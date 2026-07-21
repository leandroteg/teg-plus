// Entrypoint do worker. Sobe os loops de comando (painel → conectar/desconectar/
// testar) e de saída (respostas dos agentes → WhatsApp), e inicia o canal.
import { config } from './config.js'
import { log, err } from './log.js'
import * as db from './db.js'
import { startClient, stopClient, shutdownClient, sendWhatsApp, getStatus } from './whatsapp.js'

// Só espelha respostas criadas A PARTIR de agora (não reenvia histórico no boot).
let outboundCursor = new Date().toISOString()
let stopped = false

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)) }

async function loopComandos() {
  while (!stopped) {
    try {
      const cmd = await db.pollCommand()
      if (cmd) {
        log('comando do painel:', cmd.comando)
        if (cmd.comando === 'connect') await startClient()
        else if (cmd.comando === 'disconnect') await stopClient()
        else if (cmd.comando === 'test' && cmd.payload?.to) {
          await sendWhatsApp({ to: cmd.payload.to, text: cmd.payload.text || 'Mensagem de teste do TEG+ ✅' })
        }
      }
      await db.syncStatus(getStatus()) // heartbeat (worker_visto_em)
    } catch (e) { err('loopComandos', e.message) }
    await sleep(config.pollComandoMs)
  }
}

async function loopSaida() {
  while (!stopped) {
    try {
      const replies = await db.getOutboundReplies(outboundCursor)
      for (const r of replies) {
        await sendWhatsApp({ to: r.to, text: `*Resposta no CH-${String(r.numero).padStart(4, '0')}*\n${r.mensagem}` })
        if (r.createdAt > outboundCursor) outboundCursor = r.createdAt
      }
    } catch (e) { err('loopSaida', e.message) }
    await sleep(config.pollSaidaMs)
  }
}

async function main() {
  log('TEG+ WhatsApp worker iniciando…')
  log('Supabase:', config.supabaseUrl, '| canal:', config.enabled ? 'ON' : 'OFF')
  try { log('conta externa:', await db.getExternoPerfilId()) } catch (e) { err(e.message) }

  loopComandos()
  loopSaida()

  if (config.enabled) await startClient()
  else log('WHATSAPP_ENABLED!=true — worker no ar, aguardando "Conectar" pelo painel.')
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log('encerrando…')
    stopped = true
    await shutdownClient().catch(() => {}) // só fecha o Chromium, NÃO desloga (preserva sessão)
    process.exit(0)
  })
}

main().catch((e) => { err('fatal', e.stack || e.message); process.exit(1) })
