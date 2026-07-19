import { useState, useMemo } from 'react'
import { X, Download, ChevronRight, FolderKanban, FileText } from 'lucide-react'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, useMedicaoSecao, useObraStatus, type EAPPolo, type EAPPacote } from '../../hooks/usePMO'
import { gerarStatusReportProjetoPdf } from '../../utils/status-report-projeto-pdf'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtM = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M` : `R$ ${Math.round(v / 1e3)}k`
const fmtQtd = (q?: number | null, u?: string | null) => (q == null || !u) ? '' : `${Number(q).toLocaleString('pt-BR', { maximumFractionDigits: q < 10 ? 1 : 0 })} ${u}`
const MESES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
const MES_LBL: Record<string, string> = { '2026-01': 'Jan', '2026-02': 'Fev', '2026-03': 'Mar', '2026-04': 'Abr', '2026-05': 'Mai', '2026-06': 'Jun', '2026-07': 'Jul' }
const pacColor = (n: string) => {
  const s = n.toLowerCase()
  if (s.includes('cabo')) return '#4f46e5'
  if (s.includes('torre') || s.includes('montag')) return '#1e293b'
  if (s.includes('funda')) return '#b45309'
  if (s.includes('adm')) return '#7c3aed'
  if (s.includes('prelim') || s.includes('canteir')) return '#2563eb'
  return '#64748b'
}
const farolDot = (f?: string | null) => f === 'vermelho' ? 'bg-red-500' : f === 'amarelo' ? 'bg-amber-500' : f === 'verde' ? 'bg-emerald-500' : 'bg-slate-400'

// ── Barra de pacote (padrão EAPFinal) ─────────────────────────────────────────
function PacoteBar({ pac, isLight }: { pac: EAPPacote; isLight: boolean }) {
  const color = pacColor(pac.n)
  if (pac.isOutros) return (
    <div className={`rounded-xl border border-dashed p-2.5 flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'}`}>
      <span className="font-semibold text-sm" style={{ color }}>{pac.n}</span>
      <span className={`text-sm font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{fmtM(pac.valor)}</span>
    </div>
  )
  const barPct = pac.pctFis ?? pac.pctFin
  return (
    <div className={`rounded-xl p-2.5 ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-sm leading-tight" style={{ color: isLight ? '#0f2a4a' : '#e2e8f0' }}>{pac.n}</span>
        {fmtQtd(pac.qtdContr, pac.unidade) && <span className="ml-auto text-[11px] font-semibold text-white px-2 py-0.5 rounded-full shrink-0" style={{ background: color }}>{fmtQtd(pac.qtdContr, pac.unidade)}</span>}
      </div>
      <div className={`h-5 rounded-full overflow-hidden relative ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(barPct, 100)}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {pac.pctFis != null ? `Físico ${pac.pctFis}% · falta ${fmtQtd(pac.qtdContr - (pac.qtdReal ?? 0), pac.unidade) || '—'}` : `Faturado ${pac.pctFin}%`}
        </span>
        <span className="text-xs font-bold tabular-nums" style={{ color: isLight ? '#0f2a4a' : '#cbd5e1' }}>{fmtM(pac.valor)}</span>
      </div>
    </div>
  )
}

// ── Painel principal ──────────────────────────────────────────────────────────
export default function ProjetoStatusReport({ isLight }: { isLight: boolean }) {
  const portfolioId = useEGPPortfolioId()
  const { data: raws = [], isLoading } = useEAPFinal(portfolioId)
  const { data: secao = [] } = useMedicaoSecao()
  const { data: obraStatus = [] } = useObraStatus()
  const [det, setDet] = useState<EAPPolo | null>(null)

  // Só OSC de CONSTRUÇÃO NÃO CONCLUÍDA (tipo=construção e saldo>0)
  const excludedOscs = useMemo(() => {
    const s = new Set<string>()
    for (const p of raws) for (const o of p.oscs) {
      const ok = (o.tipo ?? '').toLowerCase().includes('constru') && (o.saldo_reais ?? 0) > 0
      if (!ok) s.add(o.id)
    }
    return s
  }, [raws])

  // nome da obra -> obra_id (p/ ligar o status por obra)
  const obraIdByNome = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of raws) for (const o of p.oscs) if (o.obra_id && o.obra_nome) m.set(o.obra_nome, o.obra_id)
    return m
  }, [raws])
  const statusByObraId = useMemo(() => new Map(obraStatus.map(s => [s.obra_id, s])), [obraStatus])

  const polos = useMemo(() => aggregatePolos(raws, excludedOscs).filter(p => p.contr > 0), [raws, excludedOscs])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  // medição mês×pacote para o projeto selecionado
  const medicaoTabela = (polo: EAPPolo) => {
    const oscSet = new Set(polo.obras.flatMap(ob => ob.oscs.map(o => o.numero_os)))
    const porPac = new Map<string, Record<string, number>>()
    for (const r of secao) {
      if (!oscSet.has(r.numero_os)) continue
      const pac = r.pacote || 'Outros'
      const row = porPac.get(pac) ?? {}
      row[r.competencia] = (row[r.competencia] ?? 0) + Number(r.realizado ?? 0)
      porPac.set(pac, row)
    }
    return [...porPac.entries()].map(([pac, row]) => ({ pac, row, total: MESES.reduce((s, m) => s + (row[m] ?? 0), 0) }))
      .sort((a, b) => b.total - a.total)
  }

  const obrasDoProjeto = (polo: EAPPolo) => polo.obras
    .map(ob => ({ nome: ob.nome, id: obraIdByNome.get(ob.nome), st: statusByObraId.get(obraIdByNome.get(ob.nome) ?? '') }))
    .filter(o => o.st?.status_texto)
    .sort((a, b) => (a.st?.farol === 'vermelho' ? 0 : 1) - (b.st?.farol === 'vermelho' ? 0 : 1))

  const card = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
  const txt = isLight ? 'text-slate-800' : 'text-white'
  const muted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>Relatório por projeto · só obras de <b>construção não concluídas</b> · {polos.length} projeto{polos.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {polos.map(p => (
          <button key={p.id} onClick={() => setDet(p)} className={`text-left rounded-2xl border p-4 transition-all ${card} ${isLight ? 'hover:shadow-md' : 'hover:bg-white/[0.06]'}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className={`font-extrabold flex items-center gap-1.5 ${txt}`}><FolderKanban size={15} className="text-teal-500" /> {p.label}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'}`}>{p.obras.length} obras · {p.nOscs} OSCs</span>
            </div>
            {(['Físico', 'Financeiro'] as const).map((lbl, i) => {
              const pct = i === 0 ? p.pctFis : p.pctFin
              return (
                <div key={lbl} className="flex items-center gap-2 mb-1.5">
                  <span className={`w-16 text-[11px] font-semibold ${muted}`}>{lbl}</span>
                  <div className={`flex-1 h-4 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: i === 0 ? '#475569' : '#1e293b' }} />
                  </div>
                  <span className={`w-24 text-right text-xs font-bold ${txt}`}>{pct}% · {fmtM(i === 0 ? p.contr : p.fat)}</span>
                </div>
              )
            })}
            <div className="flex items-center justify-end mt-2 text-[11px] font-semibold text-teal-600">Abrir relatório <ChevronRight size={12} /></div>
          </button>
        ))}
      </div>

      {det && (() => {
        const p = det
        const med = medicaoTabela(p)
        const obras = obrasDoProjeto(p)
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setDet(null)}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-3xl my-6 ${isLight ? 'bg-white' : 'bg-[#0f172a]'}`} onClick={e => e.stopPropagation()}>
              {/* Capa */}
              <div className={`px-5 py-4 border-b flex items-start justify-between gap-2 sticky top-0 z-10 rounded-t-2xl ${isLight ? 'border-slate-100 bg-white' : 'border-white/[0.06] bg-[#0f172a]'}`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Status Report · Projeto</p>
                  <h3 className={`text-lg font-extrabold ${txt}`}>{p.label}</h3>
                  <p className={`text-xs ${muted}`}>{p.obras.length} obras · {p.nOscs} OSCs · Físico {p.pctFis}% · Financeiro {p.pctFin}%</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => gerarStatusReportProjetoPdf({
                    projeto: p.label, nObras: p.obras.length, nOscs: p.nOscs, pctFis: p.pctFis, pctFin: p.pctFin,
                    contratado: p.contr, faturado: p.fat, saldo: p.saldo,
                    pacotes: p.pacotes.map(pc => ({ n: pc.n, pctFis: pc.pctFis, pctFin: pc.pctFin, qtdContr: pc.qtdContr, qtdReal: pc.qtdReal, unidade: pc.unidade, valor: pc.valor })),
                    medicao: med.map(m => ({ pac: m.pac, meses: MESES.map(mm => m.row[mm] ?? 0), total: m.total })),
                    meses: MESES.map(m => MES_LBL[m]),
                    obras: obras.map(o => ({ nome: o.nome, status: o.st?.status_texto ?? null, diagnostico: o.st?.diagnostico ?? null, farol: o.st?.farol ?? null, acoes: o.st?.acoes ?? null })),
                  })} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5"><Download size={13} /> PDF</button>
                  <button onClick={() => setDet(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* EAP por pacote */}
                <div>
                  <h4 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${txt}`}><FileText size={14} className="text-teal-500" /> EAP do projeto (por pacote)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {p.pacotes.map(pc => <PacoteBar key={pc.n} pac={pc} isLight={isLight} />)}
                  </div>
                </div>

                {/* Medição mês a mês */}
                {med.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-bold mb-2 ${txt}`}>Medição mês a mês (por pacote)</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={muted}>
                            <th className="text-left font-semibold py-1.5 pr-2">Pacote</th>
                            {MESES.map(m => <th key={m} className="text-right font-semibold py-1.5 px-1.5">{MES_LBL[m]}</th>)}
                            <th className="text-right font-semibold py-1.5 pl-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {med.map(m => (
                            <tr key={m.pac} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                              <td className={`py-1.5 pr-2 font-medium ${txt}`}>{m.pac}</td>
                              {MESES.map(mm => <td key={mm} className={`text-right py-1.5 px-1.5 tabular-nums ${(m.row[mm] ?? 0) > 0 ? txt : muted}`}>{(m.row[mm] ?? 0) > 0 ? fmtM(m.row[mm]) : '·'}</td>)}
                              <td className={`text-right py-1.5 pl-2 font-bold tabular-nums ${txt}`}>{fmtM(m.total)}</td>
                            </tr>
                          ))}
                          <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <td className={`py-1.5 pr-2 font-bold ${txt}`}>Total</td>
                            {MESES.map(mm => <td key={mm} className={`text-right py-1.5 px-1.5 font-bold tabular-nums ${txt}`}>{fmtM(med.reduce((s, m) => s + (m.row[mm] ?? 0), 0))}</td>)}
                            <td className={`text-right py-1.5 pl-2 font-bold tabular-nums ${txt}`}>{fmtM(med.reduce((s, m) => s + m.total, 0))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Detalhe por obra */}
                {obras.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-bold mb-2 ${txt}`}>Obras críticas ({obras.length})</h4>
                    <div className="space-y-2.5">
                      {obras.map(o => (
                        <div key={o.nome} className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${farolDot(o.st?.farol)}`} />
                            <p className={`text-xs font-bold ${txt}`}>{o.nome}</p>
                          </div>
                          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{o.st?.diagnostico ?? o.st?.status_texto}</p>
                          {o.st?.acoes && o.st.acoes.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {o.st.acoes.map((a, i) => (
                                <p key={i} className={`text-[11px] ${muted}`}>• {a.acao} <span className="opacity-70">— {a.dono ?? '—'}{a.prazo ? ` · ${a.prazo}` : ''}</span></p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
