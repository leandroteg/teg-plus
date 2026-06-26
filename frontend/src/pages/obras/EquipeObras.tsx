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
  useCriarPlanEquipe, useExcluirPlanEquipe, useAtualizarPlanEquipe, useMoverLiderTime,
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
    key: 'kanban', label: 'Quadro Geral',
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
                colaboradores={colaboradores} equipe={equipe} obras={obras}
                isDark={isDark}
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

const PAPEL_PLURAL: Record<PapelEquipe, string> = {
  engenheiro: 'Engenheiros', supervisor: 'Supervisores', encarregado: 'Encarregados', apoio: 'Apoio', time: 'Time',
}

// Popover de pessoas disponíveis (busca + lista) para os botões "+"
function PickerPopover({ isDark, items, onPick, onClose }: {
  isDark: boolean; items: ColaboradorAtivo[]; onPick: (c: ColaboradorAtivo) => void; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const ql = q.trim().toLowerCase()
  const filtered = items.filter(c => !ql || c.nome.toLowerCase().includes(ql) || (c.cargo ?? '').toLowerCase().includes(ql)).slice(0, 50)
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute right-0 mt-1 w-[260px] rounded-xl border shadow-xl z-50 overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.1]' : 'bg-white border-slate-200'}`}>
        <div className={`p-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar disponível..." className={`w-full pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none ${isDark ? 'bg-white/[0.04] border border-white/[0.06] text-slate-200' : 'bg-slate-50 border border-slate-200'}`} />
          </div>
        </div>
        <div className="max-h-[230px] overflow-y-auto styled-scrollbar">
          {filtered.length === 0 ? (
            <p className={`text-[11px] italic px-3 py-3 ${txtMuted}`}>Nenhum disponível</p>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => { onPick(c); onClose() }} className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}>
              <Avatar nome={c.nome} fotoUrl={c.foto_url} isDark={isDark} size={22} />
              <span className={`text-[11px] font-medium truncate ${txtMain}`}>{c.nome}</span>
              <span className={`ml-auto text-[9px] truncate ${txtMuted}`}>{c.cargo}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// Linha simples (engenheiro / apoio — solto na obra)
function FlatRow({ a, isDark, onRemove, small }: { a: ObraPlanejamentoEquipe; isDark: boolean; onRemove: () => void; small?: boolean }) {
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className={`flex items-center gap-2 ${small ? 'px-2 py-1' : 'px-3 py-2'} rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/60'}`}>
      <Avatar nome={a.nome} fotoUrl={a.colaborador?.foto_url} isDark={isDark} size={small ? 20 : 26} />
      <div className="min-w-0">
        <p className={`${small ? 'text-[10px]' : 'text-xs'} font-bold truncate ${txtMain}`}>{small ? primeiroNome(a.nome) : a.nome}</p>
        {!small && <p className={`text-[9px] truncate ${txtMuted}`}>{a.funcao}</p>}
      </div>
      <PapelBadge papel={a.papel} isDark={isDark} />
      <button onClick={onRemove} className={`ml-auto p-1 rounded ${isDark ? 'hover:bg-rose-500/15 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`} title="Remover"><Trash2 size={small ? 11 : 12} /></button>
    </div>
  )
}

function ListaView({
  colaboradores, equipe, isDark,
}: {
  colaboradores: ColaboradorAtivo[]
  equipe: ObraPlanejamentoEquipe[]
  obras: ObraComProjeto[]
  isDark: boolean
}) {
  const { perfil } = useAuth()
  const criar = useCriarPlanEquipe()
  const excluir = useExcluirPlanEquipe()
  const atualizar = useAtualizarPlanEquipe()

  const [busca, setBusca] = useState('')
  const [escopo, setEscopo] = useState('obras_ssma')
  const [drag, setDrag] = useState<{ kind: 'new' | 'move'; colaboradorId?: string; allocId?: string; papel: PapelEquipe } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [picker, setPicker] = useState<string | null>(null)

  const txtMain  = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls  = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'bg-white border-slate-200'}`

  const active = useMemo(() => equipe.filter(e => STATUS_ATIVO.includes(e.status)), [equipe])
  const alocadosIds = useMemo(() => { const s = new Set<string>(); active.forEach(e => { if (e.colaborador_id) s.add(e.colaborador_id) }); return s }, [active])

  const inEscopo = (c: ColaboradorAtivo) =>
    escopo === 'todos' ? true
    : escopo === 'obras_ssma' ? (c.departamento === 'Obras' || c.papel_sugerido === 'apoio')
    : c.departamento === escopo

  // roster disponível por papel (no escopo + busca) — só lideranças e time entram na composição
  const COMPOR: PapelEquipe[] = ['supervisor', 'encarregado', 'time']
  const dispByPapel = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const m = new Map<PapelEquipe, ColaboradorAtivo[]>()
    COMPOR.forEach(p => m.set(p, []))
    colaboradores
      .filter(c => COMPOR.includes(c.papel_sugerido) && !alocadosIds.has(c.id) && inEscopo(c) && (!q || c.nome.toLowerCase().includes(q) || (c.cargo ?? '').toLowerCase().includes(q)))
      .forEach(c => m.get(c.papel_sugerido)!.push(c))
    return m
  }, [colaboradores, alocadosIds, escopo, busca])

  const poolByPapel = useMemo(() => {
    const m = new Map<PapelEquipe, ColaboradorAtivo[]>()
    COMPOR.forEach(p => m.set(p, []))
    colaboradores.filter(c => COMPOR.includes(c.papel_sugerido) && !alocadosIds.has(c.id)).forEach(c => m.get(c.papel_sugerido)!.push(c))
    return m
  }, [colaboradores, alocadosIds])

  // árvore: encarregados/time por lider_id
  const encByLider = useMemo(() => {
    const m = new Map<string, ObraPlanejamentoEquipe[]>()
    active.filter(e => e.papel === 'encarregado').forEach(e => { const k = e.lider_id ?? '__top__'; const arr = m.get(k) ?? []; arr.push(e); m.set(k, arr) })
    return m
  }, [active])
  const timeByLider = useMemo(() => {
    const m = new Map<string, ObraPlanejamentoEquipe[]>()
    active.filter(e => e.papel === 'time').forEach(e => { const k = e.lider_id ?? '__top__'; const arr = m.get(k) ?? []; arr.push(e); m.set(k, arr) })
    return m
  }, [active])

  const supervisores = useMemo(() => active.filter(e => e.papel === 'supervisor').sort((a, b) => a.nome.localeCompare(b.nome)), [active])
  const encSemSup = useMemo(() => encByLider.get('__top__') ?? [], [encByLider])
  const encIds = useMemo(() => new Set(active.filter(e => e.papel === 'encarregado').map(e => e.id)), [active])

  const kpis = useMemo(() => ({
    sup: supervisores.length,
    enc: active.filter(e => e.papel === 'encarregado').length,
    time: active.filter(e => e.papel === 'time').length,
    orf: active.filter(e => e.papel === 'time' && (!e.lider_id || !encIds.has(e.lider_id))).length,
  }), [active, supervisores, encIds])

  const escopoCount = useMemo(() => {
    const set = colaboradores.filter(inEscopo)
    return { total: set.length, alocados: set.filter(c => alocadosIds.has(c.id)).length, disp: set.filter(c => !alocadosIds.has(c.id)).length }
  }, [colaboradores, escopo, alocadosIds])
  const departamentos = useMemo(() => { const s = new Set<string>(); colaboradores.forEach(c => { if (c.departamento) s.add(c.departamento) }); return Array.from(s).sort() }, [colaboradores])

  const toggleExp = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // cria pessoa nova na composição (sem obra)
  async function criarPessoa(colaboradorId: string, papel: PapelEquipe, liderId: string | null) {
    const c = colaboradores.find(x => x.id === colaboradorId)
    if (!c) return
    try {
      await criar.mutateAsync({
        obra_id: null, colaborador_id: c.id, nome: c.nome, funcao: c.cargo ?? '—',
        papel, lider_id: liderId, categoria: categoriaFromPapel(papel),
        data_inicio: '2026-06-26', turno: 'diurno', horas_dia: 8, status: 'planejado',
        custo_hora: 0, custo_diaria: 0, created_by: perfil?.auth_id,
      } as any)
    } catch (err) { alert('Erro: ' + (err instanceof Error ? err.message : String(err))) }
  }
  async function reparent(allocId: string, liderId: string | null) {
    try { await atualizar.mutateAsync({ id: allocId, lider_id: liderId } as any) }
    catch (err) { alert('Erro: ' + (err instanceof Error ? err.message : String(err))) }
  }
  // dropar item (novo do roster ou movido) sob um lider; papelEsperado valida
  function dropUnder(liderId: string | null, papelEsperado: PapelEquipe) {
    if (!drag || drag.papel !== papelEsperado) return
    if (drag.kind === 'new' && drag.colaboradorId) criarPessoa(drag.colaboradorId, papelEsperado, liderId)
    else if (drag.kind === 'move' && drag.allocId) reparent(drag.allocId, liderId)
    setDrag(null)
  }
  async function remover(allocId: string) {
    const ids: string[] = []
    const gather = (id: string) => { ids.push(id); active.filter(e => e.lider_id === id).forEach(e => gather(e.id)) }
    gather(allocId)
    try { for (const id of ids.reverse()) await excluir.mutateAsync(id) }
    catch (err) { alert('Erro ao remover: ' + (err instanceof Error ? err.message : String(err))) }
  }

  const RosterCard = (c: ColaboradorAtivo) => (
    <div key={c.id} draggable onDragStart={() => setDrag({ kind: 'new', colaboradorId: c.id, papel: c.papel_sugerido })} onDragEnd={() => setDrag(null)}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing ${isDark ? 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12]' : 'border-slate-100 bg-white hover:shadow-sm'} ${drag?.colaboradorId === c.id ? 'opacity-40' : ''}`}>
      <Avatar nome={c.nome} fotoUrl={c.foto_url} isDark={isDark} size={24} />
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold truncate ${txtMain}`} title={c.nome}>{primeiroNome(c.nome)}</p>
        <p className={`text-[9px] truncate ${txtMuted}`}>{c.cargo}</p>
      </div>
    </div>
  )

  // ── card de um encarregado (com seu time) ──
  function EncarregadoCard({ enc }: { enc: ObraPlanejamentoEquipe }) {
    const tm = timeByLider.get(enc.id) ?? []
    const expE = expanded.has(enc.id)
    const dropEnc = drag?.papel === 'time'
    return (
      <div className={`rounded-lg border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}
        onDragOver={ev => { if (dropEnc) ev.preventDefault() }} onDrop={ev => { ev.stopPropagation(); dropUnder(enc.id, 'time'); setExpanded(p => new Set(p).add(enc.id)) }}>
        <div className={`flex items-center gap-2 px-2.5 py-1.5 ${dropEnc ? (isDark ? 'bg-orange-500/10 rounded-t-lg' : 'bg-orange-50 rounded-t-lg') : ''}`}>
          <button onClick={() => toggleExp(enc.id)} className={txtMuted}>{expE ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
          <div draggable onDragStart={() => setDrag({ kind: 'move', allocId: enc.id, papel: 'encarregado' })} onDragEnd={() => setDrag(null)} className="flex items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing">
            <Avatar nome={enc.nome} fotoUrl={enc.colaborador?.foto_url} isDark={isDark} size={22} />
            <p className={`text-[11px] font-bold truncate min-w-0 ${txtMain}`}>{primeiroNome(enc.nome)}</p>
          </div>
          <PapelBadge papel="encarregado" isDark={isDark} />
          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><Users2 size={9} /> {tm.length}</span>
          <div className="relative ml-auto">
            <button onClick={() => setPicker(picker === `node:${enc.id}` ? null : `node:${enc.id}`)} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600"><Plus size={9} /> Time</button>
            {picker === `node:${enc.id}` && <PickerPopover isDark={isDark} items={poolByPapel.get('time') ?? []} onClose={() => setPicker(null)} onPick={c => { criarPessoa(c.id, 'time', enc.id); setExpanded(p => new Set(p).add(enc.id)) }} />}
          </div>
          <button onClick={() => remover(enc.id)} className={`p-1 rounded ${isDark ? 'hover:bg-rose-500/15 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`} title="Remover"><Trash2 size={11} /></button>
        </div>
        {expE && (
          <div className={`px-2.5 pb-2 pt-1 border-t grid grid-cols-1 sm:grid-cols-2 gap-1 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            {tm.length === 0 ? <p className={`text-[10px] italic ${txtMuted}`}>Sem equipe. Arraste do Time, ou “+ Time”.</p>
              : tm.map(m => (
                <div key={m.id} draggable onDragStart={() => setDrag({ kind: 'move', allocId: m.id, papel: 'time' })} onDragEnd={() => setDrag(null)}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-grab active:cursor-grabbing ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                  <Avatar nome={m.nome} fotoUrl={m.colaborador?.foto_url} isDark={isDark} size={18} />
                  <span className={`text-[10px] truncate ${txtMain}`}>{primeiroNome(m.nome)}</span>
                  <button onClick={() => remover(m.id)} className={`ml-auto p-0.5 rounded ${isDark ? 'hover:bg-rose-500/15 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`}><X size={10} /></button>
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* KPIs + escopo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard isDark={isDark} icon={UserCog}     label="Supervisores" value={kpis.sup}  color="indigo" />
        <KpiCard isDark={isDark} icon={HardHat}      label="Encarregados" value={kpis.enc}  color="orange" />
        <KpiCard isDark={isDark} icon={Users2}       label="Time"         value={kpis.time} color="slate" />
        <KpiCard isDark={isDark} icon={Briefcase}    label="Sem encarreg." value={kpis.orf} color="cyan" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={escopo} onChange={e => setEscopo(e.target.value)} className={`${inputCls} max-w-[230px]`}>
          <option value="obras_ssma">Setor Obras + Apoio SSMA</option>
          <option value="todos">Todos os setores</option>
          {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="relative">
          <button onClick={() => setPicker(picker === 'novo-sup' ? null : 'novo-sup')} className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Plus size={13} /> Supervisor
          </button>
          {picker === 'novo-sup' && <PickerPopover isDark={isDark} items={poolByPapel.get('supervisor') ?? []} onClose={() => setPicker(null)} onPick={c => criarPessoa(c.id, 'supervisor', null)} />}
        </div>
        <span className={`ml-auto text-[11px] ${txtMuted}`}>{escopoCount.alocados}/{escopoCount.total} em equipe · {escopoCount.disp} disponíveis</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        {/* Disponíveis (roster) */}
        <div className={`lg:w-[300px] shrink-0 rounded-2xl border ${cardCls}`}>
          <div className={`px-3 py-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar disponível..." className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none ${isDark ? 'bg-white/[0.04] border border-white/[0.06] text-slate-200' : 'bg-slate-50 border border-slate-200'}`} />
            </div>
            <p className={`text-[10px] mt-1.5 ${txtMuted}`}>Arraste p/ o Supervisor (encarregado) ou Encarregado (time), ou use “+”.</p>
          </div>
          <div className="p-2 space-y-2 max-h-[68vh] overflow-y-auto styled-scrollbar">
            {COMPOR.map(papel => {
              const list = dispByPapel.get(papel) ?? []
              if (list.length === 0) return null
              const cfg = PAPEL_CONFIG[papel]; const Icon = cfg.icon
              return (
                <div key={papel}>
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <Icon size={12} className={isDark ? cfg.textDark : cfg.text} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{PAPEL_PLURAL[papel]}</span>
                    <span className={`ml-auto text-[9px] font-bold ${txtMuted}`}>{list.length}</span>
                  </div>
                  <div className="space-y-1">{list.slice(0, 60).map(RosterCard)}</div>
                  {list.length > 60 && <p className={`text-[9px] italic px-1 mt-1 ${txtMuted}`}>+{list.length - 60} — refine a busca</p>}
                </div>
              )
            })}
            {COMPOR.every(p => (dispByPapel.get(p) ?? []).length === 0) && (
              <p className={`text-[11px] italic text-center py-6 ${txtMuted}`}>Nenhum disponível no escopo</p>
            )}
          </div>
        </div>

        {/* Composição: Supervisor › Encarregado › Time */}
        <div className="flex-1 space-y-3 min-w-0">
          {supervisores.length === 0 && encSemSup.length === 0 ? (
            <div className={`text-center py-14 rounded-2xl border border-dashed ${isDark ? 'border-white/10 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              <UserCog size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Nenhuma equipe ainda</p>
              <p className="text-xs mt-1">Use “+ Supervisor” para começar a montar.</p>
            </div>
          ) : (
            <>
              {supervisores.map(sup => {
                const encs = (encByLider.get(sup.id) ?? [])
                const orf = (timeByLider.get(sup.id) ?? [])  // time pendurado direto no supervisor = sem encarregado
                const expS = expanded.has(sup.id)
                const dropSup = drag?.papel === 'encarregado'
                const totalSub = encs.length + encs.reduce((a, e) => a + (timeByLider.get(e.id)?.length ?? 0), 0) + orf.length
                return (
                  <div key={sup.id} className={`rounded-2xl border ${cardCls}`}
                    onDragOver={ev => { if (dropSup) ev.preventDefault() }} onDrop={() => { dropUnder(sup.id, 'encarregado'); setExpanded(p => new Set(p).add(sup.id)) }}>
                    <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 border-b ${dropSup ? (isDark ? 'bg-orange-500/10' : 'bg-orange-50') : ''} ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                      <button onClick={() => toggleExp(sup.id)} className={txtMuted}>{expS ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                      <Avatar nome={sup.nome} fotoUrl={sup.colaborador?.foto_url} isDark={isDark} size={28} />
                      <div className="min-w-0">
                        <p className={`text-sm font-extrabold truncate ${txtMain}`}>{sup.nome}</p>
                        <p className={`text-[9px] truncate ${txtMuted}`}>{sup.funcao}</p>
                      </div>
                      <PapelBadge papel="supervisor" isDark={isDark} />
                      {sup.observacoes?.includes('VÁRIOS') && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title={sup.observacoes}>⚠ revisar</span>}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{encs.length} enc · {totalSub} pessoas</span>
                      <div className="relative ml-auto">
                        <button onClick={() => setPicker(picker === `node:${sup.id}` ? null : `node:${sup.id}`)} className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600"><Plus size={9} /> Encarreg.</button>
                        {picker === `node:${sup.id}` && <PickerPopover isDark={isDark} items={poolByPapel.get('encarregado') ?? []} onClose={() => setPicker(null)} onPick={c => { criarPessoa(c.id, 'encarregado', sup.id); setExpanded(p => new Set(p).add(sup.id)) }} />}
                      </div>
                      <button onClick={() => remover(sup.id)} className={`p-1 rounded ${isDark ? 'hover:bg-rose-500/15 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`} title="Remover supervisor + equipe"><Trash2 size={12} /></button>
                    </div>
                    {expS && (
                      <div className="p-3 space-y-1.5">
                        {encs.length === 0 && orf.length === 0 && <p className={`text-[11px] italic ${txtMuted}`}>Sem encarregados. Arraste um, ou use “+ Encarreg.”.</p>}
                        {encs.map(enc => <EncarregadoCard key={enc.id} enc={enc} />)}

                        {/* Time sem encarregado (reatribuir) */}
                        {orf.length > 0 && (
                          <div className={`rounded-lg border border-dashed ${isDark ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-amber-300 bg-amber-50/60'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-wider px-2.5 pt-1.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>⚠ Time sem encarregado — definir</p>
                            <div className="px-2.5 pb-2 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {orf.map(m => (
                                <div key={m.id} draggable onDragStart={() => setDrag({ kind: 'move', allocId: m.id, papel: 'time' })} onDragEnd={() => setDrag(null)}
                                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-grab active:cursor-grabbing ${isDark ? 'bg-white/[0.02]' : 'bg-white'}`}>
                                  <Avatar nome={m.nome} fotoUrl={m.colaborador?.foto_url} isDark={isDark} size={18} />
                                  <span className={`text-[10px] truncate ${txtMain}`} title={m.observacoes ?? ''}>{primeiroNome(m.nome)}</span>
                                  <div className="relative ml-auto">
                                    <button onClick={() => setPicker(picker === `orf:${m.id}` ? null : `orf:${m.id}`)} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Encarreg.</button>
                                    {picker === `orf:${m.id}` && (
                                      <div className="absolute right-0 z-50">
                                        <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
                                        <div className={`relative mt-1 w-[200px] rounded-lg border shadow-xl z-50 max-h-[220px] overflow-y-auto ${isDark ? 'bg-[#0f172a] border-white/[0.1]' : 'bg-white border-slate-200'}`}>
                                          {encs.length === 0 ? <p className={`text-[10px] italic px-2 py-2 ${txtMuted}`}>Crie um encarregado antes.</p>
                                            : encs.map(e => (
                                              <button key={e.id} onClick={() => { reparent(m.id, e.id); setPicker(null) }} className={`block w-full text-left text-[10px] px-2 py-1.5 ${isDark ? 'hover:bg-white/[0.05] text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}>{primeiroNome(e.nome)}</button>
                                            ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <button onClick={() => remover(m.id)} className={`p-0.5 rounded ${isDark ? 'hover:bg-rose-500/15 text-rose-400' : 'hover:bg-rose-50 text-rose-500'}`}><X size={10} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Encarregados sem supervisor */}
              {encSemSup.length > 0 && (
                <div className={`rounded-2xl border ${cardCls}`}>
                  <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    <HardHat size={14} className="text-orange-500" />
                    <span className={`text-sm font-extrabold ${txtMain}`}>Encarregados sem supervisor</span>
                    <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{encSemSup.length}</span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {encSemSup.map(enc => <EncarregadoCard key={enc.id} enc={enc} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
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

  // Time não aparece como linha individual — só o número por encarregado.
  const rows = useMemo(() => equipe.filter(e => STATUS_ATIVO.includes(e.status) && e.papel !== 'time'), [equipe])
  const timeCountByLider = useMemo(() => {
    const m = new Map<string, number>()
    equipe.filter(e => STATUS_ATIVO.includes(e.status) && e.papel === 'time').forEach(e => {
      const k = e.lider_id ?? ''
      m.set(k, (m.get(k) ?? 0) + 1)
    })
    return m
  }, [equipe])

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
    const rank: Record<string, number> = { engenheiro: 0, supervisor: 1, encarregado: 2, apoio: 3, time: 4 }
    map.forEach(g => g.rows.sort((a, b) => {
      const oa = obraById.get(a.obra_id)?.nome ?? '', ob = obraById.get(b.obra_id)?.nome ?? ''
      return oa.localeCompare(ob) || (rank[a.papel] - rank[b.papel]) || a.nome.localeCompare(b.nome)
    }))
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [rows, obraById])

  // ── Colunas semanais (segunda → sábado) ──
  const mondayOf = (d: Date) => { const x = new Date(d); const day = x.getDay(); return addDays(x, day === 0 ? -6 : 1 - day) }
  const ddmm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const weeks = useMemo(() => {
    let startMon: Date, endDate: Date
    if (rows.length === 0) { const n = new Date(); startMon = mondayOf(n); endDate = addDays(n, 56) }
    else {
      const starts = rows.map(r => new Date(r.data_inicio).getTime())
      const ends = rows.map(r => new Date(r.data_fim || addDays(new Date(r.data_inicio), 30).toISOString()).getTime())
      startMon = mondayOf(new Date(Math.min(...starts)))
      endDate = new Date(Math.max(...ends))
    }
    const minEnd = addDays(startMon, 7 * 8)  // pelo menos 8 semanas
    if (endDate < minEnd) endDate = minEnd
    const list: { mon: Date; sat: Date; label: string }[] = []
    let cur = startMon, guard = 0
    while (cur <= endDate && guard < 30) {
      const sat = addDays(cur, 5)
      list.push({ mon: cur, sat, label: `${ddmm(cur)} - ${ddmm(sat)}` })
      cur = addDays(cur, 7); guard++
    }
    return list
  }, [rows])

  const today = new Date()
  const COL_W = { pessoa: 180, obra: 140, semana: 96 }
  const leftW = COL_W.pessoa + COL_W.obra
  const toggle = (id: string) => setMinimizados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-[11px] ${txtMuted}`}>
        <CalendarRange size={12} /> {rows.length} alocação(ões) · {weeks.length} semanas (segunda a sábado)
      </div>

      <div className={`rounded-xl border overflow-x-auto ${border}`}>
        {/* Header */}
        <div className={`flex items-stretch border-b ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
          <div className={`flex shrink-0 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`} style={{ width: `${leftW}px` }}>
            <div className={`px-3 py-2 border-r ${border} flex items-center`} style={{ width: `${COL_W.pessoa}px` }}>Pessoa</div>
            <div className={`px-2 py-2 border-r ${border} flex items-center`} style={{ width: `${COL_W.obra}px` }}>Obra</div>
          </div>
          {weeks.map((w, i) => {
            const atual = today >= w.mon && today <= addDays(w.sat, 1)
            return (
              <div key={i} className={`shrink-0 border-r px-1 py-1 text-center ${border} ${atual ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : ''}`} style={{ width: `${COL_W.semana}px` }}>
                <div className={`text-[8px] font-bold uppercase ${atual ? 'text-red-500' : txtMuted}`}>Sem.{atual ? ' • atual' : ''}</div>
                <div className={`text-[9px] font-semibold leading-tight ${txtMain}`}>{w.label}</div>
              </div>
            )
          })}
        </div>

        {rows.length === 0 ? (
          <div className={`text-center py-12 ${txtMuted}`}>
            <CalendarRange size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma alocação cadastrada</p>
          </div>
        ) : groups.map(group => {
          const min = minimizados.has(group.id)
          const totalW = leftW + weeks.length * COL_W.semana
          return (
            <div key={group.id}>
              <button onClick={() => toggle(group.id)} className={`flex items-center w-full text-left border-b transition-colors ${isDark ? 'border-white/[0.04] bg-white/[0.04] hover:bg-white/[0.06]' : 'border-slate-200 bg-slate-100 hover:bg-slate-200/60'}`} style={{ minWidth: `${totalW}px` }}>
                <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ width: `${leftW}px` }}>
                  {min ? <ChevronDown size={13} className={txtMuted} /> : <ChevronUp size={13} className={txtMuted} />}
                  <Briefcase size={12} className={txtMuted} />
                  <span className={`text-xs font-extrabold uppercase tracking-wide truncate ${txtMain}`}>{group.nome}</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>{group.rows.length}</span>
                </div>
              </button>

              {!min && group.rows.map(r => {
                const start = new Date(r.data_inicio)
                const end = new Date(r.data_fim || addDays(start, 30).toISOString())
                const cfg = PAPEL_CONFIG[r.papel]
                const obra = obraById.get(r.obra_id)
                const barColor = r.papel === 'apoio' ? 'bg-cyan-500' : 'bg-orange-500'
                return (
                  <div key={r.id} className={`flex items-stretch border-b ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <div className="flex shrink-0" style={{ width: `${leftW}px` }}>
                      <div className={`px-3 py-2 border-r ${border} flex items-center gap-1.5`} style={{ width: `${COL_W.pessoa}px` }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDark ? cfg.textDark.replace('text-', 'bg-') : cfg.text.replace('text-', 'bg-')}`} />
                        <span className={`text-[11px] font-semibold truncate ${txtMain}`} title={r.nome}>{primeiroNome(r.nome)}</span>
                        {r.papel === 'encarregado' && (timeCountByLider.get(r.id) ?? 0) > 0 && (
                          <span className={`ml-auto shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'}`} title="Pessoas na equipe">
                            <Users2 size={9} /> {timeCountByLider.get(r.id)}
                          </span>
                        )}
                      </div>
                      <div className={`px-2 py-2 border-r ${border} text-[10px] truncate ${txtMuted} flex items-center`} style={{ width: `${COL_W.obra}px` }} title={obra?.nome}>{obra?.nome ?? '—'}</div>
                    </div>
                    {weeks.map((w, i) => {
                      const ativo = start <= addDays(w.sat, 1) && end >= w.mon
                      return (
                        <div key={i} className={`shrink-0 border-r ${border} flex items-center justify-center py-2`} style={{ width: `${COL_W.semana}px` }}>
                          {ativo && <div className={`h-3.5 w-full mx-1 rounded ${barColor} shadow-sm`} title={`${primeiroNome(r.nome)} — Sem. ${w.label}`} />}
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

      <div className={`flex flex-wrap gap-3 text-[10px] ${txtMuted}`}>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-orange-500" /> Liderança alocada</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 rounded bg-cyan-500" /> Apoio</span>
        <span className="inline-flex items-center gap-1"><Users2 size={10} /> nº da equipe (sob o encarregado)</span>
        <span className="inline-flex items-center gap-1"><span className={`w-3 h-2 rounded ${isDark ? 'bg-red-500/30' : 'bg-red-100'}`} /> Semana atual</span>
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
