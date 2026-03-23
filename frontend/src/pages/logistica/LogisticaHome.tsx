import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Truck,
  AlertTriangle,
  FileText,
  RefreshCw,
  ArrowRight,
  Clock,
  Route,
  CalendarClock,
} from 'lucide-react'
import { useLogisticaKPIs, useSolicitacoes, useTransportes } from '../../hooks/useLogistica'
import { useTheme } from '../../contexts/ThemeContext'
import type { LogisticaKPIs, LogSolicitacao } from '../../types/logistica'

const EMPTY_KPIS: LogisticaKPIs = {
  total_solicitacoes: 0,
  abertas: 0,
  em_transito: 0,
  entregues_hoje: 0,
  confirmadas_hoje: 0,
  urgentes_pendentes: 0,
  nfe_emitidas_mes: 0,
  custo_total_mes: 0,
  taxa_entrega_prazo: 0,
  taxa_avarias: 0,
  tempo_medio_confirmacao_h: 0,
}

const STATUS_LABEL: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  solicitado: { label: 'Solicitado', dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' },
  planejado: { label: 'Planejado', dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  aguardando_aprovacao: { label: 'Aguard. aprov.', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  aprovado: { label: 'Aprovado', dot: 'bg-indigo-400', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  romaneio_emitido: { label: 'Romaneio', dot: 'bg-teal-400', bg: 'bg-teal-50', text: 'text-teal-700' },
  nfe_emitida: { label: 'NF-e emitida', dot: 'bg-violet-400', bg: 'bg-violet-50', text: 'text-violet-700' },
  transporte_pendente: { label: 'Transp. pendente', dot: 'bg-slate-500', bg: 'bg-slate-100', text: 'text-slate-700' },
  aguardando_coleta: { label: 'Aguard. coleta', dot: 'bg-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  em_transito: { label: 'Em transito', dot: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
  entregue: { label: 'Entregue', dot: 'bg-teal-400', bg: 'bg-teal-50', text: 'text-teal-700' },
  concluido: { label: 'Concluido', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  recusado: { label: 'Recusado', dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700' },
  cancelado: { label: 'Cancelado', dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-500' },
}

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem',
  mobilizacao: 'Mobilizacao',
  transferencia_maquina: 'Transf. maquina',
}

const OPERATIONAL_STATUSES = ['planejado', 'aprovado', 'nfe_emitida', 'transporte_pendente', 'aguardando_coleta', 'em_transito'] as const

function parseDate(value?: string) {
  if (!value) return 0
  const iso = value.includes('T') ? value : `${value}T00:00:00`
  const time = new Date(iso).getTime()
  return Number.isNaN(time) ? 0 : time
}

function fmtDate(value?: string, withTime = false) {
  if (!value) return 'Sem agenda'
  const iso = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Sem agenda'
  return withTime
    ? date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtKm(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: value >= 100 ? 0 : 1 })
}

function fmtCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function toneClasses(
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'orange' | 'blue' | 'violet' | 'red' | 'slate'
) {
  const map = {
    sky: { text: 'text-sky-600', soft: 'bg-sky-50 text-sky-700 border-sky-100', icon: 'bg-sky-50 text-sky-500' },
    emerald: { text: 'text-emerald-600', soft: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-500' },
    cyan: { text: 'text-cyan-600', soft: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'bg-cyan-50 text-cyan-500' },
    amber: { text: 'text-amber-600', soft: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'bg-amber-50 text-amber-500' },
    teal: { text: 'text-teal-600', soft: 'bg-teal-50 text-teal-700 border-teal-100', icon: 'bg-teal-50 text-teal-500' },
    orange: { text: 'text-orange-600', soft: 'bg-orange-50 text-orange-700 border-orange-100', icon: 'bg-orange-50 text-orange-500' },
    blue: { text: 'text-blue-600', soft: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'bg-blue-50 text-blue-500' },
    violet: { text: 'text-violet-600', soft: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'bg-violet-50 text-violet-500' },
    red: { text: 'text-red-600', soft: 'bg-red-50 text-red-700 border-red-100', icon: 'bg-red-50 text-red-500' },
    slate: { text: 'text-slate-500', soft: 'bg-slate-50 text-slate-600 border-slate-100', icon: 'bg-slate-50 text-slate-400' },
  } as const

  return map[tone]
}

export function StatusBadge({ status }: { status: string }) {
  const { isDark } = useTheme()
  const c = STATUS_LABEL[status] ?? { label: status, dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600' }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${isDark ? 'bg-white/10 text-slate-200' : `${c.bg} ${c.text}`}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default function LogisticaHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useLogisticaKPIs()
  const { data: urgentes = [] } = useSolicitacoes({
    urgente: true,
    status: ['solicitado', 'planejado', 'aguardando_aprovacao'],
  })
  const { data: operacionais = [] } = useSolicitacoes({ status: [...OPERATIONAL_STATUSES] })
  const { data: aguardandoColeta = [] } = useSolicitacoes({ status: ['nfe_emitida', 'transporte_pendente', 'aguardando_coleta'] })
  const { data: transportesAtivos = [] } = useTransportes()

  const operationalView = useMemo(() => {
    const routeMap = new Map<string, { label: string; km: number; solicitacoes: number; sample: LogSolicitacao; viagemId?: string }>()
    const countedTrips = new Set<string>()
    let kmProgramados = 0

    for (const sol of operacionais) {
      const tripKey = sol.viagem_id ? `viagem:${sol.viagem_id}` : null
      const routeKey =
        tripKey ?? (sol.rota_planejada?.id ? `rota:${sol.rota_planejada.id}` : `trecho:${sol.origem}:${sol.destino}`)
      const routeLabel = tripKey
        ? `${sol.viagem?.numero ?? 'Viagem'} · ${sol.viagem?.origem_principal ?? sol.origem} -> ${sol.viagem?.destino_final ?? sol.destino}`
        : sol.rota_planejada?.nome ?? `${sol.origem} -> ${sol.destino}`
      const routeKm = sol.viagem?.distancia_total_km ?? sol.rota_planejada?.distancia_km ?? sol.distancia_km ?? 0

      if (tripKey) {
        if (!countedTrips.has(tripKey)) {
          kmProgramados += routeKm
          countedTrips.add(tripKey)
        }
      } else {
        kmProgramados += routeKm
      }

      const current = routeMap.get(routeKey) ?? { label: routeLabel, km: routeKm, solicitacoes: 0, sample: sol, viagemId: sol.viagem_id }
      current.solicitacoes += 1
      current.km = current.km || routeKm
      current.sample = current.sample ?? sol
      current.viagemId = current.viagemId ?? sol.viagem_id
      routeMap.set(routeKey, current)
    }

    const proximasColetas = [...aguardandoColeta]
      .sort((a, b) => parseDate(a.data_prevista_saida ?? a.data_desejada) - parseDate(b.data_prevista_saida ?? b.data_desejada))
      .slice(0, 4)

    const now = Date.now()
    const coletasAtrasadas = aguardandoColeta.filter(sol => {
      const agenda = parseDate(sol.data_prevista_saida ?? sol.data_desejada)
      return agenda > 0 && agenda < now
    }).length

    const viagensEmExecucao = new Set(
      transportesAtivos.map(t => t.viagem_id).filter((value): value is string => Boolean(value))
    ).size

    const ocorrenciasAbertas = transportesAtivos.reduce(
      (total, transporte) => total + (transporte.ocorrencias?.filter(oc => !oc.resolvido).length ?? 0),
      0
    )

    const topRotas = [...routeMap.values()]
      .sort((a, b) => b.km - a.km || b.solicitacoes - a.solicitacoes)
      .slice(0, 4)

    return {
      kmProgramados,
      rotasAtivas: routeMap.size,
      proximasColetas,
      coletasAtrasadas,
      viagensEmExecucao,
      ocorrenciasAbertas,
      topRotas,
    }
  }, [aguardandoColeta, operacionais, transportesAtivos])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const aguardandoConfirmacao = Math.max(0, kpis.entregues_hoje - kpis.confirmadas_hoje)
  const statusSegments = [
    { key: 'abertas', label: 'Abertas', value: kpis.abertas, barClass: 'bg-orange-500', tone: 'orange' as const },
    { key: 'em_transito', label: 'Em transito', value: kpis.em_transito, barClass: 'bg-blue-500', tone: 'blue' as const },
    {
      key: 'urgentes',
      label: 'Urgentes',
      value: kpis.urgentes_pendentes,
      barClass: kpis.urgentes_pendentes > 0 ? 'bg-red-500' : 'bg-slate-400',
      tone: (kpis.urgentes_pendentes > 0 ? 'red' : 'slate') as const,
    },
    { key: 'nfe', label: 'NF-e emitidas', value: kpis.nfe_emitidas_mes, barClass: 'bg-violet-500', tone: 'violet' as const },
  ].filter(segment => segment.value > 0)

  const buildSolicitacaoDeepLink = (sol: LogSolicitacao, preferViagem = false) => {
    const params = new URLSearchParams()

    if (sol.status === 'solicitado' || sol.status === 'planejado' || sol.status === 'aguardando_aprovacao') {
      params.set('tab', sol.status)
      if (preferViagem && sol.viagem_id) params.set('viagem', sol.viagem_id)
      else params.set('item', sol.id)
      return `/logistica/solicitacoes?${params.toString()}`
    }

    if (sol.status === 'aprovado' || sol.status === 'romaneio_emitido' || (sol.status === 'nfe_emitida' && sol.doc_fiscal_tipo !== 'nf')) {
      params.set('tab', sol.status === 'nfe_emitida' ? 'nfe_emitida' : sol.status)
      params.set('item', sol.id)
      return `/logistica/expedicao?${params.toString()}`
    }

    params.set('tab', sol.status === 'nfe_emitida' ? 'transporte_pendente' : sol.status)
    params.set('item', sol.id)
    return `/logistica/transportes?${params.toString()}`
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Painel - Logistica</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Transportes, NF-e e rastreamento de entregas
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-slate-500 hover:text-orange-400' : 'text-slate-400 hover:text-orange-600'}`}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3">
        <section className={`rounded-3xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Nucleo Operacional
                </p>
                <h2 className={`mt-1.5 text-[1.9rem] md:text-[2.45rem] leading-none font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {fmtKm(operationalView.kmProgramados)} km em viagem
                </h2>
                <p className={`mt-2 text-[13px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {operationalView.rotasAtivas} rota(s)/viagem(ns) planejada(s), {transportesAtivos.length} transporte(s) acompanhados e {fmtCurrency(kpis.custo_total_mes)} em custo logistico no mes.
                </p>
              </div>
              <div className={`hidden md:flex w-12 h-12 rounded-2xl items-center justify-center ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                <Route size={22} className="text-sky-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <SpotlightMetric label="Rotas Planejadas" value={operationalView.rotasAtivas} tone="sky" note={`${operationalView.viagensEmExecucao} viagem(ns) em campo`} />
              <SpotlightMetric
                label="Transportes em Execucao"
                value={transportesAtivos.length}
                tone={operationalView.ocorrenciasAbertas > 0 ? 'amber' : 'emerald'}
                note={operationalView.ocorrenciasAbertas > 0 ? `${operationalView.ocorrenciasAbertas} ocorrencia(s) aberta(s)` : 'Operacao fluindo'}
              />
              <SpotlightMetric
                label="Proximas Coletas"
                value={operationalView.proximasColetas.length}
                tone={operationalView.coletasAtrasadas > 0 ? 'amber' : 'cyan'}
                note={operationalView.coletasAtrasadas > 0 ? `${operationalView.coletasAtrasadas} em atraso` : 'Fila sob controle'}
              />
              <SpotlightMetric
                label="Entregues Hoje"
                value={kpis.entregues_hoje}
                tone={aguardandoConfirmacao > 0 ? 'teal' : 'slate'}
                note={`${kpis.confirmadas_hoje} confirmadas`}
              />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className="p-4 md:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Janela Critica
                </p>
                <h2 className={`mt-1.5 text-base md:text-[17px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige acao primeiro
                </h2>
              </div>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${kpis.urgentes_pendentes > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={16} className={kpis.urgentes_pendentes > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>

            <div className={`rounded-2xl p-3 ${kpis.urgentes_pendentes > 0 ? 'bg-red-50 border border-red-100' : isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={`text-[11px] font-bold uppercase tracking-widest ${kpis.urgentes_pendentes > 0 ? 'text-red-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Urgentes Pendentes
                  </p>
                  <p className={`mt-1.5 text-[2rem] leading-none font-black ${kpis.urgentes_pendentes > 0 ? 'text-red-600' : isDark ? 'text-white' : 'text-slate-800'}`}>
                    {kpis.urgentes_pendentes}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${aguardandoConfirmacao > 0 ? 'text-amber-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {aguardandoConfirmacao} aguardando confirmacao
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    SLA de confirmacao: ate 4h apos a entrega
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MiniInfoCard label="NF-e no mes" value={kpis.nfe_emitidas_mes} note="documentos emitidos" icon={FileText} iconTone="text-violet-600" isDark={isDark} />
              <MiniInfoCard label="Solicitacoes abertas" value={kpis.abertas} note="na fila operacional" icon={ClipboardList} iconTone="text-orange-600" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Clock size={14} className="text-slate-500" /> Pulso por Status
          </h2>
          <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Resumo enxuto da fila
          </p>
        </div>
        <div className="p-4 space-y-3">
          <HorizontalStatusBar
            isDark={isDark}
            title="Distribuicao atual da fila"
            emptyLabel="Sem status relevantes no momento"
            segments={statusSegments}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Truck size={14} className="text-orange-500" /> Transportes em Execucao
            </h2>
            <button onClick={() => nav('/logistica/transportes?tab=em_transito')} className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5">
              Ver todos <ArrowRight size={10} />
            </button>
          </div>
          {transportesAtivos.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Nenhum transporte em campo"
              description="Quando a carga sair para coleta ou entrega, o operador acompanha a execucao por aqui."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
              {transportesAtivos.slice(0, 4).map(transporte => {
                const sol = transporte.solicitacao
                const atraso = transporte.eta_atual ? new Date(transporte.eta_atual) < new Date() : false
                const ocorrenciasAbertas = transporte.ocorrencias?.filter(oc => !oc.resolvido).length ?? 0

                return (
                  <button
                    key={transporte.id}
                    type="button"
                    onClick={() => sol && nav(buildSolicitacaoDeepLink(sol))}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ocorrenciasAbertas > 0 ? 'bg-red-50' : isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                      {ocorrenciasAbertas > 0 ? (
                        <AlertTriangle size={14} className="text-red-500" />
                      ) : (
                        <Truck size={14} className="text-orange-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol?.numero ?? transporte.id.slice(0, 8)}</p>
                        {sol?.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">URGENTE</span>}
                        {atraso && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">ATRASADO</span>}
                        {ocorrenciasAbertas > 0 && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">{ocorrenciasAbertas} ocorr.</span>}
                      </div>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {sol?.origem ?? transporte.viagem?.origem_principal ?? 'Origem'} {'->'} {sol?.destino ?? transporte.viagem?.destino_final ?? 'Destino'}
                        {transporte.viagem?.numero ? ` · ${transporte.viagem.numero}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {transporte.motorista_nome ?? transporte.viagem?.motorista_nome ?? '-'}
                      </p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{transporte.placa ?? transporte.viagem?.veiculo_placa ?? '-'}</p>
                      <p className={`text-[10px] ${atraso ? 'text-amber-600' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        ETA {fmtDate(transporte.eta_atual, true)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-red-500/30' : 'bg-white border border-red-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-red-500/20' : 'border-b border-red-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-red-400' : 'text-red-800'}`}>
              <AlertTriangle size={14} className="text-red-500" /> Solicitacoes Urgentes
            </h2>
            <button onClick={() => nav('/logistica/solicitacoes?tab=solicitado&urgent=1')} className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
              Ver todas <ArrowRight size={10} />
            </button>
          </div>
          {urgentes.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Nenhuma solicitacao urgente"
              description="As excecoes operacionais aparecem aqui para o operador priorizar a resposta."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-red-50'}`}>
              {urgentes.slice(0, 4).map(sol => (
                <button
                  key={sol.id}
                  type="button"
                  onClick={() => nav(buildSolicitacaoDeepLink(sol, Boolean(sol.viagem_id)))}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-red-50/50'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                    <AlertTriangle size={14} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol.numero}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {TIPO_LABEL[sol.tipo] ?? sol.tipo} · {sol.origem} {'->'} {sol.destino}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={sol.status} />
                    {sol.data_desejada && (
                      <p className={`text-[9px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Prazo: {fmtDate(sol.data_desejada)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <CalendarClock size={14} className="text-cyan-500" /> Proximas Coletas
            </h2>
            <button onClick={() => nav('/logistica/transportes?tab=aguardando_coleta')} className="text-[10px] text-cyan-600 font-semibold flex items-center gap-0.5">
              Abrir fila <ArrowRight size={10} />
            </button>
          </div>
          {operationalView.proximasColetas.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Nenhuma coleta pendente"
              description="Assim que a expedicao liberar uma carga, ela aparece aqui com a agenda prevista."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
              {operationalView.proximasColetas.map(sol => (
                <button
                  key={sol.id}
                  type="button"
                  onClick={() => nav(buildSolicitacaoDeepLink(sol))}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                    <CalendarClock size={15} className="text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-extrabold font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol.numero}</p>
                      <StatusBadge status={sol.status} />
                    </div>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {sol.origem} {'->'} {sol.destino}
                      {sol.rota_planejada?.distancia_km
                        ? ` · ${fmtKm(sol.rota_planejada.distancia_km)} km`
                        : sol.distancia_km
                          ? ` · ${fmtKm(sol.distancia_km)} km`
                          : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {fmtDate(sol.data_prevista_saida ?? sol.data_desejada, Boolean(sol.data_prevista_saida))}
                    </p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {sol.transportadora?.nome_fantasia ?? sol.motorista_nome ?? 'Aguardando definicao'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Route size={14} className="text-sky-500" /> Rotas com Maior Carga
            </h2>
            <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {fmtKm(operationalView.kmProgramados)} km planejados
            </span>
          </div>
          {operationalView.topRotas.length === 0 ? (
            <EmptyPanel
              isDark={isDark}
              title="Sem rotas planejadas"
              description="Planejamentos aprovados e coletas liberadas passam a aparecer aqui com o km total estimado."
            />
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
              {operationalView.topRotas.map(rota => (
                <button
                  key={rota.label}
                  type="button"
                  onClick={() => nav(buildSolicitacaoDeepLink(rota.sample, Boolean(rota.viagemId)))}
                  className={`w-full text-left px-4 py-3 transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{rota.label}</p>
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {rota.solicitacoes} solicitacao(oes) em rota
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-sky-600">{fmtKm(rota.km)} km</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SpotlightMetric({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number | string
  note: string
  tone: 'sky' | 'emerald' | 'cyan' | 'amber' | 'teal' | 'slate'
}) {
  const { isDark } = useTheme()
  const palette = toneClasses(tone)

  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : `${palette.soft} border`}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${palette.text}`}>{value}</p>
      <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{note}</p>
    </div>
  )
}

function HorizontalStatusBar({
  title,
  segments,
  emptyLabel,
  isDark,
}: {
  title: string
  segments: Array<{ key: string; label: string; value: number; barClass: string }>
  emptyLabel: string
  isDark: boolean
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{title}</p>
        <p className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{total} item(ns)</p>
      </div>
      {segments.length === 0 ? (
        <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          {emptyLabel}
        </div>
      ) : (
        <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {segments.map(segment => {
            const pct = (segment.value / total) * 100
            const showLabel = pct >= 14
            const showValue = pct >= 22

            return (
              <div
                key={segment.key}
                className={`${segment.barClass} relative flex items-center justify-center transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }}
                title={`${segment.label}: ${segment.value}`}
              >
                {showLabel && (
                  <span className="text-[10px] font-bold text-white drop-shadow-sm truncate px-2">
                    {segment.label} {showValue ? segment.value : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniInfoCard({
  label,
  value,
  note,
  icon: Icon,
  iconTone,
  isDark,
}: {
  label: string
  value: number
  note: string
  icon: typeof ClipboardList
  iconTone: string
  isDark: boolean
}) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/80'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
          <p className={`mt-1.5 text-[1.85rem] leading-none font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
          <Icon size={14} className={iconTone} />
        </div>
      </div>
    </div>
  )
}

function EmptyPanel({
  isDark,
  title,
  description,
}: {
  isDark: boolean
  title: string
  description: string
}) {
  return (
    <div className={`px-4 py-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{title}</p>
      <p className="text-[10px] mt-1">{description}</p>
    </div>
  )
}
