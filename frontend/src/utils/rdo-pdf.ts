// ─────────────────────────────────────────────────────────────────────────────
// rdo-pdf.ts — Relatório Diário de Obra (RDO) em PDF.
// Header corporativo TEG (logo de transição), dados do dia, avanço por atividade,
// ocorrências/impeditivos padronizados, equipe, recursos e fotos. Monta um jsPDF
// a partir do id do RDO (busca os filhos no banco). Devolve o doc para o chamador
// decidir: `.save()` baixa, `.output('bloburl')` abre no visualizador.
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf'
import { supabase } from '../services/supabase'
import { EMPRESA_FALLBACK, getEmpresa, type EmpresaData } from '../services/empresa'
import { EVENTO_LABEL } from '../pages/obras/RDOEstruturado'

const WEATHER: Record<string, string> = {
  sol: 'Sol', nublado: 'Nublado', chuva: 'Chuva', chuva_forte: 'Chuva forte', tempestade: 'Tempestade',
}
const NATUREZA_LABEL: Record<string, string> = {
  impeditivo: 'Impeditivo', ocorrencia: 'Ocorrência', improdutividade: 'Improdutividade',
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  try { return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return d }
}

async function loadImg(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    const data: string = await new Promise((res) => {
      const r = new FileReader(); r.onloadend = () => res(r.result as string); r.onerror = () => res(''); r.readAsDataURL(blob)
    })
    if (!data) return null
    const dim: { w: number; h: number } = await new Promise((res) => {
      const img = new Image(); img.onload = () => res({ w: img.width, h: img.height }); img.onerror = () => res({ w: 0, h: 0 }); img.src = data
    })
    return { data, w: dim.w, h: dim.h }
  } catch { return null }
}

export interface RdoPdfData {
  id: string
  obra_id: string
  obra_nome: string
  data: string
  condicao_climatica: string
  horas_improdutivas?: number | null
  motivo_improdutividade?: string | null
  resumo_atividades?: string | null
  ocorrencias?: string | null
  impeditivos?: string | null
  notas?: string | null
  fiscal_cemig?: string | null
  fiscais_cemig?: string[] | null
  tst_nomes?: string[] | null
  tst_nome?: string | null
  preenchido_por_nome?: string | null
}

async function buildDoc(r: RdoPdfData, empresa: EmpresaData, logo: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 15, CW = W - 2 * M
  let y = M
  const DARK = [30, 41, 59] as const, MID = [100, 116, 139] as const, RED = [220, 38, 38] as const
  const TEAL = [13, 148, 136] as const

  const checkPage = (need = 10) => { if (y + need > 282) { doc.addPage(); y = M } }
  const secao = (t: string) => {
    checkPage(14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEAL)
    doc.text(t, M, y); y += 1.5
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 5
  }
  const par = (l1: string, v1: string, l2?: string, v2?: string) => {
    checkPage(11)
    const half = CW / 2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
    doc.text(l1, M, y); if (l2) doc.text(l2, M + half, y)
    y += 4
    doc.setFontSize(9.5); doc.setTextColor(...DARK)
    doc.text(doc.splitTextToSize(v1 || '—', half - 4), M, y)
    if (l2) doc.text(doc.splitTextToSize(v2 || '—', half - 4), M + half, y)
    y += 6.5
  }
  const bloco = (label: string, texto: string) => {
    checkPage(12)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MID)
    doc.text(label, M, y); y += 4
    doc.setFontSize(9.5); doc.setTextColor(...DARK)
    const lines = doc.splitTextToSize(texto, CW)
    for (const ln of lines) { checkPage(6); doc.text(ln, M, y); y += 4.5 }
    y += 2
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 34, 'F')
  if (logo) { try { doc.addImage(logo, 'PNG', M, 8, 46, 12) } catch { /* ignore */ } }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 190, 200)
  doc.text(`CNPJ: ${empresa.cnpj}`, M, 25)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('RELATÓRIO DIÁRIO DE OBRA', W - M, 13, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 190, 200)
  doc.text('RDO', W - M, 18, { align: 'right' })
  doc.text(fmtDate(r.data), W - M, 23, { align: 'right' })
  y = 42

  // ── Dados do dia ─────────────────────────────────────────────────────────────
  secao('DADOS DO DIA')
  par('Obra', r.obra_nome, 'Data', fmtDate(r.data))
  const fiscais = (r.fiscais_cemig?.length ? r.fiscais_cemig : (r.fiscal_cemig ? [r.fiscal_cemig] : [])).join(', ')
  const tsts = (r.tst_nomes?.length ? r.tst_nomes : (r.tst_nome ? [r.tst_nome] : [])).map(s => s.trim()).join(', ')
  par('Clima', WEATHER[r.condicao_climatica] ?? r.condicao_climatica, 'Horas improdutivas',
    (r.horas_improdutivas ?? 0) > 0 ? `${r.horas_improdutivas}h${r.motivo_improdutividade ? ` — ${r.motivo_improdutividade}` : ''}` : '—')
  par('Fiscal(is) CEMIG', fiscais || '—', 'TST alocado(s)', tsts || '—')
  par('Preenchido por', r.preenchido_por_nome ?? '—', '', '')

  // ── Avanço por atividade ─────────────────────────────────────────────────────
  const { data: avancos } = await supabase.from('obr_rdo_avanco')
    .select('atividade, avanco, estrutura_id').eq('rdo_id', r.id)
  const { data: estrs } = await supabase.from('obr_estruturas')
    .select('id, nome').eq('obra_id', r.obra_id)
  const estMap = new Map((estrs ?? []).map(e => [String(e.id), e.nome as string]))
  if (avancos?.length) {
    secao('AVANÇO DO DIA (por atividade × torre)')
    // agrupa por atividade
    const porAtv = new Map<string, { est: string; av: number }[]>()
    for (const a of avancos) {
      const arr = porAtv.get(a.atividade as string) ?? []
      arr.push({ est: estMap.get(String(a.estrutura_id)) ?? '—', av: Number(a.avanco) })
      porAtv.set(a.atividade as string, arr)
    }
    doc.setFontSize(8.5)
    for (const [atv, itens] of porAtv) {
      checkPage(8)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK)
      doc.text(doc.splitTextToSize(atv, CW), M, y); y += 4.5
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MID); doc.setFontSize(8)
      const txt = itens.map(i => `T${i.est}: ${Math.round(i.av * 100)}%`).join('   ')
      const lines = doc.splitTextToSize(txt, CW - 4)
      for (const ln of lines) { checkPage(5); doc.text(ln, M + 3, y); y += 4 }
      y += 1.5; doc.setFontSize(8.5)
    }
    y += 2
  }

  // ── Ocorrências e impeditivos ────────────────────────────────────────────────
  const { data: eventos } = await supabase.from('obr_rdo_eventos')
    .select('natureza, tipo, horas_perdidas, descricao').eq('rdo_id', r.id).order('natureza')
  if (eventos?.length) {
    secao('OCORRÊNCIAS E IMPEDITIVOS')
    doc.setFontSize(9)
    for (const e of eventos) {
      checkPage(7)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...RED)
      doc.text(`• ${NATUREZA_LABEL[e.natureza as string] ?? e.natureza}`, M, y)
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      const detalhe = [EVENTO_LABEL[e.tipo as string] ?? e.tipo,
        (e.horas_perdidas ?? 0) > 0 ? `${e.horas_perdidas}h` : '', e.descricao].filter(Boolean).join(' — ')
      const lines = doc.splitTextToSize(detalhe, CW - 28)
      doc.text(lines, M + 26, y); y += Math.max(lines.length * 4.2, 5)
    }
    y += 2
  }

  // ── Textos ───────────────────────────────────────────────────────────────────
  if (r.resumo_atividades) { secao('RESUMO DAS ATIVIDADES'); bloco('', r.resumo_atividades) }
  if (r.notas) bloco('Notas', r.notas)

  // ── Equipe e recursos ────────────────────────────────────────────────────────
  const { data: equipe } = await supabase.from('obr_rdo_equipe')
    .select('nome, funcao, presente').eq('rdo_id', r.id).order('nome')
  const { data: recursos } = await supabase.from('obr_rdo_recurso')
    .select('descricao, operando').eq('rdo_id', r.id).order('descricao')
  if (equipe?.length || recursos?.length) {
    secao('EQUIPE E RECURSOS')
    if (equipe?.length) {
      const pres = equipe.filter(e => e.presente)
      bloco(`Equipe presente (${pres.length})`, pres.map(e => `${e.nome}${e.funcao ? ` (${e.funcao})` : ''}`).join(' · ') || '—')
    }
    if (recursos?.length) {
      const op = recursos.filter(r2 => r2.operando)
      bloco(`Recursos operando (${op.length})`, op.map(r2 => r2.descricao).join(' · ') || '—')
    }
  }

  // ── Fotos ────────────────────────────────────────────────────────────────────
  const { data: fotos } = await supabase.from('obr_rdo_fotos')
    .select('url, escopo, atividade, legenda').eq('rdo_id', r.id).limit(24)
  if (fotos?.length) {
    secao('REGISTRO FOTOGRÁFICO')
    const cols = 3, gap = 4, cellW = (CW - gap * (cols - 1)) / cols, cellH = cellW * 0.72
    let col = 0
    for (const f of fotos) {
      if (!f.url) continue
      const img = await loadImg(f.url as string)
      if (!img) continue
      if (col === 0) checkPage(cellH + 8)
      const x = M + col * (cellW + gap)
      try { doc.addImage(img.data, 'JPEG', x, y, cellW, cellH) } catch { /* ignore */ }
      doc.setFontSize(6.5); doc.setTextColor(...MID)
      const cap = (f.escopo === 'atividade' ? (f.atividade ?? '') : (f.legenda ?? 'ocorrência')) as string
      doc.text(doc.splitTextToSize(cap, cellW).slice(0, 1), x, y + cellH + 3)
      col++
      if (col >= cols) { col = 0; y += cellH + 8 }
    }
    if (col > 0) y += cellH + 8
  }

  // ── Rodapé ───────────────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MID)
    doc.text(`${empresa.razao} — RDO ${fmtDate(r.data)}`, M, 290)
    doc.text(`${p}/${pages}`, W - M, 290, { align: 'right' })
  }
  return doc
}

/** Monta o jsPDF do RDO (não baixa) — usado pelo visualizador e pelo download. */
export async function gerarRdoDoc(r: RdoPdfData) {
  let empresa: EmpresaData = EMPRESA_FALLBACK
  try { empresa = await getEmpresa() } catch { /* fallback */ }
  const logoInfo = await loadImg('/logo-teg-transicao-branca.png')
  return buildDoc(r, empresa, logoInfo?.data ?? null)
}

export function nomeArquivoRdo(r: RdoPdfData) {
  return `RDO_${r.obra_nome.split(/[\s-]/)[0]}_${(r.data ?? '').replace(/-/g, '')}.pdf`
}
