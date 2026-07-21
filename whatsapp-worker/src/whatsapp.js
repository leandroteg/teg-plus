// Cliente WhatsApp (whatsapp-web.js) + handlers de entrada/saída.
// Porte fiel do canal do Helpdesk TEG, gravando direto no Supabase via db.js.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import qrcode from 'qrcode'
import qrcodeTerminal from 'qrcode-terminal'
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_PATH = path.resolve(__dirname, '../.wwebjs_auth')

let client = null
let status = 'disconnected'
let numero = null
let starting = false

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
function sectorQuestion(sectors) {
  const lines = sectors.map((s, i) => `${i + 1}. ${s.nome}`).join('\n')
  return `👋 Olá! Para abrir seu chamado, de qual setor você está falando?\n\n${lines}\n\nResponda com o número ou o nome do setor.`
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/3gpp': '.3gp', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a', 'application/pdf': '.pdf',
  }
  return map[mime] || ''
}

async function resolveSender(msg) {
  let phone = ''
  let name = ''
  try {
    const contact = await msg.getContact()
    name = contact?.pushname || contact?.name || ''
    const sid = contact?.id?._serialized || ''
    if (sid.endsWith('@c.us')) phone = sid.replace('@c.us', '')
  } catch { /* ignora */ }
  if (!phone) phone = String(msg.from || '').replace(/@.*/, '')
  const digits = db.onlyDigits(phone)
  return { phone: digits, name: name || `WhatsApp ${digits.slice(-4)}` }
}

// ─── Saída base ──────────────────────────────────────────────────────────────
export async function sendWhatsApp({ to, text }) {
  if (!client || status !== 'ready') { log('[saída-stub] canal não pronto →', to, String(text).slice(0, 50)); return }
  let digits = db.onlyDigits(to)
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = '55' + digits
  try {
    const numberId = await client.getNumberId(digits)
    if (!numberId) { log('número sem WhatsApp:', digits); return }
    await client.sendMessage(numberId._serialized, text)
  } catch (e) { err('sendWhatsApp', e.message) }
}

// ─── Entrada ─────────────────────────────────────────────────────────────────
async function handleInbound(msg) {
  try {
    if (msg.fromMe || msg.isStatus) return
    const from = String(msg.from || '')
    if (!from.endsWith('@c.us') && !from.endsWith('@lid')) return // só conversas 1:1
    const body = (msg.body || '').trim()
    if (!body && !msg.hasMedia) return

    const { phone, name } = await resolveSender(msg)
    const digits = db.onlyDigits(phone)
    if (!digits) return
    if (isSpam(body, digits)) { log('spam descartado:', digits); return }

    gcPending()

    // baixa mídia (se houver)
    let media = null
    if (msg.hasMedia) {
      try {
        const m = await msg.downloadMedia()
        if (m && m.data) media = { buffer: Buffer.from(m.data, 'base64'), mime: m.mimetype, filename: m.filename || `anexo${extFromMime(m.mimetype)}` }
      } catch (e) { err('downloadMedia', e.message) }
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
    const cit = body.match(/CH[-\s]?(\d+)/i)
    if (cit) ticket = await db.findTicketByNumero(parseInt(cit[1], 10))
    if (!ticket) {
      ticket = known
        ? await db.findRecentOpenTicketForRequester(solicitanteId, sinceISO)
        : await db.findRecentOpenTicketForPhone(telKey, sinceISO)
    }

    if (ticket) {
      if (media) await db.saveAttachment({ chamadoId: ticket.id, autorId: solicitanteId, buffer: media.buffer, filename: media.filename, mime: media.mime })
      const texto = body || (media ? `📎 Enviou um anexo pelo WhatsApp: ${media.filename}` : '')
      if (texto) await db.addComment({ chamadoId: ticket.id, autorId: solicitanteId, mensagem: texto })
      log(`+coment CH-${ticket.numero} (${digits})`)
      return
    }

    // contato novo → pergunta o setor antes de abrir
    const sectors = await db.listActiveSectors()
    if (sectors.length === 0) {
      await abrirChamado({ solicitanteId, contatoExterno, body, media, setorId: null, to: digits })
      return
    }
    const pend = pendingSector.get(digits)
    if (!pend) {
      pendingSector.set(digits, { solicitanteId, contatoExterno, firstText: body, media, tries: 0, ts: Date.now() })
      await sendWhatsApp({ to: digits, text: sectorQuestion(sectors) })
      return
    }
    const chosen = matchSector(body, sectors)
    if (chosen) {
      pendingSector.delete(digits)
      await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media, setorId: chosen.id, to: digits })
    } else {
      pend.tries += 1; pend.ts = Date.now()
      if (pend.tries >= 2) {
        pendingSector.delete(digits)
        await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media, setorId: null, to: digits })
      } else {
        await sendWhatsApp({ to: digits, text: `Não entendi 🤔.\n\n${sectorQuestion(sectors)}` })
      }
    }
  } catch (e) { err('handleInbound', e.stack || e.message) }
}

async function abrirChamado({ solicitanteId, contatoExterno, body, media, setorId, to }) {
  const cat = await db.firstActiveCategory()
  if (!cat) {
    err('sem categoria ativa — não dá pra abrir chamado')
    await sendWhatsApp({ to, text: '⚠️ Não consegui abrir seu chamado agora. Tente novamente mais tarde.' })
    return
  }
  const raw = (body || '').trim()
  const titulo = raw.length >= 4 ? raw.slice(0, 80) : 'Atendimento via WhatsApp'
  // descricao precisa satisfazer o CHECK ti_chamados_descricao_check (mín. ~5 chars):
  // textos curtos ("oi") ganham prefixo; só-mídia usa o texto padrão.
  const descricao = raw.length >= 5
    ? raw
    : media
      ? '(mensagem com mídia — ver anexos)'
      : `Atendimento via WhatsApp: ${raw || '(sem texto)'}`
  const { id, numero: n } = await db.createTicket({ titulo, descricao, categoria: cat.nome, categoriaId: cat.id, setorId, solicitanteId, contatoExterno })
  if (media) await db.saveAttachment({ chamadoId: id, autorId: solicitanteId, buffer: media.buffer, filename: media.filename, mime: media.mime })
  log(`novo CH-${n} (${to})`)
  await sendWhatsApp({ to, text: `✅ Abrimos seu chamado *CH-${String(n).padStart(4, '0')}*. Nossa equipe de T.I. já foi avisada e responde por aqui mesmo. 🙌` })
}

// ─── Ciclo de vida do cliente ────────────────────────────────────────────────
function setStatus(s) { status = s; db.syncStatus({ status: s }).catch(() => {}) }
export function getStatus() { return { status, numero } }

export async function startClient() {
  if (starting || (client && status === 'ready')) return
  starting = true
  try {
    const mod = await import('whatsapp-web.js')
    const wweb = mod.default ?? mod
    const { Client, LocalAuth } = wweb
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    })
    setStatus('initializing')

    client.on('qr', async (qr) => {
      setStatus('qr')
      log('Escaneie o QR abaixo (ou em /ti → Configurações → WhatsApp):')
      qrcodeTerminal.generate(qr, { small: true })
      try { const url = await qrcode.toDataURL(qr); await db.syncStatus({ status: 'qr', qr: url }) } catch (e) { err('qr', e.message) }
    })
    client.on('authenticated', () => log('autenticado.'))
    client.on('auth_failure', (m) => { err('auth_failure', m); setStatus('auth_failure') })
    client.on('ready', async () => {
      numero = client?.info?.wid?.user || null
      setStatus('ready')
      log('WhatsApp conectado como', numero)
      await db.syncStatus({ status: 'ready', qr: null, numero })
    })
    client.on('disconnected', async (reason) => {
      err('desconectado:', reason)
      setStatus('disconnected')
      await db.syncStatus({ status: 'disconnected', qr: null })
      setTimeout(() => { startClient().catch((e) => err('reconnect', e.message)) }, 5000)
    })
    client.on('message', handleInbound)

    await client.initialize()
  } catch (e) {
    err('startClient', e.stack || e.message)
    setStatus('auth_failure')
  } finally {
    starting = false
  }
}

export async function stopClient() {
  try {
    if (client) { await client.logout().catch(() => {}); await client.destroy().catch(() => {}) }
  } catch { /* ignora */ }
  client = null
  numero = null
  setStatus('disconnected')
  await db.syncStatus({ status: 'disconnected', qr: null, numero: null })
}

// Encerra o Chromium no shutdown SEM deslogar — preserva a sessão (.wwebjs_auth)
// para reconectar sem reescanear o QR no próximo boot.
export async function shutdownClient() {
  try { if (client) await client.destroy().catch(() => {}) } catch { /* ignora */ }
}
