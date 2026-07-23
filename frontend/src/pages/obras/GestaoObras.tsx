// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/GestaoObras.tsx — Visão "Gestão de Obras"
// Sub-abas no padrão do módulo (ControladoriaFlow): Priorização · Planejamento
// · Diário de Obra · Medições. Estrutura criada; o conteúdo de cada aba entra
// em seguida.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileBarChart2, ListOrdered, CalendarRange, ClipboardList, Ruler, Construction } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import RDO from './RDO'
import RDOEstruturado from './RDOEstruturado'
import { usePortfolios, useObrasDoPortfolio } from '../../hooks/usePMO'
import ResumoTecnicoObras from './ResumoTecnicoObras'
import PriorizacaoObras from './PriorizacaoObras'
import PlanejamentoTecnico from './PlanejamentoTecnico'

const STEPS: FlowStep[] = [
  {
    key: 'resumo_tecnico', label: 'Resumo Técnico',
    description: 'Visão técnica consolidada das obras.',
    icon: FileBarChart2,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'priorizacao', label: 'Priorização',
    description: 'Ordene as obras por prioridade de execução.',
    icon: ListOrdered,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
  {
    key: 'planejamento', label: 'Planejamento',
    description: 'Planeje a execução das obras priorizadas.',
    icon: CalendarRange,
    accent: { bg: 'hover:bg-blue-50', bgActive: 'bg-blue-50', text: 'text-blue-600', textActive: 'text-blue-800', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-700' },
  },
  {
    key: 'diario', label: 'Diário de Obra',
    description: 'Registro diário do que foi executado em campo.',
    icon: ClipboardList,
    accent: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
  },
  {
    key: 'medicoes', label: 'Medições',
    description: 'Medição do executado para faturamento.',
    icon: Ruler,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
]

export default function GestaoObras() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [step, setStep] = useState('resumo_tecnico')
  const [searchParams] = useSearchParams()
  const atual = STEPS.find(s => s.key === step) ?? STEPS[0]

  // Veio do flyout "Novo Registro › Registrar RDO": abre a aba Diário + o modal
  const [novoRdo, setNovoRdo] = useState(false)
  const { data: portfolios = [] } = usePortfolios()
  const { data: obrasRdo = [] } = useObrasDoPortfolio(portfolios[0]?.id)
  const [obraRdoId, setObraRdoId] = useState('')
  const obraRdo = obrasRdo.find(o => o.id === obraRdoId) ?? obrasRdo[0]

  useEffect(() => {
    if (searchParams.get('novo_rdo') === '1') { setStep('diario'); setNovoRdo(true) }
  }, [searchParams])

  return (
    <div className="p-4 sm:p-6">
      <ControladoriaFlow
        title="Gestão de Obras"
        subtitle="Priorização, planejamento, diário de obra e medições"
        steps={STEPS}
        activeStep={step}
        onStepChange={setStep}
      >
        {step === 'resumo_tecnico' ? (
          <ResumoTecnicoObras />
        ) : step === 'priorizacao' ? (
          <PriorizacaoObras />
        ) : step === 'planejamento' ? (
          <PlanejamentoTecnico />
        ) : step === 'diario' ? (
          <>
            {/* barra pra abrir o RDO estruturado (matriz do Planejamento) */}
            <div className={`mb-3 rounded-2xl border p-3 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
              <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Novo RDO estruturado</span>
              <select value={obraRdo?.id ?? ''} onChange={e => setObraRdoId(e.target.value)}
                className={`appearance-none rounded-lg px-2.5 py-1.5 border text-xs font-semibold max-w-[320px] truncate ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                {obrasRdo.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <button onClick={() => setNovoRdo(true)} disabled={!obraRdo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50">
                <ClipboardList size={13} /> Preencher RDO
              </button>
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>avanço por estrutura · equipe e recursos pré-preenchidos</span>
            </div>
            {/* histórico: tela de RDO existente (arquivo intocado) */}
            <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
              <RDO />
            </div>
            {novoRdo && obraRdo && (
              <RDOEstruturado obraId={obraRdo.id} obraNome={obraRdo.nome} onClose={() => setNovoRdo(false)} />
            )}
          </>
        ) : (
          <div className={`rounded-2xl border p-4 sm:p-5 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${atual.accent.bgActive}`}>
                <atual.icon size={22} className={atual.accent.text} />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Conteúdo de “{atual.label}” em construção
              </p>
              <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {atual.description}
              </p>
              <Construction size={16} className={`mt-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            </div>
          </div>
        )}
      </ControladoriaFlow>
    </div>
  )
}
