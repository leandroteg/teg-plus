import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Search, ChevronLeft, Shield,
  Check, X, AlertCircle, Mail, RefreshCw, MoreVertical,
  CheckCircle, Power, Edit3,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import {
  useAuth,
  type Perfil, type Role,
  ROLE_LABEL, ROLE_COLOR, ALCADA_LABEL, MODULOS_ERP,
} from '../contexts/AuthContext'

// ── Avatar inline ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]
function Avatar({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' }) {
  const color = AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
  const ini = nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className={`${color} rounded-xl flex items-center justify-center shrink-0 ${
      size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    }`}>
      <span className={`text-white font-extrabold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{ini}</span>
    </div>
  )
}

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_COLOR[role]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {ROLE_LABEL[role]}
    </span>
  )
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
function usePerfis() {
  return useQuery({
    queryKey: ['sys_perfis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Perfil[]
    },
    staleTime: 30_000,
  })
}

function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Perfil> & { id: string }) => {
      const { id, ...data } = payload
      const { data: updated, error } = await supabase
        .from('sys_perfis')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return updated as Perfil
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sys_perfis'] }),
  })
}

function useConvidarUsuario() {
  const { perfil: myPerfil } = useAuth()
  return useMutation({
    mutationFn: async ({
      email, nome, role, alcada_nivel, modulos,
    }: {
      email: string; nome: string; role: Role
      alcada_nivel: number; modulos: Record<string, boolean>
    }) => {
      // 1. Salva convite pré-configurado
      const { error: convErr } = await supabase
        .from('sys_convites')
        .insert({
          email, role, alcada_nivel, modulos,
          nome_sugerido: nome || null,
          convidado_por: myPerfil?.id,
        })
      if (convErr) throw convErr

      // 2. Envia magic link (cria usuário se não existir)
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (otpErr) throw otpErr
    },
  })
}

// ── Modal: Editar usuário ──────────────────────────────────────────────────────
function EditModal({
  user, onClose,
}: { user: Perfil; onClose: () => void }) {
  const update = useUpdateUser()
  const [role,    setRole]    = useState<Role>(user.role)
  const [alcada,  setAlcada]  = useState(user.alcada_nivel)
  const [ativo,   setAtivo]   = useState(user.ativo)
  const [modulos, setModulos] = useState<Record<string, boolean>>(user.modulos ?? {})
  const [success, setSuccess] = useState(false)

  const toggleMod = (key: string) =>
    setModulos(m => ({ ...m, [key]: !m[key] }))

  const handleSave = async () => {
    await update.mutateAsync({ id: user.id, role, alcada_nivel: alcada, ativo, modulos })
    setSuccess(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Avatar nome={user.nome} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy text-sm truncate">{user.nome}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Perfil de Acesso
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => {
                const c = ROLE_COLOR[r]
                return (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all text-sm font-semibold
                      ${role === r ? `${c.bg} ${c.text} border-current` : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    {ROLE_LABEL[r]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Alçada */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Alçada de Aprovação
            </label>
            <div className="space-y-1">
              {([0, 1, 2, 3, 4] as const).map(n => (
                <button key={n} onClick={() => setAlcada(n)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-left transition-all
                    ${alcada === n ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}>
                  <Shield size={13} />
                  <span className="text-sm font-semibold">{ALCADA_LABEL[n]}</span>
                  {alcada === n && <Check size={13} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Módulos Habilitados
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {MODULOS_ERP.map(({ key, label, icon }) => (
                <button key={key} onClick={() => toggleMod(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                    ${modulos[key] ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                  <span>{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {modulos[key] && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          {/* Ativo/inativo */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-navy">Conta ativa</p>
              <p className="text-xs text-slate-400">Usuário pode fazer login</p>
            </div>
            <button onClick={() => setAtivo(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${ativo ? 'bg-green-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Error */}
          {update.isError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={13} /> Erro ao salvar. Tente novamente.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
          <button onClick={handleSave} disabled={update.isPending || success}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm
              flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-60">
            {success
              ? <><CheckCircle size={15} /> Salvo!</>
              : update.isPending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check size={15} /> Salvar alterações</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Convidar usuário ────────────────────────────────────────────────────
function ConviteModal({ onClose }: { onClose: () => void }) {
  const convidar = useConvidarUsuario()
  const [form, setForm] = useState({
    email: '', nome: '', role: 'requisitante' as Role,
    alcada_nivel: 0,
    modulos: { compras: true } as Record<string, boolean>,
  })
  const [success, setSuccess] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleMod = (key: string) =>
    setForm(f => ({ ...f, modulos: { ...f.modulos, [key]: !f.modulos[key] } }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await convidar.mutateAsync(form)
    setSuccess(true)
    setTimeout(onClose, 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus size={15} className="text-primary" />
            </div>
            <h3 className="font-bold text-navy">Convidar Usuário</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="font-bold text-navy">Convite enviado!</p>
            <p className="text-sm text-slate-500">O usuário receberá um link de acesso por e-mail.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Email + nome */}
            {[
              { key: 'email', label: 'E-mail', type: 'email', placeholder: 'usuario@teguniao.com.br' },
              { key: 'nome',  label: 'Nome (opcional)', type: 'text', placeholder: 'Nome completo' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, unknown>)[key] as string}
                  onChange={set(key)}
                  placeholder={placeholder}
                  required={key === 'email'}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
                />
              </div>
            ))}

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Perfil de acesso</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
              >
                {(Object.entries(ROLE_LABEL) as [Role, string][]).map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
              </select>
            </div>

            {/* Alçada */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Alçada de aprovação</label>
              <select
                value={form.alcada_nivel}
                onChange={e => setForm(f => ({ ...f, alcada_nivel: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50"
              >
                {[0, 1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{ALCADA_LABEL[n]}</option>
                ))}
              </select>
            </div>

            {/* Módulos */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Módulos habilitados</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULOS_ERP.map(({ key, label, icon }) => (
                  <button key={key} type="button" onClick={() => toggleMod(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all
                      ${form.modulos[key] ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-500'}`}>
                    <span>{icon}</span>
                    <span className="flex-1 text-left">{label}</span>
                    {form.modulos[key] && <Check size={11} />}
                  </button>
                ))}
              </div>
            </div>

            {convidar.isError && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
                <AlertCircle size={13} /> Erro ao enviar convite. Verifique o e-mail.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">
                Cancelar
              </button>
              <button type="submit" disabled={convidar.isPending}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                  flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60">
                {convidar.isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Mail size={14} /> Enviar convite</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Página Principal ───────────────────────────────────────────────────────────
export default function AdminUsuarios() {
  const navigate = useNavigate()
  const { data: perfis, isLoading, refetch, isFetching } = usePerfis()
  const update = useUpdateUser()

  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState<Role | 'todos'>('todos')
  const [editUser,    setEditUser]    = useState<Perfil | null>(null)
  const [showConvite, setShowConvite] = useState(false)
  const [menuOpen,    setMenuOpen]    = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!perfis) return []
    return perfis.filter(p => {
      const matchSearch = !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())
      const matchRole = filterRole === 'todos' || p.role === filterRole
      return matchSearch && matchRole
    })
  }, [perfis, search, filterRole])

  const toggleAtivo = async (p: Perfil) => {
    await update.mutateAsync({ id: p.id, ativo: !p.ativo })
  }

  const stats = useMemo(() => {
    if (!perfis) return {}
    return perfis.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [perfis])

  return (
    <>
      {editUser    && <EditModal    user={editUser}       onClose={() => setEditUser(null)} />}
      {showConvite && <ConviteModal onClose={() => { setShowConvite(false); refetch() }} />}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/perfil')}
            className="w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-500 hover:text-navy">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-navy leading-tight">Usuários</h1>
            <p className="text-xs text-slate-400">{perfis?.length ?? 0} contas · {perfis?.filter(p => p.ativo).length ?? 0} ativas</p>
          </div>
          <button
            onClick={() => refetch()}
            className={`w-8 h-8 rounded-lg bg-white shadow-card flex items-center justify-center text-slate-400 hover:text-primary ${isFetching ? 'animate-spin' : ''}`}>
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowConvite(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg hover:bg-indigo-500 active:scale-95 transition-all">
            <UserPlus size={14} /> Convidar
          </button>
        </div>

        {/* Stats de roles */}
        <div className="grid grid-cols-3 gap-2">
          {(['admin', 'comprador', 'requisitante'] as Role[]).map(r => {
            const c = ROLE_COLOR[r]
            return (
              <div key={r} className={`rounded-xl p-3 ${c.bg}`}>
                <p className={`text-xl font-black ${c.text}`}>{stats[r] ?? 0}</p>
                <p className={`text-xs font-semibold ${c.text} opacity-80`}>{ROLE_LABEL[r]}</p>
              </div>
            )
          })}
        </div>

        {/* Busca + filtro */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(['todos', ...Object.keys(ROLE_LABEL)] as (Role | 'todos')[]).map(r => (
              <button key={r} onClick={() => setFilterRole(r)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                  ${filterRole === r
                    ? 'bg-primary text-white shadow'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-primary/40'}`}>
                {r === 'todos' ? 'Todos' : ROLE_LABEL[r as Role]}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de usuários */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl shadow-card overflow-hidden transition-opacity ${!p.ativo ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <Avatar nome={p.nome} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-navy truncate">{p.nome}</p>
                      {!p.ativo && <span className="text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">Inativo</span>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{p.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <RoleBadge role={p.role} />
                      {p.alcada_nivel > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-navy/10 text-navy text-[10px] font-semibold">
                          <Shield size={9} /> N{p.alcada_nivel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                      <MoreVertical size={15} />
                    </button>
                    {menuOpen === p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-40">
                          <button onClick={() => { setEditUser(p); setMenuOpen(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <Edit3 size={13} /> Editar permissões
                          </button>
                          <button onClick={() => { toggleAtivo(p); setMenuOpen(null) }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50
                              ${p.ativo ? 'text-red-600' : 'text-green-600'}`}>
                            <Power size={13} /> {p.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Módulos */}
                {p.modulos && Object.values(p.modulos).some(Boolean) && (
                  <div className="px-4 pb-3 flex gap-1 flex-wrap">
                    {MODULOS_ERP.filter(m => p.modulos?.[m.key]).map(({ key, label, icon }) => (
                      <span key={key} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/8 text-primary text-[10px] font-semibold">
                        <span className="text-[9px]">{icon}</span> {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
