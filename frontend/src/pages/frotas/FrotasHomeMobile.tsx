import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, AlertTriangle, Wrench, RefreshCw, TrendingUp,
  FileWarning, ShieldAlert, Settings2, CheckCircle2, Gauge, DollarSign,
} from 'lucide-react'
import { useFrotasKPIs, useOrdensServico, useVeiculos, useItensManutencaoTodos } from '../../hooks/useFrotas'
import type { FrotasKPIs } from '../../types/frotas'
import {
  MobilePanel, MobileHeader, KpiCard, KpiGrid, StatTile, Section,
  RowList, ListRow, LeadingBadge, BarStat, MobileLoading, Empty, SectionBody, Pill,
} from '../../components/paineis-mobile/kit'
import type { Tone } from '../../components/paineis-mobile/kit'

// ── Helpers (replicados do desktop FrotasHome.tsx) ───────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

const ITEM_LABELS: Record<string, string> = {
  oleo_motor: 'Óleo', filtro_oleo: 'Filtro Óleo', filtro_ar: 'Filtro Ar',
  pneus: 'Pneus', bateria: 'Bateria', freios_pastilhas: 'Freios',
  suspensao: 'Suspensão', correia_dentada: 'Correia', fluido_freio: 'Fluido Freio',
}

// Cores/tons da barra de situação da frota (mesmas situações do desktop)
const STATUS_SEG: { key: string; label: string; tone: Tone }[] = [
  { key: 'disponivel',       label: 'Disponíveis',      tone: 'emerald' },
  { key: 'em_uso',           label: 'Em Uso',           tone: 'sky' },
  { key: 'em_manutencao',    label: 'Em Manutenção',    tone: 'amber' },
  { key: 'bloqueado',        label: 'Bloqueados',       tone: 'red' },
  { key: 'em_entrada',       label: 'Em Entrada',       tone: 'violet' },
  { key: 'aguardando_saida', label: 'Aguardando Saída', tone: 'rose' },
]
const STATUS_BAR: Record<string, string> = {
  disponivel: 'bg-emerald-500', em_uso: 'bg-sky-500', em_manutencao: 'bg-amber-500',
  bloqueado: 'bg-red-500', em_entrada: 'bg-violet-500', aguardando_saida: 'bg-rose-500',
}
const PRIORIDADE_TONE: Record<string, Tone> = {
  critica: 'red', alta: 'amber', media: 'amber', baixa: 'slate',
}

// Versão mobile-native do Painel de Frotas — MESMOS dados do desktop FrotasHome.
export default function FrotasHomeMobile() {
  const nav = useNavigate()
  const { data: kpis, isLoading, refetch } = useFrotasKPIs()
  const { data: osAbertas = [] } = useOrdensServico({
    status: ['aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })
  const { data: veiculos = [] } = useVeiculos()
  const { data: todosItensManut = [] } = useItensManutencaoTodos()

  // Manutenções vencendo/vencidas — agrupadas por veículo (idêntico ao desktop)
  const manutPorVeiculo = useMemo(() => {
    const map = new Map<string, { placa: string; marca: string; modelo: string; vencidos: string[]; emBreve: string[]; piorRestante: number }>()
    for (const it of todosItensManut) {
      const km = (it as unknown as Record<string, unknown>).hodometro_atual as number ?? 0
      const restante = (it.km_proxima_troca ?? 0) - km
      if (restante <= 2000) {
        const key = it.veiculo_id
        if (!map.has(key)) map.set(key, { placa: it.placa ?? '', marca: it.marca ?? '', modelo: it.modelo ?? '', vencidos: [], emBreve: [], piorRestante: restante })
        const entry = map.get(key)!
        const label = ITEM_LABELS[it.tipo_item] ?? it.tipo_item
        if (restante <= 0) entry.vencidos.push(label)
        else entry.emBreve.push(label)
        if (restante < entry.piorRestante) entry.piorRestante = restante
      }
    }
    return Array.from(map.values()).sort((a, b) => a.piorRestante - b.piorRestante).slice(0, 6)
  }, [todosItensManut])

  const totalManutVencidas = manutPorVeiculo.reduce((s, v) => s + v.vencidos.length, 0)
  const totalManutEmBreve = manutPorVeiculo.reduce((s, v) => s + v.emBreve.length, 0)

  const k = kpis as FrotasKPIs | undefined

  // OS Críticas / Altas (idêntico ao desktop)
  const osCriticasAltas = useMemo(() =>
    osAbertas.filter(o => o.prioridade === 'critica' || o.prioridade === 'alta').slice(0, 5)
  , [osAbertas])

  // Documentos vencendo (CRLV / Seguro) (idêntico ao desktop)
  const docsVencendo = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const lim = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    return veiculos
      .filter(v => v.status !== 'baixado')
      .filter(v => {
        const crlv = v.vencimento_crlv
        const seguro = v.vencimento_seguro
        return (crlv && crlv <= lim) || (seguro && seguro <= lim)
      })
      .map(v => {
        const crlvVencido = v.vencimento_crlv && v.vencimento_crlv < today
        const seguroVencido = v.vencimento_seguro && v.vencimento_seguro < today
        const docs: string[] = []
        if (v.vencimento_crlv && v.vencimento_crlv <= lim) docs.push(`CRLV ${fmtDate(v.vencimento_crlv)}`)
        if (v.vencimento_seguro && v.vencimento_seguro <= lim) docs.push(`Seguro ${fmtDate(v.vencimento_seguro)}`)
        return { ...v, docs, vencido: !!(crlvVencido || seguroVencido) }
      })
      .sort((a, b) => {
        if (a.vencido && !b.vencido) return -1
        if (!a.vencido && b.vencido) return 1
        return 0
      })
      .slice(0, 5)
  }, [veiculos])

  // Situação atual da frota (idêntico ao desktop)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const v of veiculos.filter(v => v.status !== 'baixado')) {
      counts[v.status] = (counts[v.status] ?? 0) + 1
    }
    return counts
  }, [veiculos])

  const segments = STATUS_SEG
    .map(s => ({ ...s, value: statusCounts[s.key] ?? 0 }))
    .filter(s => s.value > 0)
  const totalFrota = segments.reduce((s, seg) => s + seg.value, 0)

  // Custo mensal total (idêntico ao desktop)
  const custoMensal = (k?.custo_manutencao_mes ?? 0) + (k?.custo_abastecimento_mes ?? 0)

  if (isLoading) return <MobileLoading tone="rose" />

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel de Frotas"
        subtitle="Gestão da frota, manutenções e disponibilidade"
        icon={Car}
        tone="rose"
        right={
          <button onClick={() => refetch()} className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-500 active:scale-95">
            <RefreshCw size={15} />
          </button>
        }
      />

      {/* Núcleo da Frota — indicadores gerais */}
      <KpiGrid cols={3}>
        <KpiCard label="Total Frota" value={k?.total_veiculos ?? 0} tone="rose" note={`${k?.disponiveis ?? 0} disponíveis`} icon={Car} />
        <KpiCard label="Disponib." value={`${k?.taxa_disponibilidade ?? 0}%`} tone="emerald" note={`${k?.em_uso ?? 0} em uso`} icon={Gauge} />
        <KpiCard label="Custo Mês" value={BRL(custoMensal)} tone="amber" note="manut. + abast." icon={DollarSign} />
      </KpiGrid>

      {/* Janela Crítica — o que exige ação agora */}
      <KpiGrid cols={3}>
        <StatTile
          label="Manut. Vencidas"
          value={totalManutVencidas}
          icon={AlertTriangle}
          tone={totalManutVencidas > 0 ? 'red' : 'slate'}
          note="troca atrasada"
        />
        <StatTile
          label="Manut. Em Breve"
          value={totalManutEmBreve}
          icon={Settings2}
          tone={totalManutEmBreve > 0 ? 'amber' : 'slate'}
          note="próx. 2.000 km"
        />
        <StatTile
          label="OS Críticas"
          value={k?.os_criticas ?? 0}
          icon={Wrench}
          tone={(k?.os_criticas ?? 0) > 0 ? 'amber' : 'slate'}
          note="em andamento"
        />
      </KpiGrid>

      {/* Pulso por Situação — barra única + legenda */}
      <Section title="Pulso por Situação" icon={TrendingUp} tone="rose">
        <SectionBody>
          {totalFrota === 0 ? (
            <Empty icon={Car}>Nenhum veículo registrado</Empty>
          ) : (
            <div className="space-y-2.5">
              <div className="flex h-9 rounded-xl overflow-hidden">
                {segments.map(seg => {
                  const pct = (seg.value / totalFrota) * 100
                  return (
                    <div key={seg.key} className={`${STATUS_BAR[seg.key]} flex items-center justify-center`}
                      style={{ width: `${Math.max(pct, 4)}%` }} title={`${seg.label}: ${seg.value}`}>
                      {pct >= 16 && <span className="text-[10px] font-bold text-white">{seg.value}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {segments.map(seg => (
                  <span key={seg.key} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${STATUS_BAR[seg.key]}`} /> {seg.label} · {seg.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </SectionBody>
      </Section>

      {/* OS Críticas / Altas */}
      <Section
        title="OS Críticas / Altas"
        icon={Wrench}
        tone="rose"
        action={{ label: 'Ver todas', onClick: () => nav('/frotas/ordens-servico') }}
      >
        {osCriticasAltas.length === 0 ? (
          <Empty icon={CheckCircle2}>Nenhuma OS crítica ou alta aberta</Empty>
        ) : (
          <RowList>
            {osCriticasAltas.map(os => (
              <ListRow
                key={os.id}
                leading={<LeadingBadge tone={PRIORIDADE_TONE[os.prioridade] ?? 'slate'}><Wrench size={15} /></LeadingBadge>}
                title={os.veiculo?.placa ?? '—'}
                subtitle={os.descricao_problema}
                value={<Pill tone={PRIORIDADE_TONE[os.prioridade] ?? 'slate'}>{os.prioridade}</Pill>}
                valueSub={os.numero_os ?? '—'}
              />
            ))}
          </RowList>
        )}
      </Section>

      {/* Manutenções Vencendo */}
      <Section
        title="Manutenções Vencendo"
        icon={AlertTriangle}
        tone="amber"
        action={{ label: 'Ver todas', onClick: () => nav('/frotas/manutencao') }}
      >
        {manutPorVeiculo.length === 0 ? (
          <Empty icon={CheckCircle2}>Nenhuma manutenção vencendo ou vencida</Empty>
        ) : (
          <SectionBody className="space-y-2">
            {manutPorVeiculo.map((v, i) => {
              const temVencido = v.vencidos.length > 0
              const totalItens = v.vencidos.length + v.emBreve.length
              return (
                <div key={i} className="rounded-xl p-2.5 bg-slate-50 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {temVencido
                        ? <ShieldAlert size={13} className="text-red-500 shrink-0" />
                        : <FileWarning size={13} className="text-amber-500 shrink-0" />}
                      <span className="text-xs font-bold truncate text-slate-700 dark:text-slate-200">
                        {v.placa} — {v.marca} {v.modelo}
                      </span>
                    </div>
                    <Pill tone={temVencido ? 'red' : 'amber'}>
                      {totalItens} {totalItens > 1 ? 'itens' : 'item'}
                    </Pill>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.vencidos.map(item => (
                      <span key={item} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">{item}</span>
                    ))}
                    {v.emBreve.map(item => (
                      <span key={item} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">{item}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </SectionBody>
        )}
      </Section>

      {/* Documentos Vencendo (CRLV / Seguro) */}
      <Section title="Documentos Vencendo" icon={FileWarning} tone="amber">
        {docsVencendo.length === 0 ? (
          <Empty icon={CheckCircle2}>Nenhum documento vencendo nos próximos 30 dias</Empty>
        ) : (
          <RowList>
            {docsVencendo.map(v => (
              <ListRow
                key={v.id}
                leading={<LeadingBadge tone={v.vencido ? 'red' : 'amber'}><FileWarning size={15} /></LeadingBadge>}
                title={`${v.placa} — ${v.marca} ${v.modelo}`}
                subtitle={v.docs.join('  ·  ')}
                value={<Pill tone={v.vencido ? 'red' : 'amber'}>{v.vencido ? 'vencido' : 'a vencer'}</Pill>}
              />
            ))}
          </RowList>
        )}
      </Section>
    </MobilePanel>
  )
}
