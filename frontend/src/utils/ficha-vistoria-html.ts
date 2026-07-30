// ─────────────────────────────────────────────────────────────────────────────
// ficha-vistoria-html.ts — Ficha de campo da vistoria, em HTML.
//
// Substitui o ficha-vistoria-pdf.ts (jsPDF). Motivo: numa folha que é
// PREENCHIDA À MÃO tudo é alinhamento — pauta no pé da célula, altura para a
// caneta, rótulo que não pode ser cortado pela linha de cima. Fazer isso somando
// milímetros no jsPDF rendeu uma sequência de defeitos (linha no meio da célula,
// depois linha cortando o rótulo seguinte, emoji quebrando o espaçamento, logo
// deformada). Em HTML o navegador resolve baseline, quebra e página sozinho.
//
// Mesmo desenho do Espelho de Ponto: monta o HTML, mostra num <iframe srcDoc> e
// o "Baixar PDF" chama print() — o navegador salva em PDF.
// ─────────────────────────────────────────────────────────────────────────────
import { EMPRESA_FALLBACK, getEmpresa, type EmpresaData } from '../services/empresa'
import { AMBIENTES_PADRAO, ITENS_POR_AMBIENTE } from '../components/locacao/VistoriaChecklist'
import type { LocEntrada, LocImovel } from '../types/locacao'

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ESTADOS = ['Ótimo', 'Bom', 'Regular', 'Ruim', 'N/A'] as const

const fmtDate = (d?: string | null) => {
  if (!d) return ''
  const dt = new Date(d.length <= 10 ? `${d}T12:00:00` : d)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

/** Prazo da vistoria = início previsto − 7 dias (mesma regra da tela). */
const limiteVistoria = (inicio?: string | null) => {
  if (!inicio) return ''
  const dt = new Date(new Date(`${inicio}T12:00:00`).getTime() - 7 * 86_400_000)
  return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

/** Campo: com valor vira texto; sem valor vira pauta para escrever. */
const campo = (rotulo: string, valor?: string | null) =>
  `<div class="f"><label>${esc(rotulo)}</label>${
    valor ? `<div class="v">${esc(valor)}</div>` : '<div class="pauta"></div>'
  }</div>`

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:13px;line-height:1.5}
  .page{max-width:820px;margin:0 auto;background:#fff}
  header{background:#0f172a;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  header img{height:34px}
  header .r{text-align:right}
  header h1{font-size:20px;font-weight:700;letter-spacing:.3px}
  header .sub{font-size:12px;opacity:.85;margin-top:2px}
  .body{padding:22px 28px}
  h2{font-size:13px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #0d9488;padding-bottom:5px;margin:18px 0 12px}
  h2:first-child{margin-top:0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}
  .f label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700}
  .f .v{font-size:13px;color:#1e293b;font-weight:600;margin-top:2px;min-height:22px;border-bottom:1px solid #f1f5f9}
  /* a pauta é a base da célula: a caneta escreve ACIMA dela */
  .f .pauta{margin-top:2px;height:22px;border-bottom:1.2px solid #64748b}
  .obs{white-space:pre-wrap;font-size:12px;color:#1e293b}
  .nota{font-size:11px;color:#64748b;font-style:italic;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  .amb{background:#1e293b;color:#fff;font-size:12px;font-weight:800;letter-spacing:.4px;padding:6px 10px;text-transform:uppercase}
  thead th{background:#f8fafc;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:800;padding:5px 4px;text-align:center;border-bottom:1px solid #e2e8f0}
  thead th:first-child{text-align:left;padding-left:10px}
  thead th:last-child{text-align:left}
  tbody td{padding:0;border-bottom:1px solid #f1f5f9}
  td.item{padding-left:10px;font-weight:600;color:#334155;width:150px;vertical-align:middle}
  td.bx{text-align:center;width:46px;vertical-align:middle}
  /* quadradinho forte: é onde a caneta bate */
  .box{display:inline-block;width:13px;height:13px;border:1.2px solid #475569;border-radius:2px}
  td.ob{padding:6px 10px 6px 8px}
  /* duas pautas por item — uma linha só não cabe caneta */
  .ob i{display:block;height:17px;border-bottom:1.2px solid #64748b}
  .ob i:first-child{margin-bottom:5px}
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
    table{break-inside:avoid}
    .assin{break-inside:avoid}
  }`

function bloco(ambiente: string) {
  const cabecalho = ESTADOS.map(e => `<th>${esc(e)}</th>`).join('')
  const linhas = ITENS_POR_AMBIENTE.map(item => `
      <tr>
        <td class="item">${esc(item)}</td>
        ${ESTADOS.map(() => '<td class="bx"><span class="box"></span></td>').join('')}
        <td class="ob"><i></i><i></i></td>
      </tr>`).join('')
  return `
  <table>
    <thead>
      <tr><th colspan="${ESTADOS.length + 2}" class="amb">${esc(ambiente)}</th></tr>
      <tr><th>Item</th>${cabecalho}<th>Observação</th></tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>`
}

export interface FichaVistoriaData {
  entrada: LocEntrada
  imovel?: LocImovel | null
  tipo?: 'entrada' | 'saida'
}

export async function buildFichaVistoriaHtml(data: FichaVistoriaData): Promise<string> {
  const empresa: EmpresaData = await getEmpresa().catch(() => EMPRESA_FALLBACK)
  const { entrada } = data
  const imv = data.imovel ?? entrada.imovel
  const tipo = data.tipo ?? 'entrada'

  const endereco = [
    [imv?.endereco || entrada.endereco, imv?.numero || entrada.numero].filter(Boolean).join(', '),
    imv?.complemento || entrada.complemento,
  ].filter(Boolean).join(' — ')
  const cidade = [
    imv?.bairro || entrada.bairro,
    [imv?.cidade || entrada.cidade, imv?.uf || entrada.uf].filter(Boolean).join('/'),
  ].filter(Boolean).join(' — ')

  const conta = (v?: number | null) => (v != null ? String(v) : '')
  const contagens = [imv?.qtd_banheiros, imv?.qtd_portas, imv?.qtd_janelas].some(v => v != null)
    ? `${conta(imv?.qtd_banheiros) || '__'} banheiro(s) · ${conta(imv?.qtd_portas) || '__'} porta(s) · ${conta(imv?.qtd_janelas) || '__'} janela(s)`
    : ''

  const iptu = imv?.iptu_numero
    ? `${imv.iptu_numero}${imv.iptu_quitado == null ? '' : imv.iptu_quitado ? ' (quitado)' : ' (em aberto)'}`
    : ''

  const renovacao = entrada.renovacao === 'sim' ? 'Sim'
    : entrada.renovacao === 'nao' ? 'Não' : ''

  const corpo = `
  <h2>Imóvel</h2>
  <div class="grid">
    ${campo('Endereço', endereco)}
    ${campo('Cidade / Bairro', cidade)}
    ${campo('Área total (m²)', imv?.area_m2 != null ? `${imv.area_m2} m²` : '')}
    ${campo('Área construída (m²)', imv?.area_construida_m2 != null ? `${imv.area_construida_m2} m²` : '')}
    ${campo('Matrícula do imóvel', imv?.matricula)}
    ${campo('Aluguel mensal', entrada.valor_aluguel != null
      ? entrada.valor_aluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')}
    ${campo('Banheiros / portas / janelas', contagens)}
    ${campo('IPTU (número e situação)', iptu)}
  </div>

  <h2>Acesso e prazo</h2>
  <div class="grid">
    ${campo('Locador', entrada.locador_nome || imv?.locador_nome)}
    ${campo('Telefone (WhatsApp)', imv?.locador_telefone || entrada.locador_contato || imv?.locador_contato)}
    ${campo('Início previsto', fmtDate(entrada.data_prevista_inicio))}
    ${campo('Vistoriar até', limiteVistoria(entrada.data_prevista_inicio))}
    ${campo('Locado até', fmtDate(entrada.prazo_fim))}
    ${campo('Pretende renovar', renovacao)}
  </div>

  ${entrada.observacoes ? `
  <h2>Observações</h2>
  <div class="obs">${esc(entrada.observacoes)}</div>` : ''}

  <h2>Avaliação por ambiente (${AMBIENTES_PADRAO.length * ITENS_POR_AMBIENTE.length} pontos)</h2>
  <p class="nota">Marque o estado de cada item e use as duas linhas para anotar o que encontrar.</p>
  ${AMBIENTES_PADRAO.map(bloco).join('')}

  <div class="assin">
    <div>Vistoriador — nome e assinatura</div>
    <div>Acompanhante no local</div>
  </div>`

  const logoUrl = `${location.origin}/logo-teg-transicao-branca.png`
  const hoje = new Date().toLocaleDateString('pt-BR')
  const titulo = 'Ficha de Vistoria'
  const sub = tipo === 'saida' ? 'Devolução de imóvel' : 'Entrada de imóvel'

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(titulo)} — ${esc(endereco || sub)}</title>
<style>${CSS}</style></head>
<body>
<div class="page">
  <header>
    <div><img src="${logoUrl}" onerror="this.style.display='none'"/>
      <div class="sub" style="margin-top:8px">${esc(empresa.razao)} · CNPJ ${esc(empresa.cnpj)}</div></div>
    <div class="r"><h1>${esc(titulo)}</h1><div class="sub">${esc(sub)}</div>
      <div class="sub">Documento de apoio em campo</div></div>
  </header>
  <div class="body">${corpo}</div>
  <footer><span>${esc(empresa.razao)} — ${esc(titulo)}</span><span>Gerado pelo TEG+ · ${hoje}</span></footer>
</div>
</body></html>`
}

export function nomeFichaVistoria(data: FichaVistoriaData) {
  const imv = data.imovel ?? data.entrada.imovel
  const base = (imv?.endereco || data.entrada.endereco || 'imovel')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  return `ficha-vistoria-${data.tipo ?? 'entrada'}-${base}`
}
