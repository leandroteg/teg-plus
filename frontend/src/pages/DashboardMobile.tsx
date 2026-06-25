import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, RefreshCw, TrendingUp, AlertTriangle, Package,
  Clock, Zap, CalendarClock, Timer, XCircle, CalendarDays, MapPin,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useRequisicoes } from '../hooks/useRequisicoes'
import { usePedidos } from '../hooks/usePedidos'
import { useCotacoes } from '../hooks/useCotacoes'
import { useLookupObras } from '../hooks/useLookups'
import { useTheme } from '../contexts/ThemeContext'
import type { StatusRequisicao, DashboardData, Aprovacao } from '../types'
import {
  MobilePanel, MobileHeader, Segmented, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody,
} from '../components/paineis-mobile/kit'

// ── Formatadores (idênticos ao desktop Dashboard.tsx) ─────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// ── Constantes (idênticas ao desktop) ─────────────────────────────────────────
const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

const STATUS_ATIVO: StatusRequisicao[] = [
  'rascunho', 'em_triagem_cd', 'pendente', 'em_aprovacao', 'aprovada', 'em_esclarecimento',
  'em_cotacao', 'cotacao_enviada', 'cotacao_aprovada', 'pedido_emitido',
  'em_entrega', 'entregue', 'aguardando_pgto',
]

const PEDIDO_ATIVO = ['emitido', 'confirmado', 'em_entrega', 'parcialmente_recebido']
const COTACAO_ATIVA = ['pendente', 'em_andamento']

// RCs "em aberto": aguardando aprovação técnica + em cotação
const RC_ABERTAS_STATUS: StatusRequisicao[] = [
  'pendente', 'em_aprovacao', 'em_esclarecimento',
  'aprovada', 'em_cotacao', 'cotacao_enviada',
]

const NIVEL_LABEL: Record<number, string> = { 1: 'Coordenador', 2: 'Gerente', 3: 'Diretor', 4: 'CEO' }

// ── Item unificado para urgentes/vencidas (idêntico ao desktop) ───────────────
type DashItemTipo = 'rc' | 'cotacao' | 'pedido'
interface DashItem {
  id: string
  tipo: DashItemTipo
  numero: string
  descricao: string
  obra_nome?: string
  urgencia?: string
  status: string
  prazo?: string
  prazoLabel?: string
  valor?: number
  created_at: string
  navTo: string
}

// ── Seletor De/Até (mês + ano), padrão do desktop ─────────────────────────────
function ymHoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function addMeses(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const MESES_OPT: Array<[string, string]> = [
  ['01', 'Jan'], ['02', 'Fev'], ['03', 'Mar'], ['04', 'Abr'], ['05', 'Mai'], ['06', 'Jun'],
  ['07', 'Jul'], ['08', 'Ago'], ['09', 'Set'], ['10', 'Out'], ['11', 'Nov'], ['12', 'Dez'],
]
function PeriodoSelect({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [y, m] = value.split('-')
  const anoAtual = new Date().getFullYear()
  const anos: number[] = []
  for (let a = 2021; a <= anoAtual; a++) anos.push(a)
  const cls = `appearance-none rounded-lg px-2 py-1 border text-[11px] font-semibold cursor-pointer ${
    isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
  }`
  return (
    <span className="inline-flex items-center gap-1">
      <select value={m} onChange={e => onChange(`${y}-${e.target.value}`)} className={cls} aria-label="Mês">
        {MESES_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select value={y} onChange={e => onChange(`${e.target.value}-${m}`)} className={cls} aria-label="Ano">
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </span>
  )
}

// ── Linha de item urgente/vencida (RC / Cotação / Pedido) ─────────────────────
function ItemRow({ item, nav, variant }: {
  item: DashItem; nav: ReturnType<typeof useNavigate>; variant: 'urgente' | 'vencida'
}) {
  const hoje = Date.now()
  const prazoTs = item.prazo ? new Date(item.prazo).getTime() : 0
  const vencida = prazoTs > 0 && prazoTs < hoje

  const Icon = variant === 'urgente'
    ? AlertTriangle
    : (vencida ? XCircle : Timer)
  const iconTone = variant === 'urgente'
    ? (item.urgencia === 'critica' ? 'red' : 'amber')
    : (vencida ? 'red' : 'amber')

  const valueNode = item.valor != null && item.valor > 0 ? fmt(item.valor) : undefined
  const valueSub = item.prazo && variant === 'vencida'
    ? `${item.prazoLabel}: ${fmtData(item.prazo)}`
    : item.obra_nome

  return (
    <ListRow
      onClick={() => nav(item.navTo)}
      leading={<LeadingBadge tone={iconTone}><Icon size={15} /></LeadingBadge>}
      title={item.numero}
      subtitle={item.descricao}
      value={valueNode}
      valueSub={valueSub}
      valueTone={valueNode ? 'teal' : undefined}
    />
  )
}

// ── Recentes ──────────────────────────────────────────────────────────────────
function formatUserHandle(nome: string): string {
  const parts = nome?.trim().split(/\s+/) ?? []
  if (parts.length === 0) return ''
  const first = parts[0].toLowerCase()
  const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  return last ? `${first}.${last}` : first
}

// ── Dashboard Compras — versão mobile-native (MESMOS dados do desktop) ─────────
export default function DashboardMobile() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const [de, setDe] = useState(addMeses(ymHoje(), -2))
  const [ate, setAte] = useState(ymHoje())
  const [obraFilter, setObraFilter] = useState('')
  const [leadMode, setLeadMode] = useState('geral')

  const obras = useLookupObras()
  const { data, isLoading, refetch } = useDashboard('range', obraFilter || undefined, { de, ate })
  const { data: todasReqs = [] } = useRequisicoes()
  const { data: todosPedidos = [] } = usePedidos()
  const { data: todasCotacoes = [] } = useCotacoes()

  // ── Hooks/useMemo ANTES de qualquer early return ───
  const kpis = data?.kpis ?? EMPTY_KPIS
  const aprovacoes_pendentes = data?.aprovacoes_pendentes ?? []
  const reqs = todasReqs.length > 0 ? todasReqs : (data?.requisicoes_recentes ?? [])
  const hoje = Date.now()
  const tresDias = 3 * 24 * 3600_000

  // Pedidos emitidos (toda linha em cmp_pedidos já foi emitida; exclui cancelados)
  const pedidosEmitidos = useMemo(() =>
    todosPedidos.filter(p => p.status !== 'cancelado').length,
    [todosPedidos]
  )

  // RCs em aberto no período: aguardando aprovação técnica + cotação
  const rcsEmAberto = useMemo(() =>
    (data?.por_status ?? [])
      .filter(s => (RC_ABERTAS_STATUS as string[]).includes(s.status))
      .reduce((sum, s) => sum + (s.total ?? 0), 0),
    [data]
  )

  // Lead time de atendimento (em dias), no período/obra selecionados
  const leadStats = useMemo(() => {
    const [dy, dm] = de.split('-').map(Number)
    const [ay, am] = ate.split('-').map(Number)
    const ini = new Date(dy, dm - 1, 1, 0, 0, 0).getTime()
    const fim = new Date(ay, am, 0, 23, 59, 59).getTime()
    const DAY = 86400_000
    const entregaPorReq = new Map<string, number>()
    for (const p of todosPedidos as unknown as Array<Record<string, unknown>>) {
      const reqId = p.requisicao_id as string | undefined
      const dEnt = p.data_entrega_real as string | undefined
      if (!reqId || !dEnt) continue
      const t = new Date(`${String(dEnt).slice(0, 10)}T23:59:59`).getTime()
      const prev = entregaPorReq.get(reqId)
      if (prev === undefined || t > prev) entregaPorReq.set(reqId, t)
    }
    const FECHADO = new Set(['rascunho', 'cancelada', 'rejeitada'])
    let entSum = 0, entN = 0, gSum = 0, gN = 0
    for (const r of todasReqs as unknown as Array<Record<string, unknown>>) {
      const cr = r.created_at as string | undefined
      if (!cr) continue
      const crc = new Date(cr).getTime()
      if (crc < ini || crc > fim) continue
      if (obraFilter && r.obra_id !== obraFilter) continue
      const entrega = entregaPorReq.get(r.id as string)
      if (entrega !== undefined) {
        const dias = Math.max(0, (entrega - crc) / DAY)
        entSum += dias; entN++; gSum += dias; gN++
      } else if (!FECHADO.has(r.status as string)) {
        const dias = Math.max(0, (hoje - crc) / DAY)
        gSum += dias; gN++
      }
    }
    return { entregues: entN ? entSum / entN : null, geral: gN ? gSum / gN : null }
  }, [todasReqs, todosPedidos, de, ate, obraFilter, hoje])

  // ── Converter tudo para DashItem (sem duplicar fluxo) ───
  const allItems = useMemo(() => {
    const items: DashItem[] = []

    const reqComPedido = new Set<string>()
    todosPedidos.forEach(p => {
      if (PEDIDO_ATIVO.includes(p.status) && p.requisicao_id) reqComPedido.add(p.requisicao_id)
    })

    const reqComCotacao = new Set<string>()
    todasCotacoes.forEach(c => {
      if (COTACAO_ATIVA.includes(c.status) && c.requisicao_id) reqComCotacao.add(c.requisicao_id)
    })

    // RCs — só se NÃO tem cotação nem pedido ativo
    reqs.forEach(r => {
      if (!STATUS_ATIVO.includes(r.status)) return
      if (reqComPedido.has(r.id) || reqComCotacao.has(r.id)) return
      items.push({
        id: r.id, tipo: 'rc', numero: r.numero,
        descricao: (r as any).justificativa || r.descricao,
        obra_nome: r.obra_nome, urgencia: r.urgencia, status: r.status,
        prazo: (r as any).data_necessidade || undefined,
        prazoLabel: 'Necessidade', valor: r.valor_estimado,
        created_at: r.created_at, navTo: `/requisicoes/${r.id}`,
      })
    })

    // Cotações — só se NÃO tem pedido ativo
    todasCotacoes.forEach(c => {
      if (!COTACAO_ATIVA.includes(c.status)) return
      if (reqComPedido.has(c.requisicao_id)) return
      const req = c.requisicao as any
      items.push({
        id: c.id, tipo: 'cotacao',
        numero: req?.numero ? `${req.numero}/COT` : `COT-${c.id.slice(0, 6)}`,
        descricao: req?.justificativa || req?.descricao || 'Cotacao em andamento',
        obra_nome: req?.obra_nome, urgencia: req?.urgencia, status: c.status,
        prazo: c.data_limite || undefined,
        prazoLabel: 'Limite', valor: c.valor_selecionado ?? undefined,
        created_at: c.created_at, navTo: `/cotacoes/${c.requisicao_id}`,
      })
    })

    // Pedidos — sempre aparecem (estágio mais avançado)
    todosPedidos.forEach(p => {
      if (!PEDIDO_ATIVO.includes(p.status)) return
      const req = p.requisicao as any
      items.push({
        id: p.id, tipo: 'pedido',
        numero: p.numero_pedido || `PED-${p.id.slice(0, 6)}`,
        descricao: req?.justificativa || req?.descricao || p.fornecedor_nome,
        obra_nome: req?.obra_nome, urgencia: req?.urgencia, status: p.status,
        prazo: p.data_prevista_entrega || undefined,
        prazoLabel: 'Entrega', valor: p.valor_total ?? undefined,
        created_at: p.created_at, navTo: `/pedidos`,
      })
    })

    return items
  }, [reqs, todasCotacoes, todosPedidos])

  // ── Urgentes (RCs urgentes/criticas + pedidos em atraso) ───
  const urgentes = useMemo(() =>
    allItems
      .filter(item => {
        if (item.urgencia === 'urgente' || item.urgencia === 'critica') return true
        if (item.tipo === 'pedido' && item.prazo) {
          return new Date(item.prazo).getTime() < hoje
        }
        return false
      })
      .sort((a, b) => {
        if (a.urgencia === 'critica' && b.urgencia !== 'critica') return -1
        if (b.urgencia === 'critica' && a.urgencia !== 'critica') return 1
        const aPrazo = a.prazo ? new Date(a.prazo).getTime() : Infinity
        const bPrazo = b.prazo ? new Date(b.prazo).getTime() : Infinity
        return aPrazo - bPrazo
      }),
    [allItems, hoje]
  )

  // ── Vencidas/À vencer (todos com prazo <= hoje + 3 dias) ───
  const vencidasAVencer = useMemo(() =>
    allItems
      .filter(item => {
        if (!item.prazo) return false
        const ts = new Date(item.prazo).getTime()
        return ts <= hoje + tresDias
      })
      .sort((a, b) => {
        const tsA = new Date(a.prazo!).getTime()
        const tsB = new Date(b.prazo!).getTime()
        return tsA - tsB
      }),
    [allItems, hoje]
  )

  // ── Contagens por prazo para o Pulso ───
  const prazoCounts = useMemo(() => {
    let noPrazo = 0, aVencer = 0, vencido = 0
    allItems.forEach(item => {
      if (!item.prazo) { noPrazo++; return }
      const ts = new Date(item.prazo).getTime()
      if (ts < hoje) vencido++
      else if (ts <= hoje + tresDias) aVencer++
      else noPrazo++
    })
    return { noPrazo, aVencer, vencido }
  }, [allItems, hoje])

  // ── Pedidos por Obra ───
  const pedidosPorObra = useMemo(() => {
    const obraMap = new Map<string, { nome: string; valor: number; qtd: number }>()
    todosPedidos.forEach(p => {
      if (p.status === 'cancelado') return
      const nome = (p.requisicao as any)?.obra_nome || 'Sem obra'
      const cur = obraMap.get(nome) || { nome, valor: 0, qtd: 0 }
      cur.valor += p.valor_total ?? 0
      cur.qtd += 1
      obraMap.set(nome, cur)
    })
    return Array.from(obraMap.values()).sort((a, b) => b.valor - a.valor)
  }, [todosPedidos])

  if (isLoading) return <MobileLoading />

  const aprovacaoMap = new Map<string, Aprovacao>(
    aprovacoes_pendentes.map(a => [a.requisicao_id, a])
  )

  const recentes = reqs.slice(0, 8)

  // Lead time exibido conforme o toggle
  const leadVal = leadMode === 'entregues' ? leadStats.entregues : leadStats.geral
  const leadStr = leadVal == null ? '—' : leadVal >= 1 ? `${leadVal.toFixed(1)}d` : `${Math.round(leadVal * 24)}h`

  const prazoTotal = prazoCounts.noPrazo + prazoCounts.aVencer + prazoCounts.vencido
  const maxObra = pedidosPorObra[0]?.valor || 1

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel - Compras"
        subtitle="Requisições, cotações e pedidos"
        icon={ShoppingCart}
        tone="teal"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-teal-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Filtros: Lead mode + período De/Até + obra */}
      <div className="space-y-2.5">
        <Segmented
          value={leadMode}
          onChange={setLeadMode}
          options={[{ value: 'entregues', label: 'Entregues' }, { value: 'geral', label: '+ Em aberto' }]}
          tone="emerald"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <CalendarDays size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <PeriodoSelect value={de} onChange={v => { setDe(v); if (v > ate) setAte(v) }} isDark={isDark} />
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>→</span>
          <PeriodoSelect value={ate} onChange={v => { setAte(v); if (v < de) setDe(v) }} isDark={isDark} />
        </div>
        <div className="relative flex items-center">
          <MapPin size={12} className={`absolute left-2.5 pointer-events-none z-10 ${obraFilter ? 'text-teal-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <select
            value={obraFilter}
            onChange={e => setObraFilter(e.target.value)}
            className={`w-full text-[12px] font-semibold rounded-xl pl-8 pr-3 py-2 border transition-all appearance-none cursor-pointer truncate ${
              obraFilter
                ? 'bg-teal-50 border-teal-300 text-teal-700'
                : isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <option value="">Todas obras</option>
            {obras.map(o => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Núcleo de Compras — indicadores do período */}
      <KpiGrid cols={3}>
        <StatTile label="Pedidos Emit." value={pedidosEmitidos} icon={ShoppingCart} tone="teal" note="emitidos" />
        <StatTile label="RCs em Aberto" value={rcsEmAberto} icon={Clock} tone="sky" note="aprov + cotação" />
        <StatTile label="Lead Time" value={leadStr} icon={Timer} tone={leadVal != null && leadVal > 7 ? 'amber' : 'emerald'} note={leadMode === 'entregues' ? 'entrega − RC' : 'inclui abertos'} />
      </KpiGrid>

      {/* Janela Crítica — o que exige ação agora */}
      <KpiGrid>
        <KpiCard
          label="Urgentes"
          value={urgentes.length}
          tone={urgentes.length > 0 ? 'red' : 'slate'}
          icon={Zap}
          note={urgentes.length > 0 ? 'RCs + pedidos atrasados' : 'tudo ok'}
        />
        <KpiCard
          label="Vencidas / A Vencer"
          value={vencidasAVencer.length}
          tone={vencidasAVencer.length > 0 ? 'amber' : 'slate'}
          icon={CalendarClock}
          note="RCs + cotações + pedidos"
        />
      </KpiGrid>

      {/* Pulso por Prazo */}
      <Section title="Pulso por Prazo" icon={TrendingUp} tone="teal">
        <SectionBody>
          {prazoTotal === 0 ? (
            <Empty>Nenhum item ativo no período</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {prazoCounts.noPrazo > 0 && (
                  <div className="bg-emerald-500 flex items-center justify-center" style={{ width: `${Math.max((prazoCounts.noPrazo / prazoTotal) * 100, 4)}%` }}>
                    {(prazoCounts.noPrazo / prazoTotal) >= 0.16 && <span className="text-[10px] font-bold text-white">{prazoCounts.noPrazo}</span>}
                  </div>
                )}
                {prazoCounts.aVencer > 0 && (
                  <div className="bg-amber-400 flex items-center justify-center" style={{ width: `${Math.max((prazoCounts.aVencer / prazoTotal) * 100, 4)}%` }}>
                    {(prazoCounts.aVencer / prazoTotal) >= 0.16 && <span className="text-[10px] font-bold text-white">{prazoCounts.aVencer}</span>}
                  </div>
                )}
                {prazoCounts.vencido > 0 && (
                  <div className="bg-red-500 flex items-center justify-center" style={{ width: `${Math.max((prazoCounts.vencido / prazoTotal) * 100, 4)}%` }}>
                    {(prazoCounts.vencido / prazoTotal) >= 0.16 && <span className="text-[10px] font-bold text-white">{prazoCounts.vencido}</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-emerald-500" /> No prazo · {prazoCounts.noPrazo}</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400" /> A vencer · {prazoCounts.aVencer}</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500" /> Vencido · {prazoCounts.vencido}</span>
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Urgentes */}
      <Section title="Urgentes" icon={Zap} tone="red" action={{ label: 'Ver todas', onClick: () => nav('/requisicoes') }}>
        {urgentes.length === 0 ? (
          <Empty icon={Zap}>Nenhum item urgente</Empty>
        ) : (
          <RowList>
            {urgentes.slice(0, 6).map(item => (
              <ItemRow key={`${item.tipo}-${item.id}`} item={item} nav={nav} variant="urgente" />
            ))}
          </RowList>
        )}
      </Section>

      {/* Vencidas / A vencer */}
      <Section title="Vencidas / A vencer" icon={CalendarClock} tone="amber" action={{ label: 'Ver todas', onClick: () => nav('/requisicoes') }}>
        {vencidasAVencer.length === 0 ? (
          <Empty icon={CalendarClock}>Nenhum item vencido ou próximo do prazo</Empty>
        ) : (
          <RowList>
            {vencidasAVencer.slice(0, 6).map(item => (
              <ItemRow key={`${item.tipo}-${item.id}`} item={item} nav={nav} variant="vencida" />
            ))}
          </RowList>
        )}
      </Section>

      {/* Recentes */}
      <Section title="Recentes" icon={Clock} tone="slate" action={{ label: 'Ver todas', onClick: () => nav('/requisicoes') }}>
        {recentes.length === 0 ? (
          <Empty icon={Clock}>Nenhuma requisição encontrada</Empty>
        ) : (
          <RowList>
            {recentes.slice(0, 8).map(r => {
              const aprovacao = aprovacaoMap.get(r.id)
              const handle = r.solicitante_nome ? formatUserHandle(r.solicitante_nome) : null
              const isUrgente = r.urgencia === 'urgente' || r.urgencia === 'critica'
              const subtitle = aprovacao
                ? `Aguardando ${aprovacao.aprovador_nome}${aprovacao.nivel ? ` (${NIVEL_LABEL[aprovacao.nivel] ?? `Nível ${aprovacao.nivel}`})` : ''}`
                : (handle ? `${handle} · ${(r as any).justificativa || r.descricao}` : ((r as any).justificativa || r.descricao))
              return (
                <ListRow
                  key={r.id}
                  onClick={() => nav(`/requisicoes/${r.id}`)}
                  leading={<LeadingBadge tone={isUrgente ? (r.urgencia === 'critica' ? 'red' : 'amber') : 'slate'}>{r.numero?.slice(-2) || '—'}</LeadingBadge>}
                  title={(r as any).justificativa || r.descricao}
                  subtitle={subtitle}
                  value={r.valor_estimado != null ? fmt(r.valor_estimado) : '—'}
                  valueSub={r.obra_nome}
                  valueTone="teal"
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Pedidos por Obra */}
      <Section title="Pedidos por Obra" icon={Package} tone="teal">
        <SectionBody className="space-y-2.5">
          {pedidosPorObra.length === 0 ? (
            <Empty icon={Package}>Nenhum pedido</Empty>
          ) : pedidosPorObra.map(o => (
            <BarStat key={o.nome} label={o.nome} value={fmt(o.valor)} pct={(o.valor / maxObra) * 100} tone="teal" />
          ))}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
