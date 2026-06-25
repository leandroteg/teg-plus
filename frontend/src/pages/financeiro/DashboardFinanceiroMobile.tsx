import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { DollarSign, AlertTriangle, CalendarClock, Clock, TrendingUp, TrendingDown, RefreshCw, LayoutGrid } from 'lucide-react'
import { useFinanceiroDashboard } from '../../hooks/useFinanceiro'
import type { ContaPagar, FinanceiroKPIs } from '../../types/financeiro'
import {
  MobilePanel, MobileHeader, Segmented, MobileSelect, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody,
} from '../../components/paineis-mobile/kit'

const PainelPagamentos = lazy(() => import('./PainelPagamentos'))

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: FinanceiroKPIs = {
  total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
  valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
  aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
}

const STATUS_LABEL: Record<string, string> = {
  previsto: 'Previsto', confirmado: 'Confirmado', em_lote: 'Em Lote', aprovado_pgto: 'Pgto Aprovado',
  em_pagamento: 'Em Pagamento', pago: 'Pago', conciliado: 'Conciliado',
}
const BAR_COLORS: Record<string, string> = {
  previsto: 'bg-slate-400', confirmado: 'bg-blue-400', em_lote: 'bg-violet-500',
  aprovado_pgto: 'bg-indigo-500', em_pagamento: 'bg-amber-400', pago: 'bg-emerald-500', conciliado: 'bg-green-500',
}
const PIPELINE_ORDER = ['previsto', 'confirmado', 'em_lote', 'aprovado_pgto', 'em_pagamento', 'pago', 'conciliado']

// Versão mobile-native do Painel Financeiro — MESMOS dados (useFinanceiroDashboard)
// + o mesmo seletor de sub-painel do desktop (Painel / Pgtos Previstos).
export default function DashboardFinanceiroMobile() {
  const nav = useNavigate()
  const location = useLocation()
  const [periodo, setPeriodo] = useState('30d')
  const [painelAtivo, setPainelAtivo] = useState('painel') // 'painel' | 'pgtos_previstos'
  useEffect(() => { setPeriodo('30d') }, [location.key])
  const { data, isLoading, refetch } = useFinanceiroDashboard(periodo)

  const kpis = data?.kpis ?? EMPTY_KPIS
  const porStatus = data?.por_status ?? []
  const porCC = data?.por_centro_custo ?? []
  const proximos = data?.vencimentos_proximos ?? []

  const ordered = PIPELINE_ORDER
    .map(key => porStatus.find((s: any) => s.status === key))
    .filter((s): s is any => !!s && s.total > 0)
  const totalPipeline = ordered.reduce((sum: number, s: any) => sum + s.total, 0) || 1
  const maxCC = Math.max(...porCC.map((c: any) => c.valor), 1)

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel Financeiro"
        subtitle="Pagamentos e recebimentos"
        icon={DollarSign}
        tone="emerald"
        right={painelAtivo === 'painel' ? (
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        ) : undefined}
      />

      {/* Seletor de sub-painel (dropdown elegante — abre lista) */}
      <MobileSelect
        value={painelAtivo}
        onChange={setPainelAtivo}
        icon={LayoutGrid}
        options={[{ value: 'painel', label: 'Painel' }, { value: 'pgtos_previstos', label: 'Pgtos Previstos' }]}
      />

      {painelAtivo === 'pgtos_previstos' ? (
        <Suspense fallback={<MobileLoading />}><PainelPagamentos /></Suspense>
      ) : isLoading ? (
        <MobileLoading />
      ) : (
        <>
          <Segmented
            value={periodo}
            onChange={setPeriodo}
            options={[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: '365d', label: 'Ano' }]}
          />

          <KpiGrid>
            <KpiCard label="Saldo em Aberto" value={fmt(kpis.valor_total_aberto)} tone="emerald" note={`${kpis.total_cp} títulos`} />
            <KpiCard label="Pago no Período" value={fmt(kpis.valor_pago_periodo)} tone="teal" note={`${kpis.cp_pagas_periodo} pagamentos`} />
          </KpiGrid>

          <KpiGrid cols={3}>
            <StatTile label="Vence 7 dias" value={fmt(kpis.valor_a_vencer_7d)} icon={Clock} tone={kpis.cp_a_vencer > 0 ? 'amber' : 'slate'} note={`${kpis.cp_a_vencer} tít.`} />
            <StatTile label="Vencidas" value={kpis.cp_vencidas} icon={AlertTriangle} tone={kpis.cp_vencidas > 0 ? 'red' : 'slate'} note={kpis.cp_vencidas > 0 ? 'atenção!' : 'tudo ok'} />
            <StatTile label="Aguard. Aprov." value={kpis.aguardando_aprovacao} icon={CalendarClock} tone={kpis.aguardando_aprovacao > 0 ? 'amber' : 'slate'} note="pendentes" />
          </KpiGrid>

          <Section title="Pulso Financeiro" icon={TrendingUp} tone="emerald">
            <SectionBody>
              {ordered.length === 0 ? (
                <Empty>Nenhum título no período</Empty>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex h-9 rounded-xl overflow-hidden">
                    {ordered.map((s: any) => (
                      <div key={s.status} className={`${BAR_COLORS[s.status] ?? 'bg-gray-300'} flex items-center justify-center`}
                        style={{ width: `${Math.max((s.total / totalPipeline) * 100, 4)}%` }}>
                        {(s.total / totalPipeline) * 100 >= 16 && <span className="text-[10px] font-bold text-white">{s.total}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {ordered.map((s: any) => (
                      <span key={s.status} className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className={`w-2 h-2 rounded-full ${BAR_COLORS[s.status]}`} /> {STATUS_LABEL[s.status]} · {s.total}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </SectionBody>
          </Section>

          <Section title="Próximos Vencimentos" icon={Clock} tone="amber" action={{ label: 'Ver todos', onClick: () => nav('/financeiro/cp') }}>
            {proximos.length === 0 ? (
              <Empty icon={Clock}>Nenhum vencimento próximo</Empty>
            ) : (
              <RowList>
                {proximos.slice(0, 6).map((cp: ContaPagar) => {
                  const vencido = new Date(cp.data_vencimento) < new Date()
                  return (
                    <ListRow
                      key={cp.id}
                      leading={<LeadingBadge tone={vencido ? 'red' : 'emerald'}>{fmtData(cp.data_vencimento).split('/')[0]}</LeadingBadge>}
                      title={cp.fornecedor_nome}
                      subtitle={cp.natureza ?? 'Geral'}
                      value={fmt(cp.valor_original)}
                      valueSub={fmtData(cp.data_vencimento)}
                      valueTone={vencido ? 'red' : undefined}
                    />
                  )
                })}
              </RowList>
            )}
          </Section>

          <Section title="Por Centro de Custo" icon={TrendingDown} tone="emerald">
            <SectionBody className="space-y-2.5">
              {porCC.length === 0 ? (
                <Empty>Nenhum dado por centro de custo</Empty>
              ) : porCC.slice(0, 8).map((cc: any) => (
                <BarStat key={cc.centro_custo} label={cc.centro_custo} value={fmt(cc.valor)} pct={(cc.valor / maxCC) * 100} tone="emerald" />
              ))}
            </SectionBody>
          </Section>
        </>
      )}
    </MobilePanel>
  )
}
