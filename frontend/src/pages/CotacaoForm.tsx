import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, PlusCircle, Trash2, Send, CheckCircle, Info,
} from 'lucide-react'
import { useCotacao, useSubmeterCotacao } from '../hooks/useCotacoes'
import CotacaoComparativo from '../components/CotacaoComparativo'
import FluxoTimeline from '../components/FluxoTimeline'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface FornecedorForm {
  fornecedor_nome:    string
  fornecedor_contato: string
  fornecedor_cnpj:    string
  valor_total:        number
  prazo_entrega_dias: number
  condicao_pagamento: string
  observacao:         string
}

const emptyFornecedor = (): FornecedorForm => ({
  fornecedor_nome: '', fornecedor_contato: '', fornecedor_cnpj: '',
  valor_total: 0, prazo_entrega_dias: 0, condicao_pagamento: '', observacao: '',
})

// Cotações mínimas pelo valor
function getMinCot(valor: number) {
  if (valor <= 500)  return 1
  if (valor <= 2000) return 2
  return 3
}

export default function CotacaoForm() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { data: cotacao, isLoading } = useCotacao(id)
  const submitMutation = useSubmeterCotacao()

  const [fornecedores, setFornecedores] = useState<FornecedorForm[]>([
    emptyFornecedor(), emptyFornecedor(),
  ])

  const updateFornecedor = (idx: number, field: keyof FornecedorForm, value: string | number) =>
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))

  const validos = fornecedores.filter(f => f.fornecedor_nome.trim() && f.valor_total > 0)
  const valorRef = (cotacao?.requisicao as any)?.valor_estimado ?? 0
  const minCot   = getMinCot(valorRef)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || validos.length < minCot) return
    try {
      await submitMutation.mutateAsync({
        cotacao_id: id,
        fornecedores: validos.map(f => ({ ...f, itens_precos: [] })),
      })
      nav('/cotacoes')
    } catch { /* handled */ }
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
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/cotacoes')} className="p-1">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <h2 className="text-lg font-extrabold text-slate-800">Cotação Concluída</h2>
        </div>

        {/* RC Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-mono mb-1">{cotacao.requisicao?.numero}</p>
          <p className="text-sm font-bold text-slate-800">{cotacao.requisicao?.descricao}</p>
          <p className="text-xs text-slate-400 mt-1">{cotacao.requisicao?.obra_nome}</p>
        </div>

        {/* Timeline */}
        {cotacao.requisicao && (
          <FluxoTimeline status={cotacao.requisicao.status ?? 'cotacao_aprovada'} />
        )}

        {/* Comparativo */}
        <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />
      </div>
    )
  }

  // ── Formulário de nova cotação ────────────────────────────────────────────
  return (
    <form onSubmit={submit} className="space-y-4">
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
            Categoria: <strong>{(cotacao.requisicao as any).categoria.replace(/_/g, ' ')}</strong>
            {' · '}Mínimo: <strong>{minCot} cotação{minCot > 1 ? 'ões' : ''}</strong> para valor {fmt(valorRef)}
          </p>
        </div>
      )}

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
        <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">Fornecedor {idx + 1}</span>
            {fornecedores.length > 2 && (
              <button type="button" onClick={() => setFornecedores(p => p.filter((_, i) => i !== idx))}>
                <Trash2 size={14} className="text-slate-300 hover:text-red-500 transition" />
              </button>
            )}
          </div>

          <input
            required={idx < minCot}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none"
            placeholder="Nome do fornecedor *"
            value={forn.fornecedor_nome}
            onChange={e => updateFornecedor(idx, 'fornecedor_nome', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
              placeholder="CNPJ"
              value={forn.fornecedor_cnpj}
              onChange={e => updateFornecedor(idx, 'fornecedor_cnpj', e.target.value)}
            />
            <input
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
              placeholder="Contato (tel/e-mail)"
              value={forn.fornecedor_contato}
              onChange={e => updateFornecedor(idx, 'fornecedor_contato', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold">Valor Total (R$) *</label>
              <input
                required={idx < minCot}
                type="number" min="0.01" step="0.01"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                value={forn.valor_total || ''}
                onChange={e => updateFornecedor(idx, 'valor_total', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold">Prazo (dias)</label>
              <input
                type="number" min="1"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                value={forn.prazo_entrega_dias || ''}
                onChange={e => updateFornecedor(idx, 'prazo_entrega_dias', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
            placeholder="Condição de pagamento (ex: 30 dias, à vista)"
            value={forn.condicao_pagamento}
            onChange={e => updateFornecedor(idx, 'condicao_pagamento', e.target.value)}
          />
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
            selecionado: f.valor_total === Math.min(...validos.map(x => x.valor_total)),
          }))}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitMutation.isPending || validos.length < minCot}
        className="w-full bg-teal-500 text-white rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-teal-500/25 active:scale-[0.98] transition-all"
      >
        {submitMutation.isPending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><Send size={18} /> Enviar para Aprovação Técnica</>
        )}
      </button>

      {validos.length < minCot && (
        <p className="text-xs text-amber-600 text-center">
          Adicione pelo menos {minCot} fornecedor{minCot > 1 ? 'es' : ''} com nome e valor preenchidos.
        </p>
      )}

      {submitMutation.isSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-emerald-700 text-sm font-semibold">
          <CheckCircle size={16} /> Cotação enviada para aprovação!
        </div>
      )}

      {submitMutation.isError && (
        <p className="text-red-500 text-sm text-center">Erro ao enviar. Tente novamente.</p>
      )}
    </form>
  )
}
