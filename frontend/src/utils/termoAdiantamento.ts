// ─────────────────────────────────────────────────────────────────────────────
// utils/termoAdiantamento.ts — Termo de Adiantamento de Viagem (Repasse)
//
// Substitui o documento que era emitido pelo Totvs RM: sai com o logo/dados da
// empresa do grupo, os dados do favorecido (CPF, endereço, telefone vindos do
// RH), o detalhamento da despesa e o texto de autorização de desconto que o
// colaborador assina.
//
// Mesmo padrão da Solicitação de Cotação: monta HTML e manda imprimir numa aba.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../services/supabase'
import { getEmpresa, EMPRESA_FALLBACK, type EmpresaData } from '../services/empresa'

export interface TermoAdiantamentoDados {
  numero: string
  favorecido_nome: string
  favorecido_email?: string | null
  valor_solicitado: number
  finalidade: string
  justificativa?: string | null
  observacoes?: string | null
  chave_pix?: string | null
  banco?: string | null
  centro_custo?: string | null
  data_solicitacao?: string | null
  data_pagamento?: string | null
  data_limite_prestacao?: string | null
  solicitante_nome?: string | null
}

type FavorecidoRH = {
  cpf?: string | null
  matricula?: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  tipo_contrato?: string | null
  cnpj_pj?: string | null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d?: string | null) => {
  if (!d) return '—'
  const iso = d.length > 10 ? d : `${d}T00:00:00`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const fmtCPF = (v?: string | null) => {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return v ?? ''
}

/** Busca os dados cadastrais do favorecido no RH (e-mail > nome). */
async function buscarFavorecidoRH(nome: string, email?: string | null): Promise<FavorecidoRH | null> {
  const COLS = 'cpf, matricula, endereco, numero, bairro, cidade, uf, cep, telefone, tipo_contrato, cnpj_pj'
  try {
    if (email?.trim()) {
      const { data } = await supabase.from('rh_colaboradores').select(COLS)
        .ilike('email', email.trim()).limit(1).maybeSingle()
      if (data) return data as FavorecidoRH
    }
    const { data } = await supabase.from('rh_colaboradores').select(COLS)
      .ilike('nome', nome.trim()).limit(1).maybeSingle()
    return (data as FavorecidoRH | null) ?? null
  } catch {
    return null
  }
}

export function buildTermoAdiantamentoHtml(
  ad: TermoAdiantamentoDados,
  empresa: EmpresaData,
  rh: FavorecidoRH | null,
  emitidoPor?: string | null,
): string {
  const enderecoLinha = [
    [rh?.endereco, rh?.numero].filter(Boolean).join(', '),
    rh?.bairro,
  ].filter(Boolean).join(' — ')
  const cidadeLinha = [rh?.cidade, rh?.uf].filter(Boolean).join(' - ')
  const documento = fmtCPF(rh?.cpf || rh?.cnpj_pj)
  const ehPJ = (rh?.tipo_contrato || '').toUpperCase() === 'PJ'
  const agora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const detalhes = [ad.finalidade, ad.justificativa, ad.observacoes]
    .filter(t => (t ?? '').toString().trim())
    .join('\n')

  const pagamentoLinha = [
    ad.banco ? `Banco: ${ad.banco}` : null,
    ad.chave_pix ? `Chave PIX: ${ad.chave_pix}` : null,
  ].filter(Boolean).join('  •  ')

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Adiantamento de Viagem (Repasse) - ${esc(ad.numero)}</title>
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
  .obs { white-space:pre-wrap; font-size:11.5px; line-height:1.55; margin:14px 0 6px; }
  .pgto { font-size:11.5px; font-weight:700; margin:10px 0 4px; }
  .termo { margin-top:22px; font-size:11px; line-height:1.65; text-align:justify; }
  .termo strong { font-weight:800; }
  .assinatura { margin-top:54px; text-align:center; }
  .assinatura .linha { border-top:1px solid #111827; width:340px; margin:0 auto 5px; }
  .assinatura .nome { font-size:11.5px; font-weight:700; }
  .rodape { margin-top:26px; font-size:9px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; padding-top:8px; }
  @media print { .page { padding:14px 20px; } @page { margin:12mm; } }
</style></head><body>
<div class="page">
  <div class="header">
    <img src="${esc(empresa.logoUrl)}" alt="${esc(empresa.fantasia)}" onerror="this.style.display='none'">
    <div class="titulo">
      <h1>Adiantamento de Viagem (Repasse)</h1>
      <div class="empresa">${esc(empresa.razao)} — CNPJ ${esc(empresa.cnpj)}</div>
    </div>
    <div class="meta">
      <div class="numero">${esc(ad.numero)}</div>
      <div>${esc(agora)}</div>
      ${emitidoPor ? `<div>${esc(emitidoPor)}</div>` : ''}
    </div>
  </div>

  <div class="dados">
    <div class="linha">
      <span class="rot">Favorecido:</span>
      <span>${rh?.matricula ? esc(rh.matricula) + ' — ' : ''}${esc(ad.favorecido_nome)}</span>
      <span class="dir"><b><i>CPF/CNPJ:</i></b> ${esc(documento || '—')}</span>
    </div>
    <div class="linha">
      <span class="rot">Endereço:</span>
      <span>${esc(enderecoLinha || '—')}</span>
      <span class="dir">${esc(cidadeLinha)}</span>
    </div>
    <div class="linha">
      <span class="rot">Telefone:</span>
      <span>${esc(rh?.telefone || '—')}</span>
      <span class="dir">${ad.centro_custo ? '<b>' + esc(ad.centro_custo) + '</b>' : ''}</span>
    </div>
    <div class="linha">
      <span class="rot">Cond. Pagto:</span>
      <span>À VISTA</span>
      <span class="dir">Solicitado por: ${esc(ad.solicitante_nome || '—')}</span>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:52px">ITEM</th>
      <th>DESCRIÇÃO</th>
      <th style="width:56px">QTD.</th>
      <th style="width:120px">PREÇO UNITÁRIO</th>
      <th style="width:120px">TOTAL</th>
    </tr></thead>
    <tbody><tr>
      <td style="text-align:center">1</td>
      <td><b>ADIANTAMENTO DE VIAGEM</b></td>
      <td style="text-align:center">1</td>
      <td style="text-align:right">${esc(fmtBRL(ad.valor_solicitado))}</td>
      <td style="text-align:right"><b>${esc(fmtBRL(ad.valor_solicitado))}</b></td>
    </tr></tbody>
  </table>

  ${detalhes ? `<div class="obs">${esc(detalhes)}</div>` : ''}
  ${pagamentoLinha ? `<div class="pgto">${esc(pagamentoLinha)}</div>` : ''}
  ${ad.data_pagamento ? `<div class="pgto">Previsão de pagamento: ${esc(fmtData(ad.data_pagamento))}</div>` : ''}

  <div class="termo">
    Pelo presente instrumento, eu <strong>${esc(ad.favorecido_nome)}</strong>, portador(a) do CPF nº
    <strong>${esc(documento || '____________________')}</strong>, ciente de minha responsabilidade quanto à
    <strong>POLÍTICA DE REPASSE DE VIAGENS</strong>, autorizo o desconto em minha folha de pagamento/nota fiscal,
    correspondente ao adiantamento de viagem que por ventura eu deixar de prestar contas dentro do prazo de
    <strong>5 (cinco) dias úteis</strong>${ad.data_limite_prestacao ? ` — até <strong>${esc(fmtData(ad.data_limite_prestacao))}</strong>` : ''},
    conforme política interna da empresa ${esc(empresa.fantasia)}.
    <br><br>
    Os descontos poderão ser aplicados das seguintes formas:
    <br>– Caso o favorecido do comprovante for CLT, o desconto será aplicado nos termos do Artigo 462 § da CLT, § 1º.
    <br>– Caso o favorecido do comprovante for prestador de serviço, o desconto será aplicado na autorização para faturamento.
    ${ehPJ ? '<br><br><i>Favorecido cadastrado como prestador de serviço (PJ).</i>' : ''}
  </div>

  <div class="assinatura">
    <div class="linha"></div>
    <div class="nome">${esc(ad.favorecido_nome)}</div>
  </div>

  <div class="rodape">
    ${esc(ad.numero)} • Emitido em ${esc(agora)} • TEG+ ${esc(empresa.fantasia)}
  </div>
</div>
<script>window.onload = function () { setTimeout(function () { window.print() }, 350) }</script>
</body></html>`
}

/** Monta o termo e abre numa aba para impressão/assinatura. */
export async function imprimirTermoAdiantamento(ad: TermoAdiantamentoDados, emitidoPor?: string | null) {
  const [empresa, rh] = await Promise.all([
    getEmpresa().catch(() => EMPRESA_FALLBACK),
    buscarFavorecidoRH(ad.favorecido_nome, ad.favorecido_email),
  ])
  const html = buildTermoAdiantamentoHtml(ad, empresa, rh, emitidoPor)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Permita pop-ups neste site para abrir o termo de adiantamento.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
}
