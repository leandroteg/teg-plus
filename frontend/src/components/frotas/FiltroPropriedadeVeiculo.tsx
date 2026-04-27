// ─────────────────────────────────────────────────────────────────────────────
// FiltroPropriedadeVeiculo — pills de filtro Próprio / Locado / Cedido
// ─────────────────────────────────────────────────────────────────────────────
import type { PropriedadeVeiculo } from '../../types/frotas'

interface Props {
  selecionadas: Set<PropriedadeVeiculo>
  onChange: (next: Set<PropriedadeVeiculo>) => void
  /** Contagem opcional por propriedade. */
  contagem?: Record<string, number>
  isLight: boolean
  className?: string
}

const PROP_CFG: Record<PropriedadeVeiculo, { label: string; lightOn: string; lightOff: string; darkOn: string; darkOff: string }> = {
  propria: {
    label: 'Próprio',
    lightOn:  'bg-emerald-500 text-white border-emerald-500',
    lightOff: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    darkOn:   'bg-emerald-500 text-white border-emerald-500',
    darkOff:  'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
  },
  locada: {
    label: 'Locado',
    lightOn:  'bg-amber-500 text-white border-amber-500',
    lightOff: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
    darkOn:   'bg-amber-500 text-white border-amber-500',
    darkOff:  'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20',
  },
  cedida: {
    label: 'Cedido',
    lightOn:  'bg-slate-500 text-white border-slate-500',
    lightOff: 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
    darkOn:   'bg-slate-500 text-white border-slate-500',
    darkOff:  'bg-slate-500/10 text-slate-300 border-slate-500/30 hover:bg-slate-500/20',
  },
}

const ALL: PropriedadeVeiculo[] = ['propria', 'locada', 'cedida']

export default function FiltroPropriedadeVeiculo({
  selecionadas, onChange, contagem, isLight, className = '',
}: Props) {
  function toggle(prop: PropriedadeVeiculo) {
    const next = new Set(selecionadas)
    if (next.has(prop)) next.delete(prop); else next.add(prop)
    onChange(next)
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {ALL.map(p => {
        const cfg = PROP_CFG[p]
        const ativo = selecionadas.has(p)
        const cls = ativo
          ? (isLight ? cfg.lightOn : cfg.darkOn)
          : (isLight ? cfg.lightOff : cfg.darkOff)
        return (
          <button
            key={p}
            onClick={() => toggle(p)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${cls}`}
          >
            {cfg.label}
            {contagem !== undefined && (
              <span className={`text-[10px] font-mono ${ativo ? 'opacity-90' : 'opacity-60'}`}>
                {contagem[p] ?? 0}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
