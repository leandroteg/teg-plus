import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, FileText, Lightbulb, Award, PackageX,
  Plus, Trash2, Save, Edit3, X, Check, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import {
  usePortfolio, useStatusReports,
  useLicoesAprendidas, useCriarLicao, useAtualizarLicao, useDeletarLicao,
  useAceite, useSalvarAceite,
  useDesmobilizacao, useCriarDesmob, useAtualizarDesmob, useDeletarDesmob,
} from '../../hooks/usePMO'
import type { PMOStatusReport, PMOLicaoAprendida, PMOAceite, PMODesmobilizacao } from '../../types/pmo'

type Tab = 'status_report' | 'licoes' | 'aceite' | 'desmobilizacao'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'status_report', label: 'Status Report', icon: FileText },
  { key: 'licoes', label: 'Lições Aprendidas', icon: Lightbulb },
  { key: 'aceite', label: 'Aceite', icon: Award },
  { key: 'desmobilizacao', label: 'Desmobilização', icon: PackageX },
]

const TAB_ACCENT: Record<Tab, { bg: string; bgActive: string; text: string; textActive: string; border: string; bgDark: string; bgActiveDark: string; textDark: string; textActiveDark: string; borderDark: string }> = {
  status_report:  { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-teal-500/10',    textDark: 'text-teal-400',    textActiveDark: 'text-teal-300',    borderDark: 'border-teal-500/40' },
  licoes:         { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-amber-500/10',   textDark: 'text-amber-400',   textActiveDark: 'text-amber-300',   borderDark: 'border-amber-500/40' },
  aceite:         { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-emerald-500/10', textDark: 'text-emerald-400', textActiveDark: 'text-emerald-300', borderDark: 'border-emerald-500/40' },
  desmobilizacao: { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  bgDark: 'hover:bg-white/[0.03]', bgActiveDark: 'bg-violet-500/10',  textDark: 'text-violet-400',  textActiveDark: 'text-violet-300',  borderDark: 'border-violet-500/40' },
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Main ────────────────────────────────────────────────────────────────────

export default function EGPEncerramento() {
  const { isLightSidebar: isLight } = useTheme()
  const portfolioId = useEGPPortfolioId()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('status_report')

  const { data: portfolio } = usePortfolio(portfolioId)

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => nav('/egp/encerramento')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <CheckCircle2 size={20} className="text-teal-500" />
          Encerramento
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
      {tab === 'status_report' && <StatusReportPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'licoes' && <LicoesPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'aceite' && <AceitePanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'desmobilizacao' && <DesmobilizacaoPanel portfolioId={portfolioId} isLight={isLight} />}
    </div>
  )
}

// ── Status Report Panel ────────────────────────────────────────────────────

function StatusReportPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: reports, isLoading } = useStatusReports(portfolioId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const valueCls = `text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    rascunho: { label: 'Rascunho', cls: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400' },
    publicado: { label: 'Publicado', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
  }

  if (!reports || reports.length === 0) {
    return (
      <div className={cardCls}>
        <p className={`text-sm text-center py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Nenhum status report encontrado
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reports.map(r => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.rascunho
        return (
          <div key={r.id} className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                {r.periodo}
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className={labelCls}>Data Report</p>
                <p className={valueCls}>{r.data_report ?? '-'}</p>
              </div>
              <div>
                <p className={labelCls}>OS Total</p>
                <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{r.os_total}</p>
              </div>
              <div>
                <p className={labelCls}>Faturamento Atual</p>
                <p className={`text-lg font-bold text-teal-500`}>{fmtBRL(r.faturamento_atual ?? 0)}</p>
              </div>
              <div>
                <p className={labelCls}>Meta Faturamento</p>
                <p className={valueCls}>{fmtBRL(r.meta_faturamento ?? 0)}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Licoes Aprendidas Panel ────────────────────────────────────────────────

function LicoesPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useLicoesAprendidas(portfolioId)
  const criar = useCriarLicao()
  const atualizar = useAtualizarLicao()
  const deletar = useDeletarLicao()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMOLicaoAprendida>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMOLicaoAprendida>>({ fase: '', descricao: '', tipo: 'positivo', recomendacao: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.descricao) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ fase: '', descricao: '', tipo: 'positivo', recomendacao: '' })
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
        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
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
              <th className={thCls}>Fase</th>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Recomendação</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.fase ?? ''} onChange={e => setEditRow(r => ({ ...r, fase: e.target.value }))} /> : item.fase ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.descricao ?? ''} onChange={e => setEditRow(r => ({ ...r, descricao: e.target.value }))} /> : item.descricao}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.tipo ?? 'positivo'} onChange={e => setEditRow(r => ({ ...r, tipo: e.target.value as 'positivo' | 'negativo' }))}>
                        <option value="positivo">Positivo</option>
                        <option value="negativo">Negativo</option>
                      </select>
                    ) : (
                      <TipoBadge value={item.tipo} isLight={isLight} />
                    )}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.recomendacao ?? ''} onChange={e => setEditRow(r => ({ ...r, recomendacao: e.target.value }))} /> : item.recomendacao ?? '-'}
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
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-teal-50/30' : 'border-white/[0.04] bg-teal-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Fase" value={newRow.fase ?? ''} onChange={e => setNewRow(r => ({ ...r, fase: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Descrição" value={newRow.descricao ?? ''} onChange={e => setNewRow(r => ({ ...r, descricao: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.tipo ?? 'positivo'} onChange={e => setNewRow(r => ({ ...r, tipo: e.target.value as 'positivo' | 'negativo' }))}>
                    <option value="positivo">Positivo</option>
                    <option value="negativo">Negativo</option>
                  </select>
                </td>
                <td className={tdCls}><input className={inputCls} placeholder="Recomendação" value={newRow.recomendacao ?? ''} onChange={e => setNewRow(r => ({ ...r, recomendacao: e.target.value }))} /></td>
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
              isLight ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'
            }`}
          >
            <Plus size={14} /> Adicionar lição
          </button>
        </div>
      )}
    </div>
  )
}

function TipoBadge({ value, isLight }: { value?: string; isLight: boolean }) {
  if (value === 'positivo') {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
      }`}>
        <ThumbsUp size={10} /> Positivo
      </span>
    )
  }
  if (value === 'negativo') {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400'
      }`}>
        <ThumbsDown size={10} /> Negativo
      </span>
    )
  }
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400'}`}>-</span>
}

// ── Aceite Panel ───────────────────────────────────────────────────────────

function AceitePanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: aceite, isLoading } = useAceite(portfolioId)
  const salvar = useSalvarAceite()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<PMOAceite>>({})

  useEffect(() => {
    if (aceite) setForm(aceite)
  }, [aceite])

  const handleSave = async () => {
    if (!portfolioId) return
    await salvar.mutateAsync({ ...form, portfolio_id: portfolioId })
    setEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
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
      ? 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 text-white'
  }`

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400' },
    assinado: { label: 'Assinado', cls: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400' },
    rejeitado: { label: 'Rejeitado', cls: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400' },
  }

  const st = STATUS_CFG[form.status ?? 'pendente'] ?? STATUS_CFG.pendente

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isLight ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
            }`}
          >
            <Edit3 size={12} /> Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); if (aceite) setForm(aceite) }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <X size={12} /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500 text-white hover:bg-teal-600 transition-all disabled:opacity-50"
            >
              <Save size={12} /> Salvar
            </button>
          </div>
        )}
      </div>

      {/* Form card */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>Aceite do Projeto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className={labelCls}>Contrato ID</p>
            <p className={valueCls}>{form.contrato_id || '-'}</p>
          </div>
          <div>
            <p className={labelCls}>Data Aceite</p>
            {editing ? (
              <input type="date" value={form.data_aceite ?? ''} onChange={e => setForm(f => ({ ...f, data_aceite: e.target.value }))} className={inputCls} />
            ) : (
              <p className={valueCls}>{form.data_aceite || '-'}</p>
            )}
          </div>
          <div>
            <p className={labelCls}>Status</p>
            {editing ? (
              <select value={form.status ?? 'pendente'} onChange={e => setForm(f => ({ ...f, status: e.target.value as PMOAceite['status'] }))} className={inputCls}>
                <option value="pendente">Pendente</option>
                <option value="assinado">Assinado</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            ) : (
              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            )}
          </div>
          <div>
            <p className={labelCls}>Assinatura URL</p>
            {editing ? (
              <input type="text" value={form.assinatura_url ?? ''} onChange={e => setForm(f => ({ ...f, assinatura_url: e.target.value }))} className={inputCls} placeholder="https://..." />
            ) : (
              <p className={valueCls}>{form.assinatura_url || '-'}</p>
            )}
          </div>
        </div>
        <div className="mt-4">
          <p className={labelCls}>Observações</p>
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
    </div>
  )
}

// ── Desmobilizacao Panel ───────────────────────────────────────────────────

const DESMOB_STATUS_OPTS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluído' },
]

function DesmobilizacaoPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useDesmobilizacao(portfolioId)
  const criar = useCriarDesmob()
  const atualizar = useAtualizarDesmob()
  const deletar = useDeletarDesmob()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMODesmobilizacao>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMODesmobilizacao>>({ item: '', categoria: '', status: 'pendente', responsavel: '', data_prevista: '', data_real: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-teal-500/20 focus:border-teal-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-teal-500/20 focus:border-teal-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.item) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ item: '', categoria: '', status: 'pendente', responsavel: '', data_prevista: '', data_real: '' })
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
        <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Item</th>
              <th className={thCls}>Categoria</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Responsável</th>
              <th className={thCls}>Data Prevista</th>
              <th className={thCls}>Data Real</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              const isConcluido = item.status === 'concluido'
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'} ${isConcluido ? (isLight ? 'bg-emerald-50/40' : 'bg-emerald-500/5') : ''}`}>
                  <td className={tdCls}>
                    {isEditing ? (
                      <input className={inputCls} value={editRow.item ?? ''} onChange={e => setEditRow(r => ({ ...r, item: e.target.value }))} />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {isConcluido && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                        <span className={isConcluido ? 'line-through opacity-60' : ''}>{item.item}</span>
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.categoria ?? ''} onChange={e => setEditRow(r => ({ ...r, categoria: e.target.value }))} /> : item.categoria ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.status ?? 'pendente'} onChange={e => setEditRow(r => ({ ...r, status: e.target.value as PMODesmobilizacao['status'] }))}>
                        {DESMOB_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <DesmobStatusBadge value={item.status} isLight={isLight} />
                    )}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.responsavel ?? ''} onChange={e => setEditRow(r => ({ ...r, responsavel: e.target.value }))} /> : item.responsavel ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input type="date" className={inputCls} value={editRow.data_prevista ?? ''} onChange={e => setEditRow(r => ({ ...r, data_prevista: e.target.value }))} /> : item.data_prevista ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input type="date" className={inputCls} value={editRow.data_real ?? ''} onChange={e => setEditRow(r => ({ ...r, data_real: e.target.value }))} /> : item.data_real ?? '-'}
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
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-teal-50/30' : 'border-white/[0.04] bg-teal-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Item" value={newRow.item ?? ''} onChange={e => setNewRow(r => ({ ...r, item: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Categoria" value={newRow.categoria ?? ''} onChange={e => setNewRow(r => ({ ...r, categoria: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.status ?? 'pendente'} onChange={e => setNewRow(r => ({ ...r, status: e.target.value as PMODesmobilizacao['status'] }))}>
                    {DESMOB_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={tdCls}><input className={inputCls} placeholder="Responsável" value={newRow.responsavel ?? ''} onChange={e => setNewRow(r => ({ ...r, responsavel: e.target.value }))} /></td>
                <td className={tdCls}><input type="date" className={inputCls} value={newRow.data_prevista ?? ''} onChange={e => setNewRow(r => ({ ...r, data_prevista: e.target.value }))} /></td>
                <td className={tdCls}><input type="date" className={inputCls} value={newRow.data_real ?? ''} onChange={e => setNewRow(r => ({ ...r, data_real: e.target.value }))} /></td>
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
              isLight ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'
            }`}
          >
            <Plus size={14} /> Adicionar item
          </button>
        </div>
      )}
    </div>
  )
}

function DesmobStatusBadge({ value, isLight }: { value?: string; isLight: boolean }) {
  const map: Record<string, { label: string; light: string; dark: string }> = {
    pendente: { label: 'Pendente', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
    em_andamento: { label: 'Em Andamento', light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/15 text-amber-400' },
    concluido: { label: 'Concluído', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  }
  const m = map[value ?? ''] ?? { label: '-', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' }
  return <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? m.light : m.dark}`}>{m.label}</span>
}
