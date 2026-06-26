// Painel Histograma — matriz de recursos (Polo → Recurso × Mês). Pessoas (RH) + máquinas (frota).
// Fonte "Efetivo real": pessoas vindas do RH e máquinas da frota, por frente, alimentando o plano
// (a engine do cronograma define QUANDO cada fase roda; o efetivo real define QUANTAS pessoas/máquinas).
// Fonte "Plano": usa a equipe de uma versão do cronograma. Montagem+Lançamento = equipe única.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Info } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useEfetivoReal } from '../../../hooks/useEfetivoReal'
import { supabase } from '../../../services/supabase'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import {
  ymLabel, shiftYM, startYM, buildTree, makeDefaultConfig, projObra, equipeFromEfetivo,
  type Obra, type Config, type Versao,
} from './cronogramaEngine'
import { useFiltrosTree, FiltrosFrenteObra, filtrarTree } from './egpFiltros'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
// recursos (linhas da matriz): 2 de mão de obra + 2 de máquinas
const RES = [
  { key: 'fundP', label: 'Fundação — equipe', cor: '#16a34a', tipo: 'Mão de obra' },
  { key: 'mlP', label: 'Montagem e Lançamento — equipe', cor: '#7c3aed', tipo: 'Mão de obra' },
  { key: 'maqF', label: 'Máquinas Fundação', cor: '#f59e0b', tipo: 'Máquinas' },
  { key: 'maqM', label: 'Guindauto (Mont/Lanç)', cor: '#2563eb', tipo: 'Máquinas' },
] as const
type ResKey = typeof RES[number]['key']
const MES_ABR = ['', 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const mAbr = (ym: string) => MES_ABR[+ym.split('-')[1]]

export default function HistogramaPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const { data: efetivo } = useEfetivoReal(portfolioId)
  const [fonte, setFonte] = useState<'real' | 'plano'>('real')
  const [verId, setVerId] = useState<string | null>(null)
  const flt = useFiltrosTree()

  const tree = useMemo(() => buildTree(raw), [raw])
  const allObras = useMemo(() => tree.flatMap(f => f.obras), [tree])
  const defaultConfig = useMemo<Config>(() => makeDefaultConfig(allObras), [allObras])

  const { data: versoes = [] } = useQuery<Versao[]>({
    queryKey: ['crono-versoes', portfolioId],
    queryFn: async () => { const { data } = await supabase.from('pmo_cronograma_versao').select('id, nome, config, updated_at').eq('portfolio_id', portfolioId).order('updated_at', { ascending: false }); return (data ?? []) as Versao[] },
  })
  const planoCfg = useMemo<Config>(() => {
    const v = versoes.find(x => x.id === verId); if (!v) return defaultConfig
    const c = v.config as Partial<Config>
    return { prodPP: c.prodPP ?? defaultConfig.prodPP, equipe: c.equipe ?? defaultConfig.equipe, horizonte: c.horizonte ?? 12, precedencia: c.precedencia, lag: c.lag }
  }, [versoes, verId, defaultConfig])
  const realCfg = useMemo<Config>(() => ({
    prodPP: defaultConfig.prodPP, horizonte: 12, precedencia: true, lag: 0,
    equipe: equipeFromEfetivo(tree, efetivo?.porFrente ?? {}, false),
  }), [tree, efetivo, defaultConfig])

  const start = startYM()
  const hist = useMemo(() => {
    const cfg = fonte === 'real' ? realCfg : planoCfg
    const frentesSel = filtrarTree(tree, flt)
    const pjMap = new Map<Obra, ReturnType<typeof projObra>>()
    let H = 0
    for (const fr of frentesSel) for (const o of fr.obras) { const pj = projObra(o, cfg, start); pjMap.set(o, pj); H = Math.max(H, pj.maxMeses) }
    const zero = () => ({ fundP: new Array(H).fill(0), mlP: new Array(H).fill(0), maqF: new Array(H).fill(0), maqM: new Array(H).fill(0) } as Record<ResKey, number[]>)
    const perFrente = frentesSel.map(fr => {
      const ef = efetivo?.porFrente[fr.label]
      const d = zero(); const fundAt = new Array(H).fill(false), mlAt = new Array(H).fill(false)
      for (const o of fr.obras) {
        const pj = pjMap.get(o)!; const eq = cfg.equipe[o.nome] ?? {}
        const fundRow = pj.rows.find(r => r.d.label === 'Fundação')
        const montRow = pj.rows.find(r => r.d.label === 'Montagem')
        const lancRow = pj.rows.find(r => r.d.label === 'Lançamento')
        const mlTeam = eq['Montagem'] ?? eq['Lançamento'] ?? 0
        for (let m = 0; m < pj.maxMeses; m++) {
          if (fundRow && (fundRow.qty[m] || 0) > 0.001) { d.fundP[m] += fundRow.pessoas[m] || 0; fundAt[m] = true }
          const mlOn = (montRow && (montRow.qty[m] || 0) > 0.001) || (lancRow && (lancRow.qty[m] || 0) > 0.001)
          if (mlOn) { d.mlP[m] += mlTeam; mlAt[m] = true }
        }
      }
      if (ef) for (let m = 0; m < H; m++) { if (fundAt[m]) d.maqF[m] += ef.maqFund; if (mlAt[m]) d.maqM[m] += ef.maqML }
      return { label: fr.label, d }
    })
    const anyAt = (m: number) => perFrente.some(f => RES.some(r => f.d[r.key][m] > 0.001))
    let last = -1; for (let m = 0; m < H; m++) if (anyAt(m)) last = m
    const len = last + 1
    const meses = Array.from({ length: len }, (_, m) => shiftYM(start, m))
    const totals = zero(); for (const k of RES.map(r => r.key)) totals[k] = totals[k].slice(0, len)
    perFrente.forEach(f => { for (const r of RES) f.d[r.key] = f.d[r.key].slice(0, len) })
    for (const f of perFrente) for (const r of RES) for (let m = 0; m < len; m++) totals[r.key][m] += f.d[r.key][m]
    const frentesF = perFrente.filter(f => RES.some(r => f.d[r.key].some(v => v > 0.001)))
    // KPIs
    const totPpl = meses.map((_, m) => totals.fundP[m] + totals.mlP[m])
    const totMaq = meses.map((_, m) => totals.maqF[m] + totals.maqM[m])
    const picoPpl = Math.max(0, ...totPpl), picoMaq = Math.max(0, ...totMaq)
    return { meses, frentes: frentesF, totals, picoPpl, picoMaq, picoPplMes: totPpl.indexOf(picoPpl), picoMaqMes: totMaq.indexOf(picoMaq) }
  }, [tree, flt.fFrente, flt.fObra, flt.fPct, fonte, realCfg, planoCfg, efetivo, start])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const totReal = efetivo?.total
  const W_LABEL = 240, W_MES = 56
  const tableW = W_LABEL + hist.meses.length * W_MES
  const cell = (v: number, cor: string) => v > 0.001
    ? <span className="inline-flex items-center justify-center min-w-[30px] h-7 px-1.5 rounded-md text-[11px] font-bold tabular-nums" style={{ background: cor + (isDark ? '2e' : '22'), color: cor }}>{Math.round(v)}</span>
    : <span className="text-slate-300">·</span>
  // anos para o cabeçalho agrupado
  const anos: { ano: string; n: number }[] = []
  hist.meses.forEach(m => { const y = m.slice(0, 4); const lastA = anos[anos.length - 1]; if (lastA && lastA.ano === y) lastA.n++; else anos.push({ ano: y, n: 1 }) })

  const ResRows = ({ d, prefix }: { d: Record<ResKey, number[]>; prefix?: string }) => (
    <>{RES.map(r => (
      <tr key={(prefix ?? '') + r.key} className={`border-b ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`}>
        <td className={`sticky left-0 z-10 px-3 py-1.5 text-left text-[12px] whitespace-nowrap ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: r.cor }} />
          <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{r.label}</span>
        </td>
        {d[r.key].map((v, i) => <td key={i} className="px-1 py-1 text-center">{cell(v, r.cor)}</td>)}
      </tr>
    ))}</>
  )

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`inline-flex rounded-xl border overflow-hidden text-[12px] ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {([['real', 'Efetivo real'], ['plano', 'Plano']] as const).map(([f, lb]) => (
            <button key={f} onClick={() => setFonte(f)} className={`px-3 py-1.5 font-semibold ${fonte === f ? 'bg-teal-600 text-white' : (isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-50')}`}>{lb}</button>
          ))}
        </div>
        <FiltrosFrenteObra tree={tree} f={flt} isDark={isDark} />
        {fonte === 'plano' && versoes.length > 0 && (
          <select value={verId ?? ''} onChange={e => setVerId(e.target.value || null)} className={`text-[12px] font-semibold rounded-xl border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
            <option value="">Plano padrão</option>
            {versoes.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fonte === 'real' ? 'pessoas: RH · máquinas: frota' : 'equipe do plano · máquinas: frota'}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Pico de mão de obra" value={`${Math.round(hist.picoPpl)}`} tone="teal" isDark={isDark} note={hist.meses[hist.picoPplMes] ? ymLabel(hist.meses[hist.picoPplMes]) : '—'} />
        <Kpi label="Pico de máquinas" value={`${Math.round(hist.picoMaq)}`} tone="amber" isDark={isDark} note={hist.meses[hist.picoMaqMes] ? ymLabel(hist.meses[hist.picoMaqMes]) : '—'} />
        <Kpi label="Efetivo real (RH)" value={totReal ? `${totReal.fundacao + totReal.montlanc} pessoas` : '—'} tone="violet" isDark={isDark} note={totReal ? `${totReal.maqFund + totReal.maqML} máquinas (frota)` : '—'} />
        <Kpi label="Horizonte" value={`${hist.meses.length} mes(es)`} tone="sky" isDark={isDark} note={hist.meses.length ? `${ymLabel(hist.meses[0])} → ${ymLabel(hist.meses[hist.meses.length - 1])}` : '—'} />
      </div>

      {/* aviso de cobertura */}
      {fonte === 'real' && efetivo && (efetivo.semFrente.fundacao + efetivo.semFrente.montlanc > 0) && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <Info size={14} className="shrink-0 mt-0.5" />
          <span><b>{efetivo.semFrente.fundacao + efetivo.semFrente.montlanc} pessoas</b> em bases sem frente ({efetivo.semFrente.bases.join(', ') || '—'}) não entram. Frentes sem base no RH ficam zeradas — use <b>Cronograma → Configurar → Efetivo real (RH)</b> e ajuste manualmente.</span>
        </div>
      )}

      {/* Matriz Polo / Recurso × Mês */}
      <PanelCard title="Histograma de recursos — Polo / Recurso × Mês" icon={<Users size={14} className="text-teal-500" />} isDark={isDark} pad={false} bodyClassName="overflow-x-auto">
        {hist.meses.length === 0 ? <p className="text-center py-8 text-sm text-slate-400">Sem recursos no horizonte{fonte === 'real' ? ' (verifique o efetivo no RH das frentes filtradas)' : ''}.</p> : (
          <table className="border-collapse" style={{ width: tableW }}>
            <thead>
              <tr className={isDark ? 'bg-slate-800' : 'bg-slate-100'}>
                <th className={`sticky left-0 z-10 px-3 py-2 text-left text-[12px] font-bold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`} style={{ width: W_LABEL }}>Polo / Recurso</th>
                {anos.map(a => <th key={a.ano} colSpan={a.n} className={`px-2 py-2 text-center text-[12px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.ano}</th>)}
              </tr>
              <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <th className={`sticky left-0 z-10 ${isDark ? 'bg-slate-900' : 'bg-white'}`} />
                {hist.meses.map(m => <th key={m} className={`px-1 py-1.5 text-center text-[10px] font-semibold ${m === hist.meses[hist.picoPplMes] ? 'text-teal-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ width: W_MES }}>{mAbr(m)}</th>)}
              </tr>
            </thead>
            <tbody>
              {hist.frentes.map((fr, fi) => (
                <FrenteBloco key={fr.label} label={fr.label} fi={fi} d={fr.d} isDark={isDark} ResRows={ResRows} nMeses={hist.meses.length} />
              ))}
              {/* Total geral */}
              <tr className={isDark ? 'bg-slate-800/80' : 'bg-slate-100'}>
                <td className={`sticky left-0 z-10 px-3 py-1.5 text-left text-[12px] font-bold ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`} colSpan={1}>TOTAL GERAL</td>
                <td colSpan={hist.meses.length} className={isDark ? 'bg-slate-800/80' : 'bg-slate-100'} />
              </tr>
              <ResRows d={hist.totals} prefix="tot" />
            </tbody>
          </table>
        )}
      </PanelCard>
    </div>
  )
}

function FrenteBloco({ label, fi, d, isDark, ResRows, nMeses }: { label: string; fi: number; d: Record<ResKey, number[]>; isDark: boolean; ResRows: (p: { d: Record<ResKey, number[]>; prefix?: string }) => JSX.Element; nMeses: number }) {
  const cores = ['#3b82f6', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  return (
    <>
      <tr className={isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}>
        <td className={`sticky left-0 z-10 px-3 py-1.5 text-left text-[12px] font-bold ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`}>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: cores[fi % cores.length] }} />
          {`P${String(fi + 1).padStart(2, '0')} — `}<span className="uppercase">{label}</span>
        </td>
        <td colSpan={nMeses} className={isDark ? 'bg-white/[0.04]' : 'bg-slate-50'} />
      </tr>
      <ResRows d={d} prefix={label} />
    </>
  )
}
