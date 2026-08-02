import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, PlusCircle, Trash2, Send, CheckCircle, Info, AlertTriangle,
  Paperclip, FileText, X, Loader2, Eye, Ban, CheckCircle2, PackagePlus,
  ScrollText, Undo2, Printer, RotateCcw,
} from 'lucide-react'
import { useCotacao, useFinalizarCotacao, useDevolverRequisicaoCotacao } from '../hooks/useCotacoes'
import { condicaoPagamentoInterpretavel } from '../utils/pagamentos'
import { useCategorias } from '../hooks/useCategorias'
import { useEmitirPedido, useCancelarRequisicao } from '../hooks/usePedidos'
import { useAuth } from '../contexts/AuthContext'
import { useEditorLock } from '../hooks/useEditorLock'
import type { Cotacao, ItemPreco } from '../types'
import CotacaoComparativo from '../components/CotacaoComparativo'
import AuditoriaCard from '../components/AuditoriaCard'
import FluxoTimeline from '../components/FluxoTimeline'
import FornecedorCadastroModal from '../components/FornecedorCadastroModal'
import UploadCotacao from '../components/UploadCotacao'
import EmitirPedidoModal from '../components/EmitirPedidoModal'
import { supabase } from '../services/supabase'
import { api } from '../services/api'
import type { CnpjResult } from '../services/api'
import NumericInput from '../components/NumericInput'
import { minCotacoesPorValor } from '../utils/cotacoesPolicy'
import { toUpperNorm, UpperTextarea } from '../components/UpperInput'
import { joinFornecedorContato, splitFornecedorContato } from '../utils/fornecedorContato'
import { getEmpresaById, EMPRESA_FALLBACK } from '../services/empresa'
import type { EmpresaData } from '../services/empresa'
import { useLookupEmpresas } from '../hooks/useLookups'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FILE_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const FILE_MAX_SIZE = 50 * 1024 * 1024

interface FornecedorForm {
  id?:                string   // presente quando já existe em cmp_cotacao_fornecedores (cotação reaberta)
  fornecedor_nome:    string
  fornecedor_contato: string
  fornecedor_telefone: string
  fornecedor_email: string
  fornecedor_cnpj:    string
  valor_total:        number   // subtotal de produtos (soma dos itens ou valor digitado)
  valor_frete:        number
  prazo_entrega_dias: number
  condicao_pagamento: string
  observacao:         string
  arquivo_urls:       string[]
  itens_precos:       ItemPreco[]
}

const emptyFornecedor = (): FornecedorForm => ({
  fornecedor_nome: '', fornecedor_contato: '', fornecedor_telefone: '', fornecedor_email: '', fornecedor_cnpj: '',
  valor_total: 0, valor_frete: 0, prazo_entrega_dias: 0, condicao_pagamento: '', observacao: '',
  arquivo_urls: [], itens_precos: [],
})

const calcTotalItems = (itens: ItemPreco[]) =>
  Math.round(itens.reduce((s, i) => s + i.valor_total, 0) * 100) / 100

// Custo entregue = produtos + frete (usado p/ comparar fornecedores e na aprovacao)
const calcTotalEntregue = (f: FornecedorForm) =>
  Math.round((f.valor_total + (f.valor_frete || 0)) * 100) / 100

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
  // Itens trancados ao escopo da RC por padrao (alterar exige devolver ao
  // solicitante). Excecao temporaria (1a fase): comprador (flag
  // sys_perfis.comprador) ou admin podem inserir itens novos e editar a
  // descricao/quantidade direto na cotacao, ate organizarmos o fluxo formal.
  const { isAdmin, perfil } = useAuth()
  const podeEditarItens = isAdmin || !!perfil?.comprador
  const podeEditarQtd = podeEditarItens
  const [itemResults, setItemResults] = useState<Record<number, any[]>>({})
  const [itemOpen, setItemOpen] = useState<Record<number, boolean>>({})
  const [itemQuery, setItemQuery] = useState<Record<number, string>>({})
  const itemTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  // Dropdown de sugestao renderizado via portal (position:fixed) pra fugir do
  // overflow-hidden da tabela — senao fica cortado atras do banner de total.
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [ddPos, setDdPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const openIdx = useMemo(() => {
    const k = Object.keys(itemOpen).find(key => itemOpen[Number(key)])
    return k !== undefined ? Number(k) : null
  }, [itemOpen])
  useLayoutEffect(() => {
    if (openIdx === null) { setDdPos(null); return }
    const el = inputRefs.current[openIdx]
    if (!el) { setDdPos(null); return }
    const update = () => {
      const r = el.getBoundingClientRect()
      setDdPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 288) })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [openIdx])

  // Itens que vieram do parse de PDF sem bater automaticamente com a RC (descricao
  // vazia + sugestao com o texto original) chegam aqui pra o comprador escolher o
  // item certo — pre-preenche a busca com a sugestao pra já mostrar candidatos.
  useEffect(() => {
    setItemQuery(prev => {
      let changed = false
      const next = { ...prev }
      items.forEach((it, idx) => {
        if (!it.descricao && it.sugestao && next[idx] === undefined) {
          next[idx] = toUpperNorm(it.sugestao)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [items])

  // Itens da requisição que ainda não foram adicionados
  const usedDescs = new Set(items.map(it => it.descricao.toLowerCase().trim()).filter(Boolean))
  const availableReqItens = reqItens.filter(ri => !usedDescs.has(ri.descricao.toLowerCase().trim()))

  // Comprador/admin pode adicionar item mesmo sem sobra da RC (item novo, fora do escopo).
  const canAddItem = availableReqItens.length > 0 || podeEditarItens

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
    // Um dropdown aberto por vez: abrir substitui o mapa (fecha os demais).
    setItemOpen(prev => reqMatches.length > 0 ? { [i]: true } : { ...prev, [i]: false })
  }, [availableReqItens])

  // Descrição livre (comprador/admin): escreve direto no item e sugere itens da
  // RC (sincrono) + do catálogo est_itens (async, debounced) pra facilitar o
  // pareamento e evitar recadastro. Pegar do catálogo preenche unidade/valor médio.
  const handleDescChange = (i: number, text: string) => {
    if (!podeEditarItens) { searchItem(i, text); return }
    const normalized = toUpperNorm(text)
    onChange(items.map((item, idx) => idx === i ? { ...item, descricao: normalized } : item))
    setItemQuery(prev => ({ ...prev, [i]: normalized }))

    const rcMatches = filterReqItens(normalized).map(ri => ({ ...ri, _fromReq: true }))
    setItemResults(prev => ({ ...prev, [i]: rcMatches }))
    // Abre o dropdown se ha sugestao OU se ja da pra oferecer "Cadastrar" (>=2 chars),
    // senao o rodape de cadastro nunca aparece quando o item nao existe.
    // Substitui o mapa (um aberto por vez).
    setItemOpen((rcMatches.length > 0 || normalized.trim().length >= 2) ? { [i]: true } : {})

    if (itemTimerRef.current[i]) clearTimeout(itemTimerRef.current[i])
    if (normalized.trim().length < 2) return
    itemTimerRef.current[i] = setTimeout(async () => {
      const term = `%${normalized.trim()}%`
      const { data } = await supabase
        .from('est_itens')
        .select('id, codigo, descricao, unidade, valor_medio')
        .eq('ativo', true)
        .or(`descricao.ilike.${term},codigo.ilike.${term}`)
        .order('descricao')
        .limit(20)
      const rcDescs = new Set(rcMatches.map(r => r.descricao.toLowerCase().trim()))
      const catalogo = (data ?? [])
        .filter((c: any) => !rcDescs.has(String(c.descricao ?? '').toLowerCase().trim()))
        .map((c: any) => ({ ...c, _fromReq: false }))
      setItemResults(prev => ({ ...prev, [i]: [...rcMatches, ...catalogo] }))
      setItemOpen({ [i]: true })
    }, 300)
  }

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
                  ref={el => { inputRefs.current[i] = el }}
                  className={`text-[11px] border rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-teal-300 w-full ${
                    item.descricao && !podeEditarItens
                      ? 'bg-teal-50/60 border-teal-200 text-slate-700 cursor-default'
                      : item.sugestao && !item.descricao
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-white border-slate-200'
                  }`}
                  placeholder={podeEditarItens ? 'Descreva o item ou escolha da RC...' : 'Selecione um item da RC...'}
                  title={!item.descricao && item.sugestao ? `Não bateu automaticamente com a RC — texto original: "${item.sugestao}". Escolha o item correto abaixo.` : undefined}
                  autoComplete="off"
                  readOnly={!!item.descricao && !podeEditarItens}
                  value={item.descricao || (itemQuery[i] ?? '')}
                  onChange={e => handleDescChange(i, e.target.value)}
                  onFocus={() => {
                    if (item.descricao && !podeEditarItens) return
                    handleDescChange(i, item.descricao || (itemQuery[i] ?? ''))
                  }}
                  onBlur={() => setTimeout(() => setItemOpen(prev => ({ ...prev, [i]: false })), 150)}
                />
                {item.descricao && !podeEditarItens && (
                  <button
                    type="button"
                    onClick={() => clearItemDescricao(i)}
                    title="Limpar seleção"
                    className="flex-shrink-0 text-slate-300 hover:text-rose-500 transition"
                  >
                    <X size={11} />
                  </button>
                )}
                {itemOpen[i] && ddPos && (!item.descricao || podeEditarItens) && (() => {
                  const text = (item.descricao || itemQuery[i] || '').trim()
                  const results = itemResults[i] ?? []
                  const showCadastrar = podeEditarItens && text.length >= 2
                  if (results.length === 0 && !showCadastrar) return null
                  return createPortal(
                  <div
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto"
                    style={{ top: ddPos.top, left: ddPos.left, width: ddPos.width }}
                  >
                    {results.map((est: any, ri: number) => (
                      <button
                        key={est.id || `req-${ri}`}
                        type="button"
                        className={`w-full text-left px-2.5 py-2 transition-colors border-b border-slate-100 last:border-0 ${
                          est._fromReq ? 'hover:bg-amber-50 bg-amber-50/30' : 'hover:bg-teal-50'
                        }`}
                        onMouseDown={() => selectItem(i, est)}
                      >
                        <p className="text-[11px] font-semibold text-slate-800 truncate">
                          {est._fromReq
                            ? <span className="text-[9px] font-bold text-amber-600 mr-1">REQUISIÇÃO</span>
                            : <span className="text-[9px] font-bold text-teal-600 mr-1">CATÁLOGO</span>}
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
                    {showCadastrar && (
                      <button
                        type="button"
                        onMouseDown={() => window.open(`/cadastros/itens?descricao=${encodeURIComponent(text)}`, '_blank')}
                        className="w-full text-left px-2.5 py-2 hover:bg-violet-50 border-t border-slate-100 flex items-center gap-1.5 text-violet-600"
                      >
                        <PlusCircle size={12} className="shrink-0" />
                        <span className="text-[11px] font-semibold truncate">Cadastrar “{text}” no catálogo</span>
                      </button>
                    )}
                  </div>,
                  document.body
                  )
                })()}
              </div>
              <input
                type="number" min="0" step="0.01"
                readOnly={!podeEditarQtd}
                className={`text-[11px] rounded px-1 py-1 text-center outline-none w-full ${
                  podeEditarQtd
                    ? 'bg-white border border-slate-200 focus:ring-1 focus:ring-teal-300'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed'
                }`}
                value={item.qtd || ''}
                onChange={podeEditarQtd ? e => updateItem(i, 'qtd', e.target.value) : undefined}
                title={podeEditarQtd ? 'Quantidade da cotação (comprador pode ajustar)' : 'Quantidade definida pela RC. Para alterar, devolva a requisição ao solicitante.'}
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
          {podeEditarItens
            ? 'Existe item sem descrição. Preencha a descrição ou remova a linha.'
            : 'Existe item sem descrição selecionada da RC. Escolha um item do dropdown ou remova a linha.'}
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
        <div>
          <h2 className="text-lg font-extrabold text-slate-800">Cotação Concluída</h2>
          {cotacao.comprador_nome && (
            <p className="text-xs text-slate-400">Cotado por: <span className="font-semibold text-slate-500">{cotacao.comprador_nome}</span></p>
          )}
        </div>
      </div>

      {/* RC Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-slate-400 font-mono">{req?.numero}</p>
          {(() => {
            const rcItens = (req as any)?.itens as { atendido_em_pedido_id?: string | null }[] | undefined
            if (!rcItens || rcItens.length === 0) return null
            const atendidos = rcItens.filter(it => !!it.atendido_em_pedido_id).length
            const pendentes = rcItens.length - atendidos
            if (atendidos === 0 || pendentes === 0) return null
            return (
              <span
                title={`${atendidos} de ${rcItens.length} itens já comprados em pedidos anteriores — adicione fornecedor para os ${pendentes} pendentes`}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-indigo-100 text-indigo-700"
              >
                ⏳ PARCIAL ({atendidos}/{rcItens.length})
              </span>
            )
          })()}
        </div>
        <p className="text-sm font-bold text-slate-800">{req?.justificativa || req?.descricao}</p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-slate-400">{req?.obra_nome}</p>
          <p className="text-sm font-extrabold text-teal-600">{fmt(cotacao.valor_selecionado ?? req?.valor_estimado ?? 0)}</p>
        </div>
        {(req as any)?.arquivo_url && (
          <a
            href={(req as any).arquivo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition"
          >
            <Paperclip size={12} /> Planilha de referência do solicitante
          </a>
        )}
      </div>

      {/* Timeline */}
      {req && <FluxoTimeline status={req.status ?? 'cotacao_aprovada'} />}

      {/* Comparativo */}
      {cotacao.fornecedores && <CotacaoComparativo fornecedores={cotacao.fornecedores} readOnly />}

      {/* Auditoria */}
      <AuditoriaCard
        createdAt={cotacao.created_at}
        updatedAt={cotacao.updated_at}
        criadoPor={cotacao.criado_por_nome}
        atualizadoPor={cotacao.atualizado_por_nome}
        extra={[
          { label: 'Comprador', value: cotacao.comprador_nome },
        ]}
      />

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

// ─── Solicitação de Cotação PDF ───────────────────────────────────────────────

function buildSolicitacaoHtml(cotacao: Cotacao, EMPRESA: EmpresaData = EMPRESA_FALLBACK): string {
  const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c))
  const fmtBRL = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
  const req = cotacao.requisicao
  const itens = (req as any)?.itens ?? []
  const hoje = new Date().toLocaleDateString('pt-BR')
  const prazoResposta = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')

  const itensHtml = itens.map((item: any, i: number) => `
    <tr>
      <td style="text-align:center;color:#64748b">${i + 1}</td>
      <td>${esc(item.descricao)}${item.descricao_complementar ? `<br><span style="font-size:10px;color:#475569;font-style:italic">${esc(item.descricao_complementar)}</span>` : ''}${item.marca ? `<br><span style="font-size:9px;color:#94a3b8">Marca ref.: ${esc(item.marca)}</span>` : ''}</td>
      <td style="text-align:center">${item.quantidade}</td>
      <td style="text-align:center">${esc(item.unidade)}</td>
      <td style="text-align:right;color:#94a3b8;font-style:italic">${fmtBRL(item.valor_unitario_estimado)}</td>
      <td style="border-bottom:1px solid #94a3b8;min-width:80px"> </td>
      <td style="border-bottom:1px solid #94a3b8;min-width:90px"> </td>
    </tr>
  `).join('')

  const enderecoLinha = [EMPRESA.endereco, EMPRESA.cidade, EMPRESA.uf].filter(Boolean).join(', ')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Solicitacao de Cotacao - ${esc(req?.numero ?? '')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; color:#1e293b; font-size:12px; background:#fff; }
  .page { max-width:820px; margin:0 auto; padding:30px 40px; }
  .header { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; background:#1e293b; border-radius:12px; margin-bottom:22px; }
  .header-left { display:flex; align-items:center; gap:14px; }
  .header-left img { height:52px; object-fit:contain; }
  .company-name { font-size:12px; font-weight:700; color:#e2e8f0; }
  .company-detail { font-size:10px; color:#94a3b8; margin-top:2px; }
  .header-right { text-align:right; }
  .doc-title { font-size:20px; font-weight:900; color:#2dd4bf; letter-spacing:-0.5px; }
  .doc-sub { font-size:11px; color:#94a3b8; margin-top:3px; }
  .doc-date { font-size:10px; color:#64748b; margin-top:5px; }
  .section { margin-bottom:18px; }
  .section-title { font-size:10px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px; border-bottom:1.5px solid #e2e8f0; padding-bottom:4px; }
  .fields { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
  .field .label { font-size:9px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; }
  .field .value { font-size:12px; font-weight:600; color:#1e293b; margin-top:1px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  thead th { background:#f1f5f9; color:#475569; font-weight:700; text-align:left; padding:7px 8px; border-bottom:2px solid #e2e8f0; font-size:9px; text-transform:uppercase; }
  tbody td { padding:6px 8px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .write-col { min-width:90px; border-bottom:1.5px solid #94a3b8 !important; background:#fafafa; }
  .total-note { font-size:10px; color:#64748b; margin-top:6px; font-style:italic; }
  .warn-box { background:#fffbeb; border:1.5px solid #fcd34d; border-radius:8px; padding:10px 14px; margin-bottom:16px; }
  .warn-box p { font-size:11px; color:#92400e; }
  .warn-box strong { color:#78350f; }
  .supplier-box { border:1.5px solid #e2e8f0; border-radius:8px; padding:12px 14px; margin-bottom:16px; background:#f8fafc; }
  .supplier-box .title { font-size:10px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px; }
  .supplier-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .supplier-field { border-bottom:1px solid #94a3b8; padding-bottom:2px; min-height:20px; }
  .supplier-label { font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:2px; }
  .conditions-box { border:1.5px solid #e2e8f0; border-radius:8px; padding:12px 14px; background:#f8fafc; }
  .cond-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; }
  .cond-field { border-bottom:1px solid #94a3b8; min-height:20px; padding-bottom:2px; }
  .cond-label { font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:2px; }
  .footer { margin-top:28px; padding-top:14px; border-top:2px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-end; font-size:9px; color:#94a3b8; }
  .footer-sig { text-align:center; }
  .footer-sig .sig-line { border-top:1px solid #94a3b8; width:180px; margin:0 auto 4px; padding-top:4px; }
  @media print { .page { padding:20px 30px; } }
</style>
</head>
<body>
<div class="page">

  <!-- Cabeçalho -->
  <div class="header">
    <div class="header-left">
      <img src="${esc(EMPRESA.logoUrl)}" alt="Logo" onerror="this.style.display='none'" />
      <div>
        <div class="company-name">${esc(EMPRESA.fantasia || EMPRESA.razao)}</div>
        <div class="company-detail">CNPJ: ${esc(EMPRESA.cnpj)}</div>
        ${enderecoLinha ? `<div class="company-detail">${esc(enderecoLinha)}</div>` : ''}
        ${EMPRESA.telefone ? `<div class="company-detail">Tel: ${esc(EMPRESA.telefone)}</div>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">SOLICITAÇÃO DE COTAÇÃO</div>
      <div class="doc-sub">RC: <strong style="color:#e2e8f0">${esc(req?.numero ?? '—')}</strong></div>
      <div class="doc-date">Emitido em: ${hoje} &nbsp;|&nbsp; Resp. até: <strong style="color:#fbbf24">${prazoResposta}</strong></div>
    </div>
  </div>

  <!-- Aviso prazo -->
  <div class="warn-box">
    <p>Solicitamos gentilmente o envio da proposta comercial até <strong>${prazoResposta}</strong>.
    Encaminhe para o comprador responsável com valores unitários, prazo de entrega e condição de pagamento.
    Esta cotação não constitui compromisso de compra.</p>
  </div>

  <!-- Dados da RC -->
  <div class="section">
    <div class="section-title">Dados da Solicitação</div>
    <div class="fields">
      <div class="field"><div class="label">Obra / Local</div><div class="value">${esc(req?.obra_nome ?? '—')}</div></div>
      <div class="field"><div class="label">Categoria</div><div class="value">${esc((req as any)?.categoria?.replace(/_/g,' ') ?? '—')}</div></div>
      <div class="field"><div class="label">Descrição</div><div class="value">${esc(req?.descricao ?? '—')}</div></div>
      <div class="field"><div class="label">Valor de referência (estimado)</div><div class="value" style="color:#0d9488;font-weight:900">${fmtBRL((req as any)?.valor_estimado)}</div></div>
    </div>
    ${req?.justificativa ? `<div style="margin-top:8px;background:#f0fdf4;border-radius:6px;padding:8px 10px;font-size:11px;color:#166534"><strong>Justificativa:</strong> ${esc(req.justificativa)}</div>` : ''}
  </div>

  <!-- Itens para cotar -->
  <div class="section">
    <div class="section-title">Itens para Cotação — preencha os campos em branco</div>
    <table>
      <thead>
        <tr>
          <th style="width:4%">#</th>
          <th style="width:38%">Descrição do Item</th>
          <th style="width:8%">Qtd</th>
          <th style="width:7%">Un</th>
          <th style="width:13%">Vl. Ref. (est.)</th>
          <th style="width:15%" class="write-col">Vl. Unit. (R$)</th>
          <th style="width:15%" class="write-col">Total (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml}
        <tr style="background:#f1f5f9">
          <td colspan="6" style="text-align:right;font-weight:700;font-size:11px;padding:8px">VALOR TOTAL DA PROPOSTA</td>
          <td class="write-col" style="font-weight:900;font-size:13px"> </td>
        </tr>
      </tbody>
    </table>
    <p class="total-note">* Valores de referência são estimativas internas. Preencha com seus valores reais.</p>
  </div>

  <!-- Dados do Fornecedor -->
  <div class="supplier-box">
    <div class="title">Dados do Fornecedor — preencher</div>
    <div class="supplier-grid">
      <div><div class="supplier-label">Razão Social / Nome</div><div class="supplier-field"> </div></div>
      <div><div class="supplier-label">CNPJ / CPF</div><div class="supplier-field"> </div></div>
      <div><div class="supplier-label">Contato / Vendedor</div><div class="supplier-field"> </div></div>
      <div><div class="supplier-label">Telefone</div><div class="supplier-field"> </div></div>
      <div><div class="supplier-label">E-mail</div><div class="supplier-field"> </div></div>
      <div><div class="supplier-label">Cidade / UF</div><div class="supplier-field"> </div></div>
    </div>
  </div>

  <!-- Condições Comerciais -->
  <div class="conditions-box">
    <div class="title" style="margin-bottom:8px">Condições Comerciais — preencher</div>
    <div class="cond-grid">
      <div><div class="cond-label">Prazo de Entrega (dias)</div><div class="cond-field"> </div></div>
      <div><div class="cond-label">Condição de Pagamento</div><div class="cond-field"> </div></div>
      <div><div class="cond-label">Validade da Proposta</div><div class="cond-field"> </div></div>
      <div><div class="cond-label">Frete</div><div class="cond-field"> </div></div>
    </div>
    <div style="margin-top:10px"><div class="cond-label">Observações / Condições especiais</div><div style="border-bottom:1px solid #94a3b8;min-height:28px"> </div></div>
  </div>

  <!-- Rodapé -->
  <div class="footer">
    <div>
      <div>${esc(EMPRESA.fantasia || EMPRESA.razao)} · CNPJ ${esc(EMPRESA.cnpj)}</div>
      ${EMPRESA.email ? `<div>E-mail: ${esc(EMPRESA.email)}</div>` : ''}
    </div>
    <div class="footer-sig">
      <div class="sig-line"></div>
      <div>Assinatura e carimbo do fornecedor</div>
      <div style="margin-top:6px">Data: ___/___/______</div>
    </div>
  </div>

</div>
</body></html>`
}

async function gerarSolicitacaoCotacao(cotacao: Cotacao, empresaId?: string | null) {
  // Estampa a empresa do grupo escolhida na cotação (multi-empresa) — sem id, Matriz.
  const empresa = await getEmpresaById(empresaId).catch(() => EMPRESA_FALLBACK)
  const html = buildSolicitacaoHtml(cotacao, empresa)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
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
  const { isLocked, blockedByName, canOverride, assumeControl } = useEditorLock({
    resourceType: 'cmp_requisicao',
    resourceId: cotacao?.requisicao_id ?? id,
    enabled: Boolean(cotacao?.requisicao_id ?? id),
  })

  const [fornecedores, setFornecedores] = useState<FornecedorForm[]>([
    emptyFornecedor(),
  ])
  // IDs de fornecedores já salvos (cmp_cotacao_fornecedores) removidos da tela nesta
  // sessão — precisam ser deletados no banco no submit, senão ficam órfãos.
  const [fornecedoresRemovidosIds, setFornecedoresRemovidosIds] = useState<string[]>([])
  const removeFornecedor = useCallback((idx: number) => {
    setFornecedores(prev => {
      const alvo = prev[idx]
      if (alvo?.id) setFornecedoresRemovidosIds(ids => [...ids, alvo.id as string])
      return prev.filter((_, i) => i !== idx)
    })
  }, [])
  // Itens da RC ainda pendentes (não atendidos por pedido anterior), prontos pra
  // virar linhas de um card de fornecedor — qtd da RC, preço zerado. Usado sempre
  // que um card "em branco" é criado (1º acesso, Adicionar Fornecedor, Recomeçar),
  // pra o comprador só descer preenchendo preço em vez de buscar item por item.
  const itensPendentesDaRC = useCallback((): ItemPreco[] => {
    const rcItens = (cotacao?.requisicao?.itens ?? []) as any[]
    return rcItens
      .filter(item => !item.atendido_em_pedido_id)
      .map(item => ({
        descricao: toUpperNorm(item.descricao),
        qtd: item.quantidade,
        valor_unitario: 0,
        valor_total: 0,
      }))
  }, [cotacao?.requisicao])
  // REGRA: todo fornecedor sempre exibe a lista COMPLETA dos itens em escopo da
  // RC, mesmo que ele cote só uma parte (itens não cotados ficam em branco,
  // preço 0). Parte da lista completa e sobrepõe os preços/qtd já salvos daquele
  // fornecedor, casando por descrição normalizada. Usado ao reabrir uma cotação
  // salva — sem isso, cada fornecedor voltaria só com o subconjunto que foi salvo
  // e a lista divergiria entre fornecedores.
  const comEscopoCompletoDaRC = useCallback((salvos: ItemPreco[] = []): ItemPreco[] => {
    const base = itensPendentesDaRC()
    if (base.length === 0) return salvos ?? []
    const porDescricao = new Map(
      (salvos ?? [])
        .filter(it => it.descricao?.trim())
        .map(it => [toUpperNorm(it.descricao).trim(), it]),
    )
    return base.map(item => {
      const salvo = porDescricao.get(toUpperNorm(item.descricao).trim())
      return salvo
        ? {
            descricao: item.descricao,
            qtd: salvo.qtd ?? item.qtd,
            valor_unitario: salvo.valor_unitario ?? 0,
            valor_total: salvo.valor_total ?? 0,
          }
        : item
    })
  }, [itensPendentesDaRC])
  // Recomeça a cotação do zero: remove TODOS os fornecedores já salvos (marcados
  // pra deletar no submit) e volta pra 1 card em branco com os itens da RC
  // pré-listados. Só o que já foi digitado/lido de cotação anterior some.
  const resetFornecedores = useCallback(() => {
    setFornecedores(prev => {
      const idsExistentes = prev.filter(f => f.id).map(f => f.id as string)
      if (idsExistentes.length > 0) setFornecedoresRemovidosIds(ids => [...ids, ...idsExistentes])
      return [{ ...emptyFornecedor(), itens_precos: itensPendentesDaRC() }]
    })
    setSelecaoPorItem(new Map())
    setSelecaoTocada(false)
  }, [itensPendentesDaRC])
  // Hidrata o formulário quando a cotação carrega: reaproveita fornecedores já
  // salvos (cotação em andamento reaberta) ou, se ainda não há nenhum, pré-lista
  // os itens da RC no card 1 — em vez de começar totalmente em branco. Só roda 1x
  // — não pode sobrescrever edições em curso em refetches seguintes.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (!cotacao) return
    hydratedRef.current = true
    if (cotacao.fornecedores && cotacao.fornecedores.length > 0) {
      setFornecedores(cotacao.fornecedores.map(f => ({
        id:                 f.id,
        fornecedor_nome:    f.fornecedor_nome ?? '',
        fornecedor_contato: f.fornecedor_contato ?? '',
        fornecedor_telefone: f.fornecedor_telefone ?? '',
        fornecedor_email:   f.fornecedor_email ?? '',
        fornecedor_cnpj:    f.fornecedor_cnpj ?? '',
        valor_total:        f.valor_total ?? 0,
        valor_frete:        (f as any).valor_frete ?? 0,
        prazo_entrega_dias: f.prazo_entrega_dias ?? 0,
        condicao_pagamento: f.condicao_pagamento ?? '',
        observacao:         f.observacao ?? '',
        arquivo_urls:       f.arquivo_urls ?? [],
        itens_precos:       comEscopoCompletoDaRC(f.itens_precos),
      })))
    } else {
      setFornecedores([{ ...emptyFornecedor(), itens_precos: itensPendentesDaRC() }])
    }
  }, [cotacao, itensPendentesDaRC, comEscopoCompletoDaRC])
  // ── Empresa do grupo (multi-empresa): quem solicita a cotação e recebe a NF ──
  // Default Matriz (EMP-001); persiste na hora em cmp_cotacoes pra valer no PDF
  // de solicitação e virar o default da emissão do pedido, mesmo antes de concluir.
  const empresas = useLookupEmpresas()
  const empresaMatrizId = useMemo(() => {
    if (empresas.length === 0) return ''
    return empresas.find(e => e.codigo === 'EMP-001')?.id ?? empresas[0].id
  }, [empresas])
  const [empresaId, setEmpresaId] = useState('')
  const empresaHydratedRef = useRef(false)
  useEffect(() => {
    if (empresaHydratedRef.current || !cotacao) return
    if (cotacao.empresa_id) {
      setEmpresaId(cotacao.empresa_id)
      empresaHydratedRef.current = true
    } else if (empresaMatrizId) {
      setEmpresaId(empresaMatrizId)
      empresaHydratedRef.current = true
    }
  }, [cotacao, empresaMatrizId])
  const handleEmpresaChange = useCallback((novaEmpresaId: string) => {
    setEmpresaId(novaEmpresaId)
    if (!id || !novaEmpresaId) return
    supabase
      .from('cmp_cotacoes')
      .update({ empresa_id: novaEmpresaId })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn('[CotacaoForm] Empresa não salva na cotação:', error.message)
      })
  }, [id])

  const [semCotacoesMinimas, setSemCotacoesMinimas] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const toastRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (toast) {
      toastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [toast])
  // CNPJs detectados pelo parse que NÃO estão cadastrados em cmp_fornecedores.
  // Guarda apenas os 14 dígitos. Usado para exibir chip "Cadastrar" no card.
  const [naoCadastradosCnpjs, setNaoCadastradosCnpjs] = useState<Set<string>>(new Set())
  const [cadastroModalIdx, setCadastroModalIdx] = useState<number | null>(null)
  const [triedSubmit, setTriedSubmit] = useState(false)
  // Seleção manual por item: Map<descricaoNormalizada, fornecedorIndex>
  const [selecaoPorItem, setSelecaoPorItem] = useState<Map<string, number>>(new Map())
  const [selecaoTocada, setSelecaoTocada] = useState(false)
  // Saldo de quantidade: itens cuja qtd cotada (na proposta escolhida) é menor
  // que a qtd da RC — ao concluir, o comprador decide o destino do restante
  // (desconsiderar ou gerar RC complementar via RPC cmp_ajustar_qtd_cotacao).
  const [saldoPrompt, setSaldoPrompt] = useState<
    { item_id: string; descricao: string; unidade: string; qtd_rc: number; qtd_nova: number }[] | null
  >(null)
  const [saldoBusy, setSaldoBusy] = useState(false)

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

  const updateFornecedor = (idx: number, field: keyof FornecedorForm, value: string | number | string[]) => {
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
    searchTimerRef.current[idx] = setTimeout(async () => {
      const q = supabase
        .from('cmp_fornecedores')
        .select('id, nome_fantasia, razao_social, cnpj, telefone, email, contato_nome, cidade, uf')
        .eq('ativo', true)
        .limit(10)
      const { data } = normalizedQuery.trim().length >= 2
        ? await q.or(`nome_fantasia.ilike.%${normalizedQuery}%,razao_social.ilike.%${normalizedQuery}%`)
        : await q.order('nome_fantasia', { ascending: true })
      setFornResults(prev => ({ ...prev, [idx]: data || [] }))
      setFornOpen(prev => ({ ...prev, [idx]: (data?.length ?? 0) > 0 }))
    }, normalizedQuery.trim().length >= 2 ? 300 : 0)
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

  // ── Atalho: seleciona fornecedor de menor preço para TODOS os itens ────────
  // Disparado apenas via botão explícito — o padrão é deixar o usuário decidir.
  const selecionarMenorPrecoEmTodos = useCallback(() => {
    const validosIdx: number[] = []
    fornecedores.forEach((f, idx) => {
      if (f.fornecedor_nome.trim() && f.valor_total > 0) validosIdx.push(idx)
    })
    if (validosIdx.length === 0) return

    const chaveDescricao = (s: string) => s.toLowerCase().trim()
    const candidatos = new Map<string, { precos: { idx: number; valor: number }[] }>()
    for (const idx of validosIdx) {
      for (const it of fornecedores[idx].itens_precos) {
        const descricao = it.descricao?.trim()
        if (!descricao || !it.valor_total || it.valor_total <= 0) continue
        const key = chaveDescricao(descricao)
        const entry = candidatos.get(key) ?? { precos: [] }
        entry.precos.push({ idx, valor: it.valor_total })
        candidatos.set(key, entry)
      }
    }
    const novaSelecao = new Map<string, number>()
    for (const [key, { precos }] of candidatos) {
      const menor = precos.reduce((best, p) => (p.valor < best.valor ? p : best), precos[0])
      novaSelecao.set(key, menor.idx)
    }
    setSelecaoPorItem(novaSelecao)
    setSelecaoTocada(true)
  }, [fornecedores])

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
    // Normaliza e tokeniza (palavras ≥3 chars, sem acento, uppercase)
    const tokenize = (s: string) =>
      toUpperNorm(String(s ?? ''))
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3)

    const rcTokensList: { descricao: string; tokens: Set<string> }[] = rcItens
      .map((it: any) => ({
        descricao: toUpperNorm(String(it.descricao ?? '')).trim(),
        tokens: new Set(tokenize(it.descricao)),
      }))
      .filter((x: { descricao: string; tokens: Set<string> }) => x.descricao)

    // Fuzzy match por overlap de tokens. Score = overlap / min(|tokensPDF|, |tokensRC|)
    // Aceita quando score ≥ 0.4 E pelo menos 2 tokens em comum (ou match exato).
    // Cada item da RC só pode ser mapeado 1x (evita duplicar).
    const rcUsed = new Set<string>()
    const matchesRcItem = (desc: string): string | null => {
      const norm = toUpperNorm(desc).trim()
      if (!norm) return null
      // Match exato
      for (const rc of rcTokensList) {
        if (!rcUsed.has(rc.descricao) && rc.descricao === norm) {
          rcUsed.add(rc.descricao)
          return rc.descricao
        }
      }
      const pdfTokens = new Set(tokenize(norm))
      if (pdfTokens.size === 0) return null
      let best: { desc: string; score: number; overlap: number } | null = null
      for (const rc of rcTokensList) {
        if (rcUsed.has(rc.descricao)) continue
        if (rc.tokens.size === 0) continue
        let overlap = 0
        for (const t of pdfTokens) if (rc.tokens.has(t)) overlap++
        const score = overlap / Math.min(pdfTokens.size, rc.tokens.size)
        if (overlap >= 2 && score >= 0.4 && (!best || score > best.score)) {
          best = { desc: rc.descricao, score, overlap }
        }
      }
      if (best) {
        rcUsed.add(best.desc)
        return best.desc
      }
      return null
    }

    let itensForaEscopo = 0
    let fornecedoresDescartados = 0
    let rcNaoCotados: string[] = []

    setFornecedores(prev => {
      const vazios      = prev.filter(f => !f.fornecedor_nome.trim() && f.valor_total === 0)
      const preenchidos = prev.filter(f => f.fornecedor_nome.trim() || f.valor_total > 0)

      const novos: FornecedorForm[] = parsed.map(p => {
        // rcUsed evita que UM fornecedor mapeie o mesmo item da RC 2x. O escopo é
        // por fornecedor: quando o documento traz vários fornecedores cotando os
        // MESMOS itens, cada um precisa poder mapear a RC do zero. Sem este reset,
        // o 1º fornecedor "consome" todos os itens e os demais ficam sem match →
        // descartados (apareciam zerados, sem nem carregar nome/CNPJ).
        rcUsed.clear()
        // Inclui todo item com preço. Quando não bate com nenhum item da RC
        // (sigla/tamanho abreviado, marca no meio da descrição, etc.), mantém a
        // linha com descrição vazia + sugestão do texto original — o comprador
        // resolve na hora escolhendo o item certo no dropdown (mesma UI de
        // "Adicionar item"), sem precisar devolver a requisição ao solicitante.
        const itensComValor: ItemPreco[] = (p.itens ?? [])
          .filter(it => it.valor_unitario > 0)
          .map(it => {
            const rcMatch = matchesRcItem(it.descricao)
            if (!rcMatch) itensForaEscopo++
            return {
              descricao:      rcMatch ?? '', // vazio = comprador escolhe manualmente
              qtd:            it.qtd,
              valor_unitario: it.valor_unitario,
              valor_total:    Math.round(it.qtd * it.valor_unitario * 100) / 100,
              sugestao:       rcMatch ? undefined : (it.descricao || undefined),
            }
          })
        // Fornecedor sem nenhum item com preço (documento vazio/ilegível) é descartado.
        if (itensComValor.length === 0) {
          fornecedoresDescartados++
          return null
        }
        const valorTotal = calcTotalItems(itensComValor)
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
          valor_frete:        0,
          prazo_entrega_dias: p.prazo_entrega_dias || 0,
          condicao_pagamento: toUpperNorm(p.condicao_pagamento || ''),
          observacao:         toUpperNorm(p.observacao || ''),
          arquivo_urls:       uploadedPath ? [uploadedPath] : [],
          itens_precos:       itensComValor,
        }
      }).filter((f): f is FornecedorForm => f !== null)

      // Se nenhum fornecedor foi aproveitado, preserva o estado anterior
      // (não adiciona slots vazios extras só por causa do upload).
      if (novos.length === 0) return prev

      // Preenche primeiro os slots vazios existentes; o excedente é anexado.
      const result = [...preenchidos]
      const restantes = [...novos]
      for (const _vazio of vazios) {
        const novo = restantes.shift()
        if (!novo) break
        result.push(novo)
      }
      result.push(...restantes)

      // Itens da RC que nenhum fornecedor (incluindo os já cadastrados antes
      // deste upload) cotou ainda — fica visível pro comprador decidir, em vez
      // de sumir silenciosamente da tela (ex.: kit lido como itens avulsos).
      const descricoesCotadas = new Set(
        result.flatMap(f => f.itens_precos.map(it => toUpperNorm(it.descricao).trim()).filter(Boolean))
      )
      rcNaoCotados = rcTokensList
        .map(rc => rc.descricao)
        .filter(desc => !descricoesCotadas.has(desc))

      return result
    })

    // Verifica quais CNPJs extraídos do PDF ainda NÃO estão cadastrados.
    const cnpjsParsed = Array.from(new Set(
      parsed
        .map(p => String(p.fornecedor_cnpj ?? '').replace(/\D/g, ''))
        .filter(c => c.length === 14)
    ))
    if (cnpjsParsed.length > 0) {
      try {
        const { data: existing } = await supabase
          .from('cmp_fornecedores')
          .select('cnpj')
          .in('cnpj', cnpjsParsed)
        const existingSet = new Set((existing ?? []).map((f: any) => String(f.cnpj ?? '').replace(/\D/g, '')))
        const naoCad = cnpjsParsed.filter(c => !existingSet.has(c))
        if (naoCad.length > 0) {
          setNaoCadastradosCnpjs(prev => {
            const next = new Set(prev)
            for (const c of naoCad) next.add(c)
            return next
          })
        }
      } catch { /* silencioso: chip deixa de aparecer, mas o form segue */ }
    }

    const msgs: string[] = []
    if (fornecedoresDescartados > 0) {
      msgs.push(`${fornecedoresDescartados} fornecedor(es) do PDF ficaram sem nenhum item com preço legível.`)
    }
    if (itensForaEscopo > 0) {
      msgs.push(`${itensForaEscopo} item(ns) do PDF não bateram automaticamente com a RC — ficaram na lista sem descrição. Escolha o item correto no dropdown de cada linha (não precisa devolver ao solicitante).`)
    }
    if (rcNaoCotados.length > 0) {
      msgs.push(`${rcNaoCotados.length} item(ns) da RC ainda sem cotação de nenhum fornecedor: ${rcNaoCotados.join(', ')}.`)
    }
    if (msgs.length > 0) {
      setToast({ type: 'error', msg: msgs.join(' ') })
    }
  }, [id, cotacao?.requisicao])

  // Leitura de IA escopada a UM card de fornecedor já existente (em vez de criar
  // fornecedor novo, como o upload global no topo faz). Usa só o 1º fornecedor
  // detectado no documento. Preenche campo em branco; nunca sobrescreve o que o
  // comprador já digitou manualmente — nem nome/CNPJ/condição, nem preço de item.
  const handleFornecedorParsed = useCallback(async (idx: number, parsed: {
    fornecedor_nome: string
    fornecedor_cnpj?: string
    fornecedor_contato?: string
    fornecedor_telefone?: string
    fornecedor_email?: string
    prazo_entrega_dias?: number
    condicao_pagamento?: string
    observacao?: string
    itens?: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
  }[], file: File) => {
    const p = parsed[0]
    if (!p) return

    let uploadedPath = ''
    if (id && file) {
      try {
        const safeName = 'cotacao_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${id}/${Date.now()}_${safeName}`
        const { error } = await supabase.storage.from('cotacoes-docs').upload(path, file)
        if (!error) uploadedPath = path
      } catch { /* upload falhou, segue sem anexo */ }
    }

    const tokenize = (s: string) =>
      toUpperNorm(String(s ?? ''))
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3)

    setFornecedores(prev => prev.map((f, i) => {
      if (i !== idx) return f

      // Fuzzy match (mesma regra do upload global) contra as linhas JÁ LISTADAS
      // neste card — pré-carregadas com os itens da RC.
      const rowTokens = f.itens_precos.map(row => ({
        descricao: toUpperNorm(row.descricao).trim(),
        tokens: new Set(tokenize(row.descricao)),
      }))
      const rowUsed = new Set<string>()
      const matchRow = (desc: string): string | null => {
        const norm = toUpperNorm(desc).trim()
        if (!norm) return null
        for (const r of rowTokens) {
          if (!rowUsed.has(r.descricao) && r.descricao === norm) { rowUsed.add(r.descricao); return r.descricao }
        }
        const pdfTokens = new Set(tokenize(norm))
        if (pdfTokens.size === 0) return null
        let best: { desc: string; score: number } | null = null
        for (const r of rowTokens) {
          if (rowUsed.has(r.descricao) || r.tokens.size === 0) continue
          let overlap = 0
          for (const t of pdfTokens) if (r.tokens.has(t)) overlap++
          const score = overlap / Math.min(pdfTokens.size, r.tokens.size)
          if (overlap >= 2 && score >= 0.4 && (!best || score > best.score)) best = { desc: r.descricao, score }
        }
        if (best) { rowUsed.add(best.desc); return best.desc }
        return null
      }

      const itensAtualizados = f.itens_precos.map(item => ({ ...item }))
      for (const it of (p.itens ?? [])) {
        if (!(it.valor_unitario > 0)) continue
        const matched = matchRow(it.descricao)
        if (!matched) continue
        const rowIdx = itensAtualizados.findIndex(row => toUpperNorm(row.descricao).trim() === matched)
        if (rowIdx === -1 || itensAtualizados[rowIdx].valor_unitario > 0) continue // preço já preenchido — preserva
        const qtd = itensAtualizados[rowIdx].qtd || it.qtd
        itensAtualizados[rowIdx] = {
          ...itensAtualizados[rowIdx],
          valor_unitario: it.valor_unitario,
          valor_total: Math.round(qtd * it.valor_unitario * 100) / 100,
        }
      }

      const contatoSeparado = splitFornecedorContato(p.fornecedor_contato)
      const telefone = p.fornecedor_telefone || contatoSeparado.telefone
      const email = p.fornecedor_email || contatoSeparado.email

      return {
        ...f,
        fornecedor_nome:     f.fornecedor_nome.trim() || toUpperNorm(p.fornecedor_nome || ''),
        fornecedor_cnpj:     f.fornecedor_cnpj.trim() || (p.fornecedor_cnpj ? maskCNPJ(p.fornecedor_cnpj) : ''),
        fornecedor_telefone: f.fornecedor_telefone.trim() || telefone,
        fornecedor_email:    f.fornecedor_email.trim() || email,
        fornecedor_contato:  f.fornecedor_contato.trim() || joinFornecedorContato(telefone, email, p.fornecedor_contato),
        prazo_entrega_dias:  f.prazo_entrega_dias || (p.prazo_entrega_dias || 0),
        condicao_pagamento:  f.condicao_pagamento.trim() || toUpperNorm(p.condicao_pagamento || ''),
        observacao:          f.observacao.trim() || toUpperNorm(p.observacao || ''),
        arquivo_urls:        f.arquivo_urls.length > 0 ? f.arquivo_urls : (uploadedPath ? [uploadedPath] : []),
        itens_precos:        itensAtualizados,
        valor_total:         calcTotalItems(itensAtualizados),
      }
    }))
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
      updateFornecedor(idx, 'arquivo_urls', [...(fornecedores[idx]?.arquivo_urls ?? []), path])
    } catch (err) {
      setUploadError(prev => ({ ...prev, [idx]: err instanceof Error ? err.message : 'Erro no upload' }))
    } finally {
      setUploading(prev => ({ ...prev, [idx]: false }))
    }
  }, [id, fornecedores, updateFornecedor])

  const removeFile = useCallback(async (idx: number, fileIdx: number) => {
    const path = fornecedores[idx]?.arquivo_urls?.[fileIdx]
    if (path) {
      await supabase.storage.from('cotacoes-docs').remove([path]).catch(() => {})
    }
    updateFornecedor(idx, 'arquivo_urls', (fornecedores[idx]?.arquivo_urls ?? []).filter((_, i) => i !== fileIdx))
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

  // Bloqueia envio quando há fornecedor válido (nome + valor) com CNPJ não cadastrado.
  const temNaoCadastrados = validos.some(f => {
    const d = String(f.fornecedor_cnpj ?? '').replace(/\D/g, '')
    return d.length === 14 && naoCadastradosCnpjs.has(d)
  })

  // Itens únicos precificados entre os fornecedores válidos — cada um precisa ter
  // um fornecedor escolhido no mapa antes do envio.
  const itensParaEscolher = (() => {
    const keys = new Set<string>()
    for (const f of validos) {
      for (const it of f.itens_precos) {
        if (it.descricao.trim() && it.valor_total > 0) {
          keys.add(it.descricao.toLowerCase().trim())
        }
      }
    }
    return keys
  })()
  const itensEscolhidos = Array.from(itensParaEscolher).filter(k => selecaoPorItem.has(k)).length
  const itensPendentes = itensParaEscolher.size - itensEscolhidos
  const precisaEscolherFornecedores = validos.length >= 2 && itensParaEscolher.size > 0 && itensPendentes > 0

  // Itens da RC (ainda não atendidos por um pedido anterior) que nenhum fornecedor
  // válido cotou — aviso não bloqueante: o comprador pode enviar assim mesmo, mas
  // fica ciente de que vai precisar reabrir cotação pra esses itens depois.
  const rcItensNaoCotados = (((cotacao?.requisicao as any)?.itens ?? []) as any[])
    .filter(it => !it.atendido_em_pedido_id)
    .map(it => String(it.descricao ?? '').trim())
    .filter(desc => desc && !itensParaEscolher.has(desc.toLowerCase()))

  // Itens da RC cuja quantidade na proposta ESCOLHIDA (seleção por item ou menor
  // preço entregue) veio menor que a da RC — fornecedor sem a quantidade cheia.
  // A qtd da linha de outros fornecedores não importa: só o que será comprado.
  const computeReducoes = () => {
    const rcItens = (((cotacao?.requisicao as any)?.itens ?? []) as any[])
      .filter(it => !it.atendido_em_pedido_id)
    const menorPreco = validos.reduce<FornecedorForm | undefined>(
      (best, f) => (!best || calcTotalEntregue(f) < calcTotalEntregue(best) ? f : best),
      undefined,
    )
    const reducoes: { item_id: string; descricao: string; unidade: string; qtd_rc: number; qtd_nova: number }[] = []
    for (const it of rcItens) {
      const key = String(it.descricao ?? '').toLowerCase().trim()
      if (!key) continue
      const idxSel = selecaoPorItem.get(key)
      const escolhido = idxSel !== undefined ? fornecedores[idxSel] : menorPreco
      const linha = escolhido?.itens_precos.find(ip => ip.descricao.toLowerCase().trim() === key)
      if (!linha || !(linha.valor_total > 0)) continue // item não cotado → aviso próprio já cobre
      const qtdRc = Number(it.quantidade ?? 0)
      const qtdCotada = Number(linha.qtd ?? 0)
      if (qtdCotada > 0 && qtdCotada < qtdRc) {
        reducoes.push({
          item_id: it.id,
          descricao: String(it.descricao ?? ''),
          unidade: String(it.unidade ?? 'un'),
          qtd_rc: qtdRc,
          qtd_nova: qtdCotada,
        })
      }
    }
    return reducoes
  }

  const fornecedoresComCondicaoInvalida = validos
    .map((f, i) => ({ idx: i + 1, nome: f.fornecedor_nome, cond: f.condicao_pagamento }))
    .filter(f => f.cond.trim() && !condicaoPagamentoInterpretavel(f.cond))

  // Validação + feedback claro em cada etapa
  const canSubmit = validos.length > 0
    && (semCotacoesMinimas || validos.length >= minCot)
    && (!semCotacoesMinimas || justificativa.trim().length > 0)
    && !temNaoCadastrados
    && !precisaEscolherFornecedores
    && fornecedoresComCondicaoInvalida.length === 0

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
    if (temNaoCadastrados) {
      setToast({ type: 'error', msg: 'Há fornecedor(es) ainda não cadastrado(s). Clique em "Cadastrar agora" no card antes de enviar.' })
      return
    }
    if (precisaEscolherFornecedores) {
      setToast({ type: 'error', msg: `Escolha o fornecedor de cada item no mapa de cotação (${itensPendentes} pendente${itensPendentes > 1 ? 's' : ''}).` })
      return
    }
    if (fornecedoresComCondicaoInvalida.length > 0) {
      const nomes = fornecedoresComCondicaoInvalida.map(f => f.nome || `Fornecedor ${f.idx}`).join(', ')
      setToast({
        type: 'error',
        msg: `Condição de pagamento não interpretada em: ${nomes}. Use "à vista", "30 dias", "30/60/90", "Entrada+30" ou "Nx" — senão a parcela do pedido fica "Revisar manualmente".`,
      })
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

    // Fornecedor escolhido sem a quantidade cheia de algum item → o comprador
    // decide o destino do saldo antes do envio (modal). O envio continua em
    // confirmarSaldo, depois do RPC de ajuste.
    const reducoes = computeReducoes()
    if (reducoes.length > 0) {
      setSaldoPrompt(reducoes)
      return
    }

    await doEnviar()
  }

  const doEnviar = async (msgExtra?: string) => {
    if (!id || !cotacao) return
    try {
      // Mapeia índice em 'fornecedores' (original) → índice em 'validos'
      const validosIdxMap = new Map<number, number>()
      let v = 0
      fornecedores.forEach((f, i) => {
        if (f.fornecedor_nome.trim() && f.valor_total > 0) {
          validosIdxMap.set(i, v)
          v++
        }
      })
      const chaveDescricao = (s: string) => s.toLowerCase().trim()

      await submitMutation.mutateAsync({
        cotacao_id: id,
        requisicao_id: cotacao.requisicao_id,
        empresa_id: empresaId || empresaMatrizId || null,
        fornecedores: validos.map((f, validosIdx) => {
          const itensComSelecao = f.itens_precos.map(item => {
            const key = chaveDescricao(item.descricao)
            const fornIdxOriginal = selecaoPorItem.get(key)
            const fornIdxEmValidos = fornIdxOriginal !== undefined ? validosIdxMap.get(fornIdxOriginal) : undefined
            const selecionado = fornIdxEmValidos === validosIdx
            const { sugestao: _sugestao, ...itemSemSugestao } = item
            return {
              ...itemSemSugestao,
              descricao: toUpperNorm(item.descricao),
              selecionado,
            }
          })
          return {
            id:                 f.id,
            fornecedor_nome:    toUpperNorm(f.fornecedor_nome),
            fornecedor_contato: joinFornecedorContato(f.fornecedor_telefone, f.fornecedor_email, f.fornecedor_contato) || undefined,
            fornecedor_telefone: f.fornecedor_telefone || undefined,
            fornecedor_email:   f.fornecedor_email || undefined,
            fornecedor_cnpj:    f.fornecedor_cnpj || undefined,
            valor_total:        calcTotalEntregue(f),
            valor_frete:        f.valor_frete || undefined,
            prazo_entrega_dias: f.prazo_entrega_dias || undefined,
            condicao_pagamento: f.condicao_pagamento ? toUpperNorm(f.condicao_pagamento) : undefined,
            observacao:         f.observacao ? toUpperNorm(f.observacao) : undefined,
            arquivo_urls:       f.arquivo_urls,
            itens_precos:       itensComSelecao.length > 0 ? itensComSelecao : undefined,
          }
        }),
        sem_cotacoes_minimas: semCotacoesMinimas,
        justificativa_sem_cotacoes: semCotacoesMinimas ? toUpperNorm(justificativa.trim()) : undefined,
        fornecedores_removidos_ids: fornecedoresRemovidosIds,
      })
      setToast({ type: 'success', msg: `Cotação enviada para aprovação!${msgExtra ? ` ${msgExtra}` : ''}` })
      setTimeout(() => nav('/cotacoes'), msgExtra ? 1600 : 800)
    } catch (err) {
      console.error('[CotacaoForm] Erro ao enviar:', err)
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setToast({ type: 'error', msg: `Erro ao enviar cotação: ${msg}` })
    }
  }

  // Resposta do modal de saldo: ajusta as quantidades da RC (RPC) e segue o envio.
  // gerarComplementar=true também cria a RC-filha (numero-B) com o restante.
  const confirmarSaldo = async (gerarComplementar: boolean) => {
    if (!id || !saldoPrompt || saldoPrompt.length === 0) return
    setSaldoBusy(true)
    try {
      const { data, error } = await supabase.rpc('cmp_ajustar_qtd_cotacao', {
        p_cotacao_id: id,
        p_ajustes: saldoPrompt.map(r => ({ item_id: r.item_id, qtd_nova: r.qtd_nova })),
        p_gerar_complementar: gerarComplementar,
      })
      if (error) throw new Error(error.message)
      const childNumero = (data as any)?.child_numero as string | undefined
      setSaldoPrompt(null)
      await doEnviar(
        gerarComplementar && childNumero
          ? `RC complementar ${childNumero} criada com o saldo — já está na fila de cotação.`
          : undefined,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setToast({ type: 'error', msg: `Erro ao ajustar quantidades: ${msg}` })
    } finally {
      setSaldoBusy(false)
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
            {canOverride && (
              <button
                type="button"
                onClick={assumeControl}
                className="mt-2 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition">
                Assumir edição (Admin)
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => nav('/cotacoes')} className="p-1">
            <ChevronLeft size={18} className="text-slate-500" />
          </button>
          <h2 className="text-lg font-extrabold text-slate-800">Inserir Cotação</h2>
        </div>
        <div className="flex items-center gap-2">
          {fornecedores.some(f => f.id) && (
            <button
              type="button"
              title="Remove os fornecedores já salvos nesta cotação e volta pra 1 card em branco. Os itens da RC continuam disponíveis normalmente."
              onClick={() => {
                if (!confirm('Recomeçar a cotação? Os fornecedores já salvos nesta cotação serão removidos ao enviar. Os itens da RC continuam disponíveis pra escolher de novo.')) return
                resetFornecedores()
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
            >
              <RotateCcw size={13} />
              Recomeçar
            </button>
          )}
          {cotacao && (
            <button
              type="button"
              onClick={() => gerarSolicitacaoCotacao(cotacao, empresaId)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold shadow-sm shadow-violet-500/20 transition-colors"
            >
              <Printer size={13} />
              Solicitar Cotação
            </button>
          )}
        </div>
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

      {/* Empresa do grupo em nome da qual a cotação é solicitada (multi-empresa) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <label className="block text-xs font-bold text-slate-600 mb-1.5">Empresa Compradora</label>
        <select
          value={empresaId}
          onChange={e => handleEmpresaChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
        >
          {empresas.length === 0 && <option value="">Carregando empresas...</option>}
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.nome_fantasia || emp.razao_social}
              {emp.cnpjs?.[0] ? ` • ${maskCNPJ(emp.cnpjs[0])}` : ''}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-slate-400 mt-1.5">
          O fornecedor deve emitir a proposta e a NF para esta empresa. Ela sai no PDF de Solicitar Cotação e é sugerida na emissão do pedido.
        </p>
      </div>

      {/* Upload inteligente com IA — OCULTADO 2026-07-03: gerava muita divergência
          na cotação (IA lê PDF/imagem e preenche preços errados). Reativar: trocar false por true. */}
      {false && (
      <UploadCotacao
        onParsed={handleAiParsed}
        disabled={cotacao?.status === 'concluida' || isLocked}
        cotacaoId={id}
        requisicaoId={cotacao?.requisicao_id}
      />
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
      {fornecedores.map((forn, idx) => {
        const cnpjDigits = String(forn.fornecedor_cnpj ?? '').replace(/\D/g, '')
        const precisaCadastrar = cnpjDigits.length === 14 && naoCadastradosCnpjs.has(cnpjDigits)
        return (
        <div key={idx} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 ${
          precisaCadastrar ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'
        }`}>
          {/* Header do card */}
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-[10px] font-black text-white">
                {idx + 1}
              </span>
              <span className="text-xs font-bold text-slate-700">Fornecedor {idx + 1}</span>
              {forn.fornecedor_nome.trim() && forn.valor_total > 0 && !precisaCadastrar && (
                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">✓ Válido</span>
              )}
            </div>
            {fornecedores.length > 1 && (
              <button type="button" onClick={() => removeFornecedor(idx)}
                className="p-1 rounded-lg hover:bg-red-50 transition">
                <Trash2 size={14} className="text-red-400 hover:text-red-600 transition" />
              </button>
            )}
          </div>

          {/* Banner — fornecedor não cadastrado (bloqueia envio) */}
          {precisaCadastrar && (
            <div className="mx-4 mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-amber-900">Fornecedor não cadastrado</p>
                  <p className="text-[11px] text-amber-700 leading-tight">É obrigatório cadastrar antes de enviar a cotação.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCadastroModalIdx(idx)}
                className="shrink-0 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-colors"
              >
                <PlusCircle size={14} /> Cadastrar agora
              </button>
            </div>
          )}

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
                  if ((fornResults[idx]?.length ?? 0) > 0)
                    setFornOpen(prev => ({ ...prev, [idx]: true }))
                  else
                    searchFornecedor(idx, forn.fornecedor_nome)
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

            {/* Atalho: cadastrar fornecedor que não está na base (fluxo manual).
                Abre o mesmo modal pré-preenchido com o que já foi digitado. */}
            {!precisaCadastrar && (
              <button
                type="button"
                onClick={() => setCadastroModalIdx(idx)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition"
              >
                <PlusCircle size={12} /> Não encontrou? Cadastrar novo fornecedor
              </button>
            )}

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

            {/* ── Leitura de IA escopada a este fornecedor ──────────────────────
                Preenche só o que estiver em branco (nome/CNPJ/condição) e o preço
                dos itens ainda zerados — não mexe no que já foi digitado à mão.
                OCULTADO 2026-07-03: mesma decisão do upload global (muita divergência).
                Reativar: trocar false por true. */}
            {false && (
            <UploadCotacao
              onParsed={(parsed, file) => handleFornecedorParsed(idx, parsed, file)}
              disabled={cotacao?.status === 'concluida' || isLocked}
              cotacaoId={id}
              requisicaoId={cotacao?.requisicao_id}
            />
            )}

            {/* ── Itens e Preços ─────────────────────────────────────────────── */}
            <ItemPricingTable
              items={forn.itens_precos}
              onChange={items => updateFornecedorItems(idx, items)}
              reqItens={(cotacao?.requisicao as any)?.itens ?? []}
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold">
                  {calcTotalItems(forn.itens_precos) > 0
                    ? (cotacao?.requisicao as any)?.compra_recorrente ? 'Valor Mensal (calculado)' : 'Produtos (calculado)'
                    : (cotacao?.requisicao as any)?.compra_recorrente ? 'Valor Mensal *' : 'Produtos *'}
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
                <label className="text-[10px] text-slate-400 font-semibold">Frete (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">R$</span>
                  <NumericInput
                    min={0} step={0.01}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow"
                    value={forn.valor_frete}
                    onChange={v => updateFornecedor(idx, 'valor_frete', v)}
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

            {forn.valor_frete > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-100 px-3 py-1.5">
                <span className="text-[11px] font-semibold text-teal-600">Total entregue (produtos + frete)</span>
                <span className="text-sm font-bold text-teal-700">{fmt(calcTotalEntregue(forn))}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <input
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none transition-shadow ${
                    forn.condicao_pagamento.trim() && !condicaoPagamentoInterpretavel(forn.condicao_pagamento)
                      ? 'border-red-300 bg-red-50/40'
                      : 'border-slate-200'
                  }`}
                  placeholder="Condição de pgto (30 dias, à vista, 30/60/90, 3x...)"
                  maxLength={255}
                  value={forn.condicao_pagamento}
                  onChange={e => updateFornecedor(idx, 'condicao_pagamento', e.target.value)}
                />
                {forn.condicao_pagamento.trim() && !condicaoPagamentoInterpretavel(forn.condicao_pagamento) && (
                  <p className="mt-1 text-[10px] text-red-600 leading-snug">
                    Não interpretado. Use: "à vista", "30 dias", "30/60/90", "Entrada+30" ou "Nx".
                  </p>
                )}
              </div>
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

            {/* ── Anexos da Cotação ────────────────────────────────────────── */}
            <div className="pt-1 space-y-1.5">
              <input
                ref={el => { fileInputRefs.current[idx] = el }}
                type="file"
                accept={FILE_ACCEPTED.join(',')}
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? [])
                  files.forEach(file => handleFileUpload(idx, file))
                  if (fileInputRefs.current[idx]) fileInputRefs.current[idx]!.value = ''
                }}
              />

              {forn.arquivo_urls.map((url, fileIdx) => (
                /* Arquivo anexado */
                <div key={url} className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-700 truncate">
                      Cotação anexada
                    </p>
                    <p className="text-[10px] text-emerald-500 truncate">
                      {url.split('/').pop()?.replace(/^\d+_/, '') ?? 'arquivo'}
                    </p>
                  </div>
                  <button type="button" onClick={() => viewFile(url)}
                    className="p-1.5 rounded-lg hover:bg-emerald-100 transition" title="Visualizar">
                    <Eye size={14} className="text-emerald-600" />
                  </button>
                  <button type="button" onClick={() => removeFile(idx, fileIdx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition" title="Remover">
                    <X size={14} className="text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}

              {uploading[idx] && (
                /* Fazendo upload */
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Loader2 size={16} className="text-amber-600 animate-spin flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Enviando arquivo...</p>
                </div>
              )}

              {/* Botão de upload — sempre visível, permite anexar mais de um arquivo */}
              <button
                type="button"
                onClick={() => fileInputRefs.current[idx]?.click()}
                className="w-full flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2.5 hover:border-violet-400 hover:bg-violet-50/30 transition-all group"
              >
                <Paperclip size={14} className="text-slate-400 group-hover:text-violet-500 transition" />
                <span className="text-xs text-slate-400 group-hover:text-violet-600 font-semibold transition">
                  {forn.arquivo_urls.length > 0 ? 'Anexar mais um arquivo' : 'Anexar cotação (PDF, foto)'}
                </span>
              </button>

              {uploadError[idx] && (
                <p className="text-[11px] text-red-500 mt-1 pl-1">{uploadError[idx]}</p>
              )}
            </div>
          </div>
        </div>
      )})}

      {/* Adicionar fornecedor */}
      <button
        type="button"
        onClick={() => setFornecedores(p => [...p, { ...emptyFornecedor(), itens_precos: itensPendentesDaRC() }])}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-teal-600 border-2 border-dashed border-teal-300 rounded-2xl hover:bg-teal-50 transition"
      >
        <PlusCircle size={14} /> Adicionar Fornecedor
      </button>

      {/* Barra de escolha do mapa — instrui o usuário e oferece atalho */}
      {validos.length >= 2 && itensParaEscolher.size > 0 && (
        <div className={`rounded-2xl border-2 px-4 py-3 flex items-center justify-between gap-3 ${
          itensPendentes > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {itensPendentes > 0
              ? <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              : <CheckCircle size={18} className="text-emerald-600 shrink-0" />}
            <div className="min-w-0">
              <p className={`text-xs font-extrabold ${itensPendentes > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                {itensPendentes > 0
                  ? `Escolha o fornecedor de cada item (${itensEscolhidos}/${itensParaEscolher.size})`
                  : `Todos os itens têm fornecedor escolhido (${itensEscolhidos}/${itensParaEscolher.size})`}
              </p>
              <p className={`text-[11px] leading-tight ${itensPendentes > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                Clique no valor do fornecedor na tabela abaixo para definir quem fornece cada item.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={selecionarMenorPrecoEmTodos}
            className="shrink-0 inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-colors"
            title="Preenche o mapa escolhendo o fornecedor de menor preço em cada item"
          >
            Menor preço em todos
          </button>
        </div>
      )}

      {/* Comparativo inline (quando ≥ 2 válidos) */}
      {validos.length >= 2 && (() => {
        // Mapeia índice de 'validos' → índice original em 'fornecedores' (estado)
        const idxMap: number[] = []
        fornecedores.forEach((f, i) => {
          if (f.fornecedor_nome.trim() && f.valor_total > 0) idxMap.push(i)
        })
        const chaveDescricao = (s: string) => s.toLowerCase().trim()
        // selecaoPorItem guarda index ORIGINAL; o Comparativo precisa do 'id' (que é String(i) com i = idx em 'validos')
        const selecaoPorItemParaComparativo = new Map<string, string>()
        for (const [key, idxOriginal] of selecaoPorItem) {
          const idxEmValidos = idxMap.indexOf(idxOriginal)
          if (idxEmValidos >= 0) selecaoPorItemParaComparativo.set(key, String(idxEmValidos))
        }
        return (
          <CotacaoComparativo
            fornecedores={validos.map((f, i) => ({
              id: String(i),
              cotacao_id: id ?? '',
              fornecedor_nome: f.fornecedor_nome,
              fornecedor_contato: joinFornecedorContato(f.fornecedor_telefone, f.fornecedor_email, f.fornecedor_contato) || undefined,
              fornecedor_telefone: f.fornecedor_telefone || undefined,
              fornecedor_email: f.fornecedor_email || undefined,
              fornecedor_cnpj: f.fornecedor_cnpj || undefined,
              valor_total: calcTotalEntregue(f),
              prazo_entrega_dias: f.prazo_entrega_dias || undefined,
              condicao_pagamento: f.condicao_pagamento || undefined,
              itens_precos: f.itens_precos,
              arquivo_urls: f.arquivo_urls,
              selecionado: calcTotalEntregue(f) === Math.min(...validos.map(x => calcTotalEntregue(x))),
            }))}
            selecaoPorItem={selecaoPorItemParaComparativo}
            onSelectItem={(descricao, idStr) => {
              const idxEmValidos = Number(idStr)
              const idxOriginal = idxMap[idxEmValidos]
              if (idxOriginal === undefined) return
              setSelecaoTocada(true)
              setSelecaoPorItem(prev => {
                const next = new Map(prev)
                next.set(chaveDescricao(descricao), idxOriginal)
                return next
              })
            }}
          />
        )
      })()}

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
        <div ref={toastRef} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 ${
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

      {rcItensNaoCotados.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            <strong>{rcItensNaoCotados.length} item{rcItensNaoCotados.length > 1 ? 's' : ''} da RC sem cotação de nenhum fornecedor:</strong>{' '}
            {rcItensNaoCotados.join(', ')}. Pode enviar assim mesmo — depois será preciso reabrir uma cotação pra esses itens.
          </span>
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
        <p className={`text-xs text-center ${(temNaoCadastrados || precisaEscolherFornecedores) ? 'text-amber-700 font-bold' : 'text-slate-400'}`}>
          {temNaoCadastrados
            ? 'Cadastre o(s) fornecedor(es) destacado(s) em amarelo antes de enviar.'
            : precisaEscolherFornecedores
              ? `Escolha o fornecedor de ${itensPendentes} item${itensPendentes > 1 ? 'ns' : ''} no mapa de cotação antes de enviar.`
              : validos.length === 0
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

      {/* Modal: cadastrar novo fornecedor direto da cotação (fluxo manual ou banner) */}
      {cadastroModalIdx !== null && fornecedores[cadastroModalIdx] && (
        <FornecedorCadastroModal
          open
          title="Cadastrar fornecedor"
          description="Cadastre o fornecedor para usá-lo nesta cotação e no Financeiro."
          initialData={{
            razao_social: fornecedores[cadastroModalIdx].fornecedor_nome,
            nome_fantasia: fornecedores[cadastroModalIdx].fornecedor_nome,
            cnpj: fornecedores[cadastroModalIdx].fornecedor_cnpj,
            telefone: fornecedores[cadastroModalIdx].fornecedor_telefone,
            email: fornecedores[cadastroModalIdx].fornecedor_email,
          }}
          onClose={() => setCadastroModalIdx(null)}
          onSaved={(saved) => {
            const savedDigits = String(saved.cnpj ?? '').replace(/\D/g, '')
            setNaoCadastradosCnpjs(prev => {
              const next = new Set(prev)
              next.delete(savedDigits)
              return next
            })
            setFornecedores(prev => prev.map((f, i) => i === cadastroModalIdx ? {
              ...f,
              fornecedor_nome: toUpperNorm(saved.nome_fantasia || saved.razao_social || f.fornecedor_nome),
              fornecedor_cnpj: maskCNPJ(saved.cnpj || f.fornecedor_cnpj),
              fornecedor_telefone: saved.telefone || f.fornecedor_telefone,
              fornecedor_email: saved.email || f.fornecedor_email,
              fornecedor_contato: joinFornecedorContato(
                saved.telefone || f.fornecedor_telefone,
                saved.email || f.fornecedor_email,
                saved.contato_nome || '',
              ),
            } : f))
            setCadastroModalIdx(null)
            setToast({ type: 'success', msg: 'Fornecedor cadastrado com sucesso.' })
          }}
        />
      )}

      {/* Modal: destino do saldo de quantidade (fornecedor sem a qtd cheia) */}
      {saldoPrompt && saldoPrompt.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => !saldoBusy && setSaldoPrompt(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 flex items-center gap-3">
              <PackagePlus size={20} className="text-white" />
              <div>
                <p className="text-sm font-bold text-white">Quantidade menor que a pedida</p>
                <p className="text-[11px] text-white/80">
                  O fornecedor escolhido não cobre a quantidade total da RC.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <ul className="space-y-1.5">
                {saldoPrompt.map(r => (
                  <li key={r.item_id} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700">
                    <span className="font-bold">{r.descricao}</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Cotado {r.qtd_nova} de {r.qtd_rc} {r.unidade} — saldo de {r.qtd_rc - r.qtd_nova} {r.unidade}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                O que deseja fazer com o restante? A RC seguirá para aprovação apenas com a
                quantidade cotada. A RC complementar entra na fila de cotação com o saldo,
                numerada como {(cotacao?.requisicao as any)?.numero ?? 'RC'}-B.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  disabled={saldoBusy}
                  onClick={() => confirmarSaldo(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {saldoBusy
                    ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <PackagePlus size={14} />}
                  Gerar RC complementar com o saldo
                </button>
                <button
                  type="button"
                  disabled={saldoBusy}
                  onClick={() => confirmarSaldo(false)}
                  className="w-full py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                >
                  Desconsiderar o restante
                </button>
                <button
                  type="button"
                  disabled={saldoBusy}
                  onClick={() => setSaldoPrompt(null)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Voltar e revisar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
