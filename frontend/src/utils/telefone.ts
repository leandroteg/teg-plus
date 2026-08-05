// Telefone do usuário — usado pelo cadastro/edição em /admin/usuarios e pelo
// canal WhatsApp do Helpdesk (whatsapp-bridge).
//
// O bridge casa a mensagem recebida com o funcionário pelos ÚLTIMOS 8 DÍGITOS
// (whatsapp-bridge/src/db.js → phoneKey), o que torna o formato de gravação
// indiferente. Ainda assim guardamos só dígitos: evita que "(67) 99604-7609" e
// "67996047609" convivam no banco e confundam quem consulta.

/** Só os dígitos (é o que vai para sys_perfis.telefone). */
export function normalizarTelefone(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '')
}

/** Últimos 8 dígitos — mesma chave de casamento usada pelo bridge. */
export function chaveTelefone(v: string | null | undefined): string {
  const d = normalizarTelefone(v)
  return d.length >= 8 ? d.slice(-8) : ''
}

/**
 * Formata para leitura: (67) 99604-7609. Aceita com ou sem DDI 55 e devolve a
 * entrada crua quando não reconhece o formato (nunca esconde o dado).
 */
export function formatarTelefone(v: string | null | undefined): string {
  let d = normalizarTelefone(v)
  if (!d) return ''
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2) // DDI que o WhatsApp traz
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return String(v ?? '')
}

/** Máscara progressiva enquanto digita (não bloqueia colar do WhatsApp). */
export function mascaraTelefone(v: string): string {
  const d = normalizarTelefone(v).slice(0, 13)
  if (d.length > 11) return d // colou com DDI: deixa como está
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Válido para o casamento do WhatsApp: DDD + número (10 ou 11 dígitos, ou com DDI). */
export function telefoneValido(v: string | null | undefined): boolean {
  const d = normalizarTelefone(v)
  if (!d) return false
  const semDdi = d.length > 11 && d.startsWith('55') ? d.slice(2) : d
  return semDdi.length === 10 || semDdi.length === 11
}
