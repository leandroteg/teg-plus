import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { getArticle } from './data/articles'
import { useTiAuth } from './data/auth'
import { Spinner } from './components/ui'
import { formatDateTime } from './lib/format'

export default function Artigo() {
  const { id } = useParams()
  const { isStaff: staff } = useTiAuth()
  const { data, isLoading, error } = useQuery({ queryKey: ['ti', 'article', id], queryFn: () => getArticle(id!), enabled: !!id })

  if (isLoading) return <Spinner />
  if (error || !data) {
    return (
      <div className="ti-scope mx-auto max-w-md">
        <div className="card p-8 text-center">
          <p className="text-slate-600">Artigo não encontrado</p>
          <Link to="/ti/base" className="btn-primary mt-4 inline-flex">Voltar à base</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ti-scope mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/ti/base" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
          <ArrowLeft className="h-4 w-4" /> Base de conhecimento
        </Link>
        {staff && <Link to={`/ti/base/${data.id}/editar`} className="btn-outline"><Pencil className="h-4 w-4" /> Editar</Link>}
      </div>
      <article className="card p-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {data.title}
          {!data.published && <span className="ml-2 align-middle rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">rascunho</span>}
        </h1>
        <p className="mt-1 text-xs text-slate-400">por {data.author.name} · atualizado em {formatDateTime(data.updatedAt)}</p>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.content}</div>
      </article>
    </div>
  )
}
