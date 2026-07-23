// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/PriorizacaoObras.tsx — aba "Priorização" da Gestão de Obras.
// Lista de obras ordenável (drag + setas), persistida em obr_priorizacao —
// a ordem alimenta o planejador automático do EGP e os painéis (SuperTEG).
//  · %Físico   = engine do Cronograma EGP (EAP: real/contratado ponderado)
//  · %Financ.  = medição acumulada ÷ contratado (pmo_osc_itens valor_acum/valor)
//  · Prazo     = vencimento da OSC mais tardia da obra
//  · Prazo cliente / Frentes liberadas / Bloqueios / Comentários = editáveis
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, GripVertical, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { usePortfolios, useObrasDoPortfolio, useOSCsDoPortfolio, useEAPFinal, type EGPOscRow } from '../../hooks/usePMO'
import { buildTree } from '../pmo/paineis/cronogramaEngine'

const fmtData = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

interface PrioRow {
  obra_id: string
  ordem: number | null
  prazo_cliente: string | null
  frentes_liberadas: string | null
  bloqueios: string | null
  comentarios: string | null
}

function usePriorizacao() {
  return useQuery<PrioRow[]>({
    queryKey: ['obr-priorizacao'],
    queryFn: async () => {
      const { data, error } = await supabase.from('obr_priorizacao').select('*')
      if (error) return []
      return (data ?? []) as PrioRow[]
    },
  })
}

// % financeiro por OSC: medição acumulada ÷ contratado (itens)
function useFinPorOsc() {
  return useQuery<Map<string, { acum: number; valor: number }>>({
    queryKey: ['obr-fin-por-osc'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pmo_osc_itens').select('fluxo_os_id, valor, valor_acum')
      const m = new Map<string, { acum: number; valor: number }>()
      if (error) return m
      for (const it of data ?? []) {
        const k = String(it.fluxo_os_id)
        const cur = m.get(k) ?? { acum: 0, valor: 0 }
        cur.acum += Number(it.valor_acum ?? 0)
        cur.valor += Number(it.valor ?? 0)
        m.set(k, cur)
      }
      return m
    },
    staleTime: 5 * 60_000,
  })
}

export default function PriorizacaoObras() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const { data: portfolios = [] } = usePortfolios()
  const [pid, setPid] = useState('')
  const portfolioId = pid || portfolios[0]?.id

  const { data: obras = [], isLoading } = useObrasDoPortfolio(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const { data: raw } = useEAPFinal(portfolioId)
  const { data: prio = [] } = usePriorizacao()
  const { data: finPorOsc } = useFinPorOsc()

  const [q, setQ] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fValor, setFValor] = useState('')
  const [fAno, setFAno] = useState('')
  const [fStatus, setFStatus] = useState<'ativas' | 'canceladas' | 'todas'>('ativas')
  const [dragId, setDragId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  // %físico por NOME de obra (engine do cronograma EGP)
  const fisPorNome = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of buildTree(raw)) for (const o of f.obras) m.set(norm(o.nome), o.pctFis)
    return m
  }, [raw])

  // OSCs por obra com filtros (mesma lógica do Resumo Técnico)
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

  const prioMap = useMemo(() => new Map(prio.map(p => [p.obra_id, p])), [prio])
  const filtroAtivo = !!(fTipo || fValor || fAno || fStatus !== 'ativas')

  // linhas: obras filtradas, ordenadas por ordem salva (sem ordem → fim, por prazo)
  const linhas = useMemo(() => {
    const base = obras.filter(o => {
      if (filtroAtivo && !(oscByObra.get(o.id)?.length)) return false
      const s = q.trim().toLowerCase()
      return !s || o.nome.toLowerCase().includes(s) || o.polo_nome.toLowerCase().includes(s)
    }).map(o => {
      const arr = oscByObra.get(o.id) ?? []
      const prazo = arr.map(x => x.vencimento).filter(Boolean).sort().slice(-1)[0] ?? null
      const fin = arr.reduce((acc, x) => {
        const f = finPorOsc?.get(x.id); if (f) { acc.acum += f.acum; acc.valor += f.valor } return acc
      }, { acum: 0, valor: 0 })
      return {
        ...o,
        prazo,
        pctFis: fisPorNome.get(norm(o.nome)) ?? null,
        pctFin: fin.valor > 0 ? Math.round((fin.acum / fin.valor) * 100) : null,
        prio: prioMap.get(o.id) ?? null,
      }
    })
    base.sort((a, b) => {
      const oa = a.prio?.ordem ?? 1e9, ob = b.prio?.ordem ?? 1e9
      if (oa !== ob) return oa - ob
      return (a.prazo ?? '9999') < (b.prazo ?? '9999') ? -1 : 1
    })
    return base
  }, [obras, oscByObra, filtroAtivo, q, fisPorNome, finPorOsc, prioMap])

  // ── persistência ────────────────────────────────────────────────────────────
  const upsert = useMutation({
    mutationFn: async (patch: Partial<PrioRow> & { obra_id: string }) => {
      const { error } = await supabase.from('obr_priorizacao').upsert({
        ...patch, atualizado_por_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'obra_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obr-priorizacao'] }),
  })

  const salvarOrdem = async (ids: string[]) => {
    setSalvando(true)
    try {
      const rows = ids.map((obra_id, i) => ({
        obra_id, ordem: i + 1,
        prazo_cliente: prioMap.get(obra_id)?.prazo_cliente ?? null,
        frentes_liberadas: prioMap.get(obra_id)?.frentes_liberadas ?? null,
        bloqueios: prioMap.get(obra_id)?.bloqueios ?? null,
        comentarios: prioMap.get(obra_id)?.comentarios ?? null,
        atualizado_por_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
      }))
      await supabase.from('obr_priorizacao').upsert(rows, { onConflict: 'obra_id' })
      qc.invalidateQueries({ queryKey: ['obr-priorizacao'] })
    } finally { setSalvando(false) }
  }

  const mover = (idx: number, delta: number) => {
    const ids = linhas.map(l => l.id)
    const j = idx + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    salvarOrdem(ids)
  }
  const dropSobre = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = linhas.map(l => l.id)
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    setDragId(null)
    salvarOrdem(ids)
  }

  const anos = useMemo(() => [...new Set(oscs.map(o => (o.data_osc ?? '').slice(0, 4)).filter(Boolean))].sort().reverse(), [oscs])
  const tipos = useMemo(() => [...new Set(oscs.map(o => o.tipo).filter(Boolean))] as string[], [oscs])

  const card = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const sel = `appearance-none rounded-lg px-2.5 py-1.5 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`
  const inp = `w-full rounded-lg border px-2 py-1.5 text-xs ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50/60 border-slate-200 text-slate-700 placeholder:text-slate-400'}`
  const pctCls = (p: number | null) => p == null ? (isDark ? 'text-slate-600' : 'text-slate-300')
    : p >= 90 ? 'text-emerald-500 font-bold' : p >= 50 ? 'text-sky-500 font-bold' : 'text-amber-500 font-bold'

  return (
    <div className="space-y-3">
      {/* Filtros (mesmos do Resumo Técnico) */}
      <div className={`rounded-2xl ${card} p-3 flex items-center gap-2 flex-wrap`}>
        <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{linhas.length} obras</span>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="buscar..." className={`pl-7 pr-3 py-1.5 rounded-lg border text-xs w-44 ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`} />
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
        <select value={fStatus} onChange={e => setFStatus(e.target.value as never)} className={sel}>
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
        {salvando && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> salvando ordem…</span>}
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>arraste ou use as setas pra ordenar</span>
      </div>

      {/* Cabeçalho */}
      <div className={`rounded-xl ${card} overflow-x-auto`}>
        <div className="min-w-[1180px]">
          <div className={`grid grid-cols-[44px_28px_minmax(220px,1.2fr)_60px_60px_96px_130px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)] gap-2 items-center px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500 border-b border-white/[0.06]' : 'text-slate-400 border-b border-slate-100'}`}>
            <span>#</span><span /><span>Obra</span>
            <span>% Fís</span><span>% Fin</span>
            <span>Prazo OSC</span><span>Prazo Acordado</span>
            <span>Frentes liberadas</span><span>Bloqueios e impeditivos</span><span>Comentários</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> carregando…</div>
          ) : linhas.map((o, idx) => (
            <div key={o.id}
              draggable
              onDragStart={() => setDragId(o.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => dropSobre(o.id)}
              className={`grid grid-cols-[44px_28px_minmax(220px,1.2fr)_60px_60px_96px_130px_minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)] gap-2 items-center px-3 py-2 ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.02]' : 'border-b border-slate-50 hover:bg-slate-50/60'} ${dragId === o.id ? 'opacity-40' : ''}`}>
              {/* posição + setas */}
              <span className="flex items-center gap-1">
                <span className={`text-sm font-extrabold w-6 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{idx + 1}</span>
                <span className="flex flex-col">
                  <button onClick={() => mover(idx, -1)} className="text-slate-400 hover:text-sky-500 leading-none"><ChevronUp size={12} /></button>
                  <button onClick={() => mover(idx, 1)} className="text-slate-400 hover:text-sky-500 leading-none"><ChevronDown size={12} /></button>
                </span>
              </span>
              <GripVertical size={13} className="text-slate-300 cursor-grab" />
              {/* obra */}
              <span className="min-w-0">
                <span className={`text-xs font-bold block truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{o.nome}</span>
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.polo_nome}</span>
              </span>
              <span className={`text-right text-xs tabular-nums ${pctCls(o.pctFis)}`}>{o.pctFis != null ? `${o.pctFis}%` : '—'}</span>
              <span className={`text-right text-xs tabular-nums ${pctCls(o.pctFin)}`}>{o.pctFin != null ? `${o.pctFin}%` : '—'}</span>
              <span className={`text-center text-xs font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtData(o.prazo)}</span>
              <CampoData valor={o.prio?.prazo_cliente ?? ''} onSave={v => upsert.mutate({ obra_id: o.id, ordem: o.prio?.ordem ?? idx + 1, prazo_cliente: v || null, frentes_liberadas: o.prio?.frentes_liberadas ?? null, bloqueios: o.prio?.bloqueios ?? null, comentarios: o.prio?.comentarios ?? null })} cls={inp} />
              <CampoTexto valor={o.prio?.frentes_liberadas ?? ''} placeholder="frentes liberadas…" onSave={v => upsert.mutate({ obra_id: o.id, ordem: o.prio?.ordem ?? idx + 1, frentes_liberadas: v || null, prazo_cliente: o.prio?.prazo_cliente ?? null, bloqueios: o.prio?.bloqueios ?? null, comentarios: o.prio?.comentarios ?? null })} cls={inp} />
              <CampoTexto valor={o.prio?.bloqueios ?? ''} placeholder="bloqueios…" onSave={v => upsert.mutate({ obra_id: o.id, ordem: o.prio?.ordem ?? idx + 1, bloqueios: v || null, prazo_cliente: o.prio?.prazo_cliente ?? null, frentes_liberadas: o.prio?.frentes_liberadas ?? null, comentarios: o.prio?.comentarios ?? null })} cls={inp} alerta={!!o.prio?.bloqueios} />
              <CampoTexto valor={o.prio?.comentarios ?? ''} placeholder="comentários…" onSave={v => upsert.mutate({ obra_id: o.id, ordem: o.prio?.ordem ?? idx + 1, comentarios: v || null, prazo_cliente: o.prio?.prazo_cliente ?? null, frentes_liberadas: o.prio?.frentes_liberadas ?? null, bloqueios: o.prio?.bloqueios ?? null })} cls={inp} />
            </div>
          ))}
          {!isLoading && linhas.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">Nenhuma obra encontrada</div>
          )}
        </div>
      </div>

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        %Físico = EAP do EGP (executado ÷ contratado, ponderado) · %Financeiro = medição acumulada ÷ contratado · Prazo = OSC mais tardia da obra. A ordem e os campos alimentam o planejador automático e os painéis.
      </p>
    </div>
  )
}

// campo texto com salvamento no blur (evita 1 upsert por tecla)
function CampoTexto({ valor, placeholder, onSave, cls, alerta }: { valor: string; placeholder: string; onSave: (v: string) => void; cls: string; alerta?: boolean }) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor])
  return (
    <input value={v} placeholder={placeholder}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== valor) onSave(v) }}
      className={`${cls} ${alerta ? 'border-rose-300 dark:border-rose-500/40' : ''}`} />
  )
}
function CampoData({ valor, onSave, cls }: { valor: string; onSave: (v: string) => void; cls: string }) {
  const [v, setV] = useState(valor)
  useEffect(() => setV(valor), [valor])
  return (
    <input type="date" value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== valor) onSave(v) }}
      className={cls} />
  )
}
