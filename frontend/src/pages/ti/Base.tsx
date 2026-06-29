import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, BookOpen, FileText } from 'lucide-react'
import { listArticles } from './data/articles'
import { useTiAuth } from './data/auth'
import { PageHeader, Spinner, EmptyState } from './components/ui'
import { timeAgo } from './lib/format'

export default function Base() {
  const { isStaff: staff } = useTiAuth()
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'articles', q], queryFn: () => listArticles(q) })
  const articles = data ?? []

  return (
    <div className="ti-scope">
      <PageHeader
        title="Base de conhecimento"
        subtitle="Tutoriais e respostas frequentes da T.I."
        action={staff ? <Link to="/ti/base/novo" className="btn-primary"><Plus className="h-4 w-4" /> Novo artigo</Link> : undefined}
      />

      <div className="card mb-4 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar artigos…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title="Nenhum artigo encontrado"
          description={staff ? 'Crie o primeiro artigo da base' : 'Ainda não há artigos publicados'}
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {articles.map((a) => (
            <Link key={a.id} to={`/ti/base/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50">
              <FileText className="h-5 w-5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-700">
                  {a.title}
                  {!a.published && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">rascunho</span>}
                </div>
                <div className="text-xs text-slate-400">por {a.author.name} · atualizado {timeAgo(a.updatedAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
