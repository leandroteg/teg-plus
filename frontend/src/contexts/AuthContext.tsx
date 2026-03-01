import {
  createContext, useContext, useEffect, useState,
  useCallback, ReactNode,
} from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type Role =
  | 'admin' | 'gerente' | 'aprovador'
  | 'comprador' | 'requisitante' | 'visitante'

export const ROLE_LABEL: Record<Role, string> = {
  admin:        'Administrador',
  gerente:      'Gerente',
  aprovador:    'Aprovador',
  comprador:    'Comprador',
  requisitante: 'Requisitante',
  visitante:    'Visitante',
}

export const ROLE_COLOR: Record<Role, { bg: string; text: string; dot: string }> = {
  admin:        { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  gerente:      { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  aprovador:    { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  comprador:    { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  requisitante: { bg: 'bg-sky-100',    text: 'text-sky-700',    dot: 'bg-sky-500'    },
  visitante:    { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400'  },
}

// Hierarquia numérica: quanto maior, mais acesso
export const ROLE_NIVEL: Record<Role, number> = {
  admin: 5, gerente: 4, aprovador: 3,
  comprador: 2, requisitante: 1, visitante: 0,
}

export const ALCADA_LABEL: Record<number, string> = {
  0: 'Sem alçada',
  1: 'Coordenador (até R$ 5.000)',
  2: 'Gerente (até R$ 25.000)',
  3: 'Diretor (até R$ 100.000)',
  4: 'CEO (sem limite)',
}

export interface Perfil {
  id: string
  auth_id: string
  nome: string
  email: string
  cargo: string | null
  departamento: string | null
  avatar_url: string | null
  role: Role
  alcada_nivel: number
  modulos: Record<string, boolean>
  preferencias: Record<string, unknown>
  ativo: boolean
  ultimo_acesso: string | null
  created_at: string
  updated_at: string
}

// Módulos do ERP (extensível)
export const MODULOS_ERP = [
  { key: 'compras',     label: 'Compras',     icon: '🛒' },
  { key: 'financeiro',  label: 'Financeiro',  icon: '💰' },
  { key: 'rh',          label: 'RH',          icon: '👥' },
  { key: 'ssma',        label: 'SSMA',        icon: '⛑️' },
  { key: 'estoque',     label: 'Estoque',     icon: '📦' },
  { key: 'contratos',   label: 'Contratos',   icon: '📋' },
]

// ── Context ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  // Estado
  user: User | null
  perfil: Perfil | null
  session: Session | null
  loading: boolean

  // Ações de auth
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>

  // Ações de perfil
  updatePerfil: (data: Partial<Pick<Perfil, 'nome' | 'cargo' | 'departamento'>>) => Promise<{ error: string | null }>
  reloadPerfil: () => Promise<void>

  // Helpers de permissão (uso nos componentes)
  role: Role
  roleLabel: string
  isAdmin: boolean
  isGerente: boolean       // gerente ou acima
  canManage: boolean       // pode gerenciar usuários
  hasModule: (mod: string) => boolean
  canApprove: (nivel: number) => boolean
  atLeast: (role: Role) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil,  setPerfil]  = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  // Carrega perfil do Supabase
  const loadPerfil = useCallback(async (authId: string) => {
    const { data, error } = await supabase
      .from('sys_perfis')
      .select('*')
      .eq('auth_id', authId)
      .single()

    if (!error && data) {
      setPerfil(data as Perfil)
      // Registra acesso em background (sem await para não bloquear UI)
      supabase.rpc('registrar_acesso', { p_auth_id: authId })
    }
  }, [])

  const reloadPerfil = useCallback(async () => {
    if (user?.id) await loadPerfil(user.id)
  }, [user, loadPerfil])

  // Inicializa sessão e ouve mudanças
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadPerfil(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadPerfil(session.user.id)
        } else {
          setPerfil(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [loadPerfil])

  // ── Auth actions ─────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? translateError(error.message) : null }
  }

  const signInMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error ? translateError(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setPerfil(null)
    setUser(null)
    setSession(null)
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    return { error: error ? translateError(error.message) : null }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? translateError(error.message) : null }
  }

  // ── Perfil actions ───────────────────────────────────────────────

  const updatePerfil = async (
    data: Partial<Pick<Perfil, 'nome' | 'cargo' | 'departamento'>>
  ) => {
    if (!user) return { error: 'Não autenticado' }
    const { data: updated, error } = await supabase
      .from('sys_perfis')
      .update(data)
      .eq('auth_id', user.id)
      .select()
      .single()
    if (error) return { error: error.message }
    setPerfil(updated as Perfil)
    return { error: null }
  }

  // ── Permission helpers ───────────────────────────────────────────

  const role: Role = perfil?.role ?? 'visitante'

  const value: AuthContextType = {
    user,
    perfil,
    session,
    loading,
    signIn,
    signInMagicLink,
    signOut,
    resetPassword,
    updatePassword,
    updatePerfil,
    reloadPerfil,
    role,
    roleLabel: ROLE_LABEL[role],
    isAdmin:    role === 'admin',
    isGerente:  ROLE_NIVEL[role] >= ROLE_NIVEL['gerente'],
    canManage:  role === 'admin',
    hasModule:  (mod) => perfil?.modulos?.[mod] === true,
    canApprove: (nivel) => (perfil?.alcada_nivel ?? 0) >= nivel,
    atLeast:    (r) => ROLE_NIVEL[role] >= ROLE_NIVEL[r],
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook público ───────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

// ── Traduções de erros do Supabase ─────────────────────────────────────────────

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))  return 'E-mail ou senha incorretos'
  if (msg.includes('Email not confirmed'))         return 'Confirme seu e-mail antes de entrar'
  if (msg.includes('Too many requests'))           return 'Muitas tentativas. Aguarde um momento'
  if (msg.includes('User already registered'))     return 'Este e-mail já está cadastrado'
  if (msg.includes('Email rate limit exceeded'))   return 'Limite de e-mails atingido. Tente mais tarde'
  if (msg.includes('Password should be'))         return 'A senha deve ter pelo menos 6 caracteres'
  if (msg.includes('New password should be'))     return 'A nova senha deve ter pelo menos 6 caracteres'
  if (msg.includes('same password'))              return 'A nova senha deve ser diferente da atual'
  return msg
}
