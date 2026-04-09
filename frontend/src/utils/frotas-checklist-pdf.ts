// ─────────────────────────────────────────────────────────────────────────────
// frotas-checklist-pdf.ts — Geração de PDF profissional para Checklist de Veículo
// Mesmo padrão visual do Laudo de Vistoria, Pedido de Compra e Romaneio de Carga.
// Header corporativo (logo + CNPJ TEG), dados do veículo, tabela de itens
// por categoria, fotos, assinaturas. Multi-page com quebras automáticas.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import type {
  FroVeiculo, FroChecklistExecucao, FroChecklistExecucaoItem,
  FroChecklistFoto, EstadoItemVeiculo, NivelCombustivel, TipoChecklist2,
} from '../types/frotas'

// ── Types ───────────────────────────────────────────────────────────────────

export interface FrotasChecklistPdfData {
  execucao: FroChecklistExecucao
  veiculo: FroVeiculo
  itens: FroChecklistExecucaoItem[]
  fotos?: FroChecklistFoto[]
  alocacao?: { obra_nome?: string; centro_custo?: string; data_saida?: string; data_retorno_prev?: string }
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

function estadoLabel(e?: EstadoItemVeiculo | null): string {
  if (!e) return '—'
  const map: Record<EstadoItemVeiculo, string> = {
    otimo: 'Ótimo',
    bom: 'Bom',
    regular: 'Regular',
    ruim: 'Ruim',
    nao_se_aplica: 'N/A',
  }
  return map[e] || e
}

function estadoColor(e?: EstadoItemVeiculo | null): readonly [number, number, number] {
  if (!e) return [100, 116, 139] // MID
  const map: Record<EstadoItemVeiculo, readonly [number, number, number]> = {
    otimo:        [16, 185, 129],  // emerald-500
    bom:          [59, 130, 246],  // blue-500
    regular:      [245, 158, 11],  // amber-500
    ruim:         [239, 68, 68],   // red-500
    nao_se_aplica:[148, 163, 184], // slate-400
  }
  return map[e] || [100, 116, 139]
}

function tipoChecklistLabel(t: TipoChecklist2): string {
  const map: Record<TipoChecklist2, string> = {
    pre_viagem: 'PRÉ-VIAGEM',
    pos_viagem: 'PÓS-VIAGEM',
    entrega_locadora: 'ENTREGA LOCADORA',
    devolucao_locadora: 'DEVOLUÇÃO LOCADORA',
    pre_manutencao: 'PRÉ-MANUTENÇÃO',
    pos_manutencao: 'PÓS-MANUTENÇÃO',
  }
  return map[t] || t.replace(/_/g, ' ').toUpperCase()
}

function categoriaVeiculoLabel(c?: string): string {
  if (!c) return '—'
  const map: Record<string, string> = {
    passeio: 'Passeio', pickup: 'Pickup', van: 'Van', vuc: 'VUC',
    truck: 'Truck', carreta: 'Carreta', moto: 'Moto', onibus: 'Ônibus',
  }
  return map[c] || c
}

function combustivelLabel(c?: string): string {
  if (!c) return '—'
  const map: Record<string, string> = {
    flex: 'Flex', gasolina: 'Gasolina', diesel: 'Diesel',
    etanol: 'Etanol', eletrico: 'Elétrico', gnv: 'GNV',
  }
  return map[c] || c
}

function propriedadeLabel(p?: string): string {
  if (!p) return '—'
  const map: Record<string, string> = {
    propria: 'Própria', locada: 'Locada', cedida: 'Cedida',
  }
  return map[p] || p
}

function getCategoriaLabel(ordem: number): string {
  if (ordem < 10) return 'DOCUMENTAÇÃO'
  if (ordem < 30) return 'EXTERIOR'
  if (ordem < 40) return 'ILUMINAÇÃO'
  if (ordem < 50) return 'MECÂNICA'
  if (ordem < 60) return 'INTERIOR'
  return 'ACESSÓRIOS'
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
  fotos: FroChecklistFoto[],
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

async function buildChecklistDoc(
  data: FrotasChecklistPdfData,
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

  const { execucao, veiculo } = data

  // Derive tipo from template or execucao
  const tipo = execucao.template?.tipo ?? 'pre_viagem'

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
  doc.text('CHECKLIST DE VEÍCULO', W - M, 13, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 200)
  doc.text(tipoChecklistLabel(tipo), W - M, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(fmtDate(execucao.concluido_at || execucao.created_at), W - M, 25, { align: 'right' })
  // Checklist ID
  doc.setFontSize(7)
  doc.text(`#${execucao.id.slice(0, 8).toUpperCase()}`, W - M, 30, { align: 'right' })
  y = 40

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: DADOS DO VEÍCULO
  // ══════════════════════════════════════════════════════════════════════════

  sectionTitle('DADOS DO VEÍCULO')

  addFieldPair(
    'Placa', veiculo.placa || '—',
    'Número de Série', veiculo.numero_serie || '—',
  )

  addFieldPair(
    'Marca / Modelo', `${veiculo.marca || '—'} / ${veiculo.modelo || '—'}`,
    'Ano', veiculo.ano_fab ? `${veiculo.ano_fab}${veiculo.ano_mod ? `/${veiculo.ano_mod}` : ''}` : '—',
  )

  addFieldPair(
    'Categoria', categoriaVeiculoLabel(veiculo.categoria),
    'Combustível', combustivelLabel(veiculo.combustivel),
  )

  addFieldPair(
    'Propriedade', propriedadeLabel(veiculo.propriedade),
    'Hodômetro / Horímetro',
    `${execucao.hodometro ?? veiculo.hodometro_atual ?? '—'} km${veiculo.horimetro_atual != null ? ` / ${execucao.horimetro ?? veiculo.horimetro_atual} h` : ''}`,
  )

  // ── Nível de Combustível (visual gauge) ──────────────────────────────────
  if (execucao.nivel_combustivel) {
    checkPage(14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('Nível de Combustível', M, y)
    y += 4

    const nivelMap: Record<NivelCombustivel, number> = {
      vazio: 0, '1/4': 1, '1/2': 2, '3/4': 3, cheio: 4,
    }
    const segColors: readonly (readonly [number, number, number])[] = [
      [239, 68, 68],   // red (empty)
      [249, 115, 22],  // orange (1/4)
      [245, 158, 11],  // yellow (1/2)
      [132, 204, 22],  // lime (3/4)
      [16, 185, 129],  // green (cheio)
    ]
    const segLabels = ['E', '1/4', '1/2', '3/4', 'F']
    const filledCount = nivelMap[execucao.nivel_combustivel] + 1
    const gaugeW = 90
    const segW = gaugeW / 5
    const segH = 6

    for (let i = 0; i < 5; i++) {
      const x = M + i * segW
      if (i < filledCount) {
        doc.setFillColor(...segColors[i])
        doc.rect(x, y, segW - 1, segH, 'F')
      } else {
        doc.setFillColor(226, 232, 240)
        doc.rect(x, y, segW - 1, segH, 'F')
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setTextColor(i < filledCount ? 255 : 148, i < filledCount ? 255 : 163, i < filledCount ? 255 : 184)
      doc.text(segLabels[i], x + segW / 2 - 0.5, y + 4, { align: 'center' })
    }

    // Label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...DARK)
    doc.text(execucao.nivel_combustivel.toUpperCase(), M + gaugeW + 4, y + 4.5)

    y += segH + 5
  }

  y += 2

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: RESPONSÁVEL
  // ══════════════════════════════════════════════════════════════════════════

  sectionTitle('RESPONSÁVEL')
  addField('Nome', execucao.responsavel_nome || '—', true)
  addField('Data do Checklist', fmtDateFull(execucao.concluido_at || execucao.created_at))
  y += 2

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: ALOCAÇÃO (if applicable)
  // ══════════════════════════════════════════════════════════════════════════

  if (data.alocacao) {
    const aloc = data.alocacao
    if (aloc.obra_nome || aloc.centro_custo || aloc.data_saida) {
      sectionTitle('ALOCAÇÃO')
      if (aloc.obra_nome) addField('Obra / Destino', aloc.obra_nome, true)
      if (aloc.centro_custo) addField('Centro de Custo', aloc.centro_custo)
      if (aloc.data_saida || aloc.data_retorno_prev) {
        addFieldPair(
          'Data Saída', fmtDateFull(aloc.data_saida),
          'Retorno Previsto', fmtDateFull(aloc.data_retorno_prev),
        )
      }
      y += 2
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: CHECKLIST
  // ══════════════════════════════════════════════════════════════════════════

  const itens = data.itens || []
  if (itens.length > 0) {
    // Group by category derived from template_item.ordem
    const categorias = new Map<string, FroChecklistExecucaoItem[]>()
    for (const it of itens) {
      const ordem = it.template_item?.ordem ?? 99
      const key = getCategoriaLabel(ordem)
      if (!categorias.has(key)) categorias.set(key, [])
      categorias.get(key)!.push(it)
    }

    sectionTitle('CHECKLIST')

    for (const [categoria, items] of categorias) {
      checkPage(20)

      // Categoria sub-header
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(M, y - 3, CW, 7, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...DARK)
      doc.text(categoria, M + 3, y + 1)

      // Count summary for this categoria
      const total = items.length
      const ok = items.filter(it => {
        const e = it.estado
        return e === 'otimo' || e === 'bom'
      }).length
      const warn = items.filter(it => it.estado === 'regular').length
      const bad = items.filter(it => it.estado === 'ruim').length
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
        const estado = it.estado

        // Item name
        doc.setTextColor(...DARK)
        const itemName = (it.template_item?.descricao ?? '—')
        const itemNameTrunc = itemName.length > 35 ? itemName.slice(0, 32) + '...' : itemName
        doc.text(itemNameTrunc, cols.item, y)

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

        // Divergência indicator (non-conforme)
        if (it.conforme === false) {
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
    const countByEstado = (e: EstadoItemVeiculo) =>
      allItems.filter(it => it.estado === e).length

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text('RESUMO', M, y)
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

    const pendencias = execucao.tem_pendencias
    if (pendencias) {
      doc.setTextColor(239, 68, 68)
    } else {
      doc.setTextColor(...TEAL)
    }
    doc.text(
      pendencias ? '⚠ CHECKLIST COM PENDÊNCIAS' : '✓ CHECKLIST SEM PENDÊNCIAS',
      W - M, y, { align: 'right' },
    )
    y += 8
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION: OBSERVAÇÕES GERAIS
  // ══════════════════════════════════════════════════════════════════════════

  if (execucao.observacoes_gerais) {
    checkPage(20)
    sectionTitle('OBSERVAÇÕES GERAIS')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(execucao.observacoes_gerais, CW)
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
    doc.text(`${data.fotos.length} foto(s) registrada(s) durante o checklist.`, M, y)
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
        const desc = foto.descricao || `Foto ${i + col + 1}`
        const captionTrunc = desc.length > 45 ? desc.slice(0, 42) + '...' : desc
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
  doc.text('Responsável Frotas', M + 37.5, y + 4, { align: 'center' })
  doc.setFontSize(6)
  doc.text(`${empresa.fantasia}`, M + 37.5, y + 8, { align: 'center' })

  // Right signature
  doc.line(W - M - 75, y, W - M, y)
  doc.text('Motorista / Operador', W - M - 37.5, y + 4, { align: 'center' })
  if (execucao.responsavel_nome) {
    doc.setFontSize(6)
    doc.text(execucao.responsavel_nome, W - M - 37.5, y + 8, { align: 'center' })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════════════════════

  const now = new Date().toLocaleString('pt-BR')
  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(
    `TEG+ ERP · ${empresa.fantasia} · CNPJ ${empresa.cnpj} · Checklist gerado em ${now}`,
    W / 2, 290, { align: 'center' },
  )

  return doc
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getFrotasChecklistPdfFileName(data: FrotasChecklistPdfData): string {
  const tipo = (data.execucao.template?.tipo ?? 'checklist').replace(/_/g, '-')
  const placa = data.veiculo.placa?.replace(/[^A-Za-z0-9]/g, '') || 'sem-placa'
  const date = (data.execucao.concluido_at || data.execucao.created_at || '').slice(0, 10)
  const id = data.execucao.id.slice(0, 8)
  return `checklist-${tipo}-${placa}-${date}-${id}.pdf`
}

export async function gerarFrotasChecklistPdfBlob(data: FrotasChecklistPdfData): Promise<Blob> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logo = await loadLogoBase64(empresa.logoUrl)
  const doc = await buildChecklistDoc(data, empresa, logo)
  return doc.output('blob')
}

export async function gerarFrotasChecklistPDF(data: FrotasChecklistPdfData): Promise<string> {
  const blob = await gerarFrotasChecklistPdfBlob(data)
  return URL.createObjectURL(blob)
}

/** Gera e abre o PDF em nova aba */
export async function abrirFrotasChecklistPdf(data: FrotasChecklistPdfData): Promise<void> {
  const url = await gerarFrotasChecklistPDF(data)
  window.open(url, '_blank')
}

/** Gera e dispara download do PDF */
export async function downloadFrotasChecklistPdf(data: FrotasChecklistPdfData): Promise<void> {
  const blob = await gerarFrotasChecklistPdfBlob(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = getFrotasChecklistPdfFileName(data)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Compartilha via WhatsApp (mobile) ou copia link */
export async function compartilharFrotasChecklistWhatsApp(data: FrotasChecklistPdfData): Promise<boolean> {
  const blob = await gerarFrotasChecklistPdfBlob(data)
  const fileName = getFrotasChecklistPdfFileName(data)
  const file = new File([blob], fileName, { type: 'application/pdf' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `Checklist de Veículo - ${tipoChecklistLabel(data.execucao.template?.tipo ?? 'pre_viagem')}`,
        text: `Checklist de veículo ${data.veiculo.placa} — ${data.veiculo.marca} ${data.veiculo.modelo}`,
        files: [file],
      })
      return true
    } catch {
      return false
    }
  }

  // Fallback: open WhatsApp web with message
  const msg = encodeURIComponent(
    `Segue o Checklist de Veículo (${tipoChecklistLabel(data.execucao.template?.tipo ?? 'pre_viagem')}) — ${data.veiculo.placa} ${data.veiculo.marca} ${data.veiculo.modelo}.`,
  )
  window.open(`https://wa.me/?text=${msg}`, '_blank')
  // Also trigger download so user can attach
  downloadFrotasChecklistPdf(data)
  return true
}
