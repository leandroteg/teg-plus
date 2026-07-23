// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/ResumoTecnicoObras.tsx — aba "Resumo Técnico" da Gestão de Obras.
// Árvore Frente(projeto) › Obra › OSC, no mesmo padrão do EGP › Iniciação, porém
// SOMENTE LEITURA (sem criar projeto/obra/OSC) e com os dados técnicos de cada
// OSC visíveis: quantidade de torres e km de linha.
//
// ⚠️ km de LINHA = itens em km da seção "Lançamento". NÃO somamos a seção
// "Transportes" (é quilometragem rodada de veículo — daria 164 mil km).
// Torres = pmo_fluxo_os.qtd_torres (preenchido só em parte das OSCs → "—").
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Search, Building2, Ruler, TowerControl, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { usePortfolios, useProjetos, useObrasDoPortfolio, useOSCsDoPortfolio, type EGPOscRow } from '../../hooks/usePMO'

const fmtBRL = (v?: number | null) => v == null ? '—' : `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const fmtNum = (v?: number | null, dec = 0) => v == null || v === 0 ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: dec })
const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

// km de linha por OSC (só seção Lançamento) — 1 query agregada no cliente
function useKmLinhaPorOsc() {
  return useQuery<Map<string, number>>({
    queryKey: ['obr-km-linha-por-osc'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pmo_osc_itens').select('fluxo_os_id, secao, unidade, quantidade')
      const m = new Map<string, number>()
      if (error) return m
      for (const it of data ?? []) {
        if (String(it.unidade ?? '').toLowerCase() !== 'km') continue
        if (!/lan[cç]amento/i.test(String(it.secao ?? ''))) continue
        const k = String(it.fluxo_os_id)
        m.set(k, (m.get(k) ?? 0) + Number(it.quantidade ?? 0))
      }
      return m
    },
    staleTime: 5 * 60_000,
  })
}

export default function ResumoTecnicoObras() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: portfolios = [] } = usePortfolios()
  const [pid, setPid] = useState<string>('')
  const portfolioId = pid || portfolios[0]?.id

  const { data: obras = [], isLoading } = useObrasDoPortfolio(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: kmPorOsc } = useKmLinhaPorOsc()

  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fValor, setFValor] = useState('')
  const [fAno, setFAno] = useState('')
  const [fStatus, setFStatus] = useState<'ativas' | 'canceladas' | 'todas'>('ativas')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [fechados, setFechados] = useState<Set<string>>(new Set())

  const km = (id: string) => kmPorOsc?.get(id) ?? 0

  // OSCs por obra, aplicando filtros
  const oscByObra = useMemo(() => {
    const m = new Map<string, EGPOscRow[]>()
    for (const o of oscs) {
      if (!o.obra_id) continue
      const cancelada = o.etapa_atual === 'cancelada'
      if (fStatus === 'ativas' && cancelada) continue
      if (fStatus === 'canceladas' && !cancelada) continue
      if (fTipo && o.tipo !== fTipo) continue
      if (fAno && (o.data_osc ?? '').slice(0, 4) !== fAno) continue
      if (fValor) {
        const v = o.valor ?? 0
        if (fValor === 'gt1m' && v <= 1_000_000) continue
        if (fValor === 'mid' && !(v >= 100_000 && v <= 1_000_000)) continue
        if (fValor === 'lt100k' && v >= 100_000) continue
      }
      const arr = m.get(o.obra_id) ?? []; arr.push(o); m.set(o.obra_id, arr)
    }
    return m
  }, [oscs, fStatus, fTipo, fAno, fValor])

  const filtroAtivo = !!(fTipo || fValor || fAno || fStatus !== 'ativas')
  const lista = useMemo(() => obras.filter(o => {
    if (filtroAtivo && !(oscByObra.get(o.id)?.length)) return false
    const s = q.trim().toLowerCase()
    return !s || o.nome.toLowerCase().includes(s) || (o.codigo ?? '').toLowerCase().includes(s) || o.polo_nome.toLowerCase().includes(s)
  }), [obras, oscByObra, filtroAtivo, q])

  // agrega uma obra a partir das suas OSCs
  const agg = (arr: EGPOscRow[]) => ({
    valor: arr.reduce((s, o) => s + (o.valor ?? 0), 0),
    torres: arr.reduce((s, o) => s + (o.qtd_torres ?? 0), 0),
    km: arr.reduce((s, o) => s + km(o.id), 0),
    ini: arr.map(o => o.data_osc).filter(Boolean).sort()[0] ?? null,
    fim: arr.map(o => o.vencimento).filter(Boolean).sort().slice(-1)[0] ?? null,
  })

  // agrupa obras por projeto (frente)
  const grupos = useMemo(() => {
    const byProj = new Map<string, typeof lista>()
    for (const o of lista) {
      const k = o.pmo_projeto_id || '__sem__'
      const a = byProj.get(k) ?? []; a.push(o); byProj.set(k, a)
    }
    const nome = new Map<string, string>()
    for (const p of projetos) nome.set(p.id, p.nome)
    for (const o of lista) if (o.pmo_projeto_id && !nome.has(o.pmo_projeto_id)) nome.set(o.pmo_projeto_id, o.polo_nome)
    return [...byProj.entries()]
      .map(([id, obs]) => ({ id, nome: id === '__sem__' ? '— Sem frente' : (nome.get(id) ?? '—'), obras: obs }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [lista, projetos])

  const anos = useMemo(() => [...new Set(oscs.map(o => (o.data_osc ?? '').slice(0, 4)).filter(Boolean))].sort().reverse(), [oscs])
  const tipos = useMemo(() => [...new Set(oscs.map(o => o.tipo).filter(Boolean))] as string[], [oscs])

  const totObras = lista.length
  const totGeral = lista.reduce((acc, o) => {
    const a = agg(oscByObra.get(o.id) ?? [])
    return { valor: acc.valor + a.valor, torres: acc.torres + a.torres, km: acc.km + a.km }
  }, { valor: 0, torres: 0, km: 0 })

  const card = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const sel = `appearance-none rounded-lg px-2.5 py-1.5 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`
  const toggleObra = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleGrupo = (id: string) => setFechados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className={`rounded-2xl ${card} p-3 flex items-center gap-2 flex-wrap`}>
        <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{totObras} obras</span>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="buscar..."
            className={`pl-7 pr-3 py-1.5 rounded-lg border text-xs w-44 ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`} />
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={sel}>
          <option value="">Tipo: todos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={fValor} onChange={e => setFValor(e.target.value)} className={sel}>
          <option value="">Valor: todos</option>
          <option value="gt1m">&gt; R$ 1 mi</option>
          <option value="mid">R$ 100 mil – 1 mi</option>
          <option value="lt100k">&lt; R$ 100 mil</option>
        </select>
        <select value={fAno} onChange={e => setFAno(e.target.value)} className={sel}>
          <option value="">Ano: todos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value as any)} className={sel}>
          <option value="ativas">Ativas</option>
          <option value="canceladas">Canceladas</option>
          <option value="todas">Todas</option>
        </select>
        {portfolios.length > 1 && (
          <select value={portfolioId ?? ''} onChange={e => setPid(e.target.value)} className={`${sel} max-w-[220px] truncate`}>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.nome_obra}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <div className={`flex items-center gap-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className="font-bold">{fmtBRL(totGeral.valor)}</span>
          <span className="flex items-center gap-1"><TowerControl size={12} /> {fmtNum(totGeral.torres)}</span>
          <span className="flex items-center gap-1"><Ruler size={12} /> {fmtNum(totGeral.km, 1)} km</span>
        </div>
      </div>

      {isLoading ? (
        <div className={`rounded-2xl ${card} py-16 flex items-center justify-center gap-2 text-sm text-slate-400`}>
          <Loader2 size={16} className="animate-spin" /> carregando obras…
        </div>
      ) : grupos.length === 0 ? (
        <div className={`rounded-2xl ${card} py-16 text-center`}>
          <Building2 size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma obra encontrada</p>
        </div>
      ) : grupos.map(g => {
        const tot = g.obras.reduce((acc, o) => {
          const a = agg(oscByObra.get(o.id) ?? [])
          return { valor: acc.valor + a.valor, torres: acc.torres + a.torres, km: acc.km + a.km }
        }, { valor: 0, torres: 0, km: 0 })
        const aberto = !fechados.has(g.id)
        return (
          <div key={g.id} className="space-y-1">
            {/* Cabeçalho da frente */}
            <button onClick={() => toggleGrupo(g.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-100/70'}`}>
              {aberto ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              <span className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{g.nome}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-200 text-slate-600'}`}>{g.obras.length} obras</span>
              <div className="flex-1" />
              <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmtBRL(tot.valor)}</span>
              <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><TowerControl size={11} /> {fmtNum(tot.torres)}</span>
              <span className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Ruler size={11} /> {fmtNum(tot.km, 1)} km</span>
            </button>

            {aberto && g.obras.map(o => {
              const arr = oscByObra.get(o.id) ?? []
              const a = agg(arr)
              const exp = open.has(o.id)
              return (
                <div key={o.id} className={`rounded-xl ${card} overflow-hidden`}>
                  <button onClick={() => toggleObra(o.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                    {exp ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                    <span className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.nome}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{arr.length} OSC{arr.length === 1 ? '' : 's'}</span>
                    {o.status && <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>{o.status}</span>}
                    <div className="flex-1" />
                    <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmtBRL(a.valor)}</span>
                    <span className={`text-[11px] shrink-0 flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><TowerControl size={11} /> {fmtNum(a.torres)}</span>
                    <span className={`text-[11px] shrink-0 flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Ruler size={11} /> {fmtNum(a.km, 1)} km</span>
                    <span className={`text-[10px] shrink-0 hidden sm:block ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{fmtData(a.ini)} · {fmtData(a.fim)}</span>
                  </button>

                  {exp && (
                    <div className={`px-3 pb-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                      <div className={`grid grid-cols-[1.4fr_auto_auto_auto_auto_auto] gap-2 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        <span>OSC</span><span>Tipo</span><span className="text-right">Torres</span><span className="text-right">Km linha</span><span className="text-right">Valor</span><span className="text-right">Prazo</span>
                      </div>
                      {arr.length === 0 && <p className={`text-xs px-2 py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma OSC neste filtro.</p>}
                      {arr.map(osc => (
                        <div key={osc.id} className={`grid grid-cols-[1.4fr_auto_auto_auto_auto_auto] gap-2 items-center px-2 py-1.5 rounded-lg text-xs ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                          <span className={`font-semibold truncate ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>{osc.numero_os}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>{osc.tipo ?? '—'}</span>
                          <span className={`text-right tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(osc.qtd_torres)}</span>
                          <span className={`text-right tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtNum(km(osc.id), 1)}</span>
                          <span className={`text-right font-semibold tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fmtBRL(osc.valor)}</span>
                          <span className={`text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtData(osc.vencimento)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Torres = quantidade informada na OSC (nem toda OSC tem). Km de linha = itens em km da seção “Lançamento” (não inclui transporte).
      </p>
    </div>
  )
}
