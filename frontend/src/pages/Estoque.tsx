import { useNavigate } from 'react-router-dom'
import {
  Package, Warehouse, ArrowLeft, Clock,
  ArrowUpDown, MapPin, BookMarked, ScanLine,
  BellRing, Link2, BarChart2, CheckCircle2,
} from 'lucide-react'

// ── Funcionalidades planejadas ──────────────────────────────────────────────
const FEATURES = [
  {
    icon: ArrowUpDown,
    name: 'Entrada e saída de materiais',
    desc: 'Registro de movimentações com nota fiscal, fornecedor e responsável',
  },
  {
    icon: MapPin,
    name: 'Inventário por obra',
    desc: 'Controle de estoque segmentado por canteiro, almoxarifado e centro de custo',
  },
  {
    icon: BookMarked,
    name: 'Reservas e requisições',
    desc: 'Solicitação de materiais com aprovação e reserva automática de saldo',
  },
  {
    icon: ScanLine,
    name: 'Rastreabilidade de materiais',
    desc: 'Histórico completo de movimentações por item, lote ou número de série',
  },
  {
    icon: BellRing,
    name: 'Alertas de estoque mínimo',
    desc: 'Notificações automáticas quando o saldo cai abaixo do ponto de ressuprimento',
  },
  {
    icon: Link2,
    name: 'Integração com Compras',
    desc: 'Geração automática de requisições de compra a partir de alertas de estoque',
  },
  {
    icon: Warehouse,
    name: 'Gestão de fornecedores e SKUs',
    desc: 'Catálogo de materiais padronizado com múltiplos fornecedores por item',
  },
  {
    icon: BarChart2,
    name: 'Relatórios de giro e acurácia',
    desc: 'Indicadores de performance do almoxarifado: giro, acurácia e obsolescência',
  },
]

// ── Timeline ────────────────────────────────────────────────────────────────
const TIMELINE = [
  { quarter: 'Q3 2026', label: 'Movimentações + Inventário por Obra', status: 'next' },
  { quarter: 'Q3 2026', label: 'Reservas, Requisições e Alertas de Estoque', status: 'planned' },
  { quarter: 'Q4 2026', label: 'Rastreabilidade, Integração Compras e Relatórios', status: 'planned' },
]

// ── Component ───────────────────────────────────────────────────────────────
export default function Estoque() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header com gradiente blue ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-400 px-6 pt-8 pb-16 shadow-lg">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-blue-100 hover:text-white text-sm
            font-medium mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          Voltar ao Menu
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center
            justify-center shadow-inner border border-white/30">
            <Package size={28} className="text-white" />
          </div>
          <div>
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-0.5">
              TEG+ ERP
            </p>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Módulo Estoque
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
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center
                  shrink-0 mt-0.5">
                  <Icon size={15} className="text-blue-600" />
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
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
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
                    status === 'next' ? 'text-blue-600' : 'text-slate-400'
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
            border-2 border-blue-200 text-blue-700 font-bold text-sm
            hover:bg-blue-50 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar ao Menu Principal
        </button>
      </div>
    </div>
  )
}
