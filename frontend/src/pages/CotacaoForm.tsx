import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, PlusCircle, Trash2, Send, CheckCircle, Info, AlertTriangle,
  Paperclip, FileText, X, Loader2, Eye, Ban, CheckCircle2, PackagePlus,
  ScrollText, Undo2,
} from 'lucide-react'
import { useCotacao, useFinalizarCotacao, useDevolverRequisicaoCotacao } from '../hooks/useCotacoes'
import { useCategorias } from '../hooks/useCategorias'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useAuth } from '../contexts/AuthContext'
import { useEditorLock } from '../hooks/useEditorLock'
import type { Cotacao, ItemPreco } from '../types'
import CotacaoComparativo from '../components/CotacaoComparativo'
import FluxoTimeline from '../components/FluxoTimeline'
import UploadCotacao from '../components/UploadCotacao'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import type { CnpjResult } from '../services/api'
import NumericInput from '../components/NumericInput'
import { minCotacoesPorValor } from '../utils/cotacoesPolicy'
import { toUpperNorm, UpperTextarea } from '../components/UpperInput'
import { joinFornecedorContato, splitFornecedorContato } from '../utils/fornecedorContato'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FILE_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const FILE_MAX_SIZE = 50 * 1024 * 1024

interface FornecedorForm {
  fornecedor_nome:    string
  fornecedor_contato: string
  fornecedor_telefone: string
  fornecedor_email: string
  fornecedor_cnpj:    string
  valor_total:        number
  prazo_entrega_dias: number
  condicao_pagamento: string
  observacao:         string
  arquivo_url:        string
  itens_precos:       ItemPreco[]
}

const emptyFornecedor = (): FornecedorForm => ({
  fornecedor_nome: '', fornecedor_contato: '', fornecedor_telefone: '', fornecedor_email: '', fornecedor_cnpj: '',
  valor_total: 0, prazo_entrega_dias: 0, condicao_pagamento: '', observacao: '',
  arquivo_url: '', itens_precos: [],
})

const calcTotalItems = (itens: ItemPreco[]) =>
  Math.round(itens.reduce((s, i) => s + i.valor_total, 0) * 100) / 100

// ── Tabela de itens e preços por fornecedor ──────────────────────────────────
type ReqItem = { id: string; descricao: string; quantidade: number; unidade: string; valor_unitario_estimado: number }

function ItemPricingTable({
  items,
  onChange,
  reqItens = [],
}: {
  items: ItemPreco[]
  onChange: (items: ItemPreco[]) => void
  reqItens?: ReqItem[]
}) {
  const [itemResults, setItemResults] = useState<Record<number, any[]>>({})
  const [itemOpen, setItemOpen] = useState<Record<number, boolean>>({})
  const [itemQuery, setItemQuery] = useState<Record<number, string>>({})
  const itemTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // Itens da requisição que ainda não foram adicionados
  const usedDescs = new Set(items.map(it => it.descricao.toLowerCase().trim()).filter(Boolean))
  const availableReqItens = reqItens.filter(ri => !usedDescs.has(ri.descricao.toLowerCase().trim()))

  const canAddItem = availableReqItens.length > 0

  const addItem = () => {
    if (!canAddItem) return
    onChange([...items, { descricao: '', qtd: 1, valor_unitario: 0, valor_total: 0 }])
  }

  const removeItem = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i))
    setItemQuery(prev => { const n = { ...prev }; delete n[i]; return n })
  }

  const updateItem = (i: number, field: keyof ItemPreco, raw: string) => {
    const updated = items.map((item, idx) => {
      if (idx !== i) return item
      const val = parseFloat(raw) || 0
      const next = { ...item, [field]: val }
      if (field === 'qtd' || field === 'valor_unitario') {
        const qtd = field === 'qtd' ? val : item.qtd
        const vu  = field === 'valor_unitario' ? val : item.valor_unitario
        next.valor_total = Math.round(qtd * vu * 100) / 100
      }
      return next
    })
    onChange(updated)
  }

  // Filtra itens da requisição pelo texto digitado
  const filterReqItens = (query: string) => {
    if (!query.trim()) return availableReqItens
    const q = query.toLowerCase()
    return availableReqItens.filter(ri => ri.descricao.toLowerCase().includes(q))
  }

  // Busca/filtragem do autocomplete — só atualiza query local, NÃO escreve em item.descricao.
  // A descrição só é definida via selectItem (picking do dropdown da RC), impedindo que o
  // cotador digite itens fora do escopo aprovado.
  const searchItem = useCallback((i: number, query: string) => {
    const normalizedQuery = toUpperNorm(query)
    setItemQuery(prev => ({ ...prev, [i]: normalizedQuery }))
    if (itemTimerRef.current[i]) clearTimeout(itemTimerRef.current[i])

    const reqMatches = filterReqItens(normalizedQuery)
    setItemResults(prev => ({ ...prev, [i]: reqMatches.map(ri => ({ ...ri, _fromReq: true })) }))
    setItemOpen(prev => ({ ...prev, [i]: reqMatches.length > 0 }))
  }, [availableReqItens])

  const clearItemDescricao = (i: number) => {
    onChange(items.map((item, idx) => idx === i ? { ...item, descricao: '' } : item))
    setItemQuery(prev => ({ ...prev, [i]: '' }))
  }

  const selectItem = useCallback((i: number, est: any) => {
    onChange(items.map((item, idx) => {
      if (idx !== i) return item
      if (est._fromReq) {
        // Item da requisição: usa quantidade e valor estimado
        const qtd = est.quantidade || item.qtd
        const vu = est.valor_unitario_estimado || 0
        return {
          ...item,
          descricao: est.descricao,
          qtd,
          valor_unitario: vu,
          valor_total: Math.round(qtd * vu * 100) / 100,
        }
      }
      // Item do estoque
      const vu = est.valor_medio || 0
      return {
        ...item,
        descricao: est.descricao,
        valor_unitario: vu,
        valor_total: Math.round(item.qtd * vu * 100) / 100,
      }
    }))
    setItemOpen(prev => ({ ...prev, [i]: false }))
  }, [items, onChange])

  // Close dropdowns when items array shrinks
  useEffect(() => {
    setItemResults({})
    setItemOpen({})
  }, [items.length])

  const total = calcTotalItems(items)
  const fmtLocal = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          <PackagePlus size={11} /> Itens e Preços
        </span>
        {items.length > 0 && (
          <span className="text-[10px] text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
          {/* Header */}
          <div className="grid grid-cols-[1fr_44px_80px_68px_24px] gap-1 px-2 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
            <span>Descrição</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">R$/un</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {items.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_44px_80px_68px_24px] gap-1 px-2 py-1.5 border-b border-slate-50 last:border-0 items-center"
            >
              <div className="relative flex items-center gap-1">
                <input
                  className={`text-[11px] border rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-teal-300 w-full ${
                    item.descricao ? 'bg-teal-50/60 border-teal-200 text-slate-700 cursor-default' : 'bg-white border-slate-200'
                  }`}
                  placeholder="Selecione um item da RC..."
                  autoComplete="off"
                  readOnly={!!item.descricao}
                  value={item.descricao || (itemQuery[i] ?? '')}
                  onChange={e => searchItem(i, e.target.value)}
                  onFocus={() => {
                    if (item.descricao) return
                    const reqMatches = filterReqItens(itemQuery[i] ?? '')
                    setItemResults(prev => ({ ...prev, [i]: reqMatches.map(ri => ({ ...ri, _fromReq: true })) }))
                    setItemOpen(prev => ({ ...prev, [i]: reqMatches.length > 0 }))
                  }}
                  onBlur={() => setTimeout(() => setItemOpen(prev => ({ ...prev, [i]: false })), 150)}
                />
                {item.descricao && (
                  <button
                    type="button"
                    onClick={() => clearItemDescricao(i)}
                    title="Limpar seleção"
                    className="flex-shrink-0 text-slate-300 hover:text-rose-500 transition"
                  >
                    <X size={11} />
                  </button>
                )}
                {itemOpen[i] && !item.descricao && (itemResults[i]?.length ?? 0) > 0 && (
                  <div className="absolute z-50 left-0 w-72 mt-0.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {itemResults[i].map((est: any, ri: number) => (
                      <button
                        key={est.id || `req-${ri}`}
                        type="button"
                        className={`w-full text-left px-2.5 py-2 transition-colors border-b border-slate-100 last:border-0 ${
                          est._fromReq ? 'hover:bg-amber-50 bg-amber-50/30' : 'hover:bg-teal-50'
                        }`}
                        onMouseDown={() => selectItem(i, est)}
                      >
                        <p className="text-[11px] font-semibold text-slate-800 truncate">
                          {est._fromReq && <span className="text-[9px] font-bold text-amber-600 mr-1">REQUISIÇÃO</span>}
                          {est.descricao}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {est._fromReq
                            ? `${est.quantidade} ${est.unidade || 'un'}${est.valor_unitario_estimado ? ` · ${est.valor_unitario_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/un` : ''}`
                            : `${est.codigo} · ${est.unidade}${est.valor_medio ? ` · ${est.valor_medio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`
                          }
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number" min="0.001" step="any"
                className="text-[11px] bg-white border border-slate-200 rounded px-1 py-1 text-center outline-none focus:ring-1 focus:ring-teal-300 w-full"
                value={item.qtd || ''}
                onChange={e => updateItem(i, 'qtd', e.target.value)}
              />
              <input
                type="number" min="0" step="0.01"
                className="text-[11px] bg-white border border-slate-200 rounded px-1 py-1 text-right outline-none focus:ring-1 focus:ring-teal-300 w-full"
                value={item.valor_unitario || ''}
                onChange={e => updateItem(i, 'valor_unitario', e.target.value)}
              />
              <span className="text-[11px] font-semibold text-slate-700 text-right pr-0.5">
                {fmtLocal(item.valor_total)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="flex items-center justify-center text-slate-300 hover:text-red-500 transition"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Total row */}
          <div className="flex justify-between items-center px-2 py-1.5 bg-teal-50 border-t border-teal-100">
            <span className="text-[10px] font-bold text-teal-600 uppercase">Total calculado</span>
            <span className="text-sm font-extrabold text-teal-600">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={addItem}
        disabled={!canAddItem}
        title={!canAddItem ? 'Todos os itens da RC já foram adicionados. Para alterar escopo, devolva ao solicitante.' : undefined}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold border border-dashed rounded-xl transition ${
          canAddItem
            ? 'text-teal-600 border-teal-200 hover:bg-teal-50'
            : 'text-slate-300 border-slate-200 cursor-not-allowed'
        }`}
      >
        <PlusCircle size={12} />
        {items.length === 0 ? 'Precificar por item (opcional)' : 'Adicionar item'}
      </button>
      {!canAddItem && items.length > 0 && reqItens.length > 0 && (
        <p className="text-[10px] text-slate-400 text-center mt-1">
          Todos os itens da RC já foram adicionados. Se precisa alterar o escopo,
          use <strong className="text-rose-500">Devolver ao Solicitante</strong>.
        </p>
      )}
      {items.some(it => !it.descricao.trim()) && (
        <p className="text-[10px] text-rose-500 text-center mt-1 font-semibold">
          Existe item sem descrição selecionada da RC. Escolha um item do dropdown ou remova a linha.
        </p>
      )}
    </div>
  )
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
  const { atLeast, perfil } = useAuth()
  const emitirMutation = useEmitirPedido()
  const cancelarMutation = useCancelarRequisicao()
  const [pedidoToast, setPedidoToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showEmitirModal, setShowEmitirModal] = useState(false)
  const [solicitandoContrato, setSolicitandoContrato] = useState(false)

  const { data: categorias = [] } = useCategorias()
  const req = cotacao.requisicao
  const canEmitPedido = atLeast('comprador') && req?.status === 'cotacao_aprovada'
  const isRecorrente = (req as any)?.compra_recorrente === true
  const valorReq = cotacao.valor_selecionado ?? (req as any)?.valor_estimado ?? 0
  const categoriaTipo = categorias.find(c => c.codigo === (req as any)?.categoria)?.tipo
  const isServico = categoriaTipo === 'servico'
  const deveContrato = isRecorrente || (isServico && valorReq > 2000)

  // ── Solicitar Contrato (compra recorrente) ───────────────────────────────
  const handleSolicitarContrato = async () => {
    if (!req || !perfil) return
    setSolicitandoContrato(true)
    try {
      // Generate numero: SOL-CON-YYYY-NNN
      const year = new Date().getFullYear()
      const prefix = `SOL-CON-${year}-`
      const { count } = await supabase
        .from('con_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .like('numero', `${prefix}%`)
      const seq = String((count ?? 0) + 1).padStart(3, '0')
      const numero = `${prefix}${seq}`

      const { error: insertErr } = await supabase
        .from('con_solicitacoes')
        .insert({
          numero,
          objeto: req.descricao,
          categoria_contrato: 'prestacao_servico',
          grupo_contrato: 'prestacao_servicos',
          tipo_contrato: 'despesa',
          tipo_contraparte: 'fornecedor',
          contraparte_nome: cotacao.fornecedor_selecionado_nome ?? 'A definir',
          obra_id: (req as any).obra_id ?? null,
          valor_estimado: cotacao.valor_selecionado ?? req.valor_estimado ?? 0,
          solicitante_id: perfil.id,
          solicitante_nome: perfil.nome,
          etapa_atual: 'solicitacao',
          status: 'em_andamento',
          requisicao_origem_id: req.id,
          urgencia: 'normal',
          documentos_ref: [],
        })
      if (insertErr) throw insertErr

      // Update requisição status
      const { error: updErr } = await supabase
        .from('cmp_requisicoes')
        .update({ status: 'aguardando_contrato' })
        .eq('id', req.id)
      if (updErr) throw updErr

      setPedidoToast({ type: 'success', msg: 'Solicitação de contrato criada com sucesso' })
      setTimeout(() => nav('/contratos/solicitacoes'), 2000)
    } catch (err: any) {
      setPedidoToast({ type: 'error', msg: `Erro ao solicitar contrato: ${err?.message || 'erro desconhecido'}` })
      setTimeout(() => setPedidoToast(null), 5000)
    } finally {
      setSolicitandoContrato(false)
    }
  }

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
        <p className="text-sm font-bold text-slate-800">{req?.justificativa || req?.descricao}</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-slate-400">{req?.obra_nome}</p>
          <p className="text-sm font-extrabold text-teal-600">{fmt(cotacao.valor_selecionado ?? req?.valor_estimado ?? 0)}</p>
        </div>
      </div>

      {/* Timeline */}
      {req && <FluxoTimeline status={req.status ?? 'cotacao_aprovada'} />}

      {/* Comparativo */}
      {cotacao.fornecedores && <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />}

      {/* ── Emitir Pedido / Solicitar Contrato / Cancelar ────────────── */}
      {canEmitPedido && (
        <div className={`bg-white rounded-2xl border-2 ${deveContrato ? 'border-indigo-200' : 'border-teal-200'} shadow-sm overflow-hidden`}>
          <div className={`${deveContrato ? 'bg-indigo-50' : 'bg-teal-50'} px-4 py-3 border-b ${deveContrato ? 'border-indigo-100' : 'border-teal-100'}`}>
            <p className={`text-xs font-bold ${deveContrato ? 'text-indigo-700' : 'text-teal-700'} uppercase tracking-wider flex items-center gap-2`}>
              {deveContrato ? <ScrollText size={14} /> : <FileText size={14} />}
              {deveContrato ? 'Próximo Passo — Solicitação de Contrato' : 'Próximo Passo — Emissão de Pedido'}
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
                  disabled={cancelarMutation.isPending || emitirMutation.isPending || solicitandoContrato}
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

                {deveContrato ? (
                  <button
                    disabled={solicitandoContrato || cancelarMutation.isPending}
                    onClick={handleSolicitarContrato}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                      text-white bg-indigo-500 border-2 border-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20
                      active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {solicitandoContrato
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <ScrollText size={16} />}
                    Solicitar Contrato
                  </button>
                ) : (
                  <button
                    disabled={emitirMutation.isPending || cancelarMutation.isPending}
                    onClick={() => setShowEmitirModal(true)}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold
                      text-white bg-teal-500 border-2 border-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20
                      active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {emitirMutation.isPending
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <FileText size={16} />}
                    Emitir Pedido
                  </button>
                )}
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


      {req && showEmitirModal && (
        <EmitirPedidoModal
          open
          onClose={() => setShowEmitirModal(false)}
          requisicaoId={req.id}
          compraRecorrente={deveContrato}
          onSolicitarContrato={async () => {
            try {
              const num = `SOL-CON-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
              const { error: solErr } = await supabase.from('con_solicitacoes').insert({
                numero: num,
                grupo_contrato: 'prestacao_servicos',
                tipo_contrato: 'despesa',
                obra_id: req.obra_id || null,
                valor_estimado: cotacao.valor_selecionado || req.valor_estimado || 0,
                solicitante_id: perfil?.id || null,
                etapa_atual: 'solicitacao',
                status: 'em_andamento',
                requisicao_origem_id: req.id,
              })
              if (solErr) throw solErr
              await supabase.from('cmp_requisicoes').update({ status: 'aguardando_contrato' }).eq('id', req.id)
              setShowEmitirModal(false)
              setPedidoToast({ type: 'success', msg: `Solicitação de contrato ${num} criada` })
              setTimeout(() => nav('/contratos/solicitacoes'), 1500)
            } catch (err: any) {
              setPedidoToast({ type: 'error', msg: `Erro: ${err?.message || 'falha ao criar solicitação'}` })
            }
          }}
          cotacao={{
            id: cotacao.id,
            fornecedorNome: cotacao.fornecedor_selecionado_nome ?? "N/A",
            valorTotal: cotacao.valor_selecionado ?? req.valor_estimado,
            compradorId: cotacao.comprador_id,
          }}
          onConfirm={(payload) => {
            emitirMutation.mutate({
              requisicaoId: req.id,
              ...payload,
            }, {
              onSuccess: (pedido) => {
                setShowEmitirModal(false)
                setPedidoToast({ type: "success", msg: `${pedido.numero_pedido} emitido` })
              },
              onError: (err: any) => {
                setPedidoToast({ type: "error", msg: `Erro ao emitir pedido: ${err?.message || "erro desconhecido"}` })
                setTimeout(() => setPedidoToast(null), 5000)
              },
            })
          }}
          isSubmitting={emitirMutation.isPending}
        />
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
  const { perfil } = useAuth()
  const { data: cotacao, isLoading } = useCotacao(id)
  const { data: categorias = [] } = useCategorias()
  const submitMutation = useFinalizarCotacao()
  const devolverMutation = useDevolverRequisicaoCotacao()

  // Modal devolver ao solicitante
  const [showDevolverModal, setShowDevolverModal] = useState(false)
  const [motivoDevolucao, setMotivoDevolucao] = useState('')
  const { isLocked, blockedByName } = useEditorLock({
    resourceType: 'cmp_requisicao',
    resourceId: cotacao?.requisicao_id ?? id,
    enabled: Boolean(cotacao?.requisicao_id ?? id),
  })

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

  // ── Fornecedor autocomplete state ─────────────────────────────────────────
  const [fornResults, setFornResults] = useState<Record<number, any[]>>({})
  const [fornOpen, setFornOpen] = useState<Record<number, boolean>>({})
  const searchTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

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
        const nomePreenchido = toUpperNorm(result.razao_social || result.nome_fantasia || '')
        setFornecedores(prev => prev.map((f, i) => {
          if (i !== idx) return f
          const shouldFillTelefone = isCorrection || !f.fornecedor_telefone.trim()
          const shouldFillEmail = isCorrection || !f.fornecedor_email.trim()
          const telefone = shouldFillTelefone ? (result.telefone || '') : f.fornecedor_telefone
          const email = shouldFillEmail ? (result.email || '') : f.fornecedor_email
          return {
            ...f,
            fornecedor_nome: (isCorrection || !f.fornecedor_nome.trim()) ? nomePreenchido : f.fornecedor_nome,
            fornecedor_contato: (isCorrection || !f.fornecedor_contato.trim()) ? joinFornecedorContato(telefone, email, f.fornecedor_contato) : f.fornecedor_contato,
            fornecedor_telefone: telefone,
            fornecedor_email: email,
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
    const digits = raw.replace(/\D/g, '')
    // Reset lastRef when editing (allows re-lookup after correction)
    if (digits.length < 14) {
      cnpjLastRef.current[idx] = ''
    }
    // Auto-lookup when 14 digits reached
    if (digits.length === 14) {
      handleCnpjLookup(idx, raw)
    }
  }, [handleCnpjLookup])

  const updateFornecedor = (idx: number, field: keyof FornecedorForm, value: string | number) => {
    const normalized = typeof value === 'string'
      && field !== 'fornecedor_cnpj'
      && field !== 'fornecedor_contato'
      && field !== 'fornecedor_telefone'
      && field !== 'fornecedor_email'
      ? toUpperNorm(value)
      : value
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, [field]: normalized } : f))
  }

  const searchFornecedor = useCallback((idx: number, query: string) => {
    const normalizedQuery = toUpperNorm(query)
    setFornecedores(prev => prev.map((f, i) => i === idx ? { ...f, fornecedor_nome: normalizedQuery } : f))
    if (searchTimerRef.current[idx]) clearTimeout(searchTimerRef.current[idx])
    if (normalizedQuery.trim().length < 2) {
      setFornResults(prev => ({ ...prev, [idx]: [] }))
      setFornOpen(prev => ({ ...prev, [idx]: false }))
      return
    }
    searchTimerRef.current[idx] = setTimeout(async () => {
      const { data } = await supabase
        .from('cmp_fornecedores')
        .select('id, nome_fantasia, razao_social, cnpj, telefone, email, contato_nome, cidade, uf')
        .or(`nome_fantasia.ilike.%${normalizedQuery}%,razao_social.ilike.%${normalizedQuery}%`)
        .eq('ativo', true)
        .limit(8)
      setFornResults(prev => ({ ...prev, [idx]: data || [] }))
      setFornOpen(prev => ({ ...prev, [idx]: (data?.length ?? 0) > 0 }))
    }, 300)
  }, [])

  const selectFornecedor = useCallback((idx: number, f: any) => {
    const contato = joinFornecedorContato(f.telefone, f.email, f.contato_nome)
    setFornecedores(prev => prev.map((item, i) => i !== idx ? item : {
      ...item,
      fornecedor_nome: toUpperNorm(f.nome_fantasia || f.razao_social || ''),
      fornecedor_cnpj: f.cnpj || '',
      fornecedor_contato: contato,
      fornecedor_telefone: f.telefone || '',
      fornecedor_email: f.email || '',
    }))
    setFornOpen(prev => ({ ...prev, [idx]: false }))
  }, [])

  const updateFornecedorItems = useCallback((idx: number, itens: ItemPreco[]) => {
    setFornecedores(prev => prev.map((f, i) => {
      if (i !== idx) return f
      const total = calcTotalItems(itens)
      return { ...f, itens_precos: itens, valor_total: total > 0 ? total : f.valor_total }
    }))
  }, [])

  // ── Pré-preenche itens da RC em todos os fornecedores ainda vazios ──────────
  useEffect(() => {
    const itens = cotacao?.requisicao?.itens
    if (!itens?.length) return
    const itensPrecos: ItemPreco[] = itens.map(item => ({
      descricao: toUpperNorm(item.descricao),
      qtd: item.quantidade,
      valor_unitario: 0,
      valor_total: 0,
    }))
    setFornecedores(prev =>
      prev.map(f =>
        f.itens_precos.length === 0
          ? { ...f, itens_precos: itensPrecos }
          : f,
      ),
    )
  }, [cotacao?.requisicao?.itens])

  // ── AI Upload: preenche fornecedores automaticamente (incluindo itens) ───────
  const handleAiParsed = useCallback(async (parsed: {
    fornecedor_nome: string
    fornecedor_cnpj?: string
    fornecedor_contato?: string
    fornecedor_telefone?: string
    fornecedor_email?: string
    valor_total: number
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    observacao?: string
    itens?: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
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

    // Itens da RC (normalizados para comparação)
    const rcItens = (cotacao?.requisicao as any)?.itens ?? []
    const rcDescsNorm = new Set<string>(
      rcItens.map((it: any) => toUpperNorm(String(it.descricao ?? '')).trim()).filter(Boolean)
    )
    // Fuzzy match: considera o item como "da RC" se a descricao normalizada
    // contém ou está contida em alguma descricao da RC (≥5 chars em comum)
    const matchesRcItem = (desc: string): string | null => {
      const norm = toUpperNorm(desc).trim()
      if (!norm) return null
      if (rcDescsNorm.has(norm)) return norm
      for (const rcDesc of rcDescsNorm) {
        if (rcDesc.length < 5 || norm.length < 5) continue
        if (norm.includes(rcDesc) || rcDesc.includes(norm)) return rcDesc
      }
      return null
    }

    let itensForaEscopo = 0

    setFornecedores(prev => {
      const vazios      = prev.filter(f => !f.fornecedor_nome.trim() && f.valor_total === 0)
      const preenchidos = prev.filter(f => f.fornecedor_nome.trim() || f.valor_total > 0)

      const novos: FornecedorForm[] = parsed.map(p => {
        // Só inclui itens que têm preço E batem com algum item da RC.
        // Itens fora do escopo são descartados (contagem vai para toast de aviso).
        const itensComValor: ItemPreco[] = (p.itens ?? [])
          .filter(it => it.valor_unitario > 0)
          .map(it => {
            const rcMatch = matchesRcItem(it.descricao)
            if (!rcMatch) {
              itensForaEscopo++
              return null
            }
            return {
              descricao:      rcMatch, // usa a descrição canônica da RC
              qtd:            it.qtd,
              valor_unitario: it.valor_unitario,
              valor_total:    Math.round(it.qtd * it.valor_unitario * 100) / 100,
            }
          })
          .filter((x): x is ItemPreco => x !== null)
        const totalItens = calcTotalItems(itensComValor)
        // Se há itens com preço → usa a soma deles; senão usa o total do documento
        const valorTotal = itensComValor.length > 0 ? totalItens : (p.valor_total || 0)
        const contatoSeparado = splitFornecedorContato(p.fornecedor_contato)
        const telefone = p.fornecedor_telefone || contatoSeparado.telefone
        const email = p.fornecedor_email || contatoSeparado.email
        return {
          fornecedor_nome:    toUpperNorm(p.fornecedor_nome || ''),
          fornecedor_cnpj:    p.fornecedor_cnpj ? maskCNPJ(p.fornecedor_cnpj) : '',
          fornecedor_contato: joinFornecedorContato(telefone, email, p.fornecedor_contato),
          fornecedor_telefone: telefone,
          fornecedor_email:   email,
          valor_total:        valorTotal,
          prazo_entrega_dias: p.prazo_entrega_dias || 0,
          condicao_pagamento: toUpperNorm(p.condicao_pagamento || ''),
          observacao:         toUpperNorm(p.observacao || ''),
          arquivo_url:        uploadedPath,
          itens_precos:       itensComValor,
        }
      })

      const result = [...preenchidos]
      let slotIdx = 0
      for (const novo of novos) {
        if (slotIdx < vazios.length) { result.push(novo); slotIdx++ }
        else result.push(novo)
      }
      while (result.length < 2) result.push(emptyFornecedor())
      return result
    })

    if (itensForaEscopo > 0) {
      setToast({
        type: 'error',
        msg: `${itensForaEscopo} item(ns) do PDF foram ignorados por não pertencerem à RC. Para incluí-los, devolva a requisição ao solicitante.`,
      })
    }
  }, [id, cotacao?.requisicao])

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
      setUploadError(prev => ({ ...prev, [idx]: 'Máximo 50 MB' }))
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
  const categoriaCodigo = ((cotacao?.requisicao as any)?.categoria ?? '') as string
  const categoriaRegra = categorias.find(c => c.codigo === categoriaCodigo)?.cotacoes_regras
  const minCot = minCotacoesPorValor(valorRef, categoriaRegra)

  // Validação + feedback claro em cada etapa
  const canSubmit = validos.length > 0 && (semCotacoesMinimas || validos.length >= minCot) && (!semCotacoesMinimas || justificativa.trim().length > 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)
    setTriedSubmit(true)

    if (isLocked) {
      setToast({ type: 'error', msg: `${blockedByName ?? 'Outro usuário'} está editando esta cotação no momento.` })
      return
    }

    // Validações com feedback explícito
    if (!id || !cotacao) {
      setToast({ type: 'error', msg: 'Cotação não encontrada. Recarregue a página.' })
      return
    }

    // Segurança: bloqueia itens sem descrição da RC (cotador não pode introduzir itens fora do escopo)
    const itensInvalidos = fornecedores.some(f =>
      f.itens_precos.some(it => !it.descricao.trim() && (it.valor_unitario > 0 || it.qtd > 0))
    )
    if (itensInvalidos) {
      setToast({
        type: 'error',
        msg: 'Há itens sem descrição selecionada da RC. Escolha um item do dropdown ou remova a linha antes de enviar.',
      })
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
          fornecedor_nome:    toUpperNorm(f.fornecedor_nome),
          fornecedor_contato: joinFornecedorContato(f.fornecedor_telefone, f.fornecedor_email, f.fornecedor_contato) || undefined,
          fornecedor_telefone: f.fornecedor_telefone || undefined,
          fornecedor_email:   f.fornecedor_email || undefined,
          fornecedor_cnpj:    f.fornecedor_cnpj || undefined,
          valor_total:        f.valor_total,
          prazo_entrega_dias: f.prazo_entrega_dias || undefined,
          condicao_pagamento: f.condicao_pagamento ? toUpperNorm(f.condicao_pagamento) : undefined,
          observacao:         f.observacao ? toUpperNorm(f.observacao) : undefined,
          arquivo_url:        f.arquivo_url || undefined,
          itens_precos:       f.itens_precos.length > 0
            ? f.itens_precos.map(item => ({ ...item, descricao: toUpperNorm(item.descricao) }))
            : undefined,
        })),
        sem_cotacoes_minimas: semCotacoesMinimas,
        justificativa_sem_cotacoes: semCotacoesMinimas ? toUpperNorm(justificativa.trim()) : undefined,
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
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700">
              {blockedByName ?? 'Outro usuário'} está editando
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Esta cotação está bloqueada temporariamente para evitar conflito de alterações.
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => nav('/cotacoes')} className="p-1">
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <h2 className="text-lg font-extrabold text-slate-800">Inserir Cotação</h2>
      </div>

      <fieldset disabled={isLocked} className={isLocked ? 'space-y-4 opacity-60' : 'space-y-4'}>

      {/* RC Info + Timeline */}
      {cotacao?.requisicao && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400 font-mono">{cotacao.requisicao.numero}</p>
              {(cotacao.requisicao as any)?.compra_recorrente && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg">Recorrente</span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{cotacao.requisicao.justificativa || cotacao.requisicao.descricao}</p>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">{cotacao.requisicao.obra_nome}</span>
              <span className="text-sm font-extrabold text-teal-600">{fmt(valorRef)}</span>
            </div>
            {cotacao.requisicao.descricao && cotacao.requisicao.descricao !== cotacao.requisicao.justificativa && (
              <div className="mt-2 pt-2 border-t border-slate-100 rounded-lg bg-teal-50/50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-teal-600">Detalhes adicionais</p>
                <p className="text-xs leading-relaxed text-teal-800">{cotacao.requisicao.descricao}</p>
              </div>
            )}
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
        disabled={cotacao?.status === 'concluida' || isLocked}
        cotacaoId={id}
        requisicaoId={cotacao?.requisicao_id}
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
            <div className="relative">
              <input
                required={idx < minCot && !semCotacoesMinimas}
                autoComplete="off"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-shadow ${
                  triedSubmit && !forn.fornecedor_nome.trim() && idx < minCot && !semCotacoesMinimas
                    ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                }`}
                placeholder="Nome do fornecedor *"
                value={forn.fornecedor_nome}
                onChange={e => searchFornecedor(idx, e.target.value)}
                onFocus={() => {
                  if (forn.fornecedor_nome.trim().length >= 2 && (fornResults[idx]?.length ?? 0) > 0)
                    setFornOpen(prev => ({ ...prev, [idx]: true }))
                }}
                onBlur={() => setTimeout(() => setFornOpen(prev => ({ ...prev, [idx]: false })), 150)}
              />
              {fornOpen[idx] && (fornResults[idx]?.length ?? 0) > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                  {fornResults[idx].map((f: any) => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors border-b border-slate-100 last:border-0"
                      onMouseDown={() => selectFornecedor(idx, f)}
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.nome_fantasia || f.razao_social}</p>
                      {f.nome_fantasia && f.razao_social && f.nome_fantasia !== f.razao_social && (
                        <p className="text-[11px] text-slate-400 truncate">{f.razao_social}</p>
                      )}
                      <p className="text-[10px] text-slate-400">{[f.cidade, f.uf].filter(Boolean).join(' – ')}{f.cnpj ? ` · ${f.cnpj}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                placeholder="Telefone"
                type="tel"
                value={forn.fornecedor_telefone}
                onChange={e => updateFornecedor(idx, 'fornecedor_telefone', e.target.value)}
              />
              <input
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                placeholder="E-mail"
                type="email"
                value={forn.fornecedor_email}
                onChange={e => updateFornecedor(idx, 'fornecedor_email', e.target.value)}
              />
            </div>

            {/* ── Itens e Preços ─────────────────────────────────────────────── */}
            <ItemPricingTable
              items={forn.itens_precos}
              onChange={items => updateFornecedorItems(idx, items)}
              reqItens={(cotacao?.requisicao as any)?.itens ?? []}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">
                  {calcTotalItems(forn.itens_precos) > 0
                    ? (cotacao?.requisicao as any)?.compra_recorrente ? 'Valor Mensal (calculado)' : 'Valor Total (calculado)'
                    : (cotacao?.requisicao as any)?.compra_recorrente ? 'Valor Mensal *' : 'Valor Total *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">R$</span>
                  <NumericInput
                    required={idx < minCot && !semCotacoesMinimas}
                    min={0.01} step={0.01}
                    readOnly={calcTotalItems(forn.itens_precos) > 0}
                    className={`w-full border rounded-xl pl-9 pr-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-teal-300 outline-none transition-shadow ${
                      calcTotalItems(forn.itens_precos) > 0
                        ? 'bg-teal-50 border-teal-200 text-teal-700 cursor-default'
                        : triedSubmit && !forn.valor_total && idx < minCot && !semCotacoesMinimas
                          ? 'border-red-300 bg-red-50/30'
                          : 'border-slate-200'
                    }`}
                    value={forn.valor_total}
                    onChange={v => calcTotalItems(forn.itens_precos) === 0 && updateFornecedor(idx, 'valor_total', v)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">Prazo (dias)</label>
                <NumericInput
                  min={1}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                  value={forn.prazo_entrega_dias}
                  onChange={v => updateFornecedor(idx, 'prazo_entrega_dias', v)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                placeholder="Condição de pgto (30 dias, à vista...)"
                maxLength={255}
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
            fornecedor_contato: joinFornecedorContato(f.fornecedor_telefone, f.fornecedor_email, f.fornecedor_contato) || undefined,
            fornecedor_telefone: f.fornecedor_telefone || undefined,
            fornecedor_email: f.fornecedor_email || undefined,
            fornecedor_cnpj: f.fornecedor_cnpj || undefined,
            valor_total: f.valor_total,
            prazo_entrega_dias: f.prazo_entrega_dias || undefined,
            condicao_pagamento: f.condicao_pagamento || undefined,
            itens_precos: f.itens_precos,
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
              onChange={e => setJustificativa(toUpperNorm(e.target.value))}
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

      {/* Devolver ao Solicitante — alternativa segura a "adicionar itens fora do escopo" */}
      {cotacao?.requisicao_id && cotacao?.status !== 'concluida' && !devolverMutation.isSuccess && (
        <button
          type="button"
          disabled={devolverMutation.isPending || submitMutation.isPending || isLocked}
          onClick={() => { setMotivoDevolucao(''); setShowDevolverModal(true) }}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-rose-600 border border-rose-200 rounded-2xl hover:bg-rose-50 transition disabled:opacity-50"
        >
          <Undo2 size={14} /> Devolver ao Solicitante
        </button>
      )}

      {devolverMutation.isSuccess && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-2 text-sm font-semibold text-rose-700">
          <CheckCircle size={16} className="text-rose-500" />
          Requisição devolvida ao solicitante. As aprovações anteriores foram invalidadas.
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitMutation.isPending || !canSubmit || isLocked || devolverMutation.isPending || devolverMutation.isSuccess}
        className={`w-full rounded-2xl py-4 font-extrabold flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all ${
          canSubmit && !submitMutation.isPending && !isLocked
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
      </fieldset>

      {/* Modal: Devolver ao Solicitante */}
      {showDevolverModal && cotacao?.requisicao_id && id && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => !devolverMutation.isPending && setShowDevolverModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-4 flex items-center gap-3">
              <Undo2 size={20} className="text-white" />
              <div>
                <p className="text-sm font-bold text-white">Devolver ao Solicitante</p>
                <p className="text-[11px] text-white/80">
                  A RC voltará para edição e o ciclo de aprovação será reiniciado.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-700 leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> Esta ação irá:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Cancelar esta cotação em andamento</li>
                  <li>Invalidar as aprovações técnicas anteriores</li>
                  <li>Voltar a RC ao solicitante para edição</li>
                  <li>Ao reenviar, passará novamente pela aprovação da alçada 1</li>
                </ul>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700 mb-1 block">
                  Motivo da devolução <span className="text-rose-500">*</span>
                </span>
                <UpperTextarea
                  rows={4}
                  value={motivoDevolucao}
                  onChange={e => setMotivoDevolucao(e.target.value)}
                  placeholder="Explique ao solicitante o que precisa ser ajustado (mínimo 20 caracteres)..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 outline-none resize-none"
                />
                <p className={`text-[10px] mt-1 ${motivoDevolucao.trim().length < 20 ? 'text-slate-400' : 'text-emerald-600'}`}>
                  {motivoDevolucao.trim().length}/20 caracteres mínimos
                </p>
              </label>

              {devolverMutation.isError && (
                <p className="text-xs text-red-600">
                  Erro ao devolver: {(devolverMutation.error as Error)?.message || 'tente novamente'}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={devolverMutation.isPending}
                  onClick={() => setShowDevolverModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={devolverMutation.isPending || motivoDevolucao.trim().length < 20 || !perfil}
                  onClick={() => {
                    if (!perfil || !cotacao.requisicao_id || !id) return
                    devolverMutation.mutate(
                      {
                        requisicaoId: cotacao.requisicao_id,
                        cotacaoId: id,
                        motivo: motivoDevolucao,
                        cotadorNome: perfil.nome,
                      },
                      {
                        onSuccess: () => {
                          setShowDevolverModal(false)
                          setTimeout(() => nav('/cotacoes'), 1200)
                        },
                      }
                    )
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition disabled:opacity-50"
                >
                  {devolverMutation.isPending
                    ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Undo2 size={14} />}
                  Confirmar Devolução
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
