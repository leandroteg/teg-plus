// Guards de papel do módulo TI, usados nas rotas do App.tsx.
// O acesso ao módulo em si (hasModule('ti')) é garantido antes, pelo ModuleRoute;
// aqui separamos o que é da equipe (atendentes/admin) e o que é só do admin.
import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../data/supabase'

/** Só admin global (Usuários, Configurações). */
export function TiAdminRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/ti" replace />
  return <Outlet />
}

/** Equipe de T.I.: atendente (ti_atendentes) ou admin. O estado 'null' (carregando)
 *  evita expulsar atendentes antes da consulta resolver. */
export function TiStaffRoute() {
  const { isAdmin, perfil } = useAuth()
  const [ok, setOk] = useState<boolean | null>(isAdmin ? true : null)

  useEffect(() => {
    if (isAdmin) { setOk(true); return }
    if (!perfil?.id) return
    let alive = true
    supabase
      .from('ti_atendentes')
      .select('perfil_id')
      .eq('perfil_id', perfil.id)
      .maybeSingle()
      .then(({ data }) => { if (alive) setOk(!!data) })
    return () => { alive = false }
  }, [isAdmin, perfil?.id])

  if (ok === null) return null
  if (!ok) return <Navigate to="/ti" replace />
  return <Outlet />
}
