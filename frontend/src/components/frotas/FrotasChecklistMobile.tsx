// ---------------------------------------------------------------------------
// FrotasChecklistMobile.tsx -- App-like fullscreen mobile checklist for Frotas
// Follows VistoriaMobile.tsx pattern (glass morphism, swipe, camera, offline).
// Accent color: rose (gradient: rose-500 to amber-500).
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ArrowLeft, Camera, Check, CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, MessageSquare, Save, Wifi, WifiOff, X, AlertTriangle, Sparkles, Fuel,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import {
  CATEGORIAS_VEICULO, getCategoriaForItem, buildChecklistFromTemplate,
  type FrotasChecklistItem, type EstadoItemVeiculo,
} from './FrotasChecklist'
import type { FroVeiculo, FroChecklistTemplateItem } from '../../types/frotas'
import VehicleDiagramInspection, { type ZoneDamage } from './VehicleDiagramInspection'

// Stub import — the offline hook will be created by another agent.
// For now we define a minimal type so the file compiles.
// import { useFrotasChecklistOffline, type FroOfflineFoto } from '../../hooks/useFrotasChecklistOffline'

export interface FroOfflineFoto {
  id: string
  descricao: string
  dataUrl: string
  timestamp: number
}

// -- Nivel Combustivel --------------------------------------------------------

export type NivelCombustivel = 0 | 1 | 2 | 3 | 4

const NIVEIS_COMBUSTIVEL: { value: NivelCombustivel; label: string }[] = [
  { value: 0, label: 'Vazio' },
  { value: 1, label: '1/4' },
  { value: 2, label: '1/2' },
  { value: 3, label: '3/4' },
  { value: 4, label: 'Cheio' },
]

// -- Estado visual config (same 5-grade as VistoriaMobile) --------------------

const ESTADOS: {
  value: EstadoItemVeiculo; label: string; emoji: string
  light: string; dark: string; selected: string
}[] = [
  {
    value: 'otimo', label: 'Otimo', emoji: '\u2728',
    light: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    selected: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30',
  },
  {
    value: 'bom', label: 'Bom', emoji: '\u{1F44D}',
    light: 'bg-blue-50 text-blue-600 border-blue-200',
    dark: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    selected: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30',
  },
  {
    value: 'regular', label: 'Regular', emoji: '\u26A0\uFE0F',
    light: 'bg-amber-50 text-amber-600 border-amber-200',
    dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    selected: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30',
  },
  {
    value: 'ruim', label: 'Ruim', emoji: '\u274C',
    light: 'bg-red-50 text-red-600 border-red-200',
    dark: 'bg-red-500/10 text-red-400 border-red-500/20',
    selected: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/30',
  },
  {
    value: 'nao_se_aplica', label: 'N/A', emoji: '\u2014',
    light: 'bg-slate-50 text-slate-500 border-slate-200',
    dark: 'bg-white/5 text-slate-500 border-white/10',
    selected: 'bg-slate-500 text-white border-slate-500 shadow-lg shadow-slate-500/20',
  },
]

// -- Save data payload --------------------------------------------------------

export interface ChecklistSaveData {
  itens: FrotasChecklistItem[]
  obsGerais: string
  nivelCombustivel: NivelCombustivel | null
  hodometroRegistro: number | null
}

// -- Props --------------------------------------------------------------------

interface Props {
  veiculo: FroVeiculo
  templateItems: FroChecklistTemplateItem[]
  execucaoId: string | null
  tipoChecklist: string
  onClose: () => void
  onSave: (data: ChecklistSaveData) => Promise<void>
  onConcluir: (data: ChecklistSaveData) => Promise<void>
  /** Vehicle diagram zone damages (only for tipo_ativo='veiculo') */
  zoneDamages?: ZoneDamage[]
  onZoneDamagesChange?: (damages: ZoneDamage[]) => void
}

// -- Title by tipo ------------------------------------------------------------

const TITULO_POR_TIPO: Record<string, string> = {
  pre_viagem: 'Checklist Pre-Viagem',
  pos_viagem: 'Checklist Pos-Viagem',
  entrega_locadora: 'Vistoria de Entrega',
  devolucao_locadora: 'Vistoria de Devolucao',
  pre_manutencao: 'Checklist Pre-Manutencao',
  pos_manutencao: 'Checklist Pos-Manutencao',
}

// -- Component ----------------------------------------------------------------

export default function FrotasChecklistMobile({
  veiculo,
  templateItems,
  execucaoId,
  tipoChecklist,
  onClose,
  onSave,
  onConcluir,
  zoneDamages = [],
  onZoneDamagesChange,
}: Props) {
  const showDiagram = (veiculo.tipo_ativo || 'veiculo') === 'veiculo' && !!onZoneDamagesChange
  const { isDark } = useTheme()
  const isOnline = useOnlineStatus()

  // State
  const [itens, setItensState] = useState<FrotasChecklistItem[]>(() =>
    buildChecklistFromTemplate(templateItems),
  )
  const [obsGerais, setObsGeraisState] = useState('')
  const [nivelCombustivel, setNivelCombustivel] = useState<NivelCombustivel | null>(null)
  const [hodometroRegistro, setHodometroRegistro] = useState<number | null>(veiculo.hodometro_atual || null)
  const [offlineFotos, setOfflineFotos] = useState<FroOfflineFoto[]>([])
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [expandedObs, setExpandedObs] = useState<Set<number>>(new Set())
  const [showObs, setShowObs] = useState(false)

  const tabsRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [pendingFoto, setPendingFoto] = useState<{ descricao: string } | null>(null)

  // Derive categories from items (only those with items)
  const categories = useMemo(() => {
    const catKeys = Object.keys(CATEGORIAS_VEICULO)
    const result: { key: string; label: string; emoji: string; items: (FrotasChecklistItem & { idx: number })[] }[] = []

    for (const key of catKeys) {
      const catItems = itens
        .map((it, idx) => ({ ...it, idx }))
        .filter(it => getCategoriaForItem(it.ordem) === key)
      if (catItems.length > 0) {
        const cat = CATEGORIAS_VEICULO[key]
        result.push({ key, label: cat.label, emoji: cat.emoji, items: catItems })
      }
    }

    return result
  }, [itens])

  const currentCategory = categories[activeTab]
  const currentItens = currentCategory?.items || []

  const totalFilled = itens.filter(it => it.estado !== null).length
  const totalItems = itens.length
  const progress = totalItems > 0 ? (totalFilled / totalItems) * 100 : 0

  const categoryFilled = (catIdx: number) => {
    const cat = categories[catIdx]
    if (!cat) return { filled: 0, total: 0 }
    return {
      filled: cat.items.filter(it => it.estado !== null).length,
      total: cat.items.length,
    }
  }

  // Scroll tab into view
  useEffect(() => {
    const el = tabsRef.current?.children[activeTab] as HTMLElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeTab])

  // -- Actions ----------------------------------------------------------------

  const setEstado = useCallback((idx: number, estado: EstadoItemVeiculo) => {
    if ('vibrate' in navigator) navigator.vibrate(8)
    setItensState(prev => prev.map((it, i) => (i === idx ? { ...it, estado } : it)))
  }, [])

  const setObs = useCallback((idx: number, obs: string) => {
    setItensState(prev => prev.map((it, i) => (i === idx ? { ...it, observacao: obs } : it)))
  }, [])

  const toggleObs = (idx: number) => {
    setExpandedObs(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  // Camera
  const openCamera = (descricao: string) => {
    setPendingFoto({ descricao })
    cameraRef.current?.click()
  }

  const onCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingFoto) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const foto: FroOfflineFoto = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          descricao: pendingFoto.descricao,
          dataUrl: reader.result as string,
          timestamp: Date.now(),
        }
        setOfflineFotos(prev => [...prev, foto])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
    setPendingFoto(null)
  }

  const removeFoto = (id: string) => {
    setOfflineFotos(prev => prev.filter(f => f.id !== id))
  }

  // Build save data
  const buildSaveData = (): ChecklistSaveData => ({
    itens,
    obsGerais,
    nivelCombustivel,
    hodometroRegistro,
  })

  // Save / Conclude
  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(buildSaveData())
      onClose()
    } catch (err) {
      console.error('[FrotasChecklistMobile] handleSave error:', err)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    setSaving(true)
    try {
      await onConcluir(buildSaveData())
      onClose()
    } catch (err) {
      console.error('[FrotasChecklistMobile] handleConcluir error:', err)
      onClose()
    } finally {
      setSaving(false)
      setShowConfirm(false)
    }
  }

  // Swipe
  const touchX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0 && activeTab < categories.length - 1) setActiveTab(p => p + 1)
      if (diff < 0 && activeTab > 0) setActiveTab(p => p - 1)
    }
  }

  // Vehicle subtitle
  const veiculoLabel = `${veiculo.placa} \u2014 ${veiculo.marca} ${veiculo.modelo}${veiculo.ano_mod ? ` ${veiculo.ano_mod}` : ''}`
  const titulo = TITULO_POR_TIPO[tipoChecklist] || 'Checklist'

  // -- Render -----------------------------------------------------------------

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#0c1222]' : 'bg-[#f8fafc]'}`}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCapture} />

      {/* ====== HEADER ====== */}
      <header
        className={`shrink-0 ${isDark ? 'glass-dark' : 'glass-light'}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              isDark ? 'bg-white/[0.06] active:bg-white/10' : 'bg-slate-100 active:bg-slate-200'
            }`}
          >
            <ArrowLeft size={18} className={isDark ? 'text-slate-300' : 'text-slate-600'} />
          </button>

          <div className="min-w-0 flex-1">
            <h1
              className={`text-[15px] font-bold truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
            >
              {titulo}
            </h1>
            <p
              className={`text-[11px] truncate leading-tight mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              {veiculoLabel}
            </p>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full ${
                isOnline ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
              }`}
            >
              {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
            </span>
            <span
              className={`text-[11px] font-extrabold tabular-nums px-2.5 py-1 rounded-full ${
                progress === 100
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : progress > 0
                    ? isDark
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-rose-50 text-rose-600'
                    : isDark
                      ? 'bg-white/[0.06] text-slate-500'
                      : 'bg-slate-100 text-slate-400'
              }`}
            >
              {totalFilled}/{totalItems}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className={`mx-4 mb-2 h-[3px] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200/70'}`}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #F43F5E, #F59E0B)',
            }}
          />
        </div>

        {/* Fuel gauge + Hodometro */}
        <div className="flex items-center gap-3 px-4 pb-2">
          {/* Fuel gauge */}
          <div className="flex items-center gap-2 flex-1">
            <Fuel size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <div className="flex gap-1 flex-1">
              {NIVEIS_COMBUSTIVEL.map(nc => (
                <button
                  key={nc.value}
                  type="button"
                  onClick={() => setNivelCombustivel(nc.value)}
                  className={[
                    'flex-1 h-6 rounded-md transition-all duration-200 relative overflow-hidden',
                    nivelCombustivel !== null && nc.value <= nivelCombustivel
                      ? 'bg-gradient-to-t from-rose-500 to-amber-400 shadow-sm'
                      : isDark
                        ? 'bg-white/[0.06] border border-white/[0.06]'
                        : 'bg-slate-100 border border-slate-200',
                  ].join(' ')}
                  title={nc.label}
                />
              ))}
            </div>
            <span className={`text-[9px] font-bold w-8 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {nivelCombustivel !== null ? NIVEIS_COMBUSTIVEL[nivelCombustivel].label : '--'}
            </span>
          </div>

          {/* Hodometro */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              value={hodometroRegistro ?? ''}
              onChange={e => setHodometroRegistro(e.target.value ? Number(e.target.value) : null)}
              placeholder="km"
              className={`w-20 text-[12px] font-bold tabular-nums text-right rounded-lg px-2 py-1.5 border outline-none transition-colors ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600 focus:border-rose-500/40'
                  : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'
              }`}
            />
            <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>km</span>
          </div>
        </div>

        {/* Category tabs */}
        <div
          ref={tabsRef}
          className="flex gap-1.5 px-4 pb-3 overflow-x-auto hide-scrollbar"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {categories.map((cat, i) => {
            const { filled, total } = categoryFilled(i)
            const isActive = i === activeTab
            const isComplete = filled === total && total > 0

            return (
              <button
                key={cat.key}
                onClick={() => setActiveTab(i)}
                className={[
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0',
                  'transition-all duration-200',
                  isActive
                    ? isDark
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isDark
                      ? 'text-slate-500 active:bg-white/[0.06]'
                      : 'text-slate-400 active:bg-slate-100',
                  !isActive && 'border border-transparent',
                ].join(' ')}
              >
                {isComplete && (
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-emerald-500' : 'bg-emerald-500/60'
                    }`}
                  >
                    <Check size={9} className="text-white" strokeWidth={3} />
                  </span>
                )}
                <span>{cat.emoji}</span>
                <span className="truncate max-w-[80px]">{cat.label}</span>
                {!isComplete && (
                  <span
                    className={`text-[9px] ${
                      isActive ? (isDark ? 'text-rose-400/60' : 'text-rose-400') : 'opacity-40'
                    }`}
                  >
                    {filled}/{total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* ====== BODY ====== */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="px-4 pt-4 pb-32 space-y-2.5">
          {/* Category title */}
          {currentCategory && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{currentCategory.emoji}</span>
              <h2
                className={`text-lg font-extrabold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {currentCategory.label}
              </h2>
            </div>
          )}

          {/* Obs gerais -- first tab only */}
          {activeTab === 0 && (
            <button
              onClick={() => setShowObs(!showObs)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border transition-colors ${
                isDark
                  ? 'border-white/[0.06] bg-white/[0.02] active:bg-white/[0.04]'
                  : 'border-slate-100 bg-white active:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {obsGerais ? 'Observacoes gerais' : 'Adicionar observacoes gerais'}
                </span>
              </div>
              <ChevronRight
                size={14}
                className={`transition-transform ${showObs ? 'rotate-90' : ''} ${isDark ? 'text-slate-600' : 'text-slate-300'}`}
              />
            </button>
          )}
          {activeTab === 0 && showObs && (
            <div className="animate-fadeIn">
              <textarea
                rows={3}
                placeholder="Observacoes sobre o veiculo..."
                value={obsGerais}
                onChange={e => setObsGeraisState(e.target.value)}
                className={`w-full text-sm rounded-2xl px-4 py-3 border outline-none resize-none transition-colors ${
                  isDark
                    ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600 focus:border-rose-500/40'
                    : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'
                }`}
                autoFocus
              />
            </div>
          )}

          {/* Vehicle Diagram (shown on first tab for vehicles) */}
          {activeTab === 0 && showDiagram && (
            <div className="mb-3">
              <VehicleDiagramInspection
                damages={zoneDamages}
                onChange={onZoneDamagesChange!}
                readOnly={false}
              />
            </div>
          )}

          {/* Item Cards */}
          {currentItens.map(({ idx, descricao, estado, observacao, permiteFoto, obrigatorio }, cardIndex) => {
            const itemFotos = offlineFotos.filter(f => f.descricao === descricao)
            const hasObs = expandedObs.has(idx)

            return (
              <div
                key={`${currentCategory?.key}-${idx}`}
                className={[
                  'rounded-2xl border overflow-hidden transition-all duration-200',
                  isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-white',
                  estado === 'ruim'
                    ? isDark
                      ? 'border-red-500/20 bg-red-500/[0.03]'
                      : 'border-red-200 bg-red-50/30'
                    : '',
                ].join(' ')}
                style={{ animationDelay: `${cardIndex * 30}ms` }}
              >
                <div className="px-4 pt-4 pb-3.5">
                  {/* Item header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[13px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {descricao}
                      {obrigatorio && <span className="text-rose-500 ml-1">*</span>}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => toggleObs(idx)}
                        className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          observacao
                            ? isDark
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-rose-50 text-rose-500'
                            : isDark
                              ? 'text-slate-600 active:bg-white/[0.06]'
                              : 'text-slate-300 active:bg-slate-50'
                        }`}
                      >
                        <MessageSquare size={14} />
                        {observacao && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />
                        )}
                      </button>
                      {permiteFoto && (
                        <button
                          onClick={() => openCamera(descricao)}
                          className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            itemFotos.length > 0
                              ? isDark
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-rose-50 text-rose-500'
                              : isDark
                                ? 'text-slate-600 active:bg-white/[0.06]'
                                : 'text-slate-300 active:bg-slate-50'
                          }`}
                        >
                          <Camera size={14} />
                          {itemFotos.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                              {itemFotos.length}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Estado buttons */}
                  <div className="flex gap-1.5">
                    {ESTADOS.map(st => {
                      const isSelected = estado === st.value
                      return (
                        <button
                          key={st.value}
                          onClick={() => setEstado(idx, st.value)}
                          className={[
                            'flex-1 flex flex-col items-center justify-center gap-0.5',
                            'py-2.5 rounded-xl border transition-all duration-150',
                            'min-h-[52px] active:scale-[0.96]',
                            isSelected ? st.selected : isDark ? st.dark : st.light,
                          ].join(' ')}
                        >
                          <span className="text-sm leading-none">{st.emoji}</span>
                          <span
                            className={`text-[9px] font-bold leading-none mt-0.5 ${
                              isSelected ? 'text-white/90' : ''
                            }`}
                          >
                            {st.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Obs field */}
                  {hasObs && (
                    <div className="mt-3 animate-fadeIn">
                      <input
                        type="text"
                        placeholder="Observacao..."
                        value={observacao}
                        onChange={e => setObs(idx, e.target.value)}
                        className={`w-full text-[13px] rounded-xl px-3.5 py-2.5 border outline-none transition-colors ${
                          isDark
                            ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-slate-600 focus:border-rose-500/40'
                            : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'
                        }`}
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Foto thumbnails */}
                  {itemFotos.length > 0 && (
                    <div
                      className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {itemFotos.map(foto => (
                        <div
                          key={foto.id}
                          className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-1 ring-black/5"
                        >
                          <img src={foto.dataUrl} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeFoto(foto.id)}
                            className="absolute inset-0 bg-black/0 active:bg-black/40 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity"
                          >
                            <X size={16} className="text-white drop-shadow" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Nav between categories */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <button
              onClick={() => activeTab > 0 && setActiveTab(p => p - 1)}
              disabled={activeTab === 0}
              className={`flex items-center gap-1 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
                activeTab === 0
                  ? 'opacity-0 pointer-events-none'
                  : isDark
                    ? 'bg-white/[0.04] text-slate-400 active:bg-white/[0.08]'
                    : 'bg-white text-slate-500 active:bg-slate-100 border border-slate-100'
              }`}
            >
              <ChevronLeft size={14} /> Anterior
            </button>

            {/* Dot pagination */}
            <div className="flex items-center gap-1.5">
              {categories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === activeTab
                      ? 'w-4 bg-rose-500'
                      : categoryFilled(i).filled === categoryFilled(i).total
                        ? 'bg-emerald-500/50'
                        : isDark
                          ? 'bg-white/10'
                          : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => activeTab < categories.length - 1 && setActiveTab(p => p + 1)}
              disabled={activeTab === categories.length - 1}
              className={`flex items-center gap-1 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
                activeTab === categories.length - 1
                  ? 'opacity-0 pointer-events-none'
                  : isDark
                    ? 'bg-white/[0.04] text-slate-400 active:bg-white/[0.08]'
                    : 'bg-white text-slate-500 active:bg-slate-100 border border-slate-100'
              }`}
            >
              Proximo <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </main>

      {/* ====== FOOTER ====== */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-10 ${isDark ? 'glass-dark' : 'glass-light'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10">
            <WifiOff size={11} className="text-amber-500" />
            <span className="text-[10px] font-bold text-amber-500">Offline -- salvo no dispositivo</span>
          </div>
        )}

        <div className="flex gap-2.5 px-4 py-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl text-[13px] font-bold border transition-all active:scale-[0.98] ${
              isDark
                ? 'border-white/[0.08] text-slate-300 active:bg-white/[0.06]'
                : 'border-slate-200 text-slate-600 active:bg-slate-50'
            } ${saving ? 'opacity-50' : ''}`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </button>
          <button
            onClick={() => (totalFilled === totalItems ? setShowConfirm(true) : undefined)}
            disabled={totalFilled < totalItems || saving}
            className={[
              'flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl text-[13px] font-bold transition-all active:scale-[0.98]',
              totalFilled === totalItems
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 active:bg-emerald-600'
                : isDark
                  ? 'bg-white/[0.04] text-slate-600'
                  : 'bg-slate-100 text-slate-400',
              saving ? 'opacity-50' : '',
            ].join(' ')}
          >
            <CheckCircle2 size={16} />
            Concluir
          </button>
        </div>
      </footer>

      {/* ====== CONFIRM SHEET ====== */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          onClick={() => setShowConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-lg rounded-t-[28px] overflow-hidden ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className={`w-8 h-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>

            <div className="px-6 pt-3 pb-6">
              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                    isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'
                  }`}
                >
                  <Sparkles size={20} className="text-emerald-500" />
                </div>
                <div>
                  <h3
                    className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    Concluir {titulo}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {totalFilled}/{totalItems} itens preenchidos
                  </p>
                </div>
              </div>

              <p
                className={`text-[13px] leading-relaxed mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                O checklist sera concluido e o veiculo podera ter seu status atualizado.
                Os itens nao poderao mais ser editados.
              </p>

              {!isOnline && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4 ${
                    isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <WifiOff size={14} className="text-amber-500 shrink-0" />
                  <p className="text-[11px] font-semibold text-amber-600">
                    Offline -- sincroniza automaticamente ao reconectar
                  </p>
                </div>
              )}

              {itens.some(it => it.estado === 'ruim') && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-4 ${
                    isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[11px] font-semibold text-red-600">
                    {itens.filter(it => it.estado === 'ruim').length} item(ns) marcado(s) como "Ruim"
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowConfirm(false)}
                  className={`flex-1 h-12 rounded-2xl text-[13px] font-bold border transition-all active:scale-[0.98] ${
                    isDark ? 'border-white/[0.08] text-slate-300' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConcluir}
                  disabled={saving}
                  className="flex-1 h-12 rounded-2xl text-[13px] font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 active:bg-emerald-600 active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
