import { Link } from 'react-router-dom'
import { Server, Plus, Inbox, ListChecks, ArrowLeft, HelpCircle, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useIsAtendenteTi, useMeusChamados } from './hooks'
import { STATUS_COLOR, STATUS_LABEL, formatNumero, getCategoria } from './types'

export default function TIHome() {
  const { isAdmin } = useAuth()
  const isAtendente = useIsAtendenteTi()
  const { items, loading } = useMeusChamados()
  const abertos = items.filter(c => c.status !== 'fechado' && c.status !== 'resolvido')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-sky-500 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar à Mandala
          </Link>
        </div>

        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/15 flex items-center justify-center shrink-0">
              <Server className="w-7 h-7 text-sky-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Chamados de TI</h1>
              <p className="text-slate-500 dark:text-slate-400">Precisa de ajuda? Abra um chamado que a gente resolve.</p>
            </div>
          </div>
          {isAdmin && (
            <Link
              to="/ti/admin"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="w-3.5 h-3.5" /> Gerenciar atendentes
            </Link>
          )}
        </header>

        {/* Action cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          <Link
            to="/ti/novo"
            className="group rounded-2xl border-2 border-sky-500/40 bg-gradient-to-br from-sky-500/10 to-blue-600/10 hover:from-sky-500/20 hover:to-blue-600/20 p-6 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Abrir novo chamado</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Conte o que está acontecendo. A gente te avisa quando responder.
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/ti/meus"
            className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 p-6 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                <ListChecks className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Meus chamados</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {loading ? 'Carregando...' : `${items.length} no total · ${abertos.length} em andamento`}
                </p>
              </div>
            </div>
          </Link>

          {isAtendente && (
            <Link
              to="/ti/fila"
              className="sm:col-span-2 group rounded-2xl border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 p-6 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <Inbox className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Fila de atendimento (TI)</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Visão de todos os chamados — assumir, responder e resolver.
                  </p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Latest tickets preview */}
        {!loading && items.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
              Seus chamados recentes
            </h3>
            <div className="space-y-2">
              {items.slice(0, 5).map(c => {
                const cat = getCategoria(c.categoria)
                return (
                  <Link
                    key={c.id}
                    to={`/ti/c/${c.id}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <cat.Icon className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{formatNumero(c.numero)}</span>
                        <span>·</span>
                        <span>{cat.label}</span>
                      </div>
                      <p className="text-sm text-slate-900 dark:text-slate-100 truncate font-medium">{c.titulo}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLOR[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </Link>
                )
              })}
            </div>
            {items.length > 5 && (
              <Link to="/ti/meus" className="inline-block mt-4 text-sm text-sky-600 hover:text-sky-500 dark:text-sky-400">
                Ver todos ({items.length}) →
              </Link>
            )}
          </section>
        )}

        {!loading && items.length === 0 && (
          <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
            <HelpCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-300 font-medium">Você ainda não abriu nenhum chamado.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sempre que precisar de ajuda da TI, comece por aqui.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
