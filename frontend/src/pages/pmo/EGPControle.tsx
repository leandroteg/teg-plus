import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, Ruler, Calendar, TrendingUp,
  Scale, FileText, Activity, AlertTriangle,
  Plus, Check, FolderKanban, ChevronRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import {
  usePortfolio, useProjetos, useCriarProjeto,
  useMedicaoResumo, useMedicaoItens,
  useMudancas, useMultas, useStatusReports, useIndicadores,
} from '../../hooks/usePMO'
import { useLookups } from '../../hooks/useLookups'
import type {
  PMOMedicaoResumo, PMOMedicaoItem, PMOMudanca, PMOMulta,
  PMOStatusReport, PMOIndicadoresSnapshot,
} from '../../types/pmo'

type Tab = 'medicoes' | 'eventos' | 'status_report' | 'indicadores'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'medicoes', label: 'Medições', icon: Ruler },
  { key: 'eventos', label: 'Eventos', icon: AlertTriangle },
  { key: 'status_report', label: 'Status Report', icon: FileText },
  { key: 'indicadores', label: 'Indicadores', icon: Activity },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  medicoes:       { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-emerald-500/10', textDark: 'text-emerald-400', textActiveDark: 'text-emerald-300', borderDark: 'border-emerald-500/40' },
  eventos:        { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-amber-500/10',   textDark: 'text-amber-400',   textActiveDark: 'text-amber-300',   borderDark: 'border-amber-500/40' },
  status_report:  { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-blue-500/10',    textDark: 'text-blue-400',    textActiveDark: 'text-blue-300',    borderDark: 'border-blue-500/40' },
  indicadores:    { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10',  textDark: 'text-violet-400',  textActiveDark: 'text-violet-300',  borderDark: 'border-violet-500/40' },
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const fmtNum = (v?: number | null) => (v != null ? v.toLocaleString('pt-BR') : '-')

const fmtData = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-'

// ── Main ────────────────────────────────────────────────────────────────────

export default function EGPControle() {
  const { isLightSidebar: isLight } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('medicoes')
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
        onClick={() => projetoId ? setProjetoId(null) : nav('/egp/controle')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> {projetoId ? 'Voltar aos Projetos' : 'Voltar'}
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <BarChart3 size={20} className="text-emerald-500" />
          Controle
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
              <FolderKanban size={16} className="text-emerald-500" /> Projetos do Contrato
            </h2>
            <button
              onClick={() => setCriando(!criando)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isLight ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
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
                  isLight ? 'bg-white border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-400' : 'bg-slate-800/60 border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500 text-white'
                }`}
              />
              <select
                value={novoProjeto.centro_custo_id}
                onChange={e => setNovoProjeto(p => ({ ...p, centro_custo_id: e.target.value }))}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                  isLight ? 'bg-white border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-400' : 'bg-slate-800/60 border-slate-700 focus:ring-emerald-500/20 focus:border-emerald-500 text-white'
                }`}
              >
                <option value="">Centro de custo (opcional)</option>
                {(lookups?.centros_custo ?? []).map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.descricao}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleCriarProjeto} disabled={!novoProjeto.nome.trim() || criarProjeto.isPending}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50">
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
              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : (projetos ?? []).length === 0 ? (
            <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <FolderKanban size={32} className="mx-auto mb-3 opacity-40" />
              <p className={`text-sm font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum projeto cadastrado</p>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Crie um projeto para iniciar o controle</p>
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
                        ? 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/10'
                        : 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5'
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
                      isLight ? 'text-emerald-500 group-hover:text-emerald-600' : 'text-emerald-400 group-hover:text-emerald-300'
                    }`}>
                      Acessar Controle <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
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
      {tab === 'medicoes' && <MedicoesPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'eventos' && <EventosPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'status_report' && <StatusReportPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'indicadores' && <IndicadoresPanel portfolioId={portfolioId} isLight={isLight} />}
        </>
      )}
    </div>
  )
}

// ── Medicoes Panel ──────────────────────────────────────────────────────────

function MedicoesPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: resumo, isLoading: loadResumo } = useMedicaoResumo(portfolioId)
  const { data: itens, isLoading: loadItens } = useMedicaoItens(portfolioId)

  if (loadResumo || loadItens) return <Spinner />

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const valueCls = `text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`
  const thCls = `text-left text-xs font-semibold uppercase tracking-wide py-3 px-4 ${
    isLight ? 'text-slate-400 bg-slate-50' : 'text-slate-500 bg-white/[0.02]'
  }`
  const tdCls = `py-3 px-4 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={cardCls}>
          <p className={labelCls}>Valor Contrato</p>
          <p className={valueCls}>{resumo ? fmtBRL(resumo.valor_contrato) : '-'}</p>
        </div>
        <div className={cardCls}>
          <p className={labelCls}>Total Medido</p>
          <p className={valueCls}>{resumo ? fmtBRL(resumo.total_medido_valor) : '-'}</p>
          {resumo && (
            <p className={`text-xs mt-0.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
              {fmtPct(resumo.total_medido_pct)}
            </p>
          )}
        </div>
        <div className={cardCls}>
          <p className={labelCls}>A Medir</p>
          <p className={valueCls}>{resumo ? fmtBRL(resumo.total_a_medir_valor) : '-'}</p>
          {resumo && (
            <p className={`text-xs mt-0.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>
              {fmtPct(resumo.total_a_medir_pct)}
            </p>
          )}
        </div>
        <div className={cardCls + ' flex items-center justify-center'}>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20"
          >
            <Scale size={14} />
            Solicitar Faturamento
          </button>
        </div>
      </div>

      {/* Items table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <h3 className={`text-sm font-bold px-5 pt-5 pb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>
          Itens de Medição
        </h3>
        {(!itens || itens.length === 0) ? (
          <EmptyState isLight={isLight} message="Nenhum item de medição cadastrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                  <th className={thCls}>#</th>
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>Unidade</th>
                  <th className={thCls + ' text-right'}>Qtd Prevista</th>
                  <th className={thCls + ' text-right'}>Preco Unit.</th>
                  <th className={thCls + ' text-right'}>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr
                    key={item.id}
                    className={`border-b transition-colors ${
                      isLight ? 'border-slate-50 hover:bg-slate-50/50' : 'border-white/[0.03] hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className={tdCls + ' font-mono text-xs'}>{item.numero_medicao}</td>
                    <td className={`${tdCls} font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{item.item_descricao}</td>
                    <td className={tdCls}>{item.unidade ?? '-'}</td>
                    <td className={tdCls + ' text-right font-mono'}>{fmtNum(item.quantidade_prevista)}</td>
                    <td className={tdCls + ' text-right font-mono'}>{fmtBRL(item.preco_unitario)}</td>
                    <td className={`${tdCls} text-right font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{fmtBRL(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Eventos Panel ───────────────────────────────────────────────────────────

function EventosPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: mudancas, isLoading: loadM } = useMudancas(portfolioId)
  const { data: multas, isLoading: loadMu } = useMultas(portfolioId)

  if (loadM || loadMu) return <Spinner />

  const cardCls = `rounded-2xl border overflow-hidden ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const thCls = `text-left text-xs font-semibold uppercase tracking-wide py-3 px-4 ${
    isLight ? 'text-slate-400 bg-slate-50' : 'text-slate-500 bg-white/[0.02]'
  }`
  const tdCls = `py-3 px-4 text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`

  const PARECER_CFG: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
    aprovado: { label: 'Aprovado', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
    reprovado: { label: 'Reprovado', cls: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400' },
    em_analise: { label: 'Em Análise', cls: isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-400' },
  }

  const STATUS_MULTA_CFG: Record<string, { label: string; cls: string }> = {
    notificada: { label: 'Notificada', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
    em_defesa: { label: 'Em Defesa', cls: isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/15 text-blue-400' },
    confirmada: { label: 'Confirmada', cls: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400' },
    cancelada: { label: 'Cancelada', cls: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400' },
    paga: { label: 'Paga', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
  }

  const IMPACTO_CFG: Record<string, { label: string; cls: string }> = {
    baixo: { label: 'Baixo', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
    medio: { label: 'Médio', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
    alto: { label: 'Alto', cls: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400' },
  }

  return (
    <div className="space-y-4">
      {/* Mudancas */}
      <div className={cardCls}>
        <div className="px-5 pt-5 pb-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <TrendingUp size={14} className="text-emerald-500" />
            Mudanças
          </h3>
        </div>
        {(!mudancas || mudancas.length === 0) ? (
          <EmptyState isLight={isLight} message="Nenhuma mudança registrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Descrição</th>
                  <th className={thCls}>Impacto Prazo</th>
                  <th className={thCls}>Parecer</th>
                </tr>
              </thead>
              <tbody>
                {mudancas.map(m => {
                  const imp = IMPACTO_CFG[m.impacto_prazo] ?? { label: m.impacto_prazo, cls: '' }
                  const par = PARECER_CFG[m.parecer] ?? { label: m.parecer, cls: '' }
                  return (
                    <tr
                      key={m.id}
                      className={`border-b transition-colors ${
                        isLight ? 'border-slate-50 hover:bg-slate-50/50' : 'border-white/[0.03] hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {m.tipo.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={tdCls + ' max-w-xs truncate'}>{m.descricao}</td>
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${imp.cls}`}>
                          {imp.label}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${par.cls}`}>
                          {par.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multas */}
      <div className={cardCls}>
        <div className="px-5 pt-5 pb-3">
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <AlertTriangle size={14} className="text-red-500" />
            Multas
          </h3>
        </div>
        {(!multas || multas.length === 0) ? (
          <EmptyState isLight={isLight} message="Nenhuma multa registrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Descrição</th>
                  <th className={thCls + ' text-right'}>Valor Estimado</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {multas.map(mu => {
                  const st = STATUS_MULTA_CFG[mu.status] ?? { label: mu.status, cls: '' }
                  return (
                    <tr
                      key={mu.id}
                      className={`border-b transition-colors ${
                        isLight ? 'border-slate-50 hover:bg-slate-50/50' : 'border-white/[0.03] hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          isLight ? 'bg-red-50 text-red-600' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {mu.tipo_multa.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className={tdCls + ' max-w-xs truncate'}>{mu.descricao}</td>
                      <td className={`${tdCls} text-right font-mono font-semibold ${isLight ? 'text-red-600' : 'text-red-400'}`}>
                        {fmtBRL(mu.valor_estimado)}
                      </td>
                      <td className={tdCls}>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status Report Panel ─────────────────────────────────────────────────────

function StatusReportPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: reports, isLoading } = useStatusReports(portfolioId)

  if (isLoading) return <Spinner />

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    rascunho: { label: 'Rascunho', cls: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400' },
    publicado: { label: 'Publicado', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
    revisao: { label: 'Revisão', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
  }

  if (!reports || reports.length === 0) {
    return <EmptyState isLight={isLight} message="Nenhum status report cadastrado" />
  }

  return (
    <div className="space-y-4">
      {reports.map(r => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.rascunho
        const delta = r.delta_faturamento
        const deltaColor = delta >= 0
          ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
          : (isLight ? 'text-red-600' : 'text-red-400')

        return (
          <div key={r.id} className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'
                }`}>
                  <Calendar size={14} className="text-emerald-500" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {r.periodo}
                  </p>
                  <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmtData(r.data_report)}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>
                {st.label}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={labelCls}>OS Total</p>
                <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {r.os_total}
                </p>
              </div>
              <div>
                <p className={labelCls}>Faturamento Atual</p>
                <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {fmtBRL(r.faturamento_atual)}
                </p>
              </div>
              <div>
                <p className={labelCls}>Meta Faturamento</p>
                <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {fmtBRL(r.meta_faturamento)}
                </p>
              </div>
              <div>
                <p className={labelCls}>Delta</p>
                <p className={`text-lg font-bold ${deltaColor}`}>
                  {delta >= 0 ? '+' : ''}{fmtBRL(delta)}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Indicadores Panel ───────────────────────────────────────────────────────

function IndicadoresPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: snapshots, isLoading } = useIndicadores(portfolioId)

  if (isLoading) return <Spinner />

  const latest = snapshots?.[0]

  if (!latest) {
    return <EmptyState isLight={isLight} message="Nenhum snapshot de indicadores encontrado" />
  }

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const valueCls = `text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`

  const getIndexColor = (v?: number | null) => {
    if (v == null) return isLight ? 'text-slate-400' : 'text-slate-500'
    if (v >= 1) return isLight ? 'text-emerald-600' : 'text-emerald-400'
    if (v >= 0.9) return isLight ? 'text-amber-600' : 'text-amber-400'
    return isLight ? 'text-red-600' : 'text-red-400'
  }

  const metrics: { label: string; value: string; color?: string; icon: React.ElementType }[] = [
    {
      label: 'SPI (IDP)',
      value: latest.idp != null ? latest.idp.toFixed(2) : '-',
      color: getIndexColor(latest.idp),
      icon: TrendingUp,
    },
    {
      label: 'CPI (IDC)',
      value: latest.idc != null ? latest.idc.toFixed(2) : '-',
      color: getIndexColor(latest.idc),
      icon: BarChart3,
    },
    {
      label: '% Valor Executado',
      value: latest.pct_valor_executado != null ? fmtPct(latest.pct_valor_executado) : '-',
      icon: Scale,
    },
    {
      label: 'Multas Acumuladas',
      value: latest.multas_acumuladas != null ? fmtBRL(latest.multas_acumuladas) : '-',
      color: latest.multas_acumuladas && latest.multas_acumuladas > 0
        ? (isLight ? 'text-red-600' : 'text-red-400')
        : undefined,
      icon: AlertTriangle,
    },
    {
      label: 'Produção Mensal',
      value: fmtNum(latest.producao_mensal),
      icon: Activity,
    },
    {
      label: 'Taxa Frequência',
      value: latest.taxa_frequencia != null ? latest.taxa_frequencia.toFixed(2) : '-',
      icon: FileText,
    },
    {
      label: 'Horas Trabalhadas',
      value: fmtNum(latest.horas_trabalhadas),
      icon: Ruler,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Snapshot date */}
      <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Snapshot: {fmtData(latest.data_snapshot)}
      </p>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className={cardCls}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isLight ? 'bg-emerald-50' : 'bg-emerald-500/10'
                }`}>
                  <Icon size={13} className="text-emerald-500" />
                </div>
                <p className={`${labelCls} !mb-0`}>{m.label}</p>
              </div>
              <p className={`${valueCls} ${m.color ?? ''}`}>
                {m.value}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared helpers ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ isLight, message }: { isLight: boolean; message: string }) {
  return (
    <div className={`rounded-2xl border p-10 text-center ${
      isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{message}</p>
    </div>
  )
}
