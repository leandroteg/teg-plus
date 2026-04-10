import { useState } from 'react'
import { Plus, Wrench, X, Clock, AlertTriangle, Car, Building2 } from 'lucide-react'
import { UpperTextarea } from '../../../components/UpperInput'
import { useOrdensServico, useCriarOS, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroOrdemServico, PrioridadeOS, TipoOS, StatusOS } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function diasEmAberto(dataAbertura: string): number {
  return Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 86_400_000)
}

// ── Config prioridade ─────────────────────────────────────────────────────────
const PRIOR: Record<PrioridadeOS, { label: string; badge: string; bar: string }> = {
  critica: {
    label: 'CRÍTICA',
    badge: 'bg-red-500/15 text-red-500 border-red-500/30',
    bar:   'bg-red-500',
  },
  alta: {
    label: 'ALTA',
    badge: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
    bar:   'bg-orange-500',
  },
  media: {
    label: 'MÉDIA',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    bar:   'bg-amber-400',
  },
  baixa: {
    label: 'BAIXA',
    badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    bar:   'bg-slate-500',
  },
}

const TIPO_LABEL: Record<TipoOS, { label: string; cls: string }> = {
  preventiva: { label: 'Preventiva', cls: 'bg-teal-500/10 text-teal-500' },
  corretiva:  { label: 'Corretiva',  cls: 'bg-orange-500/10 text-orange-500' },
  sinistro:   { label: 'Sinistro',   cls: 'bg-red-500/10 text-red-500' },
  revisao:    { label: 'Revisão',    cls: 'bg-violet-500/10 text-violet-500' },
}

// ── Config colunas ────────────────────────────────────────────────────────────
interface ColunaCfg {
  status:    StatusOS
  label:     string
  accent:    string   // cor Tailwind sem prefixo (ex: 'sky')
  dotColor:  string
  emptyMsg:  string
}

const COLUNAS: ColunaCfg[] = [
  { status: 'pendente',             label: 'Pendente',     accent: 'slate',   dotColor: 'bg-slate-400',   emptyMsg: 'Nenhuma OS pendente'    },
  { status: 'em_cotacao',           label: 'Cotação',      accent: 'sky',     dotColor: 'bg-sky-500',     emptyMsg: 'Nenhuma em cotação'     },
  { status: 'aguardando_aprovacao', label: 'Em Aprovação', accent: 'amber',   dotColor: 'bg-amber-500',   emptyMsg: 'Nenhuma aguardando'     },
  { status: 'aprovada',             label: 'Aprovada',     accent: 'teal',    dotColor: 'bg-teal-500',    emptyMsg: 'Nenhuma aprovada'       },
  { status: 'em_execucao',          label: 'Em Execução',  accent: 'violet',  dotColor: 'bg-violet-500',  emptyMsg: 'Nenhuma em execução'    },
  { status: 'concluida',            label: 'Concluída',    accent: 'emerald', dotColor: 'bg-emerald-500', emptyMsg: 'Nenhuma concluída hoje' },
]

const ACCENT_TOP: Record<string, string> = {
  slate:   'border-t-slate-400',
  sky:     'border-t-sky-500',
  amber:   'border-t-amber-500',
  teal:    'border-t-teal-500',
  violet:  'border-t-violet-500',
  emerald: 'border-t-emerald-500',
}

const ACCENT_COUNT_D: Record<string, string> = {
  slate:   'bg-slate-500/20 text-slate-400',
  sky:     'bg-sky-500/20 text-sky-400',
  amber:   'bg-amber-500/20 text-amber-400',
  teal:    'bg-teal-500/20 text-teal-400',
  violet:  'bg-violet-500/20 text-violet-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
}
const ACCENT_COUNT_L: Record<string, string> = {
  slate:   'bg-slate-100 text-slate-600',
  sky:     'bg-sky-100 text-sky-700',
  amber:   'bg-amber-100 text-amber-700',
  teal:    'bg-teal-100 text-teal-700',
  violet:  'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}

// ── Modal Nova OS ─────────────────────────────────────────────────────────────
function NovaOSModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
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

  const inp = `w-full px-3 py-2.5 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/40 transition-colors ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300'
      : 'bg-white/[0.06] border border-white/[0.12] text-white hover:border-white/20'
  }`
  const lbl = `block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`
  const card = isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  const div  = isLight ? 'border-slate-100' : 'border-white/[0.06]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border ${card}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${div}`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wrench size={16} className="text-rose-500" /> Nova Ordem de Serviço
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-rose-400 transition-colors rounded-lg p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={lbl}>Veículo / Máquina *</label>
            <select className={`${inp} [&>option]:bg-slate-900`} value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select className={`${inp} [&>option]:bg-slate-900`} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOS }))}>
                {(Object.entries(TIPO_LABEL) as [TipoOS, typeof TIPO_LABEL[TipoOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select className={`${inp} [&>option]:bg-slate-900`} value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}>
                {(Object.entries(PRIOR) as [PrioridadeOS, typeof PRIOR[PrioridadeOS]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Descrição do Problema *</label>
            <UpperTextarea className={`${inp} resize-none`} rows={3} required
              placeholder="Descreva o problema identificado..."
              value={form.descricao_problema}
              onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} />
          </div>

          <div>
            <label className={lbl}>Previsão de Conclusão</label>
            <input type="date" className={inp} value={form.data_previsao}
              onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} />
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex gap-3 ${div}`}>
          <button type="button" onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/12 text-slate-300 hover:bg-white/5'
            }`}>
            Cancelar
          </button>
          <button type="submit" disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-sm text-white font-bold shadow-sm shadow-rose-500/20 transition-all disabled:opacity-50">
            {criar.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── OS Card ───────────────────────────────────────────────────────────────────
function OSCard({ os, isLight }: { os: FroOrdemServico; isLight: boolean }) {
  const p    = PRIOR[os.prioridade]
  const t    = TIPO_LABEL[os.tipo]
  const dias = diasEmAberto(os.data_abertura)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado

  return (
    <div className={`group relative rounded-2xl border overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg cursor-default select-none ${
      isLight
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-slate-200'
        : 'bg-slate-800/70 border-white/[0.08] hover:border-white/[0.14] hover:shadow-black/40'
    }`}>
      {/* Barra de prioridade lateral */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${p.bar}`} />

      <div className="pl-4 pr-3.5 py-3.5 space-y-2.5">
        {/* Linha 1: prioridade + dias */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${p.badge}`}>
            {p.label}
          </span>
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${
            dias > 14 ? 'text-red-400' : dias > 7 ? 'text-amber-400' : 'text-slate-500'
          }`}>
            <Clock size={10} />
            {dias}d
            {dias > 14 && <AlertTriangle size={10} />}
          </div>
        </div>

        {/* Linha 2: OS# + Placa */}
        <div>
          <div className="flex items-center gap-1.5">
            <Car size={11} className="text-slate-400 shrink-0" />
            <p className={`text-sm font-extrabold leading-tight truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {os.veiculo?.placa ?? '—'}
              {os.veiculo?.modelo && (
                <span className={`font-normal text-[11px] ml-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {os.veiculo.marca} {os.veiculo.modelo}
                </span>
              )}
            </p>
          </div>
          {os.numero_os && (
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{os.numero_os}</p>
          )}
        </div>

        {/* Linha 3: Descrição */}
        {os.descricao_problema && (
          <p className={`text-[11px] leading-snug line-clamp-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {os.descricao_problema}
          </p>
        )}

        {/* Linha 4: Tipo + Fornecedor */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${t.cls}`}>
            {t.label}
          </span>
          {os.fornecedor && (
            <span className={`flex items-center gap-1 text-[10px] truncate max-w-[120px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <Building2 size={9} className="shrink-0" />
              {os.fornecedor.nome_fantasia ?? os.fornecedor.razao_social}
            </span>
          )}
        </div>

        {/* Linha 5: Valor */}
        {valor != null && valor > 0 && (
          <div className={`flex items-center justify-end pt-1 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.05]'}`}>
            <span className={`text-xs font-black ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              {BRL(valor)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Coluna Kanban ─────────────────────────────────────────────────────────────
function KanbanColuna({ cfg, cards, isLight }: { cfg: ColunaCfg; cards: FroOrdemServico[]; isLight: boolean }) {
  const topBorder  = ACCENT_TOP[cfg.accent]
  const countCls   = isLight ? ACCENT_COUNT_L[cfg.accent] : ACCENT_COUNT_D[cfg.accent]

  return (
    <div className={`flex flex-col flex-shrink-0 w-[240px] rounded-2xl border-t-[3px] ${topBorder} overflow-hidden ${
      isLight
        ? 'bg-slate-50/80 border-x border-b border-slate-200'
        : 'bg-[#0f172a]/60 border-x border-b border-white/[0.05]'
    }`}>
      {/* Cabeçalho */}
      <div className={`flex items-center justify-between px-3.5 py-3 border-b ${
        isLight ? 'border-slate-200 bg-white/60' : 'border-white/[0.05] bg-white/[0.02]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
          <span className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            {cfg.label}
          </span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${countCls}`}>
          {cards.length}
        </span>
      </div>

      {/* Área scrollável */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isLight ? 'bg-slate-100' : 'bg-white/[0.04]'
            }`}>
              <Wrench size={14} className="text-slate-500" />
            </div>
            <p className="text-[10px] text-slate-500 text-center leading-relaxed px-2">
              {cfg.emptyMsg}
            </p>
          </div>
        ) : (
          cards.map(os => <OSCard key={os.id} os={os} isLight={isLight} />)
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OSAbertas() {
  const { isLightSidebar: isLight } = useTheme()
  const [novaOS, setNovaOS] = useState(false)

  const { data: abertas = [], isLoading } = useOrdensServico({
    status: ['pendente', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })
  const { data: concluidas = [] } = useOrdensServico({ status: 'concluida' })

  const todas: FroOrdemServico[] = [...abertas, ...concluidas.slice(0, 8)]

  const criticas = abertas.filter(o => o.prioridade === 'critica').length
  const altas    = abertas.filter(o => o.prioridade === 'alta').length

  function cardsDaColuna(status: StatusOS) {
    return todas.filter(o => o.status === status)
  }

  return (
    /* Ocupa todo o espaço do hub sem scroll externo */
    <div className="flex flex-col h-full overflow-hidden p-4 sm:p-6 gap-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wrench size={18} className="text-rose-500" />
            OS Abertas
            <span className={`text-sm font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              — {abertas.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Pipeline de manutenção em andamento</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Alertas rápidos */}
          {criticas > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-500 border border-red-500/20">
              <AlertTriangle size={10} /> {criticas} crítica{criticas > 1 ? 's' : ''}
            </span>
          )}
          {altas > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500/15 text-orange-500 border border-orange-500/20">
              {altas} alta{altas > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setNovaOS(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-sm text-white font-bold shadow-sm shadow-rose-500/20 transition-all"
          >
            <Plus size={14} /> Nova OS
          </button>
        </div>
      </div>

      {/* ── Kanban ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex gap-3 flex-1">
          {COLUNAS.map(c => (
            <div key={c.status}
              className={`w-[240px] flex-shrink-0 rounded-2xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`} />
          ))}
        </div>
      ) : (
        /* flex-1 + min-h-0 = ocupa o espaço restante sem extrapolar */
        <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
          {COLUNAS.map(cfg => (
            <KanbanColuna
              key={cfg.status}
              cfg={cfg}
              cards={cardsDaColuna(cfg.status)}
              isLight={isLight}
            />
          ))}
        </div>
      )}

      {novaOS && <NovaOSModal onClose={() => setNovaOS(false)} isLight={isLight} />}
    </div>
  )
}
