import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ClipboardList, Search, X, CheckCircle2, Clock, AlertTriangle,
  Calendar, ArrowUp, ArrowDown, LayoutList, LayoutGrid, Download,
  MapPin, Package2, Truck, FileText, Building2, Tag, Briefcase,
  ShieldCheck, Plus, Save, Loader2, Trash2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useSolicitacoes, useAtualizarStatusSolicitacao,
  useAprovarSolicitacao, usePlanejaarSolicitacao,
  useEnviarParaAprovacao, useCriarSolicitacao,
  useRotas,
} from '../../hooks/useLogistica'
import { useSearchParams } from 'react-router-dom'
import { useLookupObras, useLookupCentrosCusto } from '../../hooks/useLookups'
import type { LogSolicitacao, StatusSolicitacaoPipeline, CriarSolicitacaoPayload, TipoTransporte } from '../../types/logistica'
import { SOLICITACAO_PIPELINE_STAGES } from '../../types/logistica'

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtData = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

const fmtDataFull = (d?: string) =>
  d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

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
  viagem:                 'Viagem',
  mobilizacao:            'Mobilização',
  transferencia_material: 'Transf. Material',
  transferencia_maquina:  'Transf. Máquina',
}

// ── Status accents ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, typeof ClipboardList> = {
  solicitado:           ClipboardList,
  planejado:            Calendar,
  aguardando_aprovacao: ShieldCheck,
}

const STATUS_ACCENT: Record<string, { bg: string; bgActive: string; text: string; textActive: string; dot: string; border: string }> = {
  solicitado:           { bg: 'hover:bg-slate-50',   bgActive: 'bg-slate-100',   text: 'text-slate-600',  textActive: 'text-slate-800',  dot: 'bg-slate-400',  border: 'border-slate-400' },
  planejado:            { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',   text: 'text-violet-600', textActive: 'text-violet-800', dot: 'bg-violet-500', border: 'border-violet-500' },
  aguardando_aprovacao: { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',    text: 'text-amber-600',  textActive: 'text-amber-800',  dot: 'bg-amber-500',  border: 'border-amber-500' },
}

const STATUS_ACCENT_DARK: Record<string, { bg: string; bgActive: string; text: string; textActive: string }> = {
  solicitado:           { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-slate-500/10',  text: 'text-slate-400',  textActive: 'text-slate-200' },
  planejado:            { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10', text: 'text-violet-400', textActive: 'text-violet-300' },
  aguardando_aprovacao: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',  text: 'text-amber-400',  textActive: 'text-amber-300' },
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(items: LogSolicitacao[], stageName: string) {
  const headers = ['Número', 'Tipo', 'Origem', 'Destino', 'Obra', 'Urgente', 'Solicitante', 'Data Desejada', 'Descrição', 'Status']
  const rows = items.map(s => [
    s.numero, TIPO_LABEL[s.tipo] || s.tipo, s.origem, s.destino,
    s.obra_nome || '', s.urgente ? 'Sim' : 'Não', s.solicitante_nome || '',
    fmtDataFull(s.data_desejada), s.descricao || '', s.status,
  ])
  const bom = '\uFEFF'
  const csv = bom + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `solicitacoes-${stageName.replace(/\s/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ sol, onClose, onAction, isDark }: {
  sol: LogSolicitacao; onClose: () => void
  onAction: (action: string, sol: LogSolicitacao) => void; isDark: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList size={18} className="text-orange-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>#{sol.numero}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>
              {TIPO_LABEL[sol.tipo] || sol.tipo}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            {sol.urgente && (
              <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} /> URGENTE
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ml-auto ${STATUS_ACCENT[sol.status]?.bgActive || 'bg-slate-100'} ${STATUS_ACCENT[sol.status]?.textActive || 'text-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_ACCENT[sol.status]?.dot || 'bg-slate-400'}`} />
              {SOLICITACAO_PIPELINE_STAGES.find(s => s.status === sol.status)?.label ?? sol.status}
            </span>
          </div>

          <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><span className="text-slate-400">Origem:</span> <span className="font-semibold">{sol.origem}</span></div>
              <div><span className="text-slate-400">Destino:</span> <span className="font-semibold">{sol.destino}</span></div>
              {sol.obra_nome && <div><span className="text-slate-400">Obra:</span> <span className="font-semibold">{sol.obra_nome}</span></div>}
              {sol.centro_custo && <div><span className="text-slate-400">Centro Custo:</span> <span className="font-semibold">{sol.centro_custo}</span></div>}
              {sol.solicitante_nome && <div><span className="text-slate-400">Solicitante:</span> <span className="font-semibold">{sol.solicitante_nome}</span></div>}
              {sol.data_desejada && <div><span className="text-slate-400">Data Desejada:</span> <span className="font-semibold">{fmtData(sol.data_desejada)}</span></div>}
              {sol.modal && <div><span className="text-slate-400">Modal:</span> <span className="font-semibold capitalize">{sol.modal.replace(/_/g, ' ')}</span></div>}
              {sol.motorista_nome && <div><span className="text-slate-400">Motorista:</span> <span className="font-semibold">{sol.motorista_nome}</span></div>}
              {sol.veiculo_placa && <div><span className="text-slate-400">Placa:</span> <span className="font-mono font-semibold">{sol.veiculo_placa}</span></div>}
              {sol.custo_estimado != null && <div><span className="text-slate-400">Custo Est.:</span> <span className="font-semibold text-emerald-600">R$ {sol.custo_estimado.toFixed(2)}</span></div>}
            </div>
            {sol.descricao && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{sol.descricao}</p>}
          </div>

          {/* Progress */}
          <div className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Progresso</p>
            <div className="flex items-center gap-0.5">
              {SOLICITACAO_PIPELINE_STAGES.map((s, i) => {
                const currentIdx = SOLICITACAO_PIPELINE_STAGES.findIndex(st => st.status === sol.status)
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
            {sol.status === 'solicitado' && (
              <button onClick={() => onAction('planejar', sol)} className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                <Calendar size={15} /> Planejar
              </button>
            )}
            {sol.status === 'planejado' && (
              <button onClick={() => onAction('enviarAprovacao', sol)} className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2">
                <ShieldCheck size={15} /> Enviar p/ Aprovação
              </button>
            )}
            {sol.status === 'aguardando_aprovacao' && (
              <button onClick={() => onAction('aprovar', sol)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={15} /> Aprovar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Row (compact table row) ──────────────────────────────────────────────────

function SolRow({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 border-b cursor-pointer transition-all ${
      isDark ? `border-white/[0.04] hover:bg-white/[0.03] ${isSelected ? 'bg-orange-500/10' : ''}` : `border-slate-100 hover:bg-slate-50 ${isSelected ? 'bg-orange-50' : ''}`
    }`}>
      <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
        className="w-3 h-3 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

      {sol.urgente && <AlertTriangle size={11} className="text-red-500 shrink-0" />}
      {!sol.urgente && <div className="w-[11px] shrink-0" />}

      <span className={`text-[11px] font-mono font-bold w-[60px] shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
        {sol.numero}
      </span>

      <span className={`text-[10px] px-1.5 py-0.5 rounded-md w-[90px] shrink-0 text-center font-medium ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
        {TIPO_LABEL[sol.tipo] || sol.tipo}
      </span>

      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {sol.origem}
      </span>

      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>

      <span className={`text-xs truncate w-[140px] shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {sol.destino}
      </span>

      <span className={`text-[11px] truncate w-[100px] shrink-0 flex items-center gap-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {sol.obra_nome ? <><Building2 size={9} className="shrink-0" /> {sol.obra_nome}</> : '—'}
      </span>

      <span className={`text-[11px] text-right w-[62px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {fmtData(sol.data_desejada || sol.criado_em)}
      </span>
    </div>
  )
}

// ── Card (full-width, 1 per line) ────────────────────────────────────────────

function SolCard({ sol, onClick, isDark, isSelected, onSelect }: {
  sol: LogSolicitacao; onClick: () => void; isDark: boolean; isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div onClick={onClick} className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
      isDark
        ? `border-white/[0.06] hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5 ${isSelected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/[0.02]'}`
        : `border-slate-200 hover:border-orange-300 hover:shadow-md ${isSelected ? 'bg-orange-50 border-orange-300' : 'bg-white'}`
    }`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={isSelected} onChange={e => { e.stopPropagation(); onSelect(sol.id) }} onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0" />

        {sol.urgente && <AlertTriangle size={13} className="text-red-500 shrink-0" />}

        <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>#{sol.numero}</span>

        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
          {TIPO_LABEL[sol.tipo] || sol.tipo}
        </span>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-sm">
          <MapPin size={12} className={`shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.origem}</span>
          <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} shrink-0`}>→</span>
          <span className={`font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{sol.destino}</span>
        </div>

        {sol.urgente && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">URGENTE</span>}
      </div>

      {sol.descricao && (
        <p className={`text-xs truncate mt-1.5 ml-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sol.descricao}</p>
      )}

      <div className="flex items-center justify-between mt-2 ml-10">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sol.obra_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Building2 size={9} /> {sol.obra_nome}
            </span>
          )}
          {sol.centro_custo && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <Briefcase size={9} /> {sol.centro_custo}
            </span>
          )}
          {sol.solicitante_nome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              {sol.solicitante_nome}
            </span>
          )}
        </div>
        <span className={`text-[11px] flex items-center gap-1 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Calendar size={10} /> {fmtData(sol.data_desejada || sol.criado_em)}
        </span>
      </div>
    </div>
  )
}

// ── Nova Solicitação Modal ───────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoTransporte, string> = {
  viagem:                  'Viagem',
  mobilizacao:             'Mobilização',
  transferencia_material:  'Transf. Material',
  transferencia_maquina:   'Transf. Máquina',
}

const EMPTY_FORM: CriarSolicitacaoPayload = {
  tipo: 'transferencia_material',
  origem: '',
  destino: '',
  descricao: '',
  urgente: false,
}

function NovaSolicitacaoModal({ isDark, onClose, onSuccess }: {
  isDark: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState<CriarSolicitacaoPayload>({ ...EMPTY_FORM })
  const [itensForm, setItensForm] = useState<{ descricao: string; quantidade: number; unidade: string; peso_kg?: number; volume_m3?: number }[]>([])
  const criar = useCriarSolicitacao()
  const obras = useLookupObras()
  const centrosCusto = useLookupCentrosCusto()
  const { data: rotas = [] } = useRotas()

  const set = (k: keyof CriarSolicitacaoPayload, v: any) => setForm(p => ({ ...p, [k]: v }))

  const canSubmit = form.origem.trim().length > 0 && form.destino.trim().length > 0

  async function handleCriar() {
    if (!canSubmit) return
    await criar.mutateAsync({ ...form, itens: itensForm.length > 0 ? itensForm : undefined })
    onSuccess()
    onClose()
  }

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-orange-500/50'
      : 'bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-orange-500'
  }`
  const labelCls = `block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 sticky top-0 z-10 ${isDark ? 'border-b border-white/[0.06] bg-[#1e293b]' : 'border-b border-slate-100 bg-white'}`}>
          <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nova Solicitação</h2>
          <button onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inputCls}>
                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rota Padrão</label>
              <select onChange={e => {
                const r = rotas.find(r => r.id === e.target.value)
                setForm(p => ({ ...p, origem: r?.origem ?? p.origem, destino: r?.destino ?? p.destino }))
              }} className={inputCls}>
                <option value="">Selecionar rota...</option>
                {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Origem *</label>
              <input value={form.origem} onChange={e => set('origem', e.target.value)}
                className={inputCls} placeholder="Cidade / Depósito" />
            </div>
            <div>
              <label className={labelCls}>Destino *</label>
              <input value={form.destino} onChange={e => set('destino', e.target.value)}
                className={inputCls} placeholder="Obra / Cidade" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Obra / Projeto</label>
              <select value={form.obra_nome ?? ''} onChange={e => set('obra_nome', e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {obras.map(o => (
                  <option key={o.id} value={o.nome}>{o.codigo} - {o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Centro de Custo</label>
              <select value={form.centro_custo ?? ''} onChange={e => set('centro_custo', e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {centrosCusto.map(cc => (
                  <option key={cc.id} value={cc.codigo}>{cc.codigo} - {cc.descricao}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>OC Vinculada</label>
              <input value={form.oc_numero ?? ''} onChange={e => set('oc_numero', e.target.value)}
                className={inputCls} placeholder="OC-2026-0001" />
            </div>
            <div>
              <label className={labelCls}>Data Desejada</label>
              <input type="date" value={form.data_desejada ?? ''} onChange={e => set('data_desejada', e.target.value)}
                className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descrição da Carga</label>
            <textarea value={form.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              rows={2} className={`${inputCls} resize-none`} placeholder="Lista de materiais, equipamentos..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Peso Total (kg)</label>
              <input type="number" min={0} value={form.peso_total_kg ?? ''}
                onChange={e => set('peso_total_kg', e.target.value ? Number(e.target.value) : undefined)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>N° de Volumes</label>
              <input type="number" min={0} value={form.volumes_total ?? ''}
                onChange={e => set('volumes_total', e.target.value ? Number(e.target.value) : undefined)}
                className={inputCls} />
            </div>
          </div>

          {/* Itens da Carga */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Itens da Carga</label>
              <button type="button"
                onClick={() => setItensForm(p => [...p, { descricao: '', quantidade: 1, unidade: 'un' }])}
                className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 hover:text-orange-700">
                <Plus size={10} /> Adicionar Item
              </button>
            </div>
            {itensForm.length > 0 ? (
              <div className="space-y-2">
                {itensForm.map((item, idx) => (
                  <div key={idx} className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className="flex gap-2 mb-2">
                      <input value={item.descricao}
                        onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                        placeholder="Descrição do item *" className={`${inputCls} flex-1 text-xs`} />
                      <button onClick={() => setItensForm(p => p.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600 shrink-0 p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" min={1} value={item.quantidade}
                        onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, quantidade: Number(e.target.value) } : it))}
                        placeholder="Qtd" className={`${inputCls} text-xs`} />
                      <select value={item.unidade}
                        onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, unidade: e.target.value } : it))}
                        className={`${inputCls} text-xs`}>
                        {['un','pç','kg','m','m²','m³','L','cx','rl','pct','bd','tb'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <input type="number" min={0} step={0.1} value={item.peso_kg ?? ''}
                        onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, peso_kg: e.target.value ? Number(e.target.value) : undefined } : it))}
                        placeholder="Peso" className={`${inputCls} text-xs`} />
                      <input type="number" min={0} step={0.01} value={item.volume_m3 ?? ''}
                        onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, volume_m3: e.target.value ? Number(e.target.value) : undefined } : it))}
                        placeholder="Vol" className={`${inputCls} text-xs`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-xl px-4 py-3 text-center ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                <Package2 size={16} className={`mx-auto mb-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item adicionado (opcional)</p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.urgente ?? false} onChange={e => set('urgente', e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Urgente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.carga_especial ?? false} onChange={e => set('carga_especial', e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Carga Especial</span>
            </label>
          </div>

          {form.urgente && (
            <div>
              <label className={labelCls}>Justificativa da Urgência *</label>
              <textarea value={form.justificativa_urgencia ?? ''} onChange={e => set('justificativa_urgencia', e.target.value)}
                rows={2} className={`${inputCls} resize-none`} placeholder="Motivo da urgência..." />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Cancelar
          </button>
          <button onClick={handleCriar} disabled={criar.isPending || !canSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {criar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Criar Solicitação
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SolicitacoesPipeline() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<StatusSolicitacaoPipeline>('solicitado')
  const [busca, setBusca] = useState('')
  const [detail, setDetail] = useState<LogSolicitacao | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [sortField, setSortField] = useState<SortField>('data')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showNovaSolicitacao, setShowNovaSolicitacao] = useState(false)

  // Abrir modal via ?nova=1 (clique no sidebar)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setShowNovaSolicitacao(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: solicitacoes = [], isLoading } = useSolicitacoes()
  const atualizarStatus = useAtualizarStatusSolicitacao()
  const aprovar = useAprovarSolicitacao()
  const enviarParaAprovacao = useEnviarParaAprovacao()

  // Group by status
  const grouped = useMemo(() => {
    const map = new Map<StatusSolicitacaoPipeline, LogSolicitacao[]>()
    for (const s of SOLICITACAO_PIPELINE_STAGES) map.set(s.status, [])
    for (const sol of solicitacoes) {
      const arr = map.get(sol.status as StatusSolicitacaoPipeline)
      if (arr) arr.push(sol)
    }
    return map
  }, [solicitacoes])

  // Filter + sort active tab
  const activeItems = useMemo(() => {
    let items = [...(grouped.get(activeTab) || [])]
    if (busca) {
      const q = busca.toLowerCase()
      items = items.filter(s =>
        s.numero.toLowerCase().includes(q) || s.origem.toLowerCase().includes(q) ||
        s.destino.toLowerCase().includes(q) || s.obra_nome?.toLowerCase().includes(q) ||
        s.descricao?.toLowerCase().includes(q) || s.solicitante_nome?.toLowerCase().includes(q) ||
        s.centro_custo?.toLowerCase().includes(q)
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'data':    cmp = (a.criado_em || '').localeCompare(b.criado_em || ''); break
        case 'origem':  cmp = a.origem.localeCompare(b.origem); break
        case 'destino': cmp = a.destino.localeCompare(b.destino); break
        case 'tipo':    cmp = a.tipo.localeCompare(b.tipo); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [grouped, activeTab, busca, sortField, sortDir])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  const selectAll = () => {
    const ids = activeItems.map(s => s.id)
    const all = ids.length > 0 && ids.every(id => selectedIds.has(id))
    setSelectedIds(all ? new Set() : new Set(ids))
  }
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  const switchTab = (status: StatusSolicitacaoPipeline) => { setActiveTab(status); setSelectedIds(new Set()); setBusca('') }

  // Actions
  const handlePlanejar = async (ids: string[]) => {
    try {
      for (const id of ids) await atualizarStatus.mutateAsync({ id, status: 'planejado' })
      showToast('success', `${ids.length} solicitação(ões) planejada(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao planejar') }
  }

  const handleEnviarAprovacao = async (ids: string[]) => {
    try {
      for (const id of ids) await enviarParaAprovacao.mutateAsync({ id })
      showToast('success', `${ids.length} enviada(s) para aprovação`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao enviar para aprovação') }
  }

  const handleAprovar = async (ids: string[]) => {
    try {
      for (const id of ids) await aprovar.mutateAsync({ id, aprovado: true })
      showToast('success', `${ids.length} solicitação(ões) aprovada(s)`)
      setSelectedIds(new Set())
    } catch { showToast('error', 'Erro ao aprovar') }
  }

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    switch (activeTab) {
      case 'solicitado': handlePlanejar(ids); break
      case 'planejado': handleEnviarAprovacao(ids); break
      case 'aguardando_aprovacao': handleAprovar(ids); break
    }
  }

  const handleDetailAction = (action: string, sol: LogSolicitacao) => {
    setDetail(null)
    switch (action) {
      case 'planejar': handlePlanejar([sol.id]); break
      case 'enviarAprovacao': handleEnviarAprovacao([sol.id]); break
      case 'aprovar': handleAprovar([sol.id]); break
    }
  }

  const handleExport = () => {
    const stage = SOLICITACAO_PIPELINE_STAGES.find(s => s.status === activeTab)
    const toExport = selectedIds.size > 0 ? activeItems.filter(s => selectedIds.has(s.id)) : activeItems
    exportCSV(toExport, stage?.label || activeTab)
    showToast('success', `${toExport.length} registro(s) exportado(s)`)
  }

  const BULK_ACTIONS: Partial<Record<StatusSolicitacaoPipeline, { label: string; icon: typeof CheckCircle2; className: string }>> = {
    solicitado:           { label: 'Planejar',              icon: Calendar,     className: 'bg-violet-600 hover:bg-violet-700 text-white' },
    planejado:            { label: 'Enviar p/ Aprovação',   icon: ShieldCheck,  className: 'bg-amber-600 hover:bg-amber-700 text-white' },
    aguardando_aprovacao: { label: 'Aprovar',               icon: CheckCircle2, className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  }
  const bulk = BULK_ACTIONS[activeTab]
  const selectedInTab = activeItems.filter(s => selectedIds.has(s.id))
  const urgentCt = activeItems.filter(s => s.urgente).length

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
            <ClipboardList size={20} className="text-orange-600" /> Solicitações
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {solicitacoes.filter(s => ['solicitado','planejado','aguardando_aprovacao'].includes(s.status)).length} solicitações no pipeline
          </p>
        </div>
        <button onClick={() => setShowNovaSolicitacao(true)}
          className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Solicitação
        </button>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar pb-0.5">
        {SOLICITACAO_PIPELINE_STAGES.map(stage => {
          const count = grouped.get(stage.status)?.length || 0
          const isActive = activeTab === stage.status
          const Icon = STATUS_ICONS[stage.status] || ClipboardList
          const accent = isDark ? STATUS_ACCENT_DARK[stage.status] : STATUS_ACCENT[stage.status]
          return (
            <button key={stage.status} onClick={() => switchTab(stage.status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? `${accent?.bgActive} ${accent?.textActive} font-bold shadow-sm ${!isDark ? `ring-1 ${STATUS_ACCENT[stage.status]?.border?.replace('border-', 'ring-')}` : ''}`
                  : `${accent?.bg} ${accent?.text} font-medium`
              }`}>
              <Icon size={13} className="shrink-0" />
              {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                  isActive ? isDark ? 'bg-white/10 text-white' : `${STATUS_ACCENT[stage.status]?.dot} text-white` : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
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
              placeholder="Buscar número, origem, destino, obra..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'
              }`} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
          </div>

          <div className="flex items-center gap-0.5">
            {SORT_OPTIONS.map(opt => {
              const isAct = sortField === opt.field
              return (
                <button key={opt.field} onClick={() => toggleSort(opt.field)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    isAct ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                    : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}>
                  {opt.label} {isAct && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              )
            })}
          </div>

          <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setViewMode('list')} className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Lista">
              <LayoutList size={14} />
            </button>
            <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`} title="Cards">
              <LayoutGrid size={14} />
            </button>
          </div>

          <button onClick={handleExport} disabled={activeItems.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30'
            }`} title="Exportar CSV">
            <Download size={13} /> CSV
          </button>

          <div className={`ml-auto flex items-center gap-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{activeItems.length} solicitação(ões)</span>
            {urgentCt > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-bold">
                <AlertTriangle size={11} /> {urgentCt} urgente{urgentCt > 1 ? 's' : ''}
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
              <>
                <button onClick={handleBulkAction} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${bulk.className}`}>
                  <bulk.icon size={12} /> {bulk.label} ({selectedInTab.length})
                </button>
              </>
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
                <ClipboardList size={24} className="text-slate-300" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma solicitação nesta etapa</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{busca ? 'Tente outra busca' : 'As solicitações aparecerão aqui quando avançarem'}</p>
            </div>
          ) : viewMode === 'list' ? (
            <>
              <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                <span className="w-3 shrink-0" />
                <span className="w-[11px] shrink-0" />
                <span className="w-[60px] shrink-0">Nº</span>
                <span className="w-[90px] shrink-0 text-center">Tipo</span>
                <span className="w-[140px] shrink-0">Origem</span>
                <span className="w-3 shrink-0" />
                <span className="w-[140px] shrink-0">Destino</span>
                <span className="w-[100px] shrink-0">Obra</span>
                <span className="w-[62px] shrink-0 text-right">Data</span>
              </div>
              {activeItems.map(sol => (
                <SolRow key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />
              ))}
            </>
          ) : (
            <div className="p-3 space-y-2">
              {activeItems.map(sol => (
                <SolCard key={sol.id} sol={sol} onClick={() => setDetail(sol)} isDark={isDark} isSelected={selectedIds.has(sol.id)} onSelect={toggleSelect} />
              ))}
            </div>
          )}
        </div>
      </div>

      {detail && <DetailModal sol={detail} onClose={() => setDetail(null)} onAction={handleDetailAction} isDark={isDark} />}
      {showNovaSolicitacao && (
        <NovaSolicitacaoModal
          isDark={isDark}
          onClose={() => setShowNovaSolicitacao(false)}
          onSuccess={() => showToast('success', 'Solicitação criada com sucesso!')}
        />
      )}
    </div>
  )
}
