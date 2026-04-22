import { useState, useMemo } from 'react'
import { Gauge } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useKmPorVeiculo, useUtilizacaoVeiculos } from '../../../hooks/useTelemetria'
import { useVeiculos, useAlocacoes } from '../../../hooks/useFrotas'
import { formatCodigoCategoria } from '../../frotas/veiculoObs'
import VeiculoDetalhesModal from '../../frotas/VeiculoDetalhesModal'
import type { FroVeiculo, FroAlocacao, CategoriaVeiculo } from '../../../types/frotas'

const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  passeio: 'Passeio', pickup: 'Pickup', van: 'Van', vuc: 'VUC',
  truck: 'Truck', carreta: 'Carreta', moto: 'Moto', onibus: 'Ônibus',
}

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
  const [filtroCat, setFiltroCat] = useState<CategoriaVeiculo | 'todos'>('todos')
  const [filtroObra, setFiltroObra] = useState<string>('todas')
  const [detalheVeic, setDetalheVeic] = useState<{ v: FroVeiculo; a?: FroAlocacao } | null>(null)

  const inicioISO = inicio ? inicio + 'T00:00:00' : undefined
  const fimISO = fim ? fim + 'T23:59:59' : undefined

  const { data: kmData = [], isLoading: loadingKm } = useKmPorVeiculo(inicioISO, fimISO)
  const { data: utilizacaoData = [], isLoading: loadingUtil } = useUtilizacaoVeiculos(inicioISO, fimISO)
  const { data: veiculosAll = [] } = useVeiculos()
  const { data: alocacoes = [] } = useAlocacoes({ status: 'ativa' })

  const veicMap = useMemo(() => new Map(veiculosAll.map(v => [v.id, v])), [veiculosAll])
  const alocByVeic = useMemo(() => new Map(alocacoes.map(a => [a.veiculo_id, a])), [alocacoes])

  const obrasUnicas = useMemo(() => {
    const s = new Set<string>()
    alocacoes.forEach(a => { if (a.obra?.nome) s.add(a.obra.nome) })
    return Array.from(s).sort()
  }, [alocacoes])

  // Filtra kmData pela categoria e obra do veiculo
  const kmDataFiltered = useMemo(() => {
    return kmData.filter(k => {
      const v = veicMap.get(k.veiculo_id)
      if (filtroCat !== 'todos' && v?.categoria !== filtroCat) return false
      if (filtroObra !== 'todas' && alocByVeic.get(k.veiculo_id)?.obra?.nome !== filtroObra) return false
      return true
    })
  }, [kmData, veicMap, alocByVeic, filtroCat, filtroObra])

  const totalKm = useMemo(() => kmDataFiltered.reduce((s, v) => s + v.km_percorrido, 0), [kmDataFiltered])

  const isLoading = loadingKm || loadingUtil

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'

  const inputCls = `px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white'
  }`

  const thCls = `text-left text-[10px] font-bold uppercase tracking-[0.18em] px-4 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  const tdCls = `px-4 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  return (
    <div className="space-y-3">
      {/* ── Filtros inline ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`text-sm font-extrabold mr-auto ${isLight ? 'text-slate-800' : 'text-white'}`}>Utilização</h2>
        <input type="date" className={inputCls} value={inicio} onChange={e => setInicio(e.target.value)} title="Início" />
        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>→</span>
        <input type="date" className={inputCls} value={fim} onChange={e => setFim(e.target.value)} title="Fim" />
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value as CategoriaVeiculo | 'todos')} className={inputCls}>
          <option value="todos">Todos tipos</option>
          {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} className={`${inputCls} max-w-[200px]`}>
          <option value="todas">Todas obras</option>
          {obrasUnicas.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
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
          {/* ── Tabela Unica: KM + Utilizacao ────────────────────────── */}
          {(() => {
            // Mescla kmDataFiltered + utilizacaoData por veiculo_id
            const utilMap = new Map(utilizacaoData.map(u => [u.veiculo_id, u]))
            const diasUteis = utilizacaoData[0]?.dias_uteis_periodo ?? 0
            const rows = kmDataFiltered.map(km => ({
              km,
              util: utilMap.get(km.veiculo_id),
            }))
            if (rows.length === 0) return (
              <div className={`rounded-2xl py-12 text-center ${cardCls}`}>
                <Gauge size={36} className={`mx-auto mb-2 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                <p className="text-sm text-slate-500">Nenhum veículo encontrado com esses filtros</p>
              </div>
            )

            return (
              <div className={`rounded-2xl overflow-hidden ${cardCls}`}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                        <th className={thCls}>Veículo</th>
                        <th className={`${thCls} text-right`}>KM Início</th>
                        <th className={`${thCls} text-right`}>KM Fim</th>
                        <th className={`${thCls} text-right`}>KM Percorrido</th>
                        <th className={`${thCls} text-right whitespace-nowrap`}>Dias de Uso</th>
                        <th
                          className={`${thCls} text-right whitespace-nowrap`}
                          title="Dias de uso / dias úteis com dados da base telemetria (global)"
                        >
                          % Alocação
                          <span className="block text-[9px] font-normal opacity-70 normal-case tracking-normal">
                            base ajustada: {utilizacaoData[0]?.dias_uteis_ajustado ?? diasUteis} de {diasUteis} d. úteis
                            {(utilizacaoData[0]?.dias_sem_dados ?? 0) > 0 && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {' '}(−{utilizacaoData[0]?.dias_sem_dados}d s/ telemetria)
                              </span>
                            )}
                          </span>
                        </th>
                        <th className={`${thCls} min-w-[180px]`}>Utilização do período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ km: v, util }) => {
                        const horasOcioso = util ? Math.max(0, util.horas_ligado - util.horas_movimento) : 0
                        const horasDesligado = util ? Math.max(0, util.horas_total - util.horas_ligado) : 0
                        const pctMovimento = util && util.horas_total > 0 ? (util.horas_movimento / util.horas_total) * 100 : 0
                        const pctOcioso = util && util.horas_total > 0 ? (horasOcioso / util.horas_total) * 100 : 0
                        const pctDesligado = util && util.horas_total > 0 ? (horasDesligado / util.horas_total) * 100 : 0

                        const alocColor = !util || util.pct_alocacao < 50
                          ? 'text-rose-600 dark:text-rose-400'
                          : util.pct_alocacao < 75
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'

                        const veicFull = veicMap.get(v.veiculo_id)
                        const { codigo, categoria } = veicFull
                          ? formatCodigoCategoria(veicFull)
                          : { codigo: v.placa, categoria: '' }

                        return (
                          <tr
                            key={v.veiculo_id}
                            onClick={() => {
                              if (veicFull) setDetalheVeic({ v: veicFull, a: alocByVeic.get(v.veiculo_id) })
                            }}
                            className={`border-b last:border-b-0 cursor-pointer transition-colors ${
                              isLight ? 'border-slate-50 hover:bg-slate-50' : 'border-white/[0.03] hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className={tdCls}>
                              <div className="flex items-baseline gap-1.5">
                                <span className={`text-xs font-extrabold font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>{codigo}</span>
                                {categoria && (
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                                    {categoria}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {v.marca} {v.modelo}
                                <span className={isLight ? 'text-slate-300' : 'text-slate-600'}> · </span>
                                <span className="font-mono">{v.placa}</span>
                              </p>
                            </td>
                            <td className={`${tdCls} text-right tabular-nums`}>{fmtKm(v.km_inicio)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{fmtKm(v.km_fim)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold`}>{fmtKm(v.km_percorrido)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>
                              {util ? (
                                <>
                                  <span className="font-bold">{util.dias_uso}</span>
                                  <span className="text-xs text-slate-400"> / {util.dias_uteis_ajustado}</span>
                                </>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className={`${tdCls} text-right tabular-nums`}>
                              {util ? (
                                <span className={`font-extrabold ${alocColor}`}>{util.pct_alocacao.toFixed(0)}%</span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className={tdCls}>
                              {util ? (
                                <div>
                                  <div className={`flex h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`}>
                                    {pctMovimento > 0 && (
                                      <div
                                        className="bg-emerald-500"
                                        style={{ width: `${pctMovimento}%` }}
                                        title={`Em movimento: ${fmtHoras(util.horas_movimento)}h (${pctMovimento.toFixed(1)}%)`}
                                      />
                                    )}
                                    {pctOcioso > 0 && (
                                      <div
                                        className="bg-yellow-400"
                                        style={{ width: `${pctOcioso}%` }}
                                        title={`Ocioso: ${fmtHoras(horasOcioso)}h (${pctOcioso.toFixed(1)}%)`}
                                      />
                                    )}
                                    {pctDesligado > 0 && (
                                      <div
                                        className="bg-slate-300 dark:bg-slate-600"
                                        style={{ width: `${pctDesligado}%` }}
                                        title={`Desligado: ${fmtHoras(horasDesligado)}h (${pctDesligado.toFixed(1)}%)`}
                                      />
                                    )}
                                  </div>
                                  <p className="mt-1 text-[9px] text-slate-400 whitespace-nowrap">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtHoras(util.horas_movimento)}h</span>
                                    <span className="mx-1">·</span>
                                    <span className="text-yellow-600 dark:text-yellow-500 font-semibold">{fmtHoras(horasOcioso)}h</span>
                                    <span className="mx-1">·</span>
                                    <span className="font-semibold">{fmtHoras(horasDesligado)}h</span>
                                  </p>
                                </div>
                              ) : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Totals row */}
                      <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                        <td className={`${tdCls} font-extrabold`}>Total</td>
                        <td className={tdCls} />
                        <td className={tdCls} />
                        <td className={`${tdCls} text-right tabular-nums font-extrabold`}>{fmtKm(totalKm)}</td>
                        <td className={tdCls} colSpan={3} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Modal Detalhes */}
      {detalheVeic && (
        <VeiculoDetalhesModal
          veiculo={detalheVeic.v}
          isLight={isLight}
          onClose={() => setDetalheVeic(null)}
          alocacaoInfo={detalheVeic.a ? {
            id: detalheVeic.a.id,
            obraId: detalheVeic.a.obra_id,
            obra: detalheVeic.a.obra?.nome,
            responsavel: detalheVeic.a.responsavel_nome ?? undefined,
            dataSaida: detalheVeic.a.data_saida,
            dataRetornoPrev: detalheVeic.a.data_retorno_prev,
            observacoes: detalheVeic.a.observacoes ?? undefined,
          } : undefined}
        />
      )}
    </div>
  )
}
