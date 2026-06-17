import { useEffect, useMemo, useState } from 'react'
import { X, Landmark, CheckCircle2, SkipForward, Link2, AlertCircle } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useExtratoCandidatos, useAplicarConciliacaoAuto } from '../hooks/useFinanceiro'

export interface ConciliarItem {
  id: string
  tipo: 'cp' | 'cr'
  nome: string         // fornecedor ou cliente
  descricao?: string
  valor: number        // valor_original
  dataRef: string      // data_vencimento YYYY-MM-DD
}

interface Props {
  open: boolean
  items: ConciliarItem[]
  onClose: () => void
  onConciliarSemExtrato: (id: string) => Promise<void> | void
  onDone?: (resumo: { vinculados: number; semVinculo: number; pulados: number }) => void
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export default function ConciliarComExtratoModal({ open, items, onClose, onConciliarSemExtrato, onDone }: Props) {
  const { isDark } = useTheme()
  const [idx, setIdx] = useState(0)
  const [resumo, setResumo] = useState({ vinculados: 0, semVinculo: 0, pulados: 0 })
  const [busy, setBusy] = useState(false)

  const aplicar = useAplicarConciliacaoAuto()
  const current = items[idx]

  const { data: candidatos = [], isLoading } = useExtratoCandidatos({
    tipo: current?.tipo ?? 'cp',
    valor: current?.valor ?? 0,
    dataRef: current?.dataRef ?? '',
    enabled: open && !!current,
  })

  useEffect(() => {
    if (open) {
      setIdx(0)
      setResumo({ vinculados: 0, semVinculo: 0, pulados: 0 })
    }
  }, [open])

  const finalizar = (proxResumo = resumo) => {
    onDone?.(proxResumo)
    onClose()
  }

  const avancar = (proxResumo: typeof resumo) => {
    setResumo(proxResumo)
    if (idx + 1 >= items.length) {
      finalizar(proxResumo)
    } else {
      setIdx(idx + 1)
    }
  }

  const handleEscolher = async (movId: string) => {
    if (!current) return
    setBusy(true)
    try {
      await aplicar.mutateAsync([{ mov_id: movId, tipo_match: current.tipo, cand_id: current.id }])
      avancar({ ...resumo, vinculados: resumo.vinculados + 1 })
    } catch {
      // mantém na mesma tela em caso de erro
    } finally {
      setBusy(false)
    }
  }

  const handleSemExtrato = async () => {
    if (!current) return
    setBusy(true)
    try {
      await onConciliarSemExtrato(current.id)
      avancar({ ...resumo, semVinculo: resumo.semVinculo + 1 })
    } catch {
      // segue
    } finally {
      setBusy(false)
    }
  }

  const handlePular = () => {
    avancar({ ...resumo, pulados: resumo.pulados + 1 })
  }

  const total = items.length
  const progresso = useMemo(() => total > 1 ? `${idx + 1} / ${total}` : '', [idx, total])

  if (!open || !current) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-emerald-600" />
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Conciliar com extrato bancário {progresso && <span className="text-slate-400 text-xs ml-1">({progresso})</span>}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Escolha o lançamento do banco que corresponde a este título.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* CP/CR atual */}
        <div className={`px-5 py-3 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'} border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{current.nome}</p>
              {current.descricao && <p className="text-xs text-slate-500 truncate">{current.descricao}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">Venc. {fmtData(current.dataRef)} · {current.tipo.toUpperCase()}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fmt(current.valor)}</p>
            </div>
          </div>
        </div>

        {/* Lista de candidatos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : candidatos.length === 0 ? (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50'
            }`}>
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className={`font-bold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                  Nenhum lançamento bancário corresponde a este valor.
                </p>
                <p className={`mt-1 ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
                  Você pode marcar como conciliado mesmo assim (sem vínculo com o banco), pular este título, ou importar o extrato primeiro em Tesouraria.
                </p>
              </div>
            </div>
          ) : (
            candidatos.map((mov: any) => (
              <button
                key={mov.id}
                type="button"
                disabled={busy}
                onClick={() => handleEscolher(mov.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all disabled:opacity-50 ${
                  isDark
                    ? 'border-white/[0.06] bg-white/[0.02] hover:border-emerald-400/50 hover:bg-emerald-500/5'
                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Landmark size={14} className="text-teal-500 shrink-0" />
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {mov.descricao || 'Lançamento bancário'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {mov.conta_nome ?? 'Conta'} · {fmtData(mov.data_movimentacao)}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {fmt(Math.abs(mov.valor))}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t flex items-center justify-between gap-3 flex-wrap ${
          isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="text-[11px] text-slate-500">
            {total > 1 && `${resumo.vinculados} vinculados · ${resumo.semVinculo} sem vínculo · ${resumo.pulados} pulados`}
          </div>
          <div className="flex gap-2 flex-wrap">
            {total > 1 && (
              <button
                onClick={handlePular}
                disabled={busy}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
                  isDark ? 'border-white/[0.06] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <SkipForward size={13} /> Pular este
              </button>
            )}
            <button
              onClick={handleSemExtrato}
              disabled={busy}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 disabled:opacity-50 ${
                isDark ? 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10' : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {busy ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              Conciliar sem vínculo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
