import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, FileText, RefreshCw, AlertTriangle, Clock, CheckCircle2, Target, RefreshCcw, ArrowRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSgiKPIs, useDocumentos, useObjetivos } from '../../hooks/useSgi'
import { STATUS_DOC_LABEL, TIPO_DOC_LABEL, FAROL_CFG } from '../../types/sgi'
import type { SgiMeta, SgiCheckin, SgiObjetivo, Farol } from '../../types/sgi'
import {
  MobilePanel, MobileHeader, KpiGrid, StatTile, Section, SectionBody,
  RowList, ListRow, LeadingBadge, Pill, MobileLoading, Empty,
} from '../../components/paineis-mobile/kit'

const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const FAROL_ORDER: Farol[] = ['verde', 'amarelo', 'vermelho', 'cinza']
const FAROL_BAR: Record<Farol, string> = { verde: 'bg-emerald-500', amarelo: 'bg-amber-500', vermelho: 'bg-red-500', cinza: 'bg-slate-300' }

type MetaFull = SgiMeta & { checkins: SgiCheckin[] }
type ObjFull = SgiObjetivo & { metas: MetaFull[] }

const ultimoCheckin = (m: MetaFull): SgiCheckin | null =>
  m.checkins?.length ? [...m.checkins].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))[0] : null

const fmtVal = (v: number | null | undefined, unidade?: string | null) => {
  if (v == null) return '—'
  const n = v.toLocaleString('pt-BR')
  return unidade === '%' ? `${n}%` : unidade ? `${n} ${unidade}` : n
}

const METAS_PRINCIPAIS = ['Produção', 'Lucratividade', 'Acidentes graves'] as const
const METAS_APOIO = ['Produtividade', 'Novos contratos', 'Turnover', 'Clima organizacional'] as const

// Versão mobile do Painel SGI · Gestão — mesmos dados do desktop, ajustado para telas pequenas.
export default function SgiPainelMobile() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis, isLoading, refetch: refetchKpis } = useSgiKPIs()
  const { data: objetivos = [], refetch: refetchObj } = useObjetivos()
  const { data: documentos = [] } = useDocumentos()

  const refetch = () => { refetchKpis(); refetchObj() }
  const recentes = useMemo(() => [...documentos].slice(0, 6), [documentos])

  const anuais = useMemo(() =>
    (objetivos as ObjFull[]).flatMap(o => o.metas.filter(m => m.periodo === 'anual').map(m => ({ o, m, u: ultimoCheckin(m) })))
  , [objetivos])

  const byT = useMemo(() =>
    Object.fromEntries(anuais.map(a => [a.o.titulo, a])) as Record<string, { o: ObjFull; m: MetaFull; u: SgiCheckin | null }>
  , [anuais])

  const faroisAnuais = useMemo(() => {
    const c: Record<Farol, number> = { verde: 0, amarelo: 0, vermelho: 0, cinza: 0 }
    anuais.forEach(a => { c[(a.u?.farol as Farol) || 'cinza']++ })
    return c
  }, [anuais])

  const tris = useMemo(() => [1, 2, 3, 4].map(t => {
    const ms = (objetivos as ObjFull[]).flatMap(o => o.metas.filter(m => m.periodo === 'trimestral' && m.trimestre === t).map(m => ultimoCheckin(m)))
    const c: Record<Farol, number> = { verde: 0, amarelo: 0, vermelho: 0, cinza: 0 }
    ms.forEach(u => { c[(u?.farol as Farol) || 'cinza']++ })
    return { t, total: ms.length, c }
  }).filter(x => x.total > 0), [objetivos])

  if (isLoading) return <MobileLoading tone="violet" />

  const revisaoCritica = (kpis?.revisaoVencida ?? 0) > 0 || (kpis?.revisaoVencendo ?? 0) > 0
  const card = isDark ? 'bg-[#111827] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const faint = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <MobilePanel>
      <MobileHeader
        title="SGI · Gestão"
        subtitle="Governança: objetivos, metas, melhoria contínua e documentos"
        icon={ClipboardCheck}
        tone="violet"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-violet-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Scorecard Estratégico — metas anuais */}
      {anuais.length > 0 && (
        <Section
          title="Scorecard Estratégico 2026"
          icon={Target}
          tone="violet"
          action={{ label: 'Ver Objetivos', onClick: () => nav('/sgi/objetivos') }}
        >
          <SectionBody className="space-y-3">
            {/* faróis resumidos */}
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="inline-flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />{faroisAnuais.verde}</span>
              <span className="inline-flex items-center gap-1 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500" />{faroisAnuais.amarelo}</span>
              {faroisAnuais.vermelho > 0 && <span className="inline-flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-500" />{faroisAnuais.vermelho}</span>}
            </div>
            {/* Metas principais */}
            <div className="space-y-0">
              {[...METAS_PRINCIPAIS, ...METAS_APOIO].filter(t => byT[t]).map(titulo => {
                const { o, u } = byT[titulo]
                const fr = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                const num = u?.realizado != null ? u.realizado.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'
                return (
                  <div key={titulo} className={`flex items-center justify-between gap-3 py-2.5 border-b last:border-b-0 ${isDark ? 'border-white/[0.05]' : 'border-slate-100'}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${faint}`}>{o.area_processo || '—'}</p>
                      <p className={`text-sm font-bold truncate ${txt}`}>{titulo}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-extrabold leading-none ${fr.text}`}>{num}{o.unidade === '%' ? '%' : ''}</p>
                      <p className={`text-[9px] ${faint}`}>meta {o.direcao === 'menor_melhor' ? '≤' : '≥'} {fmtVal(byT[titulo]?.m.alvo, o.unidade)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${fr.bg} ${fr.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${fr.dot}`} />{fr.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </SectionBody>
        </Section>
      )}

      {/* OKRs por Trimestre */}
      {tris.length > 0 && (
        <Section
          title="OKRs por Trimestre"
          icon={Target}
          tone="teal"
          action={{ label: 'Ver check-in', onClick: () => nav('/sgi/objetivos') }}
        >
          <SectionBody className="space-y-3">
            {tris.map(({ t, total, c }) => (
              <div key={t} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-16 shrink-0 ${txt}`}>Trim. {t}</span>
                <div className={`flex-1 flex h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  {FAROL_ORDER.map(fk => c[fk] > 0
                    ? <div key={fk} className={FAROL_BAR[fk]} style={{ width: `${(c[fk] / total) * 100}%` }} title={`${FAROL_CFG[fk].label}: ${c[fk]}`} />
                    : null
                  )}
                </div>
                <span className={`text-[10px] font-semibold shrink-0 text-right w-24 ${faint}`}>
                  {c.verde}✓ · {c.amarelo}~ · {c.vermelho}✕{c.cinza > 0 ? ` · ${c.cinza}—` : ''}
                </span>
              </div>
            ))}
          </SectionBody>
        </Section>
      )}

      {/* Melhoria Contínua + Padronização */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => nav('/sgi/melhoria')}
          className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.97] ${card}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-extrabold flex items-center gap-1.5 ${txt}`}>
              <RefreshCcw size={13} className="text-amber-500" /> Melhoria
            </span>
            <ArrowRight size={12} className={faint} />
          </div>
          <div className="space-y-2">
            <div>
              <p className={`text-2xl font-extrabold leading-none ${(kpis?.ncsAbertas ?? 0) > 0 ? 'text-amber-500' : txt}`}>{kpis?.ncsAbertas ?? 0}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${faint}`}>NCs abertas</p>
            </div>
            <div>
              <p className={`text-xl font-extrabold leading-none ${(kpis?.acoesAtrasadas ?? 0) > 0 ? 'text-red-500' : txt}`}>{kpis?.acoesAtrasadas ?? 0}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${faint}`}>Ações atrasadas</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => nav('/sgi/padronizacao')}
          className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.97] ${card}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-extrabold flex items-center gap-1.5 ${txt}`}>
              <FileText size={13} className="text-violet-500" /> Padronização
            </span>
            <ArrowRight size={12} className={faint} />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-extrabold leading-none text-emerald-500">{kpis?.vigentes ?? 0}</p>
              <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${faint}`}>Vigentes</p>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <p className="text-lg font-extrabold leading-none text-sky-500">{kpis?.emFluxo ?? 0}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${faint}`}>Em fluxo</p>
              </div>
              <div>
                <p className={`text-lg font-extrabold leading-none ${((kpis?.revisaoVencendo ?? 0) + (kpis?.revisaoVencida ?? 0)) > 0 ? 'text-amber-500' : txt}`}>
                  {(kpis?.revisaoVencendo ?? 0) + (kpis?.revisaoVencida ?? 0)}
                </p>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${faint}`}>A vencer</p>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Janela Crítica — Revisões (só se houver) */}
      {revisaoCritica && (
        <Section title="Revisões — Janela Crítica" icon={AlertTriangle} tone="red">
          <div className="p-4">
            <KpiGrid>
              <StatTile label="Revisão vencendo" value={kpis?.revisaoVencendo ?? 0} icon={Clock}
                tone={(kpis?.revisaoVencendo ?? 0) > 0 ? 'amber' : 'slate'} note="próximos 30 dias" />
              <StatTile label="Revisão vencida" value={kpis?.revisaoVencida ?? 0} icon={AlertTriangle}
                tone={(kpis?.revisaoVencida ?? 0) > 0 ? 'red' : 'slate'} note="documentos vigentes" />
            </KpiGrid>
          </div>
        </Section>
      )}

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
              const tone = doc.status === 'vigente' ? 'emerald' : doc.status === 'em_revisao' ? 'blue' : doc.status === 'em_aprovacao' ? 'amber' : 'slate'
              return (
                <ListRow
                  key={doc.id}
                  leading={<LeadingBadge tone={tone}>{doc.codigo ? doc.codigo.slice(0, 3) : 'DOC'}</LeadingBadge>}
                  title={`${doc.codigo ? `${doc.codigo} · ` : ''}${doc.titulo}`}
                  subtitle={`${TIPO_DOC_LABEL[doc.tipo]} · v${doc.versao} · ${fmtDate(doc.updated_at?.split('T')[0])}`}
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
