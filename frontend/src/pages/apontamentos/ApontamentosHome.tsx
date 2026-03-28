import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, Plus, ClipboardList,
  CheckCircle2, Check, TrendingUp,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useApontamentosCartao } from '../../hooks/useCartoes'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatControlNumber = (value?: number) => {
  if (!value || value <= 0) return 'Pendente'
  return String(value).padStart(4, '0')
}

export default function ApontamentosHome() {
  const { dark } = useTheme()
  const navigate = useNavigate()

  const { data: todos       = [] } = useApontamentosCartao()
  const { data: enviados    = [] } = useApontamentosCartao({ status: 'enviado' })
  const { data: conciliados = [] } = useApontamentosCartao({ status: 'conciliado' })

  const totalValor = todos.reduce((s, a) => s + Number(a.valor), 0)
  const valorEnviado = enviados.reduce((s, a) => s + Number(a.valor), 0)

  const kpis = [
    {
      label: 'Total Apontado',
      value: fmt(totalValor),
      icon: TrendingUp,
      color: dark ? 'text-violet-400' : 'text-violet-600',
      bg:    dark ? 'bg-violet-500/10' : 'bg-violet-50',
    },
    {
      label: 'Enviados',
      value: enviados.length,
      sub: fmt(valorEnviado),
      icon: CheckCircle2,
      color: dark ? 'text-blue-400' : 'text-blue-600',
      bg:    dark ? 'bg-blue-500/10' : 'bg-blue-50',
    },
    {
      label: 'Conciliados',
      value: conciliados.length,
      icon: Check,
      color: dark ? 'text-emerald-400' : 'text-emerald-600',
      bg:    dark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    },
  ]

  const fallbackNumberingById = useMemo(() => {
    const ordered = [...todos].sort((a, b) => {
      const byDate = a.data_lancamento.localeCompare(b.data_lancamento)
      if (byDate !== 0) return byDate
      const byCreatedAt = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      if (byCreatedAt !== 0) return byCreatedAt
      return a.id.localeCompare(b.id)
    })
    return Object.fromEntries(ordered.map((item, index) => [item.id, index + 1]))
  }, [todos])

  const recentes = todos.slice(0, 6)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${dark ? 'bg-violet-500/15' : 'bg-violet-100'}`}>
          <CreditCard className={`w-6 h-6 ${dark ? 'text-violet-400' : 'text-violet-600'}`} />
        </div>
        <div>
          <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
            Apontamentos de Cartão
          </h1>
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            Gastos em cartão corporativo
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div
            key={k.label}
            className={`rounded-xl p-4 border ${
              dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
              {k.value}
            </p>
            {k.sub && (
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{k.sub}</p>
            )}
            <p className={`text-xs mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate(`/apontamentos/realizados?nova=${Date.now()}`)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-colors text-left ${
            dark
              ? 'border-violet-500/40 hover:border-violet-400 hover:bg-violet-500/10 text-violet-400'
              : 'border-violet-300 hover:border-violet-500 hover:bg-violet-50 text-violet-600'
          }`}
        >
          <Plus className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Novo Apontamento</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Registrar gasto no cartão</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/apontamentos/realizados')}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
            dark
              ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-700/50 text-slate-300'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <ClipboardList className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Apontamentos Realizados</p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Ver e gerenciar todos</p>
          </div>
        </button>

      </div>

      {/* Recentes */}
      {recentes.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between ${dark ? 'border-slate-700' : 'border-slate-100'}`}>
            <p className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Apontamentos Recentes</p>
            <button
              onClick={() => navigate('/apontamentos/realizados')}
              className={`text-xs ${dark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-700'}`}
            >
              Ver todos →
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentes.map(ap => (
              <div key={ap.id} className="px-4 py-3 flex items-center gap-3 justify-between">
                <div className={`min-w-[108px] rounded-xl border px-3 py-2 shrink-0 ${
                  dark ? 'border-violet-500/20 bg-violet-500/10' : 'border-violet-200 bg-violet-50'
                }`}>
                  <p className={`text-sm font-black tracking-[0.18em] ${
                    dark ? 'text-violet-100' : 'text-violet-800'
                  }`}>
                    {formatControlNumber(ap.numero ?? fallbackNumberingById[ap.id])}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {ap.descricao}
                  </p>
                  <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {new Date(ap.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {ap.estabelecimento ? ` · ${ap.estabelecimento}` : ''}
                  </p>
                </div>
                <div className="ml-4 text-right shrink-0">
                  <p className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {fmt(Number(ap.valor))}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    ap.status === 'rascunho'   ? (dark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-600')
                  : ap.status === 'enviado'    ? (dark ? 'bg-blue-500/20 text-blue-300'   : 'bg-blue-100 text-blue-700')
                  : ap.status === 'conciliado' ? (dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                  :                              (dark ? 'bg-red-500/20 text-red-300'     : 'bg-red-100 text-red-700')
                  }`}>
                    {ap.status === 'rascunho'
                      ? 'Pendente'
                      : ap.status.charAt(0).toUpperCase() + ap.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
