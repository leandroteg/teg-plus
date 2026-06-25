import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileText, RefreshCw, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { useSgiKPIs, useDocumentos } from '../../hooks/useSgi'
import { STATUS_DOC_LABEL, TIPO_DOC_LABEL } from '../../types/sgi'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, Pill, MobileLoading, Empty,
} from '../../components/paineis-mobile/kit'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

// Versão mobile-native do Painel SGI · Gestão — MESMOS dados (useSgiKPIs + useDocumentos).
export default function SgiPainelMobile() {
  const nav = useNavigate()
  const { data: kpis, isLoading, refetch } = useSgiKPIs()
  const { data: documentos = [] } = useDocumentos()

  const recentes = useMemo(() => [...documentos].slice(0, 6), [documentos])

  if (isLoading) return <MobileLoading tone="violet" />

  const revisaoCritica = (kpis?.revisaoVencida ?? 0) > 0 || (kpis?.revisaoVencendo ?? 0) > 0

  return (
    <MobilePanel>
      <MobileHeader
        title="SGI · Gestão"
        subtitle="Sistema de Gestão Integrada — governança, documentos e melhoria"
        icon={ClipboardCheck}
        tone="violet"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-violet-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Padronização — Documentos do SGI */}
      <KpiGrid cols={3}>
        <KpiCard label="Total" value={kpis?.total ?? 0} tone="violet" note="documentos" icon={FileText} />
        <KpiCard label="Vigentes" value={kpis?.vigentes ?? 0} tone="emerald" note="políticas e processos" icon={CheckCircle2} />
        <KpiCard label="Em fluxo" value={kpis?.emFluxo ?? 0} tone="sky" note="rascunho/revisão/aprovação" icon={Clock} />
      </KpiGrid>

      {/* Janela Crítica — Revisões */}
      <Section
        title="Revisões — Janela Crítica"
        icon={AlertTriangle}
        tone={revisaoCritica ? 'red' : 'slate'}
      >
        <div className="p-4">
          <KpiGrid>
            <StatTile
              label="Revisão vencendo"
              value={kpis?.revisaoVencendo ?? 0}
              icon={Clock}
              tone={(kpis?.revisaoVencendo ?? 0) > 0 ? 'amber' : 'slate'}
              note="próximos 30 dias"
            />
            <StatTile
              label="Revisão vencida"
              value={kpis?.revisaoVencida ?? 0}
              icon={AlertTriangle}
              tone={(kpis?.revisaoVencida ?? 0) > 0 ? 'red' : 'slate'}
              note="documentos vigentes"
            />
          </KpiGrid>
        </div>
      </Section>

      {/* Documentos recentes */}
      <Section
        title="Documentos recentes"
        icon={FileText}
        tone="violet"
        action={{ label: 'Ver Padronização', onClick: () => nav('/sgi/padronizacao') }}
      >
        {recentes.length === 0 ? (
          <Empty icon={FileText}>Nenhum documento cadastrado ainda.</Empty>
        ) : (
          <RowList>
            {recentes.map(doc => {
              const st = STATUS_DOC_LABEL[doc.status]
              const tone =
                doc.status === 'vigente' ? 'emerald'
                : doc.status === 'em_revisao' ? 'blue'
                : doc.status === 'em_aprovacao' ? 'amber'
                : 'slate'
              return (
                <ListRow
                  key={doc.id}
                  leading={<LeadingBadge tone={tone}>{doc.codigo ? doc.codigo.slice(0, 3) : 'DOC'}</LeadingBadge>}
                  title={`${doc.codigo ? `${doc.codigo} · ` : ''}${doc.titulo}`}
                  subtitle={`${TIPO_DOC_LABEL[doc.tipo]} · v${doc.versao} · atualizado ${fmtDate(doc.updated_at?.split('T')[0])}`}
                  value={<Pill tone={tone}>{st.label}</Pill>}
                />
              )
            })}
          </RowList>
        )}
      </Section>
    </MobilePanel>
  )
}
