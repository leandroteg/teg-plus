import { useNavigate } from 'react-router-dom'
import {
  Shield, HardHat, ArrowLeft, Clock,
  AlertTriangle, ClipboardCheck, GraduationCap,
  Search, Activity, Package, CheckCircle2, Leaf,
} from 'lucide-react'

// ── Funcionalidades planejadas ──────────────────────────────────────────────
const FEATURES = [
  {
    icon: AlertTriangle,
    name: 'Registro de ocorrências',
    desc: 'Cadastro e acompanhamento de incidentes, acidentes e quase-acidentes',
  },
  {
    icon: ClipboardCheck,
    name: 'Checklist de segurança',
    desc: 'Inspeções periódicas digitais com foto e assinatura eletrônica em campo',
  },
  {
    icon: GraduationCap,
    name: 'Treinamentos NR',
    desc: 'Controle de capacitações obrigatórias por NR com validade e reciclagem',
  },
  {
    icon: Search,
    name: 'Auditorias internas',
    desc: 'Planejamento e execução de auditorias com planos de ação corretiva',
  },
  {
    icon: Activity,
    name: 'Indicadores LTIFR e TRIFR',
    desc: 'Painéis de frequência de lesões e taxas de incidência em tempo real',
  },
  {
    icon: Package,
    name: 'Gestão de EPIs',
    desc: 'Controle de entrega, validade e devolução de equipamentos de proteção',
  },
  {
    icon: Leaf,
    name: 'Gestão ambiental',
    desc: 'Monitoramento de resíduos, licenças ambientais e consumo de recursos',
  },
  {
    icon: Shield,
    name: 'PPRA / PCMSO Digital',
    desc: 'Elaboração e controle de programas de saúde e riscos ambientais',
  },
]

// ── Timeline ────────────────────────────────────────────────────────────────
const TIMELINE = [
  { quarter: 'Q2 2026', label: 'Registro de Ocorrências + Gestão de EPIs', status: 'next' },
  { quarter: 'Q3 2026', label: 'Checklists + Treinamentos NR + Indicadores', status: 'planned' },
  { quarter: 'Q4 2026', label: 'Auditorias, Gestão Ambiental e PPRA Digital', status: 'planned' },
]

// ── Component ───────────────────────────────────────────────────────────────
export default function SSMA() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header com gradiente amber ────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-600 via-amber-500 to-orange-400 px-6 pt-8 pb-16 shadow-lg">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-amber-100 hover:text-white text-sm
            font-medium mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          Voltar ao Menu
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center
            justify-center shadow-inner border border-white/30">
            <HardHat size={28} className="text-white" />
          </div>
          <div>
            <p className="text-amber-100 text-xs font-semibold uppercase tracking-widest mb-0.5">
              TEG+ ERP
            </p>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Módulo SSMA
            </h1>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur text-white
          text-xs font-bold px-3 py-1.5 rounded-full border border-white/30">
          <Clock size={11} />
          Em Desenvolvimento
        </span>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 pb-12 space-y-5">

        {/* Card de funcionalidades */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-slate-800">Funcionalidades Planejadas</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              O que estará disponível quando o módulo for lançado
            </p>
          </div>
          <ul className="divide-y divide-slate-50">
            {FEATURES.map(({ icon: Icon, name, desc }) => (
              <li key={name} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50
                transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center
                  shrink-0 mt-0.5">
                  <Icon size={15} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Card de timeline */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-slate-800">Timeline de Lançamento</h2>
            <p className="text-slate-500 text-sm mt-0.5">Previsão de entregas por trimestre</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {TIMELINE.map(({ quarter, label, status }, idx) => (
              <div key={quarter} className="flex items-start gap-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs
                    font-bold border-2 ${
                      status === 'next'
                        ? 'bg-amber-100 border-amber-500 text-amber-700'
                        : 'bg-slate-100 border-slate-300 text-slate-500'
                    }`}>
                    {status === 'next' ? <CheckCircle2 size={14} /> : idx + 1}
                  </div>
                  {idx < TIMELINE.length - 1 && (
                    <div className="w-px h-6 bg-slate-200 mt-1" />
                  )}
                </div>
                <div className="pb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    status === 'next' ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {quarter}
                  </span>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botão voltar rodapé */}
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
            border-2 border-amber-200 text-amber-700 font-bold text-sm
            hover:bg-amber-50 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar ao Menu Principal
        </button>
      </div>
    </div>
  )
}
