import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContractSelector } from '../../components/EGPLayout'
import {
  ArrowLeft, Compass, Network, CalendarDays, BarChart3, DollarSign, Ruler,
  AlertTriangle, Plus, Trash2, Save, Edit3, X, Check, Sparkles, FolderKanban, ChevronRight,
  Table2, GitBranch,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import {
  usePortfolio, useProjetos, useCriarProjeto,
  useEAP, useGerarEAPIA,
  useTarefas, useGerarCronogramaIA,
  useHistograma,
  useOrcamento, useCriarOrcamento, useAtualizarOrcamento, useDeletarOrcamento,
  useRiscosEGP, useCriarRisco, useAtualizarRisco, useDeletarRisco,
} from '../../hooks/usePMO'
import { useLookups } from '../../hooks/useLookups'
import { ProjetosFilterBar } from './ProjetosFilterBar'
import EAPFinal, { EAPKpis } from './EAPFinal'
import CronogramaPainel from './paineis/CronogramaPainel'
import HistogramaRecursos from './paineis/HistogramaPainel'
import CustosPainel from './paineis/CustosPainel'
import RiscosPainel from './paineis/RiscosPainel'
import { MedicoesPanel } from './EGPControle'
import { Wallet } from 'lucide-react'
import type { PMOEAP, PMOTarefa, PMOHistograma, PMOOrcamento, PMORisco } from '../../types/pmo'

type Tab = 'eap' | 'cronograma' | 'histograma' | 'orcamento' | 'custos' | 'medicao' | 'riscos'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'eap', label: 'EAP', icon: Network },
  { key: 'cronograma', label: 'Cronograma', icon: CalendarDays },
  { key: 'histograma', label: 'Histograma', icon: BarChart3 },
  { key: 'orcamento', label: 'Orçamento', icon: DollarSign },
  { key: 'custos', label: 'Custos', icon: Wallet },
  { key: 'medicao', label: 'Medição', icon: Ruler },
  { key: 'riscos', label: 'Riscos', icon: AlertTriangle },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  eap:         { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-blue-500/10',    textDark: 'text-blue-400',    textActiveDark: 'text-blue-300',    borderDark: 'border-blue-500/40' },
  cronograma:  { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-teal-500/10',    textDark: 'text-teal-400',    textActiveDark: 'text-teal-300',    borderDark: 'border-teal-500/40' },
  histograma:  { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10',  textDark: 'text-violet-400',  textActiveDark: 'text-violet-300',  borderDark: 'border-violet-500/40' },
  orcamento:   { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-emerald-500/10', textDark: 'text-emerald-400', textActiveDark: 'text-emerald-300', borderDark: 'border-emerald-500/40' },
  custos:      { bg: 'hover:bg-rose-50',    bgActive: 'bg-rose-50',    text: 'text-rose-600',    textActive: 'text-rose-800',    border: 'border-rose-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-rose-500/10',    textDark: 'text-rose-400',    textActiveDark: 'text-rose-300',    borderDark: 'border-rose-500/40' },
  medicao:     { bg: 'hover:bg-sky-50',     bgActive: 'bg-sky-50',     text: 'text-sky-600',     textActive: 'text-sky-800',     border: 'border-sky-500',     bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-sky-500/10',     textDark: 'text-sky-400',     textActiveDark: 'text-sky-300',     borderDark: 'border-sky-500/40' },
  riscos:      { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-amber-500/10',   textDark: 'text-amber-400',   textActiveDark: 'text-amber-300',   borderDark: 'border-amber-500/40' },
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${v.toFixed(1)}%`

// ── Main ────────────────────────────────────────────────────────────────────

export default function EGPPlanejamento() {
  const { isLightSidebar: isLight, isDark } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('eap')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [excludedOscs, setExcludedOscs] = useState<Set<string>>(new Set())
  const [criando, setCriando] = useState(false)
  const [novoProjeto, setNovoProjeto] = useState({ nome: '', centro_custo_id: '' })

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: projetos, isLoading: loadingProjetos } = useProjetos(portfolioId)
  const criarProjeto = useCriarProjeto()
  const { data: lookups } = useLookups()

  const handleCriarProjeto = async () => {
    if (!portfolioId || !novoProjeto.nome.trim()) return
    await criarProjeto.mutateAsync({
      portfolio_id: portfolioId,
      nome: novoProjeto.nome.trim(),
      centro_custo_id: novoProjeto.centro_custo_id || undefined,
    })
    setCriando(false)
    setNovoProjeto({ nome: '', centro_custo_id: '' })
  }

  return (
    <div className="space-y-4">
      {/* Header: título + seletor de contrato */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Compass size={20} className="text-blue-500" />
          Gestão dos Projetos
        </h1>
        <ContractSelector />
      </div>

      {/* Tab bar - SEMPRE VISÍVEL no topo */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
      }`}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          const a = TAB_ACCENT[t.key]
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                active
                  ? isLight
                    ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                    : `${a.bgActiveDark} ${a.textActiveDark} ${a.borderDark} font-bold shadow-sm`
                  : isLight
                    ? `${a.bg} ${a.text} font-medium border-transparent`
                    : `${a.bgDark} ${a.textDark} font-medium border-transparent`
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Barra de filtro: Cronograma/Histograma não usam o seletor de Projetos (contrato inteiro) */}
      {tab === 'histograma' || tab === 'custos' ? null : tab === 'cronograma' ? (
        <div id="crono-filters-slot" className="flex items-center gap-2 flex-wrap justify-end" />
      ) : (
        <ProjetosFilterBar
          projetos={projetos ?? []}
          loadingProjetos={loadingProjetos}
          excluded={excluded}
          setExcluded={setExcluded}
          criando={criando}
          setCriando={setCriando}
          novoProjeto={novoProjeto}
          setNovoProjeto={setNovoProjeto}
          handleCriarProjeto={handleCriarProjeto}
          criarProjetoPending={criarProjeto.isPending}
          lookupsCC={lookups?.centros_custo ?? []}
          accentText={isLight ? TAB_ACCENT[tab].text : TAB_ACCENT[tab].textDark}
          accentBg={isLight ? TAB_ACCENT[tab].bg : TAB_ACCENT[tab].bgDark}
          isLight={isLight}
          rightSlot={tab === 'eap' ? <EAPKpis portfolioId={portfolioId} excluded={excluded} excludedOscs={excludedOscs} isLight={isLight} /> : undefined}
        />
      )}

      {/* Tab content */}
      {tab === 'eap' && <EAPFinal portfolioId={portfolioId} excluded={excluded} excludedOscs={excludedOscs} setExcludedOscs={setExcludedOscs} isLight={isLight} />}
      {tab === 'cronograma' && <CronogramaPainel portfolioId={portfolioId} />}
      {tab === 'histograma' && <HistogramaRecursos portfolioId={portfolioId} />}
      {tab === 'custos' && <CustosPainel portfolioId={portfolioId} />}
      {tab === 'orcamento' && <OrcamentoPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'medicao' && <MedicoesPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'riscos' && <RiscosPainel portfolioId={portfolioId} />}
    </div>
  )
}

// ── Componente compartilhado: Barra de projetos com chips ────────────────────
function ProjetosBar({
  projetos, loadingProjetos, projetoId, setProjetoId,
  criando, setCriando, novoProjeto, setNovoProjeto, handleCriarProjeto, criarProjetoPending,
  lookupsCC, tabAccent, isLight,
}: {
  projetos: any[]
  loadingProjetos: boolean
  projetoId: string | null
  setProjetoId: (id: string | null) => void
  criando: boolean
  setCriando: (v: boolean) => void
  novoProjeto: { nome: string; centro_custo_id: string }
  setNovoProjeto: React.Dispatch<React.SetStateAction<{ nome: string; centro_custo_id: string }>>
  handleCriarProjeto: () => void
  criarProjetoPending: boolean
  lookupsCC: { id: string; codigo: string; descricao: string }[]
  tabAccent: { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }
  isLight: boolean
}) {
  const projetosAtivos = projetos.filter(p => p.status !== 'cancelado')

  return (
    <div className={`rounded-2xl border p-3 ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          <FolderKanban size={14} className={tabAccent.text} />
          Projetos do Contrato
          <span className={`text-[10px] font-normal ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            ({projetosAtivos.length})
          </span>
        </h2>
        <button
          onClick={() => setCriando(!criando)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            isLight ? `${tabAccent.bg} ${tabAccent.text}` : `${tabAccent.bgDark} ${tabAccent.textDark}`
          }`}
        >
          <Plus size={12} /> Novo Projeto
        </button>
      </div>

      {criando && (
        <div className={`rounded-xl border p-3 mb-2 space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
          <input
            type="text"
            value={novoProjeto.nome}
            onChange={e => setNovoProjeto((p: any) => ({ ...p, nome: e.target.value }))}
            placeholder="Nome do projeto"
            className={`w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 ${
              isLight ? 'bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-400' : 'bg-slate-800/60 border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 text-white'
            }`}
          />
          <select
            value={novoProjeto.centro_custo_id}
            onChange={e => setNovoProjeto((p: any) => ({ ...p, centro_custo_id: e.target.value }))}
            className={`w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 ${
              isLight ? 'bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-400' : 'bg-slate-800/60 border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 text-white'
            }`}
          >
            <option value="">Centro de custo (opcional)</option>
            {lookupsCC.map(cc => (
              <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.descricao}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button onClick={handleCriarProjeto} disabled={!novoProjeto.nome.trim() || criarProjetoPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
              <Check size={11} /> Criar
            </button>
            <button onClick={() => setCriando(false)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-300'}`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loadingProjetos ? (
        <div className="flex items-center justify-center py-3">
          <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : projetosAtivos.length === 0 ? (
        <p className={`text-xs italic px-2 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Nenhum projeto cadastrado
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setProjetoId(null)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
              projetoId === null
                ? isLight
                  ? `${tabAccent.bgActive} ${tabAccent.textActive} ${tabAccent.border}`
                  : `${tabAccent.bgActiveDark} ${tabAccent.textActiveDark} ${tabAccent.borderDark}`
                : isLight
                  ? 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                  : 'bg-slate-800/40 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            Todos · {projetosAtivos.length}
          </button>
          {projetosAtivos.map(p => {
            const active = projetoId === p.id
            return (
              <button
                key={p.id}
                onClick={() => setProjetoId(p.id)}
                title={p.nome}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                  active
                    ? isLight
                      ? `${tabAccent.bgActive} ${tabAccent.textActive} ${tabAccent.border}`
                      : `${tabAccent.bgActiveDark} ${tabAccent.textActiveDark} ${tabAccent.borderDark}`
                    : isLight
                      ? 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      : 'bg-slate-800/40 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                {p.centro_custo?.codigo ? (
                  <>
                    <span className={`font-mono ${active ? '' : (isLight ? 'text-slate-400' : 'text-slate-500')}`}>
                      {p.centro_custo.codigo}
                    </span>
                    <span>·</span>
                  </>
                ) : null}
                <span className="truncate max-w-[180px]">
                  {(p.centro_custo?.descricao || p.nome).replace(/^CEMIG\s*\|\s*/, '')}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const useTableStyles = (isLight: boolean) => ({
  thCls: `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`,
  tdCls: `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`,
  inputCls: `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 text-white'
  }`,
  cardCls: `rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`,
})

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
  </div>
)

const IAButton = ({ label, onClick, isPending }: { label: string; onClick: () => void; isPending: boolean }) => (
  <button onClick={onClick} disabled={isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
    <Sparkles size={12} /> {isPending ? 'Gerando...' : label}
  </button>
)

// ── EAP Panel ───────────────────────────────────────────────────────────────

function EAPPanel({ portfolioId, projetoId, isLight }: { portfolioId?: string; projetoId?: string | null; isLight: boolean }) {
  const { data: items, isLoading } = useEAP(portfolioId, projetoId)
  const gerarIA = useGerarEAPIA()
  const { thCls, tdCls, cardCls } = useTableStyles(isLight)
  const [view, setView] = useState<'tabela' | 'grafico'>('grafico')

  const handleGerarIA = () => {
    if (!portfolioId) return
    gerarIA.mutate(portfolioId)
  }

  if (isLoading) return <Spinner />

  // Achata a árvore: parents (sorted por ordem) + filhos imediatos (sorted por ordem)
  // Quando "Todos" projetos: agrupa por projeto_id antes
  const flatItems: PMOEAP[] = []
  const indentMap = new Map<string, number>()
  const groupByProj = new Map<string, PMOEAP[]>()
  ;(items ?? []).forEach(it => {
    const k = it.projeto_id ?? '_'
    if (!groupByProj.has(k)) groupByProj.set(k, [])
    groupByProj.get(k)!.push(it)
  })

  for (const [, projItems] of groupByProj) {
    const parents = projItems
      .filter(i => !i.parent_id)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    parents.forEach(parent => {
      flatItems.push(parent)
      indentMap.set(parent.id, 0)
      const children = projItems
        .filter(i => i.parent_id === parent.id)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      children.forEach(child => {
        flatItems.push(child)
        indentMap.set(child.id, 1)
      })
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {/* Toggle Tabela ↔ Gráfico */}
        <div className={`inline-flex rounded-xl p-0.5 border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-white/[0.05] border-white/[0.08]'
        }`}>
          <button
            onClick={() => setView('grafico')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'grafico'
                ? isLight
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'bg-blue-500/15 text-blue-300 shadow-sm'
                : isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch size={13} /> Gráfico
          </button>
          <button
            onClick={() => setView('tabela')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'tabela'
                ? isLight
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'bg-blue-500/15 text-blue-300 shadow-sm'
                : isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table2 size={13} /> Tabela
          </button>
        </div>
        <IAButton label="Gerar EAP com IA" onClick={handleGerarIA} isPending={gerarIA.isPending} />
      </div>

      {(items ?? []).length === 0 ? (
        <div className={cardCls}>
          <p className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum item na EAP. Use "Gerar EAP com IA" para iniciar.
          </p>
        </div>
      ) : !projetoId && view === 'tabela' ? (
        <EAPResumoPorProjeto items={items ?? []} isLight={isLight} />
      ) : view === 'grafico' ? (
        <EAPGrafico items={items ?? []} isLight={isLight} singleProjeto={!!projetoId} />
      ) : (
        <div className={cardCls}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Título</th>
                  <th className={`${thCls} text-right`}>Realizado</th>
                  <th className={`${thCls} text-right`}>Total</th>
                  <th className={`${thCls} text-center`}>%</th>
                  <th className={`${thCls} text-right`}>Peso %</th>
                </tr>
              </thead>
              <tbody>
                {flatItems.map(item => {
                  const indent = indentMap.get(item.id) ?? 0
                  const isParent = !item.parent_id
                  const qr = item.qty_realizado
                  const qt = item.qty_total
                  const u = item.unidade ?? ''
                  const hasQty = qr != null && qt != null
                  const pct = hasQty && qt! > 0 ? Math.round((qr! / qt!) * 100) : null
                  const pctColor = pct == null
                    ? (isLight ? 'text-slate-400' : 'text-slate-500')
                    : pct >= 90
                      ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
                      : pct >= 50
                        ? (isLight ? 'text-blue-600' : 'text-blue-400')
                        : pct > 0
                          ? (isLight ? 'text-amber-600' : 'text-amber-400')
                          : (isLight ? 'text-slate-400' : 'text-slate-500')
                  return (
                    <tr
                      key={item.id}
                      className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'} ${
                        isParent ? (isLight ? 'bg-slate-50/60 font-semibold' : 'bg-white/[0.02] font-semibold') : ''
                      }`}
                    >
                      <td className={tdCls}>
                        <span className="font-mono text-xs">{item.codigo ?? '-'}</span>
                      </td>
                      <td className={tdCls}>
                        <span style={{ paddingLeft: `${indent * 20}px` }}>{item.titulo}</span>
                      </td>
                      <td className={`${tdCls} text-right font-mono text-xs`}>
                        {hasQty ? `${qr!.toLocaleString('pt-BR')} ${u}` : '—'}
                      </td>
                      <td className={`${tdCls} text-right font-mono text-xs`}>
                        {hasQty ? `${qt!.toLocaleString('pt-BR')} ${u}` : '—'}
                      </td>
                      <td className={`${tdCls} text-center font-bold ${pctColor}`}>
                        {pct != null ? `${pct}%` : '—'}
                      </td>
                      <td className={`${tdCls} text-right font-medium`}>{fmtPct(item.peso_percentual)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EAP Resumo por Projeto (visão "Todos" na tabela) ────────────────────────
function EAPResumoPorProjeto({ items, isLight }: { items: PMOEAP[]; isLight: boolean }) {
  const portfolioId = useEGPPortfolioId()
  const { data: projetos } = useProjetos(portfolioId)
  const { thCls, tdCls, cardCls } = useTableStyles(isLight)

  // Pacotes únicos (top-level) — extraídos da EAP
  const pacotesPadrao = Array.from(
    new Map(
      items.filter(i => !i.parent_id).map(i => [i.codigo, { codigo: i.codigo!, titulo: i.titulo }])
    ).values()
  ).sort((a, b) => Number(a.codigo ?? 0) - Number(b.codigo ?? 0))

  // Para cada projeto, calcula % físico realizado (média ponderada por peso)
  const linhas = (projetos ?? []).map(proj => {
    const itensProj = items.filter(i => i.projeto_id === proj.id)
    const pacotes = itensProj.filter(i => !i.parent_id)
    const subItens = itensProj.filter(i => !!i.parent_id)

    let pctPond = 0
    let pesoTotal = 0
    let nComConcluidos = 0
    let nComQty = 0
    subItens.forEach(s => {
      const peso = Number(s.peso_percentual ?? 0)
      pesoTotal += peso
      if (s.qty_total != null && s.qty_realizado != null && s.qty_total > 0) {
        nComQty++
        const p = Math.min((Number(s.qty_realizado) / Number(s.qty_total)) * 100, 100)
        pctPond += (p * peso) / 100
        if (p >= 100) nComConcluidos++
      }
    })
    const pctNorm = pesoTotal > 0 ? (pctPond / pesoTotal) * 100 : 0

    // Por pacote: pct calculado (média ponderada dos sub-itens do pacote)
    const pctPorPacote = new Map<string, number>()
    pacotes.forEach(pac => {
      const subs = subItens.filter(s => s.parent_id === pac.id)
      let pp = 0
      let wp = 0
      subs.forEach(s => {
        const peso = Number(s.peso_percentual ?? 0)
        wp += peso
        if (s.qty_total != null && s.qty_realizado != null && s.qty_total > 0) {
          const p = Math.min((Number(s.qty_realizado) / Number(s.qty_total)) * 100, 100)
          pp += (p * peso) / 100
        }
      })
      pctPorPacote.set(pac.codigo!, wp > 0 ? (pp / wp) * 100 : 0)
    })

    return {
      proj,
      pctNorm,
      n_subitens: subItens.length,
      n_com_qty: nComQty,
      n_concluidos: nComConcluidos,
      pctPorPacote,
    }
  })

  // Total geral (média ponderada simples por número de sub-itens com qty)
  const totalPctPorPacote = new Map<string, number>()
  pacotesPadrao.forEach(pac => {
    let soma = 0
    let cnt = 0
    linhas.forEach(l => {
      const v = l.pctPorPacote.get(pac.codigo)
      if (v != null && v > 0) { soma += v; cnt++ }
    })
    totalPctPorPacote.set(pac.codigo, cnt > 0 ? soma / cnt : 0)
  })
  const totalPctGeral =
    linhas.reduce((s, l) => s + l.pctNorm, 0) / Math.max(linhas.length, 1)
  const totalSubItens = linhas.reduce((s, l) => s + l.n_subitens, 0)
  const totalConcluidos = linhas.reduce((s, l) => s + l.n_concluidos, 0)

  const corPct = (p: number) =>
    p >= 90
      ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
      : p >= 50
        ? (isLight ? 'text-blue-600' : 'text-blue-400')
        : p > 0
          ? (isLight ? 'text-amber-600' : 'text-amber-400')
          : (isLight ? 'text-slate-400' : 'text-slate-500')

  return (
    <div className={cardCls}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Projeto</th>
              {pacotesPadrao.map(p => (
                <th key={p.codigo} className={`${thCls} text-center`} title={p.titulo}>
                  {p.codigo}
                </th>
              ))}
              <th className={`${thCls} text-center`}>Itens</th>
              <th className={`${thCls} text-center`}>% Total</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.proj.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                <td className={tdCls}>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {l.proj.centro_custo?.codigo ?? '-'}
                    </span>
                    <span className="font-semibold">
                      {(l.proj.centro_custo?.descricao || l.proj.nome).replace(/^CEMIG\s*\|\s*/, '')}
                    </span>
                  </div>
                </td>
                {pacotesPadrao.map(pac => {
                  const v = l.pctPorPacote.get(pac.codigo) ?? 0
                  return (
                    <td key={pac.codigo} className={`${tdCls} text-center font-mono text-xs ${corPct(v)}`}>
                      {v > 0 ? `${Math.round(v)}%` : '—'}
                    </td>
                  )
                })}
                <td className={`${tdCls} text-center font-mono text-xs`}>
                  {l.n_concluidos}/{l.n_subitens}
                </td>
                <td className={`${tdCls} text-center font-bold ${corPct(l.pctNorm)}`}>
                  {l.pctNorm > 0 ? `${Math.round(l.pctNorm)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={`border-t-2 ${isLight ? 'border-slate-300 bg-slate-100/60 font-bold' : 'border-white/[0.10] bg-white/[0.04] font-bold'}`}>
              <td className={tdCls}>
                <span className="text-[10px] uppercase tracking-wide">Total Carteira</span>
              </td>
              {pacotesPadrao.map(pac => {
                const v = totalPctPorPacote.get(pac.codigo) ?? 0
                return (
                  <td key={pac.codigo} className={`${tdCls} text-center font-mono text-xs ${corPct(v)}`}>
                    {v > 0 ? `${Math.round(v)}%` : '—'}
                  </td>
                )
              })}
              <td className={`${tdCls} text-center font-mono text-xs`}>
                {totalConcluidos}/{totalSubItens}
              </td>
              <td className={`${tdCls} text-center ${corPct(totalPctGeral)}`}>
                {totalPctGeral > 0 ? `${Math.round(totalPctGeral)}%` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legenda dos pacotes */}
      <div className={`px-4 py-2 border-t flex flex-wrap gap-x-4 gap-y-1 text-[10px] ${
        isLight ? 'border-slate-100 text-slate-500' : 'border-white/[0.04] text-slate-400'
      }`}>
        {pacotesPadrao.map(p => (
          <span key={p.codigo}>
            <span className="font-mono font-bold mr-1">{p.codigo}</span>
            {p.titulo}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Sub-item card (usado em EAPGrafico) ──────────────────────────────────────
function SubItemCard({ sub, cor, isLight }: { sub: PMOEAP; cor: string; isLight: boolean }) {
  const qr = sub.qty_realizado
  const qt = sub.qty_total
  const u = sub.unidade ?? ''
  const hasQty = qr != null && qt != null
  const pct = hasQty && qt! > 0 ? Math.round((qr! / qt!) * 100) : null
  return (
    <div
      className={`text-[11px] rounded-md px-2 py-1.5 border ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={`font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {sub.codigo}
          </span>
          <span className={`font-semibold truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            {sub.titulo}
          </span>
        </div>
        {pct != null && (
          <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: cor }}>
            {pct}%
          </span>
        )}
      </div>
      {hasQty && (
        <div className="flex items-center justify-between mt-1">
          <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {qr!.toLocaleString('pt-BR')} / {qt!.toLocaleString('pt-BR')} {u}
          </span>
          <span className={`text-[9px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            peso {(sub.peso_percentual ?? 0).toFixed(1)}%
          </span>
        </div>
      )}
      {!hasQty && (
        <div className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          peso {(sub.peso_percentual ?? 0).toFixed(1)}%
        </div>
      )}
      {hasQty && pct != null && (
        <div className="h-1 bg-slate-200/60 dark:bg-slate-700/60 rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
        </div>
      )}
    </div>
  )
}

// ── EAP Visão Gráfica (árvore de pacotes em colunas) ─────────────────────────
const SEC_COLOR: Record<string, string> = {
  'serviços preliminares': '#0284c7',
  'canteiro e mobilização': '#0369a1',
  'fundações': '#92400e',
  'montagem de torres': '#374151',
  'lançamento de cabos': '#3730a3',
  'administração local': '#6d28d9',
  'outros': '#4b5563',
}

function corPacote(titulo: string): string {
  return SEC_COLOR[titulo.toLowerCase().trim()] ?? '#374151'
}

function EAPGrafico({ items, isLight, singleProjeto }: { items: PMOEAP[]; isLight: boolean; singleProjeto: boolean }) {
  // Agrupa por projeto_id (quando "Todos") ou trata como um só (quando filtrado)
  const grupos = new Map<string, PMOEAP[]>()
  items.forEach(it => {
    const key = it.projeto_id ?? 'sem-projeto'
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(it)
  })

  return (
    <div className="space-y-4">
      {Array.from(grupos.entries()).map(([projId, projItems]) => {
        const pacotes = projItems.filter(i => !i.parent_id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        const filhos = (parentId: string) =>
          projItems.filter(i => i.parent_id === parentId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

        return (
          <div key={projId} className={`rounded-2xl border p-5 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
          }`}>
            {!singleProjeto && (
              <div className="text-center mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.06] text-slate-200'
                }`}>
                  Projeto {projItems[0]?.projeto_id?.slice(0, 8) ?? ''}
                </span>
              </div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2">
              {pacotes.map(pac => {
                const cor = corPacote(pac.titulo)
                const subs = filhos(pac.id)
                return (
                  <div key={pac.id} className="flex-shrink-0 min-w-[200px] max-w-[260px] flex flex-col gap-2">
                    <div
                      className="text-white font-bold text-xs px-3 py-2 rounded-md text-center shadow-sm"
                      style={{ background: cor }}
                    >
                      <div className="font-mono text-[10px] opacity-80">{pac.codigo}</div>
                      <div>{pac.titulo}</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-base font-bold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        {(pac.peso_percentual ?? 0).toFixed(0)}%
                      </div>
                      <div className={`text-[10px] uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        peso
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(pac.peso_percentual ?? 0, 100)}%`, background: cor }}
                      />
                    </div>

                    {/* Sub-itens */}
                    {subs.length > 0 && (
                      <div className="border-l-2 pl-2 ml-1 space-y-1 mt-1" style={{ borderColor: cor + '40' }}>
                        {subs.map(sub => (
                          <SubItemCard key={sub.id} sub={sub} cor={cor} isLight={isLight} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Cronograma Panel ────────────────────────────────────────────────────────

function CronogramaPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useTarefas(portfolioId)
  const gerarIA = useGerarCronogramaIA()
  const { thCls, tdCls, cardCls } = useTableStyles(isLight)

  const handleGerarIA = () => {
    if (!portfolioId) return
    gerarIA.mutate(portfolioId)
  }

  if (isLoading) return <Spinner />

  const statusCfg: Record<string, { label: string; light: string; dark: string }> = {
    nao_iniciada: { label: 'Não Iniciada', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
    em_andamento: { label: 'Em Andamento', light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-500/15 text-blue-400' },
    concluida: { label: 'Concluída', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    atrasada: { label: 'Atrasada', light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
    bloqueada: { label: 'Bloqueada', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    cancelada: { label: 'Cancelada', light: 'bg-slate-100 text-slate-500', dark: 'bg-slate-600/15 text-slate-500' },
  }

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <IAButton label="Gerar Cronograma IA" onClick={handleGerarIA} isPending={gerarIA.isPending} />
      </div>
      <div className={cardCls}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                <th className={thCls}>Tarefa</th>
                <th className={thCls}>Responsável</th>
                <th className={thCls}>Início Plan.</th>
                <th className={thCls}>Término Plan.</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>% Concluído</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${tdCls} text-center py-10 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhuma tarefa. Use "Gerar Cronograma IA" para iniciar.
                  </td>
                </tr>
              ) : (
                (items ?? []).map((t: PMOTarefa) => {
                  const st = statusCfg[t.status] ?? statusCfg.nao_iniciada
                  return (
                    <tr key={t.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                      <td className={tdCls}>{t.tarefa}</td>
                      <td className={tdCls}>{t.responsavel ?? '-'}</td>
                      <td className={tdCls}>{fmtDate(t.data_inicio_planejado)}</td>
                      <td className={tdCls}>{fmtDate(t.data_termino_planejado)}</td>
                      <td className={tdCls}>
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center gap-2 justify-end">
                          <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(t.percentual_concluido, 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium">{fmtPct(t.percentual_concluido)}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Histograma Panel ────────────────────────────────────────────────────────

function HistogramaPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useHistograma(portfolioId)
  const { cardCls } = useTableStyles(isLight)

  if (isLoading) return <Spinner />

  // Group by categoria
  const grouped = (items ?? []).reduce<Record<string, PMOHistograma[]>>((acc, item) => {
    const cat = item.categoria ?? 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const catLabels: Record<string, string> = { MOD: 'Mão de Obra Direta', MOI: 'Mão de Obra Indireta', maquinario: 'Maquinário' }
  const catColors: Record<string, { plan: string; real: string }> = {
    MOD: { plan: 'bg-blue-500', real: 'bg-blue-300' }, MOI: { plan: 'bg-violet-500', real: 'bg-violet-300' }, maquinario: { plan: 'bg-teal-500', real: 'bg-teal-300' },
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <div className={cardCls}>
        <div className={`text-center py-10 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Nenhum dado de histograma disponível.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, rows]) => {
        const colors = catColors[cat] ?? { plan: 'bg-slate-500', real: 'bg-slate-300' }
        const totalPlan = rows.reduce((s, r) => s + r.quantidade_planejada, 0)
        const totalReal = rows.reduce((s, r) => s + r.quantidade_real, 0)
        const maxVal = Math.max(...rows.map(r => Math.max(r.quantidade_planejada, r.quantidade_real)), 1)

        return (
          <div key={cat} className={cardCls}>
            <div className="p-5">
              <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>
                {catLabels[cat] ?? cat}
              </h3>
              <div className="space-y-3">
                {rows.map(row => {
                  const pW = (row.quantidade_planejada / maxVal) * 100
                  const rW = (row.quantidade_real / maxVal) * 100
                  return (
                    <div key={row.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                          {row.funcao} {row.semana ? `- ${row.semana}` : row.mes ? `- ${row.mes}` : ''}
                        </span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          Plan: {row.quantidade_planejada} | Real: {row.quantidade_real}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className={`h-3 rounded-full ${colors.plan} transition-all`} style={{ width: `${pW}%`, minWidth: pW > 0 ? '4px' : 0 }} />
                      </div>
                      <div className="flex gap-1">
                        <div className={`h-3 rounded-full ${colors.real} transition-all`} style={{ width: `${rW}%`, minWidth: rW > 0 ? '4px' : 0 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-dashed" style={{ borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${colors.plan}`} />
                  <span className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Planejado ({totalPlan})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${colors.real}`} />
                  <span className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Real ({totalReal})</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Orcamento Panel ─────────────────────────────────────────────────────────

function OrcamentoPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useOrcamento(portfolioId)
  const criar = useCriarOrcamento()
  const atualizar = useAtualizarOrcamento()
  const deletar = useDeletarOrcamento()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMOOrcamento>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMOOrcamento>>({ disciplina: '', insumo: '', fase: '', valor_previsto: 0, valor_realizado: 0 })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { thCls, tdCls, inputCls, cardCls } = useTableStyles(isLight)

  const handleAdd = async () => {
    if (!portfolioId || !newRow.disciplina) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ disciplina: '', insumo: '', fase: '', valor_previsto: 0, valor_realizado: 0 })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  if (isLoading) return <Spinner />

  return (
    <div className={cardCls}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Disciplina</th>
              <th className={thCls}>Insumo</th>
              <th className={thCls}>Fase</th>
              <th className={`${thCls} text-right`}>Valor Previsto</th>
              <th className={`${thCls} text-right`}>Valor Realizado</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.disciplina ?? ''} onChange={e => setEditRow(r => ({ ...r, disciplina: e.target.value }))} /> : item.disciplina}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.insumo ?? ''} onChange={e => setEditRow(r => ({ ...r, insumo: e.target.value }))} /> : item.insumo ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.fase ?? ''} onChange={e => setEditRow(r => ({ ...r, fase: e.target.value }))} /> : item.fase ?? '-'}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {isEditing ? <input type="number" className={inputCls} value={editRow.valor_previsto ?? 0} onChange={e => setEditRow(r => ({ ...r, valor_previsto: Number(e.target.value) }))} /> : fmtBRL(item.valor_previsto)}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {isEditing ? <input type="number" className={inputCls} value={editRow.valor_realizado ?? 0} onChange={e => setEditRow(r => ({ ...r, valor_realizado: Number(e.target.value) }))} /> : fmtBRL(item.valor_realizado)}
                  </td>
                  <td className={tdCls}>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {adding && (
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-blue-50/30' : 'border-white/[0.04] bg-blue-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Disciplina" value={newRow.disciplina ?? ''} onChange={e => setNewRow(r => ({ ...r, disciplina: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Insumo" value={newRow.insumo ?? ''} onChange={e => setNewRow(r => ({ ...r, insumo: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Fase" value={newRow.fase ?? ''} onChange={e => setNewRow(r => ({ ...r, fase: e.target.value }))} /></td>
                <td className={tdCls}><input type="number" className={inputCls} placeholder="0" value={newRow.valor_previsto ?? 0} onChange={e => setNewRow(r => ({ ...r, valor_previsto: Number(e.target.value) }))} /></td>
                <td className={tdCls}><input type="number" className={inputCls} placeholder="0" value={newRow.valor_realizado ?? 0} onChange={e => setNewRow(r => ({ ...r, valor_realizado: Number(e.target.value) }))} /></td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <button
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}
    </div>
  )
}

// ── Riscos Panel ────────────────────────────────────────────────────────────

const PROB_OPTS = [{ value: 'baixa', label: 'Baixa' }, { value: 'media', label: 'Média' }, { value: 'alta', label: 'Alta' }, { value: 'muito_alta', label: 'Muito Alta' }]
const IMPACTO_OPTS = [{ value: 'baixo', label: 'Baixo' }, { value: 'medio', label: 'Médio' }, { value: 'alto', label: 'Alto' }, { value: 'muito_alto', label: 'Muito Alto' }]
const STATUS_RISCO_OPTS = [{ value: 'aberto', label: 'Aberto' }, { value: 'mitigando', label: 'Mitigando' }, { value: 'aceito', label: 'Aceito' }, { value: 'fechado', label: 'Fechado' }]

function RiscosPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useRiscosEGP(portfolioId)
  const criar = useCriarRisco()
  const atualizar = useAtualizarRisco()
  const deletar = useDeletarRisco()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMORisco>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMORisco>>({ descricao: '', categoria: '', probabilidade: 'media', impacto: 'medio', resposta: '', responsavel: '', status: 'aberto' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { thCls, tdCls, inputCls, cardCls } = useTableStyles(isLight)

  const handleAdd = async () => {
    if (!portfolioId || !newRow.descricao) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ descricao: '', categoria: '', probabilidade: 'media', impacto: 'medio', resposta: '', responsavel: '', status: 'aberto' })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  if (isLoading) return <Spinner />

  const badgeCfg: Record<string, { light: string; dark: string }> = {
    baixa: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    baixo: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    media: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    medio: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    alta: { light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
    alto: { light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
    muito_alta: { light: 'bg-red-200 text-red-800', dark: 'bg-red-500/25 text-red-300' },
    muito_alto: { light: 'bg-red-200 text-red-800', dark: 'bg-red-500/25 text-red-300' },
    aberto: { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-500/15 text-blue-400' },
    mitigando: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    aceito: { light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
    fechado: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  }

  const Badge = ({ value }: { value?: string }) => {
    const cfg = badgeCfg[value ?? ''] ?? { light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' }
    const label = (value ?? '-').replace('_', ' ')
    return <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${isLight ? cfg.light : cfg.dark}`}>{label}</span>
  }

  return (
    <div className={cardCls}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Categoria</th>
              <th className={thCls}>Prob.</th>
              <th className={thCls}>Impacto</th>
              <th className={thCls}>Resposta</th>
              <th className={thCls}>Responsável</th>
              <th className={thCls}>Status</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.descricao ?? ''} onChange={e => setEditRow(r => ({ ...r, descricao: e.target.value }))} /> : item.descricao}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.categoria ?? ''} onChange={e => setEditRow(r => ({ ...r, categoria: e.target.value }))} /> : item.categoria ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.probabilidade ?? 'media'} onChange={e => setEditRow(r => ({ ...r, probabilidade: e.target.value as PMORisco['probabilidade'] }))}>
                        {PROB_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : <Badge value={item.probabilidade} />}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.impacto ?? 'medio'} onChange={e => setEditRow(r => ({ ...r, impacto: e.target.value as PMORisco['impacto'] }))}>
                        {IMPACTO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : <Badge value={item.impacto} />}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.resposta ?? ''} onChange={e => setEditRow(r => ({ ...r, resposta: e.target.value }))} /> : item.resposta ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.responsavel ?? ''} onChange={e => setEditRow(r => ({ ...r, responsavel: e.target.value }))} /> : item.responsavel ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.status ?? 'aberto'} onChange={e => setEditRow(r => ({ ...r, status: e.target.value as PMORisco['status'] }))}>
                        {STATUS_RISCO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : <Badge value={item.status} />}
                  </td>
                  <td className={tdCls}>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {adding && (
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-blue-50/30' : 'border-white/[0.04] bg-blue-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Descrição" value={newRow.descricao ?? ''} onChange={e => setNewRow(r => ({ ...r, descricao: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Categoria" value={newRow.categoria ?? ''} onChange={e => setNewRow(r => ({ ...r, categoria: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.probabilidade ?? 'media'} onChange={e => setNewRow(r => ({ ...r, probabilidade: e.target.value as PMORisco['probabilidade'] }))}>
                    {PROB_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.impacto ?? 'medio'} onChange={e => setNewRow(r => ({ ...r, impacto: e.target.value as PMORisco['impacto'] }))}>
                    {IMPACTO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={tdCls}><input className={inputCls} placeholder="Resposta" value={newRow.resposta ?? ''} onChange={e => setNewRow(r => ({ ...r, resposta: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Responsável" value={newRow.responsavel ?? ''} onChange={e => setNewRow(r => ({ ...r, responsavel: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.status ?? 'aberto'} onChange={e => setNewRow(r => ({ ...r, status: e.target.value as PMORisco['status'] }))}>
                    {STATUS_RISCO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <button
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <Plus size={14} /> Adicionar risco
          </button>
        </div>
      )}
    </div>
  )
}
