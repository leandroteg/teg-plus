import {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, ReactNode,
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
  senha_definida: boolean
  ultimo_acesso: string | null
  created_at: string
  updated_at: string
}

export interface ModuloERP {
  key: string
  label: string
  icon: string
}

export interface GrupoModulos {
  label: string
  modulos: ModuloERP[]
}

export const MODULOS_ERP_GROUPED: GrupoModulos[] = [
  {
    label: 'Projetos',
    modulos: [
      { key: 'egp',    label: 'EGP',    icon: '📊' },
      { key: 'obras',  label: 'Obras',  icon: '🏗️' },
      { key: 'ssma',   label: 'SSMA',   icon: '⛑️' },
    ],
  },
  {
    label: 'Suprimentos',
    modulos: [
      { key: 'compras',    label: 'Compras',    icon: '🛒' },
      { key: 'logistica',  label: 'Logística',  icon: '🚚' },
      { key: 'estoque',    label: 'Estoque',    icon: '📦' },
      { key: 'patrimonial',label: 'Patrimonial',icon: '🏛️' },
      { key: 'frotas',     label: 'Frotas',     icon: '🚛' },
    ],
  },
  {
    label: 'Backoffice',
    modulos: [
      { key: 'financeiro',    label: 'Financeiro',    icon: '💰' },
      { key: 'fiscal',        label: 'Fiscal',        icon: '🧾' },
      { key: 'controladoria', label: 'Controladoria', icon: '📈' },
      { key: 'contratos',     label: 'Contratos',     icon: '📋' },
      { key: 'cadastros',     label: 'Cadastros',     icon: '⚙️' },
    ],
  },
  {
    label: 'RH',
    modulos: [
      { key: 'rh', label: 'RH', icon: '👥' },
    ],
  },
]

// Flat array derivado (backward compat)
export const MODULOS_ERP: ModuloERP[] = MODULOS_ERP_GROUPED.flatMap(g => g.modulos)

// ── Context ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  session: Session | null
  loading: boolean
  perfilReady: boolean

  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>

  updatePerfil: (data: Partial<Pick<Perfil, 'nome' | 'cargo' | 'departamento'>>) => Promise<{ error: string | null }>
  reloadPerfil: () => Promise<void>
  markSenhaDefinida: () => Promise<{ error: string | null }>

  pendingPasswordReset: boolean
  clearPasswordReset: () => void

  role: Role
  roleLabel: string
  isAdmin: boolean
  isGerente: boolean
  canManage: boolean
  hasModule: (mod: string) => boolean
  canApprove: (nivel: number) => boolean
  atLeast: (role: Role) => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [session,     setSession]     = useState<Session | null>(null)
  const [perfil,      setPerfil]      = useState<Perfil | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [perfilReady, setPerfilReady] = useState(false)
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false)

  // Guard: evita chamadas concorrentes a loadPerfil
  const loadingRef    = useRef(false)
  // Rastreia se o usuário foi autenticado e se o perfil carregou com sucesso
  // (usados no safety net para detectar lock travado do Supabase)
  const userRef        = useRef<User | null>(null)
  const perfilLoadedRef = useRef(false)

  // ── loadPerfil ───────────────────────────────────────────────────
  // Busca perfil do DB. Se não existir, tenta criar (auto-provisionamento).
  // Se sessão inválida (user deletado), força logout.
  const loadPerfil = useCallback(async (authId: string) => {
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      const { data, error } = await supabase
        .from('sys_perfis')
        .select('*')
        .eq('auth_id', authId)
        .single()

      if (data) {
        setPerfil(data as Perfil)
        perfilLoadedRef.current = true
        supabase.rpc('registrar_acesso', { p_auth_id: authId })
        return
      }

      // PGRST116 = nenhuma linha encontrada → tenta criar perfil
      if (error?.code === 'PGRST116') {
        // Verifica se a sessão ainda é válida (servidor)
        const { data: { user: authUser }, error: sessErr } = await supabase.auth.getUser()

        if (sessErr || !authUser) {
          // Sessão inválida (user foi deletado) → limpa localmente e redireciona
          await supabase.auth.signOut()
          return
        }

        const email = authUser.email ?? ''
        const nome  = (authUser.user_metadata?.full_name as string)
          || (authUser.user_metadata?.nome as string)
          || email.split('@')[0]

        const { data: criado } = await supabase
          .from('sys_perfis')
          .insert({ auth_id: authId, nome, email })
          .select()
          .single()

        if (criado) {
          setPerfil(criado as Perfil)
          perfilLoadedRef.current = true
        }
      }
      // Outros erros (tabela não criada etc.) → perfil null, sem crash
    } catch {
      // Silencioso
    } finally {
      loadingRef.current = false
      setPerfilReady(true)
    }
  }, [])

  const reloadPerfil = useCallback(async () => {
    setPerfilReady(false)
    if (user?.id) await loadPerfil(user.id)
  }, [user, loadPerfil])

  // ── Inicialização: ÚNICO source of truth = onAuthStateChange ────
  //
  // REGRA CRÍTICA: o callback NÃO pode ser async!
  // O GoTrueClient do Supabase usa um lock interno para serializar eventos.
  // Se o callback for async e fizer await (ex: await loadPerfil), o lock
  // fica preso até o await resolver — impedindo qualquer novo evento
  // (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) de ser processado.
  // Isso causa deadlock quando: token expira → refresh trava → signOut trava.
  //
  // Solução: callback síncrono + loadPerfil fire-and-forget com .finally().
  useEffect(() => {
    perfilLoadedRef.current = false
    userRef.current = null

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        userRef.current = session?.user ?? null

        // Detecta redirecionamento de recovery link
        if (_event === 'PASSWORD_RECOVERY') {
          setPendingPasswordReset(true)
        }

        if (session?.user) {
          // Reset mutex — chamada anterior pode ter travado sem resetar
          loadingRef.current = false
          loadPerfil(session.user.id).finally(() => setLoading(false))
        } else {
          setPerfil(null)
          setPerfilReady(true)
          setLoading(false)
        }
      }
    )

    // Safety net: se após 4s o perfil não carregou, força estado limpo.
    // Cenários: rede lenta, Supabase fora, token refresh loop.
    const safety = setTimeout(() => {
      if (userRef.current && !perfilLoadedRef.current) {
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setUser(null)
        setSession(null)
        setPerfil(null)
      }
      loadingRef.current = false
      setLoading(false)
      setPerfilReady(true)
    }, 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safety)
    }
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
    // onAuthStateChange(SIGNED_OUT) vai limpar o resto
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

  const clearPasswordReset = () => setPendingPasswordReset(false)

  const markSenhaDefinida = async () => {
    if (!user) return { error: 'Não autenticado' }
    const { error } = await supabase
      .from('sys_perfis')
      .update({ senha_definida: true })
      .eq('auth_id', user.id)
    if (error) return { error: error.message }
    setPerfil(prev => prev ? { ...prev, senha_definida: true } : prev)
    return { error: null }
  }

  // ── Permission helpers ───────────────────────────────────────────

  const role: Role = perfil?.role ?? 'visitante'

  const value: AuthContextType = {
    user,
    perfil,
    session,
    loading,
    perfilReady,
    signIn,
    signInMagicLink,
    signOut,
    resetPassword,
    updatePassword,
    updatePerfil,
    reloadPerfil,
    markSenhaDefinida,
    pendingPasswordReset,
    clearPasswordReset,
    role,
    roleLabel:  ROLE_LABEL[role],
    isAdmin:    role === 'admin',
    isGerente:  ROLE_NIVEL[role] >= ROLE_NIVEL['gerente'],
    canManage:  role === 'admin',
    hasModule:  (mod) => {
      if (perfil?.modulos?.[mod] === true) return true
      if (mod === 'patrimonial') return perfil?.modulos?.estoque === true
      return false
    },
    canApprove: (nivel) => role === 'admin' || (perfil?.alcada_nivel ?? 0) >= nivel,
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
  if (msg.includes('Password should be'))          return 'A senha deve ter pelo menos 6 caracteres'
  if (msg.includes('New password should be'))      return 'A nova senha deve ter pelo menos 6 caracteres'
  if (msg.includes('same password'))               return 'A nova senha deve ser diferente da atual'
  return msg
}
