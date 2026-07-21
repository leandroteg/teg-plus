// ─────────────────────────────────────────────────────────────────────────────
// inspecao-pdf.ts — Relatório de Inspeção de Segurança (QSMA) em papel timbrado.
// Header corporativo TEG (logo + CNPJ), dados da execução (obra/executor/data/
// GPS/veredito), tabela item a item com respostas e NCs, fotos embutidas e campo
// de assinatura. Mesmo padrão visual da Ficha de EPI / Termo de Cautela.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'

export interface InspecaoPdfItem {
  ordem: number
  texto: string
  resposta?: string            // 'c' | 'nc' | 'na' | texto | número
  obs?: string
  fotoUrls?: string[]          // URLs (signed) das fotos da NC
}

export interface InspecaoPdfData {
  codigo?: string
  checklistNome?: string
  grupo?: string
  obraNome?: string
  frente?: string
  executorNome?: string
  dataExecucao?: string        // ISO
  gps?: { lat: number; lng: number } | null
  veredito?: 'liberado' | 'bloqueado' | null
  observacoes?: string
  itens: InspecaoPdfItem[]
}

async function urlToBase64(url: string): Promise<string | null> {
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

function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return iso }
}

const RESP_LABEL: Record<string, { txt: string; rgb: readonly [number, number, number] }> = {
  c:  { txt: 'CONFORME',     rgb: [16, 185, 129] },
  nc: { txt: 'NÃO CONFORME', rgb: [220, 38, 38] },
  na: { txt: 'N/A',          rgb: [100, 116, 139] },
}

async function buildDoc(data: InspecaoPdfData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M
  const RED = [220, 38, 38] as const
  const DARK = [30, 41, 59] as const
  const MID = [100, 116, 139] as const

  const checkPage = (need = 10) => { if (y + need > 280) { doc.addPage(); y = M } }
  const sectionTitle = (t: string) => {
    checkPage(14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...RED)
    doc.text(t, M, y); y += 1
    doc.setDrawColor(...RED); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 5
  }
  const fieldPair = (l1: string, v1: string, l2: string, v2: string) => {
    const h = CW / 2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MID)
    doc.text(l1, M, y); doc.text(l2, M + h, y); y += 4
    doc.setFontSize(10); doc.setTextColor(...DARK)
    doc.text(v1 || '—', M, y); doc.text(v2 || '—', M + h, y); y += 6
  }

  // ── Header ──
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 34, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 3, 18, 28) } catch { /* */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
  doc.text(empresa.fantasia, M + 22, 11)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M + 22, 16)
  if (empresa.endereco) doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M + 22, 21)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255)
  doc.text('RELATÓRIO DE INSPEÇÃO', W - M, 12, { align: 'right' })
  doc.setFontSize(8); doc.setTextColor(180, 190, 200)
  doc.text('Inspeção de Segurança — QSMA', W - M, 17, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.text(data.codigo ?? '', W - M, 23, { align: 'right' })
  y = 42

  // ── Dados ──
  sectionTitle('DADOS DA INSPEÇÃO')
  fieldPair('Checklist', `${data.checklistNome ?? '—'}`, 'Grupo / Tipo de Guia', data.grupo ?? '—')
  fieldPair('Obra', data.obraNome ?? '—', 'Frente', data.frente ?? '—')
  fieldPair('Executor', data.executorNome ?? '—', 'Data / Hora', fmtDateTime(data.dataExecucao))
  fieldPair('Localização (GPS)', data.gps ? `${data.gps.lat.toFixed(5)}, ${data.gps.lng.toFixed(5)}` : '—',
    'Veredito', data.veredito ? (data.veredito === 'liberado' ? 'LIBERADO' : 'BLOQUEADO') : '—')

  // faixa de veredito colorida
  if (data.veredito) {
    checkPage(12)
    const [cr, cg, cb] = data.veredito === 'liberado' ? [16, 185, 129] : [220, 38, 38]
    doc.setFillColor(cr, cg, cb); doc.roundedRect(M, y - 2, CW, 9, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
    doc.text(data.veredito === 'liberado' ? 'EQUIPE / ATIVIDADE LIBERADA' : 'EQUIPE / ATIVIDADE BLOQUEADA', W / 2, y + 4, { align: 'center' })
    y += 13
  } else { y += 2 }

  // ── Itens ──
  const ncs = data.itens.filter(i => i.resposta === 'nc').length
  sectionTitle(`ITENS VERIFICADOS (${data.itens.length}${ncs ? ` · ${ncs} NC` : ''})`)
  doc.setFontSize(8)
  for (const it of data.itens) {
    checkPage(10)
    const resp = it.resposta ?? ''
    const cfg = RESP_LABEL[resp]
    // texto do item (quebra)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
    const linhas = doc.splitTextToSize(`${it.ordem}. ${it.texto}`, CW - 32)
    doc.text(linhas, M, y)
    // etiqueta da resposta à direita
    if (cfg) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...cfg.rgb)
      doc.text(cfg.txt, W - M, y, { align: 'right' })
    } else if (resp) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK)
      doc.text(String(resp).slice(0, 20), W - M, y, { align: 'right' })
    }
    y += Math.max(linhas.length * 4, 4)
    // observação da NC
    if (it.obs) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...MID)
      const obsL = doc.splitTextToSize(`↳ ${it.obs}`, CW - 6)
      checkPage(obsL.length * 3.5 + 2)
      doc.text(obsL, M + 4, y); y += obsL.length * 3.5
    }
    // fotos embutidas (miniaturas)
    if (it.fotoUrls?.length) {
      checkPage(30)
      let x = M + 4
      for (const url of it.fotoUrls.slice(0, 4)) {
        const b64 = await urlToBase64(url)
        if (b64 && b64.startsWith('data:image')) {
          try {
            const fmt = b64.includes('image/png') ? 'PNG' : 'JPEG'
            doc.addImage(b64, fmt, x, y, 26, 26)
            x += 29
          } catch { /* ignora imagem inválida */ }
        }
      }
      if (x > M + 4) y += 29
    }
    doc.setDrawColor(230, 235, 240); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 2.5
  }

  // ── Observações gerais ──
  if (data.observacoes) {
    y += 2; sectionTitle('OBSERVAÇÕES GERAIS')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK)
    const o = doc.splitTextToSize(data.observacoes, CW); checkPage(o.length * 4 + 4)
    doc.text(o, M, y); y += o.length * 4 + 4
  }

  // ── Assinatura ──
  checkPage(34)
  y += 8
  const half = CW / 2
  doc.setDrawColor(...DARK); doc.setLineWidth(0.3)
  doc.line(M + 5, y, M + half - 10, y)
  doc.line(M + half + 10, y, W - M - 5, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK)
  doc.text(data.executorNome ?? 'Inspetor', M + 5 + (half - 15) / 2, y + 5, { align: 'center' })
  doc.text('Responsável pela equipe/frente', M + half + 10 + (half - 15) / 2, y + 5, { align: 'center' })
  doc.setFontSize(7); doc.setTextColor(...MID)
  doc.text('Assinatura do inspetor (TST/SESMT)', M + 5 + (half - 15) / 2, y + 9, { align: 'center' })
  doc.text('Ciência do responsável', M + half + 10 + (half - 15) / 2, y + 9, { align: 'center' })

  // rodapé
  doc.setFontSize(7); doc.setTextColor(...MID)
  doc.text(`Documento gerado pelo TEG+ QSMA em ${new Date().toLocaleString('pt-BR')}`, M, 288)

  return doc
}

export async function gerarInspecaoPdf(data: InspecaoPdfData): Promise<void> {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  const logo = empresa.logoUrl ? await urlToBase64(empresa.logoUrl) : null
  const doc = await buildDoc(data, empresa, logo)
  const nome = `Inspecao_${(data.codigo ?? 'sem-codigo').replace(/[^\w\-]+/g, '_')}.pdf`
  doc.save(nome)
}
