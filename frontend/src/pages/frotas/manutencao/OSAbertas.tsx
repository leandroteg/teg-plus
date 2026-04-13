import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Wrench, X, Clock, AlertTriangle, Car, Building2,
  Search, LayoutList, LayoutGrid, ArrowUp, ArrowDown, CheckCircle2,
  ClipboardCheck, ShieldCheck, Cog, FileSearch,
} from 'lucide-react'
import { UpperTextarea } from '../../../components/UpperInput'
import { useOrdensServico, useCriarOS, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroOrdemServico, PrioridadeOS, TipoOS, StatusOS } from '../../../types/frotas'

// ── Helpers ──────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function diasEmAberto(dataAbertura: string): number {
  return Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 86_400_000)
}

// ── Config ───────────────────────────────────────────────────────────────────
const PRIOR: Record<PrioridadeOS, { label: string; badge: string; bar: string }> = {
  critica: { label: 'CRÍTICA', badge: 'bg-red-500/15 text-red-500 border-red-500/30', bar: 'bg-red-500' },
  alta:    { label: 'ALTA',    badge: 'bg-orange-500/15 text-orange-500 border-orange-500/30', bar: 'bg-orange-500' },
  media:   { label: 'MÉDIA',   badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', bar: 'bg-amber-400' },
  baixa:   { label: 'BAIXA',   badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20', bar: 'bg-slate-500' },
}

const TIPO_LABEL: Record<TipoOS, { label: string; cls: string }> = {
  preventiva: { label: 'Preventiva', cls: 'bg-teal-500/10 text-teal-500' },
  corretiva:  { label: 'Corretiva',  cls: 'bg-orange-500/10 text-orange-500' },
  sinistro:   { label: 'Sinistro',   cls: 'bg-red-500/10 text-red-500' },
  revisao:    { label: 'Revisão',    cls: 'bg-violet-500/10 text-violet-500' },
}

// ── Pipeline stages ──────────────────────────────────────────────────────────
type StageKey = StatusOS

interface Stage {
  key: StageKey
  label: string
  icon: React.ElementType
}

const STAGES: Stage[] = [
  { key: 'pendente',             label: 'Pendente',     icon: ClipboardCheck },
  { key: 'em_cotacao',           label: 'Cotação',      icon: FileSearch },
  { key: 'aguardando_aprovacao', label: 'Aprovação',    icon: ShieldCheck },
  { key: 'aprovada',             label: 'Aprovada',     icon: CheckCircle2 },
  { key: 'em_execucao',          label: 'Em Execução',  icon: Cog },
  { key: 'concluida',            label: 'Concluída',    icon: CheckCircle2 },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }

const STAGE_ACCENT: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
  aberta:               { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
  em_cotacao:           { bg:'bg-sky-50',     bgActive:'bg-sky-100',     text:'text-sky-500',     textActive:'text-sky-800',     dot:'bg-sky-500',     badge:'bg-sky-200/80 text-sky-700',       border:'border-sky-200' },
  aguardando_aprovacao: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  aprovada:             { bg:'bg-teal-50',    bgActive:'bg-teal-100',    text:'text-teal-500',    textActive:'text-teal-800',    dot:'bg-teal-500',    badge:'bg-teal-200/80 text-teal-700',     border:'border-teal-200' },
  em_execucao:          { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700', border:'border-violet-200' },
  concluida:            { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700',border:'border-emerald-200' },
  rejeitada:            { bg:'bg-red-50',     bgActive:'bg-red-100',     text:'text-red-500',     textActive:'text-red-800',     dot:'bg-red-500',     badge:'bg-red-200/80 text-red-700',       border:'border-red-200' },
  cancelada:            { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-400',   textActive:'text-slate-600',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-500',   border:'border-slate-200' },
}

const STAGE_ACCENT_DARK: Record<StageKey, AccentSet> = {
  pendente:             { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',     border:'border-white/[0.08]' },
  aberta:               { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',     border:'border-white/[0.08]' },
  em_cotacao:           { bg:'bg-sky-500/5',     bgActive:'bg-sky-500/15',   text:'text-sky-400',     textActive:'text-sky-200',     dot:'bg-sky-400',     badge:'bg-sky-500/15 text-sky-300',         border:'border-sky-500/20' },
  aguardando_aprovacao: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15', text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',     border:'border-amber-500/20' },
  aprovada:             { bg:'bg-teal-500/5',    bgActive:'bg-teal-500/15',  text:'text-teal-400',    textActive:'text-teal-200',    dot:'bg-teal-400',    badge:'bg-teal-500/15 text-teal-300',       border:'border-teal-500/20' },
  em_execucao:          { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',   border:'border-violet-500/20' },
  concluida:            { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15',text:'text-emerald-400',textActive:'text-emerald-200',dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  rejeitada:            { bg:'bg-red-500/5',     bgActive:'bg-red-500/15',   text:'text-red-400',     textActive:'text-red-200',     dot:'bg-red-400',     badge:'bg-red-500/15 text-red-300',         border:'border-red-500/20' },
  cancelada:            { bg:'bg-white/[0.02]',  bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-400',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-500',     border:'border-white/[0.08]' },
}

// ── Modal Nova OS ────────────────────────────────────────────────────────────
function NovaOSModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criar = useCriarOS()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id: '', tipo: 'corretiva' as TipoOS,
    prioridade: 'media' as PrioridadeOS,
    descricao_problema: '', data_previsao: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id, tipo: form.tipo,
      prioridade: form.prioridade,
      descricao_problema: form.descricao_problema,
      data_previsao: form.data_previsao || undefined,
    })
    onClose()
  }

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inp = `w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder-slate-500 focus:border-rose-500'
      : 'bg-white border border-slate-200 shadow-sm text-slate-800 placeholder-slate-400 focus:border-rose-400'
  }`
  const lbl = `block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'} ${bg}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Wrench size={16} className="text-rose-500" /> Nova Ordem de Servico
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Veiculo / Maquina *</label>
            <select className={inp} value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select className={inp} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOS }))}>
                {(Object.entries(TIPO_LABEL) as [TipoOS, typeof TIPO_LABEL[TipoOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select className={inp} value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}>
                {(Object.entries(PRIOR) as [PrioridadeOS, typeof PRIOR[PrioridadeOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Descricao do Problema *</label>
            <UpperTextarea className={`${inp} resize-none`} rows={3} required
              placeholder="Descreva o problema identificado..."
              value={form.descricao_problema}
              onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Previsao de Conclusao</label>
            <input type="date" className={inp} value={form.data_previsao}
              onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} />
          </div>
        </div>
        <div className={`px-5 py-4 border-t flex gap-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button type="button" onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            Cancelar
          </button>
          <button type="submit" disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm text-white font-bold transition-colors disabled:opacity-50">
            {criar.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── OS Card ──────────────────────────────────────────────────────────────────
function OSCard({ os, isDark, onClick }: { os: FroOrdemServico; isDark: boolean; onClick: () => void }) {
  const p    = PRIOR[os.prioridade]
  const t    = TIPO_LABEL[os.tipo]
  const dias = diasEmAberto(os.data_abertura)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado

  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${
      isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-[3px] h-8 rounded-full shrink-0 ${p.bar}`} />
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {os.veiculo?.placa ?? '—'}
              {os.veiculo?.modelo && (
                <span className={`font-normal text-[11px] ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {os.veiculo.marca} {os.veiculo.modelo}
                </span>
              )}
            </p>
            {os.numero_os && <p className="text-[10px] text-slate-500 font-mono">{os.numero_os}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${p.badge}`}>
            {p.label}
          </span>
        </div>
      </div>
      {os.descricao_problema && (
        <p className={`text-[11px] leading-snug line-clamp-2 mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {os.descricao_problema}
        </p>
      )}
      <div className={`flex items-center gap-2 flex-wrap text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <span className={`px-1.5 py-0.5 rounded-md font-bold ${t.cls}`}>{t.label}</span>
        <span className="flex items-center gap-0.5"><Clock size={9} /> {dias}d</span>
        {os.fornecedor && (
          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
            <Building2 size={9} /> {os.fornecedor.nome_fantasia ?? os.fornecedor.razao_social}
          </span>
        )}
        {valor != null && valor > 0 && (
          <span className={`ml-auto font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{BRL(valor)}</span>
        )}
      </div>
    </button>
  )
}

// ── OS Row ───────────────────────────────────────────────────────────────────
function OSRow({ os, isDark, onClick }: { os: FroOrdemServico; isDark: boolean; onClick: () => void }) {
  const p    = PRIOR[os.prioridade]
  const t    = TIPO_LABEL[os.tipo]
  const dias = diasEmAberto(os.data_abertura)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado
  const accent = isDark ? STAGE_ACCENT_DARK[os.status] : STAGE_ACCENT[os.status]

  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b transition-all ${
      isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'
    }`}>
      <div className={`w-[3px] h-6 rounded-full shrink-0 ${p.bar}`} />
      <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {os.veiculo?.placa ?? '—'}
        {os.veiculo?.modelo && (
          <span className={`font-normal ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {os.veiculo.marca} {os.veiculo.modelo}
          </span>
        )}
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${t.cls}`}>{t.label}</span>
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${p.badge}`}>{p.label}</span>
      <span className={`w-[50px] text-[10px] text-right shrink-0 ${dias > 14 ? 'text-red-500 font-bold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {dias}d
      </span>
      <span className={`w-[70px] text-xs text-right font-semibold shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        {valor ? BRL(valor) : '—'}
      </span>
    </button>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function OSDetailModal({ os, onClose, isDark }: { os: FroOrdemServico; onClose: () => void; isDark: boolean }) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardBg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100'
  const indigoBg = isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-100'
  const p = PRIOR[os.prioridade]
  const t = TIPO_LABEL[os.tipo]
  const dias = diasEmAberto(os.data_abertura)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado
  const accent = isDark ? STAGE_ACCENT_DARK[os.status] : STAGE_ACCENT[os.status]
  const stageLabel = STAGES.find(s => s.key === os.status)?.label || os.status

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b rounded-t-2xl ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Wrench size={18} className="text-rose-500 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txt}`}>{os.numero_os || 'Ordem de Servico'}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${accent.bgActive} ${accent.textActive}`}>
              <span className={`w-2 h-2 rounded-full ${accent.dot}`} /> {stageLabel}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Veiculo */}
          <div className={`rounded-xl p-4 border ${indigoBg}`}>
            <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400 mb-3">Veiculo</p>
            <div className="flex items-center gap-2">
              <Car size={16} className={txtMuted} />
              <p className={`text-sm font-bold ${txt}`}>{os.veiculo?.placa ?? '—'}</p>
              {os.veiculo?.modelo && <span className={`text-xs ${txtMuted}`}>{os.veiculo.marca} {os.veiculo.modelo}</span>}
            </div>
          </div>
          {/* Dados */}
          <div className={`rounded-xl p-4 border ${cardBg}`}>
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-3 ${txtMuted}`}>Dados da OS</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={`text-[9px] ${txtMuted}`}>Tipo</p><span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${t.cls}`}>{t.label}</span></div>
              <div><p className={`text-[9px] ${txtMuted}`}>Prioridade</p><span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${p.badge}`}>{p.label}</span></div>
              <div><p className={`text-[9px] ${txtMuted}`}>Abertura</p><p className={`font-semibold ${txt}`}>{fmtDate(os.data_abertura)}</p></div>
              <div><p className={`text-[9px] ${txtMuted}`}>Dias em aberto</p><p className={`font-semibold ${dias > 14 ? 'text-red-500' : dias > 7 ? 'text-amber-500' : txt}`}>{dias} dias</p></div>
              {os.data_previsao && <div><p className={`text-[9px] ${txtMuted}`}>Previsao</p><p className={`font-semibold ${txt}`}>{fmtDate(os.data_previsao)}</p></div>}
              {valor != null && valor > 0 && <div><p className={`text-[9px] ${txtMuted}`}>Valor</p><p className={`font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{BRL(valor)}</p></div>}
            </div>
          </div>
          {/* Descricao */}
          {os.descricao_problema && (
            <div className={`rounded-xl p-4 border ${cardBg}`}>
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Descricao do Problema</p>
              <p className={`text-xs whitespace-pre-wrap ${txt}`}>{os.descricao_problema}</p>
            </div>
          )}
          {/* Fornecedor */}
          {os.fornecedor && (
            <div className={`rounded-xl p-4 border ${cardBg}`}>
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Fornecedor</p>
              <p className={`text-sm font-semibold ${txt}`}>{os.fornecedor.nome_fantasia ?? os.fornecedor.razao_social}</p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
type SortField = 'data' | 'placa' | 'prioridade'
type ViewMode = 'cards' | 'list'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data', label: 'Data' }, { field: 'placa', label: 'Placa' }, { field: 'prioridade', label: 'Prioridade' },
]

const PRIOR_ORDER: Record<PrioridadeOS, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }

export default function OSAbertas() {
  const { isDark } = useTheme()
  const [novaOS, setNovaOS] = useState(false)
  const [activeTab, setActiveTab] = useState<StageKey>('pendente')
  const [detail, setDetail] = useState<FroOrdemServico | null>(null)
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data: ordens = [], isLoading } = useOrdensServico()

  const grouped = useMemo(() => {
    const map = new Map<StageKey, FroOrdemServico[]>()
    STAGES.forEach(s => map.set(s.key, []))
    ordens.forEach(o => map.get(o.status)?.push(o))
    return map
  }, [ordens])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(o =>
        [o.veiculo?.placa, o.veiculo?.modelo, o.numero_os, o.descricao_problema, o.fornecedor?.razao_social]
          .some(v => v?.toLowerCase().includes(q))
      )
    }
    items.sort((a, b) => {
      let c = 0
      if (sortField === 'data') c = (a.data_abertura || '').localeCompare(b.data_abertura || '')
      else if (sortField === 'placa') c = (a.veiculo?.placa || '').localeCompare(b.veiculo?.placa || '')
      else c = PRIOR_ORDER[a.prioridade] - PRIOR_ORDER[b.prioridade]
      return sortDir === 'asc' ? c : -c
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Wrench size={18} className="text-rose-500" /> OS Abertas
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline de manutencao</p>
        </div>
        <button onClick={() => setNovaOS(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors">
          <Plus size={14} /> Nova OS
        </button>
      </div>

      {/* Pipeline tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {STAGES.map(stage => {
          const count = grouped.get(stage.key)?.length || 0
          const isActive = activeTab === stage.key
          const Icon = stage.icon
          const a = isDark ? STAGE_ACCENT_DARK[stage.key] : STAGE_ACCENT[stage.key]
          return (
            <button key={stage.key} onClick={() => { setActiveTab(stage.key); setBusca('') }}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" /> {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar placa, OS, problema..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
            }`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-0.5">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.field} onClick={() => toggleSort(opt.field)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                sortField === opt.field
                  ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {opt.label} {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
            </button>
          ))}
        </div>
        <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{activeItems.length} item(s)</span>
      </div>

      {/* Content */}
      <div className="min-h-[200px]">
        {activeItems.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <Wrench size={40} className="mb-3" /><p className="text-sm font-medium">Nenhuma OS nesta etapa</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">{activeItems.map(os => <OSCard key={os.id} os={os} isDark={isDark} onClick={() => setDetail(os)} />)}</div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-[3px]" /><span className="w-2" /><span className="flex-1">Veiculo</span><span className="w-[60px]">Tipo</span><span className="w-[60px]">Prior.</span><span className="w-[50px] text-right">Dias</span><span className="w-[70px] text-right">Valor</span>
            </div>
            {activeItems.map(os => <OSRow key={os.id} os={os} isDark={isDark} onClick={() => setDetail(os)} />)}
          </div>
        )}
      </div>

      {detail && <OSDetailModal os={detail} onClose={() => setDetail(null)} isDark={isDark} />}
      {novaOS && <NovaOSModal onClose={() => setNovaOS(false)} isDark={isDark} />}
    </div>
  )
}
