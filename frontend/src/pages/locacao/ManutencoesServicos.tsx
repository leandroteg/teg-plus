// ─────────────────────────────────────────────────────────────────────────────
// ManutencoesServicos — hub da aba, no mesmo desenho do módulo de Frotas:
// uma faixa de sub-abas (OS · Histórico · Limpeza) e, dentro de OS, o pipeline
// de seis etapas com lista/cards/quadro.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wrench, History, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSolicitacoesLocacao, useLimpezas } from '../../hooks/useLocacao'
import SolicitacoesPipeline from './solicitacoes/SolicitacoesPipeline'
import SolicitacoesHistorico from './solicitacoes/SolicitacoesHistorico'
import LimpezasPanel from './solicitacoes/LimpezasPanel'

type SubTab = 'os' | 'historico' | 'limpeza'

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'os',        label: 'OS',        icon: Wrench },
  { key: 'historico', label: 'Histórico', icon: History },
  { key: 'limpeza',   label: 'Limpeza',   icon: Sparkles },
]

const ACCENT: Record<SubTab, { bg: string; bgActive: string; text: string; textActive: string; border: string }> = {
  os:        { bg:'hover:bg-rose-50',    bgActive:'bg-rose-50',    text:'text-rose-600',    textActive:'text-rose-800',    border:'border-rose-500' },
  historico: { bg:'hover:bg-emerald-50', bgActive:'bg-emerald-50', text:'text-emerald-600', textActive:'text-emerald-800', border:'border-emerald-500' },
  limpeza:   { bg:'hover:bg-cyan-50',    bgActive:'bg-cyan-50',    text:'text-cyan-600',    textActive:'text-cyan-800',    border:'border-cyan-500' },
}

const ACCENT_DARK: Record<SubTab, { bg: string; bgActive: string; text: string; textActive: string; border: string }> = {
  os:        { bg:'hover:bg-rose-500/10',    bgActive:'bg-rose-500/15',    text:'text-rose-400',    textActive:'text-rose-200',    border:'border-rose-500/40' },
  historico: { bg:'hover:bg-emerald-500/10', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', border:'border-emerald-500/40' },
  limpeza:   { bg:'hover:bg-cyan-500/10',    bgActive:'bg-cyan-500/15',    text:'text-cyan-400',    textActive:'text-cyan-200',    border:'border-cyan-500/40' },
}

const ENCERRADOS = ['concluida', 'cancelada', 'rejeitada']

export default function ManutencoesServicos() {
  const { isDark } = useTheme()
  const [sub, setSub] = useState<SubTab>('os')

  // Deep link: /locacoes/gestao?tab=servicos&sub=limpeza&imovel=<id>
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const s = searchParams.get('sub')
    if (s && SUB_TABS.some(t => t.key === s)) setSub(s as SubTab)
  }, [searchParams])

  const { data: solicitacoes = [] } = useSolicitacoesLocacao()
  const { data: limpezas = [] } = useLimpezas()
  const counts: Record<SubTab, number> = {
    os:        solicitacoes.filter(s => !ENCERRADOS.includes(s.status)).length,
    historico: solicitacoes.filter(s => ENCERRADOS.includes(s.status)).length,
    limpeza:   limpezas.length,
  }

  return (
    <div className="space-y-3">
      {/* Sub-abas */}
      <div className={`flex gap-1 overflow-x-auto hide-scrollbar rounded-2xl border p-1 ${
        isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
      }`}>
        {SUB_TABS.map(t => {
          const isActive = sub === t.key
          const Icon = t.icon
          const a = isDark ? ACCENT_DARK[t.key] : ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => setSub(t.key)}
              className={`min-w-fit whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-all md:px-4 md:py-2.5 md:flex-1 flex items-center justify-center gap-2 ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} border-transparent font-medium ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" /> {t.label}
              {counts[t.key] > 0 && (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isActive ? 'bg-white/25 text-current' : isDark ? 'bg-white/[0.08] text-slate-400' : 'bg-slate-200/80 text-slate-500'
                }`}>{counts[t.key]}</span>
              )}
            </button>
          )
        })}
      </div>

      {sub === 'os' && <SolicitacoesPipeline />}
      {sub === 'historico' && <SolicitacoesHistorico />}
      {sub === 'limpeza' && <LimpezasPanel />}
    </div>
  )
}
