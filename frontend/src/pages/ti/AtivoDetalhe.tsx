import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getAsset, updateAsset, type AssetInput } from './data/assets'
import { Spinner } from './components/ui'
import { StatusBadge, PriorityBadge } from './components/Badges'
import { formatDate } from './lib/format'

const TYPES: [string, string][] = [['CELULAR', 'Celular'], ['COMPUTADOR', 'Computador'], ['MONITOR', 'Monitor'], ['OUTRO', 'Outro']]
const STATUSES: [string, string][] = [['EM_USO', 'Em uso'], ['ESTOQUE', 'Estoque'], ['MANUTENCAO', 'Manutenção'], ['AGUARDANDO', 'Aguardando'], ['BAIXADO', 'Baixado']]

export default function AtivoDetalhe() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['ti', 'asset', id], queryFn: () => getAsset(id!), enabled: !!id })
  const [form, setForm] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (!data) return
    setForm({
      type: data.type, status: data.status, tag: data.tag, model: data.model, serial: data.serial,
      phoneLine: data.phoneLine, holderName: data.holderName, holderCpf: data.holderCpf, holderCargo: data.holderCargo,
      holderEmail: data.holderEmail, previousUser: data.previousUser, mdm: data.mdm, matriz: data.matriz,
      location: data.location, notes: data.notes,
    })
  }, [data])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: () => updateAsset(id!, form as unknown as AssetInput),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ti', 'asset', id] }); qc.invalidateQueries({ queryKey: ['ti', 'assets'] }) },
  })

  if (isLoading) return <Spinner />
  if (error || !data) {
    return (
      <div className="ti-scope mx-auto max-w-md">
        <div className="card p-8 text-center">
          <p className="text-slate-600">Ativo não encontrado</p>
          <Link to="/ti/ativos" className="btn-primary mt-4 inline-flex">Voltar aos ativos</Link>
        </div>
      </div>
    )
  }

  const field = (label: string, key: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={(form[key] as string) ?? ''} onChange={(e) => set(key, e.target.value)} />
    </div>
  )

  return (
    <div className="ti-scope mx-auto max-w-4xl">
      <Link to="/ti/ativos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Ativos
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Dados do equipamento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={(form.type as string) ?? 'OUTRO'} onChange={(e) => set('type', e.target.value)}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={(form.status as string) ?? 'EM_USO'} onChange={(e) => set('status', e.target.value)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {field('Patrimônio', 'tag')}
            {field('Modelo', 'model')}
            {field('Série', 'serial')}
            {field('Linha telefônica', 'phoneLine')}
            {field('Responsável', 'holderName')}
            {field('CPF', 'holderCpf')}
            {field('Cargo', 'holderCargo')}
            {field('E-mail', 'holderEmail')}
            {field('Usuário anterior', 'previousUser')}
            {field('MDM', 'mdm')}
            {field('Matriz', 'matriz')}
            {field('Local', 'location')}
          </div>
          <div className="mt-4">
            <label className="label">Observações</label>
            <textarea className="input min-h-[70px] resize-y" value={(form.notes as string) ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? 'Salvando…' : 'Salvar alterações'}</button>
            {mut.isSuccess && <span className="text-sm text-emerald-600">Salvo!</span>}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Chamados deste equipamento</h2>
          {data.tickets.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum chamado vinculado</p>
          ) : (
            <ul className="space-y-2">
              {data.tickets.map((t) => (
                <li key={t.id}>
                  <Link to={`/ti/chamados/${t.id}`} className="block rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">{t.code}</span>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-700">{t.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{formatDate(t.createdAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
