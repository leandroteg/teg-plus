// Integração com o agente IA (n8n): repasse de conversas novas + endpoints
// /ai/* que servem de "tools" ao agente. O n8n NÃO guarda nenhuma chave da
// Evolution/Supabase — todo o I/O dele passa por aqui, com um token único.
import express from 'express'
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'
import { sendWhatsApp } from './evolution.js'

export function aiEnabled() {
  return Boolean(config.n8nWebhookUrl && config.aiSharedToken)
}

// bridge → n8n. true = IA assumiu a conversa; false = cair no fluxo clássico.
export async function forwardToAI(payload) {
  if (!aiEnabled()) return false
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), config.n8nTimeoutMs)
    const res = await fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ai-token': config.aiSharedToken },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) { err('forwardToAI HTTP', res.status); return false }
    return true
  } catch (e) {
    err('forwardToAI', e.message)
    return false
  }
}

function normalize(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() }

export function aiRouter() {
  const r = express.Router()

  r.use((req, res, next) => {
    if (!aiEnabled()) return res.status(404).json({ error: 'agente IA desligado' })
    if (req.get('x-ai-token') !== config.aiSharedToken) return res.status(401).json({ error: 'unauthorized' })
    next()
  })

  // Tool: lista os setores ativos (p/ a IA oferecer/validar).
  r.get('/setores', async (_req, res) => {
    try {
      const setores = await db.listActiveSectors()
      res.json({ setores: setores.map((s) => s.nome) })
    } catch (e) { err('/ai/setores', e.message); res.status(500).json({ error: 'falha ao listar setores' }) }
  })

  // Saída da IA → WhatsApp (o n8n não fala com a Evolution diretamente).
  // Falha de envio vira 502 → o retryOnFail do nó do n8n re-tenta.
  r.post('/responder', async (req, res) => {
    const { to, text } = req.body || {}
    if (!to || !text) return res.status(400).json({ error: 'to e text são obrigatórios' })
    if (!db.onlyDigits(to)) return res.status(400).json({ error: 'to sem dígitos válidos' })
    const ok = await sendWhatsApp({ to, text: String(text) })
    if (!ok) return res.status(502).json({ error: 'falha ao enviar via Evolution' })
    res.json({ ok: true })
  })

  // Tool: abre chamado com a mesma lógica do canal (solicitante conhecido vs
  // contato externo, categoria legada, CHECK de descrição, canal='whatsapp').
  r.post('/abrir-chamado', async (req, res) => {
    try {
      const { digits, name, titulo, descricao, setor } = req.body || {}
      if (!digits || !titulo || !descricao) return res.status(400).json({ error: 'digits, titulo e descricao são obrigatórios' })
      if (!/^\d{10,15}$/.test(String(digits))) return res.status(400).json({ error: 'digits inválido' })
      const known = await db.findRequesterByPhone(String(digits))
      const telKey = db.phoneKey(String(digits))
      const solicitanteId = known ? known.id : await db.getExternoPerfilId()
      const contatoExterno = known ? null : { nome: String(name || '').trim() || `WhatsApp ${String(digits).slice(-4)}`, telefone: String(digits), telefone_key: telKey }

      // Idempotência: já existe chamado aberto na mesma janela de conversa?
      // (Protege contra retry do n8n e contra o LLM chamar a tool duas vezes.)
      const sinceISO = new Date(Date.now() - config.janelaMin * 60 * 1000).toISOString()
      const existente = known
        ? await db.findRecentOpenTicketForRequester(solicitanteId, sinceISO)
        : await db.findRecentOpenTicketForPhone(telKey, sinceISO)
      if (existente) {
        log(`CH-${existente.numero} reutilizado pelo agente IA (${digits})`)
        return res.json({ numero: existente.numero, chamado: `CH-${String(existente.numero).padStart(4, '0')}`, id: existente.id, setor: null, reutilizado: true })
      }
      const sectors = await db.listActiveSectors()
      const chosen = setor
        ? sectors.find((s) => normalize(s.nome) === normalize(setor)) || sectors.find((s) => normalize(s.nome).includes(normalize(setor)))
        : null
      const cat = await db.firstActiveCategory()
      if (!cat) return res.status(500).json({ error: 'sem categoria ativa' })
      const tituloOk = String(titulo).trim().length >= 4 ? String(titulo).trim().slice(0, 80) : 'Atendimento via WhatsApp'
      const descOk = String(descricao).trim().length >= 5 ? String(descricao).trim() : `Atendimento via WhatsApp: ${String(descricao).trim() || '(sem texto)'}`
      const { id, numero } = await db.createTicket({
        titulo: tituloOk, descricao: descOk, categoria: cat.nome, categoriaId: cat.id,
        setorId: chosen?.id || null, solicitanteId, contatoExterno,
      })
      log(`novo CH-${numero} via agente IA (${digits})`)
      res.json({ numero, chamado: `CH-${String(numero).padStart(4, '0')}`, id, setor: chosen?.nome || null })
    } catch (e) { err('/ai/abrir-chamado', e.message); res.status(500).json({ error: 'falha ao abrir chamado' }) }
  })

  // Tool: status resumido de um chamado — SÓ do próprio solicitante (o digits
  // vem pinado pelo fluxo do n8n, nunca do modelo). Não-titular recebe o mesmo
  // 404 de não-existente, p/ não confirmar existência de chamados alheios.
  r.get('/status-chamado', async (req, res) => {
    try {
      const numero = parseInt(String(req.query.numero || ''), 10)
      const digits = String(req.query.digits || '')
      if (Number.isNaN(numero)) return res.status(400).json({ error: 'numero inválido' })
      if (!/^\d{10,15}$/.test(digits)) return res.status(400).json({ error: 'digits é obrigatório' })
      const t = await db.getChamadoResumo(numero)
      if (!t) return res.status(404).json({ error: 'chamado não encontrado' })
      const known = await db.findRequesterByPhone(digits)
      const dono = (known && t.solicitante_id === known.id)
        || (t.contato_externo?.telefone_key && t.contato_externo.telefone_key === db.phoneKey(digits))
      if (!dono) return res.status(404).json({ error: 'chamado não encontrado' })
      const { solicitante_id: _s, contato_externo: _c, ...pub } = t
      res.json(pub)
    } catch (e) { err('/ai/status-chamado', e.message); res.status(500).json({ error: 'falha ao consultar chamado' }) }
  })

  return r
}
