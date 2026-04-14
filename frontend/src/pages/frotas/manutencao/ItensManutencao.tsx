import { useState, useMemo } from 'react'
import { Settings2, Plus, Check, X } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useVeiculos, useIntervalosPreventiva, useItensManutencao, useRegistrarTroca, useInicializarItensVeiculo } from '../../../hooks/useFrotas'

const ITEM_LABELS: Record<string, string> = {
  oleo_motor: 'Óleo do Motor',
  filtro_oleo: 'Filtro de Óleo',
  filtro_ar: 'Filtro de Ar',
  pneus: 'Pneus',
  bateria: 'Bateria',
  freios_pastilhas: 'Freios (Pastilhas)',
  suspensao: 'Suspensão',
  correia_dentada: 'Correia Dentada',
  fluido_freio: 'Fluido de Freio',
}

function fmtKm(v: number) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export default function ItensManutencao() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [] } = useVeiculos()
  const { data: intervalos = [] } = useIntervalosPreventiva()
  const [veiculoId, setVeiculoId] = useState('')
  const [modal, setModal] = useState<{ tipo: string; descricao: string } | null>(null)
  const [formKm, setFormKm] = useState('')
  const [formData, setFormData] = useState('')
  const [formObs, setFormObs] = useState('')

  const veiculo = useMemo(() => veiculos.find(v => v.id === veiculoId), [veiculos, veiculoId])
  const { data: itens = [], isLoading } = useItensManutencao(veiculoId || undefined)
  const registrarTroca = useRegistrarTroca()
  const inicializar = useInicializarItensVeiculo()

  const intMap = useMemo(() => new Map(intervalos.map(i => [i.tipo_item, i])), [intervalos])

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'
  const inputCls = `px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white'
  }`
  const lblCls = `text-[10px] font-bold uppercase tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const thCls = `text-left text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  const ativos = veiculos.filter(v => v.status !== 'baixado')
  const hodometro = veiculo?.hodometro_atual ?? 0

  function abrirModal(tipo: string) {
    setModal({ tipo, descricao: ITEM_LABELS[tipo] ?? tipo })
    setFormKm(String(hodometro))
    setFormData(new Date().toISOString().split('T')[0])
    setFormObs('')
  }

  async function salvarTroca() {
    if (!modal || !veiculoId) return
    await registrarTroca.mutateAsync({
      veiculoId,
      tipoItem: modal.tipo,
      kmAtual: Number(formKm),
      data: formData,
      observacoes: formObs || undefined,
    })
    setModal(null)
  }

  return (
    <div className="space-y-4">
      {/* Seletor de veículo */}
      <div className={`rounded-2xl p-4 ${cardCls}`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[220px]">
            <label className={`block mb-1 ${lblCls}`}>Veículo</label>
            <select className={inputCls + (isLight ? '' : ' [&>option]:bg-slate-900')} value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
              <option value="">Selecione um veículo</option>
              {ativos.map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          {veiculo && (
            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Hodômetro atual: <span className="font-bold">{fmtKm(hodometro)} km</span>
              {' '}(via telemetria)
            </div>
          )}
        </div>
      </div>

      {!veiculoId && (
        <div className="flex flex-col items-center justify-center py-16">
          <Settings2 size={36} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Selecione um veículo para ver os itens de manutenção.
          </p>
        </div>
      )}

      {veiculoId && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`rounded-xl h-12 animate-pulse ${cardCls}`} />
          ))}
        </div>
      )}

      {veiculoId && !isLoading && itens.length === 0 && (
        <div className={`rounded-2xl p-6 text-center ${cardCls}`}>
          <p className={`text-sm mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum item de manutenção registrado para este veículo.
          </p>
          <button
            onClick={() => inicializar.mutate(veiculoId)}
            disabled={inicializar.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            <Plus size={14} />
            {inicializar.isPending ? 'Inicializando...' : 'Inicializar 9 Itens Padrão'}
          </button>
        </div>
      )}

      {veiculoId && !isLoading && itens.length > 0 && (
        <div className={`rounded-2xl overflow-hidden ${cardCls}`}>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                <th className={thCls}>Item</th>
                <th className={`${thCls} text-right`}>Km Última</th>
                <th className={`${thCls} text-right hidden sm:table-cell`}>Data</th>
                <th className={`${thCls} text-right hidden md:table-cell`}>Intervalo</th>
                <th className={`${thCls} text-right`}>Próxima</th>
                <th className={`${thCls} text-right`}>Restante</th>
                <th className={`${thCls} text-center`}>Status</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => {
                const int = intMap.get(item.tipo_item)
                const restante = (item.km_proxima_troca ?? 0) - hodometro
                const status = restante <= 0 ? 'vencido' : restante <= 2000 ? 'em_breve' : 'ok'
                const statusCfg = {
                  vencido: { label: 'Vencido', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
                  em_breve: { label: 'Em breve', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
                  ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
                }[status]

                return (
                  <tr key={item.id} className={`border-b last:border-b-0 ${isLight ? 'border-slate-50' : 'border-white/[0.03]'}`}>
                    <td className={`${tdCls} font-semibold`}>{ITEM_LABELS[item.tipo_item] ?? item.tipo_item}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{fmtKm(item.km_ultima_troca)}</td>
                    <td className={`${tdCls} text-right hidden sm:table-cell text-xs text-slate-400`}>
                      {item.data_ultima_troca ? new Date(item.data_ultima_troca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className={`${tdCls} text-right hidden md:table-cell text-xs text-slate-400`}>
                      {int ? `${fmtKm(int.intervalo_km)} km` : '—'}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold`}>{fmtKm(item.km_proxima_troca ?? 0)}</td>
                    <td className={`${tdCls} text-right tabular-nums font-bold ${
                      restante <= 0 ? 'text-red-500' : restante <= 2000 ? 'text-amber-500' : isLight ? 'text-emerald-600' : 'text-emerald-400'
                    }`}>
                      {fmtKm(restante)}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className={tdCls}>
                      <button
                        onClick={() => abrirModal(item.tipo_item)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                          isLight ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
                        }`}
                      >
                        Registrar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Registrar Troca */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setModal(null)}>
          <div className={`rounded-2xl p-6 w-full max-w-md space-y-4 ${cardCls}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Registrar Troca — {modal.descricao}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {veiculo?.placa} — {veiculo?.marca} {veiculo?.modelo}
            </p>
            <div className="space-y-3">
              <div>
                <label className={`block mb-1 ${lblCls}`}>KM da Troca</label>
                <input type="number" className={inputCls + ' w-full'} value={formKm} onChange={e => setFormKm(e.target.value)} />
              </div>
              <div>
                <label className={`block mb-1 ${lblCls}`}>Data</label>
                <input type="date" className={inputCls + ' w-full'} value={formData} onChange={e => setFormData(e.target.value)} />
              </div>
              <div>
                <label className={`block mb-1 ${lblCls}`}>Observações</label>
                <textarea className={inputCls + ' w-full h-16 resize-none'} value={formObs} onChange={e => setFormObs(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'
              }`}>Cancelar</button>
              <button
                onClick={salvarTroca}
                disabled={registrarTroca.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
              >
                <Check size={14} />
                {registrarTroca.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
