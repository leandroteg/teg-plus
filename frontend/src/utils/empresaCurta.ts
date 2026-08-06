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

// ── Visão "quem paga" ────────────────────────────────────────────────────────
// Nas telas de pagamento a empresa exibida é o CAIXA de onde o dinheiro sai,
// não a filial fiscal do título (que fica gravada em empresa_id para nota e
// contabilidade). Todo o grupo TEG paga pela matriz Campo Grande, então
// qualquer filial TEG aparece como "Teg - CG"; União Serviços e a Holding têm
// caixa próprio e aparecem com o nome delas. Decisão do Elton, 06/08/2026.

const PAGADORA_POR_CODIGO: Record<string, string> = {
  'EMP-001': 'Teg - CG',
  'EMP-002': 'Teg - CG',
  'EMP-003': 'Teg - CG',
  'EMP-004': 'União',
  'EMP-005': 'Holding',
}

export function empresaPagadora(emp: EmpresaMinima | undefined | null): string {
  if (!emp) return '—'
  const porCodigo = emp.codigo ? PAGADORA_POR_CODIGO[emp.codigo] : undefined
  // Empresa nova fora do mapa: se a razão social é TEG, paga pela matriz.
  if (porCodigo) return porCodigo
  const razao = (emp.razao_social || emp.nome_fantasia || '').toUpperCase()
  if (razao.includes('TEG')) return 'Teg - CG'
  return empresaCurta(emp)
}

/** Mapa id → empresa pagadora, para as listas resolverem sem hook por linha. */
export function mapaEmpresaPagadora(empresas: EmpresaMinima[]): Map<string, string> {
  return new Map(empresas.map(e => [e.id, empresaPagadora(e)]))
}
