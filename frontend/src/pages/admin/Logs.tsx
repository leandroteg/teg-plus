// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/Logs.tsx
// Central de Logs (auditoria de negócio). Lista quem fez o quê, quando e o que
// mudou, lendo sys_log_atividades (populada por triggers no Postgres).
// Acesso restrito a admin via <AdminRoute> no App.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ScrollText, Loader2, Filter, ChevronDown, ChevronRight,
  PlusCircle, PencilLine, Trash2, Cpu, X, Search, ArrowRight,
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

const TIPO_META: Record<string, { label: string; verbo: string; icon: typeof PlusCircle; tone: string }> = {
  INSERT: { label: 'Criação', verbo: 'criou', icon: PlusCircle, tone: 'emerald' },
  UPDATE: { label: 'Alteração', verbo: 'alterou', icon: PencilLine, tone: 'amber' },
  DELETE: { label: 'Exclusão', verbo: 'excluiu', icon: Trash2, tone: 'rose' },
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

/** Nome de campo legível: 'valor_total' → 'Valor total' */
function campoLabel(campo: string): string {
  const s = campo.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Iniciais para o avatar: 'João da Silva' → 'JS' (ignora conectivos curtos) */
function iniciais(nome: string | null): string {
  if (!nome) return '?'
  const todas = nome.trim().split(/\s+/).filter(Boolean)
  const significativas = todas.filter((p) => p.length > 2)
  const base = significativas.length ? significativas : todas
  const a = base[0]?.[0] ?? ''
  const b = base.length > 1 ? base[base.length - 1][0] : ''
  return (a + b).toUpperCase() || '?'
}

/** Cor estável derivada do nome, para o avatar. */
const AVATAR_TONES = ['violet', 'sky', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'teal'] as const
function avatarTone(nome: string | null): (typeof AVATAR_TONES)[number] {
  if (!nome) return 'violet'
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) & 0xffff
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

function fmtDataHoraCompleta(ts: string): string {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtHora(ts: string): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Tempo relativo em pt-BR: 'agora', 'há 5 min', 'há 3 h', 'há 2 dias'. */
function tempoRelativo(ts: string, agora: number): string {
  const diff = Math.max(0, agora - new Date(ts).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'agora mesmo'
  const min = Math.floor(s / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  const mes = Math.floor(d / 30)
  if (mes < 12) return `há ${mes} ${mes === 1 ? 'mês' : 'meses'}`
  const ano = Math.floor(d / 365)
  return `há ${ano} ${ano === 1 ? 'ano' : 'anos'}`
}

/** Rótulo do grupo de dia: 'Hoje', 'Ontem' ou data por extenso. */
function rotuloDia(ts: string): string {
  const d = new Date(ts)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, hoje)) return 'Hoje'
  if (sameDay(d, ontem)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

/** Formata um valor do diff para exibição. */
function fmtValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.length > 160 ? `${s.slice(0, 160)}…` : s
}

// ── Detalhe do diff (campos alterados / snapshot) ─────────────────────────────

function LogDetalhe({ log, isLight }: { log: LogAtividade; isLight: boolean }) {
  const dados = log.dados
  const keyCls = isLight ? 'text-slate-600' : 'text-slate-300'
  const subCls = isLight ? 'text-slate-400' : 'text-slate-500'
  const oldWrap = isLight ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
  const newWrap = isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  const valWrap = isLight ? 'bg-slate-50 text-slate-700 border-slate-100' : 'bg-white/[0.04] text-slate-200 border-white/[0.06]'

  if (!dados) {
    return <p className={`text-xs ${subCls}`}>Sem detalhes registrados.</p>
  }

  // UPDATE: mostra apenas os campos que mudaram, com antes → depois
  if (log.tipo === 'UPDATE' && dados.campos_alterados?.length) {
    return (
      <div className="space-y-2.5">
        {dados.campos_alterados.map((campo) => (
          <div key={campo} className="flex flex-col gap-1">
            <span className={`text-[11px] font-semibold ${keyCls}`}>{campoLabel(campo)}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-mono break-all px-2 py-0.5 rounded-md border ${oldWrap}`}>
                {fmtValor(dados.old?.[campo])}
              </span>
              <ArrowRight size={12} className={subCls} />
              <span className={`text-[11px] font-mono break-all px-2 py-0.5 rounded-md border ${newWrap}`}>
                {fmtValor(dados.new?.[campo])}
              </span>
            </div>
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
  if (!entradas.length) return <p className={`text-xs ${subCls}`}>Sem detalhes registrados.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-80 overflow-y-auto styled-scrollbar pr-1">
      {entradas.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 min-w-0">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${subCls}`}>{campoLabel(k)}</span>
          <span className={`text-[11px] font-mono break-all px-2 py-0.5 rounded-md border ${valWrap}`}>{fmtValor(v)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Linha da lista ────────────────────────────────────────────────────────────

const TONE_AVATAR: Record<string, { light: string; dark: string }> = {
  violet: { light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-500/20 text-violet-300' },
  sky: { light: 'bg-sky-100 text-sky-700', dark: 'bg-sky-500/20 text-sky-300' },
  emerald: { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/20 text-emerald-300' },
  amber: { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-500/20 text-amber-300' },
  rose: { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-500/20 text-rose-300' },
  cyan: { light: 'bg-cyan-100 text-cyan-700', dark: 'bg-cyan-500/20 text-cyan-300' },
  indigo: { light: 'bg-indigo-100 text-indigo-700', dark: 'bg-indigo-500/20 text-indigo-300' },
  teal: { light: 'bg-teal-100 text-teal-700', dark: 'bg-teal-500/20 text-teal-300' },
}

function LogRow({ log, isLight, agora }: { log: LogAtividade; isLight: boolean; agora: number }) {
  const [aberto, setAberto] = useState(false)
  const tipoStr = String(log.tipo ?? '')
  const meta = TIPO_META[tipoStr] ?? { label: tipoStr || '—', verbo: tipoStr.toLowerCase() || 'alterou', icon: PencilLine, tone: 'slate' }
  const Icon = meta.icon
  const isSistema = log.dados?.origem === 'sistema'
  const nQtd = log.tipo === 'UPDATE' ? log.dados?.campos_alterados?.length ?? 0 : 0

  const toneBadge: Record<string, string> = {
    emerald: isLight ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/20',
    amber: isLight ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-amber-500/15 text-amber-300 ring-amber-500/20',
    rose: isLight ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-rose-500/15 text-rose-300 ring-rose-500/20',
    slate: isLight ? 'bg-slate-100 text-slate-600 ring-slate-200' : 'bg-white/10 text-slate-300 ring-white/10',
  }
  const card = isLight
    ? 'bg-white border-slate-200 hover:border-slate-300'
    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
  const sub = isLight ? 'text-slate-500' : 'text-slate-400'
  const txt = isLight ? 'text-slate-800' : 'text-slate-100'
  const tone = isSistema ? null : avatarTone(log.usuario_nome)
  const avatarCls = tone
    ? (isLight ? TONE_AVATAR[tone].light : TONE_AVATAR[tone].dark)
    : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400')

  return (
    <div className={`rounded-xl border transition-colors ${card}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        {/* Avatar do autor */}
        <span className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold ${avatarCls}`}>
          {isSistema ? <Cpu size={16} /> : iniciais(log.usuario_nome)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
            <span className={`text-[13px] font-semibold ${txt}`}>
              {isSistema ? 'Sistema' : (log.usuario_nome || 'Desconhecido')}
            </span>
            <span className={`text-[12px] ${sub}`}>{meta.verbo}</span>
            <span className={`text-[12px] font-medium ${txt}`}>{entidadeLabel(log.entidade_tipo)}</span>
            {nQtd > 0 && (
              <span className={`text-[11px] ${sub}`}>· {nQtd} {nQtd === 1 ? 'campo' : 'campos'}</span>
            )}
          </div>
          <div className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${sub}`}>
            <span
              className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'}`}
            >
              {moduloLabel(log.modulo)}
            </span>
            <span title={fmtDataHoraCompleta(log.created_at)}>{tempoRelativo(log.created_at, agora)}</span>
          </div>
        </div>

        {/* Badge do tipo de ação */}
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ring-1 ${toneBadge[meta.tone]}`}>
          <Icon size={11} /> {meta.label}
        </span>

        {aberto
          ? <ChevronDown size={16} className={`shrink-0 ${sub}`} />
          : <ChevronRight size={16} className={`shrink-0 ${sub}`} />}
      </button>
      {aberto && (
        <div className={`px-3 pb-3 pt-2.5 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-wide ${sub}`}>
            {log.tipo === 'UPDATE' ? 'Campos alterados' : log.tipo === 'DELETE' ? 'Registro excluído' : 'Registro criado'}
            <span className="opacity-60">· {fmtHora(log.created_at)}</span>
          </div>
          <LogDetalhe log={log} isLight={isLight} />
        </div>
      )}
    </div>
  )
}

// ── Card de estatística ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, valor, tone, isLight,
}: {
  icon: typeof PlusCircle; label: string; valor: string; tone: string; isLight: boolean
}) {
  const toneCls: Record<string, string> = {
    violet: isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/15 text-violet-300',
    emerald: isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300',
    amber: isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-300',
    rose: isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/15 text-rose-300',
  }
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'
  const label2 = isLight ? 'text-slate-500' : 'text-slate-400'
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${panel}`}>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls[tone]}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <div className={`text-lg font-bold leading-none ${heading}`}>{valor}</div>
        <div className={`text-[11px] mt-1 ${label2}`}>{label}</div>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function Logs() {
  const { isLightSidebar: isLight } = useTheme()
  const [filtro, setFiltro] = useState<LogsFiltro>({})
  const [buscaInput, setBuscaInput] = useState('')

  // "agora" atualizado a cada 60s para manter os tempos relativos frescos
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

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

  // Estatísticas rápidas sobre o que já foi carregado.
  const stats = useMemo(() => {
    const startHoje = new Date()
    startHoje.setHours(0, 0, 0, 0)
    const hojeMs = startHoje.getTime()
    let hoje = 0, criacoes = 0, alteracoes = 0, exclusoes = 0
    for (const l of logs) {
      if (new Date(l.created_at).getTime() >= hojeMs) hoje++
      if (l.tipo === 'INSERT') criacoes++
      else if (l.tipo === 'UPDATE') alteracoes++
      else if (l.tipo === 'DELETE') exclusoes++
    }
    return { hoje, criacoes, alteracoes, exclusoes }
  }, [logs])

  // Agrupa os logs por dia (Hoje / Ontem / data), preservando a ordem.
  const grupos = useMemo(() => {
    const out: { rotulo: string; itens: LogAtividade[] }[] = []
    let atual: { rotulo: string; itens: LogAtividade[] } | null = null
    for (const l of logs) {
      const r = rotuloDia(l.created_at)
      if (!atual || atual.rotulo !== r) {
        atual = { rotulo: r, itens: [] }
        out.push(atual)
      }
      atual.itens.push(l)
    }
    return out
  }, [logs])

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
    // preserva o toggle de ações do sistema — é preferência de exibição, não filtro
    setFiltro((f) => ({ mostrarSistema: f.mostrarSistema }))
    setBuscaInput('')
  }

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
    <div className="max-w-5xl mx-auto">
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

        {/* Estatísticas (sobre o que já foi carregado) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
          <StatCard icon={ScrollText} label="Eventos carregados" valor={String(logs.length)} tone="violet" isLight={isLight} />
          <StatCard icon={PlusCircle} label="Criações" valor={String(stats.criacoes)} tone="emerald" isLight={isLight} />
          <StatCard icon={PencilLine} label="Alterações" valor={String(stats.alteracoes)} tone="amber" isLight={isLight} />
          <StatCard icon={Trash2} label="Exclusões" valor={String(stats.exclusoes)} tone="rose" isLight={isLight} />
        </div>

        {/* Filtros */}
        <div className={`rounded-2xl border p-3 mb-4 ${panel}`}>
          {/* Busca em destaque */}
          <div className="relative mb-2.5">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${label}`} />
            <input
              type="text"
              className={`w-full rounded-lg border pl-9 pr-3 py-2 text-[13px] outline-none transition-colors ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 focus:border-slate-400'
                  : 'bg-white/[0.03] border-white/10 text-slate-200 focus:border-white/25'
              }`}
              placeholder="Buscar por usuário ou entidade…"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <Filter size={14} className={label} />
            <span className={`text-[11px] font-bold uppercase tracking-wider ${label}`}>Filtros</span>
            {/* Toggle: ações automáticas do sistema (ocultas por padrão) */}
            <button
              type="button"
              onClick={() => setFiltro((f) => ({ ...f, mostrarSistema: !f.mostrarSistema }))}
              title="Exibir também as alterações automáticas feitas pelo sistema (integrações, rotinas)"
              className={`ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                filtro.mostrarSistema
                  ? (isLight ? 'text-violet-600' : 'text-violet-300')
                  : (isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200')
              }`}
            >
              <Cpu size={12} /> Ações do sistema
              <span
                className={`relative h-3.5 w-6 rounded-full transition-colors ${
                  filtro.mostrarSistema
                    ? 'bg-violet-500'
                    : (isLight ? 'bg-slate-300' : 'bg-white/15')
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                    filtro.mostrarSistema ? 'translate-x-2.5' : ''
                  }`}
                />
              </span>
            </button>
            {temFiltro && (
              <button
                onClick={limparFiltros}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <X size={12} /> Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
          <div className="space-y-5">
            {grupos.map((grupo) => (
              <div key={grupo.rotulo}>
                {/* Cabeçalho do dia (sticky) */}
                <div className={`sticky top-0 z-10 -mx-1 px-1 py-1.5 mb-2 flex items-center gap-2 backdrop-blur ${isLight ? 'bg-slate-50/80' : 'bg-[#0c1222]/80'}`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${label}`}>
                    {grupo.rotulo}
                  </span>
                  <span className={`text-[11px] ${label} opacity-70`}>· {grupo.itens.length}</span>
                  <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-white/[0.06]'}`} />
                </div>
                <div className="space-y-2">
                  {grupo.itens.map((log) => (
                    <LogRow key={log.id} log={log} isLight={isLight} agora={agora} />
                  ))}
                </div>
              </div>
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
  )
}
