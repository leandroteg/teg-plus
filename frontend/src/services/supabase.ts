import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://uzfjfucrinokeuwpbeie.supabase.co'

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk'

export const supabase = createClient(supabaseUrl, supabaseKey)

/** true apenas quando nenhuma URL real foi configurada */
export const isPlaceholder = false

/**
 * Valida email+senha sem trocar a sessao atual.
 * Usa um client efemero (storage memory, sem persistencia) — se o login
 * der certo a sessao fica nesse client e e descartada quando ele sai do
 * escopo. O supabase singleton acima continua intacto.
 * Retorna {ok, userId?, error?}.
 */
export async function verifySenha(email: string, senha: string): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const temp = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `verify-${Date.now()}-${Math.random()}`,
    },
  })
  const { data, error } = await temp.auth.signInWithPassword({ email, password: senha })
  if (error) return { ok: false, error: error.message }
  await temp.auth.signOut().catch(() => {})
  return { ok: true, userId: data.user?.id }
}
