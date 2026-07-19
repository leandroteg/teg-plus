import { useState, useMemo, useEffect } from 'react'
import { X, Download, ChevronRight, FolderKanban, FileText, Save, Sparkles } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useEGPPortfolioId } from '../../contexts/EGPContractContext'
import { useEAPFinal, aggregatePolos, useMedicaoSecao, useObraStatus, useProjetoSnapshots, useSalvarProjetoSnapshot, useStatusReportRun, useRiscosEGP, type EAPPolo, type EAPPacote, type ObraStatusAcao } from '../../hooks/usePMO'
import { useEfetivoReal } from '../../hooks/useEfetivoReal'
import { useCustosReal, MARGEM_LUCRO } from '../../hooks/useCustos'
import type { PMORisco } from '../../types/pmo'
import { gerarStatusReportProjetoPdf } from '../../utils/status-report-projeto-pdf'

// Conteúdo serializável do relatório (live ou snapshot)
interface ReportData {
  projeto: string; nObras: number; nOscs: number
  pctFis: number; pctFin: number; contratado: number; faturado: number; saldo: number
  obrasLista: { nome: string; oscs: string[] }[]
  pacotes: EAPPacote[]
  medicao: { pac: string; meses: number[]; total: number }[]
  prazo: { pctPrazoProj: number | null; terminoPrev: string | null; obras: { nome: string; venc: string | null; pctPrazo: number | null }[] }
  recursos: { fundacao: number; montlanc: number; maqFund: number; maqML: number } | null
  riscos: { descricao: string; categoria: string | null; sev: number; prob: number; imp: number }[]
  custos: { realizado: number; orcado: number } | null
  obras: { nome: string; status: string | null; diagnostico: string | null; farol: string | null; acoes: ObraStatusAcao[] | null }[]
}

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
  const { data: obraStatus = [], refetch: refetchStatus } = useObraStatus()
  const { data: efetivo } = useEfetivoReal(portfolioId)
  const { data: riscos = [] } = useRiscosEGP(portfolioId)
  const { data: custos } = useCustosReal(portfolioId)
  const [det, setDet] = useState<EAPPolo | null>(null)
  const [snapId, setSnapId] = useState<string>('live')
  const [disparando, setDisparando] = useState(false)
  const [dispErro, setDispErro] = useState<string | null>(null)
  const { data: snaps = [] } = useProjetoSnapshots(det?.id)
  const { data: run, refetch: refetchRun } = useStatusReportRun(det?.id)
  const salvar = useSalvarProjetoSnapshot()
  useEffect(() => { setSnapId('live'); setDispErro(null) }, [det])
  // quando a geração conclui (run -> done), recarrega os status das obras p/ atualizar os cards
  const runDone = run?.status === 'done' ? run.updated_at : null
  useEffect(() => { if (runDone) refetchStatus() }, [runDone, refetchStatus])

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

  // prazo consumido por obra/projeto (data OSC × vencimento das OSCs de construção)
  const prazoDoProjeto = (polo: EAPPolo) => {
    const rawPolo = raws.find(r => r.id === polo.id)
    const today = Date.now()
    const pct = (di: string | null, vf: string | null) => {
      if (!di || !vf) return null
      const a = new Date(di + 'T00:00:00').getTime(), b = new Date(vf + 'T00:00:00').getTime()
      if (!(b > a)) return null
      return Math.round(Math.max(0, (today - a) / (b - a)) * 100)
    }
    const byObra = new Map<string, { di: string | null; vf: string | null }>()
    let pDi: string | null = null, pVf: string | null = null
    for (const o of rawPolo?.oscs ?? []) {
      if (!((o.tipo ?? '').toLowerCase().includes('constru') && (o.saldo_reais ?? 0) > 0)) continue
      const nome = o.obra_nome || '— Sem obra'
      const cur = byObra.get(nome) ?? { di: null, vf: null }
      if (o.data_osc && (!cur.di || o.data_osc < cur.di)) cur.di = o.data_osc
      if (o.vencimento && (!cur.vf || o.vencimento > cur.vf)) cur.vf = o.vencimento
      byObra.set(nome, cur)
      if (o.data_osc && (!pDi || o.data_osc < pDi)) pDi = o.data_osc
      if (o.vencimento && (!pVf || o.vencimento > pVf)) pVf = o.vencimento
    }
    return {
      pctPrazoProj: pct(pDi, pVf), terminoPrev: pVf,
      obras: [...byObra.entries()].map(([nome, v]) => ({ nome, venc: v.vf, pctPrazo: pct(v.di, v.vf) })).sort((a, b) => (b.pctPrazo ?? -1) - (a.pctPrazo ?? -1)),
    }
  }
  const scoreR = (r: PMORisco, k: 'p' | 'i') => {
    const s = k === 'p' ? r.prob_score : r.impacto_score
    if (s) return Math.max(1, Math.min(5, s))
    const t = k === 'p' ? r.probabilidade : r.impacto
    return t === 'alta' || t === 'alto' ? 4 : t === 'baixa' || t === 'baixo' ? 2 : 3
  }

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
        const live: ReportData = {
          projeto: p.label, nObras: p.obras.length, nOscs: p.nOscs,
          pctFis: p.pctFis, pctFin: p.pctFin, contratado: p.contr, faturado: p.fat, saldo: p.saldo,
          obrasLista: p.obras.map(ob => ({ nome: ob.nome, oscs: (ob.oscs ?? []).map(o => o.numero_os) })),
          pacotes: p.pacotes,
          medicao: med.map(m => ({ pac: m.pac, meses: MESES.map(mm => m.row[mm] ?? 0), total: m.total })),
          prazo: prazoDoProjeto(p),
          recursos: efetivo?.porFrente?.[p.label] ?? null,
          riscos: riscos.filter(r => r.frente === p.label && r.status !== 'fechado')
            .map(r => { const pr = scoreR(r, 'p'), im = scoreR(r, 'i'); return { descricao: r.descricao, categoria: r.categoria ?? null, prob: pr, imp: im, sev: pr * im } })
            .sort((a, b) => b.sev - a.sev).slice(0, 8),
          custos: custos?.porFrente?.[p.label]
            ? { realizado: Math.round(Object.values(custos.porFrente[p.label]).reduce((s, v) => s + (v || 0), 0)), orcado: Math.round((1 - MARGEM_LUCRO) * p.contr) }
            : null,
          obras: obras.map(o => ({ nome: o.nome, status: o.st?.status_texto ?? null, diagnostico: o.st?.diagnostico ?? null, farol: o.st?.farol ?? null, acoes: o.st?.acoes ?? null })),
        }
        const data: ReportData = snapId === 'live' ? live : ((snaps.find(s => s.id === snapId)?.payload as ReportData) ?? live)
        const colTot = (i: number) => data.medicao.reduce((s, m) => s + (m.meses[i] ?? 0), 0)
        const isLive = snapId === 'live'
        const gerando = disparando || run?.status === 'running'
        const gerarComSuperTEG = async () => {
          setDisparando(true); setDispErro(null)
          try {
            const contexto = {
              projeto: p.label, mes_corrente: new Date().toISOString().slice(0, 7),
              pct_fisico: p.pctFis, pct_financeiro: p.pctFin, contratado: p.contr, faturado: p.fat, saldo: p.saldo,
              eap_pacotes: p.pacotes.filter(pc => !pc.isOutros).map(pc => ({ pacote: pc.n, pct_fisico: pc.pctFis, pct_financeiro: pc.pctFin, valor: pc.valor, qtd_contratada: pc.qtdContr, qtd_realizada: pc.qtdReal, unidade: pc.unidade })),
              obras: p.obras.map(ob => ({ obra_id: obraIdByNome.get(ob.nome) ?? null, nome: ob.nome, oscs: ob.oscs.map(o => o.numero_os) })).filter(o => o.obra_id),
              medicao_mes_a_mes: med.map(m => ({ pacote: m.pac, meses: MESES.map(mm => m.row[mm] ?? 0), total: m.total })),
            }
            const { data: res, error } = await supabase.functions.invoke('egp-status-projeto-analisar', { body: { projeto_id: p.id, portfolio_id: portfolioId ?? undefined, contexto } })
            if (error) throw error
            if (res?.ok === false) throw new Error(res.motivo || 'Falha na análise')
            // o estado (running/done/error) passa a vir da run durável no banco
            await refetchRun()
            if (res?.sincrono) await refetchStatus()
          } catch (e: any) { setDispErro('Erro ao acionar: ' + (e?.message || String(e))) }
          finally { setDisparando(false) }
        }
        // idade da run em andamento (p/ alertar se travar)
        const runAgeMin = run?.status === 'running' ? (Date.now() - new Date(run.started_at).getTime()) / 60000 : 0
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setDet(null)}>
            <div className={`rounded-2xl shadow-2xl w-full max-w-3xl my-6 ${isLight ? 'bg-white' : 'bg-[#0f172a]'}`} onClick={e => e.stopPropagation()}>
              {/* Capa */}
              <div className={`px-5 py-4 border-b flex items-start justify-between gap-2 sticky top-0 z-10 rounded-t-2xl ${isLight ? 'border-slate-100 bg-white' : 'border-white/[0.06] bg-[#0f172a]'}`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Status Report · Projeto</p>
                  <h3 className={`text-lg font-extrabold ${txt}`}>{data.projeto}</h3>
                  <p className={`text-xs ${muted}`}>{data.nObras} obras · {data.nOscs} OSCs · Físico {data.pctFis}% · Financeiro {data.pctFin}%</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select value={snapId} onChange={e => setSnapId(e.target.value)}
                    className={`text-xs rounded-lg border px-2 py-1.5 outline-none ${isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/[0.05] border-white/10 text-slate-300'}`}>
                    <option value="live">Ao vivo</option>
                    {snaps.map(s => <option key={s.id} value={s.id}>{new Date(s.data_report + 'T00:00:00').toLocaleDateString('pt-BR')}</option>)}
                  </select>
                  {isLive && (
                    <button onClick={gerarComSuperTEG} disabled={gerando} title="Gerar diagnóstico e ações das obras críticas pelo SuperTEG (Claude na VPS)"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60">
                      <Sparkles size={13} className={gerando ? 'animate-pulse' : ''} /> {gerando ? 'Gerando…' : 'Gerar Status com o SuperTEG'}</button>
                  )}
                  {isLive && (
                    <button onClick={() => salvar.mutate({ projetoId: p.id, portfolioId: portfolioId ?? undefined, dataReport: new Date().toISOString().slice(0, 10), payload: live, geradoPor: 'SuperTEG' })}
                      disabled={salvar.isPending} title="Salvar snapshot deste relatório"
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'border border-white/10 text-slate-300 hover:bg-white/[0.06]'}`}><Save size={13} /> {salvar.isPending ? 'Salvando…' : 'Salvar'}</button>
                  )}
                  <button onClick={() => gerarStatusReportProjetoPdf({
                    projeto: data.projeto, nObras: data.nObras, nOscs: data.nOscs, pctFis: data.pctFis, pctFin: data.pctFin,
                    contratado: data.contratado, faturado: data.faturado, saldo: data.saldo,
                    obrasLista: data.obrasLista ?? [],
                    pacotes: data.pacotes.map(pc => ({ n: pc.n, pctFis: pc.pctFis, pctFin: pc.pctFin, qtdContr: pc.qtdContr, qtdReal: pc.qtdReal, unidade: pc.unidade, valor: pc.valor })),
                    medicao: data.medicao, meses: MESES.map(m => MES_LBL[m]),
                    prazo: data.prazo ?? { pctPrazoProj: null, terminoPrev: null, obras: [] },
                    recursos: data.recursos ?? null, riscos: data.riscos ?? [], custos: data.custos ?? null,
                    obras: data.obras,
                  })} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5"><Download size={13} /> PDF</button>
                  <button onClick={() => setDet(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {dispErro && <div className="text-[11px] rounded-lg px-3 py-2 flex items-center gap-2 bg-red-500/10 text-red-500"><X size={13} /> {dispErro}</div>}
                {run?.status === 'running' && (
                  <div className="text-[11px] rounded-lg px-3 py-2 flex items-center gap-2 bg-violet-500/10 text-violet-500">
                    <Sparkles size={13} className="animate-pulse" />
                    <span>Gerando status com o SuperTEG… iniciado há {Math.max(0, Math.round(runAgeMin))} min · {run.n_obras ?? '—'} obra(s). Pode fechar o modal — continua rodando.
                      {runAgeMin > 6 && <b className="text-amber-500"> Está demorando mais que o normal — pode ter falhado; tente novamente.</b>}</span>
                  </div>
                )}
                {run?.status === 'error' && <div className="text-[11px] rounded-lg px-3 py-2 flex items-center gap-2 bg-red-500/10 text-red-500"><X size={13} /> Falha na geração: {run.mensagem ?? 'erro desconhecido'}</div>}
                {run?.status === 'done' && !dispErro && <div className="text-[11px] rounded-lg px-3 py-2 flex items-center gap-2 bg-emerald-500/10 text-emerald-600"><Sparkles size={13} /> {run.mensagem ?? `Status gerado (${run.gravados ?? 0} obras)`} · {new Date(run.updated_at).toLocaleString('pt-BR')}</div>}
                {!isLive && <p className={`text-[11px] italic ${muted}`}>Visualizando snapshot de {new Date((snaps.find(s => s.id === snapId)?.data_report ?? '') + 'T00:00:00').toLocaleDateString('pt-BR')} (congelado). Selecione "Ao vivo" para os dados atuais.</p>}
                {/* EAP por pacote */}
                <div>
                  <h4 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${txt}`}><FileText size={14} className="text-teal-500" /> EAP do projeto (por pacote)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.pacotes.map(pc => <PacoteBar key={pc.n} pac={pc} isLight={isLight} />)}
                  </div>
                </div>

                {/* Medição mês a mês */}
                {data.medicao.length > 0 && (
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
                          {data.medicao.map(m => (
                            <tr key={m.pac} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
                              <td className={`py-1.5 pr-2 font-medium ${txt}`}>{m.pac}</td>
                              {MESES.map((mm, i) => <td key={mm} className={`text-right py-1.5 px-1.5 tabular-nums ${(m.meses[i] ?? 0) > 0 ? txt : muted}`}>{(m.meses[i] ?? 0) > 0 ? fmtM(m.meses[i]) : '·'}</td>)}
                              <td className={`text-right py-1.5 pl-2 font-bold tabular-nums ${txt}`}>{fmtM(m.total)}</td>
                            </tr>
                          ))}
                          <tr className={`border-t-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <td className={`py-1.5 pr-2 font-bold ${txt}`}>Total</td>
                            {MESES.map((mm, i) => <td key={mm} className={`text-right py-1.5 px-1.5 font-bold tabular-nums ${txt}`}>{fmtM(colTot(i))}</td>)}
                            <td className={`text-right py-1.5 pl-2 font-bold tabular-nums ${txt}`}>{fmtM(data.medicao.reduce((s, m) => s + m.total, 0))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Detalhe por obra */}
                {data.obras.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-bold mb-2 ${txt}`}>Obras críticas ({data.obras.length})</h4>
                    <div className="space-y-2.5">
                      {data.obras.map(o => (
                        <div key={o.nome} className={`rounded-xl border p-3 ${isLight ? 'border-slate-200' : 'border-white/[0.08]'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${farolDot(o.farol)}`} />
                            <p className={`text-xs font-bold ${txt}`}>{o.nome}</p>
                          </div>
                          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{o.diagnostico ?? o.status}</p>
                          {o.acoes && o.acoes.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {o.acoes.map((a, i) => (
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
