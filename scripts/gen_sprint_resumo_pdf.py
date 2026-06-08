# -*- coding: utf-8 -*-
"""
Gera PDF de resumo da sessao do Sprint Junho/2026 do TEG+.
Saida: docs/Sprint-Jun26-Resumo-Sessao.pdf
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUT = 'docs/Sprint-Jun26-Resumo-Sessao.pdf'

# ── Cores ─────────────────────────────────────────────────────────────────────
TEAL = colors.HexColor('#0d9488')
DARK = colors.HexColor('#1e293b')
MID = colors.HexColor('#64748b')
GREEN = colors.HexColor('#059669')
AMBER = colors.HexColor('#d97706')
RED = colors.HexColor('#dc2626')
BG_LIGHT = colors.HexColor('#f8fafc')

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()
H_COVER = ParagraphStyle('cover', parent=styles['Title'], fontSize=24, textColor=TEAL,
                         spaceAfter=8, alignment=TA_LEFT)
H_COVER_SUB = ParagraphStyle('cover_sub', parent=styles['Normal'], fontSize=12,
                              textColor=MID, spaceAfter=4)
H1 = ParagraphStyle('h1', parent=styles['Heading1'], fontSize=16, textColor=DARK,
                    spaceBefore=16, spaceAfter=8, leading=20)
H2 = ParagraphStyle('h2', parent=styles['Heading2'], fontSize=12, textColor=TEAL,
                    spaceBefore=10, spaceAfter=6, leading=15)
BODY = ParagraphStyle('body', parent=styles['Normal'], fontSize=10, leading=14,
                      spaceAfter=4, textColor=DARK)
SMALL = ParagraphStyle('small', parent=styles['Normal'], fontSize=8.5, leading=11,
                       textColor=MID)
BULLET = ParagraphStyle('bullet', parent=BODY, leftIndent=14, spaceAfter=2)


def section(title):
    return Paragraph(title, H1)


def sub(title):
    return Paragraph(title, H2)


def p(text):
    return Paragraph(text, BODY)


def b(text):
    return Paragraph(f'&bull; {text}', BULLET)


def small(text):
    return Paragraph(text, SMALL)


def kpi_card(label, val, color):
    return Table([
        [Paragraph(f'<font size=8 color="#64748b">{label.upper()}</font>', styles['Normal'])],
        [Paragraph(f'<font size=22 color="{color.hexval()}"><b>{val}</b></font>', styles['Normal'])],
    ], colWidths=[4.2 * cm], rowHeights=[0.7 * cm, 1.4 * cm],
       style=TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))


def table_status(data, col_widths=None):
    """Tabela com cabecalho colorido e linhas alternadas."""
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
    ]))
    return t


# ── Conteudo ──────────────────────────────────────────────────────────────────
story = []

# Capa
story.append(Spacer(1, 0.6 * cm))
story.append(Paragraph('TEG+ ERP', H_COVER))
story.append(Paragraph('Sprint Junho/2026 - Resumo de Sessao', H_COVER_SUB))
story.append(Paragraph('Gerado em 2026-06-08 - Branch: main', SMALL))
story.append(Spacer(1, 0.8 * cm))

# Visao geral / KPIs
story.append(Table([[
    kpi_card('Total', '36', DARK),
    kpi_card('OK', '27', GREEN),
    kpi_card('Parcial', '6', AMBER),
    kpi_card('Pendente', '3', RED),
]], colWidths=[4.4 * cm] * 4, hAlign='LEFT'))

story.append(Spacer(1, 0.5 * cm))
story.append(p(
    '<b>Trajetoria do sprint:</b> 11 OK no inicio -> 20 (pos-merge da branch '
    '<i>feat/compras-estoque-baixas</i>) -> 25 (rodada de backend) -> 27 (rodada OFX + push cartao). '
    '<b>+16 itens fechados nesta sessao.</b>'
))

# Saldo por modulo
story.append(sub('Saldo por modulo'))
saldo_data = [
    ['Modulo', 'OK', 'Parcial', 'Pendente', 'Total'],
    ['Compras', '6', '0', '1', '7'],
    ['Estoque', '11', '1', '1', '13'],
    ['Fin. CAP', '2', '2', '0', '4'],
    ['Fin. CR + Tesouraria', '2', '1', '0', '3'],
    ['Contratos', '3', '1', '1', '5'],
    ['Locacao', '3', '1', '0', '4'],
    ['TOTAL', '27', '6', '3', '36'],
]
t = table_status(saldo_data, col_widths=[6 * cm, 1.8 * cm, 2 * cm, 2 * cm, 2 * cm])
t.setStyle(TableStyle([
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e0f2f1')),
    ('TEXTCOLOR', (0, -1), (-1, -1), TEAL),
]))
story.append(t)

story.append(PageBreak())

# ── O que foi feito ───────────────────────────────────────────────────────────
story.append(section('1. O que foi entregue nesta sessao'))

story.append(sub('Compras'))
story.append(b('<b>Validar comprovante de pagamento</b> [Alta] - modal individual de CP (ContasPagar) '
               'exige comprovante quando ha pedido vinculado; catch silencioso no upload removido. '
               'Painel de Pagamentos (batch) consulta cmp_pedidos_anexos antes de confirmar e bloqueia se '
               'faltar comprovante de algum pedido selecionado.'))
story.append(b('<b>Pedido Direto / Requisicao Extraordinaria</b> [Media] - banner amarelo "Pedido '
               'Extraordinario" na Etapa 1 da Nova Requisicao abre PedidoDiretoModal existente.'))
story.append(b('<b>Lead time no Painel</b> [Media] - pagina dedicada /compras/lead-time descontinuada; '
               'conteudo integrado como secao do Dashboard (LeadTimePainel reusavel).'))
story.append(b('<b>Painel de Lead Time por categoria/fase</b> [Baixa] - entregue pelo outro notebook, '
               'consolidado no Painel.'))
story.append(b('<b>AprovAi - linha do tempo datada</b> [Baixa] - entregue pelo outro notebook.'))
story.append(b('<b>Botao "Pedido Direto" removido</b> do header de Pedidos (redundante apos o banner).'))

story.append(sub('Estoque'))
story.append(b('<b>Limpar cautela Teste Leandro</b> [Alta] - CAU-2026-0001 deletada de producao.'))
story.append(b('<b>Remover tela Recebimentos</b> [Alta] - arquivo + rota + menu removidos; redirect '
               '/estoque/recebimentos -> /estoque adicionado pra links salvos.'))
story.append(b('<b>Filtro por localidade em Aguardando E/S</b> [Alta] - select de base agora aparece '
               'em todas as abas (Aguardando Entrada, Liberado p/ Retirada, Em Movimentacao).'))
story.append(b('<b>Validar fluxo Compras -> Estoque</b> [Alta] - migration 125: RPC '
               'fn_confirmar_entrada_estoque(uuid[]) gera est_movimentacoes (tipo=entrada) automatica '
               'ao confirmar item de recebimento, herdando dados do pedido.'))
story.append(b('<b>Importar Inventario via CSV</b> [Alta] - migration 127 + modal de upload com parse '
               '(detecta cabecalho, suporta ; ou ,). UPSERT calcula divergencia automatica.'))
story.append(b('<b>Termo de aceite na cautela</b> [Baixa] - entregue pelo outro notebook.'))
story.append(b('<b>Validar fluxo completo de cautela</b> [Baixa] - fix de status alinhado ao CHECK do '
               'banco (entregue pelo outro notebook).'))
story.append(b('<b>Painel detalhado de Estoque</b> [Baixa] - nova pagina /estoque/painel (entregue pelo '
               'outro notebook).'))
story.append(b('<b>OC automatica ao atingir minimo</b> [Baixa] - migration 128: RPC est_gerar_oc_minimo '
               'varre itens abaixo do minimo, cria 1 RC (status=rascunho) por base com quantidades '
               'sugeridas. Idempotente.'))

story.append(sub('Financeiro - Contas a Pagar'))
story.append(b('<b>Painel de pagamentos previstos com export PDF</b> [Media] - export PDF gerencial '
               '(header corporativo, faixas vencidos/hoje/7/30/futuro, total geral). Tela ativada na '
               'rota /financeiro/painel-pagamentos + item no menu.'))
story.append(b('<b>Conciliacao automatica OFX</b> [Muito Baixa] - migration 130: RPCs '
               'fn_sugerir_conciliacao_tesouraria e fn_aplicar_conciliacao_tesouraria. UI: modal de '
               'revisao com score destacado (pre-marca matches >=95).'))
story.append(b('<b>Fluxo de rejeicao corrigido</b> (descoberto durante teste) - RPC '
               'rpc_resolver_lote_status nao cancela mais lote/CP por rejeicao em aprovacao; '
               'devolve pra fila com observacao. Cancelar fica exclusivo do financeiro.'))
story.append(b('<b>Aprovador real registrado</b> (descoberto durante teste) - apr_aprovacoes agora '
               'sobrescreve aprovador_nome com o decisor real (antes ficava como Welton/Laucidio '
               'hardcoded do destinatario esperado).'))

story.append(sub('Tesouraria'))
story.append(b('<b>Conciliacao de cartao (desmembramento)</b> [Baixa] - DesmembrarFaturaModal '
               'entregue pelo outro notebook.'))
story.append(b('<b>Notificacoes pra portadores de cartao</b> [Baixa] - migration 129: tabela generica '
               'sys_notif_queue + trigger AFTER INSERT em fin_itens_fatura_cartao enfileira pra cada '
               'portador ativo. Hook useNotificacoes consome via Realtime + Browser Notification API. '
               'Secao "Cartoes e avisos" no NotificationBell.'))

story.append(sub('Contratos'))
story.append(b('<b>Solicitacoes de elaboracao vindas de Compras</b> [Media] - migration 126: RPC '
               'cmp_criar_solicitacao_contrato_from_rc herda dados da RC (solicitante, obra, escopo, '
               'valor, centro_custo). Banner "Solicitar contrato" em RequisicaoDetalhe.'))

story.append(sub('Locacao de imoveis'))
story.append(b('<b>Envio de faturas para o Financeiro</b> [Media] - migration 124: RPC '
               'loc_enviar_faturas_financeiro cria 1 fin_contas_pagar por fatura elegivel '
               '(antes era alert "em breve").'))
story.append(b('<b>Aditivos e renovacoes</b> [Baixa] - fluxo completo entregue pelo outro notebook.'))
story.append(b('<b>Entrada/saida de imoveis</b> [Baixa] - pipeline Kanban entregue pelo outro notebook.'))

story.append(PageBreak())

# ── O que esta pendente ───────────────────────────────────────────────────────
story.append(section('2. O que esta pendente'))

story.append(sub('PENDENTE (3 itens) - dependem de decisao ou trabalho grande'))
pend_data = [
    ['Modulo', 'Item', 'Prio', 'Bloqueio'],
    ['Compras', 'Painel de Savings', 'Baixa', 'Falta definir formula de economia'],
    ['Estoque', 'Permissoes almoxarife/base (RLS)', 'Media', 'Migration grande + testes extensos'],
    ['Contratos', 'Migration con_assinaturas + RLS', 'Media', 'Backend Certisign'],
]
story.append(table_status(pend_data, col_widths=[2.8 * cm, 6.5 * cm, 1.6 * cm, 6 * cm]))

story.append(sub('PARCIAL (6 itens) - base pronta, falta o ultimo pedaco'))
par_data = [
    ['Modulo', 'Item', 'Prio', 'O que falta'],
    ['Estoque', 'Validar fluxo Compras -> Estoque',
     'Alta', 'Backend feito (mig 125). Falta TESTE end-to-end com RC real'],
    ['Estoque', 'Avaliar tela Solicitacoes de Material',
     'Media', 'Decisao de produto (manter, unificar com Triagem CD, ou descontinuar)'],
    ['Fin CAP', 'Testar continuidade fluxo Financeiro',
     'Alta', 'Backend completo. Falta TESTE manual end-to-end'],
    ['Fin CAP', 'Remessa bancaria CNAB',
     'Muito Baixa', 'Decisao: CNAB bruto ou Omie API basta?'],
    ['Fin CR', 'NF emissao - validacao SEFAZ',
     'Baixa', 'Webhook validacao real-time com Receita'],
    ['Contratos', 'Envio medicao -> Financeiro',
     'Media', 'Backend pronto. Falta TESTAR workflow n8n con-gerar-cp-cr'],
]
story.append(table_status(par_data, col_widths=[2.8 * cm, 5.5 * cm, 1.8 * cm, 6.8 * cm]))

story.append(sub('Decisoes de produto que travam trabalho'))
story.append(b('<b>Formula de Savings</b> (Compras) - definir antes de implementar painel'))
story.append(b('<b>Solicitacoes Material x Triagem CD Araxa</b> (Estoque) - decidir destino da tela'))
story.append(b('<b>CNAB bruto x Omie API</b> (CAP) - definir modelo de remessa'))

story.append(sub('Testes manuais pendentes'))
story.append(b('<b>Fluxo Financeiro end-to-end</b> (Alta) - criar RC real -> cotar -> aprovar -> emitir '
               'pedido -> receber -> gerar CP -> aprovar pgto -> lote -> baixar'))
story.append(b('<b>Workflow n8n con-gerar-cp-cr</b> - validar com medicao real'))
story.append(b('<b>Conciliacao OFX</b> - importar OFX real e validar matches'))

story.append(PageBreak())

# ── RH/DP ─────────────────────────────────────────────────────────────────────
story.append(section('3. Modulo RH/DP - nao tocado nesta sessao'))
story.append(p(
    'O modulo RH/DP <b>nao foi tocado</b> nesta sessao. Sao 8 itens, todos dependentes de '
    'infraestrutura externa (Secullum + Graph API).'
))

rh_data = [
    ['Prio', 'Item', 'Bloqueio'],
    ['Alta', 'Instalar Secullum nas obras', 'OPERACIONAL - relogio fisico em obra (nao e codigo)'],
    ['Media', 'Integrar Secullum <-> TEG+', 'Depende Secullum instalado + API/webhook'],
    ['Media', 'Relatorio hora extra com e-mail', 'Depende dados Secullum + Graph API'],
    ['Media', 'Relatorio desvios/correcoes ponto', 'Idem'],
    ['Baixa', 'Aprovacao ajustes/fechamento ponto', 'Workflow + schema novos'],
    ['Baixa', 'Relatorio consolidado pra Contabilidade', 'Idem'],
    ['Baixa', 'Import holerites -> Financeiro', 'Schema novo + upload em batch'],
    ['Media', 'Portal TEG pra baixar holerite', 'Tela nova + storage por colaborador'],
]
story.append(table_status(rh_data, col_widths=[1.6 * cm, 6 * cm, 8.5 * cm]))

story.append(Spacer(1, 0.4 * cm))
story.append(sub('O que da pra fazer SEM Secullum'))
story.append(b('<b>Portal TEG pra baixar holerite</b> (Media) - tela + bucket de storage por '
               'colaborador. Aproximadamente 3-4h.'))
story.append(b('<b>Import de holerites em batch</b> (Baixa) - upload + parse, depende formato de '
               'arquivo a definir.'))

story.append(Spacer(1, 0.3 * cm))
story.append(sub('Modulo Estrutura - tambem nao tocado'))
story.append(b('<b>Plano de seguranca</b> (Media) - exige documento de arquitetura amplo (RLS, '
               'auditoria, vault, etc.). E um sprint proprio.'))
story.append(b('<b>Plano de escalabilidade</b> (Media) - idem (cache, edge, indices, throttling).'))

story.append(PageBreak())

# ── Migrations e commits ──────────────────────────────────────────────────────
story.append(section('4. Migrations e commits da sessao'))

story.append(sub('Migrations aplicadas em producao (7)'))
mig_data = [
    ['#', 'Migration', 'Funcao'],
    ['123', 'rpc_resolver_lote_nao_cancela', 'Rejeicao em aprovacao nao cancela mais lote/CP'],
    ['124', 'loc_enviar_faturas_financeiro', 'Envia faturas Locacao -> Financeiro (cria CPs)'],
    ['125', 'fn_confirmar_entrada_estoque', 'Confirmar recebimento gera est_movimentacoes auto'],
    ['126', 'cmp_criar_solicitacao_contrato_from_rc', 'Cria con_solicitacoes a partir de RC'],
    ['127', 'est_importar_inventario', 'Import CSV de contagem de inventario'],
    ['128', 'est_gerar_oc_minimo', 'Reposicao automatica via RC quando saldo < minimo'],
    ['129', 'sys_notif_queue_cartoes', 'Fila in-app + trigger pra notificar portadores'],
    ['130', 'fn_sugerir_conciliacao_tesouraria', 'Matching automatico OFX -> CP/CR'],
]
story.append(table_status(mig_data, col_widths=[1.2 * cm, 5.8 * cm, 9.5 * cm]))

story.append(sub('Commits na sessao'))
story.append(b('<b>14 commits</b> empurrados para <code>origin/main</code>'))
story.append(b('Push em producao - Vercel build automatico'))
story.append(b('Branch <code>feat/compras-estoque-baixas</code> mergeada e deletada do remoto'))

story.append(Spacer(1, 0.5 * cm))
story.append(sub('Acompanhamento'))
story.append(p('Detalhamento completo, item a item, esta em '
               '<i>docs/obsidian/Sprint - Junho 2026.md</i> no repositorio.'))

# Build
doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=2 * cm, rightMargin=2 * cm,
                        topMargin=1.6 * cm, bottomMargin=1.6 * cm,
                        title='Sprint Junho 2026 - Resumo de Sessao',
                        author='TEG+')
doc.build(story)
print(f'PDF gerado: {OUT}')
