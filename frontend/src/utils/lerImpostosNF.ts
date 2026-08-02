// ─────────────────────────────────────────────────────────────────────────────
// utils/lerImpostosNF.ts — Lê os impostos de uma NF anexada ao pedido e
// pré-preenche a seção Impostos (cmp_pedido_impostos + itens).
//
//   • XML da NF-e (modelo 55): leitura EXATA — totais do ICMSTot e impostos
//     por item (det/imposto). É o caminho recomendado.
//   • PDF (DANFE): melhor esforço — extrai chave, número, data e os totais do
//     quadro "Cálculo do Imposto" pelo texto do PDF. Sem detalhe por item.
//
// Nunca sobrescreve: se já existe registro de impostos com algum valor lançado
// para o pedido, a leitura é descartada silenciosamente.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'

export interface LeituraImpostosNF {
  origem: 'xml' | 'pdf'
  nfNumero?: string
  nfSerie?: string
  chave?: string
  dataEmissao?: string
  valorTotalNota?: number
  baseCalculoIcms?: number
  valorIcms?: number
  baseCalculoIcmsSt?: number
  valorIcmsSt?: number
  valorIpi?: number
  valorPis?: number
  valorCofins?: number
  valorFrete?: number
  valorSeguro?: number
  valorDesconto?: number
  outrasDespesas?: number
  itens: Array<{
    descricao: string
    valorItem: number
    baseCalculoIcms: number
    valorIcms: number
    valorIcmsSt: number
    valorIpi: number
    valorPis: number
    valorCofins: number
  }>
}

const num = (s: string | null | undefined) => {
  const v = parseFloat((s ?? '').trim())
  return Number.isFinite(v) ? v : 0
}

// ── XML da NF-e ──────────────────────────────────────────────────────────────

function tagText(scope: Element | Document, tag: string): string {
  return scope.getElementsByTagName(tag)[0]?.textContent ?? ''
}

export function lerXmlNFe(xmlText: string): LeituraImpostosNF | null {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) return null

  const infNFe = doc.getElementsByTagName('infNFe')[0]
  const ide = doc.getElementsByTagName('ide')[0]
  if (!infNFe || !ide) return null // não é XML de NF-e (mod 55)

  const chave = (infNFe.getAttribute('Id') ?? '').replace(/^NFe/i, '') || undefined
  const dataEmissaoRaw = tagText(ide, 'dhEmi') || tagText(ide, 'dEmi')
  const icmsTot = doc.getElementsByTagName('ICMSTot')[0]

  const itens = Array.from(doc.getElementsByTagName('det')).map(det => {
    const prod = det.getElementsByTagName('prod')[0]
    const imposto = det.getElementsByTagName('imposto')[0]
    const icms = imposto?.getElementsByTagName('ICMS')[0]
    const ipi = imposto?.getElementsByTagName('IPI')[0]
    const pis = imposto?.getElementsByTagName('PIS')[0]
    const cofins = imposto?.getElementsByTagName('COFINS')[0]
    return {
      descricao: (prod ? tagText(prod, 'xProd') : '').trim().toUpperCase(),
      valorItem: prod ? num(tagText(prod, 'vProd')) : 0,
      baseCalculoIcms: icms ? num(tagText(icms, 'vBC')) : 0,
      valorIcms: icms ? num(tagText(icms, 'vICMS')) : 0,
      valorIcmsSt: icms ? num(tagText(icms, 'vICMSST')) : 0,
      valorIpi: ipi ? num(tagText(ipi, 'vIPI')) : 0,
      valorPis: pis ? num(tagText(pis, 'vPIS')) : 0,
      valorCofins: cofins ? num(tagText(cofins, 'vCOFINS')) : 0,
    }
  }).filter(it => it.descricao)

  return {
    origem: 'xml',
    nfNumero: tagText(ide, 'nNF') || undefined,
    nfSerie: tagText(ide, 'serie') || undefined,
    chave,
    dataEmissao: dataEmissaoRaw ? dataEmissaoRaw.slice(0, 10) : undefined,
    valorTotalNota: icmsTot ? num(tagText(icmsTot, 'vNF')) : undefined,
    baseCalculoIcms: icmsTot ? num(tagText(icmsTot, 'vBC')) : undefined,
    valorIcms: icmsTot ? num(tagText(icmsTot, 'vICMS')) : undefined,
    baseCalculoIcmsSt: icmsTot ? num(tagText(icmsTot, 'vBCST')) : undefined,
    valorIcmsSt: icmsTot ? num(tagText(icmsTot, 'vST')) : undefined,
    valorIpi: icmsTot ? num(tagText(icmsTot, 'vIPI')) : undefined,
    valorPis: icmsTot ? num(tagText(icmsTot, 'vPIS')) : undefined,
    valorCofins: icmsTot ? num(tagText(icmsTot, 'vCOFINS')) : undefined,
    valorFrete: icmsTot ? num(tagText(icmsTot, 'vFrete')) : undefined,
    valorSeguro: icmsTot ? num(tagText(icmsTot, 'vSeg')) : undefined,
    valorDesconto: icmsTot ? num(tagText(icmsTot, 'vDesc')) : undefined,
    outrasDespesas: icmsTot ? num(tagText(icmsTot, 'vOutro')) : undefined,
    itens,
  }
}

// ── PDF (DANFE) — melhor esforço via texto ──────────────────────────────────

const numBr = (s: string) => {
  const v = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(v) ? v : 0
}

/** Primeiro número monetário (padrão brasileiro) até `janela` chars após o rótulo. */
function valorAposRotulo(texto: string, rotulos: string[], janela = 90): number | undefined {
  for (const rotulo of rotulos) {
    const idx = texto.search(new RegExp(rotulo, 'i'))
    if (idx < 0) continue
    const trecho = texto.slice(idx, idx + rotulo.length + janela)
    const m = trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}/)
    if (m) return numBr(m[0])
  }
  return undefined
}

async function extrairTextoPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  let texto = ''
  const maxPag = Math.min(pdf.numPages, 4)
  for (let i = 1; i <= maxPag; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texto += (content.items as Array<{ str?: string }>).map(it => it.str ?? '').join(' ') + '\n'
  }
  return texto
}

export function lerTextoDanfe(texto: string): LeituraImpostosNF | null {
  // Só tenta em documento que parece DANFE / NF-e de produto
  if (!/DANFE|DOCUMENTO AUXILIAR DA NOTA FISCAL/i.test(texto)) return null

  // Chave de acesso: 44 dígitos possivelmente com espaços/pontos
  let chave: string | undefined
  for (const run of texto.match(/\d[\d .]{40,80}\d/g) ?? []) {
    const d = run.replace(/\D/g, '')
    if (d.length === 44) { chave = d; break }
  }

  const leitura: LeituraImpostosNF = {
    origem: 'pdf',
    chave,
    nfNumero: chave ? String(parseInt(chave.slice(25, 34), 10)) : undefined,
    nfSerie: chave ? String(parseInt(chave.slice(22, 25), 10)) : undefined,
    valorTotalNota: valorAposRotulo(texto, ['VALOR TOTAL DA NOTA', 'V\\.? ?TOTAL DA NOTA']),
    baseCalculoIcms: valorAposRotulo(texto, ['BASE DE C[AÁ]LCULO DO ICMS(?! S)', 'BASE DE C[AÁ]LC\\.? DO ICMS(?! S)']),
    valorIcms: valorAposRotulo(texto, ['VALOR DO ICMS(?! SUBST)', 'VALOR TOTAL DO ICMS']),
    baseCalculoIcmsSt: valorAposRotulo(texto, ['BASE DE C[AÁ]LC\\.? (DO )?ICMS S\\.?T\\.?', 'BASE DE C[AÁ]LCULO (DO )?ICMS S\\.?T\\.?']),
    valorIcmsSt: valorAposRotulo(texto, ['VALOR DO ICMS SUBST', 'VALOR (DO )?ICMS S\\.?T\\.?']),
    valorIpi: valorAposRotulo(texto, ['VALOR TOTAL DO IPI', 'VALOR DO IPI']),
    valorPis: valorAposRotulo(texto, ['VALOR DO PIS']),
    valorCofins: valorAposRotulo(texto, ['VALOR DA COFINS', 'VALOR DO COFINS']),
    valorFrete: valorAposRotulo(texto, ['VALOR DO FRETE']),
    valorSeguro: valorAposRotulo(texto, ['VALOR DO SEGURO']),
    valorDesconto: valorAposRotulo(texto, ['DESCONTO']),
    outrasDespesas: valorAposRotulo(texto, ['OUTRAS DESPESAS']),
    itens: [],
  }

  // Sem nada aproveitável, descarta
  const temAlgo = leitura.valorTotalNota || leitura.valorIcms || leitura.chave
  return temAlgo ? leitura : null
}

// ── Leitura + gravação ───────────────────────────────────────────────────────

export async function lerImpostosNF(file: File): Promise<LeituraImpostosNF | null> {
  const nome = file.name.toLowerCase()
  try {
    if (nome.endsWith('.xml') || file.type.includes('xml')) {
      return lerXmlNFe(await file.text())
    }
    if (nome.endsWith('.pdf') || file.type.includes('pdf')) {
      return lerTextoDanfe(await extrairTextoPdf(file))
    }
  } catch {
    // leitura é best-effort: nunca quebra o fluxo de anexo
  }
  return null
}

/**
 * Lê os impostos do arquivo e pré-preenche cmp_pedido_impostos (+ itens, se XML)
 * do pedido. Não sobrescreve registro que já tenha valores lançados.
 * Retorna a leitura aplicada, ou null se nada foi gravado.
 */
export async function autoPreencherImpostosNF(
  pedidoId: string,
  file: File,
): Promise<LeituraImpostosNF | null> {
  const leitura = await lerImpostosNF(file)
  if (!leitura) return null

  // Já existe registro com algum valor? Não mexe.
  const { data: existente } = await supabase
    .from('cmp_pedido_impostos')
    .select('id, valor_total_nota, valor_icms, valor_icms_st, valor_ipi, valor_pis, valor_cofins')
    .eq('pedido_id', pedidoId)
    .eq('tipo_nota', 'nf_produto')
    .maybeSingle()
  const jaPreenchido = existente && (
    (existente.valor_total_nota ?? 0) + (existente.valor_icms ?? 0) + (existente.valor_icms_st ?? 0) +
    (existente.valor_ipi ?? 0) + (existente.valor_pis ?? 0) + (existente.valor_cofins ?? 0) > 0
  )
  if (jaPreenchido) return null

  const { data: header, error } = await supabase
    .from('cmp_pedido_impostos')
    .upsert({
      pedido_id: pedidoId,
      tipo_nota: 'nf_produto',
      nf_numero: leitura.nfNumero ?? null,
      nf_serie: leitura.nfSerie ?? null,
      nf_chave_acesso: leitura.chave ?? null,
      data_emissao: leitura.dataEmissao ?? null,
      valor_total_nota: leitura.valorTotalNota ?? 0,
      base_calculo_icms: leitura.baseCalculoIcms ?? 0,
      valor_icms: leitura.valorIcms ?? 0,
      base_calculo_icms_st: leitura.baseCalculoIcmsSt ?? 0,
      valor_icms_st: leitura.valorIcmsSt ?? 0,
      valor_ipi: leitura.valorIpi ?? 0,
      valor_pis: leitura.valorPis ?? 0,
      valor_cofins: leitura.valorCofins ?? 0,
      valor_frete: leitura.valorFrete ?? 0,
      valor_seguro: leitura.valorSeguro ?? 0,
      valor_desconto: leitura.valorDesconto ?? 0,
      outras_despesas: leitura.outrasDespesas ?? 0,
      observacao: leitura.origem === 'xml'
        ? 'Preenchido automaticamente pelo XML da NF-e anexada.'
        : 'Preenchido automaticamente pela leitura do PDF (DANFE) — confira os valores.',
    }, { onConflict: 'pedido_id,tipo_nota' })
    .select('id')
    .single()
  if (error || !header?.id) return null

  // Detalhe por item: só na leitura exata (XML)
  if (leitura.origem === 'xml' && leitura.itens.length > 0) {
    await supabase.from('cmp_pedido_impostos_itens').delete().eq('imposto_id', header.id)
    const linhas = leitura.itens
      .map(it => ({
        imposto_id: header.id,
        pedido_id: pedidoId,
        descricao: it.descricao,
        valor_item: it.valorItem,
        base_calculo_icms: it.baseCalculoIcms,
        valor_icms: it.valorIcms,
        valor_icms_st: it.valorIcmsSt,
        valor_ipi: it.valorIpi,
        valor_pis: it.valorPis,
        valor_cofins: it.valorCofins,
      }))
      .filter(l => l.base_calculo_icms + l.valor_icms + l.valor_icms_st + l.valor_ipi + l.valor_pis + l.valor_cofins > 0)
    if (linhas.length > 0) await supabase.from('cmp_pedido_impostos_itens').insert(linhas)
  }

  return leitura
}
