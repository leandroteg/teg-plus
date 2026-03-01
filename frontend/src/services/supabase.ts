import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://uzfjfucrinokeuwpbeie.supabase.co'

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDE2NTgsImV4cCI6MjA4Nzc3NzY1OH0.eFf_TTijVffZxnl2xlm_Mncji1bQRHyosAALawrtZbk'

export const supabase = createClient(supabaseUrl, supabaseKey)

/** true apenas quando nenhuma URL real foi configurada */
export const isPlaceholder = false
