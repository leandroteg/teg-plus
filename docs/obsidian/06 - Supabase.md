---
title: Supabase — Banco de Dados e Auth
type: infraestrutura
status: ativo
tags: [supabase, postgresql, auth, realtime, rls]
criado: 2026-03-02
relacionado: ["[[01 - Arquitetura Geral]]", "[[07 - Schema Database]]", "[[08 - Migrações SQL]]", "[[09 - Auth Sistema]]"]
---

# Supabase — TEG+ ERP

## Visão Geral

O Supabase é o **backend principal** do TEG+, fornecendo:
- **PostgreSQL 15** — banco relacional com RPC e views
- **Auth** — autenticação com magic link + email/senha
- **Realtime** — push de atualizações via WebSocket
- **Row Level Security** — controle de acesso por linha
- **Storage** — (não usado ainda)

---

## Configuração

```ts
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Veja [[16 - Variáveis de Ambiente]] para configuração das chaves.

---

## Acesso por Camada

| Camada | Chave | Permissões |
|--------|-------|-----------|
| Frontend (browser) | `anon key` | Acesso restrito por RLS |
| n8n (server-side) | `service_role key` | Bypass completo do RLS |
| Supabase Studio | Admin | Acesso total |

---

## Row Level Security (RLS)

**Princípio:** todo acesso ao banco é filtrado por RLS.

### Políticas principais:
```sql
-- Usuários veem apenas suas próprias requisições (ou todas se for admin)
CREATE POLICY "requisicoes_read" ON requisicoes
  FOR SELECT USING (
    solicitante_id = auth.uid()
    OR EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

-- Aprovadores veem suas aprovações pendentes
CREATE POLICY "aprovacoes_read" ON aprovacoes
  FOR SELECT USING (aprovador_id = auth.uid());

-- Leitura pública para aprovação por token (sem auth)
CREATE POLICY "aprovacao_publica" ON aprovacoes
  FOR SELECT USING (token IS NOT NULL);
```

> n8n usa `service_role` → bypass total do RLS

---

## Realtime Subscriptions

O frontend se inscreve em mudanças das tabelas principais:

```ts
// Atualização automática do dashboard
supabase
  .channel('dashboard')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'requisicoes' },
    () => queryClient.invalidateQueries(['dashboard'])
  )
  .on('postgres_changes', { event: '*', schema: 'public', table: 'aprovacoes' },
    () => queryClient.invalidateQueries(['aprovacoes'])
  )
  .subscribe()
```

---

## Funções e Views

### RPCs (Remote Procedure Calls)

| Função | Parâmetros | Retorno |
|--------|-----------|---------|
| `get_dashboard_compras` | `p_periodo, p_obra_id` | JSON agregado com KPIs |
| `gerar_numero_requisicao` | — | `string` (RC-YYYYMM-XXXX) |
| `determinar_alcada` | `valor numeric` | `integer` (1-4) |

### Views

| View | Descrição |
|------|-----------|
| `vw_dashboard_requisicoes` | Requisições com dados relacionados |
| `vw_requisicoes_completas` | Join completo: req + itens + aprovações |
| `vw_kpis_compras` | KPIs agregados |
| `vw_requisicoes_por_obra` | Agrupamento por obra |

---

## Estrutura de Tabelas

Ver detalhes completos em [[07 - Schema Database]].

### Prefixos por módulo (schema v2):
- `sys_*` → Sistema (obras, usuários, perfis, logs)
- `cmp_*` → Compras (requisições, itens, categorias, compradores, pedidos)
- `apr_*` → Aprovações (aprovações, alçadas)
- `cot_*` → Cotações (reservado)

---

## Migrações

Ver histórico completo em [[08 - Migrações SQL]].

```
001 → Schema base
002 → Seed usuários
003 → RPC dashboard
004 → Schema cotações
005 → Políticas públicas
006 → Auth integração
006b → Fix perfil
007 → Fluxo real
008 → Escalabilidade
009 → Fix RLS admin
010 → Fix dashboard
```

---

## Obras Cadastradas

| Código | Nome | Município |
|--------|------|-----------|
| SE-FRU | SE Frutal | Frutal - MG |
| SE-PAR | SE Paracatu | Paracatu - MG |
| SE-PER | SE Perdizes | Perdizes - MG |
| SE-TM | SE Três Marias | Três Marias - MG |
| SE-RP | SE Rio Paranaíba | Rio Paranaíba - MG |
| SE-ITU | SE Ituiutaba | Ituiutaba - MG |

---

## Links Relacionados

- [[07 - Schema Database]] — Tabelas e colunas detalhadas
- [[08 - Migrações SQL]] — Histórico de migrations
- [[09 - Auth Sistema]] — Autenticação Supabase
- [[13 - Alçadas]] — Regras de alçada no banco
- [[14 - Compradores e Categorias]] — Tabelas de negócio
- [[16 - Variáveis de Ambiente]] — Chaves de acesso
