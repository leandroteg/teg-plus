import { useMemo, useState, useCallback } from 'react'
import {
  Users2, Search, Plus, X, List, CalendarRange, LayoutGrid,
  HardHat, UserCog, ShieldCheck, ChevronDown, ChevronUp, Building2,
  Filter, Loader2, Trash2, ArrowRight, Calendar, Briefcase, UserPlus,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import {
  usePlanejamentoEquipe, useColaboradoresAtivos, useObrasComProjeto,
  useCriarPlanEquipe, useExcluirPlanEquipe, useMoverLiderTime,
  papelSugerido, type ObraComProjeto,
} from '../../hooks/useObras'
import type {
  ObraPlanejamentoEquipe, ColaboradorAtivo, PapelEquipe,
  CategoriaEquipePlan, StatusEquipePlan,
} from '../../types/obras'

// ── Constants ───────────────────────────────────────────────────────────────────

const PAPEL_CONFIG: Record<PapelEquipe, {
  label: string; icon: typeof Users2
  text: string; bg: string; textDark: string; bgDark: string
  lidera: boolean
}> = {
  engenheiro:  { label: 'Engenheiro',  icon: UserCog,     text: 'text-indigo-600',  bg: 'bg-indigo-50',  textDark: 'text-indigo-300',  bgDark: 'bg-indigo-500/10',  lidera: true  },
  supervisor:  { label: 'Supervisor',  icon: UserCog,     text: 'text-violet-600',  bg: 'bg-violet-50',  textDark: 'text-violet-300',  bgDark: 'bg-violet-500/10',  lidera: true  },
  encarregado: { label: 'Encarregado', icon: HardHat,     text: 'text-orange-600',  bg: 'bg-orange-50',  textDark: 'text-orange-300',  bgDark: 'bg-orange-500/10',  lidera: true  },
  apoio:       { label: 'Apoio',       icon: ShieldCheck, text: 'text-cyan-600',    bg: 'bg-cyan-50',    textDark: 'text-cyan-300',    bgDark: 'bg-cyan-500/10',    lidera: false },
  time:        { label: 'Time',        icon: Users2,      text: 'text-slate-600',   bg: 'bg-slate-100',  textDark: 'text-slate-300',   bgDark: 'bg-slate-500/10',   lidera: false },
}

const PAPEL_ORDER: PapelEquipe[] = ['engenheiro', 'supervisor', 'encarregado', 'apoio', 'time']

const STATUS_CONFIG: Record<StatusEquipePlan, { label: string; light: string; dark: string }> = {
  planejado:     { label: 'Planejado',     light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
  mobilizado:    { label: 'Mobilizado',    light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-400' },
  ativo:         { label: 'Ativo',         light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-400' },
  desmobilizado: { label: 'Desmobilizado', light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-400' },
  cancelado:     { label: 'Cancelado',     light: 'bg-red-100 text-red-600',         dark: 'bg-red-500/15 text-red-400' },
}

const STATUS_ATIVO: StatusEquipePlan[] = ['planejado', 'mobilizado', 'ativo']

type TabKey = 'lista' | 'programacao' | 'kanban'

const STEPS: FlowStep[] = [
  {
    key: 'lista', label: 'Lista',
    description: 'Monte os times: lideranças por obra, cada encarregado com sua tropa, e o apoio.',
    icon: List,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
  {
    key: 'programacao', label: 'Programação',
    description: 'Linha do tempo das alocações agrupada por Projeto › Obra.',
    icon: CalendarRange,
    accent: { bg: 'hover:bg-blue-50', bgActive: 'bg-blue-50', text: 'text-blue-600', textActive: 'text-blue-800', border: 'border-blue-500', badge: 'bg-blue-100 text-blue-700' },
  },
  {
    key: 'kanban', label: 'Kanban',
    description: 'Arraste pessoas entre obras — encarregado leva o time junto.',
    icon: LayoutGrid,
    accent: { bg: 'hover:bg-orange-50', bgActive: 'bg-orange-50', text: 'text-orange-600', textActive: 'text-orange-800', border: 'border-orange-500', badge: 'bg-orange-100 text-orange-700' },
  },
]

// ── Helpers ─────────────────────────────────────────────────────────────────────

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
const primeiroNome = (nome?: string) => (nome ?? '').split(' ').slice(0, 2).join(' ')
const categoriaFromPapel = (p: PapelEquipe): CategoriaEquipePlan => (p === 'time' ? 'mod' : 'moi')

function Avatar({ nome, fotoUrl, isDark, size = 28 }: { nome: string; fotoUrl?: string; isDark: boolean; size?: number }) {
  const iniciais = nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  if (fotoUrl) {
    return <img src={fotoUrl} alt={nome} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-bold ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-slate-200 text-slate-600'}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {iniciais}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export default function EquipeObras() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [tab, setTab] = useState<TabKey>('lista')
  const [alocarOpen, setAlocarOpen] = useState(false)
  const [alocarPreset, setAlocarPreset] = useState<{ obraId?: string; colaboradorId?: string; papel?: PapelEquipe; liderId?: string } | null>(null)

  const { data: equipe = [], isLoading: loadingEq } = usePlanejamentoEquipe()
  const { data: colaboradores = [], isLoading: loadingCol } = useColaboradoresAtivos()
  const { data: obras = [], isLoading: loadingOb } = useObrasComProjeto()

  const moverLider = useMoverLiderTime()

  // Colaboradores ja alocados (alocacao nao encerrada)
  const alocadosIds = useMemo(() => {
    const s = new Set<string>()
    equipe.filter(e => STATUS_ATIVO.includes(e.status)).forEach(e => { if (e.colaborador_id) s.add(e.colaborador_id) })
    return s
  }, [equipe])

  const disponiveis = useMemo(
    () => colaboradores.filter(c => !alocadosIds.has(c.id)),
    [colaboradores, alocadosIds],
  )

  // alocacao ativa por colaborador (p/ kanban mover)
  const alocAtivaByColab = useMemo(() => {
    const m = new Map<string, ObraPlanejamentoEquipe>()
    equipe.filter(e => STATUS_ATIVO.includes(e.status)).forEach(e => { if (e.colaborador_id) m.set(e.colaborador_id, e) })
    return m
  }, [equipe])

  const handleOpenAlocar = (preset: typeof alocarPreset = null) => {
    setAlocarPreset(preset)
    setAlocarOpen(true)
  }

  // Mover pessoa (kanban): com alocacao -> move (lider leva o time); sem -> abre modal
  const handleMoveToObra = useCallback(async (colaboradorId: string, obraId: string) => {
    const aloc = alocAtivaByColab.get(colaboradorId)
    if (!aloc) {
      const col = colaboradores.find(c => c.id === colaboradorId)
      handleOpenAlocar({ colaboradorId, obraId, papel: col?.papel_sugerido })
      return
    }
    if (aloc.obra_id === obraId) return
    try {
      await moverLider.mutateAsync({ alocacaoId: aloc.id, obraId })
    } catch (err) {
      alert('Erro ao mover: ' + (err instanceof Error ? err.message : String(err)))
    }
  }, [alocAtivaByColab, colaboradores, moverLider])

  const headerBtns = (
    <button
      onClick={() => handleOpenAlocar()}
      className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 text-white px-3 py-2 text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm"
    >
      <UserPlus size={14} /> Alocar pessoa
    </button>
  )

  const loading = loadingEq || loadingCol || loadingOb

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 z-10">{headerBtns}</div>

      <ControladoriaFlow
        title="Equipe"
        subtitle="Pessoas por Projeto › Obra — alocação integrada ao headcount do RH"
        steps={STEPS}
        activeStep={tab}
        onStepChange={(s) => setTab(s as TabKey)}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'lista' && (
              <ListaView
                equipe={equipe} obras={obras} disponiveis={disponiveis}
                isDark={isDark}
                onAlocar={(preset) => handleOpenAlocar(preset)}
              />
            )}
            {tab === 'programacao' && (
              <ProgramacaoView equipe={equipe} obras={obras} isDark={isDark} />
            )}
            {tab === 'kanban' && (
              <KanbanView
                equipe={equipe} obras={obras} disponiveis={disponiveis}
                isDark={isDark}
                onMoveToObra={handleMoveToObra}
                onAlocar={(preset) => handleOpenAlocar(preset)}
              />
            )}
          </>
        )}
      </ControladoriaFlow>

      {alocarOpen && (
        <AlocarPessoaModal
          isDark={isDark}
          obras={obras}
          colaboradores={colaboradores}
          alocadosIds={alocadosIds}
          encarregados={equipe.filter(e => e.papel === 'encarregado' && STATUS_ATIVO.includes(e.status))}
          preset={alocarPreset}
          onClose={() => { setAlocarOpen(false); setAlocarPreset(null) }}
        />
      )}
    </div>
  )
}

// ── KpiCard (reaproveita o padrao do Alocacao de Recursos) ──────────────────────

function KpiCard({ isDark, icon: Icon, label, value, color, onClick, active }: {
  isDark: boolean; icon: typeof Users2; label: string; value: number
  color: 'slate' | 'indigo' | 'orange' | 'cyan' | 'emerald'
  onClick?: () => void; active?: boolean
}) {
  const colorMap = {
    slate:   { text: 'text-slate-600',   textDark: 'text-slate-400',   bg: 'bg-slate-50',   bgDark: 'bg-slate-500/10' },
    indigo:  { text: 'text-indigo-600',  textDark: 'text-indigo-300',  bg: 'bg-indigo-50',  bgDark: 'bg-indigo-500/10' },
    orange:  { text: 'text-orange-600',  textDark: 'text-orange-300',  bg: 'bg-orange-50',  bgDark: 'bg-orange-500/10' },
    cyan:    { text: 'text-cyan-600',    textDark: 'text-cyan-300',    bg: 'bg-cyan-50',    bgDark: 'bg-cyan-500/10' },
    emerald: { text: 'text-emerald-600', textDark: 'text-emerald-300', bg: 'bg-emerald-50', bgDark: 'bg-emerald-500/10' },
  }
  const clr = colorMap[color]
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${
        active
          ? isDark ? `${clr.bgDark} border-white/[0.12]` : `${clr.bg} border-slate-300 shadow-sm`
          : isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <Icon size={14} className={isDark ? clr.textDark : clr.text} strokeWidth={2.2} />
        <span className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</span>
      </div>
      <p className={`text-[10px] font-semibold ${isDark ? clr.textDark : clr.text}`}>{label}</p>
    </button>
  )
}

function PapelBadge({ papel, isDark }: { papel: PapelEquipe; isDark: boolean }) {
  const cfg = PAPEL_CONFIG[papel]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isDark ? `${cfg.bgDark} ${cfg.textDark}` : `${cfg.bg} ${cfg.text}`}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTA VIEW — montador de times
// ══════════════════════════════════════════════════════════════════════════════

function ListaView({
  equipe, obras, disponiveis, isDark, onAlocar,
}: {
  equipe: ObraPlanejamentoEquipe[]
  obras: ObraComProjeto[]
  disponiveis: ColaboradorAtivo[]
  isDark: boolean
  onAlocar: (preset: { obraId?: string; papel?: PapelEquipe; liderId?: string } | null) => void
}) {
  const [projetoFiltro, setProjetoFiltro] = useState('todos')
  const [obraFiltro, setObraFiltro] = useState('todas')
  const [busca, setBusca] = useState('')
  const [timesAbertos, setTimesAbertos] = useState<Set<string>>(new Set())

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls  = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'}`

  const ativos = useMemo(() => equipe.filter(e => STATUS_ATIVO.includes(e.status)), [equipe])

  const kpis = useMemo(() => ({
    alocados:   ativos.length,
    liderancas: ativos.filter(e => PAPEL_CONFIG[e.papel].lidera).length,
    apoio:      ativos.filter(e => e.papel === 'apoio').length,
    disponiveis: disponiveis.length,
  }), [ativos, disponiveis])

  const projetos = useMemo(() => {
    const m = new Map<string, string>()
    obras.forEach(o => { if (o.projeto_id) m.set(o.projeto_id, o.projeto_nome ?? o.projeto_id) })
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [obras])

  const obrasFiltradas = useMemo(
    () => projetoFiltro === 'todos' ? obras : obras.filter(o => o.projeto_id === projetoFiltro),
    [obras, projetoFiltro],
  )

  // Agrupa alocacoes ativas por obra
  const porObra = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const obraOk = (id: string) =>
      (obraFiltro === 'todas' || id === obraFiltro) &&
      obrasFiltradas.some(o => o.id === id)
    const map = new Map<string, ObraPlanejamentoEquipe[]>()
    ativos.forEach(e => {
      if (!obraOk(e.obra_id)) return
      if (q && !(e.nome?.toLowerCase().includes(q) || e.funcao?.toLowerCase().includes(q))) return
      const arr = map.get(e.obra_id) ?? []
      arr.push(e)
      map.set(e.obra_id, arr)
    })
    return Array.from(map.entries())
      .map(([obraId, rows]) => ({
        obraId,
        obra: obras.find(o => o.id === obraId),
        rows,
      }))
      .sort((a, b) => (a.obra?.nome ?? '').localeCompare(b.obra?.nome ?? ''))
  }, [ativos, busca, obraFiltro, obrasFiltradas, obras])

  const toggleTime = (id: string) => setTimesAbertos(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard isDark={isDark} icon={Users2}      label="Alocados"    value={kpis.alocados}    color="orange" />
        <KpiCard isDark={isDark} icon={UserCog}      label="Lideranças"  value={kpis.liderancas}  color="indigo" />
        <KpiCard isDark={isDark} icon={ShieldCheck}  label="Apoio"       value={kpis.apoio}       color="cyan" />
        <KpiCard isDark={isDark} icon={Briefcase}    label="Disponíveis" value={kpis.disponiveis} color="emerald" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou função..." className={`${inputCls} pl-8 pr-7`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <select value={projetoFiltro} onChange={e => { setProjetoFiltro(e.target.value); setObraFiltro('todas') }} className={`${inputCls} max-w-[200px]`}>
          <option value="todos">Todos os projetos</option>
          {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={obraFiltro} onChange={e => setObraFiltro(e.target.value)} className={`${inputCls} max-w-[180px]`}>
          <option value="todas">Todas as obras</option>
          {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <span className={`ml-auto text-[11px] ${txtMuted}`}>{porObra.length} obra(s) com equipe</span>
      </div>

      {/* Lista por obra */}
      {porObra.length === 0 ? (
        <div className={`text-center py-14 rounded-xl border border-dashed ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
          <Users2 size={34} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold">Nenhuma pessoa alocada ainda</p>
          <p className="text-xs mt-1">Clique em "Alocar pessoa" para montar os times.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {porObra.map(grp => {
            const lideres = grp.rows.filter(r => PAPEL_CONFIG[r.papel].lidera)
            const apoio   = grp.rows.filter(r => r.papel === 'apoio')
            const timeByLider = new Map<string, ObraPlanejamentoEquipe[]>()
            grp.rows.filter(r => r.papel === 'time').forEach(r => {
              const k = r.lider_id ?? '__sem__'
              const arr = timeByLider.get(k) ?? []; arr.push(r); timeByLider.set(k, arr)
            })
            return (
              <div key={grp.obraId} className={`rounded-2xl border ${cardCls}`}>
                {/* Header obra */}
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  <Building2 size={14} className="text-orange-500" />
                  <span className={`text-sm font-extrabold ${txtMain}`}>{grp.obra?.nome ?? '—'}</span>
                  {grp.obra?.projeto_nome && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{grp.obra.projeto_nome}</span>}
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-600'}`}>{grp.rows.length} pessoas</span>
                  <button
                    onClick={() => onAlocar({ obraId: grp.obraId })}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <Plus size={11} /> Pessoa
                  </button>
                </div>

                <div className="p-3 space-y-2">
                  {/* Lideres */}
                  {lideres.map(l => {
                    const time = timeByLider.get(l.id) ?? []
                    const aberto = timesAbertos.has(l.id)
                    const podeTime = l.papel === 'encarregado'
                    return (
                      <div key={l.id} className={`rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <Avatar nome={l.nome} fotoUrl={l.colaborador?.foto_url} isDark={isDark} />
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${txtMain}`}>{l.nome}</p>
                            <p className={`text-[10px] truncate ${txtMuted}`}>{l.funcao}</p>
                          </div>
                          <PapelBadge papel={l.papel} isDark={isDark} />
                          {podeTime && (
                            <button
                              onClick={() => toggleTime(l.id)}
                              className={`ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                            >
                              {aberto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              Time {time.length > 0 && `(${time.length})`}
                            </button>
                          )}
                        </div>
                        {podeTime && aberto && (
                          <div className={`px-3 pb-2.5 pt-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                            {time.length === 0 ? (
                              <p className={`text-[11px] italic ${txtMuted} mb-2`}>Sem membros no time ainda.</p>
                            ) : (
                              <div className="space-y-1 mb-2">
                                {time.map(m => (
                                  <div key={m.id} className="flex items-center gap-2">
                                    <Avatar nome={m.nome} fotoUrl={m.colaborador?.foto_url} isDark={isDark} size={22} />
                                    <span className={`text-[11px] font-medium truncate ${txtMain}`}>{primeiroNome(m.nome)}</span>
                                    <span className={`text-[10px] truncate ${txtMuted}`}>· {m.funcao}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => onAlocar({ obraId: grp.obraId, papel: 'time', liderId: l.id })}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                            >
                              <Plus size={10} /> Adicionar ao time
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Apoio */}
                  {apoio.length > 0 && (
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mt-2 mb-1 ${txtMuted}`}>Apoio (Obras / SSMA)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {apoio.map(a => (
                          <div key={a.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                            <Avatar nome={a.nome} fotoUrl={a.colaborador?.foto_url} isDark={isDark} size={22} />
                            <span className={`text-[11px] font-medium truncate ${txtMain}`}>{primeiroNome(a.nome)}</span>
                            <span className={`ml-auto text-[10px] truncate ${txtMuted}`}>{a.funcao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time orfao (sem lider) */}
                  {(timeByLider.get('__sem__')?.length ?? 0) > 0 && (
                    <div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mt-2 mb-1 ${txtMuted}`}>Time sem encarregado</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {timeByLider.get('__sem__')!.map(m => (
                          <div key={m.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                            <Avatar nome={m.nome} fotoUrl={m.colaborador?.foto_url} isDark={isDark} size={22} />
                            <span className={`text-[11px] font-medium truncate ${txtMain}`}>{primeiroNome(m.nome)}</span>
                            <span className={`ml-auto text-[10px] truncate ${txtMuted}`}>{m.funcao}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PROGRAMACAO VIEW — gantt agrupado por Projeto > Obra
// ══════════════════════════════════════════════════════════════════════════════

function ProgramacaoView({
  equipe, obras, isDark,
}: {
  equipe: ObraPlanejamentoEquipe[]
  obras: ObraComProjeto[]
  isDark: boolean
}) {
  const [minimizados, setMinimizados] = useState<Set<string>>(new Set())

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const border   = isDark ? 'border-white/[0.06]' : 'border-slate-200'

  const obraById = useMemo(() => {
    const m = new Map<string, ObraComProjeto>(); obras.forEach(o => m.set(o.id, o)); return m
  }, [obras])

  const rows = useMemo(() => equipe.filter(e => STATUS_ATIVO.includes(e.status)), [equipe])

  // Agrupa por projeto
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; rows: ObraPlanejamentoEquipe[] }>()
    rows.forEach(r => {
      const o = obraById.get(r.obra_id)
      const id = o?.projeto_id ?? '__sem__'
      const nome = o?.projeto_nome ?? 'Sem projeto'
      if (!map.has(id)) map.set(id, { id, nome, rows: [] })
      map.get(id)!.rows.push(r)
    })
    // ordena rows internas por obra+nome
    map.forEach(g => g.rows.sort((a, b) => {
      const oa = obraById.get(a.obra_id)?.nome ?? '', ob = obraById.get(b.obra_id)?.nome ?? ''
      return oa.localeCompare(ob) || a.nome.localeCompare(b.nome)
    }))
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows, obraById])

  // Janela temporal
  const win = useMemo(() => {
    if (rows.length === 0) { const n = new Date(); return { start: addDays(n, -7), end: addDays(n, 60) } }
    const starts = rows.map(r => new Date(r.data_inicio))
    const ends = rows.map(r => new Date(r.data_fim || addDays(new Date(r.data_inicio), 30).toISOString()))
    const min = new Date(Math.min(...starts.map(d => d.getTime())))
    const max = new Date(Math.max(...ends.map(d => d.getTime())))
    return { start: addDays(min, -2), end: addDays(max, 2) }
  }, [rows])

  const totalDays = daysBetween(win.start, win.end) || 1
  const today = new Date()
  const todayPct = Math.max(0, Math.min(100, (daysBetween(win.start, today) / totalDays) * 100))

  const monthLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = []
    const cursor = new Date(win.start.getFullYear(), win.start.getMonth(), 1)
    while (cursor <= win.end) {
      labels.push({ label: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), pct: (daysBetween(win.start, cursor) / totalDays) * 100 })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return labels
  }, [win, totalDays])

  const COL_W = { pessoa: 200, obra: 150, periodo: 110 }
  const tableW = COL_W.pessoa + COL_W.obra + COL_W.periodo

  const toggle = (id: string) => setMinimizados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-[11px] ${txtMuted}`}>
        <CalendarRange size={12} /> {rows.length} alocação(ões) ativas · agrupadas por projeto
      </div>

      <div className={`rounded-xl border overflow-x-auto ${border}`}>
        {/* Header */}
        <div className={`flex items-center border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex shrink-0 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`} style={{ width: `${tableW}px` }}>
            <div className={`px-3 py-2 border-r ${border}`} style={{ width: `${COL_W.pessoa}px` }}>Pessoa</div>
            <div className={`px-2 py-2 border-r ${border}`} style={{ width: `${COL_W.obra}px` }}>Obra</div>
            <div className={`px-2 py-2 border-r ${border}`} style={{ width: `${COL_W.periodo}px` }}>Período</div>
          </div>
          <div className="flex-1 relative h-8 min-w-[400px]">
            {monthLabels.map((m, i) => (
              <div key={i} className={`absolute top-0 bottom-0 flex items-center text-[10px] font-semibold ${txtMuted} border-l ${border}`} style={{ left: `${m.pct}%`, paddingLeft: '4px' }}>{m.label}</div>
            ))}
            <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10 pointer-events-none" style={{ left: `${todayPct}%` }}>
              <div className="absolute -top-0.5 -translate-x-1/2 text-[9px] font-bold text-red-500">hoje</div>
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className={`text-center py-12 ${txtMuted}`}>
            <CalendarRange size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma alocação cadastrada</p>
          </div>
        ) : groups.map(group => {
          const min = minimizados.has(group.id)
          return (
            <div key={group.id}>
              <button onClick={() => toggle(group.id)} className={`flex items-center w-full text-left border-b transition-colors ${isDark ? 'border-white/[0.04] bg-white/[0.04] hover:bg-white/[0.06]' : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60'}`} style={{ minWidth: `${tableW + 400}px` }}>
                <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ width: `${tableW}px` }}>
                  {min ? <ChevronDown size={13} className={txtMuted} /> : <ChevronUp size={13} className={txtMuted} />}
                  <Briefcase size={12} className={txtMuted} />
                  <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${txtMain}`}>{group.nome}</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>{group.rows.length}</span>
                </div>
                <div className="flex-1 h-7" />
              </button>

              {!min && group.rows.map(r => {
                const start = new Date(r.data_inicio)
                const end = new Date(r.data_fim || addDays(start, 30).toISOString())
                const leftPct = (daysBetween(win.start, start) / totalDays) * 100
                const widthPct = Math.max(1, (Math.max(1, daysBetween(start, end)) / totalDays) * 100)
                const cfg = PAPEL_CONFIG[r.papel]
                const obra = obraById.get(r.obra_id)
                const barColor = r.papel === 'time' ? 'bg-slate-400' : r.papel === 'apoio' ? 'bg-cyan-500' : 'bg-orange-500'
                return (
                  <div key={r.id} className={`flex items-center border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <div className="flex shrink-0" style={{ width: `${tableW}px` }}>
                      <div className={`px-3 py-2 border-r ${border} flex items-center gap-1.5`} style={{ width: `${COL_W.pessoa}px` }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDark ? cfg.textDark.replace('text-', 'bg-') : cfg.text.replace('text-', 'bg-')}`} />
                        <span className={`text-[11px] font-semibold truncate ${txtMain}`} title={r.nome}>{primeiroNome(r.nome)}</span>
                      </div>
                      <div className={`px-2 py-2 border-r ${border} text-[11px] truncate ${txtMuted}`} style={{ width: `${COL_W.obra}px` }} title={obra?.nome}>{obra?.nome ?? '—'}</div>
                      <div className={`px-2 py-2 border-r ${border} text-[10px] ${txtMain}`} style={{ width: `${COL_W.periodo}px` }}>{fmtDate(r.data_inicio)} → {fmtDate(r.data_fim)}</div>
                    </div>
                    <div className="flex-1 relative h-9 min-w-[400px]">
                      <div className="absolute top-0 bottom-0 w-[1px] bg-red-500/40 pointer-events-none" style={{ left: `${todayPct}%` }} />
                      <div className={`absolute top-1/2 -translate-y-1/2 h-4 rounded ${barColor} shadow-sm`} style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 10 }} title={`${fmtDate(r.data_inicio)} → ${fmtDate(r.data_fim)}`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className={`flex flex-wrap gap-3 text-[10px] ${txtMuted}`}>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-orange-500" /> Liderança</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-cyan-500" /> Apoio</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-slate-400" /> Time</span>
        <span className="inline-flex items-center gap-1"><span className="w-[2px] h-3 bg-red-500" /> Hoje</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// KANBAN VIEW — colunas = obras do projeto selecionado
// ══════════════════════════════════════════════════════════════════════════════

function KanbanView({
  equipe, obras, disponiveis, isDark, onMoveToObra, onAlocar,
}: {
  equipe: ObraPlanejamentoEquipe[]
  obras: ObraComProjeto[]
  disponiveis: ColaboradorAtivo[]
  isDark: boolean
  onMoveToObra: (colaboradorId: string, obraId: string) => void
  onAlocar: (preset: { obraId?: string } | null) => void
}) {
  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const projetos = useMemo(() => {
    const m = new Map<string, string>()
    obras.forEach(o => { if (o.projeto_id) m.set(o.projeto_id, o.projeto_nome ?? o.projeto_id) })
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [obras])

  const [projetoSel, setProjetoSel] = useState<string>(() => projetos[0]?.id ?? 'todos')
  const [dragColab, setDragColab] = useState<string | null>(null)

  const obrasDoProjeto = useMemo(
    () => projetoSel === 'todos' ? obras : obras.filter(o => o.projeto_id === projetoSel),
    [obras, projetoSel],
  )

  // alocacoes ativas por obra (somente lideres + apoio aparecem como cards; time vai junto)
  const ativosByObra = useMemo(() => {
    const m = new Map<string, ObraPlanejamentoEquipe[]>()
    equipe.filter(e => STATUS_ATIVO.includes(e.status)).forEach(e => {
      const arr = m.get(e.obra_id) ?? []; arr.push(e); m.set(e.obra_id, arr)
    })
    return m
  }, [equipe])

  const onDrop = useCallback((obraId: string) => {
    if (!dragColab) return
    onMoveToObra(dragColab, obraId)
    setDragColab(null)
  }, [dragColab, onMoveToObra])

  return (
    <div className="space-y-3">
      {/* Seletor de projeto */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold ${txtMuted}`}>Projeto:</span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setProjetoSel('todos')}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition-colors ${projetoSel === 'todos' ? 'bg-orange-500 text-white border-orange-500' : isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >Todos</button>
          {projetos.map(p => (
            <button
              key={p.id}
              onClick={() => setProjetoSel(p.id)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition-colors ${projetoSel === p.id ? 'bg-orange-500 text-white border-orange-500' : isDark ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >{p.nome}</button>
          ))}
        </div>
      </div>

      <div className={`flex items-center gap-2 text-[11px] ${txtMuted}`}>
        <UserPlus size={12} /> Arraste de "Disponíveis" para uma obra para alocar. Mover um encarregado leva o time junto.
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 styled-scrollbar">
        {/* Pool disponiveis */}
        <div className={`shrink-0 w-[260px] rounded-2xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[12px] font-extrabold uppercase tracking-wider ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Disponíveis</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>{disponiveis.length}</span>
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto styled-scrollbar">
            {disponiveis.length === 0 ? (
              <p className={`text-[11px] italic text-center py-4 ${txtMuted}`}>Todos alocados</p>
            ) : disponiveis.slice(0, 200).map(c => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDragColab(c.id)}
                onDragEnd={() => setDragColab(null)}
                className={`rounded-xl border p-2 cursor-grab active:cursor-grabbing transition-all ${isDark ? 'bg-[#111827] border-white/[0.08] hover:border-white/[0.14]' : 'bg-white border-slate-200 hover:shadow-md'} ${dragColab === c.id ? 'opacity-40 scale-95' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Avatar nome={c.nome} fotoUrl={c.foto_url} isDark={isDark} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-bold truncate ${txtMain}`}>{primeiroNome(c.nome)}</p>
                    <p className={`text-[9px] truncate ${txtMuted}`}>{c.cargo ?? '—'}</p>
                  </div>
                  <PapelBadge papel={c.papel_sugerido} isDark={isDark} />
                </div>
              </div>
            ))}
            {disponiveis.length > 200 && <p className={`text-[10px] italic ${txtMuted}`}>+ {disponiveis.length - 200} (use a Lista para filtrar)</p>}
          </div>
        </div>

        {/* Colunas de obras */}
        {obrasDoProjeto.map(o => {
          const rows = ativosByObra.get(o.id) ?? []
          const cards = rows.filter(r => r.papel !== 'time') // time vai junto do lider
          const timeCount = rows.filter(r => r.papel === 'time').length
          return (
            <div
              key={o.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(o.id)}
              className={`shrink-0 w-[260px] rounded-2xl border p-3 ${dragColab ? (isDark ? 'bg-orange-500/5 border-orange-500/30' : 'bg-orange-50/40 border-orange-300') : isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className={`text-[12px] font-extrabold uppercase tracking-wider truncate ${txtMain}`} title={o.nome}>{o.nome}</p>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-50 text-orange-600'}`}>{rows.length}</span>
              </div>

              <div className="space-y-2 min-h-[60px]">
                {cards.length === 0 ? (
                  <div className={`text-center py-6 text-[10px] rounded-lg border border-dashed ${isDark ? 'border-white/10 text-slate-600' : 'border-slate-300 text-slate-400'}`}>Solte aqui</div>
                ) : cards.map(r => {
                  const cfg = PAPEL_CONFIG[r.papel]
                  const meuTime = r.papel === 'encarregado' ? rows.filter(t => t.lider_id === r.id).length : 0
                  return (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={() => r.colaborador_id && setDragColab(r.colaborador_id)}
                      onDragEnd={() => setDragColab(null)}
                      className={`rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition-all ${isDark ? 'bg-[#111827] border-white/[0.08] hover:border-white/[0.14]' : 'bg-white border-slate-200 hover:shadow-md'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar nome={r.nome} fotoUrl={r.colaborador?.foto_url} isDark={isDark} size={26} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[11px] font-bold truncate ${txtMain}`}>{primeiroNome(r.nome)}</p>
                          <p className={`text-[9px] truncate ${txtMuted}`}>{r.funcao}</p>
                        </div>
                        <PapelBadge papel={r.papel} isDark={isDark} />
                      </div>
                      {meuTime > 0 && (
                        <div className={`mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${isDark ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                          <Users2 size={9} /> +{meuTime} no time
                        </div>
                      )}
                    </div>
                  )
                })}
                {timeCount > 0 && (
                  <p className={`text-[10px] text-center ${txtMuted}`}>{timeCount} no(s) time(s)</p>
                )}
              </div>

              <button
                onClick={() => onAlocar({ obraId: o.id })}
                className={`mt-2 w-full inline-flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg border border-dashed transition-colors ${isDark ? 'border-white/10 text-slate-500 hover:border-orange-400/50 hover:text-orange-300' : 'border-slate-300 text-slate-400 hover:border-orange-400 hover:text-orange-600'}`}
              >
                <Plus size={11} /> Alocar aqui
              </button>
            </div>
          )
        })}

        {obrasDoProjeto.length === 0 && (
          <div className={`shrink-0 w-[260px] rounded-2xl border border-dashed flex items-center justify-center text-xs ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
            Nenhuma obra neste projeto
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL ALOCAR PESSOA
// ══════════════════════════════════════════════════════════════════════════════

function AlocarPessoaModal({
  isDark, obras, colaboradores, alocadosIds, encarregados, preset, onClose,
}: {
  isDark: boolean
  obras: ObraComProjeto[]
  colaboradores: ColaboradorAtivo[]
  alocadosIds: Set<string>
  encarregados: ObraPlanejamentoEquipe[]
  preset: { obraId?: string; colaboradorId?: string; papel?: PapelEquipe; liderId?: string } | null
  onClose: () => void
}) {
  const { perfil } = useAuth()
  const criar = useCriarPlanEquipe()

  const [obraId, setObraId] = useState(preset?.obraId ?? '')
  const [colabId, setColabId] = useState(preset?.colaboradorId ?? '')
  const [papel, setPapel] = useState<PapelEquipe>(preset?.papel ?? 'time')
  const [liderId, setLiderId] = useState(preset?.liderId ?? '')
  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState('')

  const inputCls = `w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'}`
  const labelCls = `text-[10px] font-bold uppercase tracking-wider block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // obras agrupadas por projeto (optgroup)
  const obrasPorProjeto = useMemo(() => {
    const m = new Map<string, { nome: string; obras: ObraComProjeto[] }>()
    obras.forEach(o => {
      const k = o.projeto_id ?? '__sem__'
      const g = m.get(k) ?? { nome: o.projeto_nome ?? 'Sem projeto', obras: [] }
      g.obras.push(o); m.set(k, g)
    })
    return Array.from(m.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [obras])

  const colabSelecionado = colaboradores.find(c => c.id === colabId)

  // lista filtrada de colaboradores (disponiveis + o ja selecionado)
  const colabFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return colaboradores
      .filter(c => !alocadosIds.has(c.id) || c.id === colabId)
      .filter(c => !q || c.nome.toLowerCase().includes(q) || (c.cargo ?? '').toLowerCase().includes(q))
      .slice(0, 60)
  }, [colaboradores, alocadosIds, colabId, busca])

  const encarregadosDaObra = useMemo(
    () => encarregados.filter(e => e.obra_id === obraId),
    [encarregados, obraId],
  )

  const selecionarColab = (c: ColaboradorAtivo) => {
    setColabId(c.id)
    if (!preset?.papel) setPapel(c.papel_sugerido)
  }

  const busy = criar.isPending

  const handleSave = async () => {
    if (!obraId || !colabId || !dataInicio) { alert('Selecione obra, pessoa e data de início'); return }
    if (!colabSelecionado) { alert('Pessoa inválida'); return }
    try {
      await criar.mutateAsync({
        obra_id: obraId,
        colaborador_id: colabId,
        nome: colabSelecionado.nome,
        funcao: colabSelecionado.cargo ?? '—',
        papel,
        lider_id: papel === 'time' && liderId ? liderId : null,
        categoria: categoriaFromPapel(papel),
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        turno: 'diurno',
        horas_dia: 8,
        status: 'planejado',
        custo_hora: 0,
        custo_diaria: 0,
        created_by: perfil?.auth_id,
      } as any)
      onClose()
    } catch (err) {
      alert('Erro ao alocar: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/15' : 'bg-orange-50'}`}>
              <UserPlus size={15} className="text-orange-500" />
            </div>
            <div>
              <p className={`text-sm font-extrabold ${txtMain}`}>Alocar pessoa</p>
              <p className={`text-[10px] ${txtMuted}`}>Vincula um colaborador do RH a uma obra</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto styled-scrollbar">
          {/* Obra */}
          <div>
            <label className={labelCls}>Obra (Projeto › Obra) *</label>
            <select value={obraId} onChange={e => { setObraId(e.target.value); setLiderId('') }} className={inputCls}>
              <option value="">Selecione...</option>
              {obrasPorProjeto.map(g => (
                <optgroup key={g.nome} label={g.nome}>
                  {g.obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Pessoa (busca) */}
          <div>
            <label className={labelCls}>Pessoa (colaborador ativo) *</label>
            {colabSelecionado ? (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
                <Avatar nome={colabSelecionado.nome} fotoUrl={colabSelecionado.foto_url} isDark={isDark} size={28} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate ${txtMain}`}>{colabSelecionado.nome}</p>
                  <p className={`text-[10px] truncate ${txtMuted}`}>{colabSelecionado.cargo} {colabSelecionado.base_nome ? `· ${colabSelecionado.base_nome}` : ''}</p>
                </div>
                <button onClick={() => { setColabId(''); setBusca('') }} className={`p-1 rounded ${isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}><X size={13} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." className={`${inputCls} pl-8`} autoFocus />
                </div>
                {busca && (
                  <div className={`mt-1 max-h-[180px] overflow-y-auto rounded-xl border ${isDark ? 'border-white/[0.08] bg-[#0b1220]' : 'border-slate-200 bg-white'}`}>
                    {colabFiltrados.length === 0 ? (
                      <p className={`text-[11px] italic px-3 py-2 ${txtMuted}`}>Nenhum disponível encontrado</p>
                    ) : colabFiltrados.map(c => (
                      <button key={c.id} onClick={() => selecionarColab(c)} className={`flex items-center gap-2 w-full text-left px-3 py-1.5 ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                        <Avatar nome={c.nome} fotoUrl={c.foto_url} isDark={isDark} size={22} />
                        <span className={`text-[11px] font-medium truncate ${txtMain}`}>{c.nome}</span>
                        <span className={`ml-auto text-[9px] truncate ${txtMuted}`}>{c.cargo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Papel */}
          <div>
            <label className={labelCls}>Papel na obra *</label>
            <div className="flex flex-wrap gap-1.5">
              {PAPEL_ORDER.map(p => {
                const cfg = PAPEL_CONFIG[p]; const Icon = cfg.icon; const on = papel === p
                return (
                  <button key={p} onClick={() => { setPapel(p); if (p !== 'time') setLiderId('') }} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${on ? (isDark ? `${cfg.bgDark} ${cfg.textDark} border-white/[0.12]` : `${cfg.bg} ${cfg.text} border-slate-300`) : isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                    <Icon size={12} /> {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Lider (somente se time) */}
          {papel === 'time' && (
            <div>
              <label className={labelCls}>Encarregado (líder do time)</label>
              <select value={liderId} onChange={e => setLiderId(e.target.value)} className={inputCls} disabled={!obraId}>
                <option value="">Sem encarregado</option>
                {encarregadosDaObra.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              {obraId && encarregadosDaObra.length === 0 && (
                <p className={`text-[10px] mt-1 ${txtMuted}`}>Nenhum encarregado nesta obra ainda. Aloque um encarregado primeiro para montar o time.</p>
              )}
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início *</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fim previsto</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        <div className={`flex justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`px-3 py-2 rounded-xl text-xs font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
          <button onClick={handleSave} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 inline-flex items-center gap-1.5">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} {busy ? 'Alocando...' : 'Alocar'}
          </button>
        </div>
      </div>
    </div>
  )
}
