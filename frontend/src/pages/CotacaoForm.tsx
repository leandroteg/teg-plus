import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, PlusCircle, Trash2, Send, CheckCircle, Award } from 'lucide-react'
import { useCotacao, useSubmeterCotacao } from '../hooks/useCotacoes'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface FornecedorForm {
  fornecedor_nome: string
  fornecedor_contato: string
  fornecedor_cnpj: string
  valor_total: number
  prazo_entrega_dias: number
  condicao_pagamento: string
  observacao: string
}

const emptyFornecedor = (): FornecedorForm => ({
  fornecedor_nome: '', fornecedor_contato: '', fornecedor_cnpj: '',
  valor_total: 0, prazo_entrega_dias: 0, condicao_pagamento: '', observacao: '',
})

export default function CotacaoForm() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { data: cotacao, isLoading } = useCotacao(id)
  const submitMutation = useSubmeterCotacao()

  const [fornecedores, setFornecedores] = useState<FornecedorForm[]>([
    emptyFornecedor(), emptyFornecedor(), emptyFornecedor(),
  ])

  const updateFornecedor = (idx: number, field: keyof FornecedorForm, value: string | number) => {
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  const menorPreco = fornecedores
    .filter(f => f.valor_total > 0)
    .sort((a, b) => a.valor_total - b.valor_total)[0]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    const valid = fornecedores.filter(f => f.fornecedor_nome && f.valor_total > 0)
    if (valid.length < 2) return

    try {
      await submitMutation.mutateAsync({
        cotacao_id: id,
        fornecedores: valid.map(f => ({
          ...f,
          itens_precos: [],
        })),
      })
      nav('/cotacoes')
    } catch {
      // error handled
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Show existing completed cotacao
  if (cotacao?.status === 'concluida' && cotacao.fornecedores) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => nav('/cotacoes')} className="p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-bold text-gray-800">Cotacao Concluida</h2>
        </div>

        {/* Requisicao info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold">{cotacao.requisicao?.numero}</p>
          <p className="text-xs text-gray-500">{cotacao.requisicao?.descricao}</p>
          <p className="text-xs text-gray-400 mt-1">{cotacao.requisicao?.obra_nome}</p>
        </div>

        {/* Comparativo */}
        <div className="space-y-2">
          {cotacao.fornecedores.map((f, idx) => (
            <div
              key={f.id || idx}
              className={`bg-white rounded-xl border p-4 ${
                f.selecionado ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    {f.selecionado && <Award className="w-4 h-4 text-emerald-500" />}
                    {f.fornecedor_nome}
                  </p>
                  {f.fornecedor_contato && (
                    <p className="text-xs text-gray-400">{f.fornecedor_contato}</p>
                  )}
                </div>
                <span className={`text-sm font-bold ${f.selecionado ? 'text-emerald-600' : 'text-gray-700'}`}>
                  {fmt(f.valor_total)}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                {f.prazo_entrega_dias && <span>Prazo: {f.prazo_entrega_dias} dias</span>}
                {f.condicao_pagamento && <span>Pgto: {f.condicao_pagamento}</span>}
              </div>
              {f.selecionado && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" /> Selecionado - Menor preco
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Form for new cotacao
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => nav('/cotacoes')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">Enviar Cotacao</h2>
      </div>

      {/* Requisicao info */}
      {cotacao?.requisicao && (
        <div className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <p className="text-sm font-semibold text-violet-800">{cotacao.requisicao.numero}</p>
          <p className="text-xs text-violet-600">{cotacao.requisicao.descricao}</p>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-violet-500">{cotacao.requisicao.obra_nome}</span>
            <span className="text-xs font-bold text-violet-700">{fmt(cotacao.requisicao.valor_estimado)}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Informe pelo menos 2 fornecedores. O sistema selecionara automaticamente o menor preco.
      </p>

      {/* Fornecedores */}
      {fornecedores.map((forn, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-600">Fornecedor {idx + 1}</span>
            {fornecedores.length > 2 && (
              <button type="button" onClick={() => setFornecedores(p => p.filter((_, i) => i !== idx))}>
                <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-500 transition" />
              </button>
            )}
          </div>

          <input
            required={idx < 2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Nome do fornecedor"
            value={forn.fornecedor_nome}
            onChange={e => updateFornecedor(idx, 'fornecedor_nome', e.target.value)}
          />
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Contato (tel/email)"
            value={forn.fornecedor_contato}
            onChange={e => updateFornecedor(idx, 'fornecedor_contato', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400">Valor Total (R$)</label>
              <input
                required={idx < 2}
                type="number" min="0.01" step="0.01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={forn.valor_total || ''}
                onChange={e => updateFornecedor(idx, 'valor_total', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Prazo (dias)</label>
              <input
                type="number" min="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={forn.prazo_entrega_dias || ''}
                onChange={e => updateFornecedor(idx, 'prazo_entrega_dias', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Condicao de pagamento"
            value={forn.condicao_pagamento}
            onChange={e => updateFornecedor(idx, 'condicao_pagamento', e.target.value)}
          />

          {/* Menor preco badge */}
          {menorPreco && forn.valor_total > 0 && forn.valor_total === menorPreco.valor_total && forn.fornecedor_nome === menorPreco.fornecedor_nome && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Award className="w-3.5 h-3.5" /> Menor preco
            </div>
          )}
        </div>
      ))}

      {/* Add more */}
      <button
        type="button"
        onClick={() => setFornecedores(p => [...p, emptyFornecedor()])}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-violet-600 border border-dashed border-violet-300 rounded-xl hover:bg-violet-50 transition"
      >
        <PlusCircle className="w-3.5 h-3.5" /> Adicionar Fornecedor
      </button>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitMutation.isPending}
        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-200 active:scale-[0.98] transition-all"
      >
        {submitMutation.isPending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><Send className="w-4 h-4" /> Enviar Cotacao</>
        )}
      </button>

      {submitMutation.isError && (
        <p className="text-red-500 text-sm text-center">Erro ao enviar. Tente novamente.</p>
      )}
    </form>
  )
}
