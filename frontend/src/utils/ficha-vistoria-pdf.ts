// ─────────────────────────────────────────────────────────────────────────────
// ficha-vistoria-pdf.ts — Ficha de campo para QUEM EXECUTA a vistoria.
//
// Não confundir com o vistoria-pdf.ts: aquele é o laudo (sai depois, com o
// resultado). Esta ficha sai ANTES, na etapa Pendente, e serve para o cara ir
// a campo sabendo onde é, com quem falar para entrar, o que já se sabe de
// pendência e a grade dos 64 pontos para riscar à mão se faltar sinal.
//
// Mesmo header corporativo do laudo de vistoria e do pedido de compra.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import { AMBIENTES_PADRAO, ITENS_POR_AMBIENTE } from '../components/locacao/VistoriaChecklist'
import type { LocEntrada, LocImovel } from '../types/locacao'

export interface FichaVistoriaData {
  entrada: LocEntrada
  imovel?: LocImovel | null
  tipo?: 'entrada' | 'saida'
}

const ESTADOS_COL = ['Ótimo', 'Bom', 'Regular', 'Ruim', 'N/A'] as const

function fmtDate(d?: string | null): string {
  if (!d) return ''
  const dt = new Date(d.length <= 10 ? d + 'T12:00:00' : d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

/** Prazo da vistoria = início previsto − 7 dias (mesma regra da tela). */
function limiteVistoria(inicio?: string | null): string {
  if (!inicio) return ''
  const dt = new Date(new Date(inicio + 'T12:00:00').getTime() - 7 * 86_400_000)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

/**
 * As fontes padrao do jsPDF sao WinAnsi (cp1252): emoji e simbolos fora dessa
 * tabela saem como lixo ("&þ") e ainda bagunçam o espaçamento da linha.
 * Como o texto vem de campo livre digitado por gente, sanear e obrigatorio.
 */
function winAnsi(txt: string): string {
  return txt
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    // emoji e pictogramas: fora com eles, inclusive os seletores de variacao
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2190}-\u{21FF}]/gu, '')
    .replace(/[^\u0000-\u00FF]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd()
}
/**
 * Encaixa a logo na caixa sem deformar. A caixa fixa antiga (18x28) esmagava
 * qualquer logo que nao fosse retrato — a da TEG e quase quadrada.
 */
function desenharLogo(doc: jsPDF, logo: string, x: number, y: number, maxW: number, maxH: number) {
  try {
    const prop = doc.getImageProperties(logo)
    const escala = Math.min(maxW / prop.width, maxH / prop.height)
    const w = prop.width * escala
    const h = prop.height * escala
    doc.addImage(logo, 'PNG', x + (maxW - w) / 2, y + (maxH - h) / 2, w, h)
  } catch { /* sem logo e melhor que logo torta */ }
}
function buildDoc(data: FichaVistoriaData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  const TEAL  = [13, 148, 136] as const
  const DARK  = [30, 41, 59] as const
  const MID   = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  const { entrada, imovel } = data
  const tipo = data.tipo ?? 'entrada'
  const imv = imovel ?? entrada.imovel
  const addr = imv?.endereco || entrada.endereco || ''
  const num = imv?.numero || entrada.numero || ''
  const compl = imv?.complemento || entrada.complemento || ''
  const bairro = imv?.bairro || entrada.bairro || ''
  const cidade = imv?.cidade || entrada.cidade || ''
  const uf = imv?.uf || entrada.uf || ''
  const cep = imv?.cep || entrada.cep || ''

  const checkPage = (needed = 10) => {
    if (y + needed > 272) { doc.addPage(); y = M }
  }

  const sectionTitle = (title: string) => {
    checkPage(16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text(title, M, y)
    y += 1.5
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, y, M + CW, y)
    y += 5
  }

  // Esta ficha e preenchida a mao quando a vistoria e manual: campo sem valor
  // ganha uma linha para escrever, nunca um traco (traco parece 'nao tem').
  // A linha vai no PE da celula: e sobre ela que se escreve, entao o texto
  // manuscrito precisa do espaco acima dela, nao abaixo.
  const linhaParaEscrever = (x: number, largura: number, base: number) => {
    doc.setDrawColor(...MID)
    doc.setLineWidth(0.35)
    doc.line(x, base, x + largura, base)
  }

  const par = (l1: string, v1: string, l2?: string, v2?: string) => {
    checkPage(12)
    const half = CW / 2
    const larg = half - 6
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MID)
    doc.text(l1.toUpperCase(), M, y)
    if (l2) doc.text(l2.toUpperCase(), M + half, y)
    y += 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...DARK)
    // campo em branco precisa de altura de escrita a mao, nao de leitura
    const alturaValor = (!v1 || (l2 && !v2)) ? 9 : 6
    const base = y + alturaValor - 2
    if (v1) doc.text(winAnsi(v1), M, y); else linhaParaEscrever(M, larg, base)
    if (l2) { if (v2) doc.text(winAnsi(v2), M + half, y); else linhaParaEscrever(M + half, larg, base) }
    y += alturaValor
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')
  if (logo) desenharLogo(doc, logo, M, 7, 44, 12)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
  doc.text(empresa.fantasia, M + 48, 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M + 48, 16)
  if (empresa.endereco) {
    doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M + 48, 21)
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('FICHA DE VISTORIA', W - M, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(180, 190, 200)
  doc.text(tipo === 'saida' ? 'Devolução de imóvel' : 'Entrada de imóvel', W - M, 19, { align: 'right' })
  doc.setFontSize(7)
  doc.text('Documento de apoio em campo', W - M, 25, { align: 'right' })
  y = 44

  // ── ONDE É ────────────────────────────────────────────────────────────────
  sectionTitle('IMÓVEL')
  const linha1 = [addr, num].filter(Boolean).join(', ') + (compl ? ` - ${compl}` : '')
  const linha2 = [bairro, [cidade, uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')
    + (cep ? ` · CEP ${cep}` : '')
  par('Endereço', linha1, 'Cidade / Bairro', linha2)
  par('Área total', imv?.area_m2 != null ? `${imv.area_m2} m²` : '',
      'Área construída', imv?.area_construida_m2 != null ? `${imv.area_construida_m2} m²` : '')
  par('Matrícula', imv?.matricula || '',
      'Aluguel', entrada.valor_aluguel != null
        ? entrada.valor_aluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : '')

  // Vem preenchido do que ja se sabe; em branco, o vistoriador conta e anota.
  const cont = (v?: number | null) => (v != null ? String(v) : '____')
  par('Contagens (banheiros / portas / janelas)',
      `${cont(imv?.qtd_banheiros)}  /  ${cont(imv?.qtd_portas)}  /  ${cont(imv?.qtd_janelas)}`,
      'IPTU', imv?.iptu_numero
        ? `${imv.iptu_numero}${imv.iptu_quitado == null ? '' : imv.iptu_quitado ? ' (quitado)' : ' (em aberto)'}`
        : '')

  // ── COMO ENTRAR ───────────────────────────────────────────────────────────
  sectionTitle('ACESSO E PRAZO')
  par('Locador', entrada.locador_nome || imv?.locador_nome || '',
      'Contato', imv?.locador_telefone || entrada.locador_contato || imv?.locador_contato || '')
  par('Início previsto', fmtDate(entrada.data_prevista_inicio),
      'Vistoria até', limiteVistoria(entrada.data_prevista_inicio))
  par('Locado até', fmtDate(entrada.prazo_fim),
      'Pretende renovar', entrada.renovacao === 'sim' ? 'Sim' : entrada.renovacao === 'nao' ? 'Não' : '(  ) Sim      (  ) Não')

  // ── O QUE JÁ SE SABE ──────────────────────────────────────────────────────
  // O texto de observações é onde ficam as pendências conhecidas (obra a fazer,
  // dados que faltam). Levar isso a campo é metade do valor da ficha.
  if (entrada.observacoes) {
    sectionTitle('OBSERVAÇÕES')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK)
    for (const linha of doc.splitTextToSize(winAnsi(entrada.observacoes), CW) as string[]) {
      checkPage(6)
      doc.text(linha, M, y)
      y += 4
    }
    y += 3
  }

  // ── GRADE 8 × 8 ───────────────────────────────────────────────────────────
  sectionTitle(`AVALIAÇÃO POR AMBIENTE (${AMBIENTES_PADRAO.length * ITENS_POR_AMBIENTE.length} pontos)`)
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
  doc.text('Marque o estado de cada item e use as duas linhas para anotar o que encontrar.', M, y)
  y += 6

  const colObs = 58                       // largura da coluna do item
  const boxW = 9
  const gap = (CW - colObs - ESTADOS_COL.length * boxW) // sobra vira coluna de observação
  const xEstado = (i: number) => M + colObs + i * boxW

  for (const ambiente of AMBIENTES_PADRAO) {
    checkPage(12 + ITENS_POR_AMBIENTE.length * 11 + 8)

    // faixa do ambiente
    doc.setFillColor(...DARK)
    doc.rect(M, y, CW, 6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255)
    doc.text(ambiente.toUpperCase(), M + 2, y + 4.2)
    y += 6

    // cabeçalho das colunas
    doc.setFillColor(241, 245, 249)
    doc.rect(M, y, CW, 5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...MID)
    doc.text('ITEM', M + 2, y + 3.4)
    ESTADOS_COL.forEach((e, i) => doc.text(e, xEstado(i) + boxW / 2, y + 3.4, { align: 'center' }))
    doc.text('OBSERVAÇÃO', xEstado(ESTADOS_COL.length) + 2, y + 3.4)
    y += 5

    for (const item of ITENS_POR_AMBIENTE) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK)
      doc.text(item, M + 2, y + 4.2)

      // quadradinho: e onde a caneta vai bater, entao precisa ser visivel
      doc.setDrawColor(...MID); doc.setLineWidth(0.4)
      ESTADOS_COL.forEach((_, i) => doc.rect(xEstado(i) + boxW / 2 - 1.9, y + 2.1, 3.8, 3.8))

      // DUAS linhas de observação por item — uma so nao cabe caneta
      const xObs = xEstado(ESTADOS_COL.length) + 2
      doc.setDrawColor(...MID); doc.setLineWidth(0.35)
      doc.line(xObs, y + 4.6, M + CW - 2, y + 4.6)
      doc.line(xObs, y + 9.4, M + CW - 2, y + 9.4)

      // separador entre itens: so organiza a leitura, fica no fundo
      y += 11
      doc.setDrawColor(...LIGHT); doc.setLineWidth(0.15)
      doc.line(M, y, M + CW, y)
    }
    y += 4
  }
  void gap

  // ── ASSINATURA ────────────────────────────────────────────────────────────
  checkPage(30)
  y += 6
  doc.setDrawColor(...DARK); doc.setLineWidth(0.3)
  const halfSig = CW / 2 - 8
  doc.line(M, y, M + halfSig, y)
  doc.line(M + CW - halfSig, y, M + CW, y)
  y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
  doc.text('Vistoriador (nome e assinatura)', M, y)
  doc.text('Acompanhante / responsável no local', M + CW - halfSig, y)
  y += 6
  doc.text(`Data da vistoria: ____ / ____ / ________`, M, y)

  // ── RODAPÉ EM TODAS AS PÁGINAS ────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  const agora = new Date().toLocaleString('pt-BR')
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MID)
    doc.text(`TEG+ ERP · ${empresa.fantasia} · Ficha gerada em ${agora}`, M, 288)
    doc.text(`${p}/${total}`, W - M, 288, { align: 'right' })
  }

  return doc
}

export function getFichaVistoriaFileName(data: FichaVistoriaData): string {
  const imv = data.imovel ?? data.entrada.imovel
  const base = (imv?.endereco || data.entrada.endereco || 'imovel')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `ficha-vistoria-${data.tipo ?? 'entrada'}-${base}.pdf`
}

/** Bytes do PDF — mesmo desenho do download, sem depender do browser. */
export async function gerarFichaVistoriaBlob(data: FichaVistoriaData): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png')
    ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  return buildDoc(data, empresa, logo).output('blob')
}

export async function downloadFichaVistoriaPdf(data: FichaVistoriaData): Promise<void> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64('/logo-teg-transicao-branca.png')
    ?? (empresa.logoUrl ? await loadLogoBase64(empresa.logoUrl) : null)
  const doc = buildDoc(data, empresa, logo)
  doc.save(getFichaVistoriaFileName(data))
}
