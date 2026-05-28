import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Inbox } from 'lucide-react'
import { useFilaChamados, useIsAtendenteTi } from './hooks'
import {
  STATUS_COLOR, STATUS_LABEL, formatNumero, getCategoria, PRIORIDADE_LABEL,
  type StatusChamado,
} from './types'

const TABS: { key: 'abertos' | StatusChamado | 'todos'; label: string }[] = [
  { key: 'abertos',             label: 'Em aberto' },
  { key: 'aberto',              label: 'Novos' },
  { key: 'em_atendimento',      label: 'Em atendimento' },
  { key: 'aguardando_usuario',  label: 'Aguardando usuário' },
  { key: 'resolvido',           label: 'Resolvidos' },
  { key: 'fechado',             label: 'Fechados' },
  { key: 'todos',               label: 'Todos' },
]

export default function FilaChamados() {
  const isAtendente = useIsAtendenteTi()
  const { items, loading, erro } = useFilaChamados()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('abertos')

  const filtered = useMemo(() => {
    if (tab === 'todos') return items
    if (tab === 'abertos') return items.filter(c => c.status !== 'resolvido' && c.status !== 'fechado')
    return items.filter(c => c.status === tab)
  }, [items, tab])

  if (!isAtendente) return <Navigate to="/ti" replace />

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/ti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 mb-1">Fila de TI</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Todos os chamados abertos no sistema. Clique para abrir e atender.
        </p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
          {TABS.map(t => {
            const count =
              t.key === 'todos' ? items.length :
              t.key === 'abertos' ? items.filter(c => c.status !== 'resolvido' && c.status !== 'fechado').length :
              items.filter(c => c.status === t.key).length
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label} <span className="opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        )}

        {erro && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-300">
            {erro}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
            <Inbox className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-300">Nenhum chamado nesta visão.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(c => {
              const cat = getCategoria(c.categoria)
              return (
                <Link
                  key={c.id}
                  to={`/ti/c/${c.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500/40 transition-colors"
                >
                  <cat.Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                      <span className="font-mono">{formatNumero(c.numero)}</span>
                      <span>·</span>
                      <span>{cat.label}</span>
                      <span>·</span>
                      <span>{PRIORIDADE_LABEL[c.prioridade]}</span>
                    </div>
                    <p className="text-sm text-slate-900 dark:text-slate-100 font-medium truncate">{c.titulo}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {c.solicitante?.nome ?? '—'} · {new Date(c.created_at).toLocaleString('pt-BR')}
                      {c.atendente?.nome && <> · atendente: {c.atendente.nome}</>}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
