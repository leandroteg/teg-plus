import 'dotenv/config'

function req(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name} (veja .env.example)`)
  return v
}

export const config = {
  supabaseUrl: req('SUPABASE_URL'),
  serviceRoleKey: req('SUPABASE_SERVICE_ROLE_KEY'),
  enabled: String(process.env.WHATSAPP_ENABLED ?? 'false').toLowerCase() === 'true',
  janelaMin: Number(process.env.WHATSAPP_CONVERSA_JANELA_MIN ?? 360),
  externoEmail: process.env.WHATSAPP_PERFIL_EXTERNO_EMAIL ?? 'whatsapp-externo@sistema.teguniao.com.br',
  bucket: process.env.WHATSAPP_BUCKET ?? 'ti-chamados',
  pollComandoMs: Number(process.env.WHATSAPP_POLL_COMANDO_MS ?? 4000),
  pollSaidaMs: Number(process.env.WHATSAPP_POLL_SAIDA_MS ?? 10000),
}
