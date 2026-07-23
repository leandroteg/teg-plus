// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/AdminHome.tsx
// Painel do administrador (/admin). Visão geral sóbria: cabeçalho compacto,
// régua de KPIs (RPC get_admin_uso_modulos + contagens leves), navegação
// agrupada em listas (Gestão / Análise / Desenvolvimento) e feed de atividade
// humana recente (sys_log_atividades). Acesso restrito via <AdminRoute>.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users, ShieldCheck, ScrollText, BarChart3, Code2, Link2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useUsoModulos } from '../../hooks/useUsoModulos'
import { supabase } from '../../services/supabase'

// ── Navegação (mesmos grupos da sidebar do AdminLayout) ───────────────────────

interface AdminItem {
  to: string
  icon: LucideIcon
  title: string
  description: string
}

interface AdminGroup {
  label: string
  items: AdminItem[]
}

const GROUPS: AdminGroup[] = [
  {
    label: 'Gestão',
    items: [
      {
        to: '/admin/usuarios', icon: Users, title: 'Usuários',
        description: 'Contas, permissões e módulos de cada colaborador',
      },
      {
        to: '/admin/politicas-aprovacao', icon: ShieldCheck, title: 'Políticas de Aprovação',
        description: 'Alçadas e fluxos de aprovação por categoria',
      },
    ],
  },
  {
    label: 'Análise',
    items: [
      {
        to: '/admin/logs', icon: ScrollText, title: 'Logs de Auditoria',
        description: 'Quem fez o quê, quando e o que mudou no sistema',
      },
      {
        to: '/admin/uso-modulos', icon: BarChart3, title: 'Uso de Módulos',
        description: 'Acessos, adoção e engajamento por módulo',
      },
    ],
  },
  {
    label: 'Desenvolvimento',
    items: [
      {
        to: '/admin/desenvolvimento', icon: Code2, title: 'Desenvolvimento',
        description: 'Roadmap, backlog e melhorias em andamento',
      },
      {
        to: '/admin/integracoes', icon: Link2, title: 'Integrações',
        description: 'Conexões com sistemas externos e configurações',
      },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_META: Record<string, { verbo: string; dot: string }> = {
  INSERT: { verbo: 'criou',   dot: 'bg-emerald-500' },
  UPDATE: { verbo: 'alterou', dot: 'bg-amber-500' },
  DELETE: { verbo: 'excluiu', dot: 'bg-rose-500' },
}

/** 'fin_contas_pagar' → 'Contas Pagar' */
function entidadeLabel(tipo: string | null): string {
  if (!tipo) return 'registro'
  return tipo
    .replace(/^[a-z]+_/, '')
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.floor(h / 24)
  return `${d} d`
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] || 'Admin'
}

interface LogRecente {
  id: string
  modulo: string
  entidade_tipo: string | null
  tipo: string
  usuario_nome: string | null
  created_at: string
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AdminHome() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()

  // KPIs de uso (7 dias) — mesma RPC admin-only do painel Uso de Módulos
  const { data: uso, isLoading: usoLoading } = useUsoModulos(7)
  const resumo = uso?.resumo

  // Usuários ativos (contagem leve, head-only)
  const { data: totalUsuarios, isLoading: usuariosLoading } = useQuery({
    queryKey: ['admin-home-usuarios-ativos'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('sys_perfis')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 5 * 60_000,
  })

  // Ações de usuários hoje (auditoria). usuario_id nulo = integrações/robôs
  // (sync de ponto, telemetria de frota etc., dezenas de milhares por dia) —
  // fora do KPI para medir atividade humana, não de máquinas.
  const { data: acoesHoje, isLoading: acoesLoading } = useQuery({
    queryKey: ['admin-home-acoes-hoje'],
    queryFn: async () => {
      const inicio = new Date()
      inicio.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('sys_log_atividades')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicio.toISOString())
        .not('usuario_id', 'is', null)
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
  })

  // Últimas atividades humanas (feed lateral) — sem usuario_id é integração
  // e afogaria o feed em "Sistema alterou X" a cada poucos minutos.
  const { data: recentes = [], isLoading: recentesLoading } = useQuery({
    queryKey: ['admin-home-logs-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_log_atividades')
        .select('id, modulo, entidade_tipo, tipo, usuario_nome, created_at')
        .not('usuario_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as LogRecente[]
    },
    staleTime: 30_000,
  })

  const deltaAcessos = resumo && resumo.acessos_prev > 0
    ? Math.round(((resumo.total_acessos - resumo.acessos_prev) / resumo.acessos_prev) * 100)
    : null

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataLonga = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // ── Tokens de tema ──────────────────────────────────────────────────────────
  const heading  = isLight ? 'text-slate-900' : 'text-slate-100'
  const body     = isLight ? 'text-slate-600' : 'text-slate-300'
  const muted    = isLight ? 'text-slate-500' : 'text-slate-400'
  const faint    = isLight ? 'text-slate-400' : 'text-slate-500'
  const hairline = isLight ? 'border-slate-200/80' : 'border-white/[0.07]'
  const divide   = isLight ? 'divide-slate-200/80' : 'divide-white/[0.07]'
  const surface  = isLight ? 'bg-white' : 'bg-white/[0.02]'
  const rowHover = isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
  const iconBox  = isLight
    ? 'bg-slate-50 border-slate-200/80 text-slate-500'
    : 'bg-white/[0.04] border-white/[0.07] text-slate-400'
  const skeleton = isLight ? 'bg-slate-100' : 'bg-white/[0.06]'

  const kpis = [
    {
      label: 'Usuários ativos',
      value: totalUsuarios?.toLocaleString('pt-BR'),
      note: 'contas habilitadas',
      loading: usuariosLoading,
    },
    {
      label: 'Ativos na semana',
      value: resumo?.usuarios_ativos_uso?.toLocaleString('pt-BR'),
      note: resumo ? `de ${resumo.base_usuarios} usuários` : '—',
      loading: usoLoading,
    },
    {
      label: 'Acessos · 7 dias',
      value: resumo?.total_acessos?.toLocaleString('pt-BR'),
      note: deltaAcessos == null ? 'últimos 7 dias' : 'vs. semana anterior',
      delta: deltaAcessos,
      loading: usoLoading,
    },
    {
      label: 'Ações hoje',
      value: acoesHoje?.toLocaleString('pt-BR'),
      note: 'por usuários, sem integrações',
      loading: acoesLoading,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div className={`flex flex-wrap items-end justify-between gap-2 border-b pb-5 ${hairline}`}>
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${faint}`}>
            Painel administrativo
          </p>
          <h1 className={`mt-1 text-xl font-semibold tracking-tight ${heading}`}>
            {saudacao}, {primeiroNome(perfil?.nome)}
          </h1>
        </div>
        <p className={`text-[12.5px] first-letter:uppercase ${muted}`}>{dataLonga}</p>
      </div>

      {/* ── KPIs ── */}
      <div className={`mt-6 rounded-xl border ${hairline} ${surface} grid grid-cols-2 lg:grid-cols-4`}>
        {kpis.map(({ label: kLabel, value, note, delta, loading }, i) => (
          <div
            key={kLabel}
            className={`px-5 py-4 ${hairline} ${
              ['', 'border-l', 'max-lg:border-t lg:border-l', 'border-l max-lg:border-t'][i]
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${faint}`}>{kLabel}</p>
            {loading ? (
              <div className={`mt-2 h-6 w-14 rounded ${skeleton} animate-pulse`} />
            ) : (
              <p className={`mt-1.5 text-[1.45rem] font-semibold leading-none tabular-nums tracking-tight ${heading}`}>
                {value ?? '—'}
              </p>
            )}
            <p className={`mt-1.5 text-[11.5px] ${faint}`}>
              {delta != null && (
                <span className={`font-medium tabular-nums mr-1 ${
                  delta >= 0
                    ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
                    : (isLight ? 'text-rose-600' : 'text-rose-400')
                }`}>
                  {delta >= 0 ? '+' : ''}{delta}%
                </span>
              )}
              {note}
            </p>
          </div>
        ))}
      </div>

      {/* ── Navegação + Atividade ── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-x-8 gap-y-8 items-start">

        {/* Navegação agrupada */}
        <div className="space-y-7">
          {GROUPS.map((group) => (
            <section key={group.label}>
              <h2 className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${faint}`}>
                {group.label}
              </h2>
              <div className={`rounded-xl border overflow-hidden ${hairline} ${surface} divide-y ${divide}`}>
                {group.items.map(({ to, icon: Icon, title, description }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`group flex items-center gap-3.5 px-4 py-3 transition-colors ${rowHover}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${iconBox}`}>
                      <Icon size={15} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-medium leading-tight ${heading}`}>{title}</span>
                      <span className={`block text-[12px] leading-tight mt-0.5 ${muted}`}>{description}</span>
                    </span>
                    <ChevronRight
                      size={14}
                      className={`shrink-0 transition-colors ${faint} ${isLight ? 'group-hover:text-slate-600' : 'group-hover:text-slate-300'}`}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Atividade recente */}
        <aside className={`rounded-xl border ${hairline} ${surface}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${hairline}`}>
            <h2 className={`text-[12px] font-semibold uppercase tracking-wider ${muted}`}>
              Atividade recente
            </h2>
          </div>

          {recentesLoading ? (
            <div className="px-4 py-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5 py-1">
                  <div className={`h-2.5 w-4/5 rounded ${skeleton} animate-pulse`} />
                  <div className={`h-2 w-1/3 rounded ${skeleton} animate-pulse`} />
                </div>
              ))}
            </div>
          ) : recentes.length === 0 ? (
            <p className={`px-4 py-10 text-center text-[12px] ${muted}`}>
              Nenhuma atividade de usuários registrada.
            </p>
          ) : (
            <ul className={`divide-y ${divide}`}>
              {recentes.map((log) => {
                const meta = TIPO_META[log.tipo] ?? TIPO_META.UPDATE
                return (
                  <li key={log.id} className="flex items-baseline gap-2.5 px-4 py-2.5">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full self-start translate-y-[5px] ${meta.dot}`} />
                    <p className={`flex-1 min-w-0 text-[12.5px] leading-snug ${body}`}>
                      <span className={`font-medium ${heading}`}>{log.usuario_nome ?? 'Sistema'}</span>
                      {' '}{meta.verbo}{' '}{entidadeLabel(log.entidade_tipo)}
                    </p>
                    <span className={`shrink-0 text-[11px] tabular-nums whitespace-nowrap ${faint}`}>
                      {tempoRelativo(log.created_at)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className={`border-t px-4 py-2.5 ${hairline}`}>
            <Link
              to="/admin/logs"
              className={`text-[12px] font-medium transition-colors ${
                isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ver todos os logs →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
