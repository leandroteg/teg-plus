import {
  Landmark, FileText, ArrowLeftRight, Zap,
  Archive, ArrowDownUp, Clock, Wrench, TrendingDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePatrimonialKPIs, useImobilizados, useMovimentacoesPatrimonial } from '../../hooks/usePatrimonial'
import type { PatMovimentacao } from '../../types/estoque'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody, Pill,
} from '../../components/paineis-mobile/kit'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// Versão mobile-native do Painel Patrimonial — MESMOS dados
// (usePatrimonialKPIs · useImobilizados · useMovimentacoesPatrimonial).
export default function PatrimonialHomeMobile() {
  const nav = useNavigate()
  const { data: kpis, isLoading: loadingKpis } = usePatrimonialKPIs()
  const { data: imobilizados = [], isLoading: loadingImob } = useImobilizados()
  const { data: movimentacoes = [], isLoading: loadingMov } = useMovimentacoesPatrimonial()

  if (loadingKpis || loadingImob || loadingMov) return <MobileLoading tone="amber" />

  // ── Derivações idênticas ao desktop ──
  const aguardandoEntrada = imobilizados.filter(i => i.status === 'pendente_registro').length
  const ativos = imobilizados.filter(i => ['ativo', 'cedido', 'em_transferencia'].includes(i.status)).length
  const emManutencao = kpis?.imobilizados_em_manutencao ?? 0
  const depreciados = imobilizados.filter(i => (i.percentual_depreciado ?? 0) >= 100 && i.status !== 'baixado').length
  const baixados = imobilizados.filter(i => i.status === 'baixado').length
  const recentes = movimentacoes.slice(0, 8)

  // Status distribution for bar
  const statusSegments = [
    { key: 'aguardando', label: 'Aguardando',  value: aguardandoEntrada, barClass: 'bg-violet-500' },
    { key: 'ativo',      label: 'Ativos',      value: ativos,            barClass: 'bg-emerald-500' },
    { key: 'manutencao', label: 'Manutencao',  value: emManutencao,      barClass: 'bg-amber-500' },
    { key: 'depreciado', label: 'Depreciados', value: depreciados,       barClass: 'bg-red-500' },
    { key: 'baixado',    label: 'Baixados',    value: baixados,          barClass: 'bg-slate-400' },
  ]
  const totalAtivos = statusSegments.reduce((s, seg) => s + seg.value, 0)

  // Categorias para chart
  const catMap = new Map<string, { nome: string; valor: number; qtd: number }>()
  imobilizados.filter(i => i.status !== 'baixado').forEach(i => {
    const nome = i.categoria || 'Sem categoria'
    const cur = catMap.get(nome) || { nome, valor: 0, qtd: 0 }
    cur.valor += (i as any).valor_liquido ?? i.valor_aquisicao ?? 0
    cur.qtd += 1
    catMap.set(nome, cur)
  })
  const categorias = Array.from(catMap.values()).sort((a, b) => b.valor - a.valor)
  const maxCatVal = categorias[0]?.valor || 1

  const criticos = aguardandoEntrada + (kpis?.termos_pendentes ?? 0)
  const segVisiveis = statusSegments.filter(s => s.value > 0)

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel Patrimonial"
        subtitle="Ativos, depreciação e movimentações"
        icon={Landmark}
        tone="amber"
      />

      {/* ── Indicadores do portfólio ── */}
      <KpiGrid cols={3}>
        <KpiCard label="Total Ativos" value={kpis?.total_imobilizados ?? 0} tone="amber" note={`${ativos} em uso`} />
        <KpiCard label="Valor Líquido" value={fmt(kpis?.valor_total_liquido ?? 0)} tone="emerald" note="contábil atual" />
        <KpiCard label="Deprec. Acum." value={fmt((kpis as any)?.depreciacao_acumulada ?? 0)} tone="red" note={depreciados > 0 ? `${depreciados} 100% deprec.` : 'nenhum 100%'} />
      </KpiGrid>

      {/* ── Janela Crítica ── */}
      <Section title="Janela Crítica" icon={Zap} tone={criticos > 0 ? 'red' : 'slate'}>
        <SectionBody>
          <KpiGrid>
            <StatTile
              label="Aguardando Entrada"
              value={aguardandoEntrada}
              icon={ArrowDownUp}
              tone={aguardandoEntrada > 0 ? 'violet' : 'slate'}
              note={aguardandoEntrada > 0 ? 'pendentes de registro' : 'tudo ok'}
            />
            <StatTile
              label="Termos Pendentes"
              value={kpis?.termos_pendentes ?? 0}
              icon={FileText}
              tone={(kpis?.termos_pendentes ?? 0) > 0 ? 'red' : 'slate'}
              note="responsabilidade"
            />
          </KpiGrid>
        </SectionBody>
      </Section>

      {/* ── Pulso por Status ── */}
      <Section title="Pulso por Status" icon={Landmark} tone="amber">
        <SectionBody>
          {totalAtivos === 0 ? (
            <Empty icon={Archive}>Nenhum ativo cadastrado</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-10 rounded-xl overflow-hidden">
                {segVisiveis.map(seg => {
                  const pct = (seg.value / totalAtivos) * 100
                  return (
                    <div key={seg.key} className={`${seg.barClass} relative flex items-center justify-center transition-all`}
                      style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white drop-shadow-sm">{seg.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segVisiveis.map(seg => (
                  <span key={seg.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${seg.barClass}`} /> {seg.label} · {seg.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* ── Movimentações Recentes ── */}
      <Section
        title="Movimentações Recentes"
        icon={Clock}
        tone="amber"
        action={{ label: 'Ver todas', onClick: () => nav('/patrimonial/movimentacoes') }}
      >
        {recentes.length === 0 ? (
          <Empty icon={ArrowLeftRight}>Nenhuma movimentação</Empty>
        ) : (
          <RowList>
            {recentes.map((mov: PatMovimentacao) => (
              <ListRow
                key={mov.id}
                leading={
                  <LeadingBadge tone={mov.tipo === 'manutencao' ? 'amber' : 'amber'}>
                    {mov.tipo === 'manutencao' ? <Wrench size={14} /> : <ArrowLeftRight size={14} />}
                  </LeadingBadge>
                }
                title={`${mov.imobilizado?.numero_patrimonio ?? '--'} — ${mov.imobilizado?.descricao ?? 'Sem descricao'}`}
                subtitle={`${mov.tipo}${mov.responsavel_destino ? ` — ${mov.responsavel_destino}` : ''}`}
                value={<Pill tone={mov.confirmado ? 'emerald' : 'amber'}>{mov.confirmado ? 'Confirmado' : 'Pendente'}</Pill>}
                valueSub={new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}
              />
            ))}
          </RowList>
        )}
      </Section>

      {/* ── Valor por Categoria ── */}
      <Section title="Valor por Categoria" icon={TrendingDown} tone="amber">
        <SectionBody className="space-y-2.5">
          {categorias.length === 0 ? (
            <Empty icon={Archive}>Nenhum ativo</Empty>
          ) : (
            categorias.slice(0, 8).map(c => (
              <BarStat key={c.nome} label={c.nome} value={fmt(c.valor)} pct={(c.valor / maxCatVal) * 100} tone="amber" />
            ))
          )}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
