// Geração e download de CSV no próprio navegador (abre no Excel). Portado do helpdesk.
function escapeCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))]
  return lines.join('\r\n')
}

export function downloadCSV(filename: string, csv: string): void {
  // BOM para o Excel reconhecer UTF-8 (acentos)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
