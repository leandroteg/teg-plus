import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, RefreshCw, FileText, Target, Sparkles, CheckCircle2, Scale, Ruler, Gauge, DollarSign } from 'lucide-react'
import { useOrcamentos } from '../../hooks/useOrcamentacao'
import type { Orcamento } from '../../types/orcamentacao'
import { fmtMM, fmtNum, fmtData } from './_ui'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  SectionBody, RowList, ListRow, LeadingBadge, Pill, Empty, MobileLoading,
} from '../../components/paineis-mobile/kit'
import type { Tone } from '../../components/paineis-mobile/kit'

// Versão mobile-native do Painel — Orçamentação. MESMOS dados (useOrcamentos),
// mesmas métricas derivadas inline do desktop (OrcamentacaoHome.tsx).
const STATUS_TONE: Record<string, Tone> = {
  rascunho: 'slate', processando: 'amber', concluido: 'emerald', erro: 'rose',
}
const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', processando: 'Processando', concluido: 'Concluído', erro: 'Erro',
}

export default function OrcamentacaoHomeMobile() {
  const nav = useNavigate()
  const { data: orcamentos = [], isLoading, refetch } = useOrcamentos()

  const m = useMemo(() => {
    const concl = orcamentos.filter(o => o.status === 'concluido')
    const proc = orcamentos.filter(o => o.status === 'processando').length
    const ext = concl.reduce((s, o) => s + (o.resultado?.resumo?.extensao_km ?? 0), 0)
    const custo = concl.reduce((s, o) => s + (o.resultado?.resumo?.custo_total ?? 0), 0)
    const us = concl.reduce((s, o) => s + (o.resultado?.resumo?.us ?? 0), 0)
    // assertividade
    const exatos = concl.filter(o => (o.resultado?.premissas_usadas as Record<string, unknown> | undefined)?.us_exato === true).length
    const comIA = concl.filter(o => String((o.resultado?.premissas_usadas as Record<string, unknown> | undefined)?.analise_por ?? '').includes('Claude')).length
    const desvios = concl.map(o => o.resultado?.comparacao?.desvio_vs_frente_pct).filter((v): v is number => typeof v === 'number').map(Math.abs)
    const desvioMedio = desvios.length ? desvios.reduce((a, b) => a + b, 0) / desvios.length : null
    return { total: orcamentos.length, concl: concl.length, proc, ext, custo, us, exatos, comIA, desvioMedio }
  }, [orcamentos])

  const recentes = orcamentos.slice(0, 5)

  if (isLoading) return <MobileLoading tone="amber" />

  const pctExato = m.concl ? Math.round(100 * m.exatos / m.concl) : 0
  const pctIA = m.concl ? Math.round(100 * m.comIA / m.concl) : 0

  return (
    <MobilePanel>
      <MobileHeader
        title="Orçamentação"
        subtitle="Carteira de orçamentos de LT (custo, US e assertividade)"
        icon={MapIcon}
        tone="amber"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-amber-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* KPIs principais */}
      <KpiGrid>
        <KpiCard label="Orçamentos" value={m.total} tone="indigo" note={`${m.concl} concluído(s) · ${m.proc} processando`} />
        <KpiCard label="Custo estimado" value={fmtMM(m.custo)} tone="amber" note="custo real Nibo+TOTVS" icon={DollarSign} />
      </KpiGrid>

      <KpiGrid>
        <StatTile label="Extensão est." value={`${fmtNum(m.ext, 0)} km`} icon={Ruler} tone="sky" note="LTs concluídas" />
        <StatTile label="Total de US" value={fmtNum(m.us)} icon={Gauge} tone="teal" note="unid. serviço CEMIG" />
      </KpiGrid>

      {/* Assertividade */}
      <Section title="Assertividade" icon={Target} tone="amber">
        <SectionBody className="space-y-2.5">
          <ListRow
            leading={<LeadingBadge tone="emerald"><CheckCircle2 size={16} /></LeadingBadge>}
            title="Custo exato (US do edital)"
            subtitle={`${m.exatos} de ${m.concl} · resto estimado pela geometria`}
            value={`${pctExato}%`}
            valueTone="emerald"
          />
          <ListRow
            leading={<LeadingBadge tone="amber"><Sparkles size={16} /></LeadingBadge>}
            title="Analisado pelo SuperTEG"
            subtitle="terreno por obra/região"
            value={`${pctIA}%`}
            valueTone="amber"
          />
          <ListRow
            leading={<LeadingBadge tone="sky"><Scale size={16} /></LeadingBadge>}
            title="Desvio médio vs carteira"
            subtitle="custo/torre vs frentes reais"
            value={m.desvioMedio == null ? '—' : `±${fmtNum(m.desvioMedio, 0)}%`}
            valueTone="sky"
          />
        </SectionBody>
      </Section>

      {/* Recentes */}
      <Section title="Recentes" icon={FileText} tone="amber" action={{ label: 'Ver todos', onClick: () => nav('/orcamentacao/orcamentos') }}>
        {recentes.length === 0 ? (
          <Empty icon={FileText}>Nenhum orçamento ainda</Empty>
        ) : (
          <RowList>
            {recentes.map((o: Orcamento) => {
              const r = o.resultado?.resumo
              return (
                <ListRow
                  key={o.id}
                  onClick={() => nav(`/orcamentacao/${o.id}`)}
                  leading={<Pill tone={STATUS_TONE[o.status] ?? 'slate'}>{STATUS_LABEL[o.status] ?? o.status}</Pill>}
                  title={o.nome}
                  subtitle={`${o.numero ?? '—'} · ${r ? `${fmtNum(r.extensao_km, 1)} km · ${fmtNum(r.us)} US` : (o.descricao || 'Aguardando estimativa')} · ${fmtData(o.created_at)}`}
                  value={r ? fmtMM(r.custo_total) : undefined}
                  valueSub={r ? 'custo' : undefined}
                  valueTone="amber"
                />
              )
            })}
          </RowList>
        )}
      </Section>
    </MobilePanel>
  )
}
