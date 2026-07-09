// Painel Cronograma — modal de config (produtividade total + alocação por obra) → Aplicar gera; versões salvas
import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Filter, ChevronDown, ChevronRight, Check, Flag, Settings2, Save, Trash2, X, Sparkles, Gauge, Eye, EyeOff, ChevronsDownUp, ChevronsUpDown, Users, HardHat, RefreshCw, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useEfetivoReal, useEquipeObrasReal, type EquipeObrasReal } from '../../../hooks/useEfetivoReal'
import { supabase } from '../../../services/supabase'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import {
  DRV, COR_PREL, COR_ADM, COR_OUTROS, ymLabel, shiftYM, startYM, ymNum, fmtM, fmtQ, ritmoCor, prazoCor, worstCor,
  buildTree, makeDefaultConfig, projObra, projTodas, equipeFromEfetivo, type Obra, type Frente, type Config, type Versao,
} from './cronogramaEngine'
import { planejarComReforco, type PlanParams, type PlanObraIn, type PlanResult } from './planejadorAuto'

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
          {options.length > 0 && (() => { const todas = n === options.length; return (
            <button onClick={() => { if (todas || n > 0) onClear(); else options.forEach(o => { if (!selected.has(o.value)) onToggle(o.value) }) }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-lg text-[11px] text-left border-b ${isDark ? 'hover:bg-white/[0.06] border-white/[0.06]' : 'hover:bg-slate-50 border-slate-100'}`}>
              <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${todas ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{todas && <Check size={11} strokeWidth={3} />}</span>
              <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{todas || n > 0 ? 'Desmarcar todas' : 'Selecionar todas'}</span>
            </button>
          ) })()}
          {options.map(o => { const on = selected.has(o.value); return (
            <button key={o.value} onClick={() => onToggle(o.value)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
              <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${on ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-white/25' : 'border-slate-300')}`}>{on && <Check size={11} strokeWidth={3} />}</span>
              <span className={`truncate ${on ? 'font-semibold' : ''} ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.label}</span>
            </button>) })}
        </div></>)}
    </div>
  )
}

// combo pesquisável de predecessora: digite pra filtrar, clique pra escolher
function PredCombo({ value, options, onPick, isDark }: { value: string; options: string[]; onPick: (v: string) => void; isDark: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = q ? options.filter(n => n.toLowerCase().includes(q.toLowerCase())) : options
  return (
    <div className="relative w-40 shrink-0">
      <input value={open ? q : value} placeholder={value && !open ? undefined : '— digite pra filtrar'}
        onFocus={() => { setOpen(true); setQ('') }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        title={value || 'sem predecessora — digite pra filtrar'}
        className={`w-full text-[11px] rounded-lg border px-1.5 py-0.5 outline-none truncate ${value ? 'border-violet-400' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-700 placeholder-slate-400'}`} />
      {open && (
        <div className={`absolute right-0 z-30 mt-1 w-80 max-h-56 overflow-auto rounded-xl border shadow-xl p-1 ${isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-slate-200'}`}>
          <button onMouseDown={e => { e.preventDefault(); onPick(''); setOpen(false) }} className={`w-full text-left px-2 py-1 rounded-lg text-[11px] text-slate-400 ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>— sem predecessora</button>
          {list.length === 0 && <p className="px-2 py-1.5 text-[11px] text-slate-400">nenhuma obra</p>}
          {list.map(n => (
            <button key={n} onMouseDown={e => { e.preventDefault(); onPick(n); setOpen(false) }} className={`w-full text-left px-2 py-1 rounded-lg text-[11px] truncate ${n === value ? 'font-bold text-teal-500' : (isDark ? 'text-slate-200' : 'text-slate-700')} ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>{n}</button>
          ))}
        </div>
      )}
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
  // nome da versão aplicada — usado pelo Publicar pra replicar no Histograma com o MESMO nome
  const [appliedNome, setAppliedNome] = useState<string>(() => { try { return localStorage.getItem(`crono-cfg-nome-${portfolioId}`) ?? '' } catch { return '' } })

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
      // replica no HISTOGRAMA: grava a config aplicada como versão com o MESMO nome do cronograma
      let nomeV = ''
      if (applied) {
        nomeV = appliedNome.trim() || 'Cronograma publicado'
        const ex = versoes.find(v => v.nome.toLowerCase() === nomeV.toLowerCase())
        if (ex) { const { error } = await supabase.from('pmo_cronograma_versao').update({ config: applied, updated_at: new Date().toISOString() }).eq('id', ex.id); if (error) throw error }
        else { const { error } = await supabase.from('pmo_cronograma_versao').insert({ portfolio_id: portfolioId, nome: nomeV, config: applied }); if (error) throw error }
        qc.invalidateQueries({ queryKey: ['crono-versoes', portfolioId] })
      }
      return { n: rows.length, nomeV }
    },
    onSuccess: r => alert(`Cronograma publicado: ${r.n} competência(s) — Fluxo de Caixa atualizado${r.nomeV ? ` e replicado no Histograma (versão "${r.nomeV}")` : ''}.`),
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
    <MultiSelect label="Frente" icon={<Filter size={12} className="opacity-70" />} options={tree.map(f => ({ value: f.label, label: f.label }))} selected={fFrente} onToggle={v => { togF(v, setFFrente); setFObra(new Set()) }} onClear={() => { setFFrente(new Set()); setFObra(new Set()) }} isDark={isDark} />
    <MultiSelect label="Obra" options={[...new Set(obraOptions)].sort().map(o => ({ value: o, label: o }))} selected={fObra} onToggle={v => togF(v, setFObra)} onClear={() => setFObra(new Set())} isDark={isDark} />
    <MultiSelect label="% Físico" options={PROD_BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fPct} onToggle={v => togF(v, setFPct)} onClear={() => setFPct(new Set())} isDark={isDark} />
    <button onClick={() => setHide100(v => !v)} title={hide100 ? 'Mostrar obras >95% físico (concluídas na prática)' : 'Ocultar obras >95% físico'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hide100 ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hide100 ? <EyeOff size={14} /> : <Eye size={14} />} &gt;95%{hide100 && ocultas100 > 0 ? ` (${ocultas100})` : ''}</button>
    <button onClick={() => setHideOM(v => !v)} title={hideOM ? 'Mostrar obras de O&M' : 'Ocultar obras de O&M'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hideOM ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hideOM ? <EyeOff size={14} /> : <Eye size={14} />} O&amp;M</button>
    <button onClick={() => setHideSemProd(v => !v)} title={hideSemProd ? 'Mostrar obras sem produção no período' : 'Ocultar obras sem produção no período (projeção zerada)'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${hideSemProd ? (isDark ? 'bg-slate-700/60 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400')}`}>{hideSemProd ? <EyeOff size={14} /> : <Eye size={14} />} Sem produção</button>
    <input value={qObra} onChange={e => setQObra(e.target.value)} placeholder="buscar obra…"
      className={`flex-1 min-w-[140px] text-[12px] rounded-xl border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'}`} />
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
        onAplicar={(c, nomeV) => { setApplied(c); if (nomeV) { setAppliedNome(nomeV); try { localStorage.setItem(`crono-cfg-nome-${portfolioId}`, nomeV) } catch { /* segue sem persistir */ } } try { localStorage.setItem(`crono-cfg-${portfolioId}`, JSON.stringify(c)) } catch { /* storage cheio/bloqueado: segue sem persistir */ } setSub('proj') }} />}

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
  onAplicar: (c: Config, nomeVersao?: string) => void
}) {
  // normaliza versões antigas (prod/modo/pesos) p/ o novo formato (prodPP/equipe)
  const normalize = (c: any): Config => ({ prodPP: c?.prodPP ?? defaultConfig.prodPP, equipe: c?.equipe ?? defaultConfig.equipe, horizonte: c?.horizonte ?? 12, precedencia: c?.precedencia, lag: c?.lag, realoc: c?.realoc, fila: c?.fila, pred: c?.pred, inicio: c?.inicio, fim: c?.fim, inicioS: c?.inicioS, fimS: c?.fimS })
  const [cfg, setCfg] = useState<Config>(() => normalize(inicial))
  const [nome, setNome] = useState('')
  const setPP = (k: string, v: number) => setCfg(c => ({ ...c, prodPP: { ...c.prodPP, [k]: Math.max(0, v) } }))
  const setEquipe = (o: string, d: string, v: number) => setCfg(c => ({ ...c, equipe: { ...c.equipe, [o]: { ...(c.equipe[o] ?? {}), [d]: Math.max(0, Math.round(v)) } } }))
  // datas: editar a OBRA aplica a todos os serviços (limpa overrides); editar o SERVIÇO sobrescreve só ele
  const setInicio = (o: string, v: string) => setCfg(c => { const inicio = { ...(c.inicio ?? {}) }; if (v) inicio[o] = v; else delete inicio[o]; const inicioS = { ...(c.inicioS ?? {}) }; delete inicioS[o]; return { ...c, inicio, inicioS } })
  const setFim = (o: string, v: string) => setCfg(c => { const fim = { ...(c.fim ?? {}) }; if (v) fim[o] = v; else delete fim[o]; const fimS = { ...(c.fimS ?? {}) }; delete fimS[o]; return { ...c, fim, fimS } })
  const setInicioSrv = (o: string, d: string, v: string) => setCfg(c => { const inicioS = { ...(c.inicioS ?? {}) }; const m = { ...(inicioS[o] ?? {}) }; if (v) m[d] = v; else delete m[d]; if (Object.keys(m).length) inicioS[o] = m; else delete inicioS[o]; return { ...c, inicioS } })
  const setFimSrv = (o: string, d: string, v: string) => setCfg(c => { const fimS = { ...(c.fimS ?? {}) }; const m = { ...(fimS[o] ?? {}) }; if (v) m[d] = v; else delete m[d]; if (Object.keys(m).length) fimS[o] = m; else delete fimS[o]; return { ...c, fimS } })
  const setPred = (o: string, v: string) => setCfg(c => { const pred = { ...(c.pred ?? {}) }; if (v && v !== o) pred[o] = v; else delete pred[o]; return { ...c, pred } })
  // valor efetivo por serviço e valor exibido na obra (comum a todos os serviços, ou vazio quando misto)
  const effIni = (o: Obra, d: string) => cfg.inicioS?.[o.nome]?.[d] ?? cfg.inicio?.[o.nome] ?? ''
  const effFim = (o: Obra, d: string) => cfg.fimS?.[o.nome]?.[d] ?? cfg.fim?.[o.nome] ?? ''
  const d8 = (v: string) => v ? (v.length === 7 ? `${v}-01` : v) : '' // config antiga YYYY-MM → dia 01 (input type=date exige data completa)
  // linha-pai mostra a JANELA da obra: menor início → maior término entre os serviços (editar aplica a todos)
  const obraIniVal = (o: Obra) => { const vs = o.drivers.filter(d => d.contr > 0).map(d => effIni(o, d.label)).filter(Boolean); return vs.length ? vs.reduce((a, b) => a < b ? a : b) : '' }
  const obraFimVal = (o: Obra) => { const vs = o.drivers.filter(d => d.contr > 0).map(d => effFim(o, d.label)).filter(Boolean); return vs.length ? vs.reduce((a, b) => a > b ? a : b) : '' }
  const start0 = startYM()
  // recálculo por obra (menu do ícone ⟳): prazo pela equipe ↔ equipe pelo prazo
  const [recalcMenu, setRecalcMenu] = useState<{ obra: string; x: number; y: number } | null>(null)
  const obraByNome = useMemo(() => new Map(allObras.map(o => [o.nome, o])), [allObras])
  // "mudei equipe → recalcular prazo": projeta a obra pela equipe×produtividade (sem data forçada) e grava as datas resultantes
  const recalcPrazo = (nome: string) => {
    const o = obraByNome.get(nome); if (!o) return
    const st = startYM()
    const livre: Config = { ...cfg, fim: { ...(cfg.fim ?? {}) }, fimS: { ...(cfg.fimS ?? {}) } }
    delete livre.fim![nome]; delete livre.fimS![nome]
    const pj = projObra(o, livre, st)
    const iS: Record<string, string> = {}, fS: Record<string, string> = {}
    pj.rows.forEach(r => {
      const first = r.qty.findIndex(q => q > 0.001)
      let last = -1; r.qty.forEach((q, m) => { if (q > 0.001) last = m })
      if (first >= 0 && last >= 0) { iS[r.d.label] = `${shiftYM(st, first)}-01`; fS[r.d.label] = `${shiftYM(st, last)}-01` }
    })
    setCfg(c => {
      const inicioS = { ...(c.inicioS ?? {}) }, fimS = { ...(c.fimS ?? {}) }, fim = { ...(c.fim ?? {}) }
      if (Object.keys(iS).length) { inicioS[nome] = iS; fimS[nome] = fS }
      delete fim[nome] // trava de data da obra sai — o prazo passa a ser resultado da equipe
      return { ...c, inicioS, fimS, fim }
    })
  }
  // "mudei prazo → recalcular equipe": nº de pessoas = saldo ÷ produtividade ÷ meses da janela atual de cada serviço
  const recalcEquipe = (nome: string) => {
    const o = obraByNome.get(nome); if (!o) return
    const eq: Record<string, number> = { ...(cfg.equipe[nome] ?? {}) }
    o.drivers.filter(d => d.contr > 0 && d.saldoQ > 0).forEach(d => {
      const ini = (effIni(o, d.label) || '').slice(0, 7), fim = (effFim(o, d.label) || '').slice(0, 7)
      if (ini && fim && fim >= ini) { const meses = ymNum(fim) - ymNum(ini) + 1; const pp = cfg.prodPP[d.label] || 1; eq[d.label] = Math.max(1, Math.ceil(d.saldoQ / (pp * meses))) }
    })
    setCfg(c => ({ ...c, equipe: { ...c.equipe, [nome]: eq } }))
  }
  // projeção ao vivo com a config SENDO editada — Duração (obra e por serviço) reage a equipe/datas/predecessão
  const fimMap = useMemo(() => {
    const m: Record<string, { termino: string | null; meses: number; srv: Record<string, number> }> = {}
    projTodas(allObras, cfg, startYM()).forEach((v, k) => { const srv: Record<string, number> = {}; v.rows.forEach(r => { srv[r.d.label] = r.meses }); m[k] = { termino: v.termino, meses: v.maxMeses, srv } })
    return m
  }, [allObras, cfg])
  // Planejamento Automático — simulador por EQUIPE-PADRÃO + recursos críticos (planejadorAuto.ts)
  const [planOpen, setPlanOpen] = useState(false)
  const [planP, setPlanP] = useState<PlanParams>({ eqF: 1, eqML: 1, rotores: 5, perfuratrizes: 1, guindastes: 1, comboios: 4, residual: 0.7, limiarGuind: 10, eqPorLanc: 2, diasUteis: 22, excluidas: [] })
  const [planAlvo, setPlanAlvo] = useState('') // YYYY-MM opcional → cálculo de reforço mínimo
  const [planExc, setPlanExc] = useState<Set<string>>(new Set()) // obras embargadas / fora do plano
  const [planRes, setPlanRes] = useState<PlanResult | null>(null)
  // torres por obra = Σ qtd_torres das OSCs de CONSTRUÇÃO ativas (lançadas na Iniciação) — busca só com o modal aberto
  const { data: torresObra } = useQuery<Record<string, number>>({
    queryKey: ['plan-torres', portfolioId],
    enabled: planOpen,
    queryFn: async () => {
      const { data: oscs } = await supabase.from('pmo_fluxo_os').select('obra_id, qtd_torres, tipo, etapa_atual').eq('portfolio_id', portfolioId)
      const ids = [...new Set((oscs ?? []).map(o => o.obra_id).filter(Boolean))]
      const { data: obs } = ids.length ? await supabase.from('sys_obras').select('id, nome').in('id', ids) : { data: [] as { id: string; nome: string }[] }
      const nm = new Map((obs ?? []).map(o => [o.id as string, o.nome as string]))
      const m: Record<string, number> = {}
      for (const o of oscs ?? []) {
        if (o.tipo !== 'construcao' || o.etapa_atual === 'cancelada' || o.qtd_torres == null) continue
        const n = nm.get(o.obra_id); if (!n) continue
        m[n] = (m[n] ?? 0) + Number(o.qtd_torres)
      }
      return m
    },
  })
  const abrirPlan = () => {
    // equipes default = alocação atual da tabela convertida em equipes-padrão (Fundação 7 · Mont/Lanç 12)
    const totF = allObras.reduce((s, o) => s + (cfg.equipe[o.nome]?.['Fundação'] || 0), 0)
    const totML = allObras.reduce((s, o) => s + (cfg.equipe[o.nome]?.['Montagem'] || 0) + (cfg.equipe[o.nome]?.['Lançamento'] || 0), 0)
    setPlanP(pp => ({ ...pp, eqF: Math.max(1, Math.round(totF / 7)), eqML: Math.max(1, Math.round(totML / 12)) }))
    // exclusões: as que você marcou antes (persistidas) + obras >95% físico (concluídas na prática) pré-marcadas
    const exc = new Set<string>(allObras.filter(o => o.drivers.some(d => d.contr > 0) && o.pctFis > 95).map(o => o.nome))
    try { for (const n of JSON.parse(localStorage.getItem(`crono-plan-exc-${portfolioId}`) ?? '[]')) exc.add(n) } catch { /* lista corrompida → segue só com as >95% */ }
    setPlanExc(exc)
    setPlanRes(null); setPlanOpen(true)
  }
  const togglePlanExc = (nome: string) => {
    setPlanExc(s => {
      const n = new Set(s); n.has(nome) ? n.delete(nome) : n.add(nome)
      try { localStorage.setItem(`crono-plan-exc-${portfolioId}`, JSON.stringify([...n])) } catch { /* storage cheio: segue sem persistir */ }
      return n
    })
    setPlanRes(null)
  }
  const simular = () => {
    const start = startYM()
    const ins: PlanObraIn[] = allObras.filter(o => o.drivers.some(d => d.contr > 0)).map(o => {
      const g = (l: string) => o.drivers.find(d => d.label === l)
      const f = g('Fundação'), mo = g('Montagem'), l = g('Lançamento')
      return {
        nome: o.nome, frente: o.frente, saldoR: o.saldoR,
        prazoIdx: o.fim ? Math.max(0, ymNum(o.fim.slice(0, 7)) - ymNum(start)) : null,
        fund: { c: f?.contr ?? 0, s: f?.saldoQ ?? 0 }, mont: { c: mo?.contr ?? 0, s: mo?.saldoQ ?? 0 }, lanc: { c: l?.contr ?? 0, s: l?.saldoQ ?? 0 },
        torres: torresObra?.[o.nome] ?? null,
      }
    })
    const alvoIdx = planAlvo ? Math.max(0, ymNum(planAlvo) - ymNum(start)) : null
    setPlanRes(planejarComReforco(ins, { ...planP, excluidas: [...planExc], alvoIdx }))
  }
  // grava o plano nos campos EXISTENTES da config: datas por serviço + predecessão + pessoas (equipes × tamanho)
  const preencherPlano = () => {
    if (!planRes) return
    const start = startYM()
    const dd = (i: number) => `${shiftYM(start, i)}-01`
    const inicioS: Record<string, Record<string, string>> = {}, fimS: Record<string, Record<string, string>> = {}
    const pred: Record<string, string> = {}
    const equipe: Record<string, Record<string, number>> = {}
    allObras.forEach(o => { equipe[o.nome] = { ...(cfg.equipe[o.nome] ?? {}) } })
    for (const [nome, o] of Object.entries(planRes.obras)) {
      const iS: Record<string, string> = {}, fS: Record<string, string> = {}
      if (o.fund) { iS['Fundação'] = dd(o.fund.ini); fS['Fundação'] = dd(o.fund.fim); equipe[nome]['Fundação'] = o.fund.eqMax * 7 }
      if (o.mont) { iS['Montagem'] = dd(o.mont.ini); fS['Montagem'] = dd(o.mont.fim); equipe[nome]['Montagem'] = o.mont.eqMax * 12 }
      if (o.lanc) { iS['Lançamento'] = dd(o.lanc.ini); fS['Lançamento'] = dd(o.lanc.fim); equipe[nome]['Lançamento'] = o.lanc.eqMax * 12 }
      if (Object.keys(iS).length) { inicioS[nome] = iS; fimS[nome] = fS }
      if (o.pred) pred[nome] = o.pred
    }
    setCfg(c => ({ ...c, equipe, inicioS, fimS, pred, inicio: {}, fim: {}, fila: {}, realoc: false }))
    setPlanOpen(false)
  }
  // preenche a equipe a partir do efetivo real (RH), distribuído às obras ∝ saldo — depois editável livre
  const efetivoTot = efetivoFrente ? Object.values(efetivoFrente).reduce((s, x) => s + x.fundacao + x.montlanc, 0) : 0
  const fillFromReal = () => setCfg(c => ({ ...c, equipe: equipeFromEfetivo(tree, efetivoFrente ?? {}, true) }))
  // preenche com a alocação REAL das Obras (obr_planejamento_equipe): direto por obra × frente; obra sem equipe fica 0
  const equipesTot = equipeObras?.total ?? 0
  const fillFromEquipes = () => setCfg(c => ({ ...c, equipe: Object.fromEntries(allObras.map(o => [o.nome, { ...(equipeObras?.porObra[o.nome] ?? {}) }])) }))
  const totPessoas = allObras.reduce((s, o) => s + DRV.reduce((a, d) => a + (cfg.equipe[o.nome]?.[d.label] || 0), 0), 0)
  // lista de obras filtrada pelos MESMOS filtros compartilhados da linha de controles (busca, >95%, frente, obra, % físico)
  const [prodOpen, setProdOpen] = useState(false) // modal secundário: produtividade padrão por pessoa
  const [verSel, setVerSel] = useState('') // versão salva selecionada no combo
  const [openSrv, setOpenSrv] = useState<Set<string>>(new Set()) // obras expandidas (linhas de serviço)
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
  // Gantt integrado à DIREITA das colunas (estilo MS Project) — linha do tempo mensal + barras por serviço
  const [ganttWide, setGanttWide] = useState(false) // true = encobre as colunas de dados (Gantt toma o lugar)
  const [durDias, setDurDias] = useState(false) // Duração em meses ou dias (clique no título da coluna alterna)
  const fmtDur = (meses: number) => durDias ? `${meses * 30}d` : `${meses}m`
  const [fSrv, setFSrv] = useState<Set<string>>(new Set()) // filtro de serviço (Fundação/Montagem/Lançamento) — vazio = todos
  const DRVF = useMemo(() => DRV.filter(d => fSrv.size === 0 || fSrv.has(d.label)), [fSrv])
  const CW = 34, NAMEW = 280
  const gantt = useMemo(() => {
    let minYM = '', maxYM = ''
    for (const [, obras] of grupos) for (const o of obras) {
      for (const d of o.drivers) {
        if (!(d.contr > 0)) continue
        const i = (effIni(o, d.label) || '').slice(0, 7), f = (effFim(o, d.label) || '').slice(0, 7)
        if (i && (!minYM || i < minYM)) minYM = i
        if (f && (!maxYM || f > maxYM)) maxYM = f
      }
      const pz = o.fim ? o.fim.slice(0, 7) : ''
      if (pz && (!maxYM || pz > maxYM)) maxYM = pz
    }
    if (!minYM) minYM = startYM()
    if (!maxYM || maxYM < minYM) maxYM = shiftYM(minYM, 11)
    const nM = Math.min(48, Math.max(12, ymNum(maxYM) - ymNum(minYM) + 1))
    return { minYM, nM, meses: Array.from({ length: nM }, (_, i) => shiftYM(minYM, i)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, cfg])
  const GW = gantt.nM * CW
  const gIx = (ym: string) => Math.max(0, Math.min(gantt.nM - 1, ymNum(ym) - ymNum(gantt.minYM)))
  const hojeIx = (() => { const d = ymNum(startYM()) - ymNum(gantt.minYM); return d >= 0 && d < gantt.nM ? d : null })()

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
          {/* Equipe por obra — toolbar única: versões (select) à esquerda, ferramentas de preenchimento à direita */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <select value={verSel} onChange={e => { const id = e.target.value; setVerSel(id); const v = versoes.find(x => x.id === id); if (v) { setCfg(normalize(v.config)); setNome(v.nome) } }}
                className={`min-w-[190px] text-[12px] font-semibold rounded-xl border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
                <option value="">Versões salvas…</option>
                {versoes.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
              {verSel && <button onClick={() => { excluir.mutate(verSel); setVerSel(''); setNome('') }} title="Excluir a versão selecionada" className={`p-1.5 rounded-xl border ${isDark ? 'border-white/15 text-slate-400 hover:text-rose-400' : 'border-slate-200 text-slate-400 hover:text-rose-500'}`}><Trash2 size={14} /></button>}
              <MultiSelect label="Serviço" options={DRV.map(d => ({ value: d.label, label: d.label }))} selected={fSrv} onToggle={v => setFSrv(s => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n })} onClear={() => setFSrv(new Set())} isDark={isDark} />
              <span className="flex-1" />
              {(() => {
                const todasObras = grupos.flatMap(([, obras]) => obras.map(o => o.nome))
                const tudoAberto = grpFechado.size === 0 && todasObras.length > 0 && todasObras.every(n => openSrv.has(n))
                const icone = `inline-flex items-center justify-center w-8 h-8 rounded-xl border transition disabled:opacity-40`
                return (<>
                  <button onClick={() => { if (tudoAberto) { setGrpFechado(new Set(grupos.map(([f]) => f))); setOpenSrv(new Set()) } else { setGrpFechado(new Set()); setOpenSrv(new Set(todasObras)) } }}
                    title={tudoAberto ? 'Recolher tudo (frentes e serviços)' : 'Expandir tudo (frentes e serviços)'}
                    className={`${icone} ${isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50 hover:text-teal-400' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-600'}`}>
                    {tudoAberto ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
                  </button>
                  <button onClick={() => setGanttWide(v => !v)} title={ganttWide ? 'Gantt: mostrar as colunas de dados de volta' : 'Gantt: encobrir as colunas de dados (só nome + linha do tempo)'} className={`${icone} ${ganttWide ? (isDark ? 'bg-teal-500/15 border-teal-500/40 text-teal-300' : 'bg-teal-50 border-teal-300 text-teal-700') : (isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-teal-500/50' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-400')}`}>{ganttWide ? <ChevronsUpDown size={15} className="rotate-90" /> : <ChevronsDownUp size={15} className="rotate-90" />}</button>
                  <button onClick={() => setProdOpen(true)} title={`Produtividade & Premissas — ${DRV.map(d => `${d.label} ${cfg.prodPP[d.label] ?? 0}`).join(' · ')} /pessoa·mês + precedência e realocação`} className={`${icone} ${isDark ? 'bg-slate-800/60 border-slate-700 text-teal-400 hover:border-teal-500/50' : 'bg-white border-slate-200 text-teal-600 hover:border-teal-400'}`}><Gauge size={15} /></button>
                  <button onClick={fillFromReal} disabled={efetivoTot === 0} title={efetivoTot === 0 ? 'Efetivo real (RH): sem efetivo' : `Efetivo real (RH) · ${efetivoTot} pessoas — distribui às obras ∝ saldo`} className={`${icone} ${isDark ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 hover:bg-teal-500/20' : 'bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100'}`}><Users size={15} /></button>
                  <button onClick={fillFromEquipes} disabled={equipesTot === 0} title={equipesTot === 0 ? 'Equipes (Obras): sem equipes alocadas' : `Equipes (Obras) · ${equipesTot} pessoas — alocação real por obra × frente (obra sem equipe fica 0)`} className={`${icone} ${isDark ? 'bg-violet-500/10 border-violet-500/40 text-violet-300 hover:bg-violet-500/20' : 'bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100'}`}><HardHat size={15} /></button>
                </>)
              })()}
              <button onClick={abrirPlan} title="Simula o portfólio por equipe-padrão e recursos críticos (rotor/perfuratriz/guindaste/comboio) e preenche início, término, predecessão e recursos" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition"><Sparkles size={14} /> Planejamento Automático</button>
            </div>
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              {/* overflow-x-scroll (não auto) + altura presa ao viewport: a barra horizontal fica SEMPRE visível acima do rodapé fixo */}
              <div className="overflow-y-auto overflow-x-scroll" style={{ maxHeight: 'max(320px, calc(100vh - 380px))' }}>
              <div className="w-max min-w-full">
              {/* cabeçalho DENTRO do scroll (sticky) — colunas de dados (recolhíveis pelo botão Gantt) + linha do tempo à direita */}
              <div className={`sticky top-0 z-20 flex items-center gap-2 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider border-b ${isDark ? 'bg-slate-900 text-slate-500 border-white/[0.06]' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                <span className={`shrink-0 sticky left-0 z-10 pl-4 relative after:content-[''] after:absolute after:left-full after:inset-y-0 after:w-2 after:bg-inherit ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`} style={{ width: NAMEW }}>Obra</span>
                {!ganttWide && (<>
                <span className="w-[118px] text-center shrink-0" title="Início planejado (dd/mm/aaaa) — a obra não produz antes dele (digite ou clique no calendário)">Início</span>
                <span className="w-[118px] text-center shrink-0" title="Término planejado (dd/mm/aaaa) — quando definido, o ritmo é forçado pela data (saldo ÷ meses), ignorando a equipe desta obra">Término</span>
                <span className="w-14 text-center shrink-0" title="Prazo — limite contratual (vencimento da OSC mais tardia da obra)">Prazo</span>
                <span onClick={() => setDurDias(v => !v)} className="w-20 text-center shrink-0 cursor-pointer hover:text-teal-500 select-none" title="Duração projetada com a configuração atual — vermelho quando estoura o Prazo. CLIQUE pra alternar meses/dias">Duração ({durDias ? 'd' : 'm'})</span>
                <span className="w-40 text-center shrink-0" title="Obra predecessora — quando ela conclui um serviço, a equipe liberada vem pra esta obra (digite pra filtrar)">Predecessão</span>
                {DRVF.map(d => <span key={d.label} className="w-14 text-center shrink-0" style={{ color: d.cor }} title={d.label}>{d.label.slice(0, 4)}.</span>)}
                <span className="w-9 text-right shrink-0">total</span>
                </>)}
                {/* linha do tempo em 2 níveis: ano em cima, mês (3 letras) embaixo — legível a 34px/mês */}
                <div className="flex flex-col shrink-0 self-stretch justify-center tracking-normal" style={{ width: GW }}>
                  <div className="flex">
                    {(() => { const gs: { y: string; n: number }[] = []; for (const m of gantt.meses) { const y = m.slice(0, 4); const u = gs[gs.length - 1]; if (u && u.y === y) u.n++; else gs.push({ y, n: 1 }) } return gs.map((g, i) => <span key={i} className={`shrink-0 text-center text-[8px] font-bold border-l ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`} style={{ width: g.n * CW }}>{g.y}</span>) })()}
                  </div>
                  <div className="flex">
                    {gantt.meses.map(mm => <span key={mm} className={`shrink-0 text-center text-[8px] font-semibold border-l ${isDark ? 'border-white/[0.04] text-slate-500' : 'border-slate-100 text-slate-400'}`} style={{ width: CW }}>{ymLabel(mm).split('/')[0]}</span>)}
                  </div>
                </div>
              </div>
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
                        <span className={`text-[11px] font-bold tabular-nums ml-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{totFr > 0 ? `· ${totFr} pessoas` : ''}</span>
                      </button>
                      {!fechado && obras.map(o => { const eq = cfg.equipe[o.nome] ?? {}; const tot = DRV.reduce((s, d) => s + (eq[d.label] || 0), 0); const aberto = openSrv.has(o.nome)
                        // barra-resumo da obra (janela total: menor início → maior término); serviços têm barra própria quando expandidos
                        const gIni = (obraIniVal(o) || '').slice(0, 7), gFim = (obraFimVal(o) || '').slice(0, 7)
                        const gPz = o.fim ? o.fim.slice(0, 7) : ''
                        return (
                        <div key={o.nome}>
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                          <span className={`shrink-0 sticky left-0 z-10 min-w-0 flex items-center text-[11px] relative after:content-[''] after:absolute after:left-full after:inset-y-0 after:w-2 after:bg-inherit ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'}`} style={{ width: NAMEW }}>
                            <button type="button" onClick={() => setOpenSrv(s => { const n = new Set(s); n.has(o.nome) ? n.delete(o.nome) : n.add(o.nome); return n })} title={aberto ? 'Recolher serviços' : 'Abrir serviços (Prelim./Fundação/Montagem/Lançamento/Outros)'} className="shrink-0 p-0.5 mr-0.5 opacity-60 hover:opacity-100">{aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                            <span className="truncate flex-1 min-w-0" title={`${o.nome} · físico ${o.pctFis}%`}>{o.nome} <span className="opacity-50">· {o.pctFis}%</span></span>
                            <button type="button" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setRecalcMenu(m => m?.obra === o.nome ? null : { obra: o.nome, x: r.left, y: r.bottom + 4 }) }} title="Recalcular esta obra — prazo pela equipe ou equipe pelo prazo" className={`shrink-0 ml-1 mr-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-bold transition ${recalcMenu?.obra === o.nome ? 'bg-teal-600 border-teal-600 text-white' : (isDark ? 'border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20' : 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100')}`}><RefreshCw size={11} /> recalc</button>
                          </span>
                          {!ganttWide && (<>
                          <input type="date" value={d8(obraIniVal(o))} onChange={e => setInicio(o.nome, e.target.value)} title="Início da obra = menor início dos serviços — EDITAR aplica a data a TODOS os serviços" className={`w-[118px] shrink-0 text-[11px] rounded-lg border px-1 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`} />
                          <input type="date" value={d8(obraFimVal(o))} onChange={e => setFim(o.nome, e.target.value)} title="Término da obra = maior término dos serviços — EDITAR força o ritmo pela data em TODOS os serviços" className={`w-[118px] shrink-0 text-[11px] rounded-lg border px-1 py-0.5 outline-none ${obraFimVal(o) ? 'border-violet-400' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`} />
                          {(() => {
                            const prazo = o.fim ? o.fim.slice(0, 7) : null
                            const pj = fimMap[o.nome]
                            const estoura = !!(prazo && pj?.termino && pj.termino > prazo)
                            return (<>
                              <span className={`w-14 shrink-0 text-center text-[10px] font-semibold tabular-nums whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`} title="Limite contratual (vencimento da OSC mais tardia)">{prazo ? ymLabel(prazo) : '—'}</span>
                              <span className={`w-20 shrink-0 text-center text-[10px] font-semibold tabular-nums whitespace-nowrap ${estoura ? 'text-rose-500' : 'text-violet-500'}`} title={`${estoura ? 'ESTOURA o prazo contratual — ' : ''}término projetado: ${pj?.termino ? ymLabel(pj.termino) : '—'}`}>{pj?.meses ? fmtDur(pj.meses) : '—'}</span>
                            </>)
                          })()}
                          <PredCombo value={cfg.pred?.[o.nome] ?? ''} options={predOpts.filter(n => n !== o.nome)} onPick={v => setPred(o.nome, v)} isDark={isDark} />
                          {DRVF.map(d => { const has = o.drivers.some(x => x.label === d.label && x.contr > 0); return (
                            <input key={d.label} type="number" min="0" disabled={!has} value={has ? (eq[d.label] ?? 0) : ''} placeholder={has ? '' : '—'} onChange={e => setEquipe(o.nome, d.label, Number(e.target.value))} className={`w-14 shrink-0 text-center text-[12px] font-semibold rounded-lg border px-1 py-0.5 outline-none ${!has ? 'opacity-30 cursor-not-allowed' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                          ) })}
                          <span className={`w-9 shrink-0 text-right text-[12px] font-bold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{tot}</span>
                          </>)}
                          {/* trilha do Gantt (mesma linha) */}
                          <div className="relative shrink-0 self-stretch" style={{ width: GW }}>
                            {gantt.meses.map((_, i2) => <span key={i2} className={`absolute top-0 bottom-0 border-l ${isDark ? 'border-white/[0.03]' : 'border-slate-100/80'}`} style={{ left: i2 * CW }} />)}
                            {hojeIx != null && <span className="absolute top-0 bottom-0 w-px bg-teal-500/60" style={{ left: hojeIx * CW + CW / 2 }} title="hoje" />}
                            {gIni && gFim && gFim >= gIni && (
                              <span className="absolute rounded" title={`${o.nome}: ${ymLabel(gIni)} → ${ymLabel(gFim)}`}
                                style={{ left: gIx(gIni) * CW + 1, width: Math.max(8, (gIx(gFim) - gIx(gIni) + 1) * CW - 2), top: 'calc(50% - 5px)', height: 10, background: isDark ? '#64748b' : '#334155' }} />
                            )}
                            {gPz && ymNum(gPz) >= ymNum(gantt.minYM) && ymNum(gPz) - ymNum(gantt.minYM) < gantt.nM && (
                              <span className="absolute w-[3px] top-1 bottom-1 bg-rose-500 rounded" style={{ left: gIx(gPz) * CW + CW - 3 }} title={`prazo CEMIG: ${ymLabel(gPz)}`} />
                            )}
                          </div>
                        </div>
                        {/* linhas de serviço — datas por serviço (override vence a obra); equipe só na coluna do próprio tipo */}
                        {aberto && (() => {
                          const srvRows: { key: string; cor: string; nome: string; info: string; drv?: string; marcos?: string }[] = []
                          if (o.prelR > 0 && fSrv.size === 0) srvRows.push({ key: 'prel', cor: COR_PREL, nome: 'Serv. Preliminares', info: `Prelim. + Canteiro · ${fmtM(o.prelR)}`, marcos: 'marcos Fund.' })
                          o.drivers.filter(d => d.contr > 0 && (fSrv.size === 0 || fSrv.has(d.label))).forEach(d => srvRows.push({ key: d.label, cor: d.cor, nome: d.label, info: `${fmtQ(d.saldoQ)} ${d.uni} · ${fmtM(d.saldoR)}`, drv: d.label }))
                          if (o.outrosR > 0 && fSrv.size === 0) srvRows.push({ key: 'outros', cor: COR_OUTROS, nome: 'Outros Serviços', info: `desmont/conf/aterr · ${fmtM(o.outrosR)}`, marcos: 'marcos Mont.' })
                          const cell = 'w-[118px] shrink-0'
                          return srvRows.map(r => {
                            const nm = r.drv ? (fimMap[o.nome]?.srv[r.drv] ?? 0) : 0
                            const si = r.drv ? (effIni(o, r.drv) || '').slice(0, 7) : ''
                            const sf = r.drv ? (effFim(o, r.drv) || '').slice(0, 7) : ''
                            return (
                              <div key={r.key} className={`flex items-center gap-2 px-2.5 py-1 border-b last:border-0 ${isDark ? 'border-white/[0.03] bg-white/[0.02]' : 'border-slate-50 bg-slate-50/60'}`}>
                                <span className={`shrink-0 sticky left-0 z-10 min-w-0 truncate pl-9 text-[10px] relative after:content-[''] after:absolute after:left-full after:inset-y-0 after:w-2 after:bg-inherit ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'}`} style={{ width: NAMEW }}><span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: r.cor }} /><b className={isDark ? 'text-slate-300' : 'text-slate-600'}>{r.nome}</b> <span className="opacity-60">{r.info}</span></span>
                                {!ganttWide && (r.drv ? (<>
                                  <input type="date" value={d8(effIni(o, r.drv))} onChange={e => setInicioSrv(o.nome, r.drv!, e.target.value)} title="Início deste serviço (dd/mm/aaaa — sobrescreve a obra)" className={`${cell} text-[11px] rounded-lg border px-1 py-0.5 outline-none ${cfg.inicioS?.[o.nome]?.[r.drv] ? 'border-teal-400' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`} />
                                  <input type="date" value={d8(effFim(o, r.drv))} onChange={e => setFimSrv(o.nome, r.drv!, e.target.value)} title="Término deste serviço (dd/mm/aaaa) — força o ritmo pela data (sobrescreve a obra)" className={`${cell} text-[11px] rounded-lg border px-1 py-0.5 outline-none ${cfg.fimS?.[o.nome]?.[r.drv] ? 'border-violet-400' : ''} ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-700'}`} />
                                  <span className="w-14 shrink-0" />
                                  <span className="w-20 shrink-0 text-center text-[10px] font-semibold tabular-nums whitespace-nowrap text-violet-500" title={`Duração projetada deste serviço — término: ${nm > 0 ? ymLabel(shiftYM(start0, nm - 1)) : '—'}`}>{nm > 0 ? fmtDur(nm) : '—'}</span>
                                  <span className="w-40 shrink-0" />
                                  {DRVF.map(d => d.label === r.drv ? (
                                    <input key={d.label} type="number" min="0" value={eq[d.label] ?? 0} onChange={e => setEquipe(o.nome, d.label, Number(e.target.value))} className={`w-14 shrink-0 text-center text-[12px] font-semibold rounded-lg border px-1 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                                  ) : <span key={d.label} className="w-14 shrink-0" />)}
                                  <span className="w-9 shrink-0" />
                                </>) : (<>
                                  <span className={cell} /><span className={cell} /><span className="w-14 shrink-0" />
                                  <span className={`w-20 shrink-0 text-center text-[9px] whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title="Mede por marcos do serviço âncora (25% a cada 25%)">{r.marcos}</span>
                                  <span className="w-40 shrink-0" />{DRVF.map(d => <span key={d.label} className="w-14 shrink-0" />)}<span className="w-9 shrink-0" />
                                </>))}
                                {/* trilha do serviço no Gantt */}
                                <div className="relative shrink-0 self-stretch" style={{ width: GW }}>
                                  {gantt.meses.map((_, i2) => <span key={i2} className={`absolute top-0 bottom-0 border-l ${isDark ? 'border-white/[0.02]' : 'border-slate-100/60'}`} style={{ left: i2 * CW }} />)}
                                  {hojeIx != null && <span className="absolute top-0 bottom-0 w-px bg-teal-500/40" style={{ left: hojeIx * CW + CW / 2 }} />}
                                  {si && sf && sf >= si
                                    ? <span className="absolute rounded-sm" title={`${r.nome}: ${ymLabel(si)} → ${ymLabel(sf)}`} style={{ left: gIx(si) * CW + 1, width: Math.max(6, (gIx(sf) - gIx(si) + 1) * CW - 2), top: 'calc(50% - 4px)', height: 8, background: r.cor }} />
                                    : r.marcos && <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{r.marcos}</span>}
                                </div>
                              </div>
                            )
                          })
                        })()}
                        </div>
                      ) })}
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
            <div className={`flex items-center gap-3 mt-1.5 flex-wrap text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span>Total: <b>{totPessoas} pessoas</b> · nº pessoas × produtividade/pessoa (drivers ausentes ficam desabilitados)</span>
              <span className="inline-flex items-center gap-1"><span className={`w-4 h-[9px] rounded inline-block ${isDark ? 'bg-slate-500' : 'bg-slate-700'}`} />obra (janela)</span>
              {DRV.map(d => <span key={d.label} className="inline-flex items-center gap-1"><span className="w-3 h-[5px] rounded-sm inline-block" style={{ background: d.cor }} />{d.label}</span>)}
              <span className="inline-flex items-center gap-1"><span className="w-[3px] h-3 bg-rose-500 rounded inline-block" />prazo CEMIG</span>
              <span className="inline-flex items-center gap-1"><span className="w-px h-3 bg-teal-500 inline-block" />hoje</span>
            </div>
          </div>

        </div>
        {/* Menu de recálculo por obra (⟳) — portal p/ não ser cortado pelo scroll */}
        {recalcMenu && createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setRecalcMenu(null)} />
            <div className={`fixed z-[71] w-64 rounded-xl border shadow-2xl p-1 ${isDark ? 'bg-slate-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} style={{ left: Math.min(recalcMenu.x, window.innerWidth - 268), top: recalcMenu.y }}>
              <p className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{recalcMenu.obra}</p>
              <button onClick={() => { recalcPrazo(recalcMenu.obra); setRecalcMenu(null) }} className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
                <Clock size={14} className="shrink-0 mt-0.5 text-violet-500" />
                <span><span className="block text-[12px] font-semibold">Recalcular prazo</span><span className={`block text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>pela equipe atual (ex.: dobrei a equipe → antecipa o término)</span></span>
              </button>
              <button onClick={() => { recalcEquipe(recalcMenu.obra); setRecalcMenu(null) }} className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-lg text-left ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'}`}>
                <Users size={14} className="shrink-0 mt-0.5 text-teal-500" />
                <span><span className="block text-[12px] font-semibold">Recalcular equipe</span><span className={`block text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>pelo prazo atual (ex.: mudei a Data Fim → nº de pessoas necessário)</span></span>
              </button>
            </div>
          </>, document.body)}
        {/* Modal secundário: produtividade padrão por pessoa + premissas de precedência/realocação */}
        {prodOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setProdOpen(false)}>
            <div className={`w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b sticky top-0 z-10 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                <h3 className="text-[13px] font-bold flex items-center gap-2"><Gauge size={14} className="text-teal-500" /> Produtividade &amp; Premissas</h3>
                <button onClick={() => setProdOpen(false)} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={14} /></button>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className={lbl}>Produtividade por pessoa (por mês)</p>
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
                <p className={`${lbl} pt-2`}>Premissas — precedência entre serviços</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span onClick={() => setCfg(c => ({ ...c, precedencia: !(c.precedencia !== false) }))} className={`w-9 h-5 rounded-full p-0.5 transition ${cfg.precedencia !== false ? 'bg-teal-600' : (isDark ? 'bg-white/15' : 'bg-slate-300')}`}><span className={`block w-4 h-4 rounded-full bg-white transition ${cfg.precedencia !== false ? 'translate-x-4' : ''}`} /></span>
                  <span className="text-[12px] font-semibold">Fundação libera Montagem · Montagem libera Lançamento</span>
                </label>
                {cfg.precedencia !== false && (
                  <div className="flex items-center gap-2 text-[11px] pl-1">
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Defasagem (meses) entre liberar e iniciar o próximo:</span>
                    <input type="number" min="0" max="12" value={cfg.lag || 0} onChange={e => setCfg(c => ({ ...c, lag: Math.max(0, Number(e.target.value)) }))} className={`w-14 text-[12px] font-semibold rounded-lg border px-1.5 py-0.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                  </div>
                )}
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Montagem não avança além do % de fundação já concluído (volume liberado); lançamento idem em relação à montagem.</p>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <span onClick={() => setCfg(c => ({ ...c, realoc: !c.realoc }))} className={`w-9 h-5 rounded-full p-0.5 transition ${cfg.realoc ? 'bg-teal-600' : (isDark ? 'bg-white/15' : 'bg-slate-300')}`}><span className={`block w-4 h-4 rounded-full bg-white transition ${cfg.realoc ? 'translate-x-4' : ''}`} /></span>
                  <span className="text-[12px] font-semibold">Realocação automática — equipe liberada migra pra obra sucessora</span>
                </label>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quando um serviço conclui numa obra, a equipe dele vai pra obra que apontou esta como <b>Predecessão</b> (seguindo a cadeia) — a produção lá só começa a partir da <b>Data Início</b>. <b>Data Fim</b> preenchida força o ritmo pela data (saldo ÷ meses), ignorando a equipe daquela obra. Sem realocação, use as datas pra planejar as ondas manualmente.</p>
              </div>
              <div className={`flex justify-end px-4 py-2.5 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                <button onClick={() => setProdOpen(false)} className="px-3 py-1 rounded-lg text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700">OK</button>
              </div>
            </div>
          </div>
        )}
        {/* Mini modal: Planejamento Automático — equipes-padrão + recursos críticos */}
        {planOpen && (() => {
          const pin = `w-16 text-center text-[12px] font-bold rounded-lg border px-1.5 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`
          const plbl = `text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`
          const setP = (k: keyof PlanParams, v: number) => { setPlanP(pp => ({ ...pp, [k]: Math.max(0, v) })); setPlanRes(null) }
          const campo = (rot: string, k: keyof PlanParams, title: string, step = 1) => (
            <label className="flex items-center gap-1.5" title={title}>
              <input type="number" min="0" step={step} value={planP[k] as number} onChange={e => setP(k, Number(e.target.value))} className={pin} />
              <span className="text-[11px] font-semibold">{rot}</span>
            </label>
          )
          const start = startYM()
          const dt = (i: number) => ymLabel(shiftYM(start, i))
          const planejaveis = allObras.filter(o => o.drivers.some(d => d.contr > 0 && d.saldoQ > 0))
          return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPlanOpen(false)}>
            <div className={`w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b sticky top-0 z-10 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                <h3 className="text-[13px] font-bold flex items-center gap-2"><Sparkles size={14} className="text-teal-500" /> Planejamento Automático — equipes-padrão + recursos críticos</h3>
                <button onClick={() => setPlanOpen(false)} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={14} /></button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <p className={`${plbl} mb-1.5`}>Equipes disponíveis</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {campo('equipes de Fundação (7 pessoas · 100 m³/mês)', 'eqF', 'Equipe-padrão de fundação: 7 pessoas → 100 m³/mês prevista')}
                    {campo('equipes de Mont./Lanç. (12 pessoas)', 'eqML', 'Equipe-padrão de montagem/lançamento: 12 pessoas; pré-montagem 1 torre/dia; lançamento junta 2-3 equipes')}
                  </div>
                </div>
                <div>
                  <p className={`${plbl} mb-1.5`}>Recursos críticos</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {campo('rotores', 'rotores', 'Porteiro da fundação: cada frente ocupa 1 rotor — máx. de frentes de fundação simultâneas')}
                    {campo('perfuratrizes', 'perfuratrizes', 'Multiplica a fundação ×4 — só compensa em obra com mais de 10 torres')}
                    {campo('guindastes', 'guindastes', 'Multiplica a montagem ×10 (10 torres/dia); obra acima do limiar só monta com guindaste')}
                    {campo('comboios', 'comboios', 'Porteiro do lançamento (puller-freio + munck + prensa): sem comboio a frente não abre')}
                  </div>
                </div>
                <div>
                  <p className={`${plbl} mb-1.5`}>Parâmetros</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-1.5" title="Fator residual (material/clima/retrabalho) sobre a produtividade prevista — calibrar com o realizado">
                      <input type="number" min="5" max="100" step="5" value={Math.round(planP.residual * 100)} onChange={e => { setPlanP(pp => ({ ...pp, residual: Math.min(1, Math.max(0.05, Number(e.target.value) / 100)) })); setPlanRes(null) }} className={pin} />
                      <span className="text-[11px] font-semibold">% eficiência</span>
                    </label>
                    {campo('torres: limiar do guindaste', 'limiarGuind', 'Obra com mais torres que isso NÃO monta sem guindaste (espera na fila); abaixo, monta manual a 1 torre/dia')}
                    {campo('equipes por frente de lançamento', 'eqPorLanc', 'Frente de lançamento consome 2-3 equipes de 12 + 1 comboio → 15 km/mês')}
                    <label className="flex items-center gap-1.5" title="Opcional: data-alvo pro portfólio — calcula o reforço MÍNIMO de equipes que cumpre">
                      <input type="month" value={planAlvo} onChange={e => { setPlanAlvo(e.target.value); setPlanRes(null) }} className={`w-[120px] text-[12px] rounded-lg border px-1.5 py-1 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`} />
                      <span className="text-[11px] font-semibold">data-alvo (opcional)</span>
                    </label>
                  </div>
                </div>
                <details>
                  <summary className={`cursor-pointer text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Obras embargadas / fora do plano {planExc.size > 0 ? `(${planExc.size} excluída${planExc.size > 1 ? 's' : ''})` : ''}</summary>
                  <div className={`mt-1.5 max-h-40 overflow-auto rounded-lg border p-1.5 space-y-0.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    {planejaveis.map(o => (
                      <label key={o.nome} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input type="checkbox" checked={planExc.has(o.nome)} onChange={() => togglePlanExc(o.nome)} />
                        <span className="truncate">{o.nome} <span className={`font-semibold ${o.pctFis > 85 ? 'text-amber-500' : 'opacity-50'}`}>· {o.pctFis}%</span></span>
                      </label>
                    ))}
                  </div>
                </details>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Simula o portfólio mês a mês: prioridade = <b>prazo CEMIG × volume R$</b>; fundação ∥ pré-montagem → montagem → lançamento; equipes e recursos migram entre obras (1º mês de frente nova = mobilização, 50%). Torres vêm do <b>qtd_torres das OSCs</b> (Iniciação); sem lançamento, estima ~3/km e avisa. As datas são <b>resultado</b> — depois de preencher, revise na tabela e clique Aplicar.</p>
                <button onClick={simular} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border ${isDark ? 'border-teal-500/40 text-teal-300 bg-teal-500/10 hover:bg-teal-500/20' : 'border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100'}`}><Gauge size={13} /> Simular</button>

                {planRes && (
                  <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
                    <p className="text-[12px] font-bold">Término geral: <span className="text-violet-500">{planRes.fimGeral >= 0 ? `${dt(planRes.fimGeral)} (${planRes.fimGeral + 1} meses)` : '—'}</span></p>
                    {planRes.inconclusas.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-rose-500 mb-0.5">⚠ NÃO CONCLUEM nem em 10 anos — gargalo permanente ({planRes.inconclusas.length}):</p>
                        {planRes.inconclusas.slice(0, 8).map(i => <p key={i.nome} className="text-[10px] text-rose-400 truncate">· {i.nome} — {i.motivo}</p>)}
                      </div>
                    )}
                    {planAlvo && (planRes.reforco
                      ? <p className="text-[11px] font-semibold text-emerald-500">Reforço mínimo pro alvo: +{planRes.reforco.eqF} equipe(s) de fundação e +{planRes.reforco.eqML} de mont./lanç. → termina {dt(planRes.reforco.fimIdx)}</p>
                      : planRes.fimGeral > (Math.max(0, ymNum(planAlvo) - ymNum(start))) && <p className="text-[11px] font-semibold text-rose-500">Nem +5/+5 equipes cumprem o alvo — o gargalo é recurso crítico (guindaste/rotor/comboio).</p>)}
                    {planRes.estouros.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-rose-500 mb-0.5">Estouros de prazo CEMIG ({planRes.estouros.length}):</p>
                        {planRes.estouros.slice(0, 8).map(e => <p key={e.nome} className="text-[10px] text-rose-400 truncate">· {e.nome} — termina {dt(e.fimIdx)}, prazo {dt(e.prazoIdx)} (+{e.fimIdx - e.prazoIdx}m)</p>)}
                      </div>
                    )}
                    {(() => { const esp = Object.entries(planRes.obras).filter(([, o]) => o.esperas.length).slice(0, 8); return esp.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-amber-500 mb-0.5">Esperas de recurso (onde a gestão recupera prazo):</p>
                        {esp.map(([n, o]) => <p key={n} className={`text-[10px] truncate ${isDark ? 'text-amber-300/80' : 'text-amber-600'}`}>· {n}: {o.esperas.join(' · ')}</p>)}
                      </div>
                    ) })()}
                    {planRes.torresEstimadas.length > 0 && (
                      <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><b>Torres estimadas por km</b> (lançar qtd_torres na Iniciação): {planRes.torresEstimadas.join(' · ')}</p>
                    )}
                  </div>
                )}
              </div>
              <div className={`flex justify-end gap-2 px-4 py-2.5 border-t sticky bottom-0 ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                <button onClick={preencherPlano} disabled={!planRes} title={planRes ? 'Grava início/término por serviço, predecessão e recursos na tabela — revise e clique Aplicar' : 'Simule primeiro'} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"><Sparkles size={13} /> Preencher Cronograma</button>
              </div>
            </div>
          </div>
          )
        })()}
        {/* Footer */}
        <div className={`flex items-center gap-2 px-5 py-3 border-t sticky bottom-0 rounded-b-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="nome da versão" className={`flex-1 text-sm rounded-lg border px-3 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-800'}`} />
          <button onClick={() => salvar.mutate()} disabled={!nome.trim() || salvar.isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border disabled:opacity-40 ${isDark ? 'border-white/15 text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Save size={14} /> Salvar versão</button>
          <button onClick={() => onAplicar(cfg, nome.trim() || undefined)} title="Aplica a configuração e volta pra Projeção" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700"><Sparkles size={14} /> Aplicar</button>
        </div>
      </div>
  )
}
