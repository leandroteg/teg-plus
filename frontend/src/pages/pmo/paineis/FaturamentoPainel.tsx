// Painel Faturamento — consolidação das medições mensais (pmo_medicao_mensal)
import { useMemo, useState } from 'react'
import { TrendingUp, Building2, PieChart, Grid3x3, Users } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useMedicaoMensal, useMedicaoSecao, useEAPFinal } from '../../../hooks/usePMO'

// As medições são sempre do contrato CEMIG — o mapeamento OSC→polo é deste portfólio,
// independente do contrato selecionado no seletor (senão tudo cai em "Outros").
const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
import { Kpi, PanelCard, HBarRow, Heatmap } from '../../rh/paineis/_ui'

const POLO_COR = ['#0d9488', '#2563eb', '#7c3aed', '#e87b2a', '#16a34a', '#db2777', '#0891b2', '#ca8a04', '#64748b']
const poloNome = (s: string) => s.replace(/^F[\d.\/]+\s*-\s*/, '')
// O espelho mensal só quebra até a SEÇÃO CEMIG. Mapeamos para os pacotes da EAP que
// têm correspondência exata (1:1). A seção 1 "Serviços Preliminares" engloba
// Serv.Preliminares + Canteiro + Adm — sem dado mensal por subseção, fica em "Serv. Preliminares".
const SECAO_TO_EAP: Record<string, string> = {
  'Preliminares': 'Serv. Preliminares', 'Fundações': 'Fundações', 'Montagem': 'Montagem de Torres', 'Lançamento': 'Lançamento de Cabos',
  'Transportes': 'Outros', 'Aterramento': 'Outros', 'Complementares': 'Outros', 'Desmontagem': 'Outros',
  'Depósito': 'Outros', 'Serv. Especiais': 'Outros', 'Outros (sem detalhe)': 'Outros',
}
const PAC_ORD = ['Serv. Preliminares', 'Fundações', 'Montagem de Torres', 'Lançamento de Cabos', 'Outros']
const PAC_COR: Record<string, string> = {
  'Serv. Preliminares': '#0284c7', 'Fundações': '#92400e', 'Montagem de Torres': '#374151', 'Lançamento de Cabos': '#3730a3', 'Outros': '#64748b',
}

const fmtM = (v: number) => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1e3 ? 'R$ ' + Math.round(v / 1e3) + 'k' : 'R$ ' + Math.round(v)
const fmtFull = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const MES_ABR = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
function listaMeses(de: string, ate: string): string[] {
  const out: string[] = []; let [y, m] = de.split('-').map(Number)
  const [ya, ma] = ate.split('-').map(Number)
  while (y < ya || (y === ya && m <= ma)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } }
  return out
}
const ymLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_ABR[Number(m)]}/${y.slice(2)}` }
function shiftMonth(ym: string, delta: number): string {
  let [y, m] = ym.split('-').map(Number); m += delta
  while (m < 1) { m += 12; y-- }; while (m > 12) { m -= 12; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

export default function FaturamentoPainel({ de = '2024-01', ate, visao = 'faturamento' }: { de?: string; ate?: string; visao?: 'faturamento' | 'producao' }) {
  const { isDark } = useTheme()
  const { data: rows, isLoading } = useMedicaoMensal()
  const { data: secaoRows } = useMedicaoSecao()
  const { data: raw } = useEAPFinal(CONTRATO_CEMIG)
  const [hover, setHover] = useState<number | null>(null)
  const ateF = ate ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const isProd = visao === 'producao'
  const noun = isProd ? 'Produção' : 'Faturamento'

  const serie = useMemo(() => {
    const byM = new Map<string, { fat: number; oscs: Set<string> }>()
    for (const r of (rows ?? [])) {
      const v = Number(r.realizado ?? 0); if (v <= 0) continue
      // produção = 1 mês antes do faturamento (mês de execução)
      const c = isProd ? shiftMonth(r.competencia, -1) : r.competencia
      let a = byM.get(c); if (!a) { a = { fat: 0, oscs: new Set() }; byM.set(c, a) }
      a.fat += v; a.oscs.add(r.numero_os)
    }
    const meses = listaMeses(de, ateF)
    return meses.map(ym => ({ ym, fat: byM.get(ym)?.fat ?? 0, oscs: byM.get(ym)?.oscs.size ?? 0 }))
  }, [rows, de, ateF, isProd])

  // mapa OSC → obra/frente (do contrato vigente)
  const oscMap = useMemo(() => {
    const m = new Map<string, { obra: string; polo: string }>()
    for (const p of (raw ?? [])) for (const o of p.oscs) m.set(o.numero_os, { obra: o.obra_nome, polo: poloNome(p.label) })
    return m
  }, [raw])

  // agregações do período: top obras, por frente, frente×mês, TEG×Sub
  const agg = useMemo(() => {
    const porObra = new Map<string, number>(); const porPolo = new Map<string, number>()
    const poloMes = new Map<string, Map<string, number>>(); const mesesSet = new Set<string>()
    let teg = 0, sub = 0
    for (const r of (rows ?? [])) {
      const v = Number(r.realizado ?? 0); const c = r.competencia
      if (v <= 0 || c < de || c > ateF) continue
      const info = oscMap.get(r.numero_os)
      const obra = info?.obra ?? '— Fora do contrato'; const polo = info?.polo ?? 'Outros'
      porObra.set(obra, (porObra.get(obra) ?? 0) + v)
      porPolo.set(polo, (porPolo.get(polo) ?? 0) + v)
      let pm = poloMes.get(polo); if (!pm) { pm = new Map(); poloMes.set(polo, pm) }
      pm.set(c, (pm.get(c) ?? 0) + v); mesesSet.add(c)
      if (r.subcontratada) sub += v; else teg += v
    }
    const topObras = [...porObra.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    const totalGeral = [...porObra.values()].reduce((s, x) => s + x, 0) || 1
    const top5 = [...porObra.values()].sort((a, b) => b - a).slice(0, 5).reduce((s, x) => s + x, 0)
    const polos = [...porPolo.entries()].sort((a, b) => b[1] - a[1])
    const meses = [...mesesSet].sort()
    return { topObras, totalObras: porObra.size, totalGeral, concentr5: Math.round(top5 / totalGeral * 100), polos, poloMes, meses, teg, sub }
  }, [rows, oscMap, de, ateF])

  // por pacote/seção da EAP — REAL (tabela pmo_medicao_secao), no período
  const pacAgg = useMemo(() => {
    const pacMes = new Map<string, Map<string, number>>(); const porPac = new Map<string, number>(); const mset = new Set<string>()
    for (const r of (secaoRows ?? [])) {
      const v = Number(r.realizado ?? 0); const c = r.competencia
      if (v <= 0 || c < de || c > ateF) continue
      const pac = SECAO_TO_EAP[r.pacote] ?? 'Outros'
      porPac.set(pac, (porPac.get(pac) ?? 0) + v)
      let pm = pacMes.get(pac); if (!pm) { pm = new Map(); pacMes.set(pac, pm) }
      pm.set(c, (pm.get(c) ?? 0) + v); mset.add(c)
    }
    const ord = (n: string) => { const i = PAC_ORD.indexOf(n); return i < 0 ? 99 : i }
    const pacotes = [...porPac.entries()].sort((a, b) => ord(a[0]) - ord(b[0]) || b[1] - a[1])
    return { pacotes, pacMes, meses: [...mset].sort() }
  }, [secaoRows, de, ateF])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  const ativos = serie.filter(s => s.fat > 0)
  const total = serie.reduce((s, x) => s + x.fat, 0)
  const media = ativos.length ? total / ativos.length : 0
  const melhor = serie.reduce((b, x) => x.fat > b.fat ? x : b, { ym: '', fat: 0, oscs: 0 })
  const max = Math.max(...serie.map(s => s.fat), 1)
  // escala de cor por desvio da média (acima = verde, abaixo = âmbar/laranja)
  const barColor = (v: number) => {
    if (v <= 0) return 'transparent'
    const r = media ? v / media : 1
    if (r >= 1.25) return '#047857'
    if (r >= 1.0) return '#10b981'
    if (r >= 0.75) return '#f59e0b'
    return '#f97316'
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label={`${noun} no período`} value={fmtM(total)} tone="emerald" isDark={isDark} note={`${ativos.length} mes(es)`} />
        <Kpi label="Média mensal" value={fmtM(media)} tone="violet" isDark={isDark} note="meses com medição" />
        <Kpi label="Melhor mês" value={fmtM(melhor.fat)} tone="sky" isDark={isDark} note={melhor.ym ? ymLabel(melhor.ym) : '—'} />
        <Kpi label="Run-rate anual" value={fmtM(media * 12)} tone="amber" isDark={isDark} note="média × 12" />
      </div>

      <PanelCard title={`${noun} mensal (medições consolidadas)`} icon={<TrendingUp size={14} className="text-teal-500" />} isDark={isDark}
        right={<div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#10b981' }} /><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>≥ média</span></span>
          <span className="flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#f59e0b' }} /><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>&lt; média</span></span>
        </div>}>
        <div className="flex items-end gap-1.5 pt-7 relative" style={{ height: 250 }}>
          {media > 0 && (
            <div className="absolute left-0 right-0 pointer-events-none flex items-center" style={{ bottom: `${(media / max) * (250 - 28) + 4}px` }}>
              <div className={`flex-1 border-t border-dashed ${isDark ? 'border-white/25' : 'border-slate-300'}`} />
              <span className={`text-[9px] font-semibold pl-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>média {fmtM(media)}</span>
            </div>
          )}
          {serie.map((s, i) => (
            <div key={s.ym} className="flex-1 flex flex-col items-center justify-end h-full relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && s.fat > 0 && (
                <div className={`absolute -top-1 z-30 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap ${i <= 1 ? 'left-0' : i >= serie.length - 2 ? 'right-0' : 'left-1/2 -translate-x-1/2'} ${isDark ? 'bg-slate-800 border border-white/10' : 'bg-white border border-slate-200'}`}>
                  <p className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{ymLabel(s.ym)}</p>
                  <p className={`text-[11px] font-bold`} style={{ color: barColor(s.fat) }}>{fmtFull(s.fat)}</p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.oscs} OSCs · {media ? Math.round(s.fat / media * 100) : 0}% da média</p>
                </div>
              )}
              <span className={`text-[13px] font-extrabold mb-1 tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.fat > 0 ? (s.fat / 1e6).toFixed(1) : ''}</span>
              <div className={`w-full rounded-t transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : ''}`} style={{ height: `${(s.fat / max) * 100}%`, minHeight: s.fat > 0 ? 2 : 0, background: barColor(s.fat) }} />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {serie.map(s => <span key={s.ym} className={`flex-1 text-center text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ymLabel(s.ym)}</span>)}
        </div>
        <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Valores em R$ milhões. {isProd ? 'Produção = medição deslocada 1 mês (mês de execução).' : 'Faturamento = soma das medições realizadas no mês.'}</p>
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top obras faturadas */}
        <PanelCard title="Top obras faturadas" icon={<Building2 size={14} className="text-teal-500" />} isDark={isDark}
          right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>top 5 = {agg.concentr5}% do total</span>}>
          <div className="space-y-2.5">
            {agg.topObras.length === 0 ? <p className={`text-xs italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados no período.</p>
              : agg.topObras.map(([nome, val], i) => <HBarRow key={nome} label={nome} value={val} max={agg.topObras[0][1]} color={POLO_COR[i % POLO_COR.length]} suffix={fmtM(val)} isDark={isDark} />)}
          </div>
        </PanelCard>

        {/* Composição por frente */}
        <PanelCard title="Composição por frente" icon={<PieChart size={14} className="text-teal-500" />} isDark={isDark}>
          <div className="flex h-9 rounded-lg overflow-hidden mb-3">
            {agg.polos.map(([nome, val], i) => { const pct = val / agg.totalGeral * 100; if (pct <= 0) return null; return (
              <div key={nome} style={{ width: `${pct}%`, background: POLO_COR[i % POLO_COR.length] }} className="flex items-center justify-center" title={`${nome}: ${fmtM(val)} (${pct.toFixed(0)}%)`}>
                {pct >= 8 && <span className="text-[10px] font-bold text-white truncate px-1">{Math.round(pct)}%</span>}
              </div>
            ) })}
          </div>
          <div className="space-y-1.5">
            {agg.polos.map(([nome, val], i) => (
              <div key={nome} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: POLO_COR[i % POLO_COR.length] }} />
                <span className={`flex-1 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{nome}</span>
                <span className={`tabular-nums font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtM(val)}</span>
                <span className={`w-9 text-right tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round(val / agg.totalGeral * 100)}%</span>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {/* Heatmaps lado a lado: por Polo + por frente (EAP) */}
      {agg.meses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {agg.polos.length > 0 && (
            <PanelCard title="Faturamento por Polo" icon={<Grid3x3 size={14} className="text-teal-500" />} isDark={isDark}
              right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$ milhões</span>} pad={false} bodyClassName="p-4 overflow-x-auto">
              <Heatmap
                meses={agg.meses.map(ym => ({ mes: MES_ABR[Number(ym.split('-')[1])], ano: ym.split('-')[0].slice(2) }))}
                linhas={agg.polos.map(([nome, val], i) => ({
                  label: nome, color: POLO_COR[i % POLO_COR.length],
                  valores: agg.meses.map(m => { const v = agg.poloMes.get(nome)?.get(m) ?? 0; return v ? Math.round(v / 1e5) / 10 : 0 }),
                  total: Math.round(val / 1e5) / 10,
                }))}
                totalMes={agg.meses.map(m => { let s = 0; for (const [nome] of agg.polos) s += agg.poloMes.get(nome)?.get(m) ?? 0; return Math.round(s / 1e5) / 10 })}
                isDark={isDark}
              />
            </PanelCard>
          )}
          {pacAgg.pacotes.length > 0 && (
            <PanelCard title="Faturamento por frente (EAP)" icon={<Grid3x3 size={14} className="text-teal-500" />} isDark={isDark}
              right={<span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>R$ milhões</span>} pad={false} bodyClassName="p-4 overflow-x-auto">
              <Heatmap
                meses={agg.meses.map(ym => ({ mes: MES_ABR[Number(ym.split('-')[1])], ano: ym.split('-')[0].slice(2) }))}
                linhas={pacAgg.pacotes.map(([nome, val]) => ({
                  label: nome, color: PAC_COR[nome] ?? '#475569',
                  valores: agg.meses.map(m => { const v = pacAgg.pacMes.get(nome)?.get(m) ?? 0; return v ? Math.round(v / 1e5) / 10 : 0 }),
                  total: Math.round(val / 1e5) / 10,
                }))}
                totalMes={agg.meses.map(m => { let s = 0; for (const [nome] of pacAgg.pacotes) s += pacAgg.pacMes.get(nome)?.get(m) ?? 0; return Math.round(s / 1e5) / 10 })}
                isDark={isDark}
              />
            </PanelCard>
          )}
        </div>
      )}

      {/* TEG × Subcontratadas */}
      {agg.sub > 0 && (() => {
        const tot = agg.teg + agg.sub || 1
        const pSub = Math.round(agg.sub / tot * 100)
        return (
          <PanelCard title="Execução: TEG × Subcontratadas" icon={<Users size={14} className="text-teal-500" />} isDark={isDark}>
            <div className="flex h-9 rounded-lg overflow-hidden mb-2">
              <div style={{ width: `${100 - pSub}%`, background: '#0d9488' }} className="flex items-center justify-center"><span className="text-[11px] font-bold text-white px-1">TEG {100 - pSub}%</span></div>
              <div style={{ width: `${pSub}%`, background: '#e87b2a' }} className="flex items-center justify-center">{pSub >= 8 && <span className="text-[11px] font-bold text-white px-1">Sub {pSub}%</span>}</div>
            </div>
            <div className="flex justify-between text-xs">
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}><span className="font-bold text-teal-500">TEG própria:</span> {fmtFull(agg.teg)}</span>
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}><span className="font-bold text-orange-500">Subcontratadas:</span> {fmtFull(agg.sub)}</span>
            </div>
          </PanelCard>
        )
      })()}
    </div>
  )
}
