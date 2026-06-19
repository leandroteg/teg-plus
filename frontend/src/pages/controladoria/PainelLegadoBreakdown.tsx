// ─────────────────────────────────────────────────────────────────────────────
// PainelLegadoBreakdown — árvore Polo → Obra → Grupo → Natureza (DRE)
// 100% do banco (fin_legado_custos via vw_legado_resumo). NADA hardcoded.
// Faturamento e US NÃO são lançados no sistema → ficam vazios (—), e tudo que
// depende deles (MB%, Rat. rateios, Lucro Op, EBITDA, R$/US, %Líq) também.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { ChevronRight, Search, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { LegadoResumo } from '../../hooks/useLegado'

const n0 = (v: number) => (v ? Math.round(v).toLocaleString('pt-BR') : '–')
const DASH = '—'

// ── agregação em árvore ──────────────────────────────────────────────────────
interface Leaf { nome: string; valor: number; qtd: number }
interface GrupoN { nome: string; valor: number; qtd: number; naturezas: Leaf[] }
interface ObraN { nome: string; valor: number; qtd: number; grupos: GrupoN[] }
interface PoloN { nome: string; valor: number; qtd: number; obras: ObraN[] }
interface BlocoN { titulo: string; total: number; grupos: GrupoN[] }

function buildTree(rows: LegadoResumo[]) {
  const obraLabel = (r: LegadoResumo) =>
    r.obra_nome ?? (r.tipo_cc === 'estrutura' ? 'Estrutura (overhead, sem obra)' : r.tipo_cc === 'frota' ? 'Frota (overhead, sem obra)' : '— Sem obra')
  const poloLabel = (r: LegadoResumo) => r.polo ?? '— Sem polo (overhead)'

  // custo direto -> árvore polo/obra/grupo/natureza
  const pmap = new Map<string, { valor: number; qtd: number; obras: Map<string, { valor: number; qtd: number; grupos: Map<string, { valor: number; qtd: number; nats: Map<string, { valor: number; qtd: number }> }> }> }>()
  const bump = (m: Map<string, { valor: number; qtd: number }>, k: string, v: number, q: number) => {
    const o = m.get(k) ?? { valor: 0, qtd: 0 }; o.valor += v; o.qtd += q; m.set(k, o)
  }

  let fatTotal = 0
  const demais = new Map<string, { valor: number; qtd: number; nats: Map<string, { valor: number; qtd: number }> }>()
  const naoop = new Map<string, { valor: number; qtd: number; nats: Map<string, { valor: number; qtd: number }> }>()
  const toBlock = (blk: typeof demais, g: string, nat: string, v: number, q: number) => {
    const gg = blk.get(g) ?? { valor: 0, qtd: 0, nats: new Map() }
    gg.valor += v; gg.qtd += q; bump(gg.nats, nat, v, q); blk.set(g, gg)
  }

  for (const r of rows) {
    const v = r.valor || 0, q = r.qtd || 0
    const nd = r.natureza_dre
    if (nd === 'receita') { fatTotal += v; continue }
    if (nd === 'custo_direto') {
      const pk = poloLabel(r)
      const p = pmap.get(pk) ?? { valor: 0, qtd: 0, obras: new Map() }
      p.valor += v; p.qtd += q
      const ok = obraLabel(r)
      const o = p.obras.get(ok) ?? { valor: 0, qtd: 0, grupos: new Map() }
      o.valor += v; o.qtd += q
      const gk = r.grupo_dre ?? '—'
      const g = o.grupos.get(gk) ?? { valor: 0, qtd: 0, nats: new Map() }
      g.valor += v; g.qtd += q
      bump(g.nats, r.classe_desc ?? '—', v, q)
      o.grupos.set(gk, g); p.obras.set(ok, o); pmap.set(pk, p)
    } else if (nd === 'despesa_fixa' || nd === 'imposto') {
      toBlock(demais, r.grupo_dre ?? '—', r.classe_desc ?? '—', v, q)
    } else if (nd === 'nao_operacional') {
      toBlock(naoop, r.grupo_dre ?? '—', r.classe_desc ?? '—', v, q)
    }
  }

  const sortLeaf = (m: Map<string, { valor: number; qtd: number }>): Leaf[] =>
    [...m.entries()].map(([nome, x]) => ({ nome, ...x })).sort((a, b) => b.valor - a.valor)
  const sortGrupos = (m: Map<string, { valor: number; qtd: number; nats: Map<string, { valor: number; qtd: number }> }>): GrupoN[] =>
    [...m.entries()].map(([nome, g]) => ({ nome, valor: g.valor, qtd: g.qtd, naturezas: sortLeaf(g.nats) })).sort((a, b) => b.valor - a.valor)

  const polos: PoloN[] = [...pmap.entries()].map(([nome, p]) => ({
    nome, valor: p.valor, qtd: p.qtd,
    obras: [...p.obras.entries()].map(([on, o]) => ({ nome: on, valor: o.valor, qtd: o.qtd, grupos: sortGrupos(o.grupos) })).sort((a, b) => b.valor - a.valor),
  })).sort((a, b) => b.valor - a.valor)

  const blocos: BlocoN[] = []
  if (demais.size) blocos.push({ titulo: 'DEMAIS CUSTOS E DESPESAS', total: [...demais.values()].reduce((s, g) => s + g.valor, 0), grupos: sortGrupos(demais) })
  if (naoop.size) blocos.push({ titulo: 'DESP. NÃO OPERACIONAIS', total: [...naoop.values()].reduce((s, g) => s + g.valor, 0), grupos: sortGrupos(naoop) })

  const custoTotal = polos.reduce((s, p) => s + p.valor, 0)
  return { polos, blocos, fatTotal, custoTotal }
}

// largura das 10 colunas (nome + 9 métricas)
const GRID = 'minmax(220px,1fr) 92px 92px 44px 96px 96px 50px 60px 92px 46px'
const HEADERS = ['Polo / Obra / Grupo / Natureza', 'Faturamento', 'Custo Direto', 'MB%', 'Rat. Custos e Desp.', 'Lucro Op', 'EBITDA', 'R$/US', 'Rat. Invest.', '%Líq']

export default function PainelLegadoBreakdown({ rows }: { rows: LegadoResumo[] }) {
  const { isDark } = useTheme()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')

  const { polos, blocos, fatTotal, custoTotal } = useMemo(() => buildTree(rows), [rows])
  const semFaturamento = fatTotal === 0

  const allIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of polos) {
      ids.add('p:' + p.nome)
      for (const o of p.obras) { ids.add('o:' + p.nome + '/' + o.nome); for (const g of o.grupos) ids.add('g:' + p.nome + '/' + o.nome + '/' + g.nome) }
    }
    for (const b of blocos) { ids.add('b:' + b.titulo); for (const g of b.grupos) ids.add('bg:' + b.titulo + '/' + g.nome) }
    return ids
  }, [polos, blocos])

  const query = q.trim().toLowerCase()
  const isOpen = (id: string) => !!query || open.has(id)
  const toggle = (id: string) => setOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const matches = (s: string) => !query || s.toLowerCase().includes(query)

  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const navy = isDark ? 'bg-[#16243a]' : 'bg-[#1a3a5c]'
  const cCus = isDark ? 'text-slate-100' : 'text-slate-800'
  const muted = isDark ? 'text-slate-600' : 'text-slate-300'

  const Cell = ({ v, cls, bold }: { v: string; cls?: string; bold?: boolean }) => (
    <span className={`text-right tabular-nums text-[11.5px] px-1 truncate ${bold ? 'font-bold' : 'font-semibold'} ${cls ?? ''}`}>{v}</span>
  )
  // célula DRE não lançada → traço discreto
  const Na = () => <span className={`text-right text-[11px] px-1 ${muted}`}>{DASH}</span>

  // linha polo/obra: só Custo Direto é real; faturamento/derivados = — (não lançado)
  function DreRow({ id, name, sub, valor, level, dark }: { id: string; name: string; sub?: string; valor: number; level: 'polo' | 'obra'; dark?: boolean }) {
    const txt = dark ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-700'
    return (
      <button onClick={() => toggle(id)} style={{ gridTemplateColumns: GRID }}
        className={`grid items-center w-full text-left gap-0 ${level === 'polo' ? `${navy} rounded-lg mt-1 py-2` : (isDark ? 'bg-white/[0.03]' : 'bg-sky-50/70') + ' rounded-md mt-0.5 py-1.5'} px-2 hover:opacity-95`}>
        <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: level === 'obra' ? 16 : 0 }}>
          <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen(id) ? 'rotate-90' : ''} ${dark ? 'text-amber-300' : 'text-amber-500'}`} />
          <span className={`truncate ${level === 'polo' ? 'font-extrabold text-[13px]' : 'font-semibold text-[12px]'} ${txt}`}>{name}</span>
          {sub && <span className="shrink-0 text-[10px] text-slate-400">· {sub}</span>}
        </span>
        <Na />
        <Cell v={n0(valor)} cls={dark ? 'text-white' : cCus} bold />
        <Na /><Na /><Na /><Na /><Na /><Na /><Na />
      </button>
    )
  }
  function SubRow({ name, valor, parent, level, badge, indent }: { name: string; valor: number; parent: number; level: 'grupo' | 'nat'; badge: string; indent: number }) {
    return (
      <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 ${level === 'grupo' ? (isDark ? 'bg-white/[0.02]' : 'bg-slate-50') + ' rounded-md mt-0.5 py-1' : 'py-[3px]'}`}>
        <span className="flex items-center gap-1 min-w-0" style={{ paddingLeft: indent }}>
          <span className={`truncate ${level === 'grupo' ? 'font-semibold text-[11.5px]' : 'text-[11px]'} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{name}</span>
        </span>
        <span />
        <Cell v={n0(valor)} cls={cCus} />
        <span className={`text-right text-[10px] px-1 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{parent ? `${Math.round((valor / parent) * 100)}%` : ''}</span>
        <span /><span /><span /><span /><span />
        <span className={`text-right text-[10px] px-1 tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{badge}</span>
      </div>
    )
  }

  const polosF = polos.filter(p => matches(p.nome) || p.obras.some(o => matches(o.nome) || o.grupos.some(g => matches(g.nome) || g.naturezas.some(n => matches(n.nome)))))

  return (
    <div className="space-y-2">
      {/* aviso honesto */}
      {semFaturamento && (
        <div className={`rounded-xl px-3 py-2 text-[11px] flex items-start gap-2 ${isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <span className="font-bold">⚠ Faturamento e US não lançados</span>
          <span className="opacity-90">— colunas de margem (MB%, Lucro Op, EBITDA, R$/US, %Líq, rateios) ficam vazias (—) até as medições serem lançadas no sistema. Só o <b>Custo</b> vem do banco.</span>
        </div>
      )}

      {/* toolbar */}
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

      {/* cabeçalho */}
      <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 py-2 rounded-lg border-b-2 ${isDark ? 'border-amber-500/40 bg-white/[0.02]' : 'border-amber-400 bg-slate-50'}`}>
        {HEADERS.map((h, i) => (
          <span key={h} className={`text-[9.5px] font-bold uppercase tracking-wide px-1 truncate ${i === 0 ? 'text-left' : 'text-right'} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{h}</span>
        ))}
      </div>

      {/* árvore */}
      <div className="overflow-x-auto">
        <div className="min-w-[1010px] space-y-0">
          {polosF.length === 0 && <p className={`text-center text-sm py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum custo no recorte selecionado</p>}
          {polosF.map(p => {
            const pid = 'p:' + p.nome
            return (
              <div key={pid}>
                <DreRow id={pid} name={p.nome} valor={p.valor} level="polo" dark />
                {isOpen(pid) && p.obras.filter(o => !query || matches(o.nome) || o.grupos.some(g => matches(g.nome) || g.naturezas.some(n => matches(n.nome)))).map(o => {
                  const oid = 'o:' + p.nome + '/' + o.nome
                  return (
                    <div key={oid}>
                      <DreRow id={oid} name={o.nome} valor={o.valor} level="obra" />
                      {isOpen(oid) && o.grupos.filter(g => !query || matches(g.nome) || g.naturezas.some(n => matches(n.nome))).map(g => {
                        const gid = 'g:' + p.nome + '/' + o.nome + '/' + g.nome
                        return (
                          <div key={gid}>
                            <button onClick={() => toggle(gid)} className="w-full text-left"><SubRow name={`▸ ${g.nome}`} valor={g.valor} parent={o.valor} level="grupo" indent={28} badge={`${g.qtd}×`} /></button>
                            {isOpen(gid) && g.naturezas.filter(n => matches(n.nome)).map((n, i) => (
                              <SubRow key={i} name={n.nome} valor={n.valor} parent={g.valor} level="nat" indent={46} badge={`${n.qtd}×`} />
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

          {/* blocos despesa fixa / não operacional */}
          {!query && blocos.map(b => {
            const bid = 'b:' + b.titulo
            return (
              <div key={bid}>
                <button onClick={() => toggle(bid)} style={{ gridTemplateColumns: GRID }} className={`grid items-center w-full text-left gap-0 ${navy} rounded-lg mt-3 py-2 px-2 hover:opacity-95`}>
                  <span className="flex items-center gap-1 min-w-0">
                    <ChevronRight size={13} className={`shrink-0 transition-transform ${isOpen(bid) ? 'rotate-90' : ''} text-amber-300`} />
                    <span className="truncate font-extrabold text-[12px] text-white">{b.titulo}</span>
                  </span>
                  <span />
                  <Cell v={n0(b.total)} cls="text-white" bold />
                  <span /><span /><span /><span /><span /><span /><span />
                </button>
                {isOpen(bid) && b.grupos.map(g => {
                  const bgid = 'bg:' + b.titulo + '/' + g.nome
                  return (
                    <div key={bgid}>
                      <button onClick={() => toggle(bgid)} className="w-full text-left"><SubRow name={`▸ ${g.nome}`} valor={g.valor} parent={b.total} level="grupo" indent={28} badge={`${g.qtd}×`} /></button>
                      {isOpen(bgid) && g.naturezas.map((n, i) => <SubRow key={i} name={n.nome} valor={n.valor} parent={g.valor} level="nat" indent={46} badge={`${n.qtd}×`} />)}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* total */}
          <div style={{ gridTemplateColumns: GRID }} className={`grid items-center gap-0 px-2 py-2.5 mt-3 rounded-lg ${isDark ? 'bg-[#0f1d33] border border-amber-500/30' : 'bg-[#0f2338]'}`}>
            <span className="truncate font-extrabold text-[12px] tracking-wide text-amber-400">TOTAL CUSTO (banco)</span>
            <Na />
            <Cell v={n0(custoTotal + blocos.reduce((s, b) => s + b.total, 0))} cls="text-white" bold />
            <Na /><Na /><Na /><Na /><Na /><Na /><Na />
          </div>
        </div>
      </div>

      <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Fonte: <code>fin_legado_custos</code> (banco) · Custo Direto na árvore por polo/obra; Despesas Fixas e Não Operacionais em blocos próprios.
        Faturamento, US e indicadores de margem aparecem quando as <b>medições/receitas</b> forem lançadas no sistema.
      </p>
    </div>
  )
}
