// ─────────────────────────────────────────────────────────────────────────────
// rdo-report-html.ts — Relatório Diário de Obra em HTML (padrão estético do
// relatório de ocorrências QSMA). Abre no visualizador (iframe) e vira PDF pelo
// "Baixar" (print A4). Fotos entram embutidas via URL pública do bucket.
//
// Além dos dados, calcula o AVANÇO DO DIA: total em estruturas-equivalentes
// (Σ dos %) e o avanço por FRENTE (seção do catálogo).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import { EVENTO_LABEL } from '../pages/obras/RDOEstruturado'

const WEATHER: Record<string, string> = {
  sol: '☀️ Sol', nublado: '⛅ Nublado', chuva: '🌧️ Chuva', chuva_forte: '⛈️ Chuva forte', tempestade: '🌩️ Tempestade',
}
const NATUREZA: Record<string, { l: string; cor: string }> = {
  impeditivo: { l: 'Impeditivo', cor: '#dc2626' },
  ocorrencia: { l: 'Ocorrência', cor: '#d97706' },
  improdutividade: { l: 'Improdutividade', cor: '#7c3aed' },
}
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmtD = (d?: string | null) => { if (!d) return '—'; try { return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR') } catch { return String(d) } }
const pct = (v: number) => `${Math.round(v * 100)}%`

export interface RdoReportRow {
  id: string; obra_id: string; obra_nome: string; data: string
}

export async function buildRdoReportHtml(r: RdoReportRow): Promise<string> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)

  const [cabRes, avRes, estRes, catRes, evRes, eqRes, rcRes, foRes] = await Promise.all([
    supabase.from('obr_rdo').select('*').eq('id', r.id).single(),
    supabase.from('obr_rdo_avanco').select('estrutura_id, atividade, avanco').eq('rdo_id', r.id),
    supabase.from('obr_estruturas').select('id, nome, ordem').eq('obra_id', r.obra_id),
    supabase.from('obr_atividades_catalogo').select('secao, atividade, cor, ordem_secao, ordem').or(`obra_id.is.null,obra_id.eq.${r.obra_id}`).eq('ativo', true),
    supabase.from('obr_rdo_eventos').select('natureza, tipo, horas_perdidas, descricao').eq('rdo_id', r.id).order('natureza'),
    supabase.from('obr_rdo_equipe').select('nome, funcao, presente').eq('rdo_id', r.id).order('nome'),
    supabase.from('obr_rdo_recurso').select('descricao, operando').eq('rdo_id', r.id).order('descricao'),
    supabase.from('obr_rdo_fotos').select('url, escopo, atividade, legenda').eq('rdo_id', r.id).limit(60),
  ])

  const cab = (cabRes.data ?? {}) as Record<string, unknown>
  const avancos = (avRes.data ?? []) as { estrutura_id: string; atividade: string; avanco: number }[]
  const estMap = new Map((estRes.data ?? []).map(e => [String(e.id), e.nome as string]))
  const cat = (catRes.data ?? []) as { secao: string; atividade: string; cor: string | null; ordem_secao: number; ordem: number }[]
  const eventos = (evRes.data ?? []) as { natureza: string; tipo: string; horas_perdidas: number | null; descricao: string | null }[]
  const equipe = (eqRes.data ?? []) as { nome: string; funcao: string | null; presente: boolean }[]
  const recursos = (rcRes.data ?? []) as { descricao: string; operando: boolean }[]
  const fotos = (foRes.data ?? []) as { url: string | null; escopo: string; atividade: string | null; legenda: string | null }[]

  // atividade → { secao, cor }
  const atvInfo = new Map<string, { secao: string; cor: string; ordem_secao: number }>()
  for (const c of cat) if (!atvInfo.has(c.atividade)) atvInfo.set(c.atividade, { secao: c.secao, cor: c.cor ?? '#64748b', ordem_secao: c.ordem_secao })

  // ── totais por frente + total do dia ────────────────────────────────────────
  type Frente = { secao: string; cor: string; ordem: number; soma: number; cells: number }
  const frentes = new Map<string, Frente>()
  let totalDia = 0
  for (const a of avancos) {
    const info = atvInfo.get(a.atividade) ?? { secao: 'Outros', cor: '#64748b', ordem_secao: 99 }
    const f = frentes.get(info.secao) ?? { secao: info.secao, cor: info.cor, ordem: info.ordem_secao, soma: 0, cells: 0 }
    f.soma += Number(a.avanco); f.cells++; frentes.set(info.secao, f)
    totalDia += Number(a.avanco)
  }
  const frentesOrd = [...frentes.values()].sort((a, b) => a.ordem - b.ordem)

  // % avanço FÍSICO do dia = estruturas-equivalentes concluídas hoje ÷ (torres × atividades)
  const nAtividades = new Set(cat.map(c => c.atividade)).size
  const nEstruturas = estMap.size
  const totalCells = nEstruturas * nAtividades
  const pctFisicoDia = totalCells ? (totalDia / totalCells) * 100 : 0

  // avanços agrupados por frente → atividade → [torres]
  const porFrenteAtv = new Map<string, Map<string, { est: string; av: number }[]>>()
  for (const a of avancos) {
    const info = atvInfo.get(a.atividade) ?? { secao: 'Outros', cor: '#64748b', ordem_secao: 99 }
    const m = porFrenteAtv.get(info.secao) ?? new Map(); porFrenteAtv.set(info.secao, m)
    const arr = m.get(a.atividade) ?? []; arr.push({ est: estMap.get(String(a.estrutura_id)) ?? '—', av: Number(a.avanco) }); m.set(a.atividade, arr)
  }

  const fiscais = ((cab.fiscais_cemig as string[])?.length ? (cab.fiscais_cemig as string[]) : (cab.fiscal_cemig ? [cab.fiscal_cemig as string] : [])).join(', ')
  const tsts = ((cab.tst_nomes as string[])?.length ? (cab.tst_nomes as string[]) : (cab.tst_nome ? [cab.tst_nome as string] : [])).map(s => s.trim()).join(', ')
  const statusLabel = { pendente: 'Pendente', aprovado: 'Aprovado', rascunho: 'Pendente', finalizado: 'Aprovado' }[(cab.status as string) ?? 'pendente'] ?? 'Pendente'
  const statusCor = statusLabel === 'Aprovado' ? '#059669' : '#d97706'

  // ── blocos ──────────────────────────────────────────────────────────────────
  const kpi = (label: string, valor: string, cor = '#0d9488') =>
    `<div class="kpi"><div class="kpi-v" style="color:${cor}">${valor}</div><div class="kpi-l">${esc(label)}</div></div>`

  const frenteBars = frentesOrd.map(f => {
    const mediaTxt = f.cells ? pct(f.soma / f.cells) : '—'
    const largura = Math.min(100, Math.round((f.soma / Math.max(f.cells, 1)) * 100))
    return `<div class="fr">
      <div class="fr-top"><span class="dot" style="background:${f.cor}"></span><b>${esc(f.secao)}</b>
        <span class="fr-meta">${f.cells} lançamento(s) · ${f.soma.toFixed(1)} estrut.-eq · média ${mediaTxt}</span></div>
      <div class="bar"><div class="bar-in" style="width:${largura}%;background:${f.cor}"></div></div>
    </div>`
  }).join('')

  const avancoDetalhe = frentesOrd.map(f => {
    const atvs = porFrenteAtv.get(f.secao)
    if (!atvs) return ''
    const linhas = [...atvs.entries()].map(([atv, itens]) => `
      <tr><td class="atv">${esc(atv)}</td>
      <td>${itens.map(i => `<span class="torre ${i.av >= 1 ? 't100' : i.av > 0 ? 'tmid' : ''}">${esc(i.est)} · ${pct(i.av)}</span>`).join(' ')}</td></tr>`).join('')
    return `<tr class="fr-head"><td colspan="2" style="color:${f.cor}">▸ ${esc(f.secao)}</td></tr>${linhas}`
  }).join('')

  const eventosHtml = eventos.length ? eventos.map(e => {
    const n = NATUREZA[e.natureza] ?? { l: e.natureza, cor: '#64748b' }
    const det = [EVENTO_LABEL[e.tipo] ?? e.tipo, (e.horas_perdidas ?? 0) > 0 ? `${e.horas_perdidas}h` : '', e.descricao].filter(Boolean).join(' — ')
    return `<div class="ev"><span class="ev-tag" style="background:${n.cor}">${esc(n.l)}</span><span>${esc(det)}</span></div>`
  }).join('') : '<p class="empty">Sem ocorrências no dia.</p>'

  const equipePres = equipe.filter(e => e.presente)
  const recOper = recursos.filter(r2 => r2.operando)

  // agrupa por chave (função / categoria), ordenado, cada grupo é um <details open>
  const grupoLista = (itens: string[], chaveDe: (s: string) => string, rotuloDe: (s: string) => string) => {
    const g = new Map<string, string[]>()
    for (const it of itens) { const k = chaveDe(it) || 'Outros'; const a = g.get(k) ?? []; a.push(rotuloDe(it)); g.set(k, a) }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, arr]) =>
      `<details open class="grp"><summary>${esc(k)} <b>(${arr.length})</b></summary>
        <ul>${arr.sort((x, y) => x.localeCompare(y, 'pt-BR')).map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>`
    ).join('')
  }
  // função "normalizada" (tira o nível romano/numérico do fim, ex.: "Servente II" → "Servente")
  const funcaoBase = (f: string) => f.replace(/\s+(I{1,3}|IV|V|VI|\d+)\s*$/i, '').trim() || 'Sem função'
  const equipeHtml = equipePres.length
    ? grupoLista(equipePres.map(e => `${e.nome}||${e.funcao ?? ''}`),
        s2 => funcaoBase(s2.split('||')[1]), s2 => { const [n, f] = s2.split('||'); return f ? `${n} — ${f}` : n })
    : '<p class="empty">Nenhum colaborador presente.</p>'
  // categoria do recurso = último segmento após " · "
  const recHtml = recOper.length
    ? grupoLista(recOper.map(r2 => r2.descricao),
        d => { const p2 = d.split('·').map(x => x.trim()); return p2[p2.length - 1] || 'Recurso' }, d => d)
    : '<p class="empty">Nenhum recurso operando.</p>'

  const fotosHtml = fotos.filter(f => f.url).map(f => {
    const cap = f.escopo === 'atividade' ? (f.atividade ?? '') : (f.legenda ?? 'Ocorrência')
    return `<figure class="foto"><img src="${esc(f.url)}" loading="lazy"/><figcaption>${esc(cap)}</figcaption></figure>`
  }).join('')

  const logoUrl = `${location.origin}/logo-teg-transicao-branca.png`

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RDO ${esc(r.obra_nome)} — ${fmtD(r.data)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:13px;line-height:1.5}
  .page{max-width:820px;margin:0 auto;background:#fff}
  header{background:#0f172a;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  header img{height:34px}
  header .r{text-align:right}
  header h1{font-size:20px;font-weight:700;letter-spacing:.3px}
  header .sub{font-size:12px;opacity:.85;margin-top:2px}
  .status{display:inline-block;margin-top:8px;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;color:#fff}
  .body{padding:22px 28px}
  h2{font-size:13px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #0d9488;padding-bottom:5px;margin:22px 0 12px}
  h2:first-child{margin-top:0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
  .f label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .f div{font-size:13px;color:#1e293b;font-weight:600;margin-top:1px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:4px 0 6px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center}
  .kpi-v{font-size:22px;font-weight:800}
  .kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;margin-top:2px}
  .fr{margin:8px 0}
  .fr-top{display:flex;align-items:center;gap:6px;font-size:12px}
  .fr-meta{color:#64748b;font-weight:500;margin-left:auto;font-size:11px}
  .dot{width:9px;height:9px;border-radius:3px;display:inline-block}
  .bar{height:8px;background:#eef2f6;border-radius:6px;overflow:hidden;margin-top:3px}
  .bar-in{height:100%;border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  td{padding:5px 6px;vertical-align:top;border-bottom:1px solid #f1f5f9}
  .fr-head td{font-weight:800;font-size:12px;padding-top:10px;border:0}
  .atv{width:230px;color:#334155;font-weight:600}
  .torre{display:inline-block;background:#f1f5f9;border-radius:5px;padding:1px 6px;font-size:11px;margin:1px 2px 1px 0;color:#475569}
  .torre.t100{background:#059669;color:#fff}
  .torre.tmid{background:#fbbf24;color:#1e293b}
  .ev{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px}
  .ev-tag{color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .grp{border:1px solid #e2e8f0;border-radius:10px;margin:6px 0;overflow:hidden;background:#fff}
  .grp>summary{cursor:default;list-style:none;padding:7px 12px;background:#f8fafc;font-size:12px;font-weight:700;color:#334155;border-bottom:1px solid #eef2f6}
  .grp>summary::-webkit-details-marker{display:none}
  .grp ul{margin:0;padding:6px 12px 8px 26px;columns:2;column-gap:20px}
  .grp li{font-size:12px;color:#475569;margin:1px 0;break-inside:avoid}
  .txt{white-space:pre-wrap;color:#1e293b}
  .empty{color:#94a3b8;font-style:italic}
  .fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .foto{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background:#f8fafc}
  .foto img{width:100%;height:130px;object-fit:cover;display:block}
  .foto figcaption{font-size:10px;color:#64748b;padding:5px 7px}
  footer{padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{
    body{background:#fff}
    @page{size:A4;margin:8mm 0 10mm}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .foto{break-inside:avoid}
    h2{break-after:avoid}
  }
</style></head>
<body>
<div class="page">
  <header>
    <div><img src="${logoUrl}" onerror="this.style.display='none'"/>
      <div class="sub" style="margin-top:8px">${esc(empresa.razao)} · CNPJ ${esc(empresa.cnpj)}</div></div>
    <div class="r"><h1>Relatório Diário de Obra</h1>
      <div class="sub">${esc(r.obra_nome)} · ${fmtD(r.data)}</div>
      <span class="status" style="background:${statusCor}">${esc(statusLabel)}</span></div>
  </header>
  <div class="body">
    <h2>Dados do dia</h2>
    <div class="grid">
      <div class="f"><label>Obra</label><div>${esc(r.obra_nome)}</div></div>
      <div class="f"><label>Data</label><div>${fmtD(r.data)}</div></div>
      <div class="f"><label>Clima</label><div>${esc(WEATHER[cab.condicao_climatica as string] ?? cab.condicao_climatica ?? '—')}</div></div>
      <div class="f"><label>Horas improdutivas</label><div>${(cab.horas_improdutivas as number ?? 0) > 0 ? `${cab.horas_improdutivas}h${cab.motivo_improdutividade ? ` — ${esc(cab.motivo_improdutividade)}` : ''}` : '—'}</div></div>
      <div class="f"><label>Fiscal(is) CEMIG</label><div>${esc(fiscais || '—')}</div></div>
      <div class="f"><label>TST alocado(s)</label><div>${esc(tsts || '—')}</div></div>
      <div class="f"><label>Preenchido por</label><div>${esc(cab.preenchido_por_nome ?? '—')}</div></div>
      ${cab.aprovado_por_nome ? `<div class="f"><label>Aprovado por</label><div>${esc(cab.aprovado_por_nome)} · ${fmtD(cab.aprovado_em as string)}</div></div>` : ''}
    </div>

    <h2>Avanço do dia</h2>
    <div class="kpis">
      ${kpi('Avanço físico do dia', `${pctFisicoDia.toFixed(2)}%`, '#059669')}
      ${kpi('Estruturas-equiv.', totalDia.toFixed(1))}
      ${kpi('Lançamentos', String(avancos.length), '#6366f1')}
      ${kpi('Frentes ativas', String(frentesOrd.length), '#0ea5e9')}
    </div>
    <p style="font-size:10.5px;color:#94a3b8;margin:-2px 0 8px">Avanço físico do dia = estruturas-equivalentes concluídas hoje ÷ (${nEstruturas} torres × ${nAtividades} atividades).</p>
    ${frenteBars || '<p class="empty">Nenhum avanço lançado neste RDO.</p>'}
    ${avancoDetalhe ? `<table style="margin-top:10px">${avancoDetalhe}</table>` : ''}

    <h2>Ocorrências e impeditivos</h2>
    ${eventosHtml}

    ${cab.resumo_atividades ? `<h2>Resumo das atividades</h2><p class="txt">${esc(cab.resumo_atividades)}</p>` : ''}
    ${cab.notas ? `<h2>Notas</h2><p class="txt">${esc(cab.notas)}</p>` : ''}

    <h2>Equipe presente (${equipePres.length})</h2>
    ${equipeHtml}
    <h2>Recursos operando (${recOper.length})</h2>
    ${recHtml}

    ${fotosHtml ? `<h2>Registro fotográfico</h2><div class="fotos">${fotosHtml}</div>` : ''}
  </div>
  <footer><span>${esc(empresa.razao)} — RDO</span><span>Gerado pelo TEG+ · ${fmtD(r.data)}</span></footer>
</div>
</body></html>`
}

export function nomeArquivoRdoReport(r: RdoReportRow) {
  return `RDO_${r.obra_nome.split(/[\s-]/)[0]}_${(r.data ?? '').replace(/-/g, '')}`
}
