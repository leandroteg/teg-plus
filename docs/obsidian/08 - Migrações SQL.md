---
title: Migrações SQL
type: banco-de-dados
status: ativo
tags: [supabase, migrations, sql, schema]
criado: 2026-03-02
relacionado: ["[[06 - Supabase]]", "[[07 - Schema Database]]"]
---

# Migrações SQL — TEG+ ERP

## Localização
```
supabase/migrations/
├── 001_schema_compras.sql
├── 002_seed_usuarios.sql
├── 003_rpc_dashboard.sql
├── 004_schema_cotacoes.sql
├── 005_public_read_policy.sql
├── 006_auth_sistema.sql
├── 006b_auth_fix_perfil.sql
├── 007_fluxo_real.sql
├── 008_fixes_escalabilidade.sql
├── 009_admin_rls_fix.sql
├── 010_dashboard_fix.sql
└── SCHEMA_v2.sql           ← Rebuild completo (referência)
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

**Ordem obrigatória:** 001 → 002 → 003 → 004 → 005 → 006 → 006b → 007 → 008 → 009 → 010

---

## Links Relacionados

- [[06 - Supabase]] — Configuração Supabase
- [[07 - Schema Database]] — Tabelas detalhadas
- [[13 - Alçadas]] — Dados de alçadas (migration 001 e 007)
- [[14 - Compradores e Categorias]] — Dados reais (migration 007)
