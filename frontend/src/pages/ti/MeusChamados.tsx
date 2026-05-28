import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Inbox } from 'lucide-react'
import { useMeusChamados } from './hooks'
import { STATUS_COLOR, STATUS_LABEL, formatNumero, getCategoria, PRIORIDADE_LABEL } from './types'

export default function MeusChamados() {
  const { items, loading, erro } = useMeusChamados()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/ti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-sky-500 mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Meus chamados</h1>
          <Link
            to="/ti/novo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo
          </Link>
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

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
            <Inbox className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-300 font-medium">Você ainda não abriu nenhum chamado.</p>
            <Link
              to="/ti/novo"
              className="inline-flex items-center gap-1 mt-4 text-sky-500 hover:text-sky-600 font-medium"
            >
              <Plus className="w-4 h-4" /> Abrir o primeiro
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-2">
            {items.map(c => {
              const cat = getCategoria(c.categoria)
              return (
                <Link
                  key={c.id}
                  to={`/ti/c/${c.id}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
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
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Aberto em {new Date(c.created_at).toLocaleDateString('pt-BR')}
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
