// Entrada: eventos MESSAGES_UPSERT do webhook da Evolution → chamados/comentários.
// Porte fiel do canal do Helpdesk TEG (whatsapp-worker/src/whatsapp.js), trocando
// o objeto `msg` do whatsapp-web.js pelo payload Baileys que a Evolution entrega.
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'
import { sendWhatsApp, getBase64FromMediaMessage } from './evolution.js'
import { aiEnabled, forwardToAI } from './ai.js'

// ─── Anti-spam (portado) ─────────────────────────────────────────────────────
const SPAM_STRONG = [/cassino/i, /apostas?/i, /\bbet\b/i, /b[oô]nus de boas[-\s]vindas/i, /pix premiad/i, /ganhe\s+r\$/i, /promo[çc][aã]o rel[aâ]mpago/i]
const SPAM_WEAK = [/\bvip\b/i, /pr[eê]mio/i, /sorteio/i, /clique aqui/i, /link na bio/i, /investimento/i]
function isSpam(body, digits) {
  const text = String(body || '')
  if (!text.trim()) return false // só mídia nunca é spam
  let strong = 0, weak = 0
  for (const r of SPAM_STRONG) if (r.test(text)) strong++
  for (const r of SPAM_WEAK) if (r.test(text)) weak++
  const estrangeiro = digits && !digits.startsWith('55')
  return strong >= 1 || weak >= 2 || (weak >= 1 && estrangeiro)
}

// ─── Mini-fluxo "de qual setor?" (em memória, TTL 15 min) ────────────────────
// O bridge é um processo persistente (como o worker era), então o Map continua ok.
const pendingSector = new Map() // key=digits → { solicitanteId, contatoExterno, firstText, media, tries, ts }
const PENDING_TTL = 15 * 60 * 1000
function gcPending() {
  const now = Date.now()
  for (const [k, v] of pendingSector) if (now - v.ts > PENDING_TTL) pendingSector.delete(k)
}
function normalize(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() }
function matchSector(text, sectors) {
  const t = normalize(text)
  const num = parseInt(t, 10)
  if (!Number.isNaN(num) && num >= 1 && num <= sectors.length) return sectors[num - 1]
  return sectors.find((s) => normalize(s.nome) === t)
    || sectors.find((s) => t.length >= 3 && normalize(s.nome).includes(t))
    || null
}
// "Oi", "Bom dia" e afins não descrevem problema nenhum: sem isso o chamado
// nasce intitulado com a saudação e a equipe tem que perguntar tudo do zero.
const SAUDACAO = /^(oi+|ola+|opa+|e ai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|blz|beleza|ei|hey)[\s!,.?]*$/
function relatoInsuficiente(t) {
  const s = String(t || '').trim()
  if (!s) return true
  if (SAUDACAO.test(normalize(s))) return true
  return [...s].length < 10
}

function sectorQuestion(sectors) {
  const lines = sectors.map((s, i) => `${i + 1}. ${s.nome}`).join('\n')
  return `👋 Olá! Para abrir seu chamado, de qual setor você está falando?\n\n${lines}\n\nResponda com o número ou o nome do setor.`
}

// ─── Payload Baileys → texto/mídia ───────────────────────────────────────────
function cleanMime(m) { return String(m || '').split(';')[0].trim() || null }
function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/3gpp': '.3gp', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a', 'application/pdf': '.pdf',
  }
  return map[mime] || ''
}

const ROTULO_MIDIA = { audio: 'um áudio', image: 'uma imagem', video: 'um vídeo', document: 'um documento', sticker: 'uma figurinha' }

// Desembrulha wrappers (efêmera, visualização única) até a mensagem real.
function unwrap(message) {
  let m = message || {}
  for (let i = 0; i < 3; i++) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message
      || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message
    if (!inner) break
    m = inner
  }
  return m
}

function extractText(m) {
  return (m.conversation || m.extendedTextMessage?.text || '').trim()
}

// Texto da mensagem CITADA (quando a pessoa usa "Responder" do WhatsApp).
// Serve SÓ para achar o CH-xxxx: se entrasse no corpo, a nossa própria
// mensagem viraria a descrição do chamado.
function extractQuotedText(m) {
  const ctx = m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo
    || m.videoMessage?.contextInfo || m.documentMessage?.contextInfo || m.audioMessage?.contextInfo
  const q = ctx?.quotedMessage
  if (!q) return ''
  const i = unwrap(q)
  return (i.conversation || i.extendedTextMessage?.text
    || i.imageMessage?.caption || i.videoMessage?.caption || '').trim()
}

function detectMedia(m) {
  if (m.imageMessage) return { kind: 'image', mime: cleanMime(m.imageMessage.mimetype) || 'image/jpeg', filename: null, caption: (m.imageMessage.caption || '').trim() }
  if (m.videoMessage) return { kind: 'video', mime: cleanMime(m.videoMessage.mimetype) || 'video/mp4', filename: null, caption: (m.videoMessage.caption || '').trim() }
  if (m.audioMessage) return { kind: 'audio', mime: cleanMime(m.audioMessage.mimetype) || 'audio/ogg', filename: null, caption: '' }
  if (m.documentMessage) return { kind: 'document', mime: cleanMime(m.documentMessage.mimetype), filename: (m.documentMessage.fileName || '').trim() || null, caption: (m.documentMessage.caption || '').trim() }
  if (m.stickerMessage) return { kind: 'sticker', mime: cleanMime(m.stickerMessage.mimetype) || 'image/webp', filename: null, caption: '' }
  return null
}

// base64 embutido pelo webhook (opção base64=true) ou buscado na Evolution.
async function fetchMediaBuffer(raw, info) {
  let b64 = raw?.message?.base64 || raw?.base64 || null
  if (!b64 && raw?.key?.id) {
    const r = await getBase64FromMediaMessage(raw.key)
    if (r?.base64) {
      b64 = r.base64
      if (!info.mime && r.mimetype) info.mime = cleanMime(r.mimetype)
      if (!info.filename && r.fileName) info.filename = r.fileName
    }
  }
  if (!b64) return null
  const clean = String(b64).replace(/^data:[^;]+;base64,/, '')
  try { return Buffer.from(clean, 'base64') } catch { return null }
}

// Resolve o remetente 1:1 → dígitos do telefone. null = ignorar (grupo/status/etc).
function resolveSender(raw) {
  const key = raw?.key || {}
  let jid = String(key.remoteJid || '')
  if (jid.endsWith('@lid')) {
    // Evolution 2.3.7 normalmente já troca remoteJid @lid pelo remoteJidAlt antes
    // do webhook; se chegou @lid aqui, o alt não veio — sem telefone não há como
    // atender, mas o descarte precisa ficar visível no log (é conversa 1:1 real).
    jid = String(key.remoteJidAlt || '')
    if (!jid.endsWith('@s.whatsapp.net')) {
      err('mensagem @lid sem remoteJidAlt — descartada:', String(key.remoteJid), String(key.id || ''))
      return null
    }
  }
  if (!jid.endsWith('@s.whatsapp.net')) return null
  const digits = db.onlyDigits(jid.split('@')[0])
  if (!digits) return null
  const name = String(raw?.pushName || '').trim() || `WhatsApp ${digits.slice(-4)}`
  return { digits, name }
}

// ─── Entrada ─────────────────────────────────────────────────────────────────
export async function handleMessagesUpsert(data) {
  // A Evolution emite 1 mensagem por evento; tolera formatos em lote por segurança.
  const items = Array.isArray(data) ? data
    : Array.isArray(data?.messages) ? data.messages
      : data ? [data] : []
  let firstErr = null
  for (const raw of items) {
    try { await handleOne(raw) } catch (e) { err('handleOne', e.stack || e.message); firstErr ??= e }
  }
  // Propaga a falha p/ a rota responder 500 → Evolution reentrega; o dedup ignora
  // os itens que já foram processados. Sem isso a mensagem se perderia em silêncio.
  if (firstErr) throw firstErr
}

// Resposta que a equipe digitou no celular (ou WhatsApp Web) em vez de usar o
// painel: registra no chamado para a conversa não ficar só no aparelho.
// O que o próprio bridge envia já está anotado em ti_whatsapp_mensagens
// (marcarEnviada), então o claim abaixo falha e a mensagem é ignorada — é isso
// que separa "digitado à mão" de "enviado pelo sistema".
async function handleFromMe(raw) {
  const key = raw.key
  const msgId = String(key.id || '')
  if (!msgId) return
  let jid = String(key.remoteJid || '')
  if (jid.endsWith('@lid')) jid = String(key.remoteJidAlt || '')
  if (!jid.endsWith('@s.whatsapp.net')) return // grupo/status/etc
  const digits = db.onlyDigits(jid.split('@')[0])
  if (!digits) return

  const m = unwrap(raw.message)
  const mediaInfo = detectMedia(m)
  const texto = extractText(m) || mediaInfo?.caption || ''
  if (!texto && !mediaInfo) return // reação/protocolo — nada a registrar

  if (!(await db.claimMensagem(msgId))) return // enviada pelo próprio bridge

  const telKey = db.phoneKey(digits)
  const known = await db.findRequesterByPhone(digits)
  const ticket = await db.findConversaAtiva({
    solicitanteId: known ? known.id : null,
    telKey: known ? null : telKey,
    janelaMin: config.janelaMin,
  })
  if (!ticket) { log(`resposta manual sem chamado aberto (${digits}) — não registrada`); return }

  const suporteId = await db.getSuportePerfilId()

  // Anexo enviado pelo atendente (print de solução, manual, áudio explicando)
  // entra no chamado igual ao do solicitante — senão o histórico fica pela metade.
  let media = null
  if (mediaInfo) {
    const buffer = await fetchMediaBuffer(raw, mediaInfo)
    if (buffer && buffer.length > 0) {
      media = { buffer, mime: mediaInfo.mime, filename: mediaInfo.filename || `anexo${extFromMime(mediaInfo.mime)}` }
      await db.saveAttachment({ chamadoId: ticket.id, autorId: suporteId, buffer, filename: media.filename, mime: media.mime })
    } else {
      err('mídia do atendente sem conteúdo (base64 indisponível):', msgId)
    }
  }

  let mensagem = texto
  if (!mensagem) mensagem = media ? `📎 Enviou um anexo pelo WhatsApp: ${media.filename}` : ''
  else if (mediaInfo && !media) mensagem += '\n\n⚠️ Um anexo foi enviado pelo WhatsApp, mas não pôde ser baixado.'
  if (mensagem) await db.addComment({ chamadoId: ticket.id, autorId: suporteId, mensagem })
  await db.vincularMensagemAoChamado(msgId, ticket.id)
  log(`+resposta do celular em CH-${ticket.numero} (${digits})${media ? ' [com anexo]' : ''}`)
}

async function handleOne(raw) {
  const key = raw?.key
  if (!key) return
  if (key.fromMe) { await handleFromMe(raw); return }
  const sender = resolveSender(raw)
  if (!sender) return
  const { digits, name } = sender

  const m = unwrap(raw.message)
  const mediaInfo = detectMedia(m)
  const body = extractText(m) || mediaInfo?.caption || ''
  const quoted = extractQuotedText(m)
  if (!body && !mediaInfo) return // reação/protocolo/etc — nada a fazer
  if (isSpam(body, digits)) { log('spam descartado:', digits); return }

  // Dedup (webhook é at-least-once): claim atômico; reentrega é ignorada.
  const msgId = String(key.id || '')
  if (msgId) {
    const fresh = await db.claimMensagem(msgId)
    if (!fresh) { log('reentrega ignorada:', msgId); return }
  }

  // O claim só é desfeito se NENHUMA escrita aconteceu (falha em fetch de mídia,
  // lookups etc.) — após a primeira escrita ele vira definitivo, senão a reentrega
  // duplicaria anexos/comentários já gravados.
  const efeitos = { commit: false }
  try {
    await processMessage({ raw, digits, name, body, quoted, mediaInfo, msgId, efeitos })
  } catch (e) {
    if (msgId && !efeitos.commit) {
      await db.desfazerClaim(msgId).catch(() => {}) // permite retry da Evolution
    } else {
      // Claim já definitivo (houve escrita): a reentrega será ignorada e esta
      // mensagem morre aqui. Não deixar o usuário no vácuo nem a equipe sem rastro.
      err('MENSAGEM PERDIDA (falha após a 1ª escrita) — msgId:', msgId, '| de:', digits, '|', e.message)
      await sendWhatsApp({ to: digits, text: '⚠️ Tive um problema ao registrar sua última mensagem. Se você não receber a confirmação em instantes, por favor reenvie.' })
    }
    throw e
  }
}

async function processMessage({ raw, digits, name, body, quoted, mediaInfo, msgId, efeitos }) {
  gcPending()

  // baixa mídia (se houver)
  let media = null
  if (mediaInfo) {
    const buffer = await fetchMediaBuffer(raw, mediaInfo)
    if (buffer && buffer.length > 0) {
      const filename = mediaInfo.filename || `anexo${extFromMime(mediaInfo.mime)}`
      media = { buffer, mime: mediaInfo.mime, filename }
    } else {
      err('mídia sem conteúdo (base64 indisponível):', msgId)
    }
  }

  // solicitante: conhecido (funcionário) vs externo (conta de sistema + contato_externo)
  const known = await db.findRequesterByPhone(digits)
  const telKey = db.phoneKey(digits)
  let solicitanteId, contatoExterno
  if (known) { solicitanteId = known.id; contatoExterno = null }
  else { solicitanteId = await db.getExternoPerfilId(); contatoExterno = { nome: name, telefone: digits, telefone_key: telKey } }

  const sinceISO = new Date(Date.now() - config.janelaMin * 60 * 1000).toISOString()

  // chamado-alvo: (a) cita CH-xxxx → (b) conversa recente aberta
  let ticket = null
  // \b é essencial: sem ele "o switch 8 caiu" viraria comentário no CH-0008
  // de outra pessoa (o mesmo vale para patch/touch/match + número).
  // O texto CITADO (responder do WhatsApp) entra só aqui, para achar o número —
  // nunca no corpo, senão nossa própria mensagem viraria a descrição.
  const cit = body.match(/\bCH[-\s]?(\d+)/i) || String(quoted || '').match(/\bCH[-\s]?(\d+)/i)
  const citNum = cit ? parseInt(cit[1], 10) : null
  if (citNum) ticket = await db.findTicketByNumero(citNum)
  // Citou um CH que NÃO está aberto (resolvido/fechado/número errado): não pode
  // cair nos fallbacks — a mensagem iria parar em OUTRO chamado, e o ramo de
  // comentário não responde nada (o usuário ficaria no silêncio). Vira conversa
  // nova, que ao menos confirma o número do chamado criado.
  if (!ticket && !citNum) {
    ticket = await db.findConversaAtiva({
      solicitanteId: known ? solicitanteId : null,
      telKey: known ? null : telKey,
      janelaMin: config.janelaMin,
    })
  }
  // Fora da janela normal, ainda reancora em chamado 'aguardando_usuario':
  // esse status é literalmente "a equipe espera a resposta do solicitante", e
  // ela costuma vir horas/dias depois do aviso — sem isso viraria chamado novo.
  if (!ticket && !citNum) {
    const aguardandoISO = new Date(Date.now() - config.aguardandoJanelaMin * 60 * 1000).toISOString()
    ticket = known
      ? await db.findAguardandoTicketForRequester(solicitanteId, aguardandoISO)
      : await db.findAguardandoTicketForPhone(telKey, aguardandoISO)
  }

  if (ticket) {
    efeitos.commit = true // primeira escrita a seguir — claim definitivo
    if (media) await db.saveAttachment({ chamadoId: ticket.id, autorId: solicitanteId, buffer: media.buffer, filename: media.filename, mime: media.mime })
    let texto = body || (media ? `📎 Enviou um anexo pelo WhatsApp: ${media.filename}` : '')
    // Mídia detectada mas sem conteúdo (download falhou): registrar mesmo assim.
    // Sem isso um áudio sem legenda some por completo — nada é gravado, o
    // usuário não é avisado e o log ainda diz "+coment".
    if (mediaInfo && !media) {
      const rotulo = ROTULO_MIDIA[mediaInfo.kind] || 'um anexo'
      const alerta = `⚠️ O solicitante enviou ${rotulo} pelo WhatsApp, mas o arquivo não pôde ser baixado. Peça para reenviar.`
      texto = texto ? `${texto}\n\n${alerta}` : alerta
    }
    if (texto) await db.addComment({ chamadoId: ticket.id, autorId: solicitanteId, mensagem: texto })
    if (msgId) await db.vincularMensagemAoChamado(msgId, ticket.id)
    log(`+coment CH-${ticket.numero} (${digits})`)
    return
  }

  // Conversa NOVA: o padrão é o fluxo clássico (pergunta o setor → abre o
  // chamado na hora). Só encaminha para a IA se ela estiver explicitamente
  // ligada como 1ª linha (AI_PRIMEIRA_LINHA=true).
  if (config.aiPrimeiraLinha && aiEnabled() && !media && body && !pendingSector.has(digits)) {
    const assumiu = await forwardToAI({ digits, name, conhecido: !!known, texto: body, msgId })
    if (assumiu) { log(`→ agente IA (${digits})`); return }
    err('agente IA indisponível — seguindo fluxo clássico:', digits)
  }

  // contato novo → pergunta o setor antes de abrir
  const sectors = await db.listActiveSectors()
  if (sectors.length === 0) {
    await abrirChamado({ solicitanteId, contatoExterno, body, media, setorId: null, to: digits, msgId, efeitos })
    return
  }
  const pend = pendingSector.get(digits)
  if (!pend) {
    // Sem pendência = 1ª mensagem OU o estado se perdeu (deploy/restart/TTL de
    // 15 min). Texto que é SÓ um setor ("5", "RH") é resposta a uma pergunta
    // nossa: o relato original vivia só na memória e sumiu. Não pode virar a
    // descrição do chamado — assume a perda e pede o relato de novo.
    const orfao = !media && !!body && !!matchSector(body, sectors)
    if (orfao) err('mini-fluxo: estado perdido (restart/TTL) —', digits)
    pendingSector.set(digits, { solicitanteId, contatoExterno, firstText: orfao ? '' : body, media, tries: 0, ts: Date.now() })
    await sendWhatsApp({
      to: digits,
      text: orfao
        ? `Desculpe, me perdi aqui 😅 Pode me contar de novo, em uma mensagem, o que está acontecendo?\n\n${sectorQuestion(sectors)}`
        : sectorQuestion(sectors),
    })
    return
  }
  // Fase "conte o problema": a pessoa já escolheu o setor mas só tinha
  // cumprimentado. Esta mensagem É o relato — abre o chamado com ela.
  if (pend.aguardandoRelato) {
    pendingSector.delete(digits)
    await abrirChamado({
      solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno,
      body: body || pend.firstText, media: pend.media || media,
      setorId: pend.setorId, to: digits, msgId, efeitos,
    })
    return
  }

  const chosen = matchSector(body, sectors)
  if (chosen) {
    // Setor escolhido, mas sem relato ("Bom dia" + "8"): pergunta o problema
    // antes de abrir, senão o chamado nasce com a saudação no título.
    if (relatoInsuficiente(pend.firstText) && !pend.media && !media) {
      pend.aguardandoRelato = true
      pend.setorId = chosen.id
      pend.ts = Date.now()
      await sendWhatsApp({ to: digits, text: `Certo, *${chosen.nome}* 👍\n\nAgora me conta rapidamente: o que está acontecendo?` })
      return
    }
    pendingSector.delete(digits)
    // `pend.media || media`: divergência INTENCIONAL do worker — mídia enviada
    // junto com a resposta de setor é anexada (o worker a descartava).
    await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media || media, setorId: chosen.id, to: digits, msgId, efeitos })
  } else {
    // Texto que não casa com setor quase sempre É a descrição do problema: o
    // usuário cumprimentou primeiro ("Bom dia") e só agora contou o caso.
    // ACUMULA em vez de descartar — sem isso o chamado nascia intitulado "Oi".
    if (body) pend.firstText = pend.firstText ? `${pend.firstText}\n${body}` : body
    if (!pend.media && media) pend.media = media
    pend.tries += 1; pend.ts = Date.now()
    if (pend.tries >= 2) {
      pendingSector.delete(digits)
      await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media, setorId: null, to: digits, msgId, efeitos })
    } else {
      await sendWhatsApp({ to: digits, text: `Anotei sua mensagem 👍 Só falta o setor para eu direcionar:\n\n${sectorQuestion(sectors)}` })
    }
  }
}

async function abrirChamado({ solicitanteId, contatoExterno, body, media, setorId, to, msgId, efeitos }) {
  const cat = await db.firstActiveCategory()
  if (!cat) {
    err('sem categoria ativa — não dá pra abrir chamado')
    await sendWhatsApp({ to, text: '⚠️ Não consegui abrir seu chamado agora. Tente novamente mais tarde.' })
    return
  }
  const raw = (body || '').trim()
  // Conta CARACTERES (code points), não unidades UTF-16: os CHECKs do banco
  // usam length() do Postgres. "👍🏽" tem raw.length 4 mas 2 caracteres — pelo
  // critério antigo virava título e o insert estourava o CHECK (>= 3).
  const rawLen = [...raw].length
  const titulo = rawLen >= 4 ? [...raw].slice(0, 80).join('') : 'Atendimento via WhatsApp'
  // descricao precisa satisfazer o CHECK ti_chamados_descricao_check (mín. ~5 chars):
  // textos curtos ("oi") ganham prefixo; só-mídia usa o texto padrão.
  const descricao = rawLen >= 5
    ? raw
    : media
      ? '(mensagem com mídia — ver anexos)'
      : `Atendimento via WhatsApp: ${raw || '(sem texto)'}`
  if (efeitos) efeitos.commit = true // primeira escrita — claim definitivo
  const { id, numero: n } = await db.createTicket({ titulo, descricao, categoria: cat.nome, categoriaId: cat.id, setorId, solicitanteId, contatoExterno })
  if (media) await db.saveAttachment({ chamadoId: id, autorId: solicitanteId, buffer: media.buffer, filename: media.filename, mime: media.mime })
  if (msgId) await db.vincularMensagemAoChamado(msgId, id)
  log(`novo CH-${n} (${to})`)
  await sendWhatsApp({ to, text: `✅ Abrimos seu chamado *CH-${String(n).padStart(4, '0')}*. Nossa equipe de T.I. já foi avisada e responde por aqui mesmo. 🙌` })
}
