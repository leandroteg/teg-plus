// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPValePanel.tsx — DP › Benefícios › Alimentação (VR) e Transporte (VT).
// Mesmo padrão do Plano de Saúde: duas sub-visões trocadas por ícone —
//   Lançamentos  — matriz de todos os ativos × quem recebe, com o valor que o
//                  fornecedor creditou no mês escolhido;
//   Consolidado  — linhas mensais por fornecedor e envio ao contas a pagar.
// Sem relatório enviado, a coluna do mês fica "—" e nada mais muda.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { Search, Check, Loader2, Users, BarChart3 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import {
  useAdesoesBeneficio, useAderirBeneficio, useAtualizarAdesao, useEncerrarAdesao,
  type BeneficioAdesao,
} from '../../hooks/useBeneficios'
import {
  useBeneficioLotes, useBeneficioMesPorColaborador, compYm,
  BENEFICIO_LABEL, type Beneficio,
} from '../../hooks/useBeneficioRelatorios'
import DPBeneficioConsolidado from './DPBeneficioConsolidado'

const fmtCur = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtMes = (ym: string) => {
  const d = new Date(ym + '-01T00:00:00')
  return `${d.toLocaleDateString('pt-BR', { month: 'long' })}/${d.getFullYear()}`
}
const mesPadrao = () => {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const mesesJanela = () => {
  const out: string[] = []
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() + 1)
  for (let i = 0; i < 20; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export default function DPValePanel({ beneficio, accent }: {
  beneficio: Exclude<Beneficio, 'plano_saude'>
  accent: 'amber' | 'sky'
}) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const { data: colaboradores = [], isLoading: loadCol } = useColaboradoresAtivos()
  const { data: adesoes = [], isLoading: loadAd } = useAdesoesBeneficio(beneficio)
  const { data: lotes = [] } = useBeneficioLotes(beneficio)
  const aderir = useAderirBeneficio()
  const atualizar = useAtualizarAdesao()
  const encerrar = useEncerrarAdesao()

  const [vista, setVista] = useState<'lancamentos' | 'consolidado'>('lancamentos')
  const [busca, setBusca] = useState('')
  const [soRecebe, setSoRecebe] = useState(false)
  const [pendenteId, setPendenteId] = useState<string | null>(null)
  const [mes, setMes] = useState<string>(mesPadrao())
  const [fornecedor, setFornecedor] = useState<string>('')

  const comLote = useMemo(() => [...new Set(lotes.map(l => compYm(l.competencia)))], [lotes])
  const meses = useMemo(
    () => [...new Set([...mesesJanela(), ...comLote, mes])].filter(Boolean).sort().reverse(),
    [comLote, mes],
  )
  useEffect(() => {
    if (comLote.length && !comLote.includes(mes)) setMes([...comLote].sort().reverse()[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comLote.join(',')])

  const { data: porColab } = useBeneficioMesPorColaborador(beneficio, mes || null)

  const fornecedores = useMemo(
    () => [...new Set(lotes.filter(l => compYm(l.competencia) === mes).map(l => l.fornecedor).filter(Boolean))] as string[],
    [lotes, mes],
  )

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  const selCls = `text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border outline-none ${inputCls}`
  const cor = accent === 'amber'
    ? { pill: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700', on: 'bg-amber-500 border-amber-500', valor: isDark ? 'text-amber-300' : 'text-amber-700' }
    : { pill: isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-700', on: 'bg-sky-500 border-sky-500', valor: isDark ? 'text-sky-300' : 'text-sky-700' }

  const adesaoPorColab = useMemo(() => {
    const m = new Map<string, BeneficioAdesao>()
    for (const a of adesoes) m.set(a.colaborador_id, a)
    return m
  }, [adesoes])

  const fornDe = (colabId: string) => porColab?.get(colabId)?.fornecedor ?? null

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return colaboradores
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q))
      .filter(c => !soRecebe || adesaoPorColab.has(c.id))
      .filter(c => !fornecedor || fornDe(c.id) === fornecedor)
  }, [colaboradores, busca, soRecebe, adesaoPorColab, fornecedor, porColab])

  const toggle = async (colabId: string, nome: string) => {
    const ades = adesaoPorColab.get(colabId)
    const rotulo = BENEFICIO_LABEL[beneficio]
    if (ades) {
      if (!confirm(`Remover ${nome} de ${rotulo}?`)) return
      setPendenteId(colabId)
      try { await encerrar.mutateAsync(ades.id) } finally { setPendenteId(null) }
    } else {
      if (!confirm(`Incluir ${nome} em ${rotulo}?`)) return
      setPendenteId(colabId)
      try {
        await aderir.mutateAsync({ colaboradorId: colabId, tipo: beneficio, criadoPor: perfil?.nome ?? null })
      } finally { setPendenteId(null) }
    }
  }

  if (loadCol || loadAd) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const vistaBtn = (v: typeof vista, VIcon: typeof Users, titulo: string) => (
    <button key={v} onClick={() => setVista(v)} title={titulo}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${vista === v
        ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : isDark ? 'border-white/10 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-slate-700'}`}>
      <VIcon size={14} />
    </button>
  )

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      {/* Cabeçalho: filtros + troca de sub-visão numa linha só.
          Os totalizadores saíram daqui — quem soma é a sub-visão Consolidado. */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={e => setMes(e.target.value)} className={selCls} title="Competência">
          {meses.map(m => <option key={m} value={m}>{fmtMes(m)}{comLote.includes(m) ? ' ·' : ''}</option>)}
        </select>
        {fornecedores.length > 1 && (
          <select value={fornecedor} onChange={e => setFornecedor(e.target.value)} className={selCls}>
            <option value="">Todos os fornecedores</option>
            {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 min-w-[140px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={13} className={txtMuted} />
          <input type="text" placeholder="Buscar colaborador…" value={busca} onChange={e => setBusca(e.target.value)}
            className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
        </div>
        <button onClick={() => setSoRecebe(v => !v)}
          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${soRecebe
            ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <Users size={11} className="inline mr-1" />Só quem recebe
        </button>
        <div className="flex items-center gap-1">
          {vistaBtn('lancamentos', Users, 'Lançamentos')}
          {vistaBtn('consolidado', BarChart3, 'Consolidado')}
        </div>
      </div>

      {vista === 'consolidado' ? <DPBeneficioConsolidado beneficio={beneficio} /> : (
        <>
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                    <th className="text-left px-3 py-2 font-semibold">COLABORADOR</th>
                    <th className="text-left px-3 py-2 font-semibold w-[140px]">FORNECEDOR</th>
                    <th className="text-center px-3 py-2 font-semibold w-[90px]">RECEBE</th>
                    <th className="text-right px-3 py-2 font-semibold w-[140px] whitespace-nowrap">CREDITADO (MÊS)</th>
                    <th className="text-right px-3 py-2 font-semibold w-[130px] whitespace-nowrap">DESCONTO (R$)</th>
                    <th className="text-right px-3 py-2 font-semibold w-[140px] whitespace-nowrap">CUSTO EMPRESA</th>
                    <th className="text-center px-3 py-2 font-semibold w-[130px] !pr-5">ENTRADA</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(c => {
                    const a = adesaoPorColab.get(c.id)
                    const busy = pendenteId === c.id
                    const mesC = porColab?.get(c.id)
                    return (
                      <tr key={c.id} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'} ${a ? (isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/40') : ''}`}>
                        <td className="px-3 py-2">
                          <p className={`font-semibold ${txt}`}>{c.nome}</p>
                          <p className={txtMuted}>{c.cargo || '—'}{c.base_nome ? ` · ${c.base_nome}` : ''}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span className={mesC?.fornecedor ? txt : txtMuted}>{fornDe(c.id) ?? '—'}</span>
                        </td>
                        <td className="text-center px-3 py-2">
                          <button onClick={() => toggle(c.id, c.nome)} disabled={busy} title={a ? 'Remover' : 'Incluir'}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${a
                              ? `${cor.on} text-white`
                              : isDark ? 'border-white/15 text-slate-600 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500'}`}>
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                          </button>
                        </td>
                        <td className={`text-right px-3 py-2 font-semibold ${mesC?.principal != null ? cor.valor : txtMuted}`}>
                          {mesC?.principal != null ? fmtCur(mesC.principal) : '—'}
                        </td>
                        <td className="text-right px-3 py-2">
                          {a ? (
                            <input type="number" min={0} step="0.01" defaultValue={a.desconto_mensal ?? ''} placeholder="0,00"
                              key={`${a.id}-desc-${a.desconto_mensal ?? ''}`}
                              onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (a.desconto_mensal ?? null)) atualizar.mutate({ id: a.id, desconto_mensal: v }) }}
                              className={`w-[75px] text-right text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                        <td className={`text-right px-3 py-2 font-bold ${mesC?.principal != null ? txt : txtMuted}`}>
                          {mesC?.principal != null ? fmtCur(mesC.principal - (a?.desconto_mensal || 0)) : '—'}
                        </td>
                        <td className="text-center px-3 py-2 pr-5">
                          {a ? (
                            <input type="date" defaultValue={a.data_inicio} key={`${a.id}-dt-${a.data_inicio}`}
                              onBlur={e => { if (e.target.value && e.target.value !== a.data_inicio) atualizar.mutate({ id: a.id, data_inicio: e.target.value }) }}
                              className={`text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {lista.length === 0 && (
                    <tr><td colSpan={7} className={`text-center py-10 text-sm ${txtMuted}`}>Nenhum colaborador encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className={`text-[11px] ${txtMuted}`}>
            {lista.length} colaborador(es) ·{' '}
            {comLote.includes(mes)
              ? `valores creditados vêm do relatório do fornecedor de ${fmtMes(mes)}.`
              : `nenhum relatório do fornecedor em ${fmtMes(mes)} — suba em Novo Registro › Lançamento Benefícios.`}
          </p>
        </>
      )}
    </div>
  )
}
