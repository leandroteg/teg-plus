import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Users2, HardHat, GraduationCap, ShieldAlert, UserPlus, Leaf, CalendarClock } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useQsmaKPIs, useOcorrencias, useTreinamentos } from '../../hooks/useQsma'
import { useObrasComProjeto } from '../../hooks/useObras'
import { useIntegracaoTreinos } from '../../hooks/useRHAdmissaoFluxo'
import { GRAVIDADE_LABEL, TIPO_OCORRENCIA_LABEL } from '../../types/qsma'

// Painel do módulo QSMA — padrão dos demais painéis (título + hero de 2 cards:
// Indicadores Chave / Indicadores Críticos) + pirâmide de Bird e listas.
// Dados 100% reais (nasce zerado até lançarem).
export default function QsmaPainel() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: kpi } = useQsmaKPIs()
  const { data: ocorrencias = [] } = useOcorrencias()
  const { data: treinamentos = [] } = useTreinamentos()
  const { data: obras = [] } = useObrasComProjeto()
  const { data: integracao } = useIntegracaoTreinos()
  const nav = useNavigate()

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const cardClass = isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white border border-slate-200 shadow-sm'

  const obraNome = (id?: string | null) => obras.find(o => o.id === id)?.nome ?? '—'
  const fmtData = (d?: string | null) => d
    ? new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
    : '—'

  const hoje = new Date().toISOString().slice(0, 10)
  const lim60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)

  const d = useMemo(() => {
    const obraById = new Map(obras.map(o => [o.id, o]))
    const ocoPorObra = new Map<string, number>()
    ocorrencias.forEach(o => {
      if (o.obra_id) ocoPorObra.set(o.obra_id, (ocoPorObra.get(o.obra_id) ?? 0) + 1)
    })
    const bars = [...ocoPorObra.entries()]
      .map(([k, v]) => ({ label: obraById.get(k)?.nome ?? '—', value: v }))
      .sort((a, b) => b.value - a.value)

    const abertas = ocorrencias
      .filter(o => o.status !== 'encerrada')
      .sort((a, b) => (b.data_ocorrencia ?? '').localeCompare(a.data_ocorrencia ?? ''))

    const treinsVencendo = treinamentos
      .filter(t => t.vencimento && t.vencimento <= lim60)
      .sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))

    return { ocoPorObra: bars, abertas, treinsVencendo }
  }, [ocorrencias, treinamentos, obras, lim60])

  // Indicadores chave
  const totalOco = ocorrencias.length
  const gravesGravissimas = ocorrencias.filter(o => o.gravidade === 'alta' || o.gravidade === 'critica').length
  const naoTratadas = ocorrencias.filter(o => !o.sgi_registro_id && o.status !== 'encerrada').length
  // Indicadores críticos
  const treinVencendo = d.treinsVencendo.length
  const integracoesAbertas = integracao?.candidatos.length ?? 0

  const pir = kpi?.piramide ?? { desvios: 0, quaseAcidentes: 0, acidentes: 0 }
  const pirMax = Math.max(1, pir.desvios, pir.quaseAcidentes, pir.acidentes)

  return (
    <div className="space-y-3">
      {/* Header — padrão dos demais painéis */}
      <div>
        <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel - QSMA</h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Riscos, EPIs, treinamentos e ocorrências
        </p>
      </div>

      {/* Hero 2 colunas — Indicadores Chave / Indicadores Críticos */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        {/* Indicadores Chave */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Indicadores Chave
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Panorama de ocorrências
                </h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <ShieldAlert size={18} className="text-red-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Ocorrências" value={totalOco} tone="slate" note="total registradas" isDark={isDark} />
              <SpotlightMetric label="Graves / Gravíssimas" value={gravesGravissimas} tone="red" note="potencial alto" isDark={isDark} />
              <SpotlightMetric label="Não tratadas" value={naoTratadas} tone={naoTratadas > 0 ? 'amber' : 'emerald'} note="sem tratativa no SGI" isDark={isDark} />
            </div>
          </div>
        </section>

        {/* Indicadores Críticos */}
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Indicadores Críticos
                </p>
                <h2 className={`mt-0.5 text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  O que exige ação agora
                </h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${(treinVencendo + integracoesAbertas) > 0 ? 'bg-amber-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <AlertTriangle size={14} className={(treinVencendo + integracoesAbertas) > 0 ? 'text-amber-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <MiniInfoCard label="Treinamentos vencendo" value={treinVencendo} note="vencidos / próx. 60 dias"
                icon={GraduationCap} iconTone={treinVencendo > 0 ? 'text-fuchsia-500' : 'text-slate-400'} isDark={isDark} />
              <MiniInfoCard label="Integrações em aberto" value={integracoesAbertas} note="admissões na integração"
                icon={UserPlus} iconTone={integracoesAbertas > 0 ? 'text-sky-500' : 'text-slate-400'} isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Grade 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pirâmide de Bird */}
        <Bloco isDark={isDark} className={card} titulo="Pirâmide de eventos" icon={AlertTriangle}>
          <div className="space-y-2 py-1">
            {[
              { label: 'Acidentes', value: pir.acidentes, cor: '#dc2626', w: 0.4 },
              { label: 'Quase-acidentes', value: pir.quaseAcidentes, cor: '#f97316', w: 0.7 },
              { label: 'Desvios', value: pir.desvios, cor: '#f59e0b', w: 1 },
            ].map(n => (
              <div key={n.label} className="flex items-center gap-2">
                <span className={`text-[11px] w-28 shrink-0 ${isDark ? 'text-white' : 'text-slate-700'}`}>{n.label}</span>
                <div className="flex-1 flex justify-center">
                  <div
                    className="h-6 rounded flex items-center justify-center text-[11px] font-bold text-white transition-all"
                    style={{ width: `${Math.max(n.w * (n.value / pirMax) * 100, 12)}%`, backgroundColor: n.cor }}
                  >
                    {n.value}
                  </div>
                </div>
              </div>
            ))}
            {pir.desvios + pir.quaseAcidentes + pir.acidentes === 0 && (
              <p className={`text-[11px] italic text-center pt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum evento registrado</p>
            )}
          </div>
        </Bloco>

        {/* Ocorrências por obra (barras) */}
        <Bloco isDark={isDark} className={card} titulo="Ocorrências por obra" icon={Users2}>
          <Barras isDark={isDark} dados={d.ocoPorObra} cor="#ef4444" vazio="Nenhuma ocorrência registrada" />
        </Bloco>

        {/* Ocorrências em aberto (lista) */}
        <Bloco isDark={isDark} className={card} titulo="Ocorrências em aberto" icon={HardHat}>
          {d.abertas.length === 0 ? (
            <p className={`text-[11px] italic py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma ocorrência em aberto</p>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
              {d.abertas.slice(0, 8).map(o => {
                const g = GRAVIDADE_LABEL[o.gravidade]
                return (
                  <button key={o.id} onClick={() => nav(`/qsma/seguranca?aba=ocorrencias&ocorrencia=${o.id}`)}
                    className={`w-full text-left flex items-center justify-between gap-2 py-1.5 -mx-1 px-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {fmtData(o.data_ocorrencia)} · {obraNome(o.obra_id)}
                      </p>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span className="font-mono">{o.codigo}</span> · {TIPO_OCORRENCIA_LABEL[o.tipo]}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold ${isDark ? g.dark : g.light}`}>{g.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Bloco>

        {/* Treinamentos vencendo (lista) */}
        <Bloco isDark={isDark} className={card} titulo="Treinamentos vencendo" icon={GraduationCap}>
          {d.treinsVencendo.length === 0 ? (
            <p className={`text-[11px] italic py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum treinamento vencendo</p>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
              {d.treinsVencendo.slice(0, 8).map(t => {
                const vencido = !!t.vencimento && t.vencimento < hoje
                return (
                  <button key={t.id} onClick={() => nav(`/qsma/seguranca?aba=treinamentos&treinamento=${t.id}`)}
                    className={`w-full text-left flex items-center justify-between gap-2 py-1.5 -mx-1 px-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.colaborador_nome ?? '—'}</p>
                      <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {[t.norma, t.curso].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold ${vencido ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                      <CalendarClock size={11} /> {fmtData(t.vencimento)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Bloco>
      </div>

      {/* Nota de integração */}
      <p className={`text-[10px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        <Leaf size={10} className="inline mr-1" />
        Ações corretivas integradas ao plano de ação do SGI · EPIs assinados via PortalTEG
      </p>
    </div>
  )
}

// ── SpotlightMetric (número grande) ──────────────────────────────────────────
function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    teal: isDark ? 'text-teal-400' : 'text-teal-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    orange: isDark ? 'text-orange-400' : 'text-orange-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    red: isDark ? 'text-red-400' : 'text-red-600',
    slate: isDark ? 'text-slate-300' : 'text-slate-700',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// ── MiniInfoCard ─────────────────────────────────────────────────────────────
function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof Users2; iconTone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={iconTone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

function Bloco({ isDark, className, titulo, icon: Icon, children }: { isDark: boolean; className: string; titulo: string; icon: typeof Users2; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <Icon size={14} className={isDark ? 'text-slate-300' : 'text-slate-500'} />
        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Barras({ isDark, dados, cor, vazio }: { isDark: boolean; dados: { label: string; value: number }[]; cor?: string; vazio?: string }) {
  const max = Math.max(1, ...dados.map(x => x.value))
  const txtMain = isDark ? 'text-white' : 'text-slate-700'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  if (dados.length === 0) return <p className={`text-[11px] italic ${txtMuted} py-2`}>{vazio ?? 'Sem dados'}</p>
  return (
    <div className="space-y-1.5">
      {dados.slice(0, 10).map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`text-[11px] truncate w-[42%] shrink-0 ${txtMain}`} title={x.label}>{x.label}</span>
          <div className={`flex-1 h-3.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full" style={{ width: `${(x.value / max) * 100}%`, backgroundColor: cor ?? '#6366f1' }} />
          </div>
          <span className={`text-[11px] font-bold w-7 text-right shrink-0 ${txtMain}`}>{x.value}</span>
        </div>
      ))}
    </div>
  )
}
