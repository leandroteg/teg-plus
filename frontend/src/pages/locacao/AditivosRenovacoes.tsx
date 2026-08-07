import { useMemo, useState } from 'react'
import { RefreshCw, Search, List, LayoutGrid, X, ArrowUp, ArrowDown, Send, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAditivos, useAtualizarStatusAditivo } from '../../hooks/useLocacao'
import { STATUS_ADITIVO_LABEL, fmtEndereco } from '../../types/locacao'
import type { StatusAditivo, TipoAditivo, LocAditivo } from '../../types/locacao'

const STATUSES = [
  { key: 'todos',                 label: 'Todos' },
  { key: 'rascunho',              label: 'Rascunho' },
  { key: 'aguardando_assinatura', label: 'Aguardando' },
  { key: 'assinado',              label: 'Assinado' },
]

const COLS: { key: string; label: string }[] = [
  { key: 'imovel',  label: 'Imóvel' },
  { key: 'cidade',  label: 'Cidade' },
  { key: 'tipo',    label: 'Tipo' },
  { key: 'periodo', label: 'Período' },
  { key: 'valor',   label: 'Valor Anterior → Novo' },
  { key: 'status',  label: 'Status' },
  { key: '',        label: 'Ações' },
]

// ── Tipo label ────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<TipoAditivo, string> = {
  renovacao:       'Renovação',
  reajuste:        'Reajuste',
  alteracao_valor: 'Alteração de Valor',
  outro:           'Outro',
}

const TIPO_CFG: Record<TipoAditivo, { bg: string; text: string }> = {
  renovacao:       { bg: 'bg-blue-50',   text: 'text-blue-700' },
  reajuste:        { bg: 'bg-amber-50',  text: 'text-amber-700' },
  alteracao_valor: { bg: 'bg-green-50',  text: 'text-green-700' },
  outro:           { bg: 'bg-slate-100', text: 'text-slate-600' },
}

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v?: number) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—'

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusAditivo }) {
  const cfg = STATUS_ADITIVO_LABEL[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo?: TipoAditivo }) {
  if (!tipo) return null
  const cfg = TIPO_CFG[tipo]
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

// ── Ações de status (rascunho → aguardando_assinatura → assinado) ─────────────
function AditivoActions({ ad, onStatus, isBusy }: {
  ad: LocAditivo
  onStatus: (id: string, status: StatusAditivo) => void
  isBusy: boolean
}) {
  if (ad.status === 'rascunho') {
    return (
      <button type="button" disabled={isBusy}
        onClick={e => { e.stopPropagation(); onStatus(ad.id, 'aguardando_assinatura') }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 disabled:opacity-50">
        <Send size={12} /> Enviar p/ assinatura
      </button>
    )
  }
  if (ad.status === 'aguardando_assinatura') {
    return (
      <button type="button" disabled={isBusy}
        onClick={e => { e.stopPropagation(); onStatus(ad.id, 'assinado') }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 hover:text-green-700 disabled:opacity-50">
        <CheckCircle2 size={12} /> Marcar assinado
      </button>
    )
  }
  return <span className="text-[11px] text-slate-400">—</span>
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function TableRow({ ad, isDark, onStatus, isBusy }: {
  ad: LocAditivo; isDark: boolean
  onStatus: (id: string, status: StatusAditivo) => void; isBusy: boolean
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <tr className={`border-b transition-colors cursor-pointer
      ${isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <td className={`px-4 py-3 text-sm font-medium ${txt}`}>
        <span className="block truncate max-w-[220px]">{fmtEndereco(ad.imovel)}</span>
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {ad.imovel?.cidade ?? '—'}
      </td>
      <td className="px-4 py-3">
        <TipoBadge tipo={ad.tipo} />
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {/* aditivo novo grava termino anterior -> novo; os antigos gravavam
             inicio -> fim do periodo. Mesma coluna, as duas leituras. */}
        {ad.data_inicio || ad.data_fim_anterior || ad.data_fim
          ? `${fmtDate(ad.data_inicio ?? ad.data_fim_anterior)} – ${fmtDate(ad.data_fim)}`
          : '—'}
      </td>
      <td className={`px-4 py-3 text-sm ${txtMuted}`}>
        {ad.valor_anterior != null ? fmtCurrency(ad.valor_anterior) : '—'}
        {ad.valor_novo != null && (
          <span className={`ml-1 font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
            → {fmtCurrency(ad.valor_novo)}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={ad.status} />
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <AditivoActions ad={ad} onStatus={onStatus} isBusy={isBusy} />
      </td>
    </tr>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
function AditivoCard({ ad, isDark, onStatus, isBusy }: {
  ad: LocAditivo; isDark: boolean
  onStatus: (id: string, status: StatusAditivo) => void; isBusy: boolean
}) {
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-xl border p-4 transition-all cursor-pointer
      ${isDark
        ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
      {/* Linha 1 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm font-bold ${txt}`}>{ad.tipo ? TIPO_LABEL[ad.tipo] : 'Aditivo'}</p>
          <TipoBadge tipo={ad.tipo} />
        </div>
        <StatusBadge status={ad.status} />
      </div>
      {/* Linha 2 */}
      <p className={`text-xs mb-2 ${txtMuted}`}>{fmtEndereco(ad.imovel)}{ad.imovel?.cidade ? ` · ${ad.imovel.cidade}` : ''}</p>
      {/* Linha 3 */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${txtMuted}`}>
        {(ad.data_inicio || ad.data_fim) && (
          <span>{fmtDate(ad.data_inicio)} – {fmtDate(ad.data_fim)}</span>
        )}
        {(ad.valor_anterior != null || ad.valor_novo != null) && (
          <span>
            {fmtCurrency(ad.valor_anterior)}
            {ad.valor_novo != null && (
              <span className={`ml-1 font-semibold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                → {fmtCurrency(ad.valor_novo)}
              </span>
            )}
          </span>
        )}
        {ad.indice_reajuste && <span>Índice: {ad.indice_reajuste}</span>}
      </div>
      <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <AditivoActions ad={ad} onStatus={onStatus} isBusy={isBusy} />
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AditivosRenovacoes() {
  const { isDark } = useTheme()
  const { data: aditivos = [], isLoading } = useAditivos()
  const atualizarStatus = useAtualizarStatusAditivo()
  const onStatus = (id: string, status: StatusAditivo) => atualizarStatus.mutate({ id, status })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [tipoFilter, setTipoFilter] = useState('')
  const [ccFilter, setCcFilter] = useState('')
  const [cidadeFilter, setCidadeFilter] = useState('')
  const [vencFilter, setVencFilter] = useState('')
  const [view, setView] = useState<'table' | 'card'>('table')
  const [sortCol, setSortCol] = useState<string>('criado')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
  }
  const limpar = () => {
    setSearch(''); setStatusFilter('todos'); setTipoFilter('')
    setCcFilter(''); setCidadeFilter(''); setVencFilter('')
  }

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const selCls = `rounded-lg border px-2 py-1.5 text-[11px] ${isDark
    ? 'bg-white/[0.04] border-white/[0.06] text-slate-200'
    : 'border-slate-200 bg-white text-slate-600'}`

  const cidades = useMemo(
    () => [...new Set(aditivos.map(a => a.imovel?.cidade).filter(Boolean))].sort() as string[],
    [aditivos])
  const centrosCusto = useMemo(() => {
    const m = new Map<string, string>()
    aditivos.forEach(a => { const cc = a.imovel?.centro_custo; if (cc?.id) m.set(cc.id, cc.descricao) })
    return [...m.entries()].sort((x, y) => x[1].localeCompare(y[1]))
  }, [aditivos])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const hoje = new Date().toISOString().slice(0, 10)
    const limite = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
    const items = aditivos.filter(ad => {
      if (statusFilter !== 'todos' && ad.status !== statusFilter) return false
      if (tipoFilter && ad.tipo !== tipoFilter) return false
      if (ccFilter && ad.imovel?.centro_custo?.id !== ccFilter) return false
      if (cidadeFilter && ad.imovel?.cidade !== cidadeFilter) return false
      if (vencFilter) {
        const d = ad.data_fim
        if (!d) return false
        if (vencFilter === 'vencido' && !(d < hoje)) return false
        if (vencFilter === '30d' && !(d >= hoje && d <= limite(30))) return false
        if (vencFilter === '90d' && !(d >= hoje && d <= limite(90))) return false
      }
      if (q && !(
        ad.imovel?.endereco?.toLowerCase().includes(q) ||
        ad.imovel?.titulo?.toLowerCase().includes(q) ||
        ad.imovel?.cidade?.toLowerCase().includes(q) ||
        ad.imovel?.descricao?.toLowerCase().includes(q) ||
        ad.descricao?.toLowerCase().includes(q) ||
        ad.tipo?.toLowerCase().includes(q))) return false
      return true
    })
    // '' nas datas/valores ausentes iria para o topo no asc; joga pro fim
    const txtDe = (v?: string | null) => (v ?? '').toString()
    items.sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortCol) {
        case 'imovel':  va = txtDe(fmtEndereco(a.imovel)); vb = txtDe(fmtEndereco(b.imovel)); break
        case 'cidade':  va = txtDe(a.imovel?.cidade);      vb = txtDe(b.imovel?.cidade); break
        case 'tipo':    va = a.tipo ? TIPO_LABEL[a.tipo] : ''; vb = b.tipo ? TIPO_LABEL[b.tipo] : ''; break
        case 'periodo': va = txtDe(a.data_fim) || '9999';  vb = txtDe(b.data_fim) || '9999'; break
        case 'valor':   va = a.valor_novo ?? a.valor_anterior ?? -1; vb = b.valor_novo ?? b.valor_anterior ?? -1; break
        case 'status':  va = txtDe(a.status);              vb = txtDe(b.status); break
        default:        va = txtDe(a.created_at);          vb = txtDe(b.created_at); break
      }
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [aditivos, search, statusFilter, tipoFilter, ccFilter, cidadeFilter, vencFilter, sortCol, sortDir])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — tudo numa linha, mesmo conjunto da aba Ativos */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar aditivo..."
            className={`w-full pl-9 pr-7 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30
              ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {STATUSES.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${statusFilter === s.key
                ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800'
                : isDark ? 'text-slate-500' : 'text-slate-400 hover:bg-slate-50'}`}>
              {s.label}
            </button>
          ))}
        </div>

        <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} className={selCls}>
          <option value="">Tipo</option>
          {(Object.entries(TIPO_LABEL) as [TipoAditivo, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={ccFilter} onChange={e => setCcFilter(e.target.value)} className={selCls}>
          <option value="">Centro de Custo</option>
          {centrosCusto.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>

        <select value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} className={selCls}>
          <option value="">Cidade</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* vencimento le a NOVA data de termino — e o que interessa acompanhar */}
        <select value={vencFilter} onChange={e => setVencFilter(e.target.value)} className={selCls}>
          <option value="">Vencimento</option>
          <option value="vencido">Vencidos</option>
          <option value="30d">Próximos 30 dias</option>
          <option value="90d">Próximos 90 dias</option>
        </select>

        {(search || statusFilter !== 'todos' || tipoFilter || ccFilter || cidadeFilter || vencFilter) && (
          <button onClick={limpar}
            className={`text-[11px] px-2 py-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
            Limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setView('table')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'table'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={16} />
          </button>
          <button onClick={() => setView('card')}
            className={`p-1.5 rounded-lg transition-colors ${view === 'card'
              ? isDark ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum aditivo encontrado</p>
        </div>
      ) : view === 'table' ? (
        /* Table View */
        <div className={`rounded-xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  {COLS.map(col => (
                    <th key={col.label}
                      onClick={() => col.key && toggleSort(col.key)}
                      className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${txtMuted}
                        ${col.key ? 'cursor-pointer select-none hover:text-indigo-500' : ''}`}>
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(ad => (
                  <TableRow key={ad.id} ad={ad} isDark={isDark} onStatus={onStatus} isBusy={atualizarStatus.isPending} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="space-y-2">
          {filtered.map(ad => (
            <AditivoCard key={ad.id} ad={ad} isDark={isDark} onStatus={onStatus} isBusy={atualizarStatus.isPending} />
          ))}
        </div>
      )}

    </div>
  )
}
