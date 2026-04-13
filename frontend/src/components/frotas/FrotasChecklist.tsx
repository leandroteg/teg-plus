// ---------------------------------------------------------------------------
// FrotasChecklist.tsx -- Checklist de veiculo com categorias por faixa de ordem
// Segue o padrao visual de VistoriaChecklist.tsx (Locacao) adaptado para Frotas.
// Accent color: rose (vs indigo da Locacao).
// ---------------------------------------------------------------------------

import { useState, useRef, useMemo } from 'react'
import { Camera, ChevronDown, ChevronUp, ImageIcon, MessageSquare } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { FroChecklistTemplateItem } from '../../types/frotas'

// -- Estado types (same 5-grade as Locacao) -----------------------------------

export type EstadoItemVeiculo = 'otimo' | 'bom' | 'regular' | 'ruim' | 'nao_se_aplica'

const ESTADOS: { value: EstadoItemVeiculo; label: string; color: string }[] = [
  { value: 'otimo',         label: 'Otimo',   color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'bom',           label: 'Bom',     color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'regular',       label: 'Regular', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'ruim',          label: 'Ruim',    color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'nao_se_aplica', label: 'N/A',     color: 'bg-slate-100 text-slate-500 border-slate-200' },
]

// -- Categories by ordem range ------------------------------------------------

export const CATEGORIAS_VEICULO: Record<string, { label: string; emoji: string; range: [number, number] }> = {
  documentacao: { label: 'Documentacao', emoji: '\u{1F4C4}', range: [1, 9] },
  exterior:     { label: 'Exterior',     emoji: '\u{1F697}', range: [10, 29] },
  iluminacao:   { label: 'Iluminacao',   emoji: '\u{1F4A1}', range: [30, 39] },
  mecanica:     { label: 'Mecanica',     emoji: '\u2699\uFE0F',  range: [40, 49] },
  interior:     { label: 'Interior',     emoji: '\u{1FA91}', range: [50, 59] },
  acessorios:   { label: 'Acessorios',   emoji: '\u{1F527}', range: [60, 99] },
}

// -- Item interface -----------------------------------------------------------

export interface FrotasChecklistItem {
  templateItemId: string
  descricao: string
  ordem: number
  obrigatorio: boolean
  permiteFoto: boolean
  estado: EstadoItemVeiculo | null
  observacao: string
}

// -- Foto type (matches checklist_execucao_itens foto) ------------------------

export interface FroChecklistFoto {
  id: string
  descricao: string
  url: string
  item_id?: string
}

// -- Props --------------------------------------------------------------------

interface Props {
  itens: FrotasChecklistItem[]
  onChange: (itens: FrotasChecklistItem[]) => void
  readOnly?: boolean
  fotos?: FroChecklistFoto[]
  onUploadFoto?: (descricao: string, file: File) => void
  uploadingFoto?: boolean
}

// -- Helpers ------------------------------------------------------------------

export function buildChecklistFromTemplate(
  templateItems: FroChecklistTemplateItem[],
): FrotasChecklistItem[] {
  return templateItems
    .sort((a, b) => a.ordem - b.ordem)
    .map(ti => ({
      templateItemId: ti.id,
      descricao: ti.descricao,
      ordem: ti.ordem,
      obrigatorio: ti.obrigatorio,
      permiteFoto: ti.permite_foto,
      estado: null,
      observacao: '',
    }))
}

export function getCategoriaForItem(ordem: number): string {
  for (const [key, cat] of Object.entries(CATEGORIAS_VEICULO)) {
    if (ordem >= cat.range[0] && ordem <= cat.range[1]) return key
  }
  return 'acessorios'
}

// -- Component ----------------------------------------------------------------

export default function FrotasChecklist({
  itens,
  onChange,
  readOnly = false,
  fotos = [],
  onUploadFoto,
  uploadingFoto,
}: Props) {
  const { isDark } = useTheme()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [expandedObs, setExpandedObs] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<string | null>(null)

  // Group items by category
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; emoji: string; items: (FrotasChecklistItem & { idx: number })[] }[] = []
    const catOrder = Object.keys(CATEGORIAS_VEICULO)

    const byCategory = new Map<string, (FrotasChecklistItem & { idx: number })[]>()
    itens.forEach((it, idx) => {
      const cat = getCategoriaForItem(it.ordem)
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push({ ...it, idx })
    })

    for (const key of catOrder) {
      const items = byCategory.get(key)
      if (items && items.length > 0) {
        const cat = CATEGORIAS_VEICULO[key]
        groups.push({ key, label: cat.label, emoji: cat.emoji, items })
      }
    }

    return groups
  }, [itens])

  const toggleCategory = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const updateItem = (idx: number, field: 'estado' | 'observacao', value: string) => {
    const next = itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    onChange(next)
  }

  const toggleObs = (idx: number) => {
    setExpandedObs(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const handleFotoClick = (descricao: string) => {
    setPendingUpload(descricao)
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingUpload && onUploadFoto) {
      onUploadFoto(pendingUpload, file)
    }
    e.target.value = ''
    setPendingUpload(null)
  }

  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const headerBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {grouped.map(({ key, label, emoji, items }) => {
        const filledCount = items.filter(it => it.estado !== null).length
        const totalCount = items.length
        const categoryFotos = fotos.filter(f => items.some(it => f.descricao === it.descricao))

        return (
          <div key={key} className={`rounded-xl border overflow-hidden ${bg}`}>
            {/* Category header */}
            <div className={`flex items-center justify-between px-4 py-3 ${headerBg}`}>
              <button
                type="button"
                onClick={() => toggleCategory(key)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <span className="text-base">{emoji}</span>
                <span className={`text-sm font-semibold truncate ${txt}`}>{label}</span>
                {categoryFotos.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-rose-500 shrink-0">
                    <ImageIcon size={10} /> {categoryFotos.length}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  filledCount === totalCount && totalCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : filledCount > 0
                      ? 'bg-amber-100 text-amber-700'
                      : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  {filledCount}/{totalCount}
                </span>
                <button type="button" onClick={() => toggleCategory(key)} className={txtMuted}>
                  {collapsed[key] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>
            </div>

            {/* Items */}
            {!collapsed[key] && (
              <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                {items.map(({ idx, descricao, estado, observacao, permiteFoto, obrigatorio }) => {
                  const itemFotos = fotos.filter(f => f.descricao === descricao)
                  const hasObs = expandedObs.has(idx)

                  return (
                    <div key={idx} className={`px-4 py-3 ${
                      estado === 'ruim' ? (isDark ? 'bg-red-500/[0.03]' : 'bg-red-50/30') : ''
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${txt}`}>
                            {descricao}
                            {obrigatorio && <span className="text-rose-500 ml-1">*</span>}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {ESTADOS.map(({ value, label: lbl, color }) => (
                            <button
                              key={value}
                              type="button"
                              disabled={readOnly}
                              onClick={() => updateItem(idx, 'estado', value)}
                              className={[
                                'px-2 py-0.5 rounded border text-[10px] font-semibold transition-all',
                                estado === value
                                  ? color
                                  : isDark
                                    ? 'border-white/10 text-slate-400'
                                    : 'border-slate-200 text-slate-400',
                              ].join(' ')}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action row: obs toggle + camera */}
                      {!readOnly && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => toggleObs(idx)}
                            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                              observacao
                                ? isDark ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' : 'border-rose-300 text-rose-600 bg-rose-50'
                                : isDark ? 'border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                                       : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300'
                            }`}
                            title="Observacao"
                          >
                            <MessageSquare size={14} />
                          </button>

                          {permiteFoto && onUploadFoto && (
                            <button
                              type="button"
                              disabled={uploadingFoto}
                              onClick={() => handleFotoClick(descricao)}
                              className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                                isDark ? 'border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                                       : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300'
                              } ${uploadingFoto ? 'opacity-50' : ''}`}
                              title="Anexar foto"
                            >
                              <Camera size={14} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable observation field */}
                      {hasObs && !readOnly && (
                        <div className="mt-2 animate-fadeIn">
                          <input
                            type="text"
                            placeholder="Observacao..."
                            value={observacao}
                            onChange={e => updateItem(idx, 'observacao', e.target.value)}
                            className={[
                              'w-full text-xs rounded-lg px-3 py-1.5 border outline-none transition-colors',
                              isDark
                                ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
                                : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400',
                            ].join(' ')}
                            autoFocus
                          />
                        </div>
                      )}

                      {/* Read-only observation display */}
                      {readOnly && observacao && (
                        <p className={`text-xs mt-1.5 ${txtMuted}`}>
                          {observacao}
                        </p>
                      )}

                      {/* Photo thumbnails */}
                      {itemFotos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {itemFotos.map(f => (
                            <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                              className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-rose-400 transition-colors">
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
