import { useState, useMemo } from 'react'
import { Gauge } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useKmPorVeiculo, useUtilizacaoVeiculos } from '../../../hooks/useTelemetria'

// ── Helpers ─────────────────────────────────────────────────────────────────

function inicioDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fimDoMes(): string {
  const d = new Date()
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${ultimo.getFullYear()}-${String(ultimo.getMonth() + 1).padStart(2, '0')}-${String(ultimo.getDate()).padStart(2, '0')}`
}

function fmtKm(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function fmtHoras(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// ── Component ───────────────────────────────────────────────────────────────

export default function KmUtilizacao() {
  const { isLightSidebar: isLight } = useTheme()

  const [inicio, setInicio] = useState(inicioDoMes)
  const [fim, setFim] = useState(fimDoMes)

  const inicioISO = inicio ? inicio + 'T00:00:00' : undefined
  const fimISO = fim ? fim + 'T23:59:59' : undefined

  const { data: kmData = [], isLoading: loadingKm } = useKmPorVeiculo(inicioISO, fimISO)
  const { data: utilizacaoData = [], isLoading: loadingUtil } = useUtilizacaoVeiculos(inicioISO, fimISO)

  const totalKm = useMemo(() => kmData.reduce((s, v) => s + v.km_percorrido, 0), [kmData])

  const isLoading = loadingKm || loadingUtil

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'

  const inputCls = `px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 shadow-sm text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white'
  }`

  const lblCls = `text-[10px] font-bold uppercase tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  const thCls = `text-left text-[10px] font-bold uppercase tracking-[0.18em] px-4 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  const tdCls = `px-4 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  return (
    <div className="space-y-6">
      {/* ── Date range ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 ${cardCls}`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={`block mb-1 ${lblCls}`}>Início</label>
            <input type="date" className={inputCls} value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <label className={`block mb-1 ${lblCls}`}>Fim</label>
            <input type="date" className={inputCls} value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-xl h-14 animate-pulse ${cardCls}`} />
          ))}
        </div>
      ) : kmData.length === 0 && utilizacaoData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Gauge size={36} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum dado de quilometragem no período selecionado.
          </p>
        </div>
      ) : (
        <>
          {/* ── KM Rodada ────────────────────────────────────────────── */}
          {kmData.length > 0 && (
            <div>
              <h3 className={`text-sm font-extrabold mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                KM Rodada
              </h3>
              <div className={`rounded-2xl overflow-hidden ${cardCls}`}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                      <th className={thCls}>Veículo</th>
                      <th className={`${thCls} text-right`}>KM Início</th>
                      <th className={`${thCls} text-right`}>KM Fim</th>
                      <th className={`${thCls} text-right`}>KM Percorrido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kmData.map(v => (
                      <tr key={v.veiculo_id} className={`border-b last:border-b-0 ${isLight ? 'border-slate-50' : 'border-white/[0.03]'}`}>
                        <td className={tdCls}>
                          <span className="font-bold">{v.placa}</span>
                          {v.marca && (
                            <span className="text-xs text-slate-400 ml-2">{v.marca} {v.modelo}</span>
                          )}
                        </td>
                        <td className={`${tdCls} text-right tabular-nums`}>{fmtKm(v.km_inicio)}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{fmtKm(v.km_fim)}</td>
                        <td className={`${tdCls} text-right tabular-nums font-bold`}>{fmtKm(v.km_percorrido)}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                      <td className={`${tdCls} font-extrabold`}>Total</td>
                      <td className={tdCls} />
                      <td className={tdCls} />
                      <td className={`${tdCls} text-right tabular-nums font-extrabold`}>{fmtKm(totalKm)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Utilização ───────────────────────────────────────────── */}
          {utilizacaoData.length > 0 && (
            <div>
              <h3 className={`text-sm font-extrabold mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Utilização
              </h3>
              <div className="space-y-3">
                {utilizacaoData.map(v => {
                  const horasOcioso = Math.max(0, v.horas_ligado - v.horas_movimento)
                  const horasDesligado = Math.max(0, v.horas_total - v.horas_ligado)

                  const pctMovimento = v.horas_total > 0 ? (v.horas_movimento / v.horas_total) * 100 : 0
                  const pctOcioso = v.horas_total > 0 ? (horasOcioso / v.horas_total) * 100 : 0
                  const pctDesligado = v.horas_total > 0 ? (horasDesligado / v.horas_total) * 100 : 0

                  return (
                    <div key={v.veiculo_id} className={`rounded-xl px-4 py-3 ${cardCls}`}>
                      {/* Vehicle info */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {v.placa}
                          </span>
                          {v.marca && (
                            <span className="text-xs text-slate-400 ml-2">{v.marca} {v.modelo}</span>
                          )}
                        </div>
                      </div>

                      {/* Stacked bar */}
                      <div className="flex h-5 rounded-lg overflow-hidden">
                        {pctMovimento > 0 && (
                          <div
                            className="bg-emerald-500 transition-all"
                            style={{ width: `${pctMovimento}%` }}
                            title={`Em movimento: ${fmtHoras(v.horas_movimento)}h (${pctMovimento.toFixed(1)}%)`}
                          />
                        )}
                        {pctOcioso > 0 && (
                          <div
                            className="bg-yellow-400 transition-all"
                            style={{ width: `${pctOcioso}%` }}
                            title={`Ocioso: ${fmtHoras(horasOcioso)}h (${pctOcioso.toFixed(1)}%)`}
                          />
                        )}
                        {pctDesligado > 0 && (
                          <div
                            className="bg-slate-300 dark:bg-slate-600 transition-all"
                            style={{ width: `${pctDesligado}%` }}
                            title={`Desligado: ${fmtHoras(horasDesligado)}h (${pctDesligado.toFixed(1)}%)`}
                          />
                        )}
                      </div>

                      {/* Labels */}
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtHoras(v.horas_movimento)}h movimento</span>
                        <span className="mx-1.5">&middot;</span>
                        <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{fmtHoras(horasOcioso)}h ocioso</span>
                        <span className="mx-1.5">&middot;</span>
                        <span className="font-semibold">{fmtHoras(horasDesligado)}h desligado</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
