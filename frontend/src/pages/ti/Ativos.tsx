import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Download, X } from 'lucide-react'
import { listAssets, createAsset } from './data/assets'
import type { Asset } from './data/shapes'
import { PageHeader, Spinner } from './components/ui'
import { downloadCSV, toCSV } from './lib/csv'

const TYPES = ['CELULAR', 'COMPUTADOR', 'MONITOR', 'OUTRO']
const STATUSES = ['EM_USO', 'ESTOQUE', 'MANUTENCAO', 'AGUARDANDO', 'BAIXADO']
const TYPE_LABEL: Record<string, string> = { CELULAR: 'Celular', COMPUTADOR: 'Computador', MONITOR: 'Monitor', OUTRO: 'Outro' }
const STATUS_LABEL: Record<string, string> = { EM_USO: 'Em uso', ESTOQUE: 'Estoque', MANUTENCAO: 'Manutenção', AGUARDANDO: 'Aguardando', BAIXADO: 'Baixado' }

interface Person {
  key: string
  holderName: string | null
  holderCpf: string | null
  holderCargo: string | null
  holderEmail: string | null
  phoneLine: string | null
  previousUser: string | null
  mdm: string | null
  matriz: string | null
  celular?: Asset
  computador?: Asset
  monitor?: Asset
}

function groupByPerson(assets: Asset[]): Person[] {
  const map = new Map<string, Asset[]>()
  for (const a of assets) {
    const key = (a.holderName || a.holderCpf || `__${a.id}`).trim()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  const people: Person[] = []
  for (const [key, group] of map) {
    const celular = group.find((a) => a.type === 'CELULAR')
    const computador = group.find((a) => a.type === 'COMPUTADOR')
    const monitor = group.find((a) => a.type === 'MONITOR')
    const primary = celular ?? group[0]
    people.push({
      key,
      holderName: group[0].holderName,
      holderCpf: group[0].holderCpf,
      holderCargo: group[0].holderCargo,
      holderEmail: group[0].holderEmail,
      previousUser: group[0].previousUser,
      phoneLine: celular?.phoneLine ?? null,
      mdm: primary?.mdm ?? null,
      matriz: primary?.matriz ?? null,
      celular, computador, monitor,
    })
  }
  return people.sort((a, b) => (a.holderName ?? '').localeCompare(b.holderName ?? '', 'pt-BR'))
}

function NewAssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, string>>({ type: 'COMPUTADOR', tag: '', model: '', holderName: '', status: 'EM_USO' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const mut = useMutation({
    mutationFn: () => createAsset(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ti', 'assets'] }); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Novo ativo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="label">Tipo</label><select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
          <div><label className="label">Patrimônio</label><input className="input" value={form.tag} onChange={(e) => set('tag', e.target.value)} placeholder="Ex.: 1184" /></div>
          <div><label className="label">Modelo</label><input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex.: Dell i5 8GB" /></div>
          <div><label className="label">Responsável</label><input className="input" value={form.holderName} onChange={(e) => set('holderName', e.target.value)} /></div>
          <div><label className="label">Status</label><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? 'Salvando…' : 'Criar'}</button>
        </div>
      </div>
    </div>
  )
}

const TH = 'sticky top-0 z-10 border-b border-r border-slate-300 bg-slate-100 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap'
const TD = 'border-b border-r border-slate-200 px-2.5 py-1.5 whitespace-nowrap'

function PatrLink({ asset }: { asset?: Asset }) {
  if (!asset) return <span className="text-slate-300">—</span>
  return <Link to={`/ti/ativos/${asset.id}`} className="font-mono font-medium text-sky-600 hover:underline">{asset.tag ?? 's/ patr.'}</Link>
}

export default function Ativos() {
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'assets'], queryFn: listAssets })

  const people = useMemo(() => groupByPerson(data ?? []), [data])
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return people
    return people.filter((p) => [
      p.holderName, p.holderCpf, p.holderCargo, p.holderEmail, p.phoneLine, p.previousUser, p.mdm, p.matriz,
      p.celular?.model, p.celular?.tag, p.computador?.model, p.computador?.tag, p.monitor?.tag,
    ].some((v) => (v ?? '').toLowerCase().includes(term)))
  }, [people, q])

  const exportCSV = () => {
    const headers = ['Linha', 'Usuário', 'CPF', 'Cargo', 'Modelo Celular', 'Patr. Celular', 'Modelo Computador', 'Patr. Computador', 'Usuário Anterior', 'E-mail', 'Monitor', 'MDM', 'Matriz']
    const rows = filtered.map((p) => [
      p.phoneLine, p.holderName, p.holderCpf, p.holderCargo,
      p.celular?.model, p.celular?.tag, p.computador?.model, p.computador?.tag,
      p.previousUser, p.holderEmail, p.monitor?.tag, p.mdm, p.matriz,
    ])
    downloadCSV('inventario_ativos.csv', toCSV(headers, rows))
  }

  return (
    <div className="ti-scope">
      <PageHeader
        title="Ativos — Inventário"
        subtitle={`${people.length} colaboradores · ${(data ?? []).length} equipamentos`}
        action={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={exportCSV}><Download className="h-4 w-4" /> Exportar CSV</button>
            <button className="btn-primary" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Novo ativo</button>
          </div>
        }
      />

      <div className="card mb-3 p-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por nome, patrimônio, modelo, linha, cargo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-400">A coluna <strong>Usuário</strong> fica fixa ao rolar para o lado; o cabeçalho fica fixo ao rolar para baixo.</p>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="card overflow-auto" style={{ maxHeight: 'calc(100vh - 210px)' }}>
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className={`${TH} sticky left-0 z-20`}>Usuário</th>
                <th className={TH}>Linha</th>
                <th className={TH}>CPF</th>
                <th className={TH}>Cargo</th>
                <th className={TH}>Modelo Celular</th>
                <th className={TH}>Patr. Cel.</th>
                <th className={TH}>Modelo Computador</th>
                <th className={TH}>Patr. Comp.</th>
                <th className={TH}>Usuário Anterior</th>
                <th className={TH}>E-mail</th>
                <th className={TH}>Monitor</th>
                <th className={TH}>MDM</th>
                <th className={TH}>Matriz</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const bg = i % 2 ? 'bg-slate-50' : 'bg-white'
                return (
                  <tr key={p.key} className={bg}>
                    <td className={`${TD} sticky left-0 z-[1] ${bg} font-medium text-slate-800`}>
                      <div>{p.holderName ?? '—'}</div>
                      {p.holderName && <Link to={`/ti/termos?colaborador=${encodeURIComponent(p.holderName)}`} className="text-[10px] font-normal text-sky-600 hover:underline">Gerar termo</Link>}
                    </td>
                    <td className={`${TD} text-slate-600`}>{p.phoneLine ?? '—'}</td>
                    <td className={`${TD} text-slate-600`}>{p.holderCpf ?? '—'}</td>
                    <td className={`${TD} text-slate-600`}>{p.holderCargo ?? '—'}</td>
                    <td className={`${TD} text-slate-700`}>{p.celular?.model ?? '—'}</td>
                    <td className={`${TD} text-center`}><PatrLink asset={p.celular} /></td>
                    <td className={`${TD} text-slate-700`}>{p.computador?.model ?? '—'}</td>
                    <td className={`${TD} text-center`}><PatrLink asset={p.computador} /></td>
                    <td className={`${TD} text-slate-500`}>{p.previousUser ?? '—'}</td>
                    <td className={`${TD} text-slate-600`}>{p.holderEmail ?? '—'}</td>
                    <td className={`${TD} text-center`}><PatrLink asset={p.monitor} /></td>
                    <td className={`${TD} text-center text-slate-600`}>{p.mdm ?? '—'}</td>
                    <td className={`${TD} text-center`}>{p.matriz ? <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">{p.matriz}</span> : '—'}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="border-b border-slate-200 px-3 py-8 text-center text-slate-400">Nenhum resultado para a busca</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewAssetModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
