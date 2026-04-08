import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronDown, FileText, Clock, DollarSign, BarChart3,
  FileSignature, RefreshCw, Download, ExternalLink, Calendar,
  Building2, MapPin, Loader2, AlertTriangle, CheckCircle2,
  CircleDot, ArrowUpRight, ArrowDownRight, Hash, Briefcase,
  Pencil, X, Check, Upload, Folder, File as FileIcon,
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import { useAtualizarContrato, useUploadContratoArquivo } from '../../hooks/useContratos'
import type {
  Contrato, Parcela, ContratoAditivo, ContratoReajuste, ContratoMedicao,
  Minuta, Assinatura, SolicitacaoHistorico, Solicitacao,
  GrupoContrato, StatusParcela,
} from '../../types/contratos'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtCompact = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(0)}k`
      : fmt(v)

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const diffMonths = (start?: string, end?: string) => {
  if (!start || !end) return null
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  em_negociacao: { label: 'Em Negociacao', dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  assinado:      { label: 'Assinado',      dot: 'bg-blue-400',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  vigente:       { label: 'Vigente',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  suspenso:      { label: 'Suspenso',      dot: 'bg-orange-400', bg: 'bg-orange-50',  text: 'text-orange-700' },
  encerrado:     { label: 'Encerrado',     dot: 'bg-slate-400',  bg: 'bg-slate-100',  text: 'text-slate-600' },
  rescindido:    { label: 'Rescindido',    dot: 'bg-red-400',    bg: 'bg-red-50',     text: 'text-red-600' },
}

const PARCELA_STATUS: Record<StatusParcela, { label: string; dot: string; bg: string; text: string }> = {
  previsto:  { label: 'Previsto',  dot: 'bg-slate-300',   bg: 'bg-slate-50',   text: 'text-slate-600' },
  pendente:  { label: 'Pendente',  dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  liberado:  { label: 'Liberado',  dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  pago:      { label: 'Pago',      dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelado: { label: 'Cancelado', dot: 'bg-red-400',     bg: 'bg-red-50',     text: 'text-red-600' },
}

// ── Editable Link Field ───────────────────────────────────────────────────────
function EditableLink({ label, value, saving, onSave }: {
  label: string
  value?: string | null
  saving?: boolean
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const handleSave = () => {
    onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="col-span-2 md:col-span-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="https://empresa.sharepoint.com/..."
          />
          <button onClick={handleSave} disabled={saving} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button onClick={() => { setDraft(value ?? ''); setEditing(false) }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="col-span-2 md:col-span-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 truncate max-w-sm"
          >
            <Folder size={13} className="shrink-0" />
            <span className="truncate">{value}</span>
            <ExternalLink size={11} className="shrink-0 opacity-60" />
          </a>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}
        <button onClick={() => { setDraft(value ?? ''); setEditing(true) }} className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors shrink-0">
          <Pencil size={11} />
        </button>
      </div>
    </div>
  )
}

// ── Collapsible Section ──────────────────────────────────────────────────────
function Section({ icon: Icon, title, count, defaultOpen = true, children }: {
  icon: React.ElementType
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-6 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
        <Icon size={18} className="text-indigo-500" />
        <span className="text-sm font-bold text-slate-800">{title}</span>
        {(count ?? 0) > 0 && (
          <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{count}</span>
        )}
        <ChevronDown className={`ml-auto text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} size={16} />
      </button>
      {open && <div className="px-6 pb-5 border-t border-slate-100 pt-4">{children}</div>}
    </div>
  )
}

// ── Info field ────────────────────────────────────────────────────────────────
function Field({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm text-slate-700 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-black">{value}</p>
      {sub && <p className="text-[10px] mt-0.5 opacity-70">{sub}</p>}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
      <AlertTriangle size={14} />
      <span className="text-xs">{text}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ContratoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Mutations ─────────────────────────────────────────────────────────
  const atualizarContrato = useAtualizarContrato()
  const uploadArquivo = useUploadContratoArquivo()
  const [uploadErro, setUploadErro] = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────────────────────
  const { data: contrato, isLoading: loadingContrato } = useQuery({
    queryKey: ['contrato-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_contratos')
        .select('*, fornecedor:cmp_fornecedores(id,razao_social,nome_fantasia,cnpj), obra:sys_obras(id,codigo,nome), cliente:con_clientes(id,nome,cnpj)')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Contrato
    },
    enabled: !!id,
  })

  const solicitacaoId = contrato?.solicitacao_id

  const { data: solicitacao } = useQuery({
    queryKey: ['contrato-solicitacao', solicitacaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_solicitacoes')
        .select('*')
        .eq('id', solicitacaoId!)
        .single()
      return data as Solicitacao | null
    },
    enabled: !!solicitacaoId,
  })

  const { data: minutas = [] } = useQuery({
    queryKey: ['contrato-minutas', solicitacaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_minutas')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('versao', { ascending: false })
      return (data ?? []) as Minuta[]
    },
    enabled: !!solicitacaoId,
  })

  const { data: assinaturas = [] } = useQuery({
    queryKey: ['contrato-assinaturas', solicitacaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_assinaturas')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
      return (data ?? []) as Assinatura[]
    },
    enabled: !!solicitacaoId,
  })

  const { data: parcelas = [] } = useQuery({
    queryKey: ['contrato-parcelas', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_parcelas')
        .select('*')
        .eq('contrato_id', id!)
        .order('numero', { ascending: true })
      return (data ?? []) as Parcela[]
    },
    enabled: !!id,
  })

  const { data: aditivos = [] } = useQuery({
    queryKey: ['contrato-aditivos', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_aditivos')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as ContratoAditivo[]
    },
    enabled: !!id,
  })

  const { data: medicoes = [] } = useQuery({
    queryKey: ['contrato-medicoes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_medicoes')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as ContratoMedicao[]
    },
    enabled: !!id,
  })

  const { data: reajustes = [] } = useQuery({
    queryKey: ['contrato-reajustes', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_reajustes')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: false })
      return (data ?? []) as ContratoReajuste[]
    },
    enabled: !!id,
  })

  const { data: historico = [] } = useQuery({
    queryKey: ['contrato-historico', solicitacaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_solicitacao_historico')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: true })
      return (data ?? []) as SolicitacaoHistorico[]
    },
    enabled: !!solicitacaoId,
  })

  // ── Loading / Not found ───────────────────────────────────────────────────
  if (loadingContrato) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Carregando contrato...</span>
      </div>
    )
  }

  if (!contrato) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle size={32} className="text-slate-300" />
        <p className="text-sm text-slate-500">Contrato nao encontrado</p>
        <button onClick={() => nav('/contratos/gestao')} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
          <ChevronLeft size={14} /> Voltar para Gestao
        </button>
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const st = STATUS_MAP[contrato.status] ?? STATUS_MAP.em_negociacao
  const contraparte = contrato.fornecedor?.razao_social || contrato.fornecedor?.nome_fantasia || contrato.cliente?.nome || solicitacao?.contraparte_nome || '—'
  const contraparteCnpj = contrato.fornecedor?.cnpj || contrato.cliente?.cnpj || solicitacao?.contraparte_cnpj
  const meses = diffMonths(contrato.data_inicio, contrato.data_fim_previsto)
  const valorTotal = contrato.valor_total + (contrato.valor_aditivos || 0)
  const valorMensal = meses ? valorTotal / meses : null
  const parcelasPagas = parcelas.filter(p => p.status === 'pago')
  const totalPago = parcelasPagas.reduce((s, p) => s + p.valor, 0)
  const totalMedido = medicoes.reduce((s, m) => s + m.valor_medido, 0)
  const execPct = valorTotal > 0 ? Math.round((totalMedido / valorTotal) * 100) : (totalPago > 0 && valorTotal > 0 ? Math.round((totalPago / valorTotal) * 100) : 0)
  const grupoLabel = contrato.grupo_contrato ? (GRUPO_CONTRATO_LABEL[contrato.grupo_contrato as GrupoContrato] ?? contrato.grupo_contrato) : '—'

  // ── Timeline dot color ────────────────────────────────────────────────────
  const timelineDot = (h: SolicitacaoHistorico) => {
    const to = h.etapa_para?.toLowerCase() || ''
    if (to.includes('cancelado') || to.includes('rejeitado')) return 'bg-red-500'
    if (to.includes('aprovacao') || to.includes('pendente') || to.includes('aguardando')) return 'bg-amber-400'
    return 'bg-emerald-500'
  }

  const etapaLabel = (e: string) =>
    e?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Back + Header ─────────────────────────────────────────────────── */}
      <button onClick={() => nav('/contratos/gestao')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors mb-1">
        <ChevronLeft size={14} /> Voltar para Gestao
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 rounded-lg px-2.5 py-1">{contrato.numero}</span>
              {solicitacao?.numero && (
                <span className="text-[10px] font-mono text-violet-500 bg-violet-50 rounded-lg px-2 py-0.5">{solicitacao.numero}</span>
              )}
            </div>
            <h1 className="text-lg font-black text-slate-800">{contrato.objeto || 'Contrato sem objeto'}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Building2 size={13} />
              <span className="font-semibold">{contraparte}</span>
              {contraparteCnpj && <span className="text-[10px] text-slate-400 font-mono">({contraparteCnpj})</span>}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full text-xs font-bold px-3 py-1.5 ${st.bg} ${st.text} shrink-0`}>
            <span className={`w-2 h-2 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <SummaryCard icon={DollarSign} label="Valor Total" value={fmtCompact(valorTotal)} sub={valorMensal ? `${fmt(valorMensal)}/mes` : undefined} color="indigo" />
          <SummaryCard icon={Calendar} label="Vigencia" value={meses ? `${meses} meses` : '—'} sub={contrato.data_fim_previsto ? `ate ${fmtDate(contrato.data_fim_previsto)}` : undefined} color="violet" />
          <SummaryCard icon={Hash} label="Parcelas" value={parcelas.length > 0 ? `${parcelasPagas.length}/${parcelas.length}` : '—'} sub={parcelasPagas.length > 0 ? 'pagas' : 'nenhuma parcela'} color="emerald" />
          <SummaryCard icon={BarChart3} label="Execucao" value={`${execPct}%`} sub="realizado" color="amber" />
        </div>
      </div>

      {/* ── Section 1: Resumo ──────────────────────────────────────────────── */}
      <Section icon={FileText} title="Resumo" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
          <Field label="Objeto" value={contrato.objeto} />
          <Field label="Grupo" value={grupoLabel} />
          <Field label="Tipo" value={contrato.tipo_contrato === 'receita' ? 'Receita' : 'Despesa'} />
          <Field label="Obra" value={contrato.obra?.nome} />
          <Field label="Centro de Custo" value={contrato.centro_custo} />
          <Field label="Classe Financeira" value={contrato.classe_financeira} />
          <Field label="Contraparte" value={contraparte} />
          <Field label="CNPJ" value={contraparteCnpj} mono />
          <Field label="Recorrencia" value={contrato.recorrencia?.replace(/_/g, ' ')} />
          <Field label="Data Inicio" value={fmtDate(contrato.data_inicio)} />
          <Field label="Data Fim Previsto" value={fmtDate(contrato.data_fim_previsto)} />
          <Field label="Data Assinatura" value={fmtDate(contrato.data_assinatura)} />
          {contrato.indice_reajuste && <Field label="Indice Reajuste" value={contrato.indice_reajuste} />}
          {contrato.garantia_tipo && <Field label="Garantia" value={`${contrato.garantia_tipo}${contrato.garantia_valor ? ' - ' + fmt(contrato.garantia_valor) : ''}`} />}
          <EditableLink
            label="Diretório do Contrato"
            value={contrato.diretorio_url}
            saving={atualizarContrato.isPending}
            onSave={v => atualizarContrato.mutate({ id: contrato.id, diretorio_url: v || undefined })}
          />
        </div>
      </Section>

      {/* ── Section 2: Linha do Tempo ─────────────────────────────────────── */}
      <Section icon={Clock} title="Linha do Tempo" count={historico.length} defaultOpen={true}>
        {historico.length === 0 ? (
          <Empty text="Nenhum historico registrado" />
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200" />
            <div className="space-y-5">
              {historico.map((h) => (
                <div key={h.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 border-white ${timelineDot(h)} shadow-sm shrink-0 z-10`} />
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-700">{etapaLabel(h.etapa_para)}</span>
                      <span className="text-[10px] text-slate-400">{fmtDateTime(h.created_at)}</span>
                    </div>
                    {h.executado_nome && (
                      <p className="text-[11px] text-slate-500 mt-0.5">por {h.executado_nome}</p>
                    )}
                    {h.observacao && (
                      <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded-xl px-3 py-2">{h.observacao}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 3: Documentos ─────────────────────────────────────────── */}
      <Section icon={FileSignature} title="Documentos" count={minutas.length + assinaturas.length} defaultOpen={true}>

        {/* Upload do Contrato */}
        <div className="mb-4 pb-4 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Arquivo do Contrato</p>
          {contrato.arquivo_url ? (
            <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon size={16} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {contrato.arquivo_url.split('/').pop()?.replace(/_/g, ' ') ?? 'Contrato'}
                  </p>
                  <p className="text-[10px] text-slate-400">Arquivo do contrato</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={contrato.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white rounded-lg px-3 py-1.5 border border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  <ExternalLink size={11} /> Visualizar
                </a>
                <a
                  href={contrato.arquivo_url}
                  download
                  className="p-1.5 rounded-lg text-indigo-500 hover:bg-white border border-transparent hover:border-indigo-200 transition-colors"
                >
                  <Download size={13} />
                </a>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
                  title="Substituir arquivo"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadArquivo.isPending}
              className="flex items-center gap-2 w-full border-2 border-dashed border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-colors disabled:opacity-50"
            >
              {uploadArquivo.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploadArquivo.isPending ? 'Enviando...' : 'Upload Contrato (PDF, DOCX, imagem...)'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadErro(null)
              try {
                await uploadArquivo.mutateAsync({ contratoId: contrato.id, file })
              } catch (err: unknown) {
                setUploadErro(err instanceof Error ? err.message : 'Erro ao enviar arquivo')
              }
              e.target.value = ''
            }}
          />
          {uploadErro && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={11} /> {uploadErro}
            </p>
          )}
        </div>

        {minutas.length === 0 && assinaturas.length === 0 ? (
          <Empty text="Nenhum documento registrado" />
        ) : (
          <div className="space-y-3">
            {/* Minutas */}
            {minutas.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{m.titulo || m.arquivo_nome}</p>
                    <p className="text-[10px] text-slate-400">{m.tipo?.replace(/_/g, ' ')} | {fmtDateTime(m.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 rounded-full px-2 py-0.5">v{m.versao}</span>
                  {m.arquivo_url && (
                    <a href={m.arquivo_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600 transition-colors">
                      <Download size={13} />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {/* Signed documents */}
            {assinaturas.filter(a => a.documento_assinado_url).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 bg-emerald-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-700">Documento Assinado</p>
                    <p className="text-[10px] text-emerald-500">{a.provedor} | {a.tipo_assinatura?.replace(/_/g, ' ')} | {fmtDateTime(a.concluido_em)}</p>
                  </div>
                </div>
                <a href={a.documento_assinado_url!} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors">
                  <Download size={13} />
                </a>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Section 4: Financeiro ─────────────────────────────────────────── */}
      <Section icon={DollarSign} title="Financeiro" count={parcelas.length} defaultOpen={true}>
        {parcelas.length === 0 ? (
          <Empty text="Nenhuma parcela registrada" />
        ) : (
          <>
            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] font-bold text-indigo-500 uppercase">Total Previsto</p>
                <p className="text-sm font-black text-indigo-700 mt-1">{fmt(valorTotal)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] font-bold text-emerald-500 uppercase">Total Pago</p>
                <p className="text-sm font-black text-emerald-700 mt-1">{fmt(totalPago)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl px-4 py-3 text-center">
                <p className="text-[10px] font-bold text-amber-500 uppercase">Saldo Restante</p>
                <p className="text-sm font-black text-amber-700 mt-1">{fmt(valorTotal - totalPago)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                <span>Progresso financeiro</span>
                <span>{valorTotal > 0 ? Math.round((totalPago / valorTotal) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all" style={{ width: `${valorTotal > 0 ? Math.min(100, (totalPago / valorTotal) * 100) : 0}%` }} />
              </div>
            </div>

            {/* Parcelas table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">#</th>
                    <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Vencimento</th>
                    <th className="text-right py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Valor</th>
                    <th className="text-center py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parcelas.map((p) => {
                    const ps = PARCELA_STATUS[p.status] ?? PARCELA_STATUS.previsto
                    const isAtrasado = p.status !== 'pago' && p.status !== 'cancelado' && new Date(p.data_vencimento) < new Date()
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-2 font-mono font-bold text-slate-500">{p.numero}</td>
                        <td className="py-2.5 px-2 text-slate-600">{fmtDate(p.data_vencimento)}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-slate-700">{fmt(p.valor)}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-2 py-0.5 ${isAtrasado ? 'bg-red-50 text-red-600' : `${ps.bg} ${ps.text}`}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isAtrasado ? 'bg-red-500' : ps.dot}`} />
                            {isAtrasado ? 'Atrasado' : ps.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      {/* ── Section 5: Medicoes ───────────────────────────────────────────── */}
      <Section icon={BarChart3} title="Medicoes" count={medicoes.length} defaultOpen={true}>
        {medicoes.length === 0 ? (
          <Empty text="Nenhuma medicao registrada" />
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                <span>Medicao acumulada</span>
                <span>{valorTotal > 0 ? Math.round((totalMedido / valorTotal) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all" style={{ width: `${valorTotal > 0 ? Math.min(100, (totalMedido / valorTotal) * 100) : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{fmt(totalMedido)} medido</span>
                <span>{fmt(valorTotal)} total</span>
              </div>
            </div>

            {/* Medicoes list */}
            <div className="space-y-2">
              {medicoes.map((m) => {
                const pctAcum = valorTotal > 0 ? Math.round((m.valor_medido / valorTotal) * 100) : 0
                return (
                  <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{m.numero_bm}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === 'aprovado' ? 'bg-emerald-50 text-emerald-600' : m.status === 'faturado' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {m.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fmtDate(m.periodo_inicio)} a {fmtDate(m.periodo_fim)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-700">{fmt(m.valor_medido)}</p>
                      <p className="text-[10px] text-violet-500 font-semibold">{pctAcum}% do total</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Section>

      {/* ── Section 6: Aditivos & Reajustes ──────────────────────────────── */}
      <Section icon={RefreshCw} title="Aditivos & Reajustes" count={aditivos.length + reajustes.length} defaultOpen={true}>
        {aditivos.length === 0 && reajustes.length === 0 ? (
          <Empty text="Nenhum aditivo ou reajuste registrado" />
        ) : (
          <div className="space-y-4">
            {/* Aditivos */}
            {aditivos.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aditivos</p>
                <div className="space-y-2">
                  {aditivos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-violet-50/50 rounded-xl px-4 py-3 border border-violet-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-700">{a.numero_aditivo}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.tipo === 'valor' ? 'bg-emerald-50 text-emerald-600' : a.tipo === 'prazo' ? 'bg-blue-50 text-blue-600' : a.tipo === 'escopo' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>
                            {a.tipo}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'aprovado' ? 'bg-emerald-50 text-emerald-600' : a.status === 'rejeitado' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {a.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{a.descricao}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {a.valor_acrescimo !== 0 && (
                          <p className={`text-xs font-bold flex items-center gap-0.5 ${a.valor_acrescimo > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {a.valor_acrescimo > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            {fmt(Math.abs(a.valor_acrescimo))}
                          </p>
                        )}
                        {a.nova_data_fim && (
                          <p className="text-[10px] text-slate-400">novo fim: {fmtDate(a.nova_data_fim)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reajustes */}
            {reajustes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reajustes</p>
                <div className="space-y-2">
                  {reajustes.map((r) => (
                    <div key={r.id} className="flex items-center justify-between bg-cyan-50/50 rounded-xl px-4 py-3 border border-cyan-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">{r.indice_nome}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.percentual_aplicado >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {r.percentual_aplicado >= 0 ? '+' : ''}{r.percentual_aplicado.toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Base: {fmtDate(r.data_base)} | Aplicado: {fmtDate(r.aplicado_em)}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-[10px] text-slate-400">{fmt(r.valor_antes)}</p>
                        <p className="text-xs font-bold text-slate-700">{fmt(r.valor_depois)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

    </div>
  )
}
