// CotacaoComparativo.tsx — Tabela comparativa de fornecedores (cotação)
import { useCallback } from 'react'
import { Check, Trophy, FileText, ExternalLink } from 'lucide-react'
import type { CotacaoFornecedor } from '../types'
import { supabase } from '../services/supabase'

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  fornecedores: CotacaoFornecedor[]
  onSelect?: (id: string) => void
  readOnly?: boolean
}

export default function CotacaoComparativo({ fornecedores, onSelect, readOnly = false }: Props) {
  const viewFile = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('cotacoes-docs').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }, [])

  if (fornecedores.length === 0) return null

  // Menor valor total → badge de destaque
  const minValor = Math.min(...fornecedores.map(f => f.valor_total))

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <Trophy size={14} className="text-amber-500" />
        <span className="text-xs font-bold text-slate-700">Comparativo de Fornecedores</span>
        <span className="ml-auto text-[11px] text-slate-400">{fornecedores.length} proposta{fornecedores.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabela: mobile → cards empilhados; desktop → tabela */}

      {/* Mobile: cards */}
      <div className="sm:hidden divide-y divide-slate-100">
        {fornecedores.map((f) => {
          const isBest = f.valor_total === minValor
          const isSelected = f.selecionado

          return (
            <div
              key={f.id}
              className={`p-4 ${isSelected ? 'bg-teal-50' : 'bg-white'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-slate-800 text-sm">{f.fornecedor_nome}</p>
                    {isBest && (
                      <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <Trophy size={9} />
                        Menor preço
                      </span>
                    )}
                    {isSelected && (
                      <span className="inline-flex items-center gap-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <Check size={9} />
                        Selecionado
                      </span>
                    )}
                  </div>
                  {f.fornecedor_cnpj && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{f.fornecedor_cnpj}</p>
                  )}
                </div>
                <p className={`text-base font-black flex-shrink-0 ${isBest ? 'text-teal-600' : 'text-slate-700'}`}>
                  {formatBRL(f.valor_total)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 mb-3">
                {f.prazo_entrega_dias != null && (
                  <div><span className="text-slate-400">Prazo:</span> <strong>{f.prazo_entrega_dias} dias</strong></div>
                )}
                {f.condicao_pagamento && (
                  <div><span className="text-slate-400">Pgto:</span> <strong>{f.condicao_pagamento}</strong></div>
                )}
                {f.fornecedor_contato && (
                  <div className="col-span-2"><span className="text-slate-400">Contato:</span> {f.fornecedor_contato}</div>
                )}
                {f.arquivo_url && (
                  <button
                    onClick={(e) => { e.stopPropagation(); viewFile(f.arquivo_url!) }}
                    className="col-span-2 flex items-center gap-1.5 text-violet-600 hover:text-violet-800 font-semibold transition"
                  >
                    <FileText size={12} />
                    <span>Ver cotação anexa</span>
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>

              {!readOnly && onSelect && !isSelected && (
                <button
                  onClick={() => onSelect(f.id)}
                  className="w-full py-2 rounded-xl text-xs font-bold border-2 border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white transition-all"
                >
                  Selecionar
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wide bg-slate-50/60">
              <th className="px-4 py-2.5">Fornecedor</th>
              <th className="px-4 py-2.5 text-right">Valor Total</th>
              <th className="px-4 py-2.5 text-center">Prazo</th>
              <th className="px-4 py-2.5">Pagamento</th>
              <th className="px-4 py-2.5 text-center">Anexo</th>
              {!readOnly && onSelect && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fornecedores.map((f) => {
              const isBest = f.valor_total === minValor
              const isSelected = f.selecionado

              return (
                <tr
                  key={f.id}
                  className={`
                    transition-colors
                    ${isSelected ? 'bg-teal-50' : 'bg-white hover:bg-slate-50/60'}
                  `}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800">{f.fornecedor_nome}</span>
                      {isBest && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          <Trophy size={9} />
                          Menor preço
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          <Check size={9} />
                          Selecionado
                        </span>
                      )}
                    </div>
                    {f.fornecedor_cnpj && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{f.fornecedor_cnpj}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-black text-base ${isBest ? 'text-teal-600' : 'text-slate-700'}`}>
                      {formatBRL(f.valor_total)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {f.prazo_entrega_dias != null
                      ? <span className="font-semibold text-slate-700">{f.prazo_entrega_dias}d</span>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-[12px]">
                    {f.condicao_pagamento ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {f.arquivo_url ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); viewFile(f.arquivo_url!) }}
                        className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold transition"
                        title="Abrir cotação"
                      >
                        <FileText size={13} />
                        <ExternalLink size={10} />
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {!readOnly && onSelect && (
                    <td className="px-4 py-3 text-right">
                      {isSelected ? (
                        <span className="text-[11px] text-teal-600 font-bold flex items-center gap-1 justify-end">
                          <Check size={12} /> Selecionado
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelect(f.id)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-teal-500 text-teal-600 hover:bg-teal-500 hover:text-white transition-all"
                        >
                          Selecionar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
