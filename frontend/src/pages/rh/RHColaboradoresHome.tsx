// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHColaboradoresHome.tsx — Wrapper de abas para a visão Colaboradores.
// Aba 1 "Lista Colaboradores" embrulha a tela existente (RHColaboradores) INTACTA.
// Abas 2/3 (Verificações / Relatórios) integram o SuperTEG.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Users, ShieldCheck, FileText } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import RHColaboradores from './RHColaboradores'
import Verificacoes from './Verificacoes'
import Relatorios from './Relatorios'

const TABS = [
  { key: 'lista',        label: 'Lista Colaboradores', icon: Users },
  { key: 'verificacoes', label: 'Verificações',        icon: ShieldCheck },
  { key: 'relatorios',   label: 'Relatórios',          icon: FileText },
] as const
type Tab = typeof TABS[number]['key']

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }
const TAB_ACCENT: Record<Tab, AccentSet> = {
  lista:        { bg:'bg-indigo-50',  bgActive:'bg-indigo-100',  text:'text-indigo-500',  textActive:'text-indigo-800',  badge:'bg-indigo-200/80 text-indigo-700',  border:'border-indigo-200' },
  verificacoes: { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
  relatorios:   { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
}
const TAB_ACCENT_DARK: Record<Tab, AccentSet> = {
  lista:        { bg:'bg-indigo-500/5',  bgActive:'bg-indigo-500/15',  text:'text-indigo-400',  textActive:'text-indigo-200',  badge:'bg-indigo-500/15 text-indigo-300',  border:'border-indigo-500/20' },
  verificacoes: { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  badge:'bg-violet-500/15 text-violet-300',  border:'border-violet-500/20' },
  relatorios:   { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
}

export default function RHColaboradoresHome() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('lista')

  return (
    <div className="flex flex-col h-full">
      {/* Tabs — mesmo layout visual das outras visões (Gestão/Entradas/Devoluções) */}
      <div className={`flex gap-1 p-1 mb-3 rounded-2xl border overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TABS.map(t => {
          const isActive = tab === t.key
          const Icon = t.icon
          const a = isDark ? TAB_ACCENT_DARK[t.key] : TAB_ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0">
        {tab === 'lista'        && <RHColaboradores />}
        {tab === 'verificacoes' && <Verificacoes />}
        {tab === 'relatorios'   && <Relatorios />}
      </div>
    </div>
  )
}
