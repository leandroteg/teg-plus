// ─────────────────────────────────────────────────────────────────────────────
// PainelLegadoBreakdown — árvore DRE Polo → Obra → Grupo → Natureza
// Replica o "Painel de Custos Projetos" validado (mesma classificação/rateio).
// Fonte: /painel_legado.json (snapshot gerado de TOTVS+NIBO+Faturamento, sem código TOTVS).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// ── Tipos do JSON ────────────────────────────────────────────────────────────
interface Nat { nome: string; cus: number; qtd: number }
interface Grupo { nome: string; cus: number; naturezas: Nat[] }
interface Obra { nome: string; periodo: string; fat: number; cus: number; dfix: number; dnao: number; us: number; grupos: Grupo[] }
interface Polo { nome: string; fat: number; cus: number; dfix: number; dnao: number; us: number; obras: Obra[] }
interface BNat { nome: string; val: number; qtd: number }
interface BGrupo { nome: string; val: number; naturezas: BNat[] }
interface Bloco { titulo: string; col: 'dfix' | 'dnao'; total: number; grupos: BGrupo[] }
interface Painel {
  periodo: string
  total: { fat: number; cus: number; dfix: number; dnao: number; us: number }
  polos: Polo[]
  blocos: Bloco[]
}

function usePainelLegado() {
  return useQuery<Painel>({
    queryKey: ['painel-legado'],
    queryFn: async () => {
      const r = await fetch('/painel_legado.json', { cache: 'no-cache' })
      if (!r.ok) throw new Error('falha ao carregar painel_legado.json')
      return r.json()
    },
    staleTime: 30 * 60 * 1000,
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const n0 = (v: number) => (v ? Math.round(v).toLocaleString('pt-BR') : '–')
const pp = (v: number | null) => (v == null ? '–' : `${Math.round(v)}%`)
const clean = (s: string) => s.replace(/\s{2,}/g, ' ').trim()

function dre(fat: number, cus: number, dfix: number, dnao: number, us: number) {
  const marg = fat - cus
  const mb = fat ? (marg / fat) * 100 : null
  const lop = marg - dfix
  const ebit = fat ? (lop / fat) * 100 : null
  const rliq = lop - dnao
  const liq = fat ? (rliq / fat) * 100 : null
  const rus = us ? (cus + dfix) / us : null
  return { mb, lop, ebit, rliq, liq, rus }
}

// largura das 10 colunas (nome + 9 métricas)
const GRID = 'minmax(210px,1fr) 92px 88px 42px 104px 104px 50px 60px 96px 46px'

// ── Component ────────────────────────────────────────────────────────────────
export default function PainelLegadoBreakdown() {
  const { isDark } = useTheme()
  const { data, isLoading, isError } = usePainelLegado()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const allIds = useMemo(() => {
    const ids = new Set<string>()
    if (!data) return ids
    for (const p of data.polos) {
      ids.add('p:' + p.nome)
      for (const o of p.obras) {
        ids.add('o:' + p.nome + '/' + o.nome)
        for (const g of o.grupos) ids.add('g:' + p.nome + '/' + o.nome + '/' + g.nome)
      }
    }
    for (const b of data.blocos) {
      ids.add('b:' + b.titulo)
      for (const g of b.grupos) ids.add('bg:' + b.titulo + '/' + g.nome)
    }
    return ids
  }, [data])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (isError || !data) return <div className={`rounded-2xl p-8 text-center text-sm ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>Não foi possível carregar o painel de breakdown.</div>

  const query = q.trim().toLowerCase()
  const isOpen = (id: string) => !!query || open.has(id)
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const matches = (s: string) => !query || s.toLowerCase().includes(query)

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const navy = isDark ? 'bg-[#16243a]' : 'bg-[#1a3a5c]'

  // cores das métricas (claro/escuro)
  const cFat = isDark ? 'text-sky-300' : 'text-sky-700'
  const cCus = isDark ? 'text-slate-100' : 'text-slate-800'
  const cRf = isDark ? 'text-amber-300' : 'text-amber-700'
  const cLo = isDark ? 'text-emerald-300' : 'text-emerald-700'
  const cRu = isDark ? 'text-violet-300' : 'text-violet-700'
  const cRn = isDark ? 'text-rose-300' : 'text-rose-700'
  const cLq = isDark ? 'text-white' : 'text-slate-900'
  const green = (v: number | null) => (v != null && v < 0 ? (isDark ? 'text-rose-300' : 'text-rose-600') : '')

  // ── célula métrica ─────────────────────────────────────────────────────────
  const Cell = ({ v, cls, bold }: { v: string; cls?: string; bold?: boolean }) => (
    <span className={`text-right tabular-nums text-[11.5px] px-1 truncate ${bold ? 'font-bold' : 'font-semibold'} ${cls ?? ''}`}>{v}</span>
  )

  // linha de polo ou obra (DRE completa)
  function DreRow({ id, name, sub, fat, cus, dfix, dnao, us, level, onClick, dark }: {
    id: string; name: string; sub?: string; fat: number; cus: number; dfix: number; dnao: number; us: number
    level: 'polo' | 'obra'; onClick: () => void; dark?: boolean
  }) {
    const d = dre(fat, cus, dfix, dnao, us)
    const txt = dark ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-700'
    const fatC = dark ? 'text-sky-200' : cFat
    const cusC = dark ? 'text-white' : cCus
    const rfC = dark ? 'text-amber-200' : cRf
    const loC = dark ? 'text-emerald-200' : cLo
    const ruC = dark ? 'text-violet-200' : cRu
    const rnC = dark ? 'text-rose-200' : cRn
    const lqC = dark ? 'text-white' : cLq
    return (
      <button onClick={onClick} style={{ gridTemplateColumns: GRID }}
        className={`grid items-center w-full text-left gap-0 ${level === 'polo' ? `${navy} ${dark ? '' : ''} rounded-lg mt-1` : (isDark ? 'bg-white/[0.03]' : 'bg-sky-50/70') + ' rounded-md mt-0.5'} ${level === 'polo' ? 'py-2' : 'py-1.5'} px-2 hover:opacity-95`}>
        <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: level === 'obra' ? 16 : 0 }}>
          <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen(id) ? 'rotate-90' : ''} ${dark ? 'text-amber-300' : 'text-amber-500'}`} />
          <span className={`truncate ${level === 'polo' ? 'font-extrabold text-[13px]' : 'font-semibold text-[12px]'} ${txt}`}>{clean(name)}</span>
          {sub && <span className={`shrink-0 text-[10px] ${dark ? 'text-slate-400' : 'text-slate-400'}`}>· {sub}</span>}
        </span>
        <Cell v={n0(fat)} cls={fatC} />
        <Cell v={n0(cus)} cls={cusC} bold />
        <Cell v={pp(d.mb)} cls={`${dark ? 'text-emerald-200' : 'text-emerald-600'} ${green(d.mb)}`} />
        <Cell v={n0(dfix)} cls={rfC} />
        <Cell v={n0(d.lop)} cls={`${loC} ${green(d.lop)}`} bold />
        <Cell v={pp(d.ebit)} cls={`${loC} ${green(d.ebit)}`} />
        <Cell v={d.rus != null ? n0(d.rus) : '–'} cls={ruC} />
        <Cell v={n0(dnao)} cls={rnC} />
        <Cell v={pp(d.liq)} cls={`${lqC} ${green(d.liq)}`} bold />
      </button>
    )
  }

  // linha de grupo/natureza (só Custo Direto + % ou contagem)
  function SubRow({ name, cus, level, badge, indent }: { name: string; cus: number; level: 'grupo' | 'nat'; badge: string; indent: number }) {
    return (
      <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 ${level === 'grupo' ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50') + ' rounded-md mt-0.5 py-1' : 'py-[3px]'}`}>
        <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: indent }}>
          <span className={`truncate ${level === 'grupo' ? 'font-semibold text-[11.5px]' : 'text-[11px]'} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{name}</span>
        </span>
        <span />
        <Cell v={n0(cus)} cls={cCus} />
        <span className={`text-right text-[10px] px-1 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{badge}</span>
      </div>
    )
  }

  // filtra polos com base na query (mantém branch se algum descendente casa)
  const polosF = data.polos.filter(p =>
    matches(p.nome) || p.obras.some(o => matches(o.nome) || o.grupos.some(g => matches(g.nome) || g.naturezas.some(n => matches(n.nome)))),
  )

  const t = data.total
  const td = dre(t.fat, t.cus, t.dfix, t.dnao, t.us)

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={`flex items-center gap-1.5 flex-1 min-w-[180px] rounded-xl px-3 py-1.5 border ${isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
          <Search size={13} className="text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="filtrar por obra, grupo, natureza…"
            className={`flex-1 bg-transparent outline-none text-xs ${isDark ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-700 placeholder:text-slate-400'}`} />
        </div>
        <button onClick={() => setOpen(s => s.size >= allIds.size ? new Set() : new Set(allIds))}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border ${isDark ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {open.size >= allIds.size ? <><ChevronsDownUp size={13} /> Recolher</> : <><ChevronsUpDown size={13} /> Expandir tudo</>}
        </button>
      </div>

      {/* Cabeçalho de colunas */}
      <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 py-2 rounded-lg border-b-2 ${isDark ? 'border-amber-500/40 bg-white/[0.02]' : 'border-amber-400 bg-slate-50'}`}>
        {['Polo / Obra / Grupo / Natureza', 'Faturamento', 'Custo Direto', 'MB%', 'Rat. Custos e Desp.', 'Lucro Op', 'EBITDA', 'R$/US', 'Rat. Invest.', '%Líq'].map((h, i) => (
          <span key={h} className={`text-[9.5px] font-bold uppercase tracking-wide px-1 truncate ${i === 0 ? 'text-left' : 'text-right'} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</span>
        ))}
      </div>

      {/* Árvore (scroll horizontal em telas estreitas) */}
      <div className="overflow-x-auto">
        <div className="min-w-[1010px] space-y-0">
          {polosF.map(p => {
            const pid = 'p:' + p.nome
            return (
              <div key={pid}>
                <DreRow id={pid} name={p.nome} fat={p.fat} cus={p.cus} dfix={p.dfix} dnao={p.dnao} us={p.us} level="polo" dark onClick={() => toggle(pid)} />
                {isOpen(pid) && p.obras.filter(o => !query || matches(o.nome) || o.grupos.some(g => matches(g.nome) || g.naturezas.some(n => matches(n.nome)))).map(o => {
                  const oid = 'o:' + p.nome + '/' + o.nome
                  return (
                    <div key={oid}>
                      <DreRow id={oid} name={o.nome} sub={o.periodo} fat={o.fat} cus={o.cus} dfix={o.dfix} dnao={o.dnao} us={o.us} level="obra" onClick={() => toggle(oid)} />
                      {isOpen(oid) && o.grupos.filter(g => !query || matches(g.nome) || g.naturezas.some(n => matches(n.nome))).map(g => {
                        const gid = 'g:' + p.nome + '/' + o.nome + '/' + g.nome
                        return (
                          <div key={gid}>
                            <button onClick={() => toggle(gid)} className="w-full text-left">
                              <SubRow name={`▸ ${g.nome}`} cus={g.cus} level="grupo" indent={28} badge={o.cus ? `${Math.round((g.cus / o.cus) * 100)}%` : ''} />
                            </button>
                            {isOpen(gid) && g.naturezas.filter(n => matches(n.nome)).map((n, i) => (
                              <SubRow key={i} name={n.nome} cus={n.cus} level="nat" indent={46} badge={`${n.qtd}×`} />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Blocos: Demais Custos e Despesas / Não Operacionais */}
          {!query && data.blocos.map(b => {
            const bid = 'b:' + b.titulo
            return (
              <div key={bid}>
                <button onClick={() => toggle(bid)} style={{ gridTemplateColumns: GRID }}
                  className={`grid items-center w-full text-left gap-0 ${navy} rounded-lg mt-3 py-2 px-2 hover:opacity-95`}>
                  <span className="flex items-center gap-1 min-w-0">
                    <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen(bid) ? 'rotate-90' : ''} text-amber-300`} />
                    <span className="truncate font-extrabold text-[12px] text-white">{b.titulo}</span>
                  </span>
                  <span />
                  <Cell v={n0(b.total)} cls={b.col === 'dfix' ? 'text-amber-200' : 'text-rose-200'} bold />
                </button>
                {isOpen(bid) && b.grupos.map(g => {
                  const bgid = 'bg:' + b.titulo + '/' + g.nome
                  return (
                    <div key={bgid}>
                      <button onClick={() => toggle(bgid)} className="w-full text-left">
                        <SubRow name={`▸ ${g.nome}`} cus={g.val} level="grupo" indent={28} badge={b.total ? `${Math.round((g.val / b.total) * 100)}%` : ''} />
                      </button>
                      {isOpen(bgid) && g.naturezas.map((n, i) => (
                        <SubRow key={i} name={n.nome} cus={n.val} level="nat" indent={46} badge={`${n.qtd}×`} />
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Total geral */}
          <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 py-2.5 mt-3 rounded-lg ${isDark ? 'bg-[#0f1d33] border border-amber-500/30' : 'bg-[#0f2338]'}`}>
            <span className="flex items-center gap-1 min-w-0">
              <span className="truncate font-extrabold text-[12px] tracking-wide text-amber-400">TOTAL GERAL</span>
            </span>
            <Cell v={n0(t.fat)} cls="text-sky-200" bold />
            <Cell v={n0(t.cus)} cls="text-white" bold />
            <Cell v={pp(td.mb)} cls="text-emerald-200" />
            <Cell v={n0(t.dfix)} cls="text-amber-200" />
            <Cell v={n0(td.lop)} cls="text-emerald-200" bold />
            <Cell v={pp(td.ebit)} cls="text-emerald-200" />
            <Cell v={td.rus != null ? n0(td.rus) : '–'} cls="text-violet-200" />
            <Cell v={n0(t.dnao)} cls="text-rose-200" />
            <Cell v={pp(td.liq)} cls="text-white" bold />
          </div>
        </div>
      </div>

      <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Período {data.periodo} · Custos TOTVS+NIBO · Faturamento por medições (OSCs). Rateio de Demais Custos e Não Operacionais proporcional ao faturamento.
        MB% = (Fat − Custo Direto)/Fat · Lucro Op = MB − Rat. Custos · EBITDA = Lucro Op/Fat · %Líq = (Lucro Op − Rat. Invest)/Fat · R$/US = (Custo Direto + Rat. Custos)/US.
      </p>
    </div>
  )
}
