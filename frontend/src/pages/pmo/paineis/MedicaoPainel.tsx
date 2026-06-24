// Painel Medição — controle comparativo mês a mês (padrão Painel Ger. Med. CEMIG)
// Tabela frente(EAP) × meses + variação, e OSC × meses + acumulado. Tudo vivo das medições.
import { useMemo } from 'react'
import { Grid3x3, Building2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useMedicaoMensal, useMedicaoSecao, useEAPFinal } from '../../../hooks/usePMO'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const PAC_ORD = ['Serv. Preliminares', 'Canteiro e Mobiliz.', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Administração Local', 'Outros']
const PAC_COR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7', 'Canteiro e Mobiliz.': '#0369a1', 'Fundações': '#92400e', 'Montagem de Torres': '#374151',
  'Lançamento de Cabos': '#3730a3', 'Administração Local': '#6d28d9', 'Outros': '#64748b',
}
const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[Number(m)]}/${y.slice(2)}` }
const fmtM = (v: number) => v >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : '' + Math.round(v)
const fmtCell = (v: number) => v <= 0 ? '' : v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + 'M' : 'R$ ' + Math.round(v / 1e3) + 'k'
const fmtFull = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')

function VarBadge({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-400">—</span>
  const up = v >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-600' : 'text-orange-600'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{up ? '+' : ''}{v.toFixed(0)}%
    </span>
  )
}

export default function MedicaoPainel({ de = '2024-01', ate }: { de?: string; ate?: string }) {
  const { isDark } = useTheme()
  const { data: mensal, isLoading } = useMedicaoMensal()
  const { data: secao } = useMedicaoSecao()
  const { data: raw } = useEAPFinal(CONTRATO_CEMIG)
  const ateF = ate ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()

  const oscMap = useMemo(() => {
    const m = new Map<string, { obra: string; polo: string }>()
    for (const p of (raw ?? [])) for (const o of p.oscs) m.set(o.numero_os, { obra: o.obra_nome, polo: p.label.replace(/^F[\d.\/]+\s*-\s*/, '') })
    return m
  }, [raw])

  // meses presentes no período
  const meses = useMemo(() => {
    const s = new Set<string>()
    for (const r of (mensal ?? [])) { const c = r.competencia; if (Number(r.realizado ?? 0) > 0 && c >= de && c <= ateF) s.add(c) }
    return [...s].sort()
  }, [mensal, de, ateF])

  // frente(EAP) × mês
  const frente = useMemo(() => {
    const mp = new Map<string, Map<string, number>>()
    for (const r of (secao ?? [])) { const c = r.competencia; const v = Number(r.realizado ?? 0); if (v <= 0 || c < de || c > ateF) continue
      let m = mp.get(r.pacote); if (!m) { m = new Map(); mp.set(r.pacote, m) }; m.set(c, (m.get(c) ?? 0) + v) }
    const rows = PAC_ORD.filter(p => mp.has(p)).map(p => {
      const mm = mp.get(p)!; const vals = meses.map(c => mm.get(c) ?? 0); const total = vals.reduce((s, x) => s + x, 0)
      return { pac: p, vals, total }
    })
    const totMes = meses.map(c => rows.reduce((s, r) => s + (r.vals[meses.indexOf(c)] ?? 0), 0))
    return { rows, totMes, total: totMes.reduce((s, x) => s + x, 0) }
  }, [secao, meses, de, ateF])

  // OSC × mês (+ acum, TEG/Sub)
  const oscTab = useMemo(() => {
    const mp = new Map<string, { vals: Map<string, number>; acum: number; total: number; sub: boolean }>()
    for (const r of (mensal ?? [])) { const c = r.competencia; const v = Number(r.realizado ?? 0); if (v <= 0 || c < de || c > ateF) continue
      let a = mp.get(r.numero_os); if (!a) { a = { vals: new Map(), acum: 0, total: 0, sub: false }; mp.set(r.numero_os, a) }
      a.vals.set(c, (a.vals.get(c) ?? 0) + v); a.total += v; a.acum = Math.max(a.acum, Number(r.acumulado ?? 0)); if (r.subcontratada) a.sub = true }
    const rows = [...mp.entries()].map(([osc, a]) => ({ osc, ...oscMap.get(osc), vals: meses.map(c => a.vals.get(c) ?? 0), acum: a.acum, total: a.total, sub: a.sub }))
      .sort((x, y) => y.total - x.total)
    return rows
  }, [mensal, oscMap, meses, de, ateF])

  // KPIs (último mês × penúltimo, TEG/Sub do período)
  const kpi = useMemo(() => {
    const ult = meses[meses.length - 1]; const pen = meses[meses.length - 2]
    const somaMes = (c?: string) => c ? (mensal ?? []).filter(r => r.competencia === c).reduce((s, r) => s + Number(r.realizado ?? 0), 0) : 0
    const fUlt = somaMes(ult); const fPen = somaMes(pen)
    const nOscUlt = ult ? new Set((mensal ?? []).filter(r => r.competencia === ult && Number(r.realizado ?? 0) > 0).map(r => r.numero_os)).size : 0
    let teg = 0, sub = 0
    for (const r of (mensal ?? [])) { const c = r.competencia; const v = Number(r.realizado ?? 0); if (v <= 0 || c < de || c > ateF) continue; if (r.subcontratada) sub += v; else teg += v }
    const tot = teg + sub
    return { ult, fUlt, nOscUlt, varPct: fPen > 0 ? (fUlt - fPen) / fPen * 100 : null, total: tot, pctTeg: tot ? Math.round(teg / tot * 100) : 0, pctSub: tot ? Math.round(sub / tot * 100) : 0 }
  }, [mensal, meses, de, ateF])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!meses.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem medições no período.</p>

  const cellBg = (v: number, max: number) => { if (v <= 0 || !max) return undefined; const a = 0.08 + 0.5 * (v / max); return isDark ? `rgba(45,212,191,${a * 0.5})` : `rgba(13,148,136,${a})` }
  const maxFrente = Math.max(...frente.rows.flatMap(r => r.vals), 1)
  const th = `px-2 py-2 text-right text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} whitespace-nowrap`
  const td = `px-2 py-1.5 text-right text-[12px] tabular-nums whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label={`Último mês (${kpi.ult ? ymLabel(kpi.ult) : '—'})`} value={fmtCell(kpi.fUlt) || 'R$ 0'} tone="emerald" isDark={isDark} note={`${kpi.nOscUlt} OSCs medidas`} />
        <Kpi label="Variação mês anterior" value={kpi.varPct === null ? '—' : `${kpi.varPct >= 0 ? '▲ +' : '▼ '}${kpi.varPct.toFixed(1)}%`} tone={kpi.varPct !== null && kpi.varPct >= 0 ? 'emerald' : 'amber'} isDark={isDark} note="penúlt → último" />
        <Kpi label="Total no período" value={'R$ ' + fmtM(kpi.total)} tone="sky" isDark={isDark} note={`${meses.length} mes(es) · ${oscTab.length} OSCs`} />
        <Kpi label="TEG × Subcontratadas" value={`${kpi.pctTeg}% / ${kpi.pctSub}%`} tone="violet" isDark={isDark} note="execução própria / terceiros" />
      </div>

      {/* Comparativo por frente (EAP) mês a mês */}
      <PanelCard title="Comparativo por frente (EAP) — mês a mês" icon={<Grid3x3 size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Var = penúlt → último mês</span>} pad={false} bodyClassName="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <th className={`px-3 py-2 text-left text-[11px] font-semibold sticky left-0 ${isDark ? 'text-slate-400 bg-slate-900' : 'text-slate-500 bg-white'}`}>Frente</th>
              {meses.map(c => <th key={c} className={th}>{ymLabel(c)}</th>)}
              <th className={`${th} pr-3`}>Total</th>
              <th className={`${th} pr-3`}>Var</th>
            </tr>
          </thead>
          <tbody>
            {frente.rows.map(r => {
              const ult = r.vals[meses.length - 1] ?? 0; const pen = r.vals[meses.length - 2] ?? 0
              const vp = pen > 0 ? (ult - pen) / pen * 100 : null
              return (
                <tr key={r.pac} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className={`px-3 py-1.5 text-left text-[12px] font-medium sticky left-0 ${isDark ? 'text-slate-200 bg-slate-900' : 'text-slate-700 bg-white'}`}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: PAC_COR[r.pac] ?? '#64748b' }} />{r.pac}
                  </td>
                  {r.vals.map((v, i) => <td key={i} className={td} style={{ background: cellBg(v, maxFrente) }}>{v > 0 ? fmtCell(v) : <span className="text-slate-400">·</span>}</td>)}
                  <td className={`${td} pr-3 font-semibold`}>{fmtCell(r.total)}</td>
                  <td className={`${td} pr-3`}><VarBadge v={vp} /></td>
                </tr>
              )
            })}
            <tr className={`border-t-2 ${isDark ? 'border-slate-600' : 'border-slate-300'} font-bold`}>
              <td className={`px-3 py-2 text-left text-[12px] sticky left-0 ${isDark ? 'text-white bg-slate-900' : 'text-slate-900 bg-white'}`}>Total</td>
              {frente.totMes.map((v, i) => <td key={i} className={`${td} font-bold`}>{fmtCell(v)}</td>)}
              <td className={`${td} pr-3 font-bold`}>{fmtCell(frente.total)}</td>
              <td className={`${td} pr-3`}>{(() => { const u = frente.totMes[meses.length - 1] ?? 0, p = frente.totMes[meses.length - 2] ?? 0; return <VarBadge v={p > 0 ? (u - p) / p * 100 : null} /> })()}</td>
            </tr>
          </tbody>
        </table>
      </PanelCard>

      {/* Comparativo por OSC mês a mês */}
      <PanelCard title="Controle por OSC — mês a mês" icon={<Building2 size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{oscTab.length} OSCs · acum = acumulado contratual</span>} pad={false} bodyClassName="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className={`border-b ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <th className={`px-3 py-2 text-left text-[11px] font-semibold sticky left-0 z-20 ${isDark ? 'text-slate-400 bg-slate-900' : 'text-slate-500 bg-white'}`}>OSC · Obra</th>
              {meses.map(c => <th key={c} className={`${th} ${isDark ? 'bg-slate-900' : 'bg-white'}`}>{ymLabel(c)}</th>)}
              <th className={`${th} pr-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>Total</th>
              <th className={`${th} pr-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>Acum.</th>
            </tr>
          </thead>
          <tbody>
            {oscTab.map(o => (
              <tr key={o.osc} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <td className={`px-3 py-1.5 text-left sticky left-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold tabular-nums ${o.sub ? 'text-orange-500' : (isDark ? 'text-teal-300' : 'text-teal-600')}`}>{o.osc.replace('OSC-', '')}</span>
                    <span className={`text-[11px] truncate max-w-[160px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={o.obra}>{o.obra ?? '—'}</span>
                    {o.polo && <span className={`text-[9px] px-1 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{o.polo}</span>}
                  </div>
                </td>
                {o.vals.map((v, i) => <td key={i} className={td} style={{ background: cellBg(v, maxFrente) }}>{v > 0 ? fmtCell(v) : <span className="text-slate-400">·</span>}</td>)}
                <td className={`${td} pr-3 font-semibold`}>{fmtCell(o.total)}</td>
                <td className={`${td} pr-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title={fmtFull(o.acum)}>{o.acum > 0 ? fmtCell(o.acum) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelCard>
    </div>
  )
}
