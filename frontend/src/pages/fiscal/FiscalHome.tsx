import { useNavigate } from 'react-router-dom'
import {
  FileText, Clock, CheckCircle2, AlertTriangle, ChevronRight,
  Zap, CalendarClock, RefreshCw, ShoppingCart, FileCheck,
  Receipt, Upload,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotasFiscais, useNfResumo } from '../../hooks/useNotasFiscais'
import { useSolicitacoesNF, useSolResumo } from '../../hooks/useSolicitacoesNF'
import type { NotaFiscal } from '../../types/fiscal'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// ── SpotlightMetric ──────────────────────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── MiniInfoCard ─────────────────────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof FileText; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function FiscalHome() {
  const { isDark } = useTheme()
  const nav = useNavigate()

  const now = new Date()
  const { data: notas = [], isLoading, refetch } = useNotasFiscais({ mes: now.getMonth() + 1, ano: now.getFullYear() })
  const { data: solicitacoes = [] } = useSolicitacoesNF({})
  const nfResumo = useNfResumo(notas)
  const solResumo = useSolResumo(solicitacoes)

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  // Pipeline bar data
  const pipelineSegments = [
    { key: 'pendente',    label: 'Pendentes',   value: solResumo.pendentes,  barClass: 'bg-slate-400' },
    { key: 'em_emissao',  label: 'Em Emissao',  value: solResumo.em_emissao, barClass: 'bg-blue-400' },
    { key: 'aguardando',  label: 'Aprovacao',    value: solResumo.aguardando, barClass: 'bg-amber-400' },
    { key: 'emitidas',    label: 'Emitidas',     value: solResumo.emitidas,   barClass: 'bg-emerald-500' },
    { key: 'rejeitadas',  label: 'Rejeitadas',   value: solResumo.rejeitadas, barClass: 'bg-red-400' },
  ].filter(s => s.value > 0)
  const totalPipeline = pipelineSegments.reduce((s, seg) => s + seg.value, 0) || 1

  // Por origem
  const origemData = [
    { key: 'pedido',   label: 'Pedidos',   value: nfResumo.porOrigem.pedido,   barClass: 'bg-teal-500' },
    { key: 'cp',       label: 'Contas Pagar', value: nfResumo.porOrigem.cp,    barClass: 'bg-blue-500' },
    { key: 'contrato', label: 'Contratos',  value: nfResumo.porOrigem.contrato, barClass: 'bg-violet-500' },
    { key: 'avulso',   label: 'Avulso',     value: nfResumo.porOrigem.avulso,   barClass: 'bg-amber-500' },
  ].filter(o => o.value > 0)
  const maxOrigem = Math.max(...origemData.map(o => o.value), 1)

  // Recentes
  const recentes = [...notas].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).slice(0, 6)

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel Fiscal</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Notas fiscais, solicitacoes e pipeline de emissao</p>
        </div>
        <button onClick={() => refetch()} className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500 hover:text-teal-400' : 'text-slate-400 hover:text-teal-600'}`}>
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nucleo Fiscal</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do mes</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <Receipt size={18} className="text-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Notas no Mes" value={nfResumo.count} tone="teal" isDark={isDark} note={fmt(nfResumo.total)} />
              <SpotlightMetric label="Solicitacoes" value={solResumo.total} tone="blue" isDark={isDark} note={`${solResumo.emitidas} emitidas`} />
              <SpotlightMetric label="Valor Total NF" value={fmt(nfResumo.total)} tone="emerald" isDark={isDark} note={`${nfResumo.count} notas`} />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Critica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>O que exige acao agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                solResumo.pendentes > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'
              }`}>
                <Zap size={14} className={solResumo.pendentes > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Pendentes" value={solResumo.pendentes} icon={Clock}
                iconTone={solResumo.pendentes > 0 ? (isDark ? 'text-amber-400' : 'text-amber-500') : 'text-slate-400'}
                note={solResumo.pendentes > 0 ? 'aguardando emissao' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="Rejeitadas" value={solResumo.rejeitadas} icon={AlertTriangle}
                iconTone={solResumo.rejeitadas > 0 ? (isDark ? 'text-red-400' : 'text-red-500') : 'text-slate-400'}
                note={solResumo.rejeitadas > 0 ? 'requer atencao' : 'nenhuma'} isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso Pipeline */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <FileCheck size={14} className="text-teal-500" /> Pipeline de Emissao
          </h2>
          <div className="flex items-center gap-3">
            {pipelineSegments.slice(0, 4).map(s => (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${s.barClass}`} />
                <span className="text-[10px] text-slate-500">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          {pipelineSegments.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              Nenhuma solicitacao no periodo
            </div>
          ) : (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              {pipelineSegments.map(s => {
                const pct = (s.value / totalPipeline) * 100
                return (
                  <div key={s.key} className={`${s.barClass} relative flex items-center justify-center transition-all`}
                    style={{ width: `${Math.max(pct, 4)}%` }} title={`${s.label}: ${s.value}`}>
                    {pct >= 14 && <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-1">{s.label} {pct >= 22 ? s.value : ''}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Row: NFs Recentes + Por Origem */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* NFs Recentes */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <FileText size={14} className="text-slate-500" /> Notas Recentes
            </h2>
            <button onClick={() => nav('/fiscal')} className="flex items-center gap-0.5 text-[10px] text-teal-600 font-semibold">
              Ver todas <ChevronRight size={11} />
            </button>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
            {recentes.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <FileText size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-200'}`} />
                <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma NF no periodo</p>
              </div>
            ) : recentes.map((nf: NotaFiscal) => (
              <div key={nf.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                  {nf.numero ? `${nf.numero}`.slice(-3) : '---'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{nf.fornecedor_nome || 'Sem fornecedor'}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    NF {nf.numero || '---'} · {fmtData(nf.data_emissao)} · {nf.origem}
                  </p>
                </div>
                <p className={`text-sm font-extrabold shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{fmt(nf.valor_total)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Por Origem */}
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <ShoppingCart size={14} className="text-teal-500" /> Por Origem
            </h2>
          </div>
          <div className="p-4 space-y-2.5">
            {origemData.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma NF no periodo</p>
            ) : origemData.map(o => (
              <div key={o.key} className="flex items-center gap-3">
                <p className={`text-[11px] font-semibold text-right shrink-0 w-[100px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{o.label}</p>
                <div className="flex-1 relative">
                  <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className={`h-full rounded-full ${o.barClass} transition-all duration-500`}
                      style={{ width: `${Math.max((o.value / maxOrigem) * 100, 4)}%` }} />
                  </div>
                </div>
                <p className={`text-[11px] font-extrabold shrink-0 w-[30px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{o.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
