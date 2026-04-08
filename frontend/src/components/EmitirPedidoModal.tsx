import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, FileText, Loader2, AlertTriangle, Ban, CheckCircle2, Landmark } from 'lucide-react'
import { useCadCentrosCusto, useCadClasses, useCadObras } from '../hooks/useCadastros'
import SearchableSelect from './SearchableSelect'
import type { SelectOption } from './SearchableSelect'
import type { RequisicaoItem } from '../types'
import { supabase } from '../services/supabase'
import { gerarPreviaParcelas, resumirHomogeneidade } from '../utils/pagamentos'
import NumericInput from './NumericInput'

type ModalCotacao = {
  id?: string
  fornecedorNome?: string
  valorTotal?: number
  compradorId?: string
  condicaoPagamento?: string
}

type ModalRequisicao = {
  id: string
  obra_id?: string | null
  obra_nome: string
  centro_custo?: string | null
  centro_custo_id?: string | null
  classe_financeira?: string | null
  classe_financeira_id?: string | null
  itens: RequisicaoItem[]
}

type ParcelaEditavel = {
  numero: number
  valor: number
  data_vencimento: string
  descricao?: string
  tipo?: 'adiantamento' | 'parcela'
  status_inicial?: 'confirmado' | 'previsto'
}

interface EmitirPedidoModalProps {
  open: boolean
  onClose: () => void
  requisicaoId: string
  cotacao?: ModalCotacao
  compraRecorrente?: boolean
  onSolicitarContrato?: () => void
  onConfirm: (payload: {
    cotacaoId: string
    fornecedorId?: string
    fornecedorNome: string
    valorTotal: number
    compradorId?: string
    classeFinanceiraId?: string
    classeFinanceira?: string
    centroCustoId?: string
    centroCusto?: string
    condicaoPagamento?: string
    observacoes?: string
    dataPrevistaEntrega?: string
    parcelasPreview: Array<{
      numero: number
      valor: number
      data_vencimento: string
      descricao?: string
      tipo?: 'adiantamento' | 'parcela'
      status_inicial?: 'confirmado' | 'previsto'
    }>
  }) => void
  isSubmitting: boolean
}

export default function EmitirPedidoModal({
  open,
  onClose,
  requisicaoId,
  cotacao,
  compraRecorrente,
  onSolicitarContrato,
  onConfirm,
  isSubmitting,
}: EmitirPedidoModalProps) {
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const { data: centros = [] } = useCadCentrosCusto()
  const { data: obras = [] } = useCadObras()

  const { data, isLoading, error } = useQuery({
    queryKey: ['emitir-pedido-modal', requisicaoId, cotacao?.id ?? 'auto'],
    enabled: open && !!requisicaoId,
    queryFn: async () => {
      const { data: requisicao, error: reqError } = await supabase
        .from('cmp_requisicoes')
        .select(`
          id, obra_id, obra_nome,
          centro_custo, centro_custo_id,
          classe_financeira, classe_financeira_id,
          itens:cmp_requisicao_itens(
            id, descricao, quantidade, unidade,
            valor_unitario_estimado,
            classe_financeira_id, classe_financeira_codigo, classe_financeira_descricao
          )
        `)
        .eq('id', requisicaoId)
        .single()

      if (reqError) throw reqError

      let cotacaoResolvida = cotacao ?? {}

      const hydrateCotacao = async (cotacaoId?: string) => {
        if (!cotacaoId) return null
        const { data: cotacaoData, error: cotError } = await supabase
          .from('cmp_cotacoes')
          .select('id, comprador_id, fornecedor_selecionado_id, fornecedor_selecionado_nome, valor_selecionado')
          .eq('id', cotacaoId)
          .maybeSingle()

        if (cotError) throw cotError
        if (!cotacaoData) return null

        let condicaoPagamento = cotacao?.condicaoPagamento
        let fornecedorCnpj: string | null = null
        if (cotacaoData.fornecedor_selecionado_id) {
          const { data: fornecedor } = await supabase
            .from('cmp_cotacao_fornecedores')
            .select('condicao_pagamento, fornecedor_cnpj')
            .eq('id', cotacaoData.fornecedor_selecionado_id)
            .maybeSingle()

          if (!condicaoPagamento) condicaoPagamento = fornecedor?.condicao_pagamento ?? undefined
          fornecedorCnpj = fornecedor?.fornecedor_cnpj ?? null
        }

        // Lookup cmp_fornecedores for banking data
        let fornecedorDB: { id: string; banco_nome?: string | null; agencia?: string | null; conta?: string | null; pix_chave?: string | null; pix_tipo?: string | null } | null = null
        if (fornecedorCnpj) {
          const { data: fdb } = await supabase
            .from('cmp_fornecedores')
            .select('id, banco_nome, agencia, conta, pix_chave, pix_tipo')
            .eq('cnpj', fornecedorCnpj)
            .maybeSingle()
          if (!fdb) {
            // try without formatting
            const cleanCnpj = fornecedorCnpj.replace(/\D/g, '')
            const { data: fdb2 } = await supabase
              .from('cmp_fornecedores')
              .select('id, banco_nome, agencia, conta, pix_chave, pix_tipo')
              .ilike('cnpj', `%${cleanCnpj}%`)
              .maybeSingle()
            fornecedorDB = fdb2 ?? null
          } else {
            fornecedorDB = fdb
          }
        }

        return {
          id: cotacaoData.id,
          fornecedorNome: cotacao?.fornecedorNome ?? cotacaoData.fornecedor_selecionado_nome ?? undefined,
          valorTotal: cotacao?.valorTotal ?? cotacaoData.valor_selecionado ?? undefined,
          compradorId: cotacao?.compradorId ?? cotacaoData.comprador_id ?? undefined,
          condicaoPagamento,
          fornecedorDB,
        } satisfies ModalCotacao & { fornecedorDB: typeof fornecedorDB }
      }

      if (cotacao?.id) {
        cotacaoResolvida = (await hydrateCotacao(cotacao.id)) ?? cotacaoResolvida
      } else {
        const { data: cotacaoData, error: cotError } = await supabase
          .from('cmp_cotacoes')
          .select('id')
          .eq('requisicao_id', requisicaoId)
          .eq('status', 'concluida')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (cotError) throw cotError
        cotacaoResolvida = (await hydrateCotacao(cotacaoData?.id)) ?? cotacaoResolvida
      }

      return {
        requisicao: {
          ...(requisicao as Omit<ModalRequisicao, 'itens'>),
          itens: (((requisicao as any)?.itens ?? []) as RequisicaoItem[]),
        } as ModalRequisicao,
        cotacao: cotacaoResolvida,
        fornecedorDB: (cotacaoResolvida as any)?.fornecedorDB ?? null,
      }
    },
    staleTime: 30_000,
  })

  const requisicao = data?.requisicao
  const cotacaoResolvida = data?.cotacao

  const classeResumo = useMemo(
    () => resumirHomogeneidade(requisicao?.itens.map((item) => item.classe_financeira_codigo) ?? []),
    [requisicao],
  )

  const classesDosItens = useMemo(
    () => Array.from(new Set(
      (requisicao?.itens ?? [])
        .map((item) => item.classe_financeira_codigo?.trim())
        .filter((value): value is string => Boolean(value)),
    )),
    [requisicao],
  )

  const [classeId, setClasseId] = useState('')
  const [centroId, setCentroId] = useState('')
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [dataPrevistaEntrega, setDataPrevistaEntrega] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [temAdiantamento, setTemAdiantamento] = useState(false)
  const [adiantamentoValor, setAdiantamentoValor] = useState('')
  const [adiantamentoData, setAdiantamentoData] = useState('')
  const [parcelasEditaveis, setParcelasEditaveis] = useState<ParcelaEditavel[]>([])
  const [parcelasEditadasManualmente, setParcelasEditadasManualmente] = useState(false)
  const [naoSolicitarContrato, setNaoSolicitarContrato] = useState(false)
  const [justNaoContrato, setJustNaoContrato] = useState('')
  const [bancoBancoNome, setBancoBancoNome] = useState('')
  const [bancoAgencia, setBancoAgencia] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [bancoPix, setBancoPix] = useState('')
  const [bancoPixTipo, setBancoPixTipo] = useState('')

  useEffect(() => {
    if (!open || !requisicao) return

    const obra = obras.find((item) => item.id === requisicao.obra_id)
    const classeSelecionada = classes.find((item) =>
      item.codigo === classeResumo.valor ||
      item.id === requisicao.classe_financeira_id ||
      item.codigo === requisicao.classe_financeira ||
      requisicao.itens.some((reqItem) => reqItem.classe_financeira_id === item.id),
    )

    setClasseId(classeSelecionada?.id ?? '')
    setCentroId((obra as any)?.centro_custo_id ?? requisicao.centro_custo_id ?? '')
    setCondicaoPagamento(cotacaoResolvida?.condicaoPagamento ?? '')
    setDataPrevistaEntrega('')
    setObservacoes('')
    setTemAdiantamento(false)
    setAdiantamentoValor('')
    setAdiantamentoData('')
    setParcelasEditadasManualmente(false)
    setNaoSolicitarContrato(false)
    setJustNaoContrato('')
    const fdb = data?.fornecedorDB
    setBancoBancoNome(fdb?.banco_nome ?? '')
    setBancoAgencia(fdb?.agencia ?? '')
    setBancoConta(fdb?.conta ?? '')
    setBancoPix(fdb?.pix_chave ?? '')
    setBancoPixTipo(fdb?.pix_tipo ?? '')
  }, [open, requisicao, cotacaoResolvida?.condicaoPagamento, obras, classes, classeResumo.valor, data?.fornecedorDB])

  const classeSelecionada = classes.find((item) => item.id === classeId)
  const centroSelecionado = centros.find((item) => item.id === centroId)
  const obraSelecionada = obras.find((item) => item.id === requisicao?.obra_id)
  const fornecedorDB = data?.fornecedorDB ?? null
  const bankingIncomplete = !!fornecedorDB && !fornecedorDB.pix_chave && (!fornecedorDB.banco_nome || !fornecedorDB.conta)
  const bankingProvided = bancoPix.trim() || (bancoBancoNome.trim() && bancoConta.trim())
  const valorTotal = cotacaoResolvida?.valorTotal ?? 0
  // fluxo efetivo: contrato OU dispensado pelo comprador
  const fluxoContrato = !!compraRecorrente && !naoSolicitarContrato
  const valorAdiantamento = Math.round((Number(adiantamentoValor || 0) || 0) * 100) / 100
  const adiantamentoInvalido = temAdiantamento && (valorAdiantamento <= 0 || valorAdiantamento > valorTotal || !adiantamentoData)
  const saldoParcelado = Math.max(0, Math.round(((temAdiantamento ? valorTotal - valorAdiantamento : valorTotal)) * 100) / 100)
  const parcelasSugeridasBase = useMemo(
    () => gerarPreviaParcelas(saldoParcelado, condicaoPagamento, dataPrevistaEntrega || undefined),
    [saldoParcelado, condicaoPagamento, dataPrevistaEntrega],
  )
  const parcelasSugeridas = useMemo(() => {
    const parcelasRegulares = parcelasSugeridasBase.map((parcela, index) => ({
      ...parcela,
      numero: temAdiantamento ? index + 2 : index + 1,
      tipo: 'parcela' as const,
      status_inicial: 'previsto' as const,
    }))

    if (!temAdiantamento) return parcelasRegulares

    const adiantamento: ParcelaEditavel = {
      numero: 1,
      valor: valorAdiantamento,
      data_vencimento: adiantamentoData,
      descricao: 'Adiantamento',
      tipo: 'adiantamento',
      status_inicial: 'confirmado',
    }

    return [adiantamento, ...parcelasRegulares]
  }, [parcelasSugeridasBase, temAdiantamento, valorAdiantamento, adiantamentoData])

  useEffect(() => {
    if (!open) return
    if (parcelasEditadasManualmente) return
    setParcelasEditaveis(parcelasSugeridas)
  }, [open, parcelasSugeridas, parcelasEditadasManualmente])

  useEffect(() => {
    if (!open) return
    setParcelasEditadasManualmente(false)
  }, [open, temAdiantamento, adiantamentoValor, adiantamentoData])

  const totalParcelas = useMemo(
    () => parcelasEditaveis.reduce((sum, parcela) => sum + (Number(parcela.valor) || 0), 0),
    [parcelasEditaveis],
  )

  const diferencaParcelas = useMemo(
    () => Math.round((totalParcelas - valorTotal) * 100) / 100,
    [totalParcelas, valorTotal],
  )

  const parcelasValidas = parcelasEditaveis.length > 0 && parcelasEditaveis.every((parcela) =>
    Number(parcela.valor) > 0 &&
    Boolean(parcela.data_vencimento),
  )

  const updateParcela = (numero: number, changes: Partial<ParcelaEditavel>) => {
    setParcelasEditadasManualmente(true)
    setParcelasEditaveis((current) => current.map((parcela) =>
      parcela.numero === numero
        ? { ...parcela, ...changes }
        : parcela,
    ))
  }

  const addParcela = () => {
    setParcelasEditadasManualmente(true)
    setParcelasEditaveis((current) => [
      ...current,
      {
        numero: current.length + 1,
        valor: 0,
        data_vencimento: dataPrevistaEntrega || '',
        descricao: `${current.length + 1}a parcela`,
        tipo: 'parcela',
        status_inicial: 'previsto',
      },
    ])
  }

  const removeParcela = (numero: number) => {
    setParcelasEditadasManualmente(true)
    setParcelasEditaveis((current) => current
      .filter((parcela) => parcela.numero !== numero)
      .map((parcela, index) => ({
        ...parcela,
        numero: parcela.tipo === 'adiantamento' ? 1 : (temAdiantamento ? index + 1 : index + 1),
      })))
  }

  const resetParcelas = () => {
    setParcelasEditadasManualmente(false)
    setParcelasEditaveis(parcelasSugeridas)
  }

  const handleSubmit = async () => {
    if (fluxoContrato && onSolicitarContrato) {
      onSolicitarContrato()
      return
    }

    // Save banking data to cmp_fornecedores if provided
    if (fornecedorDB?.id && bankingProvided) {
      await supabase.from('cmp_fornecedores').update({
        ...(bancoPix.trim() ? { pix_chave: bancoPix.trim(), pix_tipo: bancoPixTipo || null } : {}),
        ...(bancoBancoNome.trim() ? { banco_nome: bancoBancoNome.trim() } : {}),
        ...(bancoAgencia.trim() ? { agencia: bancoAgencia.trim() } : {}),
        ...(bancoConta.trim() ? { conta: bancoConta.trim() } : {}),
      }).eq('id', fornecedorDB.id)
    }

    onConfirm({
      cotacaoId: cotacaoResolvida?.id || '',
      fornecedorId: fornecedorDB?.id || undefined,
      fornecedorNome: cotacaoResolvida?.fornecedorNome || 'N/A',
      valorTotal: totalParcelas,
      compradorId: cotacaoResolvida?.compradorId,
      classeFinanceiraId: classeSelecionada?.id,
      classeFinanceira: classeSelecionada?.codigo,
      centroCustoId: centroSelecionado?.id,
      centroCusto: centroSelecionado?.codigo,
      condicaoPagamento: condicaoPagamento || cotacaoResolvida?.condicaoPagamento || undefined,
      observacoes: naoSolicitarContrato && justNaoContrato.trim()
        ? `[Contrato dispensado: ${justNaoContrato.trim()}]${observacoes ? `\n${observacoes}` : ''}`
        : observacoes,
      dataPrevistaEntrega,
      parcelasPreview: parcelasEditaveis.map((parcela) => ({
        numero: parcela.numero,
        valor: parcela.valor,
        data_vencimento: parcela.data_vencimento,
        descricao: parcela.tipo === 'adiantamento' ? 'Adiantamento' : parcela.descricao,
        tipo: parcela.tipo,
        status_inicial: parcela.status_inicial,
      })),
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-600">Emissao do Pedido</p>
            <h2 className="text-lg font-extrabold text-slate-800">{cotacaoResolvida?.fornecedorNome || 'Fechamento Financeiro'}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {isLoading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Carregando dados da requisicao e da cotacao aprovada...
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              Nao foi possivel carregar os dados da emissao: {error instanceof Error ? error.message : 'erro desconhecido'}.
            </div>
          )}

          {!isLoading && !error && requisicao && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Obra</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{requisicao.obra_nome}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Fornecedor</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{cotacaoResolvida?.fornecedorNome || '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Valor</p>
                  <p className="mt-1 text-sm font-extrabold text-emerald-600">
                    {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>

              {/* Banner: compra recorrente / serviço exige contrato */}
              {compraRecorrente && (
                <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                  naoSolicitarContrato
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-indigo-200 bg-indigo-50'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        naoSolicitarContrato ? 'bg-amber-100' : 'bg-indigo-100'
                      }`}>
                        {naoSolicitarContrato
                          ? <Ban size={14} className="text-amber-600" />
                          : <FileText size={14} className="text-indigo-600" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${naoSolicitarContrato ? 'text-amber-700' : 'text-indigo-700'}`}>
                          {naoSolicitarContrato ? 'Contrato dispensado — emitir pedido direto' : 'Esta compra requer formalizacao via Contratos'}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${naoSolicitarContrato ? 'text-amber-600' : 'text-indigo-500'}`}>
                          {naoSolicitarContrato
                            ? 'Preencha a justificativa e complete os dados financeiros abaixo.'
                            : 'Ao confirmar, sera aberta uma solicitacao de contrato no modulo Contratos.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setNaoSolicitarContrato(v => !v); setJustNaoContrato('') }}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                        naoSolicitarContrato
                          ? 'border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50'
                          : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      {naoSolicitarContrato ? 'Voltar ao Contrato' : 'Dispensar Contrato'}
                    </button>
                  </div>

                  {naoSolicitarContrato && (
                    <div>
                      <label className="block text-[11px] font-bold text-amber-700 mb-1">
                        Justificativa para dispensa de contrato *
                      </label>
                      <textarea
                        value={justNaoContrato}
                        onChange={e => setJustNaoContrato(e.target.value)}
                        placeholder="Ex.: Compra pontual, fornecedor nao aceita contrato, urgencia operacional..."
                        rows={2}
                        className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* #127 – Banking data: shown when supplier exists in cmp_fornecedores but lacks payment details */}
              {bankingIncomplete && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Landmark size={14} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-700">Dados bancários do fornecedor incompletos</p>
                      <p className="text-[11px] text-violet-500 mt-0.5">
                        Preencha abaixo para agilizar o pagamento. Os dados serão salvos no cadastro do fornecedor.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">PIX (chave)</label>
                      <input
                        value={bancoPix}
                        onChange={e => setBancoPix(e.target.value)}
                        placeholder="CPF, CNPJ, e-mail ou chave aleatória"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo da chave PIX</label>
                      <select
                        value={bancoPixTipo}
                        onChange={e => setBancoPixTipo(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                      >
                        <option value="">Selecionar...</option>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Chave aleatória</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Banco</label>
                      <input
                        value={bancoBancoNome}
                        onChange={e => setBancoBancoNome(e.target.value)}
                        placeholder="Ex.: Itaú, Bradesco, Sicredi..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Agência</label>
                        <input
                          value={bancoAgencia}
                          onChange={e => setBancoAgencia(e.target.value)}
                          placeholder="0000"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Conta</label>
                        <input
                          value={bancoConta}
                          onChange={e => setBancoConta(e.target.value)}
                          placeholder="00000-0"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-teal-700">Classe Financeira sugerida</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {classeResumo.homogeno && classeResumo.valor
                      ? classeResumo.valor
                      : requisicao.classe_financeira || 'Confirmacao manual necessaria'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {classeResumo.homogeno && classeResumo.valor
                      ? 'Puxada automaticamente dos itens da requisicao.'
                      : `Itens com multiplas classes: ${classesDosItens.join(', ') || 'sem classe definida'}.`}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-cyan-700">Centro de Custo sugerido</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {(obraSelecionada as any)?.centro_custo?.codigo || requisicao.centro_custo || '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {(obraSelecionada as any)?.centro_custo_id
                      ? 'Puxado automaticamente da obra vinculada.'
                      : requisicao.centro_custo
                        ? 'Puxado da requisicao (fallback).'
                        : 'Nenhum centro de custo vinculado.'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-600">Conferencia dos itens</p>
                </div>
                <div className="divide-y divide-slate-200">
                  {requisicao.itens.map((item, index) => (
                    <div key={item.id || `${item.descricao}-${index}`} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.descricao}</p>
                        <p className="text-[11px] text-slate-500">{item.quantidade} {item.unidade}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-semibold text-violet-700">
                          {item.classe_financeira_codigo || 'Sem classe'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {item.classe_financeira_descricao || 'Classe financeira nao definida no item'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Classe Financeira Final</label>
                  <SearchableSelect
                    options={(classes ?? []).map(c => ({ value: c.id, label: c.descricao, code: c.codigo }))}
                    value={classeId}
                    onChange={setClasseId}
                    placeholder="Buscar classe financeira..."
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    {classeResumo.homogeno && classeResumo.valor
                      ? `Sugestao automatica aplicada: ${classeResumo.valor}`
                      : 'Itens com classes diferentes exigem confirmacao manual.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Centro de Custo Final</label>
                  <SearchableSelect
                    options={(centros ?? []).map(c => ({ value: c.id, label: c.descricao, code: c.codigo }))}
                    value={centroId}
                    onChange={setCentroId}
                    placeholder="Buscar centro de custo..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Condicao de Pagamento</label>
                  <input
                    value={condicaoPagamento}
                    onChange={(event) => setCondicaoPagamento(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    placeholder="Ex.: 28 dias, 30/60, entrada + 28, 3x"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Puxada da cotacao aprovada quando houver. Revise abaixo as parcelas antes de emitir.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Data Prevista de Entrega</label>
                  <input
                    type="date"
                    value={dataPrevistaEntrega}
                    onChange={(event) => setDataPrevistaEntrega(event.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-amber-700">Tem adiantamento?</p>
                    <p className="text-[11px] text-slate-500">
                      Se sim, essa parcela especial cai direto em Confirmados no Contas a Pagar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemAdiantamento((prev) => !prev)}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${temAdiantamento ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${temAdiantamento ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {temAdiantamento && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Valor do adiantamento</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={adiantamentoValor}
                        onChange={(event) => setAdiantamentoValor(event.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Data do adiantamento</label>
                      <input
                        type="date"
                        value={adiantamentoData}
                        onChange={(event) => setAdiantamentoData(event.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                  </div>
                )}

                {temAdiantamento && (
                  <p className={`text-[11px] ${adiantamentoInvalido ? 'text-rose-600' : 'text-slate-500'}`}>
                    {adiantamentoInvalido
                      ? 'Informe valor e data do adiantamento. O valor nao pode ser maior que o total do pedido.'
                      : `Saldo restante para parcelamento normal: ${saldoParcelado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Observacoes do Pedido</label>
                <textarea
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="Complementos comerciais, observacoes de entrega ou financeiro..."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-600">Confirmacao das parcelas</p>
                    <p className="text-[11px] text-slate-400">Previa inteligente baseada na condicao de pagamento aprovada.</p>
                  </div>
                  {!cotacaoResolvida?.condicaoPagamento && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                      <AlertTriangle size={12} />
                      Sem condicao puxada da cotacao
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {parcelasEditaveis.length === 0 ? (
                    <p className="text-sm text-slate-400">Informe valor e condicao para gerar a previa.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Parcelas editaveis</p>
                          <p className="text-[11px] text-slate-400">
                            Revise valores, vencimentos e descricoes antes de emitir o pedido.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {parcelasEditadasManualmente && (
                            <button
                              type="button"
                              onClick={resetParcelas}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-white"
                            >
                              Recalcular sugestao
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={addParcela}
                            className="px-3 py-2 rounded-lg bg-teal-50 text-[11px] font-semibold text-teal-700 border border-teal-200 hover:bg-teal-100"
                          >
                            Nova parcela
                          </button>
                        </div>
                      </div>

                      {parcelasEditaveis.map((parcela) => (
                        <div key={`parcela-${parcela.numero}`} className="rounded-xl border border-slate-200 p-3 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-800">
                                  {parcela.tipo === 'adiantamento' ? 'Adiantamento' : `Parcela ${parcela.numero}`}
                                </p>
                                {parcela.tipo === 'adiantamento' && (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    Vai para Confirmados
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {parcela.tipo === 'adiantamento'
                                  ? 'Parcela especial para pagamento antecipado do fornecedor.'
                                  : 'Ajuste manual quando a negociacao fugir da sugestao automatica.'}
                              </p>
                            </div>
                            {parcelasEditaveis.length > 1 && parcela.tipo !== 'adiantamento' && (
                              <button
                                type="button"
                                onClick={() => removeParcela(parcela.numero)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-600 border border-red-200 hover:bg-red-50"
                              >
                                Remover
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Descricao</label>
                              <input
                                value={parcela.tipo === 'adiantamento' ? 'Adiantamento' : parcela.descricao ?? ''}
                                onChange={(event) => updateParcela(parcela.numero, { descricao: event.target.value })}
                                readOnly={parcela.tipo === 'adiantamento'}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                                placeholder="Ex.: Entrada, 30 dias..."
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Valor</label>
                              <NumericInput
                                min={0}
                                step={0.01}
                                value={Number.isFinite(parcela.valor) ? parcela.valor : 0}
                                onChange={v => updateParcela(parcela.numero, { valor: v })}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vencimento</label>
                              <input
                                type="date"
                                value={parcela.data_vencimento}
                                onChange={(event) => updateParcela(parcela.numero, { data_vencimento: event.target.value })}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${
                        diferencaParcelas === 0
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-amber-200 bg-amber-50'
                      }`}>
                        <div>
                          <p className={`text-sm font-semibold ${diferencaParcelas === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            Total das parcelas
                          </p>
                          <p className={`text-[11px] ${diferencaParcelas === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {diferencaParcelas === 0
                              ? 'Fechado com o valor total do pedido.'
                              : 'Ajuste os valores para fechar exatamente com o total do pedido.'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${diferencaParcelas === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {totalParcelas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className={`text-[11px] ${diferencaParcelas === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Pedido: {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* #113 – Confirmation summary: visible when ready to emit */}
              {!fluxoContrato && (classeId || centroId) && (
                <div className={`rounded-2xl border p-4 space-y-2 ${
                  classeId && centroId
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {classeId && centroId
                      ? <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />
                      : <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />}
                    <p className={`text-xs font-bold ${classeId && centroId ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {classeId && centroId ? 'Confirmação dos vínculos financeiros' : 'Preencha todos os campos antes de emitir'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className={`rounded-xl px-3 py-2 ${classeId ? 'bg-white border border-emerald-200' : 'bg-amber-100 border border-amber-300'}`}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Classe Financeira</p>
                      {classeSelecionada
                        ? <p className="text-sm font-bold text-slate-800 mt-0.5">{classeSelecionada.codigo} — {classeSelecionada.descricao}</p>
                        : <p className="text-sm font-semibold text-amber-600 mt-0.5">Não selecionada</p>}
                    </div>
                    <div className={`rounded-xl px-3 py-2 ${centroId ? 'bg-white border border-emerald-200' : 'bg-amber-100 border border-amber-300'}`}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Centro de Custo</p>
                      {centroSelecionado
                        ? <p className="text-sm font-bold text-slate-800 mt-0.5">{centroSelecionado.codigo} — {centroSelecionado.descricao}</p>
                        : <p className="text-sm font-semibold text-amber-600 mt-0.5">Não selecionado</p>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              isLoading ||
              !requisicao ||
              !cotacaoResolvida?.id ||
              (naoSolicitarContrato && !justNaoContrato.trim()) ||
              (!fluxoContrato && (
                !classeId ||
                !centroId ||
                adiantamentoInvalido ||
                !parcelasValidas ||
                diferencaParcelas !== 0
              ))
            }
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${
              fluxoContrato ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            {fluxoContrato ? 'Solicitar Contrato' : 'Emitir Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
