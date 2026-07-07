// ── Recuperação de chunk defasado (pós-deploy) ────────────────────────────────
// O app é PWA: o service worker pré-cacheia index.html + chunks. Após um deploy,
// um SW defasado pode continuar servindo o index antigo — e aí reload simples
// NÃO recupera (o SW responde de novo com o estado velho). A recuperação de
// verdade é: desregistrar o SW + limpar os CacheStorage e só então recarregar.
export async function hardRecoverFromStaleChunk(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map(r => r.unregister().catch(() => {})))
  } catch { /* sem SW — segue */ }
  try {
    const keys = (await caches?.keys?.()) ?? []
    await Promise.all(keys.map(k => caches.delete(k).catch(() => {})))
  } catch { /* sem CacheStorage — segue */ }
  window.location.reload()
}
