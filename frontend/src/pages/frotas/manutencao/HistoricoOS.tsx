import { useState, useMemo } from 'react'
import { History, CheckCircle2, XCircle, Ban, TrendingUp } from 'lucide-react'
import { useOrdensServico, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { TipoOS, StatusOS } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

const TIPO_LABEL: Record<TipoOS, string> = {
  preventiva: 'Preventiva',
  corretiva:  'Corretiva',
  sinistro:   'Sinistro',
  revisao:    'Revisão',
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  concluida:  { label: 'Concluída',  cls: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
  rejeitada:  { label: 'Rejeitada',  cls: 'bg-red-500/15 text-red-400',         icon: XCircle      },
  cancelada:  { label: 'Cancelada',  cls: 'bg-slate-500/15 text-slate-400',     icon: Ban          },
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({
  label,
  value,
  sub,
  isLight,
}: {
  label: string
  value: string | number
  sub?: string
  isLight: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
    }`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-extrabold leading-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HistoricoOS() {
  const { isLightSidebar: isLight } = useTheme()

  const [mes, setMes]         = useState(mesAtual())
  const [filtroTipo, setFiltroTipo]     = useState<TipoOS | ''>('')
  const [filtroVeiculo, setFiltroVeiculo] = useState('')

  const { data: historico = [], isLoading } = useOrdensServico({
    status: ['concluida', 'rejeitada', 'cancelada'] as StatusOS[],
  })
  const { data: veiculos = [] } = useVeiculos()

  // ── Filtragem ──────────────────────────────────────────────────────────────
  const filtrado = useMemo(() => {
    const inicioMes = mes + '-01'
    const fimMes    = mes + '-31'
    return historico.filter(os => {
      const ref = os.data_conclusao ?? os.data_abertura
      if (ref < inicioMes || ref > fimMes) return false
      if (filtroTipo && os.tipo !== filtroTipo) return false
      if (filtroVeiculo && os.veiculo_id !== filtroVeiculo) return false
      return true
    })
  }, [historico, mes, filtroTipo, filtroVeiculo])

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const concluidas  = filtrado.filter(os => os.status === 'concluida')
  const valorTotal  = concluidas.reduce((s, os) => s + (os.valor_final ?? 0), 0)

  const porTipo = useMemo(() => {
    const map: Partial<Record<TipoOS, number>> = {}
    concluidas.forEach(os => {
      map[os.tipo] = (map[os.tipo] ?? 0) + 1
    })
    return map
  }, [concluidas])

  // ── Estilos ────────────────────────────────────────────────────────────────
  const card = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
  const divider = isLight ? 'border-slate-100' : 'border-white/[0.04]'
  const th = `px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`
  const td = `px-3 py-2.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'}`
  const trEven = isLight ? 'bg-slate-50/60' : 'bg-white/[0.02]'
  const inp = `px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40 transition-colors ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <History size={20} className="text-teal-500" />
          Histórico de OS
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          OS concluídas, rejeitadas e canceladas
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="month"
          className={inp}
          value={mes}
          onChange={e => setMes(e.target.value)}
        />
        <select
          className={sel}
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoOS | '')}
        >
          <option value="">Todos os tipos</option>
          {(Object.keys(TIPO_LABEL) as TipoOS[]).map(k => (
            <option key={k} value={k}>{TIPO_LABEL[k]}</option>
          ))}
        </select>
        <select
          className={sel}
          value={filtroVeiculo}
          onChange={e => setFiltroVeiculo(e.target.value)}
        >
          <option value="">Todos os veículos</option>
          {veiculos.map(v => (
            <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Concluídas no Período"
          value={concluidas.length}
          sub={`de ${filtrado.length} no total`}
          isLight={isLight}
        />
        <KPICard
          label="Valor Total"
          value={BRL(valorTotal)}
          sub="OS concluídas"
          isLight={isLight}
        />
        <KPICard
          label="Preventivas"
          value={porTipo.preventiva ?? 0}
          sub="concluídas"
          isLight={isLight}
        />
        <KPICard
          label="Corretivas"
          value={porTipo.corretiva ?? 0}
          sub="concluídas"
          isLight={isLight}
        />
      </div>

      {/* OS por tipo badges */}
      {(Object.keys(TIPO_LABEL) as TipoOS[]).some(k => (porTipo[k] ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          <TrendingUp size={12} className="text-slate-500" />
          {(Object.keys(TIPO_LABEL) as TipoOS[]).map(k => {
            const count = porTipo[k] ?? 0
            if (count === 0) return null
            return (
              <span
                key={k}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/8 text-slate-300'
                }`}
              >
                {TIPO_LABEL[k]}: {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Tabela */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-10 rounded-xl animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`} />
            ))}
          </div>
        ) : filtrado.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">
            Nenhuma OS encontrada para os filtros selecionados
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${divider}`}>
                <th className={th}>OS#</th>
                <th className={th}>Veículo</th>
                <th className={th}>Tipo</th>
                <th className={th}>Fornecedor</th>
                <th className={th}>Abertura</th>
                <th className={th}>Conclusão</th>
                <th className={th}>Valor</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((os, idx) => {
                const sCfg = STATUS_CFG[os.status] ?? STATUS_CFG['cancelada']
                const SIcon = sCfg.icon
                return (
                  <tr key={os.id} className={idx % 2 === 1 ? trEven : ''}>
                    <td className={td + ' font-bold'}>{os.numero_os ?? '—'}</td>
                    <td className={td}>
                      <span className="font-semibold">{os.veiculo?.placa ?? '—'}</span>
                      <span className={`ml-1.5 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                        {os.veiculo?.modelo}
                      </span>
                    </td>
                    <td className={td}>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/8 text-slate-300'
                      }`}>
                        {TIPO_LABEL[os.tipo]}
                      </span>
                    </td>
                    <td className={td}>{os.fornecedor?.razao_social ?? '—'}</td>
                    <td className={td}>{fmtDate(os.data_abertura)}</td>
                    <td className={td}>{fmtDate(os.data_conclusao)}</td>
                    <td className={td + ' font-bold'}>
                      {os.valor_final ? BRL(os.valor_final) : os.status !== 'concluida' ? '—' : '—'}
                    </td>
                    <td className={td}>
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${sCfg.cls}`}>
                        <SIcon size={10} />
                        {sCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
