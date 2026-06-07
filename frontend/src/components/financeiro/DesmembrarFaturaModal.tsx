import { useMemo, useState } from 'react'
import { X, Split, Check, Loader2, AlertTriangle } from 'lucide-react'
import type { ItemFaturaCartao, ApontamentoCartao } from '../../types/financeiro'

const fmt = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// Desmembrar: vincula 1 lançamento da fatura a N apontamentos (rateio).
export default function DesmembrarFaturaModal({
  item, apontamentos, isDark, isBusy, onClose, onConfirm,
}: {
  item: ItemFaturaCartao
  apontamentos: ApontamentoCartao[]
  isDark: boolean
  isBusy: boolean
  onClose: () => void
  onConfirm: (apontamentoIds: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // candidatos: apontamentos do cartão ainda não conciliados
  const candidatos = useMemo(
    () => apontamentos.filter(a => a.status !== 'conciliado'),
    [apontamentos],
  )

  const soma = useMemo(
    () => candidatos.filter(a => selected.has(a.id)).reduce((s, a) => s + (a.valor || 0), 0),
    [candidatos, selected],
  )
  const diff = item.valor - soma
  const balanceado = Math.abs(diff) <= 0.01

  const toggle = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const card = isDark ? 'bg-[#1e293b] border-white/[0.08]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-slate-200' : 'text-slate-700'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-2xl border shadow-xl ${card} max-h-[88vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <Split size={16} className="text-emerald-500" />
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Desmembrar lançamento</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {/* Item da fatura */}
        <div className={`mx-5 mt-4 rounded-xl px-3 py-2.5 ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-0.5">Lançamento da fatura</p>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-bold truncate ${txt}`}>{item.descricao}</p>
            <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(item.valor)}</p>
          </div>
          <p className={`text-[10px] ${muted}`}>{fmtDate(item.data_lancamento)}</p>
        </div>

        <p className={`px-5 mt-3 text-[11px] ${muted}`}>
          Selecione os apontamentos que compõem este lançamento (a soma deve bater com o valor):
        </p>

        {/* Lista de apontamentos */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1.5 min-h-[80px]">
          {candidatos.length === 0 ? (
            <p className={`text-xs ${muted} py-6 text-center`}>Nenhum apontamento disponível para este cartão.</p>
          ) : candidatos.map(a => {
            const on = selected.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors
                  ${on
                    ? isDark ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-emerald-50 border-emerald-400'
                    : isDark ? 'border-white/[0.06] hover:border-white/20' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0
                  ${on ? 'bg-emerald-500 border-emerald-500' : isDark ? 'border-white/30' : 'border-slate-300'}`}>
                  {on && <Check size={11} className="text-white" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold truncate ${txt}`}>{a.descricao}</span>
                  <span className={`block text-[10px] ${muted}`}>
                    {fmtDate(a.data_lancamento)}{a.centro_custo ? ` · ${a.centro_custo}` : ''}
                  </span>
                </span>
                <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(a.valor)}</span>
              </button>
            )
          })}
        </div>

        {/* Resumo soma vs valor */}
        <div className="px-5 py-3 border-t border-slate-200/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={muted}>Soma selecionada ({selected.size})</span>
            <span className={`font-bold ${txt}`}>{fmt(soma)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={muted}>Diferença vs lançamento</span>
            <span className={`font-bold flex items-center gap-1 ${balanceado ? 'text-emerald-500' : 'text-amber-500'}`}>
              {!balanceado && <AlertTriangle size={11} />}
              {diff > 0 ? '+' : ''}{fmt(diff)}
            </span>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className={`flex-1 py-2 rounded-xl border text-xs font-semibold
                ${isDark ? 'border-white/[0.08] text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm([...selected])}
              disabled={isBusy || selected.size === 0}
              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50
                text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Split size={12} />}
              Conciliar {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
          {!balanceado && selected.size > 0 && (
            <p className="text-[10px] text-amber-500 text-center">
              A soma não bate com o lançamento — confirme apenas se o rateio for parcial intencional.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
