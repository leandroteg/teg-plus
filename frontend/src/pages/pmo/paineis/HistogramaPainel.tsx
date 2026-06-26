// Painel Histograma — recursos (mão de obra + máquinas) mês a mês.
// Fonte "Efetivo real": pessoas vindas do RH (rh_colaboradores) e máquinas da frota (fro_veiculos),
// por frente, alimentando o plano (engine do cronograma define QUANDO cada fase roda; o efetivo real
// define QUANTAS pessoas/máquinas). Grupos: Fundação e "Montagem e Lançamento" (equipe única).
// Fonte "Plano": usa a equipe configurada numa versão do cronograma.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, HardHat, ChevronDown, Filter, Info } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useEfetivoReal } from '../../../hooks/useEfetivoReal'
import { supabase } from '../../../services/supabase'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import {
  ymLabel, shiftYM, startYM, buildTree, makeDefaultConfig, projObra, equipeFromEfetivo,
  type Obra, type Config, type Versao,
} from './cronogramaEngine'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const fmtN = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))
// 2 grupos de recurso (Montagem e Lançamento = equipe única)
const GRUPOS = [
  { key: 'fund', label: 'Fundação', cor: '#92400e', drivers: ['Fundação'] },
  { key: 'ml', label: 'Montagem e Lançamento', cor: '#374151', drivers: ['Montagem', 'Lançamento'] },
] as const

export default function HistogramaPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const { data: efetivo } = useEfetivoReal(portfolioId)
  const [fonte, setFonte] = useState<'real' | 'plano'>('real')
  const [recurso, setRecurso] = useState<'pessoas' | 'maquinas'>('pessoas')
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [verId, setVerId] = useState<string | null>(null)
  const [openF, setOpenF] = useState(false)

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

  // config a partir do efetivo REAL: distribui o efetivo de cada frente entre suas obras ∝ saldo.
  // ML (Montagem+Lançamento) é equipe única → mesma alocação nos dois drivers (precedência sequencia).
  const realCfg = useMemo<Config>(() => ({
    prodPP: defaultConfig.prodPP, horizonte: 12, precedencia: true, lag: 0,
    equipe: equipeFromEfetivo(tree, efetivo?.porFrente ?? {}, false), // fracionado p/ preservar o total
  }), [tree, efetivo, defaultConfig])

  const start = startYM()
  const hist = useMemo(() => {
    const cfg = fonte === 'real' ? realCfg : planoCfg
    const frentes = fFrente.size ? tree.filter(f => fFrente.has(f.label)) : tree
    const pjMap = new Map<Obra, ReturnType<typeof projObra>>()
    let H = 0
    for (const fr of frentes) for (const o of fr.obras) { const pj = projObra(o, cfg, start); pjMap.set(o, pj); H = Math.max(H, pj.maxMeses) }
    // pessoas por grupo/mês
    const pplFund = new Array(H).fill(0), pplML = new Array(H).fill(0)
    // máquinas por grupo/mês (frota real, alocada nos meses em que a fase roda)
    const maqFund = new Array(H).fill(0), maqML = new Array(H).fill(0)
    for (const fr of frentes) {
      const ef = efetivo?.porFrente[fr.label]
      const fundAtivo = new Array(H).fill(false), mlAtivo = new Array(H).fill(false)
      for (const o of fr.obras) {
        const pj = pjMap.get(o)!; const eq = cfg.equipe[o.nome] ?? {}
        const fundRow = pj.rows.find(r => r.d.label === 'Fundação')
        const montRow = pj.rows.find(r => r.d.label === 'Montagem')
        const lancRow = pj.rows.find(r => r.d.label === 'Lançamento')
        const mlTeam = eq['Montagem'] ?? eq['Lançamento'] ?? 0
        for (let m = 0; m < pj.maxMeses; m++) {
          if (fundRow && (fundRow.qty[m] || 0) > 0.001) { pplFund[m] += fundRow.pessoas[m] || 0; fundAtivo[m] = true }
          const mlOn = (montRow && (montRow.qty[m] || 0) > 0.001) || (lancRow && (lancRow.qty[m] || 0) > 0.001)
          if (mlOn) { pplML[m] += mlTeam; mlAtivo[m] = true }
        }
      }
      if (ef) for (let m = 0; m < H; m++) { if (fundAtivo[m]) maqFund[m] += ef.maqFund; if (mlAtivo[m]) maqML[m] += ef.maqML }
    }
    // trim trailing zeros
    const peopleTot = (m: number) => pplFund[m] + pplML[m]
    let last = -1; for (let m = 0; m < H; m++) if (peopleTot(m) > 0.001 || maqFund[m] + maqML[m] > 0) last = m
    const len = last + 1
    const meses = Array.from({ length: len }, (_, m) => shiftYM(start, m))
    const ppl = { fund: pplFund.slice(0, len), ml: pplML.slice(0, len) }
    const maq = { fund: maqFund.slice(0, len), ml: maqML.slice(0, len) }
    const ds = recurso === 'pessoas' ? ppl : maq
    const data: Record<string, number[]> = { fund: ds.fund, ml: ds.ml }
    const totMes = meses.map((_, m) => data.fund[m] + data.ml[m])
    const peak = Math.max(1, ...totMes)
    const peakMes = totMes.indexOf(Math.max(0, ...totMes))
    const totGeral = totMes.reduce((s, x) => s + x, 0)
    const totPplMes = meses.map((_, m) => ppl.fund[m] + ppl.ml[m])
    const totMaqMes = meses.map((_, m) => maq.fund[m] + maq.ml[m])
    const picoPpl = Math.max(0, ...totPplMes), picoMaq = Math.max(0, ...totMaqMes)
    return { meses, data, totMes, peak, peakMes, totGeral, picoPpl, picoMaq, picoPplMes: totPplMes.indexOf(picoPpl), picoMaqMes: totMaqMes.indexOf(picoMaq) }
  }, [tree, fFrente, fonte, realCfg, planoCfg, efetivo, start, recurso])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const H_BAR = 180
  const uniRec = recurso === 'pessoas' ? 'pessoas' : 'máquinas'
  const totReal = efetivo?.total

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={`inline-flex rounded-xl border overflow-hidden text-[12px] ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {([['real', 'Efetivo real'], ['plano', 'Plano']] as const).map(([f, lb]) => (
            <button key={f} onClick={() => setFonte(f)} className={`px-3 py-1.5 font-semibold ${fonte === f ? 'bg-teal-600 text-white' : (isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-50')}`}>{lb}</button>
          ))}
        </div>
        <div className={`inline-flex rounded-xl border overflow-hidden text-[12px] ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          {(['pessoas', 'maquinas'] as const).map(r => (
            <button key={r} onClick={() => setRecurso(r)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold ${recurso === r ? 'bg-teal-600 text-white' : (isDark ? 'text-slate-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-50')}`}>
              {r === 'pessoas' ? <Users size={14} /> : <HardHat size={14} />}{r === 'pessoas' ? 'Mão de obra' : 'Máquinas'}
            </button>
          ))}
        </div>
        {/* filtro frente */}
        <div className="relative">
          <button onClick={() => setOpenF(o => !o)} className={`inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-semibold min-w-[150px] ${fFrente.size ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}>
            <Filter size={12} className="opacity-70" /><span className="opacity-70">Frente</span><span className="flex-1 text-left truncate">{fFrente.size === 0 ? 'todas' : `${fFrente.size} selec.`}</span><ChevronDown size={12} className={`shrink-0 transition ${openF ? 'rotate-180' : ''}`} />
          </button>
          {openF && (<><div className="fixed inset-0 z-20" onClick={() => setOpenF(false)} />
            <div className={`absolute left-0 z-30 mt-1.5 min-w-full w-max max-w-[320px] max-h-72 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
              {fFrente.size > 0 && <button onClick={() => setFFrente(new Set())} className="w-full text-left px-2 py-1 mb-0.5 text-[10px] font-semibold text-slate-400">× limpar</button>}
              {tree.map(f => { const on = fFrente.has(f.label); return (
                <button key={f.label} onClick={() => setFFrente(s => { const n = new Set(s); n.has(f.label) ? n.delete(f.label) : n.add(f.label); return n })} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
                  <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${on ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{on && '✓'}</span>
                  <span className={`truncate ${on ? 'font-semibold' : ''} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{f.label}</span>
                </button>) })}
            </div></>)}
        </div>
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
        <Kpi label={fonte === 'real' ? 'Efetivo real (RH)' : `Total ${uniRec}·mês`} value={fonte === 'real' && totReal ? `${totReal.fundacao + totReal.montlanc} pessoas` : fmtN(hist.totGeral)} tone="violet" isDark={isDark} note={fonte === 'real' && totReal ? `${totReal.maqFund + totReal.maqML} máquinas` : 'soma do horizonte'} />
        <Kpi label="Horizonte" value={`${hist.meses.length} mes(es)`} tone="sky" isDark={isDark} note={hist.meses.length ? `${ymLabel(hist.meses[0])} → ${ymLabel(hist.meses[hist.meses.length - 1])}` : '—'} />
      </div>

      {/* aviso de cobertura (honestidade) */}
      {fonte === 'real' && efetivo && (efetivo.semFrente.fundacao + efetivo.semFrente.montlanc > 0) && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <Info size={14} className="shrink-0 mt-0.5" />
          <span><b>{efetivo.semFrente.fundacao + efetivo.semFrente.montlanc} pessoas</b> em bases sem frente correspondente ({efetivo.semFrente.bases.join(', ') || '—'}) não entram no histograma. Frentes sem base no RH aparecem zeradas.</span>
        </div>
      )}

      {/* Histograma */}
      <PanelCard title={`Histograma de ${recurso === 'pessoas' ? 'mão de obra' : 'máquinas'} — mês a mês`} icon={recurso === 'pessoas' ? <Users size={14} className="text-teal-500" /> : <HardHat size={14} className="text-teal-500" />} isDark={isDark}
        right={<div className="flex items-center gap-3">{GRUPOS.map(g => <span key={g.key} className="inline-flex items-center gap-1 text-[10px]"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.cor }} />{g.label}</span>)}</div>}>
        {hist.meses.length === 0 ? <p className="text-center py-8 text-sm text-slate-400">Sem recursos no horizonte {fonte === 'real' ? '(verifique se há efetivo no RH para as frentes filtradas)' : ''}.</p> : (
          <div className="overflow-x-auto pb-1">
            <div className="flex items-end gap-1.5" style={{ minWidth: hist.meses.length * 52 }}>
              {hist.meses.map((m, i) => {
                const tot = hist.totMes[i]
                return (
                  <div key={m} className="flex-1 min-w-[44px] flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tot > 0 ? Math.round(tot) : ''}</span>
                    <div className="w-full flex flex-col-reverse rounded-t overflow-hidden" style={{ height: H_BAR }}>
                      {GRUPOS.map(g => { const v = hist.data[g.key][i]; return v > 0 ? <div key={g.key} style={{ height: v / hist.peak * H_BAR, background: g.cor }} title={`${g.label}: ${Math.round(v)} ${uniRec} · ${ymLabel(m)}`} /> : null })}
                    </div>
                    <span className={`text-[9px] whitespace-nowrap ${i === hist.peakMes ? 'font-bold text-teal-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{ymLabel(m)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </PanelCard>

      {/* Tabela */}
      {hist.meses.length > 0 && (
        <PanelCard title={`${recurso === 'pessoas' ? 'Mão de obra' : 'Máquinas'} por grupo e mês`} isDark={isDark} pad={false} bodyClassName="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <th className={`sticky left-0 px-3 py-1.5 text-left text-[10px] font-semibold ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'}`}>Grupo</th>
              {hist.meses.map(m => <th key={m} className={`px-2 py-1.5 text-right text-[10px] font-semibold whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ymLabel(m)}</th>)}
              <th className={`px-2 py-1.5 text-right text-[10px] font-semibold pr-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pico</th>
            </tr></thead>
            <tbody>
              {GRUPOS.map(g => { const arr = hist.data[g.key]; const pico = Math.max(0, ...arr); return (
                <tr key={g.key} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className={`sticky left-0 px-3 py-1 text-left text-[11px] font-medium ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-700'}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: g.cor }} />{g.label}</td>
                  {arr.map((v, i) => <td key={i} className={`px-2 py-1 text-right text-[11px] tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{v > 0 ? Math.round(v) : <span className="text-slate-400">·</span>}</td>)}
                  <td className={`px-2 py-1 text-right text-[11px] tabular-nums font-semibold pr-3`}>{Math.round(pico)}</td>
                </tr>
              ) })}
              <tr className={`border-t-2 ${isDark ? 'border-slate-600' : 'border-slate-300'} font-bold`}>
                <td className={`sticky left-0 px-3 py-1.5 text-left text-[11px] ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>Total {uniRec}</td>
                {hist.totMes.map((v, i) => <td key={i} className={`px-2 py-1 text-right text-[11px] tabular-nums font-bold ${i === hist.peakMes ? 'text-teal-500' : ''}`}>{Math.round(v)}</td>)}
                <td className={`px-2 py-1 text-right text-[11px] tabular-nums font-bold pr-3`}>{Math.round(hist.peak)}</td>
              </tr>
            </tbody>
          </table>
        </PanelCard>
      )}
    </div>
  )
}
