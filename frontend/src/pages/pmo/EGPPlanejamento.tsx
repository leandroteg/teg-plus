import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Compass, Network, CalendarDays, BarChart3, DollarSign,
  AlertTriangle, Plus, Trash2, Save, Edit3, X, Check, Sparkles, FolderKanban, ChevronRight,
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
import type { PMOEAP, PMOTarefa, PMOHistograma, PMOOrcamento, PMORisco } from '../../types/pmo'

type Tab = 'eap' | 'cronograma' | 'histograma' | 'orcamento' | 'riscos'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'eap', label: 'EAP', icon: Network },
  { key: 'cronograma', label: 'Cronograma', icon: CalendarDays },
  { key: 'histograma', label: 'Histograma', icon: BarChart3 },
  { key: 'orcamento', label: 'Orçamento', icon: DollarSign },
  { key: 'riscos', label: 'Riscos', icon: AlertTriangle },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  eap:         { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-blue-500/10',    textDark: 'text-blue-400',    textActiveDark: 'text-blue-300',    borderDark: 'border-blue-500/40' },
  cronograma:  { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-teal-500/10',    textDark: 'text-teal-400',    textActiveDark: 'text-teal-300',    borderDark: 'border-teal-500/40' },
  histograma:  { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10',  textDark: 'text-violet-400',  textActiveDark: 'text-violet-300',  borderDark: 'border-violet-500/40' },
  orcamento:   { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-emerald-500/10', textDark: 'text-emerald-400', textActiveDark: 'text-emerald-300', borderDark: 'border-emerald-500/40' },
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
  const [projetoId, setProjetoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [novoProjeto, setNovoProjeto] = useState({ nome: '', centro_custo_id: '' })

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: projetos, isLoading: loadingProjetos } = useProjetos(portfolioId)
  const criarProjeto = useCriarProjeto()
  const { data: lookups } = useLookups()

  const projetoAtivo = projetos?.find(p => p.id === projetoId) ?? null

  const handleCriarProjeto = async () => {
    if (!portfolioId || !novoProjeto.nome.trim()) return
    const p = await criarProjeto.mutateAsync({
      portfolio_id: portfolioId,
      nome: novoProjeto.nome.trim(),
      centro_custo_id: novoProjeto.centro_custo_id || undefined,
    })
    setProjetoId(p.id)
    setCriando(false)
    setNovoProjeto({ nome: '', centro_custo_id: '' })
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => projetoId ? setProjetoId(null) : nav('/egp/planejamento')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> {projetoId ? 'Voltar aos Projetos' : 'Voltar'}
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Compass size={20} className="text-blue-500" />
          Planejamento
        </h1>
        {portfolio && (
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {portfolio.nome_obra} - {portfolio.numero_osc}{projetoAtivo ? ` → ${projetoAtivo.nome}` : ''}
          </p>
        )}
      </div>

      {/* Project selector or Tabs */}
      {!projetoId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              <FolderKanban size={16} className="text-blue-500" /> Projetos do Contrato
            </h2>
            <button
              onClick={() => setCriando(!criando)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isLight ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
              }`}
            >
              <Plus size={14} /> Novo Projeto
            </button>
          </div>

          {criando && (
            <div className={`rounded-2xl border p-4 space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <input
                type="text"
                value={novoProjeto.nome}
                onChange={e => setNovoProjeto(p => ({ ...p, nome: e.target.value }))}
                placeholder="Nome do projeto"
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isLight ? 'bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-400' : 'bg-slate-800/60 border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 text-white'
                }`}
              />
              <select
                value={novoProjeto.centro_custo_id}
                onChange={e => setNovoProjeto(p => ({ ...p, centro_custo_id: e.target.value }))}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isLight ? 'bg-white border-slate-200 focus:ring-blue-500/20 focus:border-blue-400' : 'bg-slate-800/60 border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 text-white'
                }`}
              >
                <option value="">Centro de custo (opcional)</option>
                {(lookups?.centros_custo ?? []).map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.descricao}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleCriarProjeto} disabled={!novoProjeto.nome.trim() || criarProjeto.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
                  <Check size={12} /> Criar
                </button>
                <button onClick={() => setCriando(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-300'}`}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {loadingProjetos ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (projetos ?? []).length === 0 ? (
            <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
              <p className={`text-sm font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum projeto cadastrado</p>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Crie um projeto para iniciar o planejamento</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(projetos ?? []).filter(p => p.status !== 'cancelado').map(p => {
                const statusCfg: Record<string, { label: string; cls: string }> = {
                  ativo:     { label: 'Ativo',     cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
                  suspenso:  { label: 'Suspenso',  cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
                  concluido: { label: 'Concluído', cls: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400' },
                  cancelado: { label: 'Cancelado', cls: isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/15 text-red-400' },
                }
                const st = statusCfg[p.status] ?? statusCfg.ativo
                return (
                  <button
                    key={p.id}
                    onClick={() => setProjetoId(p.id)}
                    className={`group text-left rounded-2xl border p-4 transition-all duration-200 ${
                      isLight
                        ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10'
                        : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className={`font-semibold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{p.nome}</h3>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    {p.centro_custo && (
                      <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>CC: {p.centro_custo.codigo} - {p.centro_custo.nome}</p>
                    )}
                    {p.responsavel && (
                      <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{p.responsavel}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-3 text-xs font-medium transition-colors ${
                      isLight ? 'text-blue-500 group-hover:text-blue-600' : 'text-blue-400 group-hover:text-blue-300'
                    }`}>
                      Acessar Planejamento <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Tab bar */}
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

          {/* Tab content */}
          {tab === 'eap' && <EAPPanel portfolioId={portfolioId} isLight={isLight} />}
          {tab === 'cronograma' && <CronogramaPanel portfolioId={portfolioId} isLight={isLight} />}
          {tab === 'histograma' && <HistogramaPanel portfolioId={portfolioId} isLight={isLight} />}
          {tab === 'orcamento' && <OrcamentoPanel portfolioId={portfolioId} isLight={isLight} />}
          {tab === 'riscos' && <RiscosPanel portfolioId={portfolioId} isLight={isLight} />}
        </>
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

function EAPPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useEAP(portfolioId)
  const gerarIA = useGerarEAPIA()
  const { thCls, tdCls, cardCls } = useTableStyles(isLight)

  const handleGerarIA = () => {
    if (!portfolioId) return
    gerarIA.mutate(portfolioId)
  }

  if (isLoading) return <Spinner />

  // Build indentation map from parent_id
  const indentMap = new Map<string, number>()
  const buildIndent = (list: PMOEAP[]) => {
    list.forEach(item => {
      if (!item.parent_id) {
        indentMap.set(item.id, 0)
      } else {
        indentMap.set(item.id, (indentMap.get(item.parent_id) ?? 0) + 1)
      }
    })
  }
  buildIndent(items ?? [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <IAButton label="Gerar EAP com IA" onClick={handleGerarIA} isPending={gerarIA.isPending} />
      </div>
      <div className={cardCls}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                <th className={thCls}>Código</th>
                <th className={thCls}>Título</th>
                <th className={thCls}>Fase</th>
                <th className={`${thCls} text-right`}>Peso %</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className={`${tdCls} text-center py-10 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhum item na EAP. Use "Gerar EAP com IA" para iniciar.
                  </td>
                </tr>
              ) : (
                (items ?? []).map(item => {
                  const indent = indentMap.get(item.id) ?? 0
                  return (
                    <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                      <td className={tdCls}>
                        <span className="font-mono text-xs">{item.codigo ?? '-'}</span>
                      </td>
                      <td className={tdCls}>
                        <span style={{ paddingLeft: `${indent * 20}px` }}>{item.titulo}</span>
                      </td>
                      <td className={tdCls}>{item.fase ?? '-'}</td>
                      <td className={`${tdCls} text-right font-medium`}>{fmtPct(item.peso_percentual)}</td>
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
