// Painel Custos — orçamento por natureza (Base = 80% do valor contratual, 20% de lucro),
// Projetado (linear ao % físico) e Realizado (financeiro real, fin_legado_custos). Por frente e obra.
import { useMemo, useState } from 'react'
import { Wallet, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useCustosReal, NATUREZAS, MARGEM_LUCRO, type NatKey } from '../../../hooks/useCustos'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import { buildTree, fmtM } from './cronogramaEngine'
import { useFiltrosTree, FiltrosFrenteObra, filtrarTree } from './egpFiltros'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const ORC = 1 - MARGEM_LUCRO // 0.8
type Tri = { base: Record<NatKey, number>; proj: Record<NatKey, number>; real: Record<NatKey, number> }
const zero = () => Object.fromEntries(NATUREZAS.map(n => [n.key, 0])) as Record<NatKey, number>
const somaNat = (m: Record<NatKey, number>) => NATUREZAS.reduce((s, n) => s + (m[n.key] || 0), 0)

export default function CustosPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw, isLoading } = useEAPFinal(portfolioId)
  const { data: custos } = useCustosReal(portfolioId)
  const [openF, setOpenF] = useState<Set<string>>(new Set())
  const [openO, setOpenO] = useState<Set<string>>(new Set())
  const flt = useFiltrosTree()

  const tree = useMemo(() => buildTree(raw), [raw])
  const dados = useMemo(() => {
    const frentes = filtrarTree(tree, flt).map(fr => {
      const obras = fr.obras.map(o => {
        const base = zero(), proj = zero(), real = zero()
        NATUREZAS.forEach(n => { const b = ORC * o.valorContr * n.pct; base[n.key] = b; proj[n.key] = b * o.pctFis / 100; real[n.key] = custos?.porObra[o.nome]?.[n.key] || 0 })
        return { nome: o.nome, pctFis: o.pctFis, valorContr: o.valorContr, base, proj, real }
      })
      const base = zero(), proj = zero(), real = zero()
      NATUREZAS.forEach(n => { base[n.key] = obras.reduce((s, o) => s + o.base[n.key], 0); proj[n.key] = obras.reduce((s, o) => s + o.proj[n.key], 0); real[n.key] = custos?.porFrente[fr.label]?.[n.key] || 0 })
      const valorContr = fr.obras.reduce((s, o) => s + o.valorContr, 0)
      const pctFis = valorContr > 0 ? Math.round(fr.obras.reduce((s, o) => s + o.pctFis * o.valorContr, 0) / valorContr) : 0
      return { label: fr.label, valorContr, pctFis, base, proj, real, obras }
    }).filter(f => f.valorContr > 0)
    const base = zero(), proj = zero(), real = zero()
    NATUREZAS.forEach(n => { base[n.key] = frentes.reduce((s, f) => s + f.base[n.key], 0); proj[n.key] = frentes.reduce((s, f) => s + f.proj[n.key], 0); real[n.key] = custos?.total[n.key] || 0 })
    const valorContr = frentes.reduce((s, f) => s + f.valorContr, 0)
    const pctFis = valorContr > 0 ? Math.round(frentes.reduce((s, f) => s + f.pctFis * f.valorContr, 0) / valorContr) : 0
    return { frentes, total: { base, proj, real } as Tri, valorContr, pctFis }
  }, [tree, custos, flt.fFrente, flt.fObra, flt.fPct])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!tree.length) return <p className={`text-center py-16 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem dados da EAP.</p>

  const tog = (k: string, set: React.Dispatch<React.SetStateAction<Set<string>>>) => set(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const contratado = dados.valorContr, orcado = ORC * contratado
  const realTot = somaNat(dados.total.real), projTot = somaNat(dados.total.proj)
  const desvioTot = realTot - projTot

  const NatTable = ({ t, dense }: { t: Tri; dense?: boolean }) => {
    const th = `px-2 py-1.5 text-right text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`
    const td = `px-2 py-1 text-right text-[11px] tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`
    const stk = `sticky left-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`
    const row = (label: string, cor: string | null, base: number, proj: number, real: number, bold?: boolean) => {
      const desv = real - proj
      return (
        <tr key={label} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} ${bold ? 'font-bold' : ''}`}>
          <td className={`px-2 py-1 text-left text-[11px] ${stk} ${bold ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>{cor && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: cor }} />}{label}</td>
          <td className={td}>{fmtM(base)}</td>
          <td className={td}>{fmtM(proj)}</td>
          <td className={`${td} ${real > 0 ? '' : 'text-slate-400'}`}>{real > 0 ? fmtM(real) : '—'}</td>
          <td className={`${td} font-semibold`} style={{ color: real <= 0 ? undefined : desv > 0 ? '#ef4444' : '#10b981' }}>{real > 0 ? (desv > 0 ? '+' : '') + fmtM(desv) : '·'}</td>
        </tr>
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <th className={`px-2 py-1.5 text-left text-[10px] font-semibold ${stk} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Natureza</th>
            <th className={th}>Base (orçado)</th><th className={th}>Projetado</th><th className={th}>Realizado</th><th className={`${th} pr-3`}>Desvio (R−P)</th>
          </tr></thead>
          <tbody>
            {NATUREZAS.map(n => row(`${n.label} · ${(n.pct * 100).toFixed(1)}%`, n.cor, t.base[n.key], t.proj[n.key], t.real[n.key]))}
            {!dense && row('Total', null, somaNat(t.base), somaNat(t.proj), somaNat(t.real), true)}
          </tbody>
        </table>
      </div>
    )
  }

  const Mini = ({ t }: { t: Tri }) => {
    const r = somaNat(t.real), p = somaNat(t.proj)
    return (
      <span className="ml-auto flex items-center gap-3 text-[11px]">
        <span title="Base (orçado 80%)" className={isDark ? 'text-slate-400' : 'text-slate-500'}>{fmtM(somaNat(t.base))}</span>
        <span title="Realizado" className="font-semibold" style={{ color: r <= 0 ? undefined : r > p ? '#ef4444' : '#10b981' }}>{r > 0 ? fmtM(r) : '—'}</span>
      </span>
    )
  }

  return (
    <div className="space-y-3">
      <FiltrosFrenteObra tree={tree} f={flt} isDark={isDark} />
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Kpi label="Valor contratado" value={fmtM(contratado)} tone="sky" isDark={isDark} note="previsto (OSCs)" />
        <Kpi label="Orçado (custo)" value={fmtM(orcado)} tone="violet" isDark={isDark} note={`${(ORC * 100).toFixed(0)}% · margem ${(MARGEM_LUCRO * 100).toFixed(0)}%`} />
        <Kpi label="Projetado" value={fmtM(projTot)} tone="amber" isDark={isDark} note={`linear · ${dados.pctFis}% físico`} />
        <Kpi label="Realizado" value={realTot > 0 ? fmtM(realTot) : '—'} tone="teal" isDark={isDark} note="financeiro real" />
        <Kpi label="Desvio (R−P)" value={realTot > 0 ? (desvioTot > 0 ? '+' : '') + fmtM(desvioTot) : '—'} tone={desvioTot > 0 ? 'rose' : 'teal'} isDark={isDark} note={realTot > 0 ? (desvioTot > 0 ? 'acima do físico' : 'abaixo do físico') : '—'} />
      </div>

      <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] ${isDark ? 'bg-sky-500/10 text-sky-300' : 'bg-sky-50 text-sky-700'}`}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <span><b>Base</b> = {(ORC * 100).toFixed(0)}% do valor contratual, rateado pelas naturezas (lucro previsto {(MARGEM_LUCRO * 100).toFixed(0)}%). <b>Projetado</b> = Base × % físico. <b>Realizado</b> = custo lançado no financeiro ({fmtM(realTot)} já lançados).</span>
      </div>

      {/* Resumo por natureza */}
      <PanelCard title="Resumo por natureza — Base × Projetado × Realizado" icon={<Wallet size={14} className="text-teal-500" />} isDark={isDark} pad={false} bodyClassName="px-2 py-1">
        <NatTable t={dados.total} />
      </PanelCard>

      {/* Por frente e obra */}
      <PanelCard title="Por frente e obra" icon={<Wallet size={14} className="text-teal-500" />} isDark={isDark}>
        <div className="space-y-1.5">
          {dados.frentes.map(fr => { const fo = openF.has(fr.label); return (
            <div key={fr.label} className={`rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <button onClick={() => tog(fr.label, setOpenF)} className={`w-full flex items-center gap-2 px-3 py-2 ${fo ? 'rounded-t-xl' : 'rounded-xl'} ${isDark ? 'bg-slate-800/80 hover:bg-slate-800' : 'bg-slate-200/80 hover:bg-slate-200'}`}>
                {fo ? <ChevronDown size={14} className="shrink-0 text-teal-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{fr.label}</span>
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fr.pctFis}% físico · {fr.obras.length} obra(s)</span>
                <Mini t={fr} />
              </button>
              {fo && (
                <div className={`px-2 pb-2 pt-1 space-y-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  <NatTable t={fr} />
                  {fr.obras.map(o => { const ok = fr.label + '|' + o.nome; const oo = openO.has(ok); return (
                    <div key={o.nome} className="mt-1">
                      <button onClick={() => tog(ok, setOpenO)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.04] hover:bg-white/[0.07]' : 'bg-slate-100/80 hover:bg-slate-200/70'}`}>
                        {oo ? <ChevronDown size={12} className="shrink-0 text-teal-500" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                        <span className={`text-[12px] font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`} title={o.nome}>{o.nome}</span>
                        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{o.pctFis}%</span>
                        <Mini t={o} />
                      </button>
                      {oo && <div className="pb-1 pt-0.5"><NatTable t={o} dense /></div>}
                    </div>
                  ) })}
                </div>
              )}
            </div>
          ) })}
        </div>
      </PanelCard>
    </div>
  )
}
