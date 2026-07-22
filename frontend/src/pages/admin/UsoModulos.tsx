import { useMemo, useState } from 'react'
import {
  BarChart3, MousePointerClick, PencilLine, Users, LayoutGrid, Info,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { useTheme } from '../../contexts/ThemeContext'
import { useUsoModulos, type PeriodoDias } from '../../hooks/useUsoModulos'
import { moduleLabel } from '../../config/moduleTracking'
import type { UsoPorUsuario } from '../../types/usoModulos'

const PERIODOS: PeriodoDias[] = [7, 30, 90]

const fmtDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmtDataHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

// ── Card de estatística (mesmo padrão de admin/Logs.tsx) ──────────────────────

function StatCard({
  icon: Icon, label, valor, sub, tone, isLight,
}: {
  icon: typeof BarChart3; label: string; valor: string; sub?: string; tone: string; isLight: boolean
}) {
  const toneCls: Record<string, string> = {
    violet: isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/15 text-violet-300',
    emerald: isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300',
    amber: isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-300',
    sky: isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-300',
  }
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  const label2 = isLight ? 'text-slate-500' : 'text-slate-400'
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${panel}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls[tone]}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className={`text-lg font-bold leading-none ${heading}`}>
          {valor}
          {sub && <span className={`text-[11px] font-medium ml-1.5 ${label2}`}>{sub}</span>}
        </div>
        <div className={`text-[11px] mt-1 ${label2}`}>{label}</div>
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

// ── Página ────────────────────────────────────────────────────────────────────

export default function UsoModulos() {
  const { isLightSidebar: isLight } = useTheme()
  const [dias, setDias] = useState<PeriodoDias>(30)
  const [moduloFiltro, setModuloFiltro] = useState<string>('todos')
  const [mostrarSemUso, setMostrarSemUso] = useState(false)

  const { data, isLoading, isError, error } = useUsoModulos(dias)

  // Módulos com algum uso no período (base do filtro do gráfico e dos "nunca usados")
  const modulosComUso = useMemo(
    () => (data?.por_modulo ?? []).map((m) => m.modulo),
    [data],
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

  const usuariosVisiveis = useMemo(() => {
    const lista = data?.por_usuario ?? []
    return mostrarSemUso ? lista : lista.filter((u) => u.total_acessos + u.total_acoes > 0)
  }, [data, mostrarSemUso])

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
      <div className="max-w-5xl mx-auto px-4 py-6">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[0, 1, 2, 3].map((i) => <div key={i} className={`h-16 rounded-xl border ${panel}`} />)}
            </div>
            <div className={`h-72 rounded-2xl border ${panel}`} />
            <div className={`h-64 rounded-2xl border ${panel}`} />
          </div>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
              <StatCard icon={MousePointerClick} label="Acessos no período" valor={data.resumo.total_acessos.toLocaleString('pt-BR')} tone="sky" isLight={isLight} />
              <StatCard icon={PencilLine} label="Ações registradas" valor={data.resumo.total_acoes.toLocaleString('pt-BR')} tone="violet" isLight={isLight} />
              <StatCard
                icon={Users}
                label={`Usuários ativos (${data.resumo.pct_adocao_geral}% de adoção)`}
                valor={String(data.resumo.usuarios_ativos_uso)}
                sub={`de ${data.resumo.base_usuarios}`}
                tone="emerald"
                isLight={isLight}
              />
              <StatCard icon={LayoutGrid} label="Módulos usados" valor={String(data.resumo.modulos_usados)} tone="amber" isLight={isLight} />
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

            {/* Evolução diária */}
            <div className={`rounded-2xl border p-4 mb-4 ${panel}`}>
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
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={serieDiaria}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fontSize: 11, fill: tickFill }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                    <Tooltip labelFormatter={fmtDia} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="acessos" name="Acessos" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="acoes" name="Ações" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Uso por módulo */}
            <div className={`rounded-2xl border p-4 mb-4 overflow-x-auto ${panel}`}>
              <h2 className={`text-sm font-semibold mb-3 ${heading}`}>Uso por módulo</h2>
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
                      <th className="py-2 font-medium w-[30%]">% dos usuários que usou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.por_modulo.map((m) => (
                      <tr key={m.modulo} className={`border-t ${rowBorder}`}>
                        <td className={`py-2 pr-3 font-medium ${heading}`}>{moduleLabel(m.modulo)}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{m.acessos.toLocaleString('pt-BR')}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{m.acoes.toLocaleString('pt-BR')}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{m.usuarios_distintos}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 flex-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                              <div
                                className="h-full rounded-full bg-sky-500"
                                style={{ width: `${Math.min(m.pct_adocao, 100)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] tabular-nums w-10 text-right ${label}`}>{m.pct_adocao}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Uso por usuário */}
            <div className={`rounded-2xl border p-4 mb-4 overflow-x-auto ${panel}`}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h2 className={`text-sm font-semibold mr-auto ${heading}`}>Uso por usuário</h2>
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
                <p className={`text-[13px] ${label}`}>Nenhum usuário com uso no período.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className={`text-left text-[11px] uppercase tracking-wide ${label}`}>
                      <th className="py-2 pr-3 font-medium">Usuário</th>
                      <th className="py-2 pr-3 font-medium text-right">Acessos</th>
                      <th className="py-2 pr-3 font-medium text-right">Ações</th>
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
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{u.total_acessos.toLocaleString('pt-BR')}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{u.total_acoes.toLocaleString('pt-BR')}</td>
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
            <div className="grid gap-4 lg:grid-cols-2">
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
                          <td className={`py-2 pr-3 text-right tabular-nums ${label}`}>{t.acessos.toLocaleString('pt-BR')}</td>
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
                          <td className={`py-2 text-right tabular-nums ${label}`}>{a.quantidade.toLocaleString('pt-BR')}</td>
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
    </div>
  )
}
