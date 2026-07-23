// uso-modulos-insights — v2: análise de uso dos módulos gerada pelo SuperTEG
// (Claude na VPS), ACIONADA VIA n8n — mesmo padrão de egp-riscos-analisar.
// Deployada em produção via MCP em 2026-07-22 (verify_jwt: true).
//   create    -> coleta as métricas (RPC) e envia o contexto ao webhook n8n com
//                callback; se o n8n responder sincronamente com { analise }, grava na hora.
//   finalizar <- callback do n8n/SuperTEG com a análise estruturada; grava em sys_uso_insights.
// O create aceita: admin logado (JWT do usuário) OU service role (cron do n8n).
// O finalizar exige service role.
// Webhook padrão: https://teg-agents-n8n.nmmcas.easypanel.host/webhook/uso-modulos-insights
// (sobrescrevível pelo secret N8N_USO_INSIGHTS_WEBHOOK).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const N8N_WEBHOOK = Deno.env.get('N8N_USO_INSIGHTS_WEBHOOK') ?? 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook/uso-modulos-insights'
const CALLBACK_URL = 'https://uzfjfucrinokeuwpbeie.supabase.co/functions/v1/uso-modulos-insights'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const TIPOS = new Set(['positivo', 'negativo', 'neutro'])

// Normaliza/valida a análise vinda do SuperTEG (defensivo: o worker é externo).
function normalizarAnalise(a: unknown): Record<string, unknown> | null {
  if (!a || typeof a !== 'object') return null
  const x = a as Record<string, unknown>
  if (typeof x.resumo_executivo !== 'string' || !x.resumo_executivo.trim()) return null
  return {
    resumo_executivo: x.resumo_executivo.trim(),
    destaques: (Array.isArray(x.destaques) ? x.destaques : [])
      .filter((d: Record<string, unknown>) => d && typeof d.titulo === 'string' && typeof d.detalhe === 'string')
      .map((d: Record<string, unknown>) => ({
        tipo: TIPOS.has(String(d.tipo)) ? d.tipo : 'neutro',
        titulo: d.titulo,
        detalhe: d.detalhe,
      }))
      .slice(0, 8),
    alertas: (Array.isArray(x.alertas) ? x.alertas : []).filter((s: unknown) => typeof s === 'string').slice(0, 6),
    recomendacoes: (Array.isArray(x.recomendacoes) ? x.recomendacoes : []).filter((s: unknown) => typeof s === 'string').slice(0, 8),
  }
}

// Papel (role) do JWT do chamador — para exigir service_role no callback.
function jwtRole(req: Request): string {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return String(payload.role ?? '')
  } catch {
    return ''
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const dias = [7, 30, 90].includes(body?.dias) ? body.dias : 30
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE)

    // ── Callback do n8n/SuperTEG ────────────────────────────────────────────
    if (body.action === 'finalizar') {
      if (jwtRole(req) !== 'service_role') return json({ ok: false, motivo: 'Não autorizado' }, 401)
      if (body.erro) return json({ ok: true, ignorado: true, motivo: String(body.erro) })
      const analise = normalizarAnalise(body.analise)
      if (!analise) return json({ ok: false, motivo: 'Payload de análise inválido (esperado { analise: { resumo_executivo, destaques, alertas, recomendacoes } })' }, 400)
      const { data: inserted, error } = await sb
        .from('sys_uso_insights')
        .insert({ periodo_dias: dias, payload: analise, modelo: body.modelo ?? 'SuperTEG', gerado_por: null })
        .select('id, created_at')
        .single()
      if (error) return json({ ok: false, motivo: error.message }, 500)
      return json({ ok: true, id: inserted.id, gerado_em: inserted.created_at })
    }

    // ── create: coletar métricas e acionar o n8n/SuperTEG ───────────────────
    // Cliente com o JWT do chamador: admin passa pelo is_admin() da RPC;
    // service role (cron) passa pela liberação da migração 118.
    const auth = req.headers.get('Authorization') ?? ''
    const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } })

    const [{ data: uso, error: rpcErr }, { data: metas }] = await Promise.all([
      sbUser.rpc('get_admin_uso_modulos', { p_dias: dias }),
      sb.from('sys_uso_metas').select('modulo, meta_pct'),
    ])
    if (rpcErr) return json({ ok: false, motivo: rpcErr.message }, 403)

    const metaDe = new Map((metas ?? []).map((m: { modulo: string; meta_pct: number }) => [m.modulo, m.meta_pct]))
    const usuarios = (uso.por_usuario ?? []) as Array<Record<string, unknown>>
    const comUso = usuarios.filter((u) => Number(u.total_acessos) + Number(u.total_acoes) > 0)

    const contexto = {
      periodo_dias: dias,
      resumo: uso.resumo,
      por_modulo: (uso.por_modulo ?? []).map((m: Record<string, unknown>) => ({
        ...m,
        meta_pct: metaDe.get(m.modulo as string) ?? null,
      })),
      usuarios_por_dia: uso.usuarios_por_dia,
      horas_pico: [...(uso.por_hora ?? [])]
        .sort((a: { acessos: number; acoes: number }, b: { acessos: number; acoes: number }) =>
          (b.acessos + b.acoes) - (a.acessos + a.acoes))
        .slice(0, 5),
      top_usuarios: comUso.slice(0, 10).map((u) => ({
        nome: u.nome, role: u.role, acessos: u.total_acessos, acoes: u.total_acoes,
        dias_ativos: u.dias_ativos, modulos: u.modulos_usados,
      })),
      usuarios_sem_uso: usuarios.length - comUso.length,
      ranking_telas: (uso.ranking_telas ?? []).slice(0, 10),
      ranking_acoes: (uso.ranking_acoes ?? []).slice(0, 10),
    }

    const run_id = crypto.randomUUID()
    try {
      const r = await fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id,
          dias,
          contexto,
          instrucoes:
            'Você é um analista sênior de dados de produto do ERP TEG+. Analise as métricas de uso dos módulos e produza ' +
            'insights executivos em português do Brasil. Definições: "acessos" = navegações de tela; "acoes" = escritas auditadas; ' +
            '*_prev = período anterior de mesma duração; pct_adocao = % dos usuários ativos que usou; meta_pct = meta de adoção (null = sem meta). ' +
            'Cite números, módulos e pessoas; compare com o período anterior; se os acessos forem poucos, mencione que o rastreamento é recente. ' +
            'Não invente dados. Responda SOMENTE com JSON no formato: ' +
            '{ "analise": { "resumo_executivo": "2-3 frases", "destaques": [{ "tipo": "positivo|negativo|neutro", "titulo": "...", "detalhe": "..." }], ' +
            '"alertas": ["..."], "recomendacoes": ["..."] } } — 3 a 6 destaques, 0 a 4 alertas, 2 a 5 recomendacoes.',
          callback_url: CALLBACK_URL,
        }),
      })
      const sj = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(sj.erro || sj.error || `n8n HTTP ${r.status}`)

      // n8n pode responder sincronamente com a análise pronta
      const analiseSync = normalizarAnalise(sj.analise)
      if (analiseSync) {
        const { data: inserted } = await sb
          .from('sys_uso_insights')
          .insert({ periodo_dias: dias, payload: analiseSync, modelo: sj.modelo ?? 'SuperTEG', gerado_por: null })
          .select('created_at')
          .single()
        return json({ ok: true, sincrono: true, analise: analiseSync, gerado_em: inserted?.created_at ?? new Date().toISOString() })
      }
      return json({ ok: true, processando: true, run_id })
    } catch (e) {
      return json({ ok: false, motivo: 'Não foi possível acionar o n8n/SuperTEG: ' + String(e) }, 502)
    }
  } catch (e) {
    return json({ ok: false, motivo: String(e) }, 500)
  }
})
