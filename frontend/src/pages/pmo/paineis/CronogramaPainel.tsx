// Painel Cronograma — projeta o SALDO da EAP mês a mês por produtividade (editável)
import { useMemo, useState, useEffect } from 'react'
import { CalendarDays, Gauge, Filter, ChevronDown, Check, Flag } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal, aggregatePolos } from '../../../hooks/usePMO'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
// drivers físicos da EAP (pacote → quantitativo)
const DRV = [
  { pac: 'Serv. Preliminares', label: 'Topografia', uni: 'km', cor: '#0284c7' },
  { pac: 'Fundações', label: 'Tubulões', uni: 'm³', cor: '#92400e' },
  { pac: 'Montagem de Torres', label: 'Montagem', uni: 'ton', cor: '#374151' },
  { pac: 'Lançamento de Cabos', label: 'Lançamento', uni: 'km', cor: '#3730a3' },
]
const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[+m]}/${y.slice(2)}` }
const shiftYM = (ym: string, d: number) => { let [y, m] = ym.split('-').map(Number); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return `${y}-${String(m).padStart(2, '0')}` }
const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const fmtQ = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : (Number.isInteger(v) ? String(v) : v.toFixed(1))
const poloNm = (s: string) => s.replace(/^F[\d.\/]+\s*-\s*/, '')

function MultiSelect({ label, icon, options, selected, onToggle, onClear, isDark }: { label: string; icon?: ReactNode; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void; onClear: () => void; isDark: boolean }) {
  const [open, setOpen] = useState(false); const n = selected.size
  const resumo = n === 0 ? 'todas' : n === 1 ? (options.find(o => selected.has(o.value))?.label ?? `${n}`) : `${n} selecionadas`
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-semibold transition min-w-[150px] ${n > 0 ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}>
        {icon}<span className="opacity-70">{label}</span><span className="flex-1 text-left truncate">{resumo}</span><ChevronDown size={12} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (<><div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className={`absolute left-0 z-30 mt-1.5 min-w-full w-max max-w-[260px] max-h-72 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
          {n > 0 && <button onClick={onClear} className={`w-full text-left px-2 py-1 mb-0.5 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>× limpar</button>}
          {options.map(o => { const on = selected.has(o.value); return (
            <button key={o.value} onClick={() => onToggle(o.value)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
              <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${on ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{on && <Check size={11} strokeWidth={3} />}</span>
              <span className={`truncate ${on ? 'font-semibold' : ''} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.label}</span>
            </button>) })}
        </div></>)}
    </div>
  )
}

export default function CronogramaPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [prod, setProd] = useState<Record<string, number>>({})
  const [horizonte, setHorizonte] = useState(12) // meses-alvo p/ semear a produtividade

  const base = useMemo(() => {
    const polos = aggregatePolos(raw ?? [], new Set())
    const sel = fFrente.size ? polos.filter(p => fFrente.has(p.label)) : polos
    const drivers = DRV.map(d => {
      let contr = 0, real = 0, valor = 0, fat = 0
      for (const p of sel) { const x = p.pacotes.find(z => z.n === d.pac); if (x) { contr += x.qtdContr; real += x.qtdReal; valor += x.valor; fat += x.faturado } }
      return { ...d, contr, real, saldoQ: Math.max(0, contr - real), saldoR: Math.max(0, valor - fat), pctFis: contr ? Math.round(real / contr * 100) : 0 }
    })
    const saldoRtotal = sel.reduce((s, p) => s + p.saldo, 0)
    return { drivers, saldoRtotal, frentes: polos.map(p => p.label) }
  }, [raw, fFrente])

  // semeia a produtividade = ritmo p/ terminar no horizonte (editável depois)
  useEffect(() => {
    const seed: Record<string, number> = {}
    for (const d of base.drivers) seed[d.label] = d.saldoQ > 0 ? Math.max(0.1, Math.round(d.saldoQ / horizonte * 10) / 10) : 0
    setProd(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.drivers.map(d => d.saldoQ).join(','), horizonte])

  const proj = useMemo(() => {
    const d0 = new Date(); const start = shiftYM(`${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}`, 1)
    const rows = base.drivers.map(d => {
      const rate = prod[d.label] || 0
      const months = (rate > 0 && d.saldoQ > 0) ? Math.ceil(d.saldoQ / rate) : 0
      return { ...d, rate, months, termino: months > 0 ? shiftYM(start, months - 1) : null }
    })
    const maxMonths = Math.min(36, Math.max(0, ...rows.map(r => r.months)))
    const meses = Array.from({ length: maxMonths }, (_, i) => shiftYM(start, i))
    const matrix = rows.map(r => ({
      ...r,
      vals: meses.map((_, i) => { if (r.rate <= 0) return 0; const prev = r.rate * i; if (prev >= r.saldoQ) return 0; return Math.min(r.rate, r.saldoQ - prev) }),
    }))
    const rMes = meses.map((_, i) => matrix.reduce((s, r) => s + (r.saldoQ > 0 ? r.saldoR * (r.vals[i] / r.saldoQ) : 0), 0))
    const terminoGeral = maxMonths > 0 ? meses[maxMonths - 1] : null
    return { start, meses, matrix, rMes, maxMonths, terminoGeral, totalR: rMes.reduce((s, x) => s + x, 0) }
  }, [base, prod])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!base.frentes.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const th = `px-2 py-2 text-right text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} whitespace-nowrap`
  const td = `px-2 py-1.5 text-right text-[12px] tabular-nums whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`
  const cellBg = (v: number, max: number) => v > 0 && max ? (isDark ? `rgba(45,212,191,${0.1 + 0.45 * v / max})` : `rgba(13,148,136,${0.08 + 0.45 * v / max})`) : undefined
  const maxCell = Math.max(...proj.matrix.flatMap(r => r.vals), 1)

  return (
    <div className="space-y-3">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={base.frentes.map(f => ({ value: f, label: f }))} selected={fFrente} onToggle={v => { const n = new Set(fFrente); n.has(v) ? n.delete(v) : n.add(v); setFFrente(n) }} onClear={() => setFFrente(new Set())} isDark={isDark} />
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Semear p/ terminar em</span>
          {[6, 12, 18, 24].map(h => <button key={h} onClick={() => setHorizonte(h)} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${horizonte === h ? 'bg-teal-600 text-white border-teal-600' : (isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500')}`}>{h}m</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Saldo a faturar" value={fmtM(base.saldoRtotal)} tone="amber" isDark={isDark} note="R$ restante no contrato" />
        <Kpi label="Término previsto" value={proj.terminoGeral ? ymLabel(proj.terminoGeral) : '—'} tone="violet" isDark={isDark} note={`${proj.maxMonths} mes(es) no ritmo`} />
        <Kpi label="R$ projetado" value={fmtM(proj.totalR)} tone="teal" isDark={isDark} note="distribuído pelo físico" />
        <Kpi label="Início" value={ymLabel(proj.start)} tone="sky" isDark={isDark} note="próximo mês" />
      </div>

      {/* Parâmetros de produtividade (editáveis) */}
      <PanelCard title="Produtividade por driver (editável) — ritmo mensal" icon={<Gauge size={14} className="text-teal-500" />} isDark={isDark}
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ajuste o ritmo real; o cronograma recalcula</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {base.drivers.map(d => {
            const rate = prod[d.label] || 0; const months = (rate > 0 && d.saldoQ > 0) ? Math.ceil(d.saldoQ / rate) : 0
            return (
              <div key={d.label} className={`rounded-xl p-3 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/70 border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.cor }} /><span className={`text-[12px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{d.label}</span></div>
                <p className={`text-[10px] mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Saldo: <b>{fmtQ(d.saldoQ)} {d.uni}</b> · físico {d.pctFis}%</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" step="0.5" value={rate} onChange={e => setProd(p => ({ ...p, [d.label]: Number(e.target.value) }))}
                    className={`w-20 text-sm font-bold rounded-lg border px-2 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d.uni}/mês</span>
                </div>
                <p className={`text-[11px] mt-2 font-semibold`} style={{ color: d.cor }}>{months > 0 ? `${months} meses · termina ${proj.matrix.find(m => m.label === d.label)?.termino ? ymLabel(proj.matrix.find(m => m.label === d.label)!.termino!) : '—'}` : (d.saldoQ > 0 ? 'defina o ritmo' : 'concluído ✓')}</p>
              </div>
            )
          })}
        </div>
      </PanelCard>

      {/* Projeção mês a mês */}
      <PanelCard title="Cronograma — projeção do saldo mês a mês" icon={<CalendarDays size={14} className="text-teal-500" />} isDark={isDark} pad={false} bodyClassName="overflow-x-auto"
        right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>qtd executada projetada por mês</span>}>
        {proj.maxMonths === 0 ? <p className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Defina a produtividade pra gerar o cronograma.</p> : (
          <table className="w-full border-collapse">
            <thead><tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <th className={`px-3 py-2 text-left text-[11px] font-semibold sticky left-0 ${isDark ? 'text-slate-400 bg-slate-900' : 'text-slate-500 bg-white'}`}>Driver</th>
              {proj.meses.map(m => <th key={m} className={th}>{ymLabel(m)}</th>)}
              <th className={`${th} pr-3`}>Término</th>
            </tr></thead>
            <tbody>
              {proj.matrix.map(r => (
                <tr key={r.label} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className={`px-3 py-1.5 text-left text-[12px] font-medium sticky left-0 ${isDark ? 'text-slate-200 bg-slate-900' : 'text-slate-700 bg-white'}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: r.cor }} />{r.label} <span className="text-slate-400">({r.uni})</span></td>
                  {r.vals.map((v, i) => <td key={i} className={td} style={{ background: cellBg(v, maxCell) }}>{v > 0 ? fmtQ(v) : <span className="text-slate-400">·</span>}</td>)}
                  <td className={`${td} pr-3 font-semibold`} style={{ color: r.cor }}>{r.termino ? <span className="inline-flex items-center gap-1"><Flag size={11} />{ymLabel(r.termino)}</span> : '—'}</td>
                </tr>
              ))}
              <tr className={`border-t-2 ${isDark ? 'border-slate-600' : 'border-slate-300'} font-bold`}>
                <td className={`px-3 py-2 text-left text-[12px] sticky left-0 ${isDark ? 'text-white bg-slate-900' : 'text-slate-900 bg-white'}`}>R$ projetado</td>
                {proj.rMes.map((v, i) => <td key={i} className={`${td} font-bold`}>{v > 0 ? fmtM(v) : '·'}</td>)}
                <td className={`${td} pr-3 font-bold`}>{fmtM(proj.totalR)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </PanelCard>

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        * Projeção linear: o saldo de cada driver (contratado − executado) é distribuído no ritmo definido, a partir do próximo mês. O R$ é distribuído proporcionalmente ao físico projetado. Ajuste a produtividade pra simular cenários.
      </p>
    </div>
  )
}
