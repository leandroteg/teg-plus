import { useMemo } from 'react'
import { ClipboardCheck, HardHat, Leaf, Ban, AlertTriangle, Users2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useQsmaKPIs, useInspecoes, useOcorrencias } from '../../hooks/useQsma'
import { useObrasComProjeto } from '../../hooks/useObras'
import { TIPO_OCORRENCIA_LABEL } from '../../types/qsma'

// Painel do módulo QSMA — padrão EGP: indicadores consolidados + pirâmide de
// Bird + barras por obra. Dados 100% reais (nasce zerado até lançarem).
export default function QsmaPainel() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: kpi } = useQsmaKPIs()
  const { data: inspecoes = [] } = useInspecoes()
  const { data: ocorrencias = [] } = useOcorrencias()
  const { data: obras = [] } = useObrasComProjeto()

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const cardClass = isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white border border-slate-200 shadow-sm'

  const d = useMemo(() => {
    const obraById = new Map(obras.map(o => [o.id, o]))
    const inspPorObra = new Map<string, number>()
    inspecoes.filter(i => i.status === 'executada').forEach(i => {
      if (i.obra_id) inspPorObra.set(i.obra_id, (inspPorObra.get(i.obra_id) ?? 0) + 1)
    })
    const ocoPorObra = new Map<string, number>()
    ocorrencias.forEach(o => {
      if (o.obra_id) ocoPorObra.set(o.obra_id, (ocoPorObra.get(o.obra_id) ?? 0) + 1)
    })
    const ocoPorTipo = new Map<string, number>()
    ocorrencias.forEach(o => {
      const l = TIPO_OCORRENCIA_LABEL[o.tipo] ?? o.tipo
      ocoPorTipo.set(l, (ocoPorTipo.get(l) ?? 0) + 1)
    })
    const toBar = (m: Map<string, number>, nomeFromObra = false) =>
      [...m.entries()]
        .map(([k, v]) => ({ label: nomeFromObra ? (obraById.get(k)?.nome ?? '—') : k, value: v }))
        .sort((a, b) => b.value - a.value)
    return {
      inspPorObra: toBar(inspPorObra, true),
      ocoPorObra: toBar(ocoPorObra, true),
      ocoPorTipo: toBar(ocoPorTipo),
    }
  }, [inspecoes, ocorrencias, obras])

  const pir = kpi?.piramide ?? { desvios: 0, quaseAcidentes: 0, acidentes: 0 }
  const pirMax = Math.max(1, pir.desvios, pir.quaseAcidentes, pir.acidentes)

  return (
    <div className="space-y-3">
      {/* Indicadores consolidados — padrão EGP */}
      <section className={`rounded-3xl p-4 md:p-5 ${cardClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">QSMA · Indicadores consolidados</p>
        <h2 className={`text-sm font-black mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Segurança e Meio Ambiente <span className="font-normal text-slate-400 text-[11px]">· campo, pessoas e conformidade</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <Kpi isDark={isDark} label="Inspeções 30d"    value={`${kpi?.inspecoes30 ?? 0}`}          note="executadas"        tone={isDark ? 'text-sky-400' : 'text-sky-600'} />
          <Kpi isDark={isDark} label="Programadas"      value={`${kpi?.inspecoesProgramadas ?? 0}`} note="a executar"        tone={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
          <Kpi isDark={isDark} label="Bloqueios"        value={`${kpi?.bloqueios ?? 0}`}            note="veredito bloqueado" tone={isDark ? 'text-red-400' : 'text-red-600'} />
          <Kpi isDark={isDark} label="Ocorrências"      value={`${kpi?.ocorrenciasAbertas ?? 0}`}   note="abertas"           tone={isDark ? 'text-orange-400' : 'text-orange-600'} />
          <Kpi isDark={isDark} label="Ações QSMA"       value={`${kpi?.acoesAbertas ?? 0}`}         note={`${kpi?.acoesAtrasadas ?? 0} atrasada(s)`} tone={isDark ? 'text-amber-400' : 'text-amber-600'} />
          <Kpi isDark={isDark} label="EPIs a trocar"    value={`${kpi?.episVencendo ?? 0}`}         note="próximos 60 dias"  tone={isDark ? 'text-violet-400' : 'text-violet-600'} />
          <Kpi isDark={isDark} label="Treinamentos"     value={`${kpi?.treinamentosVencendo ?? 0}`} note="vencendo em 60d"   tone={isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'} />
          <Kpi isDark={isDark} label="Licenças críticas" value={`${kpi?.licencasCriticas ?? 0}`}    note="vencidas/60d"      tone={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
        </div>
      </section>

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

        <Bloco isDark={isDark} className={card} titulo="Ocorrências por tipo" icon={HardHat}>
          <Barras isDark={isDark} dados={d.ocoPorTipo} cor="#f97316" vazio="Nenhuma ocorrência registrada" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Inspeções executadas por obra" icon={ClipboardCheck}>
          <Barras isDark={isDark} dados={d.inspPorObra} cor="#0ea5e9" vazio="Nenhuma inspeção executada" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Ocorrências por obra" icon={Users2}>
          <Barras isDark={isDark} dados={d.ocoPorObra} cor="#ef4444" vazio="Nenhuma ocorrência registrada" />
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

function Kpi({ isDark, label, value, note, tone }: { isDark: boolean; label: string; value: string; note: string; tone: string }) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/70'}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 truncate">{label}</p>
      <p className={`mt-1.5 text-xl leading-none font-black ${tone}`}>{value}</p>
      <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
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
