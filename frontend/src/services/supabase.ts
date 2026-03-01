import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

/** Retorna true quando as variáveis de ambiente reais não foram configuradas */
export const isPlaceholder = supabaseUrl.includes('placeholder') || supabaseKey === 'placeholder-key'

/** URL do projeto Supabase para links de diagnóstico */
export const supabaseProjectUrl = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
