# Auditoria de RPCs — TEG+ ERP

> Gerado em 2026-07-08. Fonte de verdade: **banco de produção** `TEG+`
> (`uzfjfucrinokeuwpbeie`) via Supabase MCP. Homologação: `teg-plus-homolog`
> (`vxxjfxhbsklwcbhfkbes`).
>
> **Nada foi aplicado.** Este documento é diagnóstico; as mudanças propostas estão em
> migrações separadas (não aplicadas) em `supabase/migrations/` — ver seção "Migrações geradas".

## Sumário executivo

| Métrica | Valor |
|---|---|
| Funções chamáveis (RPC) no schema `public` | **165** |
| Funções de trigger no schema `public` | **75** |
| RPCs chamadas pelo frontend | ~75 (≈90 call-sites) |
| RPCs chamadas por Edge Functions | 2 |
| RPCs chamadas por pg_cron | 4 (6 jobs) |
| RPCs sem chamador identificado neste repositório | **46** (com ressalvas — ver abaixo) |
| Avisos de performance (Supabase advisors) | **1.175** |
| Funções de trigger `updated_at` idênticas e consolidáveis | ~18 → 1 |
| FKs sem índice de cobertura | 221 |
| Índices duplicados (public) | 11 pares |

### Ressalva metodológica crítica
O parâmetro `track_functions` está **desativado** em produção, logo
`pg_stat_user_functions.calls` é sempre NULL — **não há contagem de execução
server-side**. "Uso" foi inferido pelos chamadores estáticos. Além disso:
- **n8n workflows não estão neste repositório** (rodam na instância n8n / EasyPanel; só há
  1 JSON de exemplo em `n8n-workflows/`). Não foi possível verificar chamadas via n8n
  estaticamente.
- **O portal do colaborador (portalteg PWA) é uma aplicação externa** — não há cliente
  neste repositório. As RPCs `portalteg_*`, `sig_*`, `rh_ponto_sync_*`, `rh_admissao_*`
  são muito provavelmente consumidas por ela e/ou por n8n.
- Integração **mobi7** (telemetria de frota) também é externa.

Portanto a lista "sem chamador identificado" **não deve ser lida como "obsoleta"** — é uma
lista de candidatas a revisão manual (decisão do cliente: listar, não remover).

---

## Fase A — Inventário canônico

As 165 RPCs (nome, assinatura, retorno, SECURITY DEFINER, linguagem, search_path, grants)
foram extraídas de `pg_proc`. Destaques estruturais:

- **~130 são `SECURITY DEFINER`** — executam com privilégios do dono, contornando RLS.
  Exigem `search_path` fixo (a maioria tem `search_path=public`).
- **4 funções sem `search_path` fixado** (lint de segurança, baixo risco pois não são
  SECURITY DEFINER): `est_limpar_marca_descricao`, `loc_cidade_sigla`, `loc_norm_txt`,
  `loc_rua_abrev`.

### ⚠️ Segurança: SECURITY DEFINER exposto a `anon` (não-portal)
Funções `SECURITY DEFINER` executáveis por usuários **não autenticados** que **não** fazem
parte do portal público. Revisar se a exposição é intencional:

| Função | Tipo | Observação |
|---|---|---|
| `con_contrato_egp_resumo(uuid)` | leitura | dados de contrato expostos a anon |
| `con_recebiveis_egp()` | leitura | recebíveis/financeiro expostos a anon |
| `fin_folha_projecao()` | leitura | projeção de folha exposta a anon |
| `con_equipe_pj_recalcular()` | **escrita** | mutação executável por anon |
| `fn_vincular_item_rc_manual(uuid,uuid)` | **escrita** | mutação executável por anon |
| `rh_admissao_excluir(uuid)` | **escrita** | exclusão executável por anon |
| `rh_admissao_finalizar_registro(...)`, `rh_mob_enviar_apresentacao(...)`, `rh_folha_total(date)`, `rh_colaborador_missoes(uuid)`, `rh_missao_enviar(...)` | leitura/escrita | avaliar se pertencem ao fluxo do portal |

> As demais (`sig_*`, `check_rate_limit`, `qsma_proximo_codigo`, `sgi_proximo_codigo_documento`,
> `rh_admissao_assinatura_docs`, `rh_portalteg_pin_resetar`, `rh_ponto_recalc_*`) são
> plausivelmente parte do portal/assinatura/n8n — confirmar antes de qualquer REVOKE.

---

## Fase B — Matriz de uso

### Chamadores confirmados
- **Frontend** (`frontend/src/hooks/*`, `pages/*`, `contexts/AuthContext.tsx`): ~75 RPCs.
- **Edge Functions** (`supabase/functions/`): `check_rate_limit`, `get_secret`.
- **pg_cron** (6 jobs): `portalteg_lembrete_ponto`, `portalteg_push_seg_exc`,
  `ti_escalar_sla`, `ti_sla_escalation_sweep`.
- **RLS policies** (referência em `pg_policy`): confirmado para `can_manage_pre_cadastros`,
  `can_see_base`, `con_equipe_pj_pode_ver` (⇒ **não são obsoletas**).

### RPCs sem chamador identificado (46) — candidatas a revisão
Classificadas por probabilidade de uso externo (n8n/portal/mobi7):

**Grupo 1 — quase certamente usadas por Portal/n8n externos (NÃO remover sem checar):**
`portalteg_banners`, `portalteg_doc_checar`, `portalteg_doc_concluir`,
`portalteg_documento_ativo`, `portalteg_documentos_lista`, `portalteg_holerites_listar`,
`portalteg_login`, `portalteg_login_pin`, `portalteg_missao_concluir`,
`portalteg_missao_form_responder`, `portalteg_missoes_listar`, `portalteg_pin_definir`,
`portalteg_pin_remover`, `portalteg_pin_trocar`, `portalteg_push_subscribe`,
`portalteg_push_unsubscribe`, `portalteg_registrar_acesso`, `portalteg_registrar_download`,
`sig_prova_pin`, `sig_registrar_assinatura`, `rh_ponto_sync_afastamentos`,
`rh_ponto_sync_batidas`, `rh_ponto_sync_calcular`, `rh_ponto_sync_equipamentos`,
`rh_ponto_sync_funcionarios`, `rh_ponto_recalc_drenar`, `rh_ponto_recalc_semear`,
`rh_admissao_criar_via_email`, `rh_admissao_lookup_email`, `rh_admissao_parecer_salvar`,
`rh_admissao_finalizar_registro`, `rh_mob_enviar_apresentacao`,
`rh_matriz_regra_para_candidato`, `ti_ingest_canal`.

**Grupo 2 — helpers/utilitárias possivelmente inline em SQL ou legadas:**
`apr_determinar_alcada` (parece substituída pela versão em `apr_alcadas`/tabela),
`cmp_gerar_numero_requisicao` (duplicata de numeração — ver Fase C), `fn_fmt_brl`,
`fn_sync_hodometro_bulk`, `get_omie_config` (usada por Edge/n8n de integração Omie?),
`match_personal_archives` (RAG/embeddings — provável uso por agente AI externo),
`auth_at_least` (duplicata de `role_at_least` — ver Fase C).

**Grupo 3 — de fato candidatas fortes a obsoletas (verificar em n8n e remover se confirmado):**
`desp_atualizar_status_apos_pagamento`, `desp_marcar_aviso_prestacao`,
`rpc_classificar_cp_lote`, `rpc_marcar_cp_remessa_batch` (par de `rpc_processar_retorno_cp_remessa`
que É usado — verificar se a "marcar" também deveria ser), `ti_vincular_solicitante`.

### RPC quebrada
- **`get_feature_flag`** é chamada em `frontend/src/contexts/AuthContext.tsx:316` mas **não
  existe em produção**. A chamada falha silenciosamente (try/catch). Corrigir: criar a
  função (a definição existe em `068_rbac_v2_papeis_setores.sql`) **ou** remover a chamada.

---

## Fase C — Redundâncias e regras de negócio duplicadas

### C1. Triggers `updated_at` idênticos (consolidar ~18 → 1)
Corpo normalizado **byte-idêntico** `BEGIN NEW.updated_at = now(); RETURN NEW; END;`:

| Função | Nº de triggers usando |
|---|---|
| `fn_set_updated_at` | **28** |
| `fn_set_updated_at_fro` / `fn_set_updated_at_log` / `set_updated_at` / `sys_update_updated_at` | 4 cada |
| `cad_set_updated_at` / `con_set_updated_at` / `trigger_set_updated_at` | 3 cada |
| `fin_set_updated_at_cartao` | 2 |
| `fis_sol_nf_updated_at`, `fn_set_updated_at_mural`, `push_subscriptions_updated_at`, `set_sys_pre_cadastros_updated_at`, `trg_sys_roles_updated_at`, `tg_cmp_pedido_impostos_updated_at`, `trg_pre_cadastros_updated`, `orc_before_update` | 1 cada |
| **`update_rag_pa_updated_at`** | **0 (função órfã — nenhum trigger)** |

Proposta: manter **`fn_set_updated_at`** como canônica, re-apontar todos os triggers, e
dropar as demais. ⚠️ **Não** tocar em `orc_before_insert`, `ti_chamados_set_timestamps`,
`fn_con_*`, `atualizar_cp_ao_liberar_pagamento` etc. — têm lógica adicional além do
`updated_at`.

### C2. Helpers de papel/role duplicados
- `auth_role()` **≡** `get_user_role()` — **corpo byte-idêntico**. Consolidar em uma.
- `auth_at_least(text)` **≡** `role_at_least(text)` — lógica idêntica (uma chama `auth_role`,
  a outra `get_user_role`). Consolidar em uma.

### C3. ⚠️ `is_admin()` vs `is_admin_safe()` — NÃO é redundância, é BUG latente
- `is_admin()` checa `role = 'administrador'`
- `is_admin_safe()` checa `role = 'admin'`

São **strings de papel diferentes** — há duas noções conflitantes do papel de admin no
sistema. Isso pode causar falha de autorização (uma policy usa uma, outra usa a outra).
**Ação:** padronizar o valor do papel de admin e unificar as duas funções. Requer decisão
de negócio sobre qual string é a correta (verificar `sys_perfis.role` real).

### C4. Numeração duplicada
- `cmp_gerar_numero_requisicao()` (sem chamador) vs `cmp_proximo_numero_rc()` (usada pelo
  frontend). Provável legado — confirmar e dropar a não usada.
- `apr_determinar_alcada(numeric)` — verificar se a lógica de alçada migrou para a tabela
  `apr_alcadas`.

### C5. Dashboards/views duplicados
- `get_dashboard_contratos` vs `get_dashboard_contratos_gestao` (só a `_gestao` é chamada).
- Views definidas 2× nas migrações: `vw_ctrl_dre_consolidado`, `vw_ctrl_custo_por_obra`,
  `tel_ultima_posicao`.

---

## Fase D — Performance

### Advisors (produção) — 1.175 avisos
| Aviso | Qtd | Impacto |
|---|---|---|
| `multiple_permissive_policies` | 371 | Todas as policies permissivas são avaliadas a cada query |
| `unused_index` | 337 (169 tabelas) | Custo de escrita/armazenamento sem benefício de leitura |
| `auth_rls_initplan` | 244 (205 tabelas) | `auth.<fn>()` reavaliada por linha em vez de 1×/query |
| `unindexed_foreign_keys` | 221 | JOINs e checagens de FK sem índice → seq scans |
| `duplicate_index` | 1 (catálogo mostra 11 pares no public) | Índices redundantes |
| `auth_db_connections_absolute` | 1 | Auth limitado a 10 conexões fixas |

### EXPLAIN das RPCs de leitura pesadas
Com os volumes atuais (base ainda pequena), nenhuma RPC de dashboard é gargalo hoje
(`get_dashboard_compras('mes')` ≈ **7,5 ms**, 1.749 buffers; demais executam sem erro). O
risco é **estrutural e escala com o volume** — os 244 `auth_rls_initplan` e 221 FKs sem
índice degradarão linearmente conforme as tabelas crescem. Portanto as otimizações de RLS
e índices são preventivas e de alto retorno.

### Recomendações de performance (priorizadas)
1. **Índices em FKs** (221) — maior retorno, baixo risco. DDL pronta em migração.
2. **RLS init-plan** (244) — trocar `auth.uid()`/`auth.role()` por
   `(select auth.uid())`/`(select auth.role())`. Requer regeneração das policies.
3. **Índices duplicados** (11) — dropar o redundante de cada par (manter o `_key` da
   constraint única). DDL pronta.
4. **Índices não usados** (337) — revisar caso a caso; muitos podem ser recém-criados e
   ainda sem estatística. **Não** dropar em massa sem observação. Listar para revisão.
5. **multiple_permissive_policies** (371) — consolidar policies por tabela/ação; trabalho
   maior, tratar por módulo.

---

## Higiene do repositório (fora de RPCs, mas encontrado)
- **Arquivos temporários vazados** commitados na raiz de `teg-plus/`:
  `C:UserseltonAppDataLocalTempissue30_*.tsx/.ts` (6 arquivos) e
  `teg-plus/CUserseltonAppDataLocalTempissue30_useCotacoes.ts`.
- **`tmp_credenciais_FINAIS_sem_sufixo_20260330_1208.csv`** — arquivo de credenciais
  commitado. **Remover e rotacionar as credenciais** se forem reais.
- `tmp_obsoletos_usuarios_20260330/`, `worktrees/` (≈20 cópias de branches),
  `Outros_branches/` — worktrees/branches commitados no repositório → bloat e ruído de
  busca. Mover para fora do versionamento.
- **Duas pastas de migração concorrentes** (`supabase/*.sql` legado + `supabase/migrations/*.sql`)
  reutilizando números + `SCHEMA_v2.sql` / `EXECUTAR_*.sql` / `patch_rpc_tudo.py` embutindo
  cópias de funções → ambiguidade de fonte-de-verdade. Recomenda-se declarar `supabase/migrations/`
  como canônica e arquivar o resto.

---

## Migrações geradas (NÃO aplicadas)

Em `supabase/migrations/` (convenção `YYYYMMDDHHMMSS_slug.sql`), reversíveis, com rollback
inline. Aplicar **primeiro em homologação** e rodar os advisors de novo antes de produção.

| Arquivo | Conteúdo | Risco |
|---|---|---|
| `20260708100001_perf_fk_indexes.sql` | 221 `CREATE INDEX CONCURRENTLY` para FKs | Baixo |
| `20260708100002_perf_drop_duplicate_indexes.sql` | Dropa 11 índices redundantes (public) | Baixo |
| `20260708100003_consolida_updated_at_triggers.sql` | Re-aponta triggers para `fn_set_updated_at` e dropa as duplicatas | Médio |
| `20260708100004_consolida_role_helpers.sql` | Unifica `auth_role`/`get_user_role` e `auth_at_least`/`role_at_least` | Médio |
| `20260708100005_fix_get_feature_flag.sql` | (Re)cria `get_feature_flag` ausente | Baixo |
| `20260708100006_review_anon_grants.sql` | **REVOKE** de anon nas SECURITY DEFINER suspeitas — **comentado**, revisar antes | Alto (revisar) |

> As RPCs "sem chamador" (Fase B) **não** têm migração de DROP — ficam listadas para
> decisão manual, conforme combinado.

## Como validar (homologação)
1. Aplicar as migrações em `teg-plus-homolog` (`vxxjfxhbsklwcbhfkbes`).
2. Rodar `get_advisors(performance)` novamente e conferir queda em
   `unindexed_foreign_keys` e `duplicate_index`.
3. Smoke test das telas que usam os triggers `updated_at` re-apontados (qualquer UPDATE
   deve continuar atualizando `updated_at`).
4. Testar login/permissões após consolidar os helpers de role.
5. Só então planejar a aplicação em produção.
