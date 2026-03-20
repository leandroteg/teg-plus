import { useState } from 'react'
import { FileSignature, Search, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useAditivos, useAtualizarAditivo } from '../../hooks/useContratos'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import type { StatusAditivo, TipoAditivo } from '../../types/contratos'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const STATUS_CFG: Record<StatusAditivo, { label: string; dot: string; bg: string; bgDark: string; text: string; textDark: string }> = {
  rascunho:     { label: 'Rascunho',      dot: 'bg-gray-400',    bg: 'bg-gray-100',    bgDark: 'bg-gray-500/15',    text: 'text-gray-600',    textDark: 'text-gray-400'    },
  em_aprovacao: { label: 'Em Aprovação',   dot: 'bg-amber-400',   bg: 'bg-amber-50',    bgDark: 'bg-amber-500/15',   text: 'text-amber-700',   textDark: 'text-amber-400'   },
  aprovado:     { label: 'Aprovado',       dot: 'bg-emerald-500', bg: 'bg-emerald-50',  bgDark: 'bg-emerald-500/15', text: 'text-emerald-700', textDark: 'text-emerald-400' },
  rejeitado:    { label: 'Rejeitado',      dot: 'bg-red-400',     bg: 'bg-red-50',      bgDark: 'bg-red-500/15',     text: 'text-red-600',     textDark: 'text-red-400'     },
}

const TIPO_CFG: Record<TipoAditivo, { label: string; bg: string; bgDark: string; text: string; textDark: string }> = {
  escopo: { label: 'Escopo', bg: 'bg-violet-50',  bgDark: 'bg-violet-500/15',  text: 'text-violet-700',  textDark: 'text-violet-400'  },
  prazo:  { label: 'Prazo',  bg: 'bg-blue-50',    bgDark: 'bg-blue-500/15',    text: 'text-blue-700',    textDark: 'text-blue-400'    },
  valor:  { label: 'Valor',  bg: 'bg-emerald-50', bgDark: 'bg-emerald-500/15', text: 'text-emerald-700', textDark: 'text-emerald-400' },
  misto:  { label: 'Misto',  bg: 'bg-amber-50',   bgDark: 'bg-amber-500/15',   text: 'text-amber-700',   textDark: 'text-amber-400'   },
}

const FILTROS_STATUS = [
  { label: 'Todos',          value: '' },
  { label: 'Rascunho',       value: 'rascunho' },
  { label: 'Em Aprovação',   value: 'em_aprovacao' },
  { label: 'Aprovados',      value: 'aprovado' },
  { label: 'Rejeitados',     value: 'rejeitado' },
]

function StatusBadge({ status, isLight }: { status: StatusAditivo; isLight: boolean }) {
  const c = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5
      ${isLight ? `${c.bg} ${c.text}` : `${c.bgDark} ${c.textDark}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function TipoBadge({ tipo, isLight }: { tipo: TipoAditivo; isLight: boolean }) {
  const c = TIPO_CFG[tipo]
  return (
    <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5
      ${isLight ? `${c.bg} ${c.text}` : `${c.bgDark} ${c.textDark}`}`}>
      {c.label}
    </span>
  )
}

export default function AditivosPage() {
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [busca, setBusca] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data: aditivos = [], isLoading } = useAditivos()
  const atualizarAditivo = useAtualizarAditivo()

  const filtered = aditivos.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        a.numero_aditivo.toLowerCase().includes(q) ||
        a.descricao.toLowerCase().includes(q) ||
        a.contrato?.numero?.toLowerCase().includes(q) ||
        a.contrato?.objeto?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalAprovado = filtered
    .filter(a => a.status === 'aprovado')
    .reduce((s, a) => s + a.valor_acrescimo, 0)

  const handleStatusChange = (id: string, status: StatusAditivo) => {
    const label = status === 'aprovado' ? 'aprovar' : status === 'rejeitado' ? 'rejeitar' : status
    if (!confirm(`Deseja ${label} este aditivo?`)) return
    atualizarAditivo.mutate(
      {
        id,
        status,
        ...(status === 'aprovado' ? { aprovado_por: perfil?.nome ?? 'Sistema', aprovado_em: new Date().toISOString() } : {}),
      },
      {
        onSuccess: () => {
          setToast({ type: 'success', msg: `Aditivo ${status === 'aprovado' ? 'aprovado' : status === 'rejeitado' ? 'rejeitado' : 'atualizado'} com sucesso` })
          setTimeout(() => setToast(null), 4000)
        },
        onError: () => {
          setToast({ type: 'error', msg: 'Erro ao atualizar aditivo' })
          setTimeout(() => setToast(null), 5000)
        },
      }
    )
  }

  const cardCls = `rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'}`
  const thCls = `${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`
  const trCls = `border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <FileSignature size={20} className="text-indigo-500" />
          Aditivos
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Aditivos contratuais de escopo, prazo, valor e mistos
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Total Aditivos</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>{filtered.length}</p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`}>Aprovados</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {filtered.filter(a => a.status === 'aprovado').length}
          </p>
        </div>
        <div className={cardCls + ' p-4'}>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`}>Total Aprovado</p>
          <p className={`text-lg font-extrabold mt-1 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>{fmt(totalAprovado)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aditivo, contrato..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
              ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.03] text-slate-200'}`}
          />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {FILTROS_STATUS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
              ${statusFilter === f.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : isLight
                  ? 'bg-white text-slate-500 border border-slate-200'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'}`}>
            <FileSignature size={28} className={isLight ? 'text-indigo-300' : 'text-indigo-400/50'} />
          </div>
          <p className={`text-sm font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum aditivo encontrado</p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Os aditivos aparecerão aqui quando forem registrados</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={thCls}>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Aditivo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Descricao</th>
                  <th className="px-4 py-3 text-right">Valor Acrescimo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className={trCls}>
                    <td className="px-4 py-3">
                      <p className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        {a.contrato?.numero ?? '-'}
                      </p>
                      <p className={`text-[10px] truncate max-w-[160px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {a.contrato?.objeto}
                      </p>
                    </td>
                    <td className={`px-4 py-3 text-xs font-mono font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {a.numero_aditivo}
                    </td>
                    <td className="px-4 py-3">
                      <TipoBadge tipo={a.tipo} isLight={isLight} />
                    </td>
                    <td className={`px-4 py-3 text-xs max-w-[220px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {a.descricao}
                    </td>
                    <td className={`px-4 py-3 text-xs font-bold text-right ${
                      a.valor_acrescimo >= 0
                        ? isLight ? 'text-emerald-600' : 'text-emerald-400'
                        : isLight ? 'text-red-600' : 'text-red-400'
                    }`}>
                      {fmt(a.valor_acrescimo)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={a.status} isLight={isLight} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {a.status === 'em_aprovacao' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(a.id, 'aprovado')}
                              disabled={atualizarAditivo.isPending}
                              title="Aprovar"
                              className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center
                                hover:bg-emerald-100 transition-all disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.id, 'rejeitado')}
                              disabled={atualizarAditivo.isPending}
                              title="Rejeitar"
                              className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center
                                hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                        {a.status === 'rascunho' && (
                          <button
                            onClick={() => handleStatusChange(a.id, 'em_aprovacao')}
                            disabled={atualizarAditivo.isPending}
                            title="Enviar para aprovação"
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50
                              ${isLight
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                              }`}
                          >
                            Enviar
                          </button>
                        )}
                        {(a.status === 'aprovado' || a.status === 'rejeitado') && (
                          <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>—</span>
                        )}
                      </div>
                    </td>
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
