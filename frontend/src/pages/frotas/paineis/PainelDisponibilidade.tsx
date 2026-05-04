// ─────────────────────────────────────────────────────────────────────────────
// PainelDisponibilidade — Replica o dashboard da planilha BEP_TEG
// 5 blocos: Indicadores · Disponibilidade por Categoria · Paradas por Categoria
//           · Paradas por Canteiro · Ranking Mais Críticos
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Wrench, Building2, Trophy, Activity, Clock,
} from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { supabase } from '../../../services/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface OSPainel {
  id: string
  veiculo_id: string
  status: string
  status_detalhe?: string
  data_abertura: string
  data_previsao?: string
  data_conclusao?: string
  descricao_problema?: string
  valor_orcado?: number
  veiculo?: {
    placa: string
    marca: string
    modelo: string
    categoria: string
    subcategoria?: string
  }
  obra_atual?: { id: string; nome: string }
}

// ── Hook: traz dados das OS abertas + alocação ativa para canteiro ────────────

function useDadosDisponibilidade() {
  return useQuery({
    queryKey: ['painel_disponibilidade'],
    queryFn: async () => {
      // OS atualmente abertas (= em parada)
      const { data: oss = [], error } = await supabase
        .from('fro_ordens_servico')
        .select(`*, veiculo:fro_veiculos(placa,marca,modelo,categoria,subcategoria)`)
        .not('status', 'in', '(concluida,cancelada,rejeitada)')
      if (error) throw error

      // Alocações ativas pra mapear veiculo → obra
      const { data: alocs = [] } = await supabase
        .from('fro_alocacoes')
        .select('veiculo_id, obra_id, obra:sys_obras!obra_id(id,nome)')
        .eq('status', 'ativa')

      const obraByVeic = new Map<string, { id: string; nome: string }>()
      ;(alocs ?? []).forEach((a: Record<string, unknown>) => {
        if (a.obra) obraByVeic.set(a.veiculo_id as string, a.obra as { id: string; nome: string })
      })

      // Veículos totais
      const { data: veiculos = [] } = await supabase
        .from('fro_veiculos')
        .select('id, categoria, subcategoria, status')
        .neq('status', 'baixado')

      // Enriquece OS com obra
      const ossComObra: OSPainel[] = (oss ?? []).map((o: OSPainel) => ({
        ...o,
        obra_atual: obraByVeic.get(o.veiculo_id),
      }))

      return { oss: ossComObra, veiculos: veiculos ?? [] }
    },
    refetchInterval: 60_000,
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasParado(dataAbertura: string): number {
  return Math.floor((Date.now() - new Date(dataAbertura).getTime()) / 86_400_000)
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Em parada',
  pendente: 'Pendente',
  em_cotacao: 'Aguardando orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em manutenção',
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function PainelDisponibilidade() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const { data, isLoading } = useDadosDisponibilidade()

  const txt = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const cardCls = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'

  // ── Bloco ① — KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!data) return null
    const { oss, veiculos } = data
    return {
      em_parada: oss.length,
      em_manutencao: oss.filter(o => o.status === 'em_execucao').length,
      aguard_orcamento: oss.filter(o => o.status === 'em_cotacao').length,
      aguard_aprovacao: oss.filter(o => o.status === 'aguardando_aprovacao').length,
      aguard_pecas: oss.filter(o => (o.status_detalhe ?? '').toLowerCase().includes('pec')).length,
      mais_30_dias: oss.filter(o => diasParado(o.data_abertura) > 30).length,
      total_dias: oss.reduce((s, o) => s + diasParado(o.data_abertura), 0),
      custo: oss.reduce((s, o) => s + (Number(o.valor_orcado) || 0), 0),
      total_frota: veiculos.length,
    }
  }, [data])

  // ── Bloco ② — Disponibilidade por Subcategoria ─────────────────────────────
  const disponibilidade = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { subcat: string; total: number; em_parada: number }>()
    for (const v of data.veiculos) {
      const key = v.subcategoria || '(sem subcategoria)'
      if (!map.has(key)) map.set(key, { subcat: key, total: 0, em_parada: 0 })
      map.get(key)!.total++
    }
    for (const o of data.oss) {
      const key = (o.veiculo?.subcategoria) || '(sem subcategoria)'
      if (map.has(key)) map.get(key)!.em_parada++
    }
    return Array.from(map.values())
      .map(r => ({ ...r, disponiveis: r.total - r.em_parada, pct: r.total ? (r.total - r.em_parada) / r.total : 0 }))
      .sort((a, b) => b.total - a.total)
  }, [data])

  // ── Bloco ③ — Paradas por Subcategoria ─────────────────────────────────────
  const paradasPorCategoria = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { subcat: string; paradas: number; dias: number; custo: number }>()
    for (const o of data.oss) {
      const key = (o.veiculo?.subcategoria) || '(sem subcategoria)'
      if (!map.has(key)) map.set(key, { subcat: key, paradas: 0, dias: 0, custo: 0 })
      const e = map.get(key)!
      e.paradas++
      e.dias += diasParado(o.data_abertura)
      e.custo += Number(o.valor_orcado) || 0
    }
    const total = Array.from(map.values()).reduce((s, r) => s + r.paradas, 0) || 1
    return Array.from(map.values())
      .map(r => ({ ...r, pct: r.paradas / total }))
      .sort((a, b) => b.paradas - a.paradas)
  }, [data])

  // ── Bloco ④ — Paradas por Canteiro ─────────────────────────────────────────
  const paradasPorCanteiro = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { canteiro: string; paradas: number; dias: number; custo: number }>()
    for (const o of data.oss) {
      const key = o.obra_atual?.nome ?? '(sem canteiro)'
      if (!map.has(key)) map.set(key, { canteiro: key, paradas: 0, dias: 0, custo: 0 })
      const e = map.get(key)!
      e.paradas++
      e.dias += diasParado(o.data_abertura)
      e.custo += Number(o.valor_orcado) || 0
    }
    const total = Array.from(map.values()).reduce((s, r) => s + r.paradas, 0) || 1
    return Array.from(map.values())
      .map(r => ({ ...r, pct: r.paradas / total }))
      .sort((a, b) => b.paradas - a.paradas)
  }, [data])

  // ── Bloco ⑤ — Ranking Mais Críticos ────────────────────────────────────────
  const ranking = useMemo(() => {
    if (!data) return []
    return data.oss
      .map(o => ({
        placa: o.veiculo?.placa ?? '—',
        subcat: o.veiculo?.subcategoria ?? '—',
        canteiro: o.obra_atual?.nome ?? '—',
        dias: diasParado(o.data_abertura),
        diagnostico: o.descricao_problema ?? '',
        status_detalhe: o.status_detalhe ?? '',
      }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 8)
  }, [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || !kpis) return null

  // Estilo dos cards de KPI
  const kpiCard = (label: string, value: string | number, icon: React.ReactNode, color: string) => (
    <div className={`rounded-xl p-3 ${cardCls}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`${color}`}>{icon}</span>
        <span className={`text-2xl font-extrabold ${txt}`}>{value}</span>
      </div>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${txtMuted}`}>{label}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ── ① Indicadores Gerenciais ────────────────────────────────────── */}
      <section>
        <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 ${txt}`}>
          ① Indicadores Gerenciais
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {kpiCard('Em Parada', kpis.em_parada, <AlertTriangle size={16} />, 'text-rose-500')}
          {kpiCard('Em Manutenção', kpis.em_manutencao, <Wrench size={16} />, 'text-amber-500')}
          {kpiCard('Aguard. Orçamento', kpis.aguard_orcamento, <Clock size={16} />, 'text-blue-500')}
          {kpiCard('Aguard. Aprovação', kpis.aguard_aprovacao, <Clock size={16} />, 'text-violet-500')}
          {kpiCard('> 30 dias', kpis.mais_30_dias, <AlertTriangle size={16} />, 'text-red-600')}
          {kpiCard('Total Dias Parados', kpis.total_dias, <Activity size={16} />, 'text-slate-500')}
          {kpiCard('Custo Estimado', fmtBRL(kpis.custo), <Wrench size={16} />, 'text-rose-600')}
          {kpiCard('Total Frota', kpis.total_frota, <Building2 size={16} />, 'text-emerald-500')}
        </div>
      </section>

      {/* ── ② Disponibilidade por Categoria ─────────────────────────────── */}
      <section className={`rounded-2xl p-4 ${cardCls}`}>
        <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>
          ② Disponibilidade da Frota por Categoria
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
                <th className="text-left py-2 px-3">Categoria</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="text-right py-2 px-3">Em Parada</th>
                <th className="text-right py-2 px-3">Disponíveis</th>
                <th className="text-right py-2 px-3">Disp. %</th>
                <th className="text-left py-2 px-3 w-[200px]">Visual</th>
              </tr>
            </thead>
            <tbody>
              {disponibilidade.map(r => (
                <tr key={r.subcat} className={`${isLight ? 'border-t border-slate-100' : 'border-t border-white/[0.04]'}`}>
                  <td className={`py-2 px-3 font-semibold ${txt}`}>{r.subcat}</td>
                  <td className={`py-2 px-3 text-right font-mono ${txt}`}>{r.total}</td>
                  <td className={`py-2 px-3 text-right font-mono ${r.em_parada > 0 ? 'text-rose-600' : txtMuted}`}>{r.em_parada}</td>
                  <td className={`py-2 px-3 text-right font-mono ${txt}`}>{r.disponiveis}</td>
                  <td className={`py-2 px-3 text-right font-bold ${
                    r.pct >= 0.9 ? 'text-emerald-600' : r.pct >= 0.75 ? 'text-amber-600' : 'text-rose-600'
                  }`}>{fmtPct(r.pct)}</td>
                  <td className="py-2 px-3">
                    <div className={`h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`}>
                      <div className={`h-full transition-all ${
                        r.pct >= 0.9 ? 'bg-emerald-500' : r.pct >= 0.75 ? 'bg-amber-500' : 'bg-rose-500'
                      }`} style={{ width: `${r.pct * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ③ + ④ — Paradas por Categoria + por Canteiro ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`rounded-2xl p-4 ${cardCls}`}>
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>
            ③ Paradas por Categoria
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
                <th className="text-left py-2">Categoria</th>
                <th className="text-right py-2">Paradas</th>
                <th className="text-right py-2">Dias</th>
                <th className="text-right py-2">Custo</th>
              </tr>
            </thead>
            <tbody>
              {paradasPorCategoria.map(r => (
                <tr key={r.subcat} className={`${isLight ? 'border-t border-slate-100' : 'border-t border-white/[0.04]'}`}>
                  <td className={`py-2 ${txt}`}>{r.subcat}</td>
                  <td className={`py-2 text-right font-mono ${txt}`}>{r.paradas}</td>
                  <td className={`py-2 text-right font-mono ${txt}`}>{r.dias}</td>
                  <td className={`py-2 text-right font-mono ${r.custo > 0 ? 'text-rose-600' : txtMuted}`}>{r.custo > 0 ? fmtBRL(r.custo) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`rounded-2xl p-4 ${cardCls}`}>
          <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt}`}>
            ④ Paradas por Canteiro
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
                <th className="text-left py-2">Canteiro</th>
                <th className="text-right py-2">Paradas</th>
                <th className="text-right py-2">Dias</th>
                <th className="text-right py-2">Custo</th>
              </tr>
            </thead>
            <tbody>
              {paradasPorCanteiro.map(r => (
                <tr key={r.canteiro} className={`${isLight ? 'border-t border-slate-100' : 'border-t border-white/[0.04]'}`}>
                  <td className={`py-2 ${txt}`}>{r.canteiro}</td>
                  <td className={`py-2 text-right font-mono ${txt}`}>{r.paradas}</td>
                  <td className={`py-2 text-right font-mono ${txt}`}>{r.dias}</td>
                  <td className={`py-2 text-right font-mono ${r.custo > 0 ? 'text-rose-600' : txtMuted}`}>{r.custo > 0 ? fmtBRL(r.custo) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* ── ⑤ Ranking Mais Críticos ──────────────────────────────────────── */}
      <section className={`rounded-2xl p-4 ${cardCls}`}>
        <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${txt} flex items-center gap-2`}>
          <Trophy size={14} className="text-rose-500" />
          ⑤ Ranking — Veículos Mais Críticos
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
                <th className="text-left py-2 px-3">Placa</th>
                <th className="text-left py-2 px-3">Categoria</th>
                <th className="text-left py-2 px-3">Canteiro</th>
                <th className="text-right py-2 px-3">Dias Parados</th>
                <th className="text-left py-2 px-3">Diagnóstico</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={i} className={`${isLight ? 'border-t border-slate-100' : 'border-t border-white/[0.04]'}`}>
                  <td className={`py-2 px-3 font-mono font-bold ${txt}`}>{r.placa}</td>
                  <td className={`py-2 px-3 ${txtMuted}`}>{r.subcat}</td>
                  <td className={`py-2 px-3 ${txtMuted}`}>{r.canteiro}</td>
                  <td className={`py-2 px-3 text-right font-bold ${r.dias > 30 ? 'text-rose-600' : r.dias > 14 ? 'text-amber-600' : txt}`}>
                    {r.dias}
                  </td>
                  <td className={`py-2 px-3 ${txtMuted} max-w-[200px] truncate`} title={r.diagnostico}>{r.diagnostico}</td>
                  <td className={`py-2 px-3 text-[10px] ${txtMuted} max-w-[200px] truncate`} title={r.status_detalhe}>{r.status_detalhe}</td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr><td colSpan={6} className={`py-6 text-center ${txtMuted}`}>Nenhum veículo em parada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
