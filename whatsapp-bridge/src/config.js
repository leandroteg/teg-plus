import 'dotenv/config'

function req(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name} (veja .env.example)`)
  return v
}

export const config = {
  supabaseUrl: req('SUPABASE_URL'),
  serviceRoleKey: req('SUPABASE_SERVICE_ROLE_KEY'), // aceita a chave nova sb_secret_...
  evolutionUrl: req('EVOLUTION_URL').replace(/\/+$/, ''),
  evolutionApiKey: req('EVOLUTION_APIKEY'),
  evolutionInstance: process.env.EVOLUTION_INSTANCE ?? 'teg-helpdesk',
  webhookToken: process.env.WEBHOOK_TOKEN ?? '', // vazio = não exige token (use só em rede interna)
  port: Number(process.env.PORT ?? 3000),
  // Agente IA (n8n) — os DOIS precisam estar preenchidos p/ ligar a IA;
  // ausentes = comportamento clássico (mini-fluxo de setor), deploy 100% seguro.
  n8nWebhookUrl: (process.env.N8N_WEBHOOK_URL ?? '').replace(/\/+$/, ''),
  aiSharedToken: process.env.AI_SHARED_TOKEN ?? '',
  n8nTimeoutMs: Number(process.env.N8N_TIMEOUT_MS ?? 6000),
  janelaMin: Number(process.env.WHATSAPP_CONVERSA_JANELA_MIN ?? 360),
  externoEmail: process.env.WHATSAPP_PERFIL_EXTERNO_EMAIL ?? 'whatsapp-externo@sistema.teguniao.com.br',
  bucket: process.env.WHATSAPP_BUCKET ?? 'ti-chamados',
  pollComandoMs: Number(process.env.WHATSAPP_POLL_COMANDO_MS ?? 4000),
  pollSaidaMs: Number(process.env.WHATSAPP_POLL_SAIDA_MS ?? 10000),
}
