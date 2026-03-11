import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Search, ChevronLeft, Shield,
  Check, X, AlertCircle, Mail, RefreshCw,
  CheckCircle, Power, Edit3, ChevronDown, ChevronUp,
  Calendar, Clock, Briefcase, Building2, Eye,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import {
  useAuth,
  type Perfil, type Role,
  ROLE_LABEL, ROLE_COLOR, ALCADA_LABEL, MODULOS_ERP, MODULOS_ERP_GROUPED,
} from '../contexts/AuthContext'

// ── Avatar inline ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]
function Avatar({ nome, size = 'md' }: { nome: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
  const ini = nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  }
  return (
    <div className={`${color} rounded-xl flex items-center justify-center shrink-0 ${sizeClasses[size]}`}>
      <span className="text-white font-extrabold">{ini}</span>
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

// ── Módulo Checkbox Group ────────────────────────────────────────────────────
function ModuloCheckboxGroup({
  modulos,
  onToggle,
  onSetAll,
}: {
  modulos: Record<string, boolean>
  onToggle: (key: string) => void
  onSetAll: (keys: string[], val: boolean) => void
}) {
  const allKeys = MODULOS_ERP.map(m => m.key)
  const selectedCount = allKeys.filter(k => modulos[k]).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Módulos ({selectedCount} de {allKeys.length})
        </label>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onSetAll(allKeys, true)}
            className="text-[10px] font-semibold text-primary hover:underline">Todos</button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={() => onSetAll(allKeys, false)}
            className="text-[10px] font-semibold text-slate-400 hover:underline">Nenhum</button>
        </div>
      </div>
      <div className="space-y-2.5">
        {MODULOS_ERP_GROUPED.map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{group.label}</p>
            <div className="grid grid-cols-2 gap-1">
              {group.modulos.map(({ key, label, icon }) => (
                <label key={key}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-xs
                    ${modulos[key]
                      ? 'bg-primary/8 text-primary font-semibold'
                      : 'text-slate-500 hover:bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    checked={!!modulos[key]}
                    onChange={() => onToggle(key)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
                  />
                  <span className="text-[11px]">{icon}</span>
                  <span className="truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
function usePerfis() {
  return useQuery({
    queryKey: ['perfis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('*')
        .order('nome')
      if (error) throw error
      return data as Perfil[]
    },
    staleTime: 30_000,
    retry: false,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis'] }),
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
      const { error: convErr } = await supabase
        .from('sys_convites')
        .insert({
          email, role, alcada_nivel, modulos,
          nome_sugerido: nome || null,
          convidado_por: myPerfil?.id,
        })
      if (convErr) throw convErr

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/bem-vindo` },
      })
      if (otpErr) throw otpErr
    },
  })
}

// ── Expanded User Detail + Inline Edit ────────────────────────────────────────
function UserDetailPanel({
  user, onClose,
}: { user: Perfil; onClose: () => void }) {
  const update = useUpdateUser()
  const [editing, setEditing] = useState(false)
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
    setTimeout(() => { setSuccess(false); setEditing(false) }, 1200)
  }

  const handleCancel = () => {
    setRole(user.role)
    setAlcada(user.alcada_nivel)
    setAtivo(user.ativo)
    setModulos(user.modulos ?? {})
    setEditing(false)
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div className="border-t border-slate-100 bg-slate-50/50">
      {/* User info section */}
      <div className="px-4 py-4 space-y-3">
        {/* Basic Info Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Mail size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Briefcase size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.cargo || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Building2 size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600 truncate">{user.departamento || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Shield size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-600">{ALCADA_LABEL[user.alcada_nivel]}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Desde: </span>
            <span className="text-slate-600">{fmtDate(user.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span className="text-slate-400">Acesso: </span>
            <span className="text-slate-600">{fmtDate(user.ultimo_acesso)}</span>
          </div>
        </div>

        {/* Módulos atuais */}
        {!editing && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Módulos ({MODULOS_ERP.filter(m => user.modulos?.[m.key]).length} de {MODULOS_ERP.length})
            </p>
            <div className="flex gap-1 flex-wrap">
              {MODULOS_ERP.map(({ key, label, icon }) => (
                <span key={key} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  user.modulos?.[key]
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 text-slate-300'
                }`}>
                  <span className="text-[9px]">{icon}</span> {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Senha definida status */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${user.senha_definida ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className="text-slate-500">
            {user.senha_definida ? 'Senha definida' : 'Senha pendente (magic link)'}
          </span>
        </div>
      </div>

      {/* Action bar or Edit form */}
      {!editing ? (
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setEditing(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-indigo-500 active:scale-[0.98] transition-all">
            <Edit3 size={12} /> Editar Permissões
          </button>
          <button onClick={async () => {
            await update.mutateAsync({ id: user.id, ativo: !user.ativo })
          }}
            disabled={update.isPending}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all
              ${user.ativo
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}>
            <Power size={12} /> {user.ativo ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          {/* Role */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Perfil de Acesso
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => {
                const c = ROLE_COLOR[r]
                return (
                  <button key={r} onClick={() => setRole(r)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border-2 text-left transition-all text-xs font-semibold
                      ${role === r ? `${c.bg} ${c.text} border-current` : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {ROLE_LABEL[r]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Alçada */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Alçada de Aprovação
            </label>
            <div className="grid grid-cols-1 gap-1">
              {([0, 1, 2, 3, 4] as const).map(n => (
                <button key={n} onClick={() => setAlcada(n)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all
                    ${alcada === n ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}>
                  <Shield size={12} />
                  <span className="text-xs font-semibold">{ALCADA_LABEL[n]}</span>
                  {alcada === n && <Check size={12} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <ModuloCheckboxGroup
            modulos={modulos}
            onToggle={toggleMod}
            onSetAll={(keys, val) => setModulos(m => {
              const next = { ...m }
              keys.forEach(k => { next[k] = val })
              return next
            })}
          />

          {/* Ativo/inativo */}
          <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-navy">Conta ativa</p>
              <p className="text-[10px] text-slate-400">Usuário pode fazer login</p>
            </div>
            <button onClick={() => setAtivo(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${ativo ? 'bg-green-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${ativo ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Error */}
          {update.isError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={12} /> Erro ao salvar. Tente novamente.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={update.isPending || success}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs
                flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60 transition-all">
              {success
                ? <><CheckCircle size={13} /> Salvo!</>
                : update.isPending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Check size={13} /> Salvar alterações</>}
            </button>
          </div>
        </div>
      )}
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
            <ModuloCheckboxGroup
              modulos={form.modulos}
              onToggle={toggleMod}
              onSetAll={(keys, val) => setForm(f => {
                const next = { ...f.modulos }
                keys.forEach(k => { next[k] = val })
                return { ...f, modulos: next }
              })}
            />

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

  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState<Role | 'todos'>('todos')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [showConvite,  setShowConvite]  = useState(false)

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

  const stats = useMemo(() => {
    if (!perfis) return {}
    return perfis.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  }, [perfis])

  const toggleExpand = (id: string) =>
    setExpandedUser(prev => prev === id ? null : id)

  return (
    <>
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
            {filtered.map(p => {
              const isExpanded = expandedUser === p.id
              return (
                <div key={p.id} className={`bg-white rounded-2xl shadow-card overflow-hidden transition-all ${!p.ativo ? 'opacity-60' : ''}`}>
                  {/* Card header - clickable */}
                  <button
                    onClick={() => toggleExpand(p.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <Avatar nome={p.nome} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-navy truncate">{p.nome}</p>
                        {!p.ativo && <span className="text-[10px] bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-semibold">Inativo</span>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{p.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <RoleBadge role={p.role} />
                        {p.alcada_nivel > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-navy/10 text-navy text-[10px] font-semibold">
                            <Shield size={9} /> N{p.alcada_nivel}
                          </span>
                        )}
                        {p.modulos && (
                          <span className="text-[10px] text-slate-400">
                            {Object.values(p.modulos).filter(Boolean).length} módulos
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isExpanded ? 'bg-primary/10 text-primary' : 'text-slate-300'
                    }`}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <UserDetailPanel
                      user={p}
                      onClose={() => setExpandedUser(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
