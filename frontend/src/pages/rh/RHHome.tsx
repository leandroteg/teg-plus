// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHHome.tsx — Painel do Módulo RH (em desenvolvimento)
// ─────────────────────────────────────────────────────────────────────────────
import {
  Users, Heart, Clock, UserCheck, CalendarDays, Banknote,
  GraduationCap, GitBranch, ClipboardList, Timer, CheckCircle2, ImagePlay,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const FEATURES = [
  { icon: UserCheck,    name: 'Cadastro de colaboradores',    desc: 'Ficha completa com dados pessoais, contratuais e documentos digitalizados' },
  { icon: Timer,        name: 'Controle de ponto',            desc: 'Registro de jornada com integração a relógios biométricos e app mobile' },
  { icon: CalendarDays, name: 'Férias e afastamentos',        desc: 'Gestão de programação de férias, licenças e afastamentos por CID' },
  { icon: Banknote,     name: 'Folha de pagamento',           desc: 'Cálculo automático de salários, horas extras, descontos e encargos' },
  { icon: GraduationCap, name: 'Treinamentos e certificações', desc: 'Controle de capacitações obrigatórias com alertas de vencimento de NRs' },
  { icon: GitBranch,    name: 'Organograma interativo',       desc: 'Visualização da estrutura hierárquica da empresa por departamento e obra' },
  { icon: ClipboardList, name: 'Avaliações de desempenho',   desc: 'Ciclos de feedback estruturados com metas e indicadores individuais' },
  { icon: Heart,        name: 'Medicina e bem-estar',         desc: 'Controle de ASOs, exames periódicos e programas de saúde ocupacional' },
]

const TIMELINE = [
  { quarter: 'Q2 2026', label: 'Cadastro de Colaboradores + Controle de Ponto', done: false },
  { quarter: 'Q3 2026', label: 'Folha de Pagamento + Férias e Afastamentos',    done: false },
  { quarter: 'Q4 2026', label: 'Treinamentos, Organograma e Avaliações',         done: false },
]

export default function RHHome() {
  const { isAdmin } = useAuth()
  const navigate    = useNavigate()

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-violet-400" />
            Módulo RH
          </h1>
          <p className="text-sm text-slate-500">Gestão de pessoas e organização</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full
          bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <Clock size={11} />
          Em Desenvolvimento
        </span>
      </div>

      {/* Admin shortcut — Mural de Recados */}
      {isAdmin && (
        <button
          onClick={() => navigate('/rh/mural')}
          className="w-full flex items-center gap-4 p-4 rounded-2xl
            bg-violet-500/10 border border-violet-500/25
            hover:bg-violet-500/15 hover:border-violet-500/40 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30
            flex items-center justify-center shrink-0
            group-hover:scale-110 transition-transform">
            <ImagePlay size={18} className="text-violet-300" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Mural de Recados</p>
            <p className="text-xs text-slate-400">Gerencie banners e campanhas da tela inicial</p>
          </div>
          <div className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg
            bg-violet-500/20 text-violet-300 border border-violet-500/20">
            Admin
          </div>
        </button>
      )}

      {/* Funcionalidades planejadas */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-white">Funcionalidades Planejadas</h2>
          <p className="text-xs text-slate-500 mt-0.5">O que estará disponível no lançamento completo</p>
        </div>
        <ul className="divide-y divide-white/4">
          {FEATURES.map(({ icon: Icon, name, desc }) => (
            <li key={name} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20
                flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Timeline */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/6">
          <h2 className="text-sm font-bold text-white">Timeline de Lançamento</h2>
          <p className="text-xs text-slate-500 mt-0.5">Previsão de entregas por trimestre</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {TIMELINE.map(({ quarter, label, done }, idx) => (
            <div key={quarter} className="flex items-start gap-4">
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs
                  font-bold border-2 ${
                    done
                      ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                      : idx === 0
                        ? 'bg-violet-500/10 border-violet-500/50 text-violet-400'
                        : 'bg-white/4 border-white/15 text-slate-500'
                  }`}>
                  {done ? <CheckCircle2 size={14} /> : <span>{idx + 1}</span>}
                </div>
                {idx < TIMELINE.length - 1 && (
                  <div className="w-px h-5 bg-white/8 mt-1" />
                )}
              </div>
              <div className="pb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  idx === 0 ? 'text-violet-400' : 'text-slate-500'
                }`}>
                  {quarter}
                </span>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
