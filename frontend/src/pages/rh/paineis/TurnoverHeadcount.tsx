// pages/rh/paineis/TurnoverHeadcount.tsx — saídas por faixa/cargo/mês + custo (salário do cadastro).
import { useMemo } from 'react'
import { UserMinus, Briefcase, Grid3x3, DollarSign } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useHeadcountDataset } from '../../../hooks/useRH'
import { turnoverAgg, fmtBRL } from '../../../lib/headcountAnalytics'
import { PanelCard, Kpi, HBarRow, Heatmap } from './_ui'

const FAIXA_COR: Record<string, string> = { m1: '#dc2626', m1_6: '#d97706', m6_12: '#ca8a04', a1_2: '#16a34a', a2: '#0891b2' }

export default function TurnoverHeadcount() {
  const { isDark } = useTheme()
  const { data: rows = [], isLoading } = useHeadcountDataset()
  const agg = useMemo(() => turnoverAgg(rows), [rows])

  if (isLoading) return <Spinner />

  const custoMaxFaixa = Math.max(...agg.porFaixa.map(f => f.custo), 1)
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

      {!agg.temSalario && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
          <DollarSign size={13} className="shrink-0" />
          O custo em R$ aparece zerado porque o salário ainda não está cadastrado. Assim que o campo <b>salário</b> do colaborador for preenchido, o custo é calculado automaticamente (salário × multiplicador por tempo de casa).
        </div>
      )}

      {/* Saídas por faixa de tempo de casa */}
      <PanelCard title="Saídas por Tempo de Casa" icon={<UserMinus size={14} className="text-violet-500" />} isDark={isDark}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {agg.porFaixa.map(f => (
            <div key={f.key} className={`rounded-xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: FAIXA_COR[f.key] }} />
                <span className={`text-[9px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.label}</span>
              </div>
              <p className={`text-xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{f.saidas}</p>
              <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{agg.temSalario ? fmtBRL(f.custo) : 'saídas'}</p>
            </div>
          ))}
        </div>
        {agg.temSalario && (
          <div className="mt-3 space-y-1.5">
            {agg.porFaixa.filter(f => f.custo > 0).map(f => (
              <HBarRow key={f.key} label={f.label} value={f.custo} max={custoMaxFaixa} color={FAIXA_COR[f.key]} suffix={fmtBRL(f.custo)} isDark={isDark} />
            ))}
          </div>
        )}
      </PanelCard>

      {/* Top cargos por saídas */}
      <PanelCard title="Top Cargos por Saídas" icon={<Briefcase size={14} className="text-violet-500" />} isDark={isDark}>
        <div className="space-y-1.5">
          {agg.porCargo.slice(0, 10).map(c => (
            <HBarRow key={c.cargo} label={c.cargo} value={c.saidas} max={maxSaiCargo} color="#e87b2a"
              suffix={`${c.saidas} · ${c.pctTurnover.toFixed(0)}%`} isDark={isDark} />
          ))}
        </div>
        <p className={`mt-2 text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Valor = saídas · % de turnover do cargo (saídas ÷ total que passou pelo cargo).</p>
      </PanelCard>

      {/* Heatmaps por ano */}
      {Object.entries(agg.heatmap).map(([ano, hm]) => (
        hm.linhas.length > 0 && (
          <PanelCard key={ano} title={`Saídas por Setor × Mês — ${ano}`} icon={<Grid3x3 size={14} className="text-violet-500" />} isDark={isDark}>
            <Heatmap linhas={hm.linhas} totalMes={hm.totalMes} isDark={isDark} />
          </PanelCard>
        )
      ))}
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}
