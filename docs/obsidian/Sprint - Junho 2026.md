---
title: Sprint Junho 2026 — Revisão de Estado
data_revisao: 2026-06-06
---

# Sprint Junho 2026 — Revisão de Estado

Revisão item-a-item do backlog do sprint, com estado atual no código e próximo passo. Status:
- ✅ **OK** — implementado e funcionando
- 🟡 **PARCIAL** — base existe, falta peça(s) específica(s)
- 🔴 **PENDENTE** — não implementado / não localizado

## Visão Geral — atualizada 2026-06-08 (rodada 2: backend automacoes)

| Módulo | OK | Parcial | Pendente | Total |
|---|---|---|---|---|
| Compras | 6 | 0 | 1 | 7 |
| Estoque | 11 | 1 | 1 | 13 |
| Fin. CAP | 1 | 2 | 1 | 4 |
| Fin. CR + Tesouraria | 1 | 1 | 1 | 3 |
| Contratos | 3 | 1 | 1 | 5 |
| Locação | 3 | 1 | 0 | 4 |
| **Total** | **25** | **6** | **5** | **36** |

**Trajetória do sprint:** 11 → 20 → **25 ✅**. Sobra apenas teste manual (CAP fluxo end-to-end), 1 decisão de produto (Solicitações Material x Triagem) e 5 itens 🔴 que dependem de decisões/integrações externas.

---

## 🔧 Compras

### ✅ [Alta] Validar comprovante de pagamento — **fix aplicado 2026-06-06**
- **Estado original (achado):** UI já renderizava a seção "Pagamento" no detalhe do pedido ([Pedidos.tsx:1389](../../frontend/src/pages/Pedidos.tsx:1389)), mas o único pedido pago em prod (PC-202605-00001) estava **sem comprovante**. Investigação mostrou que o modal individual ([ContasPagar.tsx](../../frontend/src/pages/financeiro/ContasPagar.tsx)) tinha comprovante opcional + `catch` engolindo falha de upload, e o batch ([PainelPagamentos.tsx](../../frontend/src/pages/financeiro/PainelPagamentos.tsx)) não checava comprovante nenhum.
- **Fix:**
  - **Modal individual:** comprovante agora é obrigatório quando há `pedido_id` (arquivo selecionado OU já anexado). Erro de upload aborta o registro. Botão "Confirmar" fica desabilitado até ter comprovante.
  - **Painel batch:** ao abrir confirmação, consulta `cmp_pedidos_anexos` por `tipo='comprovante_pagamento'` em cada `pedido_id` selecionado. Se faltar algum, mostra alerta vermelho com a lista (fornecedor + nº doc + valor) e bloqueia "Confirmar".
- **Legado:** PC-202605-00001 mantido como exceção (já pago, sem comprovante).
- **Pendente:** validação visual com login (requer ambiente do usuário) + considerar RPC guardiã no banco como camada adicional.

### ✅ [Média] Pedido Direto / Requisição Extraordinária — **fix aplicado 2026-06-06**
- **Estado:** Schema já existia (migration `073_pedido_direto.sql`) e `PedidoDiretoModal` já era completo, mas só acessível pela tela de Pedidos.
- **Fix:** Banner amarelo "Pedido Extraordinário" na Etapa 1 de [NovaRequisicao.tsx:560+](../../frontend/src/pages/NovaRequisicao.tsx:560) (apenas em modo de criação, oculto em edição). Botão "Abrir" dispara `PedidoDiretoModal` existente; após emitir, navega pra `/pedidos`.
- **Validado:** modal renderiza completo no preview (fornecedor, obra, classe, itens, justificativa obrigatória).

### ✅ [Média] Lead time no painel — revisar
- **Estado:** Campo `lead_time_dias` em `est_itens`. Dashboard exibe prazos (cotação + fornecedor), ordena por urgência.
- **Refs:** [Itens.tsx](../../frontend/src/pages/estoque/Itens.tsx), [Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx).
- **Próximo passo:** Confirmar se `lead_time_dias` está sendo usado pra calcular `data_prevista_entrega` na criação do pedido (ou se é só referência).

### ✅ [Baixa] Painel de lead time por categoria e prazo por fase — **feito 2026-06-08**
- **Entrega do outro notebook** (commit `2045c1e`): hook `useLeadTimeCompras` + página dedicada com KPIs + tabela por categoria com lead time por fase (R→A, A→C, C→P, P→E) + barra empilhada de composição.
- **Ajuste hoje** (commit `2506ec3`): consolidado **dentro do Painel** (Dashboard) — página separada `/compras/lead-time` removida; componente reaproveitável em `components/dashboard/LeadTimePainel.tsx`.
- **Refs:** [LeadTimePainel.tsx](../../frontend/src/components/dashboard/LeadTimePainel.tsx), [Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx), [useLeadTimeCompras.ts](../../frontend/src/hooks/useLeadTimeCompras.ts).

### 🔴 [Baixa] Painel de savings — adiado
- **Estado:** Sem KPI consolidado.
- **Decisão (2026-06-06):** Adiado nesta rodada. Antes de implementar, alinhar **fórmula de economia** (valor_estimado − valor_selecionado? primeira − melhor cotação?).
- **Esforço estimado:** ~3–5h após a fórmula estar definida.

### ✅ [Baixa] AprovAi — detalhamento e linha do tempo
- **Estado:** AprovacaoCard com timeline e tipos (cotação/pagamento/minuta/requisição/transporte/adiantamento), KPIs e filtros.
- **Refs:** [AprovAi.tsx](../../frontend/src/pages/AprovAi.tsx).
- **Próximo passo:** Refinar visual: cards de fase com timestamp explícito e motivo de rejeição em destaque.

### ✅ [Média] Vincular itens não cadastrados (pré-cadastros)
- **Estado:** Pronto e em produção. Banner de match sugerido entregue no commit `227c46c`. Dedup normalizado (UPPER + unaccent).
- **Refs:** [ItemAutocomplete.tsx](../../frontend/src/components/ItemAutocomplete.tsx), [usePreCadastros.ts](../../frontend/src/hooks/usePreCadastros.ts).
- **Próximo passo:** Acompanhar adoção; medir taxa de match aceito vs rejeitado.

---

## 📦 Estoque

### ✅ [Alta] Importar inventário — **feito 2026-06-08**
- **Migration 127:** RPC `est_importar_inventario(uuid, jsonb, text)` recebe linhas {codigo, quantidade, observacao?}, resolve item por código, calcula saldo_sistema (agregando est_movimentacoes na base) e divergência, UPSERT em est_inventario_itens (constraint nova: unique inv+item). Marca inventário aberto → em_contagem.
- **Hook:** `useImportarInventarioCSV` em useEstoque.ts.
- **UI:** `ImportarCSVModal` com upload .csv/.txt OU cola texto. Detecta cabeçalho, suporta `;`/`,` e vírgula decimal. Lista linhas ignoradas com motivo.

### ✅ [Alta] Validar fluxo Compras → Estoque — **feito 2026-06-08**
- **Migration 125:** RPC `fn_confirmar_entrada_estoque(uuid[])` confirma itens de recebimento E gera `est_movimentacoes` (tipo=entrada) automaticamente, herdando dados do pedido (base, NF, fornecedor, obra, lote, série, validade, valor). Item sem catálogo só muda status (entra em "puladas").
- **Hook:** `useConfirmarEntrada` agora chama a RPC em vez de update direto.
- **Coluna `est_movimentacoes.recebimento_item_id`** (que já existia) passou a ser preenchida automaticamente — audit trail completo.

### ✅ [Alta] Filtro por localidade em "Aguardando Entrada/Saída" — **feito 2026-06-06**
- **Releitura:** "Localidade" no contexto do sprint = **base** (canteiro), não corredor/prateleira. `est_bases` tem 9 cadastradas. `est_localizacoes` (granular) fica pra um sprint futuro.
- **Estado original:** `baseFilter` existia em Itens.tsx mas o select só renderizava na aba "Em Estoque"; as listas de "Aguardando Entrada", "Liberado para Retirada" e "Em Movimentação" ignoravam o filtro.
- **Fix:** Removida condição `activeTab === 'em_estoque'` do select; label muda pra "Todas as bases" nas outras abas. Memos `entradasFiltradas`, `movsFiltradas`, `liberadosFiltrados` agora aplicam filtro por `base_nome` (entradas/movs) ou `base_id` (liberados).
- **Refs:** [Itens.tsx](../../frontend/src/pages/estoque/Itens.tsx).
- **Validado em preview**: aba "Aguardando Entrada" mostra select com "Todas as bases" + 9 canteiros.

### ✅ [Alta] Limpar cautela "Teste Leandro" — **feito 2026-06-06**
- **Achado:** Existia apenas 1 cautela no banco inteiro — `CAU-2026-0001` (LEANDRO MAIA MALLET, obra SEDE, status `em_aberto` há 2 meses, 1 item, observação "Colaborador esqueceu a fonte").
- **Ação:** DELETE em `est_cautelas` (cascade pegou `est_cautela_itens`). Banco zerado pra começar de fato.

### ✅ [Baixa] Termo de aceite na cautela — **feito 2026-06-08 (outro note)**
- **Entrega** (commit `2045c1e`): `TermoAceiteModal.tsx` + utility `termo-aceite-cautela-pdf.ts` gera PDF assinável do termo.
- **Refs:** [TermoAceiteModal.tsx](../../frontend/src/components/cautela/TermoAceiteModal.tsx), [termo-aceite-cautela-pdf.ts](../../frontend/src/utils/termo-aceite-cautela-pdf.ts).

### ✅ [Baixa] Validar fluxo completo de cautela — **feito 2026-06-08 (outro note)**
- **Fix** (commit `553647a`): alinhado status da cautela ao CHECK do banco — validação de fluxo destravada.
- **Bonus**: `Minhas Cautelas` agora usa `colaborador_id` correto do perfil (commit `6ea65f4`).

### 🟡 [Média] Avaliar necessidade da tela Solicitações de Material
- **Estado:** Tela ativa com pipeline completo. Pode colidir com o fluxo de triagem CD Araxá (RPCs 108) — decisão de produto pendente.
- **Refs:** [Solicitacoes.tsx](../../frontend/src/pages/estoque/Solicitacoes.tsx), `project_triagem_cd_rc` na auto-memory.
- **Próximo passo:** Decidir com PM: manter, unificar com triagem CD, ou descontinuar.

### 🔴 [Média] Regras de permissão almoxarife/base
- **Estado:** Migration 072 deixou policies abertas (`USING true`).
- **Próximo passo:** Policies `est_*_por_base` filtrando por `base_id` do perfil; perfil `almoxarife` com escopo de base.

### ✅ [Alta] Remover tela Recebimentos — **feito 2026-06-06**
- **Estado original:** Tela `/estoque/recebimentos` listava pedidos recebíveis e abria `RecebimentoModal`. O mesmo modal já é disparado da tela de Pedidos, então a função não foi perdida.
- **Ação:**
  - Removido `pages/estoque/Recebimentos.tsx` (git rm).
  - Removido lazy import e Route em `App.tsx`.
  - Removido item de menu em `EstoqueLayout.tsx`.
  - Adicionado redirect `/estoque/recebimentos` → `/estoque` para links salvos.
- **Validado em preview:** menu sem Recebimentos; rota antiga redireciona ao painel.

### ✅ [Média] Validar tela de Histórico (Movimentações)
- **Estado:** Lista por tipo (entrada/saída/transferência/ajuste/baixa/devolução) e base; busca e filtros OK.
- **Refs:** [Movimentacoes.tsx](../../frontend/src/pages/estoque/Movimentacoes.tsx).
- **Próximo passo:** Avaliar refinos de período/data se necessário.

### ✅ [Média] Validar tela e fluxo de Inventário
- **Estado:** Lista, criação por tipo (cíclico) e filtro por curva funcionando. **Contagem de itens ainda precisa de UI dedicada**.
- **Refs:** [Inventario.tsx](../../frontend/src/pages/estoque/Inventario.tsx).
- **Próximo passo:** UI de contagem item-a-item + conclusão.

### ✅ [Baixa] OC automática ao atingir estoque mínimo — **feito 2026-06-08**
- **Migration 128:** RPC `est_gerar_oc_minimo(p_base_id uuid DEFAULT NULL)` varre itens.estoque_minimo, agrega saldo, cria 1 RC (status=rascunho) por base com itens abaixo do mínimo. Quantidade sugerida = max(estoque_maximo, ponto_reposicao, minimo×2) − saldo. Idempotente: pula itens já cobertos por RC em aberto.
- **Número:** `RC-AUTO-YYYYMMDD-NNN`. Solicitante: "Sistema (estoque minimo)".
- **Disparo manual por ora** (frontend pode chamar a RPC). Pode ser plugada em cron/Edge Function depois.

### ✅ [Baixa] Painel detalhado de Estoque — **feito 2026-06-08 (outro note)**
- **Entrega** (commit `dc875dd`): nova página `/estoque/painel` (PainelEstoque) com indicadores detalhados; item "Indicadores" no menu lateral do Estoque.
- **Refs:** [PainelEstoque.tsx](../../frontend/src/pages/estoque/PainelEstoque.tsx).

---

## 💸 Financeiro — Contas a Pagar

### 🟡 [Alta] Testar continuidade do fluxo Financeiro
- **Estado:** Todos os elos existem (RC → Pedido → CP → Aprovação → Lote → Pagamento). **Não há validação end-to-end** que confirme geração de CP a partir do Recebimento.
- **Refs:** [ContasPagar.tsx](../../frontend/src/pages/financeiro/ContasPagar.tsx), [AprovacoesPagamento.tsx](../../frontend/src/pages/financeiro/AprovacoesPagamento.tsx), [LotesPagamento.tsx](../../frontend/src/pages/financeiro/LotesPagamento.tsx), [PainelPagamentos.tsx](../../frontend/src/pages/financeiro/PainelPagamentos.tsx).
- **Próximo passo:** Teste manual end-to-end em uma RC real, partindo do recebimento até a baixa.

### 🟡 [Muito Baixa] Remessa bancária
- **Estado:** Integração **via Omie API** pronta (`useOmieEnviarRemessa`, `useOmieAtualizarRemessas`, enum `RemessaCPStatus`, campos `remessa_*` em `fin_contas_pagar`). **Não há geração de CNAB 240/400 bruto**.
- **Refs:** [LotesPagamento.tsx:138](../../frontend/src/pages/financeiro/LotesPagamento.tsx:138), `useLotesPagamento.ts`.
- **Próximo passo:** Decidir se CNAB direto-banco é necessário; se sim, gerar CNAB 240 via RPC ou lib.

### 🔴 [Muito Baixa] Conciliação automática (OFX/PIX)
- **Estado:** Conciliação manual completa (select + classificar + comprovante). **Não há parsing OFX/PIX**.
- **Refs:** [Conciliacao.tsx](../../frontend/src/pages/financeiro/Conciliacao.tsx).
- **Próximo passo:** RPC de parsing OFX + matching por valor/data.

### ✅ [Média] Painel de pagamentos previstos com export PDF — **feito 2026-06-08**
- **Achado:** `PainelPagamentos.tsx` existia mas era código órfão (rota `/financeiro/painel-pagamentos` redirecionava pra CPPipeline).
- **Fix:**
  - Painel ganhou `exportPDF()` com `jsPDF` (já era dep do projeto). PDF tem título, KPIs, seções agrupadas e total geral.
  - Botão "Exportar PDF" no header (desabilita quando lista vazia).
  - Removido redirect em [App.tsx:267](../../frontend/src/App.tsx:267); painel agora monta na rota direto.
  - Adicionado item "Pgtos Previstos" no menu de Financeiro ([FinanceiroLayout.tsx](../../frontend/src/components/FinanceiroLayout.tsx)).
- **Refs:** [PainelPagamentos.tsx](../../frontend/src/pages/financeiro/PainelPagamentos.tsx).

---

## 💰 Financeiro — Contas a Receber + Tesouraria

### 🟡 [Baixa] Integração com emissão de Notas Fiscais
- **Estado:** Upload + parse AI de DANFE/XML via n8n + compartilhamento por e-mail prontos. **Sem consulta SEFAZ / emissão automatizada**.
- **Refs:** [NotasFiscais.tsx](../../frontend/src/pages/financeiro/NotasFiscais.tsx), [useNotasFiscais.ts:157](../../frontend/src/hooks/useNotasFiscais.ts:157), [ContasReceber.tsx:180](../../frontend/src/pages/financeiro/ContasReceber.tsx:180).
- **Próximo passo:** Webhook de validação contra API de consulta de NF da Receita.

### ✅ [Baixa] Conciliação de cartão de crédito (desmembramento)
- **Estado:** Tela completa com split-view (apontamentos × itens fatura), upload via n8n com OCR, warning de divergência >1%, desconciliação.
- **Refs:** [ConciliacaoCartoes.tsx](../../frontend/src/pages/financeiro/ConciliacaoCartoes.tsx), [useCartoes.ts:316](../../frontend/src/hooks/useCartoes.ts:316).
- **Próximo passo:** Testes E2E com faturas reais de múltiplos emissores.

### 🔴 [Baixa] Notificações para portadores de cartão
- **Estado:** Sem mecanismo de notificação (email/sistema). Sem coluna de preferência em `fin_apontamentos_cartao`.
- **Próximo passo:** Migration `fin_notificacoes_portador` + trigger de insert + envio via Graph API (mesmo padrão de TI).

---

## 📄 Contratos

### ✅ [Média] Solicitações de elaboração vindas de Compras — **feito 2026-06-08**
- **Migration 126:** RPC `cmp_criar_solicitacao_contrato_from_rc(requisicao_id, observacao?, responsavel_nome?)` cria `con_solicitacoes` (numero CON-YYYYMM-NNNN, etapa=preparar_minuta) herdando solicitante, obra, escopo, valor estimado, centro_custo da RC. Se já tem pedido emitido, herda fornecedor como contraparte. Idempotente: reaproveita solicitação existente não-cancelada.
- **Gatilho:** **manual** (comprador decide via banner em [RequisicaoDetalhe.tsx](../../frontend/src/pages/RequisicaoDetalhe.tsx)) — evita poluir Contratos com toda RC aprovada.
- **UI:** banner "Solicitar contrato" aparece quando RC está em [aprovada, cotacao_em_andamento, cotacao_aprovada, pedido_emitido, em_andamento]; expande textarea de observação; pós-criar mostra link "Abrir" pra ir direto na solicitação.

### ✅ [Média] Apresentação do título do item pendente
- **Estado:** STAGES já definidos em SolicitacoesLista e Assinaturas.
- **Refs:** [SolicitacoesLista.tsx:25](../../frontend/src/pages/contratos/SolicitacoesLista.tsx:25), [Assinaturas.tsx:27](../../frontend/src/pages/contratos/Assinaturas.tsx:27).
- **Próximo passo:** Revisar rótulos ("Pendente" vs "Em Andamento") e simplificar conforme desejado.

### ✅ [Média] Fluxo de elaboração de minutas
- **Estado:** Pipeline 7-etapas, análise IA (Gemini Flash via n8n), versionamento, modelos por grupo.
- **Refs:** [PreparaMinuta.tsx](../../frontend/src/pages/contratos/PreparaMinuta.tsx), [ModelosContrato.tsx](../../frontend/src/pages/contratos/ModelosContrato.tsx), `useMinutas`, `useAnalisarMinuta`, `useGerarMinutaPDF`.
- **Próximo passo:** Validar cobertura da análise IA em riscos críticos (garantias, reajustes, penalidades).

### 🟡 [Média] Fluxo de assinaturas
- **Estado:** UI 100% (5 stages: pendente → enviado → assinado → arquivado → liberado), types Certisign+ICP, endpoints n8n (`certisign-enviar`, `certisign-callback`). **Falta migration `con_assinaturas` no Supabase**.
- **Refs:** [Assinaturas.tsx](../../frontend/src/pages/contratos/Assinaturas.tsx), `useSolicitacoes.ts:1232`.
- **Próximo passo:** Criar migration `con_assinaturas` + RLS; testar callback Certisign avançando etapa.

### 🟡 [Média] Envio de medição para Financeiro
- **Estado:** UI completa (rascunho → em_aprovação → aprovado → faturado). FK `fin_cp_id` em `con_medicoes` pronta. **Workflow n8n `con-gerar-cp-cr` não testado**.
- **Refs:** [Medicoes.tsx](../../frontend/src/pages/contratos/Medicoes.tsx), tipo `ContratoMedicao`.
- **Próximo passo:** Implementar/testar workflow n8n que, ao aprovar medição + liberar parcela, cria CP/CR automático com centro de custo correto.

---

## 🏠 Locação de Imóveis

### ✅ [Média] Envio de faturas para o Financeiro — **feito 2026-06-08**
- **Migration 124:** RPC `loc_enviar_faturas_financeiro(uuid[])` cria 1 `fin_contas_pagar` por fatura elegível (status ∈ [previsto, lancado], valor > 0) com fornecedor=locador, vencimento da fatura, natureza='locacao_imovel', origem='locacao'. Marca fatura como `enviado_pagamento`. Pula já-enviadas/pagas e sem valor.
- **Hook:** `useEnviarFaturasFinanceiro` em [useLocacao.ts](../../frontend/src/hooks/useLocacao.ts) invalida `loc_faturas` + `contas-pagar`.
- **Botão:** [Faturas.tsx:400+](../../frontend/src/pages/locacao/Faturas.tsx:400) — antes era `alert('em breve')`. Agora confirma com count, envia, mostra resultado.
- **Centro de custo** da CP fica vazio inicialmente (financeiro classifica), `locador_nome` do imóvel vira fornecedor.

### 🟡 [Baixa] Fluxo de ordens de serviço
- **Estado:** CRUD visual + modal de criação prontos. Falta workflow de avanço de status e vínculo com requisição de compras.
- **Refs:** [ManutencoesServicos.tsx](../../frontend/src/pages/locacao/ManutencoesServicos.tsx), `useSolicitacoesLocacao`.
- **Próximo passo:** Mutation `useAtualizarSolicitacao` com transições (aberta → em_andamento → concluída) + FK `cmp_requisicao_id`.

### ✅ [Baixa] Aditivos e renovações — **feito 2026-06-08 (outro note)**
- **Entrega** (commit `8ae9d97`): fluxo concluído — botões "Enviar p/ assinatura" (rascunho→aguardando_assinatura) e "Marcar assinado" (aguardando→assinado) em [AditivosRenovacoes.tsx:150+](../../frontend/src/pages/locacao/AditivosRenovacoes.tsx:150). Ao assinar aplica efeito no contrato/imóvel (renovação prorroga data_fim, reajuste atualiza valor_aluguel_mensal).
- **Bonus** (commit `d0c5fc2`): entrada/saída do imóvel sincronizam status automaticamente.
- **Pendência menor:** disparo automático de e-mail ao locador fica pra quando Graph API tiver App Registration completo (project_ti_chamados).

### ✅ [Baixa] Entrada e devolução de imóveis
- **Estado:** Pipelines Kanban completos (entrada 4 etapas, saída 5 etapas), vistoria com checklist, cálculo de data limite. **Falta gerar PDF de orientações** (alertas em EntradasPipeline:329 e SaidaPipeline:298).
- **Refs:** [EntradasPipeline.tsx](../../frontend/src/pages/locacao/EntradasPipeline.tsx), [SaidaPipeline.tsx](../../frontend/src/pages/locacao/SaidaPipeline.tsx).
- **Próximo passo:** Implementar `downloadOrientacoesPdf()` com checklist padrão.

---

## 📌 Recomendações Imediatas (próximas 2 semanas)

**Alta prioridade — fechar antes de mais nada:**
1. Teste end-to-end do fluxo Financeiro (CAP) — bloqueia validação da continuidade.
2. Importação de inventário (CSV) e automação Compras→Estoque — duas pontas do mesmo gargalo.
3. Filtro de localidade em Aguardando Entrada/Saída — definir o modelo de localidade primeiro.
4. Limpeza do dado "Teste Leandro" — task de minutos.
5. Decisão de produto sobre remoção da tela Recebimentos.

**Quick wins (baixo esforço, alto valor visível):**
- Export PDF do Painel de Pagamentos (`jsPDF` + `html2canvas`).
- UX de Pedido Direto em NovaRequisicao (schema já existe).
- PDF de orientações em Locação (entrada/saída).

**Decisões de produto pendentes:**
- Solicitações de Material x Triagem CD Araxá (Estoque).
- Tela Recebimentos: manter, mover ou remover (Estoque).
- CNAB bruto x Omie API (CAP) — qual modelo de remessa adotar.
