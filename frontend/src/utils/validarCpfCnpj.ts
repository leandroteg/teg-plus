// ─────────────────────────────────────────────────────────────────────────────
// utils/validarCpfCnpj.ts — validação do DÍGITO VERIFICADOR de CPF e CNPJ.
//
// O isCpfOuCnpj de useFornecedorVinculo só confere o tamanho (11 ou 14 dígitos),
// então qualquer número passava: foi assim que entrou um "59.033.426/0001-04"
// (DV correto seria 94) duplicando um fornecedor que já existia, e um
// "12.345.678/0001-90" de teste. Aqui a conta é feita de verdade.
//
// Fornecedor do exterior não tem CNPJ — quem chama deve pular a validação
// olhando a flag `exterior` do cadastro, não afrouxar esta função.
// ─────────────────────────────────────────────────────────────────────────────

export const soDigitos = (valor?: string | null) => (valor ?? '').replace(/\D/g, '')

function dvCpf(d: string): string {
  const s1 = Array.from({ length: 9 }, (_, i) => Number(d[i]) * (10 - i)).reduce((a, b) => a + b, 0)
  const r1 = s1 % 11
  const d1 = r1 < 2 ? 0 : 11 - r1
  const s2 = Array.from({ length: 9 }, (_, i) => Number(d[i]) * (11 - i)).reduce((a, b) => a + b, 0) + d1 * 2
  const r2 = s2 % 11
  const d2 = r2 < 2 ? 0 : 11 - r2
  return `${d1}${d2}`
}

function dvCnpj(d: string): string {
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const s1 = p1.reduce((acc, peso, i) => acc + Number(d[i]) * peso, 0)
  const r1 = s1 % 11
  const d1 = r1 < 2 ? 0 : 11 - r1
  const base = `${d.slice(0, 12)}${d1}`
  const s2 = p2.reduce((acc, peso, i) => acc + Number(base[i]) * peso, 0)
  const r2 = s2 % 11
  const d2 = r2 < 2 ? 0 : 11 - r2
  return `${d1}${d2}`
}

/** true quando o CPF (11) ou CNPJ (14) tem dígito verificador correto. */
export function cpfCnpjValido(valor?: string | null): boolean {
  const d = soDigitos(valor)
  // Repetido (00000000000000, 11111111111...) passa na conta do DV mas não existe.
  if (/^(\d)\1+$/.test(d)) return false
  if (d.length === 11) return d.slice(9) === dvCpf(d)
  if (d.length === 14) return d.slice(12) === dvCnpj(d)
  return false
}

/** Mensagem pronta para o formulário, ou null quando está tudo certo. */
export function erroCpfCnpj(valor?: string | null): string | null {
  const d = soDigitos(valor)
  if (d.length === 0) return 'Informe o CPF ou CNPJ.'
  if (d.length !== 11 && d.length !== 14) {
    return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'
  }
  if (!cpfCnpjValido(d)) {
    const tipo = d.length === 11 ? 'CPF' : 'CNPJ'
    return `${tipo} inválido — confira os dígitos. Se for fornecedor do exterior, marque "Fornecedor do exterior".`
  }
  return null
}
