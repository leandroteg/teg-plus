// ─────────────────────────────────────────────────────────────────────────────
// os-report-html.ts — Relatórios da Ordem de Serviço em HTML (mesmo padrão
// estético do RDO/QSMA): abre no visualizador (iframe) e vira PDF pelo "Baixar"
// (print A4). Fotos entram embutidas via URL pública do bucket.
//
//   • Parecer Técnico  — sai na COTAÇÃO: o que será feito, fotos e histórico do
//     veículo. É a peça que Suprimentos lê para aprovar.
//   • Conclusão da OS  — sai na EXECUÇÃO/entrega: o que foi feito, itens, fotos
//     do serviço e o TERMO DE GARANTIA.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { EMPRESA_FALLBACK, getEmpresa } from '../services/empresa'
import { CATEGORIA_LABEL } from '../constants/categoriaVeiculo'

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmtD = (d?: string | null) => {
  if (!d) return '—'
  try { return new Date(String(d).includes('T') ? String(d) : String(d) + 'T12:00:00').toLocaleDateString('pt-BR') }
  catch { return String(d) }
}
const fmtDH = (d?: string | null) => {
  if (!d) return '—'
  try { return new Date(String(d)).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return String(d) }
}
const brl = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v?: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR'))

const TIPO_OS: Record<string, string> = {
  preventiva: 'Preventiva', corretiva: 'Corretiva', sinistro: 'Sinistro', revisao: 'Revisão',
}
const STATUS_OS: Record<string, string> = {
  pendente: 'Pendente', aberta: 'Aberta', em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Aguardando aprovação', aprovada: 'Aprovada', em_execucao: 'Em execução',
  aguardando: 'Aguardando', concluida: 'Concluída', rejeitada: 'Rejeitada', cancelada: 'Cancelada',
}

export type TipoRelatorioOS = 'parecer' | 'conclusao'

/** Busca tudo que os dois relatórios precisam. */
async function carregar(osId: string) {
  const [{ data: os }, { data: anexos }, { data: itens }, { data: cotacoes }] = await Promise.all([
    supabase.from('fro_ordens_servico')
      .select('*, veiculo:fro_veiculos(id, placa, marca, modelo, codigo_interno, categoria, hodometro_atual, base_id)')
      .eq('id', osId).single(),
    supabase.from('fro_os_anexos').select('*').eq('os_id', osId).order('created_at'),
    supabase.from('fro_itens_os').select('*').eq('os_id', osId).order('created_at'),
    supabase.from('fro_cotacoes_os').select('*').eq('os_id', osId).order('valor_total'),
  ])
  if (!os) throw new Error('OS não encontrada')

  const [{ data: historico }, { data: base }, { data: forn }] = await Promise.all([
    supabase.from('fro_ordens_servico')
      .select('id, numero_os, tipo, status, data_abertura, data_conclusao, descricao_problema, descricao_servico, valor_final, valor_aprovado, valor_orcado')
      .eq('veiculo_id', (os as any).veiculo_id).order('data_abertura', { ascending: false }).limit(15),
    (os as any).veiculo?.base_id
      ? supabase.from('est_bases').select('nome').eq('id', (os as any).veiculo.base_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    (os as any).fornecedor_id
      ? supabase.from('cmp_fornecedores').select('razao_social, nome_fantasia').eq('id', (os as any).fornecedor_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ])
  const fornecedorNome = (forn as any)?.nome_fantasia ?? (forn as any)?.razao_social ?? null
  return {
    os: os as any,
    anexos: (anexos ?? []) as any[],
    itens: (itens ?? []) as any[],
    cotacoes: (cotacoes ?? []) as any[],
    historico: ((historico ?? []) as any[]).filter(h => h.id !== osId),
    baseNome: (base as any)?.nome ?? null,
    fornecedorNome,
  }
}

function blocoFotos(titulo: string, fotos: { arquivo_url: string; arquivo_nome: string; rotulo?: string | null }[]) {
  if (!fotos.length) return ''
  return `<section><h2>${esc(titulo)}</h2><div class="fotos">${fotos.map(f => `
    <figure><img src="${esc(f.arquivo_url)}" onerror="this.parentElement.style.display='none'"/>
      <figcaption>${esc(f.rotulo || f.arquivo_nome)}</figcaption></figure>`).join('')}</div></section>`
}

function blocoDocs(anexos: any[]) {
  const docs = anexos.filter(a => !a.is_imagem)
  if (!docs.length) return ''
  return `<section><h2>Documentos anexados</h2><table>
    <thead><tr><th>Arquivo</th><th>Etapa</th><th>Tipo</th><th>Enviado por</th><th>Quando</th></tr></thead>
    <tbody>${docs.map(d => `<tr>
      <td><a href="${esc(d.arquivo_url)}">${esc(d.arquivo_nome)}</a></td>
      <td>${esc(d.etapa)}</td><td>${esc(d.rotulo ?? '—')}</td>
      <td>${esc(d.enviado_por_nome ?? '—')}</td><td>${fmtDH(d.created_at)}</td></tr>`).join('')}
    </tbody></table></section>`
}

export async function buildOSReportHtml(osId: string, tipo: TipoRelatorioOS): Promise<string> {
  const { os, anexos, itens, cotacoes, historico, baseNome, fornecedorNome } = await carregar(osId)
  const empresa = (await getEmpresa().catch(() => EMPRESA_FALLBACK)) ?? EMPRESA_FALLBACK
  const v = os.veiculo ?? {}
  const logoUrl = `${location.origin}/logo-teg-transicao-branca.png`
  const isParecer = tipo === 'parecer'
  const titulo = isParecer ? 'Parecer Técnico' : 'Conclusão de Ordem de Serviço'

  const fotosReq = anexos.filter(a => a.is_imagem && a.etapa === 'requisicao')
  const fotosCot = anexos.filter(a => a.is_imagem && a.etapa === 'cotacao')
  const fotosExe = anexos.filter(a => a.is_imagem && a.etapa === 'execucao')
  const fotoAbertura = os.foto_antes_url
    ? [{ arquivo_url: os.foto_antes_url, arquivo_nome: 'Foto do problema (abertura)', rotulo: 'Foto do problema' }]
    : []

  const total = itens.reduce((a, i) => a + Number(i.quantidade ?? 0) * Number(i.valor_unitario ?? 0), 0)
  const valorRef = os.valor_final ?? os.valor_aprovado ?? os.valor_orcado ?? (total || null)

  const linhasItens = itens.length
    ? `<section><h2>${isParecer ? 'Itens do orçamento' : 'Itens aplicados'}</h2><table>
        <thead><tr><th>Descrição</th><th>Tipo</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead>
        <tbody>${itens.map(i => `<tr>
          <td>${esc(i.descricao)}</td><td>${esc(i.tipo ?? '—')}</td>
          <td class="r">${num(i.quantidade)}</td><td class="r">${brl(i.valor_unitario)}</td>
          <td class="r">${brl(Number(i.quantidade ?? 0) * Number(i.valor_unitario ?? 0))}</td></tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" class="r"><b>Total</b></td><td class="r"><b>${brl(total)}</b></td></tr></tfoot>
       </table></section>`
    : ''

  const linhasCotacoes = isParecer && cotacoes.length
    ? `<section><h2>Cotações recebidas</h2><table>
        <thead><tr><th>Fornecedor</th><th class="r">Valor</th><th class="r">Prazo (dias)</th><th>Selecionada</th></tr></thead>
        <tbody>${cotacoes.map(c => `<tr>
          <td>${esc(c.observacoes ?? '—')}</td>
          <td class="r">${brl(c.valor_total)}</td>
          <td class="r">${num(c.prazo_execucao_dias)}</td>
          <td>${c.selecionado ? '✓' : ''}</td></tr>`).join('')}
        </tbody></table></section>`
    : ''

  const blocoHistorico = `<section><h2>Histórico do veículo</h2>${
    historico.length
      ? `<table><thead><tr><th>OS</th><th>Tipo</th><th>Abertura</th><th>Conclusão</th><th>Serviço</th><th class="r">Valor</th></tr></thead>
         <tbody>${historico.map(h => `<tr>
           <td>${esc(h.numero_os ?? '—')}</td><td>${esc(TIPO_OS[h.tipo] ?? h.tipo ?? '—')}</td>
           <td>${fmtD(h.data_abertura)}</td><td>${fmtD(h.data_conclusao)}</td>
           <td>${esc(h.descricao_servico ?? h.descricao_problema ?? '—')}</td>
           <td class="r">${brl(h.valor_final ?? h.valor_aprovado ?? h.valor_orcado)}</td></tr>`).join('')}
         </tbody></table>`
      : '<p class="vazio">Sem outras ordens de serviço registradas para este ativo.</p>'
  }</section>`

  const blocoGarantia = !isParecer
    ? `<section class="garantia"><h2>Termo de Garantia</h2>
        <p>O serviço descrito nesta ordem de serviço é garantido pelo prazo de
        <b>${os.garantia_meses ? `${os.garantia_meses} ${os.garantia_meses === 1 ? 'mês' : 'meses'}` : '—'}</b>${
          os.garantia_km ? ` ou <b>${num(os.garantia_km)} km</b>, o que ocorrer primeiro` : ''
        }, contados a partir de <b>${fmtD(os.data_conclusao ?? os.data_previsao)}</b>.</p>
        <p class="mini">A garantia cobre os itens aplicados e a mão de obra executada, descritos neste relatório.
        Não cobre desgaste natural, mau uso, acidentes ou intervenções de terceiros no mesmo sistema.</p>
        <div class="assinaturas">
          <div><span></span><p>Executante / Oficina<br>${esc(fornecedorNome ?? '')}</p></div>
          <div><span></span><p>Responsável pelo recebimento<br>${esc(empresa.razao ?? 'TEG União')}</p></div>
        </div>
       </section>`
    : ''

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(titulo)} — ${esc(os.numero_os ?? '')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;background:#f1f5f9;font-size:13px;line-height:1.5}
.wrap{max-width:820px;margin:0 auto;background:#fff}
header{background:${isParecer ? '#0f172a' : '#065f46'};color:#fff;padding:18px 24px;display:flex;align-items:center;gap:16px}
header img{height:34px}
header .t{flex:1}
header h1{font-size:19px;font-weight:700;letter-spacing:.3px}
header p{font-size:11px;opacity:.85}
header .os{text-align:right;font-size:11px;opacity:.9}
header .os b{display:block;font-size:16px}
section{padding:16px 24px;border-bottom:1px solid #e2e8f0}
h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:10px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.campo{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}
.campo span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;font-weight:700}
.campo b{font-size:13px;font-weight:600}
.texto{background:#f8fafc;border-left:3px solid ${isParecer ? '#0f172a' : '#059669'};border-radius:0 8px 8px 0;padding:10px 12px;white-space:pre-wrap}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;color:#475569;font-size:9px;text-transform:uppercase;letter-spacing:.6px;text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.r{text-align:right}
tfoot td{background:#f8fafc;font-size:13px}
.fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
figure{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#f8fafc}
figure img{width:100%;height:150px;object-fit:cover;display:block}
figcaption{font-size:10px;color:#64748b;padding:5px 7px}
.vazio{color:#94a3b8;font-style:italic}
.garantia{background:#ecfdf5}
.garantia p{margin-bottom:8px}
.mini{font-size:11px;color:#475569}
.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:26px}
.assinaturas span{display:block;border-top:1px solid #94a3b8;margin-bottom:5px}
.assinaturas p{font-size:10px;color:#475569;text-align:center}
footer{padding:10px 24px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
@media print{body{background:#fff}.wrap{max-width:none}@page{size:A4;margin:8mm 0 10mm}
  section{break-inside:avoid}figure{break-inside:avoid}}
</style></head><body><div class="wrap">
<header>
  <img src="${logoUrl}" onerror="this.style.display='none'"/>
  <div class="t"><h1>${esc(titulo)}</h1>
    <p>${esc(empresa.razao ?? 'TEG União')} · Gestão de Frotas</p></div>
  <div class="os">Ordem de Serviço<b>${esc(os.numero_os ?? '—')}</b>${esc(STATUS_OS[os.status] ?? os.status ?? '')}</div>
</header>

<section><h2>Ativo</h2><div class="grid">
  <div class="campo"><span>Código</span><b>${esc(v.codigo_interno ?? '—')}</b></div>
  <div class="campo"><span>Placa</span><b>${esc(v.placa ?? '—')}</b></div>
  <div class="campo"><span>Veículo</span><b>${esc(`${v.marca ?? ''} ${v.modelo ?? ''}`.trim() || '—')}</b></div>
  <div class="campo"><span>Base</span><b>${esc(baseNome ?? '—')}</b></div>
  <div class="campo"><span>Categoria</span><b>${esc((CATEGORIA_LABEL as Record<string, string>)[v.categoria] ?? v.categoria ?? '—')}</b></div>
  <div class="campo"><span>Hodômetro</span><b>${num(os.hodometro_entrada ?? v.hodometro_atual)}</b></div>
  <div class="campo"><span>Tipo de OS</span><b>${esc(TIPO_OS[os.tipo] ?? os.tipo ?? '—')}</b></div>
  <div class="campo"><span>Abertura</span><b>${fmtD(os.data_abertura)}</b></div>
  <div class="campo"><span>Previsão de término</span><b>${fmtD(os.data_previsao)}</b></div>
  <div class="campo"><span>Prioridade</span><b>${esc(os.prioridade ?? '—')}</b></div>
</div></section>

<section><h2>${isParecer ? 'Problema relatado' : 'Problema que originou a OS'}</h2>
  <div class="texto">${esc(os.descricao_problema ?? '—')}</div></section>

${isParecer ? `
<section><h2>Serviço a ser executado</h2>
  <div class="texto">${esc(os.tipo_servico || os.parecer_tecnico || 'A definir na cotação.')}</div>
  ${valorRef != null ? `<p style="margin-top:10px"><b>Valor estimado:</b> ${brl(valorRef)}</p>` : ''}
</section>` : `
<section><h2>Serviço executado</h2>
  <div class="texto">${esc(os.descricao_servico || os.parecer_tecnico || '—')}</div>
  <div class="grid" style="margin-top:10px">
    <div class="campo"><span>Entrada</span><b>${fmtD(os.data_entrada_oficina)}</b></div>
    <div class="campo"><span>Conclusão</span><b>${fmtD(os.data_conclusao)}</b></div>
    <div class="campo"><span>Fornecedor</span><b>${esc(fornecedorNome ?? '—')}</b></div>
    <div class="campo"><span>Valor final</span><b>${brl(valorRef)}</b></div>
  </div>
</section>`}

${linhasItens}
${linhasCotacoes}
${blocoFotos(isParecer ? 'Fotos do problema' : 'Fotos do problema (antes)', [...fotoAbertura, ...fotosReq])}
${isParecer ? blocoFotos('Fotos da avaliação técnica', fotosCot) : blocoFotos('Fotos do serviço executado', fotosExe)}
${blocoDocs(anexos)}
${isParecer ? blocoHistorico : ''}
${blocoGarantia}

<footer><span>${esc(empresa.razao ?? 'TEG União')} — ${esc(titulo)}</span>
<span>Gerado pelo TEG+ · ${fmtDH(new Date().toISOString())}</span></footer>
</div></body></html>`
}

export function nomeArquivoOSReport(numeroOS: string | null | undefined, tipo: TipoRelatorioOS) {
  const base = (numeroOS ?? 'OS').replace(/[^\w-]/g, '')
  return `${tipo === 'parecer' ? 'Parecer' : 'Conclusao'}-${base}.pdf`
}
