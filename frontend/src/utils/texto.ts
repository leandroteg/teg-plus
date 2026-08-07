// texto.ts — normalizacoes de texto compartilhadas.

/** Siglas e termos que ficam em CAIXA ALTA por convencao juridica/cadastral e
 *  nao podem ser rebaixados junto com o resto da frase. */
const CAIXA_ALTA_OK = new Set([
  // Nada de 'OS', 'ME', 'AS', 'NO': colidem com artigo/pronome e o texto sai
  // com uma palavra gritando no meio da frase ('gerenciar OS processos').
  'CNPJ', 'CPF', 'CEP', 'LTDA', 'EPP', 'EIRELI', 'TEG', 'CLT', 'INSS', 'FGTS',
  'IRRF', 'NFE', 'ART', 'CREA', 'CRM', 'OAB', 'EPI', 'EPIS', 'SSMA', 'QSMA',
  'KPI', 'KPIS', 'LGPD', 'SSP', 'SEJUSP', 'CEMIG', 'CONTRATANTE', 'CONTRATADA',
  'CONTRATADO', 'CONTRATANTES', 'CONTRATADAS', 'CONTRATADOS',
])

/**
 * Converte trechos escritos inteiros em CAIXA ALTA para caixa de frase.
 *
 * O ERP forca uppercase em todo input de texto (ver installGlobalUppercase em
 * main.tsx), entao objeto, escopo e justificativa chegam gritando ao banco.
 * Jogado direto no corpo de um contrato, o paragrafo inteiro sai em maiuscula.
 *
 * Regras: so mexe em trecho SEM NENHUMA minuscula (se ja tem, o autor escolheu
 * o que destacar) e com 4+ palavras (frases curtas costumam ser rotulo, titulo
 * ou sigla). Siglas da lista acima e tokens que comecam com digito ficam como
 * estao.
 */
export function normalizarCaixaAlta(txt?: string | null): string {
  if (!txt) return ''
  const trechos = txt.match(/[^.;:!?]+[.;:!?]*\s*/g) ?? [txt]
  return trechos.map(trecho => {
    const palavras = trecho.trim().split(/\s+/).filter(Boolean)
    if (palavras.length < 4) return trecho
    if (/[a-zà-öø-ÿ]/.test(trecho)) return trecho
    const espacoFinal = trecho.slice(trecho.trimEnd().length)
    const convertidas = palavras.map(p => {
      const nu = p.replace(/[^A-ZÀ-Þ0-9]/g, '')
      if (CAIXA_ALTA_OK.has(nu)) return p
      if (/^\d/.test(p)) return p
      return p.toLocaleLowerCase('pt-BR')
    }).join(' ')
    return convertidas.charAt(0).toLocaleUpperCase('pt-BR') + convertidas.slice(1) + espacoFinal
  }).join('')
}
