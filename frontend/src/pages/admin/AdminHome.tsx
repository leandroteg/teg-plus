// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/AdminHome.tsx
// Painel do administrador (/admin). Hero com saudação, KPIs reais (RPC
// get_admin_uso_modulos + contagens leves), atalhos agrupados como na sidebar
// do AdminLayout (Gestão / Análise / Desenvolvimento) e feed de atividade
// recente (sys_log_atividades). Acesso restrito via <AdminRoute>.
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Shield, Users, ShieldCheck, ScrollText, BarChart3, Code2, Link2,
  ArrowRight, ArrowUpRight, ArrowDownRight, Activity, UserCheck,
  PlusCircle, PencilLine, Trash2, ChevronRight, Gauge,
  type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useUsoModulos } from '../../hooks/useUsoModulos'
import { supabase } from '../../services/supabase'

// ── Atalhos (mesmos grupos da sidebar do AdminLayout) ─────────────────────────

interface AdminCard {
  to: string
  icon: LucideIcon
  title: string
  description: string
  gradient: string
}

interface AdminGroup {
  label: string
  cards: AdminCard[]
}

const GROUPS: AdminGroup[] = [
  {
    label: 'Gestão',
    cards: [
      {
        to: '/admin/usuarios', icon: Users, title: 'Usuários',
        description: 'Contas, permissões e módulos de cada colaborador.',
        gradient: 'from-indigo-500 to-blue-500',
      },
      {
        to: '/admin/politicas-aprovacao', icon: ShieldCheck, title: 'Políticas de Aprovação',
        description: 'Alçadas e fluxos de aprovação por módulo.',
        gradient: 'from-emerald-500 to-teal-500',
      },
    ],
  },
  {
    label: 'Análise',
    cards: [
      {
        to: '/admin/logs', icon: ScrollText, title: 'Logs de Auditoria',
        description: 'Quem fez o quê, quando e o que mudou no sistema.',
        gradient: 'from-violet-500 to-purple-500',
      },
      {
        to: '/admin/uso-modulos', icon: BarChart3, title: 'Uso de Módulos',
        description: 'Acessos, adoção e engajamento por módulo.',
        gradient: 'from-sky-500 to-cyan-500',
      },
    ],
  },
  {
    label: 'Desenvolvimento',
    cards: [
      {
        to: '/admin/desenvolvimento', icon: Code2, title: 'Desenvolvimento',
        description: 'Roadmap, backlog e melhorias em andamento.',
        gradient: 'from-amber-500 to-orange-500',
      },
      {
        to: '/admin/integracoes', icon: Link2, title: 'Integrações',
        description: 'Conexões com sistemas externos e configurações.',
        gradient: 'from-rose-500 to-pink-500',
      },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_META: Record<string, { verbo: string; icon: LucideIcon; light: string; dark: string }> = {
  INSERT: { verbo: 'criou',    icon: PlusCircle, light: 'bg-emerald-50 text-emerald-600', dark: 'bg-emerald-500/15 text-emerald-300' },
  UPDATE: { verbo: 'alterou',  icon: PencilLine, light: 'bg-amber-50 text-amber-600',     dark: 'bg-amber-500/15 text-amber-300'     },
  DELETE: { verbo: 'excluiu',  icon: Trash2,     light: 'bg-rose-50 text-rose-600',       dark: 'bg-rose-500/15 text-rose-300'       },
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

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, delta, note, isLight, loading }: {
  icon: LucideIcon
  label: string
  value: string | number | null | undefined
  delta?: number | null
  note?: string
  isLight: boolean
  loading: boolean
}) {
  const up = (delta ?? 0) >= 0
  const DeltaIcon = up ? ArrowUpRight : ArrowDownRight
  return (
    <div className={`rounded-2xl border p-4 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
      <div className="flex items-center justify-between mb-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-300'}`}>
          <Icon size={15} />
        </span>
        {delta != null && Number.isFinite(delta) && (
          <span className={`flex items-center gap-0.5 text-[11px] font-bold tabular-nums
            ${up
              ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
              : (isLight ? 'text-rose-600' : 'text-rose-400')}`}
          >
            <DeltaIcon size={12} />
            {Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
          </span>
        )}
      </div>
      {loading ? (
        <div className={`h-7 w-16 rounded-md animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
      ) : (
        <p className={`text-[1.6rem] font-extrabold leading-none tabular-nums ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {value ?? '—'}
        </p>
      )}
      <p className={`text-[10.5px] font-bold uppercase tracking-wider mt-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      {note && <p className={`text-[10.5px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{note}</p>}
    </div>
  )
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

  // Ações registradas hoje (auditoria)
  const { data: acoesHoje, isLoading: acoesLoading } = useQuery({
    queryKey: ['admin-home-acoes-hoje'],
    queryFn: async () => {
      const inicio = new Date()
      inicio.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('sys_log_atividades')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicio.toISOString())
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
  })

  // Últimas atividades (feed lateral)
  const { data: recentes = [], isLoading: recentesLoading } = useQuery({
    queryKey: ['admin-home-logs-recentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_log_atividades')
        .select('id, modulo, entidade_tipo, tipo, usuario_nome, created_at')
        .order('created_at', { ascending: false })
        .limit(7)
      if (error) throw error
      return (data ?? []) as LogRecente[]
    },
    staleTime: 30_000,
  })

  const deltaAcessos = resumo && resumo.acessos_prev > 0
    ? ((resumo.total_acessos - resumo.acessos_prev) / resumo.acessos_prev) * 100
    : null

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataLonga = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  const label = isLight ? 'text-slate-500' : 'text-slate-400'
  const sectionLabel = isLight ? 'text-slate-400' : 'text-slate-500'
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
  const card = isLight
    ? 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/[0.07] hover:-translate-y-0.5'
    : 'bg-white/[0.03] border-white/[0.06] hover:border-indigo-400/30 hover:bg-white/[0.05] hover:-translate-y-0.5'

  return (
    <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-7 sm:px-8">
          {/* textura sutil */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
          <div className="pointer-events-none absolute -right-10 -top-14 opacity-[0.09]">
            <Shield size={230} strokeWidth={1} className="text-white" />
          </div>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-indigo-100 backdrop-blur-sm">
              <Shield size={11} /> Painel do administrador
            </span>
            <h1 className="mt-3 text-[1.6rem] sm:text-3xl font-extrabold text-white leading-tight">
              {saudacao}, {primeiroNome(perfil?.nome)}
            </h1>
            <p className="mt-1 text-[13px] text-indigo-100/90 first-letter:uppercase">{dataLonga}</p>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-indigo-100/80">
              Central de gestão, análise e desenvolvimento do TEG+ — usuários, aprovações,
              auditoria e integrações em um só lugar.
            </p>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={Users} label="Usuários ativos" isLight={isLight}
            value={totalUsuarios?.toLocaleString('pt-BR')}
            loading={usuariosLoading} note="contas habilitadas"
          />
          <KpiCard
            icon={UserCheck} label="Ativos na semana" isLight={isLight}
            value={resumo?.usuarios_ativos_uso?.toLocaleString('pt-BR')}
            loading={usoLoading}
            note={resumo ? `de ${resumo.base_usuarios} usuários` : undefined}
          />
          <KpiCard
            icon={Gauge} label="Acessos · 7 dias" isLight={isLight}
            value={resumo?.total_acessos?.toLocaleString('pt-BR')}
            delta={deltaAcessos} loading={usoLoading}
            note="vs. semana anterior"
          />
          <KpiCard
            icon={Activity} label="Ações hoje" isLight={isLight}
            value={acoesHoje?.toLocaleString('pt-BR')}
            loading={acoesLoading} note="registros de auditoria"
          />
        </div>

        {/* ── Atalhos + Atividade recente ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* Atalhos agrupados */}
          <div className="lg:col-span-2 space-y-6">
            {GROUPS.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <h2 className={`text-[11px] font-bold uppercase tracking-wider ${sectionLabel}`}>
                    {group.label}
                  </h2>
                  <div className={`h-px flex-1 ${isLight ? 'bg-slate-200/80' : 'bg-white/[0.06]'}`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.cards.map(({ to, icon: Icon, title, description, gradient }) => (
                    <Link
                      key={to}
                      to={to}
                      className={`group flex items-start gap-3.5 rounded-2xl border p-4 transition-all duration-200 ${card}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                        <Icon size={18} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`flex items-center gap-1.5 text-[13.5px] font-semibold ${heading}`}>
                          {title}
                          <ArrowRight size={13} className="opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-60 group-hover:translate-x-0" />
                        </span>
                        <span className={`block text-[12px] leading-snug mt-0.5 ${label}`}>{description}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Atividade recente */}
          <aside className={`rounded-2xl border ${panel}`}>
            <div className={`flex items-center justify-between px-4 pt-4 pb-3 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-[13px] font-bold ${heading}`}>Atividade recente</h2>
              <Link
                to="/admin/logs"
                className={`flex items-center gap-0.5 text-[11.5px] font-semibold transition-colors
                  ${isLight ? 'text-indigo-600 hover:text-indigo-700' : 'text-indigo-300 hover:text-indigo-200'}`}
              >
                Ver logs <ChevronRight size={13} />
              </Link>
            </div>

            {recentesLoading ? (
              <div className="p-4 space-y-3.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-2.5 w-3/4 rounded animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                      <div className={`h-2 w-1/2 rounded animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentes.length === 0 ? (
              <p className={`px-4 py-8 text-center text-[12px] ${label}`}>Nenhuma atividade registrada ainda.</p>
            ) : (
              <ul className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                {recentes.map((log) => {
                  const meta = TIPO_META[log.tipo] ?? TIPO_META.UPDATE
                  const TipoIcon = meta.icon
                  return (
                    <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isLight ? meta.light : meta.dark}`}>
                        <TipoIcon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12.5px] leading-snug ${heading}`}>
                          <span className="font-semibold">{log.usuario_nome ?? 'Sistema'}</span>
                          {' '}{meta.verbo}{' '}
                          <span className="font-medium">{entidadeLabel(log.entidade_tipo)}</span>
                        </p>
                        <p className={`text-[11px] mt-0.5 ${label}`}>{tempoRelativo(log.created_at)} atrás</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
      </div>
    </div>
  )
}
