// Painel Riscos — registro vivo (pmo_riscos) + matriz qualitativa prob×impacto.
// Análise INCREMENTAL pelo SuperTEG (edge egp-riscos-analisar) recebendo o contexto do projeto
// (EAP, cronograma, recursos, custos, RDOs). Cada risco editável/apagável; manuais adicionáveis.
import { useMemo, useState } from 'react'
import { ShieldAlert, Sparkles, Plus, Pencil, Trash2, X, Loader2, Bot, User, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEAPFinal } from '../../../hooks/usePMO'
import { useRiscosEGP, useCriarRisco, useAtualizarRisco, useDeletarRisco } from '../../../hooks/usePMO'
import { useEfetivoReal } from '../../../hooks/useEfetivoReal'
import { useCustosReal, NATUREZAS, MARGEM_LUCRO } from '../../../hooks/useCustos'
import { supabase } from '../../../services/supabase'
import { Kpi, PanelCard } from '../../rh/paineis/_ui'
import { buildTree, makeDefaultConfig, projObra, startYM, shiftYM, ymLabel } from './cronogramaEngine'
import { useFiltrosTree, FiltrosFrenteObra, togFiltro } from './egpFiltros'
import type { PMORisco } from '../../../types/pmo'

const CONTRATO_CEMIG = '2cd4557b-846e-4d25-bbd5-6df71406a4ed'
const STATUS = ['aberto', 'monitorando', 'mitigado', 'fechado'] as const
const sevCor = (s: number) => s >= 16 ? '#ef4444' : s >= 11 ? '#f97316' : s >= 6 ? '#eab308' : '#22c55e'
const sevLabel = (s: number) => s >= 16 ? 'Crítico' : s >= 11 ? 'Alto' : s >= 6 ? 'Médio' : 'Baixo'
const scoreOf = (r: PMORisco, k: 'prob' | 'imp') => {
  const sc = k === 'prob' ? r.prob_score : r.impacto_score
  if (sc) return Math.max(1, Math.min(5, sc))
  const txt = k === 'prob' ? r.probabilidade : r.impacto
  return txt === 'alta' || txt === 'alto' ? 4 : txt === 'baixa' || txt === 'baixo' ? 2 : 3
}

export default function RiscosPainel({ portfolioId = CONTRATO_CEMIG }: { portfolioId?: string } = {}) {
  const { isDark } = useTheme()
  const { data: raw } = useEAPFinal(portfolioId)
  const { data: efetivo } = useEfetivoReal(portfolioId)
  const { data: custos } = useCustosReal(portfolioId)
  const { data: riscos = [], isLoading, refetch } = useRiscosEGP(portfolioId)
  const criar = useCriarRisco(); const atualizar = useAtualizarRisco(); const deletar = useDeletarRisco()
  const [edit, setEdit] = useState<Partial<PMORisco> | null>(null)
  const [rodando, setRodando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [fSev, setFSev] = useState<string | null>(null)
  const flt = useFiltrosTree()
  const [openG, setOpenG] = useState<Set<string>>(new Set())

  const tree = useMemo(() => buildTree(raw), [raw])

  // contexto do projeto p/ o SuperTEG
  const buildContexto = () => {
    const allObras = tree.flatMap(f => f.obras)
    const cfg = makeDefaultConfig(allObras); const start = startYM()
    let maxM = 0
    const frentes = tree.map(fr => {
      let frMax = 0; fr.obras.forEach(o => { frMax = Math.max(frMax, projObra(o, cfg, start).maxMeses) }); maxM = Math.max(maxM, frMax)
      const valorContr = fr.obras.reduce((s, o) => s + o.valorContr, 0)
      const saldoR = fr.obras.reduce((s, o) => s + o.saldoR, 0)
      const pctFis = valorContr > 0 ? Math.round(fr.obras.reduce((s, o) => s + o.pctFis * o.valorContr, 0) / valorContr) : 0
      const ef = efetivo?.porFrente[fr.label]
      return { frente: fr.label, valor_contratual: Math.round(valorContr), saldo_a_faturar: Math.round(saldoR), pct_fisico: pctFis, n_obras: fr.obras.length, termino_meses: frMax, termino: frMax > 0 ? ymLabel(shiftYM(start, frMax - 1)) : null, efetivo: ef ? { fundacao: ef.fundacao, montagem_lancamento: ef.montlanc, maquinas: ef.maqFund + ef.maqML } : null }
    })
    const contratado = frentes.reduce((s, f) => s + f.valor_contratual, 0)
    const pctFisG = contratado > 0 ? Math.round(frentes.reduce((s, f) => s + f.pct_fisico * f.valor_contratual, 0) / contratado) : 0
    const custosNat = NATUREZAS.map(n => ({ natureza: n.label, orcado: Math.round((1 - MARGEM_LUCRO) * contratado * n.pct), realizado: Math.round(custos?.total[n.key] || 0) }))
    return {
      projeto: { contrato: 'CEMIG', valor_contratado: contratado, custo_orcado: Math.round((1 - MARGEM_LUCRO) * contratado), margem_prevista_pct: MARGEM_LUCRO * 100, pct_fisico_global: pctFisG, n_frentes: frentes.length, n_obras: allObras.length, termino_geral: maxM > 0 ? ymLabel(shiftYM(start, maxM - 1)) : null },
      frentes,
      recursos_rh_frota: efetivo?.total ? { fundacao: efetivo.total.fundacao, montagem_lancamento: efetivo.total.montlanc, maquinas: efetivo.total.maqFund + efetivo.total.maqML } : null,
      custos_por_natureza: custosNat,
      rdos: 'sem RDOs lançados ainda',
    }
  }

  const rodarAnalise = async () => {
    setRodando(true); setMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('egp-riscos-analisar', { body: { portfolio_id: portfolioId, contexto: buildContexto() } })
      if (error) throw error
      if (data?.ok === false) throw new Error(data.motivo || 'Falha na análise')
      if (data?.sincrono) { setMsg(`Análise concluída: ${data.novos ?? 0} novos, ${data.atualizados ?? 0} atualizados.`); await refetch() }
      else { setMsg('Análise solicitada ao SuperTEG. Os riscos aparecem aqui quando concluir (atualizando…).'); for (let i = 0; i < 24; i++) { await new Promise(r => setTimeout(r, 5000)); await refetch() } }
    } catch (e: any) { setMsg('Erro: ' + (e?.message || String(e))) }
    finally { setRodando(false) }
  }

  // filtra por frente/obra + severidade (clique na matriz)
  const riscosView = useMemo(() => riscos.filter(r => {
    if (flt.fFrente.size && !(r.frente && flt.fFrente.has(r.frente))) return false
    if (flt.fObra.size && !(r.obra && flt.fObra.has(r.obra))) return false
    if (fSev && sevLabel(scoreOf(r, 'prob') * scoreOf(r, 'imp')) !== fSev) return false
    return true
  }), [riscos, flt.fFrente, flt.fObra, fSev])

  // matriz 5×5: prob (linhas, 5 topo) × impacto (colunas, 1..5)
  const matriz = useMemo(() => {
    const m: PMORisco[][][] = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => [] as PMORisco[]))
    for (const r of riscosView) { if (r.status === 'fechado') continue; m[scoreOf(r, 'prob')][scoreOf(r, 'imp')].push(r) }
    return m
  }, [riscosView])

  const ativos = riscosView.filter(r => r.status !== 'fechado')
  const criticos = ativos.filter(r => scoreOf(r, 'prob') * scoreOf(r, 'imp') >= 16).length
  const iaCount = riscos.filter(r => r.origem === 'ia').length

  // agrupa o registro por frente → obra (ordenado por severidade)
  const grupos = useMemo(() => {
    const sev = (r: PMORisco) => scoreOf(r, 'prob') * scoreOf(r, 'imp')
    const sorted = [...riscosView].sort((a, b) => sev(b) - sev(a))
    const byFr = new Map<string, PMORisco[]>()
    for (const r of sorted) { const k = r.frente || 'Geral'; if (!byFr.has(k)) byFr.set(k, []); byFr.get(k)!.push(r) }
    return [...byFr.entries()].map(([frente, rs]) => {
      const byOb = new Map<string, PMORisco[]>()
      for (const r of rs) { const k = r.obra || '— frente toda'; if (!byOb.has(k)) byOb.set(k, []); byOb.get(k)!.push(r) }
      return { frente, total: rs.length, criticos: rs.filter(r => sev(r) >= 16).length, obras: [...byOb.entries()].map(([obra, ors]) => ({ obra, riscos: ors })) }
    }).sort((a, b) => a.frente === 'Geral' ? 1 : b.frente === 'Geral' ? -1 : a.frente.localeCompare(b.frente, undefined, { numeric: true }))
  }, [riscosView])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" /></div>

  const salvar = async () => {
    if (!edit || !edit.descricao?.trim()) return
    const payload: Partial<PMORisco> = { ...edit, portfolio_id: portfolioId, origem: edit.origem ?? 'manual', status: edit.status ?? 'aberto' }
    if (edit.id) await atualizar.mutateAsync(payload as any); else await criar.mutateAsync(payload)
    setEdit(null)
  }

  const RiscoRow = ({ r }: { r: PMORisco }) => {
    const p = scoreOf(r, 'prob'), i = scoreOf(r, 'imp'), sev = p * i
    return (
      <tr className={`border-b align-top ${isDark ? 'border-slate-800/70' : 'border-slate-100'}`}>
        <td className="px-2 py-1.5 w-5"><span title={r.origem === 'ia' ? 'Gerado pelo SuperTEG' : 'Manual'}>{r.origem === 'ia' ? <Bot size={13} className="text-violet-500" /> : <User size={13} className="text-slate-400" />}</span></td>
        <td className="px-2 py-1.5"><div className={`text-[12px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.codigo && <span className="text-slate-400 mr-1">{r.codigo}</span>}{r.descricao}</div>{r.analise_ia && <div className="text-[10px] text-slate-400 mt-0.5">{r.analise_ia}</div>}{r.gatilho && <div className="text-[10px] text-amber-500 mt-0.5">⚑ {r.gatilho}</div>}{(r.mitigacao || r.resposta) && <div className="text-[10px] text-emerald-600 mt-0.5">→ {r.mitigacao || r.resposta}</div>}</td>
        <td className="px-2 py-1.5 text-center whitespace-nowrap"><span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[11px] font-bold tabular-nums" style={{ background: sevCor(sev) + (isDark ? '33' : '22'), color: sevCor(sev) }} title={`Probabilidade ${p} × Impacto ${i}`}>{p}×{i}={sev}</span></td>
        <td className="px-2 py-1.5 text-[11px] whitespace-nowrap capitalize">{r.categoria ? <span className="text-slate-400">{r.categoria} · </span> : null}{r.status}</td>
        <td className="px-2 py-1.5 whitespace-nowrap text-right">
          <button onClick={() => setEdit(r)} className="p-1 rounded-md hover:bg-slate-500/10 text-slate-400 hover:text-teal-500"><Pencil size={13} /></button>
          <button onClick={() => { if (confirm('Apagar este risco?')) deletar.mutate({ id: r.id, portfolio_id: portfolioId } as any) }} className="p-1 rounded-md hover:bg-slate-500/10 text-slate-400 hover:text-rose-500"><Trash2 size={13} /></button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-3">
      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={rodarAnalise} disabled={rodando} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          {rodando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{rodando ? 'Analisando…' : 'Rodar análise SuperTEG (incremental)'}
        </button>
        <button onClick={() => setEdit({ descricao: '', categoria: '', prob_score: 3, impacto_score: 3, status: 'aberto', origem: 'manual' })} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${isDark ? 'border-white/15 text-slate-200 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Plus size={14} /> Novo risco</button>
        {msg && <span className={`text-[11px] ${msg.startsWith('Erro') ? 'text-rose-500' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{msg}</span>}
      </div>

      <FiltrosFrenteObra tree={tree} f={flt} isDark={isDark} comPct={false} />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Kpi label="Riscos ativos" value={`${ativos.length}`} tone="sky" isDark={isDark} note={`${riscos.length} no total`} />
        <Kpi label="Críticos" value={`${criticos}`} tone="rose" isDark={isDark} note="severidade ≥ 16" />
        <Kpi label="Pela IA (SuperTEG)" value={`${iaCount}`} tone="violet" isDark={isDark} note={`${riscos.length - iaCount} manuais`} />
        <Kpi label="Abertos" value={`${riscos.filter(r => r.status === 'aberto').length}`} tone="amber" isDark={isDark} note="a tratar" />
      </div>

      {/* Matriz prob × impacto */}
      <PanelCard title="Matriz de risco — Probabilidade × Impacto" icon={<ShieldAlert size={14} className="text-teal-500" />} isDark={isDark}>
        <div className="flex gap-2">
          <div className="flex flex-col justify-around py-6 text-[10px] font-semibold -rotate-180 [writing-mode:vertical-rl]" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Probabilidade →</div>
          <div className="flex-1 overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: 460 }}>
              <tbody>
                {[5, 4, 3, 2, 1].map(p => (
                  <tr key={p}>
                    <td className={`w-6 text-center text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p}</td>
                    {[1, 2, 3, 4, 5].map(i => { const cs = matriz[p][i]; const sev = p * i; const cor = sevCor(sev); return (
                      <td key={i} className="p-0.5">
                        <button onClick={() => setFSev(fSev === sevLabel(sev) ? null : sevLabel(sev))} className="w-full aspect-[2/1] min-h-[40px] rounded-md flex items-center justify-center text-[13px] font-bold transition hover:ring-2 hover:ring-offset-1 hover:ring-teal-400" style={{ background: cor + (isDark ? '33' : '26'), color: cor, outline: fSev === sevLabel(sev) ? `2px solid ${cor}` : undefined }} title={`Prob ${p} × Impacto ${i} = ${sev} (${sevLabel(sev)}) · ${cs.length} risco(s)`}>
                          {cs.length || ''}
                        </button>
                      </td>
                    ) })}
                  </tr>
                ))}
                <tr><td /> {[1, 2, 3, 4, 5].map(i => <td key={i} className={`text-center text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{i}</td>)}</tr>
                <tr><td /><td colSpan={5} className={`text-center text-[10px] font-semibold pt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Impacto →</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px]">{[['Baixo', '#22c55e'], ['Médio', '#eab308'], ['Alto', '#f97316'], ['Crítico', '#ef4444']].map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}{fSev && <button onClick={() => setFSev(null)} className="ml-2 text-teal-500 font-semibold">× limpar filtro ({fSev})</button>}</div>
      </PanelCard>

      {/* Registro de riscos — agrupado por frente → obra */}
      <PanelCard title={`Registro de riscos${fSev ? ` — ${fSev}` : ''}`} icon={<ShieldAlert size={14} className="text-teal-500" />} isDark={isDark}>
        {grupos.length === 0 ? <p className="text-center py-8 text-sm text-slate-400">Nenhum risco{(fSev || flt.fFrente.size || flt.fObra.size) ? ' com esse filtro' : ''}. Rode a análise do SuperTEG ou adicione manualmente.</p> : (
          <div className="space-y-1.5">
            {grupos.map(g => { const fo = openG.has(g.frente); return (
              <div key={g.frente} className={`rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <button onClick={() => togFiltro(g.frente, setOpenG)} className={`w-full flex items-center gap-2 px-3 py-2 ${fo ? 'rounded-t-xl' : 'rounded-xl'} ${isDark ? 'bg-slate-800/80 hover:bg-slate-800' : 'bg-slate-200/80 hover:bg-slate-200'}`}>
                  {fo ? <ChevronDown size={14} className="shrink-0 text-teal-500" /> : <ChevronRight size={14} className="shrink-0 text-slate-400" />}
                  <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{g.frente}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{g.total} risco(s)</span>
                  {g.criticos > 0 && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: '#ef444422', color: '#ef4444' }}>{g.criticos} crítico(s)</span>}
                </button>
                {fo && (
                  <div className={`px-2 pb-2 pt-1 space-y-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                    {g.obras.map(ob => (
                      <div key={ob.obra}>
                        <div className={`px-1 py-1 text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ob.obra}</div>
                        <div className="overflow-x-auto"><table className="w-full border-collapse"><tbody>{ob.riscos.map(r => <RiscoRow key={r.id} r={r} />)}</tbody></table></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) })}
          </div>
        )}
      </PanelCard>

      {/* Modal add/edit */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEdit(null)}>
          <div className={`w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border shadow-2xl ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <h2 className="text-sm font-bold flex items-center gap-2"><ShieldAlert size={16} className="text-teal-500" />{edit.id ? 'Editar risco' : 'Novo risco'}</h2>
              <button onClick={() => setEdit(null)} className="p-1 rounded-lg hover:bg-slate-500/10"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(() => { const inp = `w-full text-sm rounded-lg border px-2.5 py-1.5 outline-none ${isDark ? 'bg-slate-800 border-white/15 text-white' : 'bg-white border-slate-300 text-slate-800'}`; const lbl = `text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`; const set = (k: keyof PMORisco, v: any) => setEdit(s => ({ ...s, [k]: v })); return (<>
                <div><p className={lbl}>Descrição</p><textarea rows={2} value={edit.descricao ?? ''} onChange={e => set('descricao', e.target.value)} className={inp} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className={lbl}>Frente</p><select value={edit.frente ?? ''} onChange={e => set('frente', e.target.value || null)} className={inp}><option value="">Geral</option>{tree.map(fr => <option key={fr.label} value={fr.label}>{fr.label}</option>)}</select></div>
                  <div><p className={lbl}>Obra</p><select value={edit.obra ?? ''} onChange={e => set('obra', e.target.value || null)} className={inp} disabled={!edit.frente}><option value="">{edit.frente ? 'Frente toda' : '—'}</option>{(tree.find(fr => fr.label === edit.frente)?.obras ?? []).map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}</select></div>
                  <div><p className={lbl}>Categoria</p><input value={edit.categoria ?? ''} onChange={e => set('categoria', e.target.value)} placeholder="prazo, custo, recurso…" className={inp} /></div>
                  <div><p className={lbl}>Status</p><select value={edit.status ?? 'aberto'} onChange={e => set('status', e.target.value)} className={inp}>{STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><p className={lbl}>Probabilidade (1–5)</p><input type="number" min="1" max="5" value={edit.prob_score ?? 3} onChange={e => set('prob_score', Math.max(1, Math.min(5, Number(e.target.value))))} className={inp} /></div>
                  <div><p className={lbl}>Impacto (1–5)</p><input type="number" min="1" max="5" value={edit.impacto_score ?? 3} onChange={e => set('impacto_score', Math.max(1, Math.min(5, Number(e.target.value))))} className={inp} /></div>
                </div>
                <div><p className={lbl}>Gatilho / sintoma</p><input value={edit.gatilho ?? ''} onChange={e => set('gatilho', e.target.value)} className={inp} /></div>
                <div><p className={lbl}>Mitigação / resposta</p><textarea rows={2} value={edit.mitigacao ?? ''} onChange={e => set('mitigacao', e.target.value)} className={inp} /></div>
                <div><p className={lbl}>Responsável</p><input value={edit.responsavel ?? ''} onChange={e => set('responsavel', e.target.value)} className={inp} /></div>
              </>) })()}
            </div>
            <div className={`flex justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <button onClick={() => setEdit(null)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}>Cancelar</button>
              <button onClick={salvar} disabled={!edit.descricao?.trim()} className="px-4 py-1.5 rounded-lg text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
