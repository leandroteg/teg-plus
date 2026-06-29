// Helpers de formatação (portado do helpdesk, sem alterações de lógica).
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} d`
  return formatDate(iso)
}

// Tempo restante/atraso até uma data (para SLA). Retorna { overdue, label }.
export function timeUntil(iso: string): { overdue: boolean; label: string } {
  const diffMs = new Date(iso).getTime() - Date.now()
  const overdue = diffMs < 0
  const abs = Math.abs(diffMs)
  const min = Math.floor(abs / 60000)
  const h = Math.floor(min / 60)
  const d = Math.floor(h / 24)
  let qty: string
  if (min < 60) qty = `${min} min`
  else if (h < 48) qty = `${h} h`
  else qty = `${d} d`
  return { overdue, label: overdue ? `atrasado há ${qty}` : `vence em ${qty}` }
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
