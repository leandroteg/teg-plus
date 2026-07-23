// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/PoliticasAprovacao.tsx
// Configura por categoria: validador técnico, aprovador alçada 1, limite e
// aprovador alçada 2. Salva inline ao editar cada campo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield, ShieldCheck, Loader2, Check, Save, Lock, ArrowRight,
  FileCheck2, CircleDollarSign, Layers,
} from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

interface CategoriaPolitica {
  id: string
  codigo: string
  nome: string
  validador_tecnico_id: string | null
  alcada1_aprovador_id: string | null
  alcada1_limite: number | null
  alcada2_aprovador_id: string | null
  ativo: boolean
}

interface PerfilOpt {
  id: string
  nome: string
  email: string
  role: string
}

const fmtBRL = (v: number | null | undefined) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })

const POLITICAS_GLOBAIS = [
  { label: 'Solicitação de Adiantamento', valor: 'Qualquer Diretor' },
  { label: 'Minutas Contratuais',         valor: 'Laucídio Cunha Junior' },
  { label: 'Autorização de Pagamento',    valor: 'Laucídio Cunha Junior' },
  { label: 'Aprovação de Transporte',     valor: 'Qualquer Diretor (provisório)' },
]

export default function PoliticasAprovacao() {
  const { isAdmin } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const qc = useQueryClient()
  const [salvouId, setSalvouId] = useState<string | null>(null)
  const [limiteDraft, setLimiteDraft] = useState<Record<string, string>>({})

  const { data: categorias = [], isLoading } = useQuery<CategoriaPolitica[]>({
    queryKey: ['cmp_categorias_politicas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_categorias')
        .select('id, codigo, nome, validador_tecnico_id, alcada1_aprovador_id, alcada1_limite, alcada2_aprovador_id, ativo')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as CategoriaPolitica[]
    },
  })

  const { data: perfis = [] } = useQuery<PerfilOpt[]>({
    queryKey: ['sys_perfis_aprovadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('id, nome, email, role')
        .in('role', ['administrador', 'diretor', 'gestor'])
        .order('nome')
      if (error) throw error
      return (data ?? []) as PerfilOpt[]
    },
  })

  const salvar = useMutation({
    mutationFn: async (payload: { id: string; field: string; value: string | number | null }) => {
      const { error } = await supabase
        .from('cmp_categorias')
        .update({ [payload.field]: payload.value })
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cmp_categorias_politicas'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      setSalvouId(`${variables.id}-${variables.field}`)
      setTimeout(() => setSalvouId(null), 1200)
    },
  })

  function handleSelectChange(c: CategoriaPolitica, field: 'validador_tecnico_id' | 'alcada1_aprovador_id' | 'alcada2_aprovador_id', value: string) {
    salvar.mutate({ id: c.id, field, value: value || null })
  }

  function handleLimiteBlur(c: CategoriaPolitica) {
    const raw = limiteDraft[c.id]
    if (raw === undefined) return
    const num = Number(raw.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (Number.isNaN(num) || num === Number(c.alcada1_limite ?? 0)) return
    salvar.mutate({ id: c.id, field: 'alcada1_limite', value: num })
  }

  // ── Classes de tema ─────────────────────────────────────────────────────────
  const heading = isLight ? 'text-slate-800' : 'text-slate-100'
  const label = isLight ? 'text-slate-500' : 'text-slate-400'
  const faint = isLight ? 'text-slate-400' : 'text-slate-500'
  const panel = isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
  const inputCls = `w-full px-2.5 py-2 rounded-lg text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400/60 ${
    isLight
      ? 'bg-white border border-slate-200 text-slate-800 hover:border-slate-300'
      : 'bg-white/[0.04] border border-white/[0.08] text-white hover:border-white/[0.16] [&>option]:bg-slate-900'
  }`
  const thCls = `text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${faint}`

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className={`rounded-2xl border p-8 ${panel}`}>
          <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${isLight ? 'bg-rose-50 text-rose-500' : 'bg-rose-500/15 text-rose-300'}`}>
            <Lock size={22} />
          </span>
          <p className={`text-sm font-semibold ${heading}`}>Acesso restrito</p>
          <p className={`text-xs mt-1 ${label}`}>Esta área é exclusiva para administradores.</p>
        </div>
      </div>
    )
  }

  function renderSavedIndicator(c: CategoriaPolitica, field: string) {
    const key = `${c.id}-${field}`
    if (salvouId === key) return <Check size={12} className="text-emerald-500 shrink-0" />
    if (salvar.isPending && salvar.variables?.id === c.id && salvar.variables?.field === field) {
      return <Loader2 size={12} className="animate-spin text-slate-400 shrink-0" />
    }
    return <span className="w-3 shrink-0" />
  }

  // ── Métricas derivadas ──────────────────────────────────────────────────────
  const comValidador = categorias.filter(c => c.validador_tecnico_id).length
  const comAlcada1 = categorias.filter(c => c.alcada1_aprovador_id).length
  const comAlcada2 = categorias.filter(c => c.alcada2_aprovador_id).length

  const kpis = [
    { icon: Layers,           label: 'Categorias ativas',  value: categorias.length },
    { icon: FileCheck2,       label: 'Com validador',      value: comValidador },
    { icon: CircleDollarSign, label: 'Com alçada 1',       value: comAlcada1 },
    { icon: ShieldCheck,      label: 'Com alçada 2',       value: comAlcada2 },
  ]

  const etapas = [
    { icon: FileCheck2,       titulo: 'Validação técnica', desc: 'Confere especificação e necessidade', tone: isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/15 text-violet-300' },
    { icon: CircleDollarSign, titulo: 'Alçada 1',          desc: 'Aprova até o limite definido',        tone: isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-300' },
    { icon: ShieldCheck,      titulo: 'Alçada 2',          desc: 'Aprova acima do limite',              tone: isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border
          ${isLight ? 'bg-slate-50 border-slate-200/80 text-slate-500' : 'bg-white/[0.04] border-white/[0.07] text-slate-400'}`}>
          <ShieldCheck size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className={`text-lg font-bold leading-tight ${heading}`}>Políticas de Aprovação</h1>
          <p className={`text-[12px] ${label}`}>Quem valida e quem aprova cada categoria de compra. Mudanças valem imediatamente.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold
          ${isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>
          <Save size={11} /> Salvamento automático
        </span>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ icon: Icon, label: kLabel, value }) => (
          <div key={kLabel} className={`rounded-2xl border p-3.5 ${panel}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border
                ${isLight ? 'bg-slate-50 border-slate-200/80 text-slate-500' : 'bg-white/[0.04] border-white/[0.07] text-slate-400'}`}>
                <Icon size={15} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                {isLoading ? (
                  <div className={`h-5 w-8 rounded animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                ) : (
                  <p className={`text-lg font-extrabold leading-none tabular-nums ${heading}`}>{value}</p>
                )}
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${faint}`}>{kLabel}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Como funciona o fluxo ── */}
      <div className={`rounded-2xl border p-4 ${panel}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
          {etapas.map((etapa, i) => (
            <div key={etapa.titulo} className="flex items-center gap-2 sm:flex-1">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${etapa.tone}`}>
                <etapa.icon size={16} />
              </span>
              <div className="min-w-0">
                <p className={`text-[12px] font-semibold leading-tight ${heading}`}>
                  <span className={`mr-1 text-[10px] font-bold ${faint}`}>{i + 1}.</span>
                  {etapa.titulo}
                </p>
                <p className={`text-[11px] leading-tight ${label}`}>{etapa.desc}</p>
              </div>
              {i < etapas.length - 1 && (
                <ArrowRight size={14} className={`hidden sm:block ml-auto shrink-0 ${faint}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabela de categorias ── */}
      <section className={`rounded-2xl border overflow-hidden ${panel}`}>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-9 w-40 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                <div className={`h-9 flex-1 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                <div className={`h-9 flex-1 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                <div className={`h-9 w-28 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
                <div className={`h-9 flex-1 rounded-lg animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
              </div>
            ))}
          </div>
        ) : categorias.length === 0 ? (
          <div className="py-14 text-center">
            <Shield size={28} className={`mx-auto mb-2 ${faint}`} />
            <p className={`text-sm font-semibold ${heading}`}>Nenhuma categoria ativa</p>
            <p className={`text-xs mt-1 ${label}`}>Cadastre categorias de compras para configurar as políticas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isLight ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white/[0.03] border-b border-white/[0.06]'}>
                  <th className={thCls}>Categoria</th>
                  <th className={thCls}>Validação técnica</th>
                  <th className={thCls}>Aprovação · Alçada 1</th>
                  <th className={thCls + ' w-[140px]'}>Limite alçada 1</th>
                  <th className={thCls}>Aprovação · Alçada 2</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(c => (
                  <tr key={c.id} className={`border-t transition-colors ${isLight ? 'border-slate-100 hover:bg-slate-50/60' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}>
                    <td className={`px-4 py-2.5 ${heading}`}>
                      <p className="text-[13px] font-semibold leading-tight">{c.nome}</p>
                      <span className={`mt-0.5 inline-block rounded px-1 py-px text-[10px] font-mono
                        ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'}`}>
                        {c.codigo}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          className={inputCls}
                          value={c.validador_tecnico_id ?? ''}
                          onChange={e => handleSelectChange(c, 'validador_tecnico_id', e.target.value)}
                        >
                          <option value="">— Sem validador —</option>
                          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        {renderSavedIndicator(c, 'validador_tecnico_id')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          className={inputCls}
                          value={c.alcada1_aprovador_id ?? ''}
                          onChange={e => handleSelectChange(c, 'alcada1_aprovador_id', e.target.value)}
                        >
                          <option value="">— Sem aprovador —</option>
                          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        {renderSavedIndicator(c, 'alcada1_aprovador_id')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${inputCls} text-right font-semibold tabular-nums`}
                          value={limiteDraft[c.id] ?? fmtBRL(c.alcada1_limite ?? 0)}
                          onChange={e => setLimiteDraft({ ...limiteDraft, [c.id]: e.target.value })}
                          onFocus={() => setLimiteDraft({ ...limiteDraft, [c.id]: String(c.alcada1_limite ?? 0) })}
                          onBlur={() => { handleLimiteBlur(c); setLimiteDraft(d => { const n = { ...d }; delete n[c.id]; return n }) }}
                        />
                        {renderSavedIndicator(c, 'alcada1_limite')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          className={inputCls}
                          value={c.alcada2_aprovador_id ?? ''}
                          onChange={e => handleSelectChange(c, 'alcada2_aprovador_id', e.target.value)}
                        >
                          <option value="">— Sem aprovador —</option>
                          {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        {renderSavedIndicator(c, 'alcada2_aprovador_id')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Políticas globais ── */}
      <section className={`rounded-2xl border p-4 sm:p-5 ${panel}`}>
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-400'}`}>
            <Lock size={14} />
          </span>
          <div>
            <h2 className={`text-[13px] font-bold leading-tight ${heading}`}>Políticas globais</h2>
            <p className={`text-[11px] ${label}`}>Aprovações que não dependem de categoria · somente leitura, alteração exige deploy</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {POLITICAS_GLOBAIS.map(({ label: pLabel, valor }) => (
            <div key={pLabel} className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5
              ${isLight ? 'border-slate-100 bg-slate-50/60' : 'border-white/[0.04] bg-white/[0.02]'}`}>
              <span className={`text-[12px] font-medium ${label}`}>{pLabel}</span>
              <span className={`text-[12px] font-semibold text-right ${heading}`}>{valor}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
