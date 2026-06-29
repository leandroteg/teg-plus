// Ponto único de acesso ao Supabase dentro do módulo TI.
// Reexporta o singleton global do app — nunca criar outro client aqui.
export { supabase } from '../../../services/supabase'
