// pages/rh/paineis/ComposicaoHeadcount.tsx — composição do quadro por setor/cargo + tempo de empresa.
import { useMemo, useState } from 'react'
import { PieChart, Layers, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useHeadcountDataset } from '../../../hooks/useRH'
import {
  composicaoAtual, evolucaoPorSetor, tempoEmpresaDist, cargoParaSetor,
  listaMeses, ymLabel, parseData, tempoEmpresaTexto, type HeadcountRow,
} from '../../../lib/headcountAnalytics'
import { PanelCard, Kpi, StackedMonthChart, Legenda, ProporcaoBar } from './_ui'

export default function ComposicaoHeadcount({ de = '2025-01', ate }: { de?: string; ate: string }) {
  const { isDark } = useTheme()
  const { data: rows = [], isLoading } = useHeadcountDataset()
  const [aberto, setAberto] = useState<string | null>(null)

  const dados = useMemo(() => {
    const comp = composicaoAtual(rows)
    const meses = listaMeses(de, ate)
    const evo = evolucaoPorSetor(rows, meses)
    const tempo = tempoEmpresaDist(rows)
    // colaboradores por setor (ativos + saíram) para as tabelas
    const porSetor = new Map<string, HeadcountRow[]>()
    for (const r of rows) {
      const k = cargoParaSetor(r.cargo)
      if (!porSetor.has(k)) porSetor.set(k, [])
      porSetor.get(k)!.push(r)
    }
    return { comp, evo: { meses: meses.map(ymLabel), series: evo.series }, tempo, porSetor }
  }, [rows, de, ate])

  if (isLoading) return <Spinner />

  const { comp, evo, tempo, porSetor } = dados
  const maxTempo = Math.max(...tempo.map(t => t.ativos), 1)
  const hoje = new Date()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Total Ativos" value={comp.total} tone="violet" isDark={isDark} />
        {comp.setores.slice(0, 3).map((s, i) => (
          <Kpi key={s.key} label={s.label} value={s.total} tone={['emerald', 'sky', 'amber'][i]} note={`${s.pct.toFixed(1)}%`} isDark={isDark} />
        ))}
      </div>

      {/* Evolução por setor + proporção */}
      <PanelCard title="Evolução por Área — no período" icon={<Layers size={14} className="text-violet-500" />} isDark={isDark}
        right={<Legenda items={evo.series} isDark={isDark} />}>
        {evo.series.length === 0 ? <Vazio isDark={isDark} /> : <StackedMonthChart meses={evo.meses} series={evo.series} isDark={isDark} height={200} />}
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      {/* Coluna esquerda: Composição Equipe + Tempo de Empresa */}
      <div className="space-y-3">
      <PanelCard title="Composição Equipe" icon={<PieChart size={14} className="text-violet-500" />} isDark={isDark}>
        <ProporcaoBar segments={comp.setores.map(s => ({ label: s.label, value: s.total, color: s.color }))} isDark={isDark} />
      </PanelCard>
      <PanelCard title="Tempo de Empresa" icon={<Clock size={15} className="text-violet-500" />} isDark={isDark}>
        <div className="space-y-2.5">
          {tempo.map(t => (
            <div key={t.key} className="flex items-center gap-2">
              <p className={`text-[13px] font-semibold text-right shrink-0 w-[112px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.label}</p>
              <div className={`flex-1 h-7 rounded-md overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                <div className="h-full rounded-md bg-emerald-500/80" style={{ width: `${Math.max((t.ativos / maxTempo) * 100, 2)}%` }} title={`Ativos: ${t.ativos}`} />
              </div>
              <p className={`text-[15px] font-extrabold shrink-0 w-[44px] text-right ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>{t.ativos}</p>
              <p className={`text-[12px] shrink-0 w-[74px] text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.saiu} saíram</p>
            </div>
          ))}
        </div>
        <p className={`mt-2.5 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Barra = ativos por faixa (tempo real de admissão). "Saíram" = quem desligou naquela faixa.</p>
      </PanelCard>
      </div>

      {/* Tabelas por setor (colapsáveis) */}
      <PanelCard title="Detalhamento por Setor" icon={<Layers size={14} className="text-violet-500" />} isDark={isDark} pad={false}>
        <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
          {comp.setores.map(s => {
            const lista = (porSetor.get(s.key) ?? []).slice().sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
            const ativos = lista.filter(r => r.ativo).length
            const open = aberto === s.key
            return (
              <div key={s.key}>
                <button onClick={() => setAberto(open ? null : s.key)} className={`w-full flex items-center gap-2 px-4 py-3 ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                  {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className={`text-sm font-bold flex-1 text-left ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s.label}</span>
                  <span className={`text-[12px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ativos} ativos · {lista.length} no histórico</span>
                </button>
                {open && (
                  <div className="px-4 pb-3 overflow-x-auto">
                    {/* cargo pills */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {s.cargos.slice(0, 16).map(c => (
                        <span key={c.cargo} className={`text-[11px] px-2 py-0.5 rounded font-semibold ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{c.cargo} <b>{c.n}</b></span>
                      ))}
                    </div>
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                          {['Nome', 'Cargo', 'Status', 'Admissão', 'Saída', 'Tempo'].map(h => <th key={h} className="px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.slice(0, 200).map(r => {
                          const adm = parseData(r.data_admissao), dem = parseData(r.data_demissao)
                          return (
                            <tr key={r.id} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                              <td className={`px-2 py-1.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.nome}</td>
                              <td className={`px-2 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.cargo || '—'}</td>
                              <td className="px-2 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.ativo ? (isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600')}`}>{r.ativo ? 'Ativo' : 'Saiu'}</span>
                              </td>
                              <td className={`px-2 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{adm ? adm.toLocaleDateString('pt-BR') : '—'}</td>
                              <td className={`px-2 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{dem ? dem.toLocaleDateString('pt-BR') : '—'}</td>
                              <td className={`px-2 py-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{adm ? tempoEmpresaTexto(adm, dem || hoje) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </PanelCard>
      </div>

      <p className={`text-[11px] px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Setor derivado do cargo por regras de palavra-chave (rh_colaboradores.setor está vazio). Refinável depois.</p>
    </div>
  )
}

function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
}
function Vazio({ isDark }: { isDark: boolean }) {
  return <div className={`h-40 rounded-xl flex items-center justify-center text-xs ${isDark ? 'bg-white/[0.03] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Sem dados no período</div>
}
