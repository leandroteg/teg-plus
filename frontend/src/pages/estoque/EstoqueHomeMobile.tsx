import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package2, DollarSign, AlertTriangle, RefreshCw, TrendingUp, Activity,
  Clock, FileText, ArrowLeftRight, MapPin, ShieldAlert, Boxes,
} from 'lucide-react'
import {
  useEstoqueKPIs, useSaldosAbaixoMinimo, useMovimentacoes, useSolicitacoes,
  useAguardandoEntrada, useLiberadosRetirada, useBases, useRCsEmTriagemCD,
} from '../../hooks/useEstoque'
import { useCautelas } from '../../hooks/useCautelas'
import { useAuth } from '../../contexts/AuthContext'
import type { Tone } from '../../components/paineis-mobile/kit'
import {
  MobilePanel, MobileHeader, Segmented, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, Pill, MobileLoading, Empty, SectionBody,
} from '../../components/paineis-mobile/kit'

const fmtCurrency = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// Versão mobile-native do Painel de Estoque — MESMOS dados/hooks do EstoqueHome desktop.
export default function EstoqueHomeMobile() {
  const nav = useNavigate()
  const [aba, setAba] = useState('painel')

  const { data: kpis, isLoading, refetch } = useEstoqueKPIs()
  const { data: abaixoMinimo = [] } = useSaldosAbaixoMinimo()
  const { data: movimentacoes = [] } = useMovimentacoes()
  const { data: solicitacoes = [] } = useSolicitacoes()
  const { data: cautelasEmAberto = [] } = useCautelas({ status: 'em_aberto' })
  const { data: aguardandoEntrada = [] } = useAguardandoEntrada()
  const { data: liberadosRetirada = [] } = useLiberadosRetirada()
  const { data: bases = [] } = useBases()
  const { data: rcsEmTriagem = [] } = useRCsEmTriagemCD()
  const { perfil, isAdmin } = useAuth()

  const minhaBase = perfil?.base_id ? bases.find(b => b.id === perfil.base_id) : null
  const isTriador = isAdmin || Boolean((minhaBase as any)?.faz_triagem)
  const restritoABase = Boolean(minhaBase) && !isAdmin && !isTriador

  // Solicitações pendentes (aberta) — mesma derivação do desktop
  const solicitacoesPendentes = useMemo(() =>
    solicitacoes.filter(s => s.status === 'aberta')
  , [solicitacoes])

  // Saldos com estoque positivo (regular) — mesma aproximação do desktop
  const saldosEmEstoque = useMemo(() => {
    const total = kpis?.total_itens ?? 0
    const abaixo = abaixoMinimo.length
    return Math.max(total - abaixo, 0)
  }, [kpis, abaixoMinimo])

  // Pulso segments — mesmos valores/ordem do desktop
  const statusSegments = useMemo(() => [
    { key: 'aguardando_entrada', label: 'Aguard. Entrada', value: aguardandoEntrada.length, tone: 'slate' as Tone, bar: 'bg-slate-400' },
    { key: 'em_estoque', label: 'Em Estoque', value: saldosEmEstoque, tone: 'emerald' as Tone, bar: 'bg-emerald-500' },
    { key: 'liberado_retirada', label: 'Liber. Retirada', value: liberadosRetirada.length, tone: 'sky' as Tone, bar: 'bg-sky-500' },
    { key: 'em_cautela', label: 'Em Cautela', value: cautelasEmAberto.length, tone: 'violet' as Tone, bar: 'bg-violet-500' },
    { key: 'abaixo_minimo', label: 'Abaixo Mínimo', value: abaixoMinimo.length, tone: 'red' as Tone, bar: 'bg-red-500' },
  ], [aguardandoEntrada, saldosEmEstoque, liberadosRetirada, cautelasEmAberto, abaixoMinimo])
  const pulsoTotal = statusSegments.reduce((s, seg) => s + seg.value, 0)

  if (isLoading) return <MobileLoading tone="teal" />

  return (
    <MobilePanel>
      <MobileHeader
        title="Estoque"
        subtitle="Almoxarifado, cautelas e movimentações"
        icon={Package2}
        tone="teal"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-teal-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {restritoABase && minhaBase && (
        <div className="flex">
          <Pill tone="teal"><MapPin size={11} /> {minhaBase.nome} · apenas seu polo</Pill>
        </div>
      )}

      <Segmented
        value={aba}
        onChange={setAba}
        options={[{ value: 'painel', label: 'Painel' }, { value: 'indicadores', label: 'Indicadores' }]}
        tone="emerald"
      />

      {aba === 'indicadores' ? (
        <Section title="Indicadores" icon={Activity} tone="teal">
          <Empty icon={Activity}>Abra o painel de indicadores na versão desktop.</Empty>
        </Section>
      ) : (<>
        {/* Aviso de triagem — só para quem faz triagem no CD */}
        {isTriador && solicitacoesPendentes.length > 0 && (
          <Section title="Triagem pendente" icon={FileText} tone="amber" action={{ label: 'Atender', onClick: () => nav('/estoque/solicitacoes') }}>
            <SectionBody>
              <p className="text-sm font-bold text-amber-500">
                {solicitacoesPendentes.length} {solicitacoesPendentes.length === 1 ? 'solicitação nova aguardando triagem' : 'solicitações novas aguardando triagem'}
              </p>
              <p className="text-xs text-amber-500/70 mt-0.5">Atenda pelo estoque ou encaminhe ao Compras</p>
            </SectionBody>
          </Section>
        )}

        {/* Núcleo de Estoque — KPIs gerais */}
        <KpiGrid cols={3}>
          <StatTile label="Total Itens" value={kpis?.total_itens ?? 0} icon={Boxes} tone="teal" note="ativos" />
          <StatTile label="Valor Estoque" value={fmtCurrency(kpis?.valor_estoque_total ?? 0)} icon={DollarSign} tone="emerald" note="saldo × médio" />
          <StatTile label="Mov./Mês" value={kpis?.movimentacoes_mes ?? 0} icon={ArrowLeftRight} tone="sky" note="30 dias" />
        </KpiGrid>

        {/* Triagem CD — RCs aguardando triagem */}
        <Section title="Triagem CD" icon={ShieldAlert} tone="sky" action={{ label: `Ver (${rcsEmTriagem.length})`, onClick: () => nav('/requisicoes?tab=em_triagem') }}>
          {rcsEmTriagem.length === 0 ? (
            <Empty icon={ShieldAlert}>Nenhuma RC aguardando triagem</Empty>
          ) : (
            <RowList>
              {rcsEmTriagem.slice(0, 4).map(rc => {
                const diasParado = Math.floor((Date.now() - new Date(rc.created_at).getTime()) / 86400000)
                const tagVelho = diasParado >= 2
                return (
                  <ListRow
                    key={rc.id}
                    onClick={() => nav(`/requisicoes/${rc.id}`)}
                    leading={<LeadingBadge tone="sky">{rc.numero?.slice(-3) ?? '—'}</LeadingBadge>}
                    title={rc.solicitante_nome}
                    subtitle={`${rc.obra_nome ?? '—'}${rc.categoria ? ' · ' + rc.categoria.replace(/_/g, ' ') : ''}`}
                    value={diasParado === 0 ? 'Hoje' : `${diasParado}d`}
                    valueTone={tagVelho ? 'amber' : 'sky'}
                  />
                )
              })}
            </RowList>
          )}
        </Section>

        {/* Pulso por Situação — pipeline de estoque */}
        <Section title="Pulso por Situação" icon={TrendingUp} tone="teal">
          <SectionBody>
            {pulsoTotal === 0 ? (
              <Empty>Nenhum item registrado</Empty>
            ) : (
              <div className="space-y-2.5">
                <div className="flex h-9 rounded-xl overflow-hidden">
                  {statusSegments.map(seg => {
                    if (seg.value === 0) return null
                    const pct = (seg.value / pulsoTotal) * 100
                    return (
                      <div key={seg.key} className={`${seg.bar} flex items-center justify-center`}
                        style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                        {pct >= 16 && <span className="text-[10px] font-bold text-white">{seg.value}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {statusSegments.map(seg => (
                    <span key={seg.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className={`w-2 h-2 rounded-full ${seg.bar}`} /> {seg.label} · {seg.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SectionBody>
        </Section>

        {/* Itens Abaixo do Mínimo */}
        <Section title="Itens Abaixo do Mínimo" icon={AlertTriangle} tone="red" action={{ label: 'Ver todos', onClick: () => nav('/estoque/itens') }}>
          {abaixoMinimo.length === 0 ? (
            <Empty icon={AlertTriangle}>Nenhum item abaixo do estoque mínimo.</Empty>
          ) : (
            <RowList>
              {abaixoMinimo.slice(0, 5).map(saldo => (
                <ListRow
                  key={saldo.id}
                  title={saldo.item?.descricao ?? '—'}
                  subtitle={`${saldo.base?.nome ?? '—'} · Cod: ${saldo.item?.codigo ?? '—'}`}
                  value={`${saldo.saldo} ${saldo.item?.unidade ?? ''}`}
                  valueSub={`min: ${saldo.item?.estoque_minimo ?? '—'}`}
                  valueTone="red"
                />
              ))}
            </RowList>
          )}
        </Section>

        {/* Últimas Movimentações */}
        <Section title="Últimas Movimentações" icon={ArrowLeftRight} tone="sky" action={{ label: 'Ver todas', onClick: () => nav('/estoque/movimentacoes') }}>
          {movimentacoes.length === 0 ? (
            <Empty icon={ArrowLeftRight}>Nenhuma movimentação recente.</Empty>
          ) : (
            <RowList>
              {movimentacoes.slice(0, 5).map(mov => {
                const tipoCfg: Record<string, { label: string; tone: Tone }> = {
                  entrada: { label: 'Entrada', tone: 'emerald' },
                  saida: { label: 'Saída', tone: 'red' },
                  transferencia_in: { label: 'Transf. In', tone: 'sky' },
                  transferencia_out: { label: 'Transf. Out', tone: 'amber' },
                  ajuste_positivo: { label: 'Ajuste +', tone: 'indigo' },
                  ajuste_negativo: { label: 'Ajuste -', tone: 'amber' },
                  baixa: { label: 'Baixa', tone: 'slate' },
                }
                const cfg = tipoCfg[mov.tipo] ?? { label: mov.tipo, tone: 'slate' as Tone }
                return (
                  <ListRow
                    key={mov.id}
                    title={(mov as any).item?.descricao ?? '—'}
                    subtitle={`${mov.quantidade} un · ${fmtDate(mov.criado_em)}`}
                    value={<Pill tone={cfg.tone}>{cfg.label}</Pill>}
                  />
                )
              })}
            </RowList>
          )}
        </Section>

        {/* Cautelas em Aberto */}
        <Section title="Cautelas em Aberto" icon={ShieldAlert} tone="violet" action={{ label: 'Ver todas', onClick: () => nav('/estoque/cautelas') }}>
          {cautelasEmAberto.length === 0 ? (
            <Empty icon={ShieldAlert}>Nenhuma cautela em aberto.</Empty>
          ) : (
            <RowList>
              {cautelasEmAberto.slice(0, 5).map(c => {
                const today = new Date().toISOString().split('T')[0]
                const vencida = c.data_devolucao_prevista && c.data_devolucao_prevista < today
                return (
                  <ListRow
                    key={c.id}
                    leading={vencida ? <LeadingBadge tone="red"><AlertTriangle size={14} /></LeadingBadge> : <LeadingBadge tone="violet"><ShieldAlert size={14} /></LeadingBadge>}
                    title={c.solicitante_nome ?? '—'}
                    subtitle={`${c.obra_nome ?? '—'} · Dev: ${fmtDate(c.data_devolucao_prevista)}`}
                    value={<Pill tone={vencida ? 'red' : 'violet'}>{vencida ? 'Vencida' : 'Em aberto'}</Pill>}
                  />
                )
              })}
            </RowList>
          )}
        </Section>

        {/* Solicitações Pendentes */}
        <Section title="Solicitações Pendentes" icon={FileText} tone="amber" action={{ label: 'Ver todas', onClick: () => nav('/estoque/solicitacoes') }}>
          {solicitacoesPendentes.length === 0 ? (
            <Empty icon={FileText}>Nenhuma solicitação pendente.</Empty>
          ) : (
            <RowList>
              {solicitacoesPendentes.slice(0, 5).map(sol => {
                const urgenciaMap: Record<string, { label: string; tone: Tone }> = {
                  normal: { label: 'Normal', tone: 'slate' },
                  urgente: { label: 'Urgente', tone: 'amber' },
                  emergencia: { label: 'Emergência', tone: 'red' },
                }
                const urg = urgenciaMap[sol.urgencia] ?? urgenciaMap.normal
                return (
                  <ListRow
                    key={sol.id}
                    leading={<LeadingBadge tone="amber"><Clock size={14} /></LeadingBadge>}
                    title={sol.solicitante_nome}
                    subtitle={`${sol.obra_nome ?? '—'} · ${fmtDate(sol.criado_em)}`}
                    value={<Pill tone={urg.tone}>{urg.label}</Pill>}
                  />
                )
              })}
            </RowList>
          )}
        </Section>
      </>)}
    </MobilePanel>
  )
}
