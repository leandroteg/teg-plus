import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { listAllCanned, createCanned, updateCanned } from './data/canned'
import type { CannedResponse } from './data/shapes'
import { PageHeader, Spinner } from './components/ui'

function Editor({ item }: { item: CannedResponse }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState(item.title)
  const [body, setBody] = useState(item.body)
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ti', 'canned', 'all'] })
    qc.invalidateQueries({ queryKey: ['ti', 'canned'] })
  }
  const mut = useMutation({
    mutationFn: (patch: { title?: string; body?: string; active?: boolean }) => updateCanned(item.id, patch),
    onSuccess: invalidate,
  })
  const dirty = title !== item.title || body !== item.body

  return (
    <div className="card space-y-2 p-4">
      <input className="input font-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input min-h-[80px] resize-y" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${item.active ? 'text-emerald-600' : 'text-slate-400'}`}>
          {item.active ? 'Ativo' : 'Inativo'}
        </span>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs" onClick={() => mut.mutate({ active: !item.active })}>
            {item.active ? 'Desativar' : 'Ativar'}
          </button>
          <button className="btn-primary text-xs" disabled={!dirty || mut.isPending} onClick={() => mut.mutate({ title: title.trim(), body: body.trim() })}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Respostas() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'canned', 'all'], queryFn: listAllCanned })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const addMut = useMutation({
    mutationFn: () => createCanned({ title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle(''); setBody('')
      qc.invalidateQueries({ queryKey: ['ti', 'canned', 'all'] })
      qc.invalidateQueries({ queryKey: ['ti', 'canned'] })
    },
  })

  return (
    <div className="ti-scope">
      <PageHeader title="Respostas prontas" subtitle="Modelos para agilizar o atendimento" />
      <div className="card mb-6 space-y-2 p-4">
        <h2 className="text-sm font-semibold text-slate-700">Novo modelo</h2>
        <input className="input" placeholder="Título (ex.: Pedir mais informações)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input min-h-[80px] resize-y" placeholder="Texto da resposta…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn-primary" disabled={!title.trim() || !body.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data ?? []).map((c) => <Editor key={c.id} item={c} />)}
        </div>
      )}
    </div>
  )
}
