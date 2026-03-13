import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  FileText, Clock, CheckCircle2, XCircle, Search, Edit3, Send,
  ThumbsUp, ThumbsDown, Building2, Calendar, Hash, AlertTriangle,
  Loader2, X, Eye, ChevronDown, Key, Package, DollarSign, Info,
  Paperclip, Plus, Trash2, Users, MapPin, FileCheck, Download,
  ArrowUp, ArrowDown, LayoutList, LayoutGrid, Truck, ShoppingCart,
  PenLine, FileOutput, ArrowRight, Filter,
} from 'lucide-react'
import type {
  SolicitacaoNF,
  SolicitacaoNFFilters,
  StatusSolicitacaoNF,
  StatusFiscalPipeline,
  EmitirNFPayload,
} from '../../types/solicitacaoNF'
import { FISCAL_PIPELINE_STAGES } from '../../types/solicitacaoNF'
import {
  useSolicitacoesNF, useSolResumo, useCriarSolicitacao, useIniciarEmissao,
  useEmitirNF, useAnexarNFExterna, useAprovarSolicitacao,
  useRejeitarSolicitacao, useUploadDANFE,
} from '../../hooks/useSolicitacoesNF'
import type { CriarSolicitacaoPayload } from '../../types/solicitacaoNF'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtDateFull = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtRelative = (d: string) => {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return fmtDate(d)
}

const fmtCnpj = (cnpj: string) => {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return cnpj
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

const parseNum = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// ── Constants ───────────────────────────────────────────────────────────────

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

type SortField = 'data' | 'valor' | 'fornecedor'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',       label: 'Data' },
  { field: 'valor',      label: 'Valor' },
  { field: 'fornecedor', label: 'Fornecedor' },
]

const STATUS_CONFIG: Record<StatusSolicitacaoNF, {
  label: string; icon: typeof Clock
  bg: string; text: string; border: string
  darkBg: string; darkText: string; darkBorder: string
}> = {
  pendente: {
    label: 'Pendente', icon: Clock,
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
    darkBg: 'bg-amber-500/10', darkText: 'text-amber-400', darkBorder: 'border-amber-500/20',
  },
  em_emissao: {
    label: 'Em Emissao', icon: Edit3,
    bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200',
    darkBg: 'bg-blue-500/10', darkText: 'text-blue-400', darkBorder: 'border-blue-500/20',
  },
  aguardando_aprovacao: {
    label: 'Aguardando', icon: Clock,
    bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200',
    darkBg: 'bg-violet-500/10', darkText: 'text-violet-400', darkBorder: 'border-violet-500/20',
  },
  aprovada: {
    label: 'Aprovada', icon: CheckCircle2,
    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',
    darkBg: 'bg-emerald-500/10', darkText: 'text-emerald-400', darkBorder: 'border-emerald-500/20',
  },
  emitida: {
    label: 'Emitida', icon: CheckCircle2,
    bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200',
    darkBg: 'bg-green-500/10', darkText: 'text-green-400', darkBorder: 'border-green-500/20',
  },
  rejeitada: {
    label: 'Rejeitada', icon: XCircle,
    bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200',
    darkBg: 'bg-red-500/10', darkText: 'text-red-400', darkBorder: 'border-red-500/20',
  },
}

const ORIGEM_CONFIG: Record<string, { label: string; icon: typeof Truck; color: string; darkColor: string }> = {
  logistica: { label: 'Logistica', icon: Truck, color: 'text-blue-600 bg-blue-50 border-blue-200', darkColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  compras:   { label: 'Compras',   icon: ShoppingCart, color: 'text-violet-600 bg-violet-50 border-violet-200', darkColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  manual:    { label: 'Manual',    icon: PenLine, color: 'text-slate-600 bg-slate-50 border-slate-200', darkColor: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
}

const TAB_ACCENT: Record<string, {
  bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string
  darkBg: string; darkBgActive: string; darkText: string; darkTextActive: string
}> = {
  slate:  { bg: 'hover:bg-slate-50',  bgActive: 'bg-slate-100',  text: 'text-slate-500', textActive: 'text-slate-800', dot: 'bg-slate-400', border: 'ring-slate-400',
            darkBg: 'hover:bg-white/[0.03]', darkBgActive: 'bg-slate-500/10', darkText: 'text-slate-500', darkTextActive: 'text-slate-200' },
  blue:   { bg: 'hover:bg-blue-50',   bgActive: 'bg-blue-50',    text: 'text-blue-500',  textActive: 'text-blue-800',  dot: 'bg-blue-500',  border: 'ring-blue-500',
            darkBg: 'hover:bg-white/[0.03]', darkBgActive: 'bg-blue-500/10',  darkText: 'text-blue-400',  darkTextActive: 'text-blue-300' },
  amber:  { bg: 'hover:bg-amber-50',  bgActive: 'bg-amber-50',   text: 'text-amber-500', textActive: 'text-amber-800', dot: 'bg-amber-500', border: 'ring-amber-500',
            darkBg: 'hover:bg-white/[0.03]', darkBgActive: 'bg-amber-500/10', darkText: 'text-amber-400', darkTextActive: 'text-amber-300' },
  green:  { bg: 'hover:bg-green-50',  bgActive: 'bg-green-50',   text: 'text-green-500', textActive: 'text-green-800', dot: 'bg-green-500', border: 'ring-green-500',
            darkBg: 'hover:bg-white/[0.03]', darkBgActive: 'bg-green-500/10', darkText: 'text-green-400', darkTextActive: 'text-green-300' },
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, isDark }: { status: StatusSolicitacaoNF; isDark: boolean }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
      isDark ? `${cfg.darkBg} ${cfg.darkText} ${cfg.darkBorder}` : `${cfg.bg} ${cfg.text} ${cfg.border}`
    }`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

// ── OrigemBadge ──────────────────────────────────────────────────────────────

function OrigemBadge({ origem, isDark }: { origem?: string; isDark: boolean }) {
  if (!origem) return null
  const cfg = ORIGEM_CONFIG[origem]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
      isDark ? cfg.darkColor : cfg.color
    }`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

// ── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(items: SolicitacaoNF[], stageName: string) {
  const headers = ['Fornecedor', 'CNPJ', 'Valor', 'NF', 'Serie', 'Data Emissao', 'Origem', 'Status', 'Tipo Emissao', 'Solicitado Em']
  const rows = items.map(s => [
    s.fornecedor_nome,
    s.fornecedor_cnpj || '',
    s.valor_total?.toFixed(2).replace('.', ',') || '',
    s.numero_nf || '',
    s.serie || '',
    s.data_emissao || '',
    s.origem || '',
    s.status,
    s.emissao_tipo || '',
    s.solicitado_em,
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nf-pipeline-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── FormSection ─────────────────────────────────────────────────────────────

function FormSection({ title, icon: Icon, isDark, defaultOpen = false, badge, children }: {
  title: string; icon: typeof Info; isDark: boolean; defaultOpen?: boolean; badge?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-xl border transition-all ${
      isDark
        ? `border-slate-700/60 ${open ? 'bg-slate-800/40' : 'bg-transparent'}`
        : `border-slate-200 ${open ? 'bg-slate-50/50' : 'bg-transparent'}`
    }`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
          isDark ? 'text-slate-300 hover:bg-slate-700/30' : 'text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Icon size={12} className={isDark ? 'text-amber-400/60' : 'text-amber-500/60'} />
        {title}
        {badge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
            isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
          }`}>{badge}</span>
        )}
        <ChevronDown size={11} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

// ── SistemaEmissaoModal ─────────────────────────────────────────────────────

interface NFItem { descricao: string; quantidade: number; unidade: string; valor_unitario?: number }

function SistemaEmissaoModal({ sol, isDark, onSubmit, onClose, isPending }: {
  sol: SolicitacaoNF; isDark: boolean
  onSubmit: (payload: EmitirNFPayload) => void
  onClose: () => void; isPending: boolean
}) {
  // State
  const [emitenteCnpj, setEmitenteCnpj] = useState(sol.emitente_cnpj || '')
  const [emitenteNome, setEmitenteNome] = useState(sol.emitente_nome || '')
  const [destCnpj, setDestCnpj] = useState(sol.destinatario_cnpj || sol.fornecedor_cnpj || '')
  const [destNome, setDestNome] = useState(sol.destinatario_nome || sol.fornecedor_nome || '')
  const [destUf, setDestUf] = useState(sol.destinatario_uf || '')
  const [items, setItems] = useState<NFItem[]>(sol.items?.length ? sol.items : [{ descricao: '', quantidade: 1, unidade: 'UN' }])
  const [frete, setFrete] = useState(sol.valor_frete?.toString() || '')
  const [seguro, setSeguro] = useState(sol.valor_seguro?.toString() || '')
  const [desconto, setDesconto] = useState(sol.valor_desconto_nf?.toString() || '')
  const [icmsBase, setIcmsBase] = useState(sol.icms_base?.toString() || '')
  const [icmsValor, setIcmsValor] = useState(sol.icms_valor?.toString() || '')
  const [numero, setNumero] = useState(sol.numero_nf || '')
  const [serie, setSerie] = useState(sol.serie || '')
  const [dataEmissao, setDataEmissao] = useState(sol.data_emissao || new Date().toISOString().split('T')[0])
  const [cfop, setCfop] = useState(sol.cfop || '')
  const [natOp, setNatOp] = useState(sol.natureza_operacao || '')
  const [chave, setChave] = useState(sol.chave_acesso || '')
  const [infoComplementar, setInfoComplementar] = useState(sol.info_complementar || '')
  const [danfeUrl, setDanfeUrl] = useState(sol.danfe_url || '')
  const [formError, setFormError] = useState('')

  const obraUf = sol.obra?.uf
  const itemSubtotals = items.map(it => (it.valor_unitario ?? 0) * it.quantidade)
  const valorItens = itemSubtotals.reduce((s, v) => s + v, 0)
  const valorTotalNF = valorItens + parseNum(frete) + parseNum(seguro) - parseNum(desconto)

  const addItem = () => setItems(p => [...p, { descricao: '', quantidade: 1, unidade: 'UN' }])
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof NFItem, val: string | number) => {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  }

  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 ${
    isDark
      ? 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-600'
      : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
  }`
  const labelCls = `text-[11px] font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  const handleSubmit = () => {
    if (!numero.trim()) { setFormError('Numero NF obrigatorio'); return }
    if (!dataEmissao) { setFormError('Data emissao obrigatoria'); return }
    setFormError('')
    onSubmit({
      numero_nf: numero.trim(),
      serie: serie.trim() || undefined,
      chave_acesso: chave.trim() || undefined,
      data_emissao: dataEmissao,
      danfe_url: danfeUrl.trim() || undefined,
      cfop: cfop.trim() || undefined,
      natureza_operacao: natOp.trim() || undefined,
      emitente_cnpj: emitenteCnpj.trim() || undefined,
      emitente_nome: emitenteNome.trim() || undefined,
      destinatario_cnpj: destCnpj.trim() || undefined,
      destinatario_nome: destNome.trim() || undefined,
      destinatario_uf: destUf || undefined,
      items: items.filter(it => it.descricao.trim()),
      valor_total: valorTotalNF || sol.valor_total || undefined,
      valor_frete: parseNum(frete) || undefined,
      valor_seguro: parseNum(seguro) || undefined,
      valor_desconto_nf: parseNum(desconto) || undefined,
      icms_base: parseNum(icmsBase) || undefined,
      icms_valor: parseNum(icmsValor) || undefined,
      info_complementar: infoComplementar.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${
          isDark ? 'border-slate-700 bg-[#1e293b]' : 'border-slate-100 bg-white'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 size={16} className="text-amber-500 shrink-0" />
            <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Emissao via Sistema
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}>{sol.fornecedor_nome}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {/* Section 1: Partes */}
          <FormSection title="Emitente / Destinatario" icon={Users} isDark={isDark} defaultOpen>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className={labelCls}>Emitente CNPJ</label>
                <input type="text" value={emitenteCnpj} onChange={e => setEmitenteCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Emitente Nome</label>
                <input type="text" value={emitenteNome} onChange={e => setEmitenteNome(e.target.value)}
                  placeholder="Razao Social" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Destinatario CNPJ</label>
                <input type="text" value={destCnpj} onChange={e => setDestCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Destinatario Nome</label>
                <input type="text" value={destNome} onChange={e => setDestNome(e.target.value)}
                  placeholder="Razao Social" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Destinatario UF</label>
                <select value={destUf} onChange={e => setDestUf(e.target.value)} className={inputCls}>
                  <option value="">Selecione</option>
                  {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          </FormSection>

          {/* Section 2: Itens */}
          <FormSection title="Itens da NF" icon={Package} isDark={isDark} defaultOpen={false}
            badge={items.filter(it => it.descricao.trim()).length > 0 ? `${items.filter(it => it.descricao.trim()).length} itens` : undefined}>
            <div className="space-y-2 mt-2">
              {items.map((it, i) => (
                <div key={i} className={`flex items-end gap-2 rounded-xl p-2 border ${
                  isDark ? 'border-slate-700/40 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'
                }`}>
                  <div className="flex-1">
                    <label className={labelCls}>Descricao</label>
                    <input type="text" value={it.descricao}
                      onChange={e => updateItem(i, 'descricao', e.target.value)}
                      placeholder="Item" className={inputCls} />
                  </div>
                  <div className="w-16">
                    <label className={labelCls}>Qtd</label>
                    <input type="number" value={it.quantidade} min={0.01} step={0.01}
                      onChange={e => updateItem(i, 'quantidade', parseFloat(e.target.value) || 0)}
                      className={inputCls} />
                  </div>
                  <div className="w-16">
                    <label className={labelCls}>UN</label>
                    <input type="text" value={it.unidade}
                      onChange={e => updateItem(i, 'unidade', e.target.value)}
                      className={inputCls} />
                  </div>
                  <div className="w-24">
                    <label className={labelCls}>Vlr Unit</label>
                    <input type="number" value={it.valor_unitario ?? ''} min={0} step={0.01}
                      onChange={e => updateItem(i, 'valor_unitario', parseFloat(e.target.value) || 0)}
                      className={inputCls} />
                  </div>
                  <div className="w-20 text-right">
                    <p className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      {fmt(itemSubtotals[i])}
                    </p>
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)}
                      className="p-1 text-red-400 hover:text-red-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addItem}
                className={`flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  isDark ? 'text-amber-400 hover:bg-amber-500/10' : 'text-amber-600 hover:bg-amber-50'
                }`}>
                <Plus size={11} /> Adicionar Item
              </button>
            </div>
          </FormSection>

          {/* Section 3: Valores */}
          <FormSection title="Valores" icon={DollarSign} isDark={isDark} defaultOpen={false}>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label className={labelCls}>Frete</label>
                <input type="text" value={frete} onChange={e => setFrete(e.target.value)}
                  placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Seguro</label>
                <input type="text" value={seguro} onChange={e => setSeguro(e.target.value)}
                  placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Desconto</label>
                <input type="text" value={desconto} onChange={e => setDesconto(e.target.value)}
                  placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ICMS Base</label>
                <input type="text" value={icmsBase} onChange={e => setIcmsBase(e.target.value)}
                  placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ICMS Valor</label>
                <input type="text" value={icmsValor} onChange={e => setIcmsValor(e.target.value)}
                  placeholder="0,00" className={inputCls} />
              </div>
            </div>
            <div className={`flex items-center justify-between mt-3 p-2 rounded-xl ${
              isDark ? 'bg-amber-500/5' : 'bg-amber-50/60'
            }`}>
              <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Valor Total NF:
              </span>
              <span className={`text-base font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                {fmt(valorTotalNF)}
              </span>
            </div>
          </FormSection>

          {/* Section 4: Dados NF */}
          <FormSection title="Dados da NF" icon={FileCheck} isDark={isDark} defaultOpen>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              <div>
                <label className={labelCls}>Numero NF *</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value)}
                  placeholder="000123" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Serie</label>
                <input type="text" value={serie} onChange={e => setSerie(e.target.value)}
                  placeholder="1" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data Emissao *</label>
                <input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>CFOP</label>
                <input type="text" value={cfop} onChange={e => setCfop(e.target.value)}
                  placeholder="5.949" className={inputCls} />
                {obraUf && destUf && obraUf !== destUf && (
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
                    UFs diferentes - sugestao 6.xxx
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Natureza da Operacao</label>
                <input type="text" value={natOp} onChange={e => setNatOp(e.target.value)}
                  placeholder="Prestacao de Servico" className={inputCls} />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className={labelCls}>Chave de Acesso (44 digitos)</label>
                <input type="text" value={chave} onChange={e => setChave(e.target.value)}
                  placeholder="44 digitos (opcional)" maxLength={50}
                  className={`${inputCls} font-mono text-xs tracking-wider`} />
                {chave.trim() && (
                  <p className={`text-[10px] mt-0.5 font-mono ${
                    chave.replace(/\D/g, '').length === 44
                      ? isDark ? 'text-green-400/70' : 'text-green-600/70'
                      : isDark ? 'text-amber-400/70' : 'text-amber-600/70'
                  }`}>
                    {chave.replace(/\D/g, '').length}/44 digitos
                  </p>
                )}
              </div>
            </div>
          </FormSection>

          {/* Section 5: Info Complementar */}
          <FormSection title="Info Complementares" icon={Info} isDark={isDark} defaultOpen={false}
            badge={infoComplementar.trim() ? 'preenchido' : undefined}>
            <textarea value={infoComplementar} onChange={e => setInfoComplementar(e.target.value)}
              rows={3} placeholder="Informacoes complementares da NF-e..."
              className={`${inputCls} resize-none mt-2`} />
          </FormSection>

          {/* Section 6: Anexos */}
          <FormSection title="Anexos / DANFE" icon={Paperclip} isDark={isDark} defaultOpen={false}
            badge={danfeUrl.trim() ? '1 anexo' : undefined}>
            <div className="mt-2">
              <label className={labelCls}>URL do DANFE (PDF)</label>
              <input type="url" value={danfeUrl} onChange={e => setDanfeUrl(e.target.value)}
                placeholder="https://... (URL do arquivo DANFE)" className={inputCls} />
            </div>
          </FormSection>

          {formError && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
              isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertTriangle size={12} className="shrink-0" />
              {formError}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white
                text-xs font-bold hover:bg-amber-700 transition-all disabled:opacity-50
                shadow-sm shadow-amber-600/20">
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar para Aprovacao
            </button>
            <button onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                isDark
                  ? 'border-slate-700 text-slate-400 hover:bg-slate-700/50'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AnexarNFExternaModal ────────────────────────────────────────────────────

function AnexarNFExternaModal({ sol, isDark, onSubmit, onClose, isPending }: {
  sol: SolicitacaoNF; isDark: boolean
  onSubmit: (file: File) => void
  onClose: () => void; isPending: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white'

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.xml'))) setFile(f)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-green-500/10' : 'bg-green-50'
            }`}>
              <Paperclip size={16} className="text-green-500" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                Anexar NF Emitida
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {sol.fornecedor_nome}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        <div className="p-5">
          <input type="file" accept=".pdf,.xml" className="hidden"
            ref={fileRef}
            onChange={handleFileChange} />

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? isDark ? 'border-green-400 bg-green-500/10' : 'border-green-400 bg-green-50'
                : file
                  ? isDark ? 'border-green-500/40 bg-green-500/5' : 'border-green-300 bg-green-50/50'
                  : isDark ? 'border-slate-600 hover:border-slate-500 bg-slate-800/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            {file ? (
              <div className="space-y-2">
                <FileCheck size={32} className="mx-auto text-green-500" />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  {file.name}
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {(file.size / 1024).toFixed(0)} KB — Clique para trocar
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Paperclip size={32} className={`mx-auto ${isDark ? 'text-slate-500' : 'text-slate-300'}`} />
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Arraste o arquivo da NF aqui
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  PDF ou XML — os dados serao lidos automaticamente
                </p>
              </div>
            )}
          </div>

          {isPending && (
            <div className={`flex items-center gap-2 mt-3 rounded-xl px-3 py-2 text-xs ${
              isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}>
              <Loader2 size={12} className="animate-spin shrink-0" />
              Enviando e processando NF...
            </div>
          )}
        </div>

        <div className={`flex gap-2 px-5 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <button onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            Cancelar
          </button>
          <button onClick={() => file && onSubmit(file)} disabled={!file || isPending}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold
              hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2
              shadow-sm shadow-green-600/20">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            Enviar NF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RejectModal ─────────────────────────────────────────────────────────────

function RejectModal({ sol, isDark, onConfirm, onClose, isPending }: {
  sol: SolicitacaoNF; isDark: boolean
  onConfirm: (motivo: string) => void
  onClose: () => void; isPending: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white'

  const handleConfirm = () => {
    if (!motivo.trim()) { setError('Informe o motivo da rejeicao'); return }
    setError('')
    onConfirm(motivo.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-red-500/10' : 'bg-red-50'
            }`}><XCircle size={16} className="text-red-500" /></div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Rejeitar Solicitacao</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.fornecedor_nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={`text-[11px] font-semibold mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Motivo da rejeicao *
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da rejeicao..." rows={3} autoFocus
              className={`w-full rounded-xl border px-3 py-2.5 text-sm resize-none transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 ${
                isDark
                  ? 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-600'
                  : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
              }`} />
          </div>
          {error && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${
              isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
            }`}><AlertTriangle size={12} className="shrink-0" />{error}</div>
          )}
        </div>
        <div className={`flex gap-2 px-5 py-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <button onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>Cancelar</button>
          <button onClick={handleConfirm} disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold
              hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2
              shadow-sm shadow-red-600/20">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsDown size={14} />}
            Rejeitar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NFDetailModal ───────────────────────────────────────────────────────────

function NFDetailModal({ sol, isDark, isGestor, onClose, onAction }: {
  sol: SolicitacaoNF; isDark: boolean; isGestor: boolean
  onClose: () => void
  onAction: (action: string, sol: SolicitacaoNF) => void
}) {
  const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const statusCfg = STATUS_CONFIG[sol.status]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${
          isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={18} className="text-amber-500 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.fornecedor_nome}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + Valor */}
          <div className="flex items-center justify-between">
            <p className={`text-2xl font-extrabold text-amber-600`}>
              {sol.valor_total != null ? fmt(sol.valor_total) : '—'}
            </p>
            <StatusBadge status={sol.status} isDark={isDark} />
          </div>

          {/* Details grid */}
          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {sol.fornecedor_cnpj && <div><span className="text-slate-400">CNPJ:</span> <span className="font-mono">{fmtCnpj(sol.fornecedor_cnpj)}</span></div>}
              {sol.origem && <div><span className="text-slate-400">Origem:</span> <OrigemBadge origem={sol.origem} isDark={isDark} /></div>}
              <div><span className="text-slate-400">Solicitado:</span> <span className="font-semibold">{fmtDateFull(sol.solicitado_em)}</span></div>
              {sol.emitido_em && <div><span className="text-slate-400">Emitido:</span> <span className="font-semibold">{fmtDateFull(sol.emitido_em)}</span></div>}
              {sol.numero_nf && <div><span className="text-slate-400">NF:</span> <span className="font-bold">{sol.numero_nf}{sol.serie ? ` / ${sol.serie}` : ''}</span></div>}
              {sol.data_emissao && <div><span className="text-slate-400">Data NF:</span> <span className="font-semibold">{fmtDate(sol.data_emissao)}</span></div>}
              {sol.cfop && <div><span className="text-slate-400">CFOP:</span> <span>{sol.cfop}</span></div>}
              {sol.natureza_operacao && <div><span className="text-slate-400">Natureza:</span> <span>{sol.natureza_operacao}</span></div>}
              {sol.emissao_tipo && <div><span className="text-slate-400">Tipo Emissao:</span> <span className={`font-semibold ${sol.emissao_tipo === 'externa' ? 'text-green-600' : 'text-blue-600'}`}>{sol.emissao_tipo === 'externa' ? 'NF Emitida' : 'Via Sistema'}</span></div>}
              {sol.obra && <div className="col-span-2"><span className="text-slate-400">Obra:</span> <span className="font-semibold">{sol.obra.nome}</span></div>}
            </div>
            {sol.chave_acesso && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px]">Chave de Acesso:</span>
                <p className="font-mono text-[10px] break-all mt-0.5">{sol.chave_acesso}</p>
              </div>
            )}
            {sol.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">{sol.descricao}</p>}
          </div>

          {/* Rejection reason */}
          {sol.status === 'rejeitada' && sol.motivo_rejeicao && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${
              isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
            }`}>
              <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
              <p className={`text-xs leading-relaxed ${isDark ? 'text-red-400' : 'text-red-700'}`}>{sol.motivo_rejeicao}</p>
            </div>
          )}

          {/* DANFE link */}
          {sol.danfe_url && (
            <a href={sol.danfe_url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                isDark
                  ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              }`}>
              <FileText size={14} /> Ver DANFE
            </a>
          )}

          {/* Pipeline progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {FISCAL_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = FISCAL_PIPELINE_STAGES.findIndex(st => st.status === sol.status)
                const isPast = i <= currentIdx
                const color = TAB_ACCENT[s.color]?.dot || 'bg-slate-400'
                return (
                  <div key={s.status} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-all ${isPast ? color : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
              isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>Fechar</button>

            {sol.status === 'pendente' && (
              <>
                <button onClick={() => onAction('emitirSistema', sol)}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                  <Edit3 size={15} /> Via Sistema
                </button>
                <button onClick={() => onAction('anexarExterna', sol)}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                  <Paperclip size={15} /> NF Emitida
                </button>
              </>
            )}

            {sol.status === 'em_emissao' && (
              <>
                <button onClick={() => onAction('emitirSistema', sol)}
                  className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                  <Edit3 size={15} /> Continuar
                </button>
                <button onClick={() => onAction('anexarExterna', sol)}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                  <Paperclip size={15} /> NF Emitida
                </button>
              </>
            )}

            {sol.status === 'aguardando_aprovacao' && isGestor && (
              <>
                <button onClick={() => onAction('aprovar', sol)}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <ThumbsUp size={15} /> Aprovar
                </button>
                <button onClick={() => onAction('rejeitar', sol)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isDark
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                      : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  }`}>
                  <ThumbsDown size={15} /> Rejeitar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NFRow (compact) ─────────────────────────────────────────────────────────

function NFRow({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: SolicitacaoNF; onClick: () => void; isDark: boolean
  isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
        isDark
          ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-amber-500/10' : ''}`
          : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-amber-50' : ''}`
      }`}>
      <input type="checkbox" checked={isSelected}
        onChange={e => { e.stopPropagation(); onSelect(sol.id) }}
        onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0" />

      <span className={`text-[11px] w-[60px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {fmtRelative(sol.solicitado_em)}
      </span>

      <span className={`text-xs font-semibold truncate w-[200px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {sol.fornecedor_nome}
      </span>

      <span className={`text-xs font-bold text-right w-[90px] shrink-0 text-amber-600`}>
        {sol.valor_total != null ? fmt(sol.valor_total) : '—'}
      </span>

      <span className="w-[60px] shrink-0">
        <OrigemBadge origem={sol.origem} isDark={isDark} />
      </span>

      <span className={`text-[11px] truncate w-[70px] shrink-0 font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.numero_nf || '—'}
      </span>

      {sol.emissao_tipo && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
          sol.emissao_tipo === 'externa'
            ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
            : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
        }`}>{sol.emissao_tipo === 'externa' ? 'EXT' : 'SIS'}</span>
      )}
    </div>
  )
}

// ── NFCard (full-width) ─────────────────────────────────────────────────────

function NFCard({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: SolicitacaoNF; onClick: () => void; isDark: boolean
  isSelected: boolean; onSelect: (id: string) => void
}) {
  const itemCount = sol.items?.length ?? 0

  return (
    <div onClick={onClick}
      className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
        isDark
          ? `border-white/[0.06] hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 ${isSelected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/[0.02]'}`
          : `border-slate-200 hover:border-amber-300 hover:shadow-md ${isSelected ? 'bg-amber-50 border-amber-300' : 'bg-white'}`
      }`}>
      {/* Linha 1: checkbox + fornecedor + badges + valor */}
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={isSelected}
          onChange={e => { e.stopPropagation(); onSelect(sol.id) }}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0" />
        <p className={`text-sm font-bold truncate flex-1 min-w-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {sol.fornecedor_nome}
        </p>
        {sol.fornecedor_cnpj && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border shrink-0 ${
            isDark ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>{fmtCnpj(sol.fornecedor_cnpj)}</span>
        )}
        <p className={`text-sm font-extrabold shrink-0 text-amber-600`}>
          {sol.valor_total != null ? fmt(sol.valor_total) : '—'}
        </p>
      </div>

      {/* Linha 2: badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-7">
        <OrigemBadge origem={sol.origem} isDark={isDark} />
        {sol.emissao_tipo && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
            sol.emissao_tipo === 'externa'
              ? isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200'
              : isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>{sol.emissao_tipo === 'externa' ? 'NF Emitida' : 'Via Sistema'}</span>
        )}
        {itemCount > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
            isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'
          }`}>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
        )}
        {sol.numero_nf && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
            isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'
          }`}>NF {sol.numero_nf}{sol.serie ? ` / ${sol.serie}` : ''}</span>
        )}
        {sol.obra && (
          <span className={`flex items-center gap-1 text-[10px] ${isDark ? 'text-teal-400/70' : 'text-teal-600/70'}`}>
            <MapPin size={9} /> {sol.obra.nome}
          </span>
        )}
      </div>

      {/* Linha 3: descricao */}
      {sol.descricao && (
        <p className={`text-xs truncate mt-1.5 ml-7 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.descricao}</p>
      )}

      {/* Rejection reason */}
      {sol.status === 'rejeitada' && sol.motivo_rejeicao && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border mt-2 ml-7 ${
          isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <AlertTriangle size={11} className="text-red-500 mt-0.5 shrink-0" />
          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-red-400' : 'text-red-700'}`}>{sol.motivo_rejeicao}</p>
        </div>
      )}

      {/* Linha 4: date + danfe */}
      <div className="flex items-center justify-between mt-2 ml-7">
        <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtRelative(sol.solicitado_em)}
          {sol.emitido_em && <span className="ml-2">&bull; Emitido {fmtDateFull(sol.emitido_em)}</span>}
        </span>
        {sol.danfe_url && (
          <a href={sol.danfe_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              isDark ? 'text-green-400 hover:text-green-300' : 'text-green-600 hover:text-green-700'
            }`}>
            <FileText size={10} /> DANFE
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function FiscalPipeline() {
  const { isDark } = useTheme()
  const { role } = useAuth()
  const isGestor = role === 'admin' || role === 'gerente'

  // State
  const [activeTab, setActiveTab] = useState<StatusFiscalPipeline>('pendente')
  const [showRejected, setShowRejected] = useState(false)
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailSol, setDetailSol] = useState<SolicitacaoNF | null>(null)
  const [emissaoTarget, setEmissaoTarget] = useState<SolicitacaoNF | null>(null)
  const [externaTarget, setExternaTarget] = useState<SolicitacaoNF | null>(null)
  const [rejectTarget, setRejectTarget] = useState<SolicitacaoNF | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Detect ?nova=1 from sidebar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('nova') === '1') {
      setShowCreate(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Data — no month filter for pipeline (show all)
  const filters: SolicitacaoNFFilters = useMemo(() => ({
    busca: busca.trim() || undefined,
  }), [busca])

  const { data: allSolicitacoes = [], isLoading } = useSolicitacoesNF(filters)

  // Group by status
  const grouped = useMemo(() => {
    const map = new Map<string, SolicitacaoNF[]>()
    for (const s of FISCAL_PIPELINE_STAGES) map.set(s.status, [])
    map.set('rejeitada', [])
    for (const sol of allSolicitacoes) {
      // 'aprovada' → show in 'emitida' tab
      const key = sol.status === 'aprovada' ? 'emitida' : sol.status
      const arr = map.get(key)
      if (arr) arr.push(sol)
    }
    return map
  }, [allSolicitacoes])

  // Active items = tab items, sorted
  const activeItems = useMemo(() => {
    const tabKey = showRejected ? 'rejeitada' : activeTab
    let items = [...(grouped.get(tabKey) || [])]

    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'data':       cmp = a.solicitado_em.localeCompare(b.solicitado_em); break
        case 'valor':      cmp = (a.valor_total ?? 0) - (b.valor_total ?? 0); break
        case 'fornecedor': cmp = a.fornecedor_nome.localeCompare(b.fornecedor_nome); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [grouped, activeTab, showRejected, sortField, sortDir])

  const tabTotal = useMemo(() => activeItems.reduce((s, sol) => s + (sol.valor_total ?? 0), 0), [activeItems])
  const rejectedCount = grouped.get('rejeitada')?.length || 0

  // Mutations
  const iniciarEmissao = useIniciarEmissao()
  const emitirNF = useEmitirNF()
  const anexarExterna = useAnexarNFExterna()
  const aprovarSol = useAprovarSolicitacao()
  const rejeitarSol = useRejeitarSolicitacao()
  const criarSolicitacao = useCriarSolicitacao()

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Tab switch
  const switchTab = (status: StatusFiscalPipeline) => {
    setActiveTab(status)
    setShowRejected(false)
    setSelectedIds(new Set())
  }

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAll = () => {
    const allIds = activeItems.map(s => s.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }

  // Sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // Actions
  const handleDetailAction = (action: string, sol: SolicitacaoNF) => {
    setDetailSol(null)
    switch (action) {
      case 'emitirSistema':
        // First move to em_emissao if pendente
        if (sol.status === 'pendente') {
          iniciarEmissao.mutate(sol.id, {
            onSuccess: (updated) => setEmissaoTarget(updated),
            onError: () => showToast('error', 'Erro ao iniciar emissao'),
          })
        } else {
          setEmissaoTarget(sol)
        }
        break
      case 'anexarExterna':
        if (sol.status === 'pendente') {
          // For externa, we skip em_emissao
          setExternaTarget(sol)
        } else {
          setExternaTarget(sol)
        }
        break
      case 'aprovar':
        aprovarSol.mutate(sol.id, {
          onSuccess: () => showToast('success', 'Solicitacao aprovada e emitida'),
          onError: () => showToast('error', 'Erro ao aprovar'),
        })
        break
      case 'rejeitar':
        setRejectTarget(sol)
        break
    }
  }

  const handleEmitirSubmit = (payload: EmitirNFPayload) => {
    if (!emissaoTarget) return
    emitirNF.mutate({ id: emissaoTarget.id, payload }, {
      onSuccess: () => {
        showToast('success', 'NF enviada para aprovacao')
        setEmissaoTarget(null)
      },
      onError: () => showToast('error', 'Erro ao enviar NF'),
    })
  }

  const handleAnexarSubmit = (file: File) => {
    if (!externaTarget) return
    anexarExterna.mutate({ id: externaTarget.id, file }, {
      onSuccess: () => {
        showToast('success', 'NF emitida anexada com sucesso')
        setExternaTarget(null)
      },
      onError: () => showToast('error', 'Erro ao anexar NF emitida'),
    })
  }

  const handleRejectConfirm = (motivo: string) => {
    if (!rejectTarget) return
    rejeitarSol.mutate({ id: rejectTarget.id, motivo }, {
      onSuccess: () => {
        showToast('success', 'Solicitacao rejeitada')
        setRejectTarget(null)
      },
      onError: () => showToast('error', 'Erro ao rejeitar'),
    })
  }

  // Bulk actions
  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (activeTab === 'pendente') {
      // Bulk iniciar emissao
      ids.forEach(id => iniciarEmissao.mutate(id))
      showToast('success', `${ids.length} solicitacao(oes) em emissao`)
      setSelectedIds(new Set())
    }
    if (activeTab === 'aguardando_aprovacao' && isGestor) {
      ids.forEach(id => aprovarSol.mutate(id))
      showToast('success', `${ids.length} solicitacao(oes) aprovada(s)`)
      setSelectedIds(new Set())
    }
  }

  // Export
  const handleExport = () => {
    const stage = showRejected ? 'rejeitadas' : (FISCAL_PIPELINE_STAGES.find(s => s.status === activeTab)?.label || activeTab)
    const toExport = selectedIds.size > 0 ? activeItems.filter(s => selectedIds.has(s.id)) : activeItems
    exportCSV(toExport, stage)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  // Bulk config
  const BULK_ACTIONS: Partial<Record<StatusFiscalPipeline, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    pendente:              { label: 'Iniciar Emissao', icon: ArrowRight,   className: 'bg-amber-600 hover:bg-amber-700 text-white' },
    aguardando_aprovacao:  { label: 'Aprovar',         icon: ThumbsUp,     className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  }
  const bulk = showRejected ? undefined : BULK_ACTIONS[activeTab]
  const selectedInTab = activeItems.filter(s => selectedIds.has(s.id))

  return (
    <div className="space-y-4">
      {/* Keyframes */}
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <FileOutput size={20} className="text-amber-500" />
            Pipeline NF
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {allSolicitacoes.length} solicitacoes &middot; Emissao via sistema ou NF emitida
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm">
          <Plus size={14} /> Nova Solicitação
        </button>
      </div>

      {/* ── Horizontal Tabs ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5">
        {FISCAL_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status && !showRejected
          const accent = isDark ? TAB_ACCENT[stage.color] : TAB_ACCENT[stage.color]

          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? `${isDark ? accent?.darkBgActive : accent?.bgActive} ${isDark ? accent?.darkTextActive : accent?.textActive} font-bold shadow-sm ${!isDark ? `ring-1 ${accent?.border}` : ''}`
                  : `${isDark ? accent?.darkBg : accent?.bg} ${isDark ? accent?.darkText : accent?.text} font-medium`
              }`}>
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                  isActive
                    ? isDark ? 'bg-white/10 text-white' : `${accent?.dot} text-white`
                    : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}

        {/* Rejeitadas toggle */}
        {rejectedCount > 0 && (
          <button onClick={() => { setShowRejected(!showRejected); setSelectedIds(new Set()) }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
              showRejected
                ? isDark ? 'bg-red-500/10 text-red-400 font-bold' : 'bg-red-50 text-red-700 font-bold ring-1 ring-red-300'
                : isDark ? 'text-red-400/60 hover:bg-white/[0.03]' : 'text-red-400 hover:bg-red-50'
            }`}>
            <XCircle size={12} />
            Rejeitadas
            <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
              showRejected
                ? 'bg-red-500 text-white'
                : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
            }`}>{rejectedCount}</span>
          </button>
        )}
      </div>

      {/* ── Content Panel ──────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* Toolbar */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar fornecedor, NF, descricao..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`} />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => {
              const isActive = sortField === opt.field
              return (
                <button key={opt.field} onClick={() => toggleSort(opt.field)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isActive
                      ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                      : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}>
                  {opt.label}
                  {isActive && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              )
            })}
          </div>

          {/* View toggle */}
          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 transition-all ${
                viewMode === 'list'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`} title="Lista"><LayoutList size={14} /></button>
            <button onClick={() => setViewMode('cards')}
              className={`p-1.5 transition-all ${
                viewMode === 'cards'
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700'
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`} title="Cards"><LayoutGrid size={14} /></button>
          </div>

          {/* Export */}
          <button onClick={handleExport} disabled={activeItems.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`} title="Exportar CSV"><Download size={13} /> CSV</button>

          {/* Stats */}
          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{activeItems.length} {activeItems.length === 1 ? 'solicitacao' : 'solicitacoes'}</span>
            <span className="font-bold text-amber-600">{fmt(tabTotal)}</span>
          </div>
        </div>

        {/* Select all + bulk bar */}
        {activeItems.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={activeItems.length > 0 && activeItems.every(s => selectedIds.has(s.id))}
                onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todos</span>
            </label>
            {selectedInTab.length > 0 && (
              <>
                <button onClick={handleBulkAction}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}>
                  <bulk.icon size={12} />
                  {bulk.label} ({selectedInTab.length})
                </button>
                <span className={`text-[10px] ml-auto ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fmt(selectedInTab.reduce((s, sol) => s + (sol.valor_total ?? 0), 0))} selecionado
                </span>
              </>
            )}
          </div>
        )}

        {/* List / Cards */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <FileText size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhuma solicitacao nesta etapa
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {busca ? 'Tente outra busca' : 'As solicitacoes aparecerão aqui'}
              </p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              {/* Table header */}
              <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${
                isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'
              }`}>
                <span className="w-3 shrink-0" />
                <span className="w-[60px] shrink-0">Data</span>
                <span className="w-[200px] shrink-0">Fornecedor</span>
                <span className="w-[90px] shrink-0 text-right">Valor</span>
                <span className="w-[60px] shrink-0">Origem</span>
                <span className="w-[70px] shrink-0">NF</span>
                <span className="w-[40px] shrink-0">Tipo</span>
              </div>
              {activeItems.map(sol => (
                <NFRow key={sol.id} sol={sol}
                  onClick={() => setDetailSol(sol)}
                  isDark={isDark}
                  isSelected={selectedIds.has(sol.id)}
                  onSelect={toggleSelect} />
              ))}
            </>
          ) : (
            <div className="p-3 space-y-2">
              {activeItems.map(sol => (
                <NFCard key={sol.id} sol={sol}
                  onClick={() => setDetailSol(sol)}
                  isDark={isDark}
                  isSelected={selectedIds.has(sol.id)}
                  onSelect={toggleSelect} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {detailSol && (
        <NFDetailModal sol={detailSol} isDark={isDark} isGestor={isGestor}
          onClose={() => setDetailSol(null)} onAction={handleDetailAction} />
      )}

      {emissaoTarget && (
        <SistemaEmissaoModal sol={emissaoTarget} isDark={isDark}
          onSubmit={handleEmitirSubmit} onClose={() => setEmissaoTarget(null)}
          isPending={emitirNF.isPending} />
      )}

      {externaTarget && (
        <AnexarNFExternaModal sol={externaTarget} isDark={isDark}
          onSubmit={handleAnexarSubmit} onClose={() => setExternaTarget(null)}
          isPending={anexarExterna.isPending} />
      )}

      {rejectTarget && (
        <RejectModal sol={rejectTarget} isDark={isDark}
          onConfirm={handleRejectConfirm} onClose={() => setRejectTarget(null)}
          isPending={rejeitarSol.isPending} />
      )}

      {showCreate && (
        <NovaSolicitacaoNFModal isDark={isDark}
          onClose={() => setShowCreate(false)}
          onSubmit={(payload) => {
            criarSolicitacao.mutate(payload, {
              onSuccess: () => { showToast('success', 'Solicitação criada'); setShowCreate(false) },
              onError: () => showToast('error', 'Erro ao criar solicitação'),
            })
          }}
          isPending={criarSolicitacao.isPending} />
      )}
    </div>
  )
}

// ── NovaSolicitacaoNFModal ────────────────────────────────────────────────────

function NovaSolicitacaoNFModal({ isDark, onClose, onSubmit, isPending }: {
  isDark: boolean; onClose: () => void;
  onSubmit: (p: CriarSolicitacaoPayload) => void; isPending: boolean
}) {
  const [form, setForm] = useState({
    fornecedor_cnpj: '', fornecedor_nome: '', valor_total: '',
    cfop: '', natureza_operacao: '', descricao: '', observacoes: '',
    origem: 'manual' as 'logistica' | 'compras' | 'manual',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.fornecedor_nome.trim() && form.valor_total

  const submit = () => {
    if (!canSubmit) return
    onSubmit({
      fornecedor_cnpj: form.fornecedor_cnpj,
      fornecedor_nome: form.fornecedor_nome,
      valor_total: parseFloat(form.valor_total) || 0,
      cfop: form.cfop || undefined,
      natureza_operacao: form.natureza_operacao || undefined,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      origem: form.origem,
    })
  }

  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const label = `text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const input = `w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors
    ${isDark ? 'bg-slate-800 border-white/[0.08] text-white placeholder:text-slate-600 focus:border-amber-500/50' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-amber-400'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl ${card} max-h-[85vh] overflow-y-auto`}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Plus size={16} className="text-amber-500" /> Nova Solicitação NF
          </h2>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Origem */}
          <div>
            <p className={label}>Origem</p>
            <div className="flex gap-2">
              {(['manual', 'compras', 'logistica'] as const).map(o => (
                <button key={o} onClick={() => set('origem', o)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    form.origem === o
                      ? 'bg-amber-600 text-white'
                      : isDark ? 'bg-white/[0.06] text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {o === 'manual' ? 'Manual' : o === 'compras' ? 'Compras' : 'Logística'}
                </button>
              ))}
            </div>
          </div>

          {/* Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={label}>Fornecedor *</p>
              <input className={input} placeholder="Razão social" value={form.fornecedor_nome}
                onChange={e => set('fornecedor_nome', e.target.value)} />
            </div>
            <div>
              <p className={label}>CNPJ</p>
              <input className={input} placeholder="00.000.000/0000-00" value={form.fornecedor_cnpj}
                onChange={e => set('fornecedor_cnpj', e.target.value)} />
            </div>
          </div>

          {/* Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={label}>Valor Total *</p>
              <input className={input} type="number" step="0.01" placeholder="0,00" value={form.valor_total}
                onChange={e => set('valor_total', e.target.value)} />
            </div>
            <div>
              <p className={label}>CFOP</p>
              <input className={input} placeholder="Ex: 5102" value={form.cfop}
                onChange={e => set('cfop', e.target.value)} />
            </div>
          </div>

          {/* Natureza */}
          <div>
            <p className={label}>Natureza da Operação</p>
            <input className={input} placeholder="Ex: Venda de mercadoria" value={form.natureza_operacao}
              onChange={e => set('natureza_operacao', e.target.value)} />
          </div>

          {/* Descrição */}
          <div>
            <p className={label}>Descrição</p>
            <textarea className={`${input} resize-none`} rows={2} placeholder="Descrição da solicitação..."
              value={form.descricao} onChange={e => set('descricao', e.target.value)} />
          </div>

          {/* Observações */}
          <div>
            <p className={label}>Observações</p>
            <textarea className={`${input} resize-none`} rows={2} placeholder="Observações adicionais..."
              value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-b-2xl`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
            Cancelar
          </button>
          <button onClick={submit} disabled={!canSubmit || isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-sm">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Criar Solicitação
          </button>
        </div>
      </div>
    </div>
  )
}
