import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Mail, Briefcase, Building2, Shield, Lock,
  LogOut, Edit3, Check, X, ChevronRight, Eye, EyeOff,
  AlertCircle, CheckCircle, Settings, Code2,
  Volume2, VolumeX, BellRing, ChevronLeft,
} from 'lucide-react'
import {
  useAuth, ROLE_LABEL, ROLE_COLOR, ALCADA_LABEL, MODULOS_ERP, type Role,
} from '../contexts/AuthContext'
import { PasswordStrengthBar } from '../components/SetPasswordModal'
import { useSound } from '../hooks/useSound'
import { usePushNotifications } from '../hooks/usePushNotifications'

// ── Avatar ─────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-violet-500 to-indigo-600',
  'from-indigo-500 to-blue-600',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
]
function avatarColor(nome: string) {
  return AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
}
function initials(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ── Componentes internos ───────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_COLOR[role]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {ROLE_LABEL[role]}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string | null | undefined
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-navy truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

// ── Formulário de edição inline ────────────────────────────────────────────────

interface EditFormData { nome: string; cargo: string; departamento: string }

function EditPerfilModal({
  initial, onSave, onCancel, busy, error,
}: {
  initial: EditFormData
  onSave: (d: EditFormData) => void
  onCancel: () => void
  busy: boolean
  error: string | null
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof EditFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-navy">Editar Perfil</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form) }}
          className="p-5 space-y-4">
          {[
            { key: 'nome' as const,         label: 'Nome completo', placeholder: 'Seu nome', icon: User },
            { key: 'cargo' as const,        label: 'Cargo',         placeholder: 'ex: Analista de Compras', icon: Briefcase },
            { key: 'departamento' as const, label: 'Departamento',  placeholder: 'ex: Suprimentos', icon: Building2 },
          ].map(({ key, label, placeholder, icon: Icon }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                flex items-center justify-center gap-1.5 hover:bg-indigo-500 transition-colors disabled:opacity-60">
              {busy
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check size={14} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Formulário de senha ────────────────────────────────────────────────────────

function SenhaModal({
  onSave, onCancel, busy, error,
}: {
  onSave: (newPass: string) => void
  onCancel: () => void
  busy: boolean
  error: string | null
}) {
  const [newPass,    setNewPass]    = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass.length < 6) { setLocalError('Mínimo 6 caracteres'); return }
    if (newPass !== confirm) { setLocalError('As senhas não coincidem'); return }
    setLocalError(null)
    onSave(newPass)
  }

  const msg = localError || error

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-navy">Trocar Senha</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nova senha</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setLocalError(null) }}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div className="mt-2">
              <PasswordStrengthBar password={newPass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirmar nova senha</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setLocalError(null) }}
                placeholder="Repita a senha"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-slate-50 focus:bg-white"
              />
            </div>
            {confirm && newPass && confirm !== newPass && (
              <p className="text-[11px] text-red-500 mt-1 ml-1">As senhas não coincidem</p>
            )}
          </div>

          {msg && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-3 py-2 text-xs">
              <AlertCircle size={13} /> {msg}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold
                flex items-center justify-center gap-1.5 hover:bg-indigo-500 disabled:opacity-60">
              {busy
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check size={14} /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página Principal ───────────────────────────────────────────────────────────

export default function Perfil() {
  const {
    perfil, role, roleLabel, isAdmin,
    signOut, updatePerfil, updatePassword,
    loading, perfilReady, reloadPerfil,
  } = useAuth()
  const navigate = useNavigate()

  const [editOpen,   setEditOpen]   = useState(false)
  const [senhaOpen,  setSenhaOpen]  = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [editError,  setEditError]  = useState<string | null>(null)
  const [senhaError, setSenhaError] = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)
  const [retrying,   setRetrying]   = useState(false)

  // loading=true → auth ainda inicializando (onAuthStateChange não disparou ainda)
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-xs text-slate-400">Carregando perfil...</p>
    </div>
  )

  // loading=false mas perfil=null → tabela não existe ou sem permissão
  if (!perfil) return (
    <div className="flex flex-col items-center justify-center h-52 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
        <AlertCircle size={24} className="text-amber-500" />
      </div>
      <div>
        <p className="font-bold text-navy text-sm">Perfil não encontrado</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
          Execute o SQL de setup no Supabase ou aguarde a sincronização.
        </p>
      </div>
      <button
        disabled={retrying}
        onClick={async () => {
          setRetrying(true)
          await reloadPerfil()
          setRetrying(false)
        }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold
          hover:bg-indigo-500 transition-colors disabled:opacity-60"
      >
        {retrying
          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : null}
        Tentar novamente
      </button>
    </div>
  )

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSavePerfil = async (data: EditFormData) => {
    setBusy(true); setEditError(null)
    const { error } = await updatePerfil(data)
    setBusy(false)
    if (error) { setEditError(error); return }
    setEditOpen(false)
    showToast('Perfil atualizado com sucesso!')
  }

  const handleSaveSenha = async (newPass: string) => {
    setBusy(true); setSenhaError(null)
    const { error } = await updatePassword(newPass)
    setBusy(false)
    if (error) { setSenhaError(error); return }
    setSenhaOpen(false)
    showToast('Senha alterada com sucesso!')
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold animate-pulse">
          <CheckCircle size={15} /> {toast}
        </div>
      )}

      {/* Modais */}
      {editOpen && (
        <EditPerfilModal
          initial={{ nome: perfil.nome, cargo: perfil.cargo ?? '', departamento: perfil.departamento ?? '' }}
          onSave={handleSavePerfil}
          onCancel={() => { setEditOpen(false); setEditError(null) }}
          busy={busy}
          error={editError}
        />
      )}
      {senhaOpen && (
        <SenhaModal
          onSave={handleSaveSenha}
          onCancel={() => { setSenhaOpen(false); setSenhaError(null) }}
          busy={busy}
          error={senhaError}
        />
      )}

      <div className="space-y-4">

        {/* ── Botão Voltar ── */}
        <button
          onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/')}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ChevronLeft size={14} /> Voltar
        </button>

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-navy via-indigo-900 to-primary" />
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between -mt-10 mb-3">
              {/* Avatar grande */}
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarColor(perfil.nome)}
                flex items-center justify-center border-4 border-white shadow-lg shrink-0`}>
                <span className="text-white text-2xl font-black">{initials(perfil.nome)}</span>
              </div>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
                  text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors mb-1"
              >
                <Edit3 size={12} /> Editar
              </button>
            </div>

            <h1 className="text-xl font-black text-navy leading-tight">{perfil.nome}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {[perfil.cargo, perfil.departamento].filter(Boolean).join(' · ') || 'Sem cargo definido'}
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <RoleBadge role={role} />
              {perfil.alcada_nivel > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full
                  bg-navy/10 text-navy text-xs font-semibold">
                  <Shield size={10} />
                  Alçada N{perfil.alcada_nivel}
                </span>
              )}
              {!perfil.ativo && (
                <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                  Inativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Dados da conta ── */}
        <Section title="Dados da Conta">
          <InfoRow icon={Mail}      label="E-mail"        value={perfil.email} />
          <InfoRow icon={Briefcase} label="Cargo"         value={perfil.cargo} />
          <InfoRow icon={Building2} label="Departamento"  value={perfil.departamento} />
          <InfoRow icon={User}      label="Último acesso" value={fmtDate(perfil.ultimo_acesso)} />
          <InfoRow icon={User}      label="Membro desde"  value={fmtDate(perfil.created_at)} />
        </Section>

        {/* ── Acesso e permissões ── */}
        <Section title="Acesso e Permissões">
          <div className="px-4 py-3 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Shield size={15} className="text-slate-500" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Perfil de Acesso</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={role} />
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-b border-slate-50 last:border-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Alçada de Aprovação</p>
            <p className="text-sm font-medium text-navy">{ALCADA_LABEL[perfil.alcada_nivel]}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Módulos Habilitados</p>
            <div className="flex flex-wrap gap-1.5">
              {MODULOS_ERP.map(({ key, label, icon }) =>
                perfil.modulos?.[key] ? (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                    bg-primary/10 text-primary text-xs font-semibold">
                    <span>{icon}</span> {label}
                  </span>
                ) : (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                    bg-slate-100 text-slate-400 text-xs">
                    <span className="opacity-40">{icon}</span> {label}
                  </span>
                )
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              Permissões gerenciadas pelo administrador
            </p>
          </div>
        </Section>

        {/* ── Segurança ── */}
        <Section title="Segurança">
          <button
            onClick={() => setSenhaOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Lock size={15} className="text-slate-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy">Trocar senha</p>
              <p className="text-xs text-slate-400">Defina uma nova senha de acesso</p>
            </div>
            <ChevronRight size={15} className="text-slate-300" />
          </button>
        </Section>

        {/* ── Preferências do App ── */}
        <Section title="Preferências">
          <SoundToggle />
          <PushToggle />
        </Section>

        {/* ── Admin ── */}
        {isAdmin && (
          <Section title="Administração">
            <button
              onClick={() => navigate('/admin/usuarios')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
            >
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <Settings size={15} className="text-violet-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">Gerenciar Usuários</p>
                <p className="text-xs text-slate-400">Convitar, editar roles e permissões</p>
              </div>
              <ChevronRight size={15} className="text-slate-300" />
            </button>
            <button
              onClick={() => navigate('/admin/desenvolvimento')}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Code2 size={15} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">Desenvolvimento</p>
                <p className="text-xs text-slate-400">Issues, specs AI e task management</p>
              </div>
              <ChevronRight size={15} className="text-slate-300" />
            </button>
          </Section>
        )}

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
            border-2 border-red-200 text-red-600 font-semibold text-sm
            hover:bg-red-50 active:scale-[0.98] transition-all"
        >
          <LogOut size={16} /> Sair da conta
        </button>

        <p className="text-center text-xs text-slate-300 pb-2">
          TEG+ ERP v2.0 · {roleLabel}
        </p>
      </div>
    </>
  )
}

// ── Sound toggle ────────────────────────────────────────────────────────────────
function SoundToggle() {
  const { isMuted, toggleMute, play } = useSound()

  return (
    <button
      onClick={() => { toggleMute(); if (isMuted) setTimeout(() => play('success'), 100) }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMuted ? 'bg-slate-100' : 'bg-teal-100'}`}>
        {isMuted ? <VolumeX size={15} className="text-slate-400" /> : <Volume2 size={15} className="text-teal-600" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">Sons de notificacao</p>
        <p className="text-xs text-slate-400">{isMuted ? 'Desativados' : 'Ativados'}</p>
      </div>
      <div className={`w-10 h-6 rounded-full relative transition-colors ${isMuted ? 'bg-slate-200' : 'bg-teal-500'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isMuted ? 'left-0.5' : 'left-[18px]'}`} />
      </div>
    </button>
  )
}

// ── Push notifications toggle ───────────────────────────────────────────────────
function PushToggle() {
  const { isSupported, isSubscribed, subscribe, unsubscribe, loading } = usePushNotifications()

  if (!isSupported) return null

  const handleToggle = async () => {
    if (isSubscribed) await unsubscribe()
    else await subscribe()
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSubscribed ? 'bg-blue-100' : 'bg-slate-100'}`}>
        <BellRing size={15} className={isSubscribed ? 'text-blue-600' : 'text-slate-400'} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">Notificacoes push</p>
        <p className="text-xs text-slate-400">{isSubscribed ? 'Ativadas — receba alertas mesmo com app fechado' : 'Desativadas'}</p>
      </div>
      <div className={`w-10 h-6 rounded-full relative transition-colors ${isSubscribed ? 'bg-blue-500' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isSubscribed ? 'left-[18px]' : 'left-0.5'}`} />
      </div>
    </button>
  )
}
