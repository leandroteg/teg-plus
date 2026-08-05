// ─────────────────────────────────────────────────────────────────────────────
// utils/empresaCurta.ts — apelido curto da empresa pagadora para caber em
// coluna de lista. O nome fantasia completo ("TEG União Energia (Filial 1 —
// Paracatu/MG)") não cabe em nenhuma tabela; aqui vira "Teg Paracatu".
//
// O mapa é por CÓDIGO da empresa (estável) e o fallback deriva do nome, para
// empresa nova ainda não mapeada não aparecer vazia.
// ─────────────────────────────────────────────────────────────────────────────

const POR_CODIGO: Record<string, string> = {
  'EMP-001': 'Teg - CG',
  'EMP-002': 'Teg Paracatu',
  'EMP-003': 'Teg Araxá',
  'EMP-004': 'União',
  'EMP-005': 'Holding',
}

export interface EmpresaMinima {
  id: string
  codigo?: string | null
  nome_fantasia?: string | null
  razao_social?: string | null
}

/** Deriva um apelido curto quando o código não está no mapa. */
function derivar(emp: EmpresaMinima): string {
  const base = (emp.nome_fantasia || emp.razao_social || '').trim()
  if (!base) return emp.codigo ?? '—'
  // "TEG União Energia (Filial 2 — CD Araxá/MG)" → pega o que está nos parênteses
  const dentro = base.match(/\(([^)]+)\)/)?.[1]
  const alvo = dentro ?? base
  // corta sufixos societários e o estado no fim ("CD Araxá/MG" → "CD Araxá")
  return alvo
    .replace(/\s*[—-]\s*/g, ' ')
    .replace(/\/[A-Z]{2}\b/g, '')
    .replace(/\b(LTDA|S\.?A\.?|ME|EPP|EIRELI)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18)
}

export function empresaCurta(emp: EmpresaMinima | undefined | null): string {
  if (!emp) return '—'
  const porCodigo = emp.codigo ? POR_CODIGO[emp.codigo] : undefined
  return porCodigo ?? derivar(emp)
}

/** Mapa id → apelido curto, para as listas resolverem sem hook por linha. */
export function mapaEmpresaCurta(empresas: EmpresaMinima[]): Map<string, string> {
  return new Map(empresas.map(e => [e.id, empresaCurta(e)]))
}
