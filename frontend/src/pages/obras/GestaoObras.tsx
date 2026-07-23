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
import { useProjetos, useObrasDoPortfolio, useOSCsDoPortfolio } from '../../hooks/usePMO'
import { EGPContractProvider, useEGPPortfolioId } from '../../contexts/EGPContractContext'
import { ContractSelector } from '../../components/EGPLayout'
import ResumoTecnicoObras from './ResumoTecnicoObras'
import PriorizacaoObras from './PriorizacaoObras'
import PlanejamentoTecnico from './PlanejamentoTecnico'
import { useObrasFiltros, ObrasFiltrosBar } from './obrasFiltros'
import LancarProjetoModal from './LancarProjetoModal'

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
    key: 'planejamento', label: 'Plan. Técnico',
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

function GestaoObrasInner() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [step, setStep] = useState('resumo_tecnico')
  const [searchParams, setSearchParams] = useSearchParams()
  const atual = STEPS.find(s => s.key === step) ?? STEPS[0]

  // Veio do flyout "Novo Registro › Registrar RDO": abre a aba Diário + o modal
  const [novoRdo, setNovoRdo] = useState(false)
  const portfolioId = useEGPPortfolioId()          // contrato do topo — filtra TODAS as abas
  const { data: obrasRdo = [] } = useObrasDoPortfolio(portfolioId)
  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const fMed = useObrasFiltros()          // filtros padrão da aba Medições
  const [obraRdoId, setObraRdoId] = useState('')
  const [lancarProj, setLancarProj] = useState(false)
  const obraRdo = obrasRdo.find(o => o.id === obraRdoId) ?? obrasRdo[0]

  useEffect(() => {
    const novo = searchParams.get('novo_rdo') === '1'
    const lancar = searchParams.get('lancar_projeto') === '1'
    if (!novo && !lancar) return
    if (novo) { setStep('diario'); setNovoRdo(true) }
    if (lancar) setLancarProj(true)
    // limpa os params: senão o 2º clique no flyout não muda a URL e o efeito não roda
    const p = new URLSearchParams(searchParams); p.delete('novo_rdo'); p.delete('lancar_projeto')
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <div className="p-4 sm:p-6">
      <ControladoriaFlow
        title="Gestão de Obras"
        subtitle="Priorização, planejamento, diário de obra e medições"
        steps={STEPS}
        activeStep={step}
        onStepChange={setStep}
        headerRight={<ContractSelector />}   /* contrato na MESMA linha do título */
      >
        {step === 'resumo_tecnico' ? (
          <ResumoTecnicoObras portfolioId={portfolioId} />
        ) : step === 'priorizacao' ? (
          <PriorizacaoObras portfolioId={portfolioId} />
        ) : step === 'planejamento' ? (
          <PlanejamentoTecnico portfolioId={portfolioId} />
        ) : step === 'diario' ? (
          <>
            {/* histórico + filtros padrão; a obra escolhida lá é a do RDO estruturado */}
            <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 -mt-3">
              <RDO portfolioId={portfolioId} onObraChange={setObraRdoId} embutido />
            </div>
            {novoRdo && obraRdo && (
              <RDOEstruturado obraId={obraRdo.id} obraNome={obraRdo.nome} onClose={() => setNovoRdo(false)}
                obras={obrasRdo.map(o => ({ id: o.id, nome: o.nome, projeto_id: o.pmo_projeto_id, projeto_nome: o.polo_nome }))}
                onObraChange={setObraRdoId} />
            )}
          </>
        ) : (
          <div className="space-y-3">
            {step === 'medicoes' && (
              <div className={`rounded-2xl border p-3 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                <ObrasFiltrosBar projetos={projetos} oscs={oscs} f={fMed} isDark={isDark} />
              </div>
            )}
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
          </div>
        )}
      </ControladoriaFlow>
      {lancarProj && <LancarProjetoModal portfolioId={portfolioId} onClose={() => setLancarProj(false)} />}
    </div>
  )
}

// Provider do contrato (mesmo do EGP) envolvendo a visão inteira
export default function GestaoObras() {
  return (
    <EGPContractProvider>
      <GestaoObrasInner />
    </EGPContractProvider>
  )
}
