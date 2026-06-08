import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

export interface PortalUser {
  id: string
  nome: string
  matricula: string | null
  cpf: string
  data_nascimento: string
  cargo: string | null
  departamento: string | null
  email: string | null
  foto_url: string | null
}

const STORAGE_KEY = 'portal-teg-user'

export function usePortalAuth() {
  const [user, setUser] = useState<PortalUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (cpf: string, dataNascimento: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const cpfClean = cpf.replace(/\D/g, '')
      if (cpfClean.length !== 11) {
        throw new Error('CPF deve ter 11 dígitos')
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
        throw new Error('Data de nascimento inválida')
      }

      const { data, error } = await supabase.rpc('portal_teg_login', {
        p_cpf: cpfClean,
        p_data_nascimento: dataNascimento,
      })

      if (error) throw new Error('Erro ao consultar dados. Tente novamente.')
      const row = Array.isArray(data) ? data[0] : data
      if (!row) throw new Error('CPF ou data de nascimento incorretos, ou colaborador inativo.')

      const portalUser = row as PortalUser
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(portalUser))
      setUser(portalUser)
      return portalUser
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setUser(e.newValue ? JSON.parse(e.newValue) : null)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return { user, isLoading, error, login, logout, isAuthenticated: !!user }
}
