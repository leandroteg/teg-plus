import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitBranch, ChevronRight, Layers, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../contexts/ThemeContext'
import { useEAP, usePortfolio, useTAP, useGerarEAPIA } from '../../hooks/usePMO'
import { supabase } from '../../services/supabase'
import type { PMOEAP, FaseEAP } from '../../types/pmo'

const FASE_MAP: Record<FaseEAP, { label: string; light: string; dark: string }> = {
  iniciacao:      { label: 'Iniciacao',      light: 'bg-blue-100 text-blue-700',     dark: 'bg-blue-500/15 text-blue-400' },
  planejamento:   { label: 'Planejamento',   light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-500/15 text-violet-400' },
  execucao:       { label: 'Execucao',       light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  monitoramento:  { label: 'Monitoramento',  light: 'bg-amber-100 text-amber-700',  dark: 'bg-amber-500/15 text-amber-400' },
  encerramento:   { label: 'Encerramento',   light: 'bg-slate-100 text-slate-600',  dark: 'bg-slate-500/15 text-slate-400' },
}

function buildTree(items: PMOEAP[]): PMOEAP[] {
  const map = new Map<string, PMOEAP & { children: PMOEAP[] }>()
  const roots: (PMOEAP & { children: PMOEAP[] })[] = []

  items.forEach(it => map.set(it.id, { ...it, children: [] }))
  items.forEach(it => {
    const node = map.get(it.id)!
    if (it.parent_id && map.has(it.parent_id)) {
      map.get(it.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export default function EAP() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: items, isLoading } = useEAP(portfolioId)
  const { data: tap } = useTAP(portfolioId)
  const gerarIA = useGerarEAPIA()

  const [gerando, setGerando] = useState(false)
  const [aiMsg, setAiMsg] = useState<string | null>(null)
  const [confirmGerar, setConfirmGerar] = useState(false)

  const tree = useMemo(() => buildTree(items ?? []), [items])

  const doGerarEAP = async () => {
    if (!portfolioId || !portfolio) return
    setConfirmGerar(false)
    setGerando(true)
    setAiMsg(null)
    try {
      const result = await gerarIA.mutateAsync({
        portfolio_id: portfolioId,
        obra_nome: portfolio.nome_obra,
        tap_dados: tap ?? undefined,
      })
      // Delete existing EAP items and insert AI-generated ones
      if ((items ?? []).length > 0) {
        await supabase.from('pmo_eap').delete().eq('portfolio_id', portfolioId)
      }
      if (Array.isArray(result) && result.length > 0) {
        const rows = result.map((it, idx) => ({
          ...it,
          portfolio_id: portfolioId,
          ordem: idx + 1,
          peso_percentual: it.peso_percentual ?? 0,
        }))
        await supabase.from('pmo_eap').insert(rows)
      }
      qc.invalidateQueries({ queryKey: ['pmo-eap', portfolioId] })
      setAiMsg('EAP gerada com sucesso via IA! Revise a estrutura.')
    } catch {
      setAiMsg('Erro ao gerar EAP via IA. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav(portfolioId ? `/egp/portfolio/${portfolioId}` : '/egp/portfolio')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <GitBranch size={20} className="text-violet-500" />
            Estrutura Analitica do Projeto (EAP)
          </h1>
          {portfolio && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {portfolio.nome_obra} - {portfolio.numero_osc}
            </p>
          )}
        </div>
        <button
          onClick={() => (items ?? []).length > 0 ? setConfirmGerar(true) : doGerarEAP()}
          disabled={gerando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-indigo-600 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {gerando ? 'Gerando...' : 'Gerar com IA'}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmGerar && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
          isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            A EAP existente sera substituida. Deseja continuar?
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfirmGerar(false)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isLight ? 'hover:bg-amber-100' : 'hover:bg-amber-500/20'
              }`}>
              Cancelar
            </button>
            <button onClick={doGerarEAP}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors">
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* AI feedback */}
      {aiMsg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          aiMsg.includes('Erro')
            ? (isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-500/10 border-red-500/20 text-red-400')
            : (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400')
        }`}>
          {aiMsg.includes('Erro') ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          {aiMsg}
        </div>
      )}

      {/* Tree */}
      <div className={`rounded-2xl border p-4 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        {tree.length === 0 ? (
          <p className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum item na EAP
          </p>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <EAPNode key={node.id} node={node as PMOEAP & { children: PMOEAP[] }} depth={0} isLight={isLight} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EAPNode({ node, depth, isLight }: {
  node: PMOEAP & { children?: PMOEAP[] }; depth: number; isLight: boolean
}) {
  const hasChildren = (node.children?.length ?? 0) > 0
  const fase = node.fase ? FASE_MAP[node.fase] : null

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors ${
          isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
        }`}
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <ChevronRight size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        ) : (
          <Layers size={14} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
        )}

        {node.codigo && (
          <span className={`text-xs font-mono font-semibold ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
            {node.codigo}
          </span>
        )}

        <span className={`text-sm font-medium flex-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
          {node.titulo}
        </span>

        {fase && (
          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${isLight ? fase.light : fase.dark}`}>
            {fase.label}
          </span>
        )}

        <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {node.peso_percentual}%
        </span>
      </div>

      {hasChildren && (
        <div>
          {(node.children as (PMOEAP & { children?: PMOEAP[] })[]).map(child => (
            <EAPNode key={child.id} node={child} depth={depth + 1} isLight={isLight} />
          ))}
        </div>
      )}
    </div>
  )
}
