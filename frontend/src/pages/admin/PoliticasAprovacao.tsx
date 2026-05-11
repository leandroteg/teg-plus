// ─────────────────────────────────────────────────────────────────────────────
// pages/admin/PoliticasAprovacao.tsx
// Configura por categoria: validador técnico, aprovador alçada 1, limite e
// aprovador alçada 2. Salva inline ao editar cada campo.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Loader2, Check, Save } from 'lucide-react'
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

  const cardCls = isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
  const txt = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'
  const inputCls = `w-full px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white [&>option]:bg-slate-900'
  }`
  const thCls = `text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${txtMuted}`

  if (!isAdmin) {
    return <div className={`p-6 rounded-2xl ${cardCls}`}><p className={`text-sm ${txt}`}>Acesso restrito a administradores.</p></div>
  }

  function renderSavedIndicator(c: CategoriaPolitica, field: string) {
    const key = `${c.id}-${field}`
    if (salvouId === key) return <Check size={11} className="text-emerald-500 inline ml-1" />
    if (salvar.isPending && salvar.variables?.id === c.id && salvar.variables?.field === field) {
      return <Loader2 size={11} className="animate-spin text-slate-400 inline ml-1" />
    }
    return null
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-xl font-extrabold ${txt} flex items-center gap-2`}>
          <Shield size={20} className="text-rose-500" />
          Políticas de Aprovação por Categoria
        </h1>
        <p className={`text-xs mt-1 ${txtMuted}`}>
          Configura quem valida tecnicamente e quem aprova financeiramente cada categoria. Mudanças entram em vigor imediatamente.
        </p>
      </div>

      <section className={`rounded-2xl p-4 ${cardCls}`}>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                  <th className={thCls}>Categoria</th>
                  <th className={thCls}>Validação Técnica</th>
                  <th className={thCls}>Aprovação Alçada 1</th>
                  <th className={thCls + ' w-[130px]'}>Limite Alçada 1</th>
                  <th className={thCls}>Aprovação Alçada 2</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(c => (
                  <tr key={c.id} className={`border-t ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}>
                    <td className={`px-3 py-2 ${txt}`}>
                      <p className="font-semibold">{c.nome}</p>
                      <p className={`text-[10px] font-mono ${txtMuted}`}>{c.codigo}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={inputCls}
                        value={c.validador_tecnico_id ?? ''}
                        onChange={e => handleSelectChange(c, 'validador_tecnico_id', e.target.value)}
                      >
                        <option value="">— Sem validador —</option>
                        {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      {renderSavedIndicator(c, 'validador_tecnico_id')}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={inputCls}
                        value={c.alcada1_aprovador_id ?? ''}
                        onChange={e => handleSelectChange(c, 'alcada1_aprovador_id', e.target.value)}
                      >
                        <option value="">— Sem aprovador —</option>
                        {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      {renderSavedIndicator(c, 'alcada1_aprovador_id')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${inputCls} text-right`}
                          value={limiteDraft[c.id] ?? fmtBRL(c.alcada1_limite ?? 0)}
                          onChange={e => setLimiteDraft({ ...limiteDraft, [c.id]: e.target.value })}
                          onFocus={() => setLimiteDraft({ ...limiteDraft, [c.id]: String(c.alcada1_limite ?? 0) })}
                          onBlur={() => { handleLimiteBlur(c); setLimiteDraft(d => { const n = { ...d }; delete n[c.id]; return n }) }}
                        />
                        {renderSavedIndicator(c, 'alcada1_limite')}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={inputCls}
                        value={c.alcada2_aprovador_id ?? ''}
                        onChange={e => handleSelectChange(c, 'alcada2_aprovador_id', e.target.value)}
                      >
                        <option value="">— Sem aprovador —</option>
                        {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                      {renderSavedIndicator(c, 'alcada2_aprovador_id')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={`text-[11px] mt-3 flex items-center gap-1 ${txtMuted}`}>
          <Save size={11} /> Salvamento automático ao editar cada campo
        </p>
      </section>

      <section className={`rounded-2xl p-4 ${cardCls}`}>
        <h2 className={`text-sm font-bold mb-2 ${txt}`}>Políticas Globais (somente leitura)</h2>
        <p className={`text-xs mb-3 ${txtMuted}`}>
          Tipos de aprovação que NÃO dependem de categoria. Para alterar, é necessário deploy.
        </p>
        <div className={`text-xs space-y-1.5 ${txt}`}>
          <div className="flex gap-3"><span className="font-bold w-56">Solicitação de Adiantamento:</span> Qualquer Diretor</div>
          <div className="flex gap-3"><span className="font-bold w-56">Minutas Contratuais:</span> Laucídio Cunha Junior</div>
          <div className="flex gap-3"><span className="font-bold w-56">Autorização de Pagamento:</span> Laucídio Cunha Junior</div>
          <div className="flex gap-3"><span className="font-bold w-56">Aprovação de Transporte:</span> Qualquer Diretor (provisório)</div>
        </div>
      </section>
    </div>
  )
}
