// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/PoliticasAprovacao.tsx
// Configuração de validadores técnicos por área + mapeamento de categorias.
// Acesso: apenas administradores.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Tag, Save, Loader2, Check } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

interface ValidadorTec {
  area: 'operacional' | 'administrativo' | 'ti'
  validador_id: string | null
  validador_nome: string | null
  ativo: boolean
}

interface CategoriaRow {
  id: string
  codigo: string
  nome: string
  area_tecnica: 'operacional' | 'administrativo' | 'ti' | null
  ativo: boolean
}

interface PerfilOpt {
  id: string
  nome: string
  email: string
}

const AREA_LABEL: Record<string, string> = {
  operacional: 'Operacional',
  administrativo: 'Administrativo',
  ti: 'TI',
}

const AREA_COLOR: Record<string, string> = {
  operacional:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  administrativo: 'bg-amber-100 text-amber-700 border-amber-200',
  ti:             'bg-sky-100 text-sky-700 border-sky-200',
}

export default function PoliticasAprovacao() {
  const { isAdmin } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const qc = useQueryClient()
  const [salvouId, setSalvouId] = useState<string | null>(null)

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: validadores = [], isLoading: loadingV } = useQuery<ValidadorTec[]>({
    queryKey: ['apr_validadores_tecnicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apr_validadores_tecnicos')
        .select('*')
        .order('area')
      if (error) throw error
      return (data ?? []) as ValidadorTec[]
    },
  })

  const { data: categorias = [], isLoading: loadingC } = useQuery<CategoriaRow[]>({
    queryKey: ['cmp_categorias_politicas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_categorias')
        .select('id, codigo, nome, area_tecnica, ativo')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []) as CategoriaRow[]
    },
  })

  const { data: perfis = [] } = useQuery<PerfilOpt[]>({
    queryKey: ['sys_perfis_aprovadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('id, nome, email')
        .in('role', ['administrador', 'diretor', 'gestor'])
        .order('nome')
      if (error) throw error
      return (data ?? []) as PerfilOpt[]
    },
  })

  // ── Mutations ───────────────────────────────────────────────────────────
  const salvarValidador = useMutation({
    mutationFn: async (payload: { area: string; validador_id: string | null }) => {
      const perfil = perfis.find(p => p.id === payload.validador_id)
      const { error } = await supabase
        .from('apr_validadores_tecnicos')
        .upsert({
          area: payload.area,
          validador_id: payload.validador_id,
          validador_nome: perfil?.nome ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'area' })
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['apr_validadores_tecnicos'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      setSalvouId(`v-${variables.area}`)
      setTimeout(() => setSalvouId(null), 1500)
    },
  })

  const salvarCategoriaArea = useMutation({
    mutationFn: async (payload: { id: string; area_tecnica: string | null }) => {
      const { error } = await supabase
        .from('cmp_categorias')
        .update({ area_tecnica: payload.area_tecnica })
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['cmp_categorias_politicas'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      setSalvouId(`c-${variables.id}`)
      setTimeout(() => setSalvouId(null), 1500)
    },
  })

  // ── Estilos ─────────────────────────────────────────────────────────────
  const cardCls = isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const txt = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const inputCls = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white [&>option]:bg-slate-900'
  }`

  // Agrupa categorias por área
  const categoriasPorArea = useMemo(() => {
    const groups: Record<string, CategoriaRow[]> = { operacional: [], administrativo: [], ti: [], '__sem': [] }
    categorias.forEach(c => {
      const key = c.area_tecnica ?? '__sem'
      if (!groups[key]) groups[key] = []
      groups[key].push(c)
    })
    return groups
  }, [categorias])

  if (!isAdmin) {
    return (
      <div className={`p-6 rounded-2xl ${cardCls}`}>
        <p className={`text-sm ${txt}`}>Acesso restrito a administradores.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-extrabold ${txt} flex items-center gap-2`}>
          <Shield size={20} className="text-rose-500" />
          Políticas de Aprovação
        </h1>
        <p className={`text-xs mt-1 ${txtMuted}`}>
          Define quem valida tecnicamente cada categoria de produto. Mudanças entram em vigor imediatamente em todas as filas de aprovação.
        </p>
      </div>

      {/* ── Validadores por Área ───────────────────────────────────────── */}
      <section className={`rounded-2xl p-5 ${cardCls}`}>
        <h2 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <Users size={14} className="text-teal-500" />
          Validadores Técnicos por Área
        </h2>
        {loadingV ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['operacional', 'administrativo', 'ti'] as const).map(area => {
              const v = validadores.find(x => x.area === area)
              const isSaving = salvarValidador.isPending && salvarValidador.variables?.area === area
              const isSaved = salvouId === `v-${area}`
              return (
                <div key={area} className={`p-3 rounded-xl border ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${AREA_COLOR[area]}`}>
                      {AREA_LABEL[area]}
                    </span>
                    {isSaved && <Check size={14} className="text-emerald-500" />}
                    {isSaving && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  </div>
                  <select
                    className={inputCls}
                    value={v?.validador_id ?? ''}
                    onChange={e => salvarValidador.mutate({ area, validador_id: e.target.value || null })}
                  >
                    <option value="">— Sem validador —</option>
                    {perfis.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  {v?.validador_nome && (
                    <p className={`text-[10px] mt-1 ${txtMuted}`}>
                      Atual: <span className="font-semibold">{v.validador_nome}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Categorias × Área ──────────────────────────────────────────── */}
      <section className={`rounded-2xl p-5 ${cardCls}`}>
        <h2 className={`text-sm font-bold mb-3 flex items-center gap-2 ${txt}`}>
          <Tag size={14} className="text-violet-500" />
          Mapeamento de Categorias por Área
        </h2>
        <p className={`text-xs mb-4 ${txtMuted}`}>
          Cada categoria pertence a uma área. O validador técnico daquela área aprovará todas as Requisições de Compra da categoria.
        </p>
        {loadingC ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                  <th className={`text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Categoria</th>
                  <th className={`text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Área</th>
                  <th className={`text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Validador atual</th>
                </tr>
              </thead>
              <tbody>
                {(['operacional', 'administrativo', 'ti', '__sem'] as const).map(area => {
                  const items = categoriasPorArea[area] ?? []
                  if (items.length === 0) return null
                  const validadorNome = validadores.find(v => v.area === area)?.validador_nome
                  return (
                    <>
                      {items.map(c => {
                        const isSaving = salvarCategoriaArea.isPending && salvarCategoriaArea.variables?.id === c.id
                        const isSaved = salvouId === `c-${c.id}`
                        return (
                          <tr key={c.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                            <td className={`px-3 py-2 ${txt}`}>
                              <p className="font-semibold">{c.nome}</p>
                              <p className={`text-[10px] font-mono ${txtMuted}`}>{c.codigo}</p>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className={`${inputCls} max-w-[200px]`}
                                value={c.area_tecnica ?? ''}
                                onChange={e => salvarCategoriaArea.mutate({
                                  id: c.id,
                                  area_tecnica: e.target.value || null,
                                })}
                              >
                                <option value="">— Sem área —</option>
                                <option value="operacional">Operacional</option>
                                <option value="administrativo">Administrativo</option>
                                <option value="ti">TI</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${txt}`}>{validadorNome ?? '—'}</span>
                                {isSaved && <Check size={12} className="text-emerald-500" />}
                                {isSaving && <Loader2 size={12} className="animate-spin text-slate-400" />}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Políticas de Pessoas Fixas (read-only, info) ───────────────── */}
      <section className={`rounded-2xl p-5 ${cardCls}`}>
        <h2 className={`text-sm font-bold mb-2 flex items-center gap-2 ${txt}`}>
          <Save size={14} className="text-amber-500" />
          Políticas de Pessoas Fixas (somente leitura)
        </h2>
        <p className={`text-xs mb-3 ${txtMuted}`}>
          As políticas abaixo estão atualmente codificadas no sistema. Para alterar, é necessário deploy.
        </p>
        <div className={`text-xs space-y-2 ${txt}`}>
          <div className="flex gap-3"><span className="font-bold w-56">Aprovação Compras ≤ R$ 3.000:</span> Leandro Mallet <em className={txtMuted}>ou</em> Welton Pereira</div>
          <div className="flex gap-3"><span className="font-bold w-56">Aprovação Compras &gt; R$ 3.000:</span> Laucídio Cunha Junior</div>
          <div className="flex gap-3"><span className="font-bold w-56">Solicitação de Adiantamento:</span> Qualquer Diretor</div>
          <div className="flex gap-3"><span className="font-bold w-56">Minutas Contratuais:</span> Laucídio Cunha Junior</div>
          <div className="flex gap-3"><span className="font-bold w-56">Autorização de Pagamento:</span> Laucídio Cunha Junior</div>
        </div>
      </section>
    </div>
  )
}
