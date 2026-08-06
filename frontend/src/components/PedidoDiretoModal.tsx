import { useState, useMemo, useEffect, useRef } from 'react'
import { X, PlusCircle, Trash2, Loader2, AlertTriangle, ShoppingCart, Search, UserPlus, CheckCircle2, Landmark, Upload, Paperclip, FileText, ExternalLink } from 'lucide-react'
import { useEmitirPedidoDireto, useEditarPedidoDireto, CP_ABERTAS, type TipoPedidoDireto } from '../hooks/usePedidos'
import { useAnexosPedido, useUploadAnexo, TIPO_LABEL, type PedidoAnexo } from '../hooks/useAnexos'
import { useCadFornecedores, useCadClasses, useSalvarFornecedor } from '../hooks/useCadastros'
import { useLookupObras, useLookupEmpresas } from '../hooks/useLookups'
import { useCartoesCredito } from '../hooks/useCartoes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import NumericInput from './NumericInput'
import { toUpperNorm } from './UpperInput'
import { gerarPreviaParcelas } from '../utils/pagamentos'

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
  /** Mesmos campos, naturezas diferentes: compra emergencial x pagamento antecipado. */
  tipo?: TipoPedidoDireto
}

/** Só muda o texto — a mecânica do pedido sem cotação é idêntica nos dois casos. */
const TEXTOS: Record<TipoPedidoDireto, {
  titulo: string; subtitulo: string; labelJustificativa: string; placeholderJustificativa: string
}> = {
  extraordinario: {
    titulo: 'Pedido Direto',
    subtitulo: 'Sem Requisição nem Cotação',
    labelJustificativa: 'Justificativa para dispensa de RC/Cotação *',
    placeholderJustificativa: 'Ex: COMPRA DE EMERGÊNCIA, FORNECEDOR ÚNICO, VALOR ABAIXO DO LIMITE...',
  },
  adiantamento_fornecedor: {
    titulo: 'Adiantamento a Fornecedor',
    subtitulo: 'Pagamento antecipado, sem Requisição nem Cotação',
    labelJustificativa: 'Justificativa do adiantamento *',
    placeholderJustificativa: 'Ex: SINAL DE 50% EXIGIDO PELO FORNECEDOR, PAGAMENTO ANTECIPADO PARA INÍCIO DA FABRICAÇÃO...',
  },
}

export default function PedidoDiretoModal({ open, onClose, onSuccess, pedido, tipo }: Props) {
  const { perfil } = useAuth()
  const emitir = useEmitirPedidoDireto()
  const editar = useEditarPedidoDireto()
  const editMode = !!pedido
  // Na edição manda o que está gravado; na criação, o atalho que abriu o modal.
  const tipoPedido: TipoPedidoDireto = (pedido?.tipo_pedido as TipoPedidoDireto) || tipo || 'extraordinario'
  const txt = TEXTOS[tipoPedido] ?? TEXTOS.extraordinario

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
  // Vencimento explícito (boleto com data fechada). Preenchido, manda na frente
  // da condição de pagamento e gera uma única parcela nessa data.
  const [dataVencimento, setDataVencimento] = useState('')
  // Parcelamento igual ao pedido normal: previa gerada da condicao/vencimento e
  // editavel antes de emitir. Lista vazia = comportamento antigo (hook resolve).
  const [parcelas, setParcelas] = useState<Array<{ numero: number; valor: number; data_vencimento: string; descricao?: string }>>([])
  const [parcelasEditadas, setParcelasEditadas] = useState(false)
  // Edicao de VALOR e separada da de data/descricao: quem so ajusta vencimentos
  // continua com os valores seguindo o total do pedido conforme os itens entram.
  const [valoresEditados, setValoresEditados] = useState(false)
  const [valorFrete, setValorFrete] = useState(0)
  const [valorDespesas, setValorDespesas] = useState(0)
  const [valorDesconto, setValorDesconto] = useState(0)
  const [justificativa, setJustificativa] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemDireto[]>([emptyItem()])
  const [erro, setErro] = useState<string | null>(null)

  // ── Anexos ────────────────────────────────────────────────────────────────
  // O pedido só existe depois do insert, então na emissão os arquivos ficam
  // numa fila e sobem logo em seguida. Na edição o pedido já tem id, mas a fila
  // é a mesma para o comportamento não mudar de uma tela para a outra.
  const uploadAnexo = useUploadAnexo()
  const fileRef = useRef<HTMLInputElement>(null)
  const anexoIdRef = useRef(0)
  const [anexos, setAnexos] = useState<Array<{ id: number; file: File; tipo: PedidoAnexo['tipo'] }>>([])
  const [enviandoAnexos, setEnviandoAnexos] = useState(false)
  // Pedido gravado mas com anexo que falhou: sem isto o modal fecharia e o
  // documento sumiria calado — ou o usuário reemitiria e duplicaria o pedido.
  const [emitidoComFalha, setEmitidoComFalha] = useState<{ numero: string; falhas: string[] } | null>(null)
  const { data: anexosExistentes = [] } = useAnexosPedido(pedido?.id)

  const addAnexos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novos = Array.from(e.target.files ?? [])
    if (novos.length) {
      setErro(null)
      setAnexos(prev => [
        ...prev,
        ...novos.map(file => ({ id: ++anexoIdRef.current, file, tipo: 'outro' as PedidoAnexo['tipo'] })),
      ])
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  /** Sobe a fila e devolve os nomes que falharam — um anexo ruim não derruba os outros. */
  const enviarAnexos = async (pedidoId: string): Promise<string[]> => {
    if (anexos.length === 0) return []
    setEnviandoAnexos(true)
    const falhas: string[] = []
    try {
      for (const a of anexos) {
        try {
          await uploadAnexo.mutateAsync({ pedidoId, file: a.file, tipo: a.tipo, origem: 'compras' })
        } catch {
          falhas.push(a.file.name)
        }
      }
    } finally {
      setEnviandoAnexos(false)
    }
    setAnexos(prev => prev.filter(a => falhas.includes(a.file.name)))
    return falhas
  }

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
    setValorFrete(Number(pedido.valor_frete ?? 0))
    setValorDespesas(Number((pedido as any).valor_despesas ?? 0))
    setValorDesconto(Number(pedido.valor_desconto ?? 0))
    setJustificativa(pedido.justificativa_sem_cotacao ?? '')
    setObservacoes(pedido.observacoes ?? '')
    setItens(pedido.itens_direto?.length ? pedido.itens_direto.map((i: any) => ({ ...i })) : [emptyItem()])
    // Vencimento explícito gravado no próprio pedido. Sem isto a edição perdia a
    // data fechada do boleto e o Financeiro recebia a parcela recalculada pela
    // condição de pagamento (ou "Revisar manualmente", quando ela não é interpretável).
    setDataVencimento(pedido.data_vencimento ?? '')
    // Parcelas ja gravadas no pedido entram como estao (marcadas como editadas
    // para a previa automatica nao sobrescrever a negociacao registrada).
    const pp = (pedido as any).parcelas_preview
    if (Array.isArray(pp) && pp.length > 0) {
      setParcelas(pp.map((p: any, i: number) => ({
        numero: i + 1,
        valor: Number(p.valor) || 0,
        data_vencimento: p.data_vencimento ?? '',
        descricao: p.descricao,
      })))
      setParcelasEditadas(true)
      setValoresEditados(true)
    }
    // Forma de pagamento/cartão vivem na parcela do Contas a Pagar
    supabase
      .from('fin_contas_pagar')
      .select('forma_pagamento, cartao_id, data_vencimento')
      .eq('pedido_id', pedido.id)
      .in('status', [...CP_ABERTAS])
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const primeira = data?.[0]
        setFormaPagamento((primeira?.forma_pagamento as FormaPagamentoPedido) ?? '')
        setCartaoId(primeira?.cartao_id ?? '')
        // Pedido antigo, sem vencimento explícito gravado: reexibe o da parcela
        // quando é única e sem condição — com condição, quem manda é ela.
        if (!pedido.data_vencimento) {
          const semCondicao = !(pedido.condicao_pagamento ?? '').trim()
          setDataVencimento(semCondicao && data?.length === 1 ? (primeira?.data_vencimento ?? '') : '')
        }
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
  // Total entregue = itens + frete + despesas − desconto (mesma conta da cotação)
  const acrescimos = (valorFrete || 0) + (valorDespesas || 0)
  const total = Math.max(
    0,
    Math.round((subtotal + acrescimos - (valorDesconto || 0)) * 100) / 100,
  )

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const parcelasSugeridas = useMemo(() => {
    const base = dataPrevistaEntrega || new Date().toISOString().split('T')[0]
    if (dataVencimento) {
      return [{ numero: 1, valor: total, data_vencimento: dataVencimento, descricao: condicaoPagamento || 'Vencimento informado' }]
    }
    if (total > 0) return gerarPreviaParcelas(total, condicaoPagamento || '', base)
    // Itens ainda sem valor: gera a ESTRUTURA da condicao (datas editaveis, R$ 0)
    // para quem digita "30/60" ja poder acertar os vencimentos — os valores
    // entram sozinhos quando os itens forem valorados.
    return gerarPreviaParcelas(1, condicaoPagamento || '', base).map(p => ({ ...p, valor: 0 }))
  }, [total, dataVencimento, condicaoPagamento, dataPrevistaEntrega])

  useEffect(() => {
    if (!parcelasEditadas) {
      setParcelas(parcelasSugeridas)
      return
    }
    if (valoresEditados) return
    // Datas/descricoes sao do usuario; valores redistribuem em partes iguais
    // (ultima absorve o arredondamento) enquanto ninguem mexer neles.
    setParcelas(prev => {
      if (prev.length === 0) return prev
      const cada = Math.floor((total / prev.length) * 100) / 100
      return prev.map((p, i) => ({
        ...p,
        valor: i === prev.length - 1
          ? Math.round((total - cada * (prev.length - 1)) * 100) / 100
          : cada,
      }))
    })
  }, [parcelasSugeridas, parcelasEditadas, valoresEditados, total])

  const somaParcelas = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0)
  const parcelasDivergem = parcelas.length > 0 && total > 0 && Math.abs(somaParcelas - total) > 0.01

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
  // ...mas o cadastro pode ter UM meio e o pedido sair por OUTRO: fornecedor só
  // com boleto e pagamento por Pix precisa da chave aqui (antes não havia onde digitar).
  const faltaPix = formaPagamento === 'pix' && !fSel?.pix_chave
  const faltaBanco = formaPagamento === 'transferencia' && (!fSel?.banco_nome || !fSel?.conta)
  const mostrarDadosPagamento = !!fornecedorSel && (bankingIncomplete || faltaPix || faltaBanco)
  // Boleto/cartão não usam PIX nem conta — trava os campos só nesses casos.
  const dispensaDadosBanco = formaPagamento === 'boleto' || formaPagamento === 'cartao'
    || (!formaPagamento && (bancoBoleto || bancoCartao))
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
    if (!justificativa.trim()) return setErro(
      tipoPedido === 'adiantamento_fornecedor'
        ? 'Informe a justificativa do adiantamento.'
        : 'Informe a justificativa para dispensar Requisição/Cotação.'
    )
    if (formaPagamento === 'cartao' && !cartaoId) return setErro('Selecione qual cartão corporativo será usado.')
    if (parcelas.some(p => !p.data_vencimento)) return setErro('Toda parcela precisa de data de vencimento.')
    if (parcelasDivergem) return setErro(`A soma das parcelas (${fmt(somaParcelas)}) difere do total do pedido (${fmt(total)}). Ajuste antes de continuar.`)

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
          dataVencimento: dataVencimento || undefined,
          parcelasPreview: parcelas.length > 0
            ? parcelas.map((p, i) => ({
                numero: i + 1,
                valor: Math.round((Number(p.valor) || 0) * 100) / 100,
                data_vencimento: p.data_vencimento,
                descricao: p.descricao,
              }))
            : undefined,
          justificativaSemCotacao: toUpperNorm(justificativa),
          observacoes: observacoes ? toUpperNorm(observacoes) : undefined,
          empresaId: empresaId || undefined,
          formaPagamento: formaPagamento || undefined,
          cartaoId: formaPagamento === 'cartao' ? cartaoId || undefined : undefined,
          valorFrete: valorFrete || undefined,
          valorDespesas: valorDespesas || undefined,
          valorDesconto: valorDesconto || undefined,
        })
        const falhas = await enviarAnexos(pedido.id)
        if (falhas.length > 0) {
          setEmitidoComFalha({ numero: pedido.numero_pedido ?? '', falhas })
          return
        }
        onSuccess?.(pedido.numero_pedido)
        onClose()
      } catch (e) {
        setErro((e as Error).message || 'Erro ao salvar alterações.')
      }
      return
    }

    try {
      // Completou dados bancários/PIX de fornecedor que não tinha → salva no cadastro
      if (fornecedorId && mostrarDadosPagamento && bankingProvided) {
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
        dataVencimento: dataVencimento || undefined,
        parcelasPreview: parcelas.length > 0
          ? parcelas.map((p, i) => ({
              numero: i + 1,
              valor: Math.round((Number(p.valor) || 0) * 100) / 100,
              data_vencimento: p.data_vencimento,
              descricao: p.descricao,
            }))
          : undefined,
        justificativaSemCotacao: toUpperNorm(justificativa),
        observacoes: observacoes ? toUpperNorm(observacoes) : undefined,
        compradorId: perfil?.id,
        tipoPedido,
        empresaId: empresaId || undefined,
        formaPagamento: formaPagamento || undefined,
        cartaoId: formaPagamento === 'cartao' ? cartaoId || undefined : undefined,
        valorFrete: valorFrete || undefined,
        valorDespesas: valorDespesas || undefined,
        valorDesconto: valorDesconto || undefined,
      })
      // Pedido já está gravado a partir daqui: falha de anexo não pode virar
      // erro de emissão, senão o usuário tenta de novo e duplica o pedido.
      const falhas = await enviarAnexos(result.id)
      if (falhas.length > 0) {
        setEmitidoComFalha({ numero: result.numero_pedido, falhas })
        return
      }
      onSuccess?.(result.numero_pedido)
      onClose()
    } catch (e) {
      setErro((e as Error).message || 'Erro ao emitir pedido.')
    }
  }

  /** Fecha depois de um pedido que gravou mas ficou com anexo pendente. */
  const fecharAposFalhaAnexo = () => {
    onSuccess?.(emitidoComFalha?.numero ?? '')
    setEmitidoComFalha(null)
    onClose()
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
              <h2 className="text-sm font-extrabold text-slate-800">{editMode ? `Editar ${pedido?.numero_pedido ?? txt.titulo}` : txt.titulo}</h2>
              <p className="text-[11px] text-slate-400">{editMode ? 'Todos os campos editáveis, exceto o fornecedor' : txt.subtitulo}</p>
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

          {/* Condição e Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600">Cond. Pagamento</label>
              <input
                className={`mt-1 w-full border rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none ${
                  dataVencimento ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200'
                }`}
                placeholder="Ex: 30 DDL"
                value={condicaoPagamento}
                onChange={e => setCondicaoPagamento(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Data de Vencimento</label>
              <input
                type="date"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
                value={dataVencimento}
                onChange={e => setDataVencimento(e.target.value)}
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
          <p className="-mt-2 text-[11px] text-slate-400">
            {dataVencimento
              ? 'Vencimento informado: gera uma única parcela nessa data (a condição de pagamento fica só como referência).'
              : 'Sem data de vencimento, as parcelas saem da condição de pagamento contada a partir da previsão de entrega.'}
          </p>

          {/* Parcelamento — mesma previa editavel do pedido normal */}
          {parcelas.length > 0 && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-600">Parcelas ({parcelas.length})</p>
                  <p className="text-[11px] text-slate-400">Revise valores e vencimentos antes de {editMode ? 'salvar' : 'emitir'}.</p>
                </div>
                <div className="flex items-center gap-2">
                  {parcelasEditadas && (
                    <button
                      type="button"
                      onClick={() => { setParcelasEditadas(false); setValoresEditados(false); setParcelas(parcelasSugeridas) }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-white"
                    >
                      Recalcular
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setParcelasEditadas(true); setParcelas(prev => [...prev, { numero: prev.length + 1, valor: 0, data_vencimento: '', descricao: `PARCELA ${prev.length + 1}` }]) }}
                    className="px-2.5 py-1.5 rounded-lg bg-orange-50 text-[11px] font-semibold text-orange-700 border border-orange-200 hover:bg-orange-100"
                  >
                    + Parcela
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {parcelas.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-[11px] font-bold text-slate-400 text-center shrink-0">{idx + 1}</span>
                    <input
                      type="date"
                      value={p.data_vencimento}
                      onChange={e => { setParcelasEditadas(true); setParcelas(prev => prev.map((x, i) => i === idx ? { ...x, data_vencimento: e.target.value } : x)) }}
                      className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-semibold">R$</span>
                      <NumericInput
                        min={0} step={0.01}
                        value={p.valor}
                        onChange={v => { setParcelasEditadas(true); setValoresEditados(true); setParcelas(prev => prev.map((x, i) => i === idx ? { ...x, valor: v } : x)) }}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs text-right outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>
                    <input
                      value={p.descricao ?? ''}
                      placeholder="DESCRICAO"
                      onChange={e => { setParcelasEditadas(true); setParcelas(prev => prev.map((x, i) => i === idx ? { ...x, descricao: e.target.value.toUpperCase() } : x)) }}
                      className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs uppercase outline-none focus:ring-2 focus:ring-orange-300"
                    />
                    <button
                      type="button"
                      disabled={parcelas.length === 1}
                      onClick={() => { setParcelasEditadas(true); setParcelas(prev => prev.filter((_, i) => i !== idx)) }}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-30 shrink-0"
                      title="Remover parcela"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className={`flex justify-end gap-2 text-[11px] font-semibold ${parcelasDivergem ? 'text-red-600' : 'text-slate-400'}`}>
                  <span>Soma {fmt(somaParcelas)}</span>
                  <span>· Total {fmt(total)}</span>
                  {parcelasDivergem && <span>— difere do total</span>}
                </div>
              </div>
            </div>
          )}

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
          {fornecedorSel && !mostrarDadosPagamento && (
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

          {/* Falta o dado do meio escolhido → completar aqui (salva no fornecedor) */}
          {mostrarDadosPagamento && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <Landmark size={14} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-violet-700">
                    {faltaPix ? 'Fornecedor sem chave PIX cadastrada'
                      : faltaBanco ? 'Fornecedor sem dados bancários cadastrados'
                      : 'Dados de pagamento do fornecedor incompletos'}
                  </p>
                  <p className="text-[11px] text-violet-500">
                    {faltaPix ? 'Informe a chave PIX para pagar por Pix — será salva no cadastro.'
                      : faltaBanco ? 'Informe banco, agência e conta para a transferência — será salvo no cadastro.'
                      : 'Informe PIX, dados bancários ou marque boleto/cartão — será salvo no cadastro.'}
                  </p>
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
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-violet-300 outline-none ${dispensaDadosBanco ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Chave PIX"
                  disabled={dispensaDadosBanco}
                  value={bancoPix}
                  onChange={e => setBancoPix(e.target.value.toUpperCase())}
                />
                <select
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${dispensaDadosBanco ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  disabled={dispensaDadosBanco}
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
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm uppercase bg-white focus:ring-2 focus:ring-violet-300 outline-none ${dispensaDadosBanco ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Banco"
                  disabled={dispensaDadosBanco}
                  value={bancoBancoNome}
                  onChange={e => setBancoBancoNome(e.target.value.toUpperCase())}
                />
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${dispensaDadosBanco ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Agência"
                  disabled={dispensaDadosBanco}
                  value={bancoAgencia}
                  onChange={e => setBancoAgencia(e.target.value)}
                />
                <input
                  className={`w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none ${dispensaDadosBanco ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
                  placeholder="Conta"
                  disabled={dispensaDadosBanco}
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
            {/* Frete/Despesas/Desconto sempre visíveis — antes o desconto só
                aparecia com item valorado, e ninguém achava o campo */}
            <div className="mt-2 space-y-1">
              {([
                { label: 'Frete (R$)', value: valorFrete, onChange: setValorFrete },
                { label: 'Despesas (R$)', value: valorDespesas, onChange: setValorDespesas },
                { label: 'Desconto (R$)', value: valorDesconto, onChange: setValorDesconto },
              ] as const).map(campo => (
                <div key={campo.label} className="flex items-center justify-between gap-3">
                  <label className="text-[10px] text-slate-400 font-semibold">{campo.label}</label>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">R$</span>
                    <NumericInput
                      min={0} step={0.01}
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm text-right bg-white focus:ring-2 focus:ring-orange-300 outline-none"
                      value={campo.value}
                      onChange={campo.onChange}
                    />
                  </div>
                </div>
              ))}
              {valorDesconto >= subtotal + acrescimos && valorDesconto > 0 && (
                <p className="text-[10px] text-red-600 text-right">Desconto maior ou igual ao total do pedido — confira.</p>
              )}
              {/* Composição do total — só aparece quando há frete/despesas/desconto */}
              {(valorFrete > 0 || valorDespesas > 0 || valorDesconto > 0) && (
                <div className="flex flex-wrap justify-end gap-x-2 text-[10px] text-slate-400">
                  <span>Itens {fmt(subtotal)}</span>
                  {valorFrete > 0 && <span>+ frete {fmt(valorFrete)}</span>}
                  {valorDespesas > 0 && <span>+ despesas {fmt(valorDespesas)}</span>}
                  {valorDesconto > 0 && <span>− desconto {fmt(valorDesconto)}</span>}
                </div>
              )}
              <div className="flex justify-end items-baseline gap-2">
                <span className="text-[10px] text-slate-400 font-semibold">Total</span>
                <span className="text-sm font-extrabold text-orange-600">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Justificativa (obrigatória) */}
          <div>
            <label className="text-xs font-bold text-slate-600">
              {txt.labelJustificativa}
            </label>
            <textarea
              rows={3}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm uppercase focus:ring-2 focus:ring-orange-300 outline-none resize-none"
              placeholder={txt.placeholderJustificativa}
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

          {/* Documentos — orçamento, proposta, boleto, NF... Pedido sem cotação
              é o que menos tem rastro formal; o anexo aqui é a prova dele. */}
          <div>
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Paperclip size={12} /> Documentos <span className="text-slate-400 font-normal">(opcional)</span>
            </label>

            {editMode && anexosExistentes.length > 0 && (
              <div className="mt-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 space-y-1">
                <p className="text-[11px] font-bold text-emerald-700">Já anexados</p>
                {anexosExistentes.map(a => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-emerald-600 hover:underline truncate"
                  >
                    <FileText size={11} className="shrink-0" />
                    <span className="font-semibold shrink-0">{TIPO_LABEL[a.tipo]}</span>
                    <span className="text-emerald-400">·</span>
                    <span className="truncate">{a.nome_arquivo}</span>
                    <ExternalLink size={10} className="shrink-0 text-emerald-400" />
                  </a>
                ))}
              </div>
            )}

            <div
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 flex items-center gap-3 border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl px-4 py-3 cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-colors"
            >
              <Upload size={17} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Clique para selecionar</p>
                <p className="text-[11px] text-slate-400">PDF, JPG, PNG, XLS, XLSX — pode escolher mais de um</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.xml,.jpg,.jpeg,.png,.xls,.xlsx"
              onChange={addAnexos}
              className="hidden"
            />

            {anexos.map(a => (
              <div key={a.id} className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <FileText size={14} className="text-orange-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{a.file.name}</p>
                  <p className="text-[10px] text-slate-400">{(a.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <select
                  value={a.tipo}
                  onChange={e => setAnexos(prev => prev.map(x =>
                    x.id === a.id ? { ...x, tipo: e.target.value as PedidoAnexo['tipo'] } : x
                  ))}
                  className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:ring-1 focus:ring-orange-300 outline-none"
                >
                  {(Object.keys(TIPO_LABEL) as PedidoAnexo['tipo'][])
                    .filter(t => t !== 'comprovante_pagamento')
                    .map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setAnexos(prev => prev.filter(x => x.id !== a.id))}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {emitidoComFalha && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 space-y-1">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle size={13} className="shrink-0" />
                Pedido {emitidoComFalha.numero} emitido — mas {emitidoComFalha.falhas.length} anexo(s) falharam
              </p>
              <p className="text-[11px]">
                {emitidoComFalha.falhas.join(', ')}. Não emita de novo: feche e anexe pelo detalhe do pedido.
              </p>
            </div>
          )}

          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <AlertTriangle size={13} className="shrink-0" /> {erro}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          {emitidoComFalha ? (
            /* Pedido já gravado: o único caminho é sair, para não duplicar. */
            <button
              onClick={fecharAposFalhaAnexo}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={emitir.isPending || editar.isPending || enviandoAnexos}
                className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-orange-500/20 transition-colors"
              >
                {enviandoAnexos
                  ? <><Loader2 size={15} className="animate-spin" /> Anexando...</>
                  : (emitir.isPending || editar.isPending)
                    ? <><Loader2 size={15} className="animate-spin" /> {editMode ? 'Salvando...' : 'Emitindo...'}</>
                    : <><ShoppingCart size={15} /> {editMode ? 'Salvar Alterações' : 'Emitir Pedido Direto'}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
