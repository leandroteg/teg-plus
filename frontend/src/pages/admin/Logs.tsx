// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/Logs.tsx
// Central de Logs (auditoria de negócio). Lista quem fez o quê, quando e o que
// mudou, lendo sys_log_atividades (populada por triggers no Postgres).
// Acesso restrito a admin via <AdminRoute> no App.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ScrollText, Loader2, Filter, ChevronDown, ChevronRight,
  PlusCircle, PencilLine, Trash2, Cpu, X,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useLogs, useLogModulos, useLogUsuarios,
  type LogAtividade, type LogsFiltro,
} from '../../hooks/useLogs'

// ── Labels amigáveis ──────────────────────────────────────────────────────────

const MODULO_LABEL: Record<string, string> = {
  sys: 'Sistema / Usuários', cmp: 'Compras', fin: 'Financeiro', apr: 'Aprovações',
  con: 'Contratos', loc: 'Locação', est: 'Estoque', pat: 'Patrimônio',
  rh: 'RH', log: 'Logística', fro: 'Frotas', pmo: 'Projetos (PMO)',
  obr: 'Obras', orc: 'Orçamentação', qsma: 'QSMA', sgi: 'Gestão (SGI)',
  ctrl: 'Controladoria', fis: 'Fiscal', ti: 'TI', desp: 'Despesas',
}
const moduloLabel = (m: string) => MODULO_LABEL[m] ?? m

const TIPO_META: Record<string, { label: string; icon: typeof PlusCircle; tone: string }> = {
  INSERT: { label: 'Criou', icon: PlusCircle, tone: 'emerald' },
  UPDATE: { label: 'Alterou', icon: PencilLine, tone: 'amber' },
  DELETE: { label: 'Excluiu', icon: Trash2, tone: 'rose' },
}

/** Nome de entidade legível: 'fin_contas_pagar' → 'Contas Pagar' */
function entidadeLabel(tipo: string | null): string {
  if (!tipo) return '—'
  const semPrefixo = tipo.replace(/^[a-z]+_/, '')
  return semPrefixo
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function fmtDataHora(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Formata um valor do diff para exibição. */
function fmtValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

// ── Detalhe do diff (campos alterados / snapshot) ─────────────────────────────

function LogDetalhe({ log, isLight }: { log: LogAtividade; isLight: boolean }) {
  const dados = log.dados
  const rowCls = isLight ? 'border-slate-100' : 'border-white/[0.06]'
  const keyCls = isLight ? 'text-slate-500' : 'text-slate-400'
  const oldCls = isLight ? 'text-rose-600' : 'text-rose-400'
  const newCls = isLight ? 'text-emerald-600' : 'text-emerald-400'

  if (!dados) {
    return <p className={`text-xs ${keyCls}`}>Sem detalhes registrados.</p>
  }

  // UPDATE: mostra apenas os campos que mudaram, com antes → depois
  if (log.tipo === 'UPDATE' && dados.campos_alterados?.length) {
    return (
      <div className="space-y-1.5">
        {dados.campos_alterados.map((campo) => (
          <div key={campo} className={`grid grid-cols-[minmax(120px,180px)_1fr] gap-3 border-b pb-1.5 ${rowCls}`}>
            <span className={`text-[11px] font-semibold ${keyCls}`}>{campo}</span>
            <span className="text-[11px] font-mono break-all">
              <span className={oldCls}>{fmtValor(dados.old?.[campo])}</span>
              <span className={keyCls}> → </span>
              <span className={newCls}>{fmtValor(dados.new?.[campo])}</span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  // INSERT / DELETE: snapshot dos campos principais
  const snapshot = (log.tipo === 'DELETE' ? dados.old : dados.new) ?? {}
  const entradas = Object.entries(snapshot).filter(
    ([k]) => !['search_vector', 'tsv'].includes(k),
  )
  if (!entradas.length) return <p className={`text-xs ${keyCls}`}>Sem detalhes registrados.</p>

  return (
    <div className="space-y-1 max-h-72 overflow-y-auto styled-scrollbar pr-1">
      {entradas.map(([k, v]) => (
        <div key={k} className={`grid grid-cols-[minmax(120px,180px)_1fr] gap-3 border-b pb-1 ${rowCls}`}>
          <span className={`text-[11px] font-semibold ${keyCls}`}>{k}</span>
          <span className="text-[11px] font-mono break-all">{fmtValor(v)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Linha da lista ────────────────────────────────────────────────────────────

function LogRow({ log, isLight }: { log: LogAtividade; isLight: boolean }) {
  const [aberto, setAberto] = useState(false)
  const meta = TIPO_META[log.tipo] ?? { label: log.tipo, icon: PencilLine, tone: 'slate' }
  const Icon = meta.icon
  const isSistema = log.dados?.origem === 'sistema'

  const toneBg: Record<string, string> = {
    emerald: isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/15 text-emerald-300',
    amber: isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/15 text-amber-300',
    rose: isLight ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/15 text-rose-300',
    slate: isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300',
  }
  const card = isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
  const sub = isLight ? 'text-slate-500' : 'text-slate-400'
  const txt = isLight ? 'text-slate-800' : 'text-slate-100'

  return (
    <div className={`rounded-xl border transition-colors ${card}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${toneBg[meta.tone]}`}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${txt}`}>
              {log.usuario_nome || 'Desconhecido'}
            </span>
            {isSistema && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400'}`}>
                <Cpu size={10} /> Sistema
              </span>
            )}
            <span className={`text-[12px] ${sub}`}>{meta.label.toLowerCase()}</span>
            <span className={`text-[12px] font-medium ${txt}`}>{entidadeLabel(log.entidade_tipo)}</span>
          </div>
          <div className={`text-[11px] mt-0.5 ${sub}`}>
            {moduloLabel(log.modulo)} · {fmtDataHora(log.created_at)}
          </div>
        </div>
        {aberto
          ? <ChevronDown size={16} className={`shrink-0 ${sub}`} />
          : <ChevronRight size={16} className={`shrink-0 ${sub}`} />}
      </button>
      {aberto && (
        <div className={`px-3 pb-3 pt-1 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <LogDetalhe log={log} isLight={isLight} />
        </div>
      )}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Logs() {
  const { isLightSidebar: isLight } = useTheme()
  const [filtro, setFiltro] = useState<LogsFiltro>({})
  const [buscaInput, setBuscaInput] = useState('')

  // debounce da busca textual
  useEffect(() => {
    const t = setTimeout(() => setFiltro((f) => ({ ...f, busca: buscaInput })), 400)
    return () => clearTimeout(t)
  }, [buscaInput])

  const {
    data, isLoading, isError, error,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useLogs(filtro)
  const { data: modulos = [] } = useLogModulos()
  const { data: usuarios = [] } = useLogUsuarios()

  const logs = useMemo(() => data?.pages.flat() ?? [], [data])

  // scroll infinito (server-side): observa um sentinela ao fim da lista
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '300px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const temFiltro = Boolean(
    filtro.modulo || filtro.tipo || filtro.usuarioId || filtro.de || filtro.ate || filtro.busca,
  )
  function limparFiltros() {
    setFiltro({})
    setBuscaInput('')
  }

  const bg = isLight ? 'bg-slate-50' : 'bg-[#0c1222]'
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  const label = isLight ? 'text-slate-500' : 'text-slate-400'
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  const inputCls = `rounded-lg border px-2.5 py-1.5 text-[13px] outline-none transition-colors ${
    isLight
      ? 'bg-white border-slate-200 text-slate-700 focus:border-slate-400'
      : 'bg-white/[0.03] border-white/10 text-slate-200 focus:border-white/25'
  }`
  // As <option> do dropdown nativo não herdam o tema do <select>: sem cor
  // explícita, no dark ficam texto claro sobre fundo claro do SO (ilegível).
  const optionCls = isLight ? 'text-slate-700 bg-white' : 'text-slate-100 bg-slate-800'

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/15 text-violet-300'}`}>
            <ScrollText size={20} />
          </span>
          <div>
            <h1 className={`text-lg font-bold ${heading}`}>Logs de Auditoria</h1>
            <p className={`text-[12px] ${label}`}>
              Registro de quem fez o quê, quando e o que mudou no sistema.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className={`rounded-2xl border p-3 mb-4 ${panel}`}>
          <div className="flex items-center gap-2 mb-2.5">
            <Filter size={14} className={label} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${label}`}>Filtros</span>
            {temFiltro && (
              <button
                onClick={limparFiltros}
                className={`ml-auto inline-flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <X size={12} /> Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <select
              className={inputCls}
              value={filtro.modulo ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, modulo: e.target.value || undefined }))}
            >
              <option className={optionCls} value="">Todos os módulos</option>
              {modulos.map((m) => (
                <option className={optionCls} key={m} value={m}>{moduloLabel(m)}</option>
              ))}
            </select>
            <select
              className={inputCls}
              value={filtro.tipo ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, tipo: e.target.value || undefined }))}
            >
              <option className={optionCls} value="">Toda ação</option>
              <option className={optionCls} value="INSERT">Criação</option>
              <option className={optionCls} value="UPDATE">Alteração</option>
              <option className={optionCls} value="DELETE">Exclusão</option>
            </select>
            <select
              className={inputCls}
              value={filtro.usuarioId ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, usuarioId: e.target.value || undefined }))}
            >
              <option className={optionCls} value="">Todos os usuários</option>
              {usuarios.map((u) => (
                <option className={optionCls} key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
            <input
              type="date"
              className={inputCls}
              value={filtro.de ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, de: e.target.value || undefined }))}
              title="De"
            />
            <input
              type="date"
              className={inputCls}
              value={filtro.ate ?? ''}
              onChange={(e) => setFiltro((f) => ({ ...f, ate: e.target.value || undefined }))}
              title="Até"
            />
            <input
              type="text"
              className={inputCls}
              placeholder="Buscar usuário/entidade…"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className={`flex items-center justify-center gap-2 py-16 text-sm ${label}`}>
            <Loader2 size={16} className="animate-spin" /> Carregando logs…
          </div>
        ) : isError ? (
          <div className={`rounded-xl border p-6 text-center text-sm ${isLight ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-rose-500/20 bg-rose-500/10 text-rose-300'}`}>
            Erro ao carregar logs: {(error as Error)?.message}
          </div>
        ) : logs.length === 0 ? (
          <div className={`rounded-xl border p-10 text-center ${panel}`}>
            <ScrollText size={28} className={`mx-auto mb-2 ${label}`} />
            <p className={`text-sm ${label}`}>Nenhum log encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <LogRow key={log.id} log={log} isLight={isLight} />
            ))}
            {hasNextPage && (
              <div ref={sentinelRef} className={`flex items-center justify-center gap-2 py-4 text-xs ${label}`}>
                <Loader2 size={14} className="animate-spin" />
                <span>Carregando mais…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
