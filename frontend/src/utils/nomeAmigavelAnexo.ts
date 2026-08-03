// ─────────────────────────────────────────────────────────────────────────────
// utils/nomeAmigavelAnexo.ts — Renomeia o anexo do pedido para leitura humana.
//
// DANFE sai do emissor com a chave de acesso como nome ("31260830927398...-nfe.pdf").
// Aqui a chave é lida (do próprio nome do arquivo, do XML ou do texto do PDF) e
// vira algo como "NFe 3778 - MERCEARIA CENTRO RIO.pdf".
//
// Layout da chave (44 dígitos): cUF(2) AAMM(4) CNPJ(14) mod(2) série(3)
// nNF(9) tpEmis(1) cNF(8) cDV(1).
//
// Best-effort: se nada for reconhecido, mantém o nome original.
// ─────────────────────────────────────────────────────────────────────────────

const soDigitos = (s: string) => s.replace(/\D/g, '')

export interface DadosChaveNFe {
  chave: string
  modelo: string
  serie: string
  numero: string
  cnpjEmitente: string
}

/** Extrai a chave de acesso (44 dígitos) de um texto, tolerando espaços/pontos. */
export function extrairChaveNFe(texto: string): string | null {
  const runs = texto.match(/\d[\d .-]{40,90}\d/g) ?? []
  for (const run of runs) {
    const d = soDigitos(run)
    if (d.length === 44) return d
    // Chave colada a outros dígitos (ex.: nome de arquivo "…-nfe"): varre janelas
    if (d.length > 44) {
      for (let i = 0; i + 44 <= d.length; i++) {
        const win = d.slice(i, i + 44)
        if (win.slice(20, 22) === '55' || win.slice(20, 22) === '65') return win
      }
    }
  }
  return null
}

export function dadosDaChave(chave: string): DadosChaveNFe | null {
  if (chave.length !== 44) return null
  const modelo = chave.slice(20, 22)
  if (modelo !== '55' && modelo !== '65') return null
  return {
    chave,
    modelo,
    serie: String(Number(chave.slice(22, 25))),
    numero: String(Number(chave.slice(25, 34))),
    cnpjEmitente: chave.slice(6, 20),
  }
}

/** Nome curto do fornecedor: 4 primeiras palavras, sem sufixo societário. */
const RE_ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g')

function fornecedorCurto(nome?: string | null): string {
  const limpo = (nome ?? '')
    .normalize('NFD').replace(RE_ACENTOS, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 &.-]/g, ' ')
    .replace(/\b(LTDA|ME|EPP|EIRELI|S[.\s]?A|COMERCIO|COMERCIAL|E|DE|DA|DO)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpo.split(' ').filter(w => /[A-Z0-9]/.test(w)).slice(0, 4).join(' ').slice(0, 40)
}

const extensaoDe = (nome: string) => {
  const m = nome.match(/\.([A-Za-z0-9]{1,5})$/)
  return m ? `.${m[1].toLowerCase()}` : ''
}

async function textoDoArquivo(file: File): Promise<string> {
  const nome = file.name.toLowerCase()
  if (file.type.includes('xml') || nome.endsWith('.xml')) return file.text()
  if (!file.type.includes('pdf') && !nome.endsWith('.pdf')) return ''
  const pdfjsLib = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  let texto = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    texto += (content.items as Array<{ str?: string }>).map(it => it.str ?? '').join(' ') + '\n'
  }
  return texto
}

/** nNF/serie do XML da NF-e — mais confiável que a chave quando disponível. */
function dadosDoXml(texto: string): { numero: string; serie: string; modelo: string } | null {
  const nNF = texto.match(/<nNF>\s*(\d+)\s*<\/nNF>/)?.[1]
  if (!nNF) return null
  return {
    numero: String(Number(nNF)),
    serie: String(Number(texto.match(/<serie>\s*(\d+)\s*<\/serie>/)?.[1] ?? '1')),
    modelo: texto.match(/<mod>\s*(\d+)\s*<\/mod>/)?.[1] ?? '55',
  }
}

/**
 * Gera o nome de exibição do anexo. O arquivo no Storage não muda — só o
 * `nome_arquivo` gravado em cmp_pedidos_anexos.
 */
export async function gerarNomeAmigavelAnexo(
  file: File,
  tipo: string,
  fornecedorNome?: string | null,
): Promise<string> {
  const ext = extensaoDe(file.name)
  const forn = fornecedorCurto(fornecedorNome)
  const sufixoForn = forn ? ` - ${forn}` : ''

  if (tipo === 'nota_fiscal') {
    // 1) chave no próprio nome do arquivo (caso mais comum do DANFE)
    let dados = dadosDaChave(extrairChaveNFe(file.name) ?? '')
    let numero = dados?.numero
    let serie = dados?.serie
    let modelo = dados?.modelo

    // 2) conteúdo do arquivo (XML tem nNF/serie explícitos; PDF tem a chave)
    if (!numero) {
      try {
        const texto = await textoDoArquivo(file)
        const xml = dadosDoXml(texto)
        if (xml) {
          numero = xml.numero; serie = xml.serie; modelo = xml.modelo
        } else {
          dados = dadosDaChave(extrairChaveNFe(texto) ?? '')
          numero = dados?.numero; serie = dados?.serie; modelo = dados?.modelo
        }
      } catch { /* segue com o nome original */ }
    }

    if (numero) {
      const rotulo = modelo === '65' ? 'NFCe' : 'NFe'
      const parteSerie = serie && serie !== '1' ? ` serie ${serie}` : ''
      return `${rotulo} ${numero}${parteSerie}${sufixoForn}${ext}`
    }
    return file.name
  }

  if (tipo === 'boleto' && forn) return `Boleto${sufixoForn}${ext}`

  return file.name
}
