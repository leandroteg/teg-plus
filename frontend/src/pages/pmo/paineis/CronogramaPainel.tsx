// Painel Cronograma — modal de config (produtividade total + alocação por obra) → Aplicar gera; versões salvas
import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Filter, ChevronDown, ChevronRight, Check, Flag, Settings2, Save, Trash2, X, Sparkles, Gauge, Eye, EyeOff, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useEfetivoReal, useEquipeObrasReal, type EquipeObrasReal } from '../../../hooks/useEfetivoReal'
import { supabase } from '../../../services/supabase'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import {
  DRV, COR_PREL, COR_ADM, COR_OUTROS, ymLabel, shiftYM, startYM, fmtM, fmtQ, ritmoCor, prazoCor, worstCor,
  buildTree, makeDefaultConfig, projObra, projTodas, equipeFromEfetivo, type Obra, type Frente, type Config, type Versao,
} from './cronogramaEngine'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const PROD_BANDS: [string, string, (p: number) => boolean][] = [
  ['0', '0%', p => p === 0], ['1-25', '1–25%', p => p >= 1 && p <= 25], ['26-50', '26–50%', p => p >= 26 && p <= 50], ['51-75', '51–75%', p => p >= 51 && p <= 75], ['75-85', '75–85%', p => p > 75 && p <= 85], ['85-95', '85–95%', p => p > 85 && p <= 95], ['95+', '>95%', p => p > 95],
]
function Dots({ ritmo, prazo }: { ritmo: string; prazo: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: ritmo }} title="Produtividade (físico × prazo decorrido)" />
      <span className="w-2.5 h-2.5 rounded-full ring-1 ring-inset ring-black/10" style={{ background: prazo }} title="Prazo (término previsto × vencimento)" />
    </span>
  )
}

function MultiSelect({ label, icon, options, selected, onToggle, onClear, isDark }: { label: string; icon?: ReactNode; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void; onClear: () => void; isDark: boolean }) {
  const [open, setOpen] = useState(false); const n = selected.size
  const resumo = n === 0 ? 'todas' : n === 1 ? (options.find(o => selected.has(o.value))?.label ?? `${n}`) : `${n} selecionadas`
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border text-[11px] font-semibold transition min-w-[160px] ${n > 0 ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}>
        {icon}<span className="opacity-70">{label}</span><span className="flex-1 text-left truncate">{resumo}</span><ChevronDown size={12} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (<><div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <div className={`absolute left-0 z-30 mt-1.5 min-w-full w-max max-w-[300px] max-h-72 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
          {options.length === 0 && <p className="px-2 py-1.5 text-[11px] text-slate-400">—</p>}
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
  const qc = useQueryClient()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const { data: efetivo } = useEfetivoReal(portfolioId)
  const { data: equipeObras, isLoading: equipeLoading } = useEquipeObrasReal()
  const [fFrente, setFFrente] = useState<Set<string>>(new Set())
  const [fObra, setFObra] = useState<Set<string>>(new Set())
  const [fPct, setFPct] = useState<Set<string>>(new Set()) // todos os % físicos visíveis por padrão
  const [hideOM, setHideOM] = useState(true) // O&M (manutenção) oculto por padrão
  const [hideSemProd, setHideSemProd] = useState(true) // obras sem produção projetada no período ocultas por padrão
  const [qObra, setQObra] = useState('') // busca por nome — vale nas duas sub-telas
  const [hide100, setHide100] = useState(true) // >95% físico = concluída na prática — oculta nas duas sub-telas
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setSlot(document.getElementById('crono-filters-slot')) })
  const [openF, setOpenF] = useState<Set<string>>(new Set())
  const [openO, setOpenO] = useState<Set<string>>(new Set())
  const [sub, setSub] = useState<'proj' | 'cfg'>('proj') // sub-telas da aba: Projeção (tabela) | Cronograma (config, ex-modal)
  const [applied, setApplied] = useState<Config | null>(null)

  // árvore frente → obra → drivers (saldo) — engine compartilhada
  const tree = useMemo(() => buildTree(raw), [raw])

  const allObras = useMemo(() => tree.flatMap(f => f.obras), [tree])
  const allKeys = useMemo(() => ({ frentes: tree.map(f => f.label), obras: tree.flatMap(f => f.obras.map(o => f.label + '|' + o.nome)) }), [tree])
  const allOpen = allKeys.frentes.length > 0 && allKeys.frentes.every(l => openF.has(l)) && allKeys.obras.every(k => openO.has(k))
  const toggleAll = () => { if (allOpen) { setOpenF(new Set()); setOpenO(new Set()) } else { setOpenF(new Set(allKeys.frentes)); setOpenO(new Set(allKeys.obras)) } }
  const saldoGlobal = useMemo(() => { const m: Record<string, number> = {}; DRV.forEach(d => m[d.label] = 0); for (const o of allObras) for (const d of o.drivers) m[d.label] += d.saldoQ; return m }, [allObras])

  // config default (produtividade/pessoa padrão; equipe p/ terminar cada obra em 12m, ∝ saldo)
  const defaultConfig = useMemo<Config>(() => makeDefaultConfig(allObras), [allObras])

  // 1ª carga: restaura a última config APLICADA (localStorage, por contrato).
  // Sem config salva, o padrão é a ALOCAÇÃO REAL das Obras (Equipes); teórico 12m só se não houver equipe nenhuma.
  useEffect(() => {
    if (applied || !allObras.length || equipeLoading) return
    try {
      const s = localStorage.getItem(`crono-cfg-${portfolioId}`)
      if (s) { setApplied({ ...defaultConfig, ...JSON.parse(s) }); return }
    } catch { /* config corrompida → segue pro padrão */ }
    if (equipeObras && equipeObras.total > 0) {
      setApplied({ ...defaultConfig, equipe: Object.fromEntries(allObras.map(o => [o.nome, { ...(equipeObras.porObra[o.nome] ?? {}) }])) })
      return
    }
    setApplied(defaultConfig)
  }, [applied, allObras, defaultConfig, portfolioId, equipeObras, equipeLoading])

  // versões salvas
  const { data: versoes = [] } = useQuery<Versao[]>({
    queryKey: ['crono-versoes', portfolioId],
    queryFn: async () => { const { data } = await supabase.from('pmo_cronograma_versao').select('id, nome, config, updated_at').eq('portfolio_id', portfolioId).order('updated_at', { ascending: false }); return (data ?? []) as Versao[] },
  })

  const start = startYM()

  // projeção de TODAS as obras de uma vez (necessário p/ realocação automática — as obras interagem).
  // O filtro de exibição não muda a simulação: obra oculta continua segurando/recebendo equipe.
  const projMap = useMemo(() => {
    if (!applied) return new Map<string, ReturnType<typeof projObra>>()
    const strip = (o: Obra): Obra => (hideOM && o.omR > 0) ? { ...o, omR: 0, omOscs: [], saldoR: o.saldoR - o.omR } : o
    return projTodas(allObras.map(strip), applied, start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, allObras, hideOM])

  const view = useMemo(() => {
    if (!applied) return { frentesF: [] as typeof tree, maxMeses: 0, saldoRtot: 0, terminoGeral: null as string | null }
    const isOM = (o: Obra) => o.omR > 0 && !o.drivers.some(d => d.contr > 0) // obra pura de O&M
    const stripOM = (o: Obra): Obra => (hideOM && o.omR > 0) ? { ...o, omR: 0, omOscs: [], saldoR: o.saldoR - o.omR } : o // tira a parte O&M de obra mista
    const frentesF = tree.filter(fr => fFrente.size === 0 || fFrente.has(fr.label))
      .map(fr => ({ ...fr, obras: fr.obras.filter(o => (fObra.size === 0 || fObra.has(o.nome)) && (fPct.size === 0 || PROD_BANDS.some(b => fPct.has(b[0]) && b[2](o.pctFis))) && !(hideOM && isOM(o)) && !(hide100 && o.pctFis > 95) && (!qObra || o.nome.toLowerCase().includes(qObra.toLowerCase()))).map(stripOM)
        // sem produção no período = projeção zerada (sem equipe/capacidade e sem O&M visível)
        .filter(o => !hideSemProd || (projMap.get(o.nome)?.totalRmes.reduce((s, x) => s + x, 0) ?? 0) >= 1) })).filter(fr => fr.obras.length > 0)
    let maxMeses = 0, saldoRtot = 0
    for (const fr of frentesF) for (const o of fr.obras) { saldoRtot += o.saldoR; maxMeses = Math.max(maxMeses, projMap.get(o.nome)?.maxMeses ?? 0) }
    return { frentesF, maxMeses, saldoRtot, terminoGeral: maxMeses > 0 ? shiftYM(start, maxMeses - 1) : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fFrente, fObra, fPct, hideOM, hideSemProd, hide100, qObra, applied, projMap])

  const totPessoas = useMemo(() => applied ? view.frentesF.flatMap(f => f.obras).reduce((s, o) => s + DRV.reduce((a, d) => a + (applied.equipe?.[o.nome]?.[d.label] || 0), 0), 0) : 0, [applied, view.frentesF])
  // total geral (todas as obras, ignorando o filtro de % físico/obra) — o KPI mostra o todo; o filtro só muda a lista
  const totPessoasAll = useMemo(() => applied ? allObras.reduce((s, o) => s + DRV.reduce((a, d) => a + (applied.equipe?.[o.nome]?.[d.label] || 0), 0), 0) : 0, [applied, allObras])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const obraOptions = (fFrente.size ? tree.filter(f => fFrente.has(f.label)) : tree).flatMap(f => f.obras.map(o => o.nome))
  const togF = (k: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => set(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const obraMeses = (o: Obra, _cfg: Config) => projMap.get(o.nome)?.maxMeses ?? 0
  // 1º mês com produção projetada (respeita Início planejado/realocação) — data de início da obra
  const obraIni = (o: Obra) => { const idx = projMap.get(o.nome)?.totalRmes.findIndex(v => v > 0.5) ?? -1; return idx >= 0 ? shiftYM(start, idx) : null }
  const mesesArr = (applied && view.maxMeses > 0) ? Array.from({ length: view.maxMeses }, (_, i) => shiftYM(start, i)) : []
  const totMensal = (obras: Obra[]) => { const a = new Array(mesesArr.length).fill(0); if (applied) for (const o of obras) projMap.get(o.nome)?.totalRmes.forEach((v, i) => { if (i < a.length) a[i] += v }); return a }
  // larguras fixas p/ TODAS as tabelas alinharem as colunas
  const W_LABEL = 190, W_MES = 72, W_TOT = 78
  const tableW = W_LABEL + mesesArr.length * W_MES + W_TOT // largura fixa idêntica p/ todas as tabelas (não esticar)
  const colGroup = <colgroup><col style={{ width: W_LABEL }} />{mesesArr.map((_, i) => <col key={i} style={{ width: W_MES }} />)}<col style={{ width: W_TOT }} /></colgroup>
  const stk = `sticky left-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`
  const TotalLinha = ({ label, obras, geral }: { label: string; obras: Obra[]; geral?: boolean }) => {
    const t = totMensal(obras); const tot = t.reduce((s, x) => s + x, 0)
    const td = `px-2 py-1 text-right text-[11px] tabular-nums whitespace-nowrap`
    const hcl = `px-2 py-1 text-right text-[9px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap`
    return (
      <div className="overflow-x-auto">
        <table className="border-collapse table-fixed" style={{ width: tableW }}>
          {colGroup}
          <thead><tr><th className={`${hcl} text-left ${stk}`}></th>{mesesArr.map(m => <th key={m} className={hcl}>{ymLabel(m)}</th>)}<th className={`${hcl} pr-3`}>Total</th></tr></thead>
          <tbody><tr className={geral ? 'font-bold' : 'font-semibold'}>
            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk} ${geral ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-teal-300' : 'text-teal-700')}`}>{label}</td>
            {t.map((v, i) => <td key={i} className={`${td} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td>)}
            <td className={`${td} pr-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmtM(tot)}</td>
          </tr></tbody>
        </table>
      </div>
    )
  }

  const publicar = useMutation({
    mutationFn: async () => {
      const obrasAll = view.frentesF.flatMap(fr => fr.obras)
      const tot = totMensal(obrasAll)
      await supabase.from('pmo_cronograma_previsao').delete().eq('portfolio_id', portfolioId)
      const rows = mesesArr.map((ym, i) => ({ portfolio_id: portfolioId, competencia: ym, valor: tot[i] || 0 }))
        .filter(r => r.valor > 0.5)
      if (rows.length) { const { error } = await supabase.from('pmo_cronograma_previsao').insert(rows); if (error) throw error }
      return rows.length
    },
    onSuccess: n => alert(`Cronograma publicado: ${n} competência(s) — o Fluxo de Caixa do Financeiro já enxerga.`),
    onError: () => alert('Erro ao publicar o cronograma.'),
  })

  const subBtn = (k: 'proj' | 'cfg', label: string, icon: ReactNode) => (
    <button key={k} onClick={() => setSub(k)} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[10px] text-[12px] font-bold transition ${sub === k ? 'bg-teal-600 text-white shadow-sm' : (isDark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}>{icon}{label}</button>
  )
  const ocultas100 = allObras.filter(o => o.drivers.some(d => d.contr > 0) && o.pctFis > 95).length
  // linha única de controles, IDÊNTICA nas duas sub-telas (seletor + filtros compartilhados); só a ação da direita muda
  const controles = (<>
    <div className={`inline-flex items-center rounded-xl border p-0.5 ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-100/80'}`}>
      {subBtn('proj', 'Projeção', <CalendarDays size={13} />)}
      {subBtn('cfg', 'Cronograma', <Settings2 size={13} />)}
    </div>
    <input value={qObra} onChange={e => setQObra(e.target.value)} placeholder="buscar obra…"
      className={`w-40 text-[12px] rounded-xl border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'}`} />
    <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={tree.map(f => ({ value: f.label, label: f.label }))} selected={fFrente} onToggle={v => { togF(v, setFFrente); setFObra(new Set()) }} onClear={() => { setFFrente(new Set()); setFObra(new Set()) }} isDark={isDark} />
    <MultiSelect label="Obra" options={[...new Set(obraOptions)].sort().map(o => ({ value: o, label: o }))} selected={fObra} onToggle={v => togF(v, setFObra)} onClear={() => setFObra(new Set())} isDark={isDark} />
    <MultiSelect label="% Físico" options={PROD_BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fPct} onToggle={v => togF(v, setFPct)} onClear={() => setFPct(new Set())} isDark={isDark} />
    <button onClick={() => setHide100(v => !v)} title={hide100 ? 'Mostrar obras >95% físico (concluídas na prática)' : 'Ocultar obras >95% físico'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hide100 ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hide100 ? <EyeOff size={14} /> : <Eye size={14} />} &gt;95%{hide100 && ocultas100 > 0 ? ` (${ocultas100})` : ''}</button>
    <button onClick={() => setHideOM(v => !v)} title={hideOM ? 'Mostrar obras de O&M' : 'Ocultar obras de O&M'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hideOM ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hideOM ? <EyeOff size={14} /> : <Eye size={14} />} O&amp;M</button>
    <button onClick={() => setHideSemProd(v => !v)} title={hideSemProd ? 'Mostrar obras sem produção no período' : 'Ocultar obras sem produção no período (projeção zerada)'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hideSemProd ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hideSemProd ? <EyeOff size={14} /> : <Eye size={14} />} Sem produção</button>
    {sub === 'proj' && (
      <button onClick={() => publicar.mutate()} disabled={publicar.isPending || mesesArr.length === 0}
        title="Grava o Total geral exibido como cronograma oficial (fonte do Fluxo de Caixa do Financeiro)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
        {publicar.isPending ? '...' : 'Publicar cronograma'}
      </button>
    )}
  </>)

  return (
    <div className="space-y-3">
      {slot ? createPortal(controles, slot) : <div className="flex flex-wrap items-center gap-2">{controles}</div>}

      {sub === 'cfg' && <ConfigView isDark={isDark} portfolioId={portfolioId} allObras={allObras} saldoGlobal={saldoGlobal}
        tree={tree} efetivoFrente={efetivo?.porFrente} equipeObras={equipeObras}
        qObra={qObra} hide100={hide100} fFrente={fFrente} fObra={fObra} fPct={fPct}
        inicial={applied ?? defaultConfig} defaultConfig={defaultConfig} versoes={versoes} qc={qc}
        onAplicar={c => { setApplied(c); try { localStorage.setItem(`crono-cfg-${portfolioId}`, JSON.stringify(c)) } catch { /* storage cheio/bloqueado: segue sem persistir */ } setSub('proj') }} />}

      {sub === 'proj' && (<>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Saldo a faturar" value={fmtM(view.saldoRtot)} tone="amber" isDark={isDark} note="R$ restante (filtro)" />
        <Kpi label="Início" value={ymLabel(start)} tone="sky" isDark={isDark} note="mês atual" />
        <Kpi label="Término previsto" value={view.terminoGeral ? ymLabel(view.terminoGeral) : '—'} tone="violet" isDark={isDark} note={`${view.maxMeses} mes(es)`} />
        <Kpi label="Equipe" value={`${totPessoasAll} pessoas`} tone="teal" isDark={isDark} note={totPessoas !== totPessoasAll ? `${totPessoas} no filtro atual` : 'Fund. + Mont. + Lanç.'} />
      </div>

      <PanelCard title="Cronograma por frente e obra" icon={<CalendarDays size={14} className="text-teal-500" />} isDark={isDark}
        right={<div className="flex items-center gap-2.5">
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>barra = duração até o término</span>
          <button onClick={toggleAll} title={allOpen ? 'Recolher tudo' : 'Expandir tudo'} className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50 hover:text-teal-400' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600'}`}>{allOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}</button>
        </div>}>
        {!applied ? <p className={`text-center py-8 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Use <b>Configurar / Gerar</b> pra montar o cronograma.</p> : (
          <div className="space-y-1.5">
            {view.frentesF.map(fr => {
              const fOpen = openF.has(fr.label)
              const frMaxMes = Math.max(0, ...fr.obras.map(o => obraMeses(o, applied)))
              const frTerm = frMaxMes > 0 ? shiftYM(start, frMaxMes - 1) : null
              const frIniIdx = Math.min(...fr.obras.map(o => { const idx = projMap.get(o.nome)?.totalRmes.findIndex(v => v > 0.5) ?? -1; return idx >= 0 ? idx : Infinity }))
              const frIni = Number.isFinite(frIniIdx) ? shiftYM(start, frIniIdx) : null
              const frSaldoR = fr.obras.reduce((s, o) => s + o.saldoR, 0)
              const frRitmo = worstCor(fr.obras.map(o => ritmoCor(o.pctFis, o.ini, o.fim)))
              const frPrazo = worstCor(fr.obras.map(o => { const m = obraMeses(o, applied); return prazoCor(m > 0 ? shiftYM(start, m - 1) : null, o.fim) }))
              return (
                <div key={fr.label} className={`rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  <button onClick={() => togF(fr.label, setOpenF)} className={`w-full flex items-center gap-2 px-3 py-2 ${fOpen ? 'rounded-t-xl' : 'rounded-xl'} ${isDark ? 'bg-slate-800/80 hover:bg-slate-800' : 'bg-slate-200/80 hover:bg-slate-200'}`}>
                    {fOpen ? <ChevronDown size={14} className="shrink-0 text-teal-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                    <Dots ritmo={frRitmo} prazo={frPrazo} />
                    <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fr.label}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-500 whitespace-nowrap"><Flag size={10} />{frIni ? ymLabel(frIni) : '—'} → {frTerm ? ymLabel(frTerm) : '—'}</span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fr.obras.length} obra(s)</span>
                    <span className="ml-auto flex items-center gap-3 text-[11px]"><span className={isDark ? 'text-amber-400' : 'text-amber-600'}>{fmtM(frSaldoR)}</span></span>
                  </button>
                  {fOpen && (
                    <div className={`px-2 pb-2 space-y-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                      {fr.obras.map(o => {
                        const okey = fr.label + '|' + o.nome; const oOpen = openO.has(okey)
                        const oMax = obraMeses(o, applied); const oTerm = oMax > 0 ? shiftYM(start, oMax - 1) : null
                        const oIni = obraIni(o)
                        return (
                          <div key={o.nome} className="mt-1">
                            <button onClick={() => togF(okey, setOpenO)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-slate-100/80 hover:bg-slate-200/70'}`}>
                              {oOpen ? <ChevronDown size={12} className="shrink-0 text-teal-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                              <Dots ritmo={ritmoCor(o.pctFis, o.ini, o.fim)} prazo={prazoCor(oTerm, o.fim)} />
                              <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-500 whitespace-nowrap shrink-0"><Flag size={10} />{oIni ? ymLabel(oIni) : '—'} → {oTerm ? ymLabel(oTerm) : '—'}</span>
                              <span className="ml-auto flex items-center gap-3 text-[10px]"><span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{fmtM(o.saldoR)}</span></span>
                            </button>
                            {oOpen && (() => {
                              const pj = projMap.get(o.nome) ?? projObra(o, applied, start)
                              const thx = `px-2 py-1 text-right text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'} whitespace-nowrap`
                              const tdx = `px-2 py-1 text-right text-[11px] tabular-nums whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`
                              return (
                                <div className="pr-1 pb-2 pt-1 overflow-x-auto">
                                  {pj.maxMeses === 0 ? <p className="text-[11px] text-slate-400 px-2 py-1">Defina a produtividade pra projetar.</p> : (
                                    <table className="border-collapse table-fixed" style={{ width: tableW }}>
                                      {colGroup}
                                      <thead><tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                        <th className={`px-2 py-1 text-left text-[10px] font-semibold ${stk} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Serviço</th>
                                        {mesesArr.map(m => <th key={m} className={thx}>{ymLabel(m)}</th>)}
                                        <th className={`${thx} pr-3`}>Total</th>
                                      </tr></thead>
                                      <tbody>
                                        {o.prelR > 0 && (
                                          <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: COR_PREL }} /><b className={isDark ? 'text-slate-200' : 'text-slate-700'}>Preliminares</b> <span className="text-slate-400">Serv. Prelim. + Canteiro · {fmtM(o.prelR)}</span></td>
                                            {mesesArr.map((_, i) => { const v = pj.prelRmes[i] || 0; return <td key={i} className={tdx}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td> })}
                                            <td className={`${tdx} pr-3 font-semibold`}>{fmtM(o.prelR)}</td>
                                          </tr>
                                        )}
                                        {pj.rows.map(r => { const rowTot = r.rMes.reduce((s, x) => s + x, 0); return (
                                          <tr key={r.d.label} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: r.d.cor }} /><b className={isDark ? 'text-slate-200' : 'text-slate-700'}>{r.d.label}</b> <span className="text-slate-400">{fmtQ(r.d.saldoQ)} {r.d.uni} · {fmtM(r.d.saldoR)}</span></td>
                                            {mesesArr.map((_, i) => { const q = r.qty[i] || 0; const v = r.rMes[i] || 0; return (
                                              <td key={i} className={`${tdx} leading-tight`}>{q > 0 ? <><div className="font-semibold" style={{ color: r.d.cor }}>{fmtQ(q)} {r.d.uni}</div><div className="text-[9px] text-slate-400">{fmtM(v)}</div></> : <span className="text-slate-400">·</span>}</td>
                                            ) })}
                                            <td className={`${tdx} pr-3 font-semibold`} style={{ color: r.d.cor }}>{fmtM(rowTot)}</td>
                                          </tr>
                                        ) })}
                                        {o.admR > 0 && (
                                          <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: COR_ADM }} /><b className={isDark ? 'text-slate-200' : 'text-slate-700'}>Administração</b> <span className="text-slate-400">{fmtM(o.admR)}</span></td>
                                            {mesesArr.map((_, i) => { const v = pj.admRmes[i] || 0; return <td key={i} className={tdx}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td> })}
                                            <td className={`${tdx} pr-3 font-semibold`}>{fmtM(o.admR)}</td>
                                          </tr>
                                        )}
                                        {o.outrosR > 0 && (
                                          <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: COR_OUTROS }} /><b className={isDark ? 'text-slate-200' : 'text-slate-700'}>Outros</b> <span className="text-slate-400">desmont/conf/aterr… · {fmtM(o.outrosR)}</span></td>
                                            {mesesArr.map((_, i) => { const v = pj.outrosRmes[i] || 0; return <td key={i} className={tdx}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td> })}
                                            <td className={`${tdx} pr-3 font-semibold`}>{fmtM(o.outrosR)}</td>
                                          </tr>
                                        )}
                                        {o.omR > 0 && (
                                          <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                            <td className={`px-2 py-1 text-left text-[11px] truncate ${stk}`}><span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: '#0d9488' }} /><b className={isDark ? 'text-slate-200' : 'text-slate-700'}>Execução</b> <span className="text-slate-400">O&amp;M{o.omOscs.length ? ' · ' + o.omOscs.join(', ') : ''} · {fmtM(o.omR)}</span></td>
                                            {mesesArr.map((_, i) => { const v = pj.execMes[i] || 0; return <td key={i} className={tdx}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td> })}
                                            <td className={`${tdx} pr-3 font-semibold text-teal-600`}>{fmtM(o.omR)}</td>
                                          </tr>
                                        )}
                                        <tr className={`border-t-2 ${isDark ? 'border-slate-600' : 'border-slate-300'} font-bold`}>
                                          <td className={`px-2 py-1 text-left text-[11px] ${stk} ${isDark ? 'text-white' : 'text-slate-900'}`}>Total R$/mês</td>
                                          {mesesArr.map((_, i) => { const v = pj.totalRmes[i] || 0; return <td key={i} className={`${tdx} font-bold`}>{v > 0 ? fmtM(v) : <span className="text-slate-400">·</span>}</td> })}
                                          <td className={`${tdx} pr-3 font-bold`}>{fmtM(pj.totalRmes.reduce((s, x) => s + x, 0))}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })}
                      <div className={`mt-1.5 pt-1.5 border-t border-dashed ${isDark ? 'border-white/10' : 'border-slate-200'}`}><TotalLinha label={`Total ${fr.label}`} obras={fr.obras} /></div>
                    </div>
                  )}
                </div>
              )
            })}
            {view.frentesF.length > 0 && <div className={`rounded-xl border px-2 py-2 mt-1 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}><TotalLinha label="Total geral" obras={view.frentesF.flatMap(f => f.obras)} geral /></div>}
          </div>
        )}
      </PanelCard>
      </>)}
    </div>
  )
}

// ── Sub-tela de configuração (ex-modal) — Aplicar volta pra Projeção ─────────
function ConfigView({ isDark, portfolioId, allObras, saldoGlobal, tree, efetivoFrente, equipeObras, qObra, hide100, fFrente, fObra, fPct, inicial, defaultConfig, versoes, qc, onAplicar }: {
  isDark: boolean; portfolioId: string; allObras: Obra[]; saldoGlobal: Record<string, number>
  tree: Frente[]; efetivoFrente?: Record<string, { fundacao: number; montlanc: number }>
  equipeObras?: EquipeObrasReal
  qObra: string; hide100: boolean; fFrente: Set<string>; fObra: Set<string>; fPct: Set<string>
  inicial: Config; defaultConfig: Config; versoes: Versao[]; qc: ReturnType<typeof useQueryClient>
  onAplicar: (c: Config) => void
}) {
  // normaliza versões antigas (prod/modo/pesos) p/ o novo formato (prodPP/equipe)
  const normalize = (c: any): Config => ({ prodPP: c?.prodPP ?? defaultConfig.prodPP, equipe: c?.equipe ?? defaultConfig.equipe, horizonte: c?.horizonte ?? 12, precedencia: c?.precedencia, lag: c?.lag, realoc: c?.realoc, fila: c?.fila, pred: c?.pred, inicio: c?.inicio })
  const [cfg, setCfg] = useState<Config>(() => normalize(inicial))
  const [nome, setNome] = useState('')
  const setPP = (k: string, v: number) => setCfg(c => ({ ...c, prodPP: { ...c.prodPP, [k]: Math.max(0, v) } }))
  const setEquipe = (o: string, d: string, v: number) => setCfg(c => ({ ...c, equipe: { ...c.equipe, [o]: { ...(c.equipe[o] ?? {}), [d]: Math.max(0, Math.round(v)) } } }))
  const setInicio = (o: string, v: string) => setCfg(c => { const inicio = { ...(c.inicio ?? {}) }; if (v) inicio[o] = v; else delete inicio[o]; return { ...c, inicio } })
  const setPred = (o: string, v: string) => setCfg(c => { const pred = { ...(c.pred ?? {}) }; if (v && v !== o) pred[o] = v; else delete pred[o]; return { ...c, pred } })
  // término projetado por obra com a config SENDO editada — a coluna Fim reage ao vivo a equipe/início/predecessão
  const fimMap = useMemo(() => { const m: Record<string, string | null> = {}; projTodas(allObras, cfg, startYM()).forEach((v, k) => { m[k] = v.termino }); return m }, [allObras, cfg])
  const fillEquipe = (h: number) => setCfg(c => { const equipe: Record<string, Record<string, number>> = {}; allObras.forEach(o => { const e: Record<string, number> = {}; o.drivers.forEach(d => { if (d.contr > 0 && d.saldoQ > 0) { const pp = c.prodPP[d.label] || 1; e[d.label] = Math.max(1, Math.round(d.saldoQ / (pp * h))) } }); equipe[o.nome] = e }); return { ...c, equipe, horizonte: h } })
  // preenche a equipe a partir do efetivo real (RH), distribuído às obras ∝ saldo — depois editável livre
  const efetivoTot = efetivoFrente ? Object.values(efetivoFrente).reduce((s, x) => s + x.fundacao + x.montlanc, 0) : 0
  const fillFromReal = () => setCfg(c => ({ ...c, equipe: equipeFromEfetivo(tree, efetivoFrente ?? {}, true) }))
  // preenche com a alocação REAL das Obras (obr_planejamento_equipe): direto por obra × frente; obra sem equipe fica 0
  const equipesTot = equipeObras?.total ?? 0
  const fillFromEquipes = () => setCfg(c => ({ ...c, equipe: Object.fromEntries(allObras.map(o => [o.nome, { ...(equipeObras?.porObra[o.nome] ?? {}) }])) }))
  const totPessoas = allObras.reduce((s, o) => s + DRV.reduce((a, d) => a + (cfg.equipe[o.nome]?.[d.label] || 0), 0), 0)
  // lista de obras filtrada pelos MESMOS filtros compartilhados da linha de controles (busca, >95%, frente, obra, % físico)
  const [prodOpen, setProdOpen] = useState(false) // modal secundário: produtividade padrão por pessoa
  const [grpFechado, setGrpFechado] = useState<Set<string>>(new Set())
  const grupos = useMemo(() => {
    const map = new Map<string, Obra[]>()
    for (const o of allObras) {
      if (!o.drivers.some(d => d.contr > 0)) continue // só O&M/sem drivers → não tem onde alocar equipe
      if (hide100 && o.pctFis > 95) continue // >95% = concluída na prática (nem toda obra fecha em 100%)
      if (qObra && !o.nome.toLowerCase().includes(qObra.toLowerCase())) continue
      if (fFrente.size > 0 && !fFrente.has(o.frente)) continue
      if (fObra.size > 0 && !fObra.has(o.nome)) continue
      if (fPct.size > 0 && !PROD_BANDS.some(b => fPct.has(b[0]) && b[2](o.pctFis))) continue
      const arr = map.get(o.frente) ?? []; arr.push(o); map.set(o.frente, arr)
    }
    return [...map.entries()]
  }, [allObras, hide100, qObra, fFrente, fObra, fPct])
  const predOpts = useMemo(() => allObras.filter(o => o.drivers.some(d => d.contr > 0)).map(o => o.nome).sort(), [allObras])

  const salvar = useMutation({
    mutationFn: async () => {
      const ex = versoes.find(v => v.nome.toLowerCase() === nome.trim().toLowerCase())
      if (ex) await supabase.from('pmo_cronograma_versao').update({ config: cfg, updated_at: new Date().toISOString() }).eq('id', ex.id)
      else await supabase.from('pmo_cronograma_versao').insert({ portfolio_id: portfolioId, nome: nome.trim(), config: cfg })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crono-versoes', portfolioId] }); setNome('') },
  })
  const excluir = useMutation({
    mutationFn: async (id: string) => { await supabase.from('pmo_cronograma_versao').delete().eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crono-versoes', portfolioId] }),
  })

  const inp = `w-20 text-sm font-bold rounded-lg border px-2 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`
  const lbl = `text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  return (
      <div className={`rounded-2xl border ${isDark ? 'bg-slate-900/60 border-white/[0.06] text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <div className="px-5 py-3 space-y-3">
          {/* Versões (inline) */}
          {versoes.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className={lbl}>Versões</p>
              {versoes.map(v => (
                <span key={v.id} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-semibold border ${isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'}`}>
                  <button onClick={() => { setCfg(normalize(v.config)); setNome(v.nome) }} className="hover:text-teal-500">{v.nome}</button>
                  <button onClick={() => excluir.mutate(v.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={11} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Equipe por obra (nº de pessoas) — toolbar única: busca/filtro à esquerda, preenchimentos à direita */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className={lbl}>Equipe por obra — nº de pessoas</p>
              <span className="flex-1" />
              <button onClick={() => setProdOpen(true)} title="Produtividade padrão por pessoa/mês (por serviço)" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isDark ? 'border-white/15 text-slate-300 bg-white/[0.04]' : 'border-slate-300 text-slate-600 bg-white'}`}><Gauge size={11} className="text-teal-500" /> Produtividade · {DRV.map(d => cfg.prodPP[d.label] ?? 0).join(' / ')}</button>
              <button onClick={fillFromReal} disabled={efetivoTot === 0} title={efetivoTot === 0 ? 'sem efetivo no RH' : 'puxa o efetivo real do RH (por frente) e distribui às obras ∝ saldo — depois edite livre'} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border disabled:opacity-40 ${isDark ? 'border-teal-500/40 text-teal-300 bg-teal-500/10' : 'border-teal-300 text-teal-700 bg-teal-50'}`}><Sparkles size={11} /> Efetivo real (RH){efetivoTot > 0 ? ` · ${efetivoTot}` : ''}</button>
              <button onClick={fillFromEquipes} disabled={equipesTot === 0} title={equipesTot === 0 ? 'sem equipes alocadas nas Obras' : 'preenche com a alocação real das equipes (Obras › Equipe): encarregado + time por obra × frente. Obra sem equipe fica 0 — depois edite livre'} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border disabled:opacity-40 ${isDark ? 'border-violet-500/40 text-violet-300 bg-violet-500/10' : 'border-violet-300 text-violet-700 bg-violet-50'}`}><Sparkles size={11} /> Equipes (Obras){equipesTot > 0 ? ` · ${equipesTot}` : ''}</button>
              <span className="text-[10px] text-slate-400">terminar em</span>
              {[6, 12, 18, 24].map(h => <button key={h} onClick={() => fillEquipe(h)} title="distribui equipe ∝ saldo p/ terminar nesse prazo" className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.horizonte === h ? 'bg-teal-600 text-white border-teal-600' : (isDark ? 'border-white/15 text-slate-400' : 'border-slate-300 text-slate-500')}`}>{h}m</button>)}
            </div>
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <div className={`flex items-center gap-2 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                <span className="flex-1">Obra</span>
                <span className="w-[104px] text-center" title="Mês de início planejado — a obra não produz antes dele">Início</span>
                <span className="w-12 text-center" title="Término projetado com a configuração atual (equipe, início e predecessão)">Fim</span>
                {DRV.map(d => <span key={d.label} className="w-14 text-center" style={{ color: d.cor }}>{d.label}</span>)}
                <span className="w-9 text-right">total</span>
                <span className="w-36 text-center" title="Obra predecessora — quando ela conclui um serviço, a equipe liberada vem pra esta obra">Predecessão</span>
              </div>
              <div className="max-h-[58vh] overflow-auto">
                {grupos.length === 0 && <p className={`px-3 py-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma obra no filtro.</p>}
                {grupos.map(([frente, obras]) => {
                  const fechado = grpFechado.has(frente)
                  const totFr = obras.reduce((s, o) => s + DRV.reduce((a, d) => a + (cfg.equipe[o.nome]?.[d.label] || 0), 0), 0)
                  return (
                    <div key={frente}>
                      <button type="button" onClick={() => setGrpFechado(s => { const n = new Set(s); n.has(frente) ? n.delete(frente) : n.add(frente); return n })}
                        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left border-b ${isDark ? 'bg-white/[0.03] border-white/[0.05]' : 'bg-slate-50/80 border-slate-100'}`}>
                        {fechado ? <ChevronRight size={12} className="shrink-0 opacity-60" /> : <ChevronDown size={12} className="shrink-0 opacity-60" />}
                        <span className={`text-[11px] font-bold ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>{frente}</span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{obras.length} obra(s)</span>
                        <span className={`ml-auto text-[11px] font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{totFr > 0 ? `${totFr} pessoas` : ''}</span>
                      </button>
                      {!fechado && obras.map(o => { const eq = cfg.equipe[o.nome] ?? {}; const tot = DRV.reduce((s, d) => s + (eq[d.label] || 0), 0); return (
                        <div key={o.nome} className={`flex items-center gap-2 px-2.5 py-1.5 border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                          <span className={`flex-1 text-[11px] truncate pl-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} title={`${o.nome} · físico ${o.pctFis}%`}>{o.nome} <span className="opacity-50">· {o.pctFis}%</span></span>
                          <input type="month" value={cfg.inicio?.[o.nome] ?? ''} onChange={e => setInicio(o.nome, e.target.value)} className={`w-[104px] text-[11px] rounded-lg border px-1 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`} />
                          <span className="w-12 text-center text-[11px] font-semibold tabular-nums text-violet-500" title="Término projetado com a configuração atual">{fimMap[o.nome] ? ymLabel(fimMap[o.nome]!) : '—'}</span>
                          {DRV.map(d => { const has = o.drivers.some(x => x.label === d.label && x.contr > 0); return (
                            <input key={d.label} type="number" min="0" disabled={!has} value={has ? (eq[d.label] ?? 0) : ''} placeholder={has ? '' : '—'} onChange={e => setEquipe(o.nome, d.label, Number(e.target.value))} className={`w-14 text-center text-[12px] font-semibold rounded-lg border px-1 py-0.5 outline-none ${!has ? 'opacity-30 cursor-not-allowed' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                          ) })}
                          <span className={`w-9 text-right text-[12px] font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{tot}</span>
                          <select value={cfg.pred?.[o.nome] ?? ''} onChange={e => setPred(o.nome, e.target.value)} title={cfg.pred?.[o.nome] ?? 'sem predecessora'} className={`w-36 text-[11px] rounded-lg border px-1 py-0.5 outline-none truncate ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`}>
                            <option value="">—</option>
                            {predOpts.filter(n => n !== o.nome).map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      ) })}
                    </div>
                  )
                })}
              </div>
            </div>
            <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Total: <b>{totPessoas} pessoas</b> · cada obra avança no ritmo nº pessoas × produtividade/pessoa. Drivers que a obra não tem ficam desabilitados.</p>
          </div>

          {/* Premissas (precedência) */}
          <div>
            <p className={`${lbl} mb-2`}>Premissas — precedência entre serviços</p>
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <span onClick={() => setCfg(c => ({ ...c, precedencia: !(c.precedencia !== false) }))} className={`w-9 h-5 rounded-full p-0.5 transition ${cfg.precedencia !== false ? 'bg-teal-600' : (isDark ? 'bg-white/15' : 'bg-slate-300')}`}><span className={`block w-4 h-4 rounded-full bg-white transition ${cfg.precedencia !== false ? 'translate-x-4' : ''}`} /></span>
              <span className="text-[12px] font-semibold">Fundação libera Montagem · Montagem libera Lançamento</span>
            </label>
            {cfg.precedencia !== false && (
              <div className="flex items-center gap-2 text-[11px] pl-1">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Defasagem (meses) entre liberar e iniciar o próximo:</span>
                <input type="number" min="0" max="12" value={cfg.lag || 0} onChange={e => setCfg(c => ({ ...c, lag: Math.max(0, Number(e.target.value)) }))} className={`w-14 text-[12px] font-semibold rounded-lg border px-1.5 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
              </div>
            )}
            <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Montagem não avança além do % de fundação já concluído (volume liberado); lançamento idem em relação à montagem.</p>
            <label className="flex items-center gap-2 mt-3 mb-1 cursor-pointer">
              <span onClick={() => setCfg(c => ({ ...c, realoc: !c.realoc }))} className={`w-9 h-5 rounded-full p-0.5 transition ${cfg.realoc ? 'bg-teal-600' : (isDark ? 'bg-white/15' : 'bg-slate-300')}`}><span className={`block w-4 h-4 rounded-full bg-white transition ${cfg.realoc ? 'translate-x-4' : ''}`} /></span>
              <span className="text-[12px] font-semibold">Realocação automática — equipe liberada migra pra obra sucessora</span>
            </label>
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quando um serviço conclui numa obra, a equipe dele vai pra obra que apontou esta como <b>Predecessão</b> (seguindo a cadeia se a sucessora não tiver saldo daquele serviço) — a produção lá só começa a partir do <b>Início</b> planejado, e a coluna <b>Fim</b> mostra o término projetado. Sem realocação, use só o Início pra planejar as ondas manualmente.</p>
          </div>
        </div>
        {/* Modal secundário: produtividade padrão por pessoa */}
        {prodOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setProdOpen(false)}>
            <div className={`w-full max-w-sm rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <h3 className="text-[13px] font-bold flex items-center gap-2"><Gauge size={14} className="text-teal-500" /> Produtividade por pessoa (por mês)</h3>
                <button onClick={() => setProdOpen(false)} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={14} /></button>
              </div>
              <div className="px-4 py-3 space-y-2">
                {DRV.map(d => (
                  <div key={d.label} className={`flex items-center gap-2 rounded-xl p-2.5 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50/70 border-slate-100'}`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.cor }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold">{d.label}</span>
                      <span className={`block text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>saldo total {fmtQ(saldoGlobal[d.label] || 0)} {d.uni}</span>
                    </span>
                    <input type="number" min="0" step="0.1" value={cfg.prodPP[d.label] ?? 0} onChange={e => setPP(d.label, Number(e.target.value))} className={inp} />
                    <span className="text-[10px] text-slate-400 w-24">{d.uni}/pessoa·mês</span>
                  </div>
                ))}
              </div>
              <div className={`flex justify-end px-4 py-2.5 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <button onClick={() => setProdOpen(false)} className="px-3 py-1 rounded-lg text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700">OK</button>
              </div>
            </div>
          </div>
        )}
        {/* Footer */}
        <div className={`flex items-center gap-2 px-5 py-3 border-t sticky bottom-0 rounded-b-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="nome da versão" className={`flex-1 text-sm rounded-lg border px-3 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
          <button onClick={() => salvar.mutate()} disabled={!nome.trim() || salvar.isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40 ${isDark ? 'border-white/15 text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Save size={14} /> Salvar versão</button>
          <button onClick={() => onAplicar(cfg)} title="Aplica a configuração e volta pra Projeção" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700"><Sparkles size={14} /> Aplicar</button>
        </div>
      </div>
  )
}
