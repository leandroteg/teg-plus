// ─────────────────────────────────────────────────────────────────────────────
// VistoriaMobile.tsx — Experiência fullscreen mobile-first para vistorias
// Touch-friendly, offline-first, câmera nativa, tabs horizontais por ambiente.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ArrowLeft, Save, CheckCircle2, Loader2, AlertTriangle,
  Camera, ChevronRight, ChevronLeft, X, Check, Pencil, Plus, Trash2,
  WifiOff, Wifi, RefreshCw, ImageIcon, MessageSquare,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useVistoriaOffline, fileToDataUrl, type OfflineFoto } from '../../hooks/useVistoriaOffline'
import {
  AMBIENTES_PADRAO, ITENS_POR_AMBIENTE, buildDefaultItens,
  type ChecklistItem,
} from './VistoriaChecklist'
import type { LocEntrada, EstadoItem } from '../../types/locacao'

// ── Constants ────────────────────────────────────────────────────────────────

const ESTADOS: { value: EstadoItem; label: string; emoji: string; bg: string; ring: string; text: string }[] = [
  { value: 'otimo', label: 'Otimo', emoji: '✨', bg: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-white' },
  { value: 'bom', label: 'Bom', emoji: '👍', bg: 'bg-blue-500', ring: 'ring-blue-400', text: 'text-white' },
  { value: 'regular', label: 'Regular', emoji: '⚠️', bg: 'bg-amber-500', ring: 'ring-amber-400', text: 'text-white' },
  { value: 'ruim', label: 'Ruim', emoji: '❌', bg: 'bg-red-500', ring: 'ring-red-400', text: 'text-white' },
  { value: 'nao_se_aplica', label: 'N/A', emoji: '➖', bg: 'bg-slate-400', ring: 'ring-slate-300', text: 'text-white' },
]

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entrada: LocEntrada
  vistoriaId: string | null
  onClose: () => void
  onSave: (itens: ChecklistItem[], obsGerais: string) => Promise<void>
  onConcluir: (itens: ChecklistItem[], obsGerais: string) => Promise<void>
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VistoriaMobile({ entrada, vistoriaId, onClose, onSave, onConcluir }: Props) {
  const { isDark } = useTheme()
  const isOnline = useOnlineStatus()
  const offline = useVistoriaOffline(entrada.id)

  // Initialize from offline data or defaults
  const [itens, setItensState] = useState<ChecklistItem[]>(() =>
    offline.hasSavedData && offline.data.itens.length > 0
      ? offline.data.itens
      : buildDefaultItens()
  )
  const [obsGerais, setObsGeraisState] = useState(
    offline.hasSavedData ? offline.data.obsGerais : ''
  )
  const [offlineFotos, setOfflineFotos] = useState<OfflineFoto[]>(
    offline.hasSavedData ? offline.data.fotos : []
  )
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [editingAmbiente, setEditingAmbiente] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [showObsFor, setShowObsFor] = useState<number | null>(null)

  const tabsRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [pendingFoto, setPendingFoto] = useState<{ ambiente: string; item: string } | null>(null)

  // Sync itens to offline storage
  useEffect(() => {
    offline.setItens(itens)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens])

  useEffect(() => {
    offline.setObsGerais(obsGerais)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obsGerais])

  useEffect(() => {
    if (vistoriaId) offline.setVistoriaId(vistoriaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistoriaId])

  // Derive ambientes from itens
  const ambientes = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const it of itens) {
      if (!seen.has(it.ambiente)) {
        seen.add(it.ambiente)
        result.push(it.ambiente)
      }
    }
    return result
  }, [itens])

  const currentAmbiente = ambientes[activeTab] || ambientes[0] || ''
  const currentItens = useMemo(() =>
    itens
      .map((it, idx) => ({ ...it, idx }))
      .filter(it => it.ambiente === currentAmbiente),
    [itens, currentAmbiente]
  )

  const totalFilled = itens.filter(it => it.estado !== null).length
  const totalItems = itens.length
  const progress = totalItems > 0 ? (totalFilled / totalItems) * 100 : 0

  // Scroll active tab into view
  useEffect(() => {
    const tabEl = tabsRef.current?.children[activeTab] as HTMLElement
    tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeTab])

  // ── Item Actions ───────────────────────────────────────────────────────────

  const setEstado = useCallback((idx: number, estado: EstadoItem) => {
    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(10)
    setItensState(prev => prev.map((it, i) => i === idx ? { ...it, estado } : it))
  }, [])

  const setObs = useCallback((idx: number, observacao: string) => {
    setItensState(prev => prev.map((it, i) => i === idx ? { ...it, observacao } : it))
  }, [])

  // ── Ambiente Management ────────────────────────────────────────────────────

  const startEditAmbiente = (ambiente: string) => {
    setEditingAmbiente(ambiente)
    setEditNome(ambiente)
    setTimeout(() => editInputRef.current?.select(), 50)
  }

  const confirmEditAmbiente = () => {
    if (!editingAmbiente || !editNome.trim()) { setEditingAmbiente(null); return }
    const trimmed = editNome.trim()
    if (trimmed === editingAmbiente || ambientes.includes(trimmed)) { setEditingAmbiente(null); return }
    setItensState(prev => prev.map(it => it.ambiente === editingAmbiente ? { ...it, ambiente: trimmed } : it))
    setEditingAmbiente(null)
  }

  const addAmbiente = () => {
    let name = 'Nova Area'
    let c = 1
    while (ambientes.includes(name)) { c++; name = `Nova Area ${c}` }
    const newItens = ITENS_POR_AMBIENTE.map(item => ({
      ambiente: name, item, estado: null as EstadoItem | null, observacao: '',
    }))
    setItensState(prev => [...prev, ...newItens])
    setActiveTab(ambientes.length) // Switch to new tab
    setTimeout(() => startEditAmbiente(name), 100)
  }

  const removeAmbiente = (ambiente: string) => {
    if (ambientes.length <= 1) return
    setItensState(prev => prev.filter(it => it.ambiente !== ambiente))
    if (activeTab >= ambientes.length - 1) setActiveTab(Math.max(0, ambientes.length - 2))
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  const openCamera = (ambiente: string, item: string) => {
    setPendingFoto({ ambiente, item })
    cameraRef.current?.click()
  }

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingFoto) {
      const foto = await offline.addFoto(pendingFoto.ambiente, pendingFoto.item, file)
      setOfflineFotos(prev => [...prev, foto])
    }
    e.target.value = ''
    setPendingFoto(null)
  }

  const removeFotoLocal = (fotoId: string) => {
    offline.removeFoto(fotoId)
    setOfflineFotos(prev => prev.filter(f => f.id !== fotoId))
  }

  // ── Save / Conclude ────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isOnline) {
        await onSave(itens, obsGerais)
        offline.markSynced()
      } else {
        offline.setStatus('rascunho')
      }
      onClose()
    } catch {
      offline.setStatus('rascunho')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    setSaving(true)
    try {
      if (isOnline) {
        await onConcluir(itens, obsGerais)
        offline.markSynced()
        offline.clear()
      } else {
        offline.setStatus('concluida')
      }
      onClose()
    } catch {
      offline.setStatus('concluida')
      onClose()
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  // ── Swipe Navigation ──────────────────────────────────────────────────────

  const touchStartX = useRef(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 60) {
      if (diff > 0 && activeTab < ambientes.length - 1) setActiveTab(prev => prev + 1)
      if (diff < 0 && activeTab > 0) setActiveTab(prev => prev - 1)
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const bgPage = isDark ? 'bg-[#0f172a]' : 'bg-slate-50'
  const bgCard = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const bgHeader = isDark ? 'bg-[#1e293b]/95 border-white/[0.06]' : 'bg-white/95 border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txtSub = isDark ? 'text-slate-500' : 'text-slate-400'
  const inputCls = isDark
    ? 'bg-white/[0.06] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400'

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${bgPage}`}>
      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-10 shrink-0 backdrop-blur-xl border-b safe-area-top ${bgHeader}`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onClose} className={`p-2 -ml-2 rounded-xl ${isDark ? 'active:bg-white/10' : 'active:bg-slate-100'}`}>
            <ArrowLeft size={20} className={txt} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className={`text-base font-bold truncate ${txt}`}>Vistoria de Entrada</h1>
            <p className={`text-xs truncate ${txtMuted}`}>
              {entrada.endereco}{entrada.numero ? `, ${entrada.numero}` : ''} — {entrada.cidade}/{entrada.uf}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Online/Offline badge */}
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
              isOnline
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {/* Progress badge */}
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              totalFilled === totalItems
                ? 'bg-emerald-100 text-emerald-700'
                : totalFilled > 0
                  ? 'bg-indigo-100 text-indigo-700'
                  : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {totalFilled}/{totalItems}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`h-1 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Tabs horizontais ────────────────────────────────────────────── */}
        <div className="relative">
          <div
            ref={tabsRef}
            className="flex overflow-x-auto scrollbar-hide gap-1 px-3 py-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {ambientes.map((amb, i) => {
              const ambItens = itens.filter(it => it.ambiente === amb)
              const ambFilled = ambItens.filter(it => it.estado !== null).length
              const isComplete = ambFilled === ambItens.length
              const isActive = i === activeTab

              return (
                <button
                  key={amb}
                  onClick={() => setActiveTab(i)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : isDark
                        ? 'bg-white/[0.06] text-slate-400 active:bg-white/10'
                        : 'bg-slate-100 text-slate-600 active:bg-slate-200',
                  ].join(' ')}
                >
                  {isComplete && <Check size={10} className={isActive ? 'text-emerald-300' : 'text-emerald-500'} />}
                  <span className="truncate max-w-[100px]">{amb}</span>
                  <span className={`text-[9px] ${isActive ? 'text-indigo-200' : txtSub}`}>
                    {ambFilled}/{ambItens.length}
                  </span>
                </button>
              )
            })}

            {/* Add tab */}
            <button
              onClick={addAmbiente}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 border-2 border-dashed transition-colors ${
                isDark
                  ? 'border-white/10 text-slate-500 active:border-indigo-500/40'
                  : 'border-slate-200 text-slate-400 active:border-indigo-400'
              }`}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body — Checklist Items ──────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Ambiente header with edit/delete */}
        <div className="flex items-center justify-between mb-1">
          {editingAmbiente === currentAmbiente ? (
            <form className="flex items-center gap-2 flex-1" onSubmit={e => { e.preventDefault(); confirmEditAmbiente() }}>
              <input
                ref={editInputRef}
                type="text"
                value={editNome}
                onChange={e => setEditNome(e.target.value)}
                onBlur={confirmEditAmbiente}
                className={`text-lg font-bold rounded-xl px-3 py-2 border outline-none flex-1 ${inputCls}`}
                autoFocus
              />
              <button type="submit" className="p-2 text-emerald-500"><Check size={18} /></button>
            </form>
          ) : (
            <>
              <h2 className={`text-lg font-bold ${txt}`}>{currentAmbiente}</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => startEditAmbiente(currentAmbiente)} className={`p-2 rounded-xl ${isDark ? 'text-slate-500 active:bg-white/10' : 'text-slate-400 active:bg-slate-100'}`}>
                  <Pencil size={14} />
                </button>
                {ambientes.length > 1 && (
                  <button onClick={() => removeAmbiente(currentAmbiente)} className={`p-2 rounded-xl ${isDark ? 'text-slate-500 active:bg-red-500/10' : 'text-slate-400 active:bg-red-50'}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Observações gerais (collapsible) */}
        {activeTab === 0 && (
          <div className={`rounded-2xl border p-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Observacoes Gerais</label>
            <textarea
              rows={2}
              placeholder="Observacoes sobre o imovel..."
              value={obsGerais}
              onChange={e => setObsGeraisState(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2.5 border outline-none resize-none ${inputCls}`}
            />
          </div>
        )}

        {/* Checklist items */}
        {currentItens.map(({ idx, item, estado, observacao }) => {
          const itemFotos = offlineFotos.filter(f => f.ambiente === currentAmbiente && f.item === item)
          const showObs = showObsFor === idx

          return (
            <div key={`${currentAmbiente}-${item}`} className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-100'} ${bgCard}`}>
              <div className="p-4">
                {/* Item name */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-semibold ${txt}`}>{item}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowObsFor(showObs ? null : idx)}
                      className={`p-2 rounded-xl transition-colors ${
                        observacao
                          ? 'text-indigo-500 bg-indigo-50'
                          : isDark ? 'text-slate-500 active:bg-white/10' : 'text-slate-400 active:bg-slate-100'
                      }`}
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      onClick={() => openCamera(currentAmbiente, item)}
                      className={`p-2 rounded-xl transition-colors ${
                        itemFotos.length > 0
                          ? 'text-indigo-500 bg-indigo-50'
                          : isDark ? 'text-slate-500 active:bg-white/10' : 'text-slate-400 active:bg-slate-100'
                      }`}
                    >
                      <Camera size={14} />
                      {itemFotos.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center">
                          {itemFotos.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Estado buttons — grid for mobile touch targets */}
                <div className="grid grid-cols-5 gap-1.5">
                  {ESTADOS.map(({ value, label, emoji, bg: stateBg, ring }) => {
                    const isSelected = estado === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEstado(idx, value)}
                        className={[
                          'flex flex-col items-center justify-center rounded-xl min-h-[56px] transition-all duration-150',
                          isSelected
                            ? `${stateBg} ${ring} ring-2 ring-offset-1 shadow-lg scale-[1.02]`
                            : isDark
                              ? 'bg-white/[0.06] active:bg-white/10'
                              : 'bg-slate-50 active:bg-slate-100 border border-slate-200',
                          isDark && !isSelected ? 'ring-offset-[#1e293b]' : 'ring-offset-white',
                        ].join(' ')}
                      >
                        <span className="text-base leading-none">{emoji}</span>
                        <span className={`text-[10px] font-semibold mt-1 ${isSelected ? 'text-white' : txtMuted}`}>
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Observação expandível */}
                {showObs && (
                  <div className="mt-3 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Observacao sobre este item..."
                      value={observacao}
                      onChange={e => setObs(idx, e.target.value)}
                      className={`w-full text-sm rounded-xl px-3 py-2.5 border outline-none ${inputCls}`}
                      autoFocus
                    />
                  </div>
                )}

                {/* Foto thumbnails */}
                {itemFotos.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {itemFotos.map(foto => (
                      <div key={foto.id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                        <img src={foto.dataUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeFotoLocal(foto.id)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Navigation arrows between ambientes */}
        <div className="flex items-center justify-between pt-2 pb-4">
          <button
            onClick={() => activeTab > 0 && setActiveTab(prev => prev - 1)}
            disabled={activeTab === 0}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 0
                ? 'opacity-30'
                : isDark ? 'bg-white/[0.06] text-slate-300 active:bg-white/10' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <span className={`text-xs font-semibold ${txtSub}`}>
            {activeTab + 1} / {ambientes.length}
          </span>
          <button
            onClick={() => activeTab < ambientes.length - 1 && setActiveTab(prev => prev + 1)}
            disabled={activeTab === ambientes.length - 1}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === ambientes.length - 1
                ? 'opacity-30'
                : isDark ? 'bg-white/[0.06] text-slate-300 active:bg-white/10' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}
          >
            Proximo
            <ChevronRight size={16} />
          </button>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`sticky bottom-0 shrink-0 border-t backdrop-blur-xl safe-area-bottom ${bgHeader}`}>
        {/* Offline status line */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 text-amber-600 text-xs font-semibold">
            <WifiOff size={12} />
            Offline — dados salvos no dispositivo
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-colors ${
              isDark
                ? 'border-indigo-500/40 text-indigo-400 active:bg-indigo-500/10'
                : 'border-indigo-300 text-indigo-700 active:bg-indigo-50'
            } ${saving ? 'opacity-50' : ''}`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar
          </button>
          <button
            onClick={() => totalFilled === totalItems ? setConfirming(true) : undefined}
            disabled={totalFilled < totalItems || saving}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
              totalFilled === totalItems
                ? 'bg-emerald-600 text-white active:bg-emerald-700 shadow-lg shadow-emerald-500/25'
                : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <CheckCircle2 size={16} />
            Concluir
          </button>
        </div>
      </footer>

      {/* ── Confirm Dialog ──────────────────────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div
            className={`w-full max-w-lg rounded-t-3xl shadow-2xl p-6 safe-area-bottom animate-slide-up ${bgCard}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-4" />

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <h3 className={`text-base font-bold ${txt}`}>Concluir Vistoria?</h3>
            </div>

            <p className={`text-sm mb-5 ${txtMuted}`}>
              Apos concluir, os itens nao poderao ser editados. A entrada avancara para "Aguardando Assinatura".
              {!isOnline && (
                <span className="block mt-2 text-amber-600 font-semibold">
                  Voce esta offline. Os dados serao sincronizados quando a conexao for restaurada.
                </span>
              )}
              {itens.some(it => it.estado === 'ruim') && (
                <span className="block mt-1 text-red-500 font-semibold">
                  {itens.filter(it => it.estado === 'ruim').length} item(ns) marcado(s) como "Ruim".
                </span>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                className={`flex-1 py-3.5 rounded-xl text-sm font-bold border ${
                  isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConcluir}
                disabled={saving}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-emerald-600 text-white active:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
