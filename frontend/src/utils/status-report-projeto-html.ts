// ─────────────────────────────────────────────────────────────────────────────
// status-report-projeto-html.ts — Status Report de Projeto (EGP) em HTML.
// Abre em nova aba com CSS de impressão A4 (Ctrl+P / botão = salvar em PDF).
// Capítulos respondem as 10 perguntas do padrão: dados quantitativos (tabelas)
// + análise do SuperTEG (Q&A com conclusão, tabela de evidência e bullets).
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjHtmlPacote { n: string; pctFis: number | null; pctFin: number; qtdContr: number; qtdReal: number; unidade: string | null; valor: number }
export interface ProjHtmlMedRow { pac: string; meses: number[]; total: number }
export interface ProjHtmlAcao { acao: string; dono?: string; prazo?: string }
export interface ProjHtmlObra { nome: string; status: string | null; diagnostico: string | null; farol: string | null; acoes: ProjHtmlAcao[] | null }
export interface ProjHtmlObraLista { nome: string; oscs: string[] }
export interface ProjHtmlPrazo { pctPrazoProj: number | null; terminoPrev: string | null; obras: { nome: string; venc: string | null; pctPrazo: number | null }[] }
export interface ProjHtmlRecursos { fundacao: number; montlanc: number; maqFund: number; maqML: number }
export interface ProjHtmlRisco { descricao: string; categoria: string | null; sev: number; prob: number; imp: number }
export interface ProjHtmlCapItem { q: string; a: string; tabela?: { colunas: string[]; linhas: string[][] } | null; bullets?: string[] | null }
export interface ProjHtmlCap { key: string; titulo: string; itens: ProjHtmlCapItem[] }
export interface ProjHtmlStReport { farol: string | null; sintese: string | null; decisoes: string[] | null; capitulos: ProjHtmlCap[] | null; gerado_em: string | null }
export interface StatusReportProjetoHtmlData {
  projeto: string; nObras: number; nOscs: number
  pctFis: number; pctFin: number
  contratado: number; faturado: number; saldo: number
  obrasLista: ProjHtmlObraLista[]
  pacotes: ProjHtmlPacote[]
  medicao: ProjHtmlMedRow[]
  meses: string[]
  prazo: ProjHtmlPrazo
  recursos: ProjHtmlRecursos | null
  riscos: ProjHtmlRisco[]
  custos: { realizado: number; orcado: number } | null
  obras: ProjHtmlObra[]
  stReport: ProjHtmlStReport | null
}

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmtM = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M` : `R$ ${Math.round(v / 1e3)}k`
const fmtQ = (q: number, u: string | null) => u ? `${Number(q).toLocaleString('pt-BR', { maximumFractionDigits: q < 10 ? 1 : 0 })} ${u}` : ''
const fmtD = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
const FAROL_BG: Record<string, string> = { vermelho: '#dc2626', amarelo: '#d97706', verde: '#059669', cinza: '#64748b' }
const chip = (farol: string | null) => { const f = farol ?? 'cinza'; return `<span class="chip" style="background:${FAROL_BG[f] ?? FAROL_BG.cinza}">${esc(f.toUpperCase())}</span>` }
const pacColor = (n: string) => {
  const s = n.toLowerCase()
  if (s.includes('cabo')) return '#4f46e5'
  if (s.includes('torre') || s.includes('montag')) return '#1e293b'
  if (s.includes('funda')) return '#b45309'
  if (s.includes('adm')) return '#7c3aed'
  if (s.includes('prelim') || s.includes('canteir')) return '#2563eb'
  return '#64748b'
}
const sevLbl = (s: number) => s >= 16 ? 'Crítico' : s >= 11 ? 'Alto' : s >= 6 ? 'Médio' : 'Baixo'
const sevColor = (s: number) => s >= 16 ? '#dc2626' : s >= 11 ? '#ea580c' : s >= 6 ? '#d97706' : '#059669'
const CAT_LBL: Record<string, string> = { prazo: 'Prazo', custo: 'Custo', recurso: 'Recurso', seguranca: 'Segurança', qualidade: 'Qualidade', ambiental: 'Ambiental', externo: 'Externo', contratual: 'Contratual' }

function diasLbl(venc: string | null): { txt: string; cls: string } {
  if (!venc) return { txt: '—', cls: 'mut' }
  const n = Math.round((Date.now() - new Date(venc + 'T00:00:00').getTime()) / 86400000)
  if (n > 0) return { txt: `${n} dias de atraso`, cls: 'neg' }
  if (n < 0) return { txt: `faltam ${-n} dias`, cls: 'pos' }
  return { txt: 'vence hoje', cls: 'warn' }
}

function qaHtml(caps: Map<string, ProjHtmlCap>, key: string): string {
  const cap = caps.get(key)
  if (!cap || !(cap.itens ?? []).length) return ''
  return cap.itens.map(it => {
    const tb = it.tabela && (it.tabela.colunas?.length ?? 0) >= 2 && (it.tabela.linhas?.length ?? 0) > 0 ? it.tabela : null
    return `<div class="qa">
      <p class="q">» ${esc(it.q)}</p>
      ${it.a ? `<p class="a">${esc(it.a)}</p>` : ''}
      ${tb ? `<table class="tb"><thead><tr>${tb.colunas.map((c, i) => `<th class="${i === 0 ? 'l' : 'r'}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${tb.linhas.map(l => `<tr>${tb.colunas.map((_c, i) => `<td class="${i === 0 ? 'l' : 'r'}">${esc(l[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
      ${(it.bullets ?? []).length ? `<ul class="bl">${(it.bullets ?? []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>`
  }).join('')
}

function buildHtml(d: StatusReportProjetoHtmlData): string {
  const caps = new Map<string, ProjHtmlCap>((d.stReport?.capitulos ?? []).map(c => [c.key, c]))
  let chap = 0
  const chapter = (t: string, inner: string) => { chap++; return `<section class="ch"><h2><span class="n">${chap}</span>${esc(t)}</h2>${inner}</section>` }
  const naDisp = (txt: string) => `<p class="nadisp">Não disponível no período — ${esc(txt)}</p>`

  // 1. Obras e OSCs
  const cObras = d.obrasLista.length
    ? `<table class="tb"><thead><tr><th class="l">Obra</th><th class="l">OSCs</th></tr></thead><tbody>${d.obrasLista.map(ob => `<tr><td class="l b">${esc(ob.nome)}</td><td class="l mut">${esc(ob.oscs.length ? ob.oscs.join(' · ') : 'sem OSC vinculada')}</td></tr>`).join('')}</tbody></table>`
    : '<p class="mut">Sem obras de construção em aberto neste projeto.</p>'

  // 2. Físico (EAP cards)
  const cFisico = `<div class="grid2">${d.pacotes.map(pc => {
    const color = pacColor(pc.n)
    const bar = Math.min(pc.pctFis ?? pc.pctFin, 100)
    const qb = fmtQ(pc.qtdContr, pc.unidade)
    return `<div class="pac"><div class="pt"><b>${esc(pc.n)}</b>${qb ? `<span class="badge" style="background:${color}">${esc(qb)}</span>` : ''}</div>
      <div class="barbg"><div class="bar" style="width:${bar}%;background:${color}"></div></div>
      <div class="pf"><span class="mut">${pc.pctFis != null ? `Físico ${pc.pctFis}% · falta ${esc(fmtQ(pc.qtdContr - (pc.qtdReal ?? 0), pc.unidade) || '0')}` : `Faturado ${pc.pctFin}%`}</span><b>${fmtM(pc.valor)}</b></div></div>`
  }).join('')}</div>` + qaHtml(caps, 'fisico')

  // 3. Prazo (dias)
  const pjD = diasLbl(d.prazo?.terminoPrev ?? null)
  const cPrazo = (d.prazo?.terminoPrev || d.prazo?.obras?.length)
    ? `<p class="lead">Término previsto (vencimento da última OSC): <b>${fmtD(d.prazo?.terminoPrev ?? null)}</b> — <span class="${pjD.cls}">${pjD.txt}</span> · Físico atual <b>${d.pctFis}%</b>.</p>` +
      (d.prazo?.obras?.length ? `<table class="tb"><thead><tr><th class="l">Obra</th><th class="r">Vencimento</th><th class="r">Desvio de prazo</th></tr></thead><tbody>${d.prazo.obras.map(o => { const dl = diasLbl(o.venc); return `<tr><td class="l b">${esc(o.nome)}</td><td class="r">${fmtD(o.venc)}</td><td class="r ${dl.cls}">${dl.txt}</td></tr>` }).join('')}</tbody></table>` : '')
    : naDisp('datas de OSC/vencimento não lançadas.')
  const cPrazoFull = cPrazo + qaHtml(caps, 'prazo')

  // 4. Produção (medição mês a mês)
  let cProd = ''
  if (d.medicao.length) {
    const tot = new Array(d.meses.length).fill(0); let totG = 0
    const rows = d.medicao.map(m => { m.meses.forEach((v, i) => tot[i] += v); totG += m.total; return `<tr><td class="l b">${esc(m.pac)}</td>${m.meses.map(v => `<td class="r ${v > 0 ? '' : 'dot'}">${v > 0 ? fmtM(v) : '·'}</td>`).join('')}<td class="r bold">${fmtM(m.total)}</td></tr>` }).join('')
    cProd = `<table class="tb"><thead><tr><th class="l">Pacote</th>${d.meses.map(mL => `<th class="r">${esc(mL)}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${rows}<tr class="totr"><td class="l bold">Total</td>${tot.map(v => `<td class="r bold">${fmtM(v)}</td>`).join('')}<td class="r bold">${fmtM(totG)}</td></tr></tbody></table>`
  } else cProd = '<p class="mut">Sem medições lançadas no período.</p>'
  cProd += qaHtml(caps, 'producao')

  // 5. Financeiro
  let finRows = `<tr><td class="l mut">Contratado</td><td class="r b">${fmtM(d.contratado)}</td></tr>
    <tr><td class="l mut">Faturado (medido)</td><td class="r pos b">${fmtM(d.faturado)} (${d.pctFin}%)</td></tr>
    <tr><td class="l mut">Saldo a produzir</td><td class="r neg b">${fmtM(d.saldo)}</td></tr>`
  if (d.custos) {
    const pctC = d.custos.orcado > 0 ? Math.round(d.custos.realizado / d.custos.orcado * 100) : 0
    const mg = d.faturado - d.custos.realizado
    finRows += `<tr><td class="l mut">Custo realizado × orçado (frente)</td><td class="r b">${fmtM(d.custos.realizado)} de ${fmtM(d.custos.orcado)} (${pctC}%)</td></tr>
      <tr><td class="l mut">Margem parcial (faturado − custo)</td><td class="r b ${mg >= 0 ? 'pos' : 'neg'}">${fmtM(mg)}</td></tr>`
  }
  const cFin = `<table class="tb kv"><tbody>${finRows}</tbody></table>` + qaHtml(caps, 'financeiro')

  // 6. Recursos
  const cRec = (d.recursos
    ? `<table class="tb kv"><tbody>
        <tr><td class="l mut">Pessoas — Fundação</td><td class="r b">${d.recursos.fundacao}</td></tr>
        <tr><td class="l mut">Pessoas — Montagem / Lançamento</td><td class="r b">${d.recursos.montlanc}</td></tr>
        <tr><td class="l mut">Máquinas de fundação</td><td class="r b">${d.recursos.maqFund}</td></tr>
        <tr><td class="l mut">Guindauto / lançamento</td><td class="r b">${d.recursos.maqML}</td></tr></tbody></table>`
    : '') + (qaHtml(caps, 'recursos') || (d.recursos ? '' : naDisp('efetivo da frente não casado com a base do projeto.')))

  // 7. Riscos
  const cRis = (d.riscos.length
    ? `<table class="tb"><thead><tr><th class="l">Risco</th><th class="l">Categoria</th><th class="r">Severidade</th></tr></thead><tbody>${d.riscos.map(r => `<tr><td class="l">${esc(r.descricao)}</td><td class="l mut">${esc(r.categoria ? (CAT_LBL[r.categoria] ?? r.categoria) : '—')}</td><td class="r b" style="color:${sevColor(r.sev)}">${sevLbl(r.sev)} (${r.prob}×${r.imp})</td></tr>`).join('')}</tbody></table>`
    : '') + (qaHtml(caps, 'riscos') || (d.riscos.length ? '' : naDisp('nenhum risco cadastrado no módulo EGP-Riscos.')))

  // 8. Segurança
  const cSeg = qaHtml(caps, 'seguranca') || naDisp('sem análise QSMA — gere o relatório com o SuperTEG.')

  // 9. Contrato (só se houver conteúdo)
  const cContrato = qaHtml(caps, 'contrato')

  // 10. Ações e obras críticas
  const cAcoes = (d.obras.length
    ? d.obras.map(o => `<div class="obra">
        <p class="ot">${chip(o.farol)}<b>${esc(o.nome)}</b></p>
        <p class="a">${esc(o.diagnostico ?? o.status ?? '')}</p>
        ${(o.acoes ?? []).length ? `<table class="tb"><thead><tr><th class="l">Ação</th><th class="l">Responsável</th><th class="r">Prazo</th></tr></thead><tbody>${(o.acoes ?? []).map(a => `<tr><td class="l">${esc(a.acao)}</td><td class="l mut">${esc(a.dono ?? '—')}</td><td class="r">${esc(a.prazo ?? '—')}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>`).join('')
    : '<p class="mut">Nenhuma obra marcada como crítica no momento.</p>') + qaHtml(caps, 'acoes')

  // 11. Síntese
  let cSint = ''
  if (d.stReport?.sintese) {
    cSint = `<p class="ot">${chip(d.stReport.farol)}<b>Farol do projeto</b></p><p class="lead">${esc(d.stReport.sintese)}</p>`
    const decs = d.stReport.decisoes ?? []
    if (decs.length) cSint += `<p class="dec-t">Exige decisão da diretoria:</p><ul class="bl dec">${decs.map(dec => `<li>${esc(dec)}</li>`).join('')}</ul>`
  } else {
    cSint = `<p class="lead">Projeto com <b>${d.pctFis}%</b> físico e <b>${d.pctFin}%</b> financeiro sobre ${fmtM(d.contratado)} contratados (saldo ${fmtM(d.saldo)}). Gere o relatório com o SuperTEG para farol, síntese e decisões.</p>`
  }

  const geradoEm = d.stReport?.gerado_em ? `Análise SuperTEG de ${new Date(d.stReport.gerado_em).toLocaleString('pt-BR')}` : `Gerado em ${new Date().toLocaleString('pt-BR')}`

  const body = [
    chapter('Obras e OSCs do projeto', cObras),
    chapter('Progresso físico (EAP)', cFisico),
    chapter('Prazo', cPrazoFull),
    chapter('Produção e ritmo — medição mês a mês', cProd),
    chapter('Financeiro / margem', cFin),
    chapter('Recursos e equipe', cRec),
    chapter(`Riscos e bloqueios${d.riscos.length ? ` (${d.riscos.length})` : ''}`, cRis),
    chapter('Segurança (QSMA)', cSeg),
    ...(cContrato ? [chapter('Contrato / cliente (CEMIG)', cContrato)] : []),
    chapter(`Ações e obras críticas${d.obras.length ? ` (${d.obras.length})` : ''}`, cAcoes),
    chapter('Síntese e decisão', cSint),
  ].join('')

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Status Report — ${esc(d.projeto)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:#1e293b; font-size:12px; line-height:1.45; background:#f1f5f9; }
  .page { max-width:840px; margin:0 auto; background:#fff; padding:0 0 32px; box-shadow:0 2px 16px rgba(0,0,0,.08); }
  header { background:#1e293b; color:#fff; padding:20px 32px; display:flex; justify-content:space-between; align-items:center; }
  header img { height:34px; }
  header .hr { text-align:right; }
  header .k { font-size:10px; font-weight:700; letter-spacing:.12em; color:#94a3b8; text-transform:uppercase; }
  header h1 { font-size:20px; font-weight:800; margin:2px 0; }
  header .sub { font-size:10.5px; color:#94a3b8; }
  .wrap { padding:20px 32px 0; }
  .meta { display:flex; align-items:center; gap:10px; color:#64748b; font-size:11.5px; margin-bottom:12px; }
  .chip { display:inline-block; color:#fff; font-size:9px; font-weight:800; letter-spacing:.06em; padding:2.5px 9px; border-radius:99px; vertical-align:middle; }
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
  .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; }
  .kpi .t { font-size:10.5px; color:#64748b; margin-bottom:3px; }
  .kpi .v { font-size:16px; font-weight:800; }
  .sintbox { border:1px solid #e2e8f0; border-left:4px solid #7c3aed; border-radius:10px; padding:12px 16px; margin-bottom:18px; background:#faf9ff; }
  .ch { margin-bottom:20px; break-inside:auto; }
  .ch h2 { background:#1e293b; color:#fff; font-size:12.5px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; padding:7px 12px; border-radius:7px; border-left:4px solid #dc2626; margin-bottom:10px; break-after:avoid; }
  .ch h2 .n { display:inline-block; background:#dc2626; border-radius:5px; padding:0 7px; margin-right:9px; }
  .tb { width:100%; border-collapse:collapse; margin:6px 0 10px; break-inside:auto; }
  .tb th { background:#f1f5f9; color:#475569; font-size:10px; text-transform:uppercase; letter-spacing:.05em; padding:5px 8px; }
  .tb td { padding:5px 8px; border-top:1px solid #f1f5f9; font-size:11.5px; }
  .tb tr { break-inside:avoid; }
  .tb tbody tr:nth-child(even) td { background:#fafbfc; }
  .tb .totr td { border-top:2px solid #cbd5e1; background:#f8fafc !important; }
  .tb.kv td { padding:6px 10px; }
  .l { text-align:left; } .r { text-align:right; font-variant-numeric:tabular-nums; }
  .b { font-weight:600; } .bold { font-weight:800; } .mut { color:#64748b; }
  .pos { color:#059669; } .neg { color:#dc2626; } .warn { color:#d97706; } .dot { color:#cbd5e1; }
  .lead { margin:2px 0 8px; font-size:12px; }
  .nadisp { color:#94a3b8; font-style:italic; font-size:11px; margin:2px 0 6px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
  .pac { border:1px solid #e2e8f0; border-radius:9px; padding:8px 10px; break-inside:avoid; }
  .pac .pt { display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; font-size:11.5px; }
  .badge { color:#fff; font-size:9px; font-weight:700; padding:1.5px 8px; border-radius:99px; }
  .barbg { height:8px; background:#e2e8f0; border-radius:99px; overflow:hidden; margin-bottom:5px; }
  .bar { height:100%; border-radius:99px; }
  .pf { display:flex; justify-content:space-between; font-size:10.5px; }
  .qa { margin:4px 0 10px; break-inside:avoid; }
  .qa .q { font-weight:700; font-size:11.5px; margin-bottom:2px; }
  .qa .a, .obra .a { color:#475569; margin:1px 0 4px 14px; font-size:11.5px; }
  .qa .tb { margin-left:14px; width:calc(100% - 14px); }
  .bl { margin:3px 0 6px 30px; }
  .bl li { color:#475569; font-size:11.5px; margin-bottom:2px; }
  .obra { margin-bottom:14px; break-inside:avoid; }
  .obra .ot, .ot { display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:4px; }
  .dec-t { font-weight:800; color:#b45309; font-size:11.5px; margin:8px 0 3px; }
  .bl.dec li { color:#1e293b; font-weight:500; }
  footer { color:#94a3b8; font-size:10px; font-style:italic; padding:14px 32px 0; display:flex; justify-content:space-between; }
  .printbtn { position:fixed; top:14px; right:14px; background:#0d9488; color:#fff; border:0; border-radius:9px; padding:10px 18px; font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 3px 12px rgba(0,0,0,.25); }
  .printbtn:hover { background:#0f766e; }
  @media print {
    body { background:#fff; }
    .page { box-shadow:none; max-width:none; }
    .printbtn { display:none; }
    @page { size:A4; margin:10mm 0 12mm; }
    header { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style></head><body>
<button class="printbtn" onclick="window.print()">Salvar PDF / Imprimir</button>
<div class="page">
  <header>
    <img src="${location.origin}/logo-teg-transicao-branca.png" alt="TEG" onerror="this.style.display='none'">
    <div class="hr">
      <div class="k">Status Report · Projeto</div>
      <h1>${esc(d.projeto)}</h1>
      <div class="sub">Escritório de Gestão de Projetos (EGP) · ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </header>
  <div class="wrap">
    <div class="meta">${d.nObras} obras · ${d.nOscs} OSCs · só construção não concluída ${d.stReport?.farol ? chip(d.stReport.farol) : ''}</div>
    <div class="kpis">
      <div class="kpi"><div class="t">Físico</div><div class="v">${d.pctFis}% · ${fmtM(d.contratado)}</div></div>
      <div class="kpi"><div class="t">Financeiro</div><div class="v" style="color:#059669">${d.pctFin}% · ${fmtM(d.faturado)}</div></div>
      <div class="kpi"><div class="t">Saldo a produzir</div><div class="v" style="color:#dc2626">${fmtM(d.saldo)}</div></div>
    </div>
    ${d.stReport?.sintese ? `<div class="sintbox"><p class="ot">${chip(d.stReport.farol)}<b>Síntese do SuperTEG</b></p><p class="lead">${esc(d.stReport.sintese)}</p></div>` : ''}
    ${body}
  </div>
  <footer><span>${esc(geradoEm)}</span><span>TEG Engenharia — uso interno</span></footer>
</div>
</body></html>`
}

export function gerarStatusReportProjetoHtml(d: StatusReportProjetoHtmlData): void {
  const html = buildHtml(d)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}
