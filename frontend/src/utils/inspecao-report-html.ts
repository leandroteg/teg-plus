// ─────────────────────────────────────────────────────────────────────────────
// inspecao-report-html.ts — Relatório de Inspeção em HTML, no mesmo padrão do
// rdo-report-html: o n8n manda esse HTML para o SuperTEG renderizar em PDF e
// anexa no e-mail. Não confundir com inspecao-pdf.ts, que é o jsPDF do botão
// "baixar" na tela — aquele roda no cliente e não serve para o envio.
// ─────────────────────────────────────────────────────────────────────────────
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import { evidenciaUrl } from '../hooks/useQsma'
import type { QsmaInspecao } from '../types/qsma'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmtDT = (iso?: string | null) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso) }
}

const RESP: Record<string, { txt: string; cor: string; bg: string }> = {
  c:  { txt: 'CONFORME',      cor: '#047857', bg: '#ecfdf5' },
  nc: { txt: 'NÃO CONFORME',  cor: '#b91c1c', bg: '#fef2f2' },
  na: { txt: 'N/A',           cor: '#475569', bg: '#f1f5f9' },
}

export function nomeArquivoInspecao(insp: QsmaInspecao): string {
  const aloj = (insp.imovel?.titulo || insp.imovel?.nome || 'alojamento').split(/[\s-]/)[0]
  return `Inspecao_${insp.codigo ?? 'sem-codigo'}_${aloj}`.replace(/[^\w.\- ]+/g, '_')
}

export async function buildInspecaoReportHtml(insp: QsmaInspecao): Promise<string> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const itens = insp.modelo?.itens ?? []

  // As evidências ficam em bucket privado: sem assinar, a imagem chega quebrada
  // no PDF (e o relatório sai "sem foto" justamente onde ela mais importa).
  const linhas = await Promise.all(itens.map(async it => {
    const r = insp.respostas.find(x => x.ordem === it.ordem)
    const chave = String(r?.resposta ?? '')
    const cfg = RESP[chave]
    const fotos = (await Promise.all((r?.foto_paths ?? []).map(p => evidenciaUrl(p)))).filter(Boolean) as string[]
    return `<tr class="${chave === 'nc' ? 'nc' : ''}">
      <td class="ord">${it.ordem}</td>
      <td>
        <div class="item">${esc(it.texto)}</div>
        ${r?.obs ? `<div class="obs">↳ ${esc(r.obs)}</div>` : ''}
        ${fotos.length ? `<div class="fotos">${fotos.slice(0, 6).map(u => `<img src="${esc(u)}" alt=""/>`).join('')}</div>` : ''}
      </td>
      <td class="resp">${cfg
        ? `<span class="tag" style="color:${cfg.cor};background:${cfg.bg}">${cfg.txt}</span>`
        : `<span class="tag livre">${esc(r?.resposta ?? '—')}</span>`}</td>
    </tr>`
  }))

  const ncs = insp.respostas.filter(r => r.resposta === 'nc').length
  const aloj = insp.imovel?.titulo || insp.imovel?.nome || '—'
  const cidade = [insp.imovel?.cidade, insp.imovel?.uf].filter(Boolean).join('/')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Relatório de Inspeção ${esc(insp.codigo ?? '')}</title>
<style>
  @page{size:A4 portrait;margin:12mm}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#0f172a;font-size:11pt}
  header.cab{background:#1e293b;color:#fff;padding:8mm 10mm;display:flex;align-items:center;justify-content:space-between;gap:8mm}
  header.cab .emp{font-size:12pt;font-weight:800}
  header.cab .sub{font-size:8pt;color:#b4becb;margin-top:1mm}
  header.cab .tit{text-align:right}
  header.cab .tit b{font-size:13pt;display:block}
  header.cab .tit span{font-size:8.5pt;color:#b4becb}
  h2{font-size:10.5pt;color:#dc2626;border-bottom:.6mm solid #dc2626;padding-bottom:1.2mm;margin:7mm 0 3mm}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm}
  .grid .lbl{font-size:8pt;color:#64748b}
  .grid .val{font-size:10pt;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-top:2mm}
  th{background:#f1f5f9;color:#475569;font-size:8pt;text-transform:uppercase;letter-spacing:.5px;text-align:left;padding:2mm}
  td{border-bottom:.3mm solid #e2e8f0;padding:2.5mm 2mm;vertical-align:top}
  tr{page-break-inside:avoid}
  tr.nc td{background:#fff5f5}
  td.ord{width:10mm;color:#94a3b8;font-family:Consolas,monospace}
  td.resp{width:34mm;text-align:right}
  .item{font-size:10pt}
  .obs{font-size:9pt;color:#64748b;font-style:italic;margin-top:1mm}
  .fotos{display:flex;flex-wrap:wrap;gap:2mm;margin-top:2mm}
  .fotos img{width:32mm;height:32mm;object-fit:cover;border:.3mm solid #cbd5e1;border-radius:2mm}
  .tag{font-size:7.5pt;font-weight:800;padding:1mm 2.5mm;border-radius:10mm;white-space:nowrap}
  .tag.livre{color:#0f172a;background:#f1f5f9}
  .resumo{display:flex;gap:4mm;margin-top:3mm}
  .kpi{flex:1;border:.3mm solid #e2e8f0;border-radius:2mm;padding:3mm;text-align:center}
  .kpi b{display:block;font-size:16pt}
  .kpi span{font-size:8pt;color:#64748b}
  .kpi.alerta b{color:#dc2626}
  .assin{display:flex;gap:14mm;margin-top:14mm}
  .assin div{flex:1;text-align:center;border-top:.3mm solid #0f172a;padding-top:2mm;font-size:9pt}
  .assin small{display:block;color:#64748b;font-size:7.5pt}
  footer.rod{margin-top:8mm;font-size:7.5pt;color:#94a3b8;text-align:center}
</style></head><body>
<header class="cab">
  <div>
    <div class="emp">${esc(empresa.fantasia)}</div>
    <div class="sub">CNPJ: ${esc(empresa.cnpj)}</div>
  </div>
  <div class="tit"><b>RELATÓRIO DE INSPEÇÃO</b><span>${esc(insp.codigo ?? '')} · QSMA</span></div>
</header>

<h2>DADOS DA INSPEÇÃO</h2>
<div class="grid">
  <div><div class="lbl">Alojamento</div><div class="val">${esc(aloj)}</div></div>
  <div><div class="lbl">Cidade</div><div class="val">${esc(cidade || '—')}</div></div>
  <div><div class="lbl">Checklist</div><div class="val">${esc(insp.modelo?.nome ?? '—')}</div></div>
  <div><div class="lbl">Grupo</div><div class="val">${esc(insp.modelo?.grupo ?? '—')}</div></div>
  <div><div class="lbl">Executor</div><div class="val">${esc(insp.executor_nome ?? '—')}</div></div>
  <div><div class="lbl">Data / Hora</div><div class="val">${esc(fmtDT(insp.data_execucao))}</div></div>
  <div><div class="lbl">Localização (GPS)</div><div class="val">${insp.latitude != null && insp.longitude != null
    ? `${Number(insp.latitude).toFixed(5)}, ${Number(insp.longitude).toFixed(5)}` : '—'}</div></div>
</div>

<div class="resumo">
  <div class="kpi"><b>${itens.length}</b><span>itens verificados</span></div>
  <div class="kpi ${ncs ? 'alerta' : ''}"><b>${ncs}</b><span>não conformidades</span></div>
</div>

<h2>ITENS VERIFICADOS</h2>
<table>
  <thead><tr><th>#</th><th>Item</th><th style="text-align:right">Resposta</th></tr></thead>
  <tbody>${linhas.join('')}</tbody>
</table>

${insp.observacoes ? `<h2>OBSERVAÇÕES GERAIS</h2><p>${esc(insp.observacoes)}</p>` : ''}

<div class="assin">
  <div>${esc(insp.executor_nome ?? 'Inspetor')}<small>Assinatura do inspetor (TST/SESMT)</small></div>
  <div>&nbsp;<small>Ciência do responsável</small></div>
</div>
<footer class="rod">Documento gerado pelo TEG+ QSMA em ${new Date().toLocaleString('pt-BR')}</footer>
</body></html>`
}
