import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// Cliente service-role: ignora RLS (este é um serviço de back-end confiável,
// rodando on-prem). A chave NUNCA deve sair desta máquina.
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
