import { KeyRound } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function Cautelas() {
  const { isLightSidebar: isLight } = useTheme()

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <KeyRound size={40} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
      <h1 className={`text-lg font-extrabold mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>Cautelas</h1>
      <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Em breve — controle de empréstimos e devoluções de materiais.
      </p>
    </div>
  )
}
