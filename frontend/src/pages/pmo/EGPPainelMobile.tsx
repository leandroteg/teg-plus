import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertTriangle, Zap, TrendingUp, Clock, MapPin,
  CalendarClock, BarChart3, RefreshCw, DollarSign,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { usePortfolios } from '../../hooks/usePMO'
import { useLookupObras } from '../../hooks/useLookups'
import { supabase } from '../../services/supabase'
import type { StatusPortfolio } from '../../types/pmo'
import {
  MobilePanel, MobileHeader, Segmented, KpiCard, KpiGrid, StatTile, Section,
  SectionBody, RowList, ListRow, LeadingBadge, BarStat, Pill, Empty, MobileLoading,
} from '../../components/paineis-mobile/kit'

// ── Formatadores (mesmos do desktop EGPPainel) ───────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
const fmtDataHora = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Status config (mesmo do desktop) ─────────────────────────────────────────
const STATUS_CONFIG: Array<{ key: StatusPortfolio; label: string; barClass: string }> = [
  { key: 'em_analise_ate', label: 'Em Análise ATE', barClass: 'bg-amber-400' },
  { key: 'revisao_cliente', label: 'Revisão Cliente', barClass: 'bg-violet-500' },
  { key: 'liberado_iniciar', label: 'Liberado Iniciar', barClass: 'bg-blue-500' },
  { key: 'obra_andamento', label: 'Em Andamento', barClass: 'bg-emerald-500' },
  { key: 'obra_paralisada', label: 'Paralisada', barClass: 'bg-red-500' },
  { key: 'obra_concluida', label: 'Concluída', barClass: 'bg-slate-400' },
]

// ── Hooks auxiliares — MESMAS queries/keys do desktop (cache compartilhado) ───

function useEGPKpis(obraFilter: string) {
  return useQuery({
    queryKey: ['egp-kpis', obraFilter],
    queryFn: async () => {
      let riscosQ = supabase
        .from('pmo_riscos')
        .select('id', { count: 'exact', head: true })
        .in('probabilidade', ['alta', 'muito_alta'])
        .in('impacto', ['alto', 'muito_alto'])
        .eq('status', 'aberto')

      let acoesQ = supabase
        .from('pmo_plano_acao')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('prazo', new Date().toISOString())

      let indicadoresQ = supabase
        .from('pmo_indicadores_snapshot')
        .select('portfolio_id, idp, pct_valor_executado')
        .order('data_snapshot', { ascending: false })

      if (obraFilter) {
        const { data: portIds } = await supabase
          .from('pmo_portfolio')
          .select('id')
          .eq('obra_id', obraFilter)
        const ids = (portIds ?? []).map(p => p.id)
        if (ids.length > 0) {
          riscosQ = riscosQ.in('portfolio_id', ids)
          acoesQ = acoesQ.in('portfolio_id', ids)
          indicadoresQ = indicadoresQ.in('portfolio_id', ids)
        } else {
          return { riscosCriticos: 0, acoesCriticas: 0, indicadores: [] as Array<{ portfolio_id: string | null; idp: number | null; pct_valor_executado: number | null }> }
        }
      }

      const [riscosRes, acoesRes, indicadoresRes] = await Promise.all([
        riscosQ,
        acoesQ,
        indicadoresQ,
      ])

      const indRaw = (indicadoresRes.data ?? []) as Array<{ portfolio_id: string | null; idp: number | null; pct_valor_executado: number | null }>
      const seenPortfolios = new Set<string>()
      const indicadores: typeof indRaw = []
      for (const ind of indRaw) {
        const pid = ind.portfolio_id ?? ''
        if (!seenPortfolios.has(pid)) {
          seenPortfolios.add(pid)
          indicadores.push(ind)
        }
      }

      return {
        riscosCriticos: riscosRes.count ?? 0,
        acoesCriticas: acoesRes.count ?? 0,
        indicadores,
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}

function useRecentes() {
  return useQuery({
    queryKey: ['egp-recentes'],
    queryFn: async () => {
      const [multasRes, reunioesRes, mudancasRes, acoesRes] = await Promise.all([
        supabase.from('pmo_multas').select('id, descricao, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_reunioes').select('id, tipo, data, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_mudancas').select('id, descricao, tipo, created_at, parecer, portfolio_id').order('created_at', { ascending: false }).limit(3),
        supabase.from('pmo_plano_acao').select('id, descricao, created_at, status, portfolio_id').order('created_at', { ascending: false }).limit(3),
      ])

      type RecenteItem = { id: string; tipo: string; descricao: string; created_at: string; status: string }
      const items: RecenteItem[] = []

      for (const m of (multasRes.data ?? []) as any[]) {
        items.push({ id: m.id, tipo: 'Multa', descricao: m.descricao, created_at: m.created_at, status: m.status })
      }
      for (const r of (reunioesRes.data ?? []) as any[]) {
        items.push({ id: r.id, tipo: 'Reunião', descricao: `${r.tipo} - ${r.data}`, created_at: r.created_at, status: r.status })
      }
      for (const m of (mudancasRes.data ?? []) as any[]) {
        items.push({ id: m.id, tipo: 'Mudança', descricao: m.descricao, created_at: m.created_at, status: m.parecer })
      }
      for (const a of (acoesRes.data ?? []) as any[]) {
        items.push({ id: a.id, tipo: 'Ação', descricao: a.descricao, created_at: a.created_at, status: a.status })
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return items.slice(0, 8)
    },
    staleTime: 2 * 60 * 1000,
  })
}

const RECENTE_TONE: Record<string, 'red' | 'blue' | 'violet' | 'amber' | 'slate'> = {
  Multa: 'red', Reunião: 'blue', Mudança: 'violet', Ação: 'amber',
}

// ── Versão mobile-native do Painel EGP (visão Geral) — MESMOS dados ───────────
export default function EGPPainelMobile() {
  const nav = useNavigate()
  const [obraFilter, setObraFilter] = useState('')
  const obras = useLookupObras()

  const { data: portfolios = [], isLoading, refetch: refetchPortfolios } = usePortfolios(
    obraFilter ? { obra_id: obraFilter } : undefined
  )
  const { data: kpis, refetch: refetchKpis } = useEGPKpis(obraFilter)
  const { data: recentes = [], refetch: refetchRecentes } = useRecentes()

  const refetch = () => {
    refetchPortfolios()
    refetchKpis()
    refetchRecentes()
  }

  // ── Computed KPIs (mesma lógica do desktop) ────────────────────────────────
  const hoje = Date.now()

  const avancoFisico = useMemo(() => {
    const ativos = portfolios.filter(p => p.valor_total_osc > 0)
    if (ativos.length === 0) return 0
    const total = ativos.reduce((sum, p) => {
      const pct = (p.custo_real / p.valor_total_osc) * 100
      return sum + Math.min(pct, 100)
    }, 0)
    return total / ativos.length
  }, [portfolios])

  const desvioPrazo = useMemo(() => {
    const ativos = portfolios.filter(p =>
      p.status === 'obra_andamento' && p.data_termino_contratual
    )
    if (ativos.length === 0) return 0
    const totalDias = ativos.reduce((sum, p) => {
      const termino = new Date(p.data_termino_contratual!).getTime()
      const diff = (termino - hoje) / (1000 * 60 * 60 * 24)
      return sum + diff
    }, 0)
    return Math.round(totalDias / ativos.length)
  }, [portfolios, hoje])

  const custoReal = useMemo(() =>
    portfolios.reduce((sum, p) => sum + (p.custo_real ?? 0), 0),
    [portfolios]
  )

  const statusSegments = useMemo(() => {
    return STATUS_CONFIG
      .map(s => ({
        key: s.key,
        label: s.label,
        value: portfolios.filter(p => p.status === s.key).length,
        barClass: s.barClass,
      }))
      .filter(s => s.value > 0)
  }, [portfolios])

  const atrasadas = useMemo(() =>
    portfolios.filter(p =>
      p.data_termino_contratual &&
      new Date(p.data_termino_contratual).getTime() < hoje &&
      p.status === 'obra_andamento'
    ),
    [portfolios, hoje]
  )

  const spiCriticos = useMemo(() => {
    if (!kpis?.indicadores) return []
    const lowIdp = new Set(
      kpis.indicadores
        .filter(i => i.idp != null && i.idp < 0.85)
        .map(i => i.portfolio_id)
    )
    return portfolios.filter(p => lowIdp.has(p.id))
  }, [portfolios, kpis])

  const porObra = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; valor: number }>()
    for (const p of portfolios) {
      const obraNome = p.obra?.nome ?? 'Sem obra'
      const entry = map.get(obraNome) ?? { nome: obraNome, total: 0, valor: 0 }
      entry.total += 1
      entry.valor += p.valor_total_osc ?? 0
      map.set(obraNome, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor)
  }, [portfolios])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return <MobileLoading tone="emerald" />

  const totalStatus = statusSegments.reduce((sum, s) => sum + s.value, 0)
  const maxObra = Math.max(...porObra.map(o => o.valor), 1)

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel - EGP"
        subtitle="Portfólio, indicadores e alertas críticos"
        icon={Activity}
        tone="emerald"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-emerald-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Filtro por obra */}
      <Segmented
        value={obraFilter}
        onChange={setObraFilter}
        options={[{ value: '', label: 'Todas' }, ...obras.map(o => ({ value: o.id, label: o.nome }))]}
        tone="emerald"
      />

      {/* Núcleo EGP — indicadores consolidados */}
      <KpiGrid cols={3}>
        <KpiCard label="Avanço Físico" value={fmtPct(avancoFisico)} tone="teal" note="média do portfólio" />
        <KpiCard
          label="Prazo"
          value={`${desvioPrazo > 0 ? '+' : ''}${desvioPrazo}d`}
          tone={desvioPrazo < 0 ? 'amber' : 'emerald'}
          note={desvioPrazo < 0 ? 'atrasado' : 'no prazo'}
        />
        <KpiCard label="Custo Real" value={fmt(custoReal)} tone="sky" note="acumulado" />
      </KpiGrid>

      {/* Janela Crítica */}
      <KpiGrid>
        <StatTile
          label="Riscos Críticos"
          value={kpis?.riscosCriticos ?? 0}
          icon={AlertTriangle}
          tone={(kpis?.riscosCriticos ?? 0) > 0 ? 'red' : 'slate'}
          note={(kpis?.riscosCriticos ?? 0) > 0 ? 'alta prob. + impacto' : 'nenhum crítico'}
        />
        <StatTile
          label="Ações Críticas"
          value={kpis?.acoesCriticas ?? 0}
          icon={Zap}
          tone={(kpis?.acoesCriticas ?? 0) > 0 ? 'red' : 'slate'}
          note={(kpis?.acoesCriticas ?? 0) > 0 ? 'prazo vencido' : 'nenhuma atrasada'}
        />
      </KpiGrid>

      {/* Pulso por Status */}
      <Section title="Pulso por Status" icon={TrendingUp} tone="emerald">
        <SectionBody>
          {statusSegments.length === 0 ? (
            <Empty>Nenhuma OSC cadastrada</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {statusSegments.map(seg => {
                  const pct = (seg.value / totalStatus) * 100
                  return (
                    <div key={seg.key} className={`${seg.barClass} flex items-center justify-center`} style={{ width: `${Math.max(pct, 4)}%` }}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white">{seg.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {statusSegments.map(seg => (
                  <span key={seg.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${seg.barClass}`} /> {seg.label} · {seg.value}
                  </span>
                ))}
              </div>
              <p className="text-[10px] font-semibold text-slate-400 text-right">{totalStatus} OSC(s)</p>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* Atrasadas */}
      <Section
        title="Atrasadas"
        icon={CalendarClock}
        tone="red"
        action={{ label: 'Ver portfólio', onClick: () => nav('/egp/portfolio') }}
      >
        {atrasadas.length === 0 ? (
          <Empty icon={CalendarClock}>Nenhuma OSC atrasada</Empty>
        ) : (
          <RowList>
            {atrasadas.slice(0, 5).map(p => {
              const diasAtraso = Math.round((hoje - new Date(p.data_termino_contratual!).getTime()) / (1000 * 60 * 60 * 24))
              return (
                <ListRow
                  key={p.id}
                  onClick={() => nav(`/egp/portfolio/${p.id}`)}
                  leading={<LeadingBadge tone="red"><AlertTriangle size={14} /></LeadingBadge>}
                  title={p.numero_osc}
                  subtitle={p.nome_obra}
                  value={fmt(p.valor_total_osc)}
                  valueSub={`Prazo ${fmtData(p.data_termino_contratual)} · -${diasAtraso}d`}
                  valueTone="red"
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* SPI < 0.85 */}
      <Section
        title="SPI < 0.85"
        icon={BarChart3}
        tone="amber"
        action={{ label: 'Ver portfólio', onClick: () => nav('/egp/portfolio') }}
      >
        {spiCriticos.length === 0 ? (
          <Empty icon={BarChart3}>Nenhuma OSC com SPI crítico</Empty>
        ) : (
          <RowList>
            {spiCriticos.slice(0, 5).map(p => {
              const ind = kpis?.indicadores.find(i => i.portfolio_id === p.id)
              return (
                <ListRow
                  key={p.id}
                  onClick={() => nav(`/egp/portfolio/${p.id}`)}
                  leading={<LeadingBadge tone="amber"><BarChart3 size={14} /></LeadingBadge>}
                  title={p.numero_osc}
                  subtitle={p.nome_obra}
                  value={fmt(p.valor_total_osc)}
                  valueSub={`IDP ${ind?.idp?.toFixed(2) ?? '—'} · ${p.obra?.nome ?? '—'}`}
                  valueTone="amber"
                />
              )
            })}
          </RowList>
        )}
      </Section>

      {/* Por Obra */}
      <Section title="Por Obra" icon={MapPin} tone="slate">
        <SectionBody className="space-y-2.5">
          {porObra.length === 0 ? (
            <Empty icon={MapPin}>Nenhuma OSC por obra</Empty>
          ) : porObra.map(o => (
            <BarStat
              key={o.nome}
              label={o.nome}
              value={fmt(o.valor)}
              pct={(o.valor / maxObra) * 100}
              tone="teal"
            />
          ))}
        </SectionBody>
      </Section>

      {/* Recentes */}
      <Section
        title="Recentes"
        icon={Clock}
        tone="slate"
        action={{ label: 'Ver portfólio', onClick: () => nav('/egp/portfolio') }}
      >
        {recentes.length === 0 ? (
          <Empty icon={Clock}>Nenhuma atividade recente</Empty>
        ) : (
          <RowList>
            {recentes.map(r => (
              <ListRow
                key={r.id}
                leading={<LeadingBadge tone={RECENTE_TONE[r.tipo] ?? 'slate'}><DollarSign size={14} /></LeadingBadge>}
                title={r.descricao}
                subtitle={r.status}
                value={<Pill tone={RECENTE_TONE[r.tipo] ?? 'slate'}>{r.tipo}</Pill>}
                valueSub={fmtDataHora(r.created_at)}
              />
            ))}
          </RowList>
        )}
      </Section>
    </MobilePanel>
  )
}
