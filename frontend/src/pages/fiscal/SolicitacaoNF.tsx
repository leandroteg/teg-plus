import { FileInput, Clock } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function SolicitacaoNF() {
  const { isDark } = useTheme()

  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6
        ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
        <FileInput size={36} className={isDark ? 'text-amber-400' : 'text-amber-500'} />
      </div>

      <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        Solicitação de Nota Fiscal
      </h2>
      <p className={`text-sm mb-6 max-w-md text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Recebimento de notas fiscais solicitadas pela Logística.
        Este módulo está em desenvolvimento.
      </p>

      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
        ${isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
        <Clock size={14} />
        Em breve
      </div>
    </div>
  )
}
