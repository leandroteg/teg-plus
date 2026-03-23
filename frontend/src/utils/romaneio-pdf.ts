import jsPDF from 'jspdf'
import type { EmpresaData } from '../services/empresa'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import type { LogSolicitacao } from '../types/logistica'

export interface RomaneioData {
  numero: string
  origem: string
  destino: string
  obra_nome?: string
  solicitante?: string
  motorista_nome?: string
  veiculo_placa?: string
  itens: Array<{
    descricao: string
    quantidade: number
    unidade: string
    peso_kg?: number
  }>
  peso_total_kg?: number
  volumes_total?: number
  observacoes?: string
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

function buildRomaneioDoc(data: RomaneioData, empresa: EmpresaData, logoBase64?: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  const CW = W - 2 * M
  let y = M

  const TEAL = [13, 148, 136] as const
  const DARK = [30, 41, 59] as const
  const MID = [100, 116, 139] as const
  const LIGHT = [226, 232, 240] as const

  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 34, 'F')

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', M, 3, 18, 28)
    } catch {
      // Keep rendering even if the logo fails.
    }
  }

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

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('ROMANEIO DE CARGA', W - M, 13, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`#${data.numero}`, W - M, 20, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const dataStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.text(dataStr, W - M, 26, { align: 'right' })
  y = 42

  doc.setFontSize(8)
  doc.setTextColor(...MID)
  doc.text('ORIGEM', M, y)
  doc.text('DESTINO', M + CW / 2 + 5, y)
  y += 5
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text(data.origem || '-', M, y)
  doc.text(data.destino || '-', M + CW / 2 + 5, y)
  y += 5
  if (data.obra_nome) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MID)
    doc.text(`Obra: ${data.obra_nome}`, M + CW / 2 + 5, y)
    y += 4
  }
  y += 4

  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 6

  if (data.motorista_nome || data.veiculo_placa) {
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('MOTORISTA', M, y)
    doc.text('PLACA', M + 80, y)
    doc.text('SOLICITANTE', M + 130, y)
    y += 5
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text(data.motorista_nome || '-', M, y)
    doc.text(data.veiculo_placa || '-', M + 80, y)
    doc.text(data.solicitante || '-', M + 130, y)
    y += 8
    doc.setDrawColor(...LIGHT)
    doc.line(M, y, W - M, y)
    y += 6
  }

  doc.setFillColor(241, 245, 249)
  doc.rect(M, y, CW, 7, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MID)
  const cols = [M + 2, M + 8, M + CW * 0.55, M + CW * 0.7, M + CW * 0.85]
  doc.text('#', cols[0], y + 5)
  doc.text('DESCRICAO', cols[1], y + 5)
  doc.text('QTD', cols[2], y + 5)
  doc.text('UNID', cols[3], y + 5)
  doc.text('PESO (kg)', cols[4], y + 5)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  data.itens.forEach((item, i) => {
    if (y > 260) {
      doc.addPage()
      y = M
    }
    doc.setTextColor(...DARK)
    doc.text(String(i + 1), cols[0], y)
    const desc = item.descricao.length > 45 ? `${item.descricao.slice(0, 45)}...` : item.descricao
    doc.text(desc, cols[1], y)
    doc.text(String(item.quantidade), cols[2], y)
    doc.text(item.unidade, cols[3], y)
    doc.text(item.peso_kg ? item.peso_kg.toFixed(1) : '-', cols[4], y)
    y += 6

    doc.setDrawColor(241, 245, 249)
    doc.line(M, y - 2, W - M, y - 2)
  })

  y += 4

  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.5)
  doc.line(M, y, W - M, y)
  y += 6
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(`Total de Volumes: ${data.volumes_total ?? data.itens.length}`, M, y)
  doc.text(`Peso Total: ${data.peso_total_kg?.toFixed(1) ?? '-'} kg`, M + 70, y)
  y += 10

  if (data.observacoes) {
    doc.setFontSize(8)
    doc.setTextColor(...MID)
    doc.text('OBSERVACOES', M, y)
    y += 4
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(data.observacoes, CW)
    doc.text(lines, M, y)
    y += lines.length * 4.5 + 6
  }

  if (y > 240) {
    doc.addPage()
    y = M
  }
  y = Math.max(y, 230)
  doc.setDrawColor(...LIGHT)
  doc.setLineWidth(0.3)
  doc.line(M, y, M + 75, y)
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text('Responsavel Expedicao', M + 37.5, y + 4, { align: 'center' })
  doc.line(W - M - 75, y, W - M, y)
  doc.text('Motorista / Transportador', W - M - 37.5, y + 4, { align: 'center' })

  doc.setFontSize(6)
  doc.setTextColor(180, 180, 180)
  doc.text(`TEG+ ERP - ${empresa.fantasia} - CNPJ ${empresa.cnpj} - Romaneio gerado em ${dataStr}`, W / 2, 290, { align: 'center' })

  return doc
}

export function buildRomaneioDataFromSolicitacao(sol: LogSolicitacao): RomaneioData {
  const itens = sol.itens?.length
    ? sol.itens.map(item => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        peso_kg: item.peso_kg,
      }))
    : [{
        descricao: sol.descricao || 'Carga diversa',
        quantidade: 1,
        unidade: 'un',
      }]

  return {
    numero: sol.numero,
    origem: sol.origem,
    destino: sol.destino,
    obra_nome: sol.obra_nome,
    solicitante: sol.solicitante_nome,
    motorista_nome: sol.viagem?.motorista_nome || sol.motorista_nome,
    veiculo_placa: sol.viagem?.veiculo_placa || sol.veiculo_placa,
    itens,
    peso_total_kg: sol.peso_total_kg,
    volumes_total: sol.volumes_total,
    observacoes: sol.observacoes_carga || sol.observacoes,
  }
}

export function getRomaneioFileName(input: Pick<RomaneioData, 'numero'> | Pick<LogSolicitacao, 'numero'>) {
  return `romaneio-${input.numero}.pdf`
}

export async function gerarRomaneioPdfBlob(data: RomaneioData | LogSolicitacao): Promise<Blob> {
  const payload = 'status' in data ? buildRomaneioDataFromSolicitacao(data) : data
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const logoBase64 = await loadLogoBase64(empresa.logoUrl)
  const doc = buildRomaneioDoc(payload, empresa, logoBase64)
  return doc.output('blob')
}

export async function gerarRomaneioPDF(data: RomaneioData | LogSolicitacao): Promise<string> {
  const blob = await gerarRomaneioPdfBlob(data)
  return URL.createObjectURL(blob)
}
