// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPFluxoPage.tsx — Página de fluxo do DP (header + rail + painel)
// Estrutura reutilizável; conteúdo de cada aba será montado depois.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Construction } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import RHTabRail, { corDaAba, type RHTab } from './RHTabRail'

export default function DPFluxoPage({ titulo, subtitulo, icon: Icon, iconColor, tabs, renderPanel }: {
  titulo: string
  subtitulo: string
  icon: LucideIcon
  iconColor: string
  tabs: RHTab[]
  renderPanel?: (activeKey: string) => ReactNode
}) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [active, setActive] = useState(tabs[0]?.key ?? '')
  const ativa = tabs.find(t => t.key === active) ?? tabs[0]
  const accent = ativa ? corDaAba(ativa.cor, isDark) : null
  const conteudo = renderPanel ? renderPanel(active) : null

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Icon size={20} className={iconColor} />
          {titulo}
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{subtitulo}</p>
      </div>

      {/* Rail */}
      <RHTabRail tabs={tabs} active={active} onChange={setActive} isDark={isDark} />

      {/* Painel */}
      {conteudo ? (
        conteudo
      ) : (
        <div className={`rounded-2xl border p-4 sm:p-5 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
          <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'}`}>
            {ativa && (
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${accent?.bgActive}`}>
                <ativa.icon size={22} className={accent?.icon} />
              </div>
            )}
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Conteúdo de “{ativa?.label}” em construção
            </p>
            <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              A estrutura do DP está pronta. Os campos e ações desta etapa serão montados em seguida.
            </p>
            <Construction size={16} className={`mt-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          </div>
        </div>
      )}
    </div>
  )
}
