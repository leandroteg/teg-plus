import { useState, useEffect, useCallback } from 'react'
import { X, Save, CheckCircle2, Loader2, AlertTriangle, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import VistoriaChecklist, { buildDefaultItens, type ChecklistItem } from './VistoriaChecklist'
import {
  useCriarVistoria, useAtualizarVistoria, useSalvarVistoriaItens,
  useUploadVistoriaFoto, useVistoriaFotos, useVistorias, useAtualizarStatusEntrada,
} from '../../hooks/useLocacao'
import type { LocEntrada, LocVistoria, StatusEntrada } from '../../types/locacao'

interface Props {
  entrada: LocEntrada
  onClose: () => void
}

export default function VistoriaModal({ entrada, onClose }: Props) {
  const { isDark } = useTheme()
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

  // Initialize: create vistoria if needed, load existing items
  useEffect(() => {
    if (initialized) return
    if (existingVistoria) {
      // Load existing items into checklist format
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
      // Auto-create
      criarVistoria.mutate(
        { imovel_id: entrada.imovel_id, tipo: 'entrada', entrada_id: entrada.id },
        {
          onSuccess: (v) => {
            setVistoriaId(v.id)
            setItens(buildDefaultItens())
            setInitialized(true)
          },
        },
      )
    }
  }, [existingVistoria, entrada, initialized, criarVistoria])

  const preenchidos = itens.filter(it => it.estado !== null).length
  const total = itens.length

  const handleUploadFoto = useCallback((ambiente: string, item: string, file: File) => {
    if (!vistoriaId) return
    uploadFoto.mutate({ vistoriaId, file, descricao: `${ambiente}|${item}`, tipo: 'entrada' })
  }, [vistoriaId, uploadFoto])

  const handleSalvarRascunho = async () => {
    if (!vistoriaId) return
    setSaving(true)
    try {
      await salvarItens.mutateAsync({
        vistoriaId,
        itens: itens.map((it, i) => ({
          ambiente: it.ambiente, item: it.item,
          estado_entrada: it.estado || undefined,
          observacao: it.observacao || undefined, ordem: i,
        })),
      })
      await atualizarVistoria.mutateAsync({
        id: vistoriaId, status: 'em_andamento', observacoes_gerais: obsGerais || undefined,
        data_vistoria: new Date().toISOString().split('T')[0],
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    if (!vistoriaId) return
    setSaving(true)
    try {
      const temPendencias = itens.some(it => it.estado === 'ruim')
      await salvarItens.mutateAsync({
        vistoriaId,
        itens: itens.map((it, i) => ({
          ambiente: it.ambiente, item: it.item,
          estado_entrada: it.estado || undefined,
          observacao: it.observacao || undefined, ordem: i,
        })),
      })
      await atualizarVistoria.mutateAsync({
        id: vistoriaId, status: 'concluida', observacoes_gerais: obsGerais || undefined,
        tem_pendencias: temPendencias,
        data_vistoria: new Date().toISOString().split('T')[0],
      })
      // Advance entrada to aguardando_assinatura
      await atualizarEntrada.mutateAsync({ id: entrada.id, status: 'aguardando_assinatura' as StatusEntrada })
      onClose()
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

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
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (preenchidos / total) * 100 : 0}%` }}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Observações gerais */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Observações Gerais</label>
            <textarea
              rows={2}
              placeholder="Observações gerais sobre o imóvel..."
              value={obsGerais}
              onChange={e => setObsGerais(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`}
            />
          </div>

          {/* Checklist */}
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
        <div className={`shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
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

        {/* Confirm dialog */}
        {confirming && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirming(false)}>
            <div className={`rounded-2xl shadow-2xl p-6 max-w-sm mx-4 ${bg}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={20} className="text-amber-500" />
                <h4 className={`text-sm font-bold ${txt}`}>Concluir Vistoria?</h4>
              </div>
              <p className={`text-xs mb-4 ${txtMuted}`}>
                Após concluir, os itens não poderão ser editados. A entrada avançará para "Aguardando Assinatura".
                {itens.some(it => it.estado === 'ruim') && (
                  <span className="block mt-1 text-red-500 font-semibold">
                    Atenção: {itens.filter(it => it.estado === 'ruim').length} item(ns) marcado(s) como "Ruim".
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
