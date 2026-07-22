// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/DPFolhaPainel.tsx — Visão "Folha" do Painel do DP.
// Mesmo padrão dos demais painéis (hero Núcleo/Janela Crítica + seções em cards).
// Fontes reais: dp_folha.resumo + itens/desvios (checklist), rh_holerites
// (evolução e custo por base), useColaboradoresSemConta. Nada fake — o que não
// tem dado ainda aparece vazio ("amadurece conforme o fluxo roda").
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react'
import { DollarSign, Zap, ClipboardCheck, Landmark, Ban, TrendingUp, Layers, Clock, Building2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SpotlightMetric, MiniInfoCard } from '../../components/rh/DPPainelCards'
import {
  useFolhas, useFolhaItens, useFolhaDesvios, useColaboradoresSemConta,
  useHoleritesEvolucao, useCustoPorBase,
} from '../../hooks/useDPFolha'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const compLabel = (c: string) => { const [y, m] = c.split('-'); return `${MESES[Number(m) - 1] ?? m}/${y}` }
const mesAbbr = (c: string) => MESES[Number(c.split('-')[1]) - 1] ?? c
function brlC(v?: number | null): string {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
  if (a >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

const PIPELINE = [
  { key: 'apuracao', label: 'Apuração' },
  { key: 'verificacao', label: 'Verificação' },
  { key: 'correcoes', label: 'Correções' },
  { key: 'fechamento', label: 'Fechamento' },
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'concluido', label: 'Concluído' },
]
const STAGE_IDX: Record<string, number> = {
  apuracao: 0, erro: 0, verificando: 1, verificado: 1, corrigindo: 2, fechamento: 3, pagamento: 4, concluido: 5,
}

export default function DPFolhaPainel({ isDark, cardClass }: { isDark: boolean; cardClass: string }) {
  const nav = useNavigate()
  const { data: folhas = [] } = useFolhas()
  const folha = folhas[0] ?? null                        // mais recente (competência desc)
  const comp7 = folha ? String(folha.competencia).slice(0, 7) : undefined

  const { data: itens = [] } = useFolhaItens(folha?.id)
  const { data: desvios = [] } = useFolhaDesvios(folha?.id)
  const { data: semConta = [] } = useColaboradoresSemConta()
  const { data: evolucao = [] } = useHoleritesEvolucao()
  const { data: custoBase = [] } = useCustoPorBase(comp7)

  const resumo = folha?.resumo ?? {}
  const naoPagar = desvios.filter(d => d.tipo === 'nao_pagar').length
  const assert = useMemo(() => {
    const verif = itens.filter(it => ['ok', 'desvio', 'atencao'].includes(it.resultado)).length
    const conf = itens.filter(it => it.resultado === 'ok' || it.resultado === 'atencao').length
    return verif ? Math.round((conf / verif) * 100) : null
  }, [itens])

  const liquido = resumo.total_liquido ?? null
  const bruto = resumo.total_bruto ?? null
  const descontos = resumo.total_descontos ?? (bruto != null && liquido != null ? bruto - liquido : null)
  const variacao = resumo.variacao_mes_anterior_pct
  const stageIdx = folha ? (STAGE_IDX[folha.status] ?? 0) : -1

  const evoMax = Math.max(...evolucao.map(e => e.total), 1)
  const evoRecent = evolucao.slice(-7)
  const baseMax = Math.max(...custoBase.map(b => b.total), 1)

  if (!folha) {
    return (
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className="py-16 text-center">
          <DollarSign size={30} className={`mx-auto mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma folha lançada ainda</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Lance uma folha no DP › Folha para o painel ganhar vida.</p>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-3">
      {/* Hero: Indicadores + Janela Crítica */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Núcleo da Folha</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores-chave</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <DollarSign size={18} className="text-violet-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Líquido total" value={brlC(liquido)} tone="violet" isDark={isDark} note={`competência ${compLabel(comp7!)}`} />
              <SpotlightMetric label="Custo bruto" value={brlC(bruto)} tone="blue" isDark={isDark}
                aside={variacao != null ? `${variacao > 0 ? '+' : ''}${variacao}%` : undefined}
                asideTitle="Variação do custo bruto vs mês anterior" note="proventos totais" />
              <SpotlightMetric label="Assertividade" value={assert != null ? `${assert}%` : '—'} tone={assert != null && assert < 70 ? 'red' : 'emerald'} isDark={isDark} note="conferência do checklist" />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Crítica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>O que exige ação agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(folha.qtd_desvios_abertos > 0 || naoPagar > 0) ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={(folha.qtd_desvios_abertos > 0 || naoPagar > 0) ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniInfoCard label="Desvios abertos" value={folha.qtd_desvios_abertos} icon={ClipboardCheck}
                iconTone={folha.qtd_desvios_abertos > 0 ? 'text-red-500' : 'text-slate-400'} note={folha.qtd_desvios_abertos > 0 ? 'a tratar' : 'em dia'} isDark={isDark} />
              <MiniInfoCard label="Sem conta banc." value={semConta.length} icon={Landmark}
                iconTone={semConta.length > 0 ? 'text-amber-500' : 'text-slate-400'} note="a cadastrar" isDark={isDark} />
              <MiniInfoCard label="Não pagar" value={naoPagar} icon={Ban}
                iconTone={naoPagar > 0 ? 'text-rose-500' : 'text-slate-400'} note="inativo/processo" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Evolução do custo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-violet-500" /> Evolução do custo da folha
          </h2>
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>líquido por competência</span>
        </div>
        <div className="px-4 pt-4 pb-2">
          {evoRecent.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Sem holerites lançados</div>
          ) : (
            <div className="flex items-end gap-3 h-[140px]">
              {evoRecent.map((e, i) => {
                const ultimo = i === evoRecent.length - 1
                const h = Math.max((e.total / evoMax) * 112, 6)
                return (
                  <div key={e.comp} className="flex-1 text-center">
                    <div className={`text-[10px] font-bold ${ultimo ? 'text-violet-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>{brlC(e.total).replace('R$ ', '')}</div>
                    <div className="mt-1 rounded-t-md transition-all" style={{ height: `${h}px`, background: ultimo ? '#7c3aed' : (isDark ? '#4c3a8c' : '#c4b5fd') }} />
                    <div className={`text-[10px] mt-1 ${ultimo ? 'font-bold text-violet-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{mesAbbr(e.comp)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Composição do custo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Layers size={14} className="text-violet-500" /> Composição do custo · {compLabel(comp7!)}
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Líquido <b className="text-slate-600 dark:text-slate-300">{brlC(liquido)}</b></span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Descontos <b className="text-slate-600 dark:text-slate-300">{brlC(descontos)}</b></span>
          </div>
        </div>
        <div className="px-4 py-3">
          {bruto && liquido != null && descontos != null ? (
            <div className={`flex h-10 rounded-xl overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
              <div className="h-full bg-violet-600 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${(liquido / bruto) * 100}%` }}>Líquido · {brlC(liquido)}</div>
              <div className={`h-full flex items-center justify-center text-[10px] font-bold ${isDark ? 'bg-white/[0.12] text-slate-300' : 'bg-slate-300 text-slate-600'}`} style={{ width: `${(descontos / bruto) * 100}%` }}>Descontos · {brlC(descontos)}</div>
            </div>
          ) : (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>Sem totais da folha</div>
          )}
        </div>
      </section>

      {/* Status da folha + Custo por base */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-blue-500" /> Status da folha vigente
            </h2>
            <button onClick={() => nav('/rh/dp/folha')} className="flex items-center gap-0.5 text-[10px] text-blue-600 font-semibold shrink-0">Folha <ChevronRight size={11} /></button>
          </div>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-end gap-2 h-[76px]">
              {PIPELINE.map((s, i) => {
                const atual = i === stageIdx
                const feito = i < stageIdx
                return (
                  <div key={s.key} className="flex-1 text-center">
                    <div className="rounded-md transition-all" style={{ height: atual ? '58px' : '16px', background: atual ? '#7c3aed' : feito ? (isDark ? '#3f6212' : '#bbf7d0') : (isDark ? '#1f2937' : '#e2e8f0') }} />
                    <div className={`text-[8px] mt-1.5 ${atual ? 'font-bold text-violet-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Building2 size={14} className="text-blue-500" /> Custo por base · {compLabel(comp7!)}
            </h2>
          </div>
          {custoBase.length === 0 ? (
            <div className="py-10 text-center">
              <Building2 size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem custo por base no período</p>
            </div>
          ) : (
            <ul className="px-2 py-1.5">
              {custoBase.slice(0, 8).map(b => (
                <li key={b.nome} className="flex items-center gap-2.5 px-2 py-1.5">
                  <span className={`w-[110px] shrink-0 truncate text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{b.nome}</span>
                  <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500" style={{ width: `${Math.max((b.total / baseMax) * 100, 4)}%` }} />
                  </div>
                  <span className={`w-[64px] text-right text-[11px] font-extrabold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{brlC(b.total).replace('R$ ', '')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
