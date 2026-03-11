import { useState } from 'react'
import {
  HardHat, ClipboardList, CloudSun, Wallet, Receipt,
  Users, ArrowRight, Truck, Plus, X, Save, Users2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useObrasKPIs,
  useApontamentos,
  useMobilizacoes,
  useCriarMobilizacao,
  useEquipes,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { TipoMobilizacao } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_APONTAMENTO: Record<string, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
  confirmado: { label: 'Confirmado', light: 'bg-blue-100 text-blue-700',   dark: 'bg-blue-500/15 text-blue-300'  },
  validado:   { label: 'Validado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
}

const STATUS_MOB: Record<string, { label: string; light: string; dark: string }> = {
  planejada:     { label: 'Planejada',     light: 'bg-slate-100 text-slate-600',      dark: 'bg-slate-500/15 text-slate-400' },
  em_andamento:  { label: 'Em Andamento',  light: 'bg-blue-100 text-blue-700',        dark: 'bg-blue-500/15 text-blue-300' },
  concluida:     { label: 'Concluida',     light: 'bg-emerald-100 text-emerald-700',  dark: 'bg-emerald-500/15 text-emerald-300' },
}

// ── KPI accent map (static classes for Tailwind JIT) ─────────────────────────

const ACCENT_MAP: Record<string, { iconBgLight: string; iconBgDark: string; iconText: string }> = {
  blue:   { iconBgLight: 'bg-blue-50',   iconBgDark: 'bg-blue-500/10',   iconText: 'text-blue-500' },
  amber:  { iconBgLight: 'bg-amber-50',  iconBgDark: 'bg-amber-500/10',  iconText: 'text-amber-500' },
  violet: { iconBgLight: 'bg-violet-50', iconBgDark: 'bg-violet-500/10', iconText: 'text-violet-500' },
  rose:   { iconBgLight: 'bg-rose-50',   iconBgDark: 'bg-rose-500/10',   iconText: 'text-rose-500' },
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent, isLight,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof HardHat
  accent: string
  isLight: boolean
}) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.blue
  return (
    <div className={`rounded-2xl border p-5 ${isLight
      ? 'bg-white border-slate-200 shadow-sm'
      : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight
          ? a.iconBgLight
          : a.iconBgDark
        }`}>
          <Icon size={18} className={a.iconText} />
        </div>
        <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
      </div>
      <p className={`text-3xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
      )}
    </div>
  )
}

// ── Quick Link ───────────────────────────────────────────────────────────────

function QuickLink({
  to, label, desc, icon: Icon, isLight,
}: {
  to: string; label: string; desc: string; icon: typeof HardHat; isLight: boolean
}) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border p-4 flex items-center gap-4 transition-colors ${isLight
        ? 'bg-white border-slate-200 shadow-sm hover:border-teal-300 hover:shadow-md'
        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
      }`}
    >
      <Icon size={20} className={`shrink-0 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{label}</p>
        <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
      </div>
      <ArrowRight size={16} className={`shrink-0 transition-transform group-hover:translate-x-1 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
    </Link>
  )
}

// ── Mobilization empty form ──────────────────────────────────────────────────

const EMPTY_MOB = {
  obra_id: '',
  tipo: 'mobilizacao' as TipoMobilizacao,
  data_prevista: '',
  responsavel: '',
  observacoes: '',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ObrasHome() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()
  const { data: kpis, isLoading } = useObrasKPIs()
  const { data: recentApontamentos = [] } = useApontamentos()
  const { data: mobilizacoes = [] } = useMobilizacoes()
  const criarMobilizacao = useCriarMobilizacao()

  // Equipe — use first obra that exists, or none
  const [equipeObraId, setEquipeObraId] = useState('')
  const { data: equipeData = [] } = useEquipes(equipeObraId || undefined)

  const [showMobModal, setShowMobModal] = useState(false)
  const [mobForm, setMobForm] = useState(EMPTY_MOB)

  const latest5 = recentApontamentos.slice(0, 5)
  const recentMobs = mobilizacoes.slice(0, 5)

  const handleCreateMob = async () => {
    await criarMobilizacao.mutateAsync({
      obra_id: mobForm.obra_id,
      tipo: mobForm.tipo,
      colaboradores: [],
      equipamentos: [],
      status: 'planejada',
      data_prevista: mobForm.data_prevista || null,
      responsavel: mobForm.responsavel || null,
      observacoes: mobForm.observacoes || null,
    })
    setShowMobModal(false)
    setMobForm(EMPTY_MOB)
  }

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  const inputClass = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-700'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 placeholder:text-slate-500'
  }`

  const labelClass = `block text-xs font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          Painel de Obras
        </h1>
        <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Visao geral de apontamentos, RDOs, adiantamentos e equipes
        </p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-2xl h-28 animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.03]'}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Apontamentos Hoje" value={kpis?.apontamentos_hoje ?? 0} sub="registros do dia" icon={ClipboardList} accent="blue" isLight={isLight} />
          <KpiCard label="RDOs Pendentes" value={kpis?.rdos_pendentes ?? 0} sub="aguardando finalizar" icon={CloudSun} accent="amber" isLight={isLight} />
          <KpiCard label="Adiantamentos Abertos" value={kpis?.adiantamentos_abertos ?? 0} sub="aguardando prestacao" icon={Wallet} accent="violet" isLight={isLight} />
          <KpiCard label="Prestacoes Pendentes" value={kpis?.prestacoes_pendentes ?? 0} sub="aguardando aprovacao" icon={Receipt} accent="rose" isLight={isLight} />
        </div>
      )}

      {/* Two-column layout: Recent Apontamentos + Mobilizacoes */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Apontamentos */}
        <div className={`rounded-2xl border p-5 ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
              <ClipboardList size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
              Apontamentos Recentes
            </h2>
            <Link to="/obras/apontamentos" className={`text-xs font-medium flex items-center gap-1 ${isLight ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'}`}>
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>

          {latest5.length === 0 ? (
            <p className={`text-sm text-center py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Nenhum apontamento registrado
            </p>
          ) : (
            <div className="space-y-2">
              {latest5.map(ap => {
                const st = STATUS_APONTAMENTO[ap.status] ?? STATUS_APONTAMENTO.rascunho
                return (
                  <div key={ap.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isLight
                    ? 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{ap.atividade}</p>
                      <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {ap.obra?.nome ?? '\u2014'}{ap.frente?.nome ? ` / ${ap.frente.nome}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {ap.quantidade_executada} {ap.unidade ?? 'un'}
                      </p>
                      <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(ap.data_apontamento)}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mobilizacoes */}
        <div className={`rounded-2xl border p-5 ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
              <Truck size={16} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
              Mobilizacoes Recentes
            </h2>
            <button
              onClick={() => { setMobForm(EMPTY_MOB); setShowMobModal(true) }}
              className={`text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${isLight
                ? 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'
              }`}
            >
              <Plus size={12} /> Nova
            </button>
          </div>

          {recentMobs.length === 0 ? (
            <p className={`text-sm text-center py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Nenhuma mobilizacao registrada
            </p>
          ) : (
            <div className="space-y-2">
              {recentMobs.map(mob => {
                const st = STATUS_MOB[mob.status] ?? STATUS_MOB.planejada
                return (
                  <div key={mob.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isLight
                    ? 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                  }`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {mob.tipo === 'mobilizacao' ? 'Mobilizacao' : 'Desmobilizacao'}
                      </p>
                      <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {mob.obra?.nome ?? '\u2014'}
                        {mob.data_prevista ? ` \u2022 ${fmtDate(mob.data_prevista)}` : ''}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Equipe por Obra */}
      <div className={`rounded-2xl border p-5 ${isLight
        ? 'bg-white border-slate-200 shadow-sm'
        : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <Users2 size={16} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
            Equipe por Obra
          </h2>
          <select
            value={equipeObraId}
            onChange={e => setEquipeObraId(e.target.value)}
            className={selectClass}
          >
            <option value="">Selecione uma obra</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>

        {!equipeObraId ? (
          <p className={`text-sm text-center py-6 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Selecione uma obra para ver a equipe
          </p>
        ) : equipeData.length === 0 ? (
          <p className={`text-sm text-center py-6 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum membro na equipe desta obra
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {equipeData.map(m => (
              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isLight
                ? 'bg-slate-50/50 border-slate-100'
                : 'bg-white/[0.02] border-white/[0.04]'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isLight
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-violet-500/15 text-violet-400'
                }`}>
                  {m.colaborador_nome.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {m.colaborador_nome}
                  </p>
                  <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {m.funcao}{m.frente?.nome ? ` \u2022 ${m.frente.nome}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.ativo
                  ? (isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400')
                  : (isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-500/15 text-slate-400')
                }`}>
                  {m.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className={`text-sm font-semibold mb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>
          Acesso Rapido
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink to="/obras/apontamentos" label="Apontamentos" desc="Registro diario de producao" icon={ClipboardList} isLight={isLight} />
          <QuickLink to="/obras/rdo" label="RDO" desc="Relatorio diario de obra" icon={CloudSun} isLight={isLight} />
          <QuickLink to="/obras/adiantamentos" label="Adiantamentos" desc="Solicitacoes e prestacao de contas" icon={Wallet} isLight={isLight} />
          <QuickLink to="/obras/prestacao" label="Prestacao de Contas" desc="Despesas e reembolsos" icon={Receipt} isLight={isLight} />
          <QuickLink to="/obras/equipe" label="Planejamento de Equipe" desc="Profissionais por obra" icon={Users} isLight={isLight} />
        </div>
      </div>

      {/* Create Mobilization Modal */}
      {showMobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-xl p-6 ${isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#1e293b] border-white/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Nova Mobilizacao</h2>
              <button onClick={() => setShowMobModal(false)} className={`p-1.5 rounded-lg transition-colors ${isLight
                ? 'hover:bg-slate-100 text-slate-400'
                : 'hover:bg-white/[0.06] text-slate-500'
              }`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Obra *</label>
                <select value={mobForm.obra_id} onChange={e => setMobForm(f => ({ ...f, obra_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select value={mobForm.tipo} onChange={e => setMobForm(f => ({ ...f, tipo: e.target.value as TipoMobilizacao }))} className={inputClass}>
                  <option value="mobilizacao">Mobilizacao</option>
                  <option value="desmobilizacao">Desmobilizacao</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Data Prevista</label>
                <input type="date" value={mobForm.data_prevista} onChange={e => setMobForm(f => ({ ...f, data_prevista: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Responsavel</label>
                <input type="text" value={mobForm.responsavel} onChange={e => setMobForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsavel" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Observacoes</label>
                <textarea value={mobForm.observacoes} onChange={e => setMobForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Opcional..." className={inputClass} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowMobModal(false)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-white/[0.06]'
              }`}>
                Cancelar
              </button>
              <button
                onClick={handleCreateMob}
                disabled={!mobForm.obra_id || criarMobilizacao.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {criarMobilizacao.isPending ? 'Criando...' : 'Criar Mobilizacao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
