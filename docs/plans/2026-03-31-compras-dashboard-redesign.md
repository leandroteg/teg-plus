# Compras Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `Dashboard.tsx` (rota `/compras`) seguindo o padrão visual/arquitetural do `LogisticaHome.tsx` — dark mode via `useTheme()`, hero card, Pulso por Status, Requisições Urgentes e Vencidas/À vencer.

**Architecture:** Rewrite completo do `Dashboard.tsx` mantendo as mesmas queries (`useDashboard` + `useRequisicoes`). Filtros de urgentes e vencidas são client-side sobre os dados já carregados. Sub-componentes locais copiados do padrão LogísticaHome (`SpotlightMetric`, `HorizontalStatusBar`, `MiniInfoCard`, `EmptyPanel`, `toneClasses`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, Lucide React, `useTheme()`, `useDashboard()`, `useRequisicoes()`, `useNavigate()`

---

## Contexto do arquivo atual

- **Arquivo:** `frontend/src/pages/Dashboard.tsx`
- **Rota:** `/compras` (App.tsx linha 391)
- **Queries:** `useDashboard(periodo, obraId)` + `useRequisicoes()` + `useLookupObras()`
- **Problema:** `bg-white` hardcoded sem dark mode, KpiCard simples sem `useTheme()`, sem hero card, sem seções urgentes/vencidas

## Referência visual

- **Modelo:** `frontend/src/pages/logistica/LogisticaHome.tsx`
- Sub-componentes locais a copiar/adaptar: `toneClasses`, `SpotlightMetric`, `HorizontalStatusBar`, `MiniInfoCard`, `EmptyPanel`

---

## Task 1: Estrutura base + Header + helpers

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (rewrite completo)

**Step 1: Reescrever imports e helpers no topo**

Substituir todo o conteúdo do arquivo começando pelos imports. Manter os imports existentes e adicionar:

```tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Clock, CheckCircle, DollarSign,
  RefreshCw, Settings, TrendingUp, AlertTriangle,
  Package, ChevronRight, ShoppingCart, Timer,
  ArrowRight, CalendarClock, XCircle, Zap,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useRequisicoes } from '../hooks/useRequisicoes'
import { useLookupObras } from '../hooks/useLookups'
import { useTheme } from '../contexts/ThemeContext'
import StatusBadge from '../components/StatusBadge'
import FluxoTimeline from '../components/FluxoTimeline'
import { isPlaceholder } from '../services/supabase'
import type { StatusRequisicao, DashboardData, Aprovacao, Requisicao } from '../types'
```

**Step 2: Adicionar `toneClasses` helper (idêntico ao LogísticaHome)**

```tsx
function toneClasses(
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'orange' | 'blue' | 'violet' | 'red' | 'slate' | 'indigo'
) {
  const map = {
    sky:     { text: 'text-sky-600',     soft: 'bg-sky-50 text-sky-700 border-sky-100',         icon: 'bg-sky-50 text-sky-500' },
    emerald: { text: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-500' },
    cyan:    { text: 'text-cyan-600',    soft: 'bg-cyan-50 text-cyan-700 border-cyan-100',       icon: 'bg-cyan-50 text-cyan-500' },
    amber:   { text: 'text-amber-600',   soft: 'bg-amber-50 text-amber-700 border-amber-100',    icon: 'bg-amber-50 text-amber-500' },
    teal:    { text: 'text-teal-600',    soft: 'bg-teal-50 text-teal-700 border-teal-100',       icon: 'bg-teal-50 text-teal-500' },
    orange:  { text: 'text-orange-600',  soft: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'bg-orange-50 text-orange-500' },
    blue:    { text: 'text-blue-600',    soft: 'bg-blue-50 text-blue-700 border-blue-100',       icon: 'bg-blue-50 text-blue-500' },
    violet:  { text: 'text-violet-600',  soft: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'bg-violet-50 text-violet-500' },
    red:     { text: 'text-red-600',     soft: 'bg-red-50 text-red-700 border-red-100',          icon: 'bg-red-50 text-red-500' },
    slate:   { text: 'text-slate-500',   soft: 'bg-slate-50 text-slate-600 border-slate-100',    icon: 'bg-slate-50 text-slate-400' },
    indigo:  { text: 'text-indigo-600',  soft: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'bg-indigo-50 text-indigo-500' },
  } as const
  return map[tone]
}
```

**Step 3: Adicionar constantes de pipeline e formatadores**

```tsx
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

const PIPELINE_ETAPAS = [
  { key: 'pendentes',   label: 'Pendentes',   statuses: ['rascunho', 'pendente'] as StatusRequisicao[],                          color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   barClass: 'bg-amber-400'   },
  { key: 'valid_tec',   label: 'Valid. Téc.', statuses: ['em_aprovacao'] as StatusRequisicao[],                                  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    barClass: 'bg-blue-500'    },
  { key: 'cotacao',     label: 'Cotação',     statuses: ['aprovada', 'em_cotacao', 'cotacao_enviada'] as StatusRequisicao[],     color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  barClass: 'bg-violet-500'  },
  { key: 'aprov_fin',   label: 'Aprov. Fin.', statuses: ['cotacao_aprovada'] as StatusRequisicao[],                              color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  barClass: 'bg-indigo-500'  },
  { key: 'pedido',      label: 'Pedido',      statuses: ['pedido_emitido'] as StatusRequisicao[],                                color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-200',    barClass: 'bg-cyan-500'    },
  { key: 'entrega',     label: 'Entrega',     statuses: ['em_entrega', 'entregue'] as StatusRequisicao[],                       color: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-teal-200',    barClass: 'bg-teal-500'    },
  { key: 'pagamento',   label: 'Pagamento',   statuses: ['aguardando_pgto', 'pago'] as StatusRequisicao[],                      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', barClass: 'bg-emerald-500' },
]

const STATUS_ATIVO: StatusRequisicao[] = [
  'rascunho', 'pendente', 'em_aprovacao', 'aprovada', 'em_esclarecimento',
  'em_cotacao', 'cotacao_enviada', 'cotacao_aprovada', 'pedido_emitido',
  'em_entrega', 'entregue', 'aguardando_pgto',
]

const NIVEL_LABEL: Record<number, string> = { 1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO' }
```

**Step 4: Verificar no browser que não há erros de compilação**

Salvar e verificar console do preview.

---

## Task 2: Sub-componentes locais

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Adicionar `SpotlightMetric`**

```tsx
function SpotlightMetric({
  label, value, note, tone,
}: {
  label: string
  value: number | string
  note: string
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'slate' | 'indigo' | 'orange' | 'blue' | 'violet' | 'red'
}) {
  const { isDark } = useTheme()
  const palette = toneClasses(tone)
  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : `${palette.soft} border`}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${palette.text}`}>{value}</p>
      <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{note}</p>
    </div>
  )
}
```

**Step 2: Adicionar `HorizontalStatusBar`**

```tsx
function HorizontalStatusBar({
  title, segments, emptyLabel, isDark,
}: {
  title: string
  segments: Array<{ key: string; label: string; value: number; barClass: string }>
  emptyLabel: string
  isDark: boolean
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} RC(s)</p>
      </div>
      {segments.length === 0 ? (
        <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          {emptyLabel}
        </div>
      ) : (
        <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {segments.map(seg => {
            const pct = (seg.value / total) * 100
            const showLabel = pct >= 14
            const showValue = pct >= 22
            return (
              <div
                key={seg.key}
                className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }}
                title={`${seg.label}: ${seg.value}`}
              >
                {showLabel && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {seg.label} {showValue ? seg.value : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* legenda */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segments.map(seg => (
          <span key={seg.key} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${seg.barClass}`} />
            {seg.label}: <span className="font-bold text-slate-700">{seg.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Adicionar `MiniInfoCard` e `EmptyPanel`**

```tsx
function MiniInfoCard({
  label, value, note, icon: Icon, iconTone, isDark,
}: {
  label: string; value: number; note: string
  icon: typeof FileText; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
          <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
          <Icon size={14} className={iconTone} />
        </div>
      </div>
    </div>
  )
}

function EmptyPanel({ isDark, title, description }: { isDark: boolean; title: string; description: string }) {
  return (
    <div className={`px-4 py-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{title}</p>
      <p className="text-[10px] mt-1">{description}</p>
    </div>
  )
}
```

---

## Task 3: Componente `UrgentesCard` e `VencidasCard`

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Adicionar `UrgentesCard`**

```tsx
function UrgentesCard({ reqs, isDark, nav }: { reqs: Requisicao[]; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-red-500/30' : 'bg-white border border-red-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-red-500/20' : 'border-b border-red-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
          <Zap size={14} className="text-red-500" /> Requisições Urgentes
        </h2>
        <button
          onClick={() => nav('/requisicoes?urgencia=urgente')}
          className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5"
        >
          Ver todas <ArrowRight size={10} />
        </button>
      </div>
      {reqs.length === 0 ? (
        <EmptyPanel
          isDark={isDark}
          title="Nenhuma requisição urgente"
          description="Requisições marcadas como urgente ou crítica aparecem aqui para priorização imediata."
        />
      ) : (
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-red-50'}`}>
          {reqs.slice(0, 5).map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => nav(`/requisicoes/${r.id}`)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-red-50/50'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.urgencia === 'critica' ? (isDark ? 'bg-red-500/20' : 'bg-red-100') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50')}`}>
                <AlertTriangle size={14} className={r.urgencia === 'critica' ? 'text-red-500' : 'text-amber-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.numero}</p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.urgencia === 'critica' ? 'CRÍTICA' : 'URGENTE'}
                  </span>
                </div>
                <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.descricao}</p>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={r.status} size="sm" />
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.obra_nome}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
```

**Step 2: Adicionar `VencidasCard`**

```tsx
function VencidasCard({ reqs, isDark, nav }: { reqs: Requisicao[]; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  const hoje = Date.now()
  const tresDias = 3 * 24 * 3600_000

  return (
    <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-amber-500/30' : 'bg-white border border-amber-200'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-amber-500/20' : 'border-b border-amber-100'}`}>
        <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
          <CalendarClock size={14} className="text-amber-500" /> Vencidas / À vencer
        </h2>
        <button
          onClick={() => nav('/requisicoes?vencidas=1')}
          className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5"
        >
          Ver todas <ArrowRight size={10} />
        </button>
      </div>
      {reqs.length === 0 ? (
        <EmptyPanel
          isDark={isDark}
          title="Nenhuma RC vencida ou próxima do prazo"
          description="RCs com prazo de necessidade vencido ou vencendo nos próximos 3 dias aparecem aqui."
        />
      ) : (
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-amber-50'}`}>
          {reqs.slice(0, 5).map(r => {
            const prazo = r.created_at ? new Date(r.created_at).getTime() : 0
            // Usa created_at como proxy se data_necessidade não existir no tipo base
            const dataNecessidade = (r as any).data_necessidade
            const prazoTs = dataNecessidade ? new Date(dataNecessidade).getTime() : 0
            const vencida = prazoTs > 0 && prazoTs < hoje
            const aVencer = prazoTs > 0 && prazoTs >= hoje && prazoTs <= hoje + tresDias
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => nav(`/requisicoes/${r.id}`)}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-amber-50/50'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${vencida ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50')}`}>
                  {vencida ? <XCircle size={14} className="text-red-500" /> : <Timer size={14} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.numero}</p>
                    {vencida && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">VENCIDA</span>}
                    {aVencer && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">À VENCER</span>}
                  </div>
                  <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.descricao}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={r.status} size="sm" />
                  {dataNecessidade && (
                    <p className={`text-[9px] mt-0.5 font-semibold ${vencida ? 'text-red-500' : 'text-amber-600'}`}>
                      Prazo: {fmtData(dataNecessidade)}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

---

## Task 4: Componente principal `Dashboard` — rewrite

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Reescrever a função `Dashboard` principal**

```tsx
export default function Dashboard() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const [periodo, setPeriodo] = useState('trimestre')
  const [obraFilter, setObraFilter] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState<number | null>(null)
  const obras = useLookupObras()
  const { data, isLoading, isError, error, refetch } = useDashboard(periodo, obraFilter || undefined)
  const { data: todasReqs = [] } = useRequisicoes()

  if (isPlaceholder) return <SetupRequired />
  if (isLoading) return <Loader />
  if (isError) return <ErrorPanel error={error} refetch={refetch} />

  const kpis = data?.kpis ?? EMPTY_KPIS
  const por_obra = data?.por_obra ?? []
  const aprovacoes_pendentes = data?.aprovacoes_pendentes ?? []
  const reqs = todasReqs.length > 0 ? todasReqs : (data?.requisicoes_recentes ?? [])

  // Aprovação map
  const aprovacaoMap = new Map<string, Aprovacao>(
    aprovacoes_pendentes.map(a => [a.requisicao_id, a])
  )

  // Contagem por etapa pipeline
  const pipelineContagens = PIPELINE_ETAPAS.map(etapa =>
    reqs.filter(r => etapa.statuses.includes(r.status)).length
  )

  // Segmentos para HorizontalStatusBar
  const statusSegments = PIPELINE_ETAPAS
    .map((etapa, i) => ({ key: etapa.key, label: etapa.label, value: pipelineContagens[i], barClass: etapa.barClass }))
    .filter(s => s.value > 0)

  // Recentes filtradas pelo pipeline selecionado
  const recentes = pipelineFilter !== null
    ? reqs.filter(r => PIPELINE_ETAPAS[pipelineFilter].statuses.includes(r.status))
    : reqs.slice(0, 8)

  // Urgentes: urgencia urgente ou critica, status ativo
  const urgentes = useMemo(() =>
    reqs.filter(r =>
      (r.urgencia === 'urgente' || r.urgencia === 'critica') &&
      STATUS_ATIVO.includes(r.status)
    ).sort((a, b) => {
      // critica antes de urgente
      if (a.urgencia === 'critica' && b.urgencia !== 'critica') return -1
      if (b.urgencia === 'critica' && a.urgencia !== 'critica') return 1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }),
    [reqs]
  )

  // Vencidas / À vencer: data_necessidade <= hoje + 3 dias, status ativo
  const hoje = Date.now()
  const tresDias = 3 * 24 * 3600_000
  const vencidasAVencer = useMemo(() =>
    reqs.filter(r => {
      const dataNecessidade = (r as any).data_necessidade
      if (!dataNecessidade) return false
      if (!STATUS_ATIVO.includes(r.status)) return false
      const ts = new Date(dataNecessidade).getTime()
      return ts <= hoje + tresDias
    }).sort((a, b) => {
      const tsA = new Date((a as any).data_necessidade).getTime()
      const tsB = new Date((b as any).data_necessidade).getTime()
      return tsA - tsB
    }),
    [reqs, hoje]
  )

  // Tempo médio de aprovação formatado
  const tempoMedio = kpis.tempo_medio_aprovacao_horas > 0
    ? kpis.tempo_medio_aprovacao_horas >= 24
      ? `${(kpis.tempo_medio_aprovacao_horas / 24).toFixed(1)}d`
      : `${Math.round(kpis.tempo_medio_aprovacao_horas)}h`
    : '—'

  const cardClass = isDark
    ? 'bg-[#1e293b] border border-white/[0.06]'
    : 'bg-white border border-slate-200'

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Painel — Compras
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Requisições, cotações e pedidos de compra
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-teal-400' : 'text-slate-400 hover:text-teal-600'}`}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {[['semana', 'Sem'], ['mes', 'Mês'], ['trimestre', 'Trim'], ['tudo', 'Tudo']].map(([val, lbl]) => (
            <button key={val} onClick={() => setPeriodo(val)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                periodo === val
                  ? 'bg-teal-600 text-white shadow-sm'
                  : isDark ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-white text-slate-500 border border-slate-200'
              }`}>
              {lbl}
            </button>
          ))}
        </div>
        <select
          value={obraFilter}
          onChange={e => setObraFilter(e.target.value)}
          className={`text-[11px] font-semibold rounded-full px-2.5 py-1.5 border transition-all appearance-none cursor-pointer max-w-[140px] truncate ${
            obraFilter
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          <option value="">Todas obras</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>
          ))}
        </select>
      </div>

      {/* ── Hero 2 colunas ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3">

        {/* Núcleo de Compras */}
        <section className={`rounded-3xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Núcleo de Compras
                </p>
                <h2 className={`mt-1.5 text-[1.9rem] md:text-[2.45rem] leading-none font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {fmt(kpis.valor_total_mes)}
                </h2>
                <p className={`mt-2 text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {kpis.total_mes} RC(s) no período · {kpis.aguardando_aprovacao} aguardando aprovação · {kpis.aprovadas_mes} aprovadas
                </p>
              </div>
              <div className={`hidden md:flex w-12 h-12 rounded-2xl items-center justify-center ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <ShoppingCart size={22} className="text-teal-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <SpotlightMetric
                label="Total RCs"
                value={kpis.total_mes}
                tone="teal"
                note="no período selecionado"
              />
              <SpotlightMetric
                label="Aguard. Aprovação"
                value={kpis.aguardando_aprovacao}
                tone={kpis.aguardando_aprovacao > 5 ? 'amber' : 'sky'}
                note={kpis.aguardando_aprovacao > 5 ? 'atenção: fila alta' : 'fila sob controle'}
              />
              <SpotlightMetric
                label="Valor Total"
                value={fmt(kpis.valor_total_mes)}
                tone="indigo"
                note="em compras no período"
              />
              <SpotlightMetric
                label="Tempo Médio Aprov."
                value={tempoMedio}
                tone={kpis.tempo_medio_aprovacao_horas > 48 ? 'amber' : 'emerald'}
                note={kpis.tempo_medio_aprovacao_horas > 48 ? 'acima do SLA 48h' : 'dentro do SLA'}
              />
            </div>
          </div>
        </section>

        {/* Janela Crítica */}
        <section className={`rounded-3xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className="p-4 md:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Crítica
                </p>
                <h2 className={`mt-1.5 text-base md:text-[17px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige ação agora
                </h2>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${urgentes.length > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={16} className={urgentes.length > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>

            <div className={`rounded-2xl p-3 ${urgentes.length > 0 ? 'bg-red-50 border border-red-100' : isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-widest ${urgentes.length > 0 ? 'text-red-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Urgentes Pendentes
                  </p>
                  <p className={`mt-1.5 text-[2rem] leading-none font-black ${urgentes.length > 0 ? 'text-red-600' : isDark ? 'text-white' : 'text-slate-800'}`}>
                    {urgentes.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${vencidasAVencer.length > 0 ? 'text-amber-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {vencidasAVencer.length} vencidas/à vencer
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    prazo: data de necessidade
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MiniInfoCard
                label="Rejeitadas"
                value={kpis.rejeitadas_mes}
                note="no período"
                icon={XCircle}
                iconTone="text-red-500"
                isDark={isDark}
              />
              <MiniInfoCard
                label="Em Cotação"
                value={reqs.filter(r => ['em_cotacao', 'cotacao_enviada', 'cotacao_aprovada'].includes(r.status)).length}
                note="aguardando definição"
                icon={FileText}
                iconTone="text-violet-500"
                isDark={isDark}
              />
            </div>
          </div>
        </section>
      </div>

      {/* ── Pulso por Status ────────────────────────────────────────────── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-teal-500" /> Pulso por Status
          </h2>
          {pipelineFilter !== null && (
            <button onClick={() => setPipelineFilter(null)} className="text-[10px] text-teal-600 font-semibold">
              Ver todos ×
            </button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuição atual do pipeline"
            emptyLabel="Nenhuma RC no período"
            segments={statusSegments}
          />
          {/* Pipeline clicável por etapa */}
          <div className="grid grid-cols-7 gap-1 pt-1">
            {PIPELINE_ETAPAS.map((etapa, i) => {
              const count = pipelineContagens[i]
              const active = pipelineFilter === i
              return (
                <button key={etapa.key} onClick={() => setPipelineFilter(active ? null : i)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    active ? `${etapa.bg} ${etapa.border} shadow-sm` : isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                  <span className={`text-base font-extrabold leading-none ${active ? etapa.color : count > 0 ? (isDark ? 'text-slate-300' : 'text-slate-700') : isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                    {count}
                  </span>
                  <span className={`text-[8px] font-semibold text-center leading-tight ${active ? etapa.color : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {etapa.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Urgentes + Vencidas ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <UrgentesCard reqs={urgentes} isDark={isDark} nav={nav} />
        <VencidasCard reqs={vencidasAVencer} isDark={isDark} nav={nav} />
      </div>

      {/* ── Por Obra ────────────────────────────────────────────────────── */}
      {por_obra.length > 0 && (
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Package size={14} className="text-slate-500" /> Por Obra
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {por_obra.map(o => {
              const maxValor = Math.max(...por_obra.map(x => x.valor), 1)
              const pct = Math.round((o.valor / maxValor) * 100)
              return (
                <div key={o.obra_nome} className={`rounded-2xl p-3.5 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/80 border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{o.obra_nome}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.total} RC{o.total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-teal-600">{fmt(o.valor)}</p>
                      {o.pendentes > 0 && (
                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5 justify-end mt-0.5">
                          <AlertTriangle size={9} /> {o.pendentes} pend.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Recentes ────────────────────────────────────────────────────── */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Clock size={14} className="text-slate-500" />
            {pipelineFilter !== null ? PIPELINE_ETAPAS[pipelineFilter].label : 'Recentes'}
          </h2>
          <button onClick={() => nav('/requisicoes')}
            className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
            Ver todas <ChevronRight size={11} />
          </button>
        </div>
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
          {recentes.length === 0 ? (
            <EmptyPanel isDark={isDark} title="Nenhuma requisição encontrada" description="Ajuste os filtros de período ou obra para ver mais resultados." />
          ) : (
            recentes.slice(0, 8).map(r => (
              <RecentCard key={r.id} r={r} aprovacao={aprovacaoMap.get(r.id)} isDark={isDark} nav={nav} />
            ))
          )}
        </div>
      </section>

    </div>
  )
}
```

---

## Task 5: Refatorar `RecentCard`, `Loader`, `ErrorPanel`, `SetupRequired`

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Reescrever `RecentCard` com dark mode**

```tsx
function RecentCard({ r, aprovacao, isDark, nav }: { r: any; aprovacao?: Aprovacao; isDark: boolean; nav: ReturnType<typeof useNavigate> }) {
  const approvalLabel = r.status === 'pendente' ? 'Aguard. Valid. Técnica'
    : r.status === 'em_aprovacao' ? 'Em Validação Técnica'
    : r.status === 'cotacao_aprovada' ? 'Aguard. Aprov. Financeira'
    : undefined

  return (
    <button
      type="button"
      onClick={() => nav(`/requisicoes/${r.id}`)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.numero}</span>
          <StatusBadge status={r.status as StatusRequisicao} size="sm" customLabel={approvalLabel} />
          {(r.urgencia === 'urgente' || r.urgencia === 'critica') && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.urgencia === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {r.urgencia === 'critica' ? 'CRÍTICA' : 'URGENTE'}
            </span>
          )}
        </div>
        <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{r.descricao}</p>
        {aprovacao && (
          <div className="flex items-center gap-1 mt-1">
            <Clock size={9} className="text-amber-500" />
            <span className="text-[10px] text-amber-600 font-medium truncate">
              Aguardando {aprovacao.aprovador_nome}
              {aprovacao.nivel ? ` (${NIVEL_LABEL[aprovacao.nivel] ?? `Nível ${aprovacao.nivel}`})` : ''}
            </span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[80px]`}>{r.obra_nome}</p>
        <p className="text-sm font-extrabold text-teal-600">
          {r.valor_estimado?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) ?? '—'}
        </p>
      </div>
    </button>
  )
}
```

**Step 2: Reescrever `Loader` e adicionar `ErrorPanel` com dark mode**

```tsx
function Loader() {
  const { isDark } = useTheme()
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin ${isDark ? 'border-teal-400' : 'border-teal-500'}`} />
    </div>
  )
}

function ErrorPanel({ error, refetch }: { error: unknown; refetch: () => void }) {
  const { isDark } = useTheme()
  const errMsg = ((error as any)?.message ?? (error as any)?.details ?? 'Erro desconhecido') as string
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Erro ao carregar dados</p>
      <p className="text-xs text-red-500 font-mono">{errMsg}</p>
      <button onClick={refetch}
        className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 text-teal-600 rounded-xl text-sm font-semibold">
        <RefreshCw size={14} /> Tentar novamente
      </button>
    </div>
  )
}
```

**Step 3: Manter `SetupRequired` como está (não precisa de dark mode)**

---

## Task 6: Verificação final

**Step 1: Verificar no browser — abrir `/compras`**

Conferir:
- [ ] Header "Painel — Compras" com botão Atualizar
- [ ] Filtros de período e obra funcionando
- [ ] Hero 2 colunas com 4 SpotlightMetrics + Janela Crítica
- [ ] Pulso por Status com barra horizontal + grid de 7 etapas clicáveis
- [ ] Seção Urgentes e Vencidas/À vencer (pode estar vazia, EmptyPanel deve aparecer)
- [ ] Seção Por Obra (se tiver dados)
- [ ] Seção Recentes filtrando ao clicar no pipeline
- [ ] Dark mode: alternar tema e conferir que nenhum `bg-white` hardcoded aparece
- [ ] Sem erros no console

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(compras): redesign painel seguindo padrao LogisticaHome

- Dark mode completo via useTheme()
- Hero card Nucleo de Compras com 4 SpotlightMetrics
- Janela Critica com urgentes + vencidas/à vencer count
- Pulso por Status: HorizontalStatusBar + grid pipeline clicavel
- Secoes Requisicoes Urgentes e Vencidas/À vencer
- Por Obra e Recentes com dark mode

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
