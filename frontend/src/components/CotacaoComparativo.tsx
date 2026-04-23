// CotacaoComparativo.tsx — Comparativo de fornecedores (total + matriz por item)
import { useCallback, useMemo } from 'react'
import { Check, Trophy, FileText, ExternalLink, Package, Sparkles } from 'lucide-react'
import type { CotacaoFornecedor, ItemSelecionado } from '../types'
import { supabase } from '../services/supabase'
import { calcularRecomendacao } from '../utils/cotacaoRecomendacao'
import { getFornecedorEmail, getFornecedorTelefone } from '../utils/fornecedorContato'

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  fornecedores: CotacaoFornecedor[]
  onSelect?: (id: string) => void
  readOnly?: boolean
  /** Itens aprovados parcialmente (vindos do AprovAi) */
  itensSelecionados?: ItemSelecionado[]
  /** Callback: clique numa célula item x fornecedor (modo sele\u00e7\u00e3o por item).
   *  Quando definido, o componente fica interativo: cada item pode ser atribu\u00eddo
   *  a um fornecedor. Passa a descri\u00e7\u00e3o do item + id do fornecedor. */
  onSelectItem?: (itemDescricao: string, fornecedorId: string) => void
  /** Mapa atual de sele\u00e7\u00e3o por item (descricao normalizada -> fornecedor_id).
   *  Quando presente, destaca a c\u00e9lula selecionada em verde. */
  selecaoPorItem?: Map<string, string>
}

// Normaliza descricao para matching entre fornecedores
const normalizeKey = (s: string) => s.toLowerCase().trim()

export default function CotacaoComparativo({ fornecedores, onSelect, readOnly = false, itensSelecionados, onSelectItem, selecaoPorItem }: Props) {
  const viewFile = useCallback(async (path: string) => {
    const { data } = await supabase.storage.from('cotacoes-docs').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }, [])

  const recomendacao = useMemo(() => calcularRecomendacao(fornecedores), [fornecedores])
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    recomendacao?.scores.forEach(s => m.set(s.id, s.score))
    return m
  }, [recomendacao])

  if (fornecedores.length === 0) return null

  const minValor = Math.min(...fornecedores.map(f => f.valor_total))

  // ── Verificar se algum fornecedor tem itens ──────────────────────────────────
  const temItens = fornecedores.some(f => f.itens_precos?.length > 0)

  // ── Montar matriz de itens ────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const matrizItens = useMemo(() => {
    if (!temItens) return []
    // Unificar todos os itens por descricao normalizada
    const keyMap = new Map<string, string>() // normalKey -> display label
    for (const f of fornecedores) {
      for (const it of f.itens_precos ?? []) {
        const key = normalizeKey(it.descricao)
        if (!keyMap.has(key)) keyMap.set(key, it.descricao)
      }
    }
    // Para cada item: preco por fornecedor
    return Array.from(keyMap.entries()).map(([key, label]) => {
      const precos = fornecedores.map(f => {
        const item = f.itens_precos?.find(it => normalizeKey(it.descricao) === key)
        return item ?? null
      })
      const valoresValidos = precos.filter(Boolean).map(p => p!.valor_total)
      const minItemValor = valoresValidos.length > 0 ? Math.min(...valoresValidos) : null
      return { key, label, precos, minItemValor }
    })
  }, [fornecedores, temItens])

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
        <Trophy size={14} className="text-amber-500" />
        <span className="text-xs font-bold text-slate-700">Comparativo de Fornecedores</span>
        <span className="ml-auto text-[11px] text-slate-400">
          {fornecedores.length} proposta{fornecedores.length !== 1 ? 's' : ''}
          {temItens && <span className="ml-1 text-teal-500">· por item</span>}
        </span>
      </div>

      {/* ── Matriz por item (quando há itens) ──────────────────────────────────── */}
      {temItens && matrizItens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wide bg-slate-50/80 border-b border-slate-100">
                <th className="px-3 py-2 flex items-center gap-1">
                  <Package size={11} className="text-teal-500" /> Item
                </th>
                {fornecedores.map(f => (
                  <th key={f.id} className="px-3 py-2 text-right">
                    <span className="truncate max-w-[120px] block">{f.fornecedor_nome}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matrizItens.map(({ key, label, precos, minItemValor }) => (
                <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2 text-slate-700 font-medium max-w-[180px]">
                    <span className="line-clamp-2 leading-tight">{label}</span>
                  </td>
                  {precos.map((p, fi) => {
                    const forn = fornecedores[fi]
                    const isBestItem = p && minItemValor !== null && p.valor_total === minItemValor
                    const isPartialSel = itensSelecionados?.some(
                      it => normalizeKey(it.descricao) === key && it.fornecedor_id === forn.id
                    )
                    const isItemSelecionado = selecaoPorItem?.get(key) === forn.id
                    const isInteractive = Boolean(onSelectItem && !readOnly && p)
                    const handleClick = () => {
                      if (isInteractive && p) onSelectItem!(label, forn.id)
                    }
                    return (
                      <td key={fi} className="px-3 py-2 text-right">
                        {p ? (
                          <div
                            role={isInteractive ? 'button' : undefined}
                            tabIndex={isInteractive ? 0 : undefined}
                            onClick={isInteractive ? handleClick : undefined}
                            onKeyDown={isInteractive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } } : undefined}
                            className={`inline-flex flex-col items-end gap-0.5 rounded-lg px-1.5 py-0.5 transition-all ${
                              isItemSelecionado ? 'bg-teal-50 border-2 border-teal-500 shadow-sm' :
                              isPartialSel      ? 'bg-emerald-50 border border-emerald-200' :
                              isBestItem        ? 'bg-amber-50'  : ''
                            } ${
                              isInteractive
                                ? (isItemSelecionado
                                    ? 'cursor-pointer'
                                    : 'cursor-pointer hover:bg-teal-50 hover:ring-2 hover:ring-teal-300')
                                : ''
                            }`}
                          >
                            <span className={`font-bold ${
                              isItemSelecionado ? 'text-teal-700' :
                              isPartialSel      ? 'text-emerald-700' :
                              isBestItem        ? 'text-teal-600'   : 'text-slate-700'
                            }`}>
                              {formatBRL(p.valor_total)}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {p.qtd} × {formatBRL(p.valor_unitario)}
                            </span>
                            {isItemSelecionado && (
                              <span className="text-[9px] font-bold text-teal-600 flex items-center gap-0.5">
                                <Check size={8} /> escolhido
                              </span>
                            )}
                            {!isItemSelecionado && isBestItem && !isPartialSel && (
                              <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                                <Trophy size={8} /> menor
                              </span>
                            )}
                            {!isItemSelecionado && isPartialSel && (
                              <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                                <Check size={8} /> aprovado
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-200 text-[11px]">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            {/* Totais */}
            <tfoot>
              {/* Sub-total escolhido (quando h\u00e1 sele\u00e7\u00e3o por item) */}
              {selecaoPorItem && selecaoPorItem.size > 0 && (
                <tr className="border-t border-teal-200 bg-teal-50/40">
                  <td className="px-3 py-2 text-[10px] font-bold text-teal-700 uppercase tracking-wider">Escolhido</td>
                  {fornecedores.map(f => {
                    const itensDoForn = matrizItens.filter(m => selecaoPorItem.get(m.key) === f.id)
                    const totalEscolhido = itensDoForn.reduce((sum, m) => {
                      const preco = m.precos[fornecedores.indexOf(f)]
                      return sum + (preco?.valor_total ?? 0)
                    }, 0)
                    const qtdItens = itensDoForn.length
                    return (
                      <td key={f.id} className="px-3 py-2 text-right">
                        {qtdItens > 0 ? (
                          <>
                            <span className="font-extrabold text-sm text-teal-700">
                              {formatBRL(totalEscolhido)}
                            </span>
                            <div className="text-[9px] font-semibold text-teal-600 mt-0.5">
                              {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )}

              {/* Total geral (todos os itens do fornecedor) */}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-3 py-2 text-xs font-bold text-slate-600 uppercase">Total da proposta</td>
                {fornecedores.map(f => {
                  const isBest = f.valor_total === minValor
                  const isSelected = f.selecionado
                  return (
                    <td key={f.id} className="px-3 py-2 text-right">
                      <span className={`font-extrabold text-sm ${
                        isSelected ? 'text-teal-600' : isBest ? 'text-teal-500' : 'text-slate-600'
                      }`}>
                        {formatBRL(f.valor_total)}
                      </span>
                      <div className="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                        {isSelected && (
                          <span className="text-[9px] font-bold text-teal-600 flex items-center gap-0.5">
                            <Check size={8} /> Selecionado
                          </span>
                        )}
                        {!isSelected && isBest && (
                          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Trophy size={8} /> Menor preco
                          </span>
                        )}
                        {recomendacao?.recomendadoId === f.id && (
                          <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-0.5">
                            <Sparkles size={8} /> Recomendado
                          </span>
                        )}
                        {scoreMap.has(f.id) && (
                          <span className="text-[9px] font-medium text-slate-400">
                            {scoreMap.get(f.id)}pts
                          </span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Vista total (sem itens ou como complemento) ─────────────────────── */}
      {!temItens && (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {fornecedores.map((f) => {
              const isBest = f.valor_total === minValor
              const isSelected = f.selecionado
              return (
                <div key={f.id} className={`p-4 ${isSelected ? 'bg-teal-50' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800 text-sm">{f.fornecedor_nome}</p>
                        {isBest && (
                          <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <Trophy size={9} /> Menor preço
                          </span>
                        )}
                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <Check size={9} /> Selecionado
                          </span>
                        )}
                        {recomendacao?.recomendadoId === f.id && (
                          <span className="inline-flex items-center gap-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            <Sparkles size={9} /> Recomendado
                          </span>
                        )}
                      </div>
                      {f.fornecedor_cnpj && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{f.fornecedor_cnpj}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-base font-black ${isBest ? 'text-teal-600' : 'text-slate-700'}`}>
                        {formatBRL(f.valor_total)}
                      </p>
                      {scoreMap.has(f.id) && (
                        <p className="text-[10px] text-slate-400 font-semibold">{scoreMap.get(f.id)} pts</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 mb-3">
                    {f.prazo_entrega_dias != null && (
                      <div><span className="text-slate-400">Prazo:</span> <strong>{f.prazo_entrega_dias} dias</strong></div>
                    )}
                    {f.condicao_pagamento && (
                      <div><span className="text-slate-400">Pgto:</span> <strong>{f.condicao_pagamento}</strong></div>
                    )}
                    {getFornecedorTelefone(f) && (
                      <div><span className="text-slate-400">Tel:</span> {getFornecedorTelefone(f)}</div>
                    )}
                    {getFornecedorEmail(f) && (
                      <div><span className="text-slate-400">E-mail:</span> {getFornecedorEmail(f)}</div>
                    )}
                    {f.arquivo_url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); viewFile(f.arquivo_url!) }}
                        className="col-span-2 flex items-center gap-1.5 text-violet-600 hover:text-violet-800 font-semibold transition"
                      >
                        <FileText size={12} /><span>Ver cotação anexa</span><ExternalLink size={10} />
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
                    <tr key={f.id} className={`transition-colors ${isSelected ? 'bg-teal-50' : 'bg-white hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{f.fornecedor_nome}</span>
                          {isBest && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              <Trophy size={9} /> Menor preço
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center gap-0.5 bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              <Check size={9} /> Selecionado
                            </span>
                          )}
                          {recomendacao?.recomendadoId === f.id && (
                            <span className="inline-flex items-center gap-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              <Sparkles size={9} /> Recomendado
                            </span>
                          )}
                        </div>
                        {f.fornecedor_cnpj && (
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{f.fornecedor_cnpj}</p>
                        )}
                        {(getFornecedorTelefone(f) || getFornecedorEmail(f)) && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            {[getFornecedorTelefone(f), getFornecedorEmail(f)].filter(Boolean).join(' | ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-black text-base ${isBest ? 'text-teal-600' : 'text-slate-700'}`}>
                          {formatBRL(f.valor_total)}
                        </span>
                        {scoreMap.has(f.id) && (
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{scoreMap.get(f.id)} pts</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {f.prazo_entrega_dias != null
                          ? <span className="font-semibold text-slate-700">{f.prazo_entrega_dias}d</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[12px]">
                        {f.condicao_pagamento ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {f.arquivo_url ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); viewFile(f.arquivo_url!) }}
                            className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold transition"
                          >
                            <FileText size={13} /><ExternalLink size={10} />
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
        </>
      )}

      {/* Card de recomendação */}
      {recomendacao && fornecedores.length >= 2 && (
        <div className="mx-4 mb-4 mt-2 flex items-start gap-2.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2.5">
          <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-indigo-800">{recomendacao.resumo}</p>
            <p className="text-[10px] text-indigo-500 mt-0.5">
              Score: {recomendacao.scores.map(s => `${s.nome} ${s.score}pts`).join(' · ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
