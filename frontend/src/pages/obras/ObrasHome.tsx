import { useTheme } from '../../contexts/ThemeContext'
import ObrasPainel from './ObrasPainel'

export default function ObrasHome() {
  const { isLightSidebar: isLight } = useTheme()

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
        Painel de Obras
      </h1>
      <ObrasPainel />
    </div>
  )
}
