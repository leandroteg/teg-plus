// Painel Custos — orçamento x custo real (sem dados ainda; tela vazia)
import { DollarSign } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { PanelCard } from '../../rh/paineis/_ui'

export default function CustosPainel() {
  const { isDark } = useTheme()
  return (
    <div className="space-y-3">
      <PanelCard title="Custos & Orçamento" icon={<DollarSign size={14} className="text-teal-500" />} isDark={isDark}>
        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
            <DollarSign size={26} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ainda não há dados de custo</p>
            <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Este painel mostrará orçado × custo real (mão de obra, materiais, equipamentos) e margem por polo/obra
              assim que a integração de custos/orçamento for ligada.
            </p>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}
