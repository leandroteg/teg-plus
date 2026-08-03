import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// Cliente service-level: ignora RLS (serviço de back-end confiável, rodando na
// VPS junto da Evolution). A chave vive SÓ no Environment do Easypanel.
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
