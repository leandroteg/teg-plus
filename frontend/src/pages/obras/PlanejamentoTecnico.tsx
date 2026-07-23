// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/PlanejamentoTecnico.tsx — aba "Planejamento" da Gestão de Obras.
// Réplica da planilha "ACOMPANHAMENTO MODELO": matriz ATIVIDADES (catálogo
// padrão, por seção) × ESTRUTURAS/TORRES da obra. Cada célula = DATA + AVANÇO.
// Bloco esquerdo: QTD PREV · EXECUTADO (qtd/%) · FALTANTE. Tabelas:
// obr_estruturas (colunas) + obr_atividade_avanco (células).
// O preenchimento do RDO atualizará estas células (integração futura).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Loader2, Search } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePortfolios, useObrasDoPortfolio, useOSCsDoPortfolio, useEAPFinal, useProjetos, type EGPOscRow } from '../../hooks/usePMO'
import { buildTree } from '../pmo/paineis/cronogramaEngine'
import { MultiSelect, togFiltro } from '../pmo/paineis/egpFiltros'

// faixas de % (padrão da tela do EGP: 0 / 1–25 / 26–50 / 51–75 / 76–90 / 91–99 / 100)
const BANDS: [string, string, (p: number) => boolean][] = [
  ['0', '0%', p => p <= 0], ['1-25', '1–25%', p => p >= 1 && p <= 25], ['26-50', '26–50%', p => p >= 26 && p <= 50],
  ['51-75', '51–75%', p => p >= 51 && p <= 75], ['76-90', '76–90%', p => p >= 76 && p <= 90],
  ['91-99', '91–99%', p => p >= 91 && p <= 99], ['100', '100%', p => p >= 100],
]
const normNome = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Catálogo padrão (planilha ACOMPANHAMENTO MODELO — 32 atividades por seção)
const CATALOGO: { secao: string; atividades: string[] }[] = [
  { secao: 'Preliminar Fundação', atividades: [
    'CONFERÊNCIA TOPOGRÁFICA', 'LOCAÇÃO DE CAVAS', 'ABERTURA E IDENTIFICAÇÃO DE ACESSO',
  ]},
  { secao: 'Fundação', atividades: [
    'ARMAÇÃO/MONTAGEM DE FERRAGENS', 'ESCAVAÇÃO DE CAVAS', 'NIVELAMENTO DE STUBS E FORMAS',
    'CONCRETAGEM DE FUNDAÇÃO', 'RETIRADA DE FORMAS',
  ]},
  { secao: 'Aterramento', atividades: [
    'INSTALAÇÃO DE FIO CONTRAPESO', 'MEDIÇÃO DE RESISTÊNCIA',
  ]},
  { secao: 'Montagem', atividades: [
    'CONFERÊNCIA DE POSIÇÕES', 'TRANSPORTE DE FERRAGENS PARA O CAMPO', 'PRÉ-MONTAGEM DE ESTRUTURAS',
    'MONTAGEM DE ESTRUTURAS', 'REVISÃO DE ESTRUTURAS',
  ]},
  { secao: 'Lançamento', atividades: [
    'ABERTURA DE FAIXA DE SERVIDÃO', 'PREPARAÇÃO CONDUTOR', 'LANÇAMENTO DE CABOS CONDUTORES',
    'NIVELAMENTO DE CABOS CONDUTOR', 'GRAMPEAÇÃO E ENCABEÇAMENTO DE CONDUTOR', 'REVISÃO FINAL DE CABO CONDUTOR',
    'PREPARAÇÃO DE CABO PARA-RAIO', 'LANÇAMENTO DE CABO PARA-RAIO', 'NIVELAMENTO DE CABO PARA-RAIO',
    'GRAMPEAÇÃO E ENCABEÇAMENTO DE PARA-RAIO', 'REVISÃO FINAL DE CABO PARA-RAIO', 'INSTALAÇÃO DE SINALIZAÇÃO AÉREA',
  ]},
  { secao: 'Acabamento', atividades: [
    'SECCIONAMENTO E ATERRAMENTO DE CERCAS', 'PINTURA, NUMERAÇÃO, ETC', 'ACABAMENTO FINAL DE SOLO - PRAD',
  ]},
  { secao: 'Outros', atividades: [
    'COMISSIONAMENTO FINAL', 'ENERGIZAÇÃO',
  ]},
]
const SECAO_COR: Record<string, string> = {
  'Preliminar Fundação': '#64748b', 'Fundação': '#f59e0b', 'Aterramento': '#10b981',
  'Montagem': '#6366f1', 'Lançamento': '#0ea5e9', 'Acabamento': '#8b5cf6', 'Outros': '#94a3b8',
}

interface Estrutura { id: string; obra_id: string; nome: string; tipo: string | null; peso_ton: number | null; dist_prox_m: number | null; ordem: number }
interface Celula { id: string; estrutura_id: string; atividade: string; data: string | null; avanco: number; responsavel_nome: string | null }

function useEstruturas(obraId?: string) {
  return useQuery<Estrutura[]>({
    queryKey: ['obr-estruturas', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_estruturas').select('*').eq('obra_id', obraId!).order('ordem').order('nome')
      return (data ?? []) as Estrutura[]
    },
  })
}
function useCelulas(obraId?: string) {
  return useQuery<Celula[]>({
    queryKey: ['obr-ativ-avanco', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_atividade_avanco').select('id, estrutura_id, atividade, data, avanco, responsavel_nome').eq('obra_id', obraId!)
      return (data ?? []) as Celula[]
    },
  })
}

export default function PlanejamentoTecnico() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const { data: portfolios = [] } = usePortfolios()
  const [pid, setPid] = useState('')
  const portfolioId = pid || portfolios[0]?.id
  const { data: obras = [] } = useObrasDoPortfolio(portfolioId)
  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const { data: raw } = useEAPFinal(portfolioId)
  const [obraId, setObraId] = useState('')

  // filtros (todos na 1ª linha, padrão EGP)
  const [fProjeto, setFProjeto] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fValor, setFValor] = useState('')
  const [fAno, setFAno] = useState('')
  const [fFat, setFFat] = useState<Set<string>>(new Set())
  const [fPrazo, setFPrazo] = useState<Set<string>>(new Set())
  const [fExec, setFExec] = useState<Set<string>>(new Set())

  // métricas por obra (OSCs + medição + engine EAP) pra alimentar os filtros
  const oscsPorObra = useMemo(() => {
    const m = new Map<string, EGPOscRow[]>()
    for (const o of oscs) {
      if (!o.obra_id || o.etapa_atual === 'cancelada') continue
      const a = m.get(o.obra_id) ?? []; a.push(o); m.set(o.obra_id, a)
    }
    return m
  }, [oscs])
  const { data: finPorOsc } = useQuery<Map<string, { acum: number; valor: number }>>({
    queryKey: ['obr-fin-por-osc'],
    queryFn: async () => {
      const { data } = await supabase.from('pmo_osc_itens').select('fluxo_os_id, valor, valor_acum')
      const m = new Map<string, { acum: number; valor: number }>()
      for (const it of data ?? []) {
        const k = String(it.fluxo_os_id)
        const cur = m.get(k) ?? { acum: 0, valor: 0 }
        cur.acum += Number(it.valor_acum ?? 0); cur.valor += Number(it.valor ?? 0)
        m.set(k, cur)
      }
      return m
    },
    staleTime: 5 * 60_000,
  })
  const fisPorNome = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of buildTree(raw)) for (const o of f.obras) m.set(normNome(o.nome), o.pctFis)
    return m
  }, [raw])

  const hoje = new Date().toISOString().slice(0, 10)
  const metricas = useMemo(() => {
    const m = new Map<string, { pctFat: number | null; pctPrazo: number | null; pctExec: number | null }>()
    for (const o of obras) {
      const arr = oscsPorObra.get(o.id) ?? []
      let acum = 0, valor = 0
      let minI: string | null = null, maxP: string | null = null
      for (const x of arr) {
        const f = finPorOsc?.get(x.id); if (f) { acum += f.acum; valor += f.valor }
        const di = x.data_osc?.slice(0, 10); if (di && (!minI || di < minI)) minI = di
        const dv = x.vencimento?.slice(0, 10); if (dv && (!maxP || dv > maxP)) maxP = dv
      }
      let pctPrazo: number | null = null
      if (minI && maxP && maxP > minI) {
        const tot = new Date(maxP).getTime() - new Date(minI).getTime()
        const dec = new Date(hoje).getTime() - new Date(minI).getTime()
        pctPrazo = Math.max(0, Math.min(100, Math.round((dec / tot) * 100)))
      }
      m.set(o.id, {
        pctFat: valor > 0 ? Math.round((acum / valor) * 100) : null,
        pctPrazo,
        pctExec: fisPorNome.get(normNome(o.nome)) ?? null,
      })
    }
    return m
  }, [obras, oscsPorObra, finPorOsc, fisPorNome, hoje])

  const bandOk = (sel: Set<string>, p: number | null) =>
    sel.size === 0 || (p != null && BANDS.some(b => sel.has(b[0]) && b[2](p)))

  const anos = useMemo(() => [...new Set(oscs.map(o => (o.data_osc ?? '').slice(0, 4)).filter(Boolean))].sort().reverse(), [oscs])
  const tipos = useMemo(() => [...new Set(oscs.map(o => o.tipo).filter(Boolean))] as string[], [oscs])

  // obras filtradas → alimentam o select de Obra
  const obrasFiltradas = useMemo(() => obras.filter(o => {
    if (fProjeto && o.pmo_projeto_id !== fProjeto) return false
    const arr = oscsPorObra.get(o.id) ?? []
    if (fTipo && !arr.some(x => x.tipo === fTipo)) return false
    if (fAno && !arr.some(x => (x.data_osc ?? '').slice(0, 4) === fAno)) return false
    if (fValor) {
      const ok = arr.some(x => {
        const v = x.valor ?? 0
        if (fValor === 'gt1m') return v > 1_000_000
        if (fValor === 'mid') return v >= 100_000 && v <= 1_000_000
        return v < 100_000
      })
      if (!ok) return false
    }
    const met = metricas.get(o.id)
    if (!bandOk(fFat, met?.pctFat ?? null)) return false
    if (!bandOk(fPrazo, met?.pctPrazo ?? null)) return false
    if (!bandOk(fExec, met?.pctExec ?? null)) return false
    return true
  }), [obras, fProjeto, fTipo, fAno, fValor, oscsPorObra, metricas, fFat, fPrazo, fExec])

  const obraSel = (obraId && obrasFiltradas.some(o => o.id === obraId)) ? obraId : obrasFiltradas[0]?.id
  const { data: estruturas = [], isLoading } = useEstruturas(obraSel)
  const { data: celulas = [] } = useCelulas(obraSel)

  const [qTorre, setQTorre] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [novo, setNovo] = useState({ nome: '', tipo: '', peso: '', dist: '' })
  const [edit, setEdit] = useState<{ est: Estrutura; atividade: string; cel?: Celula } | null>(null)

  const cel = useMemo(() => {
    const m = new Map<string, Celula>()
    for (const c of celulas) m.set(`${c.estrutura_id}|${c.atividade}`, c)
    return m
  }, [celulas])

  const cols = useMemo(() => estruturas.filter(e => !qTorre.trim() || e.nome.toLowerCase().includes(qTorre.toLowerCase())), [estruturas, qTorre])

  const addEstrutura = useMutation({
    mutationFn: async () => {
      if (!novo.nome.trim() || !obraSel) return
      const { error } = await supabase.from('obr_estruturas').insert({
        obra_id: obraSel, nome: novo.nome.trim(), tipo: novo.tipo.trim() || null,
        peso_ton: novo.peso.trim() ? Number(novo.peso.replace(',', '.')) : null,
        dist_prox_m: novo.dist.trim() ? Number(novo.dist.replace(',', '.')) : null,
        ordem: estruturas.length + 1,
      })
      if (error) throw error
    },
    onSuccess: () => { setNovo({ nome: '', tipo: '', peso: '', dist: '' }); setAddOpen(false); qc.invalidateQueries({ queryKey: ['obr-estruturas', obraSel] }) },
  })
  const delEstrutura = useMutation({
    mutationFn: async (id: string) => { await supabase.from('obr_estruturas').delete().eq('id', id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['obr-estruturas', obraSel] }); qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraSel] }) },
  })
  const salvarCel = useMutation({
    mutationFn: async (p: { estrutura_id: string; atividade: string; data: string | null; avanco: number }) => {
      const { error } = await supabase.from('obr_atividade_avanco').upsert({
        obra_id: obraSel, estrutura_id: p.estrutura_id, atividade: p.atividade,
        data: p.data, avanco: p.avanco, responsavel_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'estrutura_id,atividade' })
      if (error) throw error
    },
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraSel] }) },
  })

  const card = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const sel = `appearance-none rounded-lg px-2.5 py-1.5 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`
  const th = `text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  const celCor = (av: number) => av >= 1 ? 'bg-emerald-500 text-white' : av > 0 ? 'bg-amber-400 text-slate-900' : (isDark ? 'bg-white/[0.04] text-slate-600' : 'bg-slate-100 text-slate-400')

  return (
    <div className="space-y-3">
      {/* Filtros — todos na 1ª linha (padrão EGP): Contrato · Projeto · Tipo · Valor · Ano · %s · Obra */}
      <div className={`rounded-2xl ${card} p-3 flex items-center gap-2 flex-wrap`}>
        {portfolios.length > 1 && (
          <select value={portfolioId ?? ''} onChange={e => { setPid(e.target.value); setObraId(''); setFProjeto('') }} className={`${sel} max-w-[180px] truncate`}>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.nome_obra}</option>)}
          </select>
        )}
        <select value={fProjeto} onChange={e => { setFProjeto(e.target.value); setObraId('') }} className={`${sel} max-w-[180px] truncate`}>
          <option value="">Projeto: todos</option>
          {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={fTipo} onChange={e => { setFTipo(e.target.value); setObraId('') }} className={sel}>
          <option value="">Tipo: todos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={fValor} onChange={e => { setFValor(e.target.value); setObraId('') }} className={sel}>
          <option value="">Valor: todos</option>
          <option value="gt1m">&gt; R$ 1 mi</option>
          <option value="mid">R$ 100 mil – 1 mi</option>
          <option value="lt100k">&lt; R$ 100 mil</option>
        </select>
        <select value={fAno} onChange={e => { setFAno(e.target.value); setObraId('') }} className={sel}>
          <option value="">Ano: todos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <MultiSelect label="% Faturado" options={BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fFat}
          onToggle={v => { togFiltro(v, setFFat); setObraId('') }} onClear={() => setFFat(new Set())} isDark={isDark} compacto />
        <MultiSelect label="% Prazo" options={BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fPrazo}
          onToggle={v => { togFiltro(v, setFPrazo); setObraId('') }} onClear={() => setFPrazo(new Set())} isDark={isDark} compacto />
        <MultiSelect label="% Executado" options={BANDS.map(b => ({ value: b[0], label: b[1] }))} selected={fExec}
          onToggle={v => { togFiltro(v, setFExec); setObraId('') }} onClear={() => setFExec(new Set())} isDark={isDark} compacto />
        <select value={obraSel ?? ''} onChange={e => setObraId(e.target.value)} className={`${sel} max-w-[280px] truncate font-bold`}>
          {obrasFiltradas.length === 0 && <option value="">— nenhuma obra no filtro —</option>}
          {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={qTorre} onChange={e => setQTorre(e.target.value)} placeholder="filtrar torre..." className={`pl-7 pr-3 py-1.5 rounded-lg border text-xs w-32 ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`} />
        </div>
        <div className="flex-1" />
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{obrasFiltradas.length} obra(s) · {estruturas.length} estrutura(s)</span>
        <button onClick={() => setAddOpen(v => !v)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white">
          <Plus size={13} /> Estrutura
        </button>
      </div>

      {addOpen && (
        <div className={`rounded-xl ${card} p-3 flex items-end gap-2 flex-wrap`}>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">TORRE / ESTRUTURA
            <input value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} placeholder="76B" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">TIPO
            <input value={novo.tipo} onChange={e => setNovo(n => ({ ...n, tipo: e.target.value }))} placeholder="DL3A" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">PESO (t)
            <input value={novo.peso} onChange={e => setNovo(n => ({ ...n, peso: e.target.value }))} placeholder="273,3" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">DIST. PRÓX. TORRE (m)
            <input value={novo.dist} onChange={e => setNovo(n => ({ ...n, dist: e.target.value }))} placeholder="380" className={`${sel} w-28`} /></label>
          <button onClick={() => addEstrutura.mutate()} disabled={!novo.nome.trim() || addEstrutura.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
            {addEstrutura.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Adicionar'}
          </button>
        </div>
      )}

      {/* Matriz */}
      <div className={`rounded-xl ${card} overflow-x-auto`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> carregando…</div>
        ) : (
          <table className="border-collapse text-xs min-w-full">
            <thead>
              <tr>
                <th className={`sticky left-0 z-10 px-2 py-1.5 text-left ${th} ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>Seção</th>
                <th className={`sticky left-[86px] z-10 px-2 py-1.5 text-left ${th} min-w-[230px] ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>Atividade</th>
                <th className={`px-1.5 py-1.5 ${th} text-right`}>Prev</th>
                <th className={`px-1.5 py-1.5 ${th} text-right`}>Exec</th>
                <th className={`px-1.5 py-1.5 ${th} text-right`}>%</th>
                {cols.map(e => (
                  <th key={e.id} className={`px-1 py-1.5 text-center min-w-[74px] ${isDark ? 'border-l border-white/[0.05]' : 'border-l border-slate-100'}`}>
                    <div className={`text-[11px] font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{e.nome}</div>
                    <div className="text-[9px] text-slate-400">{e.tipo ?? '—'}{e.peso_ton ? ` · ${e.peso_ton}t` : ''}</div>
                    {e.dist_prox_m != null && <div className="text-[9px] text-sky-500 font-semibold">→ {e.dist_prox_m.toLocaleString('pt-BR')} m</div>}
                    <button onClick={() => { if (confirm(`Remover ${e.nome}?`)) delEstrutura.mutate(e.id) }} className="text-slate-300 hover:text-rose-500"><X size={10} /></button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATALOGO.map(g => g.atividades.map((atv, ai) => {
                const prev = cols.length
                const exec = cols.reduce((s, e) => s + Math.min(1, cel.get(`${e.id}|${atv}`)?.avanco ?? 0), 0)
                const pct = prev ? Math.round((exec / prev) * 100) : 0
                return (
                  <tr key={g.secao + atv} className={isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}>
                    {ai === 0 && (
                      <td rowSpan={g.atividades.length}
                        className={`sticky left-0 z-10 px-2 py-1 align-top text-[10px] font-bold w-[86px] ${isDark ? 'bg-[#111827]' : 'bg-white'}`}
                        style={{ color: SECAO_COR[g.secao] }}>{g.secao}</td>
                    )}
                    <td className={`sticky left-[86px] z-10 px-2 py-1 text-[11px] ${isDark ? 'bg-[#111827] text-slate-300' : 'bg-white text-slate-600'}`}>{atv}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{prev || '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{exec ? exec.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold ${pct >= 100 ? 'text-emerald-500' : pct > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{pct ? `${pct}%` : '—'}</td>
                    {cols.map(e => {
                      const c = cel.get(`${e.id}|${atv}`)
                      const av = c?.avanco ?? 0
                      return (
                        <td key={e.id} className={`px-0.5 py-0.5 text-center ${isDark ? 'border-l border-white/[0.05]' : 'border-l border-slate-100'}`}>
                          <button onClick={() => setEdit({ est: e, atividade: atv, cel: c })}
                            className={`w-full rounded px-1 py-1 text-[10px] font-bold transition-colors hover:opacity-80 ${celCor(av)}`}
                            title={c?.data ? `${atv} · ${e.nome} · ${c.data}` : `${atv} · ${e.nome}`}>
                            {av >= 1 ? '✓' : av > 0 ? `${Math.round(av * 100)}%` : '·'}
                            {c?.data && <span className="block text-[8px] font-normal opacity-80">{c.data.slice(8, 10)}/{c.data.slice(5, 7)}</span>}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              }))}
            </tbody>
          </table>
        )}
        {!isLoading && estruturas.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">Nenhuma estrutura cadastrada nesta obra — use “+ Estrutura” para montar as colunas (76B, 77B…).</div>
        )}
      </div>

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Modelo da planilha ACOMPANHAMENTO: célula = avanço da atividade naquela estrutura (data + %). O RDO passará a atualizar estas células automaticamente.
      </p>

      {/* editor de célula */}
      {edit && (
        <CelulaEditor
          est={edit.est} atividade={edit.atividade} cel={edit.cel}
          onClose={() => setEdit(null)}
          onSave={(data, avanco) => salvarCel.mutate({ estrutura_id: edit.est.id, atividade: edit.atividade, data, avanco })}
          salvando={salvarCel.isPending}
          isDark={isDark}
        />
      )}
    </div>
  )
}

function CelulaEditor({ est, atividade, cel, onClose, onSave, salvando, isDark }: {
  est: Estrutura; atividade: string; cel?: Celula; onClose: () => void
  onSave: (data: string | null, avanco: number) => void; salvando: boolean; isDark: boolean
}) {
  const [data, setData] = useState(cel?.data ?? new Date().toISOString().slice(0, 10))
  const [av, setAv] = useState(String(Math.round((cel?.avanco ?? 0) * 100)))
  const inp = `rounded-lg border px-2 py-1.5 text-xs ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl border shadow-2xl p-4 ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{est.nome} <span className="text-slate-400 font-normal">· {est.tipo ?? ''}</span></p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{atividade}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">DATA
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">AVANÇO
            <select value={av} onChange={e => setAv(e.target.value)} className={inp}>
              {['0', '25', '50', '75', '100'].map(p => <option key={p} value={p}>{p}%</option>)}
            </select></label>
          <button onClick={() => onSave(data || null, Number(av) / 100)} disabled={salvando}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
            {salvando ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
        {cel?.responsavel_nome && <p className="text-[10px] text-slate-400 mt-2">último registro por {cel.responsavel_nome}</p>}
      </div>
    </div>
  )
}
