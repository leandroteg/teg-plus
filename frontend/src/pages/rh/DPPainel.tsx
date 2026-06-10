// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/DPPainel.tsx — Painel do DP (padrão dos dashboards TEG+)
// Estrutura pronta; dados serão preenchidos pela integração com o Seculum.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Calculator, Receipt, Timer, Fingerprint, TrendingUp, ChevronRight,
  Zap, Clock, AlertTriangle, PlugZap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'

const fmtBRL = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function SpotlightMetric({ label, value, tone, note, isDark }: {
  label: string; value: string | number; tone: string; note?: string; isDark: boolean
}) {
  const tones: Record<string, string> = {
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    blue: isDark ? 'text-blue-400' : 'text-blue-600',
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-500',
  }
  return (
    <div className={`rounded-2xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone] || tones.slate}`}>{value}</p>
      {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

function MiniInfoCard({ label, value, note, icon: Icon, iconTone, isDark }: {
  label: string; value: string | number; note?: string; icon: typeof Receipt; iconTone: string; isDark: boolean
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

export default function DPPainel() {
  const { isDark } = useTheme()
  const nav = useNavigate()
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  // Placeholders — serão preenchidos pela integração com o Seculum
  const folhaMensal = 0
  const horaExtra = 0
  const volumePonto = 0
  const pontosAberto = 0
  const heAprovar = 0
  const porCC: { centro_custo: string; valor: number }[] = []
  const maxCC = Math.max(...porCC.map(c => c.valor), 1)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>Painel DP</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Folha, ponto e horas extras</p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
          <PlugZap size={12} /> Aguardando Seculum
        </span>
      </div>

      {/* Aviso de integração */}
      <div className={`rounded-xl border border-dashed px-4 py-2.5 flex items-center gap-2 text-xs ${isDark ? 'border-white/[0.10] text-slate-400' : 'border-slate-300 text-slate-500'}`}>
        <PlugZap size={14} className="text-amber-500 shrink-0" />
        Estrutura pronta — os indicadores serão preenchidos automaticamente quando a integração com o <strong className="mx-1">Seculum</strong> for ativada.
      </div>

      {/* Hero: Indicadores + Janela Crítica */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Núcleo da Folha</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores do mês</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Calculator size={18} className="text-amber-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <SpotlightMetric label="Folha do Mês" value={fmtBRL(folhaMensal)} tone="amber" isDark={isDark} note="total bruto" />
              <SpotlightMetric label="Hora Extra" value={fmtBRL(horaExtra)} tone="blue" isDark={isDark} note="no mês" />
              <SpotlightMetric label="Volume de Ponto" value={volumePonto} tone="violet" isDark={isDark} note="registros" />
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
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${pontosAberto > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={pontosAberto > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniInfoCard label="Pontos em Aberto" value={pontosAberto} icon={Clock}
                iconTone={pontosAberto > 0 ? 'text-red-500' : 'text-slate-400'} note={pontosAberto > 0 ? 'regularizar' : 'tudo ok'} isDark={isDark} />
              <MiniInfoCard label="HE a Aprovar" value={heAprovar} icon={AlertTriangle}
                iconTone={heAprovar > 0 ? 'text-amber-500' : 'text-slate-400'} note="pendentes" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso: custo da folha por centro de custo */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <TrendingUp size={14} className="text-amber-500" /> Custo da Folha por Centro de Custo
          </h2>
        </div>
        <div className="px-4 py-3">
          {porCC.length === 0 ? (
            <div className={`h-10 rounded-xl flex items-center justify-center text-[10px] font-semibold ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              Aguardando dados da folha (Seculum)
            </div>
          ) : (
            <div className="space-y-2.5">
              {porCC.slice(0, 8).map(cc => (
                <div key={cc.centro_custo} className="flex items-center gap-3">
                  <p className={`text-[11px] font-semibold text-right shrink-0 w-[90px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc.centro_custo}</p>
                  <div className="flex-1 relative">
                    <div className={`h-6 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-600 transition-all duration-500" style={{ width: `${Math.max((cc.valor / maxCC) * 100, 4)}%` }} />
                    </div>
                  </div>
                  <p className={`text-[11px] font-extrabold shrink-0 w-[70px] text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmtBRL(cc.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Listas: Pontos em aberto + Apontamentos de HE */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Fingerprint size={14} className="text-blue-500" /> Pontos em Aberto
            </h2>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">Ir para Ponto <ChevronRight size={11} /></button>
          </div>
          <div className="py-10 text-center">
            <Clock size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sem pontos em aberto</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Dados virão do Seculum</p>
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Timer size={14} className="text-orange-500" /> Apontamentos de Hora Extra
            </h2>
            <button onClick={() => nav('/rh/dp/ponto')} className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">Ver todos <ChevronRight size={11} /></button>
          </div>
          <div className="py-10 text-center">
            <Timer size={28} className={`mx-auto mb-2 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum apontamento recente</p>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Dados virão do Seculum</p>
          </div>
        </section>
      </div>
    </div>
  )
}
