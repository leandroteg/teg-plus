// ---------------------------------------------------------------------------
// FrotasChecklistModal.tsx -- Orchestrator for vehicle checklist
// Detects viewport, delegates to FrotasChecklistMobile on mobile.
// Desktop: renders modal with FrotasChecklist. Manages persistence.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react'
import { X, Save, CheckCircle2, Loader2, AlertTriangle, Wifi, WifiOff, Fuel } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useQuery } from '@tanstack/react-query'
import FrotasChecklist, {
  buildChecklistFromTemplate,
  type FrotasChecklistItem,
} from './FrotasChecklist'
import FrotasChecklistMobile, {
  type ChecklistSaveData,
  type NivelCombustivel,
} from './FrotasChecklistMobile'
import {
  useChecklistTemplates,
  useChecklistExecucoes,
} from '../../hooks/useFrotas'
import { supabase } from '../../services/supabase'
import { dataUrlToBlob } from '../../hooks/useVistoriaOffline'
import type {
  FroVeiculo,
  FroChecklistTemplateItem,
  TipoChecklist2,
  FroChecklistExecucao,
} from '../../types/frotas'

// -- Mobile Detection ---------------------------------------------------------

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  )
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isMobile
}

// -- Fuel gauge labels --------------------------------------------------------

const NIVEIS_COMBUSTIVEL: { value: NivelCombustivel; label: string }[] = [
  { value: 0, label: 'Vazio' },
  { value: 1, label: '1/4' },
  { value: 2, label: '1/2' },
  { value: 3, label: '3/4' },
  { value: 4, label: 'Cheio' },
]

// -- Props --------------------------------------------------------------------

interface Props {
  veiculo: FroVeiculo
  tipoChecklist: TipoChecklist2
  alocacaoId?: string
  onClose: () => void
}

// -- Component ----------------------------------------------------------------

export default function FrotasChecklistModal({ veiculo, tipoChecklist, alocacaoId, onClose }: Props) {
  const { isDark } = useTheme()
  const isMobile = useIsMobile()
  const isOnline = useOnlineStatus()

  // Load template for the checklist type
  const { data: templates = [] } = useChecklistTemplates(tipoChecklist)
  const tipoAtivo = veiculo.tipo_ativo || 'veiculo'
  // Prefer templates that have items seeded (077 migration over 068 stubs)
  const matchingTemplates = templates.filter(
    t => t.tipo_ativo === tipoAtivo || t.tipo_ativo === 'todos',
  )
  const template = matchingTemplates.find(t => t.itens && t.itens.length > 0)
    || matchingTemplates[0]
    || templates.find(t => t.itens && t.itens.length > 0)
    || templates[0]
    || null

  // Load template items
  const { data: templateItems = [] } = useQuery({
    queryKey: ['fro_checklist_template_itens', template?.id],
    queryFn: async () => {
      if (!template?.id) return []
      const { data, error } = await supabase
        .from('fro_checklist_template_itens')
        .select('*')
        .eq('template_id', template.id)
        .order('ordem')
      if (error) throw error
      return data as FroChecklistTemplateItem[]
    },
    enabled: !!template?.id,
  })

  // Load existing executions for this vehicle
  const { data: execucoes = [] } = useChecklistExecucoes(veiculo.id)
  const existingExecucao = execucoes.find(
    e => e.template_id === template?.id && e.status !== 'concluido',
  )

  // State
  const [execucaoId, setExecucaoId] = useState<string | null>(existingExecucao?.id || null)
  const [itens, setItens] = useState<FrotasChecklistItem[]>([])
  const [obsGerais, setObsGerais] = useState(existingExecucao?.observacoes || '')
  const [nivelCombustivel, setNivelCombustivel] = useState<NivelCombustivel | null>(null)
  const [hodometroRegistro, setHodometroRegistro] = useState<number | null>(
    existingExecucao?.hodometro || veiculo.hodometro_atual || null,
  )
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'

  // Use template items from join if separate query returned empty
  const effectiveItems = templateItems.length > 0
    ? templateItems
    : (template?.itens ?? [])

  // Initialize: create execution if needed, populate items
  useEffect(() => {
    if (initialized || !template?.id || effectiveItems.length === 0) return

    // Build checklist from template
    const baseItens = buildChecklistFromTemplate(effectiveItems)

    // If there's an existing execution with saved items, merge them
    if (existingExecucao?.itens && existingExecucao.itens.length > 0) {
      const mergedItens = baseItens.map(bi => {
        const saved = existingExecucao.itens!.find(s => s.template_item_id === bi.templateItemId)
        if (saved) {
          return {
            ...bi,
            estado: saved.conforme === true ? 'otimo' as const
              : saved.conforme === false ? 'ruim' as const
              : null,
            observacao: saved.observacao || '',
          }
        }
        return bi
      })
      setItens(mergedItens)
      setExecucaoId(existingExecucao.id)
      setObsGerais(existingExecucao.observacoes || '')
      setHodometroRegistro(existingExecucao.hodometro || veiculo.hodometro_atual || null)
      setInitialized(true)
      return
    }

    // Create a new execution if none exists
    if (!existingExecucao && isOnline) {
      const createExecution = async () => {
        try {
          const { data, error } = await supabase
            .from('fro_checklist_execucoes')
            .insert({
              template_id: template.id,
              veiculo_id: veiculo.id,
              alocacao_id: alocacaoId || null,
              hodometro: veiculo.hodometro_atual || null,
              status: 'pendente',
            })
            .select('id')
            .single()
          if (error) throw error
          setExecucaoId(data.id)
        } catch (err) {
          console.error('[FrotasChecklistModal] Error creating execution:', err)
        }
      }
      createExecution()
    }

    setItens(baseItens)
    setInitialized(true)
  }, [initialized, template, effectiveItems, existingExecucao, isOnline, veiculo, alocacaoId])

  const preenchidos = itens.filter(it => it.estado !== null).length
  const total = itens.length

  // -- Save / Conclude logic --------------------------------------------------

  const doSaveItems = useCallback(
    async (saveItens: FrotasChecklistItem[], eid: string, obs: string, hodo: number | null) => {
      // Upsert execution items
      const rows = saveItens.map(it => ({
        execucao_id: eid,
        template_item_id: it.templateItemId,
        conforme: it.estado === 'otimo' || it.estado === 'bom' ? true
          : it.estado === 'ruim' || it.estado === 'regular' ? false
          : null,
        observacao: it.observacao || null,
      }))

      // Delete existing items and re-insert (simplest upsert pattern)
      await supabase.from('fro_checklist_execucao_itens').delete().eq('execucao_id', eid)
      const { error: insertErr } = await supabase
        .from('fro_checklist_execucao_itens')
        .insert(rows)
      if (insertErr) throw insertErr

      // Update execution record
      const { error: updateErr } = await supabase
        .from('fro_checklist_execucoes')
        .update({
          status: 'em_andamento',
          observacoes: obs || null,
          hodometro: hodo,
        })
        .eq('id', eid)
      if (updateErr) throw updateErr
    },
    [],
  )

  const doConclude = useCallback(
    async (saveItens: FrotasChecklistItem[], eid: string, obs: string, hodo: number | null) => {
      await doSaveItems(saveItens, eid, obs, hodo)

      // Mark execution as concluded
      const { error: concludeErr } = await supabase
        .from('fro_checklist_execucoes')
        .update({
          status: 'concluido',
          concluido_at: new Date().toISOString(),
          observacoes: obs || null,
          hodometro: hodo,
        })
        .eq('id', eid)
      if (concludeErr) throw concludeErr

      // Update vehicle hodometro if provided and higher
      if (hodo && hodo > (veiculo.hodometro_atual || 0)) {
        await supabase
          .from('fro_veiculos')
          .update({ hodometro_atual: hodo })
          .eq('id', veiculo.id)
      }

      // Update vehicle status if applicable (aguardando_saida -> em_uso)
      if (veiculo.status === 'aguardando_saida' && tipoChecklist === 'pre_viagem') {
        await supabase
          .from('fro_veiculos')
          .update({ status: 'em_uso' })
          .eq('id', veiculo.id)
      }
    },
    [doSaveItems, veiculo, tipoChecklist],
  )

  // Upload foto helper
  const handleUploadFoto = useCallback(
    (descricao: string, file: File) => {
      if (!execucaoId) return
      const uploadAsync = async () => {
        try {
          const ext = file.type.includes('png') ? 'png' : 'jpg'
          const path = `checklist/${execucaoId}/${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('frotas-fotos')
            .upload(path, file, { upsert: true, contentType: file.type })
          if (upErr) {
            console.error('[FrotasChecklistModal] Upload error:', upErr)
            return
          }
          const {
            data: { publicUrl },
          } = supabase.storage.from('frotas-fotos').getPublicUrl(path)

          // Find matching item to get template_item_id
          const matchingItem = itens.find(it => it.descricao === descricao)
          if (matchingItem) {
            // Get the execucao item id to update foto_url
            const { data: execItem } = await supabase
              .from('fro_checklist_execucao_itens')
              .select('id')
              .eq('execucao_id', execucaoId)
              .eq('template_item_id', matchingItem.templateItemId)
              .single()
            if (execItem) {
              await supabase
                .from('fro_checklist_execucao_itens')
                .update({ foto_url: publicUrl })
                .eq('id', execItem.id)
            }
          }
        } catch (err) {
          console.error('[FrotasChecklistModal] Upload error:', err)
        }
      }
      uploadAsync()
    },
    [execucaoId, itens],
  )

  // -- Save / Conclude handlers (desktop) -------------------------------------

  const handleSalvarRascunho = async () => {
    if (!execucaoId) return
    setSaving(true)
    try {
      await doSaveItems(itens, execucaoId, obsGerais, hodometroRegistro)
      onClose()
    } catch (err) {
      console.error('[FrotasChecklistModal] Save error:', err)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleConcluir = async () => {
    if (!execucaoId) return
    setSaving(true)
    try {
      await doConclude(itens, execucaoId, obsGerais, hodometroRegistro)
      onClose()
    } catch (err) {
      console.error('[FrotasChecklistModal] Conclude error:', err)
      onClose()
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  // -- Mobile save/conclude callbacks -----------------------------------------

  const handleMobileSave = useCallback(
    async (data: ChecklistSaveData) => {
      if (!execucaoId) return
      await doSaveItems(data.itens, execucaoId, data.obsGerais, data.hodometroRegistro)
    },
    [execucaoId, doSaveItems],
  )

  const handleMobileConcluir = useCallback(
    async (data: ChecklistSaveData) => {
      if (!execucaoId) return
      await doConclude(data.itens, execucaoId, data.obsGerais, data.hodometroRegistro)
    },
    [execucaoId, doConclude],
  )

  // -- Loading state ----------------------------------------------------------

  if (!initialized) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className={`rounded-2xl shadow-2xl p-10 ${bg}`}>
          <Loader2 size={32} className="animate-spin text-rose-500 mx-auto" />
          <p className={`text-sm mt-3 ${txtMuted}`}>Preparando checklist...</p>
        </div>
      </div>
    )
  }

  // -- Mobile Fullscreen ------------------------------------------------------

  if (isMobile) {
    return (
      <FrotasChecklistMobile
        veiculo={veiculo}
        templateItems={templateItems}
        execucaoId={execucaoId}
        tipoChecklist={tipoChecklist}
        onClose={onClose}
        onSave={handleMobileSave}
        onConcluir={handleMobileConcluir}
      />
    )
  }

  // -- Desktop Modal ----------------------------------------------------------

  const veiculoLabel = `${veiculo.placa} \u2014 ${veiculo.marca} ${veiculo.modelo}${veiculo.ano_mod ? ` ${veiculo.ano_mod}` : ''}`

  const TITULO_POR_TIPO: Record<string, string> = {
    pre_viagem: 'Checklist Pre-Viagem',
    pos_viagem: 'Checklist Pos-Viagem',
    entrega_locadora: 'Vistoria de Entrega',
    devolucao_locadora: 'Vistoria de Devolucao',
    pre_manutencao: 'Checklist Pre-Manutencao',
    pos_manutencao: 'Checklist Pos-Manutencao',
  }
  const titulo = TITULO_POR_TIPO[tipoChecklist] || 'Checklist'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative flex flex-col w-full max-w-2xl mx-auto my-4 max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div
          className={`shrink-0 flex items-center justify-between px-5 py-4 border-b ${
            isDark ? 'border-white/[0.06]' : 'border-slate-100'
          }`}
        >
          <div className="min-w-0">
            <h3 className={`text-base font-bold truncate ${txt}`}>{titulo}</h3>
            <p className={`text-xs truncate ${txtMuted}`}>{veiculoLabel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Online/Offline indicator */}
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                preenchidos === total
                  ? 'bg-emerald-100 text-emerald-700'
                  : preenchidos > 0
                    ? 'bg-amber-100 text-amber-700'
                    : isDark
                      ? 'bg-white/10 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
              }`}
            >
              {preenchidos}/{total}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`shrink-0 h-1.5 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
            style={{ width: `${total > 0 ? (preenchidos / total) * 100 : 0}%` }}
          />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Vehicle fields row: fuel gauge + hodometro */}
          <div className="flex items-end gap-4">
            {/* Fuel gauge */}
            <div className="flex-1">
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
                Nivel de Combustivel
              </label>
              <div className="flex items-center gap-2">
                <Fuel size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                <div className="flex gap-1 flex-1">
                  {NIVEIS_COMBUSTIVEL.map(nc => (
                    <button
                      key={nc.value}
                      type="button"
                      onClick={() => setNivelCombustivel(nc.value)}
                      className={[
                        'flex-1 h-8 rounded-lg transition-all duration-200 text-[10px] font-bold',
                        nivelCombustivel !== null && nc.value <= nivelCombustivel
                          ? 'bg-gradient-to-t from-rose-500 to-amber-400 text-white shadow-sm'
                          : isDark
                            ? 'bg-white/[0.06] border border-white/[0.06] text-slate-500'
                            : 'bg-slate-100 border border-slate-200 text-slate-400',
                      ].join(' ')}
                    >
                      {nc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Hodometro */}
            <div className="w-36">
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
                Hodometro (km)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={hodometroRegistro ?? ''}
                onChange={e =>
                  setHodometroRegistro(e.target.value ? Number(e.target.value) : null)
                }
                placeholder="km"
                className={`w-full text-sm font-bold tabular-nums rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
          </div>

          {/* Obs gerais */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
              Observacoes Gerais
            </label>
            <textarea
              rows={2}
              placeholder="Observacoes gerais sobre o veiculo..."
              value={obsGerais}
              onChange={e => setObsGerais(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`}
            />
          </div>

          <FrotasChecklist
            itens={itens}
            onChange={setItens}
            readOnly={false}
            onUploadFoto={handleUploadFoto}
          />
        </div>

        {/* Footer sticky */}
        <div
          className={`shrink-0 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}
        >
          {/* Offline save indicator */}
          {!isOnline && (
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 text-amber-600 text-xs font-semibold">
              <WifiOff size={12} />
              Offline -- dados serao salvos localmente
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
                isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
              }`}
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleSalvarRascunho}
                disabled={saving}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  isDark
                    ? 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                    : 'border-rose-300 text-rose-700 hover:bg-rose-50'
                } ${saving ? 'opacity-50' : ''}`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Rascunho
              </button>
              <button
                onClick={() => (preenchidos === total ? setConfirming(true) : undefined)}
                disabled={preenchidos < total || saving}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  preenchidos === total
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : isDark
                      ? 'bg-white/[0.06] text-slate-500'
                      : 'bg-slate-100 text-slate-400'
                } ${saving ? 'opacity-50' : ''}`}
                title={
                  preenchidos < total
                    ? `Preencha todos os ${total} itens para concluir`
                    : ''
                }
              >
                <CheckCircle2 size={14} />
                Concluir Checklist
              </button>
            </div>
          </div>
        </div>

        {/* Confirm dialog */}
        {confirming && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          >
            <div
              className={`rounded-2xl shadow-2xl p-6 max-w-sm mx-4 ${bg}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={20} className="text-amber-500" />
                <h4 className={`text-sm font-bold ${txt}`}>Concluir Checklist?</h4>
              </div>
              <p className={`text-xs mb-4 ${txtMuted}`}>
                Apos concluir, os itens nao poderao ser editados.
                {veiculo.status === 'aguardando_saida' && tipoChecklist === 'pre_viagem' && (
                  <span className="block mt-1 text-rose-600 font-semibold">
                    O veiculo sera atualizado para "Em Uso".
                  </span>
                )}
                {!isOnline && (
                  <span className="block mt-1 text-amber-600 font-semibold">
                    Offline: dados serao sincronizados quando a conexao for restaurada.
                  </span>
                )}
                {itens.some(it => it.estado === 'ruim') && (
                  <span className="block mt-1 text-red-500 font-semibold">
                    Atencao: {itens.filter(it => it.estado === 'ruim').length} item(ns) marcado(s)
                    como "Ruim".
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${
                    isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                  }`}
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
