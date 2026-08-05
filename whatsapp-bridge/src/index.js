// Entrypoint do bridge. Sobe o servidor de webhook (Evolution → chamados),
// os loops de comando (painel → conectar/desconectar/testar) e de saída
// (respostas dos agentes → WhatsApp), e mantém ti_whatsapp em dia p/ o painel.
import express from 'express'
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'
import * as evo from './evolution.js'
import { handleMessagesUpsert } from './inbound.js'
import { aiEnabled, aiRouter } from './ai.js'

// Versão do código: vai para o log de boot E para ti_whatsapp.worker_versao,
// então dá para conferir por SQL se um deploy aplicou mesmo o código novo.
const BUILD = '1.3.0-preprod'

// Estado local espelhado em ti_whatsapp (o painel do TEG+ lê de lá).
let local = { status: 'disconnected', numero: null }
function setLocal(patch) { local = { ...local, ...patch } }

// Só espelha respostas criadas A PARTIR de agora (não reenvia histórico no boot).
let outboundCursor = new Date().toISOString()
let statusCursor = outboundCursor
let statusFalhas = 0 // ciclos consecutivos segurando o cursor por falha de envio
let saidaFalhas = 0
const STATUS_MAX_RETRIES = 5
const SAIDA_MAX_RETRIES = 5
// Intervalo entre mensagens de um mesmo lote. O número é novo e amanhã fala
// com dezenas de contatos pela 1ª vez: disparar em rajada é o padrão clássico
// de bloqueio do WhatsApp. ~40 msg/min continua muito acima do volume real.
const ENVIO_INTERVALO_MS = Number(process.env.WHATSAPP_ENVIO_INTERVALO_MS ?? 1200)
let stopped = false

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)) }

// ─── Status: eventos da Evolution → ti_whatsapp ──────────────────────────────
const STATE_MAP = { open: 'ready', connecting: 'initializing', close: 'disconnected', refused: 'disconnected' }

async function handleConnectionUpdate(d) {
  const state = d?.state || d?.connection || ''
  const status = STATE_MAP[state] || 'disconnected'
  if (status === 'ready') {
    let numero = db.onlyDigits(String(d?.wuid || '').split('@')[0]) || local.numero
    if (!numero) numero = await evo.ownerNumber().catch(() => null)
    setLocal({ status, numero })
    await db.syncStatus({ status, numero, qr: null })
  } else {
    setLocal({ status })
    await db.syncStatus({ status, ...(status === 'disconnected' ? { qr: null } : {}) })
  }
  log('conexão:', state, '→', status, local.numero ?? '')
}

async function handleQrUpdated(d) {
  const qr = d?.qrcode?.base64 || d?.base64 || null
  // Limite de QR atingido: a Evolution manda QRCODE_UPDATED sem qrcode ({ message,
  // statusCode }) e em seguida CONNECTION_UPDATE 'refused' — ignora o evento vazio.
  if (!qr) return
  setLocal({ status: 'qr' })
  await db.syncStatus({ status: 'qr', qr })
  log('QR atualizado (disponível no painel /ti → Configurações → WhatsApp)')
}

// Reconciliação: corrige drift se algum webhook se perdeu (ex.: bridge reiniciou).
async function reconcile() {
  try {
    const state = await evo.connectionState()
    const status = STATE_MAP[state] || 'disconnected'
    if (status === 'ready' && !local.numero) {
      const numero = await evo.ownerNumber().catch(() => null)
      setLocal({ status, numero })
      await db.syncStatus({ status, numero, qr: null })
    } else if (status !== local.status) {
      // QR pendente: enquanto aguarda leitura, a Evolution reporta 'connecting' —
      // não sobrescrever, senão o QR some do painel a cada ciclo do reconcile.
      if (local.status === 'qr' && state === 'connecting') return
      setLocal({ status })
      await db.syncStatus({ status, ...(status !== 'qr' ? { qr: null } : {}) })
    }
  } catch (e) { err('reconcile', e.message) }
}

// ─── Webhook (Evolution → bridge) ────────────────────────────────────────────
const app = express()
// Webhook configurado com base64 DESLIGADO (mídia é buscada via REST no fallback),
// então o payload é sempre pequeno. Margem p/ metadados grandes sem aceitar gigantes.
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, versao: BUILD, ...local }))

app.post(['/webhook', '/webhook/:ev'], async (req, res) => {
  if (config.webhookToken) {
    const t = req.get('x-webhook-token') || req.query.token
    if (t !== config.webhookToken) return res.status(401).json({ error: 'unauthorized' })
  }
  const body = req.body || {}
  const event = String(body.event || req.params.ev || '').toLowerCase().replace(/[_-]/g, '.')
  try {
    if (event === 'messages.upsert') await handleMessagesUpsert(body.data)
    else if (event === 'connection.update') await handleConnectionUpdate(body.data)
    else if (event === 'qrcode.updated') await handleQrUpdated(body.data)
    // demais eventos: 200 e ignora
    res.json({ ok: true })
  } catch (e) {
    err('webhook', event, e.stack || e.message)
    res.status(500).json({ ok: false }) // Evolution pode reentregar; dedup protege
  }
})

// Tools do agente IA (n8n) — só ativas com N8N_WEBHOOK_URL + AI_SHARED_TOKEN.
app.use('/ai', aiRouter())

// Payload acima do limite: responde 200 p/ a Evolution NÃO reentregar um evento
// que nunca vai caber (a mídia ainda é recuperável pelo fallback REST em outro evento).
app.use((e, _req, res, next) => {
  if (e?.type === 'entity.too.large') {
    err('webhook payload acima do limite — evento descartado')
    return res.status(200).json({ ok: false, dropped: true })
  }
  next(e)
})

// ─── Loops (portados do worker) ──────────────────────────────────────────────
async function loopComandos() {
  while (!stopped) {
    try {
      const cmd = await db.pollCommand()
      if (cmd) {
        log('comando do painel:', cmd.comando)
        if (cmd.comando === 'connect') {
          const r = await evo.connectInstance()
          if (r.qr) { setLocal({ status: 'qr' }); await db.syncStatus({ status: 'qr', qr: r.qr }) }
          else await reconcile()
        } else if (cmd.comando === 'disconnect') {
          await evo.logoutInstance()
          setLocal({ status: 'disconnected', numero: null })
          await db.syncStatus({ status: 'disconnected', qr: null, numero: null })
        } else if (cmd.comando === 'test' && cmd.payload?.to) {
          await evo.sendWhatsApp({ to: cmd.payload.to, text: cmd.payload.text || 'Mensagem de teste do TEG+ ✅' })
        }
      }
      await db.syncStatus(local) // heartbeat (worker_visto_em)
    } catch (e) { err('loopComandos', e.message) }
    await sleep(config.pollComandoMs)
  }
}

async function loopSaida() {
  while (!stopped) {
    try {
      const { out: replies, lastSeen } = await db.getOutboundReplies(outboundCursor)
      let falhou = false
      for (const r of replies) {
        const texto = r.doAssistente
          ? r.mensagem // aviso automático já se explica; prefixo de "resposta" enganaria
          : `*Resposta no CH-${String(r.numero).padStart(4, '0')}*\n${r.mensagem}`
        const ok = await evo.sendWhatsApp({ to: r.to, text: texto })
        if (!ok) { err(`saída CH-${r.numero}: envio falhou — segurando cursor p/ nova tentativa`); falhou = true; break }
        await sleep(ENVIO_INTERVALO_MS) // espaça a rajada
      }
      // Falha de envio NÃO avança o cursor: a resposta da equipe é retentada no
      // próximo ciclo (sem isso ela sumia em silêncio — a equipe jura que
      // respondeu e o usuário jura que não recebeu).
      if (falhou && saidaFalhas < SAIDA_MAX_RETRIES) saidaFalhas += 1
      else {
        if (falhou) err('saída: desistindo do envio após', SAIDA_MAX_RETRIES, 'tentativas')
        saidaFalhas = 0
        // Avança pelo último comentário VISTO (não só enviado): comentários filtrados
        // (autor=solicitante, chamado sem telefone) deixam de ser re-buscados a cada
        // poll — sem isso o cursor congela e, passado o cap de linhas do Supabase,
        // o canal de saída travaria de vez.
        if (lastSeen && lastSeen > outboundCursor) {
          outboundCursor = lastSeen
          await db.setCursor('cursor_saida', outboundCursor)
        }
      }
    } catch (e) { err('loopSaida', e.message) }
    await sleep(config.pollSaidaMs)
  }
}

// Avisa o solicitante quando a equipe move o chamado no Quadro (ou muda o
// status na tela do chamado). Textos curtos, no tom do canal.
// Mesma régua do canal de e-mail do produto (pages/ti/email.ts): volta para
// 'aberto' NÃO avisa — quase sempre é a equipe corrigindo o quadro, não
// reabertura de verdade.
const TEXTO_STATUS = {
  em_atendimento: (n) => `🔧 Seu chamado *CH-${n}* está em *atendimento* — nossa equipe de T.I. já está cuidando dele.`,
  aguardando_usuario: (n) => `⏳ Seu chamado *CH-${n}* está *aguardando sua resposta*. É só responder por aqui (se demorar, cite *CH-${n}* na mensagem).`,
  resolvido: (n) => `✅ Seu chamado *CH-${n}* foi *resolvido*. Se o problema voltar, responda citando *CH-${n}*.`,
  fechado: (n) => `🔒 Seu chamado *CH-${n}* foi *encerrado*. Obrigado! 🙌`,
}

async function loopStatus() {
  while (!stopped) {
    try {
      const { out: mudancas, lastSeen } = await db.getStatusChanges(statusCursor)
      let falhou = false
      for (const m of mudancas) {
        const texto = TEXTO_STATUS[m.para]
        if (!texto) continue // status sem mensagem definida → não avisa
        const ok = await evo.sendWhatsApp({ to: m.to, text: texto(String(m.numero).padStart(4, '0')) })
        if (!ok) { err(`status CH-${m.numero}: envio falhou — segurando cursor p/ nova tentativa`); falhou = true; break }
        log(`status CH-${m.numero}: ${m.de} → ${m.para} (avisado ${m.to})`)
        await sleep(ENVIO_INTERVALO_MS) // espaça a rajada (equipe arrastando vários cards)
      }
      // Falha de envio NÃO avança o cursor: o aviso é retentado no próximo
      // ciclo (perder um 'aguardando_usuario' travaria o chamado). Após
      // statusMaxRetries ciclos seguidos, desiste e segue — senão o cursor
      // ficaria preso para sempre num destinatário inválido.
      if (falhou && statusFalhas < STATUS_MAX_RETRIES) statusFalhas += 1
      else {
        if (falhou) err('status: desistindo do aviso após', STATUS_MAX_RETRIES, 'tentativas')
        statusFalhas = 0
        if (lastSeen && lastSeen > statusCursor) {
          statusCursor = lastSeen
          await db.setCursor('cursor_status', statusCursor)
        }
      }
    } catch (e) { err('loopStatus', e.message) }
    await sleep(config.pollSaidaMs)
  }
}

// Acompanhamento: o solicitante abriu (ou comentou) e a equipe não respondeu.
// Postura definida pelo negócio: NÃO tentar resolver — só dar satisfação. O
// texto é postado como comentário do assistente no chamado (a equipe vê o que
// foi dito) e o loopSaida se encarrega de entregá-lo no WhatsApp.
const TEXTO_FOLLOWUP = (n, aviso) => aviso === 1
  ? `Oi! Passando para você não ficar sem notícia: seu chamado *CH-${n}* está na fila da nossa equipe de T.I. 👍\n\nAssim que alguém assumir, a resposta chega por aqui mesmo.`
  : `Seu chamado *CH-${n}* continua na fila e ainda será respondido por aqui. Obrigado pela paciência! 🙏\n\nSe algo mudou ou ficou urgente, é só escrever — sua mensagem entra no chamado.`

async function loopFollowup() {
  if (config.followupEsperaMin <= 0) { log('acompanhamento automático: desligado'); return }
  let assistenteId = null
  while (!stopped) {
    try {
      if (!assistenteId) assistenteId = await db.getAssistentePerfilId()
      const pendentes = await db.getChamadosSemResposta({
        esperaMin: config.followupEsperaMin,
        maxAvisos: config.followupMax,
        assistenteId,
      })
      for (const p of pendentes) {
        await db.addComment({
          chamadoId: p.id,
          autorId: assistenteId,
          mensagem: TEXTO_FOLLOWUP(String(p.numero).padStart(4, '0'), p.aviso),
        })
        log(`acompanhamento CH-${p.numero} (aviso ${p.aviso}/${config.followupMax})`)
      }
    } catch (e) { err('loopFollowup', e.message) }
    await sleep(60_000)
  }
}

async function loopReconcile() {
  while (!stopped) {
    await reconcile()
    await sleep(60_000)
  }
}

async function loopLimpeza() {
  while (!stopped) {
    await db.limparMensagensAntigas(30)
    await sleep(24 * 60 * 60 * 1000)
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────
async function main() {
  log(`TEG+ WhatsApp bridge ${BUILD} iniciando…`)
  log('Supabase:', config.supabaseUrl, '| Evolution:', config.evolutionUrl, '| instância:', config.evolutionInstance)
  log('fluxo de entrada:', config.aiPrimeiraLinha && aiEnabled() ? 'IA de 1ª linha' : 'CLÁSSICO (setor → abre chamado)')
  log('endpoints /ai/*:', aiEnabled() ? 'ativos' : 'desligados')
  log(`aviso de mudança de status: LIGADO (agrupa após ${config.statusSettleMs / 1000}s de silêncio)`)
  log(`acompanhamento automático: ${config.followupEsperaMin > 0 ? `LIGADO (${config.followupEsperaMin} min, máx ${config.followupMax} avisos)` : 'desligado'}`)
  try { log('conta externa:', await db.getExternoPerfilId()) } catch (e) { err(e.message) }

  await db.syncStatus({ worker_versao: BUILD }) // carimba a versão p/ conferência por SQL

  // Retoma os cursores de onde pararam (um deploy no meio do expediente não
  // pode engolir respostas em voo), mas nunca mais que 6h atrás — se o bridge
  // ficou dias fora, reenviar tudo seria pior que perder.
  const cur = await db.getCursors()
  const piso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  if (cur?.saida && cur.saida > piso) outboundCursor = cur.saida
  if (cur?.status && cur.status > piso) statusCursor = cur.status
  log('cursores:', `saída=${outboundCursor}`, `status=${statusCursor}`)

  await reconcile()

  app.listen(config.port, () => log(`webhook ouvindo na porta ${config.port} (POST /webhook)`))

  loopComandos()
  loopSaida()
  loopStatus()
  loopFollowup()
  loopReconcile()
  loopLimpeza()
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('encerrando…')
    stopped = true
    // a sessão do WhatsApp mora na Evolution — nada a preservar aqui
    process.exit(0)
  })
}

main().catch((e) => { err('fatal', e.stack || e.message); process.exit(1) })
