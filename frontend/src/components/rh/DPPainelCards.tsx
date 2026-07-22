// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPPainelCards.tsx — cards do padrão do Painel DP, compartilhados
// entre as visões Ponto (DPPainel) e Folha (DPFolhaPainel).
// ─────────────────────────────────────────────────────────────────────────────
import type { LucideIcon } from 'lucide-react'

export function SpotlightMetric({ label, value, tone, note, isDark, aside, asideTitle }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean; aside?: string; asideTitle?: string
}) {
  const tones: Record<string, string> = {
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none flex items-baseline gap-1.5 ${tones[tone] || tones.slate}`}>
        <span>{value}</span>
        {aside && <span title={asideTitle} className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-200/70 text-slate-600'}`}>{aside}</span>}
      </p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

export function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: LucideIcon; iconTone: string; isDark: boolean
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
