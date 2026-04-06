import { useNavigate } from 'react-router-dom'
import { Building2, FileText, Wrench, RefreshCw, DollarSign, AlertTriangle, ArrowRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useLocacaoKPIs, useFaturas, useSolicitacoesLocacao } from '../../hooks/useLocacao'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

const fmtDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export default function LocacaoHome() {
  const nav = useNavigate()
  const { isDark } = useTheme()
  const { data: kpis, isLoading } = useLocacaoKPIs()
  const { data: faturasVencendo = [] } = useFaturas()
  const { data: solicitacoesAbertas = [] } = useSolicitacoesLocacao({ status: 'aberta' })

  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-navy'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-400'
  const cardHover = isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'

  const urgenteSols = solicitacoesAbertas.filter(s => s.urgencia === 'urgente' || s.urgencia === 'alta')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const KPI_CARDS = [
    {
      label: 'Imoveis Ativos',
      value: kpis?.imoveisAtivos ?? 0,
      icon: Building2,
      iconColor: 'text-indigo-500',
      iconBg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50',
      onClick: () => nav('/locacoes/ativos'),
    },
    {
      label: 'Faturas Vencendo (7d)',
      value: kpis?.faturasVencendo ?? 0,
      icon: FileText,
      iconColor: (kpis?.faturasVencendo ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400',
      iconBg: (kpis?.faturasVencendo ?? 0) > 0 ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/faturas'),
    },
    {
      label: 'Manutencoes Abertas',
      value: kpis?.manutencoesAbertas ?? 0,
      icon: Wrench,
      iconColor: (kpis?.manutencoesAbertas ?? 0) > 0 ? 'text-orange-500' : 'text-slate-400',
      iconBg: (kpis?.manutencoesAbertas ?? 0) > 0 ? (isDark ? 'bg-orange-500/10' : 'bg-orange-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/servicos'),
    },
    {
      label: 'Contratos Expirando (60d)',
      value: kpis?.contratosExpirando ?? 0,
      icon: RefreshCw,
      iconColor: (kpis?.contratosExpirando ?? 0) > 0 ? 'text-violet-500' : 'text-slate-400',
      iconBg: (kpis?.contratosExpirando ?? 0) > 0 ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : (isDark ? 'bg-white/[0.04]' : 'bg-slate-50'),
      onClick: () => nav('/locacoes/aditivos'),
    },
    {
      label: 'Valor Total Mensal',
      value: fmtCurrency(kpis?.valorTotalMensal ?? 0),
      icon: DollarSign,
      iconColor: 'text-green-500',
      iconBg: isDark ? 'bg-green-500/10' : 'bg-green-50',
      onClick: () => nav('/locacoes/faturas'),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold ${txt}`}>Painel - Locacao de Imoveis</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>Gestao de contratos, faturas e manutencoes</p>
      </div>

      {/* Alertas urgentes */}
      {urgenteSols.length > 0 && (
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
              {urgenteSols.length} solicitacao(s) urgente(s)
            </p>
          </div>
          <div className="space-y-1">
            {urgenteSols.slice(0, 3).map(sol => (
              <button
                key={sol.id}
                onClick={() => nav('/locacoes/servicos')}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg flex items-center justify-between ${isDark ? 'bg-white/[0.04] text-slate-300' : 'bg-white text-slate-700'}`}
              >
                <span className="truncate">{sol.titulo}</span>
                <ArrowRight size={12} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {KPI_CARDS.map(({ label, value, icon: Icon, iconColor, iconBg, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`rounded-2xl border p-4 text-left transition-all ${bg} ${cardHover} flex flex-col gap-3`}
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

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Faturas vencendo */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Proximas Faturas</p>
            <button
              onClick={() => nav('/locacoes/faturas')}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {faturasVencendo.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma fatura vencendo em breve.</p>
          ) : (
            <div className="space-y-2">
              {faturasVencendo.slice(0, 5).map(fat => (
                <div key={fat.id} className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <div className="min-w-0">
                    <span className="truncate block">{fat.imovel?.descricao ?? 'Imovel'}</span>
                    <span className={txtMuted}>{fat.tipo} · Vence {fmtDate(fat.vencimento)}</span>
                  </div>
                  <span className={`font-semibold shrink-0 ${fat.valor_previsto ? '' : txtMuted}`}>
                    {fat.valor_previsto ? fmtCurrency(fat.valor_previsto) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solicitacoes abertas */}
        <div className={`rounded-2xl border p-4 ${bg}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-bold ${txt}`}>Solicitacoes Abertas</p>
            <button
              onClick={() => nav('/locacoes/servicos')}
              className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </div>
          {solicitacoesAbertas.length === 0 ? (
            <p className={`text-xs ${txtMuted}`}>Nenhuma solicitacao aberta.</p>
          ) : (
            <div className="space-y-2">
              {solicitacoesAbertas.slice(0, 5).map(sol => (
                <div key={sol.id} className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <div className="min-w-0">
                    <span className="truncate block">{sol.titulo}</span>
                    <span className={txtMuted}>{sol.imovel?.descricao ?? '—'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                    sol.urgencia === 'urgente' ? 'bg-red-100 text-red-700' :
                    sol.urgencia === 'alta' ? 'bg-amber-100 text-amber-700' :
                    isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sol.urgencia}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
