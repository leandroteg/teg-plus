// Configurações (admin) — URL do gateway go2rtc + cadastro de câmeras.
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save } from 'lucide-react'
import { listCameras, createCamera, updateCamera, deleteCamera, getGo2rtcUrl, setGo2rtcUrl } from './data/cameras'
import type { Camera } from './data/types'

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'

function GatewayPanel() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['mon', 'go2rtc'], queryFn: getGo2rtcUrl })
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? data ?? ''
  const mut = useMutation({
    mutationFn: () => setGo2rtcUrl(value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mon', 'go2rtc'] }),
  })
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Gateway de vídeo (go2rtc)</h2>
      <p className="mb-3 text-xs text-slate-500">
        URL pública (túnel HTTPS) do go2rtc que roda na máquina on-prem. Ex.: <code>https://cameras.suaempresa.com</code>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} flex-1`} value={value} onChange={(e) => setDraft(e.target.value)} placeholder="https://cameras.suaempresa.com" />
        <button className={btnPrimary} disabled={mut.isPending} onClick={() => mut.mutate()}><Save className="h-4 w-4" /> {mut.isPending ? 'Salvando…' : 'Salvar'}</button>
      </div>
      {mut.isError && <p className="mt-2 text-xs text-red-600">Não foi possível salvar a URL. Tente novamente.</p>}
      {mut.isSuccess && !mut.isPending && <p className="mt-2 text-xs text-emerald-600">URL salva.</p>}
    </div>
  )
}

function CameraRow({ cam, onChanged }: { cam: Camera; onChanged: () => void }) {
  const [nome, setNome] = useState(cam.nome)
  const [local, setLocal] = useState(cam.local ?? '')
  const [canal, setCanal] = useState(String(cam.canal))
  const [streamKey, setStreamKey] = useState(cam.streamKey ?? '')
  const save = useMutation({
    mutationFn: () => updateCamera(cam.id, { nome: nome.trim(), local: local.trim() || null, canal: Number(canal) || 1, streamKey: streamKey.trim() || null }),
    onSuccess: onChanged,
  })
  const toggle = useMutation({ mutationFn: () => updateCamera(cam.id, { ativo: !cam.ativo }), onSuccess: onChanged })
  const del = useMutation({ mutationFn: () => deleteCamera(cam.id), onSuccess: onChanged })
  const busy = save.isPending || toggle.isPending || del.isPending
  const erro = save.isError || toggle.isError || del.isError
  return (
    <div className="border-t border-slate-100 py-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.4fr_1.2fr_0.5fr_1.2fr_auto]">
        <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
        <input className={inputCls} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local" />
        <input className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="Canal" />
        <input className={inputCls} value={streamKey} onChange={(e) => setStreamKey(e.target.value)} placeholder="stream_key (go2rtc)" />
        <div className="flex items-center gap-1">
          <button disabled={busy} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => toggle.mutate()}>{cam.ativo ? 'Ativa' : 'Inativa'}</button>
          <button disabled={busy} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => save.mutate()}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          <button disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { if (window.confirm(`Excluir a câmera "${cam.nome}"?`)) del.mutate() }} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      {erro && <p className="mt-1.5 text-xs text-red-600">Não foi possível concluir a operação. Tente novamente.</p>}
    </div>
  )
}

export default function Config() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['mon', 'cameras', 'all'], queryFn: () => listCameras(true) })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['mon', 'cameras'] })
    qc.invalidateQueries({ queryKey: ['mon', 'cameras', 'all'] })
  }
  const [nome, setNome] = useState('')
  const add = useMutation({ mutationFn: () => createCamera({ nome: nome.trim(), canal: 1 }), onSuccess: () => { setNome(''); invalidate() } })
  const cams = data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
        <p className="mt-0.5 text-sm text-slate-500">Gateway de vídeo e cadastro de câmeras</p>
      </div>

      <GatewayPanel />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Câmeras</h2>
        <div className="mb-1 flex flex-wrap gap-2">
          <input className={`${inputCls} min-w-[200px] flex-1`} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da nova câmera" />
          <button className={btnPrimary} disabled={!nome.trim() || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /> {add.isPending ? 'Adicionando…' : 'Adicionar'}</button>
        </div>
        {add.isError && <p className="mb-1 text-xs text-red-600">Não foi possível adicionar a câmera. Tente novamente.</p>}
        {cams.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhuma câmera. Adicione a primeira acima.</p>
        ) : (
          <div>{cams.map((c) => <CameraRow key={c.id} cam={c} onChanged={invalidate} />)}</div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          O <b>stream_key</b> deve bater com o nome do stream no go2rtc (arquivo YAML do gateway on-prem). O <b>canal</b> é o número do canal no NVR.
        </p>
      </div>
    </div>
  )
}
