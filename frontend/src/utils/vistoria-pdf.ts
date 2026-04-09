// ─────────────────────────────────────────────────────────────────────────────
// vistoria-pdf.ts — Geração de PDF profissional para Laudo de Vistoria
// Mesmo padrão visual do Pedido de Compra e Romaneio de Carga.
// Header corporativo (logo + CNPJ TEG), dados do imóvel, tabela de itens
// por ambiente, fotos, assinaturas. Multi-page com quebras automáticas.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import type {
  LocEntrada, LocImovel, LocVistoria, LocVistoriaItem,
  LocVistoriaFoto, EstadoItem, TipoVistoria,
} from '../types/locacao'

// ── Types ───────────────────────────────────────────────────────────────────

export interface VistoriaPdfData {
  vistoria: LocVistoria
  entrada?: LocEntrada
  imovel?: LocImovel
  itens: LocVistoriaItem[]
  fotos?: LocVistoriaFoto[]
}

// ── Logo Loader ─────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return d
  }
}

function fmtDateFull(d?: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return d
  }
}

function estadoLabel(e?: EstadoItem | null): string {
  if (!e) return '—'
  const map: Record<EstadoItem, string> = {
    otimo: 'Ótimo',
    bom: 'Bom',
    regular: 'Regular',
    ruim: 'Ruim',
    nao_se_aplica: 'N/A',
  }
  return map[e] || e
}

function estadoColor(e?: EstadoItem | null): readonly [number, number, number] {
  if (!e) return [100, 116, 139] // MID
  const map: Record<EstadoItem, readonly [number, number, number]> = {
    otimo:        [16, 185, 129],  // emerald-500
    bom:          [59, 130, 246],  // blue-500
    regular:      [245, 158, 11],  // amber-500
    ruim:         [239, 68, 68],   // red-500
    nao_se_aplica:[148, 163, 184], // slate-400
  }
  return map[e] || [100, 116, 139]
}

function tipoLabel(t: TipoVistoria): string {
  return t === 'entrada' ? 'ENTRADA' : 'SAÍDA'
}

// ── Image Loader (fotos) ────────────────────────────────────────────────────

interface LoadedImage {
  dataUrl: string
  format: 'PNG' | 'JPEG'
  width: number
  height: number
}

async function loadImageAsBase64(url: string): Promise<LoadedImage | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.onload = () => resolve({
          dataUrl,
          format: blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG',
          width: img.naturalWidth || img.width || 1,
          height: img.naturalHeight || img.height || 1,
        })
        img.onerror = () => resolve(null)
        img.src = dataUrl
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Load multiple images concurrently with a timeout per image */
async function loadFotoImages(
  fotos: LocVistoriaFoto[],
): Promise<Map<string, LoadedImage>> {
  const results = new Map<string, LoadedImage>()
  const TIMEOUT = 8000 // 8s per foto

  await Promise.allSettled(
    fotos.map(async (foto) => {
      try {
        const loaded = await Promise.race([
          loadImageAsBase64(foto.url),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT)),
        ])
        if (loaded) results.set(foto.id, loaded)
      } catch { /* skip */ }
    }),
  )

  return results
}

// ── Build PDF ───────────────────────────────────────────────────────────────

async function buildVistoriaDoc(
  data: VistoriaPdfData,
  empresa: EmpresaData,
  logo: string | null,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  // Colors (same as Pedido de Compra)
  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID  = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  const { vistoria, entrada, imovel } = data

  // Derive imovel data from vistoria.imovel, prop imovel, or entrada
  const imv = imovel || vistoria.imovel
  const addr = imv?.endereco || entrada?.endereco || ''
  const num  = imv?.numero || entrada?.numero || ''
  const comp = imv?.complemento || entrada?.complemento || ''
  const bairro = imv?.bairro || entrada?.bairro || ''
  const cidade = imv?.cidade || entrada?.cidade || ''
  const uf = imv?.uf || entrada?.uf || ''
  const cep = imv?.cep || entrada?.cep || ''

  // ── Utility: page break check ──────────────────────────────────────────────
  const checkPage = (needed = 10) => {
    if (y + needed > 275) {
      doc.addPage()
      y = M
    }
  }

  // ── Section title ──────────────────────────────────────────────────────────
  const sectionTitle = (title: string) => {
    checkPage(15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...TEAL)
    doc.text(title, M, y)
    y += 1
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, y, W - M, y)
    y += 5
  }

  // ── Field pair ─────────────────────────────────────────────────────────────
  const addField = (label: string, value: string, bold = false, labelWidth = 42) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text(label, M, y)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    const truncated = value?.length > 70 ? value.slice(0, 67) + '...' : (value || '—')
    doc.text(truncated, M + labelWidth, y)
    y += 6.5
  }

  // ── Two-column field pair ──────────────────────────────────────────────────
  const addFieldPair = (l1: string, v1: string, l2: string, v2: string) => {
    const halfW = CW / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text(l1, M, y)
    doc.text(l2, M + halfW, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(v1 || '—', M, y)
    doc.text(v2 || '—', M + halfW, y)
    y += 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER BAR
  // ══════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')

  // Logo
  if (logo) {
    try { doc.addImage(logo, 'PNG', M, 3, 18, 28) } catch { /* ignore */ }
  }

  // Company info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(empresa.fantasia, M + 22, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M + 22, 16)
  if (empresa.endereco) {
    doc.text(`${empresa.endereco}${empresa.cidade ? ` - ${empresa.cidade}/${empresa.uf ?? ''}` : ''}`, M + 22, 21)
  }
  if (empresa.telefone) {
    doc.text(`${empresa.telefone}${empresa.email ? ` | ${empresa.email}` : ''}`, M + 22, 26)
  }

  // Document title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text(`LAUDO DE VISTORIA`, W - M, 13, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 200)
  doc.text(`${tipoLabel(vistoria.tipo)}`, W - M, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(fmtDate(vistoria.data_vistoria || vistoria.created_at), W - M, 25, { align: 'right' })
  // Vistoria ID
  doc.setFontSize(7)
  doc.text(`#${vistoria.id.slice(0, 8).toUpperCase()}`, W - M, 30, { align: 'right' })
  y = 40

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: DADOS DO IMÓVEL
  // ══════════════════════════════════════════════════════════════════════════

  sectionTitle('DADOS DO IMÓVEL')

  // Full address line
  const fullAddr = [addr, num].filter(Boolean).join(', ')
    + (comp ? ` - ${comp}` : '')
    + (bairro ? ` · ${bairro}` : '')
  addField('Endereço', fullAddr, true)

  addFieldPair(
    'Cidade / UF', `${cidade || '—'}${uf ? ` / ${uf}` : ''}`,
    'CEP', cep || '—',
  )

  if (imv?.area_m2 || entrada?.area_m2) {
    addFieldPair(
      'Área (m²)', `${imv?.area_m2 || entrada?.area_m2 || '—'} m²`,
      'Código', imv?.codigo || '—',
    )
  }

  if (imv?.descricao) {
    addField('Descrição', imv.descricao)
  }

  y += 2

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: LOCADOR (proprietário)
  // ══════════════════════════════════════════════════════════════════════════

  const locadorNome = imv?.locador_nome || entrada?.locador_nome
  const locadorDoc  = imv?.locador_cpf_cnpj || entrada?.locador_cpf_cnpj
  const locadorTel  = imv?.locador_contato || entrada?.locador_contato

  if (locadorNome || locadorDoc) {
    sectionTitle('LOCADOR / PROPRIETÁRIO')
    addField('Nome', locadorNome || '—', true)
    if (locadorDoc) addField('CPF/CNPJ', locadorDoc)
    if (locadorTel) addField('Contato', locadorTel)
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: DADOS DA LOCAÇÃO
  // ══════════════════════════════════════════════════════════════════════════

  if (entrada) {
    sectionTitle('DADOS DA LOCAÇÃO')
    const valor = entrada.valor_aluguel
      ? `R$ ${entrada.valor_aluguel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : '—'
    addFieldPair(
      'Aluguel Mensal', valor,
      'Dia Vencimento', entrada.dia_vencimento ? `Dia ${entrada.dia_vencimento}` : '—',
    )
    if (entrada.data_prevista_inicio) {
      addField('Início Previsto', fmtDateFull(entrada.data_prevista_inicio))
    }
    if (entrada.observacoes) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MID)
      doc.text('Observações', M, y)
      y += 4
      doc.setTextColor(...DARK)
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(entrada.observacoes, CW)
      doc.text(lines.slice(0, 4), M, y)
      y += Math.min(lines.length, 4) * 4
    }
    y += 2
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: CHECKLIST DE VISTORIA
  // ══════════════════════════════════════════════════════════════════════════

  const itens = data.itens || []
  if (itens.length > 0) {
    // Group by ambiente
    const ambientes = new Map<string, LocVistoriaItem[]>()
    for (const it of itens) {
      const key = it.ambiente
      if (!ambientes.has(key)) ambientes.set(key, [])
      ambientes.get(key)!.push(it)
    }

    sectionTitle('CHECKLIST DE VISTORIA')

    const estadoField = vistoria.tipo === 'entrada' ? 'estado_entrada' : 'estado_saida'

    for (const [ambiente, items] of ambientes) {
      checkPage(20)

      // Ambiente sub-header
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(M, y - 3, CW, 7, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...DARK)
      doc.text(ambiente.toUpperCase(), M + 3, y + 1)

      // Count summary for this ambiente
      const total = items.length
      const ok = items.filter(it => {
        const e = it[estadoField]
        return e === 'otimo' || e === 'bom'
      }).length
      const warn = items.filter(it => it[estadoField] === 'regular').length
      const bad = items.filter(it => it[estadoField] === 'ruim').length
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...MID)
      doc.text(`${total} itens · ${ok} ok · ${warn} regular · ${bad} ruim`, W - M - 3, y + 1, { align: 'right' })
      y += 7

      // Table header
      const cols = {
        item:   M + 3,
        estado: M + CW * 0.55,
        obs:    M + CW * 0.72,
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(71, 85, 105)
      doc.text('ITEM', cols.item, y)
      doc.text('ESTADO', cols.estado, y)
      doc.text('OBSERVAÇÃO', cols.obs, y)
      y += 4

      // Items
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      for (const it of items) {
        checkPage(8)
        const estado = it[estadoField] as EstadoItem | undefined

        // Item name
        doc.setTextColor(...DARK)
        const itemName = it.item.length > 35 ? it.item.slice(0, 32) + '...' : it.item
        doc.text(itemName, cols.item, y)

        // Estado with color
        const color = estadoColor(estado)
        doc.setTextColor(...color)
        doc.setFont('helvetica', 'bold')
        doc.text(estadoLabel(estado), cols.estado, y)

        // Observacao
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...MID)
        const obs = it.observacao || ''
        const obsTrunc = obs.length > 28 ? obs.slice(0, 25) + '...' : obs
        doc.text(obsTrunc, cols.obs, y)
        doc.setFontSize(8)

        // Divergência indicator
        if (it.divergencia) {
          doc.setFillColor(239, 68, 68)
          doc.circle(cols.item - 2.5, y - 1.2, 1, 'F')
        }

        y += 5

        // Separator
        doc.setDrawColor(241, 245, 249)
        doc.setLineWidth(0.2)
        doc.line(M + 2, y - 2, W - M - 2, y - 2)
      }

      y += 3
    }

    // ── Summary counts ──────────────────────────────────────────────────────
    checkPage(20)
    y += 2
    doc.setDrawColor(...TEAL)
    doc.setLineWidth(0.5)
    doc.line(M, y, W - M, y)
    y += 6

    const allItems = itens
    const totalItens = allItems.length
    const countByEstado = (e: EstadoItem) =>
      allItems.filter(it => (it[estadoField] as EstadoItem) === e).length

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text('RESUMO DA VISTORIA', M, y)
    y += 6

    // Summary cards
    const summaryItems: { label: string; count: number; color: readonly [number, number, number] }[] = [
      { label: 'Ótimo', count: countByEstado('otimo'), color: [16, 185, 129] },
      { label: 'Bom', count: countByEstado('bom'), color: [59, 130, 246] },
      { label: 'Regular', count: countByEstado('regular'), color: [245, 158, 11] },
      { label: 'Ruim', count: countByEstado('ruim'), color: [239, 68, 68] },
      { label: 'N/A', count: countByEstado('nao_se_aplica'), color: [148, 163, 184] },
    ]

    const cardW = CW / summaryItems.length
    summaryItems.forEach((s, i) => {
      const x = M + i * cardW

      // Colored top border
      doc.setFillColor(...s.color)
      doc.rect(x + 1, y, cardW - 2, 1.5, 'F')

      // Card background
      doc.setFillColor(248, 250, 252)
      doc.rect(x + 1, y + 1.5, cardW - 2, 11, 'F')

      // Count
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...s.color)
      doc.text(String(s.count), x + cardW / 2, y + 7.5, { align: 'center' })

      // Label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...MID)
      doc.text(s.label, x + cardW / 2, y + 11.5, { align: 'center' })
    })
    y += 17

    // Total
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    doc.text(`Total de itens avaliados: ${totalItens}`, M, y)

    const pendencias = vistoria.tem_pendencias
    if (pendencias) {
      doc.setTextColor(239, 68, 68)
    } else {
      doc.setTextColor(...TEAL)
    }
    doc.text(
      pendencias ? '⚠ VISTORIA COM PENDÊNCIAS' : '✓ VISTORIA SEM PENDÊNCIAS',
      W - M, y, { align: 'right' },
    )
    y += 8
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: OBSERVAÇÕES GERAIS
  // ══════════════════════════════════════════════════════════════════════════

  if (vistoria.observacoes_gerais) {
    checkPage(20)
    sectionTitle('OBSERVAÇÕES GERAIS')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(vistoria.observacoes_gerais, CW)
    doc.text(lines.slice(0, 8), M, y)
    y += Math.min(lines.length, 8) * 4.5 + 4
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: FOTOS (imagens embarcadas no PDF)
  // ══════════════════════════════════════════════════════════════════════════

  if (data.fotos && data.fotos.length > 0) {
    // Load all photo images
    const fotoImages = await loadFotoImages(data.fotos)

    // Start a new page for photos section
    doc.addPage()
    y = M

    sectionTitle('REGISTRO FOTOGRÁFICO')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    doc.text(`${data.fotos.length} foto(s) registrada(s) durante a vistoria.`, M, y)
    y += 6

    // Layout: 2 images per row
    const IMG_W = (CW - 6) / 2  // ~87mm each, 6mm gap
    const IMG_H = 60             // 60mm height per photo
    const GAP = 6
    const CARD_PADDING = 2
    const CAPTION_H = 8

    const fotos = data.fotos
    for (let i = 0; i < fotos.length; i += 2) {
      const rowHeight = IMG_H + CAPTION_H + CARD_PADDING * 2 + 4
      checkPage(rowHeight)

      for (let col = 0; col < 2 && i + col < fotos.length; col++) {
        const foto = fotos[i + col]
        const img = fotoImages.get(foto.id)
        const x = M + col * (IMG_W + GAP)

        // Card background
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(...LIGHT)
        doc.setLineWidth(0.3)
        doc.roundedRect(x, y, IMG_W, IMG_H + CAPTION_H + CARD_PADDING * 2, 2, 2, 'FD')

        if (img) {
          // Calculate aspect-fit dimensions
          const ratio = img.width / Math.max(img.height, 1)
          const maxW = IMG_W - CARD_PADDING * 2
          const maxH = IMG_H - CARD_PADDING
          let renderW = maxW
          let renderH = renderW / Math.max(ratio, 0.01)

          if (renderH > maxH) {
            renderH = maxH
            renderW = renderH * Math.max(ratio, 0.01)
          }

          // Center the image in the card
          const imgX = x + CARD_PADDING + (maxW - renderW) / 2
          const imgY = y + CARD_PADDING + (maxH - renderH) / 2

          try {
            doc.addImage(img.dataUrl, img.format, imgX, imgY, renderW, renderH)
          } catch {
            // If addImage fails, show placeholder
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.setTextColor(...MID)
            doc.text('Imagem indisponível', x + IMG_W / 2, y + IMG_H / 2, { align: 'center' })
          }
        } else {
          // No image loaded - placeholder
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...MID)
          doc.text('Imagem indisponível', x + IMG_W / 2, y + IMG_H / 2, { align: 'center' })
        }

        // Caption below image
        const captionY = y + IMG_H + CARD_PADDING + 3
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...DARK)
        // Parse descricao: format is "Ambiente|Item" from upload
        const desc = foto.descricao || `Foto ${i + col + 1}`
        const [ambiente, item] = desc.includes('|') ? desc.split('|') : [desc, '']
        const caption = item ? `${ambiente} — ${item}` : ambiente
        const captionTrunc = caption.length > 45 ? caption.slice(0, 42) + '...' : caption
        doc.text(captionTrunc, x + CARD_PADDING + 1, captionY)

        // Date
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(...MID)
        doc.text(fmtDate(foto.created_at), x + IMG_W - CARD_PADDING - 1, captionY, { align: 'right' })
      }

      y += IMG_H + CAPTION_H + CARD_PADDING * 2 + 6
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ASSINATURAS
  // ══════════════════════════════════════════════════════════════════════════

  checkPage(30)
  y = Math.max(y + 6, 230)

  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)

  // Left signature
  doc.line(M, y, M + 75, y)
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Responsável pela Vistoria', M + 37.5, y + 4, { align: 'center' })
  doc.setFontSize(6)
  doc.text(`${empresa.fantasia}`, M + 37.5, y + 8, { align: 'center' })

  // Right signature
  doc.line(W - M - 75, y, W - M, y)
  doc.text('Locador / Representante', W - M - 37.5, y + 4, { align: 'center' })
  if (locadorNome) {
    doc.setFontSize(6)
    doc.text(locadorNome, W - M - 37.5, y + 8, { align: 'center' })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════════════

  const now = new Date().toLocaleString('pt-BR')
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(
    `TEG+ ERP · ${empresa.fantasia} · CNPJ ${empresa.cnpj} · Laudo gerado em ${now}`,
    W / 2, 290, { align: 'center' },
  )

  return doc
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getVistoriaPdfFileName(data: VistoriaPdfData): string {
  const tipo = data.vistoria.tipo === 'entrada' ? 'entrada' : 'saida'
  const date = (data.vistoria.data_vistoria || data.vistoria.created_at || '').slice(0, 10)
  const id = data.vistoria.id.slice(0, 8)
  return `laudo-vistoria-${tipo}-${date}-${id}.pdf`
}

export async function gerarVistoriaPdfBlob(data: VistoriaPdfData): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64(empresa.logoUrl)
  const doc = await buildVistoriaDoc(data, empresa, logo)
  return doc.output('blob')
}

export async function gerarVistoriaPDF(data: VistoriaPdfData): Promise<string> {
  const blob = await gerarVistoriaPdfBlob(data)
  return URL.createObjectURL(blob)
}

/** Gera e abre o PDF em nova aba */
export async function abrirVistoriaPdf(data: VistoriaPdfData): Promise<void> {
  const url = await gerarVistoriaPDF(data)
  window.open(url, '_blank')
}

/** Gera e dispara download do PDF */
export async function downloadVistoriaPdf(data: VistoriaPdfData): Promise<void> {
  const blob = await gerarVistoriaPdfBlob(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = getVistoriaPdfFileName(data)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Compartilha via WhatsApp (mobile) ou copia link */
export async function compartilharVistoriaWhatsApp(data: VistoriaPdfData): Promise<boolean> {
  const blob = await gerarVistoriaPdfBlob(data)
  const fileName = getVistoriaPdfFileName(data)
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `Laudo de Vistoria - ${data.vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'}`,
        text: `Laudo de vistoria de ${data.vistoria.tipo} do imóvel`,
        files: [file],
      })
      return true
    } catch {
      return false
    }
  }

  // Fallback: open WhatsApp web with message
  const addr = data.imovel?.endereco || data.entrada?.endereco || 'imóvel'
  const msg = encodeURIComponent(
    `Segue o Laudo de Vistoria de ${data.vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'} — ${addr}.`,
  )
  window.open(`https://wa.me/?text=${msg}`, '_blank')
  // Also trigger download so user can attach
  downloadVistoriaPdf(data)
  return true
}
