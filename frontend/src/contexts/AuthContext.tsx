import {
  createContext, useContext, useEffect, useState,
  useCallback, useRef, ReactNode,
} from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export type PapelGlobal =
  | 'requisitante'
  | 'equipe'
  | 'supervisor'
  | 'diretor'
  | 'ceo'

export type Role =
  | 'administrador'
  | 'diretor'
  | 'gestor'
  | 'requisitante'
  | 'visitante'
  | 'equipe'
  | 'supervisor'
  | 'ceo'
  | 'admin'
  | 'gerente'
  | 'aprovador'
  | 'comprador'

export interface PerfilSetor {
  id: string
  setor_id: string
  setor_codigo: string
  setor_nome: string
  modulo_key: string
  papel: PapelGlobal
  aprovador_tecnico: boolean
  ativo: boolean
}

const PAPEL_LABEL: Record<PapelGlobal, string> = {
  requisitante: 'Requisitante',
  equipe: 'Equipe',
  supervisor: 'Supervisor',
  diretor: 'Diretor',
  ceo: 'CEO',
}

export const ROLE_LABEL: Record<Role, string> = {
  administrador: 'Administrador',
  diretor: 'Diretor',
  gestor: 'Gestor',
  requisitante: 'Requisitante',
  visitante: 'Visitante',
  equipe: 'Equipe',
  supervisor: 'Supervisor',
  ceo: 'CEO',
  admin: 'Administrador',
  gerente: 'Diretor',
  aprovador: 'Supervisor',
  comprador: 'Equipe',
}

export const ROLE_COLOR: Record<Role, { bg: string; text: string; dot: string }> = {
  administrador: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  diretor: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  gestor: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  requisitante: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  visitante: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  equipe: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  supervisor: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  ceo: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  admin: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  gerente: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  aprovador: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  comprador: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
}

export const ROLE_NIVEL: Record<string, number> = {
  ceo: 7,
  administrador: 6, admin: 6,
  diretor: 5, gerente: 5,
  supervisor: 4, aprovador: 4,
  gestor: 3, equipe: 3, comprador: 3,
  requisitante: 2,
  visitante: 1,
}

const PAPEL_TO_LEGACY_ROLE: Record<PapelGlobal, Role> = {
  requisitante: 'requisitante',
  equipe: 'gestor',
  supervisor: 'gestor',
  diretor: 'diretor',
  ceo: 'administrador',
}

function mapLegacyRoleToPapel(role?: string | null): PapelGlobal {
  switch ((role ?? '').toLowerCase()) {
    case 'ceo':
      return 'ceo'
    case 'diretor':
    case 'gerente':
      return 'diretor'
    case 'supervisor':
    case 'aprovador':
      return 'supervisor'
    case 'equipe':
    case 'comprador':
    case 'gestor':
      return 'equipe'
    default:
      return 'requisitante'
  }
}

function normalizeModuleKey(mod: string): string {
  if (mod === 'patrimonial') return 'patrimonio'
  if (mod === 'patrimonio') return 'patrimonio'
  if (mod === 'apontamentos') return 'financeiro'
  return mod
}

export const ALCADA_LABEL: Record<number, string> = {
  0: 'Sem alçada',
  1: 'Coordenador (até R$ 5.000)',
  2: 'Gerente (até R$ 25.000)',
  3: 'Diretor (até R$ 100.000)',
  4: 'CEO (sem limite)',
}

// Hotfix de acentuação consistente (evita variação de encoding por ambiente)
ALCADA_LABEL[0] = 'Sem alçada'
ALCADA_LABEL[1] = 'Coordenador (até R$ 5.000)'
ALCADA_LABEL[2] = 'Gerente (até R$ 25.000)'
ALCADA_LABEL[3] = 'Diretor (até R$ 100.000)'

export interface Perfil {
  id: string
  auth_id: string
  nome: string
  email: string
  cargo: string | null
  departamento: string | null
  avatar_url: string | null
  role: Role
  papel_global?: PapelGlobal | null
  alcada_nivel: number
  modulos: Record<string, boolean>
  permissoes_especiais: Record<string, Record<string, unknown>>
  preferencias: Record<string, unknown>
  ativo: boolean
  senha_definida: boolean
  role_id: string | null
  colaborador_id: string | null
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
      { key: 'egp', label: 'EGP', icon: '📊' },
      { key: 'obras', label: 'Obras', icon: '🏗️' },
      { key: 'ssma', label: 'SSMA', icon: '⛑️' },
    ],
  },
  {
    label: 'Suprimentos',
    modulos: [
      { key: 'compras', label: 'Compras', icon: '🛒' },
      { key: 'logistica', label: 'Logística', icon: '🚚' },
      { key: 'estoque', label: 'Estoque', icon: '📦' },
      { key: 'patrimonial', label: 'Patrimonial', icon: '🏛️' },
      { key: 'frotas', label: 'Frotas', icon: '🚛' },
    ],
  },
  {
    label: 'Backoffice',
    modulos: [
      { key: 'financeiro', label: 'Financeiro', icon: '💰' },
      { key: 'fiscal', label: 'Fiscal', icon: '🧾' },
      { key: 'controladoria', label: 'Controladoria', icon: '📈' },
      { key: 'contratos', label: 'Contratos', icon: '📋' },
      { key: 'cadastros', label: 'Cadastros', icon: '⚙️' },
    ],
  },
  {
    label: 'RH',
    modulos: [
      { key: 'rh', label: 'RH', icon: '👥' },
    ],
  },
]

export const MODULOS_ERP: ModuloERP[] = MODULOS_ERP_GROUPED.flatMap(g => g.modulos)

interface AuthContextType {
  user: User | null
  perfil: Perfil | null
  session: Session | null
  loading: boolean
  perfilReady: boolean
  rbacV2Enabled: boolean
  papelGlobal: PapelGlobal
  perfilSetores: PerfilSetor[]

  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signInMagicLink: (identifier: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (identifier: string) => Promise<{ error: string | null }>
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
  hasSetorPapel: (mod: string, papeis?: PapelGlobal[]) => boolean
  canApprove: (nivel: number) => boolean
  canTechnicalApprove: (mod: string) => boolean
  atLeast: (role: Role | string) => boolean
  permissoesEspeciais: (modulo: string) => Record<string, unknown>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [perfilReady, setPerfilReady] = useState(false)
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false)
  const [rbacV2Enabled, setRbacV2Enabled] = useState(false)
  const [perfilSetores, setPerfilSetores] = useState<PerfilSetor[]>([])

  const loadingRef = useRef(false)
  const userRef = useRef<User | null>(null)
  const perfilLoadedRef = useRef(false)
  const LOGIN_DOMAIN = 'login.teg.local'
  const LOGIN_FALLBACK_DOMAIN = 'login.teg.local.com'

  const resolveIdentifierCandidates = useCallback((identifier: string): string[] => {
    const input = identifier.trim().toLowerCase()
    if (!input) return []
    if (!input.includes('@')) {
      return [`${input}@${LOGIN_DOMAIN}`, `${input}@${LOGIN_FALLBACK_DOMAIN}`]
    }
    const [local, domain] = input.split('@')
    if (!local || !domain) return [input]
    if (domain === LOGIN_DOMAIN || domain === LOGIN_FALLBACK_DOMAIN) return [input]
    if (domain === 'teguniao.com.br') {
      return [`${local}@${LOGIN_DOMAIN}`, `${local}@${LOGIN_FALLBACK_DOMAIN}`]
    }
    return [input]
  }, [])

  const loadRbacContext = useCallback(async (perfilData: Perfil | null) => {
    if (!perfilData?.id) {
      setRbacV2Enabled(false)
      setPerfilSetores([])
      return
    }

    try {
      const { data: flagData, error: flagError } = await supabase.rpc('get_feature_flag', {
        p_chave: 'rbac_v2_enabled',
        p_default: false,
      })

      if (flagError) {
        setRbacV2Enabled(false)
        setPerfilSetores([])
        return
      }

      const enabled = Boolean(flagData)
      setRbacV2Enabled(enabled)

      if (!enabled) {
        setPerfilSetores([])
        return
      }

      const { data, error } = await supabase
        .from('sys_perfil_setores')
        .select('id, papel, aprovador_tecnico, ativo, setor:sys_setores(id, codigo, nome, modulo_key, ativo)')
        .eq('perfil_id', perfilData.id)
        .eq('ativo', true)

      if (error || !data) {
        setPerfilSetores([])
        return
      }

      const rows: PerfilSetor[] = (data as Array<Record<string, unknown>>)
        .map(row => {
          const setor = row.setor as Record<string, unknown> | null
          if (!setor) return null
          return {
            id: String(row.id),
            setor_id: String(setor.id),
            setor_codigo: String(setor.codigo),
            setor_nome: String(setor.nome),
            modulo_key: String(setor.modulo_key),
            papel: String(row.papel ?? 'equipe') as PapelGlobal,
            aprovador_tecnico: Boolean(row.aprovador_tecnico),
            ativo: Boolean(row.ativo),
          } satisfies PerfilSetor
        })
        .filter((v): v is PerfilSetor => Boolean(v))

      setPerfilSetores(rows)
    } catch {
      setRbacV2Enabled(false)
      setPerfilSetores([])
    }
  }, [])

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
        const loaded = data as Perfil
        setPerfil(loaded)
        perfilLoadedRef.current = true
        loadRbacContext(loaded)
        supabase.rpc('registrar_acesso', { p_auth_id: authId })
        return
      }

      if (error?.code === 'PGRST116') {
        const { data: { user: authUser }, error: sessErr } = await supabase.auth.getUser()
        if (sessErr || !authUser) {
          await supabase.auth.signOut()
          return
        }

        const email = authUser.email ?? ''
        const nome = (authUser.user_metadata?.full_name as string)
          || (authUser.user_metadata?.nome as string)
          || email.split('@')[0]

        const { data: criado } = await supabase
          .from('sys_perfis')
          .insert({ auth_id: authId, nome, email })
          .select()
          .single()

        if (criado) {
          const loaded = criado as Perfil
          setPerfil(loaded)
          perfilLoadedRef.current = true
          loadRbacContext(loaded)
        }
      }
    } catch {
      setRbacV2Enabled(false)
      setPerfilSetores([])
    } finally {
      loadingRef.current = false
      setPerfilReady(true)
    }
  }, [loadRbacContext])

  const reloadPerfil = useCallback(async () => {
    setPerfilReady(false)
    if (user?.id) await loadPerfil(user.id)
  }, [user, loadPerfil])

  useEffect(() => {
    perfilLoadedRef.current = false
    userRef.current = null

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        userRef.current = currentSession?.user ?? null

        if (event === 'PASSWORD_RECOVERY') {
          setPendingPasswordReset(true)
        }

        if (currentSession?.user) {
          loadingRef.current = false
          loadPerfil(currentSession.user.id).finally(() => setLoading(false))
        } else {
          setPerfil(null)
          setPerfilSetores([])
          setRbacV2Enabled(false)
          setPerfilReady(true)
          setLoading(false)
        }
      }
    )

    const safety = setTimeout(() => {
      if (userRef.current && !perfilLoadedRef.current) {
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setUser(null)
        setSession(null)
        setPerfil(null)
        setPerfilSetores([])
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

  const signIn = async (identifier: string, password: string) => {
    const candidates = resolveIdentifierCandidates(identifier)
    let lastError: string | null = null

    for (const email of candidates) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return { error: null }
      lastError = error.message
    }

    return { error: translateError(lastError ?? 'Falha ao autenticar') }
  }

  const signInMagicLink = async (identifier: string) => {
    const email = resolveIdentifierCandidates(identifier)[0] ?? identifier.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error ? translateError(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (identifier: string) => {
    if (!identifier.includes('@')) {
      return { error: 'Recuperação por usuário não disponível. Use o e-mail de login ou fale com o administrador.' }
    }
    const email = identifier.trim().toLowerCase()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    return { error: error ? translateError(error.message) : null }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? translateError(error.message) : null }
  }

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
    const loaded = updated as Perfil
    setPerfil(loaded)
    loadRbacContext(loaded)
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

  const legacyRole: Role = (perfil?.role ?? 'visitante') as Role
  const papelGlobal: PapelGlobal = perfil?.papel_global ?? mapLegacyRoleToPapel(legacyRole)
  const role: Role = legacyRole
  const isAdmin = legacyRole === 'administrador' || legacyRole === 'admin'

  const hasModule = (mod: string): boolean => {
    if (isAdmin) return true
    const normalized = normalizeModuleKey(mod)

    if (rbacV2Enabled && perfilSetores.length > 0) {
      const hasBySetor = perfilSetores.some(s => s.ativo && normalizeModuleKey(s.modulo_key) === normalized)
      if (hasBySetor) return true
    }

    if (perfil?.modulos?.[mod] === true) return true
    if (perfil?.modulos?.[normalized] === true) return true
    if (mod === 'patrimonial') return perfil?.modulos?.estoque === true
    if (mod === 'apontamentos') return perfil?.modulos?.financeiro === true
    return false
  }

  const hasSetorPapel = (mod: string, papeis: PapelGlobal[] = ['equipe', 'supervisor', 'diretor', 'ceo']) => {
    if (isAdmin) return true
    const normalized = normalizeModuleKey(mod)

    if (!rbacV2Enabled || perfilSetores.length === 0) {
      const fallbackRole = PAPEL_TO_LEGACY_ROLE[papelGlobal]
      return hasModule(mod) && (ROLE_NIVEL[fallbackRole] ?? 0) >= 3
    }

    return perfilSetores.some(s =>
      s.ativo
      && normalizeModuleKey(s.modulo_key) === normalized
      && papeis.includes(s.papel)
    )
  }

  const canTechnicalApprove = (mod: string): boolean => {
    if (isAdmin) return true
    if (papelGlobal === 'diretor' || papelGlobal === 'ceo') return hasModule(mod)

    const normalized = normalizeModuleKey(mod)
    if (rbacV2Enabled && perfilSetores.length > 0) {
      return perfilSetores.some(s =>
        s.ativo
        && normalizeModuleKey(s.modulo_key) === normalized
        && (s.aprovador_tecnico || s.papel === 'supervisor' || s.papel === 'diretor' || s.papel === 'ceo')
      )
    }

    return legacyRole === 'diretor' || legacyRole === 'gerente' || legacyRole === 'gestor' || legacyRole === 'aprovador'
  }

  const currentNivel = Math.max(ROLE_NIVEL[legacyRole] ?? 0, ROLE_NIVEL[papelGlobal] ?? 0)

  const value: AuthContextType = {
    user,
    perfil,
    session,
    loading,
    perfilReady,
    rbacV2Enabled,
    papelGlobal,
    perfilSetores,
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
    roleLabel: rbacV2Enabled ? PAPEL_LABEL[papelGlobal] : (ROLE_LABEL[role] ?? ROLE_LABEL.requisitante),
    isAdmin,
    isGerente: currentNivel >= (ROLE_NIVEL.diretor ?? 5),
    canManage: isAdmin,
    hasModule,
    hasSetorPapel,
    canApprove: (nivel) => isAdmin || papelGlobal === 'ceo' || (perfil?.alcada_nivel ?? 0) >= nivel,
    canTechnicalApprove,
    atLeast: (r) => currentNivel >= (ROLE_NIVEL[r] ?? 0),
    permissoesEspeciais: (modulo: string) => perfil?.permissoes_especiais?.[modulo] ?? {},
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Usuário/e-mail ou senha incorretos'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar'
  if (msg.includes('Too many requests')) return 'Muitas tentativas. Aguarde um momento'
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado'
  if (msg.includes('Email rate limit exceeded')) return 'Limite de e-mails atingido. Tente mais tarde'
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres'
  if (msg.includes('New password should be')) return 'A nova senha deve ter pelo menos 6 caracteres'
  if (msg.includes('same password')) return 'A nova senha deve ser diferente da atual'
  return msg
}
