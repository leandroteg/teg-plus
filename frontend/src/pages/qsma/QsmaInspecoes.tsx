import { useMemo, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardList, CalendarRange, CheckCircle2, Plus, ChevronUp, ChevronDown,
  Trash2, Ban, ShieldCheck, Play, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import { useModelosChecklist, useSalvarModelo, useInspecoes, useSalvarInspecao } from '../../hooks/useQsma'
import { QsmaModal, ModalFooter, FotosUpload, fmtData } from '../../components/qsma/ModalBits'
import { QsmaToolbar, ToolbarSelect, ToolbarPills, BotaoNovo, MultiCheck } from '../../components/qsma/Toolbar'
import { ObraPicker, pickerInputCls, pickerLabelCls } from '../../components/qsma/Pickers'
import {
  useObrasComProjeto, useColaboradoresAtivos, usePlanejamentoEquipe,
  useCriarPlanEquipe, useAtualizarPlanEquipe, useExcluirPlanEquipe, papelSugerido,
} from '../../hooks/useObras'
import type { ObraPlanejamentoEquipe } from '../../types/obras'
import type { QsmaModeloChecklist, QsmaInspecao, ItemChecklist, RespostaItem, TipoModelo, EscopoModelo, TipoResposta } from '../../types/qsma'
import { TIPO_MODELO_LABEL, ESCOPO_MODELO_LABEL, STATUS_INSPECAO_LABEL } from '../../types/qsma'

const STEPS: FlowStep[] = [
  {
    key: 'modelos', label: 'Modelos',
    description: 'Monte os checklists configuráveis: itens, tipo de resposta e veredito.',
    icon: ClipboardList,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'programacao', label: 'Programação',
    description: 'Agende inspeções por obra, equipe ou veículo.',
    icon: CalendarRange,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
  {
    key: 'execucoes', label: 'Execuções',
    description: 'Inspeções realizadas com respostas, evidências e veredito.',
    icon: CheckCircle2,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
]

export default function QsmaInspecoes() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<string>(params.get('aba') ?? 'modelos')
  const [modalModelo, setModalModelo] = useState<QsmaModeloChecklist | 'novo' | null>(null)
  // modal único "Programar Inspeção" — também aloca o TST e marca os tipos
  const [modalProg, setModalProg] = useState<null | { aloc?: ObraPlanejamentoEquipe; obraId?: string; data?: string; tstId?: string }>(null)
  const [executar, setExecutar] = useState<QsmaInspecao | null>(null)
  const [pickerExec, setPickerExec] = useState(false)

  // deep-link do Novo Registro: /qsma/inspecoes?novo=programar
  useEffect(() => {
    const novo = params.get('novo')
    if (novo === 'programar') { setAba('programacao'); setModalProg({}) }
    if (novo === 'executar') { setAba('programacao'); setPickerExec(true) }
    if (novo === 'modelo') { setAba('modelos'); setModalModelo('novo') }
    if (novo) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: modelos = [] } = useModelosChecklist()
  const { data: inspecoes = [] } = useInspecoes()
  const { data: obras = [] } = useObrasComProjeto()
  const { data: equipeObras = [] } = usePlanejamentoEquipe()
  const obraNome = (id?: string) => obras.find(o => o.id === id)?.nome ?? '—'

  // supervisor/admin podem alterar a alocação clicando no nome
  const { isAdmin, atLeast } = useAuth()
  const podeRealocar = isAdmin || atLeast('supervisor')

  // filtros por aba (busca + selects na primeira linha, padrão do sistema)
  const [busca, setBusca] = useState('')
  const [tipoF, setTipoF] = useState('')
  const [grupoF, setGrupoF] = useState('')
  const [exObras, setExObras] = useState<Set<string>>(new Set())
  const [veredF, setVeredF] = useState('todos')

  // TSTs = alocação do módulo Obras (obr_planejamento_equipe) — INTEGRADO nos 2
  // sentidos: aloca em Obras aparece aqui; aloca aqui grava lá também.
  const tsts = useMemo(() => equipeObras.filter(r =>
    ['planejado', 'mobilizado', 'ativo'].includes(r.status)
    && /seguran|tst|sesmt/i.test(r.funcao ?? '')
  ), [equipeObras])

  // tipos de inspeção marcados = modelos distintos das inspeções do TST na obra
  const tiposPorTst = useMemo(() => {
    const m = new Map<string, { codigo?: string; nome: string }[]>()
    inspecoes.forEach(i => {
      if (!i.equipe_lider_id || !i.obra_id) return
      const k = `${i.equipe_lider_id}|${i.obra_id}`
      const mod = modelos.find(x => x.id === i.modelo_id)
      const nome = mod?.nome ?? i.modelo?.nome ?? ''
      if (!nome) return
      const arr = m.get(k) ?? []
      if (!arr.some(a => a.nome === nome)) { arr.push({ codigo: mod?.codigo, nome }); m.set(k, arr) }
    })
    return m
  }, [inspecoes, modelos])

  // TSTs do RH ainda SEM alocação — aparecem p/ serem alocados
  const { data: colabsAtivos = [] } = useColaboradoresAtivos()
  const tstsSemAlocacao = useMemo(() => {
    const alocados = new Set(tsts.map(t => t.colaborador_id).filter(Boolean))
    const q2 = busca.trim().toLowerCase()
    return colabsAtivos.filter(c =>
      /seguran|tst|sesmt/i.test(c.cargo ?? '')
      && !alocados.has(c.id)
      && (!q2 || c.nome.toLowerCase().includes(q2))
    )
  }, [colabsAtivos, tsts, busca])

  // ── Gantt semanal (mesmo template da Programação de Obras) ─────────────────
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const mondayOf = (d: Date) => { const x = new Date(d); const day = x.getDay(); return addDays(x, day === 0 ? -6 : 1 - day) }
  const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const [minimizados, setMinimizados] = useState<Set<string>>(new Set())
  const toggleMin = (id: string) => setMinimizados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const topScrollRef = useRef<HTMLDivElement>(null)
  const mainScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const top = topScrollRef.current, main = mainScrollRef.current
    if (!top || !main) return
    let lock = false
    const sync = (from: HTMLElement, to: HTMLElement) => () => {
      if (lock) return; lock = true; to.scrollLeft = from.scrollLeft; lock = false
    }
    const a = sync(top, main), b = sync(main, top)
    top.addEventListener('scroll', a); main.addEventListener('scroll', b)
    return () => { top.removeEventListener('scroll', a); main.removeEventListener('scroll', b) }
  }, [aba])

  const weeks = useMemo(() => {
    const hoje = new Date()
    const startMon = mondayOf(hoje)
    const ends: number[] = [
      ...tsts.map(t => new Date(t.data_fim || addDays(new Date(t.data_inicio), 30).toISOString()).getTime()),
      ...inspecoes.filter(i => i.data_prevista).map(i => new Date(i.data_prevista! + 'T12:00:00').getTime()),
    ]
    let endDate = ends.length ? new Date(Math.max(...ends)) : addDays(hoje, 56)
    const minEnd = addDays(startMon, 7 * 8)
    if (endDate < minEnd) endDate = minEnd
    const list: { mon: Date; sat: Date; label: string }[] = []
    let cur = startMon, guard = 0
    while (cur <= endDate && guard < 40) {
      const sat = addDays(cur, 5)
      list.push({ mon: cur, sat, label: `${ddmm(cur)} - ${ddmm(sat)}` })
      cur = addDays(cur, 7); guard++
    }
    return list
  }, [tsts, inspecoes]) // eslint-disable-line react-hooks/exhaustive-deps

  // inspeções por obra × semana (contadores p/ os chips do Gantt)
  const inspSemana = useMemo(() => {
    const m = new Map<string, { prog: number; exec: number; bloq: number }>()
    inspecoes.forEach(i => {
      const dt = i.status === 'executada' ? (i.data_execucao ?? i.data_prevista) : i.data_prevista
      if (!dt || !i.obra_id) return
      const d = new Date(dt.includes('T') ? dt : dt + 'T12:00:00')
      const idx = weeks.findIndex(w => d >= w.mon && d < addDays(w.mon, 7))
      if (idx < 0) return
      const k = `${i.obra_id}|${idx}`
      const cur = m.get(k) ?? { prog: 0, exec: 0, bloq: 0 }
      if (i.status === 'executada') { cur.exec++; if (i.veredito === 'bloqueado') cur.bloq++ }
      else if (i.status === 'programada') cur.prog++
      m.set(k, cur)
    })
    return m
  }, [inspecoes, weeks])

  // grupos Projeto › Obra (obras com TST alocado OU com inspeção)
  const gruposGantt = useMemo(() => {
    const q2 = busca.trim().toLowerCase()
    const obraIds = new Set<string>([
      ...tsts.map(t => t.obra_id).filter(Boolean) as string[],
      ...inspecoes.map(i => i.obra_id).filter(Boolean) as string[],
    ])
    const projMap = new Map<string, { id: string; nome: string; obras: { id: string; nome: string; tsts: typeof tsts }[] }>()
    for (const oid of obraIds) {
      if (exObras.has(oid)) continue
      const o = obras.find(x => x.id === oid)
      if (!o) continue
      const doTst = tsts.filter(t => t.obra_id === oid && (!q2 || t.nome.toLowerCase().includes(q2)))
      if (q2 && doTst.length === 0 && !o.nome.toLowerCase().includes(q2)) continue
      const pid = o.projeto_id ?? '__sem__'
      if (!projMap.has(pid)) projMap.set(pid, { id: pid, nome: o.projeto_nome ?? 'Sem projeto', obras: [] })
      projMap.get(pid)!.obras.push({ id: oid, nome: o.nome, tsts: doTst })
    }
    return [...projMap.values()]
      .map(p => ({ ...p, obras: p.obras.sort((a, b) => a.nome.localeCompare(b.nome)) }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [tsts, inspecoes, obras, exObras, busca])

  const COL_W = { esq: 340, semana: 96 }
  const totalW = COL_W.esq + weeks.length * COL_W.semana
  const hojeGantt = new Date()
  const borderG = isDark ? 'border-white/[0.06]' : 'border-slate-200'

  const obrasComRegistro = useMemo(() => {
    const ids = new Set(inspecoes.map(i => i.obra_id).filter(Boolean))
    return obras.filter(o => ids.has(o.id)).map(o => ({ value: o.id, label: o.nome }))
  }, [inspecoes, obras])

  const q = busca.trim().toLowerCase()
  const grupos = useMemo(() => [...new Set(modelos.map(m => m.grupo).filter(Boolean))].sort() as string[], [modelos])
  const modelosF = useMemo(() => modelos.filter(m =>
    (!q || m.nome.toLowerCase().includes(q) || (m.codigo ?? '').toLowerCase().includes(q))
    && (!tipoF || m.tipo === tipoF)
    && (!grupoF || m.grupo === grupoF)
  ), [modelos, q, tipoF, grupoF])
  // agrupado por "tipo de guia" (grupo) p/ renderização com headers
  const modelosPorGrupo = useMemo(() => {
    const map = new Map<string, typeof modelos>()
    for (const m of modelosF) {
      const g = m.grupo || 'Sem grupo'
      map.set(g, [...(map.get(g) ?? []), m])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [modelosF])
  const programadas = useMemo(() => inspecoes.filter(i =>
    i.status === 'programada'
    && !exObras.has(i.obra_id ?? '')
    && (!q || (i.modelo?.nome ?? '').toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q))
  ), [inspecoes, exObras, q])
  const executadas = useMemo(() => inspecoes.filter(i =>
    i.status === 'executada'
    && !exObras.has(i.obra_id ?? '')
    && (!q || (i.modelo?.nome ?? '').toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q) || (i.executor_nome ?? '').toLowerCase().includes(q))
    && (veredF === 'todos' || (veredF === 'bloqueado' ? i.veredito === 'bloqueado' : veredF === 'liberado' ? i.veredito === 'liberado' : true))
  ), [inspecoes, exObras, q, veredF])

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <ControladoriaFlow
      title="Inspeções"
      subtitle="Checklists de campo — montar, programar e executar com evidência e veredito"
      steps={STEPS}
      activeStep={aba}
      onStepChange={setAba}
    >
      {/* ── Aba Modelos ── */}
      {aba === 'modelos' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${modelosF.length} modelo${modelosF.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar modelo ou código…"
            acoes={<BotaoNovo label="Novo Modelo" onClick={() => setModalModelo('novo')} />}
          >
            <ToolbarSelect
              isDark={isDark} value={grupoF} onChange={setGrupoF} allLabel="Todos os tipos de guia"
              options={grupos.map(g => ({ value: g, label: g }))}
            />
            <ToolbarSelect
              isDark={isDark} value={tipoF} onChange={setTipoF} allLabel="Todos os tipos"
              options={(Object.keys(TIPO_MODELO_LABEL) as (keyof typeof TIPO_MODELO_LABEL)[]).map(t => ({ value: t, label: TIPO_MODELO_LABEL[t] }))}
            />
          </QsmaToolbar>
          {modelosF.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum modelo de checklist — crie o primeiro" />
          ) : (
            <div className="space-y-4">
              {modelosPorGrupo.map(([grupo, lista]) => (
                <div key={grupo}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${txtMuted}`}>{grupo}</p>
                    <span className={`text-[9px] font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>({lista.length})</span>
                    <div className={`flex-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lista.map(m => (
                      <button key={m.id} onClick={() => setModalModelo(m)} className={`text-left ${card} p-4 hover:shadow-md transition-all`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{m.codigo ?? '—'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${m.ativo
                            ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                            : isDark ? 'bg-slate-500/15 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                        <p className={`text-sm font-bold leading-snug ${txtMain}`}>{m.nome}</p>
                        <p className={`text-[10px] mt-1 ${txtMuted}`}>
                          {TIPO_MODELO_LABEL[m.tipo]} · {ESCOPO_MODELO_LABEL[m.escopo]} · {m.itens.length} item(ns)
                          {m.exige_veredito && ' · com veredito'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Programação ── */}
      {aba === 'programacao' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${programadas.length} programada${programadas.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar inspeção…"
          >
            <MultiCheck isDark={isDark} label="Obras" options={obrasComRegistro} excluded={exObras} setExcluded={setExObras} />
          </QsmaToolbar>

          {/* linha info */}
          <div className={`flex items-center gap-2 text-[11px] ${txtMuted}`}>
            <CalendarRange size={12} /> {tsts.length} TST(s) alocado(s) · {inspecoes.filter(i => i.status !== 'cancelada').length} inspeção(ões) · {weeks.length} semanas · clique no nome do TST p/ alocar/programar · numa célula p/ programar na semana
          </div>

          {/* Barra de rolagem horizontal fixa (sticky) — sincronizada com a tabela */}
          <div ref={topScrollRef} className={`sticky top-0 z-20 overflow-x-scroll overflow-y-hidden h-3.5 rounded-lg border ${isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
            <div style={{ width: `${totalW}px`, height: 1 }} />
          </div>

          <div ref={mainScrollRef} className={`rounded-xl border overflow-x-auto ${borderG}`}>
            {/* Header */}
            <div className={`flex items-stretch border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`shrink-0 px-3 py-2 border-r ${borderG} flex items-center text-[10px] font-bold uppercase tracking-wider ${txtMuted}`} style={{ width: `${COL_W.esq}px` }}>Projeto › Obra › TST</div>
              {weeks.map((w, i) => {
                const atual = hojeGantt >= w.mon && hojeGantt <= addDays(w.sat, 1)
                return (
                  <div key={i} className={`shrink-0 border-r px-1 py-1 text-center ${borderG} ${atual ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : ''}`} style={{ width: `${COL_W.semana}px` }}>
                    <div className={`text-[8px] font-bold uppercase ${atual ? 'text-red-500' : txtMuted}`}>Sem.{atual ? ' • atual' : ''}</div>
                    <div className={`text-[9px] font-semibold leading-tight ${txtMain}`}>{w.label}</div>
                  </div>
                )
              })}
            </div>

            {gruposGantt.length === 0 ? (
              <div className={`text-center py-12 ${txtMuted}`}>
                <CalendarRange size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhum TST alocado — aloque em Obras › Alocação de Equipes</p>
              </div>
            ) : gruposGantt.map(proj => {
              const pmin = minimizados.has(proj.id)
              const total = proj.obras.reduce((a, ob) => a + ob.tsts.length, 0)
              return (
                <div key={proj.id}>
                  {/* Projeto */}
                  <button onClick={() => toggleMin(proj.id)} className={`flex items-center w-full text-left border-b transition-colors ${isDark ? 'border-white/[0.04] bg-white/[0.06] hover:bg-white/[0.08]' : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60'}`} style={{ minWidth: `${totalW}px` }}>
                    <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ width: `${COL_W.esq}px` }}>
                      {pmin ? <ChevronDown size={14} className={txtMuted} /> : <ChevronUp size={14} className={txtMuted} />}
                      <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${txtMain}`}>{proj.nome}</span>
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>{total}</span>
                    </div>
                  </button>

                  {!pmin && proj.obras.map(ob => {
                    const omin = minimizados.has(`${proj.id}:${ob.id}`)
                    return (
                      <div key={ob.id}>
                        {/* Obra: células clicáveis com chips de inspeção da semana */}
                        <div className={`flex items-stretch border-b ${isDark ? 'border-white/[0.04] bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`} style={{ minWidth: `${totalW}px` }}>
                          <button onClick={() => toggleMin(`${proj.id}:${ob.id}`)} className="flex items-center gap-1.5 py-1.5 shrink-0 text-left" style={{ width: `${COL_W.esq}px`, paddingLeft: 24, paddingRight: 8 }}>
                            {omin ? <ChevronDown size={12} className={txtMuted} /> : <ChevronUp size={12} className={txtMuted} />}
                            <ShieldCheck size={11} className="text-red-500" />
                            <span className={`text-[11px] font-bold truncate ${txtMain}`}>{ob.nome}</span>
                            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>{ob.tsts.length} TST</span>
                          </button>
                          {weeks.map((w, i) => {
                            const c = inspSemana.get(`${ob.id}|${i}`)
                            const passada = addDays(w.sat, 1) < hojeGantt
                            const dataClick = (w.mon < hojeGantt ? hojeGantt : w.mon).toISOString().split('T')[0]
                            return (
                              <button
                                key={i}
                                onClick={() => !passada && setModalProg({ obraId: ob.id, data: dataClick })}
                                disabled={passada && !c}
                                title={passada ? undefined : `Programar inspeção em ${ob.nome} — semana ${w.label}`}
                                className={`shrink-0 border-r ${borderG} flex items-center justify-center gap-1 py-1.5 transition-colors ${passada ? '' : (isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50')}`}
                                style={{ width: `${COL_W.semana}px` }}
                              >
                                {c?.exec ? (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.bloq ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700') : (isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700')}`} title={`${c.exec} executada(s)${c.bloq ? ` · ${c.bloq} bloqueio(s)` : ''}`}>
                                    ✓{c.exec}
                                  </span>
                                ) : null}
                                {c?.prog ? (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`} title={`${c.prog} programada(s)`}>
                                    {c.prog}
                                  </span>
                                ) : null}
                                {!c && !passada && <Plus size={10} className={`opacity-0 hover:opacity-100 ${txtMuted}`} />}
                              </button>
                            )
                          })}
                        </div>

                        {/* TSTs da obra: barra de alocação (Obras) + tipos marcados */}
                        {!omin && ob.tsts.map(t => {
                          const start = new Date(t.data_inicio)
                          const end = new Date(t.data_fim || addDays(start, 60).toISOString())
                          const nomeT = t.nome
                          const tps = tiposPorTst.get(`${t.colaborador_id}|${t.obra_id}`) ?? []
                          return (
                            <div key={t.id} className={`flex items-stretch border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`} style={{ minWidth: `${totalW}px` }}>
                              <div
                                onClick={podeRealocar ? () => setModalProg({ aloc: t }) : undefined}
                                className={`shrink-0 py-1.5 border-r ${borderG} flex flex-col justify-center gap-0.5 ${podeRealocar ? 'cursor-pointer' : ''}`}
                                style={{ width: `${COL_W.esq}px`, paddingLeft: 40, paddingRight: 8 }}
                                title={podeRealocar ? 'Clique para alterar a alocação e os tipos de inspeção' : nomeT}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span className={`flex-1 min-w-0 text-[11px] font-semibold truncate ${txtMain} ${podeRealocar ? 'hover:underline' : ''}`} title={nomeT}>{nomeT}</span>
                                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>TST</span>
                                </div>
                                {tps.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pl-3">
                                    {tps.slice(0, 4).map((tp, k) => (
                                      <span key={k} className={`text-[8px] font-bold px-1 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`} title={tp.nome}>{tp.codigo ?? tp.nome.slice(0, 8)}</span>
                                    ))}
                                    {tps.length > 4 && <span className={`text-[8px] ${txtMuted}`}>+{tps.length - 4}</span>}
                                  </div>
                                )}
                              </div>
                              {weeks.map((w, i) => {
                                const ativo = start <= addDays(w.sat, 1) && end >= w.mon
                                return (
                                  <div key={i} className={`shrink-0 border-r ${borderG} flex items-center justify-center py-1.5`} style={{ width: `${COL_W.semana}px` }}>
                                    {ativo && <div className="h-3.5 w-full mx-1 rounded bg-amber-500 shadow-sm" title={`${nomeT} — Sem. ${w.label}`} />}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* TSTs do RH sem alocação em Obras — visíveis p/ não sumir ninguém */}
            {tstsSemAlocacao.length > 0 && (
              <div>
                <button onClick={() => toggleMin('__sem_aloc__')} className={`flex items-center w-full text-left border-b transition-colors ${isDark ? 'border-white/[0.04] bg-white/[0.06] hover:bg-white/[0.08]' : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60'}`} style={{ minWidth: `${totalW}px` }}>
                  <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ width: `${COL_W.esq}px` }}>
                    {minimizados.has('__sem_aloc__') ? <ChevronDown size={14} className={txtMuted} /> : <ChevronUp size={14} className={txtMuted} />}
                    <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${txtMuted}`}>Sem alocação</span>
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>{tstsSemAlocacao.length}</span>
                  </div>
                </button>
                {!minimizados.has('__sem_aloc__') && tstsSemAlocacao.map(c => (
                  <div key={c.id} className={`flex items-stretch border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`} style={{ minWidth: `${totalW}px` }}>
                    <div className={`shrink-0 py-1.5 border-r ${borderG} flex items-center gap-1.5`} style={{ width: `${COL_W.esq}px`, paddingLeft: 24, paddingRight: 8 }}>
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isDark ? 'bg-slate-500' : 'bg-slate-300'}`} />
                      <span className={`flex-1 min-w-0 text-[11px] font-semibold truncate ${txtMain}`} title={`${c.nome}${c.cargo ? ` · ${c.cargo}` : ''}`}>{c.nome}</span>
                      {c.base_nome && (
                        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`} title="Base de lotação (RH)">{c.base_nome}</span>
                      )}
                      {podeRealocar && (
                        <button
                          onClick={() => setModalProg({ tstId: c.id })}
                          className={`shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${isDark ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                          title="Alocar este TST no QSMA"
                        >
                          <Plus size={9} /> Alocar
                        </button>
                      )}
                    </div>
                    <div className={`flex-1 flex items-center px-3 py-1.5 text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`} style={{ minWidth: `${weeks.length * COL_W.semana}px` }}>
                      ainda sem alocação no QSMA
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div className={`flex flex-wrap gap-3 text-[10px] ${txtMuted}`}>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-500" /> TST alocado</span>
            <span className="inline-flex items-center gap-1"><span className={`px-1 rounded-full font-bold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>n</span> inspeções programadas</span>
            <span className="inline-flex items-center gap-1"><span className={`px-1 rounded-full font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>✓n</span> executadas</span>
            <span className="inline-flex items-center gap-1"><span className={`w-3 h-2 rounded ${isDark ? 'bg-red-500/30' : 'bg-red-100'}`} /> Semana atual</span>
          </div>

          {programadas.length === 0 ? (
            <p className={`text-[11px] italic text-center py-2 ${txtMuted}`}>Nenhuma inspeção programada — clique numa célula do quadro acima</p>
          ) : (
            <div className="space-y-2">
              {programadas.map(i => (
                <div key={i.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${txtMain}`}>
                      <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{i.codigo}</span>
                      {i.modelo?.nome ?? 'Checklist'}
                    </p>
                    <p className={`text-[11px] ${txtMuted}`}>{obraNome(i.obra_id)}{i.frente ? ` · ${i.frente}` : ''} · prevista {fmtData(i.data_prevista)}</p>
                  </div>
                  <button
                    onClick={() => setExecutar(i)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Play size={11} /> Executar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Execuções ── */}
      {aba === 'execucoes' && (
        <div className="space-y-2">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${executadas.length} executada${executadas.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar código, modelo, executor…"
          >
            <MultiCheck isDark={isDark} label="Obras" options={obrasComRegistro} excluded={exObras} setExcluded={setExObras} />
            <ToolbarPills
              isDark={isDark} value={veredF} onChange={setVeredF}
              options={[{ value: 'todos', label: 'Todas' }, { value: 'liberado', label: 'Liberadas' }, { value: 'bloqueado', label: 'Bloqueadas' }]}
            />
          </QsmaToolbar>
          {executadas.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhuma inspeção executada ainda" />
          ) : executadas.map(i => {
            const nc = i.respostas.filter(r => r.resposta === 'nc').length
            return (
              <div key={i.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${txtMain}`}>
                    <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{i.codigo}</span>
                    {i.modelo?.nome ?? 'Checklist'}
                  </p>
                  <p className={`text-[11px] ${txtMuted}`}>
                    {obraNome(i.obra_id)} · {fmtData(i.data_execucao)} · {i.executor_nome ?? '—'}
                    {nc > 0 && <span className="text-red-500 font-semibold"> · {nc} NC</span>}
                  </p>
                </div>
                {i.veredito && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    i.veredito === 'liberado'
                      ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      : isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'
                  }`}>
                    {i.veredito === 'liberado' ? <ShieldCheck size={11} /> : <Ban size={11} />}
                    {i.veredito === 'liberado' ? 'LIBERADO' : 'BLOQUEADO'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modais ── */}
      {modalModelo && (
        <ModeloChecklistModal
          isDark={isDark}
          modelo={modalModelo === 'novo' ? null : modalModelo}
          grupos={grupos}
          onClose={() => setModalModelo(null)}
        />
      )}
      {modalProg && (
        <ProgramarInspecaoModal
          isDark={isDark}
          modelos={modelos.filter(m => m.ativo)}
          tstsRh={colabsAtivos.filter(c => /seguran|tst|sesmt/i.test(c.cargo ?? ''))}
          inspecoesExistentes={inspecoes}
          aloc={modalProg.aloc ?? null}
          defaultObraId={modalProg.obraId}
          defaultData={modalProg.data}
          defaultTstId={modalProg.tstId}
          onClose={() => setModalProg(null)}
        />
      )}
      {pickerExec && (
        <ExecutarPickerModal
          isDark={isDark}
          programadas={programadas}
          obraNome={obraNome}
          onPick={(i) => { setPickerExec(false); setExecutar(i) }}
          onClose={() => setPickerExec(false)}
        />
      )}
      {executar && (
        <ExecutarInspecaoModal isDark={isDark} inspecao={executar} onClose={() => setExecutar(null)} />
      )}
    </ControladoriaFlow>
  )
}

// ── Modal: escolher qual inspeção programada executar ─────────────────────────
function ExecutarPickerModal({ isDark, programadas, obraNome, onPick, onClose }: {
  isDark: boolean
  programadas: QsmaInspecao[]
  obraNome: (id?: string) => string
  onPick: (i: QsmaInspecao) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtradas = programadas.filter(i => {
    const s = q.trim().toLowerCase()
    return !s || (i.codigo ?? '').toLowerCase().includes(s) || (i.modelo?.nome ?? '').toLowerCase().includes(s) || obraNome(i.obra_id).toLowerCase().includes(s)
  })
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <QsmaModal isDark={isDark} titulo="Executar inspeção" subtitulo="Escolha a inspeção programada para realizar em campo" onClose={onClose}>
      <input
        value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar código, checklist ou obra…"
        className={pickerInputCls(isDark)}
      />
      {filtradas.length === 0 ? (
        <p className={`text-[11px] italic text-center py-6 ${txtMuted}`}>
          {programadas.length === 0 ? 'Nenhuma inspeção programada — programe uma primeiro (clique numa célula do Gantt).' : 'Nada encontrado na busca.'}
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-2">
          {filtradas.map(i => (
            <button
              key={i.id}
              onClick={() => onPick(i)}
              className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${txtMain}`}>
                  <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{i.codigo}</span>
                  {i.modelo?.nome ?? 'Checklist'}
                </p>
                <p className={`text-[11px] truncate ${txtMuted}`}>{obraNome(i.obra_id)}{i.frente ? ` · ${i.frente}` : ''} · prevista {fmtData(i.data_prevista)}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white">
                <Play size={11} /> Executar
              </span>
            </button>
          ))}
        </div>
      )}
    </QsmaModal>
  )
}

function Vazio({ isDark, texto }: { isDark: boolean; texto: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
      <ClipboardList size={36} className="mb-2" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

// ── Modal: builder de modelo de checklist ────────────────────────────────────

function ModeloChecklistModal({ isDark, modelo, grupos, onClose }: { isDark: boolean; modelo: QsmaModeloChecklist | null; grupos: string[]; onClose: () => void }) {
  const salvar = useSalvarModelo()
  const { perfil } = useAuth()
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [grupo, setGrupo] = useState(modelo?.grupo ?? '')
  const [tipo, setTipo] = useState<TipoModelo>(modelo?.tipo ?? 'inspecao')
  const [escopo, setEscopo] = useState<EscopoModelo>(modelo?.escopo ?? 'equipe')
  const [exigeVeredito, setExigeVeredito] = useState(modelo?.exige_veredito ?? false)
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true)
  const [itens, setItens] = useState<ItemChecklist[]>(modelo?.itens ?? [])
  // classe sem w-full (o pickerInputCls tem w-full, que conflita com flex-1/w-28 na linha do item)
  const cellCls = `rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-red-500/25 ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 [&>option]:bg-slate-900' : 'bg-white border-slate-200 text-slate-800'}`

  const erros: string[] = []
  if (!nome.trim()) erros.push('informe o nome')
  if (itens.length === 0) erros.push('adicione ao menos 1 item')
  if (itens.some(i => !i.texto.trim())) erros.push('há item sem texto')

  function addItem() {
    setItens(prev => [...prev, { ordem: prev.length + 1, texto: '', tipo_resposta: 'cna' }])
  }
  function move(i: number, delta: number) {
    setItens(prev => {
      const arr = [...prev]
      const j = i + delta
      if (j < 0 || j >= arr.length) return prev
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr.map((x, k) => ({ ...x, ordem: k + 1 }))
    })
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={modelo ? `Editar modelo ${modelo.codigo ?? ''}` : 'Novo modelo de checklist'} subtitulo="Itens configuráveis — o executor responde item a item no campo" onClose={onClose}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Inspeção diária de equipe LV" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoModelo)} className={pickerInputCls(isDark)}>
            {(Object.keys(TIPO_MODELO_LABEL) as TipoModelo[]).map(t => <option key={t} value={t}>{TIPO_MODELO_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Escopo</label>
          <select value={escopo} onChange={e => setEscopo(e.target.value as EscopoModelo)} className={pickerInputCls(isDark)}>
            {(Object.keys(ESCOPO_MODELO_LABEL) as EscopoModelo[]).map(t => <option key={t} value={t}>{ESCOPO_MODELO_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={pickerLabelCls(isDark)}>Grupo (tipo de guia)</label>
          <input
            value={grupo} onChange={e => setGrupo(e.target.value)} list="qsma-grupos-guia"
            placeholder="Ex.: Inspeção Trabalho (Distribuição)" className={pickerInputCls(isDark)}
          />
          <datalist id="qsma-grupos-guia">
            {grupos.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={exigeVeredito} onChange={e => setExigeVeredito(e.target.checked)} className="accent-red-600" />
          Exige veredito Liberado/Bloqueado
        </label>
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="accent-red-600" />
          Ativo
        </label>
      </div>

      {/* Itens */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Itens do checklist ({itens.length})</span>
          <button onClick={addItem} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
            <Plus size={10} /> Item
          </button>
        </div>
        {itens.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono w-5 text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}.</span>
            <input
              value={item.texto}
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
              placeholder="O que verificar?"
              className={`${cellCls} flex-1 min-w-0`}
            />
            <select
              value={item.tipo_resposta}
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, tipo_resposta: e.target.value as TipoResposta } : x))}
              className={`${cellCls} w-28 shrink-0`}
            >
              <option value="cna">C / NC / NA</option>
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
            </select>
            <div className="flex flex-col shrink-0">
              <button onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-600 p-0.5"><ChevronUp size={11} /></button>
              <button onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-600 p-0.5"><ChevronDown size={11} /></button>
            </div>
            <button onClick={() => setItens(prev => prev.filter((_, j) => j !== i).map((x, k) => ({ ...x, ordem: k + 1 })))} className="text-slate-400 hover:text-red-500 p-1 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {itens.length === 0 && <p className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Sem itens — clique em "+ Item"</p>}
      </div>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        salvando={salvar.isPending}
        onCancel={onClose}
        onSave={() => salvar.mutate(
          { id: modelo?.id, nome: nome.trim(), grupo: grupo.trim() || undefined, tipo, escopo, exige_veredito: exigeVeredito, ativo, itens, criado_por_nome: perfil?.nome },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: programar inspeção ────────────────────────────────────────────────

function ProgramarInspecaoModal({ isDark, modelos, tstsRh, inspecoesExistentes, aloc, defaultObraId, defaultData, defaultTstId, onClose }: {
  isDark: boolean
  modelos: QsmaModeloChecklist[]
  tstsRh: { id: string; nome: string; cargo?: string; departamento?: string; base_id?: string; base_nome?: string }[]
  inspecoesExistentes: QsmaInspecao[]
  aloc: ObraPlanejamentoEquipe | null
  defaultObraId?: string
  defaultData?: string
  defaultTstId?: string
  onClose: () => void
}) {
  const salvarInsp = useSalvarInspecao()
  const criarAloc = useCriarPlanEquipe()
  const atualizarAloc = useAtualizarPlanEquipe()
  const excluirAloc = useExcluirPlanEquipe()
  const isEdit = !!aloc

  // tipos já marcados (edição) = modelos distintos das inspeções desse TST na obra
  const tiposIniciais = useMemo(() => {
    if (!aloc) return new Set<string>()
    return new Set(inspecoesExistentes
      .filter(i => i.equipe_lider_id === aloc.colaborador_id && i.obra_id === aloc.obra_id && i.modelo_id)
      .map(i => i.modelo_id!))
  }, [aloc, inspecoesExistentes])

  const [tipos, setTipos] = useState<Set<string>>(tiposIniciais)
  const [obraId, setObraId] = useState(aloc?.obra_id ?? defaultObraId ?? '')
  const [frente, setFrente] = useState(aloc?.funcao_equipe ?? '')
  const [tstId, setTstId] = useState(aloc?.colaborador_id ?? defaultTstId ?? '')
  const [dataPrevista, setDataPrevista] = useState((aloc?.data_inicio ?? '').slice(0, 10) || defaultData || new Date().toISOString().split('T')[0])
  const [recorrencia, setRecorrencia] = useState<'unica' | 'diaria' | 'semanal'>('unica')
  const [dataFim, setDataFim] = useState((aloc?.data_fim ?? '').slice(0, 10) || (() => { const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().split('T')[0] })())
  const [gerar, setGerar] = useState(!isEdit)
  const [gerando, setGerando] = useState(false)

  const datasSerie = useMemo(() => {
    if (!gerar) return []
    if (recorrencia === 'unica') return [dataPrevista].filter(Boolean)
    if (!dataPrevista || !dataFim || dataFim < dataPrevista) return []
    const out: string[] = []
    const d = new Date(dataPrevista + 'T12:00:00')
    const fim = new Date(dataFim + 'T12:00:00')
    while (d <= fim && out.length < 60) {
      const dow = d.getDay()
      if (recorrencia === 'semanal' || (dow >= 1 && dow <= 5)) out.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + (recorrencia === 'semanal' ? 7 : 1))
    }
    return out
  }, [gerar, recorrencia, dataPrevista, dataFim])

  const modelosPorGrupo = useMemo(() => {
    const m = new Map<string, QsmaModeloChecklist[]>()
    modelos.forEach(mod => { const g = mod.grupo || 'Outros'; m.set(g, [...(m.get(g) ?? []), mod]) })
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [modelos])
  const toggleTipo = (id: string) => setTipos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const tst = tstsRh.find(c => c.id === tstId)

  const erros: string[] = []
  if (tipos.size === 0) erros.push('marque ao menos 1 tipo de inspeção')
  if (!obraId) erros.push('escolha a obra')
  if (!dataPrevista) erros.push('informe a data')
  if (gerar && recorrencia !== 'unica' && datasSerie.length === 0) erros.push('período da série inválido')
  const nGera = tipos.size * datasSerie.length

  async function programar() {
    setGerando(true)
    try {
      let liderId = tstId
      if (tstId) {
        // INTEGRADO com Obras: grava em obr_planejamento_equipe (aloca aqui = aloca lá)
        if (aloc) {
          await atualizarAloc.mutateAsync({
            id: aloc.id, obra_id: obraId, data_inicio: dataPrevista,
            data_fim: recorrencia !== 'unica' ? dataFim : (dataFim || undefined),
            funcao_equipe: frente || undefined,
          })
        } else {
          const nova = await criarAloc.mutateAsync({
            colaborador_id: tstId, nome: tst?.nome ?? 'TST', funcao: tst?.cargo ?? 'Técnico de Segurança',
            papel: papelSugerido(tst?.cargo, tst?.departamento), categoria: 'moi',
            obra_id: obraId, data_inicio: dataPrevista,
            data_fim: recorrencia !== 'unica' ? dataFim : (dataFim || undefined),
            funcao_equipe: frente || undefined, status: 'planejado',
          })
          liderId = nova.colaborador_id ?? tstId
        }
      }
      // gera as inspeções marcadas (dedup vs já existentes p/ mesmo lider+obra+modelo+data)
      const existe = new Set(inspecoesExistentes
        .filter(i => i.status === 'programada')
        .map(i => `${i.equipe_lider_id ?? ''}|${i.obra_id ?? ''}|${i.modelo_id ?? ''}|${i.data_prevista ?? ''}`))
      for (const id of tipos) for (const dt of datasSerie) {
        const key = `${liderId}|${obraId}|${id}|${dt}`
        if (existe.has(key)) continue
        await salvarInsp.mutateAsync({
          modelo_id: id, obra_id: obraId, frente: frente || undefined,
          equipe_lider_id: liderId || undefined, data_prevista: dt, status: 'programada',
        })
      }
      onClose()
    } catch (e: any) {
      alert(`Erro: ${e?.message ?? 'desconhecido'}`)
    } finally {
      setGerando(false)
    }
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={isEdit ? `Alocação · ${aloc?.nome ?? ''}` : 'Programar inspeção'} subtitulo="Aloca o TST (integrado com Obras) e programa as inspeções que ele fará" onClose={onClose}>
      {/* Tipos de inspeção a serem feitos (marcar as guias) */}
      <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <label className={pickerLabelCls(isDark)}>Tipos de inspeção a serem feitos ({tipos.size}) *</label>
        <div className="max-h-48 overflow-y-auto space-y-2 mt-1">
          {modelosPorGrupo.map(([grupo, lista]) => (
            <div key={grupo}>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{grupo}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {lista.map(m => (
                  <label key={m.id} className={`flex items-center gap-1.5 text-[11px] cursor-pointer px-1.5 py-1 rounded-lg ${tipos.has(m.id) ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : ''} ${isDark ? 'text-slate-300 hover:bg-white/[0.03]' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={tipos.has(m.id)} onChange={() => toggleTipo(m.id)} className="accent-red-600 shrink-0" />
                    <span className="truncate">{m.codigo ? `${m.codigo} · ` : ''}{m.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} required />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Frente</label>
          <input value={frente} onChange={e => setFrente(e.target.value)} placeholder="Opcional" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>{recorrencia === 'unica' ? 'Data prevista *' : 'Início *'}</label>
          <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
      </div>

      {/* TST responsável — aloca em Obras (integrado nos dois sentidos) */}
      <div>
        <label className={pickerLabelCls(isDark)}>TST responsável {isEdit ? '' : '(aloca em Obras também)'}</label>
        <select value={tstId} onChange={e => setTstId(e.target.value)} disabled={isEdit} className={`${pickerInputCls(isDark)} ${isEdit ? 'opacity-70' : ''}`}>
          <option value="">— sem alocar (só programar) —</option>
          {tstsRh.map(c => <option key={c.id} value={c.id}>{c.nome}{c.base_nome ? ` · ${c.base_nome}` : ''}</option>)}
        </select>
      </div>

      {/* Frequência — gera a agenda de uma vez */}
      <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={gerar} onChange={e => setGerar(e.target.checked)} className="accent-red-600" />
          Gerar as inspeções programadas agora
        </label>
        {gerar && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
              {([['unica', 'Única'], ['diaria', 'Diária (dias úteis)'], ['semanal', 'Semanal']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setRecorrencia(v)}
                  className={`px-3 py-2 text-[11px] font-semibold transition-all ${recorrencia === v ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700') : (isDark ? 'bg-transparent text-slate-400 hover:bg-white/[0.05]' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
                  {l}
                </button>
              ))}
            </div>
            {recorrencia !== 'unica' && (
              <>
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>até</span>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={`${pickerInputCls(isDark)} w-36`} />
              </>
            )}
            {nGera > 0 && (
              <span className={`text-[10px] font-semibold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                gera {nGera} inspeção(ões) · {datasSerie.length} data(s) × {tipos.size} tipo(s)
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {isEdit ? (
          <button
            onClick={() => { if (confirm('Remover a alocação deste TST? Remove também da programação de Obras. As inspeções já geradas permanecem.')) excluirAloc.mutate(aloc!.id, { onSuccess: onClose }) }}
            className={`text-[11px] font-semibold px-3 py-2 rounded-xl border transition-colors ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
          >
            Remover alocação
          </button>
        ) : <span />}
        <div className="flex-1">
          <ModalFooter
            isDark={isDark} erros={erros} salvando={gerando} onCancel={onClose}
            saveLabel={nGera > 1 ? `${tstId ? 'Alocar + ' : ''}${nGera} inspeções` : (tstId ? (isEdit ? 'Salvar' : 'Alocar') : 'Programar')}
            onSave={programar}
          />
        </div>
      </div>
    </QsmaModal>
  )
}

// ── Modal: executar inspeção (wizard item a item) ────────────────────────────

function ExecutarInspecaoModal({ isDark, inspecao, onClose }: { isDark: boolean; inspecao: QsmaInspecao; onClose: () => void }) {
  const salvar = useSalvarInspecao()
  const { perfil } = useAuth()
  const itens = inspecao.modelo?.itens ?? []
  const [respostas, setRespostas] = useState<RespostaItem[]>(
    itens.map(it => ({ ordem: it.ordem, resposta: undefined, obs: '', foto_paths: [] })),
  )
  const [obs, setObs] = useState('')
  const [veredito, setVeredito] = useState<'liberado' | 'bloqueado' | ''>('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [pedindoGps, setPedindoGps] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
    setPedindoGps(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPedindoGps(false) },
      () => setPedindoGps(false),
      { timeout: 8000 },
    )
  }, [])

  const respondidos = respostas.filter(r => r.resposta != null && r.resposta !== '').length
  const ncs = respostas.filter(r => r.resposta === 'nc').length
  const erros: string[] = []
  if (respondidos < itens.length) erros.push(`responda todos os itens (${respondidos}/${itens.length})`)
  if (inspecao.modelo?.exige_veredito && !veredito) erros.push('defina o veredito')
  const avisos: string[] = []
  if (ncs > 0) avisos.push(`${ncs} não conformidade(s) — considere registrar ocorrência/ação`)

  function responder(i: number, patch: Partial<RespostaItem>) {
    setRespostas(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={`Executar ${inspecao.codigo ?? 'inspeção'}`} subtitulo={inspecao.modelo?.nome} onClose={onClose}>
      {/* progresso */}
      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(respondidos / Math.max(1, itens.length)) * 100}%` }} />
      </div>

      <div className="space-y-3">
        {itens.map((item, i) => {
          const r = respostas[i]
          const tipoItem = item.tipo_resposta ?? 'cna'
          return (
            <div key={i} className={`rounded-xl border p-3 ${
              r?.resposta === 'nc'
                ? isDark ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-red-200 bg-red-50/40'
                : isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'
            }`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className={`font-mono mr-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}.</span>
                {item.texto}
              </p>
              {tipoItem === 'cna' ? (
                <div className="flex gap-1.5">
                  {([['c', 'Conforme', 'emerald'], ['nc', 'Não conforme', 'red'], ['na', 'N/A', 'slate']] as const).map(([v, l, tone]) => (
                    <button
                      key={v}
                      onClick={() => responder(i, { resposta: v })}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        r?.resposta === v
                          ? tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : tone === 'red' ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-slate-500 border-slate-500 text-white'
                          : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={tipoItem === 'numero' ? 'number' : 'text'}
                  value={r?.resposta ?? ''}
                  onChange={e => responder(i, { resposta: e.target.value })}
                  placeholder={tipoItem === 'numero' ? '0' : 'Resposta…'}
                  className={pickerInputCls(isDark)}
                />
              )}
              {(r?.resposta === 'nc' || item.foto_obrigatoria) && (
                <div className="mt-2 space-y-2">
                  <input
                    value={r?.obs ?? ''}
                    onChange={e => responder(i, { obs: e.target.value })}
                    placeholder="Descreva a não conformidade…"
                    className={pickerInputCls(isDark)}
                  />
                  <FotosUpload
                    isDark={isDark}
                    pasta={`inspecoes/${inspecao.id}/item-${i + 1}`}
                    paths={r?.foto_paths ?? []}
                    onChange={p => responder(i, { foto_paths: p })}
                    label="Foto da NC"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label className={pickerLabelCls(isDark)}>Observações gerais</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
      </div>

      {inspecao.modelo?.exige_veredito && (
        <div className="flex gap-2">
          <button
            onClick={() => setVeredito('liberado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'liberado' ? 'bg-emerald-600 border-emerald-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-emerald-500/10' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'
            }`}
          >
            <ShieldCheck size={14} /> LIBERADO
          </button>
          <button
            onClick={() => setVeredito('bloqueado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'bloqueado' ? 'bg-red-600 border-red-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-red-500/10' : 'border-slate-200 text-slate-600 hover:bg-red-50'
            }`}
          >
            <Ban size={14} /> BLOQUEADO
          </button>
        </div>
      )}

      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {pedindoGps ? <span className="inline-flex items-center gap-1"><Loader2 size={9} className="animate-spin" /> obtendo GPS…</span>
          : gps ? `📍 ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : '📍 GPS indisponível'}
      </p>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        avisos={avisos}
        salvando={salvar.isPending}
        onCancel={onClose}
        saveLabel="Concluir inspeção"
        onSave={() => salvar.mutate(
          {
            id: inspecao.id,
            respostas,
            observacoes: obs || undefined,
            veredito: (veredito || null) as never,
            latitude: gps?.lat, longitude: gps?.lng,
            data_execucao: new Date().toISOString(),
            executor_id: perfil?.id, executor_nome: perfil?.nome,
            status: 'executada',
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

export { STATUS_INSPECAO_LABEL }
