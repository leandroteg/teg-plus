import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { Building2, Receipt, Wrench, FileSignature, BedDouble, FileText, ShieldCheck } from 'lucide-react'
import { gerarTabelaPdf } from '../../utils/tabela-pdf'
import { useImoveis, useFaturas, useSolicitacoesLocacao, useAditivos } from '../../hooks/useLocacao'
import { useInspecoes } from '../../hooks/useQsma'
import { useLeitos } from '../../hooks/useLeitos'
import Ativos from './Ativos'
import Faturas from './Faturas'
import ManutencoesServicos from './ManutencoesServicos'
import AditivosRenovacoes from './AditivosRenovacoes'
import ControleLeitos from './ControleLeitos'
import RelatoriosInspecao from './RelatoriosInspecao'

const TABS = [
  { key: 'ativos',   label: 'Ativos',                  icon: Building2 },
  { key: 'aditivos', label: 'Aditivos & Renovações',    icon: FileSignature },
  { key: 'faturas',  label: 'Faturas',                  icon: Receipt },
  { key: 'servicos', label: 'Manutenções e Serviços',   icon: Wrench },
  { key: 'inspecoes', label: 'Inspeções',               icon: ShieldCheck },
  { key: 'acordos',  label: 'Controle Leitos',          icon: BedDouble },
] as const

type Tab = typeof TABS[number]['key']

// Accent por tab (mesmo padrão visual de Entradas/Devoluções)
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const TAB_ACCENT: Record<Tab, AccentSet> = {
  ativos:   { bg:'bg-indigo-50',  bgActive:'bg-indigo-100',  text:'text-indigo-500',  textActive:'text-indigo-800',  dot:'bg-indigo-500',  badge:'bg-indigo-200/80 text-indigo-700',  border:'border-indigo-200' },
  faturas:  { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  servicos: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  aditivos: { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
  inspecoes:{ bg:'bg-rose-50',    bgActive:'bg-rose-100',    text:'text-rose-500',    textActive:'text-rose-800',    dot:'bg-rose-500',    badge:'bg-rose-200/80 text-rose-700',    border:'border-rose-200' },
  acordos:  { bg:'bg-cyan-50',    bgActive:'bg-cyan-100',    text:'text-cyan-500',    textActive:'text-cyan-800',    dot:'bg-cyan-500',    badge:'bg-cyan-200/80 text-cyan-700',    border:'border-cyan-200' },
}
const TAB_ACCENT_DARK: Record<Tab, AccentSet> = {
  ativos:   { bg:'bg-indigo-500/5',  bgActive:'bg-indigo-500/15',  text:'text-indigo-400',  textActive:'text-indigo-200',  dot:'bg-indigo-400',  badge:'bg-indigo-500/15 text-indigo-300',  border:'border-indigo-500/20' },
  faturas:  { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  servicos: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',   border:'border-amber-500/20' },
  aditivos: { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',  border:'border-violet-500/20' },
  inspecoes:{ bg:'bg-rose-500/5',    bgActive:'bg-rose-500/15',    text:'text-rose-400',    textActive:'text-rose-200',    dot:'bg-rose-400',    badge:'bg-rose-500/15 text-rose-300',    border:'border-rose-500/20' },
  acordos:  { bg:'bg-cyan-500/5',    bgActive:'bg-cyan-500/15',    text:'text-cyan-400',    textActive:'text-cyan-200',    dot:'bg-cyan-400',    badge:'bg-cyan-500/15 text-cyan-300',    border:'border-cyan-500/20' },
}

export default function Gestao() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('ativos')
  const contentRef = useRef<HTMLDivElement>(null)

  // Deep link do Portal TEG (QR do alojamento → "Fechar OS"):
  // /locacoes/gestao?tab=servicos&imovel=<id>. O ?imovel é lido pela própria aba.
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TABS.some(x => x.key === t)) setTab(t as Tab)
  }, [searchParams])

  function gerarRelatorio() {
    const table = contentRef.current?.querySelector('table')
    const label = TABS.find(t => t.key === tab)?.label ?? 'Gestão'
    if (!table) {
      alert('Nenhuma tabela visível nesta aba. Se estiver na visão de cards, alterne para a visão de lista/tabela e tente de novo.')
      return
    }
    gerarTabelaPdf({ titulo: `Gestão de Locação — ${label}`, subtitulo: `Aba: ${label}`, table })
  }

  // Contagens por aba
  const { data: imoveis = [] } = useImoveis()
  const { data: faturas = [] } = useFaturas()
  const { data: solicitacoes = [] } = useSolicitacoesLocacao()
  const { data: aditivos = [] } = useAditivos()
  const { data: leitos = [] } = useLeitos()
  const { data: inspecoes = [] } = useInspecoes({ apenasImoveis: true })

  const counts: Record<Tab, number> = useMemo(() => ({
    ativos: imoveis.filter(i => (i as { tipo?: string }).tipo !== 'HTL').length,
    faturas: faturas.length,
    servicos: solicitacoes.length,
    aditivos: aditivos.length,
    inspecoes: inspecoes.length,
    acordos: leitos.length,
  }), [imoveis, faturas, solicitacoes, aditivos, inspecoes, leitos])

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Gestão</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ativos, faturas, manutenções, aditivos e acordos</p>
        </div>
        <button onClick={gerarRelatorio} title="Gerar relatório em PDF da tabela visível"
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
            isDark ? 'border-white/10 text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <FileText size={15} /> Relatório
        </button>
      </div>

      {/* Tabs — mesmo layout de Entradas/Devoluções */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TABS.map(t => {
          const count = counts[t.key]
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
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${
                  isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-auto p-4">
        {tab === 'ativos'   && <Ativos />}
        {tab === 'faturas'  && <Faturas />}
        {tab === 'servicos' && <ManutencoesServicos />}
        {tab === 'aditivos' && <AditivosRenovacoes />}
        {tab === 'inspecoes' && <RelatoriosInspecao />}
        {tab === 'acordos'  && <ControleLeitos />}
      </div>
    </div>
  )
}
