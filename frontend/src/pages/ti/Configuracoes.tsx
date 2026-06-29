import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Smartphone, ShieldCheck, History, FileSignature } from 'lucide-react'
import {
  listCategories, listAllNamed, createNamed, updateNamed,
  getSla, updateSla, listAllCustomFields, createCustomField, updateCustomField, type NamedTable,
} from './data/meta'
import { getTermTemplates, setTermTemplates } from './data/terms'
import { getRetention, setRetention, listAudit } from './data/lgpd'
import type { Category, Priority } from './data/shapes'
import { PRIORITY_META } from './lib/constants'
import { PageHeader, Spinner } from './components/ui'
import { formatDateTime } from './lib/format'
import { getWhatsappState, sendWhatsappCommand, type WaStatus } from './data/whatsapp'

const SLA_ORDER: Priority[] = ['URGENTE', 'ALTA', 'MEDIA', 'BAIXA']

function Row({ item, table, invalidate }: { item: Category; table: NamedTable; invalidate: () => void }) {
  const [name, setName] = useState(item.name)
  const mut = useMutation({
    mutationFn: (patch: { name?: string; active?: boolean }) => updateNamed(table, item.id, patch),
    onSuccess: invalidate,
  })
  return (
    <li className="flex items-center gap-2 py-2">
      <input
        className="input flex-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name.trim() !== item.name) mut.mutate({ name: name.trim() }) }}
      />
      <span className={`w-16 text-center text-xs font-medium ${item.active ? 'text-emerald-600' : 'text-slate-400'}`}>
        {item.active ? 'Ativo' : 'Inativo'}
      </span>
      <button className="btn-ghost text-xs" onClick={() => mut.mutate({ active: !item.active })}>
        {item.active ? 'Desativar' : 'Ativar'}
      </button>
    </li>
  )
}

function Manager({ title, table, activeKey }: { title: string; table: NamedTable; activeKey: string[] }) {
  const qc = useQueryClient()
  const allKey = [...activeKey, 'all']
  const invalidate = () => { qc.invalidateQueries({ queryKey: allKey }); qc.invalidateQueries({ queryKey: activeKey }) }
  const { data, isLoading } = useQuery({ queryKey: allKey, queryFn: () => listAllNamed(table) })
  const [name, setName] = useState('')
  const addMut = useMutation({ mutationFn: () => createNamed(table, name.trim()), onSuccess: () => { setName(''); invalidate() } })

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(data ?? []).map((item) => <Row key={item.id} item={item} table={table} invalidate={invalidate} />)}
        </ul>
      )}
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <input
          className="input flex-1"
          placeholder={`Novo(a) ${title.toLowerCase().slice(0, -1)}…`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) addMut.mutate() }}
        />
        <button className="btn-primary" disabled={!name.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </div>
  )
}

function SlaEditor() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['ti', 'sla'], queryFn: getSla })
  const [vals, setVals] = useState<Record<string, number>>({})
  useEffect(() => { if (data) setVals(data) }, [data])
  const mut = useMutation({ mutationFn: () => updateSla(vals), onSuccess: () => qc.invalidateQueries({ queryKey: ['ti', 'sla'] }) })

  return (
    <div className="card mt-6 p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Prazos de atendimento (SLA)</h2>
      <p className="mb-3 text-xs text-slate-500">Tempo-alvo de resolução, em horas, por prioridade</p>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SLA_ORDER.map((p) => (
              <div key={p}>
                <label className="label">{PRIORITY_META[p].label}</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} className="input" value={vals[p] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [p]: Number(e.target.value) }))} />
                  <span className="text-sm text-slate-400">h</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Salvando…' : 'Salvar prazos'}</button>
            {mut.isSuccess && <span className="text-sm text-emerald-600">Prazos salvos!</span>}
          </div>
        </>
      )}
    </div>
  )
}

function CustomFieldsManager() {
  const qc = useQueryClient()
  const { data: categories } = useQuery({ queryKey: ['ti', 'categories'], queryFn: listCategories })
  const [categoryId, setCategoryId] = useState('')
  useEffect(() => { if (!categoryId && categories?.length) setCategoryId(categories[0].id) }, [categories, categoryId])

  const { data: fields } = useQuery({
    queryKey: ['ti', 'customfields', 'all', categoryId],
    queryFn: () => listAllCustomFields(categoryId),
    enabled: !!categoryId,
  })

  const [label, setLabel] = useState('')
  const [type, setType] = useState('TEXT')
  const [required, setRequired] = useState(false)
  const [options, setOptions] = useState('')
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ti', 'customfields'] })

  const addMut = useMutation({
    mutationFn: () => createCustomField({
      categoryId, label: label.trim(), type, required,
      options: type === 'SELECT' ? options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { setLabel(''); setOptions(''); setRequired(false); invalidate() },
  })
  const patchMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { active?: boolean } }) => updateCustomField(id, patch),
    onSuccess: invalidate,
  })

  return (
    <div className="card mt-6 p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Campos personalizados por categoria</h2>
      <p className="mb-3 text-xs text-slate-500">Campos extras que aparecem ao abrir um chamado da categoria</p>
      <select className="input mb-3 w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <ul className="divide-y divide-slate-100">
        {(fields ?? []).map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1 text-slate-700">{f.label} <span className="text-xs text-slate-400">({f.type}{f.required ? ', obrigatório' : ''})</span></span>
            <span className={`text-xs font-medium ${f.active ? 'text-emerald-600' : 'text-slate-400'}`}>{f.active ? 'Ativo' : 'Inativo'}</span>
            <button className="btn-ghost text-xs" onClick={() => patchMut.mutate({ id: f.id, patch: { active: !f.active } })}>{f.active ? 'Desativar' : 'Ativar'}</button>
          </li>
        ))}
        {(fields ?? []).length === 0 && <li className="py-2 text-sm text-slate-400">Nenhum campo nesta categoria</li>}
      </ul>
      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input flex-1" placeholder="Rótulo (ex.: Nº de patrimônio)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="TEXT">Texto</option>
            <option value="NUMBER">Número</option>
            <option value="DATE">Data</option>
            <option value="SELECT">Lista</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-slate-600"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Obrigatório</label>
        </div>
        {type === 'SELECT' && <input className="input" placeholder="Opções separadas por vírgula" value={options} onChange={(e) => setOptions(e.target.value)} />}
        <button className="btn-primary" disabled={!label.trim() || addMut.isPending} onClick={() => addMut.mutate()}><Plus className="h-4 w-4" /> Adicionar campo</button>
      </div>
    </div>
  )
}

const WA_META: Record<WaStatus, { label: string; cls: string }> = {
  disconnected: { label: 'Desconectado', cls: 'bg-slate-100 text-slate-600' },
  initializing: { label: 'Iniciando…', cls: 'bg-amber-100 text-amber-700' },
  qr: { label: 'Aguardando leitura do QR', cls: 'bg-violet-100 text-violet-700' },
  ready: { label: 'Conectado', cls: 'bg-emerald-100 text-emerald-700' },
  auth_failure: { label: 'Falha de conexão', cls: 'bg-red-100 text-red-700' },
}

function WhatsAppPanel() {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: ['ti', 'whatsapp'], queryFn: getWhatsappState, refetchInterval: 2500 })
  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [feedback, setFeedback] = useState('')

  const cmd = useMutation({
    mutationFn: (v: { comando: 'connect' | 'disconnect' | 'test'; payload?: { to: string; text?: string } }) =>
      sendWhatsappCommand(v.comando, v.payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ti', 'whatsapp'] }),
  })

  const status = data?.status ?? 'disconnected'
  const meta = WA_META[status]
  const workerOnline = !!data?.workerVistoEm && Date.now() - new Date(data.workerVistoEm).getTime() < 60_000

  return (
    <div className="card mt-6 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">WhatsApp (canal)</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
        {status === 'ready' && data?.numero && <span className="text-xs text-slate-500">como +{data.numero}</span>}
        <span className={`ml-auto inline-flex items-center gap-1 text-xs ${workerOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
          <span className={`h-2 w-2 rounded-full ${workerOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          {workerOnline ? 'Worker online' : 'Worker offline'}
        </span>
      </div>

      {!workerOnline && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          O serviço (worker) não está rodando na máquina da T.I. Inicie-o (<code>npm start</code> em <code>whatsapp-worker</code>) para conectar e receber mensagens.
        </p>
      )}

      {status === 'qr' && data?.qr && (
        <div className="mb-3 flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-4">
          <img src={data.qr} alt="QR de pareamento" className="h-56 w-56" />
          <p className="text-center text-xs text-slate-500">
            No WhatsApp do número corporativo: <b>Aparelhos conectados → Conectar um aparelho</b> e escaneie.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status !== 'ready' ? (
          <button className="btn-primary" disabled={!workerOnline || cmd.isPending} onClick={() => cmd.mutate({ comando: 'connect' })}>
            Conectar
          </button>
        ) : (
          <button className="btn-outline" disabled={cmd.isPending} onClick={() => cmd.mutate({ comando: 'disconnect' })}>
            Desconectar
          </button>
        )}
      </div>

      {status === 'ready' && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-medium text-slate-600">Enviar mensagem de teste</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Número (com DDD)</label>
              <input className="input w-44" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="11999998888" />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="label">Mensagem (opcional)</label>
              <input className="input" value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Mensagem de teste do TEG+ ✅" />
            </div>
            <button
              className="btn-primary"
              disabled={!testTo.trim() || cmd.isPending}
              onClick={() => { cmd.mutate({ comando: 'test', payload: { to: testTo.trim(), text: testMsg.trim() || undefined } }); setFeedback('Comando de teste enviado ao worker.') }}
            >
              Enviar
            </button>
            {feedback && <span className="text-xs text-emerald-600">{feedback}</span>}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">Conexão não-oficial — use um número dedicado. O serviço roda on-prem na T.I.</p>
    </div>
  )
}

function TermTemplatesPanel() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['ti', 'terms', 'templates'], queryFn: getTermTemplates })
  const [entrega, setEntrega] = useState('')
  const [devolucao, setDevolucao] = useState('')
  useEffect(() => { if (data) { setEntrega(data.entrega); setDevolucao(data.devolucao) } }, [data])
  const saveMut = useMutation({
    mutationFn: () => setTermTemplates({ entrega, devolucao }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ti', 'terms', 'templates'] }),
  })
  return (
    <div className="card mt-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-slate-700">Modelos de termo (entrega/devolução)</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Edite o texto dos termos. Campos automáticos: <code>{'{{nome}}'}</code>, <code>{'{{cpf}}'}</code>, <code>{'{{funcao}}'}</code>, <code>{'{{data}}'}</code> e <code>{'{{ativos}}'}</code> (tabela de equipamentos). Cabeçalho e assinaturas são adicionados sozinhos
      </p>
      <label className="label">Termo de entrega</label>
      <textarea className="input min-h-[160px] resize-y font-mono text-xs" value={entrega} onChange={(e) => setEntrega(e.target.value)} />
      <label className="label mt-3 block">Termo de devolução</label>
      <textarea className="input min-h-[120px] resize-y font-mono text-xs" value={devolucao} onChange={(e) => setDevolucao(e.target.value)} />
      <div className="mt-3 flex items-center gap-2">
        <button className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>{saveMut.isPending ? 'Salvando…' : 'Salvar modelos'}</button>
        {saveMut.isSuccess && <span className="text-sm text-emerald-600">Salvo!</span>}
      </div>
    </div>
  )
}

const AUDIT_LABEL: Record<string, string> = {
  EXPORT: 'Exportação', ANONIMIZAR: 'Anonimização', RETENCAO: 'Retenção',
  SOLIC_EXCLUSAO: 'Pedido de exclusão', PERFIL: 'Configuração', PAPEL: 'Papel', ACESSO: 'Acesso', TERMO: 'Termo',
}
const AUDIT_BADGE: Record<string, string> = {
  EXPORT: 'bg-blue-100 text-blue-700', ANONIMIZAR: 'bg-red-100 text-red-700', RETENCAO: 'bg-amber-100 text-amber-700',
  SOLIC_EXCLUSAO: 'bg-violet-100 text-violet-700', PERFIL: 'bg-slate-100 text-slate-600',
  PAPEL: 'bg-emerald-100 text-emerald-700', ACESSO: 'bg-slate-100 text-slate-600', TERMO: 'bg-sky-100 text-sky-700',
}

function RetentionPanel() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['ti', 'lgpd', 'retention'], queryFn: getRetention })
  const [enabled, setEnabled] = useState(false)
  const [months, setMonths] = useState(24)
  useEffect(() => { if (data) { setEnabled(data.enabled); setMonths(data.months) } }, [data])

  const saveMut = useMutation({
    mutationFn: () => setRetention({ enabled, months }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ti', 'lgpd', 'retention'] }),
  })

  return (
    <div className="card mt-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-700">Retenção de dados (LGPD)</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Anonimiza automaticamente requerentes inativos — sem chamados em aberto e sem atividade no período. A varredura automática roda numa rotina agendada (fase de Edge Functions)
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Ativar anonimização automática
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Anonimizar após</span>
        <input type="number" min={1} max={120} className="input w-20" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        <span className="text-slate-600">meses de inatividade</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">Elegíveis agora: <strong className="text-slate-600">{data?.eligibleNow ?? 0}</strong> requerente(s)</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>{saveMut.isPending ? 'Salvando…' : 'Salvar'}</button>
        <button className="btn-outline opacity-60" disabled title="Disponível na fase de Edge Functions">Executar agora (em breve)</button>
        {saveMut.isSuccess && <span className="text-sm text-emerald-600">Salvo!</span>}
      </div>
    </div>
  )
}

function AuditPanel() {
  const { data } = useQuery({ queryKey: ['ti', 'lgpd', 'audit'], queryFn: () => listAudit(100) })
  const items = data ?? []
  return (
    <div className="card mt-6 p-5">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-700">Auditoria de dados pessoais (LGPD)</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Registro de acessos e alterações de dados pessoais — exportações, anonimizações, mudanças de papel/acesso e solicitações
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum evento registrado ainda</p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-2 pr-2">Quando</th><th className="py-2 pr-2">Ação</th><th className="py-2 pr-2">Por</th><th className="py-2 pr-2">Titular</th><th className="py-2">Detalhe</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-400">{formatDateTime(e.createdAt)}</td>
                  <td className="py-2 pr-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${AUDIT_BADGE[e.action] ?? 'bg-slate-100 text-slate-600'}`}>{AUDIT_LABEL[e.action] ?? e.action}</span></td>
                  <td className="py-2 pr-2 text-slate-600">{e.actorName ?? '—'}</td>
                  <td className="py-2 pr-2 text-slate-600">{e.targetName ?? '—'}</td>
                  <td className="py-2 text-xs text-slate-500">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Configuracoes() {
  return (
    <div className="ti-scope">
      <PageHeader title="Configurações" subtitle="Categorias, setores, SLA, campos, termos e LGPD" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Manager title="Categorias" table="ti_categorias" activeKey={['ti', 'categories']} />
        <Manager title="Setores" table="ti_setores" activeKey={['ti', 'sectors']} />
      </div>
      <SlaEditor />
      <CustomFieldsManager />
      <WhatsAppPanel />
      <TermTemplatesPanel />
      <RetentionPanel />
      <AuditPanel />
    </div>
  )
}
