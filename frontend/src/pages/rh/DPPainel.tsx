// pages/rh/DPPainel.tsx — DP > Painel
import { LayoutDashboard, Gift, Fingerprint, Receipt, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'

const CARDS = [
  { label: 'Benefícios', desc: 'Plano de saúde, alimentação, transporte, moradia', icon: Gift,        cor: 'text-amber-500',   bg: 'bg-amber-50',   to: '/rh/dp/beneficios' },
  { label: 'Ponto',      desc: 'Registros, retificações, horas extras, atestados', icon: Fingerprint, cor: 'text-blue-500',    bg: 'bg-blue-50',    to: '/rh/dp/ponto' },
  { label: 'Folha',      desc: 'Apuração, verificação, fechamento e pagamento',    icon: Receipt,     cor: 'text-violet-500',  bg: 'bg-violet-50',  to: '/rh/dp/folha' },
  { label: 'Holerites',  desc: 'Geração e distribuição de holerites',              icon: FileText,    cor: 'text-emerald-500', bg: 'bg-emerald-50', to: '/rh/dp/holerites' },
]

export default function DPPainel() {
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <LayoutDashboard size={20} className="text-amber-400" />
          Departamento Pessoal
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Folha de pagamento, ponto, benefícios e holerites</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
        {CARDS.map(c => (
          <button key={c.to} onClick={() => navigate(c.to)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
              isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
            }`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isLight ? c.bg : 'bg-white/[0.05]'}`}>
              <c.icon size={20} className={c.cor} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{c.label}</p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{c.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
