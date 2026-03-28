import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard, Plus, Search, Calendar, Filter,
  Upload, Trash2, Send, X, Check, Eye, Receipt,
  AlertCircle, CheckCircle2, Clock, XCircle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useCartoesCredito,
  useApontamentosCartao,
  useCriarApontamentoCartao,
  useAtualizarApontamentoCartao,
  useEnviarApontamento,
  useExcluirApontamentoCartao,
} from '../../hooks/useCartoes'
import type { ApontamentoCartao, StatusApontamentoCartao, BandeiraCartao } from '../../types/financeiro'
import { useCadClasses, useCadCentrosCusto } from '../../hooks/useCadastros'
import SearchableSelect from '../../components/SearchableSelect'
import type { SelectOption } from '../../components/SearchableSelect'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const formatControlNumber = (value?: number) => {
  if (!value || value <= 0) return 'Pendente'
  return String(value)
}

const BANDEIRA_LABEL: Record<BandeiraCartao, string> = {
  visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo',
  amex: 'Amex', hipercard: 'Hipercard', outro: 'Outro',
}

const BANDEIRA_COLOR: Record<BandeiraCartao, string> = {
  visa: 'text-blue-500', mastercard: 'text-red-500', elo: 'text-yellow-500',
  amex: 'text-sky-500', hipercard: 'text-purple-500', outro: 'text-slate-400',
}

const STATUS_CONFIG: Record<StatusApontamentoCartao, {
  label: string
  icon: typeof CheckCircle2
  light: string
  dark: string
}> = {
  rascunho:   { label: 'Pendente',   icon: Clock,         light: 'bg-slate-100 text-slate-600',       dark: 'bg-slate-500/15 text-slate-400' },
  enviado:    { label: 'Enviado',    icon: CheckCircle2,  light: 'bg-blue-100 text-blue-700',         dark: 'bg-blue-500/15 text-blue-300' },
  conciliado: { label: 'Conciliado', icon: Check,         light: 'bg-emerald-100 text-emerald-700',   dark: 'bg-emerald-500/15 text-emerald-300' },
  rejeitado:  { label: 'Rejeitado',  icon: XCircle,       light: 'bg-red-100 text-red-700',           dark: 'bg-red-500/15 text-red-300' },
}

const EMPTY_FORM = {
  cartao_id: '',
  data_lancamento: new Date().toISOString().split('T')[0],
  descricao: '',
  estabelecimento: '',
  valor: '',
  centro_custo: '',
  classe_financeira: '',
  observacoes: '',
}

// ── Card Icon ─────────────────────────────────────────────────────────────────

function CardBadge({ bandeira, ultimos4, nome }: { bandeira: BandeiraCartao; ultimos4?: string; nome: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${BANDEIRA_COLOR[bandeira]}`}>
      <CreditCard size={12} />
      {BANDEIRA_LABEL[bandeira]} {ultimos4 ? `····${ultimos4}` : nome}
    </span>
  )
}

// ── Form Modal ────────────────────────────────────────────────────────────────

function ApontamentoModal({
  isDark,
  editing,
  nextIndex,
  onClose,
  onSaved,
}: {
  isDark: boolean
  editing: ApontamentoCartao | null
  nextIndex: number
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const { data: cartoes = [] } = useCartoesCredito()
  const { data: classes = [] } = useCadClasses()
  const { data: centrosCusto = [] } = useCadCentrosCusto()
  const criar = useCriarApontamentoCartao()
  const atualizar = useAtualizarApontamentoCartao()

  const classeOptions: SelectOption[] = (classes ?? []).map(c => ({ value: c.descricao, label: c.descricao, code: c.codigo }))
  const centroOptions: SelectOption[] = (centrosCusto ?? []).map(c => ({ value: c.descricao, label: c.descricao, code: c.codigo }))

  const [form, setForm] = useState(() =>
    editing
      ? {
          cartao_id: editing.cartao_id,
          data_lancamento: editing.data_lancamento,
          descricao: editing.descricao,
          estabelecimento: editing.estabelecimento ?? '',
          valor: String(editing.valor),
          centro_custo: editing.centro_custo ?? '',
          classe_financeira: editing.classe_financeira ?? '',
          observacoes: editing.observacoes ?? '',
        }
      : EMPTY_FORM
  )
  const [error, setError] = useState('')

  const isBusy = criar.isPending || atualizar.isPending

  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm
    focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
    ${isDark ? 'bg-white/[0.03] border-white/[0.08] text-slate-200 placeholder-slate-500' : 'border-slate-200 text-slate-700 placeholder-slate-400'}`

  const lbl = `text-[10px] font-bold uppercase tracking-wider mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  async function handleSubmit() {
    if (!form.cartao_id) return setError('Selecione um cartão')
    if (!form.descricao.trim()) return setError('Informe a descrição')
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return setError('Valor inválido')

    const payload = {
      cartao_id: form.cartao_id,
      data_lancamento: form.data_lancamento,
      descricao: form.descricao.trim(),
      estabelecimento: form.estabelecimento || undefined,
      valor,
      centro_custo: form.centro_custo || undefined,
      classe_financeira: form.classe_financeira || undefined,
      observacoes: form.observacoes || undefined,
    }

    try {
      if (editing) {
        await atualizar.mutateAsync({ id: editing.id, ...payload })
        onSaved('Apontamento atualizado')
      } else {
        await criar.mutateAsync(payload)
        onSaved('Apontamento criado')
      }
      onClose()
    } catch {
      setError('Erro ao salvar apontamento')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'}`}>
              <Receipt size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {editing ? 'Editar Apontamento' : 'Novo Apontamento'}
              </h3>
              {!editing && (
                <p className="text-[10px] text-emerald-500 font-semibold mt-0.5 uppercase tracking-[0.18em]">
                  Proximo controle: {formatControlNumber(nextIndex)}
                </p>
              )}
              <p className="text-[10px] text-slate-400">Registre o gasto no cartão corporativo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Cartão */}
          <div>
            <label className={lbl}>Cartão *</label>
            <select
              value={form.cartao_id}
              onChange={e => setForm(f => ({ ...f, cartao_id: e.target.value }))}
              className={inp}
            >
              <option value="">Selecione o cartão...</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.ultimos4 ? ` ····${c.ultimos4}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data */}
            <div>
              <label className={lbl}>Data *</label>
              <input
                type="date"
                value={form.data_lancamento}
                onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))}
                className={inp}
              />
            </div>
            {/* Valor */}
            <div>
              <label className={lbl}>Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                className={inp}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className={lbl}>Descrição *</label>
            <input
              type="text"
              placeholder="Ex: Almoço cliente, Material escritório..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className={inp}
            />
          </div>

          {/* Estabelecimento */}
          <div>
            <label className={lbl}>Estabelecimento</label>
            <input
              type="text"
              placeholder="Nome do local ou fornecedor"
              value={form.estabelecimento}
              onChange={e => setForm(f => ({ ...f, estabelecimento: e.target.value }))}
              className={inp}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Centro de custo */}
            <SearchableSelect
              options={centroOptions}
              value={form.centro_custo}
              onChange={v => setForm(f => ({ ...f, centro_custo: v }))}
              placeholder="Buscar centro de custo..."
              label="Centro de Custo"
            />
            {/* Classe financeira */}
            <SearchableSelect
              options={classeOptions}
              value={form.classe_financeira}
              onChange={v => setForm(f => ({ ...f, classe_financeira: v }))}
              placeholder="Buscar classe financeira..."
              label="Classe Financeira"
            />
          </div>

          {/* Observações */}
          <div>
            <label className={lbl}>Observações</label>
            <textarea
              rows={2}
              placeholder="Notas adicionais..."
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              className={`${inp} resize-none`}
            />
          </div>

          {/* Comprovante (upload placeholder) */}
          <div>
            <label className={lbl}>Comprovante</label>
            <div className={`rounded-xl border-2 border-dashed flex items-center justify-center gap-2 py-4 cursor-pointer
              transition-colors hover:border-emerald-400
              ${isDark ? 'border-white/[0.08] text-slate-500 hover:text-emerald-400' : 'border-slate-200 text-slate-400 hover:text-emerald-600'}`}>
              <Upload size={16} />
              <span className="text-xs font-medium">
                {editing?.comprovante_nome ?? 'Clique para anexar comprovante (PDF, JPG, PNG)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Upload via integração de armazenamento</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs font-medium">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all
                ${isDark ? 'border-white/[0.06] text-slate-400 hover:bg-white/[0.03]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isBusy}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold
                hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBusy ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {editing ? 'Salvar Alterações' : 'Criar Apontamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ApontamentosCartao() {
  const { isDark } = useTheme()
  const { perfil } = useAuth()
  const [searchParams] = useSearchParams()

  const [filtroCartao, setFiltroCartao] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusApontamentoCartao | ''>('')
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ApontamentoCartao | null>(null)

  // Abre modal automaticamente quando ?nova= está presente na URL
  useEffect(() => {
    if (searchParams.has('nova')) setShowModal(true)
  }, [searchParams])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: cartoes = [] } = useCartoesCredito()
  const { data: apontamentos = [], isLoading } = useApontamentosCartao({
    cartao_id: filtroCartao || undefined,
    status: filtroStatus || undefined,
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
  })

  const enviar = useEnviarApontamento()
  const excluir = useExcluirApontamentoCartao()

  const filtered = useMemo(() => {
    if (!busca) return apontamentos
    const q = busca.toLowerCase()
    return apontamentos.filter(a =>
      a.descricao.toLowerCase().includes(q)
      || a.estabelecimento?.toLowerCase().includes(q)
      || a.centro_custo?.toLowerCase().includes(q)
      || a.classe_financeira?.toLowerCase().includes(q)
    )
  }, [apontamentos, busca])

  const fallbackNumberingById = useMemo(() => {
    const ordered = [...apontamentos].sort((a, b) => {
      const byDate = a.data_lancamento.localeCompare(b.data_lancamento)
      if (byDate !== 0) return byDate

      const byCreatedAt = a.created_at.localeCompare(b.created_at)
      if (byCreatedAt !== 0) return byCreatedAt

      return a.id.localeCompare(b.id)
    })

    return Object.fromEntries(ordered.map((item, index) => [item.id, index + 1]))
  }, [apontamentos])

  // KPIs
  const totalValor = apontamentos.reduce((s, a) => s + a.valor, 0)
  const countEnviado  = apontamentos.filter(a => a.status === 'enviado').length
  const countConc     = apontamentos.filter(a => a.status === 'conciliado').length
  const nextApontamentoIndex = Object.keys(fallbackNumberingById).length + 1

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleEnviar(a: ApontamentoCartao) {
    try {
      await enviar.mutateAsync(a.id)
      showToast('success', 'Apontamento enviado para conciliação')
    } catch {
      showToast('error', 'Erro ao enviar apontamento')
    }
  }

  async function handleExcluir(id: string) {
    try {
      await excluir.mutateAsync(id)
      setDeleteConfirm(null)
      showToast('success', 'Apontamento excluído')
    } catch {
      showToast('error', 'Erro ao excluir apontamento')
    }
  }

  const card = (extra = '') =>
    `rounded-2xl border shadow-sm ${extra} ${isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'}`

  return (
    <div className="space-y-4 pb-20">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm
          font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <CreditCard size={20} className="text-emerald-600" />
            Apontamentos de Cartão
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Olá, {(perfil?.nome ?? 'Usuário').split(' ')[0]} · Registre seus gastos corporativos e anexe comprovantes
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white
            text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-500/20"
        >
          <Plus size={15} />
          Novo Apontamento
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Total Período</p>
          <p className={`text-base font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(totalValor)}</p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest mb-1 flex items-center gap-1">
            <Send size={9} /> Enviados
          </p>
          <p className="text-base font-extrabold text-blue-600">{countEnviado}</p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest mb-1 flex items-center gap-1">
            <CheckCircle2 size={9} /> Conciliados
          </p>
          <p className="text-base font-extrabold text-emerald-600">{countConc}</p>
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────── */}
      <div className={card('p-3 space-y-3')}>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <Filter size={11} /> Filtros
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Descrição, estabelecimento, CC..."
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>
          {/* Cartão */}
          <select
            value={filtroCartao}
            onChange={e => setFiltroCartao(e.target.value)}
            className={`px-3 py-2.5 rounded-xl border text-xs
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            <option value="">Todos os cartões</option>
            {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          {/* Status */}
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as StatusApontamentoCartao | '')}
            className={`px-3 py-2.5 rounded-xl border text-xs
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
              ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Pendente</option>
            <option value="enviado">Enviado</option>
            <option value="conciliado">Conciliado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
          {/* Datas */}
          <div className="flex gap-2">
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className={`pl-8 pr-2 py-2.5 rounded-xl border text-xs
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} />
            </div>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className={`pl-8 pr-2 py-2.5 rounded-xl border text-xs
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-slate-50'}`}>
            <CreditCard size={28} className={isDark ? 'text-emerald-400' : 'text-slate-300'} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum apontamento encontrado
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Clique em "Novo Apontamento" para registrar um gasto
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const cfg = STATUS_CONFIG[a.status]
            const StatusIcon = cfg.icon
            const isEditable = a.status === 'rascunho'
            const displayNumber = a.numero ?? fallbackNumberingById[a.id]

            return (
              <div
                key={a.id}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition-all
                  ${isDark ? 'bg-[#1e293b] border-white/[0.06] hover:border-white/[0.12]' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
              >
                <div className={`min-w-[118px] shrink-0 rounded-xl border px-3 py-2 ${
                  isDark
                    ? 'border-emerald-500/20 bg-emerald-500/10'
                    : 'border-emerald-200 bg-emerald-50'
                }`}>
                  <p className={`text-sm font-black tracking-[0.18em] text-center ${
                    isDark ? 'text-emerald-100' : 'text-emerald-800'
                  }`}>
                    {formatControlNumber(displayNumber)}
                  </p>
                </div>

                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  a.status === 'conciliado' ? 'bg-emerald-500' :
                  a.status === 'enviado'    ? 'bg-blue-500' :
                  a.status === 'rejeitado'  ? 'bg-red-500' : 'bg-slate-400'
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {a.descricao}
                    </p>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${isDark ? cfg.dark : cfg.light}`}>
                      <StatusIcon size={9} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {fmtDate(a.data_lancamento)}
                    </span>
                    {a.estabelecimento && (
                      <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        · {a.estabelecimento}
                      </span>
                    )}
                    {a.cartao && (
                      <CardBadge
                        bandeira={a.cartao.bandeira}
                        ultimos4={a.cartao.ultimos4}
                        nome={a.cartao.nome}
                      />
                    )}
                    {a.centro_custo && (
                      <span className="text-[10px] font-medium text-teal-600 bg-teal-500/10 px-1.5 py-0.5 rounded-md">
                        {a.centro_custo}
                      </span>
                    )}
                    {a.comprovante_url && (
                      <a href={a.comprovante_url} target="_blank" rel="noreferrer"
                        className="text-[10px] font-medium text-blue-500 flex items-center gap-0.5 hover:underline">
                        <Eye size={9} /> Comprovante
                      </a>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <p className={`text-base font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {fmt(a.valor)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditable && (
                    <>
                      <button
                        onClick={() => { setEditing(a); setShowModal(true) }}
                        title="Editar"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                          ${isDark ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                      >
                        <Receipt size={14} />
                      </button>
                      <button
                        onClick={() => handleEnviar(a)}
                        title="Enviar para conciliação"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                          ${isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-500 hover:bg-blue-50'}`}
                      >
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(a.id)}
                        title="Excluir"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                          ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-50'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Delete Confirm ──────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Excluir apontamento?
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Esta ação não pode ser desfeita. Somente rascunhos podem ser excluídos.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold
                  ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-600'}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExcluir(deleteConfirm)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <ApontamentoModal
          isDark={isDark}
          editing={editing}
          nextIndex={nextApontamentoIndex}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={msg => showToast('success', msg)}
        />
      )}
    </div>
  )
}
