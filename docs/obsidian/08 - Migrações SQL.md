---
title: Migrações SQL
type: banco-de-dados
status: ativo
tags: [supabase, migrations, sql, schema]
criado: 2026-03-02
atualizado: 2026-04-07
relacionado: ["[[06 - Supabase]]", "[[07 - Schema Database]]", "[[19 - Integração Omie]]", "[[21 - Fluxo Pagamento]]"]
---

# Migrações SQL — TEG+ ERP

> **75 arquivos SQL** no diretório `supabase/`, incluindo migrations numeradas, runners e schema de referência.

## Localização

```
supabase/
├── 001 → 055                    → Migrations numeradas (cronológicas)
├── EXECUTAR_NO_SUPABASE.sql     → Runner completo (aplica todas)
├── EXECUTAR_MODULOS_FASE2.sql   → Runner módulos fase 2
├── EXECUTAR_MODULOS_NOVOS.sql   → Runner módulos novos
└── SCHEMA_v2.sql                → Rebuild completo de referência
```

---

## Histórico Completo de Migrações

### Módulo Compras (001-010)

#### `001_schema_compras.sql` — Schema Base
**Cria:** Estrutura inicial do módulo de compras.
- Enums: `status_requisicao`, `status_aprovacao`, `urgencia_tipo`
- Tabelas: `obras`, `usuarios`, `alcadas`, `requisicoes`, `requisicao_itens`, `aprovacoes`, `atividades_log`, `configuracoes`
- Funções: `gerar_numero_requisicao()`, `determinar_alcada()`, `update_updated_at()`
- Views: `vw_dashboard_requisicoes`, `vw_requisicoes_completas`, `vw_kpis_compras`, `vw_requisicoes_por_obra`
- Triggers: `updated_at` automático
- RLS: Habilitado em todas as tabelas
- Realtime: Publication nas tabelas principais

#### `002_seed_usuarios.sql` — Dados Iniciais
**Cria:** Usuários de teste/produção iniciais.
- 4 aprovadores (Coordenador, Gerente, Diretor, CEO)
- 3 requisitantes (João Silva, Maria Santos, Carlos Lima)

#### `003_rpc_dashboard.sql` — RPC Dashboard
**Cria:** Função `get_dashboard_compras(p_periodo, p_obra_id)`.
- Retorna JSON com KPIs, por_status, por_obra, recentes

#### `004_schema_cotacoes.sql` — Cotações
**Cria:** Tabelas `cotacoes`, `cotacao_fornecedores`, `cotacao_itens`.

#### `005_public_read_policy.sql` — Políticas Públicas
**Cria:** Políticas de leitura anônima para aprovação via token.

#### `006_auth_sistema.sql` — Integração Auth
**Cria:** Trigger `on_auth_user_created` → cria perfil automático. Sincronização `auth.users` ↔ `sys_perfis`.

#### `006b_auth_fix_perfil.sql` — Fix Perfil
**Corrige:** Problemas na criação automática de perfil. Fix trigger, emails duplicados, `ultimo_acesso`.

#### `007_fluxo_real.sql` — Fluxo Real de Negócio
**Maior migration da fase inicial.** 12 categorias reais, 3 compradores, expansão dos status, tabela `cmp_pedidos`.
→ Ver [[14 - Compradores e Categorias]]

#### `008_fixes_escalabilidade.sql` — Otimizações
**Corrige:** Índices de performance em colunas de filtro frequente.

#### `009_admin_rls_fix.sql` — Fix RLS Admin
**Corrige:** Admin pode ver todas as requisições sem filtro de `solicitante_id`.

#### `010_dashboard_fix.sql` — Fix Dashboard
**Corrige:** Otimização das views e RPC do dashboard.

---

### Módulo Financeiro (011-014)

#### `011_schema_financeiro.sql` — Módulo Financeiro
**Cria:** Schema completo: `fin_contas_pagar`, `fin_contas_receber`, `fin_centros_custo`, `fin_bancos`.
- Enums: `status_cp`, `status_cr`, `tipo_lancamento`
- Views: `vw_cp_vencimentos`, `vw_cr_recebimentos`, `vw_dre_simplificado`

#### `012_fix_rls_perfis.sql` — Fix RLS Perfis
**Corrige:** Loop infinito de RLS em `sys_perfis`. Função `is_admin()` com `SECURITY DEFINER`.

#### `013_omie_integracao.sql` — Integração Omie
**Cria:** `sys_config`, `fin_sync_log`, `get_omie_config()` (SECURITY DEFINER).
→ Ver [[19 - Integração Omie]]

#### `014_fluxo_pagamento.sql` — Fluxo de Pagamento
**Cria:** Ciclo Compras → Financeiro.
- Colunas em `cmp_pedidos`: `status_pagamento`, `liberado_pagamento_em/por`, `pago_em`, `nf_numero`
- Tabela `cmp_pedidos_anexos`, bucket `pedidos-anexos`
- Triggers: `trig_criar_cp_ao_emitir_pedido`, `trig_atualizar_cp_ao_liberar`
→ Ver [[21 - Fluxo Pagamento]]

---

### Módulos Operacionais (015-018)

#### `015_estoque_patrimonial.sql` — Estoque e Patrimonial
**Cria:** `est_itens`, `est_movimentacoes`, `est_inventario`, `est_imobilizados`, `est_depreciacoes`.
→ Ver [[22 - Módulo Estoque e Patrimonial]]

#### `015_fix_cp_trigger_enrich.sql` — Fix CP Trigger
**Corrige:** Enriquecimento de dados no trigger de criação de CP.

#### `016_logistica_transportes.sql` — Logística
**Cria:** `log_solicitacoes`, `log_transportes`, `log_etapas`, `log_nfe`, `log_transportadoras`. 9 etapas de rastreamento.
→ Ver [[23 - Módulo Logística e Transportes]]

#### `017_frotas_manutencao.sql` — Frotas
**Cria:** `fro_veiculos`, `fro_ordens_servico`, `fro_checklists`, `fro_abastecimentos`, `fro_telemetria`.
→ Ver [[24 - Módulo Frotas e Manutenção]]

#### `018_mural_recados.sql` — Mural de Recados
**Cria:** Enum `mural_tipo`, tabela `mural_banners`, view `mural_banners_vigentes`, seed 3 banners.
→ Ver [[25 - Mural de Recados]]

---

### RH, HHt, SSMA (019-021)

#### `019_rh.sql` — Módulo RH + DP
**Cria:** `rh_funcoes`, `rh_departamentos`, `rh_colaboradores`, `rh_mobilizacoes`, `rh_desmobilizacoes`, `rh_banco_talentos`.

#### `019_esclarecimento_flow.sql` — Fluxo Esclarecimento
**Cria:** Status `em_esclarecimento` em requisições e aprovações. Campos de esclarecimento.

#### `019_financeiro_performance.sql` — Performance Financeiro
**Cria:** Índices compostos para acelerar `get_dashboard_financeiro`.

#### `019_nf_romaneio_sync.sql` — NF/Romaneio Sync
**Cria:** Status `romaneio_emitido`, trigger auto-sync Fiscal → Logística.

#### `020_hht.sql` — Módulo HHt
**Cria:** `hht_atividades`, `hht_lancamentos`, `hht_aprovacoes`, `hht_consolidado`. Base do custo real por obra.

#### `021_ssma.sql` — Módulo SSMA
**Cria:** `ssm_epis`, `ssm_epi_colaborador`, `ssm_treinamentos`, `ssm_col_treinamento` e mais. Requisitos legais NR-10/NR-35.

---

### Contratos e Controladoria (022-024)

#### `022_contratos.sql` — Contratos Base
**Cria:** `con_clientes`, `con_contratos`, `con_medicoes`, `con_medicao_itens`, `con_pleitos`, `con_alertas`.
→ Ver [[27 - Módulo Contratos Gestão]]

#### `023_controladoria.sql` — Controladoria
**Cria:** `ctrl_orcamentos`, `ctrl_dre`, `ctrl_kpis_snapshot`, `ctrl_cenarios`. Dashboard CEO.

#### `024_contratos_gestao.sql` — Contratos Parcelas
**Cria:** `con_contrato_itens`, `con_parcelas`, `con_parcela_anexos`. Triggers de previsão financeira. Função `con_gerar_parcelas_recorrentes()`.

---

### Cadastros e Hardening (025-031)

#### `025_cadastros_master.sql` — Cadastros Master Data
**Cria:** `fin_classes_financeiras`, `sys_centros_custo`, `rh_colaboradores`.
→ Ver [[28 - Módulo Cadastros AI]]

#### `025_rls_granular.sql` — RLS Granular
**Cria:** Políticas RLS mais granulares por módulo e papel.

#### `026_lookups_constraints_indexes.sql` — Lookups e Constraints
**Cria:** Tabelas de lookup, constraints de integridade, índices adicionais. Fundação de integridade de dados.

#### `027_rpc_aprovacoes_batch.sql` — RPC Aprovações Batch
**Cria:** Função `get_aprovacoes_pendentes_compras()`. Substitui 3 queries sequenciais por 1 RPC.

#### `028_production_hardening.sql` — Production Hardening
**Cria:** 58 índices em FKs sem índice, particionamento, otimizações de produção.

#### `029_add_senha_definida.sql` — Campo senha_definida
**Cria:** Campo `senha_definida` em `sys_perfis` para tracking de primeiro acesso.

#### `029_sync_nf_pedidos_to_fiscal.sql` — Sync NF → Fiscal
**Cria:** Trigger auto-sync de anexos NF de pedidos para módulo fiscal. Backfill existentes.

#### `030_fis_solicitacoes_nf.sql` — Solicitações de NF
**Cria:** Enum `fis_status_solicitacao_nf`, tabela `fis_solicitacoes_nf`. Fluxo Logística → Fiscal.

#### `031_cache_consultas.sql` — Cache de Consultas
**Cria:** Tabela `cache_consultas` para cache de CNPJ/CEP. TTL: 7 dias.

---

### Módulos Avançados (032-036)

#### `032_contratos_completo.sql` — Contratos Expandido
**Cria:** Medições, aditivos, reajustes, cronograma contratual.

#### `033_obras_gestao.sql` — Módulo Obras
**Cria:** Apontamentos, RDO, prestação de contas, adiantamentos, equipes.
→ Ver [[32 - Módulo Obras]]

#### `034_controladoria_full.sql` — Controladoria Completa
**Cria:** Orçamentos detalhados, DRE, KPIs, cenários, alertas.
→ Ver [[30 - Módulo Controladoria]]

#### `035_pmo_gestao_projetos.sql` — PMO/EGP
**Cria:** Portfolio, TAP, EAP, Gantt, medições, histograma, fluxo OS, status report, multas, reuniões, mudanças, indicadores.
→ Ver [[31 - Módulo PMO-EGP]]

#### `036_obras_planejamento_equipe.sql` — Planejamento de Equipe
**Cria:** `obr_planejamento_equipe` — alocação de equipes em obras vinculada ao cronograma do EGP.

---

### Fixes e Features Incrementais (037-055)

#### `037_fix_log_atividades_fk.sql` — Fix FK Log
**Corrige:** FK `sys_log_atividades.usuario_id` que referenciava `sys_usuarios` em vez de `auth.uid()`.

#### `039_ctrl_orcamento_linhas_extras.sql` — Orçamento Extras
**Cria:** Colunas `premissa`, `desvio_explicacao`, `plano_acao` em `ctrl_orcamento_linhas`.

#### `040_contratos_v2_fluxo.sql` — Contratos V2 Fluxo
**Cria:** `con_solicitacoes` — Solicitação de Contrato (fluxo 7 etapas).

#### `041_ctrl_indicadores_producao.sql` — Indicadores de Produção
**Cria:** `ctrl_indicadores_producao` — indicadores unitários por obra/mês para painel executivo.

#### `042_apr_tipo_aprovacao.sql` — Tipo de Aprovação
**Cria:** Campo `tipo_aprovacao` em `apr_aprovacoes`: `requisicao_compra`, `cotacao`, `autorizacao_pagamento`, `minuta_contratual`.

#### `043_egp_tap.sql` — EGP TAP
**Cria:** Tabela `egp_tap` — Termo de Abertura de Projeto.

#### `044_lotes_pagamento.sql` — Lotes de Pagamento
**Cria:** Batch Payment Approval com decisões parciais. Tabela principal de lotes.

#### `044_con_modelos_contrato.sql` — Modelos de Contrato
**Cria:** `con_modelos_contrato` — templates de contrato (receita/despesa).

#### `045_con_assinaturas.sql` — Assinaturas Digitais
**Cria:** `con_assinaturas` — tracking de assinatura digital Certisign.

#### `046_cp_pipeline_statuses.sql` — CP Pipeline
**Cria:** Status unificados de CP: `confirmado`, `em_lote`, `em_pagamento`. Migra status antigos.

#### `047_cr_pipeline_upgrade.sql` — CR Pipeline
**Cria:** Pipeline CR: previsto → autorizado → faturamento → nf_emitida → aguardando → recebido → conciliado.

#### `048_logistica_gera_cp.sql` — Logística Gera CP
**Cria:** Trigger automático de geração de CP a partir de transportes aprovados.

#### `049_tesouraria_foundation.sql` — Tesouraria
**Cria:** Tabelas de Tesouraria, dashboard RPC, recomputação de saldos, bucket para importação de extratos.

#### `049_estoque_controle_flags.sql` — Estoque Flags
**Cria:** Flags de controle estoque/patrimônio em `est_itens`, `justificativa_destino` em recebimentos.

#### `050_cp_remessas_omie.sql` — Remessas CP/Omie
**Cria:** Metadados de remessa em `fin_contas_pagar`, RPCs para envio via IME/Omie.

#### `052_fix_recebimento_fluxo.sql` — Fix Recebimento
**Corrige:** FK constraint em `cmp_recebimentos.recebido_por`.

#### `053_categorias_compras_fev2026.sql` — Atualização Categorias
**Atualiza:** Categorias de compras (inativa categorias obsoletas, inclui locação).

#### `053_fix_recebimento_item_sem_estoque.sql` — Fix Item sem Estoque
**Corrige:** Permite recebimento de itens consumo sem vínculo com `item_estoque_id`.

#### `054_cp_parcelas_pedido.sql` — CP Parcelas
**Corrige:** Geração de CP na emissão de pedido respeita `parcelas_preview` (múltiplos títulos).

#### `055_recebimento_aguardando_entrada.sql` — Aguardando Entrada
**Cria:** Status `aguardando_entrada` em `cmp_recebimento_itens`. Trigger só processa quando `confirmado`.

---

### Runners e Referência

#### `EXECUTAR_NO_SUPABASE.sql`
Runner completo que aplica todas as migrations em ordem.

#### `EXECUTAR_MODULOS_FASE2.sql`
Runner para módulos da fase 2 (RH, HHt, SSMA, Contratos, Controladoria).

#### `EXECUTAR_MODULOS_NOVOS.sql`
Runner para módulos novos (Obras, PMO, Fiscal).

#### `SCHEMA_v2.sql` — Rebuild Completo (Referência)

**Convenção de prefixos:**
```
sys_    → Sistema (obras, usuarios, configuracoes, perfis, logs)
cmp_    → Compras (requisicoes, itens, categorias, compradores, pedidos)
apr_    → Aprovações (aprovacoes, alcadas)
cot_    → Cotações
fin_    → Financeiro (contas_pagar, contas_receber, bancos)
fis_    → Fiscal (solicitacoes_nf)
rh_     → RH (colaboradores, funcoes, departamentos)
hht_    → HHt (atividades, lancamentos, aprovacoes)
ssm_    → SSMA (epis, treinamentos)
est_    → Estoque (itens, movimentacoes, inventario)
log_    → Logística (solicitacoes, transportes, etapas)
fro_    → Frotas (veiculos, ordens_servico, checklists)
con_    → Contratos (contratos, parcelas, medicoes, modelos)
ctrl_   → Controladoria (orcamentos, dre, kpis, cenarios)
pmo_    → PMO/EGP (projetos, tarefas, histograma)
obr_    → Obras (apontamentos, rdo, adiantamentos)
```

> **Nota:** SCHEMA_v2 é o target architecture. As migrations anteriores são o estado atual da produção.

---

## Como Aplicar Migrations

```bash
# Via Supabase CLI
supabase db push

# Ou diretamente no Supabase Studio
# SQL Editor → colar e executar em ordem
```

**Ordem obrigatória:** 001 → 002 → ... → 055 (seguir numeração sequencial, respeitando dependências)

> **Atenção:** Algumas numerações têm múltiplos arquivos (ex: 019a/b/c/d, 029a/b, 044a/b, 049a/b, 053a/b). Aplicar todos.

---

## Links Relacionados

- [[06 - Supabase]] — Configuração Supabase
- [[07 - Schema Database]] — Tabelas detalhadas
- [[09 - Auth Sistema]] — RBAC e autenticação (006, 025_rls)
- [[13 - Alçadas]] — Dados de alçadas (001, 007)
- [[14 - Compradores e Categorias]] — Dados reais (007)
- [[19 - Integração Omie]] — Integração Omie (013, 050)
- [[21 - Fluxo Pagamento]] — Fluxo pagamento (014, 044, 046)
- [[22 - Módulo Estoque e Patrimonial]] — Estoque (015)
- [[23 - Módulo Logística e Transportes]] — Logística (016, 048)
- [[24 - Módulo Frotas e Manutenção]] — Frotas (017)
- [[25 - Mural de Recados]] — Mural (018)
- [[27 - Módulo Contratos Gestão]] — Contratos (022, 024, 032, 040, 044, 045)
- [[28 - Módulo Cadastros AI]] — Cadastros (025)
- [[30 - Módulo Controladoria]] — Controladoria (023, 034, 039, 041)
- [[31 - Módulo PMO-EGP]] — PMO (035, 043)
- [[32 - Módulo Obras]] — Obras (033, 036)
