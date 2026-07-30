// ─────────────────────────────────────────────────────────────────────────────
// ponto-report-html.ts — Espelho de ponto do colaborador no mês, em HTML
// (mesmo padrão estético do RDO / relatório QSMA). Abre no visualizador (iframe)
// e vira PDF pelo "Baixar" (print A4).
//
// Marca a ORIGEM de cada batida: relógio (REP), intervalo pré-assinalado e
// lançamento manual (retificação). Isso é o que dá valor de conferência ao
// espelho — sem isso, 12:00/13:00 parece batida e não é.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import { fmtHoras, fmtHora, intervalToMin, minToHoras, labelMes, proximoMes } from '../lib/ponto'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Origem da batida no Secullum (mesma tabela usada na aba Retificações)
const ORIGEM_REP = '16'      // relógio/REP — sempre com NSR
const ORIGEM_PRE = '3'       // intervalo pré-assinalado (vem do horário cadastrado)
const ORIGEM_MANUAL = '2'    // inclusão/edição manual = retificação

export interface PontoReportRow {
  colaborador_id: string
  colaborador_nome: string
  ano_mes: string            // 'YYYY-MM'
}

interface DiaRaw {
  data: string
  entrada1: string | null; saida1: string | null
  entrada2: string | null; saida2: string | null
  normais: string | null; faltas: string | null
  ex50: string | null; ex70: string | null; ex100: string | null
  hh_trabalhada: string | null; atrasos: string | null
  folga: boolean | null; compensado: boolean | null
  raw: Record<string, { Origem?: number | string } | null> | null
}

const origemDe = (raw: DiaRaw['raw'], slot: string): string => {
  const o = raw?.[`FonteDados${slot}`]?.Origem
  return o == null ? '' : String(o)
}

export async function buildPontoReportHtml(r: PontoReportRow): Promise<string> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const ini = `${r.ano_mes}-01`
  const fim = proximoMes(ini)

  const [resRes, diasRes] = await Promise.all([
    supabase.from('vw_rh_ponto_resumo_mes')
      .select('colaborador_nome, cargo, matricula, base_nome, cc_codigo, cc_nome, departamento, dias, dias_batidos, hh_trabalhada, normais, extras, faltas, atrasos, banco_saldo, dias_em_aberto')
      .eq('colaborador_id', r.colaborador_id).eq('ano_mes', ini),
    supabase.from('rh_ponto_dia')
      .select('data, entrada1, saida1, entrada2, saida2, normais, faltas, ex50, ex70, ex100, hh_trabalhada, atrasos, folga, compensado, raw')
      .eq('colaborador_id', r.colaborador_id).gte('data', ini).lt('data', fim).order('data'),
  ])

  const resumos = (resRes.data ?? []) as Record<string, unknown>[]
  const dias = (diasRes.data ?? []) as unknown as DiaRaw[]
  // o colaborador pode ter 2+ linhas no resumo (troca de base no mês) — soma
  const cab = resumos[0] ?? {}
  const somaInt = (k: string) => resumos.reduce((s, x) => s + intervalToMin(x[k] as string), 0)
  const somaNum = (k: string) => resumos.reduce((s, x) => s + Number(x[k] ?? 0), 0)

  const hhMin = somaInt('hh_trabalhada')
  const normMin = somaInt('normais')
  const faltaMin = somaInt('faltas')
  const atrasoMin = somaInt('atrasos')
  const exMin = somaInt('extras')
  const nDias = somaNum('dias')
  const nBatidos = somaNum('dias_batidos')
  const emAberto = somaNum('dias_em_aberto')

  // quantas batidas do mês vieram de cada origem — é o rodapé de conferência
  let nRep = 0, nPre = 0, nManual = 0, diasComManual = 0
  for (const d of dias) {
    let temManual = false
    for (const slot of ['Entrada1', 'Saida1', 'Entrada2', 'Saida2']) {
      const o = origemDe(d.raw, slot)
      if (o === ORIGEM_REP) nRep++
      else if (o === ORIGEM_PRE) nPre++
      else if (o === ORIGEM_MANUAL) { nManual++; temManual = true }
    }
    if (temManual) diasComManual++
  }

  const kpi = (label: string, valor: string, cor = '#0d9488') =>
    `<div class="kpi"><div class="kpi-v" style="color:${cor}">${valor}</div><div class="kpi-l">${esc(label)}</div></div>`

  // célula de batida com a marca da origem
  const cel = (h: string | null, o: string) => {
    if (!h) return '<td class="h">—</td>'
    const cls = o === ORIGEM_MANUAL ? 'h man' : o === ORIGEM_PRE ? 'h pre' : 'h'
    const tag = o === ORIGEM_MANUAL ? '<sup>M</sup>' : o === ORIGEM_PRE ? '<sup>P</sup>' : ''
    return `<td class="${cls}">${fmtHora(h)}${tag}</td>`
  }

  const linhas = dias.map(d => {
    const ex = intervalToMin(d.ex50) + intervalToMin(d.ex70) + intervalToMin(d.ex100)
    const falta = intervalToMin(d.faltas) > 0
    const dt = new Date(d.data + 'T12:00:00')
    const dow = dt.getDay()
    const fds = dow === 0 || dow === 6
    const marca = d.folga ? '<span class="tag folga">folga</span>'
      : d.compensado ? '<span class="tag comp">comp.</span>' : ''
    return `<tr class="${fds ? 'fds' : ''}">
      <td class="d">${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} <span class="dow">${DIAS[dow]}</span></td>
      ${cel(d.entrada1, origemDe(d.raw, 'Entrada1'))}
      ${cel(d.saida1, origemDe(d.raw, 'Saida1'))}
      ${cel(d.entrada2, origemDe(d.raw, 'Entrada2'))}
      ${cel(d.saida2, origemDe(d.raw, 'Saida2'))}
      <td class="n">${fmtHoras(d.normais)}</td>
      <td class="n ${ex > 0 ? 'ex' : ''}">${ex > 0 ? minToHoras(ex) : '—'}</td>
      <td class="n ${falta ? 'fal' : ''}">${fmtHoras(d.faltas)}</td>
      <td class="mk">${marca}</td>
    </tr>`
  }).join('')

  const totalRow = `<tr class="tot">
    <td>Total · ${nBatidos}/${nDias} dias</td>
    <td colspan="4"></td>
    <td>${normMin > 0 ? minToHoras(normMin) : '—'}</td>
    <td class="ex">${exMin > 0 ? minToHoras(exMin) : '—'}</td>
    <td class="fal">${faltaMin > 0 ? minToHoras(faltaMin) : '—'}</td>
    <td></td>
  </tr>`

  const logoUrl = `${location.origin}/logo-teg-transicao-branca.png`
  const hoje = new Date().toLocaleDateString('pt-BR')

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Espelho de ponto — ${esc(r.colaborador_nome)} — ${esc(labelMes(ini))}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:13px;line-height:1.5}
  .page{max-width:820px;margin:0 auto;background:#fff}
  header{background:linear-gradient(135deg,#1e293b,#0f766e);color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  header img{height:34px}
  header .r{text-align:right}
  header h1{font-size:20px;font-weight:700;letter-spacing:.3px}
  header .sub{font-size:12px;opacity:.85;margin-top:2px}
  .body{padding:22px 28px}
  h2{font-size:13px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #0d9488;padding-bottom:5px;margin:22px 0 12px}
  h2:first-child{margin-top:0}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 24px}
  .f label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .f div{font-size:13px;color:#1e293b;font-weight:600;margin-top:1px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:4px 0 6px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center}
  .kpi-v{font-size:22px;font-weight:800}
  .kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
  thead th{background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:800;padding:6px;text-align:center;border-bottom:1px solid #e2e8f0}
  thead th:first-child{text-align:left}
  td{padding:4px 6px;border-bottom:1px solid #f1f5f9;text-align:center}
  td.d{text-align:left;font-weight:600;color:#334155;white-space:nowrap}
  .dow{color:#94a3b8;font-weight:500;font-size:11px}
  td.h{font-variant-numeric:tabular-nums;color:#334155}
  td.h.man{color:#b45309;font-weight:700;background:#fffbeb}
  td.h.pre{color:#94a3b8}
  td.h sup{font-size:8px;margin-left:1px}
  td.n{font-variant-numeric:tabular-nums;color:#64748b}
  td.n.ex{color:#ea580c;font-weight:700}
  td.n.fal{color:#e11d48;font-weight:700}
  tr.fds td{background:#fafafa;color:#94a3b8}
  tr.fds td.d{color:#94a3b8}
  tr.tot td{background:#f1f5f9;font-weight:800;color:#1e293b;border-top:2px solid #cbd5e1;border-bottom:0}
  tr.tot td:first-child{text-align:left}
  .tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:999px}
  .tag.folga{background:#e0f2fe;color:#0369a1}
  .tag.comp{background:#f1f5f9;color:#64748b}
  .leg{margin-top:10px;font-size:10.5px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap}
  .leg b{color:#334155}
  .aviso{margin-top:8px;font-size:10.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 10px}
  .assin{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px}
  .assin div{border-top:1px solid #94a3b8;padding-top:5px;font-size:11px;color:#64748b;text-align:center}
  footer{padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{
    body{background:#fff}
    @page{size:A4;margin:8mm 0 10mm}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead{display:table-header-group}
    tr{break-inside:avoid}
    h2{break-after:avoid}
    .assin{break-inside:avoid}
  }
</style></head>
<body>
<div class="page">
  <header>
    <div><img src="${logoUrl}" onerror="this.style.display='none'"/>
      <div class="sub" style="margin-top:8px">${esc(empresa.razao)} · CNPJ ${esc(empresa.cnpj)}</div></div>
    <div class="r"><h1>Espelho de Ponto</h1>
      <div class="sub">${esc(r.colaborador_nome)} · ${esc(labelMes(ini))}</div></div>
  </header>
  <div class="body">
    <h2>Colaborador</h2>
    <div class="grid">
      <div class="f"><label>Nome</label><div>${esc(cab.colaborador_nome ?? r.colaborador_nome)}</div></div>
      <div class="f"><label>Matrícula</label><div>${esc(cab.matricula ?? '—')}</div></div>
      <div class="f"><label>Cargo</label><div>${esc(cab.cargo ?? '—')}</div></div>
      <div class="f"><label>Base</label><div>${esc(cab.base_nome ?? '—')}</div></div>
      <div class="f"><label>Centro de custo</label><div>${esc(cab.cc_codigo ?? cab.cc_nome ?? '—')}</div></div>
      <div class="f"><label>Competência</label><div>${esc(labelMes(ini))}</div></div>
    </div>

    <h2>Totais do mês</h2>
    <div class="kpis">
      ${kpi('HH trabalhada', hhMin > 0 ? minToHoras(hhMin) : '—', '#7c3aed')}
      ${kpi('Horas normais', normMin > 0 ? minToHoras(normMin) : '—')}
      ${kpi('Horas extras', exMin > 0 ? minToHoras(exMin) : '—', '#ea580c')}
      ${kpi('Faltas', faltaMin > 0 ? minToHoras(faltaMin) : '—', '#e11d48')}
    </div>
    <div class="leg">
      <span><b>Dias apurados:</b> ${nBatidos} de ${nDias}</span>
      <span><b>Atrasos:</b> ${atrasoMin > 0 ? minToHoras(atrasoMin) : '—'}</span>
      <span><b>Saldo banco:</b> ${fmtHoras(cab.banco_saldo as string)}</span>
      ${emAberto > 0 ? `<span style="color:#b45309"><b>Dias em aberto:</b> ${emAberto}</span>` : ''}
    </div>

    <h2>Marcações do mês</h2>
    <table>
      <thead><tr>
        <th>Dia</th><th>Entrada</th><th>Saída interv.</th><th>Volta interv.</th><th>Saída</th>
        <th>Normais</th><th>Extras</th><th>Faltas</th><th></th>
      </tr></thead>
      <tbody>${linhas || '<tr><td colspan="9" style="padding:18px;color:#94a3b8;font-style:italic">Sem marcações no período.</td></tr>'}${dias.length ? totalRow : ''}</tbody>
    </table>

    <div class="leg">
      <span><b>Origem das marcações:</b></span>
      <span><b style="color:#334155">${nRep}</b> no relógio</span>
      <span><b style="color:#94a3b8">${nPre}</b> pré-assinaladas <sup>P</sup></span>
      <span><b style="color:#b45309">${nManual}</b> lançadas à mão <sup>M</sup></span>
    </div>
    ${nManual > 0 ? `<div class="aviso"><b>${nManual} marcaç${nManual > 1 ? 'ões' : 'ão'} em ${diasComManual} dia${diasComManual > 1 ? 's' : ''} ${nManual > 1 ? 'foram lançadas' : 'foi lançada'} manualmente no sistema de ponto</b> (destacadas em âmbar com <sup>M</sup>) — não passaram pelo relógio e por isso não têm NSR. As marcadas com <sup>P</sup> são o intervalo pré-assinalado, gerado a partir do horário cadastrado.</div>` : ''}

    <div class="assin">
      <div>Assinatura do colaborador</div>
      <div>Assinatura do responsável</div>
    </div>
  </div>
  <footer><span>${esc(empresa.razao)} — Espelho de ponto</span><span>Gerado pelo TEG+ · ${hoje}</span></footer>
</div>
</body></html>`
}

export function nomeArquivoPontoReport(r: PontoReportRow) {
  const nome = r.colaborador_nome.trim().split(/\s+/).slice(0, 2).join('_')
  return `Ponto_${nome}_${r.ano_mes.replace('-', '')}`
}
