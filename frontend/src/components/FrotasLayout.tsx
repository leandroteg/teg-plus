import {
  LayoutDashboard, Truck, Wrench, Gauge, Plus,
  Loader2, WifiOff, CloudUpload, CheckCircle2, AlertTriangle, X,
  Car, Building2, CalendarDays, User, FileText,
} from 'lucide-react'
import { useState } from 'react'
import ModuleLayout from './ModuleLayout'
import { useFrotasChecklistSync } from '../hooks/useFrotasChecklistSync'
import { useVeiculos } from '../hooks/useFrotas'
import { useTheme } from '../contexts/ThemeContext'

// ── Sync Banner ─────────────────────────────────────────────────────────────

function FrotasChecklistSyncBanner() {
  const { isOnline, syncing, pendingCount, lastResults, syncAll } = useFrotasChecklistSync()
  const { isDark } = useTheme()
  const [dismissed, setDismissed] = useState(false)

  if (pendingCount === 0 && lastResults.length === 0) return null
  if (dismissed && !syncing && pendingCount === 0) return null

  if (syncing) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-rose-500/15 text-rose-300 border-b border-rose-500/20'
               : 'bg-rose-50 text-rose-700 border-b border-rose-200'
      }`}>
        <Loader2 size={16} className="animate-spin shrink-0" />
        <span>Sincronizando checklists de frotas...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isOnline
          ? isDark ? 'bg-amber-500/15 text-amber-300 border-b border-amber-500/20'
                   : 'bg-amber-50 text-amber-700 border-b border-amber-200'
          : isDark ? 'bg-slate-500/15 text-slate-300 border-b border-slate-500/20'
                   : 'bg-slate-100 text-slate-600 border-b border-slate-200'
      }`}>
        {isOnline ? <CloudUpload size={16} className="shrink-0" /> : <WifiOff size={16} className="shrink-0" />}
        <span className="flex-1">
          {pendingCount} checklist(s) pendente(s) de sincronização
          {!isOnline && ' — aguardando conexão'}
        </span>
        {isOnline && (
          <button onClick={() => syncAll()}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              isDark ? 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-200'
                     : 'bg-amber-200 hover:bg-amber-300 text-amber-800'
            }`}>
            Sincronizar agora
          </button>
        )}
      </div>
    )
  }

  const allOk = lastResults.length > 0 && lastResults.every(r => r.success)
  const hasErrors = lastResults.some(r => !r.success)

  if (allOk) {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/20'
               : 'bg-emerald-50 text-emerald-700 border-b border-emerald-200'
      }`}>
        <CheckCircle2 size={16} className="shrink-0" />
        <span className="flex-1">{lastResults.length} checklist(s) sincronizado(s) com sucesso!</span>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
      </div>
    )
  }

  if (hasErrors) {
    const failCount = lastResults.filter(r => !r.success).length
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold ${
        isDark ? 'bg-red-500/15 text-red-300 border-b border-red-500/20'
               : 'bg-red-50 text-red-700 border-b border-red-200'
      }`}>
        <AlertTriangle size={16} className="shrink-0" />
        <span className="flex-1">{failCount} checklist(s) falharam ao sincronizar</span>
        <button onClick={() => syncAll()}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
            isDark ? 'bg-red-500/30 hover:bg-red-500/50 text-red-200'
                   : 'bg-red-200 hover:bg-red-300 text-red-800'
          }`}>
          Tentar novamente
        </button>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
      </div>
    )
  }

  return null
}

// ── Nova Solicitacao Modal ──────────────────────────────────────────────────

type TipoSolicitacao = 'emprestimo' | 'manutencao'

const TIPO_OPTS: { value: TipoSolicitacao; label: string; desc: string; icon: typeof Car }[] = [
  { value: 'emprestimo',  label: 'Emprestimo de Ativo',       desc: 'Solicitar veiculo ou maquina para obra / CC', icon: Car },
  { value: 'manutencao',  label: 'Solicitacao de Manutencao', desc: 'Reportar problema ou agendar revisao',        icon: Wrench },
]

function NovaSolicitacaoFrotasModal({ onClose }: { onClose: () => void }) {
  const { isDark } = useTheme()
  const isLight = !isDark
  const { data: veiculos = [] } = useVeiculos()
  const [tipo, setTipo] = useState<TipoSolicitacao>('emprestimo')
  const [veiculoId, setVeiculoId] = useState('')
  const [destino, setDestino] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [obs, setObs] = useState('')
  const [success, setSuccess] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const inp = `w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors ${
    isDark
      ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder-slate-500 focus:border-rose-500'
      : 'bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-rose-400'
  }`
  const lbl = `text-xs font-semibold block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className={`rounded-2xl shadow-2xl w-full max-w-md p-6 text-center ${bg}`} onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>Solicitacao Registrada!</h3>
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {tipo === 'emprestimo' ? 'Emprestimo de ativo solicitado' : 'Solicitacao de manutencao registrada'}
          </p>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700">Fechar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={e => e.stopPropagation()}
        className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'} ${bg}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 rounded-t-2xl ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'}`}>
          <h2 className={`text-base font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Plus size={16} className="text-rose-500" /> Nova Solicitacao
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {TIPO_OPTS.map(opt => {
              const Icon = opt.icon
              const active = tipo === opt.value
              return (
                <button key={opt.value} type="button" onClick={() => setTipo(opt.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    active
                      ? (isLight ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-500/10 border-rose-500/40 text-rose-300')
                      : (isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/[0.03] border-white/[0.06] text-slate-300')
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    active ? (isLight ? 'bg-rose-100' : 'bg-rose-500/20') : (isLight ? 'bg-slate-100' : 'bg-white/[0.06]')
                  }`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Ativo */}
          {tipo === 'emprestimo' && (
            <div>
              <label className={lbl}><Car size={11} className="inline mr-1" />Ativo Solicitado</label>
              <select value={veiculoId} onChange={e => setVeiculoId(e.target.value)} className={inp}>
                <option value="">Selecionar ativo...</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
              </select>
            </div>
          )}

          {/* Destino */}
          <div>
            <label className={lbl}><Building2 size={11} className="inline mr-1" />Obra / Centro de Custo</label>
            <input value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex: Obra Campo Belo, CC-012..." className={inp} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}><CalendarDays size={11} className="inline mr-1" />Data de Inicio</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}><CalendarDays size={11} className="inline mr-1" />Retorno Previsto</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Responsavel */}
          <div>
            <label className={lbl}><User size={11} className="inline mr-1" />Responsavel</label>
            <input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsavel..." className={inp} />
          </div>

          {/* Obs */}
          <div>
            <label className={lbl}><FileText size={11} className="inline mr-1" />Observacoes</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder={tipo === 'manutencao' ? 'Descreva o problema...' : 'Finalidade, observacoes...'} className={`${inp} resize-none`} />
          </div>
        </div>

        <div className={`px-5 py-4 border-t flex gap-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button type="button" onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
            Cancelar
          </button>
          <button type="submit"
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm text-white font-bold transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> Enviar Solicitacao
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Layout ──────────────────────────────────────────────────────────────────

export default function FrotasLayout() {
  const [showModal, setShowModal] = useState(false)

  const NAV = [
    { to: '/frotas',                   icon: LayoutDashboard, label: 'Painel',              end: true },
    { to: '/frotas',                   icon: Plus,            label: 'Nova Solicitação', requisitanteAllowed: true, accent: true, action: () => setShowModal(true) },
    { to: '/frotas/frota',             icon: Truck,           label: 'Frota & Máquinas'               },
    { to: '/frotas/manutencao',        icon: Wrench,          label: 'Manutenção'                     },
    { to: '/frotas/operacao',          icon: Gauge,           label: 'Operação & Controle'            },
  ]

  return (
    <>
      <FrotasChecklistSyncBanner />
      <ModuleLayout
        moduleKey="frotas"
        moduleName="Frotas"
        moduleEmoji="🚗"
        accent="rose"
        nav={NAV}
        moduleSubtitle="Veículos & Máquinas"
        bottomNavMaxItems={5}
        truncateBottomLabels
      />
      {showModal && <NovaSolicitacaoFrotasModal onClose={() => setShowModal(false)} />}
    </>
  )
}
