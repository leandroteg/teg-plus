import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, RefreshCw, Search, ExternalLink,
  GitBranch, MessageSquare, Tag, Clock, Sparkles,
  X, AlertCircle, CheckCircle, Bug, Lightbulb,
  HelpCircle, ListChecks, Filter, ChevronRight,
  Code2, Send, FileCode2, Loader2, ArrowUpRight,
  CircleDot, GitPullRequestDraft, Plus, Zap,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ────────────────────────────────────────────────────────────────────────

interface GHLabel {
  name: string
  color: string
}

interface GHIssue {
  number: number
  title: string
  state: string
  labels: GHLabel[]
  created_at: string
  updated_at: string
  body: string | null
  comments: number
  user: string
  html_url: string
}

interface GHComment {
  id: number
  body: string
  user: string
  created_at: string
  updated_at: string
  is_ai_spec: boolean
}

interface GHIssueDetail extends Omit<GHIssue, 'comments'> {
  comments_count: number
  comments: GHComment[]
}

// ── Constants ────────────────────────────────────────────────────────────────────

const GH_REPO = 'leandroteg/teg-plus'
const GH_API = `https://api.github.com/repos/${GH_REPO}`
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''
const GH_HEADERS: HeadersInit = {
  'Authorization': `Bearer ${GH_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

const LABEL_ICONS: Record<string, React.ElementType> = {
  bug: Bug,
  enhancement: Lightbulb,
  question: HelpCircle,
  documentation: FileCode2,
}

const LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'd73a4a': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'a2eeef': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  '0075ca': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'e4e669': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  '008672': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'cfd3d7': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  'd876e3': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'ffffff': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  '7057ff': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  'b60205': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
}

function getLabelStyle(color: string) {
  return LABEL_COLORS[color] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
}

// ── GitHub API helpers ───────────────────────────────────────────────────────────

async function ghFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    headers: GH_HEADERS,
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

interface GHIssueRaw {
  number: number; title: string; state: string; body: string | null
  labels: Array<{ name: string; color: string }>
  created_at: string; updated_at: string; comments: number
  user: { login: string } | null; html_url: string
}
interface GHCommentRaw {
  id: number; body: string; user: { login: string } | null
  created_at: string; updated_at: string
}

function mapIssue(i: GHIssueRaw): GHIssue {
  return {
    number: i.number, title: i.title, state: i.state, body: i.body,
    labels: i.labels.map(l => ({ name: l.name, color: l.color })),
    created_at: i.created_at, updated_at: i.updated_at,
    comments: i.comments, user: i.user?.login || 'unknown', html_url: i.html_url,
  }
}

function mapComment(c: GHCommentRaw): GHComment {
  return {
    id: c.id, body: c.body, user: c.user?.login || 'unknown',
    created_at: c.created_at, updated_at: c.updated_at,
    is_ai_spec: c.body?.includes('## \uD83E\uDD16 AI Specification') || false,
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────────────

function useIssues(state: string, label?: string) {
  return useQuery({
    queryKey: ['dev-issues', state, label],
    queryFn: async () => {
      let url = `/issues?state=${state}&per_page=50&sort=updated&direction=desc`
      if (label) url += `&labels=${encodeURIComponent(label)}`
      const raw = await ghFetch<GHIssueRaw[]>(url)
      return raw.map(mapIssue)
    },
    staleTime: 60_000,
    retry: 1,
  })
}

function useIssueDetail(number: number | null) {
  return useQuery({
    queryKey: ['dev-issue', number],
    queryFn: async () => {
      const [issue, comments] = await Promise.all([
        ghFetch<GHIssueRaw>(`/issues/${number}`),
        ghFetch<GHCommentRaw[]>(`/issues/${number}/comments?per_page=100`),
      ])
      return {
        ...mapIssue(issue),
        comments_count: issue.comments,
        comments: comments.map(mapComment),
      } as GHIssueDetail
    },
    enabled: !!number,
    staleTime: 30_000,
    retry: 1,
  })
}

function usePostComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ number, comment }: { number: number; comment: string }) => {
      const result = await ghFetch<{ id: number; html_url: string }>(
        `/issues/${number}/comments`,
        {
          method: 'POST',
          headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: comment }),
        }
      )
      return result
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['dev-issue', vars.number] })
      qc.invalidateQueries({ queryKey: ['dev-issues'] })
    },
  })
}

function useCreateIssue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; body: string; labels: string[] }) => {
      const result = await ghFetch<{ number: number; title: string; html_url: string }>(
        '/issues',
        {
          method: 'POST',
          headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dev-issues'] })
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (seconds < 60) return 'agora'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function extractModule(title: string): string | null {
  const match = title.match(/^\[([A-Z]+)\]\s/)
  return match ? match[1] : null
}

function stripModulePrefix(title: string): string {
  return title.replace(/^\[[A-Z]+\]\s*/, '')
}

/** Call SuperTEG AI Agent (Gemini Flash) to generate a real implementation spec */
const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

async function generateAISpec(issue: GHIssueDetail): Promise<string> {
  const module = extractModule(issue.title) || 'GERAL'
  const tipo = issue.labels.find(l => l.name === 'bug') ? 'Bug Fix' :
    issue.labels.find(l => l.name === 'enhancement') ? 'Feature/Enhancement' : 'Task'
  const labelsStr = issue.labels.map(l => l.name).join(', ') || 'none'

  // Build a rich prompt for the SuperTEG Agent (Gemini Flash)
  const aiPrompt = `Você é um arquiteto de software sênior do TEG+ ERP. Gere uma especificação técnica DETALHADA de implementação para esta GitHub Issue.

## Issue #${issue.number}: ${issue.title}
- **Tipo:** ${tipo}
- **Módulo:** ${module}
- **Labels:** ${labelsStr}
- **Autor:** @${issue.user}
- **Criada em:** ${new Date(issue.created_at).toLocaleDateString('pt-BR')}

### Descrição Original:
${issue.body || 'Sem descrição fornecida.'}

---

## Stack do projeto TEG+ ERP:
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS + TanStack Query v5 + React Router v6
- Backend: Supabase (PostgreSQL 15 + Auth + RLS + Realtime)
- Automação: n8n (webhooks)
- Deploy: Vercel
- Estrutura: frontend/src/pages/, frontend/src/hooks/ (15 hooks), frontend/src/services/api.ts, frontend/src/services/supabase.ts
- Módulos: Compras, Financeiro, Estoque, Logística, Frotas, RH, Cadastros, Fiscal, SSMA, Contratos
- Padrão UI: rounded-2xl, shadow-card, navy/teal/violet palette, lucide-react icons

## GERE a especificação com:
1. **Objetivo** — O que resolver e por quê
2. **Análise Técnica** — Arquivos afetados, dependências, riscos
3. **Plano de Implementação** — Passos numerados e detalhados
4. **Schema/Dados** — Se envolve DB: tabelas, colunas, RLS policies, migrations
5. **Critérios de Aceite** — Lista com checkboxes específicos e testáveis
6. **Notas para o Desenvolvedor** — Edge cases, patterns a seguir, armadilhas a evitar

Responda em Markdown formatado. Seja específico e técnico, não genérico.`

  const response = await fetch(`${N8N_BASE}/superteg/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: aiPrompt,
      session_id: `devhub_spec_${issue.number}_${Date.now()}`,
    }),
  })

  if (!response.ok) {
    throw new Error(`SuperTEG AI respondeu com status ${response.status}`)
  }

  const data = await response.json()
  // The SuperTEG webhook returns: { resposta, session_id, user_nome, timestamp }
  // Handle both array and object responses
  const result = Array.isArray(data) ? data[0]?.json || data[0] : data
  const aiText = result?.resposta || result?.json?.resposta || result?.output || ''

  if (!aiText || aiText.length < 50) {
    throw new Error('Resposta da IA muito curta ou vazia')
  }

  return `## 🤖 AI Specification — Issue #${issue.number}

> Gerado por **SuperTEG AI** (Google Gemini Flash) · ${new Date().toISOString().split('T')[0]}

---

${aiText}

---
*🤖 Powered by SuperTEG AI Agent · TEG+ Dev Hub*`
}

// ── Sub-Components ───────────────────────────────────────────────────────────────

function LabelBadge({ label }: { label: GHLabel }) {
  const style = getLabelStyle(label.color)
  const Icon = LABEL_ICONS[label.name] || Tag
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
      font-bold border ${style.bg} ${style.text} ${style.border}`}>
      <Icon size={10} />
      {label.name}
    </span>
  )
}

function StatePill({ state }: { state: string }) {
  if (state === 'open') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
        font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CircleDot size={10} />
        Open
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]
      font-bold bg-violet-50 text-violet-700 border border-violet-200">
      <GitPullRequestDraft size={10} />
      Closed
    </span>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <GitBranch size={28} className="text-slate-300" />
      </div>
      <p className="text-sm font-bold text-navy mb-1">Nenhuma issue encontrada</p>
      <p className="text-xs text-slate-400 max-w-[240px] mx-auto">
        Tente alterar os filtros ou criar uma nova issue
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="flex flex-col items-center gap-3">
        <span className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Carregando issues...</p>
      </div>
    </div>
  )
}

// ── Issue Card ───────────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  isSelected,
  onClick,
}: {
  issue: GHIssue
  isSelected: boolean
  onClick: () => void
}) {
  const module = extractModule(issue.title)
  const cleanTitle = stripModulePrefix(issue.title)
  const typeLabel = issue.labels.find(l => ['bug', 'enhancement', 'question'].includes(l.name))
  const TypeIcon = typeLabel ? (LABEL_ICONS[typeLabel.name] || Tag) : ListChecks

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl shadow-card overflow-hidden
        transition-all duration-200 group
        ${isSelected
          ? 'ring-2 ring-primary shadow-lg scale-[1.01]'
          : 'hover:shadow-md hover:scale-[1.005] active:scale-[0.995]'}`}
    >
      <div className="px-4 py-3.5">
        {/* Top row: number + module + time */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-mono font-bold text-slate-400">#{issue.number}</span>
          {module && (
            <span className="px-1.5 py-0.5 rounded-md bg-navy/8 text-navy text-[10px] font-bold">
              {module}
            </span>
          )}
          <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-1">
            <Clock size={9} />
            {timeAgo(issue.updated_at)}
          </span>
        </div>

        {/* Title */}
        <div className="flex items-start gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5
            ${typeLabel?.name === 'bug'
              ? 'bg-red-100 text-red-600'
              : typeLabel?.name === 'enhancement'
                ? 'bg-amber-100 text-amber-600'
                : 'bg-blue-100 text-blue-600'
            }`}>
            <TypeIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-navy leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {cleanTitle}
            </p>
            {issue.body && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                {issue.body.replace(/[#*\-_>`\n]/g, ' ').trim().substring(0, 120)}
              </p>
            )}
          </div>
        </div>

        {/* Bottom row: labels + comments */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <StatePill state={issue.state} />
          {issue.labels.map(l => (
            <LabelBadge key={l.name} label={l} />
          ))}
          <span className="ml-auto" />
          {issue.comments > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
              <MessageSquare size={10} />
              {issue.comments}
            </span>
          )}
          <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  )
}

// ── Issue Detail Panel ───────────────────────────────────────────────────────────

function IssueDetailPanel({
  issueNumber,
  onClose,
}: {
  issueNumber: number
  onClose: () => void
}) {
  const { data: issue, isLoading, isError } = useIssueDetail(issueNumber)
  const postComment = usePostComment()
  const [generatingSpec, setGeneratingSpec] = useState(false)
  const [specSuccess, setSpecSuccess] = useState(false)
  const [newComment, setNewComment] = useState('')

  const [specError, setSpecError] = useState<string | null>(null)

  const handleGenerateSpec = useCallback(async () => {
    if (!issue) return
    setGeneratingSpec(true)
    setSpecSuccess(false)
    setSpecError(null)
    try {
      // 1. Call SuperTEG AI Agent (Gemini Flash) to generate spec
      const spec = await generateAISpec(issue)
      // 2. Post the AI-generated spec as a GitHub comment
      await postComment.mutateAsync({ number: issue.number, comment: spec })
      setSpecSuccess(true)
      setTimeout(() => setSpecSuccess(false), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar spec com IA'
      setSpecError(msg)
      setTimeout(() => setSpecError(null), 6000)
    } finally {
      setGeneratingSpec(false)
    }
  }, [issue, postComment])

  const handlePostComment = useCallback(async () => {
    if (!issue || !newComment.trim()) return
    await postComment.mutateAsync({ number: issue.number, comment: newComment.trim() })
    setNewComment('')
  }, [issue, newComment, postComment])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col
        animate-[slideIn_0.2s_ease-out]"
        style={{ '--tw-enter-translate-x': '100%' } as React.CSSProperties}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-navy hover:bg-slate-200 transition-colors">
            <X size={16} />
          </button>
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-xs text-slate-400 font-mono font-bold">#{issueNumber}</p>
                <p className="text-sm font-bold text-navy truncate">{issue?.title}</p>
              </>
            )}
          </div>
          {issue && (
            <a
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="p-5 text-center">
              <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
              <p className="text-sm text-red-600 font-semibold">Erro ao carregar issue</p>
            </div>
          ) : issue ? (
            <div className="divide-y divide-slate-50">
              {/* Meta info */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatePill state={issue.state} />
                  {issue.labels.map(l => (
                    <LabelBadge key={l.name} label={l} />
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Code2 size={11} />
                    @{issue.user}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(issue.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={11} />
                    {issue.comments_count} comentários
                  </span>
                </div>
              </div>

              {/* Issue body */}
              {issue.body && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Descrição
                  </p>
                  <div className="prose prose-sm prose-slate max-w-none text-sm leading-relaxed
                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-navy [&_h2]:mt-4 [&_h2]:mb-2
                    [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-navy
                    [&_hr]:my-3 [&_hr]:border-slate-100
                    [&_strong]:font-bold [&_strong]:text-navy
                    [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_pre]:bg-slate-900 [&_pre]:text-green-400 [&_pre]:rounded-xl [&_pre]:p-3 [&_pre]:text-xs [&_pre]:font-mono
                    [&_ul]:space-y-1 [&_li]:text-slate-600">
                    {issue.body.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>
                      if (line.startsWith('### ')) return <h3 key={i}>{line.replace('### ', '')}</h3>
                      if (line.startsWith('---')) return <hr key={i} />
                      if (line.startsWith('**') && line.endsWith('**')) return <p key={i}><strong>{line.replace(/\*\*/g, '')}</strong></p>
                      if (line.startsWith('- [ ] ')) return <div key={i} className="flex items-center gap-2 text-slate-600"><input type="checkbox" disabled className="rounded" /><span className="text-sm">{line.replace('- [ ] ', '')}</span></div>
                      if (line.startsWith('- [x] ')) return <div key={i} className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked disabled className="rounded" /><span className="text-sm line-through opacity-50">{line.replace('- [x] ', '')}</span></div>
                      if (line.startsWith('- ')) return <div key={i} className="flex items-start gap-2 text-slate-600 text-sm"><span className="text-slate-400 mt-1">•</span>{line.replace('- ', '')}</div>
                      if (line.startsWith('> ')) return <blockquote key={i} className="border-l-3 border-primary/30 pl-3 text-slate-500 italic text-sm">{line.replace('> ', '')}</blockquote>
                      if (line.match(/^\*\*.+\*\*:/)) {
                        const [label, ...rest] = line.split(':')
                        return <p key={i} className="text-sm text-slate-600"><strong className="text-navy">{label.replace(/\*\*/g, '')}:</strong>{rest.join(':')}</p>
                      }
                      if (line.trim() === '') return <div key={i} className="h-2" />
                      return <p key={i} className="text-sm text-slate-600">{line}</p>
                    })}
                  </div>
                </div>
              )}

              {/* AI Spec Generator */}
              <div className="px-5 py-4">
                <button
                  onClick={handleGenerateSpec}
                  disabled={generatingSpec || specSuccess}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm
                    transition-all duration-300 active:scale-[0.98]
                    ${specSuccess
                      ? 'bg-emerald-500 text-white'
                      : specError
                        ? 'bg-red-500 text-white'
                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg hover:shadow-xl'
                    } disabled:opacity-70`}
                >
                  {specSuccess ? (
                    <><CheckCircle size={16} /> Spec gerada e postada!</>
                  ) : specError ? (
                    <><AlertCircle size={16} /> {specError}</>
                  ) : generatingSpec ? (
                    <><Loader2 size={16} className="animate-spin" /> 🧠 Gerando com Gemini AI...</>
                  ) : (
                    <><Sparkles size={16} /> Gerar Especificação AI (Gemini)</>
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-400 mt-1.5">
                  Gera um prompt detalhado com spec técnica e posta como comentário na issue
                </p>
              </div>

              {/* Comments Timeline */}
              {issue.comments.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Comentários ({issue.comments_count})
                  </p>
                  <div className="space-y-3">
                    {issue.comments.map(c => (
                      <div key={c.id} className={`rounded-xl border overflow-hidden
                        ${c.is_ai_spec
                          ? 'border-violet-200 bg-violet-50/50'
                          : 'border-slate-100 bg-white'
                        }`}>
                        {/* Comment header */}
                        <div className={`flex items-center gap-2 px-3 py-2 border-b
                          ${c.is_ai_spec ? 'border-violet-200 bg-violet-100/50' : 'border-slate-50 bg-slate-50/50'}`}>
                          {c.is_ai_spec && <Sparkles size={11} className="text-violet-600" />}
                          <Code2 size={11} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500">@{c.user}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                          {c.is_ai_spec && (
                            <span className="ml-auto px-1.5 py-0.5 rounded bg-violet-200 text-violet-700 text-[9px] font-bold">
                              AI SPEC
                            </span>
                          )}
                        </div>
                        {/* Comment body */}
                        <div className="px-3 py-2.5 text-xs text-slate-600 leading-relaxed max-h-60 overflow-y-auto">
                          {c.body.split('\n').map((line, i) => {
                            if (line.startsWith('## ')) return <h3 key={i} className="text-sm font-bold text-navy mt-2 mb-1">{line.replace(/^#+\s/, '')}</h3>
                            if (line.startsWith('### ')) return <h4 key={i} className="text-xs font-bold text-navy mt-2 mb-0.5">{line.replace(/^#+\s/, '')}</h4>
                            if (line.startsWith('#### ')) return <h5 key={i} className="text-xs font-bold text-slate-500 mt-1.5 mb-0.5">{line.replace(/^#+\s/, '')}</h5>
                            if (line.startsWith('---')) return <hr key={i} className="my-2 border-slate-200" />
                            if (line.startsWith('- [ ] ')) return <div key={i} className="flex items-center gap-1.5 ml-2"><input type="checkbox" disabled className="rounded w-3 h-3" /><span>{line.replace('- [ ] ', '')}</span></div>
                            if (line.startsWith('- [x] ')) return <div key={i} className="flex items-center gap-1.5 ml-2"><input type="checkbox" checked disabled className="rounded w-3 h-3" /><span className="line-through opacity-50">{line.replace('- [x] ', '')}</span></div>
                            if (line.startsWith('- ')) return <div key={i} className="ml-2">• {line.replace('- ', '')}</div>
                            if (line.startsWith('> ')) return <div key={i} className="border-l-2 border-violet-300 pl-2 text-slate-500 italic">{line.replace('> ', '')}</div>
                            if (line.startsWith('`') && line.endsWith('`')) return <code key={i} className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">{line.replace(/`/g, '')}</code>
                            if (line.trim() === '') return <div key={i} className="h-1.5" />
                            return <p key={i}>{line}</p>
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Comment */}
              <div className="px-5 py-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Novo Comentário
                </p>
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Adicionar comentário..."
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                      bg-slate-50 focus:bg-white resize-none placeholder:text-slate-300"
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={!newComment.trim() || postComment.isPending}
                    className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center
                      hover:bg-indigo-500 disabled:opacity-40 transition-colors self-end shrink-0"
                  >
                    {postComment.isPending
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Send size={14} />
                    }
                  </button>
                </div>
                {postComment.isError && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> Erro ao postar comentário
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ── New Issue Modal ──────────────────────────────────────────────────────────────

function NewIssueModal({ onClose }: { onClose: () => void }) {
  const createIssue = useCreateIssue()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [module, setModule] = useState('GERAL')
  const [tipo, setTipo] = useState<'bug' | 'enhancement' | 'question'>('enhancement')
  const [success, setSuccess] = useState<{ number: number; html_url: string } | null>(null)

  const MODULES = ['GERAL', 'COMPRAS', 'FINANCEIRO', 'ESTOQUE', 'LOGISTICA', 'FROTAS', 'RH', 'FISCAL', 'CONTRATOS', 'CADASTROS']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullTitle = `[${module}] ${title}`
    const tipoEmoji = tipo === 'bug' ? '🐛 Bug' : tipo === 'enhancement' ? '💡 Sugestão' : '❓ Dúvida'
    const fullBody = `## ${tipoEmoji}\n\n${body}\n\n---\n**Módulo:** ${module.toLowerCase()}\n**Tipo:** ${tipo}\n**Origem:** TEG+ Dev Hub`

    const result = await createIssue.mutateAsync({
      title: fullTitle,
      body: fullBody,
      labels: [tipo],
    })
    setSuccess(result)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus size={15} className="text-primary" />
            </div>
            <h3 className="font-bold text-navy">Nova Issue</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="font-bold text-navy">Issue #{success.number} criada!</p>
            <a href={success.html_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
              Ver no GitHub <ArrowUpRight size={13} />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { key: 'bug' as const, label: 'Bug', icon: Bug, color: 'red' },
                  { key: 'enhancement' as const, label: 'Melhoria', icon: Lightbulb, color: 'amber' },
                  { key: 'question' as const, label: 'Dúvida', icon: HelpCircle, color: 'blue' },
                ]).map(t => (
                  <button key={t.key} type="button" onClick={() => setTipo(t.key)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all
                      ${tipo === t.key
                        ? `border-${t.color}-400 bg-${t.color}-50 text-${t.color}-700`
                        : 'border-slate-100 text-slate-500 hover:border-slate-200'
                      }`}>
                    <t.icon size={13} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Módulo */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Módulo</label>
              <select
                value={module}
                onChange={e => setModule(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
              >
                {MODULES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Descreva o problema ou melhoria..."
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descrição</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Detalhes, passos para reproduzir, comportamento esperado..."
                rows={4}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white resize-none"
              />
            </div>

            {createIssue.isError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
                <AlertCircle size={13} /> Erro ao criar issue. Tente novamente.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={createIssue.isPending || !title.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                  flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60 transition-colors">
                {createIssue.isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><GitBranch size={14} /> Criar Issue</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────────

export default function Desenvolvimento() {
  const navigate = useNavigate()

  const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open')
  const [filterLabel, setFilterLabel] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null)
  const [showNewIssue, setShowNewIssue] = useState(false)

  const { data: issues, isLoading, refetch, isFetching } = useIssues(filterState, filterLabel)

  const filtered = useMemo(() => {
    if (!issues) return []
    if (!search) return issues
    const q = search.toLowerCase()
    return issues.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.body?.toLowerCase().includes(q) ||
      `#${i.number}`.includes(q)
    )
  }, [issues, search])

  const stats = useMemo(() => {
    if (!issues) return { total: 0, bugs: 0, enhancements: 0, withSpecs: 0 }
    return {
      total: issues.length,
      bugs: issues.filter(i => i.labels.some(l => l.name === 'bug')).length,
      enhancements: issues.filter(i => i.labels.some(l => l.name === 'enhancement')).length,
      withSpecs: 0, // would need comments data
    }
  }, [issues])

  return (
    <>
      {selectedIssue && (
        <IssueDetailPanel
          issueNumber={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
      {showNewIssue && (
        <NewIssueModal onClose={() => { setShowNewIssue(false); refetch() }} />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/perfil')}
            className="w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-navy transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-navy leading-tight">Desenvolvimento</h1>
              <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-bold uppercase tracking-wider">
                Dev Hub
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {stats.total} issues · {stats.bugs} bugs · {stats.enhancements} melhorias
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className={`w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-400 hover:text-primary transition-colors ${isFetching ? 'animate-spin' : ''}`}>
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowNewIssue(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg
              hover:bg-indigo-500 active:scale-95 transition-all">
            <Plus size={14} /> Nova Issue
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 bg-red-50 border border-red-100">
            <div className="flex items-center gap-1.5">
              <Bug size={14} className="text-red-600" />
              <p className="text-xl font-black text-red-700">{stats.bugs}</p>
            </div>
            <p className="text-[10px] font-bold text-red-500 mt-0.5">Bugs</p>
          </div>
          <div className="rounded-xl p-3 bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-1.5">
              <Lightbulb size={14} className="text-amber-600" />
              <p className="text-xl font-black text-amber-700">{stats.enhancements}</p>
            </div>
            <p className="text-[10px] font-bold text-amber-500 mt-0.5">Melhorias</p>
          </div>
          <div className="rounded-xl p-3 bg-violet-50 border border-violet-100">
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-violet-600" />
              <p className="text-xl font-black text-violet-700">{stats.total}</p>
            </div>
            <p className="text-[10px] font-bold text-violet-500 mt-0.5">Total</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar issues por título, número ou descrição..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {/* State filters */}
            {([
              { key: 'open' as const, label: 'Abertas', icon: CircleDot },
              { key: 'closed' as const, label: 'Fechadas', icon: GitPullRequestDraft },
              { key: 'all' as const, label: 'Todas', icon: Filter },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilterState(f.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${filterState === f.key
                    ? 'bg-primary text-white shadow'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-primary/40'}`}>
                <f.icon size={11} />
                {f.label}
              </button>
            ))}

            <span className="w-px bg-slate-200 my-1" />

            {/* Label filters */}
            {([
              { key: '', label: 'Todos' },
              { key: 'bug', label: 'Bugs' },
              { key: 'enhancement', label: 'Melhorias' },
              { key: 'question', label: 'Dúvidas' },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilterLabel(f.key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${filterLabel === f.key
                    ? 'bg-violet-600 text-white shadow'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-violet-400'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Issues List */}
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {filtered.map(issue => (
              <IssueCard
                key={issue.number}
                issue={issue}
                isSelected={selectedIssue === issue.number}
                onClick={() => setSelectedIssue(issue.number)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
