import { useState, useEffect } from 'react'
import {
  Rocket, ClipboardCheck, Users, MessageSquare,
  Plus, Trash2, Save, Edit3, X, Check, Building2, Search, ChevronRight, Upload, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import { ContractSelector } from '../../components/EGPLayout'
import {
  usePortfolio, useTAP, useSalvarTAP,
  useStakeholders, useCriarStakeholder, useAtualizarStakeholder, useDeletarStakeholder,
  useComunicacao, useCriarComunicacao, useAtualizarComunicacao, useDeletarComunicacao,
  useObrasDoPortfolio, useOSCsDoPortfolio, useAddOSC, useDeletarOSC, useUpdateOSC, useOSCItens,
  useAddOSCFromParse, parseOSCPdf,
  useProjetos, useCriarProjeto, useCriarObraEGP,
  type EGPOscRow, type EGPOscItem,
} from '../../hooks/usePMO'
import type { PMOTAP, PMOStakeholder, PMOComunicacao } from '../../types/pmo'

type Tab = 'tap' | 'stakeholders' | 'comunicacao' | 'oscs'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'tap', label: 'TAP', icon: ClipboardCheck },
  { key: 'stakeholders', label: 'Stakeholders', icon: Users },
  { key: 'comunicacao', label: 'Comunicação', icon: MessageSquare },
  { key: 'oscs', label: 'Obras/OS Iniciadas', icon: Building2 },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  tap:           { bg: 'hover:bg-amber-50',  bgActive: 'bg-amber-50',  text: 'text-amber-600',  textActive: 'text-amber-800',  border: 'border-amber-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-amber-500/10',  textDark: 'text-amber-400',  textActiveDark: 'text-amber-300',  borderDark: 'border-amber-500/40' },
  stakeholders:  { bg: 'hover:bg-sky-50',    bgActive: 'bg-sky-50',    text: 'text-sky-600',    textActive: 'text-sky-800',    border: 'border-sky-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-sky-500/10',    textDark: 'text-sky-400',    textActiveDark: 'text-sky-300',    borderDark: 'border-sky-500/40' },
  comunicacao:   { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10', textDark: 'text-violet-400', textActiveDark: 'text-violet-300', borderDark: 'border-violet-500/40' },
  oscs:          { bg: 'hover:bg-teal-50',   bgActive: 'bg-teal-50',   text: 'text-teal-600',   textActive: 'text-teal-800',   border: 'border-teal-500',   bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-teal-500/10',   textDark: 'text-teal-400',   textActiveDark: 'text-teal-300',   borderDark: 'border-teal-500/40' },
}

const INFLUENCIA_OPTS: { value: string; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Main ────────────────────────────────────────────────────────────────────

export default function EGPIniciacao() {
  const { isLightSidebar: isLight } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const [tab, setTab] = useState<Tab>('tap')

  const { data: portfolio } = usePortfolio(portfolioId)

  return (
    <div className="space-y-4">
      {/* Header: título + seletor de contrato */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Rocket size={20} className="text-amber-500" />
          Iniciação
        </h1>
        <ContractSelector />
      </div>

      {/* Tab bar */}
      <div className={`flex gap-1 p-1 rounded-2xl border overflow-x-auto hide-scrollbar ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
      }`}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          const a = TAB_ACCENT[t.key]
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                active
                  ? isLight
                    ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                    : `${a.bgActiveDark} ${a.textActiveDark} ${a.borderDark} font-bold shadow-sm`
                  : isLight
                    ? `${a.bg} ${a.text} font-medium border-transparent`
                    : `${a.bgDark} ${a.textDark} font-medium border-transparent`
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'tap' && <TAPPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'stakeholders' && <StakeholdersPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'comunicacao' && <ComunicacaoPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'oscs' && <ObrasIniciadasPanel portfolioId={portfolioId} isLight={isLight} />}
    </div>
  )
}

// ── TAP Panel ───────────────────────────────────────────────────────────────

function TAPPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: tap, isLoading } = useTAP(portfolioId)
  const salvar = useSalvarTAP()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<PMOTAP>>({})

  useEffect(() => {
    if (tap) setForm(tap)
  }, [tap])

  const handleSave = async () => {
    if (!portfolioId) return
    await salvar.mutateAsync({ ...form, portfolio_id: portfolioId } as PMOTAP & { portfolio_id: string })
    setEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const valueCls = `text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-amber-500/20 focus:border-amber-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-amber-500/20 focus:border-amber-500 text-white'
  }`

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    rascunho: { label: 'Rascunho', cls: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400' },
    em_aprovacao: { label: 'Em Aprovação', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
    aprovado: { label: 'Aprovado', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
    rejeitado: { label: 'Rejeitado', cls: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400' },
  }

  const st = STATUS_CFG[tap?.status ?? 'rascunho'] ?? STATUS_CFG.rascunho

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLight ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <Edit3 size={12} /> Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); if (tap) setForm(tap) }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <X size={12} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-all disabled:opacity-50"
            >
              <Save size={12} /> Salvar
            </button>
          </div>
        )}
      </div>

      {/* Identificacao */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>Identificação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome do Projeto" value={form.nome_projeto} editing={editing} onChange={v => setForm(f => ({ ...f, nome_projeto: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} />
          <Field label="Número" value={form.numero_projeto} editing={editing} onChange={v => setForm(f => ({ ...f, numero_projeto: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} />
          <Field label="Cliente" value={form.cliente} editing={editing} onChange={v => setForm(f => ({ ...f, cliente: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} />
          <Field label="Gerente do Projeto" value={form.gerente_projeto} editing={editing} onChange={v => setForm(f => ({ ...f, gerente_projeto: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} />
          <Field label="Patrocinador" value={form.patrocinador_cliente} editing={editing} onChange={v => setForm(f => ({ ...f, patrocinador_cliente: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} />
          <Field label="Data Abertura" value={form.data_abertura} editing={editing} onChange={v => setForm(f => ({ ...f, data_abertura: v }))} labelCls={labelCls} valueCls={valueCls} inputCls={inputCls} type="date" />
        </div>
      </div>

      {/* Objetivo e Escopo */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>Objetivo e Escopo</h3>
        <div className="space-y-4">
          <div>
            <p className={labelCls}>Objetivo</p>
            {editing ? (
              <textarea
                value={form.objetivo ?? ''}
                onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
                rows={3}
                className={inputCls}
              />
            ) : (
              <p className={valueCls}>{form.objetivo || '-'}</p>
            )}
          </div>
          <div>
            <p className={labelCls}>Escopo Inclui</p>
            <p className={valueCls}>{(form.escopo_inclui ?? []).join('; ') || '-'}</p>
          </div>
          <div>
            <p className={labelCls}>Escopo Não Inclui</p>
            <p className={valueCls}>{(form.escopo_nao_inclui ?? []).join('; ') || '-'}</p>
          </div>
        </div>
      </div>

      {/* Classificacao */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>Classificação</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className={labelCls}>Urgência</p>
            <ClassBadge value={form.classificacao_urgencia} isLight={isLight} />
          </div>
          <div>
            <p className={labelCls}>Complexidade</p>
            <ClassBadge value={form.classificacao_complexidade} isLight={isLight} />
          </div>
          <div>
            <p className={labelCls}>Faturamento</p>
            <ClassBadge value={form.classificacao_faturamento as string} isLight={isLight} />
          </div>
          <div>
            <p className={labelCls}>Duração</p>
            <ClassBadge value={form.classificacao_duracao} isLight={isLight} />
          </div>
        </div>
      </div>

      {/* Orcamento */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>Orçamento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className={labelCls}>Total</p>
            <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {fmtBRL(form.orcamento_total ?? 0)}
            </p>
          </div>
          <div>
            <p className={labelCls}>Referência</p>
            <p className={valueCls}>{form.orcamento_referencia || '-'}</p>
          </div>
        </div>
      </div>

      {/* Premissas & Restricoes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cardCls}>
          <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>Premissas</h3>
          {(form.premissas ?? []).length === 0 ? (
            <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma premissa</p>
          ) : (
            <ul className="space-y-1">
              {(form.premissas ?? []).map((p, i) => (
                <li key={i} className={`text-sm flex items-start gap-2 ${valueCls}`}>
                  <span className="text-amber-500 mt-0.5">-</span> {p}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={cardCls}>
          <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>Restrições</h3>
          {(form.restricoes ?? []).length === 0 ? (
            <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma restrição</p>
          ) : (
            <ul className="space-y-1">
              {(form.restricoes ?? []).map((r, i) => (
                <li key={i} className={`text-sm flex items-start gap-2 ${valueCls}`}>
                  <span className="text-amber-500 mt-0.5">-</span> {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Observacoes */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>Observações</h3>
        {editing ? (
          <textarea
            value={form.observacoes ?? ''}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            rows={3}
            className={inputCls}
          />
        ) : (
          <p className={valueCls}>{form.observacoes || '-'}</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, editing, onChange, labelCls, valueCls, inputCls, type = 'text' }: {
  label: string; value?: string; editing: boolean; onChange: (v: string) => void
  labelCls: string; valueCls: string; inputCls: string; type?: string
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      {editing ? (
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className={inputCls} />
      ) : (
        <p className={valueCls}>{value || '-'}</p>
      )}
    </div>
  )
}

function ClassBadge({ value, isLight }: { value?: string; isLight: boolean }) {
  const map: Record<string, { label: string; light: string; dark: string }> = {
    baixa: { label: 'Baixa', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    baixo: { label: 'Baixo', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    media: { label: 'Média', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    medio: { label: 'Médio', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    alta: { label: 'Alta', light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
    alto: { label: 'Alto', light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
  }
  const m = map[value ?? ''] ?? { label: value ?? '-', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' }
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? m.light : m.dark}`}>
      {m.label}
    </span>
  )
}

// ── Stakeholders Panel ──────────────────────────────────────────────────────

function StakeholdersPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useStakeholders(portfolioId)
  const criar = useCriarStakeholder()
  const atualizar = useAtualizarStakeholder()
  const deletar = useDeletarStakeholder()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMOStakeholder>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMOStakeholder>>({ nome: '', papel: '', organizacao: '', influencia: 'media', estrategia: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-amber-500/20 focus:border-amber-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-amber-500/20 focus:border-amber-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.nome) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ nome: '', papel: '', organizacao: '', influencia: 'media', estrategia: '' })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Nome</th>
              <th className={thCls}>Papel</th>
              <th className={thCls}>Organização</th>
              <th className={thCls}>Influência</th>
              <th className={thCls}>Estratégia</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.nome ?? ''} onChange={e => setEditRow(r => ({ ...r, nome: e.target.value }))} /> : item.nome}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.papel ?? ''} onChange={e => setEditRow(r => ({ ...r, papel: e.target.value }))} /> : item.papel ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.organizacao ?? ''} onChange={e => setEditRow(r => ({ ...r, organizacao: e.target.value }))} /> : item.organizacao ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.influencia ?? 'media'} onChange={e => setEditRow(r => ({ ...r, influencia: e.target.value as PMOStakeholder['influencia'] }))}>
                        {INFLUENCIA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <InfluenciaBadge value={item.influencia} isLight={isLight} />
                    )}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.estrategia ?? ''} onChange={e => setEditRow(r => ({ ...r, estrategia: e.target.value }))} /> : item.estrategia ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {/* Add row */}
            {adding && (
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-amber-50/30' : 'border-white/[0.04] bg-amber-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Nome" value={newRow.nome ?? ''} onChange={e => setNewRow(r => ({ ...r, nome: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Papel" value={newRow.papel ?? ''} onChange={e => setNewRow(r => ({ ...r, papel: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Organização" value={newRow.organizacao ?? ''} onChange={e => setNewRow(r => ({ ...r, organizacao: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.influencia ?? 'media'} onChange={e => setNewRow(r => ({ ...r, influencia: e.target.value as PMOStakeholder['influencia'] }))}>
                    {INFLUENCIA_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={tdCls}><input className={inputCls} placeholder="Estratégia" value={newRow.estrategia ?? ''} onChange={e => setNewRow(r => ({ ...r, estrategia: e.target.value }))} /></td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add button */}
      {!adding && (
        <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <button
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight ? 'text-amber-600 hover:text-amber-700' : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Plus size={14} /> Adicionar stakeholder
          </button>
        </div>
      )}
    </div>
  )
}

function InfluenciaBadge({ value, isLight }: { value?: string; isLight: boolean }) {
  const map: Record<string, { label: string; light: string; dark: string }> = {
    baixa: { label: 'Baixa', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
    media: { label: 'Média', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    alta: { label: 'Alta', light: 'bg-red-100 text-red-700', dark: 'bg-red-500/15 text-red-400' },
  }
  const m = map[value ?? ''] ?? { label: '-', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' }
  return <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? m.light : m.dark}`}>{m.label}</span>
}

// ── Comunicacao Panel ───────────────────────────────────────────────────────

function ComunicacaoPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useComunicacao(portfolioId)
  const criar = useCriarComunicacao()
  const atualizar = useAtualizarComunicacao()
  const deletar = useDeletarComunicacao()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMOComunicacao>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMOComunicacao>>({ item: '', destinatario: '', frequencia: '', canal: '', responsavel: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-amber-500/20 focus:border-amber-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-amber-500/20 focus:border-amber-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.item) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ item: '', destinatario: '', frequencia: '', canal: '', responsavel: '' })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Item</th>
              <th className={thCls}>Destinatário</th>
              <th className={thCls}>Frequência</th>
              <th className={thCls}>Canal</th>
              <th className={thCls}>Responsável</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.item ?? ''} onChange={e => setEditRow(r => ({ ...r, item: e.target.value }))} /> : item.item}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.destinatario ?? ''} onChange={e => setEditRow(r => ({ ...r, destinatario: e.target.value }))} /> : item.destinatario ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.frequencia ?? ''} onChange={e => setEditRow(r => ({ ...r, frequencia: e.target.value }))} /> : item.frequencia ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.canal ?? ''} onChange={e => setEditRow(r => ({ ...r, canal: e.target.value }))} /> : item.canal ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.responsavel ?? ''} onChange={e => setEditRow(r => ({ ...r, responsavel: e.target.value }))} /> : item.responsavel ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {adding && (
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-amber-50/30' : 'border-white/[0.04] bg-amber-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Item" value={newRow.item ?? ''} onChange={e => setNewRow(r => ({ ...r, item: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Destinatario" value={newRow.destinatario ?? ''} onChange={e => setNewRow(r => ({ ...r, destinatario: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Frequencia" value={newRow.frequencia ?? ''} onChange={e => setNewRow(r => ({ ...r, frequencia: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Canal" value={newRow.canal ?? ''} onChange={e => setNewRow(r => ({ ...r, canal: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Responsavel" value={newRow.responsavel ?? ''} onChange={e => setNewRow(r => ({ ...r, responsavel: e.target.value }))} /></td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <button
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight ? 'text-amber-600 hover:text-amber-700' : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <Plus size={14} /> Adicionar comunicacao
          </button>
        </div>
      )}
    </div>
  )
}

// ── Obras / OS Iniciadas Panel ────────────────────────────────────────────────

const STATUS_OBRA: Record<string, { label: string; light: string; dark: string }> = {
  planejada:    { label: 'Planejada',    light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  em_andamento: { label: 'Em Andamento', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  paralisada:   { label: 'Paralisada',   light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-400' },
  concluida:    { label: 'Concluída',    light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-400' },
}

// tipo da obra → tag (operacao+manutencao = O&M)
const TIPO_OBRA: Record<string, { label: string; light: string; dark: string }> = {
  construcao: { label: 'Construção', light: 'bg-sky-100 text-sky-700',       dark: 'bg-sky-500/15 text-sky-300' },
  manutencao: { label: 'O&M',        light: 'bg-amber-100 text-amber-700',   dark: 'bg-amber-500/15 text-amber-300' },
  operacao:   { label: 'O&M',        light: 'bg-amber-100 text-amber-700',   dark: 'bg-amber-500/15 text-amber-300' },
  deposito:   { label: 'Depósito',   light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-500/15 text-violet-300' },
}

const fmtBRLc = (n: number) =>
  n >= 1_000_000 ? `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  : n >= 1_000 ? `R$ ${Math.round(n / 1_000)} mil`
  : `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const fmtData = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

// soma valor, mínimo de início (data_osc), máximo de prazo (vencimento)
function aggOsc(oscs: EGPOscRow[]) {
  let valor = 0, hasV = false
  let minI: string | null = null, maxP: string | null = null
  for (const o of oscs) {
    if (o.valor != null) { valor += o.valor; hasV = true }
    const di = o.data_osc?.slice(0, 10); if (di && (!minI || di < minI)) minI = di
    const dv = o.vencimento?.slice(0, 10); if (dv && (!maxP || dv > maxP)) maxP = dv
  }
  return { valor: hasV ? valor : null, minI, maxP }
}

const selCls = (isLight: boolean, active: boolean) =>
  'text-sm rounded-xl border px-2.5 py-2 outline-none cursor-pointer shrink-0 ' +
  (active
    ? (isLight ? 'border-teal-300 text-teal-700 bg-teal-50 font-semibold' : 'border-teal-500/40 text-teal-300 bg-teal-500/10 font-semibold')
    : (isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/[0.03] border-white/[0.06] text-slate-300'))

function ObrasIniciadasPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: obras, isLoading } = useObrasDoPortfolio(portfolioId)
  const { data: oscs } = useOSCsDoPortfolio(portfolioId)
  const addOSC = useAddOSC()
  const delOSC = useDeletarOSC()
  const updOSC = useUpdateOSC()
  const addOSCParse = useAddOSCFromParse()
  const [parsing, setParsing] = useState<string | null>(null)
  const [parseErr, setParseErr] = useState<string | null>(null)

  const handlePdf = async (obraId: string, file: File) => {
    if (!portfolioId) return
    setParseErr(null); setParsing(obraId)
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1] || '')
        r.onerror = () => rej(new Error('Falha ao ler arquivo'))
        r.readAsDataURL(file)
      })
      const parsed = await parseOSCPdf(b64, file.type || 'application/pdf')
      await addOSCParse.mutateAsync({ portfolio_id: portfolioId, obra_id: obraId, parsed })
      setAddingFor(null)
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : 'Erro ao processar o PDF')
    } finally {
      setParsing(null)
    }
  }
  const { data: projetos } = useProjetos(portfolioId)
  const { data: portfolio } = usePortfolio(portfolioId)
  const criarProjeto = useCriarProjeto()
  const criarObra = useCriarObraEGP()
  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fValor, setFValor] = useState('')
  const [fData, setFData] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [form, setForm] = useState<{ numero_os: string; tipo_servico: string }>({ numero_os: '', tipo_servico: '' })
  const [collapsedPolos, setCollapsedPolos] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<null | 'projeto' | 'obra'>(null)
  const [pForm, setPForm] = useState({ nome: '', codigo: '' })
  const [oForm, setOForm] = useState({ nome: '', codigo: '', pmo_projeto_id: '' })
  const [editOsc, setEditOsc] = useState<EGPOscRow | null>(null)
  const [det, setDet] = useState<EGPOscRow | null>(null)
  const [eForm, setEForm] = useState({ tipo: '', valor: '', data_osc: '', vencimento: '', tipo_servico: '', observacoes: '' })
  const { data: oscItens } = useOSCItens(det?.id ?? editOsc?.id)
  const detObraNome = det ? ((obras ?? []).find(o => o.id === det.obra_id)?.nome ?? '') : ''
  const itensTotal = (oscItens ?? []).reduce((s, it) => s + (it.valor ?? 0), 0)
  const itensPorSecao = (oscItens ?? []).reduce((acc, it) => {
    const k = it.secao ?? '—'; (acc[k] ??= []).push(it); return acc
  }, {} as Record<string, EGPOscItem[]>)

  const openEdit = (osc: EGPOscRow) => {
    setEditOsc(osc)
    setEForm({
      tipo: osc.tipo ?? '', valor: osc.valor != null ? String(osc.valor) : '',
      data_osc: osc.data_osc ?? '', vencimento: osc.vencimento ?? '',
      tipo_servico: osc.tipo_servico ?? '', observacoes: osc.observacoes ?? '',
    })
  }
  const salvarEdit = async () => {
    if (!editOsc || !portfolioId) return
    await updOSC.mutateAsync({
      id: editOsc.id, portfolio_id: portfolioId,
      tipo: eForm.tipo || null,
      valor: eForm.valor.trim() === '' ? null : Number(eForm.valor),
      data_osc: eForm.data_osc || null, vencimento: eForm.vencimento || null,
      tipo_servico: eForm.tipo_servico.trim() || null, observacoes: eForm.observacoes.trim() || null,
    })
    setEditOsc(null)
  }
  const apagarEdit = async () => {
    if (!editOsc || !portfolioId) return
    await delOSC.mutateAsync({ id: editOsc.id, portfolio_id: portfolioId })
    setEditOsc(null)
  }

  // filtros de OSC
  const fAtivo = !!(fTipo || fValor || fData)
  const matchOsc = (o: EGPOscRow) => {
    if (fTipo && o.tipo !== fTipo) return false
    if (fValor) {
      const v = o.valor ?? 0
      if (fValor === 'gt1m' && v <= 1_000_000) return false
      if (fValor === 'mid' && !(v >= 100_000 && v <= 1_000_000)) return false
      if (fValor === 'lt100k' && v >= 100_000) return false
    }
    if (fData && (o.data_osc ?? '').slice(0, 4) !== fData) return false
    return true
  }

  // OSCs agrupadas por obra (já filtradas)
  const oscByObra = new Map<string, EGPOscRow[]>()
  for (const osc of oscs ?? []) {
    if (!osc.obra_id) continue
    if (fAtivo && !matchOsc(osc)) continue
    const arr = oscByObra.get(osc.obra_id) ?? []
    arr.push(osc)
    oscByObra.set(osc.obra_id, arr)
  }

  const list = (obras ?? []).filter(o => {
    if (fAtivo && !(oscByObra.get(o.id)?.length)) return false
    const s = q.trim().toLowerCase()
    return !s || o.nome.toLowerCase().includes(s) || (o.codigo ?? '').toLowerCase().includes(s) || o.polo_nome.toLowerCase().includes(s)
  })

  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const togglePolo = (p: string) => setCollapsedPolos(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })

  // agrupa obras por projeto (polo); inclui projetos vazios (recém-criados)
  const byProjeto = new Map<string, typeof list>()
  for (const o of list) { const k = o.pmo_projeto_id || '__sem__'; const a = byProjeto.get(k) ?? []; a.push(o); byProjeto.set(k, a) }
  const nomeProjeto = new Map<string, string>()
  for (const p of projetos ?? []) nomeProjeto.set(p.id, p.nome)
  for (const o of list) if (o.pmo_projeto_id && !nomeProjeto.has(o.pmo_projeto_id)) nomeProjeto.set(o.pmo_projeto_id, o.polo_nome)
  const grupos = [
    ...[...nomeProjeto.keys()].map(id => ({ id, nome: nomeProjeto.get(id) ?? '—' })),
    ...(byProjeto.has('__sem__') ? [{ id: '__sem__', nome: '— Sem polo' }] : []),
  ].filter(g => !q.trim() || (byProjeto.get(g.id)?.length ?? 0) > 0).sort((a, b) => a.nome.localeCompare(b.nome))

  const handleCriarProjeto = async () => {
    if (!pForm.nome.trim() || !portfolioId) return
    await criarProjeto.mutateAsync({ nome: pForm.nome.trim(), codigo: pForm.codigo.trim() || undefined, portfolio_id: portfolioId, contrato_id: portfolio?.contrato_id ?? undefined })
    setPForm({ nome: '', codigo: '' }); setModal(null)
  }
  const handleCriarObra = async () => {
    if (!oForm.nome.trim() || !oForm.pmo_projeto_id || !portfolioId) return
    const codigo = oForm.codigo.trim() || ('OBR-' + Date.now().toString(36).slice(-5).toUpperCase())
    await criarObra.mutateAsync({ nome: oForm.nome.trim(), codigo, pmo_projeto_id: oForm.pmo_projeto_id, portfolio_id: portfolioId })
    setOForm({ nome: '', codigo: '', pmo_projeto_id: '' }); setModal(null)
  }

  const handleAdd = async (obraId: string) => {
    if (!portfolioId || !form.numero_os.trim()) return
    await addOSC.mutateAsync({ portfolio_id: portfolioId, obra_id: obraId, numero_os: form.numero_os.trim(), tipo_servico: form.tipo_servico.trim() || undefined })
    setForm({ numero_os: '', tipo_servico: '' })
    setAddingFor(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  const inputCls = `rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 ${isLight ? 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-400 text-slate-700' : 'bg-slate-800/60 border-slate-700 focus:ring-teal-500/20 text-white'}`

  return (
    <div className="space-y-4">
      {/* Header + busca + filtros (linha única) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <p className={`text-sm font-semibold shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          {list.length} obra{list.length !== 1 ? 's' : ''}
        </p>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 shrink-0 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <Search size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="buscar…"
            className={`w-28 text-sm outline-none bg-transparent ${isLight ? 'text-slate-700 placeholder:text-slate-400' : 'text-white placeholder:text-slate-500'}`} />
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={selCls(isLight, !!fTipo)}>
          <option value="">Tipo: todos</option>
          <option value="construcao">Construção</option>
          <option value="manutencao">O&amp;M</option>
          <option value="deposito">Depósito</option>
        </select>
        <select value={fValor} onChange={e => setFValor(e.target.value)} className={selCls(isLight, !!fValor)}>
          <option value="">Valor: todos</option>
          <option value="gt1m">&gt; R$ 1 mi</option>
          <option value="mid">R$ 100 mil – 1 mi</option>
          <option value="lt100k">&lt; R$ 100 mil</option>
        </select>
        <select value={fData} onChange={e => setFData(e.target.value)} className={selCls(isLight, !!fData)}>
          <option value="">Ano: todos</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
        {fAtivo && (
          <button onClick={() => { setFTipo(''); setFValor(''); setFData('') }} title="Limpar filtros"
            className={`shrink-0 p-2 rounded-xl ${isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/[0.06]'}`}><X size={15} /></button>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
          <button onClick={() => { setPForm({ nome: '', codigo: '' }); setModal('projeto') }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${isLight ? 'bg-violet-50 text-violet-700 hover:bg-violet-100' : 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25'}`}>
            <Plus size={14} /> Projeto
          </button>
          <button onClick={() => { setOForm({ nome: '', codigo: '', pmo_projeto_id: projetos?.[0]?.id ?? '' }); setModal('obra') }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap bg-teal-600 text-white hover:bg-teal-700">
            <Plus size={14} /> Obra
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <Building2 size={32} className="mx-auto mb-3 opacity-40" />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma obra vinculada a este contrato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map(g => {
            const obrasDoPolo = byProjeto.get(g.id) ?? []
            const poloOpen = !!q.trim() || !collapsedPolos.has(g.id)
            const pa = aggOsc(obrasDoPolo.flatMap(o => oscByObra.get(o.id) ?? []))
            return (
              <div key={g.id}>
                {/* cabeçalho do polo/projeto */}
                <button onClick={() => togglePolo(g.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl ${isLight ? 'bg-slate-100 hover:bg-slate-200/70' : 'bg-white/[0.05] hover:bg-white/[0.08]'}`}>
                  <ChevronRight size={15} className={`shrink-0 transition-transform ${poloOpen ? 'rotate-90' : ''} ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`font-bold text-sm truncate ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>{g.nome}</span>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-white text-slate-500' : 'bg-white/10 text-slate-400'}`}>{obrasDoPolo.length} obra{obrasDoPolo.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="w-[74px] shrink-0" />
                  <span className={`w-[70px] shrink-0 text-right text-xs font-bold tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>{pa.valor != null ? fmtBRLc(pa.valor) : ''}</span>
                  <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{pa.minI ? fmtData(pa.minI) : ''}</span>
                  <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{pa.maxP ? fmtData(pa.maxP) : ''}</span>
                  <span className="w-4 shrink-0" />
                </button>

                {/* obras do polo */}
                {poloOpen && (
                  <div className="space-y-2 mt-2 md:pl-3">
                    {obrasDoPolo.map(o => {
                      const oscList = oscByObra.get(o.id) ?? []
                      const expanded = open.has(o.id)
                      const st = STATUS_OBRA[o.status ?? ''] ?? { label: o.status ?? '—', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' }
                      const oa = aggOsc(oscList)
                      return (
                        <div key={o.id} className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                          {/* linha da obra */}
                          <button onClick={() => toggle(o.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                            <ChevronRight size={15} className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''} ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`font-medium text-sm truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{o.nome}</span>
                              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${oscList.length ? (isLight ? 'bg-teal-50 text-teal-700' : 'bg-teal-500/15 text-teal-300') : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-500/15 text-slate-400')}`}>
                                {oscList.length} OSC{oscList.length !== 1 ? 's' : ''}
                              </span>
                              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? st.light : st.dark}`}>{st.label}</span>
                            </div>
                            <span className="w-[74px] shrink-0" />
                            <span className={`w-[70px] shrink-0 text-right text-xs font-bold tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-100'}`}>{oa.valor != null ? fmtBRLc(oa.valor) : ''}</span>
                            <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{oa.minI ? fmtData(oa.minI) : ''}</span>
                            <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{oa.maxP ? fmtData(oa.maxP) : ''}</span>
                            <span className="w-4 shrink-0" />
                          </button>

                          {/* OSCs (colapsável) */}
                          {expanded && (
                            <div className={`px-3 pb-3 pt-1 border-t ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/[0.04] bg-white/[0.01]'}`}>
                              {oscList.length === 0 && addingFor !== o.id && (
                                <p className={`text-xs py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma OSC nesta obra ainda.</p>
                              )}
                              {oscList.length > 0 && (
                                <div className={`flex items-center gap-3 pb-1 text-[10px] font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="w-[92px] shrink-0">OSC</span>
                                  <span className="flex-1 min-w-0" />
                                  <span className="w-[74px] text-right shrink-0">Tipo</span>
                                  <span className="w-[70px] text-right shrink-0">Valor</span>
                                  <span className="w-[60px] text-right shrink-0">Início</span>
                                  <span className="w-[60px] text-right shrink-0">Prazo</span>
                                  <span className="w-4 shrink-0" />
                                </div>
                              )}
                              {oscList.map(osc => {
                                const tp = TIPO_OBRA[osc.tipo ?? '']
                                return (
                                  <div key={osc.id} onClick={() => setDet(osc)} className={`flex items-center gap-3 py-1.5 text-sm cursor-pointer rounded-lg -mx-1 px-1 ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.04]'}`}>
                                    <span className={`w-[92px] shrink-0 font-mono text-xs font-semibold ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>{osc.numero_os}</span>
                                    <span className={`flex-1 min-w-0 truncate text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{osc.tipo_servico ? `· ${osc.tipo_servico}` : ''}</span>
                                    <span className="w-[74px] shrink-0 flex justify-end">{tp && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isLight ? tp.light : tp.dark}`}>{tp.label}</span>}</span>
                                    <span className={`w-[70px] shrink-0 text-right font-semibold tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{osc.valor != null ? fmtBRLc(osc.valor) : '—'}</span>
                                    <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{osc.data_osc ? fmtData(osc.data_osc) : '—'}</span>
                                    <span className={`w-[60px] shrink-0 text-right text-[11px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{osc.vencimento ? fmtData(osc.vencimento) : '—'}</span>
                                    <button onClick={e => { e.stopPropagation(); openEdit(osc) }} className={`w-4 shrink-0 ${isLight ? 'text-slate-400 hover:text-teal-600' : 'text-slate-500 hover:text-teal-400'}`} title="Editar OSC"><Edit3 size={13} /></button>
                                  </div>
                                )
                              })}

                              {/* adicionar OSC via PDF de abertura (parse Gemini) */}
                              {addingFor === o.id ? (
                                <div className="mt-2">
                                  {parsing === o.id ? (
                                    <div className="flex items-center gap-2 text-xs font-medium text-teal-600">
                                      <Loader2 size={14} className="animate-spin" /> Lendo o PDF e extraindo número, valor, datas e itens…
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer bg-teal-600 text-white hover:bg-teal-700">
                                          <Upload size={14} /> Anexar PDF da OSC
                                          <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(o.id, f); e.target.value = '' }} />
                                        </label>
                                        <button onClick={() => { setAddingFor(null); setParseErr(null) }} className={`text-xs ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}>cancelar</button>
                                      </div>
                                      <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>O Gemini lê o PDF de abertura e preenche número, valor, início, prazo, tipo e itens automaticamente.</p>
                                      {parseErr && <p className="text-[11px] mt-1 text-red-500">{parseErr}</p>}
                                    </>
                                  )}
                                </div>
                              ) : (
                                <button onClick={() => { setAddingFor(o.id); setParseErr(null) }} className={`inline-flex items-center gap-1 mt-1.5 text-xs font-semibold ${isLight ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'}`}>
                                  <Plus size={13} /> Adicionar OSC
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Cada obra pode ter várias OSCs (em <code>pmo_fluxo_os</code>, ligadas à obra). Adicione com o número real da OSC — nada é preenchido automaticamente.
      </p>

      {/* Modal criar projeto / obra */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-2xl border p-5 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{modal === 'projeto' ? 'Novo Projeto / Polo' : 'Nova Obra'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {modal === 'projeto' ? (
              <div className="space-y-3">
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nome do projeto/polo *</label>
                  <input autoFocus value={pForm.nome} onChange={e => setPForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: F9 - Nova Frente" className={`${inputCls} w-full mt-1`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Código (opcional)</label>
                  <input value={pForm.codigo} onChange={e => setPForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex.: F9" className={`${inputCls} w-full mt-1`} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setModal(null)} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Cancelar</button>
                  <button onClick={handleCriarProjeto} disabled={!pForm.nome.trim() || criarProjeto.isPending} className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40">Criar projeto</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Projeto / Polo *</label>
                  <select value={oForm.pmo_projeto_id} onChange={e => setOForm(f => ({ ...f, pmo_projeto_id: e.target.value }))} className={`${inputCls} w-full mt-1`}>
                    <option value="">Selecione…</option>
                    {(projetos ?? []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nome da obra *</label>
                  <input autoFocus value={oForm.nome} onChange={e => setOForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex.: LD ... - ..., 138 KV" className={`${inputCls} w-full mt-1`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Código (opcional — gerado se vazio)</label>
                  <input value={oForm.codigo} onChange={e => setOForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex.: OSC-2026/099" className={`${inputCls} w-full mt-1`} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setModal(null)} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Cancelar</button>
                  <button onClick={handleCriarObra} disabled={!oForm.nome.trim() || !oForm.pmo_projeto_id || criarObra.isPending} className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40">Criar obra</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal DETALHES da OSC */}
      {det && (() => {
        const tp = TIPO_OBRA[det.tipo ?? '']
        const card = (label: string, val: string) => (
          <div className={`rounded-xl border px-3 py-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
            <div className={`text-sm font-bold tabular-nums mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>{val}</div>
          </div>
        )
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDet(null)}>
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
              {/* header */}
              <div className={`flex items-start justify-between gap-3 p-5 pb-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-mono font-bold text-lg ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>{det.numero_os}</h3>
                    {tp && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isLight ? tp.light : tp.dark}`}>{tp.label}</span>}
                  </div>
                  {detObraNome && <p className={`text-sm font-medium mt-1 truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{detObraNome}</p>}
                  {det.tipo_servico && <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{det.tipo_servico}</p>}
                </div>
                <button onClick={() => setDet(null)} className="shrink-0 text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              {/* cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-5 pb-3">
                {card('Valor', det.valor != null ? fmtBRL(det.valor) : '—')}
                {card('Início', det.data_osc ? fmtData(det.data_osc) : '—')}
                {card('Prazo', det.vencimento ? fmtData(det.vencimento) : '—')}
                {card('Saldo', det.saldo_reais != null ? fmtBRL(det.saldo_reais) : '—')}
              </div>
              {/* itens */}
              {(oscItens?.length ?? 0) > 0 ? (
                <div className="px-5 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Itens / Quantitativos</h4>
                    <span className={`text-xs font-bold tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>Σ {fmtBRLc(itensTotal)}</span>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(itensPorSecao).map(([sec, itens]) => (
                      <div key={sec}>
                        <div className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>{sec}</div>
                        <div className="space-y-1.5">
                          {itens.map(it => {
                            const pct = it.valor && it.valor_acum != null ? Math.min(100, Math.round((it.valor_acum / it.valor) * 100)) : null
                            return (
                              <div key={it.id}>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className={`flex-1 min-w-0 truncate ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{it.subsec_nome}</span>
                                  <span className={`w-20 text-right tabular-nums ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{it.quantidade != null ? it.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'} {it.unidade}</span>
                                  <span className={`w-24 text-right tabular-nums font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{it.valor != null ? fmtBRLc(it.valor) : '—'}</span>
                                  <span className={`w-9 text-right text-[10px] tabular-nums ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{pct != null ? pct + '%' : ''}</span>
                                </div>
                                {pct != null && (
                                  <div className={`h-1 rounded-full mt-1 overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                                    <div className="h-full rounded-full bg-teal-500" style={{ width: pct + '%' }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={`px-5 py-3 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Sem itens/quantitativos cadastrados para esta OSC.</p>
              )}
              {/* footer */}
              <div className={`flex items-center justify-between gap-2 p-5 pt-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{oscItens?.length ?? 0} {oscItens?.length === 1 ? 'item' : 'itens'}</span>
                <div className="flex gap-2">
                  <button onClick={() => setDet(null)} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Fechar</button>
                  <button onClick={() => { const o = det; setDet(null); openEdit(o) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700"><Edit3 size={14} /> Editar</button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal editar OSC */}
      {editOsc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditOsc(null)}>
          <div onClick={e => e.stopPropagation()} className={`w-full ${oscItens?.length ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto rounded-2xl border p-5 shadow-xl ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>{editOsc.numero_os}</h3>
              <button onClick={() => setEditOsc(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tipo</label>
                  <select value={eForm.tipo} onChange={e => setEForm(f => ({ ...f, tipo: e.target.value }))} className={`${inputCls} w-full mt-1`}>
                    <option value="">—</option>
                    <option value="construcao">Construção</option>
                    <option value="manutencao">O&amp;M</option>
                    <option value="deposito">Depósito</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Valor (R$)</label>
                  <input type="number" value={eForm.valor} onChange={e => setEForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" className={`${inputCls} w-full mt-1`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Data da OSC</label>
                  <input type="date" value={eForm.data_osc} onChange={e => setEForm(f => ({ ...f, data_osc: e.target.value }))} className={`${inputCls} w-full mt-1`} />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Prazo / Vencimento</label>
                  <input type="date" value={eForm.vencimento} onChange={e => setEForm(f => ({ ...f, vencimento: e.target.value }))} className={`${inputCls} w-full mt-1`} />
                </div>
              </div>
              <div>
                <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tipo de serviço</label>
                <input value={eForm.tipo_servico} onChange={e => setEForm(f => ({ ...f, tipo_servico: e.target.value }))} placeholder="Opcional" className={`${inputCls} w-full mt-1`} />
              </div>
              <div>
                <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Observações</label>
                <textarea value={eForm.observacoes} onChange={e => setEForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional" className={`${inputCls} w-full mt-1 resize-none`} />
              </div>

              {/* Itens / Quantitativos (normalizados pelo EAP) */}
              {(oscItens?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Itens / Quantitativos <span className="opacity-60">({oscItens!.length})</span></label>
                    <span className={`text-[11px] font-bold tabular-nums ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Σ {fmtBRLc(itensTotal)}</span>
                  </div>
                  <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {Object.entries(itensPorSecao).map(([sec, itens]) => (
                      <div key={sec}>
                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.05] text-slate-400'}`}>{sec}</div>
                        {itens.map(it => (
                          <div key={it.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs border-t ${isLight ? 'border-slate-100 text-slate-700' : 'border-white/[0.04] text-slate-200'}`}>
                            <span className="flex-1 min-w-0 truncate">{it.subsec_nome}</span>
                            <span className={`w-20 text-right tabular-nums ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{it.quantidade != null ? it.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'} {it.unidade}</span>
                            <span className="w-24 text-right tabular-nums font-semibold">{it.valor != null ? fmtBRLc(it.valor) : '—'}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button onClick={apagarEdit} disabled={delOSC.isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'} disabled:opacity-40`}><Trash2 size={14} /> Apagar OSC</button>
                <div className="flex gap-2">
                  <button onClick={() => setEditOsc(null)} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>Cancelar</button>
                  <button onClick={salvarEdit} disabled={updOSC.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"><Save size={14} /> Salvar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
