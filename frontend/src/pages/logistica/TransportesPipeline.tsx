import { useState, useMemo } from 'react'
import {
  Truck, Search, X, CheckCircle2, AlertTriangle,
  Calendar, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Download,
  MapPin, Clock, Building2, Package2, FileText, CalendarCheck, Star, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useSolicitacoes, useConfirmarEntregaFisica,
  useConfirmarAgendamento, useConfirmarRecebimento,
} from '../../hooks/useLogistica'
import type { LogSolicitacao, StatusTransportePipeline } from '../../types/logistica'
import { TRANSPORTE_PIPELINE_STAGES } from '../../types/logistica'

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtData = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const fmtDataHora = (d?: string) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Sort types ───────────────────────────────────────────────────────────────

type SortField = 'data' | 'origem' | 'destino' | 'tipo'
type SortDir = 'asc' | 'desc'
type ViewMode = 'list' | 'cards'

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'data',    label: 'Data' },
  { field: 'origem',  label: 'Origem' },
  { field: 'destino', label: 'Destino' },
  { field: 'tipo',    label: 'Tipo' },
]

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem', mobilizacao: 'Mobilização',
  transferencia_material: 'Transf. Material', transferencia_maquina: 'Transf. Máquina',
}

// ── Status accents ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof Truck> = {
  nfe_emitida:       FileText,
  aguardando_coleta: CalendarCheck,
  em_transito:       Truck,
  entregue:          Package2,
  concluido:         CheckCircle2,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string; badge: string }> = {
  nfe_emitida:       { bg: 'hover:bg-slate-50',    bgActive: 'bg-slate-100',    text: 'text-slate-600',   textActive: 'text-slate-800',   dot: 'bg-slate-400',    border: 'border-slate-400',    badge: 'bg-slate-200 text-slate-700' },
  aguardando_coleta: { bg: 'hover:bg-blue-50',     bgActive: 'bg-blue-50',      text: 'text-blue-600',    textActive: 'text-blue-800',    dot: 'bg-blue-500',     border: 'border-blue-500',     badge: 'bg-blue-100 text-blue-700' },
  em_transito:       { bg: 'hover:bg-amber-50',    bgActive: 'bg-amber-50',     text: 'text-amber-600',   textActive: 'text-amber-800',   dot: 'bg-amber-500',    border: 'border-amber-500',    badge: 'bg-amber-100 text-amber-700' },
  entregue:          { bg: 'hover:bg-teal-50',     bgActive: 'bg-teal-50',      text: 'text-teal-600',    textActive: 'text-teal-800',    dot: 'bg-teal-500',     border: 'border-teal-500',     badge: 'bg-teal-100 text-teal-700' },
  concluido:         { bg: 'hover:bg-green-50',    bgActive: 'bg-green-50',     text: 'text-green-600',   textActive: 'text-green-800',   dot: 'bg-green-500',    border: 'border-green-500',    badge: 'bg-green-100 text-green-700' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }> = {
  nfe_emitida:       { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',  text: 'text-slate-400',  textActive: 'text-slate-200',  badge: 'bg-slate-500/20 text-slate-300',  border: 'border-slate-500/40' },
  aguardando_coleta: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',   text: 'text-blue-400',   textActive: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-300',   border: 'border-blue-500/40' },
  em_transito:       { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',  text: 'text-amber-400',  textActive: 'text-amber-300',  badge: 'bg-amber-500/20 text-amber-300',  border: 'border-amber-500/40' },
  entregue:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',   text: 'text-teal-400',   textActive: 'text-teal-300',   badge: 'bg-teal-500/20 text-teal-300',   border: 'border-teal-500/40' },
  concluido:         { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-green-500/10',  text: 'text-green-400',  textActive: 'text-green-300',  badge: 'bg-green-500/20 text-green-300',  border: 'border-green-500/40' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(items: LogSolicitacao[], stageName: string) {
  const headers = ['Número', 'Tipo', 'Origem', 'Destino', 'Obra', 'Motorista', 'Placa', 'Urgente', 'Status']
  const rows = items.map(s => [
    s.numero, TIPO_LABEL[s.tipo] || s.tipo, s.origem, s.destino,
    s.obra_nome || '', s.motorista_nome || '', s.veiculo_placa || '',
    s.urgente ? 'Sim' : 'Não', s.status,
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transportes-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Lateness check ───────────────────────────────────────────────────────────

function isLate(sol: LogSolicitacao): boolean {
  if (sol.status !== 'em_transito') return false
  const t = sol.transporte
  if (!t?.eta_atual) return false
  return new Date(t.eta_atual) < new Date()
}

// ── Recebimento Modal ───────────────────────────────────────────────────────

function RecebimentoModal({ sol, onClose, onConfirm, isPending, isDark }: {
  sol: LogSolicitacao; onClose: () => void
  onConfirm: (data: {
    recebimento_id: string; solicitacao_id: string
    checklist: { quantidades_conferidas: boolean; estado_verificado: boolean; seriais_conferidos: boolean; temperatura_verificada: boolean }
    status: 'confirmado' | 'parcial' | 'recusado'
    divergencias?: string; avaliacao_qualidade?: number
  }) => void
  isPending: boolean; isDark: boolean
}) {
  const [checklist, setChecklist] = useState({
    quantidades_conferidas: false,
    estado_verificado: false,
    seriais_conferidos: false,
    temperatura_verificada: false,
  })
  const [statusReceb, setStatusReceb] = useState<'confirmado' | 'parcial' | 'recusado'>('confirmado')
  const [divergencias, setDivergencias] = useState('')
  const [avaliacaoQualidade, setAvaliacaoQualidade] = useState(5)

  const recebId = sol.recebimento?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-6 py-4 sticky top-0 z-10 ${isDark ? 'border-b border-white/[0.06] bg-[#1e293b]' : 'border-b border-slate-100 bg-white'}`}>
          <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Confirmar Recebimento</h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>#{sol.numero}</p>
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {sol.origem} → {sol.destino}{sol.obra_nome ? ` · ${sol.obra_nome}` : ''}
            </p>
          </div>

          <div>
            <p className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Checklist de Recebimento</p>
            <div className="space-y-2">
              {([
                ['quantidades_conferidas', 'Quantidades conferidas contra NF-e'],
                ['estado_verificado',      'Estado dos itens verificado (avarias, violação)'],
                ['seriais_conferidos',     'Itens de alta precisão conferidos individualmente'],
                ['temperatura_verificada', 'Temperatura verificada (itens com controle especial)'],
              ] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox"
                    checked={checklist[k as keyof typeof checklist]}
                    onChange={e => setChecklist(p => ({ ...p, [k]: e.target.checked }))}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Resultado *</label>
            <div className="flex gap-2">
              {([
                ['confirmado', 'Confirmado', 'bg-emerald-600'],
                ['parcial',    'Parcial',    'bg-blue-600'],
                ['recusado',   'Recusado',   'bg-red-600'],
              ] as const).map(([v, l, c]) => (
                <button key={v} onClick={() => setStatusReceb(v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors text-white ${statusReceb === v ? c : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {(statusReceb === 'parcial' || statusReceb === 'recusado') && (
            <div>
              <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Descrição das Divergências *</label>
              <textarea value={divergencias} onChange={e => setDivergencias(e.target.value)}
                rows={2} className={`w-full rounded-xl border text-xs px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`} placeholder="Descreva as divergências encontradas..." />
            </div>
          )}

          <div>
            <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Avaliação de Qualidade</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setAvaliacaoQualidade(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    avaliacaoQualidade >= n
                      ? 'bg-amber-400 text-white shadow-sm'
                      : isDark ? 'bg-white/10 text-slate-500 hover:bg-amber-500/20' : 'bg-slate-100 text-slate-400 hover:bg-amber-100'
                  }`}>
                  <Star size={14} className="mx-auto" fill={avaliacaoQualidade >= n ? 'currentColor' : 'none'} />
                </button>
              ))}
              <span className={`text-xs self-center ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{avaliacaoQualidade}/5</span>
            </div>
          </div>
        </div>
        <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Cancelar
          </button>
          <button onClick={() => {
            if (!recebId) return
            onConfirm({
              recebimento_id: recebId,
              solicitacao_id: sol.id,
              checklist,
              status: statusReceb,
              divergencias: divergencias || undefined,
              avaliacao_qualidade: avaliacaoQualidade,
            })
          }} disabled={isPending || !recebId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Confirmar Recebimento
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ sol, onClose, onAction, isDark }: {
  sol: LogSolicitacao; onClose: () => void
  onAction: (action: string, sol: LogSolicitacao) => void; isDark: boolean
}) {
  const t = sol.transporte
  const late = isLate(sol)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Truck size={18} className="text-orange-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>Transporte #{sol.numero}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sol.urgente && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> URGENTE</span>}
              {late && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={10} /> ATRASADO</span>}
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${STATUS_ACCENT[sol.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[sol.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[sol.status]?.dot || 'bg-slate-400'}`} />
              {TRANSPORTE_PIPELINE_STAGES.find(s => s.status === sol.status)?.label ?? sol.status}
            </span>
          </div>

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{sol.origem}</span></div>
              <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{sol.destino}</span></div>
              {sol.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{sol.obra_nome}</span></div>}
              {sol.motorista_nome && <div><span className="text-slate-400">Motorista:</span> <span className="font-semibold">{sol.motorista_nome}</span></div>}
              {sol.veiculo_placa && <div><span className="text-slate-400">Placa:</span> <span className="font-mono font-semibold">{sol.veiculo_placa}</span></div>}
              {t?.hora_saida && <div><span className="text-slate-400">Saída:</span> <span className="font-semibold">{fmtDataHora(t.hora_saida)}</span></div>}
              {t?.eta_atual && <div><span className="text-slate-400">ETA:</span> <span className={`font-semibold ${late ? 'text-amber-600' : ''}`}>{fmtDataHora(t.eta_atual)}</span></div>}
              {t?.hora_chegada && <div><span className="text-slate-400">Chegada:</span> <span className="font-semibold text-emerald-600">{fmtDataHora(t.hora_chegada)}</span></div>}
              {t?.codigo_rastreio && <div className="col-span-2"><span className="text-slate-400">Rastreio:</span> <span className="font-mono font-semibold">{t.codigo_rastreio}</span></div>}
            </div>
            {sol.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{sol.descricao}</p>}
          </div>

          {/* Recebimento info (for concluido) */}
          {sol.status === 'concluido' && sol.recebimento && (
            <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Recebimento Confirmado</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {sol.recebimento.quantidades_conferidas ? <CheckCircle2 size={11} className="text-emerald-500" /> : <X size={11} className="text-red-400" />}
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Quantidades</span>
                </div>
                <div className="flex items-center gap-1">
                  {sol.recebimento.estado_verificado ? <CheckCircle2 size={11} className="text-emerald-500" /> : <X size={11} className="text-red-400" />}
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Estado</span>
                </div>
                <div className="flex items-center gap-1">
                  {sol.recebimento.seriais_conferidos ? <CheckCircle2 size={11} className="text-emerald-500" /> : <X size={11} className="text-red-400" />}
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Seriais</span>
                </div>
                <div className="flex items-center gap-1">
                  {sol.recebimento.temperatura_verificada ? <CheckCircle2 size={11} className="text-emerald-500" /> : <X size={11} className="text-red-400" />}
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Temperatura</span>
                </div>
              </div>
              {sol.recebimento.confirmado_em && (
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Confirmado em {fmtDataHora(sol.recebimento.confirmado_em)}
                  {sol.recebimento.assinatura_digital && ` · ${sol.recebimento.assinatura_digital}`}
                </p>
              )}
              {sol.recebimento.divergencias && (
                <p className="text-[10px] font-medium text-amber-600">Divergências: {sol.recebimento.divergencias}</p>
              )}
            </div>
          )}

          {/* Progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {TRANSPORTE_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = TRANSPORTE_PIPELINE_STAGES.findIndex(st => st.status === sol.status)
                const isPast = i <= currentIdx
                const accent = STATUS_ACCENT[s.status]
                return <div key={s.status} className="flex-1"><div className={`h-1.5 rounded-full transition-all ${isPast ? accent?.dot || 'bg-slate-400' : isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} /></div>
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              Fechar
            </button>
            {sol.status === 'nfe_emitida' && (
              <button onClick={() => onAction('confirmarAgendamento', sol)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <CalendarCheck size={15} /> Confirmar Agendamento
              </button>
            )}
            {sol.status === 'em_transito' && (
              <button onClick={() => onAction('confirmarEntrega', sol)} className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2">
                <Package2 size={15} /> Confirmar Entrega
              </button>
            )}
            {sol.status === 'entregue' && (
              <button onClick={() => onAction('confirmarRecebimento', sol)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Confirmar Recebimento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row (compact table) ──────────────────────────────────────────────────────

function TrRow({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  const late = isLate(sol)

  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
      isDark ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-orange-500/10' : ''}` : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-orange-50' : ''}`
    }`}>
      <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

      <div className={`w-0.5 h-4 rounded-full shrink-0 ${late ? 'bg-amber-500' : sol.urgente ? 'bg-red-500' : 'bg-transparent'}`} />

      <span className={`text-[11px] font-mono font-bold w-[86px] shrink-0 whitespace-nowrap ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>{sol.numero}</span>

      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>

      <span className={`text-[11px] truncate w-[90px] shrink-0 flex items-center gap-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.obra_nome ? <><Building2 size={9} className="shrink-0" /> {sol.obra_nome}</> : '—'}
      </span>

      <span className={`text-[10px] truncate w-[88px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.motorista_nome || '—'}</span>

      <span className={`text-[11px] font-mono w-[84px] shrink-0 whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.veiculo_placa || '—'}</span>

      <span className={`text-[11px] text-right w-[64px] shrink-0 whitespace-nowrap ${late ? 'text-amber-600 font-bold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {fmtData(sol.transporte?.hora_saida || sol.updated_at)}
      </span>
    </div>
  )
}

// ── Card (full-width, 1 per line) ────────────────────────────────────────────

function TrCard({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  const late = isLate(sol)
  const t = sol.transporte

  return (
    <div onClick={onClick} className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
      isDark
        ? `border-white/[0.06] hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 ${isSelected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.02]'}`
        : `border-slate-200 hover:border-orange-300 hover:shadow-md ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white'}`
    }`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

        {(sol.urgente || late) && (
          <div className={`w-1 h-6 rounded-full shrink-0 ${late ? 'bg-amber-500' : 'bg-red-500'}`} />
        )}

        <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>#{sol.numero}</span>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
          <MapPin size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
          <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>
        </div>

        {late && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">ATRASADO</span>}
        {sol.urgente && !late && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">URGENTE</span>}
      </div>

      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sol.obra_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={9} /> {sol.obra_nome}
            </span>
          )}
          {sol.motorista_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Truck size={9} /> {sol.motorista_nome}
            </span>
          )}
          {sol.veiculo_placa && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.veiculo_placa}
            </span>
          )}
          {t?.eta_atual && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${late ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Clock size={9} /> ETA {fmtDataHora(t.eta_atual)}
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtData(t?.hora_saida || sol.updated_at)}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TransportesPipeline() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StatusTransportePipeline>('nfe_emitida')
  const [busca, setBusca] = useState('')
  const [detail, setDetail] = useState<LogSolicitacao | null>(null)
  const [recebModal, setRecebModal] = useState<LogSolicitacao | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data: solicitacoes = [], isLoading } = useSolicitacoes({
    status: ['nfe_emitida', 'aguardando_coleta', 'em_transito', 'entregue', 'concluido'],
  })
  const confirmarEntrega = useConfirmarEntregaFisica()
  const confirmarAgendamento = useConfirmarAgendamento()
  const confirmarRecebimento = useConfirmarRecebimento()

  // Group by status — for "nfe_emitida" (Pendentes), only show items that actually have NF emitted
  const grouped = useMemo(() => {
    const map = new Map<StatusTransportePipeline, LogSolicitacao[]>()
    for (const s of TRANSPORTE_PIPELINE_STAGES) map.set(s.status, [])
    for (const sol of solicitacoes) {
      // Skip nfe_emitida items that don't actually have a NF (still in Expedição)
      if (sol.status === 'nfe_emitida' && sol.doc_fiscal_tipo !== 'nf') continue
      const arr = map.get(sol.status as StatusTransportePipeline)
      if (arr) arr.push(sol)
    }
    return map
  }, [solicitacoes])

  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(s =>
        s.numero.toLowerCase().includes(q) || s.origem.toLowerCase().includes(q) ||
        s.destino.toLowerCase().includes(q) || s.obra_nome?.toLowerCase().includes(q) ||
        s.motorista_nome?.toLowerCase().includes(q) || s.veiculo_placa?.toLowerCase().includes(q) ||
        s.descricao?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'data':    cmp = (a.updated_at || '').localeCompare(b.updated_at || ''); break
        case 'origem':  cmp = a.origem.localeCompare(b.origem); break
        case 'destino': cmp = a.destino.localeCompare(b.destino); break
        case 'tipo':    cmp = a.tipo.localeCompare(b.tipo); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const showToast = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selectAll = () => { const ids = activeItems.map(s => s.id); setSelectedIds(ids.every(id => selectedIds.has(id)) ? new Set() : new Set(ids)) }
  const toggleSort = (field: SortField) => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const switchTab = (status: StatusTransportePipeline) => { setActiveTab(status); setSelectedIds(new Set()); setBusca('') }

  // Actions
  const handleConfirmarAgendamento = async (ids: string[]) => {
    try {
      for (const id of ids) await confirmarAgendamento.mutateAsync({ id })
      showToast('success', `${ids.length} agendamento(s) confirmado(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar agendamento') }
  }

  const handleConfirmarEntrega = async (ids: string[]) => {
    try {
      for (const id of ids) {
        const sol = solicitacoes.find(s => s.id === id)
        if (sol?.transporte) await confirmarEntrega.mutateAsync({ transporte_id: sol.transporte.id, solicitacao_id: sol.id })
      }
      showToast('success', `${ids.length} entrega(s) confirmada(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar entrega') }
  }

  const handleConfirmarRecebimento = async (data: {
    recebimento_id: string; solicitacao_id: string
    checklist: { quantidades_conferidas: boolean; estado_verificado: boolean; seriais_conferidos: boolean; temperatura_verificada: boolean }
    status: 'confirmado' | 'parcial' | 'recusado'
    divergencias?: string; avaliacao_qualidade?: number
  }) => {
    try {
      await confirmarRecebimento.mutateAsync({
        id: data.recebimento_id,
        solicitacao_id: data.solicitacao_id,
        checklist: data.checklist,
        status: data.status,
        divergencias: data.divergencias,
        avaliacao_qualidade: data.avaliacao_qualidade,
      })
      showToast('success', 'Recebimento confirmado com sucesso')
      setRecebModal(null)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao confirmar recebimento') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    switch (activeTab) {
      case 'nfe_emitida': handleConfirmarAgendamento(ids); break
      case 'em_transito': handleConfirmarEntrega(ids); break
      // For 'entregue', bulk opens the modal for the first selected item
      case 'entregue': {
        const first = solicitacoes.find(s => ids.includes(s.id) && s.status === 'entregue')
        if (first) setRecebModal(first)
        break
      }
    }
  }

  const handleDetailAction = (action: string, sol: LogSolicitacao) => {
    setDetail(null)
    if (action === 'confirmarAgendamento') handleConfirmarAgendamento([sol.id])
    if (action === 'confirmarEntrega') handleConfirmarEntrega([sol.id])
    if (action === 'confirmarRecebimento') setRecebModal(sol)
  }

  const handleExport = () => {
    const stage = TRANSPORTE_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeItems.filter(s => selectedIds.has(s.id)) : activeItems
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  const BULK_ACTIONS: Partial<Record<StatusTransportePipeline, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    nfe_emitida: { label: 'Confirmar Agendamento',  icon: CalendarCheck, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
    em_transito: { label: 'Confirmar Entrega',       icon: Package2,      className: 'bg-teal-600 hover:bg-teal-700 text-white' },
    entregue:    { label: 'Confirmar Recebimento',    icon: CheckCircle2,  className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeItems.filter(s => selectedIds.has(s.id))
  const lateCt = activeItems.filter(s => isLate(s)).length

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Truck size={20} className="text-orange-600" /> Transportes
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {Array.from(grouped.values()).reduce((sum, arr) => sum + arr.length, 0)} no pipeline de transporte
          </p>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TRANSPORTE_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || Truck
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]
          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? isDark
                    ? `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT_DARK[stage.status]?.border} font-bold shadow-sm`
                    : `${accent?.bgActive} ${accent?.textActive} ${STATUS_ACCENT[stage.status]?.border} font-bold shadow-sm`
                  : isDark
                    ? `${accent?.bg} ${accent?.text} font-medium border-transparent`
                    : `${accent?.bg} ${accent?.text} font-medium border-transparent hover:bg-white hover:shadow-sm`
              }`}>
              <Icon size={15} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 flex items-center justify-center ${
                  isActive ? isDark ? `${STATUS_ACCENT_DARK[stage.status]?.badge}` : `${STATUS_ACCENT[stage.status]?.badge}` : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content panel */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>

        {/* Toolbar */}
        <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar número, destino, motorista, placa..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>

          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => (
              <button key={opt.field} onClick={() => toggleSort(opt.field)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  sortField === opt.field ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}>
                {opt.label} {sortField === opt.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </div>

          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Lista"><LayoutList size={14} /></button>
            <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Cards"><LayoutGrid size={14} /></button>
          </div>

          <button onClick={handleExport} disabled={activeItems.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`} title="Exportar CSV"><Download size={13} /> CSV</button>

          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{activeItems.length} transporte(s)</span>
            {lateCt > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-bold">
                <AlertTriangle size={11} /> {lateCt} atrasado{lateCt > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Bulk actions */}
        {activeItems.length > 0 && bulk && (
          <div className={`px-4 py-2 border-b flex items-center gap-3 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={activeItems.length > 0 && activeItems.every(s => selectedIds.has(s.id))} onChange={selectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Todos</span>
            </label>
            {selectedInTab.length > 0 && (
              <button onClick={handleBulkAction} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}>
                <bulk.icon size={12} /> {bulk.label} ({selectedInTab.length})
              </button>
            )}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <Truck size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum transporte nesta etapa</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{busca ? 'Tente outra busca' : 'Os transportes aparecerão aqui quando avançarem'}</p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                <span className="w-3 shrink-0" />
                <span className="w-0.5 shrink-0" />
                <span className="w-[86px] shrink-0">Nº</span>
                <span className="w-[140px] shrink-0">Origem</span>
                <span className="w-3 shrink-0" />
                <span className="w-[140px] shrink-0">Destino</span>
                <span className="w-[90px] shrink-0">Obra</span>
                <span className="w-[88px] shrink-0">Motorista</span>
                <span className="w-[84px] shrink-0">Placa</span>
                <span className="w-[64px] shrink-0 text-right">Data</span>
              </div>
              {activeItems.map(sol => <TrRow key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />)}
            </>
          ) : (
            <div className="space-y-2 p-4">
              {activeItems.map(sol => <TrCard key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />)}
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal sol={detail} onClose={() => setDetail(null)} onAction={handleDetailAction} isDark={isDark} />}
      {recebModal && <RecebimentoModal sol={recebModal} onClose={() => setRecebModal(null)} onConfirm={handleConfirmarRecebimento} isPending={confirmarRecebimento.isPending} isDark={isDark} />}
    </div>
  )
}
