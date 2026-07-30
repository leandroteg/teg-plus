// ─────────────────────────────────────────────────────────────────────────────
// components/rh/ponto/PontoConsolidacao.tsx — DP › Ponto › Consolidação.
// Duas sub-visões na MESMA aba (padrão dos ícones do Benefícios):
//   Por pessoa  — 1 linha por colaborador do mês, com o espelho individual;
//   Consolidado — 1 linha por mês, com o relatório do mês e o pacote p/ CEMIG.
//
// A seleção (com filtro por base e por pessoa) define quem entra no relatório
// consolidado e no ZIP — é a mesma lista nas duas visões.
//
// Não há etapa de aprovação: retificação já chega aprovada do Secullum.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { Search, Users, BarChart3, FileText, Package, Loader2, Lock, LockOpen, ArrowUpDown, Check } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAuth } from '../../../contexts/AuthContext'
import { usePontoResumoMes, usePontoResumoPeriodo, usePontoFechamentos, useFecharMes, useLiberarMes } from '../../../hooks/usePonto'
import { intervalToMin, minToHoras, labelMes, ultimosMeses } from '../../../lib/ponto'
import PontoReportModal, { type PontoReportAlvo } from './PontoReportModal'

interface Pessoa {
  id: string; nome: string; cargo: string | null
  baseId: string | null; base: string | null
  hh: number; ex: number; falta: number; dias: number; batidos: number
}
interface MesLinha {
  anoMes: string; pessoas: number; hh: number; ex: number; falta: number; assinados: number
}
type OrdemPessoa = 'nome' | 'base' | 'dias' | 'hh' | 'ex' | 'falta'
type OrdemMes = 'anoMes' | 'pessoas' | 'hh' | 'ex' | 'falta'

/** clique no cabeçalho: mesma coluna inverte, coluna nova começa em asc (texto) ou desc (número) */
function proxOrdem<K extends string>(atual: { k: K; dir: 1 | -1 }, k: K, numerica: boolean): { k: K; dir: 1 | -1 } {
  if (atual.k === k) return { k, dir: atual.dir === 1 ? -1 : 1 }
  return { k, dir: numerica ? -1 : 1 }
}

export default function PontoConsolidacao({ anoMes, onAnoMes, bases }: {
  anoMes: string
  /** a competência entra NESTA barra — a aba esconde a do DPPonto p/ não virar 2 linhas */
  onAnoMes?: (v: string) => void
  bases?: { id: string; nome: string; codigo?: string | null }[]
}) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [vista, setVista] = useState<'pessoa' | 'consolidado'>('pessoa')
  const [baseFil, setBaseFil] = useState('')
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [espelho, setEspelho] = useState<PontoReportAlvo | null>(null)
  const [ordP, setOrdP] = useState<{ k: OrdemPessoa; dir: 1 | -1 }>({ k: 'nome', dir: 1 })
  const [ordM, setOrdM] = useState<{ k: OrdemMes; dir: 1 | -1 }>({ k: 'anoMes', dir: -1 })

  const { user } = useAuth()
  const quem = (user as { nome?: string; email?: string } | null)?.nome
    || (user as { email?: string } | null)?.email || 'RH'
  const fechamentos = usePontoFechamentos()
  const fechar = useFecharMes()
  const liberar = useLiberarMes()
  const fechPorMes = useMemo(() =>
    new Map((fechamentos.data ?? []).map(f => [String(f.ano_mes).slice(0, 10), f])), [fechamentos.data])

  const resumo = usePontoResumoMes(anoMes)
  // janela dos últimos 12 meses só quando a visão mensal está aberta
  const meses = useMemo(() => ultimosMeses(12), [])
  const de = (meses[meses.length - 1] ?? anoMes).slice(0, 7)
  const ate = (meses[0] ?? anoMes).slice(0, 7)
  const periodo = usePontoResumoPeriodo(vista === 'consolidado' ? de : ate, ate)

  const txt = isDark ? 'text-slate-200' : 'text-slate-700'
  const sub = isDark ? 'text-slate-500' : 'text-slate-400'
  const head = isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'
  const row = isDark ? 'border-white/[0.05] hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50/70'
  const selCls = `px-3 py-1.5 rounded-xl border text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700'}`
  const TH = 'text-left text-[10px] uppercase tracking-widest font-bold px-3 py-2.5'
  const TD = 'px-3 py-2 text-xs'

  // ── pessoas do mês (mesma agregação nas duas visões) ───────────────────────
  const pessoas: Pessoa[] = useMemo(() => {
    const m = new Map<string, Pessoa>()
    for (const r of (resumo.data ?? [])) {
      if (!r.colaborador_id) continue
      const a = m.get(r.colaborador_id) ?? { id: r.colaborador_id, nome: r.colaborador_nome ?? '—', cargo: r.cargo, baseId: r.base_id, base: r.base_nome, hh: 0, ex: 0, falta: 0, dias: 0, batidos: 0 }
      a.hh += intervalToMin(r.hh_trabalhada); a.ex += intervalToMin(r.extras); a.falta += intervalToMin(r.faltas)
      a.dias += r.dias || 0; a.batidos += r.dias_batidos || 0
      m.set(r.colaborador_id, a)
    }
    return [...m.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
  }, [resumo.data])

  const q = busca.trim().toLowerCase()
  const lista = pessoas
    .filter(p => (!baseFil || p.baseId === baseFil) && (!q || p.nome.toLowerCase().includes(q)))
    .sort((a, b) => {
      const k = ordP.k
      const cmp = k === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR')
        : k === 'base' ? (a.base ?? '').localeCompare(b.base ?? '', 'pt-BR')
          : k === 'dias' ? a.batidos - b.batidos
            : (a[k] as number) - (b[k] as number)
      return (cmp !== 0 ? cmp : a.nome.localeCompare(b.nome, 'pt-BR')) * ordP.dir
    })
  // seleção vazia = todos do filtro (é o comportamento esperado ao só filtrar)
  const escolhidos = sel.size ? lista.filter(p => sel.has(p.id)) : lista
  const nomeBase = bases?.find(b => b.id === baseFil)?.nome
  const todosMarcados = lista.length > 0 && lista.every(p => sel.has(p.id))

  const marcarTodos = () => setSel(todosMarcados ? new Set() : new Set(lista.map(p => p.id)))
  const alternar = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── linhas mensais ─────────────────────────────────────────────────────────
  const linhasMes: MesLinha[] = useMemo(() => {
    const m = new Map<string, MesLinha & { ids: Set<string> }>()
    for (const r of (periodo.data ?? [])) {
      const k = String(r.ano_mes).slice(0, 10)
      const a = m.get(k) ?? { anoMes: k, pessoas: 0, hh: 0, ex: 0, falta: 0, assinados: 0, ids: new Set<string>() }
      if (r.colaborador_id) a.ids.add(r.colaborador_id)
      a.hh += intervalToMin(r.hh_trabalhada); a.ex += intervalToMin(r.extras); a.falta += intervalToMin(r.faltas)
      m.set(k, a)
    }
    return [...m.values()].map(x => ({ ...x, pessoas: x.ids.size })).sort((a, b) => {
      const k = ordM.k
      const cmp = k === 'anoMes' ? a.anoMes.localeCompare(b.anoMes) : (a[k] as number) - (b[k] as number)
      return (cmp !== 0 ? cmp : a.anoMes.localeCompare(b.anoMes)) * ordM.dir
    })
  }, [periodo.data, ordM])

  const hoje = new Date()
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const fechAtual = fechPorMes.get(anoMes)
  const mesEncerrado = anoMes < mesCorrente

  const abrirConsolidado = (mes: string, quem: { id: string; nome: string }[], recorte?: string) =>
    setEspelho({ tipo: 'consolidado', spec: { ano_mes: mes, recorte, colaboradores: quem } })

  const vistaBtn = (v: typeof vista, Icon: typeof Users, titulo: string) => (
    <button key={v} onClick={() => setVista(v)} title={titulo}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${vista === v
        ? isDark ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-700'
        : isDark ? 'border-white/10 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-slate-700'}`}>
      <Icon size={14} />
    </button>
  )

  // cabecalho clicavel: seta indica a coluna ativa e o sentido
  const ThP = ({ label, k, num, cls = '' }: { label: string; k: OrdemPessoa; num?: boolean; cls?: string }) => (
    <th className={`${TH} ${cls} cursor-pointer select-none`} onClick={() => setOrdP(o => proxOrdem(o, k, !!num))} title={`Ordenar por ${label.toLowerCase()}`}>
      <span className={`inline-flex items-center gap-1 ${ordP.k === k ? 'text-violet-500' : ''}`}>
        {label}{ordP.k === k ? <span className="text-[8px] leading-none">{ordP.dir === 1 ? '▲' : '▼'}</span> : <ArrowUpDown size={10} className="opacity-30" />}
      </span>
    </th>
  )
  const ThM = ({ label, k, num, cls = '' }: { label: string; k: OrdemMes; num?: boolean; cls?: string }) => (
    <th className={`${TH} ${cls} cursor-pointer select-none`} onClick={() => setOrdM(o => proxOrdem(o, k, !!num))} title={`Ordenar por ${label.toLowerCase()}`}>
      <span className={`inline-flex items-center gap-1 ${ordM.k === k ? 'text-violet-500' : ''}`}>
        {label}{ordM.k === k ? <span className="text-[8px] leading-none">{ordM.dir === 1 ? '▲' : '▼'}</span> : <ArrowUpDown size={10} className="opacity-30" />}
      </span>
    </th>
  )

  const painel = `rounded-2xl border overflow-hidden ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`

  return (
    <div className="space-y-3">
      {/* TUDO numa linha só: competência · área · busca · contador · ação · visões */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={anoMes} onChange={e => onAnoMes?.(e.target.value)} className={selCls} title="Competência">
          {ultimosMeses(12).map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
        </select>
        <select value={baseFil} onChange={e => { setBaseFil(e.target.value); setSel(new Set()) }} className={selCls}>
          <option value="">Todas as áreas</option>
          {(bases ?? []).map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
        <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 min-w-[150px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={13} className={sub} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…"
            className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
        </div>
        <span className={`text-[11px] whitespace-nowrap ${sub}`}>
          <b className={txt}>{escolhidos.length}</b> {sel.size ? 'selec.' : 'no filtro'}
        </span>
        <button disabled={!escolhidos.length}
          onClick={() => abrirConsolidado(anoMes, escolhidos.map(p => ({ id: p.id, nome: p.nome })), nomeBase)}
          title={`Relatório consolidado de ${labelMes(anoMes)}${nomeBase ? ` — ${nomeBase}` : ''}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 whitespace-nowrap">
          <FileText size={13} /> Consolidado ({escolhidos.length})
        </button>
        {/* fechamento do mês selecionado — na barra, visível nas duas visões */}
        {fechAtual?.status === 'fechado' ? (
          <button onClick={() => liberar.mutate({ anoMes, por: quem })} disabled={fechar.isPending || liberar.isPending}
            title={`Fechado por ${fechAtual.fechado_por ?? '—'} em ${fechAtual.fechado_em ? new Date(fechAtual.fechado_em).toLocaleString('pt-BR') : '—'} — clique para reabrir`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 disabled:opacity-40 whitespace-nowrap">
            <LockOpen size={13} /> Liberar ponto
          </button>
        ) : (
          <button onClick={() => fechar.mutate({ anoMes, por: quem })} disabled={!mesEncerrado || fechar.isPending || liberar.isPending}
            title={mesEncerrado
              ? `Fechar o ponto de ${labelMes(anoMes)} e congelar os totais`
              : `${labelMes(anoMes)} ainda está em andamento — o fechamento libera quando o mês terminar`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-30 whitespace-nowrap">
            <Lock size={13} /> Fechar ponto
          </button>
        )}
        <div className="flex items-center gap-1">
          {vistaBtn('pessoa', Users, 'Por pessoa')}
          {vistaBtn('consolidado', BarChart3, 'Consolidado por mês')}
        </div>
      </div>

      {vista === 'pessoa' ? (
        <div className={painel}>
          {resumo.isLoading ? <Carregando /> : !lista.length ? <Vazio msg="Nenhum colaborador com ponto no mês." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className={head}>
                  <th className={`${TH} w-px`}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} className="accent-violet-500" title="Selecionar todos" /></th>
                  <ThP label="Colaborador" k="nome" /><ThP label="Área" k="base" cls="hidden md:table-cell" />
                  <ThP label="Dias" k="dias" num /><ThP label="HH" k="hh" num cls="hidden sm:table-cell" />
                  <ThP label="Extras" k="ex" num /><ThP label="Faltas" k="falta" num cls="hidden sm:table-cell" />
                  <th className={TH}>Assinatura</th><th className={TH}></th>
                </tr></thead>
                <tbody>{lista.map(p => (
                  <tr key={p.id} className={`border-t cursor-pointer ${row}`}
                    onClick={() => setEspelho({ tipo: 'colaborador', row: { colaborador_id: p.id, colaborador_nome: p.nome, ano_mes: anoMes } })}>
                    <td className={`${TD} w-px`} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(p.id)} onChange={() => alternar(p.id)} className="accent-violet-500" />
                    </td>
                    <td className={`${TD} font-semibold ${txt} max-w-[250px]`}>
                      <span className="block truncate" title={p.nome}>{p.nome}</span>
                      <span className={`text-[10px] ${sub}`}>{p.cargo ?? '—'}</span>
                    </td>
                    <td className={`${TD} hidden md:table-cell ${sub}`}>{p.base ?? '—'}</td>
                    <td className={`${TD} ${txt}`}>{p.batidos}/{p.dias}</td>
                    <td className={`${TD} hidden sm:table-cell ${sub}`}>{p.hh > 0 ? minToHoras(p.hh) : '—'}</td>
                    <td className={`${TD} font-semibold ${p.ex > 0 ? 'text-orange-500' : sub}`}>{p.ex > 0 ? minToHoras(p.ex) : '—'}</td>
                    <td className={`${TD} hidden sm:table-cell ${p.falta > 0 ? 'text-rose-500 font-semibold' : sub}`}>{p.falta > 0 ? minToHoras(p.falta) : '—'}</td>
                    <td className={TD}><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>não enviado</span></td>
                    <td className={`${TD} w-px`}><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-500 whitespace-nowrap"><FileText size={13} /> Espelho</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className={painel}>
          {periodo.isLoading ? <Carregando /> : !linhasMes.length ? <Vazio msg="Sem ponto apurado no período." /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className={head}>
                  <ThM label="Mês" k="anoMes" /><ThM label="Colaboradores" k="pessoas" num />
                  <ThM label="HH" k="hh" num cls="hidden sm:table-cell" /><ThM label="Extras" k="ex" num />
                  <ThM label="Faltas" k="falta" num cls="hidden sm:table-cell" />
                  <th className={TH}>Fechamento</th><th className={TH}>Assinados</th><th className={TH}></th>
                </tr></thead>
                <tbody>{linhasMes.map(l => {
                  const doMes = l.anoMes === anoMes
                  const fech = fechPorMes.get(l.anoMes)
                  // só depois do mês terminar (regra também aplicada na RPC)
                  const encerrado = l.anoMes < mesCorrente
                  const trabalhando = (fechar.isPending || liberar.isPending)
                  return (
                    <tr key={l.anoMes} className={`border-t ${row}`}>
                      <td className={`${TD} font-semibold ${txt}`}>{labelMes(l.anoMes)}{doMes && <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded bg-violet-500/15 text-violet-500 font-bold uppercase`}>atual</span>}</td>
                      <td className={`${TD} ${txt}`}>{l.pessoas}</td>
                      <td className={`${TD} hidden sm:table-cell ${sub}`}>{l.hh > 0 ? minToHoras(l.hh) : '—'}</td>
                      <td className={`${TD} font-semibold ${l.ex > 0 ? 'text-orange-500' : sub}`}>{l.ex > 0 ? minToHoras(l.ex) : '—'}</td>
                      <td className={`${TD} hidden sm:table-cell ${l.falta > 0 ? 'text-rose-500' : sub}`}>{l.falta > 0 ? minToHoras(l.falta) : '—'}</td>
                      <td className={TD}>
                        {fech?.status === 'fechado' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-emerald-500/15 text-emerald-500"
                            title={`Fechado por ${fech.fechado_por ?? '—'} em ${fech.fechado_em ? new Date(fech.fechado_em).toLocaleString('pt-BR') : '—'}`}>
                            <Lock size={9} /> fechado
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'}`}
                            title={fech?.status === 'liberado' ? `Liberado por ${fech.liberado_por ?? '—'}` : encerrado ? 'Mês encerrado — pode fechar' : 'Mês em andamento'}>
                            <LockOpen size={9} /> {fech?.status === 'liberado' ? 'liberado' : 'em aberto'}
                          </span>
                        )}
                      </td>
                      <td className={`${TD} ${sub}`}>0/{l.pessoas}</td>
                      <td className={`${TD} w-px`}>
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => abrirConsolidado(l.anoMes, (doMes ? escolhidos : []).map(p => ({ id: p.id, nome: p.nome })), nomeBase)}
                            disabled={!doMes || !escolhidos.length}
                            title={doMes ? 'Relatório consolidado do mês' : 'Troque a competência no filtro do topo para gerar outro mês'}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-violet-500/15 text-violet-500 hover:bg-violet-500/25 disabled:opacity-30 whitespace-nowrap">
                            <FileText size={12} /> Relatório
                          </button>
                          <button disabled title="Disponível quando a assinatura do espelho estiver ligada — hoje não há PDF assinado para empacotar"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-500/10 text-slate-400 disabled:opacity-60 whitespace-nowrap cursor-not-allowed">
                            <Package size={12} /> ZIP
                          </button>
                          {fech?.status === 'fechado' ? (
                            <button onClick={() => liberar.mutate({ anoMes: l.anoMes, por: quem })} disabled={trabalhando}
                              title="Reabrir o mês para ajustes"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 disabled:opacity-40 whitespace-nowrap">
                              <LockOpen size={12} /> Liberar
                            </button>
                          ) : (
                            <button onClick={() => fechar.mutate({ anoMes: l.anoMes, por: quem })} disabled={!encerrado || trabalhando}
                              title={encerrado ? 'Fechar o ponto do mês e congelar os totais' : 'Só depois que o mês terminar'}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 disabled:opacity-30 whitespace-nowrap">
                              <Check size={12} /> Fechar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {espelho && <PontoReportModal alvo={espelho} onClose={() => setEspelho(null)} />}
    </div>
  )

  function Carregando() { return <div className="flex justify-center py-14"><Loader2 className="animate-spin text-violet-500" size={24} /></div> }
  function Vazio({ msg }: { msg: string }) { return <div className={`text-center py-14 text-sm ${sub}`}>{msg}</div> }
}
