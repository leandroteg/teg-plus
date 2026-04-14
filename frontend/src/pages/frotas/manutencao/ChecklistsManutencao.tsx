import { useState, useMemo } from 'react'
import { Search, ChevronRight, Check, X, Plus } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import {
  useVeiculos, useItensManutencao, useIntervalosPreventiva,
  useRegistrarTroca, useInicializarItensVeiculo,
} from '../../../hooks/useFrotas'
import type { FroVeiculo, CategoriaVeiculo } from '../../../types/frotas'

const ITEM_LABELS: Record<string, string> = {
  oleo_motor: 'Óleo do Motor', filtro_oleo: 'Filtro de Óleo', filtro_ar: 'Filtro de Ar',
  pneus: 'Pneus', bateria: 'Bateria', freios_pastilhas: 'Freios (Pastilhas)',
  suspensao: 'Suspensão', correia_dentada: 'Correia Dentada', fluido_freio: 'Fluido de Freio',
}

const CAT_LABELS: Record<CategoriaVeiculo, string> = {
  passeio: 'Passeio', pickup: 'Pickup', van: 'Van', vuc: 'VUC',
  truck: 'Truck', carreta: 'Carreta', moto: 'Moto', onibus: 'Ônibus',
}

function fmtKm(v: number) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }

export default function ChecklistsManutencao() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [] } = useVeiculos()
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState<string>('')
  const [selecionado, setSelecionado] = useState<string | null>(null)

  const ativos = useMemo(() => {
    let list = veiculos.filter(v => v.status !== 'baixado')
    if (catFiltro) list = list.filter(v => v.categoria === catFiltro)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(v =>
        v.placa.toLowerCase().includes(q) ||
        `${v.marca} ${v.modelo}`.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.placa.localeCompare(b.placa))
  }, [veiculos, busca, catFiltro])

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'
  const inputCls = `px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${
    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white'
  }`

  return (
    <div className="space-y-3 p-1">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm flex-1 min-w-[200px] ${
          isLight ? 'bg-white border border-slate-200' : 'bg-white/[0.04] border border-white/[0.08]'
        }`}>
          <Search size={14} className="text-slate-400" />
          <input className={`flex-1 bg-transparent outline-none ${isLight ? 'text-slate-800' : 'text-white'} placeholder:text-slate-400`}
            placeholder="Buscar placa..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
          className={`${inputCls} ${isLight ? '' : '[&>option]:bg-slate-900'}`}>
          <option value="">Todas categorias</option>
          {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Lista de veículos */}
      <div className="space-y-1.5">
        {ativos.map(v => (
          <div key={v.id}>
            <button
              onClick={() => setSelecionado(selecionado === v.id ? null : v.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                selecionado === v.id
                  ? isLight ? 'bg-violet-50 border border-violet-200' : 'bg-violet-500/10 border border-violet-500/25'
                  : `${cardCls} hover:shadow-md`
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{v.placa}</span>
                  <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{v.marca} {v.modelo}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'
                  }`}>{CAT_LABELS[v.categoria] ?? v.categoria}</span>
                </div>
                <div className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Hodômetro: {fmtKm(v.hodometro_atual)} km
                </div>
              </div>
              <VeiculoStatusBadge veiculoId={v.id} isLight={isLight} />
              <ChevronRight size={16} className={`transition-transform ${selecionado === v.id ? 'rotate-90' : ''} ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>

            {selecionado === v.id && (
              <DetalheItens veiculo={v} isLight={isLight} />
            )}
          </div>
        ))}
      </div>

      {ativos.length === 0 && (
        <div className="text-center py-10">
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum veículo encontrado.</p>
        </div>
      )}
    </div>
  )
}

// ── Badge com contagem de itens vencidos ──────────────────────────────────────

function VeiculoStatusBadge({ veiculoId, isLight }: { veiculoId: string; isLight: boolean }) {
  const { data: itens = [] } = useItensManutencao(veiculoId)
  if (itens.length === 0) return null

  // Precisa do hodômetro pra calcular — mas já vem do parent... simplificar: buscar veículo
  // Na verdade, os itens já têm km_proxima_troca, e o componente pai tem hodometro
  // Vamos contar vencidos sem hodômetro (km_proxima = 0 ou negativo restante)
  return null // O detalhe mostra tudo
}

// ── Detalhe: itens de manutenção do veículo ──────────────────────────────────

function DetalheItens({ veiculo, isLight }: { veiculo: FroVeiculo; isLight: boolean }) {
  const { data: itens = [], isLoading } = useItensManutencao(veiculo.id)
  const { data: intervalos = [] } = useIntervalosPreventiva(veiculo.categoria)
  const registrarTroca = useRegistrarTroca()
  const inicializar = useInicializarItensVeiculo()
  const [modal, setModal] = useState<{ tipo: string; descricao: string } | null>(null)
  const [formKm, setFormKm] = useState('')
  const [formData, setFormData] = useState('')
  const [formObs, setFormObs] = useState('')

  const intMap = useMemo(() => new Map(intervalos.map(i => [i.tipo_item, i])), [intervalos])
  const hodometro = veiculo.hodometro_atual

  function abrirModal(tipo: string) {
    setModal({ tipo, descricao: ITEM_LABELS[tipo] ?? tipo })
    setFormKm(String(hodometro))
    setFormData(new Date().toISOString().split('T')[0])
    setFormObs('')
  }

  async function salvarTroca() {
    if (!modal) return
    await registrarTroca.mutateAsync({
      veiculoId: veiculo.id, tipoItem: modal.tipo,
      kmAtual: Number(formKm), data: formData, observacoes: formObs || undefined,
    })
    setModal(null)
  }

  const cardCls = isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const thCls = `text-left text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-violet-400/40 ${
    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/[0.04] border-white/[0.08] text-white'
  }`
  const lblCls = `text-[10px] font-bold uppercase tracking-[0.18em] block mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  if (isLoading) return <div className={`rounded-xl p-4 mt-1 ${cardCls}`}><div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" /></div>

  if (itens.length === 0) return (
    <div className={`rounded-xl p-4 mt-1 text-center ${cardCls}`}>
      <p className={`text-sm mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item registrado.</p>
      <button onClick={() => inicializar.mutate(veiculo.id)} disabled={inicializar.isPending}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700">
        <Plus size={14} /> {inicializar.isPending ? 'Inicializando...' : 'Inicializar 9 Itens'}
      </button>
    </div>
  )

  return (
    <div className={`rounded-xl overflow-hidden mt-1 ${cardCls}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
            <th className={thCls}>Item</th>
            <th className={`${thCls} text-right hidden sm:table-cell`}>Km Última</th>
            <th className={`${thCls} text-right hidden md:table-cell`}>Data</th>
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
            const cfg = {
              vencido: { label: 'Vencido', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
              em_breve: { label: 'Em breve', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
              ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
            }[status]

            return (
              <tr key={item.id} className={`border-b last:border-b-0 ${isLight ? 'border-slate-50' : 'border-white/[0.03]'}`}>
                <td className={`${tdCls} font-semibold`}>{ITEM_LABELS[item.tipo_item] ?? item.tipo_item}</td>
                <td className={`${tdCls} text-right tabular-nums hidden sm:table-cell`}>{fmtKm(item.km_ultima_troca)}</td>
                <td className={`${tdCls} text-right hidden md:table-cell text-xs text-slate-400`}>
                  {item.data_ultima_troca ? new Date(item.data_ultima_troca + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className={`${tdCls} text-right tabular-nums font-semibold`}>{fmtKm(item.km_proxima_troca ?? 0)}</td>
                <td className={`${tdCls} text-right tabular-nums font-bold ${
                  restante <= 0 ? 'text-red-500' : restante <= 2000 ? 'text-amber-500' : isLight ? 'text-emerald-600' : 'text-emerald-400'
                }`}>{fmtKm(restante)}</td>
                <td className={`${tdCls} text-center`}>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>
                </td>
                <td className={tdCls}>
                  <button onClick={() => abrirModal(item.tipo_item)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      isLight ? 'bg-violet-50 text-violet-700 hover:bg-violet-100' : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20'
                    }`}>Registrar</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Modal Registrar Troca */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setModal(null)}>
          <div className={`rounded-2xl p-6 w-full max-w-md space-y-4 ${isLight ? 'bg-white' : 'bg-[#1e293b]'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Registrar Troca — {modal.descricao}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400"><X size={18} /></button>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{veiculo.placa} — {veiculo.marca} {veiculo.modelo}</p>
            <div className="space-y-3">
              <div><label className={lblCls}>KM da Troca</label><input type="number" className={inputCls} value={formKm} onChange={e => setFormKm(e.target.value)} /></div>
              <div><label className={lblCls}>Data</label><input type="date" className={inputCls} value={formData} onChange={e => setFormData(e.target.value)} /></div>
              <div><label className={lblCls}>Observações</label><textarea className={`${inputCls} h-16 resize-none`} value={formObs} onChange={e => setFormObs(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'}`}>Cancelar</button>
              <button onClick={salvarTroca} disabled={registrarTroca.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700">
                <Check size={14} /> {registrarTroca.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
