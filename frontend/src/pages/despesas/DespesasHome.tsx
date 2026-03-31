import { useNavigate } from 'react-router-dom'
import { CreditCard, Wallet, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useApontamentosCartao } from '../../hooks/useCartoes'
import { useAdiantamentosDespesa } from '../../hooks/useDespesas'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function DespesasHome() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const { data: apontamentos = [] } = useApontamentosCartao()
  const { data: adiantamentos = [] } = useAdiantamentosDespesa()

  const totalCartoes = apontamentos.reduce((sum, item) => sum + Number(item.valor), 0)
  const totalAdiantamentos = adiantamentos.reduce((sum, item) => sum + Number(item.valor_solicitado), 0)
  const adiantamentosPendentes = adiantamentos.filter(item => item.status === 'solicitado').length

  const cards = [
    {
      title: 'Cartões',
      subtitle: 'Lançamentos e apontamentos de cartão corporativo',
      value: fmt(totalCartoes),
      meta: `${apontamentos.length} registros`,
      icon: CreditCard,
      accent: dark ? 'from-violet-500/20 to-indigo-500/20' : 'from-violet-50 to-indigo-50',
      border: dark ? 'border-violet-500/20' : 'border-violet-200',
      iconColor: dark ? 'text-violet-300' : 'text-violet-600',
      action: () => navigate('/despesas/cartoes'),
    },
    {
      title: 'Adiantamentos',
      subtitle: 'Solicitações para aprovação e futura prestação de contas',
      value: fmt(totalAdiantamentos),
      meta: `${adiantamentosPendentes} aguardando gestor`,
      icon: Wallet,
      accent: dark ? 'from-emerald-500/20 to-teal-500/20' : 'from-emerald-50 to-teal-50',
      border: dark ? 'border-emerald-500/20' : 'border-emerald-200',
      iconColor: dark ? 'text-emerald-300' : 'text-emerald-600',
      action: () => navigate('/despesas/adiantamentos'),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Despesas</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cartões continuam no fluxo atual. Adiantamentos entram com aprovação do gestor e seguem para o financeiro.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
            <Clock3 size={14} />
            Próximo passo
          </div>
          <p className={`mt-1 text-sm ${dark ? 'text-slate-300' : 'text-slate-700'}`}>
            Prestação de contas dos adiantamentos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {cards.map(card => (
          <button
            key={card.title}
            type="button"
            onClick={card.action}
            className={`rounded-3xl border bg-gradient-to-br ${card.accent} ${card.border} p-6 text-left transition hover:-translate-y-0.5`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`rounded-2xl p-3 ${dark ? 'bg-slate-950/30' : 'bg-white/80'}`}>
                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
              </div>
              <ArrowRight className={`h-5 w-5 shrink-0 ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div className="mt-10">
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Fluxo
              </p>
              <h2 className={`mt-2 text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{card.title}</h2>
              <p className={`mt-2 text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{card.subtitle}</p>
            </div>
            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <p className={`text-2xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{card.value}</p>
                <p className={`mt-1 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{card.meta}</p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${dark ? 'bg-white/10 text-white' : 'bg-white text-slate-700'}`}>
                <CheckCircle2 size={14} />
                Abrir fluxo
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
