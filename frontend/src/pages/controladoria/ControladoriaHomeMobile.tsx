import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, AlertTriangle, RefreshCw, BarChart3,
  PieChart, Zap, CalendarClock, FileCheck2, Archive,
} from 'lucide-react'
import { useCustoPorObra, useAlertasDesvio, useOrcamentos } from '../../hooks/useControladoria'
import type { CtrlAlertaDesvio } from '../../types/controladoria'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, BarStat, Pill, MobileLoading, Empty, SectionBody,
} from '../../components/paineis-mobile/kit'
import type { Tone } from '../../components/paineis-mobile/kit'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const pct = (v: number) => v.toFixed(1) + '%'

// Tom do dot/pill por severidade do alerta (espelha SEVERIDADE_CFG do desktop)
const SEVERIDADE_TONE: Record<string, Tone> = {
  amarelo: 'amber',
  vermelho: 'red',
  critico: 'red',
}

// Atalhos (mesmas rotas do desktop)
const ACTIONS: { icon: typeof BarChart3; label: string; to: string; tone: Tone }[] = [
  { icon: BarChart3, label: 'Controle Orcamentario', to: '/controladoria/controle-orcamentario', tone: 'blue' },
  { icon: PieChart, label: 'Controle de Custos', to: '/controladoria/controle-custos', tone: 'violet' },
  { icon: TrendingUp, label: 'Controle Projetos', to: '/controladoria/controle-projetos', tone: 'emerald' },
  { icon: AlertTriangle, label: 'Cenarios', to: '/controladoria/cenarios', tone: 'amber' },
  { icon: Archive, label: 'Relatorios Legado', to: '/controladoria/relatorios-legado', tone: 'rose' },
]

// Versao mobile-native do Painel da Controladoria — MESMOS dados (useCustoPorObra,
// useAlertasDesvio, useOrcamentos).
export default function ControladoriaHomeMobile() {
  const nav = useNavigate()

  const { data: custos = [], isLoading, refetch } = useCustoPorObra()
  const { data: alertas = [] } = useAlertasDesvio({ resolvido: false })
  const { data: orcamentos = [] } = useOrcamentos()

  if (isLoading) return <MobileLoading tone="emerald" />

  // Derivacoes — identicas ao desktop
  const custoTotal = custos.reduce((s, c) => s + (Number(c.custo_total) || 0), 0)
  const margemMedia = custos.length > 0
    ? custos.reduce((s, c) => s + (Number(c.margem_bruta) || 0), 0) / custos.length : 0
  const alertasAtivos = alertas.length
  const orcamentosAprovados = orcamentos.filter(o => o.status === 'aprovado').length
  const alertasNaoLidos = alertas.filter(a => !a.lido).slice(0, 5)
  const orcPendentes = orcamentos.length - orcamentosAprovados
  const maxCusto = Math.max(...custos.map(c => Number(c.custo_total) || 0), 1)

  return (
    <MobilePanel>
      <MobileHeader
        title="Controladoria"
        subtitle="Visao geral orcamentaria, indicadores e custos"
        icon={BarChart3}
        tone="teal"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-teal-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Indicadores do portfolio */}
      <KpiGrid>
        <KpiCard label="Custo Total" value={fmt(custoTotal)} tone="teal" icon={DollarSign} note={`${custos.length} obras`} />
        <KpiCard label="Margem Media" value={pct(margemMedia)} tone={margemMedia >= 0 ? 'emerald' : 'red'} icon={TrendingUp} note={margemMedia >= 0 ? 'positiva' : 'negativa'} />
      </KpiGrid>

      <KpiGrid cols={3}>
        <StatTile label="Orcamentos" value={`${orcamentosAprovados}/${orcamentos.length}`} icon={FileCheck2} tone="blue" note="aprov. / total" />
        <StatTile label="Alertas Ativos" value={alertasAtivos} icon={AlertTriangle} tone={alertasAtivos > 0 ? 'amber' : 'slate'} note={alertasAtivos > 0 ? 'requer atencao' : 'tudo ok'} />
        <StatTile label="Orc. Pendentes" value={orcPendentes} icon={CalendarClock} tone={orcPendentes > 0 ? 'blue' : 'slate'} note="aguardando" />
      </KpiGrid>

      {/* Atalhos */}
      <Section title="Acessos Rapidos" icon={Zap} tone="teal">
        <SectionBody>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(({ icon: Icon, label, to, tone }) => (
              <ListRow
                key={to}
                leading={<Pill tone={tone}><Icon size={13} /></Pill>}
                title={label}
                onClick={() => nav(to)}
              />
            ))}
          </div>
        </SectionBody>
      </Section>

      {/* Alertas Recentes */}
      <Section
        title="Alertas Recentes"
        icon={AlertTriangle}
        tone="amber"
        action={{ label: 'Ver todos', onClick: () => nav('/controladoria/alertas') }}
      >
        {alertasNaoLidos.length === 0 ? (
          <Empty icon={AlertTriangle}>Nenhum alerta pendente</Empty>
        ) : (
          <RowList>
            {alertasNaoLidos.map((a: CtrlAlertaDesvio) => {
              const tone = SEVERIDADE_TONE[a.severidade] ?? 'amber'
              return (
                <ListRow
                  key={a.id}
                  leading={<Pill tone={tone}><span className="w-1.5 h-1.5 rounded-full bg-current" /></Pill>}
                  title={a.obra?.nome ?? 'Geral'}
                  subtitle={a.mensagem}
                  value={pct(a.desvio_pct)}
                  valueTone={tone}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Custo por Obra */}
      <Section title="Custo por Obra" icon={DollarSign} tone="teal">
        <SectionBody className="space-y-2.5">
          {custos.length === 0 ? (
            <Empty>Nenhum dado disponivel</Empty>
          ) : custos.slice(0, 8).map((c, i) => (
            <BarStat
              key={i}
              label={String(c.obra_nome ?? c.nome ?? '—')}
              value={fmt(Number(c.custo_total) || 0)}
              pct={((Number(c.custo_total) || 0) / maxCusto) * 100}
              tone="teal"
            />
          ))}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
