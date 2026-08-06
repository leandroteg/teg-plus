// ─────────────────────────────────────────────────────────────────────────────
// utils/validarDocFornecedor.ts — Confere se um documento anexado ao pedido
// (NF/boleto em PDF) pertence mesmo ao fornecedor do pedido, comparando os
// CNPJs encontrados no texto do PDF com o CNPJ do fornecedor cadastrado.
//
// Fontes de CNPJ no documento:
//   • CNPJs impressos (com máscara, tolerante a espaços do extrator de texto)
//   • Chave de acesso da NF-e (44 dígitos, o CNPJ do emitente ocupa as
//     posições 7–20) — cobre DANFEs em que o CNPJ só aparece na chave
//   • Sequências "nuas" de exatamente 14 dígitos
//
// Tudo client-side via pdf.js (mesmo worker de lib/pdfRender.ts). PDF sem
// camada de texto (escaneado) ou imagem → 'ilegivel' (aviso, não bloqueia).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'

export interface ValidacaoDocFornecedor {
  status: 'confere' | 'divergente' | 'ilegivel' | 'sem_cadastro'
  fornecedorNome: string
  fornecedorCnpj: string | null
  cnpjsDocumento: string[]
}

const soDigitos = (s: string) => s.replace(/\D/g, '')

export const fmtCnpj = (d: string) =>
  d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d

const normalizarTexto = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

async function extrairTextoPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  let texto = ''
  const maxPag = Math.min(pdf.numPages, 6)
  for (let i = 1; i <= maxPag; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texto += (content.items as Array<{ str?: string }>).map(it => it.str ?? '').join(' ') + '\n'
  }
  return texto
}

export function extrairCnpjs(texto: string): string[] {
  const achados = new Set<string>()

  // CNPJ com máscara (tolerante a espaços que o extrator insere entre grupos)
  // [-.]? no DV: ha NF impressa com ponto no lugar do hifen (34.641.393/0001.34
  // da Gaplan) — com -? estrito o CNPJ ficava invisivel e acusava divergencia.
  const reMask = /\b(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})\s?\/\s?(\d{4})\s?[-.]?\s?(\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = reMask.exec(texto)) !== null) achados.add(m.slice(1).join(''))

  // Corridas de dígitos possivelmente separadas por espaço/ponto (chave de
  // acesso costuma sair "3121 0612 3456 ..."): junta e classifica pelo tamanho.
  const runs = texto.match(/\d[\d .]{10,80}\d/g) ?? []
  for (const run of runs) {
    const d = soDigitos(run)
    if (d.length === 44) achados.add(d.slice(6, 20)) // chave NF-e → CNPJ do emitente
    else if (d.length === 14) achados.add(d)          // CNPJ sem máscara
  }

  return Array.from(achados)
}

/**
 * Valida o arquivo contra o fornecedor do pedido. Retorna null se o pedido
 * não for encontrado (não bloqueia o fluxo por falha da própria validação).
 */
export async function validarDocFornecedorPedido(
  file: File,
  pedidoId: string,
): Promise<ValidacaoDocFornecedor | null> {
  const { data: ped } = await supabase
    .from('cmp_pedidos')
    .select('fornecedor_id, fornecedor_nome')
    .eq('id', pedidoId)
    .maybeSingle()
  if (!ped) return null

  const fornecedorNome = (ped.fornecedor_nome ?? '').trim()
  let fornecedorCnpj: string | null = null
  if (ped.fornecedor_id) {
    const { data: forn } = await supabase
      .from('cmp_fornecedores')
      .select('cnpj')
      .eq('id', ped.fornecedor_id)
      .maybeSingle()
    const d = soDigitos(forn?.cnpj ?? '')
    fornecedorCnpj = d.length === 14 ? d : null
  }

  const base = { fornecedorNome, fornecedorCnpj, cnpjsDocumento: [] as string[] }

  const nomeArquivo = file.name.toLowerCase()
  const ehPdf = file.type.includes('pdf') || nomeArquivo.endsWith('.pdf')
  const ehXml = file.type.includes('xml') || nomeArquivo.endsWith('.xml')
  if (!ehPdf && !ehXml) return { status: 'ilegivel', ...base }

  let texto = ''
  try {
    // XML da NF-e: o texto cru já contém <CNPJ> do emitente e a chave de acesso
    texto = ehXml ? await file.text() : await extrairTextoPdf(file)
  } catch {
    return { status: 'ilegivel', ...base }
  }

  const cnpjsDocumento = extrairCnpjs(texto)

  if (!fornecedorCnpj) {
    // Sem CNPJ no cadastro: tenta pelo menos casar a razão social no texto.
    if (fornecedorNome.length >= 5 && normalizarTexto(texto).includes(normalizarTexto(fornecedorNome))) {
      return { status: 'confere', ...base, cnpjsDocumento }
    }
    return { status: 'sem_cadastro', ...base, cnpjsDocumento }
  }

  if (cnpjsDocumento.length === 0) return { status: 'ilegivel', ...base }

  return {
    status: cnpjsDocumento.includes(fornecedorCnpj) ? 'confere' : 'divergente',
    ...base,
    cnpjsDocumento,
  }
}
