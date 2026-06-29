// Adapta o AuthContext do TEG+ para o shape de auth que as telas do helpdesk
// esperam ({ user: { id, name, email, role }, isStaff }). O módulo TI é
// admin-only (gate no App.tsx + AdminRoute), então na prática role ∈ {ADMIN, AGENTE}.
import { useAuth } from '../../../contexts/AuthContext'
import { useIsAtendenteTi } from '../hooks'

export type TiRole = 'ADMIN' | 'AGENTE' | 'REQUERENTE'

export interface TiUser {
  id: string
  name: string
  email: string
  role: TiRole
}

export function useTiAuth() {
  const { perfil, isAdmin } = useAuth()
  const isAtendente = useIsAtendenteTi()
  const role: TiRole = isAdmin ? 'ADMIN' : isAtendente ? 'AGENTE' : 'REQUERENTE'

  const user: TiUser | null = perfil
    ? { id: perfil.id, name: perfil.nome, email: perfil.email, role }
    : null

  return {
    user,
    isAdmin,
    isAtendente,
    /** equipe de TI: atendente ou admin (equivalente ao isStaff do helpdesk) */
    isStaff: isAdmin || isAtendente,
  }
}
