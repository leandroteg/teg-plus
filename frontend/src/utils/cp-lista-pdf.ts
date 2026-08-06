// ─────────────────────────────────────────────────────────────────────────────
// cp-lista-pdf.ts — Relatório da lista do Contas a Pagar (CPPipeline)
//
// Espelha a tela: mesma etapa, mesmos filtros, mesma ordenação e as mesmas
// colunas (Empresa, Fornecedor, Descrição, Obra, Origem, CC, Pedido, Venc.,
// Valor). Diferente do pagamentos-previstos-pdf.ts, que agrupa por faixa de
// vencimento e serve à diretoria — aqui o usuário quer levar embora exatamente
// o que está vendo, linha a linha, para conferência.
//
// A página monta as linhas (é ela que resolve apelido de empresa, urgência e
// valor a pagar); este módulo só desenha.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface LinhaRelatorioCP {
  empresa: string
  fornecedor: string
  /** Selos que aparecem ao lado do fornecedor na tela: Cmp, Log, Urg, Devolvido. */
  selos?: string[]
  descricao: string
  obra: string
  origem: string
  centroCusto: string
  pedido: string
  /** ISO (yyyy-mm-dd); na tela pago mostra a data de pagamento. */
  vencimento: string
  urgencia: 'overdue' | 'today' | 'week' | 'normal'
  /** Face do título — só sai impresso quando difere do valor a pagar. */
  valorOriginal: number
  valorAPagar: number
}

/**
 * Bloco com subtotal próprio. Nas abas de lote a tela mostra lotes, não
 * títulos: o papel útil é a relação de cada lote com os seus itens.
 */
export interface GrupoRelatorioCP {
  titulo: string
  subtitulo?: string
  linhas: LinhaRelatorioCP[]
}

export interface RelatorioCPMeta {
  /** Aba do pipeline: Previstos, Confirmados, Em Aprovação... */
  etapa: string
  /** Filtros ativos, já legíveis: "Empresa: Todas", "Vencimento: 7 dias"... */
  filtros: string[]
  /** Só quando o usuário exportou uma seleção manual. */
  selecao?: boolean
}

/** Lista corrida (abas de título) ou blocos por lote (abas de lote). */
export type ConteudoRelatorioCP = LinhaRelatorioCP[] | GrupoRelatorioCP[]

function normalizarGrupos(conteudo: ConteudoRelatorioCP): GrupoRelatorioCP[] {
  if (conteudo.length === 0) return [{ titulo: '', linhas: [] }]
  return 'linhas' in conteudo[0]
    ? conteudo as GrupoRelatorioCP[]
    : [{ titulo: '', linhas: conteudo as LinhaRelatorioCP[] }]
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
  } catch {
    return null
  }
}

const fmtMoeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d?: string) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('pt-BR') : '—'
const hoje = () => new Date().toISOString().slice(0, 10)

const W = 297, H = 210, M = 12, CW = W - 2 * M

const DARK = [30, 41, 59] as const
const MID = [100, 116, 139] as const
const LIGHT = [148, 163, 184] as const
const TEAL = [13, 148, 136] as const
const RED = [220, 38, 38] as const
const AMBER = [180, 83, 9] as const

type RGB = readonly [number, number, number]
/** jsPDF nao aceita spread de uniao de tuplas — canaliza a cor por aqui. */
const txt = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2])
const linha = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
const fundo = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2])

// Larguras somam os 273mm úteis da paisagem A4
const COLS = [
  { key: 'empresa',    label: 'EMPRESA',    w: 22 },
  { key: 'fornecedor', label: 'FORNECEDOR', w: 58 },
  { key: 'descricao',  label: `DESCRIÇÃO`, w: 62 },
  { key: 'obra',       label: 'OBRA',       w: 26 },
  { key: 'origem',     label: 'ORIGEM',     w: 16 },
  { key: 'cc',         label: 'CC',         w: 16 },
  { key: 'pedido',     label: 'PEDIDO',     w: 28 },
  { key: 'venc',       label: 'VENC.',      w: 18, right: true },
  { key: 'valor',      label: 'VALOR',      w: 27, right: true },
] as const

const X: Record<string, number> = {}
{
  let acc = M
  for (const c of COLS) { X[c.key] = acc; acc += c.w }
}
const colRight = (key: string) => X[key] + (COLS.find(c => c.key === key)?.w ?? 0) - 2

/** Corta no limite da coluna — na tela o texto é truncado, no papel também. */
function ellipsis(doc: jsPDF, texto: string, larguraMm: number) {
  const limite = larguraMm - 2.5
  if (doc.getTextWidth(texto) <= limite) return texto
  let corte = texto
  while (corte.length > 1 && doc.getTextWidth(corte + '…') > limite) corte = corte.slice(0, -1)
  return corte + '…'
}

function buildDoc(
  conteudo: ConteudoRelatorioCP,
  meta: RelatorioCPMeta,
  empresa: EmpresaData,
  logo: string | null,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  let y = 0

  const grupos = normalizarGrupos(conteudo)
  const linhas = grupos.flatMap(g => g.linhas)
  const total = linhas.reduce((s, l) => s + l.valorAPagar, 0)
  const vencidos = linhas.filter(l => l.urgencia === 'overdue')
  const venceHoje = linhas.filter(l => l.urgencia === 'today')

  const desenharCabecalho = () => {
    fundo(doc, DARK)
    doc.rect(0, 0, W, 26, 'F')
    if (logo) { try { doc.addImage(logo, 'PNG', M, 3, 14, 19) } catch { /* logo é enfeite */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
    doc.text(empresa.fantasia, M + 18, 11)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(180, 190, 200)
    doc.text(`CNPJ: ${empresa.cnpj}`, M + 18, 15.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(255, 255, 255)
    doc.text(`CONTAS A PAGAR · ${meta.etapa.toUpperCase()}`, W - M, 11, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(180, 190, 200)
    doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`, W - M, 16, { align: 'right' })
    y = 31
  }

  const desenharColunas = () => {
    doc.setFillColor(248, 250, 252)
    doc.rect(M, y - 3.5, CW, 6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); txt(doc, MID)
    for (const c of COLS) {
      if ((c as { right?: boolean }).right) doc.text(c.label, colRight(c.key), y, { align: 'right' })
      else doc.text(c.label, X[c.key], y)
    }
    y += 5
  }

  const novaPagina = () => {
    doc.addPage()
    desenharCabecalho()
    desenharColunas()
  }

  desenharCabecalho()

  // ── Filtros aplicados + resumo ──
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); txt(doc, MID)
  const filtros = [...meta.filtros]
  if (meta.selecao) filtros.push('Somente os títulos selecionados')
  doc.text(ellipsis(doc, filtros.join('   ·   '), CW - 90), M, y)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); txt(doc, DARK)
  const resumo = `${linhas.length} título${linhas.length !== 1 ? 's' : ''}`
  doc.text(resumo, W - M - 45, y, { align: 'right' })
  txt(doc, TEAL); doc.setFontSize(9)
  doc.text(fmtMoeda(total), W - M, y, { align: 'right' })
  y += 4.5

  if (vencidos.length > 0 || venceHoje.length > 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    const alertas: string[] = []
    if (vencidos.length) alertas.push(`${vencidos.length} vencido(s) · ${fmtMoeda(vencidos.reduce((s, l) => s + l.valorAPagar, 0))}`)
    if (venceHoje.length) alertas.push(`${venceHoje.length} vence(m) hoje · ${fmtMoeda(venceHoje.reduce((s, l) => s + l.valorAPagar, 0))}`)
    txt(doc, vencidos.length ? RED : AMBER)
    doc.text(alertas.join('   ·   '), M, y)
    y += 4
  }

  y += 1
  const porGrupo = grupos.some(g => g.titulo)
  if (!porGrupo) desenharColunas()

  /** Faixa de abertura do bloco — nas abas de lote, o cabeçalho de cada lote. */
  const desenharFaixaGrupo = (g: GrupoRelatorioCP) => {
    if (y + 20 > H - 16) { doc.addPage(); desenharCabecalho() }
    fundo(doc, [241, 245, 249])
    doc.roundedRect(M, y - 3.5, CW, 7, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); txt(doc, DARK)
    doc.text(ellipsis(doc, g.titulo, CW - 70), M + 2, y + 1)
    const subtotal = g.linhas.reduce((s, l) => s + l.valorAPagar, 0)
    doc.text(
      `${g.linhas.length} título${g.linhas.length !== 1 ? 's' : ''} · ${fmtMoeda(subtotal)}`,
      W - M - 2, y + 1, { align: 'right' },
    )
    y += 8
    if (g.subtitulo) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); txt(doc, MID)
      doc.text(ellipsis(doc, g.subtitulo, CW), M + 2, y)
      y += 4
    }
    desenharColunas()
  }

  // ── Linhas ──
  for (const grupo of grupos) {
    if (porGrupo) desenharFaixaGrupo(grupo)
    for (const l of grupo.linhas) {
      // Descrição quebra linha em vez de cortar: observações longas (rastro de
      // migração, instruções de pagamento) perdiam justamente o final útil.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8)
      const descLinhas = (doc.splitTextToSize(l.descricao || '—', COLS[2].w - 2.5) as string[]).slice(0, 5)
      const temAjuste = Math.abs(l.valorAPagar - l.valorOriginal) > 0.001
      const alturaLinha = Math.max(temAjuste ? 6 : 5, descLinhas.length * 2.9 + 2.1)
      if (y + alturaLinha > H - 16) novaPagina()

      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); txt(doc, LIGHT)
      doc.text(ellipsis(doc, l.empresa || '—', COLS[0].w), X.empresa, y)

      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); txt(doc, DARK)
      const selos = l.selos?.length ? `  [${l.selos.join(' · ')}]` : ''
      doc.text(ellipsis(doc, `${l.fornecedor}${selos}`, COLS[1].w), X.fornecedor, y)

      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); txt(doc, MID)
      doc.text(descLinhas, X.descricao, y, { lineHeightFactor: 1.25 })
      doc.text(ellipsis(doc, l.obra || '—', COLS[3].w), X.obra, y)
      doc.text(ellipsis(doc, l.origem || '—', COLS[4].w), X.origem, y)
      doc.text(ellipsis(doc, l.centroCusto || '—', COLS[5].w), X.cc, y)

      txt(doc, l.pedido ? TEAL : LIGHT)
      doc.text(ellipsis(doc, l.pedido || '—', COLS[6].w), X.pedido, y)

      txt(doc, l.urgencia === 'overdue' ? RED : l.urgencia === 'today' ? AMBER : MID)
      if (l.urgencia === 'overdue' || l.urgencia === 'today') doc.setFont('helvetica', 'bold')
      doc.text(fmtData(l.vencimento), colRight('venc'), y, { align: 'right' })

      // Valor: com ajuste, a face do título vai riscada em cima do valor a pagar
      if (temAjuste) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); txt(doc, LIGHT)
        const bruto = fmtMoeda(l.valorOriginal)
        doc.text(bruto, colRight('valor'), y - 2.4, { align: 'right' })
        const larg = doc.getTextWidth(bruto)
        linha(doc, LIGHT); doc.setLineWidth(0.15)
        doc.line(colRight('valor') - larg, y - 3.2, colRight('valor'), y - 3.2)
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
      txt(doc, l.urgencia === 'overdue' ? RED : DARK)
      doc.text(fmtMoeda(l.valorAPagar), colRight('valor'), y, { align: 'right' })

      y += alturaLinha
      doc.setDrawColor(241, 245, 249); doc.setLineWidth(0.2)
      doc.line(M, y - 2, W - M, y - 2)
    }
    if (porGrupo) y += 4
  }

  // ── Total ──
  if (y > H - 20) novaPagina()
  y += 2
  linha(doc, TEAL); doc.setLineWidth(0.5)
  doc.line(M, y, W - M, y)
  y += 5.5
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); txt(doc, DARK)
  doc.text(`TOTAL · ${linhas.length} título${linhas.length !== 1 ? 's' : ''}`, M, y)
  txt(doc, TEAL); doc.setFontSize(10)
  doc.text(fmtMoeda(total), W - M, y, { align: 'right' })

  // ── Rodapé com paginação ──
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p += 1) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(180, 180, 180)
    doc.text(`TEG+ ERP · ${empresa.fantasia} · Contas a Pagar — ${meta.etapa}`, M, H - 6)
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 6, { align: 'right' })
  }

  return doc
}

export async function gerarRelatorioCPPdfBlob(
  conteudo: ConteudoRelatorioCP,
  meta: RelatorioCPMeta,
): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64(empresa.logoUrl)
  return buildDoc(conteudo, meta, empresa, logo).output('blob')
}

export async function downloadRelatorioCPPdf(
  conteudo: ConteudoRelatorioCP,
  meta: RelatorioCPMeta,
): Promise<void> {
  const blob = await gerarRelatorioCPPdfBlob(conteudo, meta)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const etapaSlug = meta.etapa.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').toLowerCase()
  a.download = `contas-a-pagar-${etapaSlug}-${hoje()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
