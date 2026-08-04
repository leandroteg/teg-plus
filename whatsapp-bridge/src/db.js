// Todas as operações no Supabase (escritas/leituras nas tabelas ti_* e sys_perfis).
// Os triggers do banco cuidam de atividade, notificação, SLA e numeração — aqui
// fazemos inserts simples, espelhando a camada de dados do app.
// Portado do whatsapp-worker sem mudanças, + dedup de webhooks (ti_whatsapp_mensagens).
import { randomUUID } from 'node:crypto'
import { supabase } from './supabase.js'
import { config } from './config.js'
import { log, err } from './log.js'

const ABERTOS = ['aberto', 'em_atendimento', 'aguardando_usuario']

export function onlyDigits(s) { return String(s || '').replace(/\D/g, '') }
export function phoneKey(s) { const d = onlyDigits(s); return d.length >= 8 ? d.slice(-8) : '' }
function one(x) { return Array.isArray(x) ? x[0] : x }

// ─── Conta de sistema (solicitante dos contatos externos) ────────────────────
let externoIdCache = null
export async function getExternoPerfilId() {
  if (externoIdCache) return externoIdCache
  const { data, error } = await supabase.from('sys_perfis').select('id').eq('email', config.externoEmail).maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Conta de sistema externa não encontrada (${config.externoEmail}). Aplique a migração ti_whatsapp_canal_controle_e_conta_externa.`)
  externoIdCache = data.id
  return data.id
}

// Casa o telefone com um funcionário cadastrado (últimos 8 dígitos). null se não achar.
export async function findRequesterByPhone(phone) {
  const key = phoneKey(phone)
  if (!key) return null
  const { data, error } = await supabase.from('sys_perfis').select('id, nome, telefone').not('telefone', 'is', null)
  if (error) throw error
  const found = (data ?? []).find((u) => phoneKey(u.telefone) === key)
  return found ? { id: found.id, nome: found.nome } : null
}

// ─── Metadados ───────────────────────────────────────────────────────────────
export async function listActiveSectors() {
  const { data, error } = await supabase.from('ti_setores').select('id, nome')
    .eq('ativo', true).order('ordem', { ascending: true }).order('nome', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function firstActiveCategory() {
  const { data, error } = await supabase.from('ti_categorias').select('id, nome')
    .eq('ativo', true).order('ordem', { ascending: true }).order('nome', { ascending: true }).limit(1).maybeSingle()
  if (error) throw error
  return data ?? null
}

// ─── Dedup de webhooks (entrega at-least-once da Evolution) ──────────────────
// Padrão "claim": tenta inserir o id da mensagem; se já existe (23505), é
// reentrega e o chamador deve ignorar. Atômico — seguro contra corrida.
export async function claimMensagem(msgId) {
  const { error } = await supabase.from('ti_whatsapp_mensagens').insert({ id: msgId })
  if (!error) return true
  if (error.code === '23505') return false // duplicada — já processada (ou em processamento)
  throw error
}

export async function desfazerClaim(msgId) {
  await supabase.from('ti_whatsapp_mensagens').delete().eq('id', msgId)
}

export async function vincularMensagemAoChamado(msgId, chamadoId) {
  const { error } = await supabase.from('ti_whatsapp_mensagens').update({ chamado_id: chamadoId }).eq('id', msgId)
  if (error) err('vincularMensagemAoChamado', error.message)
}

export async function limparMensagensAntigas(dias = 30) {
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('ti_whatsapp_mensagens').delete().lt('recebido_em', corte)
  if (error) err('limparMensagensAntigas', error.message)
}

// ─── Chamados ────────────────────────────────────────────────────────────────
// Resumo de um chamado por número, em QUALQUER status (tool do agente IA).
// Inclui campos de titularidade — o /ai/status-chamado valida e NÃO os expõe.
export async function getChamadoResumo(numero) {
  const { data, error } = await supabase.from('ti_chamados')
    .select('numero, titulo, status, prioridade, created_at, solicitante_id, contato_externo')
    .eq('numero', numero).maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function findTicketByNumero(numero) {
  const { data, error } = await supabase.from('ti_chamados').select('id, numero, status').eq('numero', numero).maybeSingle()
  if (error) throw error
  if (!data || !ABERTOS.includes(data.status)) return null
  return { id: data.id, numero: data.numero }
}

export async function findRecentOpenTicketForRequester(solicitanteId, sinceISO) {
  const { data, error } = await supabase.from('ti_chamados').select('id, numero, created_at')
    .eq('solicitante_id', solicitanteId).in('status', ABERTOS).gte('created_at', sinceISO)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, numero: data.numero } : null
}

export async function findRecentOpenTicketForPhone(key, sinceISO) {
  if (!key) return null
  const { data, error } = await supabase.from('ti_chamados').select('id, numero, created_at')
    .eq('contato_externo->>telefone_key', key).in('status', ABERTOS).gte('created_at', sinceISO)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, numero: data.numero } : null
}

export async function createTicket({ titulo, descricao, categoria, categoriaId, setorId, solicitanteId, contatoExterno }) {
  const { data, error } = await supabase.from('ti_chamados').insert({
    titulo: String(titulo).slice(0, 200),
    descricao,
    categoria,                 // coluna legada NOT NULL (nome da categoria)
    categoria_id: categoriaId || null,
    setor_id: setorId || null,
    prioridade: 'media',
    solicitante_id: solicitanteId,
    canal: 'whatsapp',
    contato_externo: contatoExterno || null,
  }).select('id, numero').single()
  if (error) throw error
  return { id: data.id, numero: data.numero }
}

export async function addComment({ chamadoId, autorId, mensagem }) {
  const { error } = await supabase.from('ti_chamado_comentarios').insert({
    chamado_id: chamadoId, autor_id: autorId, mensagem, interno: false,
  })
  if (error) throw error
}

function sanitizeName(name) {
  return String(name || 'arquivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'arquivo'
}

export async function saveAttachment({ chamadoId, autorId, buffer, filename, mime }) {
  const path = `${chamadoId}/${randomUUID()}-${sanitizeName(filename)}`
  const up = await supabase.storage.from(config.bucket).upload(path, buffer, { contentType: mime || undefined, upsert: false })
  if (up.error) throw up.error
  const ins = await supabase.from('ti_chamado_anexos').insert({
    chamado_id: chamadoId, autor_id: autorId, storage_path: path,
    nome: filename || 'arquivo', mime: mime || null, tamanho_bytes: buffer.length,
  })
  if (ins.error) { await supabase.storage.from(config.bucket).remove([path]).catch(() => {}); throw ins.error }
}

// ─── Saída: respostas dos agentes → WhatsApp do solicitante ──────────────────
// Comentários novos (não internos) feitos por quem NÃO é o solicitante, em
// chamados com telefone (contato externo ou funcionário com telefone).
// Retorna { out, lastSeen }: lastSeen = created_at do último comentário LIDO
// (enviável ou não) — o chamador avança o cursor por ele, senão comentários
// filtrados seriam re-buscados p/ sempre e o canal travaria no cap de linhas.
export async function getOutboundReplies(sinceISO) {
  const { data, error } = await supabase.from('ti_chamado_comentarios')
    .select(`id, mensagem, interno, autor_id, created_at,
      chamado:ti_chamados!ti_chamado_comentarios_chamado_id_fkey(
        numero, solicitante_id, contato_externo,
        solicitante:sys_perfis!ti_chamados_solicitante_id_fkey(telefone)
      )`)
    .gt('created_at', sinceISO).eq('interno', false)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  const rows = data ?? []
  const out = []
  for (const c of rows) {
    const ch = one(c.chamado)
    if (!ch) continue
    if (c.autor_id === ch.solicitante_id) continue // o próprio solicitante comentou → não ecoar
    const sol = one(ch.solicitante)
    const tel = (ch.contato_externo && ch.contato_externo.telefone) || (sol && sol.telefone)
    if (!tel) continue
    out.push({ to: tel, numero: ch.numero, mensagem: c.mensagem, createdAt: c.created_at })
  }
  return { out, lastSeen: rows.length ? rows[rows.length - 1].created_at : null }
}

// ─── Saída: mudanças de status → WhatsApp do solicitante ─────────────────────
// O trigger do banco grava cada troca em ti_chamado_atividades
// (tipo='status', meta={de,para}). Mesmo padrão do getOutboundReplies:
// devolve lastSeen p/ o cursor avançar mesmo sobre linhas filtradas.
export async function getStatusChanges(sinceISO) {
  const { data, error } = await supabase.from('ti_chamado_atividades')
    .select(`id, meta, created_at, chamado_id,
      chamado:ti_chamados!ti_chamado_atividades_chamado_id_fkey(
        numero, contato_externo,
        solicitante:sys_perfis!ti_chamados_solicitante_id_fkey(telefone)
      )`)
    .eq('tipo', 'status').gt('created_at', sinceISO)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  const rows = data ?? []

  // Só processa chamados "esfriados": o agrupamento abaixo enxerga apenas o
  // lote deste poll, então uma cadeia de arrastos mais longa que o intervalo
  // viraria mensagens contraditórias ("em atendimento" → "voltou pra fila").
  // Corta o lote no primeiro chamado mexido há menos de statusSettleMs — ele
  // e os posteriores (junto com o cursor) ficam para o próximo ciclo.
  const ultimaDoChamado = new Map()
  for (const a of rows) ultimaDoChamado.set(a.chamado_id, a.created_at)
  const agora = Date.now()
  let corte = rows.length
  for (let i = 0; i < rows.length; i++) {
    const ultima = new Date(ultimaDoChamado.get(rows[i].chamado_id)).getTime()
    if (agora - ultima < config.statusSettleMs) { corte = i; break }
  }
  const maduras = rows.slice(0, corte)
  if (corte < rows.length) log(`status: ${rows.length - corte} mudança(s) ainda esfriando (${config.statusSettleMs / 1000}s)`)

  // Agrupa por chamado: o solicitante recebe UMA mensagem, com o status final.
  // Ida-e-volta (termina onde começou) não notifica nada.
  const porChamado = new Map()
  for (const a of maduras) {
    const ch = Array.isArray(a.chamado) ? a.chamado[0] : a.chamado
    if (!ch) continue
    const sol = Array.isArray(ch.solicitante) ? ch.solicitante[0] : ch.solicitante
    const tel = (ch.contato_externo && ch.contato_externo.telefone) || (sol && sol.telefone)
    if (!tel) continue
    const atual = porChamado.get(a.chamado_id)
    if (atual) { atual.para = a.meta?.para; atual.createdAt = a.created_at }
    else porChamado.set(a.chamado_id, { to: tel, numero: ch.numero, de: a.meta?.de, para: a.meta?.para, createdAt: a.created_at })
  }
  const out = [...porChamado.values()].filter((s) => s.para && s.para !== s.de)
  return { out, lastSeen: maduras.length ? maduras[maduras.length - 1].created_at : null }
}

// Chamado em 'aguardando_usuario' desse telefone (janela longa — é justamente
// o status em que a equipe está esperando ele responder).
export async function findAguardandoTicketForPhone(key, sinceISO) {
  if (!key) return null
  const { data, error } = await supabase.from('ti_chamados').select('id, numero, updated_at')
    .eq('contato_externo->>telefone_key', key).eq('status', 'aguardando_usuario').gte('updated_at', sinceISO)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, numero: data.numero } : null
}

export async function findAguardandoTicketForRequester(solicitanteId, sinceISO) {
  const { data, error } = await supabase.from('ti_chamados').select('id, numero, updated_at')
    .eq('solicitante_id', solicitanteId).eq('status', 'aguardando_usuario').gte('updated_at', sinceISO)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? { id: data.id, numero: data.numero } : null
}

// ─── Controle/status do canal (tabela ti_whatsapp, singleton id=1) ───────────
export async function syncStatus(patch) {
  const { error } = await supabase.from('ti_whatsapp')
    .update({ ...patch, worker_visto_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) err('syncStatus', error.message)
}

// Lê e LIMPA o comando pendente enviado pelo painel admin.
export async function pollCommand() {
  const { data, error } = await supabase.from('ti_whatsapp').select('comando, comando_payload').eq('id', 1).maybeSingle()
  if (error) { err('pollCommand', error.message); return null }
  if (!data || !data.comando) return null
  await supabase.from('ti_whatsapp').update({ comando: null, comando_payload: null, comando_em: null }).eq('id', 1)
  return { comando: data.comando, payload: data.comando_payload }
}
