---
title: Supabase — Banco de Dados e Auth
type: infraestrutura
status: ativo
tags: [supabase, postgresql, auth, realtime, rls, storage]
criado: 2026-03-02
atualizado: 2026-04-07
relacionado: ["[[01 - Arquitetura Geral]]", "[[07 - Schema Database]]", "[[08 - Migracoes SQL]]", "[[09 - Auth Sistema]]"]
---

# Supabase — TEG+ ERP

## Visao Geral

O Supabase e o **backend principal** do TEG+, fornecendo:
- **PostgreSQL 15** — banco relacional com 170+ tabelas, 90+ RPCs, views materializadas
- **Auth** — autenticacao com email/senha + magic link, auto-criacao de perfil
- **Realtime** — push de atualizacoes via WebSocket (subscriptions para live updates)
- **Row Level Security** — controle de acesso por linha em todas as tabelas
- **Storage** — 4 buckets para documentos, banners, uploads e endomarketing
- **RBAC v2** — controle de acesso granular por setor via sys_perfil_setores

### Numeros

| Metrica | Valor |
|---------|-------|
| Tabelas | 170+ |
| Prefixos de tabela | 18 |
| RPCs (functions) | 90+ |
| Migrations | 75 |
| Storage buckets | 4 |

---

## Configuracao

```ts
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

Veja [[16 - Variaveis de Ambiente]] para configuracao das chaves.

---

## Acesso por Camada

| Camada | Chave | Permissoes |
|--------|-------|-----------|
| Frontend (browser) | `anon key` | Acesso restrito por RLS + RBAC v2 |
| n8n (server-side) | `service_role key` | Bypass completo do RLS |
| Supabase Studio | Admin | Acesso total |

---

## Autenticacao

### Metodos suportados
- **Email/senha** — login padrao
- **Magic link** — login sem senha via e-mail
- **Auto-profile creation** — ao criar conta, trigger cria perfil automaticamente em `sys_perfis`

### Fluxo de auth
```
Usuario -> Login (email/senha ou magic link)
  -> Supabase Auth valida
  -> Token JWT gerado
  -> AuthContext carrega perfil + permissoes (RBAC v2)
  -> Redirect para ModuloSelector
```

---

## RBAC v2 — Controle de Acesso por Setor

| Tabela | Descricao |
|--------|-----------|
| `sys_perfil_setores` | Vincula usuario a setor(es) com role especifica |
| `sys_roles` | Define roles disponiveis no sistema |
| `sys_role_permissoes` | Mapeia permissoes granulares por role, modulo e acao |

O RBAC v2 permite que um usuario tenha roles diferentes em setores diferentes (ex: admin em Compras, viewer em Financeiro).

---

## Row Level Security (RLS)

**Principio:** todo acesso ao banco e filtrado por RLS. Todas as 170+ tabelas possuem policies ativas.

### Politicas principais:
```sql
-- Usuarios veem apenas dados do seu setor/role
CREATE POLICY "read_by_sector" ON tabela
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sys_perfil_setores ps
      WHERE ps.user_id = auth.uid()
      AND ps.setor = 'modulo'
    )
    OR EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

-- Aprovadores veem suas aprovacoes pendentes
CREATE POLICY "aprovacoes_read" ON aprovacoes
  FOR SELECT USING (aprovador_id = auth.uid());

-- Leitura publica para aprovacao por token (sem auth)
CREATE POLICY "aprovacao_publica" ON aprovacoes
  FOR SELECT USING (token IS NOT NULL);
```

> n8n usa `service_role` -> bypass total do RLS

---

## Storage Buckets

| Bucket | Uso | Acesso |
|--------|-----|--------|
| `cotacoes-docs` | Documentos de cotacao (PDFs, planilhas) | Autenticado |
| `mural-banners` | Banners do BannerSlideshow (imagens) | Publico (leitura) |
| `temp-uploads` | Uploads temporarios durante formularios | Autenticado |
| `endomarketing` | Materiais de endomarketing e RH | Autenticado |

---

## Realtime Subscriptions

O frontend se inscreve em mudancas das tabelas principais para live updates:

```ts
// Atualizacao automatica via invalidacao de cache
supabase
  .channel('module-updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cmp_requisicoes' },
    () => queryClient.invalidateQueries(['requisicoes'])
  )
  .on('postgres_changes', { event: '*', schema: 'public', table: 'apr_aprovacoes' },
    () => queryClient.invalidateQueries(['aprovacoes'])
  )
  .on('postgres_changes', { event: '*', schema: 'public', table: 'fin_contas_pagar' },
    () => queryClient.invalidateQueries(['contas-pagar'])
  )
  .subscribe()
```

Realtime e usado em: aprovacoes pendentes, dashboard KPIs, pipeline de cotacoes, status de transportes, e notificacoes do AprovAi.

---

## Funcoes RPC (90+)

### Exemplos por modulo:

| Funcao | Modulo | Descricao |
|--------|--------|-----------|
| `get_dashboard_compras` | Compras | KPIs agregados do dashboard |
| `gerar_numero_requisicao` | Compras | Gera RC-YYYYMM-XXXX |
| `determinar_alcada` | Aprovacoes | Retorna alcada 1-4 por valor |
| `get_dashboard_financeiro` | Financeiro | KPIs financeiros |
| `get_dre_consolidado` | Controladoria | DRE por periodo e obra |
| `get_kpis_frotas` | Frotas | Indicadores de frota |
| `get_portfolio_summary` | PMO/EGP | Resumo do portfolio |
| `get_cotacao_recomendacao` | Compras | Motor de recomendacao AI para cotacoes |
| `calcular_depreciacao` | Patrimonio | Calculo de depreciacao mensal |
| `get_saldo_estoque` | Estoque | Saldo por item e almoxarifado |

---

## Prefixos de Tabelas (18)

| Prefixo | Modulo | Exemplos |
|---------|--------|----------|
| `sys_` | Sistema | sys_perfil_setores, sys_roles, sys_role_permissoes, sys_obras, sys_perfis |
| `cmp_` | Compras | cmp_requisicoes, cmp_itens_requisicao, cmp_pedidos, cmp_fornecedores |
| `fin_` | Financeiro | fin_contas_pagar, fin_contas_receber, fin_conciliacao |
| `con_` | Contratos | con_contratos, con_medicoes, con_aditivos, con_parcelas |
| `ctrl_` | Controladoria | ctrl_orcamentos, ctrl_dre, ctrl_kpis, ctrl_cenarios |
| `log_` | Logistica | log_transportes, log_recebimentos, log_expedicao |
| `est_` | Estoque | est_itens, est_movimentacoes, est_inventario |
| `pat_` | Patrimonio | pat_imobilizados, pat_depreciacao |
| `fro_` | Frotas | fro_veiculos, fro_ordens_servico, fro_checklists, fro_abastecimentos |
| `obr_` | Obras | obr_apontamentos, obr_rdo, obr_adiantamentos |
| `pmo_` | PMO/EGP | pmo_portfolios, pmo_eap, pmo_cronograma, pmo_medicoes |
| `rh_` | RH | rh_colaboradores, rh_mural_banners |
| `ssm_` | SSMA | ssm_ocorrencias |
| `fis_` | Fiscal | fis_notas_fiscais, fis_solicitacoes_nf |
| `egp_` | EGP | egp_tap, egp_reunioes, egp_status_reports |
| `loc_` | Locacao | loc_contratos, loc_equipamentos, loc_medicoes |
| `apr_` | Aprovacoes | apr_aprovacoes, apr_alcadas |
| `cot_` | Cotacoes | cot_cotacoes, cot_itens_cotacao, cot_recomendacoes |

Ver detalhes completos em [[07 - Schema Database]].

---

## Migracoes (75)

Ver historico completo em [[08 - Migracoes SQL]].

As 75 migracoes cobrem:
- Schema base e seed de dados iniciais
- RPCs de dashboard e KPIs por modulo
- Politicas RLS para todas as tabelas
- RBAC v2 (sys_perfil_setores, sys_roles, sys_role_permissoes)
- Storage buckets e politicas de acesso
- Triggers para auto-criacao de perfil, numeracao automatica, e cascatas
- Views materializadas para dashboards
- Motor de recomendacao de cotacao

---

## Obras Cadastradas

| Codigo | Nome | Municipio |
|--------|------|-----------|
| SE-FRU | SE Frutal | Frutal - MG |
| SE-PAR | SE Paracatu | Paracatu - MG |
| SE-PER | SE Perdizes | Perdizes - MG |
| SE-TM | SE Tres Marias | Tres Marias - MG |
| SE-RP | SE Rio Paranaiba | Rio Paranaiba - MG |
| SE-ITU | SE Ituiutaba | Ituiutaba - MG |

---

## Links Relacionados

- [[07 - Schema Database]] — Tabelas e colunas detalhadas
- [[08 - Migracoes SQL]] — Historico de migrations
- [[09 - Auth Sistema]] — Autenticacao Supabase
- [[13 - Alcadas]] — Regras de alcada no banco
- [[14 - Compradores e Categorias]] — Tabelas de negocio
- [[16 - Variaveis de Ambiente]] — Chaves de acesso
