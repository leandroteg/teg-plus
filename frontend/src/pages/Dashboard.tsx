import { useState } from 'react'
import { FileText, Clock, CheckCircle, DollarSign, AlertTriangle, Building2, Wifi, WifiOff } from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import KpiCard from '../components/KpiCard'
import StatusBadge from '../components/StatusBadge'
import type { StatusRequisicao, DashboardData } from '../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const isDemo = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  return url === '' || url.includes('placeholder')
}

const EMPTY_KPIS: DashboardData['kpis'] = {
  total_mes: 0, aguardando_aprovacao: 0, aprovadas_mes: 0,
  rejeitadas_mes: 0, valor_total_mes: 0, tempo_medio_aprovacao_horas: 0,
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('mes')
  const { data, isLoading } = useDashboard(periodo)

  if (isLoading) return <Loader />

  const kpis = data?.kpis ?? EMPTY_KPIS
  const por_obra = data?.por_obra ?? []
  const requisicoes_recentes = data?.requisicoes_recentes ?? []

  return (
    <div className="space-y-4">
      {/* Demo banner */}
      {isDemo() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-700">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>Modo demonstracao - Configure Supabase nas env vars da Vercel para dados reais</span>
        </div>
      )}
      {!isDemo() && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-green-700">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span>Conectado ao Supabase</span>
        </div>
      )}

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
