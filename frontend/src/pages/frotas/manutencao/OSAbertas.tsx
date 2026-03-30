import { useState } from 'react'
import { Plus, Wrench, X } from 'lucide-react'
import { useOrdensServico, useCriarOS, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroOrdemServico, PrioridadeOS, TipoOS, StatusOS } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function diasEmAberto(dataAbertura: string): number {
  const abertura = new Date(dataAbertura)
  const hoje = new Date()
  return Math.floor((hoje.getTime() - abertura.getTime()) / 86_400_000)
}

const PRIORIDADE_CFG: Record<PrioridadeOS, { label: string; cls: string }> = {
  critica: { label: 'CRITICA', cls: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30' },
  alta:    { label: 'ALTA',    cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30' },
  media:   { label: 'MEDIA',   cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30' },
  baixa:   { label: 'BAIXA',   cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20' },
}

const TIPO_LABEL: Record<TipoOS, string> = {
  preventiva: 'Preventiva',
  corretiva:  'Corretiva',
  sinistro:   'Sinistro',
  revisao:    'Revisão',
}

interface ColunaCfg {
  status: StatusOS
  label: string
  borderCls: string
}

const COLUNAS: ColunaCfg[] = [
  { status: 'pendente',              label: 'Pendente',       borderCls: 'border-t-slate-400' },
  { status: 'em_cotacao',            label: 'Cotação',        borderCls: 'border-t-sky-500'   },
  { status: 'aguardando_aprovacao',  label: 'Em Aprovação',   borderCls: 'border-t-amber-500' },
  { status: 'aprovada',              label: 'Aprovada',       borderCls: 'border-t-teal-500'  },
  { status: 'em_execucao',           label: 'Em Execução',    borderCls: 'border-t-violet-500'},
  { status: 'concluida',             label: 'Concluída',      borderCls: 'border-t-emerald-500'},
]

// ── Nova OS Modal ─────────────────────────────────────────────────────────────
function NovaOSModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
  const criar = useCriarOS()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id:          '',
    tipo:                'corretiva' as TipoOS,
    prioridade:          'media'     as PrioridadeOS,
    descricao_problema:  '',
    data_previsao:       '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id:         form.veiculo_id,
      tipo:               form.tipo,
      prioridade:         form.prioridade,
      descricao_problema: form.descricao_problema,
      data_previsao:      form.data_previsao || undefined,
    })
    onClose()
  }

  const inp = `w-full px-3 py-2.5 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/40 transition-colors ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300'
      : 'bg-white/6 border border-white/12 text-white hover:border-white/20'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')
  const lbl = `block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`
  const card = isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const divider = isLight ? 'border-slate-100' : 'border-white/[0.06]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto styled-scrollbar ${card}`}
      >
        <div className={`flex items-center justify-between px-6 py-4 border-b ${divider}`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wrench size={16} className="text-rose-500" /> Nova Ordem de Serviço
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={lbl}>Veículo / Máquina *</label>
            <select
              className={sel}
              value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))}
              required
            >
              <option value="">Selecione...</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select
                className={sel}
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOS }))}
              >
                {(Object.keys(TIPO_LABEL) as TipoOS[]).map(k => (
                  <option key={k} value={k}>{TIPO_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select
                className={sel}
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}
              >
                {(Object.keys(PRIORIDADE_CFG) as PrioridadeOS[]).map(k => (
                  <option key={k} value={k}>{PRIORIDADE_CFG[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Descrição do problema *</label>
            <textarea
              className={inp + ' resize-none'}
              rows={3}
              required
              value={form.descricao_problema}
              onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))}
              placeholder="Descreva o problema identificado..."
            />
          </div>

          <div>
            <label className={lbl}>Previsão de conclusão</label>
            <input
              type="date"
              className={inp}
              value={form.data_previsao}
              onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))}
            />
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex gap-2 ${divider}`}>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              isLight
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'border-white/12 text-slate-300 hover:bg-white/5'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-sm text-white font-semibold disabled:opacity-50 shadow-sm shadow-rose-500/20 transition-all"
          >
            {criar.isPending ? 'Criando...' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── OS Kanban Card ────────────────────────────────────────────────────────────
function OSKanbanCard({ os, isLight }: { os: FroOrdemServico; isLight: boolean }) {
  const pCfg = PRIORIDADE_CFG[os.prioridade]
  const dias = diasEmAberto(os.data_abertura)
  const valor = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado

  return (
    <div
      className={`rounded-2xl border p-3.5 transition-shadow hover:shadow-md cursor-default select-none space-y-2.5 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/60 border-white/[0.07]'
      }`}
    >
      {/* Prioridade badge */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${pCfg.cls}`}>
          {pCfg.label}
        </span>
        <span className={`text-[10px] font-medium ${dias > 7 ? 'text-rose-400' : 'text-slate-400'}`}>
          {dias}d
        </span>
      </div>

      {/* OS# e Placa */}
      <div>
        <p className={`text-sm font-extrabold leading-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {os.numero_os ?? 'OS—'} · {os.veiculo?.placa ?? '—'}
        </p>
        <p className={`text-[11px] mt-0.5 leading-snug line-clamp-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {os.descricao_problema}
        </p>
      </div>

      {/* Tipo */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
          isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/8 text-slate-300'
        }`}>
          {TIPO_LABEL[os.tipo]}
        </span>
        {os.fornecedor && (
          <span className={`text-[10px] truncate max-w-[110px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {os.fornecedor.razao_social}
          </span>
        )}
      </div>

      {/* Valor */}
      {valor !== undefined && valor !== null && (
        <p className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
          {BRL(valor)}
        </p>
      )}
    </div>
  )
}

// ── Coluna Kanban ─────────────────────────────────────────────────────────────
function KanbanColuna({
  cfg,
  cards,
  isLight,
}: {
  cfg: ColunaCfg
  cards: FroOrdemServico[]
  isLight: boolean
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border-t-2 ${cfg.borderCls} min-w-[220px] max-w-[250px] flex-shrink-0 ${
        isLight ? 'bg-slate-50 border-x border-b border-slate-200' : 'bg-slate-900/40 border-x border-b border-white/[0.05]'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.05]'}`}>
        <span className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
          {cfg.label}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          cards.length > 0
            ? isLight ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-slate-300'
            : isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'
        }`}>
          {cards.length}
        </span>
      </div>

      {/* Cards scrollable */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 styled-scrollbar max-h-[calc(100vh-260px)] min-h-[120px]">
        {cards.length === 0 ? (
          <p className="text-[10px] text-slate-500 text-center py-6">Vazio</p>
        ) : (
          cards.map(os => <OSKanbanCard key={os.id} os={os} isLight={isLight} />)
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OSAbertas() {
  const { isLightSidebar: isLight } = useTheme()
  const [novaOS, setNovaOS] = useState(false)

  const { data: ordensRaw = [], isLoading } = useOrdensServico({
    status: ['pendente', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })

  // Agrupa por status, mantendo também "concluida" para o kanban visual
  const { data: concluidasRaw = [] } = useOrdensServico({ status: 'concluida' })

  const todasOS: FroOrdemServico[] = [...ordensRaw, ...concluidasRaw.slice(0, 10)]

  const total = ordensRaw.length

  function cardsDaColuna(status: StatusOS): FroOrdemServico[] {
    return todasOS.filter(os => os.status === status)
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Wrench size={20} className="text-rose-500" />
            OS Abertas
            <span className={`text-sm font-bold ml-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              — {total}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Pipeline de manutenção em andamento</p>
        </div>
        <button
          onClick={() => setNovaOS(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-sm text-white font-semibold shadow-sm shadow-rose-500/20 transition-all"
        >
          <Plus size={15} /> Nova OS
        </button>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUNAS.map(c => (
            <div
              key={c.status}
              className={`min-w-[220px] h-64 rounded-2xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
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
