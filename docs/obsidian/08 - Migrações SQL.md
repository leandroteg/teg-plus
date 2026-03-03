---
title: Migrações SQL
type: banco-de-dados
status: ativo
tags: [supabase, migrations, sql, schema]
criado: 2026-03-02
atualizado: 2026-03-03
relacionado: ["[[06 - Supabase]]", "[[07 - Schema Database]]", "[[19 - Integração Omie]]", "[[21 - Fluxo Pagamento]]"]
---

# Migrações SQL — TEG+ ERP

## Localização
```
supabase/
├── 001_schema_compras.sql       → Compras: schema base, enums, views, RLS
├── 002_seed_usuarios.sql        → Seed usuários iniciais
├── 003_rpc_dashboard.sql        → RPC get_dashboard_compras()
├── 004_schema_cotacoes.sql      → Cotações: tabelas e regras
├── 005_public_read_policy.sql   → Policies de leitura pública (aprovação por token)
├── 006_auth_sistema.sql         → Integração Supabase Auth ↔ perfis
├── 006b_auth_fix_perfil.sql     → Fix trigger auto-provisionamento
├── 007_fluxo_real.sql           → Dados reais: 12 categorias, 3 compradores, 6 obras
├── 008_fixes_escalabilidade.sql → Índices de performance
├── 009_admin_rls_fix.sql        → Fix RLS para role admin
├── 010_dashboard_fix.sql        → Otimização RPC e views dashboard
├── 011_schema_financeiro.sql    → Financeiro: fin_contas_pagar, fin_contas_receber
├── 012_fix_rls_perfis.sql       → Fix loop recursivo RLS em perfis
├── 013_omie_integracao.sql      → sys_config, fin_sync_log, get_omie_config()
├── 014_fluxo_pagamento.sql      → Ciclo Compras→Financeiro, triggers, anexos
├── 015_estoque_patrimonial.sql  → Estoque: almoxarifado, inventário, imobilizados
├── 016_logistica_transportes.sql→ Logística: transportes, NF-e, 9 etapas
├── 017_frotas_manutencao.sql    → Frotas: veículos, OS, checklists, telemetria
├── 018_mural_recados.sql        → Mural: banners, RLS, seed 3 slides [novo]
├── EXECUTAR_NO_SUPABASE.sql     → Runner completo (aplica todas as migrations)
└── SCHEMA_v2.sql                → Rebuild completo de referência
```

---

## Histórico de Migrações

### `001_schema_compras.sql` — Schema Base
**Cria:** Estrutura inicial do módulo de compras.

Inclui:
- Enums: `status_requisicao`, `status_aprovacao`, `urgencia_tipo`
- Tabelas: `obras`, `usuarios`, `alcadas`, `requisicoes`, `requisicao_itens`, `aprovacoes`, `atividades_log`, `configuracoes`
- Funções: `gerar_numero_requisicao()`, `determinar_alcada()`, `update_updated_at()`
- Views: `vw_dashboard_requisicoes`, `vw_requisicoes_completas`, `vw_kpis_compras`, `vw_requisicoes_por_obra`
- Triggers: `updated_at` automático
- RLS: Habilitado em todas as tabelas
- Realtime: Publication nas tabelas principais

---

### `002_seed_usuarios.sql` — Dados Iniciais
**Cria:** Usuários de teste/produção iniciais.

**Aprovadores inseridos:**
| Usuário | Cargo | Nível Alçada |
|---------|-------|-------------|
| Coordenador (seed) | Coordenador | 1 |
| Gerente (seed) | Gerente | 2 |
| Diretor (seed) | Diretor | 3 |
| CEO (seed) | CEO | 4 |

**Requisitantes inseridos:**
| Usuário | Cargo |
|---------|-------|
| João Silva | Técnico de Campo |
| Maria Santos | Engenheira Civil |
| Carlos Lima | Supervisor |

---

### `003_rpc_dashboard.sql` — RPC Dashboard
**Cria:** Função `get_dashboard_compras(p_periodo, p_obra_id)`.

Retorna JSON com:
```json
{
  "kpis": { "total": 0, "pendentes": 0, "aprovadas": 0, "valor_total": 0 },
  "por_status": [{ "status": "pendente", "count": 0 }],
  "por_obra": [{ "obra": "SE Frutal", "count": 0, "valor": 0 }],
  "recentes": []
}
```

---

### `004_schema_cotacoes.sql` — Cotações
**Cria:** Tabelas para o fluxo de cotações.

Tabelas:
- `cotacoes` — cabeçalho da cotação
- `cotacao_fornecedores` — fornecedores consultados
- `cotacao_itens` — itens com preços por fornecedor

---

### `005_public_read_policy.sql` — Políticas Públicas
**Cria:** Políticas de leitura anônima.

Permite acesso público (sem auth) para:
- Aprovação via token: `SELECT * FROM aprovacoes WHERE token = $1`
- Leitura de requisição para aprovação externa

---

### `006_auth_sistema.sql` — Integração Auth
**Cria:** Integração com Supabase Auth.

- Trigger `on_auth_user_created` → cria perfil automático
- Sincronização `auth.users` ↔ `sys_perfis`

---

### `006b_auth_fix_perfil.sql` — Fix Perfil
**Corrige:** Problemas na criação automática de perfil.

- Fix no trigger de auto-provisionamento
- Tratamento de emails duplicados
- Campo `ultimo_acesso` atualizado no login

---

### `007_fluxo_real.sql` — Fluxo Real de Negócio
**Maior migration** — traz dados reais de produção.

**Adiciona:**
- 12 categorias reais com compradores atribuídos
- 3 compradores reais (Lauany, Fernando, Aline)
- Expansão dos status de requisição (fases 5-7: cotação, pedido, entrega)
- Regras de alçada por categoria
- Tabela `cmp_pedidos`

Ver detalhes em [[14 - Compradores e Categorias]].

---

### `008_fixes_escalabilidade.sql` — Otimizações
**Corrige:** Performance para escala.

- Índices nas colunas de filtro frequente (`status`, `obra_id`, `solicitante_id`)
- Índice no `token` da tabela de aprovações
- Vacuum e analyze hints
- Particionamento futuro preparado

---

### `009_admin_rls_fix.sql` — Fix RLS Admin
**Corrige:** Políticas de RLS para role admin.

- Admin pode ver todas as requisições (sem filtro de `solicitante_id`)
- Admin pode editar usuários
- Admin bypassa restrições de módulo

---

### `010_dashboard_fix.sql` — Fix Dashboard
**Corrige:** Views e RPC do dashboard.

- Otimização da `vw_kpis_compras`
- Fix de performance na `get_dashboard_compras`
- Adição de timeout handling

---

### `011_schema_financeiro.sql` — Módulo Financeiro
**Cria:** Schema completo do módulo financeiro.

- Tabelas: `fin_contas_pagar`, `fin_contas_receber`, `fin_centros_custo`, `fin_bancos`
- Enums: `status_cp`, `status_cr`, `tipo_lancamento`
- RLS por role: financeiro e admin
- Views: `vw_cp_vencimentos`, `vw_cr_recebimentos`, `vw_dre_simplificado`

---

### `012_fix_rls_perfis.sql` — Fix RLS Perfis
**Corrige:** Loop infinito de RLS na tabela `sys_perfis`.

- Função `is_admin()` com `SECURITY DEFINER` para evitar recursão
- Políticas RLS reescritas usando a função helper
- Fix para `SELECT` do próprio perfil sem recursão

---

### `013_omie_integracao.sql` — Integração Omie ERP
**Cria:** Infraestrutura de integração com Omie.

- Tabela `sys_config` — armazenamento de credenciais e configurações
- Tabela `fin_sync_log` — histórico de sincronizações por domínio
- Função `get_omie_config()` com `SECURITY DEFINER` — retorna credenciais sem expor via RLS
- RLS: apenas admin escreve em `sys_config`; autenticados leem via função
- Seed de chaves iniciais (`omie_app_key`, `omie_app_secret`, `omie_habilitado`, `n8n_base_url`)

---

### `014_fluxo_pagamento.sql` — Fluxo Completo de Pagamento
**Cria:** Tudo relacionado ao ciclo Compras → Financeiro.

**Novas colunas em `cmp_pedidos`:**
- `status_pagamento` — null / `liberado` / `pago`
- `liberado_pagamento_em`, `liberado_pagamento_por`
- `pago_em`, `nf_numero`

**Nova tabela `cmp_pedidos_anexos`:**
- Upload de NF, comprovantes, medições, contratos
- Campo `origem` (`compras` / `financeiro`)
- RLS: usuários autenticados leem; donos e financeiro escrevem

**Storage bucket `pedidos-anexos`:**
- Acesso autenticado; max 50 MB

**Triggers:**
- `trig_criar_cp_ao_emitir_pedido` — cria CP em `fin_contas_pagar` ao inserir PO
- `trig_atualizar_cp_ao_liberar` — propaga mudanças de `status_pagamento` → `fin_contas_pagar`

---

### `015_estoque_patrimonial.sql` — Módulo Estoque e Patrimonial
**Cria:** Schema completo de estoque e gestão de ativos.

- Tabelas: `est_itens`, `est_movimentacoes`, `est_inventario`, `est_imobilizados`, `est_depreciacoes`
- Controle de entrada/saída por almoxarifado, inventário periódico
- Depreciação linear de imobilizados com cálculo automático
- Ver [[22 - Módulo Estoque e Patrimonial]]

---

### `016_logistica_transportes.sql` — Módulo Logística
**Cria:** Schema de transportes e movimentação de materiais.

- Tabelas: `log_solicitacoes`, `log_transportes`, `log_etapas`, `log_nfe`, `log_transportadoras`
- 9 etapas de rastreamento do transporte
- Integração NF-e, avaliação de transportadoras
- Ver [[23 - Módulo Logística e Transportes]]

---

### `017_frotas_manutencao.sql` — Módulo Frotas
**Cria:** Schema de gestão de frotas e manutenção veicular.

- Tabelas: `fro_veiculos`, `fro_ordens_servico`, `fro_checklists`, `fro_abastecimentos`, `fro_telemetria`
- OS de manutenção preventiva/corretiva, checklist diário de inspeção
- Controle de combustível e KPIs de telemetria
- Ver [[24 - Módulo Frotas e Manutenção]]

---

### `018_mural_recados.sql` — Mural de Recados ⭐ (novo)
**Cria:** Sistema de banners para comunicação corporativa na tela inicial.

- Enum: `mural_tipo` (`fixa` | `campanha`)
- Tabela: `mural_banners` com constraints de integridade para campanhas
- Índices: `ativo`, `tipo`, `ordem`, `(data_inicio, data_fim)`
- Trigger: `updated_at` automático
- RLS:
  - Usuários autenticados: leem apenas banners ativos e vigentes
  - Admin: acesso total (SELECT inclui inativos + fora do período)
- View: `mural_banners_vigentes` — atalho sem considerar RLS
- Seed: 3 banners fixos padrão (boas-vindas, módulos, segurança)
- Ver [[25 - Mural de Recados]]

---

### `SCHEMA_v2.sql` — Rebuild Completo (Referência)
**Propósito:** Schema completamente refatorado com convenções de nomenclatura.

**Convenção de prefixos:**
```
sys_    → Sistema (obras, usuarios, configuracoes, perfis, logs)
cmp_    → Compras (requisicoes, itens, categorias, compradores, pedidos)
apr_    → Aprovações (aprovacoes, alcadas)
cot_    → Cotações avançadas (reservado)
fin_    → Financeiro (reservado)
rh_     → RH (reservado)
ssm_    → SSMA (reservado)
est_    → Estoque (reservado)
cnt_    → Contratos (reservado)
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

**Ordem obrigatória:** 001 → 002 → 003 → 004 → 005 → 006 → 006b → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018

---

## Links Relacionados

- [[06 - Supabase]] — Configuração Supabase
- [[07 - Schema Database]] — Tabelas detalhadas
- [[13 - Alçadas]] — Dados de alçadas (migration 001 e 007)
- [[14 - Compradores e Categorias]] — Dados reais (migration 007)
- [[22 - Módulo Estoque e Patrimonial]] — migration 015
- [[23 - Módulo Logística e Transportes]] — migration 016
- [[24 - Módulo Frotas e Manutenção]] — migration 017
- [[25 - Mural de Recados]] — migration 018
