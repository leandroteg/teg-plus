import { useState } from 'react'
import { Camera, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { EstadoItem, LocVistoriaItem } from '../../types/locacao'

const AMBIENTES = [
  'Recepcao / Entrada',
  'Sala',
  'Cozinha',
  'Banheiro(s)',
  'Dormitorio(s)',
  'Area de Servico',
  'Garagem',
  'Area Externa',
]

const ITENS_POR_AMBIENTE = [
  'Piso',
  'Parede',
  'Teto',
  'Janelas',
  'Portas',
  'Eletrica',
  'Hidraulica',
  'Iluminacao',
]

const ESTADOS: { value: EstadoItem; label: string; color: string }[] = [
  { value: 'otimo',         label: 'Otimo',      color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'bom',           label: 'Bom',         color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'regular',       label: 'Regular',     color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'ruim',          label: 'Ruim',        color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'nao_se_aplica', label: 'N/A',         color: 'bg-slate-100 text-slate-500 border-slate-200' },
]

export type ChecklistItem = {
  ambiente: string
  item: string
  estado: EstadoItem | null
  observacao: string
}

interface Props {
  tipo: 'entrada' | 'saida'
  itens?: ChecklistItem[]
  onChange?: (itens: ChecklistItem[]) => void
  readOnly?: boolean
  comparativo?: LocVistoriaItem[]
}

function buildDefaultItens(): ChecklistItem[] {
  return AMBIENTES.flatMap(ambiente =>
    ITENS_POR_AMBIENTE.map(item => ({ ambiente, item, estado: null, observacao: '' }))
  )
}

export default function VistoriaChecklist({ tipo, itens: externalItens, onChange, readOnly = false, comparativo }: Props) {
  const { isDark } = useTheme()
  const [itens, setItens] = useState<ChecklistItem[]>(externalItens ?? buildDefaultItens())
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleAmbiente = (ambiente: string) => {
    setCollapsed(prev => ({ ...prev, [ambiente]: !prev[ambiente] }))
  }

  const updateItem = (idx: number, field: keyof ChecklistItem, value: string) => {
    const next = itens.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    setItens(next)
    onChange?.(next)
  }

  const grouped = AMBIENTES.map(ambiente => ({
    ambiente,
    items: itens.map((it, idx) => ({ ...it, idx })).filter(it => it.ambiente === ambiente),
  }))

  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const headerBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-3">
      {grouped.map(({ ambiente, items }) => (
        <div key={ambiente} className={`rounded-xl border overflow-hidden ${bg}`}>
          <button
            type="button"
            onClick={() => toggleAmbiente(ambiente)}
            className={`w-full flex items-center justify-between px-4 py-3 ${headerBg}`}
          >
            <span className={`text-sm font-semibold ${txt}`}>{ambiente}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${txtMuted}`}>
                {items.filter(it => it.estado !== null).length}/{items.length} preenchidos
              </span>
              {collapsed[ambiente] ? <ChevronDown size={14} className={txtMuted} /> : <ChevronUp size={14} className={txtMuted} />}
            </div>
          </button>

          {!collapsed[ambiente] && (
            <div className="divide-y divide-slate-100">
              {items.map(({ idx, item, estado, observacao }) => {
                const comp = comparativo?.find(c => c.ambiente === ambiente && c.item === item)
                const hasDivergencia = comp && comp.estado_entrada && estado && comp.estado_entrada !== estado

                return (
                  <div key={item} className={`px-4 py-3 ${hasDivergencia ? (isDark ? 'bg-amber-500/5' : 'bg-amber-50') : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${txt}`}>{item}</p>
                        {comp?.estado_entrada && (
                          <p className={`text-xs mt-0.5 ${txtMuted}`}>
                            Entrada: <span className="font-medium">{comp.estado_entrada}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {ESTADOS.map(({ value, label, color }) => (
                          <button
                            key={value}
                            type="button"
                            disabled={readOnly}
                            onClick={() => updateItem(idx, 'estado', value)}
                            className={[
                              'px-2 py-0.5 rounded border text-[10px] font-semibold transition-all',
                              estado === value ? color : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-400',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {hasDivergencia && (
                      <p className="text-xs mt-1 text-amber-600 font-medium">
                        Divergencia detectada
                      </p>
                    )}

                    {!readOnly && (
                      <input
                        type="text"
                        placeholder="Observacao..."
                        value={observacao}
                        onChange={e => updateItem(idx, 'observacao', e.target.value)}
                        className={[
                          'mt-2 w-full text-xs rounded-lg px-3 py-1.5 border outline-none transition-colors',
                          isDark
                            ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
                            : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400',
                        ].join(' ')}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className={`rounded-xl border border-dashed p-4 text-center ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <Camera size={20} className={`mx-auto mb-1 ${txtMuted}`} />
          <p className={`text-xs ${txtMuted}`}>Anexar fotos (em breve)</p>
        </div>
      )}
    </div>
  )
}
