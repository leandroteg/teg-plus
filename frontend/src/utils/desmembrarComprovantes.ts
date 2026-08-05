// ─────────────────────────────────────────────────────────────────────────────
// utils/desmembrarComprovantes.ts — Recebe UM PDF com vários comprovantes de
// pagamento (o arquivo que o banco devolve para a remessa do lote) e descobre,
// página a página, a qual título aquele comprovante pertence.
//
// O casamento é por CONTEÚDO, não por ordem: banco costuma emitir página de
// capa/resumo e nem sempre respeita a ordem do arquivo enviado. Dois sinais,
// nessa prioridade:
//   1. documento do favorecido (CNPJ/CPF) — o mais discriminante
//   2. valor do título (R$ 1.234,56 / 1234.56 / 1.234,56)
//
// Só vira match automático quando UM único título casa. Empate (dois títulos
// com mesmo valor e mesmo favorecido) volta como ambíguo, para a tela de
// conferência resolver — nunca chuta.
//
// Tudo client-side: pdf.js lê o texto (mesmo worker de lib/pdfRender.ts) e
// pdf-lib recorta a página. Nada disso sobe pro servidor antes da confirmação.
// ─────────────────────────────────────────────────────────────────────────────

export interface TituloParaCasar {
  cpId: string
  fornecedorNome: string
  /** CNPJ/CPF do favorecido, como estiver cadastrado (com ou sem máscara). */
  documento?: string | null
  valor: number
}

export type MotivoMatch = 'documento_e_valor' | 'documento' | 'valor' | 'ambiguo' | 'sem_match'

export interface PaginaComprovante {
  /** 1-based, como o usuário enxerga no leitor de PDF. */
  pagina: number
  texto: string
  /** cpId escolhido automaticamente; null quando ambíguo ou sem match. */
  cpIdSugerido: string | null
  motivo: MotivoMatch
  /** Candidatos quando houve empate — a tela usa para montar o seletor. */
  candidatos: string[]
}

const soDigitos = (s: string) => s.replace(/\D/g, '')

/** Normaliza para comparação: sem acento, maiúsculo, só alfanumérico e espaço. */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Texto de cada página. O extrator quebra números no meio ("1.234, 56"), então
 * devolvemos também uma versão sem espaços, usada só para achar valor/documento.
 */
async function textoPorPagina(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const paginas: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    paginas.push((content.items as Array<{ str?: string }>).map(it => it.str ?? '').join(' '))
  }
  return paginas
}

/** Todos os CNPJ/CPF plausíveis do texto (com máscara, nus, ou partidos pelo extrator). */
function documentosDoTexto(texto: string): Set<string> {
  const compacto = texto.replace(/\s+/g, '')
  const achados = new Set<string>()
  // 14 dígitos (CNPJ) e 11 (CPF), com ou sem máscara
  for (const m of compacto.matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) achados.add(soDigitos(m[0]))
  for (const m of compacto.matchAll(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g)) achados.add(soDigitos(m[0]))
  return achados
}

/** Todos os valores monetários do texto, em centavos (evita float). */
function valoresDoTexto(texto: string): Set<number> {
  const compacto = texto.replace(/\s+/g, '')
  const achados = new Set<number>()
  // 1.234,56 | 1234,56 | 1,234.56 | 1234.56
  for (const m of compacto.matchAll(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g)) {
    achados.add(Math.round(parseFloat(m[0].replace(/\./g, '').replace(',', '.')) * 100))
  }
  for (const m of compacto.matchAll(/\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/g)) {
    achados.add(Math.round(parseFloat(m[0].replace(/,/g, '')) * 100))
  }
  return achados
}

/**
 * Casa cada página com um título. Não escreve nada — só devolve o plano, que a
 * tela de conferência mostra e o usuário ajusta antes de gravar.
 */
export async function analisarComprovantes(
  file: File,
  titulos: TituloParaCasar[],
): Promise<PaginaComprovante[]> {
  const paginas = await textoPorPagina(file)

  return paginas.map((texto, idx) => {
    const docsPagina = documentosDoTexto(texto)
    const valoresPagina = valoresDoTexto(texto)
    const nomePagina = normalizar(texto)

    const pontuados = titulos.map(t => {
      const docTitulo = t.documento ? soDigitos(t.documento) : ''
      const casaDoc = docTitulo.length >= 11 && docsPagina.has(docTitulo)
      const casaValor = valoresPagina.has(Math.round(t.valor * 100))
      // Nome só desempata; sozinho não decide (razão social aparece cortada).
      const primeiroNome = normalizar(t.fornecedorNome).split(' ')[0] ?? ''
      const casaNome = primeiroNome.length >= 4 && nomePagina.includes(primeiroNome)
      return { cpId: t.cpId, casaDoc, casaValor, casaNome }
    })

    const docEValor = pontuados.filter(p => p.casaDoc && p.casaValor)
    if (docEValor.length === 1) {
      return { pagina: idx + 1, texto, cpIdSugerido: docEValor[0].cpId, motivo: 'documento_e_valor', candidatos: [] }
    }
    if (docEValor.length > 1) {
      return { pagina: idx + 1, texto, cpIdSugerido: null, motivo: 'ambiguo', candidatos: docEValor.map(p => p.cpId) }
    }

    const soDoc = pontuados.filter(p => p.casaDoc)
    if (soDoc.length === 1) {
      return { pagina: idx + 1, texto, cpIdSugerido: soDoc[0].cpId, motivo: 'documento', candidatos: [] }
    }

    const soValor = pontuados.filter(p => p.casaValor)
    if (soValor.length === 1) {
      return { pagina: idx + 1, texto, cpIdSugerido: soValor[0].cpId, motivo: 'valor', candidatos: [] }
    }
    if (soValor.length > 1) {
      // Mesmo valor em vários títulos: o nome do favorecido decide se sobrar um.
      const comNome = soValor.filter(p => p.casaNome)
      if (comNome.length === 1) {
        return { pagina: idx + 1, texto, cpIdSugerido: comNome[0].cpId, motivo: 'valor', candidatos: [] }
      }
      return { pagina: idx + 1, texto, cpIdSugerido: null, motivo: 'ambiguo', candidatos: soValor.map(p => p.cpId) }
    }

    if (soDoc.length > 1) {
      return { pagina: idx + 1, texto, cpIdSugerido: null, motivo: 'ambiguo', candidatos: soDoc.map(p => p.cpId) }
    }

    return { pagina: idx + 1, texto, cpIdSugerido: null, motivo: 'sem_match', candidatos: [] }
  })
}

/**
 * Recorta uma página (1-based) num PDF novo de página única.
 * O nome do arquivo já sai legível — é ele que vai aparecer na lista de anexos.
 */
export async function recortarPagina(file: File, pagina: number, nomeBase: string): Promise<File> {
  const { PDFDocument } = await import('pdf-lib')
  const origem = await PDFDocument.load(await file.arrayBuffer())
  const destino = await PDFDocument.create()
  const [copiada] = await destino.copyPages(origem, [pagina - 1])
  destino.addPage(copiada)
  const bytes = await destino.save()

  const nomeLimpo = nomeBase.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Comprovante'
  // BlobPart tipado: o save() devolve Uint8Array, que o File aceita direto.
  return new File([bytes as BlobPart], `${nomeLimpo}.pdf`, { type: 'application/pdf' })
}
