import { FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export default function PlanoOrcamentarioVisual() {
  const { isLightSidebar: isLight } = useTheme()

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <FileText size={20} className="text-violet-500" />
          Plano Orcamentario — Visao Executiva
        </h1>
        <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Documento consolidado com cenarios, receitas, custos e KPIs do plano 2026
        </p>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/60 border-slate-700'
      }`}>
        <iframe
          src="/plano-orcamentario-2026.html"
          title="Plano Orcamentario TEG Uniao 2026"
          className="w-full border-0"
          style={{ minHeight: '1200px', height: '100%' }}
        />
      </div>
    </div>
  )
}
