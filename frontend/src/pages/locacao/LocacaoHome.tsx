import { useNavigate } from 'react-router-dom'
import {
  Building2, DollarSign, AlertCircle, Wrench,
  Calendar, ArrowRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useLocacaoKPIs,
  useFaturas,
  useEntradas,
  useSaidas,
} from '../../hooks/useLocacao'
import { ENTRADA_PIPELINE_STAGES, SAIDA_PIPELINE_STAGES, TIPO_FATURA_LABEL, STATUS_FATURA_LABEL } from '../../types/locacao'

// ── Formatters ───────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function LocacaoHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis, isLoading } = useLocacaoKPIs()
  const { data: faturas = [] } = useFaturas()
  const { data: entradas = [] } = useEntradas()
  const { data: saidas = [] } = useSaidas()

  const bg = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardHover = isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'

  // Próximas 5 faturas (não pagas), ordenadas por vencimento
  const proximasFaturas = [...faturas]
    .filter(f => f.status !== 'pago' && f.vencimento)
    .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
    .slice(0, 5)

  // Entradas em andamento (status != liberado)
  const entradasAndamento = entradas.filter(e => e.status !== 'liberado').slice(0, 5)

  // Saídas em andamento (status != encerrado)
  const saidasAndamento = saidas.filter(s => s.status !== 'encerrado').slice(0, 5)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const KPI_CARDS = [
    {
      label: 'Imóveis Ativos',
      value: String(kpis?.imoveisAtivos ?? 0),
      Icon: Building2,
      iconColor: 'text-indigo-500',
      iconBg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50',
      onClick: () => nav('/locacoes/gestao'),
    },
    {
      label: 'Valor Total/mês',
      value: fmtCurrency(kpis?.valorTotalMensal ?? 0),
      Icon: DollarSign,
      iconColor: 'text-green-500',
      iconBg: isDark ? 'bg-green-500/10' : 'bg-green-50',
      onClick: () => nav('/locacoes/gestao'),
    },
    {
      label: 'Faturas vencendo (7d)',
      value: String(kpis?.faturasVencendo ?? 0),
      Icon: AlertCircle,
      iconColor: (kpis?.faturasVencendo ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400',
      iconBg: (kpis?.faturasVencendo ?? 0) > 0 ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/gestao'),
    },
    {
      label: 'Manutenções abertas',
      value: String(kpis?.manutencoesAbertas ?? 0),
      Icon: Wrench,
      iconColor: (kpis?.manutencoesAbertas ?? 0) > 0 ? 'text-red-500' : 'text-slate-400',
      iconBg: (kpis?.manutencoesAbertas ?? 0) > 0 ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/gestao'),
    },
    {
      label: 'Contratos vencendo (60d)',
      value: String(kpis?.contratosExpirando ?? 0),
      Icon: Calendar,
      iconColor: (kpis?.contratosExpirando ?? 0) > 0 ? 'text-orange-500' : 'text-slate-400',
      iconBg: (kpis?.contratosExpirando ?? 0) > 0 ? (isDark ? 'bg-orange-500/10' : 'bg-orange-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/gestao'),
    },
  ]

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold ${txt}`}>Painel — Locação de Imóveis</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>Gestão de contratos, faturas e manutenções</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {KPI_CARDS.map(({ label, value, Icon, iconColor, iconBg, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`rounded-2xl border p-4 text-left transition-all flex flex-col gap-3 ${bg} ${cardHover}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon size={18} className={iconColor} />
            </div>
            <div>
              <p className={`text-xl font-extrabold leading-none ${txt}`}>{value}</p>
              <p className={`text-[10px] uppercase tracking-widest font-semibold mt-1 ${txtMuted}`}>{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Faturas Próximas */}
      <div className={`rounded-2xl border p-4 ${bg}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`text-sm font-bold ${txt}`}>Faturas Próximas</p>
          <button
            onClick={() => nav('/locacoes/gestao')}
            className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
          >
            Ver todas <ArrowRight size={12} />
          </button>
        </div>
        {proximasFaturas.length === 0 ? (
          <p className={`text-xs ${txtMuted}`}>Nenhuma fatura vencendo em breve.</p>
        ) : (
          <div className="space-y-2">
            {proximasFaturas.map(fat => {
              const stCfg = STATUS_FATURA_LABEL[fat.status]
              return (
                <div key={fat.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {fat.imovel?.descricao ?? '—'}
                      </span>
                      <span className={`text-[10px] ${txtMuted}`}>{TIPO_FATURA_LABEL[fat.tipo]}</span>
                    </div>
                    <p className={`text-[10px] ${txtMuted}`}>Vence {fmtDate(fat.vencimento)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {fat.valor_previsto
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(fat.valor_previsto)
                        : '—'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${stCfg.bg} ${stCfg.text}`}>
                      {stCfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Entradas em Andamento */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Entradas em Andamento</p>
            <button
              onClick={() => nav('/locacoes/entradas')}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {entradasAndamento.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma entrada em andamento.</p>
          ) : (
            <div className="space-y-2">
              {entradasAndamento.map(e => {
                const stageCfg = ENTRADA_PIPELINE_STAGES.find(s => s.key === e.status)
                const endereco = [e.imovel?.descricao ?? e.endereco, e.imovel?.cidade ?? e.cidade].filter(Boolean).join(' — ')
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <span className={`text-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {endereco || 'Sem endereço'}
                    </span>
                    {stageCfg && (
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageCfg.badgeClass}`}>
                        {stageCfg.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Saídas em Andamento */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Saídas em Andamento</p>
            <button
              onClick={() => nav('/locacoes/saidas')}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {saidasAndamento.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma saída em andamento.</p>
          ) : (
            <div className="space-y-2">
              {saidasAndamento.map(s => {
                const stageCfg = SAIDA_PIPELINE_STAGES.find(st => st.key === s.status)
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs truncate block ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {s.imovel?.descricao ?? 'Imóvel'}
                      </span>
                      {s.data_limite_saida && (
                        <p className={`text-[10px] ${txtMuted}`}>Limite: {fmtDate(s.data_limite_saida)}</p>
                      )}
                    </div>
                    {stageCfg && (
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageCfg.badgeClass}`}>
                        {stageCfg.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
