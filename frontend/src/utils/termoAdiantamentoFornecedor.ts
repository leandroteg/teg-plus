// ─────────────────────────────────────────────────────────────────────────────
// utils/termoAdiantamentoFornecedor.ts — Termo de Adiantamento a Fornecedor
//
// Documento impresso para colher a assinatura do fornecedor que recebe
// pagamento ANTES da entrega/nota (Pedido Extraordinário tipo
// adiantamento_fornecedor). Registra o compromisso: emitir a NF e entregar,
// com o valor adiantado abatido do documento fiscal (mig 218).
//
// Mesma moldura do Termo de Adiantamento de Viagem (termoAdiantamento.ts):
// monta HTML e manda imprimir numa aba. Difere no favorecido (cadastro do
// fornecedor, não RH), nos itens (itens_direto do pedido) e no texto jurídico —
// aqui não há desconto em folha; há obrigação de faturar.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { getEmpresa, EMPRESA_FALLBACK, type EmpresaData } from '../services/empresa'

export interface TermoAdiantamentoFornecedorDados {
  numero_pedido: string
  fornecedor_nome: string
  fornecedor_id?: string | null
  valor_total: number
  itens?: Array<{ descricao: string; quantidade: number; unidade?: string; valor_unitario: number }> | null
  justificativa?: string | null
  observacoes?: string | null
  centro_custo?: string | null
  data_pedido?: string | null
  data_prevista_entrega?: string | null
  data_vencimento?: string | null
  comprador_nome?: string | null
}

type FornecedorCadastro = {
  razao_social?: string | null
  cnpj?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  telefone?: string | null
  email?: string | null
  contato_nome?: string | null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d?: string | null) => {
  if (!d) return '—'
  const iso = d.length > 10 ? d : `${d}T00:00:00`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const fmtDoc = (v?: string | null) => {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return v ?? ''
}

async function buscarFornecedor(id?: string | null, nome?: string): Promise<FornecedorCadastro | null> {
  const cols = 'razao_social, cnpj, endereco, cidade, uf, telefone, email, contato_nome'
  if (id) {
    const { data } = await supabase.from('cmp_fornecedores').select(cols).eq('id', id).maybeSingle()
    if (data) return data as FornecedorCadastro
  }
  if (nome) {
    const { data } = await supabase.from('cmp_fornecedores').select(cols)
      .or(`razao_social.ilike.${nome},nome_fantasia.ilike.${nome}`)
      .limit(1).maybeSingle()
    if (data) return data as FornecedorCadastro
  }
  return null
}

export function buildTermoAdiantamentoFornecedorHtml(
  p: TermoAdiantamentoFornecedorDados,
  empresa: EmpresaData,
  forn: FornecedorCadastro | null,
  emitidoPor?: string | null,
): string {
  const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  const documento = fmtDoc(forn?.cnpj)
  const cidadeLinha = [forn?.cidade, forn?.uf].filter(Boolean).join(' - ')

  const itens = (p.itens ?? []).filter(i => (i.descricao ?? '').trim())
  const linhas = itens.length > 0
    ? itens.map((i, idx) => `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${esc(i.descricao)}</td>
        <td style="text-align:center">${esc(i.quantidade)} ${esc(i.unidade ?? '')}</td>
        <td style="text-align:right">${esc(fmtBRL(i.valor_unitario))}</td>
        <td style="text-align:right"><b>${esc(fmtBRL(Math.round(i.quantidade * i.valor_unitario * 100) / 100))}</b></td>
      </tr>`).join('')
    : `<tr>
        <td style="text-align:center">1</td>
        <td><b>ADIANTAMENTO A FORNECEDOR — PEDIDO ${esc(p.numero_pedido)}</b></td>
        <td style="text-align:center">1</td>
        <td style="text-align:right">${esc(fmtBRL(p.valor_total))}</td>
        <td style="text-align:right"><b>${esc(fmtBRL(p.valor_total))}</b></td>
      </tr>`

  const detalhes = [p.justificativa, p.observacoes]
    .filter(t => (t ?? '').toString().trim())
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Termo de Adiantamento a Fornecedor - ${esc(p.numero_pedido)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; color:#111827; font-size:12px; background:#fff; }
  .page { max-width:820px; margin:0 auto; padding:28px 34px; }
  .header { display:flex; align-items:center; gap:18px; border-bottom:2px solid #0f766e; padding-bottom:14px; margin-bottom:6px; }
  .header img { height:56px; object-fit:contain; }
  .header .titulo { flex:1; text-align:center; }
  .header .titulo h1 { font-size:19px; font-weight:800; letter-spacing:-0.2px; }
  .header .titulo .empresa { font-size:10px; color:#6b7280; margin-top:3px; }
  .header .meta { text-align:right; font-size:10px; color:#6b7280; min-width:130px; }
  .header .meta .numero { font-size:17px; font-weight:800; color:#111827; letter-spacing:1px; }
  .dados { margin:16px 0 14px; font-size:11.5px; line-height:1.6; }
  .dados .linha { display:flex; gap:8px; }
  .dados .rot { font-weight:700; font-style:italic; min-width:92px; }
  .dados .dir { margin-left:auto; text-align:right; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-top:6px; }
  thead th { border:1px solid #111827; padding:5px 6px; font-size:10px; font-weight:800; font-style:italic; text-align:center; background:#f3f4f6; }
  tbody td { border:1px solid #111827; padding:6px; }
  tfoot td { border:1px solid #111827; padding:6px; font-weight:800; }
  .obs { white-space:pre-wrap; font-size:11.5px; line-height:1.55; margin:14px 0 6px; }
  .termo { margin-top:22px; font-size:11px; line-height:1.65; text-align:justify; }
  .termo strong { font-weight:800; }
  .assinaturas { margin-top:54px; display:flex; gap:40px; justify-content:center; }
  .assinaturas .bloco { text-align:center; flex:1; max-width:320px; }
  .assinaturas .linha { border-top:1px solid #111827; margin:0 0 5px; }
  .assinaturas .nome { font-size:11.5px; font-weight:700; }
  .assinaturas .sub { font-size:9.5px; color:#6b7280; }
  .rodape { margin-top:26px; font-size:9px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding-top:8px; }
  @media print { .page { padding:14px 20px; } @page { margin:12mm; } }
</style></head><body>
<div class="page">
  <div class="header">
    <img src="${esc(empresa.logoUrl)}" alt="${esc(empresa.fantasia)}" onerror="this.style.display='none'">
    <div class="titulo">
      <h1>Termo de Adiantamento a Fornecedor</h1>
      <div class="empresa">${esc(empresa.razao)} — CNPJ ${esc(empresa.cnpj)}</div>
    </div>
    <div class="meta">
      <div class="numero">${esc(p.numero_pedido)}</div>
      <div>${esc(agora)}</div>
      ${emitidoPor ? `<div>${esc(emitidoPor)}</div>` : ''}
    </div>
  </div>

  <div class="dados">
    <div class="linha">
      <span class="rot">Fornecedor:</span>
      <span>${esc(forn?.razao_social || p.fornecedor_nome)}</span>
      <span class="dir"><b><i>CNPJ/CPF:</i></b> ${esc(documento || '—')}</span>
    </div>
    <div class="linha">
      <span class="rot">Endereço:</span>
      <span>${esc(forn?.endereco || '—')}</span>
      <span class="dir">${esc(cidadeLinha)}</span>
    </div>
    <div class="linha">
      <span class="rot">Contato:</span>
      <span>${esc([forn?.contato_nome, forn?.telefone, forn?.email].filter(Boolean).join('  •  ') || '—')}</span>
      <span class="dir">${p.centro_custo ? '<b>' + esc(p.centro_custo) + '</b>' : ''}</span>
    </div>
    <div class="linha">
      <span class="rot">Datas:</span>
      <span>Pedido ${esc(fmtData(p.data_pedido))}${p.data_prevista_entrega ? ` • Entrega prevista ${esc(fmtData(p.data_prevista_entrega))}` : ''}</span>
      <span class="dir">Comprador: ${esc(p.comprador_nome || '—')}</span>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:44px">ITEM</th>
      <th>DESCRIÇÃO</th>
      <th style="width:80px">QTD.</th>
      <th style="width:110px">PREÇO UNIT.</th>
      <th style="width:110px">TOTAL</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr>
      <td colspan="4" style="text-align:right">VALOR ADIANTADO</td>
      <td style="text-align:right">${esc(fmtBRL(p.valor_total))}</td>
    </tr></tfoot>
  </table>

  ${detalhes ? `<div class="obs">${esc(detalhes)}</div>` : ''}

  <div class="termo">
    Pelo presente instrumento, <strong>${esc(forn?.razao_social || p.fornecedor_nome)}</strong>,
    inscrito(a) sob o CNPJ/CPF nº <strong>${esc(documento || '____________________')}</strong>, declara ter recebido de
    <strong>${esc(empresa.razao)}</strong> a título de <strong>ADIANTAMENTO</strong> a quantia de
    <strong>${esc(fmtBRL(p.valor_total))}</strong>, referente ao pedido <strong>${esc(p.numero_pedido)}</strong>,
    e compromete-se a:
    <br>– entregar os produtos e/ou executar os serviços descritos acima${p.data_prevista_entrega ? ` até <strong>${esc(fmtData(p.data_prevista_entrega))}</strong>` : ''};
    <br>– emitir o documento fiscal correspondente (NF/NFS-e) em nome da contratante, no qual o valor ora adiantado será integralmente <strong>abatido</strong>;
    <br>– restituir integralmente o valor recebido, devidamente corrigido, caso a entrega ou a prestação do serviço não se concretize.
    <br><br>
    O presente termo não substitui o documento fiscal, que permanece obrigatório.
  </div>

  <div class="assinaturas">
    <div class="bloco">
      <div class="linha"></div>
      <div class="nome">${esc(forn?.razao_social || p.fornecedor_nome)}</div>
      <div class="sub">Fornecedor${forn?.contato_nome ? ' — ' + esc(forn.contato_nome) : ''}</div>
    </div>
    <div class="bloco">
      <div class="linha"></div>
      <div class="nome">${esc(empresa.fantasia)}</div>
      <div class="sub">${esc(p.comprador_nome || 'Comprador responsável')}</div>
    </div>
  </div>

  <div class="rodape">
    ${esc(p.numero_pedido)} • Emitido em ${esc(agora)} • TEG+ ${esc(empresa.fantasia)}
  </div>
</div>
<script>window.onload = function () { setTimeout(function () { window.print() }, 350) }</script>
</body></html>`
}

/** Monta o termo e abre numa aba para impressão/assinatura. */
export async function imprimirTermoAdiantamentoFornecedor(
  p: TermoAdiantamentoFornecedorDados,
  emitidoPor?: string | null,
) {
  const [empresa, forn] = await Promise.all([
    getEmpresa().catch(() => EMPRESA_FALLBACK),
    buscarFornecedor(p.fornecedor_id, p.fornecedor_nome).catch(() => null),
  ])
  const html = buildTermoAdiantamentoFornecedorHtml(p, empresa, forn, emitidoPor)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups neste site para abrir o termo de adiantamento.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
}
