import { useState, useMemo } from 'react'
import { X, Check, RotateCcw } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useVeiculos, useIntervalosPreventiva, useSalvarIntervalosCategoria, useResetarIntervalosCategoria } from '../../../hooks/useFrotas'
import type { CategoriaVeiculo } from '../../../types/frotas'

const CATEGORIAS: Array<{ key: CategoriaVeiculo; label: string; icon: string }> = [
  { key: 'passeio',  label: 'Passeio',  icon: '🚗' },
  { key: 'pickup',   label: 'Pickup',   icon: '🛻' },
  { key: 'van',      label: 'Van',      icon: '🚐' },
  { key: 'vuc',      label: 'VUC',      icon: '📦' },
  { key: 'truck',    label: 'Truck',    icon: '🚛' },
  { key: 'carreta',  label: 'Carreta',  icon: '🚚' },
  { key: 'moto',     label: 'Moto',     icon: '🏍️' },
  { key: 'onibus',   label: 'Ônibus',   icon: '🚌' },
]

export default function Planejamento() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [] } = useVeiculos()
  const [editCategoria, setEditCategoria] = useState<CategoriaVeiculo | null>(null)

  const countPorCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    for (const v of veiculos.filter(v => v.status !== 'baixado')) {
      map[v.categoria] = (map[v.categoria] ?? 0) + 1
    }
    return map
  }, [veiculos])

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'

  return (
    <div className="space-y-4 p-1">
      <div>
        <h2 className={`text-sm font-extrabold mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          Planos Preventivos por Tipo de Veículo
        </h2>
        <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Defina os intervalos de troca de cada item para cada categoria. Veículos herdam o plano do seu tipo.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIAS.map(cat => {
          const count = countPorCategoria[cat.key] ?? 0
          return (
            <button
              key={cat.key}
              onClick={() => setEditCategoria(cat.key)}
              className={`rounded-2xl p-4 text-left transition-all hover:shadow-md ${cardCls}`}
            >
              <div className="text-2xl mb-2">{cat.icon}</div>
              <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{cat.label}</p>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {count} veículo{count !== 1 ? 's' : ''}
              </p>
            </button>
          )
        })}
      </div>

      {editCategoria && (
        <ModalIntervalos
          categoria={editCategoria}
          label={CATEGORIAS.find(c => c.key === editCategoria)?.label ?? editCategoria}
          icon={CATEGORIAS.find(c => c.key === editCategoria)?.icon ?? '🚗'}
          isLight={isLight}
          onClose={() => setEditCategoria(null)}
        />
      )}
    </div>
  )
}

// ── Modal edição de intervalos ───────────────────────────────────────────────

function ModalIntervalos({ categoria, label, icon, isLight, onClose }: {
  categoria: CategoriaVeiculo; label: string; icon: string; isLight: boolean; onClose: () => void
}) {
  const { data: intervalos = [], isLoading } = useIntervalosPreventiva(categoria)
  const { data: defaults = [] } = useIntervalosPreventiva(null)
  const salvar = useSalvarIntervalosCategoria()
  const resetar = useResetarIntervalosCategoria()
  const [editados, setEditados] = useState<Record<string, { km: number; meses: number | null }>>({})

  const todosItens = useMemo(() => {
    const map = new Map(intervalos.map(i => [i.tipo_item, { ...i, isDefault: !(i as Record<string, unknown>).categoria }]))
    for (const d of defaults) {
      if (!map.has(d.tipo_item)) map.set(d.tipo_item, { ...d, isDefault: true })
    }
    return Array.from(map.values()).sort((a, b) => a.intervalo_km - b.intervalo_km)
  }, [intervalos, defaults])

  const handleChange = (tipo: string, field: 'km' | 'meses', val: number) => {
    const item = todosItens.find(i => i.tipo_item === tipo)!
    setEditados(prev => ({
      ...prev,
      [tipo]: {
        km: field === 'km' ? val : (prev[tipo]?.km ?? item.intervalo_km),
        meses: field === 'meses' ? val : (prev[tipo]?.meses ?? item.intervalo_meses),
      },
    }))
  }

  const handleSalvar = async () => {
    const rows = todosItens.map(i => ({
      tipo_item: i.tipo_item, descricao: i.descricao,
      intervalo_km: editados[i.tipo_item]?.km ?? i.intervalo_km,
      intervalo_meses: editados[i.tipo_item]?.meses ?? i.intervalo_meses,
    }))
    await salvar.mutateAsync({ categoria, intervalos: rows })
    onClose()
  }

  const handleResetar = async () => {
    await resetar.mutateAsync(categoria)
    setEditados({})
  }

  const cardCls = isLight ? 'bg-white shadow-xl' : 'bg-[#1e293b] shadow-xl'
  const thCls = `text-left text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-24 px-2 py-1.5 rounded-lg text-sm text-center border focus:outline-none focus:ring-2 focus:ring-sky-400/40 ${
    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-white/[0.06] border-white/[0.08] text-white'
  }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col ${cardCls}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Plano Preventivo — {label}</h3>
              <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Intervalos de troca para categoria {label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                  <th className={thCls}>Item</th>
                  <th className={`${thCls} text-center`}>KM</th>
                  <th className={`${thCls} text-center`}>Meses</th>
                  <th className={`${thCls} text-center`}>Origem</th>
                </tr>
              </thead>
              <tbody>
                {todosItens.map(item => (
                  <tr key={item.tipo_item} className={`border-b last:border-b-0 ${isLight ? 'border-slate-50' : 'border-white/[0.03]'}`}>
                    <td className={`${tdCls} font-semibold`}>{item.descricao}</td>
                    <td className={`${tdCls} text-center`}>
                      <input type="number" min={1000} step={1000}
                        value={editados[item.tipo_item]?.km ?? item.intervalo_km}
                        onChange={e => handleChange(item.tipo_item, 'km', Number(e.target.value))}
                        className={inputCls} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <input type="number" min={1}
                        value={editados[item.tipo_item]?.meses ?? item.intervalo_meses ?? ''}
                        onChange={e => handleChange(item.tipo_item, 'meses', e.target.value ? Number(e.target.value) : 0)}
                        className={inputCls} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        item.isDefault
                          ? isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'
                          : isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/15 text-sky-400'
                      }`}>{item.isDefault ? 'Padrão' : label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`flex items-center justify-between p-4 border-t ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <button onClick={handleResetar} disabled={resetar.isPending}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/5'}`}>
            <RotateCcw size={13} /> Usar Padrão
          </button>
          <button onClick={handleSalvar} disabled={salvar.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors">
            <Check size={14} /> {salvar.isPending ? 'Salvando...' : 'Salvar Plano'}
          </button>
        </div>
      </div>
    </div>
  )
}
