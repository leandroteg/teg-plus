import { useNavigate } from 'react-router-dom'
import {
  FileText, TrendingUp, Clock, RefreshCw, Zap, CalendarClock, Banknote,
} from 'lucide-react'
import { useContratosDashboard, useContratos, useAditivos, useParcelas as useParcelasList } from '../../hooks/useContratos'
import { GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, Pill, MobileLoading, Empty, SectionBody,
} from '../../components/paineis-mobile/kit'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_LABEL: Record<string, string> = {
  previsto: 'Previsto', pendente: 'Pendente', liberado: 'Liberado', pago: 'Pago', cancelado: 'Cancelado',
}

// Versão mobile-native do Painel de Contratos — MESMOS dados (useContratosDashboard + listas).
export default function DashboardContratosMobile() {
  const nav = useNavigate()
  const { data, isLoading, refetch } = useContratosDashboard()
  const { data: contratosAll = [] } = useContratos()
  const { data: aditivosAll = [] } = useAditivos()
  const { data: parcelasAll = [] } = useParcelasList()

  const resumo = data?.resumo ?? { total_contratos: 0, vigentes: 0, contratos_receita: 0, contratos_despesa: 0, valor_total_receita: 0, valor_total_despesa: 0 }
  const parcelas = data?.parcelas ?? { previstas: 0, pendentes: 0, liberadas: 0, pagas: 0, valor_pendente: 0, valor_liberado: 0 }
  const proximas = data?.proximas_parcelas ?? []

  const hoje = new Date()
  const vencendo30d = contratosAll.filter(c => {
    if (c.status !== 'vigente' || !c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias >= 0 && dias <= 30
  }).length
  const parcelasAtrasadas = parcelasAll.filter((p: any) => {
    if (p.status === 'pago' || p.status === 'cancelado') return false
    return new Date(p.data_vencimento + 'T00:00:00') < hoje
  }).length

  // Status bar — segmentando vigentes em subcategorias
  const vigentes = contratosAll.filter(c => c.status === 'vigente')
  const vigentesOk = vigentes.filter(c => {
    if (!c.data_fim_previsto) return true
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 90
  }).length
  const aVencer90d = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 30 && dias <= 90
  }).length
  const aVencer30d = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    const dias = Math.ceil((new Date(c.data_fim_previsto + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
    return dias > 0 && dias <= 30
  }).length
  const vencidos = vigentes.filter(c => {
    if (!c.data_fim_previsto) return false
    return new Date(c.data_fim_previsto + 'T00:00:00') < hoje
  }).length

  const statusCounts = [
    { key: 'em_negociacao', barClass: 'bg-yellow-400',  label: 'Em Negociacao',  value: contratosAll.filter(c => c.status === 'em_negociacao').length },
    { key: 'assinado',      barClass: 'bg-blue-400',    label: 'Assinado',       value: contratosAll.filter(c => c.status === 'assinado').length },
    { key: 'vigente_ok',    barClass: 'bg-emerald-500', label: 'Vigentes',       value: vigentesOk },
    { key: 'a_vencer_90d',  barClass: 'bg-amber-400',   label: 'A Vencer 90d',   value: aVencer90d },
    { key: 'a_vencer_30d',  barClass: 'bg-orange-500',  label: 'A Vencer 30d',   value: aVencer30d },
    { key: 'vencidos',      barClass: 'bg-red-500',     label: 'Vencidos',       value: vencidos },
    { key: 'suspenso',      barClass: 'bg-violet-400',  label: 'Suspenso',       value: contratosAll.filter(c => c.status === 'suspenso').length },
    { key: 'encerrado',     barClass: 'bg-slate-400',   label: 'Encerrado',      value: contratosAll.filter(c => c.status === 'encerrado').length },
    { key: 'rescindido',    barClass: 'bg-red-400',     label: 'Rescindido',     value: contratosAll.filter(c => c.status === 'rescindido').length },
  ].filter(s => s.value > 0)
  const totalContratos = contratosAll.length || 1

  // Por grupo
  const grupos = contratosAll.reduce((acc: Record<string, number>, c) => {
    const g = c.grupo_contrato || 'outro'
    acc[g] = (acc[g] || 0) + 1
    return acc
  }, {})
  const gruposSorted = Object.entries(grupos).sort((a, b) => b[1] - a[1])
  const maxGrupo = Math.max(...gruposSorted.map(([, v]) => v), 1)

  const critico = vencendo30d + parcelasAtrasadas

  if (isLoading) return <MobileLoading tone="indigo" />

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel de Contratos"
        subtitle="Gestao de contratos, parcelas e pagamentos"
        icon={FileText}
        tone="indigo"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Indicadores do portfolio */}
      <KpiGrid cols={3}>
        <KpiCard label="Vigentes" value={resumo.vigentes} tone="indigo" note={`${resumo.total_contratos} total`} />
        <KpiCard label="A Receber" value={fmt(resumo.valor_total_receita)} tone="emerald" note={`${resumo.contratos_receita} contr.`} />
        <KpiCard label="A Pagar" value={fmt(resumo.valor_total_despesa)} tone="amber" note={`${resumo.contratos_despesa} contr.`} />
      </KpiGrid>

      {/* Janela crítica — o que exige acao agora */}
      <Section title="Janela Critica" icon={Zap} tone={critico > 0 ? 'red' : 'slate'}>
        <SectionBody>
          <KpiGrid>
            <StatTile
              label="Vencendo 30d"
              value={vencendo30d}
              icon={CalendarClock}
              tone={vencendo30d > 0 ? 'red' : 'slate'}
              note={vencendo30d > 0 ? 'renovar urgente' : 'tudo ok'}
            />
            <StatTile
              label="Parc. Atrasadas"
              value={parcelasAtrasadas}
              icon={Banknote}
              tone={parcelasAtrasadas > 0 ? 'amber' : 'slate'}
              note={parcelas.pendentes > 0 ? fmt(parcelas.valor_pendente) : 'nenhuma'}
            />
          </KpiGrid>
        </SectionBody>
      </Section>

      {/* Pulso por status */}
      <Section title="Pulso por Status" icon={TrendingUp} tone="indigo">
        <SectionBody>
          {statusCounts.length === 0 ? (
            <Empty>Nenhum contrato</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {statusCounts.map(s => {
                  const pct = (s.value / totalContratos) * 100
                  return (
                    <div key={s.key} className={`${s.barClass} flex items-center justify-center transition-all`}
                      style={{ width: `${Math.max(pct, 4)}%` }} title={`${s.label}: ${s.value}`}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white drop-shadow-sm">{s.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {statusCounts.map(s => (
                  <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${s.barClass}`} /> {s.label} · {s.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Próximas parcelas */}
      <Section title="Proximas Parcelas" icon={Clock} tone="amber" action={{ label: 'Ver todas', onClick: () => nav('/contratos/previsao') }}>
        {proximas.length === 0 ? (
          <Empty icon={Clock}>Nenhuma parcela proxima</Empty>
        ) : (
          <RowList>
            {proximas.slice(0, 6).map((p: any) => {
              const vencido = new Date(p.data_vencimento) < hoje
              const isDespesa = p.tipo_contrato === 'despesa'
              const badgeTone = vencido ? 'red' : isDespesa ? 'amber' : 'emerald'
              return (
                <ListRow
                  key={p.id}
                  leading={<LeadingBadge tone={badgeTone}>{fmtData(p.data_vencimento).split('/')[0]}</LeadingBadge>}
                  title={p.contrato_objeto || 'Contrato'}
                  subtitle={p.contraparte || ''}
                  value={fmt(p.valor)}
                  valueSub={fmtData(p.data_vencimento)}
                  valueTone={badgeTone}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Status das parcelas (do dashboard) */}
      <Section title="Parcelas no Pipeline" icon={Banknote} tone="indigo">
        <SectionBody>
          <KpiGrid cols={3}>
            <StatTile label={STATUS_LABEL.previsto} value={parcelas.previstas} tone="slate" />
            <StatTile label={STATUS_LABEL.pendente} value={parcelas.pendentes} tone={parcelas.pendentes > 0 ? 'amber' : 'slate'} />
            <StatTile label={STATUS_LABEL.liberado} value={parcelas.liberadas} tone="blue" />
          </KpiGrid>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="emerald">{STATUS_LABEL.pago}: {parcelas.pagas}</Pill>
            <Pill tone="amber">Pendente: {fmt(parcelas.valor_pendente)}</Pill>
            <Pill tone="blue">Liberado: {fmt(parcelas.valor_liberado)}</Pill>
            <Pill tone="indigo">Aditivos: {aditivosAll.length}</Pill>
          </div>
        </SectionBody>
      </Section>

      {/* Por tipo de contrato */}
      <Section title="Por Tipo de Contrato" icon={FileText} tone="indigo">
        <SectionBody className="space-y-2.5">
          {gruposSorted.length === 0 ? (
            <Empty>Nenhum contrato</Empty>
          ) : gruposSorted.slice(0, 8).map(([grupo, count]) => (
            <BarStat
              key={grupo}
              label={GRUPO_CONTRATO_LABEL[grupo as GrupoContrato] ?? grupo}
              value={count}
              pct={(count / maxGrupo) * 100}
              tone="indigo"
            />
          ))}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
