// ─────────────────────────────────────────────────────────────────────────────
// ponto-report-html.ts — Espelho de ponto em HTML (padrão estético do RDO/QSMA).
// Dois formatos, mesma seção de colaborador:
//   • buildPontoReportHtml       → 1 colaborador
//   • buildPontoConsolidadoHtml  → capa + N colaboradores, 1 por página
// Abre no visualizador (iframe) e vira PDF pelo "Baixar" (print A4).
//
// As batidas saem do rh_ponto_dia.raw, não das colunas tipadas, para o espelho
// mostrar EXATAMENTE o que está no Secullum: em dia abonado o Secullum põe a
// sigla da justificativa no campo da batida ("Atest", "INSS", "FaltDIA") e o
// rh_ponto_totime() do sync transforma isso em null.
//
// Marca também a ORIGEM de cada batida: relógio (REP), intervalo pré-assinalado
// e lançamento manual (retificação) — sem isso 12:00/13:00 parece batida e não é.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { EMPRESA_FALLBACK, getEmpresa, type EmpresaData } from '../services/empresa'
import { fmtHoras, intervalToMin, minToHoras, labelMes, proximoMes } from '../lib/ponto'

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// Origem da batida no Secullum (mesma tabela usada na aba Retificações)
const ORIGEM_REP = '16'      // relógio/REP — sempre com NSR
const ORIGEM_PRE = '3'       // intervalo pré-assinalado (vem do horário cadastrado)
const ORIGEM_MANUAL = '2'    // inclusão/edição manual = retificação

// O módulo Ponto trabalha com o mês já no 1º dia ('2026-07-01' — ver mesAtual()
// em lib/ponto), mas o painel do DP usa 'YYYY-MM'. Aceita os dois.
const normMes = (s: string) => (/^\d{4}-\d{2}$/.test(s) ? `${s}-01` : s)

export interface PontoReportRow {
  colaborador_id: string
  colaborador_nome: string
  ano_mes: string            // 'YYYY-MM' ou 'YYYY-MM-01'
}
export interface PontoConsolidadoSpec {
  ano_mes: string
  colaboradores: { id: string; nome: string }[]
  /** rótulo do recorte na capa (ex.: nome da base) */
  recorte?: string
}

interface DiaRow {
  colaborador_id: string | null
  data: string
  normais: string | null; faltas: string | null
  ex50: string | null; ex70: string | null; ex100: string | null
  hh_trabalhada: string | null; atrasos: string | null
  carga: string | null; dsr: string | null
  folga: boolean | null
  // as batidas vêm do raw, NÃO das colunas tipadas: quando o dia é abonado o
  // Secullum põe a sigla da justificativa no lugar da hora ("Atest", "INSS",
  // "FaltDIA"), e o rh_ponto_totime() do sync converte isso em null. Lendo o
  // raw o espelho mostra exatamente o que o Secullum mostra. O valor já vem
  // formatado ("06:48"), não precisa de fmtHora.
  b_e1: string | null; b_s1: string | null; b_e2: string | null; b_s2: string | null
  b_e3: string | null; b_s3: string | null
  // só a origem, não o raw inteiro — são ~10 mil linhas no consolidado
  o_e1: string | null; o_s1: string | null; o_e2: string | null; o_s2: string | null
  o_e3: string | null; o_s3: string | null
}
type ResumoRow = Record<string, unknown> & { colaborador_id: string | null }

const SEL_DIA = 'colaborador_id, data, normais, faltas, ex50, ex70, ex100, hh_trabalhada, atrasos, carga, dsr, folga,'
  + 'b_e1:raw->>Entrada1, b_s1:raw->>Saida1, b_e2:raw->>Entrada2, b_s2:raw->>Saida2, b_e3:raw->>Entrada3, b_s3:raw->>Saida3,'
  + 'o_e1:raw->FonteDadosEntrada1->>Origem, o_s1:raw->FonteDadosSaida1->>Origem,'
  + 'o_e2:raw->FonteDadosEntrada2->>Origem, o_s2:raw->FonteDadosSaida2->>Origem,'
  + 'o_e3:raw->FonteDadosEntrada3->>Origem, o_s3:raw->FonteDadosSaida3->>Origem'
const SEL_RESUMO = 'colaborador_id, colaborador_nome, cargo, matricula, base_nome, cc_codigo, cc_nome, departamento,'
  + 'dias, dias_batidos, hh_trabalhada, normais, extras, faltas, atrasos, banco_saldo, dias_em_aberto'

// o PostgREST capa em 1000 linhas por request mesmo com .limit() maior
const PAGE = 1000
async function paginar<T>(lote: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, max = 40_000): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await lote(from, from + PAGE - 1)
    if (error) throw error
    const pag = (data ?? []) as T[]
    all.push(...pag)
    if (pag.length < PAGE) break
  }
  return all
}

async function carregar(anoMes: string, ids?: string[]) {
  const ini = normMes(anoMes)
  const fim = proximoMes(ini)
  const umSo = ids?.length === 1 ? ids[0] : null
  const [resumo, dias] = await Promise.all([
    paginar<ResumoRow>((from, to) => {
      let q = supabase.from('vw_rh_ponto_resumo_mes').select(SEL_RESUMO).eq('ano_mes', ini)
      if (umSo) q = q.eq('colaborador_id', umSo)
      return q.order('colaborador_id').range(from, to)
    }),
    paginar<DiaRow>((from, to) => {
      let q = supabase.from('rh_ponto_dia').select(SEL_DIA).gte('data', ini).lt('data', fim)
      if (umSo) q = q.eq('colaborador_id', umSo)
      return q.order('colaborador_id').order('data').range(from, to)
    }),
  ])
  // com muitos colaboradores sai mais barato trazer o mês e filtrar aqui do que
  // montar um .in() com centenas de uuids na URL
  const set = ids && ids.length > 1 ? new Set(ids) : null
  return {
    ini,
    resumo: set ? resumo.filter(r => r.colaborador_id && set.has(r.colaborador_id)) : resumo,
    dias: set ? dias.filter(d => d.colaborador_id && set.has(d.colaborador_id)) : dias,
  }
}

const origens = (d: DiaRow) => [d.o_e1, d.o_s1, d.o_e2, d.o_s2, d.o_e3, d.o_s3]
/** "06:48" é batida; "Atest"/"INSS"/"FaltDIA" é sigla de justificativa */
const ehHora = (v: string | null) => !!v && /^\d{1,2}:\d{2}/.test(v)
// só liga as colunas do 3º par se houver HORA de verdade nelas: em dia abonado
// o Secullum repete a sigla da justificativa em todos os slots, inclusive no 3º
const temTerceira = (ds: DiaRow[]) => ds.some(d => ehHora(d.b_e3) || ehHora(d.b_s3))

// ── seção de UM colaborador (usada nos dois formatos) ────────────────────────
function secaoColaborador(nome: string, resumos: ResumoRow[], dias: DiaRow[], ini: string, comQuebra: boolean): string {
  const cab = resumos[0] ?? {}
  const somaInt = (k: string) => resumos.reduce((s, x) => s + intervalToMin(x[k] as string), 0)
  const somaNum = (k: string) => resumos.reduce((s, x) => s + Number(x[k] ?? 0), 0)
  const hhMin = somaInt('hh_trabalhada'), normMin = somaInt('normais')
  const faltaMin = somaInt('faltas'), atrasoMin = somaInt('atrasos'), exMin = somaInt('extras')
  const nDias = somaNum('dias'), nBatidos = somaNum('dias_batidos'), emAberto = somaNum('dias_em_aberto')

  let nRep = 0, nPre = 0, nManual = 0, diasComManual = 0, diasJustif = 0
  for (const d of dias) {
    let tem = false
    for (const o of origens(d)) {
      if (o === ORIGEM_REP) nRep++
      else if (o === ORIGEM_PRE) nPre++
      else if (o === ORIGEM_MANUAL) { nManual++; tem = true }
    }
    if (tem) diasComManual++
    if (d.b_e1 && !ehHora(d.b_e1)) diasJustif++
  }

  const kpi = (label: string, valor: string, cor = '#334155') =>
    `<div class="kpi"><div class="kpi-v" style="color:${cor}">${valor}</div><div class="kpi-l">${esc(label)}</div></div>`

  // 3º par de batidas só entra se alguém do recorte tiver — senão são 2 colunas
  // vazias em todo mundo (em julho: 2 dias no mês inteiro)
  const t3 = temTerceira(dias)
  const cel = (v: string | null, o: string | null) => {
    if (!v) return '<td class="h">—</td>'
    // sigla de justificativa ocupando o campo da batida, como no Secullum
    if (!ehHora(v)) return `<td class="h just">${esc(v)}</td>`
    const cls = o === ORIGEM_MANUAL ? 'h man' : o === ORIGEM_PRE ? 'h pre' : 'h'
    const tag = o === ORIGEM_MANUAL ? '<sup>M</sup>' : o === ORIGEM_PRE ? '<sup>P</sup>' : ''
    return `<td class="${cls}">${esc(v)}${tag}</td>`
  }

  let cargaMin = 0, dsrMin = 0
  const linhas = dias.map(d => {
    const ex = intervalToMin(d.ex50) + intervalToMin(d.ex70) + intervalToMin(d.ex100)
    const falta = intervalToMin(d.faltas) > 0
    cargaMin += intervalToMin(d.carga); dsrMin += intervalToMin(d.dsr)
    const dt = new Date(d.data + 'T12:00:00')
    const dow = dt.getDay()
    const fds = dow === 0 || dow === 6
    const marca = d.folga ? '<span class="tag folga">folga</span>' : ''
    return `<tr class="${fds ? 'fds' : ''}">
      <td class="d">${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} <span class="dow">${DIAS[dow]}</span></td>
      ${cel(d.b_e1, d.o_e1)}${cel(d.b_s1, d.o_s1)}${cel(d.b_e2, d.o_e2)}${cel(d.b_s2, d.o_s2)}
      ${t3 ? cel(d.b_e3, d.o_e3) + cel(d.b_s3, d.o_s3) : ''}
      <td class="n">${fmtHoras(d.carga)}</td>
      <td class="n">${fmtHoras(d.normais)}</td>
      <td class="n ${ex > 0 ? 'ex' : ''}">${ex > 0 ? minToHoras(ex) : '—'}</td>
      <td class="n ${falta ? 'fal' : ''}">${fmtHoras(d.faltas)}</td>
      <td class="n">${fmtHoras(d.dsr)}</td>
      <td class="mk">${marca}</td>
    </tr>`
  }).join('')

  const totalRow = `<tr class="tot">
    <td>Total · ${nBatidos}/${nDias} dias</td><td colspan="${t3 ? 6 : 4}"></td>
    <td>${cargaMin > 0 ? minToHoras(cargaMin) : '—'}</td>
    <td>${normMin > 0 ? minToHoras(normMin) : '—'}</td>
    <td class="ex">${exMin > 0 ? minToHoras(exMin) : '—'}</td>
    <td class="fal">${faltaMin > 0 ? minToHoras(faltaMin) : '—'}</td>
    <td>${dsrMin > 0 ? minToHoras(dsrMin) : '—'}</td><td></td>
  </tr>`

  return `<section class="colab${comQuebra ? ' quebra' : ''}">
    <h2>${esc(cab.colaborador_nome ?? nome)}</h2>
    <div class="grid">
      <div class="f"><label>Matrícula</label><div>${esc(cab.matricula ?? '—')}</div></div>
      <div class="f"><label>Cargo</label><div>${esc(cab.cargo ?? '—')}</div></div>
      <div class="f"><label>Base</label><div>${esc(cab.base_nome ?? '—')}</div></div>
      <div class="f"><label>Centro de custo</label><div>${esc(cab.cc_codigo ?? cab.cc_nome ?? '—')}</div></div>
      <div class="f"><label>Departamento</label><div>${esc(cab.departamento ?? '—')}</div></div>
      <div class="f"><label>Competência</label><div>${esc(labelMes(ini))}</div></div>
    </div>
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
    <table>
      <thead><tr>
        <th>Dia</th><th>Entrada</th><th>Saída interv.</th><th>Volta interv.</th><th>Saída</th>
        ${t3 ? '<th>3ª entrada</th><th>3ª saída</th>' : ''}
        <th>Carga</th><th>Normais</th><th>Extras</th><th>Faltas</th><th>DSR</th><th></th>
      </tr></thead>
      <tbody>${linhas || `<tr><td colspan="${t3 ? 13 : 11}" class="vazio">Sem marcações no período.</td></tr>`}${dias.length ? totalRow : ''}</tbody>
    </table>
    <div class="leg">
      <span><b>Origem:</b></span>
      <span><b style="color:#334155">${nRep}</b> no relógio</span>
      <span><b style="color:#94a3b8">${nPre}</b> pré-assinaladas <sup>P</sup></span>
      <span><b style="color:#b45309">${nManual}</b> lançadas à mão <sup>M</sup></span>
      ${diasJustif > 0 ? `<span><b style="color:#0369a1">${diasJustif}</b> dia${diasJustif > 1 ? 's' : ''} com justificativa no lugar da batida</span>` : ''}
    </div>
    ${nManual > 0 ? `<div class="aviso"><b>${nManual} marcaç${nManual > 1 ? 'ões' : 'ão'} em ${diasComManual} dia${diasComManual > 1 ? 's' : ''} ${nManual > 1 ? 'foram lançadas' : 'foi lançada'} manualmente no sistema de ponto</b> — destacadas em âmbar com <sup>M</sup>. Não passaram pelo relógio, por isso não têm NSR. As marcadas com <sup>P</sup> são o intervalo pré-assinalado, gerado a partir do horário cadastrado.</div>` : ''}
    <div class="assin"><div class="box"><b>${esc(cab.colaborador_nome ?? nome)}</b>Assinatura do colaborador</div></div>
  </section>`
}

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:13px;line-height:1.5}
  .page{max-width:820px;margin:0 auto;background:#fff}
  header{background:#0f172a;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  header img{height:34px}
  header .marca{font-size:19px;font-weight:800;letter-spacing:.6px;color:#fff}
  header .r{text-align:right}
  header h1{font-size:20px;font-weight:700;letter-spacing:.3px}
  header .sub{font-size:12px;opacity:.85;margin-top:2px}
  .body{padding:22px 28px}
  h2{font-size:13px;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #7c3aed;padding-bottom:5px;margin:0 0 12px}
  .colab{margin-bottom:26px}
  .colab.quebra{break-before:page;padding-top:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 24px}
  .f label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .f div{font-size:13px;color:#1e293b;font-weight:600;margin-top:1px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0 6px}
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
  td.h.just{color:#0369a1;font-weight:700;background:#f0f9ff;font-size:11px}
  td.h sup{font-size:8px;margin-left:1px}
  td.n{font-variant-numeric:tabular-nums;color:#64748b}
  td.n.ex{color:#ea580c;font-weight:700}
  td.n.fal{color:#e11d48;font-weight:700}
  td.vazio{padding:18px;color:#94a3b8;font-style:italic}
  tr.fds td{background:#fafafa;color:#94a3b8}
  tr.fds td.d{color:#94a3b8}
  tr.tot td{background:#f1f5f9;font-weight:800;color:#1e293b;border-top:2px solid #cbd5e1;border-bottom:0}
  tr.tot td:first-child{text-align:left}
  .tag{display:inline-block;font-size:9px;font-weight:700;padding:1px 6px;border-radius:999px}
  .tag.folga{background:#e0f2fe;color:#0369a1}
  .leg{margin-top:8px;font-size:10.5px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap}
  .leg b{color:#334155}
  .aviso{margin-top:8px;font-size:10.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 10px}
  .assin{display:flex;justify-content:flex-end;margin-top:34px}
  .assin .box{width:48%;border-top:1px solid #94a3b8;padding-top:5px;font-size:11px;color:#64748b;text-align:center}
  .assin .box b{display:block;font-size:11.5px;color:#334155;font-weight:700}
  .capa table{margin-top:10px}
  .capa td{text-align:left}
  .capa td.num{text-align:right;font-variant-numeric:tabular-nums}
  footer{padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{
    body{background:#fff}
    @page{size:A4;margin:8mm 0 10mm}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead{display:table-header-group}
    tr{break-inside:avoid}
    h2{break-after:avoid}
    .assin{break-inside:avoid}
  }`

// A logo vai EMBUTIDA (data URI), não como <img src="https://…/logo.png">.
// O relatório é renderizado dentro de um iframe srcDoc e depois impresso/convertido
// em PDF: nesses contextos o documento não tem a mesma origem da página, e um
// caminho absoluto pode simplesmente não ser buscado. Pior: o onerror antigo
// escondia a falha (display:none) — a logo sumia e ninguém sabia por quê.
// Falhando o fetch, entra o nome da empresa em texto; nunca um espaço em branco.
async function logoDataUri(): Promise<string | null> {
  try {
    const r = await fetch(`${location.origin}/logo-teg-transicao-branca.png`)
    if (!r.ok) return null
    const blob = await r.blob()
    return await new Promise<string | null>(resolve => {
      const fr = new FileReader()
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch { return null }
}

async function shell(empresa: EmpresaData, titulo: string, sub: string, corpo: string) {
  const logo = await logoDataUri()
  const hoje = new Date().toLocaleDateString('pt-BR')
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(titulo)} — ${esc(sub)}</title>
<style>${CSS}</style></head>
<body>
<div class="page">
  <header>
    <div>${logo
        ? `<img src="${logo}" alt="${esc(empresa.fantasia)}"/>`
        : `<div class="marca">${esc(empresa.fantasia)}</div>`}
      <div class="sub" style="margin-top:8px">${esc(empresa.razao)} · CNPJ ${esc(empresa.cnpj)}</div></div>
    <div class="r"><h1>${esc(titulo)}</h1><div class="sub">${esc(sub)}</div></div>
  </header>
  <div class="body">${corpo}</div>
  <footer><span>${esc(empresa.razao)} — ${esc(titulo)}</span><span>Gerado pelo TEG+ · ${hoje}</span></footer>
</div>
</body></html>`
}

// ── 1 colaborador ────────────────────────────────────────────────────────────
export async function buildPontoReportHtml(r: PontoReportRow): Promise<string> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const { ini, resumo, dias } = await carregar(r.ano_mes, [r.colaborador_id])
  const corpo = secaoColaborador(r.colaborador_nome, resumo, dias, ini, false)
  return await shell(empresa, 'Espelho de Ponto', `${r.colaborador_nome} · ${labelMes(ini)}`, corpo)
}

// ── consolidado: capa + 1 colaborador por página ─────────────────────────────
export async function buildPontoConsolidadoHtml(spec: PontoConsolidadoSpec): Promise<string> {
  const empresa = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const ids = spec.colaboradores.map(p => p.id)
  const { ini, resumo, dias } = await carregar(spec.ano_mes, ids)

  const resPorId = new Map<string, ResumoRow[]>()
  for (const r of resumo) { if (!r.colaborador_id) continue; const a = resPorId.get(r.colaborador_id) ?? []; a.push(r); resPorId.set(r.colaborador_id, a) }
  const diaPorId = new Map<string, DiaRow[]>()
  for (const d of dias) { if (!d.colaborador_id) continue; const a = diaPorId.get(d.colaborador_id) ?? []; a.push(d); diaPorId.set(d.colaborador_id, a) }

  // capa: totais do recorte + índice com o resumo de cada um
  let tHH = 0, tNorm = 0, tEx = 0, tFalta = 0, tManual = 0
  const linhasCapa = spec.colaboradores.map((p, i) => {
    const rs = resPorId.get(p.id) ?? []
    const ds = diaPorId.get(p.id) ?? []
    const hh = rs.reduce((s, x) => s + intervalToMin(x.hh_trabalhada as string), 0)
    const nm = rs.reduce((s, x) => s + intervalToMin(x.normais as string), 0)
    const ex = rs.reduce((s, x) => s + intervalToMin(x.extras as string), 0)
    const fa = rs.reduce((s, x) => s + intervalToMin(x.faltas as string), 0)
    const man = ds.reduce((s, d) => s + origens(d).filter(o => o === ORIGEM_MANUAL).length, 0)
    tHH += hh; tNorm += nm; tEx += ex; tFalta += fa; tManual += man
    return `<tr>
      <td style="color:#94a3b8;width:26px">${i + 1}</td>
      <td style="font-weight:600">${esc(p.nome)}</td>
      <td style="color:#64748b">${esc((rs[0]?.base_nome as string) ?? '—')}</td>
      <td class="num">${rs.reduce((s, x) => s + Number(x.dias_batidos ?? 0), 0)}</td>
      <td class="num">${hh > 0 ? minToHoras(hh) : '—'}</td>
      <td class="num" style="color:#ea580c;font-weight:600">${ex > 0 ? minToHoras(ex) : '—'}</td>
      <td class="num" style="color:#e11d48">${fa > 0 ? minToHoras(fa) : '—'}</td>
      <td class="num" style="color:#b45309">${man || '—'}</td>
    </tr>`
  }).join('')

  const kpi = (label: string, valor: string, cor = '#334155') =>
    `<div class="kpi"><div class="kpi-v" style="color:${cor}">${valor}</div><div class="kpi-l">${esc(label)}</div></div>`

  const capa = `<section class="capa">
    <h2>Consolidado ${esc(labelMes(ini))}${spec.recorte ? ` · ${esc(spec.recorte)}` : ''}</h2>
    <div class="kpis">
      ${kpi('Colaboradores', String(spec.colaboradores.length), '#7c3aed')}
      ${kpi('HH trabalhada', tHH > 0 ? minToHoras(tHH) : '—', '#7c3aed')}
      ${kpi('Horas extras', tEx > 0 ? minToHoras(tEx) : '—', '#ea580c')}
      ${kpi('Faltas', tFalta > 0 ? minToHoras(tFalta) : '—', '#e11d48')}
    </div>
    <div class="leg">
      <span><b>Horas normais:</b> ${tNorm > 0 ? minToHoras(tNorm) : '—'}</span>
      <span><b style="color:#b45309">${tManual}</b> marcações lançadas à mão no recorte</span>
    </div>
    <table>
      <thead><tr>
        <th style="text-align:left" colspan="2">Colaborador</th><th style="text-align:left">Base</th>
        <th>Dias</th><th>HH</th><th>Extras</th><th>Faltas</th><th>Manuais</th>
      </tr></thead>
      <tbody>${linhasCapa || '<tr><td colspan="8" class="vazio">Nenhum colaborador no recorte.</td></tr>'}</tbody>
    </table>
    <p style="margin-top:10px;font-size:10.5px;color:#94a3b8">Cada colaborador tem o espelho completo nas páginas seguintes, um por página.</p>
  </section>`

  const secoes = spec.colaboradores
    .map(p => secaoColaborador(p.nome, resPorId.get(p.id) ?? [], diaPorId.get(p.id) ?? [], ini, true))
    .join('')

  const sub = `${labelMes(ini)}${spec.recorte ? ` · ${spec.recorte}` : ''} · ${spec.colaboradores.length} colaborador${spec.colaboradores.length > 1 ? 'es' : ''}`
  return await shell(empresa, 'Espelho de Ponto — Consolidado', sub, capa + secoes)
}

export function nomeArquivoPontoReport(r: PontoReportRow) {
  const nome = r.colaborador_nome.trim().split(/\s+/).slice(0, 2).join('_')
  return `Ponto_${nome}_${normMes(r.ano_mes).slice(0, 7).replace('-', '')}`
}
