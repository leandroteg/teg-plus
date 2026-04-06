import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Rocket, ClipboardCheck, Users, MessageSquare,
  Plus, Trash2, Save, Edit3, X, Check,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  usePortfolio, useTAP, useSalvarTAP,
  useStakeholders, useCriarStakeholder, useAtualizarStakeholder, useDeletarStakeholder,
  useComunicacao, useCriarComunicacao, useAtualizarComunicacao, useDeletarComunicacao,
} from '../../hooks/usePMO'
import type { PMOTAP, PMOStakeholder, PMOComunicacao } from '../../types/pmo'

type Tab = 'tap' | 'stakeholders' | 'comunicacao'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'tap', label: 'TAP', icon: ClipboardCheck },
  { key: 'stakeholders', label: 'Stakeholders', icon: Users },
  { key: 'comunicacao', label: 'Comunicação', icon: MessageSquare },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  tap:           { bg: 'hover:bg-amber-50',  bgActive: 'bg-amber-50',  text: 'text-amber-600',  textActive: 'text-amber-800',  border: 'border-amber-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-amber-500/10',  textDark: 'text-amber-400',  textActiveDark: 'text-amber-300',  borderDark: 'border-amber-500/40' },
  stakeholders:  { bg: 'hover:bg-sky-50',    bgActive: 'bg-sky-50',    text: 'text-sky-600',    textActive: 'text-sky-800',    border: 'border-sky-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-sky-500/10',    textDark: 'text-sky-400',    textActiveDark: 'text-sky-300',    borderDark: 'border-sky-500/40' },
  comunicacao:   { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10', textDark: 'text-violet-400', textActiveDark: 'text-violet-300', borderDark: 'border-violet-500/40' },
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
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('tap')

  const { data: portfolio } = usePortfolio(portfolioId)

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => nav('/egp/iniciacao')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Rocket size={20} className="text-amber-500" />
          Iniciação
        </h1>
        {portfolio && (
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {portfolio.nome_obra} - {portfolio.numero_osc}
          </p>
        )}
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
