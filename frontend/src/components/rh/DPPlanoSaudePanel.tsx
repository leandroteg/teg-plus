// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPPlanoSaudePanel.tsx — DP › Benefícios › Plano de Saúde
// Duas sub-visões dentro da MESMA aba:
//   Adesões    — matriz estilo QSMA (todos os ativos × check de adesão) com o
//                que a operadora cobrou no mês escolhido (mensalidade + copart.);
//   Consolidado — linhas mensais por plano e o envio ao contas a pagar.
// Sem relatório enviado, a matriz é exatamente a de antes.
// Vidas (titular+dependentes) sincronizam con_contratos.quantitativo (trigger).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { Search, Check, Loader2, FileText, Users, BarChart3 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import {
  useAdesoesBeneficio, useContratoPlanoSaude,
  useAderirBeneficio, useAtualizarAdesao, useEncerrarAdesao,
  type BeneficioAdesao,
} from '../../hooks/useBeneficios'
import { useBeneficioLotes, useBeneficioMesPorColaborador, compYm } from '../../hooks/useBeneficioRelatorios'
import DPBeneficioConsolidado from './DPBeneficioConsolidado'

const fmtCur = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtMes = (ym: string) => {
  const d = new Date(ym + '-01T00:00:00')
  return `${d.toLocaleDateString('pt-BR', { month: 'long' })}/${d.getFullYear()}`
}
// mês anterior — é o que a operadora fatura
const mesPadrao = () => {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
// últimos 18 meses + 1 à frente, para o seletor nunca ficar vazio
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

export default function DPPlanoSaudePanel() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const { data: colaboradores = [], isLoading: loadCol } = useColaboradoresAtivos()
  const { data: adesoes = [], isLoading: loadAd } = useAdesoesBeneficio('plano_saude')
  const { data: contrato } = useContratoPlanoSaude()
  const { data: lotes = [] } = useBeneficioLotes('plano_saude')
  const aderir = useAderirBeneficio()
  const atualizar = useAtualizarAdesao()
  const encerrar = useEncerrarAdesao()

  const [vista, setVista] = useState<'adesoes' | 'consolidado'>('adesoes')
  const [busca, setBusca] = useState('')
  const [soPlano, setSoPlano] = useState(false)
  const [pendenteId, setPendenteId] = useState<string | null>(null)
  const [mes, setMes] = useState<string>(mesPadrao())
  const [operadora, setOperadora] = useState<string>('')

  // meses com relatório enviado — o seletor sempre existe (janela fixa),
  // mas garante que todo mês já lançado apareça na lista
  const comLote = useMemo(
    () => [...new Set(lotes.map(l => compYm(l.competencia)))],
    [lotes],
  )
  const meses = useMemo(
    () => [...new Set([...mesesJanela(), ...comLote, mes])].filter(Boolean).sort().reverse(),
    [comLote, mes],
  )
  // ao chegar o 1º relatório, cai no mês dele
  useEffect(() => {
    if (comLote.length && !comLote.includes(mes)) setMes([...comLote].sort().reverse()[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comLote.join(',')])

  const { data: porColab } = useBeneficioMesPorColaborador('plano_saude', mes || null)

  const operadoras = useMemo(
    () => [...new Set(lotes.filter(l => !mes || compYm(l.competencia) === mes).map(l => l.fornecedor).filter(Boolean))] as string[],
    [lotes, mes],
  )

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
  const selCls = `text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border outline-none ${inputCls}`

  const adesaoPorColab = useMemo(() => {
    const m = new Map<string, BeneficioAdesao>()
    for (const a of adesoes) m.set(a.colaborador_id, a)
    return m
  }, [adesoes])

  // operadora do colaborador: a que cobrou no mês; sem relatório, a do contrato
  const opContrato = (contrato?.contraparte_nome ?? '').split('(')[0].trim().toUpperCase() || null
  const opDe = (colabId: string) => porColab?.get(colabId)?.fornecedor ?? opContrato

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return colaboradores
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q))
      .filter(c => !soPlano || adesaoPorColab.has(c.id))
      .filter(c => !operadora || opDe(c.id) === operadora)
  }, [colaboradores, busca, soPlano, adesaoPorColab, operadora, porColab, opContrato])

  const toggle = async (colabId: string, nome: string) => {
    const ades = adesaoPorColab.get(colabId)
    if (ades) {
      if (!confirm(`Remover ${nome} do plano de saúde?`)) return
      setPendenteId(colabId)
      try { await encerrar.mutateAsync(ades.id) } finally { setPendenteId(null) }
    } else {
      if (!confirm(`Adicionar ${nome} ao plano de saúde?`)) return
      setPendenteId(colabId)
      try {
        await aderir.mutateAsync({ colaboradorId: colabId, contratoId: contrato?.id ?? null, criadoPor: perfil?.nome ?? null })
      } finally { setPendenteId(null) }
    }
  }

  if (loadCol || loadAd) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const vistaBtn = (v: typeof vista, Icon: typeof Users, titulo: string) => (
    <button key={v} onClick={() => setVista(v)} title={titulo}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border transition-colors ${vista === v
        ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : isDark ? 'border-white/10 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-slate-700'}`}>
      <Icon size={14} />
    </button>
  )

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      {/* Cabeçalho: filtros + troca de sub-visão numa linha só.
          Os totalizadores saíram daqui — quem soma é a sub-visão Consolidado. */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={e => setMes(e.target.value)} className={selCls} title="Competência">
          {meses.map(m => (
            <option key={m} value={m}>{fmtMes(m)}{comLote.includes(m) ? ' ·' : ''}</option>
          ))}
        </select>
        {operadoras.length > 1 && (
          <select value={operadora} onChange={e => setOperadora(e.target.value)} className={selCls}>
            <option value="">Todas as operadoras</option>
            {operadoras.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 min-w-[140px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={13} className={txtMuted} />
          <input type="text" placeholder="Buscar colaborador…" value={busca} onChange={e => setBusca(e.target.value)}
            className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
        </div>
        <button onClick={() => setSoPlano(v => !v)}
          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${soPlano
            ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <Users size={11} className="inline mr-1" />Só quem está no plano
        </button>
        {contrato && (
          <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <FileText size={11} /> <b className={txt}>{contrato.numero}</b> · {(contrato.contraparte_nome ?? '').split('(')[0].trim()}
          </span>
        )}
        <div className="flex items-center gap-1">
          {vistaBtn('adesoes', Users, 'Adesões')}
          {vistaBtn('consolidado', BarChart3, 'Consolidado')}
        </div>
      </div>

      {vista === 'consolidado' ? <DPBeneficioConsolidado beneficio="plano_saude" /> : (
        <>
          {/* Matriz */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                    <th className="text-left px-3 py-2 font-semibold">COLABORADOR</th>
                    <th className="text-left px-3 py-2 font-semibold w-[120px]">OPERADORA</th>
                    <th className="text-center px-3 py-2 font-semibold w-[90px]">NO PLANO</th>
                    <th className="text-right px-3 py-2 font-semibold w-[130px] whitespace-nowrap">MENSALIDADE</th>
                    <th className="text-right px-3 py-2 font-semibold w-[120px] whitespace-nowrap">COPARTIC. (MÊS)</th>
                    <th className="text-right px-3 py-2 font-semibold w-[130px] whitespace-nowrap">DESCONTO (R$)</th>
                    <th className="text-right px-3 py-2 font-semibold w-[140px] whitespace-nowrap">CUSTO EMPRESA</th>
                    <th className="text-center px-3 py-2 font-semibold w-[130px]">ENTRADA</th>
                    <th className="text-center px-3 py-2 font-semibold w-[110px]">DEPENDENTES</th>
                    <th className="text-center px-3 py-2 font-semibold w-[70px]">VIDAS</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(c => {
                    const a = adesaoPorColab.get(c.id)
                    const busy = pendenteId === c.id
                    const mesC = porColab?.get(c.id)
                    const divergiu = a?.valor_mensal != null && mesC?.principal != null
                      && Math.abs(Number(mesC.principal) - Number(a.valor_mensal)) > 0.01
                    return (
                      <tr key={c.id} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'} ${a ? (isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/40') : ''}`}>
                        <td className="px-3 py-2">
                          <p className={`font-semibold ${txt}`}>{c.nome}</p>
                          <p className={txtMuted}>{c.cargo || '—'}{c.base_nome ? ` · ${c.base_nome}` : ''}</p>
                        </td>
                        <td className="px-3 py-2">
                          {a ? <span className={mesC?.fornecedor ? txt : txtMuted}>{opDe(c.id) ?? '—'}</span> : <span className={txtMuted}>—</span>}
                        </td>
                        <td className="text-center px-3 py-2">
                          <button onClick={() => toggle(c.id, c.nome)} disabled={busy} title={a ? 'Remover do plano' : 'Adicionar ao plano'}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${a
                              ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                              : isDark ? 'border-white/15 text-slate-600 hover:border-emerald-400 hover:text-emerald-400' : 'border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500'}`}>
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                          </button>
                        </td>
                        <td className="text-right px-3 py-2">
                          {a ? (
                            <>
                              <input type="number" min={0} step="0.01" defaultValue={a.valor_mensal ?? ''} placeholder="0,00"
                                key={`${a.id}-preco-${a.valor_mensal ?? ''}`}
                                onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (a.valor_mensal ?? null)) atualizar.mutate({ id: a.id, valor_mensal: v }) }}
                                className={`w-[85px] text-right text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                              {mesC?.principal != null && (
                                <p className={`mt-0.5 text-[10px] ${divergiu ? (isDark ? 'text-amber-300' : 'text-amber-700') : txtMuted}`}
                                  title={divergiu ? 'Valor da fatura diferente do preço cadastrado' : 'Valor da fatura do mês'}>
                                  fatura: {fmtCur(mesC.principal)}
                                </p>
                              )}
                            </>
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                        <td className={`text-right px-3 py-2 ${mesC?.secundario ? (isDark ? 'text-sky-300' : 'text-sky-700') : txtMuted}`}>
                          {mesC?.secundario != null ? fmtCur(mesC.secundario) : '—'}
                        </td>
                        <td className="text-right px-3 py-2">
                          {a ? (
                            <input type="number" min={0} step="0.01" defaultValue={a.desconto_mensal ?? ''} placeholder="0,00"
                              key={`${a.id}-desc-${a.desconto_mensal ?? ''}`}
                              onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (a.desconto_mensal ?? null)) atualizar.mutate({ id: a.id, desconto_mensal: v }) }}
                              className={`w-[75px] text-right text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                        <td className={`text-right px-3 py-2 font-bold ${a ? (isDark ? 'text-amber-300' : 'text-amber-700') : txtMuted}`}>
                          {a && a.valor_mensal != null ? fmtCur((a.valor_mensal || 0) - (a.desconto_mensal || 0)) : '—'}
                        </td>
                        <td className="text-center px-3 py-2">
                          {a ? (
                            <input type="date" defaultValue={a.data_inicio} key={`${a.id}-dt-${a.data_inicio}`}
                              onBlur={e => { if (e.target.value && e.target.value !== a.data_inicio) atualizar.mutate({ id: a.id, data_inicio: e.target.value }) }}
                              className={`text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                        <td className="text-center px-3 py-2">
                          {a ? (
                            <>
                              <span className="inline-flex items-center gap-1">
                                <button onClick={() => atualizar.mutate({ id: a.id, dependentes: Math.max(0, a.dependentes - 1) })}
                                  className={`w-5 h-5 rounded border text-[10px] font-bold ${isDark ? 'border-white/15 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>−</button>
                                <span className={`w-6 text-center font-bold ${txt}`}>{a.dependentes}</span>
                                <button onClick={() => atualizar.mutate({ id: a.id, dependentes: a.dependentes + 1 })}
                                  className={`w-5 h-5 rounded border text-[10px] font-bold ${isDark ? 'border-white/15 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>+</button>
                              </span>
                              {mesC && mesC.dependentes !== a.dependentes && (
                                <button onClick={() => atualizar.mutate({ id: a.id, dependentes: mesC.dependentes })}
                                  title="A fatura do mês traz este número de dependentes — clique para usar"
                                  className={`block mx-auto mt-0.5 text-[10px] underline decoration-dotted ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                                  relatório: {mesC.dependentes}
                                </button>
                              )}
                            </>
                          ) : <span className={txtMuted}>—</span>}
                        </td>
                        <td className={`text-center px-3 py-2 font-bold ${a ? 'text-emerald-500' : txtMuted}`}>{a ? 1 + a.dependentes : '—'}</td>
                      </tr>
                    )
                  })}
                  {lista.length === 0 && (
                    <tr><td colSpan={10} className={`text-center py-10 text-sm ${txtMuted}`}>Nenhum colaborador encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className={`text-[11px] ${txtMuted}`}>
            {lista.length} colaborador(es) · adesões marcam a <b>data de entrada</b> de hoje (editável). As vidas alimentam o quantitativo do contrato automaticamente.
            {comLote.includes(mes)
              ? ' Mensalidade da fatura e coparticipação vêm do relatório da operadora de ' + fmtMes(mes) + '.'
              : ' Nenhum relatório da operadora em ' + fmtMes(mes) + ' — suba em Novo Registro › Lançamento Benefícios para preencher fatura e coparticipação.'}
          </p>
        </>
      )}

    </div>
  )
}
