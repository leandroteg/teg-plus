import { useState, useMemo } from 'react'
import {
  CreditCard, Link2, Unlink, Search, Upload,
  CheckCircle2, AlertCircle, ChevronDown, X,
  RefreshCw, FileText, Clock, Check, Filter,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useCartoesCredito,
  useApontamentosCartao,
  useFaturasCartao,
  useItensFatura,
  useConciliarItem,
  useDesconciliarItem,
} from '../../hooks/useCartoes'
import type {
  CartaoCredito, ApontamentoCartao, FaturaCartao, ItemFaturaCartao,
} from '../../types/financeiro'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

function diffPct(a: number, b: number) {
  if (!b) return null
  return Math.abs((a - b) / b) * 100
}

// ── Fatura Upload Placeholder ─────────────────────────────────────────────────

function FaturaUploadCard({ cartaoId, isDark }: { cartaoId: string; isDark: boolean }) {
  return (
    <div className={`rounded-2xl border-2 border-dashed p-5 flex flex-col items-center gap-3 text-center
      ${isDark ? 'border-white/[0.08] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center
        ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
        <Upload size={22} className="text-emerald-500" />
      </div>
      <div>
        <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Upload de Fatura
        </p>
        <p className="text-xs mt-0.5">
          Envie o PDF da fatura — o n8n extrairá os lançamentos automaticamente
        </p>
      </div>
      <button
        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold
          hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-500/20"
        onClick={() => alert('Upload de fatura via n8n — configure o webhook no módulo de integrações')}
      >
        <Upload size={12} className="inline mr-1.5" />
        Enviar Fatura PDF
      </button>
      <p className="text-[10px] text-slate-500">
        Integração automática via n8n · Webhook configurável
      </p>
    </div>
  )
}

// ── Item Fatura Card ──────────────────────────────────────────────────────────

function ItemFaturaRow({
  item,
  isDark,
  candidatos,
  onConciliar,
  isBusy,
}: {
  item: ItemFaturaCartao
  isDark: boolean
  candidatos: ApontamentoCartao[]
  onConciliar: (itemId: string, apontamentoId: string) => void
  isBusy: boolean
}) {
  const [open, setOpen] = useState(false)

  // Auto-match: mesma data ± 2 dias E valor próximo (≤ 5%)
  const suggestions = useMemo(() => {
    const d = new Date(item.data_lancamento)
    return candidatos.filter(a => {
      const da = new Date(a.data_lancamento)
      const diff = Math.abs(d.getTime() - da.getTime()) / 86400000
      const pct = diffPct(a.valor, item.valor)
      return diff <= 2 && (pct === null || pct <= 5)
    })
  }, [candidatos, item])

  const isConc = item.conciliado

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-all
      ${isConc
        ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
        : isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
      }`}>
      <div className="flex items-center gap-2">
        {/* Status */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${isConc ? 'bg-emerald-500' : 'bg-slate-400'}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {item.descricao}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">{fmtDate(item.data_lancamento)}</span>
            {item.categoria_banco && (
              <span className="text-[10px] text-slate-400">· {item.categoria_banco}</span>
            )}
            {isConc && item.apontamento && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <Link2 size={9} /> {item.apontamento.descricao}
              </span>
            )}
          </div>
        </div>

        {/* Valor */}
        <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {fmt(item.valor)}
        </p>

        {/* Link button */}
        {!isConc && (
          <button
            onClick={() => setOpen(v => !v)}
            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors
              ${isDark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'}`}
            title="Vincular apontamento"
          >
            <Link2 size={13} />
          </button>
        )}
      </div>

      {/* Dropdown de candidatos */}
      {open && !isConc && (
        <div className={`mt-2 rounded-xl border p-2 space-y-1
          ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[10px] text-slate-400 font-semibold px-1 mb-1.5">
            {suggestions.length > 0
              ? `${suggestions.length} apontamento(s) compatível(is)`
              : 'Nenhum apontamento compatível automático — selecione manualmente:'
            }
          </p>
          {(suggestions.length > 0 ? suggestions : candidatos).slice(0, 8).map(a => {
            const pct = diffPct(a.valor, item.valor)
            return (
              <button
                key={a.id}
                disabled={isBusy}
                onClick={() => { onConciliar(item.id, a.id); setOpen(false) }}
                className={`w-full text-left rounded-lg px-2.5 py-1.5 flex items-center gap-2
                  transition-colors text-xs group
                  ${isDark
                    ? 'hover:bg-emerald-500/10 text-slate-300'
                    : 'hover:bg-emerald-50 text-slate-700'
                  }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.descricao}</p>
                  <p className="text-[10px] text-slate-400">{fmtDate(a.data_lancamento)} · {a.estabelecimento ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold ${pct !== null && pct > 5 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {fmt(a.valor)}
                  </p>
                  {pct !== null && pct > 0.5 && (
                    <p className="text-[9px] text-amber-500">{pct.toFixed(1)}% diff</p>
                  )}
                </div>
                <Check size={12} className="shrink-0 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )
          })}
          <button
            onClick={() => setOpen(false)}
            className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 py-1"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Apontamento Card ──────────────────────────────────────────────────────────

function ApontamentoRow({
  a,
  isDark,
  onDesconciliar,
  isBusy,
}: {
  a: ApontamentoCartao
  isDark: boolean
  onDesconciliar: (itemId: string, apontamentoId: string) => void
  isBusy: boolean
}) {
  const isConc = a.status === 'conciliado'
  const isEnv  = a.status === 'enviado'

  return (
    <div className={`rounded-xl border px-3 py-2.5 transition-all
      ${isConc
        ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
        : isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
      }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          isConc ? 'bg-emerald-500' : isEnv ? 'bg-blue-500' : 'bg-slate-400'
        }`} />

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {a.descricao}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400">{fmtDate(a.data_lancamento)}</span>
            {a.estabelecimento && (
              <span className="text-[10px] text-slate-400">· {a.estabelecimento}</span>
            )}
            {isConc && (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                <Link2 size={9} /> Conciliado
              </span>
            )}
            {!isConc && !isEnv && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                <Clock size={9} /> Rascunho
              </span>
            )}
            {a.comprovante_url && (
              <a href={a.comprovante_url} target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-500 flex items-center gap-0.5 hover:underline">
                <FileText size={9} /> Comprovante
              </a>
            )}
          </div>
        </div>

        <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {fmt(a.valor)}
        </p>

        {isConc && a.item_fatura_id && (
          <button
            onClick={() => onDesconciliar(a.item_fatura_id!, a.id)}
            disabled={isBusy}
            title="Desvincular"
            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors
              ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-400 hover:bg-red-50'}`}
          >
            <Unlink size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ConciliacaoCartoes() {
  const { isDark } = useTheme()

  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>('')
  const [faturaSelecionada, setFaturaSelecionada] = useState<string>('')
  const [buscaApontamento, setBuscaApontamento] = useState('')
  const [buscaFatura, setBuscaFatura]   = useState('')
  const [showSoConc, setShowSoConc]    = useState(false)

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: cartoes = [] } = useCartoesCredito()
  const { data: faturas = [] } = useFaturasCartao(cartaoSelecionado || undefined)
  const { data: itens = [], isLoading: loadingItens }  = useItensFatura(
    faturaSelecionada || undefined,
    faturaSelecionada ? undefined : (cartaoSelecionado || undefined)
  )
  const { data: apontamentos = [], isLoading: loadingAp } = useApontamentosCartao({
    cartao_id: cartaoSelecionado || undefined,
  })

  const conciliar    = useConciliarItem()
  const desconciliar = useDesconciliarItem()
  const isBusy = conciliar.isPending || desconciliar.isPending

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleConciliar(itemId: string, apontamentoId: string) {
    try {
      await conciliar.mutateAsync({ itemId, apontamentoId })
      showToast('success', 'Lançamento conciliado com sucesso')
    } catch {
      showToast('error', 'Erro ao conciliar lançamento')
    }
  }

  async function handleDesconciliar(itemId: string, apontamentoId: string) {
    try {
      await desconciliar.mutateAsync({ itemId, apontamentoId })
      showToast('success', 'Vínculo removido')
    } catch {
      showToast('error', 'Erro ao desvincular')
    }
  }

  // Candidatos para vincular (apenas enviados/não conciliados)
  const candidatosVinculo = useMemo(() =>
    apontamentos.filter(a => a.status === 'enviado'),
    [apontamentos]
  )

  // Filtragem local
  const filteredItens = useMemo(() => {
    let r = itens
    if (showSoConc) r = r.filter(i => i.conciliado)
    if (buscaFatura) {
      const q = buscaFatura.toLowerCase()
      r = r.filter(i => i.descricao.toLowerCase().includes(q) || i.categoria_banco?.toLowerCase().includes(q))
    }
    return r
  }, [itens, showSoConc, buscaFatura])

  const filteredAp = useMemo(() => {
    let r = apontamentos
    if (showSoConc) r = r.filter(a => a.status === 'conciliado')
    if (buscaApontamento) {
      const q = buscaApontamento.toLowerCase()
      r = r.filter(a =>
        a.descricao.toLowerCase().includes(q)
        || a.estabelecimento?.toLowerCase().includes(q)
        || a.centro_custo?.toLowerCase().includes(q)
      )
    }
    return r
  }, [apontamentos, showSoConc, buscaApontamento])

  // Métricas
  const totalItens = itens.length
  const concItens  = itens.filter(i => i.conciliado).length
  const totalAp    = apontamentos.length
  const concAp     = apontamentos.filter(a => a.status === 'conciliado').length
  const valorFatura = itens.reduce((s, i) => s + i.valor, 0)
  const valorAp     = apontamentos.filter(a => a.status !== 'rascunho').reduce((s, a) => s + a.valor, 0)
  const diff        = valorFatura - valorAp

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
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <CreditCard size={20} className="text-emerald-600" />
          Conciliação de Cartões de Crédito
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Vincule os apontamentos dos portadores com os lançamentos extraídos das faturas
        </p>
      </div>

      {/* ── Seletores: cartão + fatura ───────────────────────────── */}
      <div className={card('p-3 flex flex-col sm:flex-row gap-3 items-end')}>
        {/* Cartão */}
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Cartão
          </label>
          <div className="relative">
            <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={cartaoSelecionado}
              onChange={e => { setCartaoSelecionado(e.target.value); setFaturaSelecionada('') }}
              className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm appearance-none
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700'}`}
            >
              <option value="">Todos os cartões</option>
              {cartoes.map((c: CartaoCredito) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.ultimos4 ? ` ····${c.ultimos4}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Fatura / Mês */}
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
            Fatura / Mês de Referência
          </label>
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={faturaSelecionada}
              onChange={e => setFaturaSelecionada(e.target.value)}
              disabled={faturas.length === 0}
              className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-sm appearance-none
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                disabled:opacity-50
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 text-slate-700'}`}
            >
              <option value="">Todas as faturas</option>
              {faturas.map((f: FaturaCartao) => (
                <option key={f.id} value={f.id}>
                  {f.mes_referencia} — {f.cartao?.nome ?? ''}
                  {f.valor_total ? ` · ${fmt(f.valor_total)}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Filtro rápido */}
        <button
          onClick={() => setShowSoConc(v => !v)}
          className={`shrink-0 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2
            ${showSoConc
              ? 'bg-emerald-600 text-white border-emerald-600'
              : isDark ? 'border-white/[0.06] text-slate-400 hover:border-emerald-500/30' : 'border-slate-200 text-slate-500 hover:border-emerald-300'
            }`}
        >
          <Filter size={12} />
          {showSoConc ? 'Só conciliados' : 'Todos'}
        </button>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Fatura Total</p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(valorFatura)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{concItens}/{totalItens} conciliados</p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Apontamentos</p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(valorAp)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{concAp}/{totalAp} conciliados</p>
        </div>
        <div className={`${card('p-3.5')} ${Math.abs(diff) > 10 ? isDark ? 'border-amber-500/20' : 'border-amber-200' : ''}`}>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-1">Diferença</p>
          <p className={`text-sm font-extrabold ${Math.abs(diff) > 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
            {diff > 0 ? '+' : ''}{fmt(diff)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {Math.abs(diff) <= 10 ? 'Balanceado' : 'Verificar diferença'}
          </p>
        </div>
        <div className={card('p-3.5')}>
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest mb-1 flex items-center gap-1">
            <CheckCircle2 size={9} /> Progresso
          </p>
          <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {totalItens > 0 ? Math.round((concItens / totalItens) * 100) : 0}%
          </p>
          <div className={`mt-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${totalItens > 0 ? (concItens / totalItens) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Split View ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── LEFT: Apontamentos dos portadores ─────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Apontamentos dos Portadores
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                {filteredAp.length}
              </span>
            </h2>
          </div>

          {/* Busca apontamentos */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaApontamento}
              onChange={e => setBuscaApontamento(e.target.value)}
              placeholder="Buscar apontamento..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>

          {loadingAp ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredAp.length === 0 ? (
            <div className={`rounded-xl border p-6 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <p className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhum apontamento
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Os portadores ainda não lançaram gastos para este cartão
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredAp.map(a => (
                <ApontamentoRow
                  key={a.id}
                  a={a}
                  isDark={isDark}
                  onDesconciliar={handleDesconciliar}
                  isBusy={isBusy}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Faturas dos cartões (extraído via n8n) ──────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Faturas dos Cartões
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                ${isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                {filteredItens.length}
              </span>
            </h2>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <RefreshCw size={9} />
              Extraído via n8n
            </span>
          </div>

          {/* Busca itens fatura */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={buscaFatura}
              onChange={e => setBuscaFatura(e.target.value)}
              placeholder="Buscar lançamento da fatura..."
              className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
                ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            />
          </div>

          {loadingItens ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredItens.length === 0 ? (
            <div className="space-y-3">
              <div className={`rounded-xl border p-4 text-center ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nenhum lançamento de fatura
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {cartaoSelecionado
                    ? 'Faça upload da fatura PDF abaixo'
                    : 'Selecione um cartão e envie a fatura'
                  }
                </p>
              </div>
              {cartaoSelecionado && (
                <FaturaUploadCard cartaoId={cartaoSelecionado} isDark={isDark} />
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                {filteredItens.map(item => (
                  <ItemFaturaRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    candidatos={candidatosVinculo}
                    onConciliar={handleConciliar}
                    isBusy={isBusy}
                  />
                ))}
              </div>
              {/* Upload nova fatura */}
              {cartaoSelecionado && (
                <FaturaUploadCard cartaoId={cartaoSelecionado} isDark={isDark} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
