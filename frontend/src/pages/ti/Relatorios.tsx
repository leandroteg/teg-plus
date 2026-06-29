import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts'
import { getReportSummary } from './data/reports'
import { STATUS_META, STATUS_LIST } from './lib/constants'
import { PageHeader, Spinner } from './components/ui'
import { downloadCSV, toCSV } from './lib/csv'

const COLORS = ['#0ea5e9', '#0d9488', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#64748b', '#3b82f6']
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

export default function Relatorios() {
  const [from, setFrom] = useState(() => isoDaysAgo(30))
  const [to, setTo] = useState(() => isoDaysAgo(0))

  const { data, isLoading } = useQuery({
    queryKey: ['ti', 'reports', from, to],
    queryFn: () => getReportSummary(from, to),
  })

  const statusData = data
    ? STATUS_LIST.map((s) => ({ name: STATUS_META[s].label, value: data.byStatus[s] ?? 0 })).filter((d) => d.value > 0)
    : []

  const exportCSV = () => {
    if (!data) return
    const rows: (string | number)[][] = []
    STATUS_LIST.forEach((s) => rows.push(['Status', STATUS_META[s].label, data.byStatus[s] ?? 0]))
    data.byCategory.forEach((x) => rows.push(['Categoria', x.name, x.value]))
    data.bySector.forEach((x) => rows.push(['Setor', x.name, x.value]))
    data.byAgent.forEach((x) => rows.push(['Agente', x.name, x.value]))
    downloadCSV(`relatorio_${from}_a_${to}.csv`, toCSV(['Seção', 'Item', 'Quantidade'], rows))
  }

  return (
    <div className="ti-scope">
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores dos chamados de T.I."
        action={
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <div>
              <label className="mb-0.5 block text-xs text-slate-500">De</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-500">Até</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn-outline" onClick={exportCSV}><Download className="h-4 w-4" /> CSV</button>
            <button className="btn-outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</button>
          </div>
        }
      />

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Chamados no período" value={data.total} />
            <Kpi label="Resolvidos" value={data.resolvedCount} />
            <Kpi label="Tempo médio de resolução" value={`${data.avgResolutionHours} h`} />
            <Kpi label="SLA cumprido" value={data.slaCompliance == null ? '—' : `${data.slaCompliance}%`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Por status">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartCard>

            <ChartCard title="Volume por dia">
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} />
              </LineChart>
            </ChartCard>

            <ChartCard title="Por categoria">
              <BarChart data={data.byCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Por setor">
              <BarChart data={data.bySector}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Por responsável">
              <BarChart data={data.byAgent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  )
}
