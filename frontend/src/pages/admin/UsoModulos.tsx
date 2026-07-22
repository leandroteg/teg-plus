import { useMemo, useState } from 'react'
import {
  BarChart3, MousePointerClick, PencilLine, Users, LayoutGrid, Info, Search,
  TrendingUp, TrendingDown, Percent, X, Target,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useUsoModulos, useUsoModuloDetalhe, useUsoMetas, useSalvarMeta, type PeriodoDias,
} from '../../hooks/useUsoModulos'
import { moduleLabel, TRACKED_MODULES } from '../../config/moduleTracking'
import type { UsoPorUsuario } from '../../types/usoModulos'

const PERIODOS: PeriodoDias[] = [7, 30, 90]
const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b']

const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtDataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'
// busca sem diferenciar maiúsculas/acentos ("jose" encontra "JOSÉ")
const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .split('')
    .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
    .join('')
    .toLowerCase()

// ── Delta vs período anterior ─────────────────────────────────────────────────

function Delta({ atual, prev, isLight }: { atual: number; prev: number; isLight: boolean }) {
  if (prev === 0 && atual === 0) return null
  if (prev === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-300'}`}>
        novo
      </span>
    )
  }
  const pct = Math.round(((atual - prev) / prev) * 100)
  const up = pct > 0
  const cls = pct === 0
    ? isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'
    : up
      ? isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300'
      : isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/15 text-rose-300'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${cls}`} title="vs período anterior">
      {pct !== 0 && (up ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, valor, sub, delta, tone, isLight,
}: {
  icon: typeof BarChart3; label: string; valor: string; sub?: string
  delta?: { atual: number; prev: number }; tone: string; isLight: boolean
}) {
  const toneCls: Record<string, string> = {
    sky: isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-300',
    violet: isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/15 text-violet-300',
    emerald: isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300',
    amber: isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-300',
    rose: isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/15 text-rose-300',
  }
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  return (
    <div className={`rounded-2xl border p-4 ${panel}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[11px] font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneCls[tone]}`}>
          <Icon size={14} />
        </span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`text-2xl font-bold leading-none ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>{valor}</span>
        {sub && <span className={`text-[12px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</span>}
        {delta && <Delta atual={delta.atual} prev={delta.prev} isLight={isLight} />}
      </div>
    </div>
  )
}

// ── Chips de módulos ──────────────────────────────────────────────────────────

function ModuloChips({ modulos, dim, isLight }: { modulos: string[]; dim?: boolean; isLight: boolean }) {
  if (!modulos.length) return <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>—</span>
  const cls = dim
    ? isLight
      ? 'bg-slate-50 text-slate-400 border-slate-200'
      : 'bg-white/[0.02] text-slate-500 border-white/[0.06]'
    : isLight
      ? 'bg-violet-50 text-violet-700 border-violet-100'
      : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
  return (
    <div className="flex flex-wrap gap-1">
      {modulos.map((m) => (
        <span key={m} className={`px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${cls}`}>
          {moduleLabel(m)}
        </span>
      ))}
    </div>
  )
}

// ── Meta de adoção editável ───────────────────────────────────────────────────

function MetaInput({
  modulo, value, isLight, onSave,
}: {
  modulo: string; value: number | undefined; isLight: boolean
  onSave: (modulo: string, metaPct: number | null) => void
}) {
  const [texto, setTexto] = useState(value != null ? String(value) : '')

  function commit() {
    const n = texto.trim() === '' ? null : Math.min(100, Math.max(1, Number(texto)))
    if (n !== null && Number.isNaN(n)) { setTexto(value != null ? String(value) : ''); return }
    setTexto(n != null ? String(n) : '')
    if (n !== (value ?? null)) onSave(modulo, n)
  }

  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="number" min={1} max={100}
        value={texto}
        placeholder="—"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className={`w-14 rounded-md border px-1.5 py-0.5 text-[12px] text-right outline-none transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-700 focus:border-slate-400'
            : 'bg-white/[0.03] border-white/10 text-slate-200 focus:border-white/25'
        }`}
      />
      <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>%</span>
    </div>
  )
}

// ── Modal de drill-down de um módulo ──────────────────────────────────────────

function ModuloDetalheModal({
  modulo, dias, meta, isLight, onClose,
}: {
  modulo: string; dias: PeriodoDias; meta?: number; isLight: boolean; onClose: () => void
}) {
  const { data, isLoading, isError, error } = useUsoModuloDetalhe(modulo, dias)

  const panel = isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.08]'
  const inner = isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  const label = isLight ? 'text-slate-500' : 'text-slate-400'
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  const rowBorder = isLight ? 'border-slate-100' : 'border-white/[0.04]'
  const gridStroke = isLight ? '#e2e8f0' : '#1e293b'
  const tickFill = isLight ? '#64748b' : '#94a3b8'
  const tooltipStyle = isLight
    ? undefined
    : { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }

  const atingiuMeta = data && meta != null ? data.resumo.pct_adocao >= meta : null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:p-8" onClick={onClose}>
      <div
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${rowBorder}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-300'}`}>
            <LayoutGrid size={16} />
          </span>
          <div className="mr-auto">
            <h2 className={`text-base font-bold ${heading}`}>{moduleLabel(modulo)}</h2>
            <p className={`text-[11px] ${label}`}>Últimos {dias} dias</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {isError && (
            <div className={`rounded-xl border p-4 text-[13px] ${isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
              Erro ao carregar o detalhe: {(error as Error)?.message ?? 'tente novamente.'}
            </div>
          )}
          {isLoading && (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => <div key={i} className={`h-20 rounded-xl border ${inner}`} />)}
              </div>
              <div className={`h-56 rounded-xl border ${inner}`} />
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* KPIs do módulo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  icon={MousePointerClick} label="Acessos" tone="sky" isLight={isLight}
                  valor={fmtNum(data.resumo.acessos)}
                  delta={{ atual: data.resumo.acessos, prev: data.resumo.acessos_prev }}
                />
                <KpiCard
                  icon={PencilLine} label="Ações" tone="violet" isLight={isLight}
                  valor={fmtNum(data.resumo.acoes)}
                  delta={{ atual: data.resumo.acoes, prev: data.resumo.acoes_prev }}
                />
                <KpiCard
                  icon={Users} label="Usuários" tone="emerald" isLight={isLight}
                  valor={String(data.resumo.usuarios)}
                  sub={`de ${data.resumo.base_usuarios}`}
                  delta={{ atual: data.resumo.usuarios, prev: data.resumo.usuarios_prev }}
                />
                <KpiCard
                  icon={Target} label="Adoção" tone={atingiuMeta === false ? 'rose' : 'amber'} isLight={isLight}
                  valor={`${data.resumo.pct_adocao}%`}
                  sub={meta != null ? `meta ${meta}%` : 'sem meta'}
                />
              </div>

              {/* Evolução do módulo */}
              <div className={`rounded-xl border p-4 ${inner}`}>
                <h3 className={`text-[13px] font-semibold mb-2 ${heading}`}>Evolução diária</h3>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data.evolucao}>
                      <defs>
                        <linearGradient id="gAcessosDet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gAcoesDet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip labelFormatter={fmtDia} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="acessos" name="Acessos" stroke="#0ea5e9" strokeWidth={2} fill="url(#gAcessosDet)" dot={false} />
                      <Area type="monotone" dataKey="acoes" name="Ações" stroke="#8b5cf6" strokeWidth={2} fill="url(#gAcoesDet)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Telas + ações */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className={`rounded-xl border p-4 overflow-x-auto ${inner}`}>
                  <h3 className={`text-[13px] font-semibold mb-2 ${heading}`}>Telas mais acessadas</h3>
                  {data.telas.length === 0 ? (
                    <p className={`text-[12px] ${label}`}>Sem acessos registrados ainda.</p>
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className={`text-left text-[10px] uppercase tracking-wide ${label}`}>
                          <th className="py-1.5 pr-2 font-medium">Tela</th>
                          <th className="py-1.5 pr-2 font-medium text-right">Acessos</th>
                          <th className="py-1.5 font-medium text-right">Usuários</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.telas.map((t) => (
                          <tr key={t.tela} className={`border-t ${rowBorder}`}>
                            <td className={`py-1.5 pr-2 break-all font-medium ${heading}`}>{t.tela}</td>
                            <td className={`py-1.5 pr-2 text-right tabular-nums ${label}`}>{fmtNum(t.acessos)}</td>
                            <td className={`py-1.5 text-right tabular-nums ${label}`}>{t.usuarios}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className={`rounded-xl border p-4 overflow-x-auto ${inner}`}>
                  <h3 className={`text-[13px] font-semibold mb-2 ${heading}`}>Ações mais comuns</h3>
                  {data.acoes.length === 0 ? (
                    <p className={`text-[12px] ${label}`}>Sem ações registradas no período.</p>
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className={`text-left text-[10px] uppercase tracking-wide ${label}`}>
                          <th className="py-1.5 pr-2 font-medium">Entidade</th>
                          <th className="py-1.5 pr-2 font-medium">Tipo</th>
                          <th className="py-1.5 font-medium text-right">Qtd.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.acoes.map((a) => (
                          <tr key={`${a.entidade_tipo}:${a.tipo}`} className={`border-t ${rowBorder}`}>
                            <td className={`py-1.5 pr-2 break-all font-medium ${heading}`}>{a.entidade_tipo}</td>
                            <td className={`py-1.5 pr-2 ${label}`}>
                              {a.tipo === 'INSERT' ? 'Criação' : a.tipo === 'UPDATE' ? 'Alteração' : a.tipo === 'DELETE' ? 'Exclusão' : a.tipo}
                            </td>
                            <td className={`py-1.5 text-right tabular-nums ${label}`}>{fmtNum(a.quantidade)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Usuários do módulo */}
              <div className={`rounded-xl border p-4 overflow-x-auto ${inner}`}>
                <h3 className={`text-[13px] font-semibold mb-2 ${heading}`}>Usuários do módulo</h3>
                {data.usuarios.length === 0 ? (
                  <p className={`text-[12px] ${label}`}>Nenhum usuário usou este módulo no período.</p>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className={`text-left text-[10px] uppercase tracking-wide ${label}`}>
                        <th className="py-1.5 pr-2 font-medium">Usuário</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Acessos</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Ações</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Dias ativos</th>
                        <th className="py-1.5 font-medium">Último uso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.usuarios.map((u) => (
                        <tr key={u.usuario_id} className={`border-t ${rowBorder}`}>
                          <td className="py-1.5 pr-2">
                            <span className={`font-medium ${heading}`}>{u.nome}</span>
                            <span className={`ml-1.5 text-[10px] capitalize ${label}`}>{u.role}</span>
                          </td>
                          <td className={`py-1.5 pr-2 text-right tabular-nums ${label}`}>{fmtNum(u.acessos)}</td>
                          <td className={`py-1.5 pr-2 text-right tabular-nums ${label}`}>{fmtNum(u.acoes)}</td>
                          <td className={`py-1.5 pr-2 text-right tabular-nums ${label}`}>{u.dias_ativos}/{dias}</td>
                          <td className={`py-1.5 whitespace-nowrap ${label}`}>{fmtDataHora(u.ultimo_uso)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function UsoModulos() {
  const { isLightSidebar: isLight } = useTheme()
  const [dias, setDias] = useState<PeriodoDias>(30)
  const [moduloFiltro, setModuloFiltro] = useState<string>('todos')
  const [mostrarSemUso, setMostrarSemUso] = useState(false)
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [moduloDetalhe, setModuloDetalhe] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useUsoModulos(dias)
  const { data: metas = {} } = useUsoMetas()
  const salvarMeta = useSalvarMeta()

  // Módulos com algum uso no período (base do filtro do gráfico e dos "nunca usados")
  const modulosComUso = useMemo(
    () => (data?.por_modulo ?? []).map((m) => m.modulo),
    [data],
  )

  const modulosSemUso = useMemo(
    () => TRACKED_MODULES.filter((m) => !modulosComUso.includes(m)),
    [modulosComUso],
  )

  // Pivot da evolução diária: uma linha por dia com acessos/ações somados
  // (todos os módulos ou apenas o filtrado)
  const serieDiaria = useMemo(() => {
    if (!data) return []
    const porDia = new Map<string, { dia: string; acessos: number; acoes: number }>()
    for (const p of data.evolucao_diaria) {
      if (moduloFiltro !== 'todos' && p.modulo !== moduloFiltro) continue
      const atual = porDia.get(p.dia) ?? { dia: p.dia, acessos: 0, acoes: 0 }
      atual.acessos += p.acessos
      atual.acoes += p.acoes
      porDia.set(p.dia, atual)
    }
    return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia))
  }, [data, moduloFiltro])

  // Donut: top 7 módulos por uso total + "Outros"
  const distribuicao = useMemo(() => {
    const lista = (data?.por_modulo ?? []).map((m) => ({ name: moduleLabel(m.modulo), value: m.acessos + m.acoes }))
    if (lista.length <= 8) return lista
    const top = lista.slice(0, 7)
    const resto = lista.slice(7).reduce((s, x) => s + x.value, 0)
    return [...top, { name: 'Outros', value: resto }]
  }, [data])

  const usoTotal = useMemo(
    () => (data ? data.resumo.total_acessos + data.resumo.total_acoes : 0),
    [data],
  )

  const usuariosVisiveis = useMemo(() => {
    let lista = data?.por_usuario ?? []
    if (!mostrarSemUso) lista = lista.filter((u) => u.total_acessos + u.total_acoes > 0)
    const termo = normalizar(buscaUsuario.trim())
    if (termo) lista = lista.filter((u) => normalizar(u.nome).includes(termo))
    return lista
  }, [data, mostrarSemUso, buscaUsuario])

  const semUsoCount = useMemo(
    () => (data?.por_usuario ?? []).filter((u) => u.total_acessos + u.total_acoes === 0).length,
    [data],
  )

  const nuncaUsados = (u: UsoPorUsuario) => modulosComUso.filter((m) => !u.modulos_usados.includes(m))

  const bg = isLight ? 'bg-slate-50' : 'bg-[#0c1222]'
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  const label = isLight ? 'text-slate-500' : 'text-slate-400'
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  const rowBorder = isLight ? 'border-slate-100' : 'border-white/[0.04]'
  const optionCls = isLight ? 'text-slate-700 bg-white' : 'text-slate-100 bg-slate-800'
  const selectCls = `rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition-colors ${
    isLight
      ? 'bg-white border-slate-200 text-slate-700 focus:border-slate-400'
      : 'bg-white/[0.03] border-white/10 text-slate-200 focus:border-white/25'
  }`
  const gridStroke = isLight ? '#e2e8f0' : '#1e293b'
  const tickFill = isLight ? '#64748b' : '#94a3b8'
  const tooltipStyle = isLight
    ? undefined
    : { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-[1500px] mx-auto px-5 py-6">
        {/* Cabeçalho + período */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-300'}`}>
            <BarChart3 size={20} />
          </span>
          <div className="mr-auto">
            <h1 className={`text-lg font-bold ${heading}`}>Uso dos Módulos</h1>
            <p className={`text-[12px] ${label}`}>
              Acessos (navegação) e ações (registros de auditoria) por módulo e usuário.
            </p>
          </div>
          <div className={`flex rounded-lg border p-0.5 ${panel}`}>
            {PERIODOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDias(p)}
                className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                  dias === p
                    ? isLight ? 'bg-slate-800 text-white' : 'bg-white/10 text-white'
                    : label
                }`}
              >
                {p} dias
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <div className={`rounded-xl border p-4 text-[13px] ${isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
            Erro ao carregar as métricas: {(error as Error)?.message ?? 'tente novamente.'}
          </div>
        )}

        {isLoading && (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className={`h-24 rounded-2xl border ${panel}`} />)}
            </div>
            <div className="grid xl:grid-cols-3 gap-4">
              <div className={`h-80 rounded-2xl border xl:col-span-2 ${panel}`} />
              <div className={`h-80 rounded-2xl border ${panel}`} />
            </div>
            <div className={`h-64 rounded-2xl border ${panel}`} />
          </div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
              <KpiCard
                icon={MousePointerClick} label="Acessos" tone="sky" isLight={isLight}
                valor={fmtNum(data.resumo.total_acessos)}
                delta={{ atual: data.resumo.total_acessos, prev: data.resumo.acessos_prev }}
              />
              <KpiCard
                icon={PencilLine} label="Ações" tone="violet" isLight={isLight}
                valor={fmtNum(data.resumo.total_acoes)}
                delta={{ atual: data.resumo.total_acoes, prev: data.resumo.acoes_prev }}
              />
              <KpiCard
                icon={Users} label="Usuários ativos" tone="emerald" isLight={isLight}
                valor={String(data.resumo.usuarios_ativos_uso)}
                sub={`de ${data.resumo.base_usuarios}`}
                delta={{ atual: data.resumo.usuarios_ativos_uso, prev: data.resumo.usuarios_prev }}
              />
              <KpiCard
                icon={Percent} label="Adoção geral" tone="amber" isLight={isLight}
                valor={`${data.resumo.pct_adocao_geral}%`}
                sub="dos usuários"
              />
              <KpiCard
                icon={LayoutGrid} label="Módulos usados" tone="rose" isLight={isLight}
                valor={String(data.resumo.modulos_usados)}
                sub={modulosSemUso.length ? `${modulosSemUso.length} sem uso` : 'todos em uso'}
              />
            </div>

            {data.resumo.total_acessos === 0 && (
              <div className={`flex items-start gap-2 rounded-xl border p-3 mb-4 text-[12px] ${isLight ? 'bg-sky-50 border-sky-100 text-sky-700' : 'bg-sky-500/10 border-sky-500/20 text-sky-300'}`}>
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  Os <strong>acessos</strong> (navegação por telas) passam a ser registrados a partir desta versão —
                  o histórico começa agora. As <strong>ações</strong> vêm dos logs de auditoria já existentes.
                </span>
              </div>
            )}

            {/* Evolução + distribuição */}
            <div className="grid xl:grid-cols-3 gap-4 mb-4">
              <div className={`rounded-2xl border p-4 xl:col-span-2 ${panel}`}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <h2 className={`text-sm font-semibold mr-auto ${heading}`}>Evolução diária</h2>
                  <select
                    value={moduloFiltro}
                    onChange={(e) => setModuloFiltro(e.target.value)}
                    className={selectCls}
                  >
                    <option value="todos" className={optionCls}>Todos os módulos</option>
                    {modulosComUso.map((m) => (
                      <option key={m} value={m} className={optionCls}>{moduleLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={serieDiaria}>
                      <defs>
                        <linearGradient id="gAcessos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gAcoes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip labelFormatter={fmtDia} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="acessos" name="Acessos" stroke="#0ea5e9" strokeWidth={2} fill="url(#gAcessos)" dot={false} />
                      <Area type="monotone" dataKey="acoes" name="Ações" stroke="#8b5cf6" strokeWidth={2} fill="url(#gAcoes)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${panel}`}>
                <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Distribuição por módulo</h2>
                {distribuicao.length === 0 ? (
                  <p className={`text-[13px] ${label}`}>Nenhum uso registrado no período.</p>
                ) : (
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={distribuicao} dataKey="value" nameKey="name"
                          cx="50%" cy="45%" innerRadius={58} outerRadius={88} paddingAngle={2} strokeWidth={0}
                        >
                          {distribuicao.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <text
                          x="50%" y="41%" textAnchor="middle" dominantBaseline="central"
                          style={{ fontSize: 22, fontWeight: 700, fill: isLight ? '#1e293b' : '#f1f5f9' }}
                        >
                          {fmtNum(usoTotal)}
                        </text>
                        <text
                          x="50%" y="49%" textAnchor="middle" dominantBaseline="central"
                          style={{ fontSize: 11, fill: isLight ? '#64748b' : '#94a3b8' }}
                        >
                          eventos
                        </text>
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtNum(v)} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Usuários por dia + atividade por hora */}
            <div className="grid xl:grid-cols-2 gap-4 mb-4">
              <div className={`rounded-2xl border p-4 ${panel}`}>
                <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Usuários únicos por dia</h2>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.usuarios_por_dia}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip labelFormatter={fmtDia} contentStyle={tooltipStyle} />
                      <Bar dataKey="usuarios" name="Usuários" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${panel}`}>
                <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Atividade por hora do dia</h2>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.por_hora}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="hora" tickFormatter={(h: number) => `${h}h`} tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} interval={1} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip labelFormatter={(h: number) => `${h}h`} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="acessos" name="Acessos" stackId="a" fill="#0ea5e9" maxBarSize={18} />
                      <Bar dataKey="acoes" name="Ações" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Uso por módulo */}
            <div className={`rounded-2xl border p-4 mb-4 overflow-x-auto ${panel}`}>
              <div className="flex flex-wrap items-baseline gap-2 mb-3">
                <h2 className={`text-sm font-semibold ${heading}`}>Uso por módulo</h2>
                <span className={`text-[11px] ${label}`}>clique em um módulo para ver o detalhe</span>
              </div>
              {data.por_modulo.length === 0 ? (
                <p className={`text-[13px] ${label}`}>Nenhum uso registrado no período.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className={`text-left text-[11px] uppercase tracking-wide ${label}`}>
                      <th className="py-2 pr-3 font-medium">Módulo</th>
                      <th className="py-2 pr-3 font-medium text-right">Acessos</th>
                      <th className="py-2 pr-3 font-medium text-right">Ações</th>
                      <th className="py-2 pr-3 font-medium text-right">Usuários</th>
                      <th className="py-2 pr-3 font-medium w-[28%]">Adoção vs meta</th>
                      <th className="py-2 font-medium text-right">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_modulo.map((m) => {
                      const meta = metas[m.modulo]
                      const barra = meta != null
                        ? m.pct_adocao >= meta ? 'bg-emerald-500' : 'bg-amber-500'
                        : 'bg-sky-500'
                      return (
                        <tr
                          key={m.modulo}
                          onClick={() => setModuloDetalhe(m.modulo)}
                          className={`border-t cursor-pointer transition-colors ${rowBorder} ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'}`}
                        >
                          <td className={`py-2 pr-3 font-medium ${heading}`}>{moduleLabel(m.modulo)}</td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{fmtNum(m.acessos)}</td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{fmtNum(m.acoes)}</td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{m.usuarios_distintos}</td>
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className={`relative h-1.5 flex-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                                <div
                                  className={`h-full rounded-full ${barra}`}
                                  style={{ width: `${Math.min(m.pct_adocao, 100)}%` }}
                                />
                                {meta != null && (
                                  <div
                                    className={`absolute top-0 h-full w-0.5 ${isLight ? 'bg-slate-500' : 'bg-slate-300'}`}
                                    style={{ left: `${Math.min(meta, 100)}%` }}
                                    title={`Meta: ${meta}%`}
                                  />
                                )}
                              </div>
                              <span className={`text-[11px] tabular-nums whitespace-nowrap text-right ${label}`}>
                                {m.pct_adocao}%{meta != null ? ` / ${meta}%` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 text-right">
                            <MetaInput
                              modulo={m.modulo}
                              value={meta}
                              isLight={isLight}
                              onSave={(mod, pct) => salvarMeta.mutate({ modulo: mod, metaPct: pct })}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              {modulosSemUso.length > 0 && (
                <div className={`flex flex-wrap items-center gap-2 mt-3 pt-3 border-t ${rowBorder}`}>
                  <span className={`text-[11px] uppercase tracking-wide font-medium ${label}`}>Sem nenhum uso no período:</span>
                  <ModuloChips modulos={modulosSemUso} dim isLight={isLight} />
                </div>
              )}
            </div>

            {/* Uso por usuário */}
            <div className={`rounded-2xl border p-4 mb-4 overflow-x-auto ${panel}`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className={`text-sm font-semibold mr-auto ${heading}`}>Uso por usuário</h2>
                <div className="relative">
                  <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${label}`} />
                  <input
                    type="text"
                    value={buscaUsuario}
                    onChange={(e) => setBuscaUsuario(e.target.value)}
                    placeholder="Buscar por nome…"
                    className={`${selectCls} pl-7 w-48`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarSemUso((v) => !v)}
                  className={`text-[12px] px-2.5 py-1 rounded-lg border transition-colors ${
                    mostrarSemUso
                      ? isLight ? 'bg-slate-800 text-white border-slate-800' : 'bg-white/10 text-white border-white/10'
                      : `${panel} ${label}`
                  }`}
                >
                  {mostrarSemUso ? 'Ocultar sem uso' : `Mostrar sem uso (${semUsoCount})`}
                </button>
              </div>
              {usuariosVisiveis.length === 0 ? (
                <p className={`text-[13px] ${label}`}>
                  {buscaUsuario.trim() ? 'Nenhum usuário encontrado com esse nome.' : 'Nenhum usuário com uso no período.'}
                </p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className={`text-left text-[11px] uppercase tracking-wide ${label}`}>
                      <th className="py-2 pr-3 font-medium">Usuário</th>
                      <th className="py-2 pr-3 font-medium text-right">Acessos</th>
                      <th className="py-2 pr-3 font-medium text-right">Ações</th>
                      <th className="py-2 pr-3 font-medium text-right">Dias ativos</th>
                      <th className="py-2 pr-3 font-medium">Último uso</th>
                      <th className="py-2 pr-3 font-medium">Módulos usados</th>
                      <th className="py-2 font-medium">Nunca usou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosVisiveis.map((u) => (
                      <tr key={u.usuario_id} className={`border-t align-top ${rowBorder}`}>
                        <td className="py-2 pr-3">
                          <div className={`font-medium ${heading}`}>{u.nome}</div>
                          <div className={`text-[11px] capitalize ${label}`}>{u.role}</div>
                        </td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{fmtNum(u.total_acessos)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{fmtNum(u.total_acoes)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{u.dias_ativos}/{dias}</td>
                        <td className={`py-2 pr-3 whitespace-nowrap ${label}`}>{fmtDataHora(u.ultimo_uso)}</td>
                        <td className="py-2 pr-3"><ModuloChips modulos={u.modulos_usados} isLight={isLight} /></td>
                        <td className="py-2"><ModuloChips modulos={nuncaUsados(u)} dim isLight={isLight} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rankings */}
            <div className="grid gap-4 xl:grid-cols-2">
              <div className={`rounded-2xl border p-4 overflow-x-auto ${panel}`}>
                <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Telas mais acessadas</h2>
                {data.ranking_telas.length === 0 ? (
                  <p className={`text-[13px] ${label}`}>Sem acessos registrados ainda.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className={`text-left text-[11px] uppercase tracking-wide ${label}`}>
                        <th className="py-2 pr-3 font-medium">Tela</th>
                        <th className="py-2 pr-3 font-medium text-right">Acessos</th>
                        <th className="py-2 font-medium text-right">Usuários</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ranking_telas.map((t) => (
                        <tr key={`${t.modulo}:${t.tela}`} className={`border-t ${rowBorder}`}>
                          <td className="py-2 pr-3">
                            <div className={`font-medium break-all ${heading}`}>{t.tela}</div>
                            <div className={`text-[11px] ${label}`}>{moduleLabel(t.modulo)}</div>
                          </td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{fmtNum(t.acessos)}</td>
                          <td className={`py-2 text-right tabular-nums ${label}`}>{t.usuarios}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className={`rounded-2xl border p-4 overflow-x-auto ${panel}`}>
                <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Ações mais comuns</h2>
                {data.ranking_acoes.length === 0 ? (
                  <p className={`text-[13px] ${label}`}>Sem ações registradas no período.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className={`text-left text-[11px] uppercase tracking-wide ${label}`}>
                        <th className="py-2 pr-3 font-medium">Entidade</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 font-medium text-right">Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ranking_acoes.map((a) => (
                        <tr key={`${a.modulo}:${a.entidade_tipo}:${a.tipo}`} className={`border-t ${rowBorder}`}>
                          <td className="py-2 pr-3">
                            <div className={`font-medium break-all ${heading}`}>{a.entidade_tipo}</div>
                            <div className={`text-[11px] ${label}`}>{moduleLabel(a.modulo)}</div>
                          </td>
                          <td className={`py-2 pr-3 ${label}`}>
                            {a.tipo === 'INSERT' ? 'Criação' : a.tipo === 'UPDATE' ? 'Alteração' : a.tipo === 'DELETE' ? 'Exclusão' : a.tipo}
                          </td>
                          <td className={`py-2 text-right tabular-nums ${label}`}>{fmtNum(a.quantidade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {moduloDetalhe && (
        <ModuloDetalheModal
          modulo={moduloDetalhe}
          dias={dias}
          meta={metas[moduloDetalhe]}
          isLight={isLight}
          onClose={() => setModuloDetalhe(null)}
        />
      )}
    </div>
  )
}
