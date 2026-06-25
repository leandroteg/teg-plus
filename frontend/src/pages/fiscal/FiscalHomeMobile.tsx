import { useNavigate } from 'react-router-dom'
import {
  Receipt, Clock, AlertTriangle, FileCheck, FileText, ShoppingCart, RefreshCw, Zap,
} from 'lucide-react'
import { useNotasFiscais, useNfResumo } from '../../hooks/useNotasFiscais'
import { useSolicitacoesNF, useSolResumo } from '../../hooks/useSolicitacoesNF'
import type { NotaFiscal } from '../../types/fiscal'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody,
} from '../../components/paineis-mobile/kit'
import type { Tone } from '../../components/paineis-mobile/kit'

const fmt = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

// Pipeline de emissão — cores por estágio (mesma ordem/semântica do desktop)
const PIPELINE_BAR: Record<string, string> = {
  pendente: 'bg-slate-400', em_emissao: 'bg-blue-400', aguardando: 'bg-amber-400',
  emitidas: 'bg-emerald-500', rejeitadas: 'bg-red-400',
}
const ORIGEM_TONE: Record<string, Tone> = { pedido: 'teal', cp: 'blue', contrato: 'violet', avulso: 'amber' }

// Versão mobile-native do Painel Fiscal — MESMOS dados (useNotasFiscais + useSolicitacoesNF).
export default function FiscalHomeMobile() {
  const nav = useNavigate()

  const now = new Date()
  const { data: notas = [], isLoading, refetch } = useNotasFiscais({ mes: now.getMonth() + 1, ano: now.getFullYear() })
  const { data: solicitacoes = [] } = useSolicitacoesNF({})
  const nfResumo = useNfResumo(notas)
  const solResumo = useSolResumo(solicitacoes)

  // Pipeline bar data (idêntico ao desktop)
  const pipelineSegments = [
    { key: 'pendente',   label: 'Pendentes',  value: solResumo.pendentes,  barClass: 'bg-slate-400' },
    { key: 'em_emissao', label: 'Em Emissao', value: solResumo.em_emissao, barClass: 'bg-blue-400' },
    { key: 'aguardando', label: 'Aprovacao',  value: solResumo.aguardando, barClass: 'bg-amber-400' },
    { key: 'emitidas',   label: 'Emitidas',   value: solResumo.emitidas,   barClass: 'bg-emerald-500' },
    { key: 'rejeitadas', label: 'Rejeitadas', value: solResumo.rejeitadas, barClass: 'bg-red-400' },
  ].filter(s => s.value > 0)
  const totalPipeline = pipelineSegments.reduce((s, seg) => s + seg.value, 0) || 1

  // Por origem (idêntico ao desktop)
  const origemData = [
    { key: 'pedido',   label: 'Pedidos',      value: nfResumo.porOrigem.pedido,   barClass: 'bg-teal-500' },
    { key: 'cp',       label: 'Contas Pagar', value: nfResumo.porOrigem.cp,       barClass: 'bg-blue-500' },
    { key: 'contrato', label: 'Contratos',    value: nfResumo.porOrigem.contrato, barClass: 'bg-violet-500' },
    { key: 'avulso',   label: 'Avulso',       value: nfResumo.porOrigem.avulso,   barClass: 'bg-amber-500' },
  ].filter(o => o.value > 0)
  const maxOrigem = Math.max(...origemData.map(o => o.value), 1)

  // Recentes (mesma ordenação do desktop)
  const recentes = [...notas].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).slice(0, 6)

  if (isLoading) return <MobileLoading tone="teal" />

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel Fiscal"
        subtitle="Notas fiscais, solicitações e pipeline de emissão"
        icon={Receipt}
        tone="teal"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-teal-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Indicadores do mês */}
      <KpiGrid>
        <KpiCard label="Notas no Mês" value={nfResumo.count} tone="teal" icon={Receipt} note={fmt(nfResumo.total)} />
        <KpiCard label="Valor Total NF" value={fmt(nfResumo.total)} tone="emerald" icon={FileText} note={`${nfResumo.count} notas`} />
      </KpiGrid>

      <KpiGrid cols={3}>
        <StatTile label="Solicitações" value={solResumo.total} icon={FileCheck} tone="blue" note={`${solResumo.emitidas} emitidas`} />
        <StatTile label="Pendentes" value={solResumo.pendentes} icon={Clock} tone={solResumo.pendentes > 0 ? 'amber' : 'slate'} note={solResumo.pendentes > 0 ? 'aguard. emissão' : 'tudo ok'} />
        <StatTile label="Rejeitadas" value={solResumo.rejeitadas} icon={AlertTriangle} tone={solResumo.rejeitadas > 0 ? 'red' : 'slate'} note={solResumo.rejeitadas > 0 ? 'requer atenção' : 'nenhuma'} />
      </KpiGrid>

      {/* Pipeline de emissão */}
      <Section title="Pipeline de Emissão" icon={solResumo.pendentes > 0 ? Zap : FileCheck} tone="teal">
        <SectionBody>
          {pipelineSegments.length === 0 ? (
            <Empty>Nenhuma solicitação no período</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {pipelineSegments.map(s => {
                  const pct = (s.value / totalPipeline) * 100
                  return (
                    <div key={s.key} className={`${s.barClass} flex items-center justify-center transition-all`}
                      style={{ width: `${Math.max(pct, 4)}%` }} title={`${s.label}: ${s.value}`}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white">{s.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {pipelineSegments.map(s => (
                  <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${PIPELINE_BAR[s.key]}`} /> {s.label} · {s.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Notas recentes */}
      <Section title="Notas Recentes" icon={FileText} tone="teal" action={{ label: 'Ver todas', onClick: () => nav('/fiscal') }}>
        {recentes.length === 0 ? (
          <Empty icon={FileText}>Nenhuma NF no período</Empty>
        ) : (
          <RowList>
            {recentes.map((nf: NotaFiscal) => (
              <ListRow
                key={nf.id}
                leading={<LeadingBadge tone="teal">{nf.numero ? `${nf.numero}`.slice(-3) : '---'}</LeadingBadge>}
                title={nf.fornecedor_nome || 'Sem fornecedor'}
                subtitle={`NF ${nf.numero || '---'} · ${fmtData(nf.data_emissao)} · ${nf.origem}`}
                value={fmt(nf.valor_total)}
                valueTone="emerald"
              />
            ))}
          </RowList>
        )}
      </Section>

      {/* Por origem */}
      <Section title="Por Origem" icon={ShoppingCart} tone="teal">
        <SectionBody className="space-y-2.5">
          {origemData.length === 0 ? (
            <Empty>Nenhuma NF no período</Empty>
          ) : origemData.map(o => (
            <BarStat key={o.key} label={o.label} value={o.value} pct={(o.value / maxOrigem) * 100} tone={ORIGEM_TONE[o.key]} />
          ))}
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
