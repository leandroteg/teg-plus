import { useState } from 'react'
import { X, PlusCircle, Trash2, Loader2, AlertTriangle, ShoppingCart } from 'lucide-react'
import { useEmitirPedidoDireto } from '../hooks/usePedidos'
import { useCadFornecedores, useCadClasses } from '../hooks/useCadastros'
import { useLookupObras } from '../hooks/useLookups'
import { useAuth } from '../contexts/AuthContext'
import NumericInput from './NumericInput'
import { toUpperNorm } from './UpperInput'

interface ItemDireto {
  descricao: string
  quantidade: number
  unidade: string
  valor_unitario: number
}

const emptyItem = (): ItemDireto => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0 })

const UNIDADES = ['un', 'par', 'jg', 'kg', 'ton', 'm', 'm²', 'm³', 'L', 'pc', 'cx', 'rl', 'hr', 'vb', 'sc']

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (numeroPedido: string) => void
}

export default function PedidoDiretoModal({ open, onClose, onSuccess }: Props) {
  const { perfil } = useAuth()
  const emitir = useEmitirPedidoDireto()

  const { data: fornecedores = [] } = useCadFornecedores()
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const obras = useLookupObras()

  const [fornecedorNome, setFornecedorNome] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [obraId, setObraId] = useState('')
  const [classeId, setClasseId] = useState('')
  const [classeBusca, setClasseBusca] = useState('')
  const [classeDropdown, setClasseDropdown] = useState(false)
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemDireto[]>([emptyItem()])
  const [erro, setErro] = useState<string | null>(null)

  if (!open) return null

  const classesFiltradas = classes
    .filter(c => {
      const t = classeBusca.toLowerCase()
      return !t || `${c.codigo} ${c.descricao}`.toLowerCase().includes(t)
    })
    .slice(0, 10)

  const classeSel = classes.find(c => c.id === classeId)
  const obraSel = obras.find(o => o.id === obraId)

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function updateItem(idx: number, field: keyof ItemDireto, value: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function handleFornecedorSelect(id: string) {
    const f = fornecedores.find(f => f.id === id)
    setFornecedorId(id)
    if (f) setFornecedorNome(f.nome_fantasia || f.razao_social || '')
  }

  async function handleSubmit() {
    setErro(null)
    if (!fornecedorNome.trim()) return setErro('Informe o fornecedor.')
    if (itens.every(i => !i.descricao.trim())) return setErro('Adicione ao menos 1 item com descrição.')
    if (!justificativa.trim()) return setErro('Informe a justificativa para dispensar Requisição/Cotação.')

    const itensFiltrados = itens.filter(i => i.descricao.trim())

    try {
      const result = await emitir.mutateAsync({
        fornecedorNome: toUpperNorm(fornecedorNome),
        fornecedorId: fornecedorId || undefined,
        valorTotal: total,
        itens: itensFiltrados.map(i => ({
          ...i,
          descricao: toUpperNorm(i.descricao),
        })),
        obraId: obraId || undefined,
        obraNome: obraSel?.nome,
        centroCusto: obraSel?.centro_custo_codigo || undefined,
        centroCustoId: obraSel?.centro_custo_id || undefined,
        classeFinanceira: classeSel ? `${classeSel.codigo} - ${classeSel.descricao}` : undefined,
        classeFinanceiraId: classeId || undefined,
        condicaoPagamento: condicaoPagamento || undefined,
        dataPrevistaEntrega: dataPrevistaEntrega || undefined,
        justificativaSemCotacao: toUpperNorm(justificativa),
        observacoes: observacoes ? toUpperNorm(observacoes) : undefined,
        compradorId: perfil?.id,
      })
      onSuccess?.(result.numero_pedido)
      onClose()
    } catch (e) {
      setErro((e as Error).message || 'Erro ao emitir pedido.')
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
              <ShoppingCart size={16} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Pedido Direto</h2>
              <p className="text-[11px] text-slate-400">Sem Requisição nem Cotação</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Aviso */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Este pedido será marcado como <strong>Sem Cotação</strong> e ficará visível nos relatórios de compras sem processo formal.
            </p>
          </div>

          {/* Fornecedor */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">Fornecedor *</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
              value={fornecedorId}
              onChange={e => handleFornecedorSelect(e.target.value)}
            >
              <option value="">Selecionar do cadastro...</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
              ))}
            </select>
            {!fornecedorId && (
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none"
                placeholder="Ou digite o nome do fornecedor..."
                value={fornecedorNome}
                onChange={e => setFornecedorNome(e.target.value.toUpperCase())}
              />
            )}
          </div>

          {/* Obra */}
          <div>
            <label className="text-xs font-bold text-slate-600">Obra / Projeto</label>
            <select
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
              value={obraId}
              onChange={e => setObraId(e.target.value)}
            >
              <option value="">Selecione a obra...</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>
              ))}
            </select>
          </div>

          {/* Classe Financeira */}
          <div>
            <label className="text-xs font-bold text-slate-600">Classe Financeira</label>
            <div className="relative mt-1">
              <input
                value={classeId ? `${classeSel?.codigo} - ${classeSel?.descricao}` : classeBusca}
                onChange={e => { setClasseBusca(e.target.value); setClasseId(''); setClasseDropdown(true) }}
                onFocus={() => setClasseDropdown(true)}
                onBlur={() => setTimeout(() => setClasseDropdown(false), 150)}
                placeholder="Buscar por código ou descrição..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
              {classeDropdown && classesFiltradas.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {classesFiltradas.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => { setClasseId(c.id); setClasseBusca(''); setClasseDropdown(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-semibold text-slate-700">{c.codigo}</span>
                      <span className="text-slate-500 truncate">{c.descricao}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Condição e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600">Cond. Pagamento</label>
              <input
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none"
                placeholder="Ex: 30 DDL"
                value={condicaoPagamento}
                onChange={e => setCondicaoPagamento(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Previsão de Entrega</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
                value={dataPrevistaEntrega}
                onChange={e => setDataPrevistaEntrega(e.target.value)}
              />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600">Itens *</label>
              <button
                type="button"
                onClick={() => setItens(p => [...p, emptyItem()])}
                className="text-orange-600 text-xs flex items-center gap-1 font-semibold"
              >
                <PlusCircle size={13} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Item {idx + 1}</span>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>
                        <Trash2 size={13} className="text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                    placeholder="Descrição do item..."
                    value={item.descricao}
                    onChange={e => updateItem(idx, 'descricao', e.target.value.toUpperCase())}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">Qtd</label>
                      <NumericInput
                        min={0.01} step={0.01}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                        value={item.quantidade}
                        onChange={v => updateItem(idx, 'quantidade', v)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Unidade</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                        value={item.unidade}
                        onChange={e => updateItem(idx, 'unidade', e.target.value)}
                      >
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Vlr. Unit.</label>
                      <NumericInput
                        min={0} step={0.01}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                        value={item.valor_unitario}
                        onChange={v => updateItem(idx, 'valor_unitario', v)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="mt-2 flex justify-end">
                <span className="text-sm font-extrabold text-orange-600">{fmt(total)}</span>
              </div>
            )}
          </div>

          {/* Justificativa (obrigatória) */}
          <div>
            <label className="text-xs font-bold text-slate-600">
              Justificativa para dispensa de RC/Cotação *
            </label>
            <textarea
              rows={3}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none resize-none"
              placeholder="Ex: COMPRA DE EMERGÊNCIA, FORNECEDOR ÚNICO, VALOR ABAIXO DO LIMITE..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value.toUpperCase())}
            />
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-bold text-slate-600">Observações</label>
            <textarea
              rows={2}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none resize-none"
              placeholder="Informações adicionais..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value.toUpperCase())}
            />
          </div>

          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <AlertTriangle size={13} className="shrink-0" /> {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={emitir.isPending}
            className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-orange-500/20 transition-colors"
          >
            {emitir.isPending
              ? <><Loader2 size={15} className="animate-spin" /> Emitindo...</>
              : <><ShoppingCart size={15} /> Emitir Pedido Direto</>}
          </button>
        </div>
      </div>
    </div>
  )
}
