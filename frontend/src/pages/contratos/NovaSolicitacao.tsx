import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle,
  Save, Send, User, Building2, FileText,
  Calendar, DollarSign, Settings2, Phone, Mail,
  Loader2, Search as SearchIcon, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useObras } from '../../hooks/useFinanceiro'
import { useLookupCentrosCusto, useLookupClassesFinanceiras } from '../../hooks/useLookups'
import { useCriarSolicitacao } from '../../hooks/useSolicitacoes'
import { api } from '../../services/api'
import type {
  TipoContraparte, TipoContratoV2, CategoriaContrato,
  UrgenciaSolicitacao, NovaSolicitacaoPayload, TipoSolicitacao,
} from '../../types/contratos'

// ── CNPJ helpers ──────────────────────────────────────────────────────────────

function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface CnpjResult {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  situacao: string
  endereco?: { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
  telefone: string
  email: string
  error?: boolean
  message?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const TIPO_SOLICITACAO_OPTIONS: { value: TipoSolicitacao; label: string; desc: string }[] = [
  { value: 'novo_contrato',     label: 'Novo Contrato',   desc: 'Contrato inicial, sem vínculo anterior' },
  { value: 'aditivo_contratual', label: 'Aditivo',         desc: 'Aditivo de prazo, valor ou escopo' },
  { value: 'distrato_rescisao', label: 'Distrato/Rescisao', desc: 'Encerramento ou rescisao contratual' },
]

const TIPO_CONTRAPARTE_OPTIONS: { value: TipoContraparte; label: string; desc: string }[] = [
  { value: 'fornecedor', label: 'Fornecedor', desc: 'Prestador de servico ou fornecedor de materiais' },
  { value: 'cliente',    label: 'Cliente',     desc: 'Cliente contratante de servicos da TEG' },
  { value: 'pj',         label: 'PJ',          desc: 'Pessoa juridica / prestador PJ' },
]

const TIPO_CONTRATO_OPTIONS: { value: TipoContratoV2; label: string }[] = [
  { value: 'receita', label: 'Receita (A Receber)' },
  { value: 'despesa', label: 'Despesa (A Pagar)' },
  { value: 'pj',      label: 'PJ (Prestador)' },
]

const CATEGORIA_OPTIONS: { value: CategoriaContrato; label: string }[] = [
  { value: 'alimentacao_restaurante',  label: 'Alimentacao / Restaurante' },
  { value: 'aquisicao_equipamentos',   label: 'Aquisicao de Equipamentos' },
  { value: 'aquisicao_ferramental',    label: 'Aquisicao de Ferramental' },
  { value: 'aquisicao_imovel',         label: 'Aquisicao de Imovel' },
  { value: 'aquisicao_veiculos',       label: 'Aquisicao de Veiculos' },
  { value: 'arrendamento_comodato',    label: 'Arrendamento / Comodato' },
  { value: 'contabilidade',            label: 'Contabilidade' },
  { value: 'frete_transportes',        label: 'Frete / Transportes' },
  { value: 'hospedagem',               label: 'Hospedagem' },
  { value: 'internet_telefonia',       label: 'Internet e Telefonia' },
  { value: 'juridico_advocacia',       label: 'Juridico / Advocacia' },
  { value: 'locacao_equipamentos',     label: 'Locacao de Equipamentos' },
  { value: 'locacao_ferramental',      label: 'Locacao de Ferramental' },
  { value: 'locacao_imovel_alojamento', label: 'Locacao de Imovel - Alojamento' },
  { value: 'locacao_imovel_canteiro',  label: 'Locacao de Imovel - Canteiro de Obras' },
  { value: 'locacao_imovel_deposito',  label: 'Locacao de Imovel - Deposito' },
  { value: 'locacao_veiculos',         label: 'Locacao de Veiculos' },
  { value: 'prestacao_servico',        label: 'Prestacao de Servicos - Terceiros' },
  { value: 'seguros',                  label: 'Seguros' },
  { value: 'servicos_medicos',         label: 'Servicos Medicos' },
  { value: 'software_ti',             label: 'Software e TI' },
  { value: 'subcontratacao',          label: 'Subcontratacao de Empresas' },
  { value: 'vigilancia_monitoramento', label: 'Vigilancia e Monitoramento' },
  { value: 'empreitada',              label: 'Empreitada' },
  { value: 'consultoria',             label: 'Consultoria' },
  { value: 'pj_pessoa_fisica',        label: 'PJ Pessoa Fisica' },
  { value: 'outro',                   label: 'Outro' },
]

const URGENCIA_OPTIONS: { value: UrgenciaSolicitacao; label: string; color: string; prazo: string }[] = [
  { value: 'critica', label: 'Urgente',     color: 'border-red-500 bg-red-50 text-red-700',       prazo: 'ate 7 dias' },
  { value: 'alta',    label: 'Prioritario', color: 'border-orange-500 bg-orange-50 text-orange-700', prazo: 'ate 15 dias' },
  { value: 'normal',  label: 'Normal',      color: 'border-slate-400 bg-slate-50 text-slate-700',   prazo: '30 dias' },
  { value: 'baixa',   label: 'Baixa',       color: 'border-green-500 bg-green-50 text-green-700',   prazo: 'sem prazo' },
]

const INDICE_REAJUSTE_OPTIONS = [
  { value: '', label: 'Nenhum' },
  { value: 'IGPM', label: 'IGP-M' },
  { value: 'IPCA', label: 'IPCA' },
  { value: 'INPC', label: 'INPC' },
  { value: 'Outro', label: 'Outro' },
]

const SETOR_OPTIONS = [
  'Engenharia', 'Suprimentos', 'Diretoria', 'Tecnologia da Informacao',
  'Recursos Humanos', 'Administrativo', 'Financeiro', 'Outro',
]

const SIM_NAO_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Nao' },
  { value: 'nao_sei', label: 'Nao sei informar' },
]

const STEPS = [
  { num: 1, label: 'Identificacao',            icon: User },
  { num: 2, label: 'Dados da Solicitacao',     icon: FileText },
  { num: 3, label: 'Vigencia e Classificacao', icon: Settings2 },
]

// ── BRL Format helpers ───────────────────────────────────────────────────────

function formatBRL(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseBRL(formatted: string): number {
  const clean = formatted.replace(/\./g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

// ── FilterSelect (combobox with type-to-filter) ─────────────────────────────

function FilterSelect({ label, value, onChange, options, placeholder, labelClass, inputClass }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string; value: string }[]
  placeholder?: string
  labelClass: string
  inputClass: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  const displayValue = value
    ? options.find(o => o.value === value)?.label ?? value
    : ''

  return (
    <div ref={ref} className="relative">
      <label className={labelClass}>{label}</label>
      <input
        type="text"
        value={open ? query : displayValue}
        placeholder={placeholder}
        className={inputClass}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
      />
      {value && !open && (
        <button
          type="button"
          onClick={() => { onChange(''); setQuery(''); setOpen(true) }}
          className="absolute right-2 top-[calc(50%+10px)] -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
        >✕</button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Nenhum resultado</p>
          ) : filtered.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onChange(o.value); setQuery(''); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors ${
                o.value === value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NovaSolicitacao() {
  const nav = useNavigate()
  const { perfil } = useAuth()
  const { data: obras = [] } = useObras()
  const centrosCusto = useLookupCentrosCusto()
  const classesFinanceiras = useLookupClassesFinanceiras()
  const criarSolicitacao = useCriarSolicitacao()

  const [step, setStep] = useState(1)
  const [erro, setErro] = useState('')
  const [touched, setTouched] = useState(false)

  // Step 1 — Identificacao do Solicitante
  const [solicitanteNome, setSolicitanteNome] = useState(perfil?.nome ?? '')
  const [departamento, setDepartamento] = useState(perfil?.departamento ?? '')
  const [emailCorporativo] = useState(perfil?.email ?? '')
  const [obraId, setObraId] = useState('')

  // Step 2 — Dados da Solicitacao
  const [tipoSolicitacao, setTipoSolicitacao] = useState<TipoSolicitacao>('novo_contrato')
  const [tipoContraparte, setTipoContraparte] = useState<TipoContraparte>('fornecedor')
  const [contraparteNome, setContraparteNome] = useState('')
  const [contraparteCnpj, setContraparteCnpj] = useState('')
  const [contraparteTelefone, setContraparteTelefone] = useState('')
  const [contraparteEmail, setContraparteEmail] = useState('')
  const [contraparteEndereco, setContraparteEndereco] = useState('')
  const [contraparteRepNome, setContraparteRepNome] = useState('')
  const [contraparteRepCpf, setContraparteRepCpf] = useState('')
  const [contraparteRepCargo, setContraparteRepCargo] = useState('')
  const [fornecedorCadastrado, setFornecedorCadastrado] = useState('')
  const [contratoVigente, setContratoVigente] = useState('')
  const [tipoContrato, setTipoContrato] = useState<TipoContratoV2>('despesa')
  const [categoriaContrato, setCategoriaContrato] = useState<CategoriaContrato>('prestacao_servico')
  const [objeto, setObjeto] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [valorEstimadoDisplay, setValorEstimadoDisplay] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [descricaoEscopo, setDescricaoEscopo] = useState('')

  // Step 3 — Vigencia e Classificacao
  const [dataInicioPrevista, setDataInicioPrevista] = useState('')
  const [dataFimPrevista, setDataFimPrevista] = useState('')
  const [prazoMeses, setPrazoMeses] = useState<number | ''>('')
  const [centroCusto, setCentroCusto] = useState('')
  const [classeFinanceira, setClasseFinanceira] = useState('')
  const [indiceReajuste, setIndiceReajuste] = useState('')
  const [urgencia, setUrgencia] = useState<UrgenciaSolicitacao>('normal')
  const [dataNecessidade, setDataNecessidade] = useState('')
  const [responsavelAprovacao, setResponsavelAprovacao] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // CNPJ auto-fill state
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjStatus, setCnpjStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const cnpjLastRef = useRef('')

  // Auto-fill solicitante when perfil loads
  useEffect(() => {
    if (perfil?.nome && !solicitanteNome) setSolicitanteNome(perfil.nome)
    if (perfil?.departamento && !departamento) setDepartamento(perfil.departamento ?? '')
  }, [perfil, solicitanteNome, departamento])

  // Auto-calc prazo from dates
  useEffect(() => {
    if (dataInicioPrevista && dataFimPrevista) {
      const start = new Date(dataInicioPrevista)
      const end = new Date(dataFimPrevista)
      const diff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
      if (diff > 0) setPrazoMeses(diff)
    }
  }, [dataInicioPrevista, dataFimPrevista])

  // ── CNPJ auto-fill ─────────────────────────────────────────────────────────

  const handleCnpjLookup = useCallback(async (rawCnpj: string) => {
    const digits = rawCnpj.replace(/\D/g, '')
    if (digits.length !== 14) return
    if (cnpjLastRef.current === digits) return
    cnpjLastRef.current = digits

    setCnpjLoading(true)
    setCnpjStatus(null)

    try {
      const result: CnpjResult = await api.consultarCNPJ(digits)
      if (result.error) {
        setCnpjStatus({ ok: false, msg: result.message || 'CNPJ nao encontrado' })
      } else {
        setCnpjStatus({ ok: true, msg: result.situacao || 'Ativa' })
        // Auto-fill fields (only if empty)
        if (!contraparteNome.trim()) {
          setContraparteNome(result.nome_fantasia || result.razao_social)
        }
        if (!contraparteTelefone.trim() && result.telefone) {
          setContraparteTelefone(result.telefone)
        }
        if (!contraparteEmail.trim() && result.email) {
          setContraparteEmail(result.email)
        }
      }
    } catch {
      setCnpjStatus({ ok: false, msg: 'Erro na consulta CNPJ' })
    } finally {
      setCnpjLoading(false)
    }
  }, [contraparteNome, contraparteTelefone, contraparteEmail])

  const handleCnpjChange = useCallback((raw: string) => {
    const masked = maskCNPJ(raw)
    setContraparteCnpj(masked)
    const digits = raw.replace(/\D/g, '')
    if (digits.length === 14) {
      handleCnpjLookup(raw)
    } else {
      setCnpjStatus(null)
      cnpjLastRef.current = ''
    }
  }, [handleCnpjLookup])

  // ── Validation ───────────────────────────────────────────────────────────

  const validateStep = useCallback((s: number): string | null => {
    if (s === 1) {
      if (!solicitanteNome.trim()) return 'Informe o nome do solicitante'
    }
    if (s === 2) {
      if (!contraparteNome.trim()) return 'Informe o nome da contraparte'
      if (!objeto.trim()) return 'Informe o objeto do contrato'
    }
    return null
  }, [solicitanteNome, contraparteNome, objeto])

  const handleNext = () => {
    setTouched(true)
    const err = validateStep(step)
    if (err) { setErro(err); return }
    setErro('')
    setTouched(false)
    setStep(prev => Math.min(prev + 1, 3))
  }

  const handlePrev = () => {
    setErro('')
    setTouched(false)
    setStep(prev => Math.max(prev - 1, 1))
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const buildPayload = (): NovaSolicitacaoPayload => ({
    solicitante_id: perfil?.id,
    solicitante_nome: solicitanteNome.trim(),
    departamento: departamento.trim() || undefined,
    obra_id: obraId || undefined,
    tipo_solicitacao: tipoSolicitacao,
    tipo_contraparte: tipoContraparte,
    contraparte_nome: contraparteNome.trim(),
    contraparte_cnpj: contraparteCnpj.replace(/\D/g, '') || undefined,
    contraparte_telefone: contraparteTelefone.trim() || undefined,
    contraparte_email: contraparteEmail.trim() || undefined,
    contraparte_endereco: contraparteEndereco.trim() || undefined,
    contraparte_representante_nome: contraparteRepNome.trim() || undefined,
    contraparte_representante_cpf: contraparteRepCpf.trim() || undefined,
    contraparte_representante_cargo: contraparteRepCargo.trim() || undefined,
    fornecedor_cadastrado: fornecedorCadastrado || undefined,
    contrato_vigente_fornecedor: contratoVigente || undefined,
    responsavel_aprovacao: responsavelAprovacao.trim() || undefined,
    tipo_contrato: tipoContrato,
    categoria_contrato: categoriaContrato,
    objeto: objeto.trim(),
    descricao_escopo: descricaoEscopo.trim() || undefined,
    justificativa: justificativa.trim() || undefined,
    valor_estimado: valorEstimadoDisplay ? parseBRL(valorEstimadoDisplay) : undefined,
    forma_pagamento: formaPagamento.trim() || undefined,
    data_inicio_prevista: dataInicioPrevista || undefined,
    data_fim_prevista: dataFimPrevista || undefined,
    prazo_meses: typeof prazoMeses === 'number' ? prazoMeses : undefined,
    centro_custo: centroCusto.trim() || undefined,
    classe_financeira: classeFinanceira.trim() || undefined,
    indice_reajuste: indiceReajuste || undefined,
    urgencia,
    data_necessidade: dataNecessidade || undefined,
    observacoes: observacoes.trim() || undefined,
  })

  const handleSaveRascunho = async () => {
    setTouched(true)
    setErro('')
    if (!solicitanteNome.trim()) return setErro('Informe o nome do solicitante')
    if (!contraparteNome.trim()) return setErro('Informe o nome da contraparte')
    if (!objeto.trim()) return setErro('Informe o objeto do contrato')

    try {
      const result = await criarSolicitacao.mutateAsync({
        ...buildPayload(),
        status: 'rascunho',
        etapa_atual: 'solicitacao',
      })
      nav(`/contratos/solicitacoes/${result.id}`)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar rascunho')
    }
  }

  const handleEnviar = async () => {
    setTouched(true)
    setErro('')
    if (!solicitanteNome.trim()) return setErro('Informe o nome do solicitante')
    if (!contraparteNome.trim()) return setErro('Informe o nome da contraparte')
    if (!objeto.trim()) return setErro('Informe o objeto do contrato')

    try {
      const result = await criarSolicitacao.mutateAsync({
        ...buildPayload(),
        status: 'em_andamento',
        etapa_atual: 'preparar_minuta',
      })
      nav(`/contratos/solicitacoes/${result.id}`)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar solicitacao')
    }
  }

  // ── Shared styles ────────────────────────────────────────────────────────

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'
  const errorBorder = (field: string) =>
    touched && !field.trim() ? 'border-red-300 ring-1 ring-red-200' : ''

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => nav('/contratos/solicitacoes')}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center
            text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Nova Solicitacao de Contrato</h1>
          <p className="text-xs text-slate-400 mt-0.5">Preencha os dados para iniciar o fluxo de contratacao</p>
        </div>
      </div>

      {/* ── Step Indicator ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            const isActive = step === s.num
            const isDone = step > s.num
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2
                      transition-all duration-300
                      ${isDone
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : isActive
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-600'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                  >
                    {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                  </div>
                  <p className={`text-[10px] font-semibold mt-1.5 text-center leading-tight
                    ${isActive ? 'text-indigo-600' : isDone ? 'text-slate-600' : 'text-slate-400'}`}>
                    {s.label}
                  </p>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 mt-[-18px] rounded-full transition-all
                    ${step > s.num ? 'bg-indigo-500' : 'bg-slate-200'}`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Step 1: Identificacao do Solicitante ───────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <User size={14} className="text-indigo-600" />
            Identificacao do Solicitante
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nome Completo *</label>
              <input
                value={solicitanteNome}
                onChange={e => setSolicitanteNome(e.target.value)}
                placeholder="Nome do solicitante"
                className={`${inputClass} ${errorBorder(solicitanteNome)}`}
              />
              {perfil?.nome && (
                <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={9} /> Preenchido automaticamente
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Setor / Departamento</label>
              <select
                value={departamento}
                onChange={e => setDepartamento(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione o setor</option>
                {SETOR_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {perfil?.departamento && (
                <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={9} /> Preenchido automaticamente
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>E-mail Corporativo</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={emailCorporativo}
                  readOnly
                  className={`${inputClass} pl-9 bg-slate-50 text-slate-500`}
                />
              </div>
              <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                <ShieldCheck size={9} /> Vinculado ao seu perfil
              </p>
            </div>
            <div>
              <label className={labelClass}>Obra</label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={obraId}
                  onChange={e => setObraId(e.target.value)}
                  className={`${inputClass} pl-9`}
                >
                  <option value="">Selecione a obra (opcional)</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Dados da Solicitacao ────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <FileText size={14} className="text-indigo-600" />
            Dados da Solicitacao
          </h2>

          {/* Tipo de Solicitacao */}
          <div>
            <label className={labelClass}>Tipo de Solicitacao *</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPO_SOLICITACAO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTipoSolicitacao(opt.value)}
                  className={`py-3 px-2 rounded-xl text-center border-2 transition-all
                    ${tipoSolicitacao === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo do Contrato *</label>
              <select
                value={tipoContrato}
                onChange={e => setTipoContrato(e.target.value as TipoContratoV2)}
                className={inputClass}
              >
                {TIPO_CONTRATO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Categoria *</label>
              <select
                value={categoriaContrato}
                onChange={e => setCategoriaContrato(e.target.value as CategoriaContrato)}
                className={inputClass}
              >
                {CATEGORIA_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tipo Contraparte */}
          <div>
            <label className={labelClass}>Tipo da Contraparte *</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPO_CONTRAPARTE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTipoContraparte(opt.value)}
                  className={`py-3 px-2 rounded-xl text-center border-2 transition-all
                    ${tipoContraparte === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── CNPJ + Auto-fill block ──────────────────────── */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <SearchIcon size={10} />
              Dados da Contraparte — CNPJ auto-preenche
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CNPJ field with auto-fill */}
              <div>
                <label className={labelClass}>CPF / CNPJ *</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={contraparteCnpj}
                    onChange={e => handleCnpjChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className={`${inputClass} pl-9 pr-10`}
                  />
                  {cnpjLoading && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                  )}
                  {!cnpjLoading && cnpjStatus?.ok && (
                    <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                  )}
                  {!cnpjLoading && cnpjStatus && !cnpjStatus.ok && (
                    <AlertTriangle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                  )}
                </div>
                {cnpjLoading && (
                  <p className="text-[9px] text-indigo-500 mt-1 flex items-center gap-1">
                    <Loader2 size={9} className="animate-spin" /> Buscando dados do CNPJ...
                  </p>
                )}
                {cnpjStatus?.ok && (
                  <p className="text-[9px] text-emerald-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={9} /> Situacao: {cnpjStatus.msg}
                  </p>
                )}
                {cnpjStatus && !cnpjStatus.ok && (
                  <p className="text-[9px] text-red-500 mt-1">{cnpjStatus.msg}</p>
                )}
              </div>

              {/* Nome (auto-filled) */}
              <div>
                <label className={labelClass}>Nome / Razao Social *</label>
                <input
                  value={contraparteNome}
                  onChange={e => setContraparteNome(e.target.value)}
                  placeholder="Razao social ou nome fantasia"
                  className={`${inputClass} ${errorBorder(contraparteNome)}`}
                />
                {cnpjStatus?.ok && contraparteNome && (
                  <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                    <ShieldCheck size={9} /> Preenchido via CNPJ
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Telefone (auto-filled) */}
              <div>
                <label className={labelClass}>Telefone com DDD</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={contraparteTelefone}
                    onChange={e => setContraparteTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                {cnpjStatus?.ok && contraparteTelefone && (
                  <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                    <ShieldCheck size={9} /> Preenchido via CNPJ
                  </p>
                )}
              </div>

              {/* Email (auto-filled) */}
              <div>
                <label className={labelClass}>E-mail</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={contraparteEmail}
                    onChange={e => setContraparteEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                {cnpjStatus?.ok && contraparteEmail && (
                  <p className="text-[9px] text-emerald-500 mt-0.5 flex items-center gap-1">
                    <ShieldCheck size={9} /> Preenchido via CNPJ
                  </p>
                )}
              </div>
            </div>

            {/* Endereço + Representante legal */}
            <div>
              <label className={labelClass}>{`Endere\u00e7o da Contraparte`}</label>
              <input value={contraparteEndereco} onChange={e => setContraparteEndereco(e.target.value)}
                placeholder="Rua, n\u00famero, bairro, cidade/UF, CEP" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Representante Legal</label>
                <input value={contraparteRepNome} onChange={e => setContraparteRepNome(e.target.value)}
                  placeholder="Nome completo" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CPF do Representante</label>
                <input value={contraparteRepCpf} onChange={e => setContraparteRepCpf(e.target.value)}
                  placeholder="000.000.000-00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cargo</label>
                <input value={contraparteRepCargo} onChange={e => setContraparteRepCargo(e.target.value)}
                  placeholder="Ex: Diretor, S\u00f3cio" className={inputClass} />
              </div>
            </div>

            {/* Cadastro checks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Possui cadastro ativo na TEG?</label>
                <div className="flex gap-2">
                  {SIM_NAO_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setFornecedorCadastrado(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-all
                        ${fornecedorCadastrado === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Existe contrato vigente?</label>
                <div className="flex gap-2">
                  {SIM_NAO_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setContratoVigente(opt.value)}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-all
                        ${contratoVigente === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Objeto + Justificativa */}
          <div>
            <label className={labelClass}>Objeto do Contrato *</label>
            <input
              value={objeto}
              onChange={e => setObjeto(e.target.value)}
              placeholder="Descricao resumida do objeto do contrato"
              className={`${inputClass} ${errorBorder(objeto)}`}
            />
          </div>

          <div>
            <label className={labelClass}>Justificativa (responsavel, obra, setor, municipio e motivo)</label>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Informe quem e o responsavel, obra, setor, municipio e o motivo da solicitacao..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>Descricao do Escopo</label>
            <textarea
              value={descricaoEscopo}
              onChange={e => setDescricaoEscopo(e.target.value)}
              placeholder="Detalhe o escopo dos servicos ou fornecimentos..."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Valor Contratado / Estimado</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  R$
                </span>
                <input
                  value={valorEstimadoDisplay}
                  onChange={e => setValorEstimadoDisplay(formatBRL(e.target.value))}
                  placeholder="0,00"
                  className={`${inputClass} pl-16`}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Forma de Pagamento</label>
              <input
                value={formaPagamento}
                onChange={e => setFormaPagamento(e.target.value)}
                placeholder="Ex: 30/60/90 dias, mensal, parcela unica"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Vigencia e Classificacao ──────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <Settings2 size={14} className="text-indigo-600" />
            Vigencia e Classificacao
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Data Inicio</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dataInicioPrevista}
                  onChange={e => setDataInicioPrevista(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Data Fim Prevista</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dataFimPrevista}
                  onChange={e => setDataFimPrevista(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Prazo de Vigencia (meses)</label>
              <input
                type="number"
                value={prazoMeses}
                onChange={e => setPrazoMeses(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Auto-calculado"
                className={inputClass}
                min={0}
              />
              <p className="text-[9px] text-slate-400 mt-0.5">Calculado automaticamente pelas datas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FilterSelect
              label="Centro de Custo"
              value={centroCusto}
              onChange={setCentroCusto}
              options={centrosCusto.map(cc => ({ id: cc.id, label: `${cc.codigo ? `${cc.codigo} - ` : ''}${cc.descricao}`, value: cc.descricao }))}
              placeholder="Digite para filtrar..."
              labelClass={labelClass}
              inputClass={inputClass}
            />
            <FilterSelect
              label="Classe Financeira"
              value={classeFinanceira}
              onChange={setClasseFinanceira}
              options={classesFinanceiras.map(cf => ({ id: cf.id, label: `${cf.codigo ? `${cf.codigo} - ` : ''}${cf.descricao}`, value: cf.descricao }))}
              placeholder="Digite para filtrar..."
              labelClass={labelClass}
              inputClass={inputClass}
            />
            <div>
              <label className={labelClass}>Indice de Reajuste</label>
              <select
                value={indiceReajuste}
                onChange={e => setIndiceReajuste(e.target.value)}
                className={inputClass}
              >
                {INDICE_REAJUSTE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Urgencia da Demanda</label>
            <div className="grid grid-cols-4 gap-2">
              {URGENCIA_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setUrgencia(opt.value)}
                  className={`py-2.5 rounded-xl text-center border-2 transition-all
                    ${urgencia === opt.value ? opt.color : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[9px] opacity-70">{opt.prazo}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data de Necessidade</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={dataNecessidade}
                  onChange={e => setDataNecessidade(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Responsavel pela Aprovacao</label>
              <input
                value={responsavelAprovacao}
                onChange={e => setResponsavelAprovacao(e.target.value)}
                placeholder="Nome do responsavel (se aplicavel)"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Informacoes Complementares</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Informacoes adicionais, referencias, contatos..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────── */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{erro}</p>
        </div>
      )}

      {/* ── Navigation Buttons ──────────────────────────────── */}
      <div className="flex gap-3">
        {step > 1 ? (
          <button
            onClick={handlePrev}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-2 border-slate-200
              text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft size={14} />
            Anterior
          </button>
        ) : (
          <button
            onClick={() => nav('/contratos/solicitacoes')}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-2 border-slate-200
              text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
        )}

        <div className="flex-1" />

        {step < 3 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-indigo-600 text-white
              text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
          >
            Proximo
            <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSaveRascunho}
              disabled={criarSolicitacao.isPending}
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl border-2 border-indigo-200
                bg-indigo-50 text-sm font-bold text-indigo-700
                hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              {criarSolicitacao.isPending
                ? <div className="w-4 h-4 border-2 border-indigo-400/40 border-t-indigo-600 rounded-full animate-spin" />
                : <Save size={14} />
              }
              Salvar Rascunho
            </button>
            <button
              onClick={handleEnviar}
              disabled={criarSolicitacao.isPending}
              className="flex items-center gap-1.5 px-6 py-3 rounded-xl bg-indigo-600 text-white
                text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200
                disabled:opacity-50"
            >
              {criarSolicitacao.isPending
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send size={14} />
              }
              Enviar Solicitacao
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
