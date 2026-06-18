// pages/rh/paineis/TurnoverHeadcount.tsx — saídas por faixa/cargo/mês + custo (salário do cadastro).
import { useMemo } from 'react'
import { UserMinus, Briefcase, Grid3x3 } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useHeadcountDataset } from '../../../hooks/useRH'
import { turnoverAgg, fmtBRL } from '../../../lib/headcountAnalytics'
import { PanelCard, Kpi, HBarRow, Heatmap } from './_ui'

const FAIXA_COR: Record<string, string> = { m1: '#dc2626', m1_6: '#d97706', m6_12: '#ca8a04', a1_2: '#16a34a', a2: '#0891b2' }

export default function TurnoverHeadcount({ de = '2025-01', ate }: { de?: string; ate: string }) {
  const { isDark } = useTheme()
  const { data: rows = [], isLoading } = useHeadcountDataset()
  const agg = useMemo(() => turnoverAgg(rows, de, ate), [rows, de, ate])

  if (isLoading) return <Spinner />

  const maxSaiFaixa = Math.max(...agg.porFaixa.map(f => f.saidas), 1)
  const maxSaiCargo = Math.max(...agg.porCargo.map(c => c.saidas), 1)
  const custoMed = agg.totalSaidas ? agg.custoTotal / agg.totalSaidas : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Saídas" value={agg.totalSaidas} tone="amber" note={agg.saidasSemData ? `+${agg.saidasSemData} sem data` : 'com data'} isDark={isDark} />
        <Kpi label="Custo Total" value={agg.temSalario ? fmtBRL(agg.custoTotal) : 'R$ 0'} tone="red" note={agg.temSalario ? 'estimado' : 'sem salário'} isDark={isDark} />
        <Kpi label="Custo / Saída" value={agg.temSalario ? fmtBRL(custoMed) : 'R$ 0'} tone="orange" note="média" isDark={isDark} />
        <Kpi label="Faixa crítica" value={agg.porFaixa[0]?.saidas ?? 0} tone="violet" note="< 1 mês" isDark={isDark} />
      </div>

      {/* Tempo de casa + Top cargos lado a lado (50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <PanelCard title="Saídas por Tempo de Casa" icon={<UserMinus size={14} className="text-violet-500" />} isDark={isDark}>
          <div className="space-y-1.5">
            {agg.porFaixa.map(f => (
              <HBarRow key={f.key} label={f.label} value={f.saidas} max={maxSaiFaixa} color={FAIXA_COR[f.key]}
                suffix={agg.temSalario ? `${f.saidas} · ${fmtBRL(f.custo)}` : `${f.saidas}`} isDark={isDark} />
            ))}
          </div>
          <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Valor = saídas{agg.temSalario ? ' · custo estimado' : ''} por faixa de tempo na saída.</p>
        </PanelCard>

        <PanelCard title="Top Cargos por Saídas" icon={<Briefcase size={14} className="text-violet-500" />} isDark={isDark}>
          <div className="space-y-1.5">
            {agg.porCargo.slice(0, 10).map(c => (
              <HBarRow key={c.cargo} label={c.cargo} value={c.saidas} max={maxSaiCargo} color="#e87b2a"
                suffix={`${c.saidas} · ${c.pctTurnover.toFixed(0)}%`} isDark={isDark} />
            ))}
          </div>
          <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Valor = saídas · % de turnover do cargo (saídas ÷ total que passou pelo cargo).</p>
        </PanelCard>
      </div>

      {/* Heatmap único — colunas conforme o filtro */}
      {agg.heatmap.linhas.length > 0 && (
        <PanelCard title="Saídas por Setor × Mês" icon={<Grid3x3 size={14} className="text-violet-500" />} isDark={isDark}>
          <Heatmap meses={agg.heatmap.meses} linhas={agg.heatmap.linhas} totalMes={agg.heatmap.totalMes} isDark={isDark} />
        </PanelCard>
      )}
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}
