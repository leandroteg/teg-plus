type ContatoLike = {
  fornecedor_contato?: string | null
  fornecedor_telefone?: string | null
  fornecedor_email?: string | null
  telefone?: string | null
  email?: string | null
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_RE = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/

export function splitFornecedorContato(contato?: string | null) {
  const raw = contato?.trim() ?? ''
  const email = raw.match(EMAIL_RE)?.[0] ?? ''
  const withoutEmail = email ? raw.replace(email, ' ') : raw
  const telefone = withoutEmail.match(PHONE_RE)?.[0]?.trim() ?? ''

  return {
    telefone,
    email,
  }
}

export function getFornecedorTelefone(fornecedor: ContatoLike) {
  const explicit = fornecedor.fornecedor_telefone ?? fornecedor.telefone
  if (explicit?.trim()) return explicit.trim()
  return splitFornecedorContato(fornecedor.fornecedor_contato).telefone
}

export function getFornecedorEmail(fornecedor: ContatoLike) {
  const explicit = fornecedor.fornecedor_email ?? fornecedor.email
  if (explicit?.trim()) return explicit.trim()
  return splitFornecedorContato(fornecedor.fornecedor_contato).email
}

export function joinFornecedorContato(telefone?: string | null, email?: string | null, fallback?: string | null) {
  const contato = [telefone?.trim(), email?.trim()].filter(Boolean).join(' / ')
  return contato || fallback?.trim() || ''
}
