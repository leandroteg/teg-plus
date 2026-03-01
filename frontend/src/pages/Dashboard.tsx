import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle, DollarSign, AlertTriangle, Building2, Sparkles, RefreshCw, Settings } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import KpiCard from '../components/KpiCard'
import StatusBadge from '../components/StatusBadge'
import { isPlaceholder } from '../services/supabase'
import type { StatusRequisicao, DashboardData } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('mes')
  const { data, isLoading, isError, error, refetch } = useDashboard(periodo)

  // Detecta ambiente sem variáveis de ambiente configuradas
  if (isPlaceholder) return <SetupRequired />

  if (isLoading) return <Loader />

  if (isError) {
    // Extrai mensagem legível de PostgrestError ou qualquer tipo de erro
    const errObj = error as Record<string, unknown> | null
    const errMsg =
      (errObj?.message as string) ||
      (errObj?.details as string) ||
      (typeof error === 'string' ? error : 'Erro desconhecido')
    const errCode = (errObj?.code as string) || (errObj?.hint as string) || ''

    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center max-w-xs">
          <p className="text-gray-700 font-medium mb-1">Erro ao carregar dados</p>
          <p className="text-xs text-red-500 font-mono mb-1">{errMsg}</p>
          {errCode && <p className="text-xs text-gray-400 font-mono">{errCode}</p>}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200 transition"
        >
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    )
  }

  const kpis = data?.kpis ?? EMPTY_KPIS
  const por_obra = data?.por_obra ?? []
  const requisicoes_recentes = data?.requisicoes_recentes ?? []

  return (
    <div className="space-y-4">

      {/* ApprovaAi Link */}
      <Link
        to="/aprovaai"
        className="block bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-4 shadow-lg shadow-violet-200 active:scale-[0.98] transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">ApprovaAi</h3>
              <p className="text-violet-200 text-xs">Aprovacoes pendentes</p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-sm font-bold">{kpis.aguardando_aprovacao}</span>
          </div>
        </div>
      </Link>

      {/* Periodo */}
      <div className="flex gap-2">
        {['semana', 'mes', 'trimestre'].map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              periodo === p ? 'bg-primary text-white' : 'bg-white text-gray-600 border'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard titulo="Total RCs" valor={kpis.total_mes} icon={FileText} cor="text-primary" />
        <KpiCard titulo="Aguardando" valor={kpis.aguardando_aprovacao} icon={Clock} cor="text-warning" />
        <KpiCard titulo="Aprovadas" valor={kpis.aprovadas_mes} icon={CheckCircle} cor="text-success" />
        <KpiCard titulo="Valor Total" valor={fmt(kpis.valor_total_mes)} icon={DollarSign} cor="text-primary" />
      </div>

      {/* Por Obra */}
      {por_obra.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <Building2 className="w-4 h-4" /> Por Obra
          </h2>
          <div className="space-y-2">
            {por_obra.map(o => (
              <div key={o.obra_nome} className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{o.obra_nome}</p>
                  <p className="text-xs text-gray-400">{o.total} requisicoes</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{fmt(o.valor)}</p>
                  {o.pendentes > 0 && (
                    <span className="text-xs text-warning flex items-center gap-0.5 justify-end">
                      <AlertTriangle className="w-3 h-3" /> {o.pendentes} pendentes
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recentes */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Requisicoes Recentes</h2>
        <div className="space-y-2">
          {requisicoes_recentes.map(r => (
            <div key={r.id} className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-mono text-gray-500">{r.numero}</span>
                <StatusBadge status={r.status as StatusRequisicao} />
              </div>
              <p className="text-sm font-medium truncate">{r.descricao}</p>
              <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                <span>{r.obra_nome}</span>
                <span className="font-semibold text-gray-700">{fmt(r.valor_estimado)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
                <span>{r.solicitante_nome}</span>
                <span>{fmtData(r.created_at)}</span>
              </div>
            </div>
          ))}
          {requisicoes_recentes.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Nenhuma requisicao encontrada</p>
          )}
        </div>
      </section>
    </div>
  )
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SetupRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 px-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-amber-500 shrink-0" />
          <h2 className="font-bold text-gray-800">Configuração necessária</h2>
        </div>
        <p className="text-sm text-gray-600">
          As variáveis de ambiente do Supabase não foram configuradas no Vercel.
        </p>
        <div className="space-y-2 text-xs font-mono bg-gray-900 text-green-400 rounded-lg p-3">
          <p className="text-gray-400"># Vercel → Settings → Environment Variables</p>
          <p>VITE_SUPABASE_URL</p>
          <p className="text-gray-500 pl-2">https://uzfjfucrinokeuwpbeie.supabase.co</p>
          <p className="mt-2">VITE_SUPABASE_ANON_KEY</p>
          <p className="text-gray-500 pl-2">← copiar do Supabase Dashboard</p>
        </div>
        <a
          href="https://supabase.com/dashboard/project/uzfjfucrinokeuwpbeie/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs bg-primary text-white rounded-lg py-2 px-4 font-medium hover:opacity-90"
        >
          1. Copiar Anon Key no Supabase →
        </a>
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs bg-gray-800 text-white rounded-lg py-2 px-4 font-medium hover:opacity-90"
        >
          2. Configurar no Vercel →
        </a>
        <p className="text-xs text-gray-400 text-center">
          Após salvar, faça um novo deploy e atualize esta página.
        </p>
      </div>
    </div>
  )
}
