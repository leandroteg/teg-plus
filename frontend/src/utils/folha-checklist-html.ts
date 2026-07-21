// utils/folha-checklist-html.ts — Relatório do checklist de validação da folha
// em HTML (mesmo padrão do template oficial do DP: cabeçalho azul/amarelo,
// seções numeradas, tabela ✓ / Item / Nº Desvios / Observações). Abre em nova
// aba pronta para imprimir/salvar em PDF.
import type { DPFolha, DPFolhaItem, DPFolhaDesvio } from '../hooks/useDPFolha'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const compLabel = (c: string) => { const [y, m] = c.split('-'); return `${MESES[Number(m) - 1] ?? m}/${y}` }
const fmtBRL = (v?: number | null) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Metadados das seções (número, título, nota) — espelham o template oficial.
const SECOES: { ord: number; num: string; titulo: string; nota: string }[] = [
  { ord: 1, num: '1', titulo: 'Movimentações e Cadastros', nota: 'Janela de movimentação: dia 1 ao 25 · congela 26 a 30' },
  { ord: 2, num: '2', titulo: 'Ponto e Jornada', nota: 'Fechamento do ponto: dia 26 ao 25 · justificar em 24h' },
  { ord: 3, num: '3', titulo: 'Horas Extras', nota: 'Aprovação prévia · máximo 2h/dia' },
  { ord: 4, num: '4', titulo: 'Ausências e Afastamentos', nota: 'Atestados em até 48h · licenças legais' },
  { ord: 5, num: '5', titulo: 'Benefícios', nota: 'Referência = lançamentos do DP' },
  { ord: 6, num: '6', titulo: 'Descontos e Termos', nota: 'Dentro de parâmetros legais' },
  { ord: 8, num: '8', titulo: 'Conferências Finais', nota: 'Líquidos · variação · adicionais · eSocial' },
]

const RES_TAG: Record<string, { txt: string; bg: string; cor: string }> = {
  ok:              { txt: 'OK',              bg: '#dcfce7', cor: '#15803d' },
  desvio:          { txt: 'Desvio',          bg: '#fee2e2', cor: '#b91c1c' },
  atencao:         { txt: 'Atenção',         bg: '#fef3e2', cor: '#b45309' },
  na:              { txt: 'N/A',             bg: '#f1f5f9', cor: '#64748b' },
  nao_verificavel: { txt: 'Não verificável', bg: '#f1f5f9', cor: '#64748b' },
}
const SEV_COR: Record<string, string> = { alta: '#b91c1c', media: '#b45309', baixa: '#64748b' }

export function gerarFolhaChecklistHtml(folha: DPFolha, itens: DPFolhaItem[], desvios: DPFolhaDesvio[]): void {
  const r = folha.resumo || {}
  const secaoOrdemDe = (it: DPFolhaItem) => {
    if (it.secao_ordem) return it.secao_ordem
    const m = (it.item_codigo || '').match(/^(\d+)/)
    return m ? Number(m[1]) : 9
  }
  const desviosDe = (cod?: string | null) => desvios.filter(d => d.item_codigo === cod)

  const secoesHtml = SECOES.map(sec => {
    const its = itens.filter(it => secaoOrdemDe(it) === sec.ord).sort((a, b) => (a.item_codigo || '').localeCompare(b.item_codigo || ''))
    if (!its.length) return ''
    const rows = its.map(it => {
      const tag = RES_TAG[it.resultado] ?? RES_TAG.na
      const ds = desviosDe(it.item_codigo)
      const dsHtml = ds.length ? `<ul class="dv">${ds.map(d =>
        `<li><span class="sv" style="color:${SEV_COR[d.severidade] || '#64748b'}">■</span> ${d.colaborador_nome ? `<b>${esc(d.colaborador_nome)}:</b> ` : ''}${esc(d.descricao)}${(d.valor_esperado || d.valor_encontrado) ? ` <i>(esperado ${esc(d.valor_esperado || '—')} · encontrado ${esc(d.valor_encontrado || '—')})</i>` : ''}</li>`
      ).join('')}</ul>` : ''
      return `<tr>
        <td class="c-cb"><span class="tag" style="background:${tag.bg};color:${tag.cor}">${tag.txt}</span></td>
        <td class="c-it"><b>${esc(it.item_codigo)}</b> ${esc(it.item_titulo)}${dsHtml}</td>
        <td class="c-er">${it.qtd_desvios || ''}</td>
        <td class="c-obs">${esc(it.observacao)}</td>
      </tr>`
    }).join('')
    return `<div class="sec">
      <div class="sec-h"><span class="n">${sec.num}</span> ${esc(sec.titulo)} <span class="note">${esc(sec.nota)}</span></div>
      <table class="items">
        <tr class="col-head"><td class="c-cb">Resultado</td><td class="c-it">Item de verificação</td><td class="c-er">Nº Desvios</td><td class="c-obs">Observações</td></tr>
        ${rows}
      </table>
    </div>`
  }).join('')

  const totalDesvios = folha.qtd_desvios ?? desvios.length
  const dataGer = new Date(Date.now() - 3 * 3600_000).toLocaleString('pt-BR')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Checklist de Validação da Folha · ${esc(compLabel(folha.competencia))} · TEG União</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600;700&display=swap');
:root{--azul:#1a3a5c;--azul2:#244c75;--amarelo:#f59e0b;--cinza:#cbd5e1;--text:#1e293b;--muted:#64748b;}
*{box-sizing:border-box;margin:0;padding:0;}@page{size:A4 portrait;margin:11mm 12mm;}
html,body{background:#e8edf3;}body{font-family:'Barlow',sans-serif;color:var(--text);font-size:9pt;}
.sheet{width:186mm;background:#fff;margin:14px auto;padding:0;}
.top{background:var(--azul);color:#fff;padding:9px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid var(--amarelo);border-radius:8px 8px 0 0;}
.top .ti{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16pt;line-height:1.05;}
.top .ti span{color:var(--amarelo);}
.top .sub{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:9.5pt;opacity:.9;margin-top:1px;}
.top .meta{font-size:7.4pt;text-align:right;opacity:.9;line-height:1.4;}
.hdr-fields{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--cinza);border-top:none;}
.hf{padding:8px 10px;border-right:1px solid var(--cinza);}.hf:last-child{border-right:none;}
.hf .lb{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:7.6pt;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;}
.hf .vl{font-weight:600;font-size:9pt;margin-top:3px;color:var(--azul);}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 12px 2px;}
.kpi{border:1px solid var(--cinza);border-radius:6px;padding:7px 9px;}
.kpi .k{font-size:7.2pt;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);font-weight:700;}
.kpi .v{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13pt;color:var(--azul);}
.sintese{padding:6px 12px 2px;font-size:8.6pt;color:#334155;}
.wrap{border:1px solid var(--cinza);border-top:none;border-radius:0 0 8px 8px;padding:9px 12px 11px;margin-top:8px;}
.sec{break-inside:avoid;margin-bottom:11px;}
.sec-h{background:var(--azul2);color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10.8pt;letter-spacing:.3px;padding:5px 11px;border-radius:5px 5px 0 0;display:flex;align-items:center;gap:7px;}
.sec-h .n{background:var(--amarelo);color:var(--azul);width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:800;}
.sec-h .note{font-family:'Barlow',sans-serif;font-weight:500;font-size:7.4pt;opacity:.82;margin-left:9px;}
table{width:100%;border-collapse:collapse;}
table.items td{border:1px solid #e6ebf1;padding:5px 8px;vertical-align:top;font-size:8.7pt;line-height:1.32;}
table.items tr:nth-child(even) td{background:#f8fafc;}
td.c-cb{width:11%;text-align:center;white-space:nowrap;}
td.c-it{width:56%;}td.c-it b{color:var(--azul);}
td.c-er{width:9%;text-align:center;font-weight:700;}
td.c-obs{width:24%;border-left:1px solid #e6ebf1;color:#475569;font-size:8.1pt;}
.col-head td{background:var(--azul)!important;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:7.6pt;text-transform:uppercase;letter-spacing:.3px;text-align:center;padding:3px 6px;}
.col-head td.c-it{text-align:left;}
.tag{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:7.4pt;padding:1px 7px;border-radius:9px;white-space:nowrap;}
ul.dv{margin:4px 0 1px 2px;padding-left:12px;list-style:none;}
ul.dv li{font-size:8pt;color:#475569;margin-bottom:2px;text-indent:-10px;padding-left:10px;}
ul.dv .sv{font-size:7pt;margin-right:3px;}ul.dv i{color:#94a3b8;}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:12px;padding:0 6px;break-inside:avoid;}
.sg .sl{border-top:1.4px solid #475569;margin-top:30px;padding-top:3px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:8.5pt;color:var(--azul);}
.sg .sd{text-align:center;font-size:7.4pt;color:var(--muted);}
.foot{margin-top:10px;padding-top:6px;border-top:1px solid var(--cinza);display:flex;justify-content:space-between;font-size:7pt;color:var(--muted);}
.foot b{color:var(--azul);}
.pbar{position:fixed;top:0;left:0;right:0;background:#1a3a5c;color:#fff;padding:8px;text-align:center;font-family:'Barlow',sans-serif;font-size:10pt;}
.pbar button{background:var(--amarelo);color:#1a3a5c;border:0;border-radius:6px;padding:5px 14px;font-weight:700;cursor:pointer;margin-left:8px;}
@media print{html,body{background:#fff;}.sheet{margin:0;width:auto;}.pbar{display:none;}}
</style></head><body>
<div class="pbar">Relatório do checklist — Folha ${esc(compLabel(folha.competencia))}<button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<div class="sheet" style="margin-top:44px">
  <div class="top">
    <div><div class="ti">TEG<span>·</span>UNIÃO</div><div class="sub">Checklist de Validação da Apuração da Folha</div></div>
    <div class="meta">Departamento Pessoal · Verificação SuperTEG<br>Gerado em ${esc(dataGer)}</div>
  </div>
  <div class="hdr-fields">
    <div class="hf"><div class="lb">Competência</div><div class="vl">${esc(compLabel(folha.competencia))}</div></div>
    <div class="hf"><div class="lb">Responsável (DP)</div><div class="vl">${esc(folha.criado_por_nome || '—')}</div></div>
    <div class="hf"><div class="lb">Total de desvios</div><div class="vl">${totalDesvios}</div></div>
    <div class="hf"><div class="lb">Status</div><div class="vl">${esc(folha.status)}</div></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="k">Colaboradores</div><div class="v">${esc(r.colaboradores_folha ?? '—')}</div></div>
    <div class="kpi"><div class="k">Líquido total</div><div class="v">${fmtBRL(r.total_liquido)}</div></div>
    <div class="kpi"><div class="k">Bruto total</div><div class="v">${fmtBRL(r.total_bruto)}</div></div>
    <div class="kpi"><div class="k">Var. vs mês ant.</div><div class="v">${r.variacao_mes_anterior_pct != null ? esc(r.variacao_mes_anterior_pct) + '%' : '—'}</div></div>
  </div>
  ${r.sintese ? `<div class="sintese"><b>Síntese:</b> ${esc(r.sintese)}</div>` : ''}
  <div class="wrap">${secoesHtml}
    <div class="sign">
      <div class="sg"><div class="sl">Responsável (DP)</div><div class="sd">Elaboração / apuração</div></div>
      <div class="sg"><div class="sl">Conferência / Aprovação</div><div class="sd">Supervisão do módulo</div></div>
    </div>
    <div class="foot"><span><b>TEG União Energia</b> · Departamento Pessoal</span><span>Verificação automatizada pelo SuperTEG · pagamento no 5º dia útil</span></div>
  </div>
</div></body></html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para abrir o relatório.'); return }
  win.document.write(html)
  win.document.close()
}
