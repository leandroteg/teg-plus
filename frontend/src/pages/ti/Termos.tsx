import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Printer, FileDown, Plus, ArrowLeft, Trash2 } from 'lucide-react'
import { listAssets } from './data/assets'
import { listTerms, getTermTemplates, createTerm } from './data/terms'
import { useTiAuth } from './data/auth'
import type { Asset, DeliveryTerm, DeliveryTermAsset, TermTemplates } from './data/shapes'
import { PageHeader, Spinner, EmptyState } from './components/ui'
import { formatDate } from './lib/format'

const TYPE_LABEL: Record<string, string> = { CELULAR: 'Celular', COMPUTADOR: 'Computador', MONITOR: 'Monitor', OUTRO: 'Outro' }
const typeLabel = (t?: string | null) => TYPE_LABEL[t ?? ''] ?? (t ?? '—')
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

// Monta o documento HTML completo (usado na prévia, na impressão e no .doc).
function buildTermHtml(term: { type: string; collaboratorName: string; cpf: string | null; funcao: string | null; assets: DeliveryTermAsset[]; createdAt: string }, tpl: string) {
  const data = formatDate(term.createdAt)
  const rows = term.assets.length
    ? term.assets.map((a, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${esc(typeLabel(a.type))}${a.model ? ' — ' + esc(a.model) : ''}</td><td>${esc(a.tag ?? '—')}${a.serial ? ' / ' + esc(a.serial) : ''}</td><td>&nbsp;</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#777">Nenhum equipamento</td></tr>'
  const table = `<table class="assets"><thead><tr><th style="width:34px">Item</th><th>Descrição / Marca / Modelo</th><th>Patrimônio / série</th><th style="width:130px">Estado na entrega</th></tr></thead><tbody>${rows}</tbody></table>`

  const body = esc(tpl)
    .split('{{nome}}').join(esc(term.collaboratorName))
    .split('{{cpf}}').join(esc(term.cpf || '—'))
    .split('{{funcao}}').join(esc(term.funcao || '—'))
    .split('{{data}}').join(esc(data))
    .split('{{ativos}}').join('@@ATIVOS@@')
    .replace(/\n/g, '<br>')
    .split('@@ATIVOS@@').join(table)

  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Termo</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; line-height: 1.6; font-size: 12pt; margin: 0; }
  .doc { max-width: 760px; margin: 0 auto; padding: 28px; }
  .head { text-align: center; border-bottom: 2px solid #0b5fa5; padding-bottom: 10px; margin-bottom: 18px; }
  .head .org { font-size: 12.5pt; font-weight: 700; color: #0b5fa5; }
  .head .sub { font-size: 9pt; color: #555; }
  .body { text-align: justify; }
  table.assets { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11pt; }
  table.assets th, table.assets td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  table.assets th { background: #eef2f7; }
  .foot { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 8.5pt; color: #888; text-align: center; }
</style></head>
<body><div class="doc">
  <div class="head">
    <div class="org">TEG UNIÃO — LOCAÇÃO, SERVIÇOS &amp; EMPREENDIMENTOS LTDA</div>
    <div class="sub">Rua João Pedro de Souza, 139 — Jardim Monte Líbano — Campo Grande/MS · CNPJ: 19.887.731/0001-29</div>
  </div>
  <div class="body">${body}</div>
  <div class="foot">Documento gerado pelo módulo de TI do TEG+.</div>
</div></body></html>`
}

function openPrint(html: string) {
  const w = window.open('', '_blank')
  if (!w) { alert('Permita pop-ups para imprimir.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 350)
}

function downloadDoc(html: string, name: string) {
  const blob = new Blob([`﻿${html}`], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function TermView({ term, templates, onBack }: { term: DeliveryTerm; templates?: TermTemplates; onBack: () => void }) {
  const tpl = (term.type === 'DEVOLUCAO' ? templates?.devolucao : templates?.entrega) ?? '{{ativos}}'
  const html = buildTermHtml(term, tpl)
  const fileName = `termo-${term.type.toLowerCase()}-${term.collaboratorName.replace(/\s+/g, '-').toLowerCase()}.doc`
  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => openPrint(html)}><Printer className="h-4 w-4" /> Imprimir / PDF</button>
        <button className="btn-outline" onClick={() => downloadDoc(html, fileName)}><FileDown className="h-4 w-4" /> Baixar Word</button>
      </div>
      <div className="card overflow-hidden p-0">
        <iframe title="Prévia do termo" srcDoc={html} className="h-[640px] w-full border-0 bg-white" />
      </div>
    </div>
  )
}

function CreateTerm({ onCreated, onCancel, initialCollaborator }: { onCreated: (t: DeliveryTerm) => void; onCancel: () => void; initialCollaborator?: string | null }) {
  const { user } = useTiAuth()
  const assetsQ = useQuery({ queryKey: ['ti', 'assets'], queryFn: listAssets })
  const all = assetsQ.data ?? []

  const collaborators = useMemo(() => {
    const map = new Map<string, { cpf: string | null; funcao: string | null; assets: Asset[] }>()
    for (const a of all) {
      const n = (a.holderName || '').trim()
      if (!n) continue
      if (!map.has(n)) map.set(n, { cpf: a.holderCpf, funcao: a.holderCargo, assets: [] })
      map.get(n)!.assets.push(a)
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name))
  }, [all])

  const [type, setType] = useState<'ENTREGA' | 'DEVOLUCAO'>('ENTREGA')
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [funcao, setFuncao] = useState('')
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [manual, setManual] = useState<(DeliveryTermAsset & { save?: boolean })[]>([])
  const [m, setM] = useState<DeliveryTermAsset>({ type: 'COMPUTADOR', model: '', tag: '', serial: '' })
  const [saveToInv, setSaveToInv] = useState(true)
  const [notes, setNotes] = useState('')
  const [sync, setSync] = useState(true)

  const current = collaborators.find((c) => c.name === name)

  const selectCollaborator = (n: string) => {
    setName(n)
    const c = collaborators.find((x) => x.name === n)
    setCpf(c?.cpf ?? '')
    setFuncao(c?.funcao ?? '')
    const pre: Record<string, boolean> = {}
    c?.assets.forEach((a) => { pre[a.id] = true })
    setPicked(pre)
  }

  useEffect(() => {
    if (initialCollaborator && !name && collaborators.length) {
      const c = collaborators.find((x) => x.name.toLowerCase() === initialCollaborator.toLowerCase())
      if (c) selectCollaborator(c.name); else setName(initialCollaborator)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCollaborator, collaborators])

  const createMut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Sessão expirada.')
      const invAssets = (current?.assets ?? []).filter((a) => picked[a.id])
      const manualClean: DeliveryTermAsset[] = manual.map((a) => ({ type: a.type, model: a.model, tag: a.tag, serial: a.serial }))
      const assets: DeliveryTermAsset[] = [
        ...invAssets.map((a) => ({ type: a.type, model: a.model, tag: a.tag, serial: a.serial })),
        ...manualClean,
      ]
      const newAssets: DeliveryTermAsset[] = manual.filter((x) => x.save).map((a) => ({ type: a.type, model: a.model, tag: a.tag, serial: a.serial }))
      return createTerm({
        type, collaboratorName: name.trim(), cpf: cpf.trim() || null, funcao: funcao.trim() || null,
        assets, assetIds: invAssets.map((a) => a.id), newAssets, notes: notes.trim() || null, syncInventory: sync,
        criadoPorId: user.id, criadoPorNome: user.name,
      })
    },
    onSuccess: (t) => onCreated(t),
  })

  const canSave = name.trim().length > 0 && !createMut.isPending

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-sky-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Tipo de termo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('ENTREGA')} className={`btn ${type === 'ENTREGA' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>Entrega</button>
            <button type="button" onClick={() => setType('DEVOLUCAO')} className={`btn ${type === 'DEVOLUCAO' ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>Devolução</button>
          </div>
        </div>

        <div>
          <label className="label">Colaborador (do inventário)</label>
          <select className="input" value={current ? name : ''} onChange={(e) => selectCollaborator(e.target.value)}>
            <option value="">— Selecione ou preencha manualmente abaixo</option>
            {collaborators.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.assets.length} ativo(s))</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Nome</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do colaborador" /></div>
          <div><label className="label">CPF</label><input className="input" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
          <div><label className="label">Função</label><input className="input" value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Cargo" /></div>
        </div>

        {current && current.assets.length > 0 && (
          <div>
            <label className="label">Equipamentos no inventário</label>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {current.assets.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={!!picked[a.id]} onChange={(e) => setPicked((p) => ({ ...p, [a.id]: e.target.checked }))} />
                  <span className="flex-1 text-slate-700">{typeLabel(a.type)} · {a.model || '—'} <span className="text-xs text-slate-400">patr. {a.tag || '—'}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {manual.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {manual.map((a, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 text-slate-700">{typeLabel(a.type)} · {a.model || '—'} <span className="text-xs text-slate-400">patr. {a.tag || '—'}</span>{a.save && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">→ inventário</span>}</span>
                <button className="text-slate-400 hover:text-red-600" onClick={() => setManual((arr) => arr.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label className="label">Adicionar equipamento manual</label>
          <div className="flex flex-wrap items-end gap-2">
            <select className="input w-auto" value={m.type ?? 'COMPUTADOR'} onChange={(e) => setM({ ...m, type: e.target.value })}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className="input w-40" placeholder="Modelo" value={m.model ?? ''} onChange={(e) => setM({ ...m, model: e.target.value })} />
            <input className="input w-28" placeholder="Patrimônio" value={m.tag ?? ''} onChange={(e) => setM({ ...m, tag: e.target.value })} />
            <input className="input w-28" placeholder="Série" value={m.serial ?? ''} onChange={(e) => setM({ ...m, serial: e.target.value })} />
            <button type="button" className="btn-outline" onClick={() => { if (!m.model && !m.tag) return; setManual((arr) => [...arr, { ...m, save: saveToInv && type === 'ENTREGA' }]); setM({ type: 'COMPUTADOR', model: '', tag: '', serial: '' }) }}><Plus className="h-4 w-4" /> Add</button>
          </div>
          {type === 'ENTREGA' && (
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={saveToInv} onChange={(e) => setSaveToInv(e.target.checked)} /> Cadastrar este equipamento no inventário e vincular ao colaborador
            </label>
          )}
        </div>

        <div><label className="label">Observações (opcional)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" className="mt-0.5" checked={sync} onChange={(e) => setSync(e.target.checked)} />
          <span>{type === 'ENTREGA' ? 'Vincular os ativos a este colaborador no inventário (status “Em uso”)' : 'Dar baixa dos ativos no inventário (status “Estoque”, sem responsável)'}</span>
        </label>

        <div className="flex items-center gap-2">
          <button className="btn-primary" disabled={!canSave} onClick={() => createMut.mutate()}>{createMut.isPending ? 'Gerando…' : 'Gerar termo'}</button>
          <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function Termos() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const preColab = params.get('colaborador')
  const [mode, setMode] = useState<'list' | 'create'>(preColab ? 'create' : 'list')
  const [viewing, setViewing] = useState<DeliveryTerm | null>(null)
  const closeCreate = () => { setMode('list'); if (preColab) setParams({}, { replace: true }) }

  const listQ = useQuery({ queryKey: ['ti', 'terms'], queryFn: listTerms })
  const templatesQ = useQuery({ queryKey: ['ti', 'terms', 'templates'], queryFn: getTermTemplates })
  const terms = listQ.data ?? []

  if (viewing) {
    return (
      <div className="ti-scope">
        <PageHeader title={viewing.type === 'DEVOLUCAO' ? 'Termo de devolução' : 'Termo de entrega'} subtitle={viewing.collaboratorName} />
        <TermView term={viewing} templates={templatesQ.data} onBack={() => setViewing(null)} />
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="ti-scope">
        <PageHeader title="Novo termo" subtitle="Preencha e gere o documento" />
        <CreateTerm
          initialCollaborator={preColab}
          onCancel={closeCreate}
          onCreated={(t) => { qc.invalidateQueries({ queryKey: ['ti', 'terms'] }); qc.invalidateQueries({ queryKey: ['ti', 'assets'] }); closeCreate(); setViewing(t) }}
        />
      </div>
    )
  }

  return (
    <div className="ti-scope">
      <PageHeader
        title="Termos de entrega"
        subtitle="Gere e guarde os termos de entrega e devolução de equipamentos"
        action={<button className="btn-primary" onClick={() => setMode('create')}><Plus className="h-4 w-4" /> Novo termo</button>}
      />
      {listQ.isLoading ? (
        <Spinner />
      ) : terms.length === 0 ? (
        <EmptyState icon={<FileSignature className="h-10 w-10" />} title="Nenhum termo ainda" description="Gere o primeiro termo de entrega de equipamentos" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Itens</th><th className="px-4 py-3">Gerado por</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terms.map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setViewing(t)}>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.type === 'DEVOLUCAO' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {t.type === 'DEVOLUCAO' ? 'Devolução' : 'Entrega'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{t.collaboratorName}</td>
                    <td className="px-4 py-3 text-slate-600">{t.assets.length}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{t.createdByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
