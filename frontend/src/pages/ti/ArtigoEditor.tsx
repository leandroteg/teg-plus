import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getArticle, createArticle, updateArticle } from './data/articles'
import { useTiAuth } from './data/auth'
import { PageHeader, ErrorNote, Spinner } from './components/ui'

export default function ArtigoEditor() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useTiAuth()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['ti', 'article', id], queryFn: () => getArticle(id!), enabled: editing })
  useEffect(() => {
    if (data) { setTitle(data.title); setContent(data.content); setPublished(data.published) }
  }, [data])

  const mut = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateArticle(id!, { title: title.trim(), content: content.trim(), published })
        return id!
      }
      if (!user) throw new Error('Sessão expirada.')
      const created = await createArticle({ title: title.trim(), content: content.trim(), published, autorId: user.id })
      return created.id
    },
    onSuccess: (articleId) => {
      qc.invalidateQueries({ queryKey: ['ti', 'articles'] })
      qc.invalidateQueries({ queryKey: ['ti', 'article', articleId] })
      navigate(`/ti/base/${articleId}`)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Não foi possível salvar o artigo.'),
  })

  if (editing && isLoading) return <Spinner />

  const onSubmit = (e: FormEvent) => { e.preventDefault(); setError(''); mut.mutate() }

  return (
    <div className="ti-scope mx-auto max-w-3xl">
      <Link to="/ti/base" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageHeader title={editing ? 'Editar artigo' : 'Novo artigo'} />
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        {error && <ErrorNote message={error} />}
        <div>
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
        </div>
        <div>
          <label className="label">Conteúdo</label>
          <textarea className="input min-h-[280px] resize-y" value={content} onChange={(e) => setContent(e.target.value)} required minLength={10} placeholder="Escreva o passo a passo. Quebras de linha são preservadas." />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Publicar (visível para todos os usuários)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
