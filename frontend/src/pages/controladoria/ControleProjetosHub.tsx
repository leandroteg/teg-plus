import { FolderKanban, Sparkles } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function ControleProjetosHub() {
  const { isLightSidebar: isLight } = useTheme()

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Controle Projetos</h1>
        <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Frente reservada para a próxima etapa da evolução do módulo.
        </p>
      </div>

      <section className={`rounded-3xl border p-6 sm:p-8 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="max-w-2xl">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
            isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-300'
          }`}>
            <FolderKanban size={24} />
          </div>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Em breve</h2>
          <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Esta frente vai consolidar controle físico-financeiro, desvios por projeto e atuação integrada com EGP e Obras.
          </p>
          <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.04] text-slate-300'
          }`}>
            <Sparkles size={14} />
            Preparado para a próxima expansão da Controladoria
          </div>
        </div>
      </section>
    </div>
  )
}
