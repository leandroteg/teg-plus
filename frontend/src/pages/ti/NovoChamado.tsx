import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCategories, listSectors, listCustomFields } from './data/meta'
import { listAssets } from './data/assets'
import { createTicket } from './data/tickets'
import { uploadAttachments } from './data/attachments'
import { useTiAuth } from './data/auth'
import type { Priority } from './data/shapes'
import { PRIORITY_LIST, PRIORITY_META } from './lib/constants'
import { PageHeader, ErrorNote } from './components/ui'
import { FileUpload } from './components/FileUpload'

export default function NovoChamado() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useTiAuth()

  const catQ = useQuery({ queryKey: ['ti', 'categories'], queryFn: listCategories })
  const secQ = useQuery({ queryKey: ['ti', 'sectors'], queryFn: listSectors })
  const assetsQ = useQuery({ queryKey: ['ti', 'assets'], queryFn: listAssets })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIA')
  const [assetId, setAssetId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const fieldsQ = useQuery({
    queryKey: ['ti', 'customfields', categoryId],
    queryFn: () => listCustomFields(categoryId),
    enabled: !!categoryId,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sessão expirada.')
      const categoryName = catQ.data?.find((c) => c.id === categoryId)?.name ?? ''
      const { id } = await createTicket({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        categoryName,
        sectorId: sectorId || null,
        assetId: assetId || null,
        priority,
        customData: customValues,
        solicitanteId: user.id,
      })
      if (files.length) {
        await uploadAttachments({ chamadoId: id, files, autorId: user.id }).catch(() => undefined)
      }
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['ti', 'tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ti', 'stats'] })
      navigate(`/ti/chamados/${id}`)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Não foi possível abrir o chamado.'),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!categoryId) return setError('Selecione a categoria.')
    mutation.mutate()
  }

  return (
    <div className="ti-scope mx-auto max-w-2xl">
      <PageHeader title="Abrir novo chamado" subtitle="Descreva o problema para a T.I." />
      <form onSubmit={onSubmit} className="card space-y-5 p-6">
        {error && <ErrorNote message={error} />}
        <div>
          <label className="label">Assunto</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Computador não liga" required minLength={4} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="" disabled>Selecione…</option>
              {(catQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Setor</label>
            <select className="input" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              <option value="">— (opcional)</option>
              {(secQ.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prioridade</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITY_LIST.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Equipamento relacionado (opcional)</label>
          <select className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">— Nenhum</option>
            {(assetsQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {(a.tag ? `${a.tag} · ` : '') + (a.model ?? a.type) + (a.holderName ? ` — ${a.holderName}` : '')}
              </option>
            ))}
          </select>
        </div>
        {(fieldsQ.data?.length ?? 0) > 0 && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-sm font-medium text-slate-600">Informações adicionais</div>
            {fieldsQ.data!.map((f) => (
              <div key={f.id}>
                <label className="label">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.type === 'SELECT' ? (
                  <select className="input" value={customValues[f.id] ?? ''} required={f.required} onChange={(e) => setCustomValues((v) => ({ ...v, [f.id]: e.target.value }))}>
                    <option value="">Selecione…</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'}
                    className="input"
                    value={customValues[f.id] ?? ''}
                    required={f.required}
                    onChange={(e) => setCustomValues((v) => ({ ...v, [f.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div>
          <label className="label">Descrição</label>
          <textarea
            className="input min-h-[150px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explique o que está acontecendo, desde quando ocorre e o que você já tentou."
            required minLength={5}
          />
        </div>
        <div>
          <label className="label">Anexos</label>
          <FileUpload files={files} onChange={setFiles} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Enviando…' : 'Abrir chamado'}
          </button>
        </div>
      </form>
    </div>
  )
}
