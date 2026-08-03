import { useState, useMemo, useEffect } from 'react'
import { X, PlusCircle, Trash2, Loader2, AlertTriangle, ShoppingCart, Search, UserPlus, CheckCircle2, Landmark } from 'lucide-react'
import { useEmitirPedidoDireto, useEditarPedidoDireto } from '../hooks/usePedidos'
import { useCadFornecedores, useCadClasses, useSalvarFornecedor } from '../hooks/useCadastros'
import { useLookupObras, useLookupEmpresas } from '../hooks/useLookups'
import { useCartoesCredito } from '../hooks/useCartoes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import NumericInput from './NumericInput'
import { toUpperNorm } from './UpperInput'

type FormaPagamentoPedido = 'pix' | 'cartao' | 'boleto' | 'transferencia'
const FORMA_PAGAMENTO_OPTIONS: Array<{ value: FormaPagamentoPedido; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
]

const soDigitos = (s: string) => s.replace(/\D/g, '')

// 12345678000199 -> 12.345.678/0001-99 (parcial conforme digita)
function fmtCnpj(s: string) {
  const d = soDigitos(s).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

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
  /** Modo edição: pedido extraordinário já emitido. Todos os campos editáveis, exceto fornecedor. */
  pedido?: any
}

export default function PedidoDiretoModal({ open, onClose, onSuccess, pedido }: Props) {
  const { perfil } = useAuth()
  const emitir = useEmitirPedidoDireto()
  const editar = useEditarPedidoDireto()
  const editMode = !!pedido

  const { data: fornecedores = [] } = useCadFornecedores()
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const obras = useLookupObras()
  const empresas = useLookupEmpresas()

  const salvarFornecedor = useSalvarFornecedor()
  const { data: cartoes = [] } = useCartoesCredito()

  const [fornecedorNome, setFornecedorNome] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedorBusca, setFornecedorBusca] = useState('')
  const [fornecedorDropdown, setFornecedorDropdown] = useState(false)
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false)
  const [novoForn, setNovoForn] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', telefone: '', email: '' })
  const [obraId, setObraId] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [classeId, setClasseId] = useState('')
  const [classeBusca, setClasseBusca] = useState('')
  const [classeDropdown, setClasseDropdown] = useState(false)
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoPedido | ''>('')
  const [cartaoId, setCartaoId] = useState('')
  // Dados bancários/PIX do fornecedor — preenchidos aqui quando o cadastro não
  // tem, e salvos de volta em cmp_fornecedores no submit (mesmo fluxo do
  // EmitirPedidoModal). Boleto/cartão dispensam dados bancários.
  const [bancoBoleto, setBancoBoleto] = useState(false)
  const [bancoCartao, setBancoCartao] = useState(false)
  const [bancoPix, setBancoPix] = useState('')
  const [bancoPixTipo, setBancoPixTipo] = useState('')
  const [bancoBancoNome, setBancoBancoNome] = useState('')
  const [bancoAgencia, setBancoAgencia] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState('')
  const [valorDesconto, setValorDesconto] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemDireto[]>([emptyItem()])
  const [erro, setErro] = useState<string | null>(null)

  // Empresa emitente. Default = Matriz (EMP-001), editável.
  const empresaMatrizId = useMemo(() => {
    if (empresas.length === 0) return ''
    return empresas.find(e => e.codigo === 'EMP-001')?.id ?? empresas[0].id
  }, [empresas])

  useEffect(() => {
    if (open && !editMode) setEmpresaId(empresaMatrizId)
  }, [open, editMode, empresaMatrizId])

  // Modo edição: preenche o form com os dados do pedido emitido
  useEffect(() => {
    if (!open || !pedido) return
    setFornecedorNome(pedido.fornecedor_nome ?? '')
    setFornecedorId(pedido.fornecedor_id ?? '')
    setEmpresaId(pedido.empresa_id ?? '')
    setClasseId(pedido.classe_financeira_id ?? '')
    setCondicaoPagamento(pedido.condicao_pagamento ?? '')
    setDataPrevistaEntrega(pedido.data_prevista_entrega ?? '')
    setValorDesconto(Number(pedido.valor_desconto ?? 0))
    setJustificativa(pedido.justificativa_sem_cotacao ?? '')
    setObservacoes(pedido.observacoes ?? '')
    setItens(pedido.itens_direto?.length ? pedido.itens_direto.map((i: any) => ({ ...i })) : [emptyItem()])
    // Forma de pagamento/cartão vivem na parcela do Contas a Pagar
    supabase
      .from('fin_contas_pagar')
      .select('forma_pagamento, cartao_id')
      .eq('pedido_id', pedido.id)
      .in('status', ['previsto', 'confirmado'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setFormaPagamento((data?.forma_pagamento as FormaPagamentoPedido) ?? '')
        setCartaoId(data?.cartao_id ?? '')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id])

  // Modo edição: resolve a obra a partir do centro de custo gravado no pedido
  useEffect(() => {
    if (!open || !pedido?.centro_custo_id || obras.length === 0) return
    const o = obras.find((x: any) => x.centro_custo_id === pedido.centro_custo_id)
    if (o) setObraId(o.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id, obras])

  if (!open) return null

  const classesMatches = classes.filter(c => {
    if ((c as any).ativo === false) return false
    const t = classeBusca.toLowerCase()
    return !t || `${c.codigo} ${c.descricao}`.toLowerCase().includes(t)
  })
  const classesFiltradas = classesMatches.slice(0, 50)

  const classeSel = classes.find(c => c.id === classeId)
  const obraSel = obras.find(o => o.id === obraId)

  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const total = Math.max(0, Math.round((subtotal - (valorDesconto || 0)) * 100) / 100)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function updateItem(idx: number, field: keyof ItemDireto, value: string | number) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  // Busca por nome (fantasia/razão) ou CNPJ (compara só dígitos)
  const buscaDigitos = soDigitos(fornecedorBusca)
  const fornecedoresFiltrados = fornecedores
    .filter(f => {
      const t = fornecedorBusca.trim().toLowerCase()
      if (!t) return false
      const porNome = `${f.nome_fantasia ?? ''} ${f.razao_social ?? ''}`.toLowerCase().includes(t)
      const porCnpj = buscaDigitos.length >= 3 && soDigitos(f.cnpj ?? '').includes(buscaDigitos)
      return porNome || porCnpj
    })
    .slice(0, 10)

  const fornecedorSel = fornecedores.find(f => f.id === fornecedorId)
  const fSel = fornecedorSel as any
  // Cadastro sem nenhum meio de recebimento conhecido → oferece completar aqui
  const bankingIncomplete = !!fornecedorSel && !fSel?.boleto && !fSel?.cartao && !fSel?.pix_chave && (!fSel?.banco_nome || !fSel?.conta)
  const bankingProvided = bancoBoleto || bancoCartao || bancoPix.trim() !== '' || (bancoBancoNome.trim() !== '' && bancoConta.trim() !== '')

  function selecionarFornecedor(id: string) {
    const f = fornecedores.find(x => x.id === id) as any
    setFornecedorId(id)
    setFornecedorNome(f ? (f.nome_fantasia || f.razao_social || '') : '')
    setFornecedorBusca('')
    setFornecedorDropdown(false)
    setShowNovoFornecedor(false)
    // Infere o meio de pagamento pelo cadastro e semeia os dados bancários
    setFormaPagamento(f?.cartao ? 'cartao' : f?.boleto ? 'boleto' : f?.pix_chave ? 'pix' : (f?.banco_nome && f?.conta) ? 'transferencia' : '')
    setBancoBoleto(Boolean(f?.boleto))
    setBancoCartao(Boolean(f?.cartao))
    setBancoPix(f?.pix_chave ?? '')
    setBancoPixTipo(f?.pix_tipo ?? '')
    setBancoBancoNome(f?.banco_nome ?? '')
    setBancoAgencia(f?.agencia ?? '')
    setBancoConta(f?.conta ?? '')
  }

  function limparFornecedor() {
    setFornecedorId('')
    setFornecedorNome('')
    setFornecedorBusca('')
    setFormaPagamento('')
    setCartaoId('')
    setBancoBoleto(false)
    setBancoCartao(false)
    setBancoPix('')
    setBancoPixTipo('')
    setBancoBancoNome('')
    setBancoAgencia('')
    setBancoConta('')
  }

  function abrirNovoFornecedor() {
    setShowNovoFornecedor(true)
    setFornecedorDropdown(false)
    setNovoForn({
      razao_social: fornecedorBusca && !buscaDigitos.match(/^\d+$/) ? fornecedorBusca.toUpperCase() : '',
      nome_fantasia: '',
      cnpj: buscaDigitos.length >= 11 ? fmtCnpj(fornecedorBusca) : '',
      telefone: '', email: '',
    })
  }

  async function handleCadastrarFornecedor() {
    setErro(null)
    if (!novoForn.razao_social.trim()) return setErro('Informe a razão social do novo fornecedor.')
    const cnpjDig = soDigitos(novoForn.cnpj)
    if (cnpjDig) {
      const existente = fornecedores.find(f => soDigitos(f.cnpj ?? '') === cnpjDig)
      if (existente) {
        // CNPJ já cadastrado — seleciona o existente em vez de duplicar
        selecionarFornecedor(existente.id)
        setErro(`CNPJ já cadastrado para "${existente.nome_fantasia || existente.razao_social}" — fornecedor selecionado.`)
        return
      }
    }
    try {
      const criado = await salvarFornecedor.mutateAsync({
        razao_social: toUpperNorm(novoForn.razao_social),
        nome_fantasia: novoForn.nome_fantasia ? toUpperNorm(novoForn.nome_fantasia) : undefined,
        cnpj: novoForn.cnpj || undefined,
        telefone: novoForn.telefone || undefined,
        email: novoForn.email ? novoForn.email.toLowerCase() : undefined,
        ativo: true,
      })
      setFornecedorId(criado.id)
      setFornecedorNome(criado.nome_fantasia || criado.razao_social || '')
      setShowNovoFornecedor(false)
      setFornecedorBusca('')
    } catch (e) {
      setErro(`Erro ao cadastrar fornecedor: ${(e as Error).message}`)
    }
  }

  async function handleSubmit() {
    setErro(null)
    if (!fornecedorNome.trim()) return setErro('Informe o fornecedor.')
    if (itens.every(i => !i.descricao.trim())) return setErro('Adicione ao menos 1 item com descrição.')
    if (!justificativa.trim()) return setErro('Informe a justificativa para dispensar Requisição/Cotação.')
    if (formaPagamento === 'cartao' && !cartaoId) return setErro('Selecione qual cartão corporativo será usado.')

    const itensFiltrados = itens.filter(i => i.descricao.trim())

    if (editMode && pedido) {
      try {
        await editar.mutateAsync({
          pedidoId: pedido.id,
          valorTotal: total,
          itens: itensFiltrados.map(i => ({ ...i, descricao: toUpperNorm(i.descricao) })),
          obraNome: obraSel?.nome,
          centroCusto: obraSel?.centro_custo_codigo || undefined,
          centroCustoId: obraSel?.centro_custo_id || undefined,
          classeFinanceira: classeSel ? `${classeSel.codigo} - ${classeSel.descricao}` : undefined,
          classeFinanceiraId: classeId || undefined,
          condicaoPagamento: condicaoPagamento || undefined,
          dataPrevistaEntrega: dataPrevistaEntrega || undefined,
          justificativaSemCotacao: toUpperNorm(justificativa),
          observacoes: observacoes ? toUpperNorm(observacoes) : undefined,
          empresaId: empresaId || undefined,
          formaPagamento: formaPagamento || undefined,
          cartaoId: formaPagamento === 'cartao' ? cartaoId || undefined : undefined,
          valorDesconto: valorDesconto || undefined,
        })
        onSuccess?.(pedido.numero_pedido)
        onClose()
      } catch (e) {
        setErro((e as Error).message || 'Erro ao salvar alterações.')
      }
      return
    }

    try {
      // Completou dados bancários/PIX de fornecedor que não tinha → salva no cadastro
      if (fornecedorId && bankingIncomplete && bankingProvided) {
        await supabase.from('cmp_fornecedores').update({
          boleto: bancoBoleto,
          cartao: bancoCartao,
          ...(bancoPix.trim() ? { pix_chave: bancoPix.trim(), pix_tipo: bancoPixTipo || null } : {}),
          ...(bancoBancoNome.trim() ? { banco_nome: bancoBancoNome.trim() } : {}),
          ...(bancoAgencia.trim() ? { agencia: bancoAgencia.trim() } : {}),
          ...(bancoConta.trim() ? { conta: bancoConta.trim() } : {}),
        }).eq('id', fornecedorId)
      }
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
        empresaId: empresaId || undefined,
        formaPagamento: formaPagamento || undefined,
        cartaoId: formaPagamento === 'cartao' ? cartaoId || undefined : undefined,
        valorDesconto: valorDesconto || undefined,
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
              <h2 className="text-sm font-extrabold text-slate-800">{editMode ? `Editar ${pedido?.numero_pedido ?? 'Pedido Direto'}` : 'Pedido Direto'}</h2>
              <p className="text-[11px] text-slate-400">{editMode ? 'Todos os campos editáveis, exceto o fornecedor' : 'Sem Requisição nem Cotação'}</p>
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

          {/* Fornecedor: busca por nome/CNPJ + cadastro rápido */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600">Fornecedor *</label>

            {editMode ? (
              <div className="flex items-center justify-between gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0 text-slate-400" />
                    {fornecedorSel?.nome_fantasia || fornecedorSel?.razao_social || fornecedorNome}
                  </p>
                  <p className="text-[11px] text-slate-400 ml-5">Fornecedor não pode ser alterado — cancele o pedido se precisar trocar.</p>
                </div>
              </div>
            ) : fornecedorId && fornecedorSel ? (
              <div className="flex items-center justify-between gap-2 border border-emerald-200 bg-emerald-50 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-800 truncate flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0" />
                    {fornecedorSel.nome_fantasia || fornecedorSel.razao_social}
                  </p>
                  {fornecedorSel.cnpj && (
                    <p className="text-[11px] text-emerald-600 ml-5">CNPJ {fmtCnpj(fornecedorSel.cnpj)}</p>
                  )}
                </div>
                <button type="button" onClick={limparFornecedor} className="text-slate-400 hover:text-slate-600 shrink-0" title="Trocar fornecedor">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none"
                  placeholder="Buscar por nome ou CNPJ..."
                  value={fornecedorBusca}
                  onChange={e => { setFornecedorBusca(e.target.value.toUpperCase()); setFornecedorDropdown(true); setFornecedorNome(e.target.value.toUpperCase()) }}
                  onFocus={() => setFornecedorDropdown(true)}
                  onBlur={() => setTimeout(() => setFornecedorDropdown(false), 150)}
                />
                {fornecedorDropdown && fornecedorBusca.trim() && (
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {fornecedoresFiltrados.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onMouseDown={() => selecionarFornecedor(f.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-700 truncate">{f.nome_fantasia || f.razao_social}</span>
                        {f.cnpj && <span className="text-[11px] text-slate-400 shrink-0 font-mono">{fmtCnpj(f.cnpj)}</span>}
                      </button>
                    ))}
                    {fornecedoresFiltrados.length === 0 && (
                      <p className="px-3 py-2 text-xs text-slate-400">Nenhum fornecedor encontrado.</p>
                    )}
                    <button
                      type="button"
                      onMouseDown={abrirNovoFornecedor}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 border-t border-slate-100"
                    >
                      <UserPlus size={14} /> Cadastrar novo fornecedor
                    </button>
                  </div>
                )}
              </div>
            )}

            {showNovoFornecedor && !fornecedorId && (
              <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide flex items-center gap-1.5">
                  <UserPlus size={12} /> Novo Fornecedor
                </p>
                <input
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                  placeholder="Razão social *"
                  value={novoForn.razao_social}
                  onChange={e => setNovoForn(p => ({ ...p, razao_social: e.target.value.toUpperCase() }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                    placeholder="Nome fantasia"
                    value={novoForn.nome_fantasia}
                    onChange={e => setNovoForn(p => ({ ...p, nome_fantasia: e.target.value.toUpperCase() }))}
                  />
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none font-mono"
                    placeholder="CNPJ"
                    inputMode="numeric"
                    value={novoForn.cnpj}
                    onChange={e => setNovoForn(p => ({ ...p, cnpj: fmtCnpj(e.target.value) }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                    placeholder="Telefone"
                    value={novoForn.telefone}
                    onChange={e => setNovoForn(p => ({ ...p, telefone: e.target.value }))}
                  />
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                    placeholder="E-mail"
                    type="email"
                    value={novoForn.email}
                    onChange={e => setNovoForn(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNovoFornecedor(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCadastrarFornecedor}
                    disabled={salvarFornecedor.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                  >
                    {salvarFornecedor.isPending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                    Cadastrar e usar
                  </button>
                </div>
              </div>
            )}

            {!editMode && !fornecedorId && !showNovoFornecedor && fornecedorNome.trim() && (
              <p className="text-[11px] text-slate-400">
                Sem cadastro selecionado — o pedido sairá com o nome digitado: <strong>{fornecedorNome}</strong>
              </p>
            )}
          </div>

          {/* Empresa emitente */}
          <div>
            <label className="text-xs font-bold text-slate-600">Empresa Emitente</label>
            <select
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
            >
              {empresas.length === 0 && <option value="">Carregando empresas...</option>}
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}{emp.cnpjs?.[0] ? ` • ${emp.cnpjs[0]}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Pessoa jurídica que emite o pedido. Padrão: Matriz.</p>
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
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          {/* Natureza Orçamentária Financeira */}
          <div>
            <label className="text-xs font-bold text-slate-600">Natureza Orçamentária Financeira</label>
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
                  {classesMatches.length > classesFiltradas.length && (
                    <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 bg-slate-50">
                      Mostrando {classesFiltradas.length} de {classesMatches.length} — digite para filtrar
                    </div>
                  )}
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

          {/* Meio de pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600">Meio de Pagamento</label>
              <select
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value as FormaPagamentoPedido | '')}
              >
                <option value="">Selecionar...</option>
                {FORMA_PAGAMENTO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {formaPagamento === 'cartao' && (
              <div>
                <label className="text-xs font-bold text-slate-600">Qual Cartão</label>
                <select
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                  value={cartaoId}
                  onChange={e => setCartaoId(e.target.value)}
                >
                  <option value="">Selecionar cartão...</option>
                  {cartoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}{c.ultimos4 ? ` • ${c.ultimos4}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dados de pagamento do fornecedor (do cadastro) */}
          {fornecedorSel && !bankingIncomplete && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <Landmark size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {[
                  fSel?.pix_chave ? `PIX: ${fSel.pix_chave}${fSel?.pix_tipo ? ` (${fSel.pix_tipo})` : ''}` : null,
                  fSel?.banco_nome ? `Banco: ${fSel.banco_nome}${fSel?.agencia ? ` • Ag. ${fSel.agencia}` : ''}${fSel?.conta ? ` • Conta ${fSel.conta}` : ''}` : null,
                  fSel?.boleto ? 'Aceita boleto' : null,
                  fSel?.cartao ? 'Aceita cartão' : null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {/* Cadastro sem dados de pagamento → completar aqui (salva no fornecedor) */}
          {bankingIncomplete && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <Landmark size={14} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-violet-700">Dados de pagamento do fornecedor incompletos</p>
                  <p className="text-[11px] text-violet-500">Informe PIX, dados bancários ou marque boleto/cartão — será salvo no cadastro.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <input type="checkbox" checked={bancoBoleto}
                    onChange={e => { setBancoBoleto(e.target.checked); if (e.target.checked) setBancoCartao(false) }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  Boleto
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <input type="checkbox" checked={bancoCartao}
                    onChange={e => { setBancoCartao(e.target.checked); if (e.target.checked) setBancoBoleto(false) }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  Cartão
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-violet-300 outline-none ${bancoBoleto || bancoCartao ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Chave PIX"
                  disabled={bancoBoleto || bancoCartao}
                  value={bancoPix}
                  onChange={e => setBancoPix(e.target.value.toUpperCase())}
                />
                <select
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${bancoBoleto || bancoCartao ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  disabled={bancoBoleto || bancoCartao}
                  value={bancoPixTipo}
                  onChange={e => setBancoPixTipo(e.target.value)}
                >
                  <option value="">Tipo da chave...</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave aleatória</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-violet-300 outline-none ${bancoBoleto || bancoCartao ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Banco"
                  disabled={bancoBoleto || bancoCartao}
                  value={bancoBancoNome}
                  onChange={e => setBancoBancoNome(e.target.value.toUpperCase())}
                />
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${bancoBoleto || bancoCartao ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Agência"
                  disabled={bancoBoleto || bancoCartao}
                  value={bancoAgencia}
                  onChange={e => setBancoAgencia(e.target.value)}
                />
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${bancoBoleto || bancoCartao ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Conta"
                  disabled={bancoBoleto || bancoCartao}
                  value={bancoConta}
                  onChange={e => setBancoConta(e.target.value)}
                />
              </div>
            </div>
          )}

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
            {/* Desconto sempre visível — antes só aparecia com item valorado, e ninguém achava o campo */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] text-slate-400 font-semibold">Desconto (R$)</label>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">R$</span>
                    <NumericInput
                      min={0} step={0.01}
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm text-right bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                      value={valorDesconto}
                      onChange={setValorDesconto}
                    />
                  </div>
                </div>
                {valorDesconto >= subtotal && valorDesconto > 0 && (
                  <p className="text-[10px] text-red-600 text-right">Desconto maior ou igual ao total dos itens — confira.</p>
                )}
                <div className="flex justify-end items-baseline gap-2">
                  {valorDesconto > 0 && (
                    <span className="text-[11px] text-slate-400 line-through">{fmt(subtotal)}</span>
                  )}
                  <span className="text-sm font-extrabold text-orange-600">{fmt(total)}</span>
                </div>
              </div>
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
            disabled={emitir.isPending || editar.isPending}
            className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-orange-500/20 transition-colors"
          >
            {(emitir.isPending || editar.isPending)
              ? <><Loader2 size={15} className="animate-spin" /> {editMode ? 'Salvando...' : 'Emitindo...'}</>
              : <><ShoppingCart size={15} /> {editMode ? 'Salvar Alterações' : 'Emitir Pedido Direto'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
