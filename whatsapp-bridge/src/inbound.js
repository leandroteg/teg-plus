// Entrada: eventos MESSAGES_UPSERT do webhook da Evolution → chamados/comentários.
// Porte fiel do canal do Helpdesk TEG (whatsapp-worker/src/whatsapp.js), trocando
// o objeto `msg` do whatsapp-web.js pelo payload Baileys que a Evolution entrega.
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'
import { sendWhatsApp, getBase64FromMediaMessage } from './evolution.js'

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

async function handleOne(raw) {
  const key = raw?.key
  if (!key || key.fromMe) return
  const sender = resolveSender(raw)
  if (!sender) return
  const { digits, name } = sender

  const m = unwrap(raw.message)
  const mediaInfo = detectMedia(m)
  const body = extractText(m) || mediaInfo?.caption || ''
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
    await processMessage({ raw, digits, name, body, mediaInfo, msgId, efeitos })
  } catch (e) {
    if (msgId && !efeitos.commit) await db.desfazerClaim(msgId).catch(() => {}) // permite retry da Evolution
    throw e
  }
}

async function processMessage({ raw, digits, name, body, mediaInfo, msgId, efeitos }) {
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
  const cit = body.match(/CH[-\s]?(\d+)/i)
  if (cit) ticket = await db.findTicketByNumero(parseInt(cit[1], 10))
  if (!ticket) {
    ticket = known
      ? await db.findRecentOpenTicketForRequester(solicitanteId, sinceISO)
      : await db.findRecentOpenTicketForPhone(telKey, sinceISO)
  }

  if (ticket) {
    efeitos.commit = true // primeira escrita a seguir — claim definitivo
    if (media) await db.saveAttachment({ chamadoId: ticket.id, autorId: solicitanteId, buffer: media.buffer, filename: media.filename, mime: media.mime })
    const texto = body || (media ? `📎 Enviou um anexo pelo WhatsApp: ${media.filename}` : '')
    if (texto) await db.addComment({ chamadoId: ticket.id, autorId: solicitanteId, mensagem: texto })
    if (msgId) await db.vincularMensagemAoChamado(msgId, ticket.id)
    log(`+coment CH-${ticket.numero} (${digits})`)
    return
  }

  // contato novo → pergunta o setor antes de abrir
  const sectors = await db.listActiveSectors()
  if (sectors.length === 0) {
    await abrirChamado({ solicitanteId, contatoExterno, body, media, setorId: null, to: digits, msgId, efeitos })
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
    // `pend.media || media`: divergência INTENCIONAL do worker — mídia enviada
    // junto com a resposta de setor é anexada (o worker a descartava).
    await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media || media, setorId: chosen.id, to: digits, msgId, efeitos })
  } else {
    pend.tries += 1; pend.ts = Date.now()
    if (pend.tries >= 2) {
      pendingSector.delete(digits)
      await abrirChamado({ solicitanteId: pend.solicitanteId, contatoExterno: pend.contatoExterno, body: pend.firstText, media: pend.media || media, setorId: null, to: digits, msgId, efeitos })
    } else {
      await sendWhatsApp({ to: digits, text: `Não entendi 🤔.\n\n${sectorQuestion(sectors)}` })
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
  const titulo = raw.length >= 4 ? raw.slice(0, 80) : 'Atendimento via WhatsApp'
  // descricao precisa satisfazer o CHECK ti_chamados_descricao_check (mín. ~5 chars):
  // textos curtos ("oi") ganham prefixo; só-mídia usa o texto padrão.
  const descricao = raw.length >= 5
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
