import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Truck,
  AlertTriangle,
  FileText,
  RefreshCw,
  Route,
  CalendarClock,
  ClipboardList,
  Activity,
} from 'lucide-react'
import { useLogisticaKPIs, useSolicitacoes, useTransportes } from '../../hooks/useLogistica'
import type { LogisticaKPIs, LogSolicitacao } from '../../types/logistica'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody, Pill,
} from '../../components/paineis-mobile/kit'

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

const STATUS_LABEL: Record<string, string> = {
  solicitado: 'Solicitado',
  planejado: 'Planejado',
  aguardando_aprovacao: 'Aguard. aprov.',
  aprovado: 'Aprovado',
  romaneio_emitido: 'Romaneio',
  nfe_emitida: 'NF-e emitida',
  transporte_pendente: 'Transp. pendente',
  aguardando_coleta: 'Aguard. coleta',
  em_transito: 'Em transito',
  entregue: 'Entregue',
  concluido: 'Concluido',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

const TIPO_LABEL: Record<string, string> = {
  viagem: 'Viagem',
  mobilizacao: 'Mobilizacao',
  transferencia_maquina: 'Transf. maquina',
}

const OPERATIONAL_STATUSES = ['planejado', 'aprovado', 'transporte_pendente', 'aguardando_coleta', 'em_transito'] as const

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

// Versão mobile-native do Painel de Logística — MESMOS dados (useLogisticaKPIs/useSolicitacoes/useTransportes).
export default function LogisticaHomeMobile() {
  const nav = useNavigate()
  const { data: kpis = EMPTY_KPIS, isLoading, refetch } = useLogisticaKPIs()
  const { data: urgentes = [] } = useSolicitacoes({
    urgente: true,
    status: ['solicitado', 'planejado', 'aguardando_aprovacao'],
  })
  const { data: operacionais = [] } = useSolicitacoes({ status: [...OPERATIONAL_STATUSES] })
  const { data: aguardandoColeta = [] } = useSolicitacoes({ status: ['transporte_pendente', 'aguardando_coleta'] })
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

  if (isLoading) return <MobileLoading tone="amber" />

  const aguardandoConfirmacao = Math.max(0, kpis.entregues_hoje - kpis.confirmadas_hoje)

  const statusSegments = [
    { key: 'abertas', label: 'Abertas', value: kpis.abertas, barClass: 'bg-orange-500' },
    { key: 'em_transito', label: 'Em transito', value: kpis.em_transito, barClass: 'bg-blue-500' },
    { key: 'urgentes', label: 'Urgentes', value: kpis.urgentes_pendentes, barClass: kpis.urgentes_pendentes > 0 ? 'bg-red-500' : 'bg-slate-400' },
    { key: 'nfe', label: 'NF-e emitidas', value: kpis.nfe_emitidas_mes, barClass: 'bg-violet-500' },
  ].filter(segment => segment.value > 0)
  const totalSegments = statusSegments.reduce((sum, s) => sum + s.value, 0)
  const maxRotaKm = Math.max(...operationalView.topRotas.map(r => r.km), 1)

  const buildSolicitacaoDeepLink = (sol: LogSolicitacao, preferViagem = false) => {
    const params = new URLSearchParams()

    if (sol.status === 'solicitado' || sol.status === 'planejado' || sol.status === 'aguardando_aprovacao') {
      params.set('tab', sol.status)
      if (preferViagem && sol.viagem_id) params.set('viagem', sol.viagem_id)
      else params.set('item', sol.id)
      return `/logistica/solicitacoes?${params.toString()}`
    }

    if (sol.status === 'aprovado') {
      params.set('tab', sol.status)
      params.set('item', sol.id)
      return `/logistica/expedicao?${params.toString()}`
    }

    if (sol.status === 'nfe_emitida' || sol.status === 'romaneio_emitido' || sol.status === 'transporte_pendente') {
      params.set('tab', 'transporte_pendente')
    } else {
      params.set('tab', sol.status)
    }
    params.set('item', sol.id)
    return `/logistica/transportes?${params.toString()}`
  }

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel - Logistica"
        subtitle="Transportes, NF-e e rastreamento"
        icon={Truck}
        tone="amber"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Núcleo operacional — km em viagem */}
      <KpiCard
        label="Nucleo Operacional"
        value={`${fmtKm(operationalView.kmProgramados)} km`}
        tone="sky"
        icon={Route}
        note={`${operationalView.rotasAtivas} rota(s)/viagem(ns) · ${transportesAtivos.length} transporte(s) · ${fmtCurrency(kpis.custo_total_mes)} custo no mes`}
      />

      <KpiGrid>
        <StatTile
          label="Rotas Planejadas"
          value={operationalView.rotasAtivas}
          icon={Route}
          tone="sky"
          note={`${operationalView.viagensEmExecucao} viagem(ns) em campo`}
        />
        <StatTile
          label="Transp. Execucao"
          value={transportesAtivos.length}
          icon={Truck}
          tone={operationalView.ocorrenciasAbertas > 0 ? 'amber' : 'emerald'}
          note={operationalView.ocorrenciasAbertas > 0 ? `${operationalView.ocorrenciasAbertas} ocorrencia(s)` : 'Operacao fluindo'}
        />
        <StatTile
          label="Proximas Coletas"
          value={operationalView.proximasColetas.length}
          icon={CalendarClock}
          tone={operationalView.coletasAtrasadas > 0 ? 'amber' : 'sky'}
          note={operationalView.coletasAtrasadas > 0 ? `${operationalView.coletasAtrasadas} em atraso` : 'Fila sob controle'}
        />
        <StatTile
          label="Entregues Hoje"
          value={kpis.entregues_hoje}
          icon={Truck}
          tone={aguardandoConfirmacao > 0 ? 'teal' : 'slate'}
          note={`${kpis.confirmadas_hoje} confirmadas`}
        />
      </KpiGrid>

      {/* Janela crítica — o que exige ação primeiro */}
      <KpiGrid>
        <KpiCard
          label="Urgentes Pendentes"
          value={kpis.urgentes_pendentes}
          tone={kpis.urgentes_pendentes > 0 ? 'red' : 'slate'}
          icon={AlertTriangle}
          note={`${aguardandoConfirmacao} aguardando confirmacao · SLA ate 4h`}
        />
        <div className="grid grid-rows-2 gap-2.5">
          <StatTile label="NF-e no mes" value={kpis.nfe_emitidas_mes} icon={FileText} tone="violet" note="emitidas" />
          <StatTile label="Solic. Abertas" value={kpis.abertas} icon={ClipboardList} tone="amber" note="na fila" />
        </div>
      </KpiGrid>

      {/* Pulso por status */}
      <Section title="Pulso por Status" icon={Activity} tone="slate">
        <SectionBody>
          {statusSegments.length === 0 ? (
            <Empty>Sem status relevantes no momento</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {statusSegments.map(s => {
                  const pct = (s.value / totalSegments) * 100
                  return (
                    <div key={s.key} className={`${s.barClass} flex items-center justify-center`} style={{ width: `${Math.max(pct, 4)}%` }}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white">{s.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {statusSegments.map(s => (
                  <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${s.barClass}`} /> {s.label} · {s.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Transportes em execução */}
      <Section
        title="Transportes em Execucao"
        icon={Truck}
        tone="amber"
        action={{ label: 'Ver todos', onClick: () => nav('/logistica/transportes?tab=em_transito') }}
      >
        {transportesAtivos.length === 0 ? (
          <Empty icon={Truck}>Nenhum transporte em campo</Empty>
        ) : (
          <RowList>
            {transportesAtivos.slice(0, 4).map(transporte => {
              const sol = transporte.solicitacao
              const atraso = transporte.eta_atual ? new Date(transporte.eta_atual) < new Date() : false
              const ocorrenciasAbertas = transporte.ocorrencias?.filter(oc => !oc.resolvido).length ?? 0
              return (
                <ListRow
                  key={transporte.id}
                  onClick={sol ? () => nav(buildSolicitacaoDeepLink(sol)) : undefined}
                  leading={
                    <LeadingBadge tone={ocorrenciasAbertas > 0 ? 'red' : 'amber'}>
                      {ocorrenciasAbertas > 0 ? <AlertTriangle size={15} /> : <Truck size={15} />}
                    </LeadingBadge>
                  }
                  title={sol?.numero ?? transporte.id.slice(0, 8)}
                  subtitle={`${sol?.origem ?? transporte.viagem?.origem_principal ?? 'Origem'} -> ${sol?.destino ?? transporte.viagem?.destino_final ?? 'Destino'}${transporte.viagem?.numero ? ` · ${transporte.viagem.numero}` : ''}`}
                  value={transporte.motorista_nome ?? transporte.viagem?.motorista_nome ?? '-'}
                  valueSub={`${transporte.placa ?? transporte.viagem?.veiculo_placa ?? '-'} · ETA ${fmtDate(transporte.eta_atual, true)}`}
                  valueTone={atraso ? 'amber' : undefined}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Solicitações urgentes */}
      <Section
        title="Solicitacoes Urgentes"
        icon={AlertTriangle}
        tone="red"
        action={{ label: 'Ver todas', onClick: () => nav('/logistica/solicitacoes?tab=solicitado&urgent=1') }}
      >
        {urgentes.length === 0 ? (
          <Empty icon={AlertTriangle}>Nenhuma solicitacao urgente</Empty>
        ) : (
          <RowList>
            {urgentes.slice(0, 4).map(sol => (
              <ListRow
                key={sol.id}
                onClick={() => nav(buildSolicitacaoDeepLink(sol, Boolean(sol.viagem_id)))}
                leading={<LeadingBadge tone="red"><AlertTriangle size={15} /></LeadingBadge>}
                title={sol.numero}
                subtitle={`${TIPO_LABEL[sol.tipo] ?? sol.tipo} · ${sol.origem} -> ${sol.destino}`}
                value={<Pill tone="red">{STATUS_LABEL[sol.status] ?? sol.status}</Pill>}
                valueSub={sol.data_desejada ? `Prazo: ${fmtDate(sol.data_desejada)}` : undefined}
              />
            ))}
          </RowList>
        )}
      </Section>

      {/* Próximas coletas */}
      <Section
        title="Proximas Coletas"
        icon={CalendarClock}
        tone="sky"
        action={{ label: 'Abrir fila', onClick: () => nav('/logistica/transportes?tab=aguardando_coleta') }}
      >
        {operationalView.proximasColetas.length === 0 ? (
          <Empty icon={CalendarClock}>Nenhuma coleta pendente</Empty>
        ) : (
          <RowList>
            {operationalView.proximasColetas.map(sol => {
              const km = sol.rota_planejada?.distancia_km ?? sol.distancia_km
              return (
                <ListRow
                  key={sol.id}
                  onClick={() => nav(buildSolicitacaoDeepLink(sol))}
                  leading={<LeadingBadge tone="sky"><CalendarClock size={15} /></LeadingBadge>}
                  title={sol.numero}
                  subtitle={`${sol.origem} -> ${sol.destino}${km ? ` · ${fmtKm(km)} km` : ''}`}
                  value={fmtDate(sol.data_prevista_saida ?? sol.data_desejada, Boolean(sol.data_prevista_saida))}
                  valueSub={sol.transportadora?.nome_fantasia ?? sol.motorista_nome ?? 'Aguardando definicao'}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Rotas com maior carga */}
      <Section title="Rotas com Maior Carga" icon={Route} tone="sky">
        <SectionBody className="space-y-2.5">
          {operationalView.topRotas.length === 0 ? (
            <Empty icon={Route}>Sem rotas planejadas</Empty>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-slate-400">
                {fmtKm(operationalView.kmProgramados)} km planejados
              </p>
              {operationalView.topRotas.map(rota => (
                <button
                  key={rota.label}
                  type="button"
                  onClick={() => nav(buildSolicitacaoDeepLink(rota.sample, Boolean(rota.viagemId)))}
                  className="w-full text-left"
                >
                  <BarStat label={rota.label} value={`${fmtKm(rota.km)} km`} pct={(rota.km / maxRotaKm) * 100} tone="sky" />
                </button>
              ))}
            </>
          )}
        </SectionBody>
      </Section>

    </MobilePanel>
  )
}
