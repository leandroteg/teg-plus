// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/paineis/LiberacaoHeadcount.tsx — Painel de Liberação (Headcount)
// Snapshot do fluxo de admissão focado em liberar p/ atividades.
// Dados vêm da RPC rh_admissao_liberacao_painel (calculada no banco).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, Activity, AlertTriangle, Zap, TrendingUp } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { supabase } from '../../../services/supabase'

type Pulso = { etapa: string; label: string; qt: number }
type Fase = { etapa: string; label: string; dias: number; qt: number }
type Atraso = { nome: string; funcao: string; dt: string; estagio: string; dias: number }
type Painel = {
  admitidos: number; liberados: number; tempo_medio_integracao: number | null
  aguardando: number; em_andamento: number; em_atraso: number
  pulso: Pulso[]; fases: Fase[]; atraso: Atraso[]
}

const ETAPA_LABEL: Record<string, string> = {
  requisicao: 'Pendente', aprovacao: 'Aprovação', proposta_alinhamento: 'Proposta',
  documentacao: 'Documentação', exames_treinamentos: 'Exames', registro: 'Registro',
  mobilizacao: 'Mobilização', integracao: 'Integração', liberado: 'Liberação',
}
const ETAPA_COR: Record<string, string> = {
  requisicao: '#94a3b8', aprovacao: '#f59e0b', proposta_alinhamento: '#f43f5e',
  documentacao: '#8b5cf6', exames_treinamentos: '#0ea5e9', registro: '#6366f1',
  mobilizacao: '#f97316', integracao: '#0d9488', liberado: '#059669',
}

function useLiberacaoPainel(de: string, ate: string) {
  return useQuery<Painel>({
    queryKey: ['rh-liberacao-painel', de, ate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rh_admissao_liberacao_painel', {
        p_de: `${de}-01`, p_ate: `${ate}-01`,
      })
      if (error) throw error
      return data as Painel
    },
  })
}

export default function LiberacaoHeadcount({ de, ate }: { de: string; ate: string }) {
  const { isDark } = useTheme()
  const { data, isLoading } = useLiberacaoPainel(de, ate)
  const cardClass = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  // Pulso: na Liberação conta só quem está "aguardando" (os já liberados saíram da fila)
  const pulsoDisplay = data.pulso.map(p => ({ ...p, qt: p.etapa === 'liberado' ? data.aguardando : p.qt }))
  const pulsoMax = Math.max(...pulsoDisplay.map(p => p.qt), 1)
  const faseMax = Math.max(...data.fases.map(f => f.dias), 1)

  return (
    <div className="space-y-3">
      {/* Hero: 3 indicadores-chave + 2 itens críticos */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.52fr_0.88fr] gap-3 items-stretch">
        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Núcleo de Liberação</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Indicadores-chave</h2>
              </div>
              <div className={`hidden md:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              <Indicador label="Admitidos" value={data.admitidos} tone="violet" note="no período" isDark={isDark} />
              <Indicador label="Liberados" value={data.liberados} tone="emerald" note="efetivados p/ campo" isDark={isDark} />
              <Indicador label="Tempo médio integração"
                value={data.tempo_medio_integracao != null ? `${data.tempo_medio_integracao.toLocaleString('pt-BR')}d` : '—'}
                tone="amber" note="registro → liberação" isDark={isDark} />
            </div>
          </div>
        </section>

        <section className={`rounded-3xl shadow-sm overflow-hidden flex flex-col ${cardClass}`}>
          <div className="p-4 md:p-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Janela Crítica</p>
                <h2 className={`mt-0.5 text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Exige ação agora</h2>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${data.em_atraso > 0 ? 'bg-red-50' : isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <Zap size={14} className={data.em_atraso > 0 ? 'text-red-500' : 'text-slate-400'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Critico label="Em atraso" value={data.em_atraso} icon={AlertTriangle}
                tone={data.em_atraso > 0 ? 'text-red-500' : 'text-slate-400'} note={data.em_atraso > 0 ? 'início já vencido' : 'em dia'} isDark={isDark} />
              <Critico label="Aguardando GESET" value={data.aguardando} icon={Clock}
                tone={data.aguardando > 0 ? 'text-amber-500' : 'text-slate-400'} note="não vai a campo" isDark={isDark} />
            </div>
          </div>
        </section>
      </div>

      {/* Pulso por etapa */}
      <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Activity size={14} className="text-violet-500" /> Pulso por etapa
          </h2>
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>pessoas em cada fase · hoje · Liberação = aguardando</span>
        </div>
        <div className="flex items-end gap-1.5 px-4 pt-5 pb-2" style={{ height: 176 }}>
          {pulsoDisplay.map(p => {
            const vazio = p.qt === 0
            const barH = vazio ? 3 : Math.max(Math.round((p.qt / pulsoMax) * 116), 10)
            return (
              <div key={p.etapa} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5" title={`${p.label}: ${p.qt}`}>
                <span className={`text-[13px] font-black leading-none ${vazio ? (isDark ? 'text-slate-600' : 'text-slate-300') : (isDark ? 'text-white' : 'text-slate-700')}`}>{p.qt}</span>
                <div className="w-full rounded-t-lg transition-all" style={{ height: barH, background: ETAPA_COR[p.etapa], opacity: vazio ? 0.3 : 1 }} />
                <div className={`text-[9px] font-bold uppercase tracking-tight truncate w-full text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{p.label}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Fases por tempo (50%) + Liberações em atraso (50%, mesma altura, rolagem) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <Clock size={14} className="text-violet-500" /> Fases por tempo
            </h2>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>dias na etapa</span>
          </div>
          <div className="h-[288px] flex flex-col justify-center gap-3 px-4">
            {data.fases.map(f => (
              <div key={f.etapa} className="grid grid-cols-[96px_1fr_46px] items-center gap-2">
                <div className={`text-[11px] font-bold text-right truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.label}</div>
                <div className={`h-4 rounded-lg overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
                  <div className="h-full rounded-lg" style={{ width: `${Math.max((f.dias / faseMax) * 100, 4)}%`, background: ETAPA_COR[f.etapa] }} />
                </div>
                <div className={`text-[11px] font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{f.dias.toLocaleString('pt-BR')}d</div>
              </div>
            ))}
            <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              * tempo médio parado na etapa atual — amadurece conforme o fluxo roda.
            </p>
          </div>
        </section>

        <section className={`rounded-2xl shadow-sm overflow-hidden ${cardClass}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
            <h2 className={`text-sm font-extrabold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <AlertTriangle size={14} className="text-red-500" /> Liberações em atraso
            </h2>
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{data.atraso.length} · por dias</span>
          </div>
          <div className="h-[288px] overflow-y-auto px-2.5 py-1.5">
            {data.atraso.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[11px] font-semibold text-slate-400">Nenhuma liberação em atraso 🎉</div>
            ) : data.atraso.map((a, i) => {
              const suspeito = a.dias > 120
              return (
                <div key={i} className={`flex items-center gap-2.5 px-1.5 py-2 ${i > 0 ? (isDark ? 'border-t border-white/[0.05]' : 'border-t border-slate-100') : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-extrabold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{cap(a.nome)}</div>
                    <div className={`text-[9.5px] mt-0.5 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {cap(a.funcao)} · adm {a.dt} · {ETAPA_LABEL[a.estagio] ?? a.estagio}
                    </div>
                  </div>
                  <div className={`shrink-0 text-center rounded-lg px-2 py-1 min-w-[52px] ${suspeito
                    ? (isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600')
                    : (isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')}`}>
                    <div className="text-[15px] font-black leading-none">{a.dias}</div>
                    <div className="text-[8px] font-bold uppercase tracking-wide opacity-85">{suspeito ? 'dias ⚠' : 'dias'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function Indicador({ label, value, tone, note, isDark }: { label: string; value: number | string; tone: string; note?: string; isDark: boolean }) {
  const tones: Record<string, string> = {
    violet: isDark ? 'text-violet-400' : 'text-violet-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
  }
  return (
    <div className={`rounded-2xl p-3 flex flex-col ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <div className="flex-1 flex flex-col justify-center">
        <p className={`text-[1.85rem] font-extrabold leading-none ${tones[tone]}`}>{value}</p>
        {note && <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
      </div>
    </div>
  )
}

function Critico({ label, value, note, icon: Icon, tone, isDark }: {
  label: string; value: number; note?: string; icon: typeof AlertTriangle; tone: string; isDark: boolean
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 flex-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50/80'}`}>
      <Icon size={16} className={tone} />
      <p className={`text-2xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`text-[9px] font-bold uppercase tracking-wider text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      {note && <p className={`text-[8px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{note}</p>}
    </div>
  )
}

// TÍTULO CAIXA-ALTA do banco → Title Case para leitura
function cap(s: string): string {
  return s.toLowerCase().replace(/\b([a-záàâãéêíóôõúç])/g, m => m.toUpperCase())
}
