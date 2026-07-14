// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPPlanoSaudePanel.tsx — DP › Benefícios › Plano de Saúde
// Matriz estilo QSMA: TODOS os colaboradores ativos × check de adesão
// (com confirmação) + preço, data de entrada e nº de dependentes editáveis.
// Vidas (titular+dependentes) sincronizam con_contratos.quantitativo (trigger).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { HeartPulse, Search, Check, Loader2, FileText, Users } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useColaboradoresAtivos } from '../../hooks/useObras'
import {
  useAdesoesBeneficio, useContratoPlanoSaude,
  useAderirBeneficio, useAtualizarAdesao, useEncerrarAdesao,
  type BeneficioAdesao,
} from '../../hooks/useBeneficios'

const fmtCur = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

export default function DPPlanoSaudePanel() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const { data: colaboradores = [], isLoading: loadCol } = useColaboradoresAtivos()
  const { data: adesoes = [], isLoading: loadAd } = useAdesoesBeneficio('plano_saude')
  const { data: contrato } = useContratoPlanoSaude()
  const aderir = useAderirBeneficio()
  const atualizar = useAtualizarAdesao()
  const encerrar = useEncerrarAdesao()

  const [busca, setBusca] = useState('')
  const [soPlano, setSoPlano] = useState(false)
  const [pendenteId, setPendenteId] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'

  const adesaoPorColab = useMemo(() => {
    const m = new Map<string, BeneficioAdesao>()
    for (const a of adesoes) m.set(a.colaborador_id, a)
    return m
  }, [adesoes])

  const lista = useMemo(() => {
    const q = busca.toLowerCase()
    return colaboradores
      .filter(c => !q || c.nome.toLowerCase().includes(q) || c.cargo?.toLowerCase().includes(q))
      .filter(c => !soPlano || adesaoPorColab.has(c.id))
  }, [colaboradores, busca, soPlano, adesaoPorColab])

  const titulares = adesoes.length
  const dependentes = adesoes.reduce((s, a) => s + (a.dependentes || 0), 0)
  const vidas = titulares + dependentes
  const somaPrecos = adesoes.reduce((s, a) => s + (a.valor_mensal || 0), 0)
  const somaDescontos = adesoes.reduce((s, a) => s + (a.desconto_mensal || 0), 0)
  const custoLiquido = somaPrecos - somaDescontos

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

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      {/* Resumo + contrato */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
          <HeartPulse size={13} /> {titulares} titulares · {dependentes} dependentes · <b>{vidas} vidas</b>
        </span>
        {somaPrecos > 0 && (
          <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            preços: {fmtCur(somaPrecos)} · descontos: {fmtCur(somaDescontos)} · <b className={isDark ? 'text-amber-300' : 'text-amber-700'}>custo empresa: {fmtCur(custoLiquido)}/mês</b>
          </span>
        )}
        {contrato && (
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap ${isDark ? 'bg-white/[0.04] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <FileText size={12} /> <b className={txt}>{contrato.numero}</b> · {(contrato.contraparte_nome ?? '').split('(')[0].trim()} · {(contrato.valor_mensal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
            {contrato.quantitativo != null && <> · q. <b className={txt}>{contrato.quantitativo}</b></>}
          </span>
        )}
        <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 min-w-[140px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={13} className={txtMuted} />
          <input type="text" placeholder="Buscar colaborador…" value={busca} onChange={e => setBusca(e.target.value)}
            className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${inputCls.split(' ').filter(c => c.startsWith('text-') || c.startsWith('placeholder-')).join(' ')}`} />
        </div>
        <button onClick={() => setSoPlano(v => !v)}
          className={`shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${soPlano
            ? isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <Users size={11} className="inline mr-1" />Só quem está no plano
        </button>
      </div>

      {/* Matriz */}
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className={isDark ? 'bg-[#101826] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="text-left px-3 py-2 font-semibold">COLABORADOR</th>
                <th className="text-center px-3 py-2 font-semibold w-[90px]">NO PLANO</th>
                <th className="text-right px-3 py-2 font-semibold w-[120px] whitespace-nowrap">PREÇO (R$)</th>
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
                return (
                  <tr key={c.id} className={`border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'} ${a ? (isDark ? 'bg-emerald-500/[0.04]' : 'bg-emerald-50/40') : ''}`}>
                    <td className="px-3 py-2">
                      <p className={`font-semibold ${txt}`}>{c.nome}</p>
                      <p className={txtMuted}>{c.cargo || '—'}{c.base_nome ? ` · ${c.base_nome}` : ''}</p>
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
                        <input type="number" min={0} step="0.01" defaultValue={a.valor_mensal ?? ''} placeholder="0,00"
                          key={`${a.id}-preco-${a.valor_mensal ?? ''}`}
                          onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== (a.valor_mensal ?? null)) atualizar.mutate({ id: a.id, valor_mensal: v }) }}
                          className={`w-[85px] text-right text-xs rounded-lg px-2 py-1 border outline-none ${inputCls}`} />
                      ) : <span className={txtMuted}>—</span>}
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
                        <span className="inline-flex items-center gap-1">
                          <button onClick={() => atualizar.mutate({ id: a.id, dependentes: Math.max(0, a.dependentes - 1) })}
                            className={`w-5 h-5 rounded border text-[10px] font-bold ${isDark ? 'border-white/15 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>−</button>
                          <span className={`w-6 text-center font-bold ${txt}`}>{a.dependentes}</span>
                          <button onClick={() => atualizar.mutate({ id: a.id, dependentes: a.dependentes + 1 })}
                            className={`w-5 h-5 rounded border text-[10px] font-bold ${isDark ? 'border-white/15 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>+</button>
                        </span>
                      ) : <span className={txtMuted}>—</span>}
                    </td>
                    <td className={`text-center px-3 py-2 font-bold ${a ? 'text-emerald-500' : txtMuted}`}>{a ? 1 + a.dependentes : '—'}</td>
                  </tr>
                )
              })}
              {lista.length === 0 && (
                <tr><td colSpan={8} className={`text-center py-10 text-sm ${txtMuted}`}>Nenhum colaborador encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className={`text-[11px] ${txtMuted}`}>
        {lista.length} colaborador(es) · adesões marcam a <b>data de entrada</b> de hoje (editável). As vidas alimentam o quantitativo do contrato automaticamente.
      </p>
    </div>
  )
}
