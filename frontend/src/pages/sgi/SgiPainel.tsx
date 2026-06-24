import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileText, RefreshCw, AlertTriangle, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSgiKPIs, useDocumentos } from '../../hooks/useSgi'
import { STATUS_DOC_LABEL, TIPO_DOC_LABEL } from '../../types/sgi'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    violet:  isDark ? 'text-violet-400'  : 'text-violet-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    sky:     isDark ? 'text-sky-400'     : 'text-sky-600',
    slate:   isDark ? 'text-slate-400'   : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof FileText; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

export default function SgiPainel() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const { data: kpis, isLoading, refetch } = useSgiKPIs()
  const { data: documentos = [] } = useDocumentos()

  const cardClass = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'

  const recentes = useMemo(() => [...documentos].slice(0, 6), [documentos])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <ClipboardCheck size={22} className="text-violet-500" /> SGI · Gestão
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Sistema de Gestão Integrada — governança, documentos e melhoria</p>
        </div>
        <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Padronização</p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>Documentos do SGI</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <FileText size={18} className="text-violet-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Total" value={kpis?.total ?? 0} tone="violet" note="documentos" isDark={isDark} />
              <SpotlightMetric label="Vigentes" value={kpis?.vigentes ?? 0} tone="emerald" note="políticas e processos" isDark={isDark} />
              <SpotlightMetric label="Em fluxo" value={kpis?.emFluxo ?? 0} tone="sky" note="rascunho/revisão/aprovação" isDark={isDark} />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Crítica</p>
                <h2 className={`mt-0.5 text-sm font-black ${txt}`}>Revisões</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(kpis?.revisaoVencida ?? 0) > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={(kpis?.revisaoVencida ?? 0) > 0 || (kpis?.revisaoVencendo ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <MiniInfoCard label="Revisão vencendo" value={kpis?.revisaoVencendo ?? 0} note="próximos 30 dias" icon={Clock} iconTone={(kpis?.revisaoVencendo ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'} isDark={isDark} />
              <MiniInfoCard label="Revisão vencida" value={kpis?.revisaoVencida ?? 0} note="documentos vigentes" icon={AlertTriangle} iconTone={(kpis?.revisaoVencida ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'} isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      <div className={`rounded-2xl border p-4 ${bg}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-sm font-bold ${txt}`}>Documentos recentes</p>
          <button onClick={() => nav('/sgi/padronizacao')} className="text-xs text-violet-500 hover:text-violet-600 font-semibold flex items-center gap-1">Ver Padronização <ArrowRight size={12} /></button>
        </div>
        {recentes.length === 0 ? (
          <p className={`text-xs ${txtMuted}`}>Nenhum documento cadastrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentes.map(doc => {
              const st = STATUS_DOC_LABEL[doc.status]
              return (
                <div key={doc.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs font-medium truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {doc.codigo ? `${doc.codigo} · ` : ''}{doc.titulo}
                    </span>
                    <p className={`text-[10px] ${txtMuted}`}>{TIPO_DOC_LABEL[doc.tipo]} · v{doc.versao} · atualizado {fmtDate(doc.updated_at?.split('T')[0])}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
