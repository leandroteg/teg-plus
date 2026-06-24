# Plano — Módulo SGI (Pilar Governança › módulo "Gestão")

> Data: 2026-06-24 · Objetivo: SGI/QSMS **nativo** no TEG+ p/ superar o SGI360 (RFP CEMIG Lote 05).
> **PRINCÍPIO INEGOCIÁVEL: 100% ADITIVO.** Nenhum `ALTER`/edição em tabela, tela, RPC, função ou trigger **existente**. Tudo novo, prefixo `sgi_`. O que já existe é só **chamado / lido / referenciado por FK / recebe INSERT** — nunca modificado.

## 1. Escopo e mapeamento
Pilar novo **Governança** (accent `violet`), módulo **Gestão** (`moduleKey: sgi`, rotas `/sgi/*`). 5 visões:

| Visão | Função | Matriz / ISO |
|---|---|---|
| Painel | dashboards + pendências | 8.x / 9.1 |
| Novo Registro | entrada única: **Check in Meta · Anomalia/Falha · Documento** | — |
| Objetivos e Metas | Anuais \| Trimestrais \| Checkin Mensal (farol) | ISO 6.2 |
| Melhoria Contínua | PDCA: Pendente→Análise de Causa→Plano de Ação→Execução→Verificação→Encerrado | 6.x + 7.x |
| Padronização | doc control: Rascunho→Revisão→Aprovação→Políticas/Processos→Obsoleto | 1.x / ISO 7.5 |

**Fora deste módulo (à parte):** Auditoria (cat 9) e Segurança/SST (cat 3,4) — virão depois e **reusam** o backbone `sgi_acoes` via `origem_tipo`.

## 2. Banco — migration nova `supabase/migrations/1xx_sgi_module.sql` (só CREATE)
Todas com colunas comuns (`id uuid default gen_random_uuid()`, `created_at/updated_at`, `criado_por_nome/atualizado_por_nome`), `status` como `text + CHECK`, RLS `SELECT USING(true)` + `ALL via can_access_modulo('sgi', auth.uid())`, e **trigger NOVO** em cada tabela `sgi_` chamando a função de auditoria já existente `_tg_stamp_audit_user()` (chamar ≠ modificar).

**Padronização**
- `sgi_documentos` — `codigo` (auto), `titulo`, `tipo` (politica/procedimento/IT/formulario/manual), `area_processo`, `status` (rascunho/em_revisao/em_aprovacao/vigente/obsoleto), `versao` int, `requer_ciencia` bool, `publico_alvo` jsonb (todos/base_id/cargo/colaboradores), `proxima_revisao` date, `arquivo_url`, `responsavel_id`, `obra_id` FK→`sys_obras`.
- `sgi_documento_versoes` — histórico imutável (nunca sobrescreve): `documento_id` FK, `versao`, `arquivo_url`, `alterado_por`, `motivo`.
- `sgi_documento_aprovacoes` — fluxo: `documento_id`, `etapa` (elaboracao/revisao/aprovacao), `responsavel_id`, `decidido_em`, `decisao`, `observacao`.
- **Ciência:** sem tabela própria — usa o motor de **Missões** existente (ver §4).
- **Storage:** bucket novo privado `sgi-documentos`.

**Melhoria Contínua (PDCA)**
- `sgi_registros` — item de melhoria/anomalia: `tipo` (anomalia/falha/desvio/quase_acidente/reclamacao/oportunidade), `origem` (campo/auditoria/cliente/meta/inspecao), `gravidade` (baixa/media/alta/critica), `area_processo`, `obra_id` FK→`sys_obras`, `descricao`, `evidencia_url`, `status_pdca` (pendente/analise_causa/plano_acao/execucao/verificacao/encerrado), `classificacao` (nc/registro/dispensado), `responsavel_id`.
- `sgi_analise_causa` — `registro_id` FK, `metodo` (5porques/ishikawa), `conteudo` jsonb, `causa_raiz`.
- **`sgi_acoes` — backbone único de ações** (reusável por Auditoria/Segurança): `origem_tipo` (registro/meta/achado_auditoria/inspecao), `origem_id`, `titulo`, `descricao`, `responsavel_id`, `prazo`, `sla_horas`, `status` (aberta/em_execucao/concluida/atrasada/cancelada), `escalonado` bool, `concluida_em`.
- `sgi_verificacao` — eficácia: `registro_id`, `eficaz` bool, `evidencia`, `verificado_por`.

**Objetivos e Metas**
- `sgi_objetivos` — `ano`, `titulo`, `area_processo`, `responsavel_id`, `indicador`, `unidade`, `direcao` (maior_melhor/menor_melhor).
- `sgi_metas` — `objetivo_id` FK, `periodo` (anual/trimestral), `trimestre` int?, `alvo` numeric.
- `sgi_metas_checkin` — `meta_id` FK, `competencia` (mês), `realizado` numeric, `farol` (verde/amarelo/vermelho), `observacao`. **Gatilho:** checkin vermelho → cria `sgi_registros` (origem=meta) → vira ação.

**SLA/escalonamento (sem tocar triggers existentes):** função nova `sgi_sla_escalonar()` + agendamento novo (pg_cron OU Edge `sgi-sla-check`) que marca `sgi_acoes` atrasadas e dispara push. Tudo novo.

**RPCs novos (`sgi_*`, SECURITY DEFINER):**
- `sgi_documento_publicar(p_documento_id, p_publico)` → cria **missões** (INSERT em `portalteg_missoes`, categoria `documento_ciencia`) + dispara `send-push`.
- `sgi_documento_adesao(p_documento_id)` → lê `portalteg_missoes` (SELECT) → X/Y deram ciência + pendentes.
- `sgi_registro_promover_nc`, `sgi_acao_criar/concluir`, `sgi_meta_checkin_lancar`, `sgi_proximo_codigo_documento` etc.

## 3. Frontend ERP — tudo novo
- `frontend/src/types/sgi.ts` — unions de status, interfaces, label maps (padrão da casa).
- `frontend/src/hooks/useSgi.ts` — React Query (QK, queries, mutations, RPCs), padrão `useLocacao`.
- `frontend/src/components/SgiLayout.tsx` — `<ModuleLayout moduleKey="sgi" accent="violet" nav=[Painel, Novo Registro, Objetivos e Metas, Melhoria Contínua, Padronização] />`.
- `frontend/src/pages/sgi/` — `SgiPainel.tsx`, `SgiNovoRegistro.tsx`, `SgiObjetivos.tsx`, `SgiMelhoriaContinua.tsx` (kanban PDCA), `SgiPadronizacao.tsx` (doc control). Accents por aba: Painel=violet, Objetivos=emerald, Melhoria=amber, Padronização=indigo, Novo Registro=cyan.

## 4. Reuso (SEM modificar nada existente)
- `can_access_modulo('sgi', auth.uid())` — **chamado** nas policies RLS das tabelas novas.
- FKs → `sys_obras`, `sys_centros_custo`, `rh_colaboradores`, `sys_perfis` — só **referência** (FK na tabela nova; não altera a tabela-alvo).
- `_tg_stamp_audit_user()` — **chamado** por triggers novos nas tabelas `sgi_`.
- **Motor de Missões (ciência):** `sgi_documento_publicar` faz **INSERT** em `portalteg_missoes` (categoria `documento_ciencia`, `metadata={documento_id,versao}`, `acao_url`=ler doc, `prazo`); o colaborador conclui pelo **`portalteg_missao_concluir`** já existente (não mexo nele); adesão = **SELECT** em `portalteg_missoes`. → uso aditivo, **sem ALTER no schema nem nos RPCs de Missões**.
- `send-push` (Edge) — **invocado** p/ alertar colaborador/responsável.
- Storage — **bucket novo** `sgi-documentos`.

## 5. Portal TEG (branch `claude/musing-perlman`) — tela "Missões" NOVA
Tela nova no Portal que consome os RPCs **existentes** `portalteg_missoes_listar` + `portalteg_missao_concluir` (lista + "Li e estou ciente"). É **nova tela** (não toca telas existentes), mas vive na branch do Portal → exige coordenação/merge dessa branch.

## 6. Faseamento
1. **Padronização** + ciência via Missões (a "joia"; ISO 7.5 / matriz 1.x — onde o SGI360 é 5/5).
2. **Melhoria Contínua** (PDCA) + backbone `sgi_acoes`.
3. **Objetivos e Metas** + checkin + farol + gatilho.
4. **Painel** consolidado + **Novo Registro** unificado.

## 7. ⚠️ Acréscimos a arquivos existentes (precisam do seu OK — são SÓ adições, não alteram nada)
Pra o módulo existir/navegar, é inevitável **adicionar** (não alterar) linhas em 3 arquivos + INSERT numa tabela:
1. `App.tsx` — novo bloco de rotas `<ModuleRoute moduleKey="sgi"><SgiLayout>…`.
2. `ModuloSelector.tsx` — novo **pilar Governança** + card "Gestão".
3. `AuthContext.tsx` (`MODULOS_ERP_GROUPED`) — nova entrada `sgi` (p/ atribuir na admin).
4. `portalteg_missoes` — **INSERT** de linhas via RPC novo (você pediu ciência nas Missões).

Nada disso modifica comportamento/registros existentes.
