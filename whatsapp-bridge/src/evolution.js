// Cliente REST da Evolution API — a "camada de transporte" que substitui o
// whatsapp-web.js do worker antigo. Todas as chamadas usam a instância única
// configurada (config.evolutionInstance).
import { config } from './config.js'
import { log, err } from './log.js'
import { onlyDigits } from './db.js'

async function api(method, path, body) {
  const res = await fetch(`${config.evolutionUrl}${path}`, {
    method,
    headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* corpo não-JSON */ }
  if (!res.ok) {
    const detail = json ? JSON.stringify(json).slice(0, 300) : text.slice(0, 300)
    throw new Error(`Evolution ${method} ${path} → HTTP ${res.status}: ${detail}`)
  }
  return json
}

// ─── Envio ───────────────────────────────────────────────────────────────────
// Retorna true/false — o /ai/responder usa o retorno p/ acionar o retry do n8n;
// os demais chamadores ignoram (mesmo comportamento de antes).
export async function sendWhatsApp({ to, text }) {
  let digits = onlyDigits(to)
  if (!digits) return false
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) digits = '55' + digits
  try {
    await api('POST', `/message/sendText/${config.evolutionInstance}`, { number: digits, text })
    return true
  } catch (e) { err('sendWhatsApp', e.message); return false }
}

// ─── Estado/ciclo de vida da instância ───────────────────────────────────────
// GET /instance/connectionState → { instance: { instanceName, state } }
export async function connectionState() {
  const r = await api('GET', `/instance/connectionState/${config.evolutionInstance}`)
  return r?.instance?.state ?? null // 'open' | 'connecting' | 'close'
}

// Número conectado (ownerJid) — null se não conectado.
export async function ownerNumber() {
  const r = await api('GET', `/instance/fetchInstances?instanceName=${config.evolutionInstance}`)
  const inst = Array.isArray(r) ? r.find((i) => i?.name === config.evolutionInstance) ?? r[0] : r
  const jid = inst?.ownerJid || ''
  return onlyDigits(String(jid).split('@')[0]) || null
}

// Inicia conexão; se desconectado, retorna QR ({ base64, code }).
export async function connectInstance() {
  const r = await api('GET', `/instance/connect/${config.evolutionInstance}`)
  return r?.base64 ? { qr: r.base64 } : {}
}

export async function logoutInstance() {
  try { await api('DELETE', `/instance/logout/${config.evolutionInstance}`) }
  catch (e) { err('logoutInstance', e.message) }
}

// ─── Mídia ───────────────────────────────────────────────────────────────────
// Fallback quando o webhook não traz o base64 embutido.
// POST /chat/getBase64FromMediaMessage → { base64, mimetype?, fileName?, ... }
export async function getBase64FromMediaMessage(key) {
  try {
    return await api('POST', `/chat/getBase64FromMediaMessage/${config.evolutionInstance}`, {
      message: { key: { id: key.id } },
      convertToMp4: false,
    })
  } catch (e) { err('getBase64FromMediaMessage', e.message); return null }
}
