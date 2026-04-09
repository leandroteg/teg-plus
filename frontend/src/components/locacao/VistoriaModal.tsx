// ─────────────────────────────────────────────────────────────────────────────
// VistoriaModal.tsx — Orquestrador de vistoria (desktop modal + mobile fullscreen)
// Detecta viewport, delega para VistoriaMobile no mobile.
// Integra persistência offline e sync engine.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { X, Save, CheckCircle2, Loader2, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import VistoriaChecklist, { buildDefaultItens, type ChecklistItem } from './VistoriaChecklist'
import VistoriaMobile from './VistoriaMobile'
import {
  useCriarVistoria, useAtualizarVistoria, useSalvarVistoriaItens,
  useUploadVistoriaFoto, useVistoriaFotos, useVistorias, useAtualizarStatusEntrada,
} from '../../hooks/useLocacao'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useVistoriaOffline } from '../../hooks/useVistoriaOffline'
import type { LocEntrada, LocVistoria, StatusEntrada } from '../../types/locacao'

// ── Mobile Detection ─────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  entrada: LocEntrada
  onClose: () => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VistoriaModal({ entrada, onClose }: Props) {
  const { isDark } = useTheme()
  const isMobile = useIsMobile()
  const isOnline = useOnlineStatus()
  const offline = useVistoriaOffline(entrada.id)

  const { data: vistorias = [] } = useVistorias({ imovel_id: entrada.imovel_id })
  const existingVistoria = vistorias.find(v => v.entrada_id === entrada.id && v.tipo === 'entrada')

  const criarVistoria = useCriarVistoria()
  const atualizarVistoria = useAtualizarVistoria()
  const salvarItens = useSalvarVistoriaItens()
  const uploadFoto = useUploadVistoriaFoto()
  const atualizarEntrada = useAtualizarStatusEntrada()
  const { data: fotos = [] } = useVistoriaFotos(existingVistoria?.id)

  const [vistoriaId, setVistoriaId] = useState<string | null>(existingVistoria?.id || null)
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [obsGerais, setObsGerais] = useState(existingVistoria?.observacoes_gerais || '')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-indigo-400'

  // Initialize: create vistoria if needed, load existing items or offline data
  useEffect(() => {
    if (initialized) return

    // Try offline data first
    if (offline.hasSavedData && offline.data.itens.length > 0) {
      setItens(offline.data.itens)
      setObsGerais(offline.data.obsGerais)
      if (offline.data.vistoriaId) setVistoriaId(offline.data.vistoriaId)
      setInitialized(true)
      return
    }

    if (existingVistoria) {
      const defaultItens = buildDefaultItens()
      if (existingVistoria.itens && existingVistoria.itens.length > 0) {
        const loaded = defaultItens.map(di => {
          const saved = existingVistoria.itens!.find(s => s.ambiente === di.ambiente && s.item === di.item)
          if (saved) return { ...di, estado: (saved.estado_entrada || null) as ChecklistItem['estado'], observacao: saved.observacao || '' }
          return di
        })
        setItens(loaded)
      } else {
        setItens(defaultItens)
      }
      setVistoriaId(existingVistoria.id)
      setObsGerais(existingVistoria.observacoes_gerais || '')
      setInitialized(true)
    } else if (!criarVistoria.isPending && entrada.imovel_id) {
      if (isOnline) {
        criarVistoria.mutate(
          { imovel_id: entrada.imovel_id, tipo: 'entrada', entrada_id: entrada.id },
          {
            onSuccess: (v) => {
              setVistoriaId(v.id)
              offline.setVistoriaId(v.id)
              setItens(buildDefaultItens())
              setInitialized(true)
            },
          },
        )
      } else {
        // Offline: initialize without creating in DB
        setItens(buildDefaultItens())
        setInitialized(true)
      }
    } else if (!entrada.imovel_id) {
      // No imovel linked — still allow offline initialization
      setItens(buildDefaultItens())
      setInitialized(true)
    }
  }, [existingVistoria, entrada, initialized, criarVistoria, isOnline, offline])

  const preenchidos = itens.filter(it => it.estado !== null).length
  const total = itens.length

  // ── Shared save/conclude logic ─────────────────────────────────────────────

  const handleUploadFoto = useCallback((ambiente: string, item: string, file: File) => {
    if (!vistoriaId) return
    uploadFoto.mutate({ vistoriaId, file, descricao: `${ambiente}|${item}`, tipo: 'entrada' })
  }, [vistoriaId, uploadFoto])

  const doSave = useCallback(async (saveItens: ChecklistItem[], saveObs: string) => {
    if (!vistoriaId) return
    await salvarItens.mutateAsync({
      vistoriaId,
      itens: saveItens.map((it, i) => ({
        ambiente: it.ambiente, item: it.item,
        estado_entrada: it.estado || undefined,
        observacao: it.observacao || undefined, ordem: i,
      })),
    })
    await atualizarVistoria.mutateAsync({
      id: vistoriaId, status: 'em_andamento', observacoes_gerais: saveObs || undefined,
      data_vistoria: new Date().toISOString().split('T')[0],
    })
  }, [vistoriaId, salvarItens, atualizarVistoria])

  const doConclude = useCallback(async (concItens: ChecklistItem[], concObs: string) => {
    if (!vistoriaId) return
    const temPendencias = concItens.some(it => it.estado === 'ruim')
    await salvarItens.mutateAsync({
      vistoriaId,
      itens: concItens.map((it, i) => ({
        ambiente: it.ambiente, item: it.item,
        estado_entrada: it.estado || undefined,
        observacao: it.observacao || undefined, ordem: i,
      })),
    })
    await atualizarVistoria.mutateAsync({
      id: vistoriaId, status: 'concluida', observacoes_gerais: concObs || undefined,
      tem_pendencias: temPendencias,
      data_vistoria: new Date().toISOString().split('T')[0],
    })
    await atualizarEntrada.mutateAsync({ id: entrada.id, status: 'aguardando_assinatura' as StatusEntrada })
  }, [vistoriaId, salvarItens, atualizarVistoria, atualizarEntrada, entrada.id])

  const handleSalvarRascunho = async () => {
    setSaving(true)
    try {
      if (isOnline && vistoriaId) {
        await doSave(itens, obsGerais)
        offline.markSynced()
      } else {
        offline.setItens(itens)
        offline.setObsGerais(obsGerais)
        offline.setStatus('rascunho')
      }
      onClose()
    } catch {
      // Fallback to offline
      offline.setStatus('rascunho')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    setSaving(true)
    try {
      if (isOnline && vistoriaId) {
        await doConclude(itens, obsGerais)
        offline.markSynced()
        offline.clear()
      } else {
        offline.setItens(itens)
        offline.setObsGerais(obsGerais)
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

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!initialized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className={`rounded-2xl shadow-2xl p-10 ${bg}`}>
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
          <p className={`text-sm mt-3 ${txtMuted}`}>Preparando vistoria...</p>
        </div>
      </div>
    )
  }

  // ── Mobile Fullscreen ──────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <VistoriaMobile
        entrada={entrada}
        vistoriaId={vistoriaId}
        onClose={onClose}
        onSave={doSave}
        onConcluir={doConclude}
      />
    )
  }

  // ── Desktop Modal ──────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative flex flex-col w-full max-w-2xl mx-auto my-4 max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden ${bg}`}
        onClick={e => e.stopPropagation()}>

        {/* Header sticky */}
        <div className={`shrink-0 flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-base font-bold truncate ${txt}`}>
              Vistoria de Entrada
            </h3>
            <p className={`text-xs truncate ${txtMuted}`}>
              {entrada.endereco}{entrada.numero ? `, ${entrada.numero}` : ''} — {entrada.cidade}/{entrada.uf}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Online/Offline indicator */}
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              preenchidos === total
                ? 'bg-emerald-100 text-emerald-700'
                : preenchidos > 0
                ? 'bg-amber-100 text-amber-700'
                : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {preenchidos}/{total}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`shrink-0 h-1.5 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (preenchidos / total) * 100 : 0}%` }}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Observacoes Gerais</label>
            <textarea
              rows={2}
              placeholder="Observacoes gerais sobre o imovel..."
              value={obsGerais}
              onChange={e => setObsGerais(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`}
            />
          </div>

          <VistoriaChecklist
            tipo="entrada"
            itens={itens}
            onChange={setItens}
            readOnly={false}
            fotos={fotos}
            onUploadFoto={handleUploadFoto}
            uploadingFoto={uploadFoto.isPending}
          />
        </div>

        {/* Footer sticky */}
        <div className={`shrink-0 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          {/* Offline save indicator */}
          {!isOnline && (
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 text-amber-600 text-xs font-semibold">
              <WifiOff size={12} />
              Offline — dados serao salvos localmente
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleSalvarRascunho}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isDark ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
                } ${saving ? 'opacity-50' : ''}`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Rascunho
              </button>
              <button
                onClick={() => preenchidos === total ? setConfirming(true) : undefined}
                disabled={preenchidos < total || saving}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  preenchidos === total
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'
                } ${saving ? 'opacity-50' : ''}`}
                title={preenchidos < total ? `Preencha todos os ${total} itens para concluir` : ''}
              >
                <CheckCircle2 size={14} />
                Concluir Vistoria
              </button>
            </div>
          </div>
        </div>

        {/* Confirm dialog */}
        {confirming && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(false)}>
            <div className={`rounded-2xl shadow-2xl p-6 max-w-sm mx-4 ${bg}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={20} className="text-amber-500" />
                <h4 className={`text-sm font-bold ${txt}`}>Concluir Vistoria?</h4>
              </div>
              <p className={`text-xs mb-4 ${txtMuted}`}>
                Apos concluir, os itens nao poderao ser editados. A entrada avancara para "Aguardando Assinatura".
                {!isOnline && (
                  <span className="block mt-1 text-amber-600 font-semibold">
                    Offline: dados serao sincronizados quando a conexao for restaurada.
                  </span>
                )}
                {itens.some(it => it.estado === 'ruim') && (
                  <span className="block mt-1 text-red-500 font-semibold">
                    Atencao: {itens.filter(it => it.estado === 'ruim').length} item(ns) marcado(s) como "Ruim".
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConcluir}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
