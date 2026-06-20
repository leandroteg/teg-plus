import { useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Map as MapIcon, ChevronLeft, ChevronDown, ChevronRight, Wallet, TrendingUp, Percent, Ruler, Factory,
  CalendarClock, Users, Layers, ListTree, Sparkles, AlertCircle, RefreshCw, Mountain,
  Boxes, HardHat, Scale, MoveHorizontal, Tent,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrcamento, useReprocessarOrcamento } from '../../hooks/useOrcamentacao'
import type { OrcRegiao } from '../../types/orcamentacao'
import { fmtBRL, fmtMM, fmtNum, StatusBadge, Kpi, BarRow, MiniMarkdown, CARD } from './_ui'

const SECAO_COR = ['#f59e0b', '#3b82f6', '#14b8a6', '#8b5cf6', '#ec4899', '#10b981', '#64748b', '#f43f5e']

export default function OrcamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: orc, isLoading } = useOrcamento(id)
  const reprocessar = useReprocessarOrcamento()
  const [scopeKey, setScopeKey] = useState<string>('total')
  const [openObra, setOpenObra] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (!orc) {
    return (
      <div className="p-4">
        <button onClick={() => nav('/orcamentacao')} className={`inline-flex items-center gap-1.5 text-sm ${txtMuted}`}><ChevronLeft size={16} /> Voltar</button>
        <p className={`mt-6 text-center text-sm ${txtMuted}`}>Orçamento não encontrado.</p>
      </div>
    )
  }

  const rTot = orc.resultado
  const regioes: OrcRegiao[] = rTot?.regioes ?? []
  // escopo: total OU uma região selecionada (mesma forma de dados)
  const scope = (scopeKey !== 'total' ? regioes.find(x => x.regiao === scopeKey) : null) ?? rTot
  const r = scope
  const resumo = r?.resumo
  const isRegiao = scopeKey !== 'total' && !!regioes.find(x => x.regiao === scopeKey)
  const analiseTxt = isRegiao ? ((scope as OrcRegiao)?.analise_md || orc.analise_md || '') : (orc.analise_md || '')

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/orcamentacao')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{orc.numero ?? '—'}</span>
            <StatusBadge status={orc.status} isDark={isDark} />
          </div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 truncate ${txt}`}>
            <MapIcon size={20} className="text-amber-500 shrink-0" /> {orc.nome}
          </h1>
        </div>
      </div>

      {/* Estado: processando */}
      {orc.status === 'processando' && (
        <section className={`${CARD(isDark)} p-8 flex flex-col items-center text-center`}>
          <div className="w-12 h-12 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className={`text-sm font-bold ${txt}`}>O SuperTEG está estimando…</p>
          <p className={`text-xs mt-1 max-w-md ${txtMuted}`}>Lendo o traçado (KMZ) por região e obra, e analisando cada região com o motor paramétrico. Isso costuma levar de 1 a 3 minutos — esta tela atualiza sozinha.</p>
        </section>
      )}

      {/* Estado: erro */}
      {orc.status === 'erro' && (
        <section className={`${CARD(isDark)} p-6`}>
          <div className={`flex items-start gap-3 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold">Não foi possível gerar o orçamento</p>
              <p className={`text-xs mt-1 ${txtMuted}`}>{orc.erro || 'Erro desconhecido.'}</p>
              <button
                onClick={() => reprocessar.mutate(orc.id)}
                disabled={reprocessar.isPending}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
              >
                <RefreshCw size={13} className={reprocessar.isPending ? 'animate-spin' : ''} /> Tentar novamente
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Estado: concluído */}
      {orc.status === 'concluido' && resumo && r && (
        <>
          {/* Seletor de região */}
          {regioes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${txtMuted}`}>Região:</span>
              {[{ k: 'total', label: `Total · ${fmtNum(rTot?.lts?.length ?? 0)} obras` }, ...regioes.map(rg => ({ k: rg.regiao, label: `${rg.regiao} · ${rg.lts.length}` }))].map(opt => (
                <button
                  key={opt.k}
                  onClick={() => setScopeKey(opt.k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    scopeKey === opt.k ? 'bg-amber-500 text-white shadow-sm'
                      : isDark ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {isRegiao && (scope as OrcRegiao).f_terreno != null && (
            <p className={`text-[11px] ${txtMuted}`}>Escopo: <span className="font-bold">{scopeKey}</span> · terreno aplicado ×{fmtNum((scope as OrcRegiao).f_terreno!, 2)}</p>
          )}

          {/* KPIs de CUSTO */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Custo estimado" value={fmtMM(resumo.custo_total)} hint="custo real Nibo+TOTVS" tone="amber" isDark={isDark} />
            <Kpi label="Custo / US" value={`R$ ${fmtNum(resumo.custo_us)}`} hint="base executada (R$/US)" tone="teal" isDark={isDark} />
            <Kpi label="Total de US" value={fmtNum(resumo.us)} hint="unidades de serviço CEMIG" tone="sky" isDark={isDark} />
            <Kpi label="Custo / torre" value={fmtMM(resumo.custo_por_torre)} hint={`${fmtNum(resumo.custo_por_km)}/km`} tone="indigo" isDark={isDark} />
          </div>

          {/* Engenharia / características */}
          <section className={`${CARD(isDark)} p-4`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><Factory size={14} className="text-amber-500" /> Características e engenharia</h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {[
                { icon: Ruler, label: 'Extensão', value: `${fmtNum(resumo.extensao_km, 1)} km` },
                { icon: Factory, label: 'Torres', value: fmtNum(resumo.torres) },
                { icon: Scale, label: 'Aço/torre', value: resumo.aco_por_torre ? `${fmtNum(resumo.aco_por_torre, 2)} t` : '—' },
                { icon: MoveHorizontal, label: 'Vão médio', value: resumo.vao_medio_m ? `${fmtNum(resumo.vao_medio_m)} m` : '—' },
                { icon: Boxes, label: 'Fund./torre', value: resumo.vol_fund_por_torre ? `${fmtNum(resumo.vol_fund_por_torre, 1)} m³` : '—' },
                { icon: Tent, label: 'Canteiro', value: resumo.canteiro_dist_km != null ? `${fmtNum(resumo.canteiro_dist_km, 1)} km` : '—' },
                { icon: CalendarClock, label: 'Prazo', value: `~${fmtNum(resumo.prazo_meses, 1)} m` },
                { icon: Users, label: 'Efetivo', value: `${fmtNum(resumo.efetivo_clt)} CLT` },
              ].map(m => (
                <div key={m.label} className={`rounded-xl p-2.5 flex flex-col items-center gap-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                  <m.icon size={14} className="text-amber-500" />
                  <p className={`text-base font-extrabold leading-none ${txt}`}>{m.value}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${txtMuted}`}>{m.label}</p>
                </div>
              ))}
            </div>
            {/* Tipos de torre */}
            {r.tipos_torre && r.tipos_torre.length > 0 && (
              <div className={`mt-3 pt-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Tipos de torre (famílias detectadas no KMZ)</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.tipos_torre.map(t => (
                    <span key={t.familia} className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      t.classe === 'ancoragem'
                        ? (isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700')
                        : (isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-100 text-sky-700')
                    }`} title={t.classe}>
                      {t.familia} <span className="opacity-60 font-normal">{t.classe === 'ancoragem' ? 'anc.' : 'susp.'}</span> · {t.qtd}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Análise do SuperTEG (do escopo selecionado) */}
          {analiseTxt && (
            <section className={`${CARD(isDark)} p-4`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-2 ${txt}`}>
                <Sparkles size={14} className="text-amber-500" /> Análise do SuperTEG{isRegiao ? ` — ${scopeKey}` : ''}
                {orc.nivel_confianca && <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>confiança: {orc.nivel_confianca}</span>}
              </h2>
              <MiniMarkdown text={analiseTxt} isDark={isDark} />
            </section>
          )}

          {/* Obras (LDs) do escopo */}
          {r.lts.length > 0 && (() => {
            const obras = [...r.lts].sort((a, b) => b.custo_total - a.custo_total)
            const vis = obras.slice(0, 50)
            return (
            <section className={`${CARD(isDark)} overflow-hidden`}>
              <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
                <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><Layers size={14} className="text-amber-500" /> Obras{isRegiao ? ` — ${scopeKey}` : ''}</h2>
                <span className={`text-[11px] ${txtMuted}`}>{obras.length} LD(s) · clique p/ ver o terreno</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-[10px] uppercase tracking-wider ${txtMuted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
                      <th className="text-left font-semibold px-3 py-2">Obra (LD)</th>
                      <th className="text-right font-semibold px-2 py-2">km</th>
                      <th className="text-right font-semibold px-2 py-2">Torres</th>
                      <th className="text-right font-semibold px-2 py-2">US</th>
                      <th className="text-right font-semibold px-2 py-2">Custo</th>
                      <th className="text-right font-semibold px-3 py-2">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vis.map((l, i) => {
                      const key = `${l.nome}_${i}`
                      const open = openObra === key
                      const temTerreno = !!(l.terreno && l.terreno.trim())
                      return (
                      <Fragment key={key}>
                        <tr
                          onClick={() => temTerreno && setOpenObra(open ? null : key)}
                          className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'} ${temTerreno ? (isDark ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-pointer hover:bg-slate-50') : ''}`}
                        >
                          <td className={`px-3 py-2 font-medium text-xs ${txt} max-w-[280px]`} title={l.nome}>
                            <span className="flex items-center gap-1.5">
                              {temTerreno && (open ? <ChevronDown size={12} className="text-amber-500 shrink-0" /> : <ChevronRight size={12} className="text-amber-500 shrink-0" />)}
                              <span className="truncate">{l.nome}</span>
                            </span>
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{fmtNum(l.extensao_km, 1)}</td>
                          <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{fmtNum(l.torres)}</td>
                          <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{fmtNum(l.us)}</td>
                          <td className={`px-2 py-2 text-right text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{fmtMM(l.custo_total)}</td>
                          <td className={`px-3 py-2 text-right text-xs ${txtMuted}`}>~{fmtNum(l.prazo_meses, 1)}m</td>
                        </tr>
                        {open && temTerreno && (
                          <tr className={isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}>
                            <td colSpan={6} className="px-4 py-2.5">
                              <div className="flex items-start gap-2">
                                <Mountain size={13} className="text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${txtMuted}`}>Terreno · f ×{fmtNum(l.f_terreno, 2)}</p>
                                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{l.terreno}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {obras.length > vis.length && (
                <div className={`px-4 py-2 text-[10px] ${txtMuted} ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                  Mostrando as 50 maiores de {obras.length} obras. Selecione uma região acima para ver o detalhe.
                </div>
              )}
            </section>
            )
          })()}

          {/* Itens EAP */}
          <section className={`${CARD(isDark)} overflow-hidden`}>
            <div className={`px-4 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><ListTree size={14} className="text-amber-500" /> Quantitativos e preços (EAP CEMIG)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-[10px] uppercase tracking-wider ${txtMuted} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
                    <th className="text-left font-semibold px-3 py-2">Cód.</th>
                    <th className="text-left font-semibold px-2 py-2">Item</th>
                    <th className="text-right font-semibold px-2 py-2">Qtd.</th>
                    <th className="text-right font-semibold px-2 py-2">Un.</th>
                    <th className="text-right font-semibold px-2 py-2">Preço unit.</th>
                    <th className="text-right font-semibold px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.itens_eap.map((it, i) => (
                    <tr key={i} className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                      <td className={`px-3 py-2 text-xs font-mono ${txtMuted}`}>{it.cod}</td>
                      <td className={`px-2 py-2 text-xs font-medium ${txt}`}>{it.nome}</td>
                      <td className={`px-2 py-2 text-right text-xs ${txt}`}>{fmtNum(it.qtd, 1)}</td>
                      <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{it.un}</td>
                      <td className={`px-2 py-2 text-right text-xs ${txtMuted}`}>{fmtBRL(it.preco_unit)}</td>
                      <td className={`px-3 py-2 text-right text-xs font-bold ${txt}`}>{fmtBRL(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`px-4 py-2 text-[10px] ${txtMuted} ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              Núcleo físico = fundações + montagem + lançamento (62,4% do contrato). O complemento cobre Administração Local, complementares e desmontagem.
            </div>
          </section>

          {/* Plano de recursos + Comparação */}
          {(r.plano_recursos || r.comparacao) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {r.plano_recursos && (
                <section className={`${CARD(isDark)} p-4`}>
                  <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><HardHat size={14} className="text-amber-500" /> Plano de recursos</h2>
                  <div className="space-y-2">
                    {r.plano_recursos.fundacao && (
                      <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                        <div><p className={`text-xs font-bold ${txt}`}>Fundação</p><p className={`text-[10px] ${txtMuted}`}>{r.plano_recursos.fundacao.equipes} equipe(s) × {r.plano_recursos.fundacao.pessoas_por_equipe} pessoas · perfuração</p></div>
                        <span className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>~{fmtNum(r.plano_recursos.fundacao.meses, 1)} m</span>
                      </div>
                    )}
                    {r.plano_recursos.montagem && (
                      <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                        <div><p className={`text-xs font-bold ${txt}`}>Montagem</p><p className={`text-[10px] ${txtMuted}`}>{r.plano_recursos.montagem.pessoas} pessoas {r.plano_recursos.montagem.guindaste ? '+ guindaste' : ''} · {fmtNum(r.plano_recursos.montagem.dias)} dias</p></div>
                        <span className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>~{fmtNum(r.plano_recursos.montagem.meses, 1)} m</span>
                      </div>
                    )}
                    {r.plano_recursos.lancamento && (
                      <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                        <div><p className={`text-xs font-bold ${txt}`}>Lançamento</p><p className={`text-[10px] ${txtMuted}`}>{r.plano_recursos.lancamento.pessoas} pessoas · puller + prensa</p></div>
                        <span className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>~{fmtNum(r.plano_recursos.lancamento.meses, 1)} m</span>
                      </div>
                    )}
                  </div>
                  <div className={`mt-3 pt-3 flex items-center justify-between ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                    <span className={`text-[11px] ${txtMuted}`}>Frota: {Object.entries(r.plano_recursos.frota_necessaria ?? {}).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(' · ')}</span>
                    <span className={`text-xs font-extrabold ${txt}`}>pico {fmtNum(r.plano_recursos.efetivo_pico_clt ?? 0)} CLT</span>
                  </div>
                </section>
              )}

              {r.comparacao && (() => {
                const c = r.comparacao!
                const dev = (v: number) => {
                  const a = Math.abs(v)
                  const cls = a <= 15 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : a <= 35 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-rose-400' : 'text-rose-600')
                  return <span className={`font-extrabold ${cls}`}>{v > 0 ? '+' : ''}{fmtNum(v, 0)}%</span>
                }
                return (
                  <section className={`${CARD(isDark)} p-4`}>
                    <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><Scale size={14} className="text-amber-500" /> Comparação de custo com a carteira</h2>
                    <div className="space-y-2.5">
                      <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Frente real mais parecida</p>
                        <p className={`text-sm font-extrabold ${txt}`}>{c.frente_mais_proxima}</p>
                        <p className={`text-[11px] ${txtMuted}`}>custo/torre {fmtMM(c.frente_custo_por_torre)} · aço {fmtNum(c.frente_aco_por_torre ?? 0, 2)} t · fund {fmtNum(c.frente_vol_fund_por_torre ?? 0, 1)} m³</p>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={txtMuted}>Custo/torre vs essa frente</span>{dev(c.desvio_vs_frente_pct)}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={txtMuted}>Média de custo/torre da carteira</span>
                        <span className={`font-bold ${txt}`}>{fmtMM(c.media_carteira_custo_por_torre)}</span>
                      </div>
                      {c.custo_us_faixa_lote && (
                        <div className="flex items-center justify-between text-xs">
                          <span className={txtMuted}>Faixa de custo/US por lote (carteira)</span>
                          <span className={`font-bold ${txt}`}>R$ {fmtNum(c.custo_us_faixa_lote[0])}–{fmtNum(c.custo_us_faixa_lote[1])}/US</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-[10px] mt-3 ${txtMuted}`}>Custo base de R$ {fmtNum(c.custo_us ?? 639)}/US (real Nibo+TOTVS). Desvio ≤15% (verde) é coerente; acima, revisar terreno/torres. O custo/US varia por lote/região.</p>
                  </section>
                )
              })()}
            </div>
          )}

          {/* Composição do custo + Cenários de preço */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className={`${CARD(isDark)} p-4`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><Wallet size={14} className="text-amber-500" /> Composição do custo <span className={`text-[11px] font-normal ${txtMuted}`}>(real Nibo+TOTVS)</span></h2>
              {(() => { const max = Math.max(...r.composicao_custo.map(c => c.valor), 1); return r.composicao_custo.map((c, i) => (
                <BarRow key={c.natureza} label={`${c.natureza} (${fmtNum(c.pct, 1)}%)`} pct={c.valor} max={max} cor={SECAO_COR[i % SECAO_COR.length]} isDark={isDark} right={fmtMM(c.valor)} />
              )) })()}
            </section>
            {r.cenarios_preco && r.cenarios_preco.length > 0 && (
              <section className={`${CARD(isDark)} p-4`}>
                <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-1 ${txt}`}><TrendingUp size={14} className="text-amber-500" /> Cenários de preço (proposta)</h2>
                <p className={`text-[10px] mb-3 ${txtMuted}`}>Estratégia de lance = US × preço/US (já inclui ativos, tributos e margem). O custo acima é a base.</p>
                <div className="space-y-2">
                  {r.cenarios_preco.map(c => {
                    const tone: Record<string, string> = { 'Mínima': 'amber', 'Competitivo': 'sky', 'Seguro': 'violet', 'Ótima': 'emerald' }
                    const t = tone[c.nome] ?? 'slate'
                    const clr = isDark
                      ? { amber: 'text-amber-300', sky: 'text-sky-300', violet: 'text-violet-300', emerald: 'text-emerald-300', slate: 'text-slate-300' }[t]
                      : { amber: 'text-amber-600', sky: 'text-sky-600', violet: 'text-violet-600', emerald: 'text-emerald-600', slate: 'text-slate-600' }[t]
                    return (
                      <div key={c.nome} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
                        <div>
                          <p className={`text-xs font-bold ${clr}`}>{c.nome} <span className={`font-normal ${txtMuted}`}>· margem {fmtNum(c.margem_pct, c.margem_pct % 1 ? 1 : 0)}%</span></p>
                          <p className={`text-[10px] ${txtMuted}`}>R$ {fmtNum(c.preco_us)} /US</p>
                        </div>
                        <span className={`text-sm font-extrabold ${txt}`}>{fmtMM(c.preco_total)}</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Curva S */}
          {r.curva_s.length > 0 && (
            <section className={`${CARD(isDark)} p-4`}>
              <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><TrendingUp size={14} className="text-amber-500" /> Curva S — desembolso mensal (custo)</h2>
              {(() => {
                const max = Math.max(...r.curva_s.map(c => c.valor), 1)
                return (
                  <div className="flex items-end gap-1.5 h-40">
                    {r.curva_s.map(c => (
                      <div key={c.mes} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`Mês ${c.mes}: ${fmtBRL(c.valor)} · acumulado ${fmtNum(c.pct_acumulado, 0)}%`}>
                        <span className={`text-[9px] font-bold ${txtMuted} opacity-0 group-hover:opacity-100 transition-opacity`}>{fmtMM(c.valor)}</span>
                        <div className="w-full rounded-t-md bg-amber-500/80 hover:bg-amber-500 transition-all" style={{ height: `${Math.max(4, (c.valor / max) * 100)}%` }} />
                        <span className={`text-[9px] ${txtMuted}`}>M{c.mes}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
              <p className={`text-[10px] mt-2 ${txtMuted}`}>Distribuição do custo total no tempo por produtividade média (curva S). Acumulado no hover.</p>
            </section>
          )}

          {/* Premissas + geometria */}
          <section className={`${CARD(isDark)} p-4`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 mb-3 ${txt}`}><Percent size={14} className="text-amber-500" /> Premissas e fontes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><p className={txtMuted}>Tensão</p><p className={`font-bold ${txt}`}>{String((rTot?.premissas_usadas?.tensao_kv ?? orc.premissas.tensao_kv) ?? '—')} kV</p></div>
              <div><p className={txtMuted}>Custo / US</p><p className={`font-bold ${txt}`}>R$ {String(rTot?.premissas_usadas?.custo_us ?? 639)}</p></div>
              <div><p className={txtMuted}>Nº de US</p><p className={`font-bold ${rTot?.premissas_usadas?.us_exato ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : txt}`}>{rTot?.premissas_usadas?.us_exato ? 'do edital (exato)' : 'estimado'}</p></div>
              <div><p className={txtMuted}>Análise por</p><p className={`font-bold ${txt}`}>{String(rTot?.premissas_usadas?.analise_por ?? '—')}</p></div>
            </div>
            {Array.isArray(rTot?.geometria_kmz) && rTot!.geometria_kmz!.length > 0 && (
              <div className={`mt-3 pt-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>Resumo por região</p>
                {rTot!.geometria_kmz!.map((g, i) => (
                  <p key={i} className={`text-[11px] ${txt}`}>
                    <span className="font-semibold">{String(g.nome)}</span>
                    <span className={txtMuted}> — {fmtNum(Number(g.extensao_km), 2)} km{Number(g.torres_kmz) > 0 ? ` · ${g.torres_kmz} obras` : ''}</span>
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
