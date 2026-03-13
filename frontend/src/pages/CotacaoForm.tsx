import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, PlusCircle, Trash2, Send, CheckCircle, Info, AlertTriangle,
  Paperclip, FileText, X, Loader2, Eye, Ban, CheckCircle2,
} from 'lucide-react'
import { useCotacao, useFinalizarCotacao } from '../hooks/useCotacoes'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useAuth } from '../contexts/AuthContext'
import type { Cotacao } from '../types'
import CotacaoComparativo from '../components/CotacaoComparativo'
import FluxoTimeline from '../components/FluxoTimeline'
import UploadCotacao from '../components/UploadCotacao'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import type { CnpjResult } from '../services/api'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FILE_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const FILE_MAX_SIZE = 10 * 1024 * 1024

interface FornecedorForm {
  fornecedor_nome:    string
  fornecedor_contato: string
  fornecedor_cnpj:    string
  valor_total:        number
  prazo_entrega_dias: number
  condicao_pagamento: string
  observacao:         string
  arquivo_url:        string
}

const emptyFornecedor = (): FornecedorForm => ({
  fornecedor_nome: '', fornecedor_contato: '', fornecedor_cnpj: '',
  valor_total: 0, prazo_entrega_dias: 0, condicao_pagamento: '', observacao: '',
  arquivo_url: '',
})

// Cotações mínimas pelo valor
function getMinCot(valor: number) {
  if (valor <= 500)  return 1
  if (valor <= 2000) return 2
  return 3
}

// ── CNPJ mask: XX.XXX.XXX/XXXX-XX ────────────────────────────────────────────
function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

// ── Cotação Concluída (com botões Emitir Pedido / Cancelar) ─────────────────

function CotacaoConcluida({ cotacao, nav }: { cotacao: Cotacao; nav: ReturnType<typeof useNavigate> }) {
  const { atLeast } = useAuth()
  const emitirMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()
  const [pedidoToast, setPedidoToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const req = cotacao.requisicao
  const canEmitPedido = atLeast('comprador') && req?.status === 'cotacao_aprovada'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => nav('/cotacoes')} className="p-1">
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <h2 className="text-lg font-extrabold text-slate-800">Cotação Concluída</h2>
      </div>

      {/* RC Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-400 font-mono mb-1">{req?.numero}</p>
        <p className="text-sm font-bold text-slate-800">{req?.descricao}</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-slate-400">{req?.obra_nome}</p>
          <p className="text-sm font-extrabold text-teal-600">{fmt(cotacao.valor_selecionado ?? req?.valor_estimado ?? 0)}</p>
        </div>
      </div>

      {/* Timeline */}
      {req && <FluxoTimeline status={req.status ?? 'cotacao_aprovada'} />}

      {/* Comparativo */}
      {cotacao.fornecedores && <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />}

      {/* ── Emitir Pedido / Cancelar ────────────────────────────────────── */}
      {canEmitPedido && (
        <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-3 border-b border-teal-100">
            <p className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-2">
              <FileText size={14} />
              Próximo Passo — Emissão de Pedido
            </p>
          </div>

          <div className="p-4 space-y-3">
            {/* Fornecedor vencedor */}
            {cotacao.fornecedor_selecionado_nome && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-emerald-500 font-semibold uppercase">Fornecedor Vencedor</p>
                    <p className="text-sm font-bold text-emerald-700">{cotacao.fornecedor_selecionado_nome}</p>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-600">
                    {fmt(cotacao.valor_selecionado ?? 0)}
                  </p>
                </div>
              </div>
            )}

            {/* Toast */}
            {pedidoToast && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                pedidoToast.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {pedidoToast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {pedidoToast.msg}
              </div>
            )}

            {/* Botões */}
            {!emitirMutation.isSuccess && !cancelarMutation.isSuccess && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={cancelarMutation.isPending || emitirMutation.isPending}
                  onClick={() => {
                    if (!confirm('Cancelar esta requisição? Esta ação não pode ser desfeita.')) return
                    cancelarMutation.mutate(req!.id, {
                      onSuccess: () => {
                        setPedidoToast({ type: 'success', msg: 'Requisição cancelada' })
                        setTimeout(() => nav('/cotacoes'), 1500)
                      },
                      onError: () => {
                        setPedidoToast({ type: 'error', msg: 'Erro ao cancelar.' })
                        setTimeout(() => setPedidoToast(null), 5000)
                      },
                    })
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                    text-red-500 bg-red-50 border-2 border-red-200 hover:bg-red-100 active:scale-[0.98]
                    transition-all disabled:opacity-50"
                >
                  {cancelarMutation.isPending
                    ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <Ban size={16} />}
                  Cancelar RC
                </button>

                <button
                  disabled={emitirMutation.isPending || cancelarMutation.isPending}
                  onClick={() => {
                    emitirMutation.mutate({
                      requisicaoId: req!.id,
                      cotacaoId: cotacao.id,
                      fornecedorNome: cotacao.fornecedor_selecionado_nome ?? 'N/A',
                      valorTotal: cotacao.valor_selecionado ?? req!.valor_estimado,
                      compradorId: cotacao.comprador_id,
                    }, {
                      onSuccess: (pedido) => {
                        setPedidoToast({ type: 'success', msg: `Pedido ${pedido.numero_pedido} emitido ✓` })
                      },
                      onError: (err: any) => {
                        setPedidoToast({ type: 'error', msg: `Erro ao emitir pedido: ${err?.message || 'erro desconhecido'}` })
                        setTimeout(() => setPedidoToast(null), 5000)
                      },
                    })
                  }}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                    text-white bg-teal-500 border-2 border-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20
                    active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {emitirMutation.isPending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <FileText size={16} />}
                  Emitir Pedido
                </button>
              </div>
            )}

            {emitirMutation.isSuccess && (
              <div className="text-center py-2">
                <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-700">Pedido Emitido!</p>
                <p className="text-xs text-slate-500 mt-1">O pedido aparece na tela de Pedidos</p>
              </div>
            )}

            {cancelarMutation.isSuccess && (
              <div className="text-center py-2">
                <Ban size={36} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-red-600">Requisição Cancelada</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status badges for non-admin or non-approved states */}
      {req?.status === 'cotacao_enviada' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-sm font-bold text-amber-700">⏳ Aguardando Aprovação Financeira</p>
          <p className="text-xs text-amber-500 mt-1">A cotação foi enviada para aprovação do gestor</p>
        </div>
      )}

      {req?.status === 'pedido_emitido' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-700">Pedido Emitido ✓</p>
          <p className="text-xs text-emerald-500 mt-1">O pedido foi emitido e está em andamento</p>
        </div>
      )}
    </div>
  )
}

export default function CotacaoForm() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { data: cotacao, isLoading } = useCotacao(id)
  const submitMutation = useFinalizarCotacao()

  const [fornecedores, setFornecedores] = useState<FornecedorForm[]>([
    emptyFornecedor(), emptyFornecedor(),
  ])
  const [semCotacoesMinimas, setSemCotacoesMinimas] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [triedSubmit, setTriedSubmit] = useState(false)

  // ── CNPJ auto-lookup state per fornecedor ─────────────────────────────────
  const [cnpjLoading, setCnpjLoading] = useState<Record<number, boolean>>({})
  const [cnpjStatus, setCnpjStatus] = useState<Record<number, { ok: boolean; msg: string }>>({})
  const cnpjLastRef = useRef<Record<number, string>>({})

  const handleCnpjLookup = useCallback(async (idx: number, rawCnpj: string) => {
    const digits = rawCnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    const isCorrection = cnpjLastRef.current[idx] !== undefined && cnpjLastRef.current[idx] !== digits
    if (cnpjLastRef.current[idx] === digits) return
    cnpjLastRef.current[idx] = digits

    setCnpjLoading(prev => ({ ...prev, [idx]: true }))
    setCnpjStatus(prev => ({ ...prev, [idx]: { ok: false, msg: '' } }))

    try {
      const result: CnpjResult = await api.consultarCNPJ(digits)
      if (result.error) {
        setCnpjStatus(prev => ({ ...prev, [idx]: { ok: false, msg: result.message || 'CNPJ nao encontrado' } }))
      } else {
        setCnpjStatus(prev => ({ ...prev, [idx]: { ok: true, msg: result.situacao || 'Ativa' } }))
        // Auto-fill name and contact — always overwrite on CNPJ correction
        const nomePreenchido = result.razao_social || result.nome_fantasia || ''
        setFornecedores(prev => prev.map((f, i) => {
          if (i !== idx) return f
          return {
            ...f,
            fornecedor_nome: (isCorrection || !f.fornecedor_nome.trim()) ? nomePreenchido : f.fornecedor_nome,
            fornecedor_contato: (isCorrection || !f.fornecedor_contato.trim()) ? [result.telefone, result.email].filter(Boolean).join(' / ') : f.fornecedor_contato,
          }
        }))
      }
    } catch {
      setCnpjStatus(prev => ({ ...prev, [idx]: { ok: false, msg: 'Erro na consulta' } }))
    } finally {
      setCnpjLoading(prev => ({ ...prev, [idx]: false }))
    }
  }, [])

  const handleCnpjChange = useCallback((idx: number, raw: string) => {
    const masked = maskCNPJ(raw)
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, fornecedor_cnpj: masked } : f))
    // Auto-lookup when 14 digits reached
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 14) {
      handleCnpjLookup(idx, raw)
    }
  }, [handleCnpjLookup])

  const updateFornecedor = (idx: number, field: keyof FornecedorForm, value: string | number) =>
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))

  // ── AI Upload: preenche fornecedores automaticamente ───────────────────────
  const handleAiParsed = useCallback(async (parsed: {
    fornecedor_nome: string
    fornecedor_cnpj?: string
    fornecedor_contato?: string
    valor_total: number
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    observacao?: string
  }[], file: File) => {
    // Upload do arquivo original para Supabase Storage
    let uploadedPath = ''
    if (id && file) {
      try {
        const safeName = 'cotacao_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${id}/${Date.now()}_${safeName}`
        const { error } = await supabase.storage.from('cotacoes-docs').upload(path, file)
        if (!error) uploadedPath = path
      } catch { /* upload falhou, segue sem anexo */ }
    }

    setFornecedores(prev => {
      // Slots vazios disponíveis
      const vazios = prev.filter(f => !f.fornecedor_nome.trim() && f.valor_total === 0)
      const preenchidos = prev.filter(f => f.fornecedor_nome.trim() || f.valor_total > 0)

      const novos: FornecedorForm[] = parsed.map(p => ({
        fornecedor_nome: p.fornecedor_nome || '',
        fornecedor_cnpj: p.fornecedor_cnpj ? maskCNPJ(p.fornecedor_cnpj) : '',
        fornecedor_contato: p.fornecedor_contato || '',
        valor_total: p.valor_total || 0,
        prazo_entrega_dias: p.prazo_entrega_dias || 0,
        condicao_pagamento: p.condicao_pagamento || '',
        observacao: p.observacao || '',
        arquivo_url: uploadedPath,
      }))

      // Preenche slots vazios primeiro, depois adiciona novos
      const result = [...preenchidos]
      let slotIdx = 0
      for (const novo of novos) {
        if (slotIdx < vazios.length) {
          result.push(novo) // Substitui slot vazio
          slotIdx++
        } else {
          result.push(novo) // Adiciona novo
        }
      }

      // Garante mínimo de 2 slots
      while (result.length < 2) result.push(emptyFornecedor())
      return result
    })
  }, [id])

  // ── Upload de arquivo por fornecedor ──────────────────────────────────────
  const [uploading, setUploading] = useState<Record<number, boolean>>({})
  const [uploadError, setUploadError] = useState<Record<number, string>>({})
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const handleFileUpload = useCallback(async (idx: number, file: File) => {
    if (!id) return
    if (!FILE_ACCEPTED.includes(file.type)) {
      setUploadError(prev => ({ ...prev, [idx]: 'Use JPG, PNG, WebP ou PDF' }))
      return
    }
    if (file.size > FILE_MAX_SIZE) {
      setUploadError(prev => ({ ...prev, [idx]: 'Máximo 10 MB' }))
      return
    }

    setUploading(prev => ({ ...prev, [idx]: true }))
    setUploadError(prev => ({ ...prev, [idx]: '' }))

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${id}/${Date.now()}_${safeName}`
      const { error } = await supabase.storage.from('cotacoes-docs').upload(path, file)
      if (error) throw error
      updateFornecedor(idx, 'arquivo_url', path)
    } catch (err) {
      setUploadError(prev => ({ ...prev, [idx]: err instanceof Error ? err.message : 'Erro no upload' }))
    } finally {
      setUploading(prev => ({ ...prev, [idx]: false }))
    }
  }, [id, updateFornecedor])

  const removeFile = useCallback(async (idx: number) => {
    const path = fornecedores[idx]?.arquivo_url
    if (path) {
      await supabase.storage.from('cotacoes-docs').remove([path]).catch(() => {})
    }
    updateFornecedor(idx, 'arquivo_url', '')
  }, [fornecedores, updateFornecedor])

  const viewFile = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('cotacoes-docs').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }, [])

  const validos = fornecedores.filter(f => f.fornecedor_nome.trim() && f.valor_total > 0)
  const valorRef = (cotacao?.requisicao as any)?.valor_estimado ?? 0
  const minCot   = getMinCot(valorRef)

  // Validação + feedback claro em cada etapa
  const canSubmit = validos.length > 0 && (semCotacoesMinimas || validos.length >= minCot) && (!semCotacoesMinimas || justificativa.trim().length > 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)
    setTriedSubmit(true)

    // Validações com feedback explícito
    if (!id || !cotacao) {
      setToast({ type: 'error', msg: 'Cotação não encontrada. Recarregue a página.' })
      return
    }
    if (validos.length === 0) {
      setToast({ type: 'error', msg: 'Preencha ao menos 1 fornecedor (nome + valor total).' })
      return
    }
    if (!semCotacoesMinimas && validos.length < minCot) {
      setToast({ type: 'error', msg: `Mínimo de ${minCot} fornecedor${minCot > 1 ? 'es' : ''} obrigatório${minCot > 1 ? 's' : ''}, ou marque a opção para enviar sem o mínimo.` })
      return
    }
    if (semCotacoesMinimas && !justificativa.trim()) {
      setToast({ type: 'error', msg: 'Preencha a justificativa para envio sem cotações mínimas.' })
      return
    }

    try {
      await submitMutation.mutateAsync({
        cotacao_id: id,
        requisicao_id: cotacao.requisicao_id,
        fornecedores: validos.map(f => ({
          fornecedor_nome: f.fornecedor_nome,
          fornecedor_contato: f.fornecedor_contato || undefined,
          fornecedor_cnpj: f.fornecedor_cnpj || undefined,
          valor_total: f.valor_total,
          prazo_entrega_dias: f.prazo_entrega_dias || undefined,
          condicao_pagamento: f.condicao_pagamento || undefined,
          observacao: f.observacao || undefined,
          arquivo_url: f.arquivo_url || undefined,
        })),
        sem_cotacoes_minimas: semCotacoesMinimas,
        justificativa_sem_cotacoes: semCotacoesMinimas ? justificativa.trim() : undefined,
      })
      setToast({ type: 'success', msg: 'Cotação enviada para aprovação!' })
      setTimeout(() => nav('/cotacoes'), 800)
    } catch (err) {
      console.error('[CotacaoForm] Erro ao enviar:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setToast({ type: 'error', msg: `Erro ao enviar cotação: ${msg}` })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Cotação já concluída ──────────────────────────────────────────────────
  if (cotacao?.status === 'concluida' && cotacao.fornecedores) {
    return (
      <CotacaoConcluida cotacao={cotacao} nav={nav} />
    )
  }

  // ── Formulário de nova cotação ────────────────────────────────────────────
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => nav('/cotacoes')} className="p-1">
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <h2 className="text-lg font-extrabold text-slate-800">Inserir Cotação</h2>
      </div>

      {/* RC Info + Timeline */}
      {cotacao?.requisicao && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-slate-400 font-mono">{cotacao.requisicao.numero}</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{cotacao.requisicao.descricao}</p>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">{cotacao.requisicao.obra_nome}</span>
              <span className="text-sm font-extrabold text-teal-600">{fmt(valorRef)}</span>
            </div>
          </div>
          <FluxoTimeline status="em_cotacao" compact />
        </div>
      )}

      {/* Card de política da categoria */}
      {(cotacao?.requisicao as any)?.categoria && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info size={14} className="text-amber-600" />
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Política da Categoria</p>
          </div>
          <p className="text-[11px] text-amber-800">
            Categoria: <strong>{(cotacao?.requisicao as any).categoria.replace(/_/g, ' ')}</strong>
            {' · '}Mínimo: <strong>{minCot} cotação{minCot > 1 ? 'ões' : ''}</strong> para valor {fmt(valorRef)}
          </p>
        </div>
      )}

      {/* Upload inteligente com IA */}
      <UploadCotacao
        onParsed={handleAiParsed}
        disabled={cotacao?.status === 'concluida'}
      />

      {/* Progresso de fornecedores */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-slate-600">
            {validos.length} de {minCot} fornecedor{minCot > 1 ? 'es' : ''} inserido{validos.length !== 1 ? 's' : ''}
          </p>
          <span className={`text-[10px] font-semibold ${validos.length >= minCot ? 'text-emerald-600' : 'text-amber-600'}`}>
            {validos.length >= minCot ? '✓ Mínimo atingido' : `Faltam ${minCot - validos.length}`}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${validos.length >= minCot ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min((validos.length / minCot) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Fornecedores */}
      {fornecedores.map((forn, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header do card */}
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-[10px] font-black text-white">
                {idx + 1}
              </span>
              <span className="text-xs font-bold text-slate-700">Fornecedor {idx + 1}</span>
              {forn.fornecedor_nome.trim() && forn.valor_total > 0 && (
                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">✓ Válido</span>
              )}
            </div>
            {fornecedores.length > 2 && (
              <button type="button" onClick={() => setFornecedores(p => p.filter((_, i) => i !== idx))}
                className="p-1 rounded-lg hover:bg-red-50 transition">
                <Trash2 size={14} className="text-red-400 hover:text-red-600 transition" />
              </button>
            )}
          </div>

          <div className="px-4 pb-4 space-y-3">
            <input
              required={idx < minCot && !semCotacoesMinimas}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-shadow ${
                triedSubmit && !forn.fornecedor_nome.trim() && idx < minCot && !semCotacoesMinimas
                  ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
              }`}
              placeholder="Nome do fornecedor *"
              value={forn.fornecedor_nome}
              onChange={e => updateFornecedor(idx, 'fornecedor_nome', e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow font-mono"
                  placeholder="00.000.000/0000-00"
                  value={forn.fornecedor_cnpj}
                  onChange={e => handleCnpjChange(idx, e.target.value)}
                  onBlur={() => handleCnpjLookup(idx, forn.fornecedor_cnpj)}
                  maxLength={18}
                />
                {cnpjLoading[idx] && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-violet-500">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] font-semibold">Buscando...</span>
                  </div>
                )}
                {cnpjStatus[idx]?.ok && (
                  <p className="text-[9px] text-emerald-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={9} /> {cnpjStatus[idx].msg}
                  </p>
                )}
                {cnpjStatus[idx] && !cnpjStatus[idx].ok && cnpjStatus[idx].msg && (
                  <p className="text-[9px] text-red-500 mt-0.5">{cnpjStatus[idx].msg}</p>
                )}
              </div>
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                placeholder="Contato (tel/e-mail)"
                value={forn.fornecedor_contato}
                onChange={e => updateFornecedor(idx, 'fornecedor_contato', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">Valor Total *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">R$</span>
                  <input
                    required={idx < minCot && !semCotacoesMinimas}
                    type="number" min="0.01" step="0.01"
                    className={`w-full border rounded-xl pl-9 pr-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-teal-300 outline-none transition-shadow ${
                      triedSubmit && !forn.valor_total && idx < minCot && !semCotacoesMinimas
                        ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                    }`}
                    value={forn.valor_total || ''}
                    onChange={e => updateFornecedor(idx, 'valor_total', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">Prazo (dias)</label>
                <input
                  type="number" min="1"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                  value={forn.prazo_entrega_dias || ''}
                  onChange={e => updateFornecedor(idx, 'prazo_entrega_dias', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                placeholder="Condição de pgto (30 dias, à vista...)"
                value={forn.condicao_pagamento}
                onChange={e => updateFornecedor(idx, 'condicao_pagamento', e.target.value)}
              />
              <div className="relative">
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                  placeholder="Observação (frete, garantia...)"
                  maxLength={200}
                  value={forn.observacao}
                  onChange={e => updateFornecedor(idx, 'observacao', e.target.value)}
                />
                {forn.observacao.length > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-300">
                    {forn.observacao.length}/200
                  </span>
                )}
              </div>
            </div>

            {/* ── Anexo da Cotação ─────────────────────────────────────────── */}
            <div className="pt-1">
              <input
                ref={el => { fileInputRefs.current[idx] = el }}
                type="file"
                accept={FILE_ACCEPTED.join(',')}
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(idx, file)
                  if (fileInputRefs.current[idx]) fileInputRefs.current[idx]!.value = ''
                }}
              />

              {forn.arquivo_url ? (
                /* Arquivo anexado */
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700 truncate">
                      Cotação anexada
                    </p>
                    <p className="text-[10px] text-emerald-500 truncate">
                      {forn.arquivo_url.split('/').pop()?.replace(/^\d+_/, '') ?? 'arquivo'}
                    </p>
                  </div>
                  <button type="button" onClick={() => viewFile(forn.arquivo_url)}
                    className="p-1.5 rounded-lg hover:bg-emerald-100 transition" title="Visualizar">
                    <Eye size={14} className="text-emerald-600" />
                  </button>
                  <button type="button" onClick={() => removeFile(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Remover">
                    <X size={14} className="text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ) : uploading[idx] ? (
                /* Fazendo upload */
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Loader2 size={16} className="text-amber-600 animate-spin flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Enviando arquivo...</p>
                </div>
              ) : (
                /* Botão de upload */
                <button
                  type="button"
                  onClick={() => fileInputRefs.current[idx]?.click()}
                  className="w-full flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2.5 hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
                >
                  <Paperclip size={14} className="text-slate-400 group-hover:text-violet-500 transition" />
                  <span className="text-xs text-slate-400 group-hover:text-violet-600 font-semibold transition">
                    Anexar cotação (PDF, foto)
                  </span>
                </button>
              )}

              {uploadError[idx] && (
                <p className="text-[11px] text-red-500 mt-1 pl-1">{uploadError[idx]}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Adicionar fornecedor */}
      <button
        type="button"
        onClick={() => setFornecedores(p => [...p, emptyFornecedor()])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-teal-600 border-2 border-dashed border-teal-300 rounded-2xl hover:bg-teal-50 transition"
      >
        <PlusCircle size={14} /> Adicionar Fornecedor
      </button>

      {/* Comparativo inline (quando ≥ 2 válidos) */}
      {validos.length >= 2 && (
        <CotacaoComparativo
          readOnly
          fornecedores={validos.map((f, i) => ({
            id: String(i),
            cotacao_id: id ?? '',
            fornecedor_nome: f.fornecedor_nome,
            fornecedor_contato: f.fornecedor_contato || undefined,
            fornecedor_cnpj: f.fornecedor_cnpj || undefined,
            valor_total: f.valor_total,
            prazo_entrega_dias: f.prazo_entrega_dias || undefined,
            condicao_pagamento: f.condicao_pagamento || undefined,
            itens_precos: [],
            arquivo_url: f.arquivo_url || undefined,
            selecionado: f.valor_total === Math.min(...validos.map(x => x.valor_total)),
          }))}
        />
      )}

      {/* Opção de envio sem cotações mínimas */}
      {validos.length < minCot && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={semCotacoesMinimas}
              onChange={e => setSemCotacoesMinimas(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-amber-500"
            />
            <div>
              <p className="text-sm font-bold text-amber-800">Enviar para aprovação sem todas as cotações</p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Será exibido um alerta para o aprovador informando que o número mínimo de cotações não foi atingido.
              </p>
            </div>
          </label>
          {semCotacoesMinimas && (
            <textarea
              required
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Justificativa obrigatória para envio sem cotações mínimas..."
              rows={3}
              className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 outline-none resize-none"
            />
          )}
        </div>
      )}

      {/* Toast de feedback */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitMutation.isPending || !canSubmit}
        className={`w-full rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all ${
          canSubmit && !submitMutation.isPending
            ? 'bg-teal-500 text-white shadow-teal-500/25 hover:bg-teal-600'
            : 'bg-slate-300 text-slate-500 shadow-slate-200/25 cursor-not-allowed'
        }`}
      >
        {submitMutation.isPending ? (
          <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
        ) : (
          <><Send size={18} /> Enviar para Aprovação</>
        )}
      </button>

      {!canSubmit && !submitMutation.isPending && (
        <p className="text-xs text-slate-400 text-center">
          {validos.length === 0
            ? 'Preencha ao menos 1 fornecedor (nome + valor) para habilitar o envio.'
            : !semCotacoesMinimas && validos.length < minCot
              ? `Adicione pelo menos ${minCot} fornecedor${minCot > 1 ? 'es' : ''} ou marque a opção acima para enviar sem o mínimo.`
              : semCotacoesMinimas && !justificativa.trim()
                ? 'Preencha a justificativa para prosseguir.'
                : ''
          }
        </p>
      )}
    </form>
  )
}
