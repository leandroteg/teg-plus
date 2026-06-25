import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KeySquare, DollarSign, Activity, Zap, Wrench, AlertTriangle, Calendar,
  TrendingUp, Clock, LogIn, LogOut, RefreshCw,
} from 'lucide-react'
import {
  useLocacaoKPIs, useFaturas, useEntradas, useSaidas, useSolicitacoesLocacao, useImoveis,
} from '../../hooks/useLocacao'
import type { LocFatura, LocEntrada, LocSaida, LocImovel } from '../../types/locacao'
import {
  ENTRADA_PIPELINE_STAGES, SAIDA_PIPELINE_STAGES, TIPO_FATURA_LABEL, STATUS_FATURA_LABEL, fmtEndereco,
} from '../../types/locacao'
import {
  MobilePanel, MobileHeader, Segmented, KpiCard, KpiGrid, StatTile, Section,
  SectionBody, RowList, ListRow, LeadingBadge, Pill, Empty, MobileLoading,
  type Tone,
} from '../../components/paineis-mobile/kit'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// Mapeia barClass do desktop -> Tone do kit, p/ a bolinha de cada segmento.
const SEG_TONE: Record<string, Tone> = {
  'bg-slate-400': 'slate', 'bg-blue-500': 'blue', 'bg-violet-500': 'violet',
  'bg-emerald-500': 'emerald', 'bg-indigo-500': 'indigo', 'bg-amber-400': 'amber',
  'bg-red-600': 'red', 'bg-cyan-500': 'sky', 'bg-orange-500': 'amber',
  'bg-amber-500': 'amber', 'bg-sky-500': 'sky', 'bg-red-500': 'red',
  'bg-violet-400': 'violet', 'bg-slate-500': 'slate',
}

type Grupo = 'entradas' | 'gestao' | 'devolucoes'

// Versão mobile-native do Painel de Locação — MESMOS dados (useLocacaoKPIs + hooks de lista).
export default function LocacaoHomeMobile() {
  const nav = useNavigate()
  const [grupo, setGrupo] = useState<Grupo>('gestao')

  const { data: kpis, isLoading, refetch } = useLocacaoKPIs()
  const { data: faturas = [] } = useFaturas()
  const { data: entradas = [] } = useEntradas()
  const { data: saidas = [] } = useSaidas()
  const { data: solicitacoes = [] } = useSolicitacoesLocacao()
  const { data: imoveis = [] } = useImoveis()

  // Contagens p/ pipeline
  const entradasAndamento = useMemo(() => entradas.filter(e => e.status !== 'liberado'), [entradas])
  const saidasAndamento = useMemo(() => saidas.filter(s => s.status !== 'encerrado'), [saidas])

  // Imóveis por situação
  const imoveisAtivos = useMemo(() => imoveis.filter(i => i.status === 'ativo').length, [imoveis])
  const imoveisEmEntrada = useMemo(() => imoveis.filter(i => i.status === 'em_entrada').length, [imoveis])
  const imoveisEmSaida = useMemo(() => imoveis.filter(i => i.status === 'em_saida').length, [imoveis])

  // Contratos vencendo/vencidos (via join no useImoveis)
  const contratosVencidos = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return imoveis.filter(i => { const d = (i as any).contrato?.data_fim_previsto; return d && d < today && i.status === 'ativo' })
  }, [imoveis])
  const contratosVencendo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const lim = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
    return imoveis.filter(i => { const d = (i as any).contrato?.data_fim_previsto; return d && d >= today && d <= lim && i.status === 'ativo' })
  }, [imoveis])

  // Próximas faturas
  const proximasFaturas = useMemo(() =>
    [...faturas].filter(f => f.status !== 'pago' && f.vencimento).sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? '')).slice(0, 5)
  , [faturas])

  // Status bar — mesma derivação do desktop (uma lista única de segmentos).
  const statusSegments = useMemo(() => {
    const entradaCounts: Record<string, number> = {}
    entradas.forEach(e => { entradaCounts[e.status] = (entradaCounts[e.status] || 0) + 1 })
    const saidaCounts: Record<string, number> = {}
    saidas.forEach(s => { saidaCounts[s.status] = (saidaCounts[s.status] || 0) + 1 })

    return [
      // Entradas
      { key: 'e_pendente', label: 'Ent. Pendente', value: entradaCounts['pendente'] || 0, barClass: 'bg-slate-400', grupo: 'entradas' as Grupo },
      { key: 'e_vistoria', label: 'Ent. Vistoria', value: entradaCounts['aguardando_vistoria'] || 0, barClass: 'bg-blue-500', grupo: 'entradas' as Grupo },
      { key: 'e_assinatura', label: 'Ent. Assinatura', value: entradaCounts['aguardando_assinatura'] || 0, barClass: 'bg-violet-500', grupo: 'entradas' as Grupo },
      { key: 'e_liberado', label: 'Liberado', value: entradaCounts['liberado'] || 0, barClass: 'bg-emerald-500', grupo: 'entradas' as Grupo },
      // Gestão
      { key: 'g_ativo', label: 'Ativos', value: imoveisAtivos - contratosVencendo.length - contratosVencidos.length, barClass: 'bg-indigo-500', grupo: 'gestao' as Grupo },
      { key: 'g_vencendo', label: 'Vencendo', value: contratosVencendo.length, barClass: 'bg-amber-400', grupo: 'gestao' as Grupo },
      { key: 'g_vencido', label: 'Vencidos', value: contratosVencidos.length, barClass: 'bg-red-600', grupo: 'gestao' as Grupo },
      { key: 'g_entrada', label: 'Em Entrada', value: imoveisEmEntrada, barClass: 'bg-cyan-500', grupo: 'gestao' as Grupo },
      { key: 'g_saida', label: 'Em Saída', value: imoveisEmSaida, barClass: 'bg-orange-500', grupo: 'gestao' as Grupo },
      // Devoluções
      { key: 's_pendente', label: 'Dev. Pendente', value: saidaCounts['pendente'] || 0, barClass: 'bg-amber-500', grupo: 'devolucoes' as Grupo },
      { key: 's_vistoria', label: 'Dev. Vistoria', value: saidaCounts['aguardando_vistoria'] || 0, barClass: 'bg-sky-500', grupo: 'devolucoes' as Grupo },
      { key: 's_pendencias', label: 'Pendências', value: saidaCounts['solucionando_pendencias'] || 0, barClass: 'bg-red-500', grupo: 'devolucoes' as Grupo },
      { key: 's_encerramento', label: 'Encerramento', value: saidaCounts['encerramento_contratual'] || 0, barClass: 'bg-violet-400', grupo: 'devolucoes' as Grupo },
      { key: 's_encerrado', label: 'Encerrado', value: saidaCounts['encerrado'] || 0, barClass: 'bg-slate-500', grupo: 'devolucoes' as Grupo },
    ]
  }, [entradas, saidas, imoveisAtivos, imoveisEmEntrada, imoveisEmSaida, contratosVencendo, contratosVencidos])

  if (isLoading) return <MobileLoading tone="indigo" />

  const grupoSegments = statusSegments.filter(s => s.grupo === grupo)
  const grupoTotal = grupoSegments.reduce((acc, s) => acc + s.value, 0)
  const grupoMax = Math.max(...grupoSegments.map(s => s.value), 1)

  return (
    <MobilePanel>
      <MobileHeader
        title="Locação de Imóveis"
        subtitle="Gestão de contratos, faturas e manutenções"
        icon={KeySquare}
        tone="indigo"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-indigo-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Núcleo de Locações — indicadores gerais */}
      <KpiGrid>
        <KpiCard label="Imóveis Ativos" value={kpis?.imoveisAtivos ?? 0} tone="indigo" note="carteira ativa" icon={KeySquare} />
        <KpiCard label="Valor Total/mês" value={fmtCurrency(kpis?.valorTotalMensal ?? 0)} tone="emerald" note="aluguéis mensais" icon={DollarSign} />
      </KpiGrid>

      <KpiGrid cols={3}>
        <StatTile
          label="Em Andamento"
          value={entradasAndamento.length + saidasAndamento.length}
          icon={Activity}
          tone="sky"
          note="entradas + devoluções"
        />
        <StatTile
          label="Faturas Vencendo"
          value={kpis?.faturasVencendo ?? 0}
          icon={Zap}
          tone={(kpis?.faturasVencendo ?? 0) > 0 ? 'amber' : 'slate'}
          note="próximos 7 dias"
        />
        <StatTile
          label="Manutenções"
          value={kpis?.manutencoesAbertas ?? 0}
          icon={Wrench}
          tone={(kpis?.manutencoesAbertas ?? 0) > 0 ? 'red' : 'slate'}
          note="abertas/andamento"
        />
      </KpiGrid>

      {/* Pulso por Situação — barra única do desktop, aqui filtrada por grupo */}
      <Section title="Pulso por Situação" icon={TrendingUp} tone="indigo">
        <SectionBody className="space-y-3">
          <Segmented<Grupo>
            value={grupo}
            onChange={setGrupo}
            tone="indigo"
            options={[
              { value: 'entradas', label: 'Entradas' },
              { value: 'gestao', label: 'Gestão' },
              { value: 'devolucoes', label: 'Devoluções' },
            ]}
          />
          {grupoTotal === 0 ? (
            <Empty>Nenhum imóvel registrado</Empty>
          ) : (
            <div className="space-y-2">
              {grupoSegments.map(seg => (
                <div key={seg.key} className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${seg.barClass}`} />
                  <p className="flex-1 min-w-0 text-[11px] font-semibold truncate text-slate-500">{seg.label}</p>
                  <Pill tone={SEG_TONE[seg.barClass] ?? 'slate'}>{seg.value}</Pill>
                </div>
              ))}
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Faturas Próximas */}
      <Section
        title="Faturas Próximas"
        icon={Clock}
        tone="amber"
        action={{ label: 'Ver todas', onClick: () => nav('/locacoes/gestao') }}
      >
        {proximasFaturas.length === 0 ? (
          <Empty icon={Clock}>Nenhuma fatura vencendo em breve</Empty>
        ) : (
          <RowList>
            {proximasFaturas.map((fat: LocFatura) => {
              const stCfg = STATUS_FATURA_LABEL[fat.status]
              return (
                <ListRow
                  key={fat.id}
                  title={fat.imovel?.descricao ?? '—'}
                  subtitle={`${TIPO_FATURA_LABEL[fat.tipo]} · Vence ${fmtDate(fat.vencimento)}`}
                  value={fat.valor_previsto ? fmtCurrency(fat.valor_previsto) : '—'}
                  valueSub={stCfg.label}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Contratos Vencendo / Vencidos */}
      <Section
        title="Contratos Vencendo / Vencidos"
        icon={AlertTriangle}
        tone="red"
        action={{ label: 'Ver todos', onClick: () => nav('/locacoes/gestao') }}
      >
        {contratosVencidos.length === 0 && contratosVencendo.length === 0 ? (
          <Empty icon={Calendar}>Nenhum contrato vencendo ou vencido</Empty>
        ) : (
          <RowList>
            {contratosVencidos.slice(0, 3).map((imo: LocImovel) => (
              <ListRow
                key={imo.id}
                leading={<LeadingBadge tone="red"><AlertTriangle size={14} /></LeadingBadge>}
                title={fmtEndereco(imo)}
                subtitle={`${imo.cidade || ''}${imo.cidade ? ' · ' : ''}Venceu ${fmtDate((imo as any).contrato?.data_fim_previsto)}`}
                value="Vencido"
                valueTone="red"
              />
            ))}
            {contratosVencendo.slice(0, 3).map((imo: LocImovel) => (
              <ListRow
                key={imo.id}
                leading={<LeadingBadge tone="amber"><Calendar size={14} /></LeadingBadge>}
                title={fmtEndereco(imo)}
                subtitle={`${imo.cidade || ''}${imo.cidade ? ' · ' : ''}Vence ${fmtDate((imo as any).contrato?.data_fim_previsto)}`}
                value="Vencendo"
                valueTone="amber"
              />
            ))}
          </RowList>
        )}
      </Section>

      {/* Entradas em Andamento */}
      <Section
        title="Entradas em Andamento"
        icon={LogIn}
        tone="blue"
        action={{ label: 'Ver todas', onClick: () => nav('/locacoes/entradas') }}
      >
        {entradasAndamento.length === 0 ? (
          <Empty icon={LogIn}>Nenhuma entrada em andamento</Empty>
        ) : (
          <RowList>
            {entradasAndamento.slice(0, 5).map((e: LocEntrada) => {
              const stage = ENTRADA_PIPELINE_STAGES.find(s => s.key === e.status)
              return (
                <ListRow
                  key={e.id}
                  title={e.endereco || e.imovel?.descricao || '—'}
                  subtitle={[e.cidade, e.uf].filter(Boolean).join(', ') || undefined}
                  value={stage ? <Pill tone="blue">{stage.label}</Pill> : undefined}
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Devoluções em Andamento */}
      <Section
        title="Devoluções em Andamento"
        icon={LogOut}
        tone="rose"
        action={{ label: 'Ver todas', onClick: () => nav('/locacoes/saida') }}
      >
        {saidasAndamento.length === 0 ? (
          <Empty icon={LogOut}>Nenhuma devolução em andamento</Empty>
        ) : (
          <RowList>
            {saidasAndamento.slice(0, 5).map((s: LocSaida) => {
              const stage = SAIDA_PIPELINE_STAGES.find(st => st.key === s.status)
              const isUrgent = s.data_limite_saida && new Date(s.data_limite_saida) <= new Date(Date.now() + 7 * 86400000)
              return (
                <ListRow
                  key={s.id}
                  title={s.imovel?.descricao ?? '—'}
                  subtitle={s.data_limite_saida ? `Limite: ${fmtDate(s.data_limite_saida)}${isUrgent ? ' · urgente' : ''}` : undefined}
                  value={stage ? <Pill tone="rose">{stage.label}</Pill> : undefined}
                />
              )
            })}
          </RowList>
        )}
      </Section>
    </MobilePanel>
  )
}
