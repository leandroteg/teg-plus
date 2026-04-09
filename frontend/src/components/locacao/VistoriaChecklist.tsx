import { useState, useRef } from 'react'
import { Camera, ChevronDown, ChevronUp, X, ImageIcon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { EstadoItem, LocVistoriaItem, LocVistoriaFoto } from '../../types/locacao'

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

export { AMBIENTES, ITENS_POR_AMBIENTE }

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
  fotos?: LocVistoriaFoto[]
  onUploadFoto?: (ambiente: string, item: string, file: File) => void
  uploadingFoto?: boolean
}

export function buildDefaultItens(): ChecklistItem[] {
  return AMBIENTES.flatMap(ambiente =>
    ITENS_POR_AMBIENTE.map(item => ({ ambiente, item, estado: null, observacao: '' }))
  )
}

export default function VistoriaChecklist({ tipo, itens: externalItens, onChange, readOnly = false, comparativo, fotos = [], onUploadFoto, uploadingFoto }: Props) {
  const { isDark } = useTheme()
  const [itens, setItens] = useState<ChecklistItem[]>(externalItens ?? buildDefaultItens())
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ ambiente: string; item: string } | null>(null)

  const toggleAmbiente = (ambiente: string) => {
    setCollapsed(prev => ({ ...prev, [ambiente]: !prev[ambiente] }))
  }

  const updateItem = (idx: number, field: keyof ChecklistItem, value: string) => {
    const next = itens.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    setItens(next)
    onChange?.(next)
  }

  const handleFotoClick = (ambiente: string, item: string) => {
    setPendingUpload({ ambiente, item })
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingUpload && onUploadFoto) {
      onUploadFoto(pendingUpload.ambiente, pendingUpload.item, file)
    }
    e.target.value = ''
    setPendingUpload(null)
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
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {grouped.map(({ ambiente, items }) => {
        const ambienteFotos = fotos.filter(f => {
          const itemIds = items.map(it => `${ambiente}|${it.item}`)
          return !f.item_id ? f.descricao === ambiente : itemIds.some(iid => f.descricao === iid)
        })

        return (
          <div key={ambiente} className={`rounded-xl border overflow-hidden ${bg}`}>
            <button
              type="button"
              onClick={() => toggleAmbiente(ambiente)}
              className={`w-full flex items-center justify-between px-4 py-3 ${headerBg}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${txt}`}>{ambiente}</span>
                {ambienteFotos.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-500">
                    <ImageIcon size={10} /> {ambienteFotos.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${txtMuted}`}>
                  {items.filter(it => it.estado !== null).length}/{items.length}
                </span>
                {collapsed[ambiente] ? <ChevronDown size={14} className={txtMuted} /> : <ChevronUp size={14} className={txtMuted} />}
              </div>
            </button>

            {!collapsed[ambiente] && (
              <div className="divide-y divide-slate-100">
                {items.map(({ idx, item, estado, observacao }) => {
                  const comp = comparativo?.find(c => c.ambiente === ambiente && c.item === item)
                  const hasDivergencia = comp && comp.estado_entrada && estado && comp.estado_entrada !== estado
                  const itemFotos = fotos.filter(f => f.descricao === `${ambiente}|${item}`)

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

                      <div className="flex items-center gap-2 mt-2">
                        {!readOnly && (
                          <input
                            type="text"
                            placeholder="Observacao..."
                            value={observacao}
                            onChange={e => updateItem(idx, 'observacao', e.target.value)}
                            className={[
                              'flex-1 text-xs rounded-lg px-3 py-1.5 border outline-none transition-colors',
                              isDark
                                ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
                                : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400',
                            ].join(' ')}
                          />
                        )}
                        {!readOnly && onUploadFoto && (
                          <button
                            type="button"
                            disabled={uploadingFoto}
                            onClick={() => handleFotoClick(ambiente, item)}
                            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                              isDark ? 'border-white/10 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'
                                     : 'border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300'
                            } ${uploadingFoto ? 'opacity-50' : ''}`}
                            title="Anexar foto"
                          >
                            <Camera size={14} />
                          </button>
                        )}
                      </div>

                      {/* Thumbnails de fotos */}
                      {itemFotos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {itemFotos.map(f => (
                            <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                              className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors">
                              <img src={f.url} alt="" className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
