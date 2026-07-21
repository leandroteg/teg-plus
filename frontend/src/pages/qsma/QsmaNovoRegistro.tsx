import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, Siren, ShieldCheck, GraduationCap, FileBadge,
  AlertTriangle, ClipboardList, ArrowRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// Porta de entrada única do QSMA: "o que você quer registrar?" — roteia para a
// visão certa já com o modal aberto (?novo=…). Padrão do SgiNovoRegistro.
const OPCOES = [
  {
    icon: ClipboardCheck, to: '/qsma/inspecoes?novo=programar',
    titulo: 'Programar Inspeção',
    desc: 'Agendar checklist de equipe, veículo ou área para execução em campo',
    tone: 'sky',
  },
  {
    icon: ClipboardList, to: '/qsma/inspecoes?novo=modelo',
    titulo: 'Novo Modelo de Checklist',
    desc: 'Montar um checklist configurável (inspeção, APR ou auditoria)',
    tone: 'indigo',
  },
  {
    icon: Siren, to: '/qsma/seguranca?novo=ocorrencia',
    titulo: 'Registrar Ocorrência',
    desc: 'Desvio, quase-acidente, acidente ou ocorrência ambiental',
    tone: 'red',
  },
  {
    icon: ShieldCheck, to: '/qsma/seguranca?novo=epi',
    titulo: 'Entrega de EPI',
    desc: 'Registrar entrega/troca com ficha assinada via PortalTEG',
    tone: 'violet',
  },
  {
    icon: GraduationCap, to: '/qsma/seguranca?novo=treinamento',
    titulo: 'Treinamento',
    desc: 'Registrar NR realizada com certificado e controle de vencimento',
    tone: 'amber',
  },
  {
    icon: AlertTriangle, to: '/qsma/seguranca?novo=risco',
    titulo: 'Risco / APR',
    desc: 'Inventário PGR ou análise preliminar de risco por tarefa',
    tone: 'orange',
  },
  {
    icon: FileBadge, to: '/qsma/meio-ambiente?novo=licenca',
    titulo: 'Licença Ambiental',
    desc: 'Licença/autorização com condicionantes e alertas de prazo',
    tone: 'emerald',
  },
] as const

const TONE: Record<string, { light: string; dark: string; icon: string }> = {
  sky:     { light: 'hover:border-sky-300 hover:bg-sky-50/50',       dark: 'hover:border-sky-500/40 hover:bg-sky-500/[0.06]',     icon: 'text-sky-500' },
  indigo:  { light: 'hover:border-indigo-300 hover:bg-indigo-50/50', dark: 'hover:border-indigo-500/40 hover:bg-indigo-500/[0.06]', icon: 'text-indigo-500' },
  red:     { light: 'hover:border-red-300 hover:bg-red-50/50',       dark: 'hover:border-red-500/40 hover:bg-red-500/[0.06]',     icon: 'text-red-500' },
  violet:  { light: 'hover:border-violet-300 hover:bg-violet-50/50', dark: 'hover:border-violet-500/40 hover:bg-violet-500/[0.06]', icon: 'text-violet-500' },
  amber:   { light: 'hover:border-amber-300 hover:bg-amber-50/50',   dark: 'hover:border-amber-500/40 hover:bg-amber-500/[0.06]', icon: 'text-amber-500' },
  orange:  { light: 'hover:border-orange-300 hover:bg-orange-50/50', dark: 'hover:border-orange-500/40 hover:bg-orange-500/[0.06]', icon: 'text-orange-500' },
  emerald: { light: 'hover:border-emerald-300 hover:bg-emerald-50/50', dark: 'hover:border-emerald-500/40 hover:bg-emerald-500/[0.06]', icon: 'text-emerald-500' },
}

export default function QsmaNovoRegistro() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const nav = useNavigate()

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Novo Registro</h1>
        <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          O que você quer registrar? Escolha abaixo — o formulário abre na visão certa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {OPCOES.map(op => {
          const t = TONE[op.tone]
          return (
            <button
              key={op.to}
              onClick={() => nav(op.to)}
              className={`group text-left rounded-2xl border p-4 transition-all ${
                isDark
                  ? `bg-white/[0.03] border-white/[0.06] ${t.dark}`
                  : `bg-white border-slate-200 shadow-sm ${t.light}`
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <op.icon size={22} className={`${t.icon} shrink-0`} />
                <ArrowRight size={14} className={`transition-transform group-hover:translate-x-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              </div>
              <p className={`mt-3 text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{op.titulo}</p>
              <p className={`mt-1 text-[11px] leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{op.desc}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
