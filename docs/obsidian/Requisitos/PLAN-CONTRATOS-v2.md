# PLAN-CONTRATOS-v2 — Reestruturação do Módulo de Contratos

> **Versão:** 2.0
> **Data:** 2026-03-09
> **Autor:** Equipe de Arquitetura TEG+
> **Status:** Em Revisão

---

## Sumário Executivo

Este documento detalha o plano de reestruturação completa do módulo de Contratos do TEG+ ERP, expandindo-o de um módulo de gestão financeira de contratos para um sistema completo de **ciclo de vida contratual** — desde a solicitação até o arquivamento, incluindo gestão de equipe PJ, integrações externas (assinatura digital, OneDrive, email) e inteligência artificial para análise de minutas.

---

## 1. ESTADO ATUAL

### 1.1 Tabelas Existentes no Banco (10 tabelas + 1 view)

| Tabela | Descrição | Migration |
|--------|-----------|-----------|
| `con_clientes` | Clientes (CEMIG, etc.) | 024 |
| `con_contratos` | Contratos principais (receita/despesa) | 024 |
| `con_contrato_itens` | Itens detalhados do contrato | 024 |
| `con_parcelas` | Parcelas de pagamento/recebimento | 024 |
| `con_parcela_anexos` | Anexos de parcelas (NF, medição, etc.) | 024 |
| `con_medicoes` | Boletins de medição (BM) | 032 |
| `con_medicao_itens` | Itens medidos por BM | 032 |
| `con_aditivos` | Aditivos contratuais | 032 |
| `con_reajustes` | Histórico de reajustes | 032 |
| `con_cronograma` | Cronograma físico-financeiro | 032 |
| `vw_con_contratos_resumo` | View resumo contratos | 032 |

**Nota:** A migration 022 criou tabelas adicionais (`con_pleitos`, `con_alertas`) com schema diferente. A migration 024 redefiniu `con_contratos` com schema de gestão (tipo receita/despesa, parcelas recorrentes). A migration 032 expandiu com medições, aditivos e reajustes.

### 1.2 Páginas Existentes (7)

| Página | Arquivo | Funcionalidade |
|--------|---------|----------------|
| DashboardContratos | `pages/contratos/DashboardContratos.tsx` | KPIs, parcelas próximas, ações rápidas |
| ListaContratos | `pages/contratos/ListaContratos.tsx` | Lista com filtros, cards expansíveis |
| NovoContrato | `pages/contratos/NovoContrato.tsx` | Formulário completo de criação |
| Parcelas | `pages/contratos/Parcelas.tsx` | Gestão de parcelas, liberação, pagamento |
| Medicoes | `pages/contratos/Medicoes.tsx` | Tabela de medições com aprovação |
| Aditivos | `pages/contratos/Aditivos.tsx` | Tabela de aditivos com aprovação |
| Reajustes | `pages/contratos/Reajustes.tsx` | Histórico de reajustes por índice |

### 1.3 Hook Existente

`useContratos.ts` — 25 funções exportadas cobrindo queries e mutations para contratos, parcelas, medições, aditivos, reajustes e cronograma.

### 1.4 Rotas Existentes

```
/contratos            → DashboardContratos
/contratos/lista      → ListaContratos
/contratos/novo       → NovoContrato
/contratos/parcelas   → Parcelas
/contratos/medicoes   → Medicoes
/contratos/aditivos   → Aditivos
/contratos/reajustes  → Reajustes
```

---

## 2. NOVO SCHEMA DE BANCO DE DADOS

### 2.1 Novas Tabelas

#### 2.1.1 `con_solicitacoes` — Solicitação de Contrato

Primeira etapa do fluxo de assinatura. Concentra todas as informações necessárias para preparar a minuta.

```sql
CREATE TABLE con_solicitacoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT UNIQUE NOT NULL,            -- SOL-CON-2026-001
  -- Solicitante
  solicitante_id        UUID REFERENCES sys_perfis(id),
  solicitante_nome      TEXT NOT NULL,
  departamento          TEXT,
  obra_id               UUID REFERENCES sys_obras(id),
  -- Contraparte
  tipo_contraparte      TEXT NOT NULL CHECK (tipo_contraparte IN ('fornecedor','cliente','pj')),
  contraparte_nome      TEXT NOT NULL,
  contraparte_cnpj      TEXT,
  contraparte_id        UUID,                            -- FK genérica (fornecedor ou cliente)
  -- Objeto
  tipo_contrato         TEXT NOT NULL CHECK (tipo_contrato IN ('receita','despesa','pj')),
  categoria_contrato    TEXT NOT NULL CHECK (categoria_contrato IN (
    'prestacao_servico','fornecimento','locacao','empreitada',
    'consultoria','pj_pessoa_fisica','outro'
  )),
  objeto                TEXT NOT NULL,
  descricao_escopo      TEXT,
  justificativa         TEXT,
  -- Valores
  valor_estimado        NUMERIC(15,2),
  forma_pagamento       TEXT,                            -- mensal, por medição, única, etc.
  -- Vigência
  data_inicio_prevista  DATE,
  data_fim_prevista     DATE,
  prazo_meses           INTEGER,
  -- Classificação
  centro_custo          TEXT,
  classe_financeira     TEXT,
  indice_reajuste       TEXT,
  -- Urgência
  urgencia              TEXT DEFAULT 'normal' CHECK (urgencia IN ('baixa','normal','alta','critica')),
  data_necessidade      DATE,
  -- Documentos de referência
  documentos_ref        JSONB DEFAULT '[]',              -- [{nome, url, tipo}]
  -- Status do fluxo (máquina de estados)
  etapa_atual           TEXT NOT NULL DEFAULT 'solicitacao'
    CHECK (etapa_atual IN (
      'solicitacao',                -- 1. Formulário preenchido
      'preparar_minuta',            -- 2. Equipe contratos prepara minuta
      'resumo_executivo',           -- 3. Resumo executivo para diretoria
      'aprovacao_diretoria',        -- 4. Aprovação via AprovAí
      'enviar_assinatura',          -- 5. Envio para assinatura digital
      'arquivar',                   -- 6. Arquivar no repositório
      'liberar_execucao',           -- 7. Liberar execução
      'concluido',                  -- Fluxo completo
      'cancelado'                   -- Cancelado em qualquer etapa
    )),
  status                TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_andamento','aguardando_aprovacao','aprovado','rejeitado','cancelado','concluido')),
  -- Observações
  observacoes           TEXT,
  motivo_cancelamento   TEXT,
  -- Responsável atual
  responsavel_id        UUID REFERENCES sys_perfis(id),
  responsavel_nome      TEXT,
  -- Audit
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID REFERENCES sys_perfis(id)
);
```

#### 2.1.2 `con_solicitacao_historico` — Histórico de Transições de Etapa

```sql
CREATE TABLE con_solicitacao_historico (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    UUID NOT NULL REFERENCES con_solicitacoes(id) ON DELETE CASCADE,
  etapa_de          TEXT NOT NULL,
  etapa_para        TEXT NOT NULL,
  executado_por     UUID REFERENCES sys_perfis(id),
  executado_nome    TEXT,
  observacao        TEXT,
  dados_etapa       JSONB,                              -- dados específicos da etapa
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

#### 2.1.3 `con_minutas` — Biblioteca de Minutas e Modelos

```sql
CREATE TABLE con_minutas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculo
  solicitacao_id    UUID REFERENCES con_solicitacoes(id),
  contrato_id       UUID REFERENCES con_contratos(id),
  -- Tipo
  tipo              TEXT NOT NULL CHECK (tipo IN ('modelo','rascunho','revisado','final','assinado')),
  categoria         TEXT,                                -- prestacao_servico, locacao, etc.
  -- Conteúdo
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  versao            INTEGER NOT NULL DEFAULT 1,
  -- Arquivo
  arquivo_url       TEXT NOT NULL,
  arquivo_nome      TEXT NOT NULL,
  mime_type         TEXT,
  tamanho_bytes     BIGINT,
  -- OneDrive/SharePoint
  onedrive_id       TEXT,                                -- ID do arquivo no OneDrive
  onedrive_url      TEXT,                                -- URL para abrir no SharePoint
  sharepoint_path   TEXT,                                -- caminho no SharePoint
  -- Análise AI
  ai_analise        JSONB,                               -- {riscos: [], sugestoes: [], score: 0-100}
  ai_analisado_em   TIMESTAMPTZ,
  -- Status
  status            TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_revisao','aprovado','obsoleto')),
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES sys_perfis(id)
);
```

#### 2.1.4 `con_resumos_executivos` — Resumos Executivos para Diretoria

```sql
CREATE TABLE con_resumos_executivos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    UUID NOT NULL REFERENCES con_solicitacoes(id) ON DELETE CASCADE,
  -- Conteúdo estruturado
  titulo            TEXT NOT NULL,
  partes_envolvidas TEXT NOT NULL,
  objeto_resumo     TEXT NOT NULL,
  valor_total       NUMERIC(15,2),
  vigencia          TEXT,
  riscos            JSONB DEFAULT '[]',                  -- [{nivel, descricao, mitigacao}]
  oportunidades     JSONB DEFAULT '[]',                  -- [{descricao, impacto}]
  recomendacao      TEXT,                                -- parecer da equipe de contratos
  -- Aprovação
  aprovacao_id      UUID,                                -- FK para apr_aprovacoes
  status            TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','rejeitado')),
  -- Arquivo
  arquivo_url       TEXT,
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES sys_perfis(id)
);
```

#### 2.1.5 `con_assinaturas` — Controle de Assinatura Digital

```sql
CREATE TABLE con_assinaturas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         UUID REFERENCES con_contratos(id),
  solicitacao_id      UUID REFERENCES con_solicitacoes(id),
  minuta_id           UUID REFERENCES con_minutas(id),
  -- Provedor
  provedor            TEXT NOT NULL CHECK (provedor IN ('certisign','docusign','manual')),
  -- IDs externos
  envelope_id         TEXT,                              -- DocuSign envelope ID
  documento_externo_id TEXT,                             -- Certisign document ID
  -- Status
  status              TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviado','parcialmente_assinado','assinado','recusado','expirado','cancelado')),
  -- Signatários
  signatarios         JSONB NOT NULL DEFAULT '[]',       -- [{nome, email, cargo, status, assinado_em}]
  -- Datas
  enviado_em          TIMESTAMPTZ,
  concluido_em        TIMESTAMPTZ,
  expira_em           TIMESTAMPTZ,
  -- Documento assinado
  documento_assinado_url TEXT,
  certificado_url     TEXT,
  -- Webhook callback
  webhook_log         JSONB DEFAULT '[]',
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

#### 2.1.6 `con_equipe_pj` — Gestão de Contratos PJ

```sql
CREATE TABLE con_equipe_pj (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         UUID NOT NULL REFERENCES con_contratos(id),
  -- Profissional
  profissional_nome   TEXT NOT NULL,
  profissional_cnpj   TEXT NOT NULL,
  profissional_email  TEXT,
  profissional_telefone TEXT,
  cargo_funcao        TEXT NOT NULL,
  -- Valores
  valor_mensal        NUMERIC(15,2) NOT NULL,
  valor_hora          NUMERIC(15,2),
  carga_horaria_mensal INTEGER,
  -- Descontos
  desconto_iss_pct    NUMERIC(5,2) DEFAULT 0,
  desconto_irrf_pct   NUMERIC(5,2) DEFAULT 0,
  outros_descontos    NUMERIC(15,2) DEFAULT 0,
  -- Vigência
  data_inicio         DATE NOT NULL,
  data_fim            DATE,
  -- Status
  status              TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','encerrado')),
  ativo               BOOLEAN DEFAULT true,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
```

#### 2.1.7 `con_autorizacoes_faturamento` — Autorização de Faturamento PJ

```sql
CREATE TABLE con_autorizacoes_faturamento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT UNIQUE NOT NULL,            -- AF-2026-001
  equipe_pj_id          UUID NOT NULL REFERENCES con_equipe_pj(id),
  contrato_id           UUID NOT NULL REFERENCES con_contratos(id),
  -- Período
  competencia_mes       INTEGER NOT NULL,                -- 1-12
  competencia_ano       INTEGER NOT NULL,
  periodo_inicio        DATE NOT NULL,
  periodo_fim           DATE NOT NULL,
  -- Valores
  valor_bruto           NUMERIC(15,2) NOT NULL,
  desconto_iss          NUMERIC(15,2) DEFAULT 0,
  desconto_irrf         NUMERIC(15,2) DEFAULT 0,
  outros_descontos      NUMERIC(15,2) DEFAULT 0,
  valor_liquido         NUMERIC(15,2) GENERATED ALWAYS AS (
    valor_bruto - COALESCE(desconto_iss, 0) - COALESCE(desconto_irrf, 0) - COALESCE(outros_descontos, 0)
  ) STORED,
  -- NF recebida
  nf_numero             TEXT,
  nf_chave              TEXT,
  nf_url                TEXT,
  nf_conferida          BOOLEAN DEFAULT false,
  nf_conferida_por      TEXT,
  nf_conferida_em       TIMESTAMPTZ,
  nf_divergencia        TEXT,
  -- Status
  status                TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','autorizado','nf_recebida','nf_conferida','lancado_pagamento','pago','cancelado')),
  -- Integração financeiro
  fin_cp_id             UUID,                            -- FK para fin_contas_pagar quando lançado
  -- Aprovação
  autorizado_por        UUID REFERENCES sys_perfis(id),
  autorizado_em         TIMESTAMPTZ,
  -- Audit
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
```

#### 2.1.8 `con_nao_conformidades` — Não Conformidades e Planos de Ação

```sql
CREATE TABLE con_nao_conformidades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT UNIQUE NOT NULL,                -- NC-CON-2026-001
  contrato_id       UUID NOT NULL REFERENCES con_contratos(id),
  -- Classificação
  tipo              TEXT NOT NULL CHECK (tipo IN (
    'descumprimento_escopo','atraso','qualidade',
    'documentacao','financeiro','seguranca','outro'
  )),
  severidade        TEXT NOT NULL CHECK (severidade IN ('baixa','media','alta','critica')),
  -- Descrição
  titulo            TEXT NOT NULL,
  descricao         TEXT NOT NULL,
  evidencias        JSONB DEFAULT '[]',                  -- [{nome, url, tipo}]
  -- Plano de Ação
  plano_acao        TEXT,
  responsavel_acao  TEXT,
  prazo_acao        DATE,
  -- Resolução
  resolucao         TEXT,
  resolvido_em      TIMESTAMPTZ,
  -- Status
  status            TEXT DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratamento','resolvida','cancelada')),
  -- Penalidade
  penalidade_aplicada BOOLEAN DEFAULT false,
  valor_penalidade  NUMERIC(15,2),
  tipo_penalidade   TEXT,
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  created_by        UUID REFERENCES sys_perfis(id)
);
```

#### 2.1.9 `con_vigencias` — Controle de Vigências e Alertas Automatizados

```sql
CREATE TABLE con_vigencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id       UUID NOT NULL REFERENCES con_contratos(id),
  -- Tipo de alerta
  tipo              TEXT NOT NULL CHECK (tipo IN (
    'vencimento_contrato','vencimento_garantia','reajuste_pendente',
    'medicao_atrasada','autorizacao_atrasada','nao_conformidade_aberta',
    'renovacao_automatica','termino_pj'
  )),
  -- Detalhes
  titulo            TEXT NOT NULL,
  mensagem          TEXT,
  data_referencia   DATE NOT NULL,                       -- data do evento (vencimento, reajuste, etc.)
  dias_antecedencia INTEGER NOT NULL DEFAULT 30,
  data_alerta       DATE NOT NULL,                       -- data em que o alerta deve ser disparado
  -- Status
  status            TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','notificado','resolvido','ignorado')),
  notificado_em     TIMESTAMPTZ,
  resolvido_em      TIMESTAMPTZ,
  -- Recorrência
  recorrente        BOOLEAN DEFAULT false,
  frequencia_dias   INTEGER,
  -- Audit
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Alterações em Tabelas Existentes

#### 2.2.1 `con_contratos` — Novas Colunas

```sql
ALTER TABLE con_contratos
  ADD COLUMN IF NOT EXISTS solicitacao_id        UUID REFERENCES con_solicitacoes(id),
  ADD COLUMN IF NOT EXISTS tipo_categoria        TEXT,   -- prestacao_servico, empreitada, etc.
  ADD COLUMN IF NOT EXISTS is_pj                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS assinatura_status     TEXT DEFAULT 'pendente'
    CHECK (assinatura_status IN ('pendente','em_assinatura','assinado','sem_assinatura')),
  ADD COLUMN IF NOT EXISTS documento_assinado_url TEXT,
  ADD COLUMN IF NOT EXISTS onedrive_url          TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_path       TEXT,
  ADD COLUMN IF NOT EXISTS renovacao_automatica  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_aviso_vencimento INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS politica_aplicada     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sem_contrato_emergencial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_dias_pagamento    INTEGER,
  ADD COLUMN IF NOT EXISTS penalidade_atraso_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periodicidade_reajuste TEXT;
```

### 2.3 Novos Indexes

```sql
CREATE INDEX idx_con_sol_etapa ON con_solicitacoes(etapa_atual);
CREATE INDEX idx_con_sol_status ON con_solicitacoes(status);
CREATE INDEX idx_con_sol_responsavel ON con_solicitacoes(responsavel_id);
CREATE INDEX idx_con_minutas_solicitacao ON con_minutas(solicitacao_id);
CREATE INDEX idx_con_minutas_contrato ON con_minutas(contrato_id);
CREATE INDEX idx_con_assinaturas_contrato ON con_assinaturas(contrato_id);
CREATE INDEX idx_con_assinaturas_status ON con_assinaturas(status);
CREATE INDEX idx_con_equipe_pj_contrato ON con_equipe_pj(contrato_id);
CREATE INDEX idx_con_af_equipe ON con_autorizacoes_faturamento(equipe_pj_id);
CREATE INDEX idx_con_af_competencia ON con_autorizacoes_faturamento(competencia_ano, competencia_mes);
CREATE INDEX idx_con_nc_contrato ON con_nao_conformidades(contrato_id);
CREATE INDEX idx_con_nc_status ON con_nao_conformidades(status);
CREATE INDEX idx_con_vigencias_data ON con_vigencias(data_alerta);
CREATE INDEX idx_con_vigencias_status ON con_vigencias(status);
```

### 2.4 Diagrama de Relacionamentos (Simplificado)

```
con_solicitacoes ──1:N──> con_solicitacao_historico
       │
       ├──1:N──> con_minutas
       ├──1:1──> con_resumos_executivos
       ├──1:1──> con_assinaturas
       │
       └──1:1──> con_contratos (após conclusão do fluxo)
                      │
                      ├──1:N──> con_contrato_itens
                      ├──1:N──> con_parcelas ──> con_parcela_anexos
                      ├──1:N──> con_medicoes ──> con_medicao_itens
                      ├──1:N──> con_aditivos
                      ├──1:N──> con_reajustes
                      ├──1:N──> con_cronograma
                      ├──1:N──> con_equipe_pj ──> con_autorizacoes_faturamento
                      ├──1:N──> con_nao_conformidades
                      ├──1:N──> con_vigencias
                      └──1:N──> con_minutas (versões posteriores)
```

---

## 3. MÁQUINA DE ESTADOS — FLUXO DE ASSINATURA (7 ETAPAS)

### 3.1 Diagrama de Estados

```
[1] SOLICITAÇÃO
    ↓ (submit)
[2] PREPARAR MINUTA
    ↓ (minuta uploaded + versão final)
[3] RESUMO EXECUTIVO
    ↓ (resumo criado)
[4] APROVAÇÃO DIRETORIA (AprovAí)
    ↓ aprovado        ↘ rejeitado → volta para [2]
[5] ENVIAR ASSINATURA
    ↓ (todos assinaram)
[6] ARQUIVAR
    ↓ (arquivo salvo OneDrive)
[7] LIBERAR EXECUÇÃO
    ↓
[✓] CONCLUÍDO → Contrato criado/atualizado em con_contratos
```

### 3.2 Transições Válidas

| De | Para | Ação | Quem |
|----|------|------|------|
| solicitacao | preparar_minuta | Submeter solicitação | Solicitante |
| preparar_minuta | resumo_executivo | Upload minuta final | Equipe Contratos |
| preparar_minuta | solicitacao | Devolver para ajustes | Equipe Contratos |
| resumo_executivo | aprovacao_diretoria | Enviar para aprovação | Equipe Contratos |
| resumo_executivo | preparar_minuta | Revisar minuta | Equipe Contratos |
| aprovacao_diretoria | enviar_assinatura | Aprovado | Diretoria (AprovAí) |
| aprovacao_diretoria | preparar_minuta | Rejeitado | Diretoria (AprovAí) |
| enviar_assinatura | arquivar | Assinatura concluída | Sistema (webhook) |
| enviar_assinatura | enviar_assinatura | Reenviar | Equipe Contratos |
| arquivar | liberar_execucao | Arquivado no repositório | Equipe Contratos |
| liberar_execucao | concluido | Liberar execução | Equipe Contratos |
| * | cancelado | Cancelar solicitação | Equipe Contratos / Admin |

### 3.3 Integração com AprovAí

O fluxo de aprovação da diretoria reutiliza o sistema existente (`apr_aprovacoes`):

```typescript
// Ao enviar para aprovação:
await supabase.from('apr_aprovacoes').insert({
  modulo: 'con',                           // Módulo Contratos
  entidade_tipo: 'solicitacao_contrato',
  entidade_id: solicitacao.id,
  nivel: 1,                                // Nível único: Diretoria
  aprovador_nome: 'Diretor Presidente',
  aprovador_email: 'diretor@teg.com.br',
  token: crypto.randomUUID(),
  data_limite: addDays(30),
  status: 'pendente',
})
```

A aprovação via token (URL `/aprovacao/:token`) já funciona no sistema. O webhook de callback avança a etapa automaticamente.

---

## 4. NOVAS PÁGINAS E VIEWS

### 4.1 Mapa de Páginas (20 telas novas, 7 existentes mantidas)

#### Grupo 1: Fluxo de Assinatura (Novas)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/contratos/solicitacoes` | SolicitacoesLista | Lista de solicitações com filtros por etapa |
| `/contratos/solicitacoes/nova` | NovaSolicitacao | Formulário wizard 3-step para nova solicitação |
| `/contratos/solicitacoes/:id` | SolicitacaoDetalhe | Detalhe + timeline do fluxo + ações por etapa |
| `/contratos/solicitacoes/:id/minuta` | PreparaMinuta | Upload/edição de minuta + análise AI |
| `/contratos/solicitacoes/:id/resumo` | ResumoExecutivo | Editor de resumo executivo com preview PDF |

#### Grupo 2: Gestão de Contratos (Existentes + Novas)

| Rota | Página | Status |
|------|--------|--------|
| `/contratos` | DashboardContratos | Manter + expandir com KPIs do fluxo |
| `/contratos/lista` | ListaContratos | Manter + adicionar coluna de etapa |
| `/contratos/novo` | NovoContrato | Manter (criação direta sem fluxo) |
| `/contratos/:id` | ContratoDetalhe | **Nova** — Visão 360 do contrato |
| `/contratos/parcelas` | Parcelas | Manter |
| `/contratos/medicoes` | Medicoes | Manter |
| `/contratos/aditivos` | Aditivos | Manter |
| `/contratos/reajustes` | Reajustes | Manter |
| `/contratos/cronograma` | Cronograma | **Nova** — Gantt visual do cronograma |
| `/contratos/minutas` | BibliotecaMinutas | **Nova** — Repositório de modelos e minutas |

#### Grupo 3: Equipe PJ (Novas)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/contratos/pj` | EquipePJLista | Lista de profissionais PJ ativos |
| `/contratos/pj/:id` | EquipePJDetalhe | Detalhe do PJ + autorizações de faturamento |
| `/contratos/pj/autorizacoes` | AutorizacoesFaturamento | Lista de AFs com conferência de NF |

#### Grupo 4: Compliance e Monitoramento (Novas)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/contratos/compliance` | DashboardCompliance | Alertas, não conformidades, vigências |
| `/contratos/nao-conformidades` | NaoConformidades | Lista de NCs + planos de ação |
| `/contratos/vigencias` | ControleVigencias | Painel de vencimentos e alertas |
| `/contratos/assinaturas` | TrackingAssinaturas | Status de assinaturas digitais |

### 4.2 ContratoDetalhe — Visão 360

A página `/contratos/:id` será um hub central com tabs:

```
[Visão Geral] [Itens] [Parcelas] [Medições] [Aditivos] [Cronograma] [Documentos] [Equipe PJ] [Compliance]
```

Cada tab carrega o componente correspondente filtrado por `contrato_id`.

---

## 5. INTEGRAÇÕES EXTERNAS

### 5.1 Assinatura Digital (Certisign / DocuSign)

#### Arquitetura

```
Frontend → n8n Webhook → Provedor (Certisign/DocuSign) → Webhook callback → n8n → Supabase
```

#### Fluxo n8n: `con-enviar-assinatura`

1. **Trigger:** Webhook `/contratos/assinatura/enviar`
2. **Switch:** Provedor (`certisign` ou `docusign`)
3. **Certisign Branch:**
   - Upload documento via API Certisign
   - Definir signatários
   - Criar processo de assinatura
   - Salvar `documento_externo_id`
4. **DocuSign Branch:**
   - Criar envelope via DocuSign API
   - Adicionar documento + signatários
   - Enviar para assinatura
   - Salvar `envelope_id`
5. **Update:** `con_assinaturas.status = 'enviado'`

#### Fluxo n8n: `con-webhook-assinatura`

1. **Trigger:** Webhook `/contratos/assinatura/callback` (chamado pelo provedor)
2. **Parse:** Identificar status do evento
3. **Update:** `con_assinaturas` com status atualizado
4. **If completado:** Avançar etapa da solicitação para `arquivar`
5. **Notificar:** Equipe contratos via WhatsApp/email

#### Configuração DocuSign (via MCP existente)

O MCP DocuSign já está configurado no projeto. Utilizar templates do DocuSign como base:
- `getTemplates` → listar templates disponíveis
- `createEnvelope` → criar envelope a partir do template
- Webhook callback para status updates

### 5.2 OneDrive / SharePoint

#### Arquitetura

```
n8n → Microsoft Graph API → OneDrive/SharePoint
```

#### Fluxo n8n: `con-arquivar-onedrive`

1. **Trigger:** Webhook `/contratos/onedrive/arquivar`
2. **Auth:** OAuth2 Microsoft Graph (token refreshável)
3. **Upload:** PUT para `/drives/{drive-id}/items/{folder-id}:/{filename}:/content`
4. **Organização de pastas:**
   ```
   /TEG+ Contratos/
     ├── Modelos/
     ├── Em Negociação/
     ├── Assinados/
     │   └── 2026/
     │       ├── CTR-2026-001 - Fornecedor ABC/
     │       │   ├── Minuta v1.pdf
     │       │   ├── Minuta v2.pdf
     │       │   └── Contrato Assinado.pdf
     │       └── ...
     └── Encerrados/
   ```
5. **Update:** `con_minutas.onedrive_id`, `con_contratos.onedrive_url`

### 5.3 Email Automático

#### Fluxo n8n: `con-enviar-email`

Reutilizar o padrão existente de notificações:

1. **Trigger:** Chamado por outros workflows
2. **Templates:**
   - Envio de minuta para revisão
   - Notificação de aprovação pendente
   - Confirmação de assinatura
   - Alerta de vencimento
   - Autorização de faturamento PJ
3. **Provedor:** SMTP corporativo ou SendGrid

---

## 6. FUNCIONALIDADES DE IA

### 6.1 Análise de Minutas

#### Fluxo n8n: `con-ai-analisar-minuta`

1. **Trigger:** Webhook `/contratos/ai/analisar-minuta`
2. **Input:** URL da minuta (PDF)
3. **OCR:** Extrair texto do PDF (reutilizar nó OCR existente do workflow `hQcdcPpLhvnGGYxF`)
4. **Prompt Claude:**
   ```
   Analise a seguinte minuta de contrato e retorne um JSON com:
   - riscos: [{nivel: "alto|medio|baixo", titulo, descricao, clausula_ref}]
   - sugestoes: [{tipo: "inclusao|alteracao|exclusao", descricao, clausula_ref}]
   - conformidade: {score: 0-100, itens_verificados: [...]}
   - resumo_executivo: "texto de 3-5 parágrafos"
   - clausulas_criticas: [{numero, texto_resumido, risco}]
   ```
5. **Save:** `con_minutas.ai_analise`
6. **Response:** Retornar análise formatada

#### Frontend: Componente `AiMinutaAnalise`

- Sidebar no `PreparaMinuta` com resultados da análise
- Score de conformidade visual (gauge chart)
- Lista de riscos com severidade colorida
- Sugestões de adequação com referência a cláusulas
- Botão "Analisar com IA" que dispara o workflow

### 6.2 Análise de Riscos do Contrato

#### Fluxo n8n: `con-ai-analisar-riscos`

1. **Input:** Dados do contrato + minuta + histórico do fornecedor
2. **Prompt Claude:**
   ```
   Com base nos dados do contrato e histórico, avalie:
   - Risco de inadimplência
   - Risco de atraso
   - Conformidade com políticas da empresa
   - Comparação com contratos similares
   - Recomendação de ação
   ```
3. **Output:** Card de riscos no ContratoDetalhe

### 6.3 Geração Automática de Resumo Executivo

- Input: dados da solicitação + minuta analisada
- Output: resumo executivo pré-preenchido para revisão humana
- Economiza tempo da equipe de contratos

---

## 7. WORKFLOWS n8n (NOVOS)

### 7.1 Lista de Workflows a Criar

| # | Nome | Trigger | Descrição |
|---|------|---------|-----------|
| 1 | con-enviar-assinatura | Webhook | Enviar minuta para Certisign/DocuSign |
| 2 | con-webhook-assinatura | Webhook | Callback de status de assinatura |
| 3 | con-arquivar-onedrive | Webhook | Upload para OneDrive/SharePoint |
| 4 | con-ai-analisar-minuta | Webhook | Análise de minuta com IA |
| 5 | con-ai-analisar-riscos | Webhook | Análise de riscos com IA |
| 6 | con-gerar-cp-cr | Cron/Trigger | Gerar CP/CR previstas no financeiro |
| 7 | con-alertas-vencimento | Cron diário | Verificar vigências e disparar alertas |
| 8 | con-notificar-af-atrasada | Cron diário | Alertar AFs de PJ não autorizadas |
| 9 | con-enviar-email | Internal | Template de emails transacionais |
| 10 | con-sync-indices | Cron semanal | Buscar índices IGPM/IPCA atualizados (API BCB) |

### 7.2 Workflow #6: Geração Automática de CP/CR

```
Trigger: con_parcelas liberada OU con_autorizacoes_faturamento autorizada
  ↓
IF tipo_contrato = 'despesa':
  INSERT fin_contas_pagar (...)
  UPDATE con_parcelas SET fin_cp_id = ...
ELSE IF tipo_contrato = 'receita':
  INSERT fin_contas_receber (...)
  UPDATE con_parcelas SET fin_cr_id = ...
  ↓
Notificar equipe financeira
```

### 7.3 Workflow #7: Alertas de Vencimento (Cron Diário)

```
Cron: 08:00 todos os dias
  ↓
Query: contratos vigentes com vencimento em N dias
  ↓
Para cada alerta:
  INSERT con_vigencias
  Notificar via WhatsApp (workflow existente 2OxlIc2UcvuYyt5H)
  Notificar via Email
```

---

## 8. MODELO DE PERMISSÕES

### 8.1 Roles e Acessos

| Funcionalidade | Equipe Contratos | Suprimentos | Controladoria | Diretoria | Admin |
|----------------|:---:|:---:|:---:|:---:|:---:|
| Dashboard | CRUD | R | R | R | CRUD |
| Solicitações — criar | CRUD | C | C | — | CRUD |
| Solicitações — gerenciar fluxo | CRUD | — | — | — | CRUD |
| Preparar minuta | CRUD | — | — | — | CRUD |
| Resumo executivo | CRUD | — | R | R | CRUD |
| Aprovar contrato (AprovAí) | — | — | — | CRUD | CRUD |
| Enviar assinatura | CRUD | — | — | — | CRUD |
| Arquivar | CRUD | — | — | — | CRUD |
| Liberar execução | CRUD | — | — | — | CRUD |
| Contratos — lista | CRUD | R | R | R | CRUD |
| Contratos — criar direto | CRUD | — | — | — | CRUD |
| Parcelas | CRUD | — | R | R | CRUD |
| Medições | CRUD | — | R | R | CRUD |
| Aditivos | CRUD | — | R | R | CRUD |
| Reajustes | CRUD | — | R | — | CRUD |
| Equipe PJ | CRUD | — | R | R | CRUD |
| Autorizações faturamento | CRUD | — | R | R | CRUD |
| Não conformidades | CRUD | — | R | R | CRUD |
| Vigências/alertas | CRUD | R | R | R | CRUD |
| Minutas — modelos | CRUD | R | R | R | CRUD |
| Minutas — upload | CRUD | — | — | — | CRUD |
| Análise AI | CRUD | — | R | R | CRUD |

> **Legenda:** C = Criar, R = Ler, U = Atualizar, D = Deletar, — = Sem acesso

### 8.2 Implementação RLS

O padrão será RLS granular baseado na role do `sys_perfis`:

```sql
-- Exemplo: Equipe Contratos tem acesso total
CREATE POLICY "con_solicitacoes_contratos_full"
  ON con_solicitacoes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'contratos')
    )
  );

-- Exemplo: Suprimentos/Controladoria/Diretoria somente leitura
CREATE POLICY "con_solicitacoes_readonly"
  ON con_solicitacoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE user_id = auth.uid()
      AND role IN ('suprimentos', 'controladoria', 'diretoria')
    )
  );
```

**Nota:** O sistema atual usa `auth.role() = 'authenticated'` para todas as tabelas con_. A migração para RLS granular será feita de forma gradual, substituindo as policies existentes.

### 8.3 Assinatura pelo Diretor Presidente

- Todo contrato deve ser assinado pelo Diretor Presidente ou preposto designado por tema
- O campo `signatarios` em `con_assinaturas` inclui obrigatoriamente o Diretor
- O sistema não permite enviar para assinatura sem aprovação da diretoria

---

## 9. DOCUMENTOS OBRIGATÓRIOS

### 9.1 Checklist de Documentos por Etapa

| Etapa | Documento | Obrigatório | Formato |
|-------|-----------|:-----------:|---------|
| Solicitação | Documentos de referência | Não | PDF/DOC |
| Preparar Minuta | Modelo de contrato | Sim | DOCX/PDF |
| Preparar Minuta | Minuta aprovada (versão final) | Sim | PDF |
| Resumo Executivo | Resumo para diretoria | Sim | PDF |
| Assinatura | Contrato assinado digitalmente | Sim | PDF (assinado) |
| Execução | Autorização de faturamento | Sim (PJ) | PDF |

### 9.2 Validação no Frontend

O sistema bloqueará a transição de etapa se documentos obrigatórios não estiverem anexados:

```typescript
const podeAvancar = (etapa: string, solicitacao: Solicitacao): boolean => {
  switch (etapa) {
    case 'preparar_minuta':
      return !!solicitacao.minutas?.some(m => m.tipo === 'final' && m.status === 'aprovado')
    case 'resumo_executivo':
      return !!solicitacao.resumo_executivo?.status === 'enviado'
    case 'enviar_assinatura':
      return !!solicitacao.resumo_executivo?.status === 'aprovado'
    // ...
  }
}
```

---

## 10. PLANO DE MIGRAÇÃO

### 10.1 Fases de Implementação

#### FASE 1 — MVP Fluxo de Assinatura (Sprint 1-2, ~3 semanas)

**Banco:**
- Migration `040_contratos_v2_fluxo.sql`:
  - `con_solicitacoes`
  - `con_solicitacao_historico`
  - `con_minutas`
  - `con_resumos_executivos`
  - Novas colunas em `con_contratos`
  - RLS, indexes, triggers de updated_at

**Frontend:**
- `SolicitacoesLista` — lista com filtros por etapa
- `NovaSolicitacao` — wizard de 3 steps
- `SolicitacaoDetalhe` — timeline + ações
- `PreparaMinuta` — upload + versionamento de minutas
- `ResumoExecutivo` — editor com preview
- Hook: `useSolicitacoes.ts`
- Types: expandir `contratos.ts`

**n8n:**
- `con-enviar-email` (notificações básicas)

**Integração AprovAí:**
- Aprovação via token existente (`/aprovacao/:token`)
- `apr_aprovacoes` com `modulo = 'con'`

**Resultado:** Fluxo completo de 7 etapas funcionando com aprovação digital, sem integrações externas (assinatura manual, arquivamento manual).

#### FASE 2 — Assinatura Digital + Arquivamento (Sprint 3-4, ~3 semanas)

**Banco:**
- Migration `041_contratos_v2_assinatura.sql`:
  - `con_assinaturas`

**Frontend:**
- `TrackingAssinaturas` — dashboard de assinaturas
- Componente `AssinaturaStatus` no SolicitacaoDetalhe

**n8n:**
- `con-enviar-assinatura` (Certisign ou DocuSign)
- `con-webhook-assinatura` (callback)
- `con-arquivar-onedrive` (Microsoft Graph)

**Resultado:** Assinatura digital automatizada e arquivamento no SharePoint.

#### FASE 3 — Gestão de Equipe PJ (Sprint 5-6, ~3 semanas)

**Banco:**
- Migration `042_contratos_v2_pj.sql`:
  - `con_equipe_pj`
  - `con_autorizacoes_faturamento`

**Frontend:**
- `EquipePJLista`
- `EquipePJDetalhe`
- `AutorizacoesFaturamento`
- Hook: `useEquipePJ.ts`

**n8n:**
- `con-gerar-cp-cr` (integração com financeiro)
- `con-notificar-af-atrasada`

**Resultado:** Gestão completa de PJs com autorização de faturamento e conferência de NF.

#### FASE 4 — Compliance e IA (Sprint 7-8, ~3 semanas)

**Banco:**
- Migration `043_contratos_v2_compliance.sql`:
  - `con_nao_conformidades`
  - `con_vigencias`

**Frontend:**
- `DashboardCompliance`
- `NaoConformidades`
- `ControleVigencias`
- `ContratoDetalhe` (visão 360)
- `Cronograma` (Gantt visual)
- `BibliotecaMinutas`
- Componente `AiMinutaAnalise`

**n8n:**
- `con-ai-analisar-minuta`
- `con-ai-analisar-riscos`
- `con-alertas-vencimento`
- `con-sync-indices` (IGPM/IPCA do BCB)

**Resultado:** Módulo completo com IA, compliance e monitoramento automatizado.

### 10.2 Compatibilidade com Dados Existentes

- Todas as tabelas existentes são mantidas sem alteração destrutiva
- Novas colunas em `con_contratos` são opcionais (`ADD COLUMN IF NOT EXISTS`)
- Contratos existentes continuam funcionando normalmente
- O fluxo de assinatura é opcional — contratos podem ser criados diretamente (rota `/contratos/novo` mantida)
- A migration usa `CREATE TABLE IF NOT EXISTS` para idempotência
- Não há remoção de colunas ou tabelas existentes

### 10.3 Estratégia de Hooks

Os hooks serão organizados assim:

| Hook | Conteúdo |
|------|----------|
| `useContratos.ts` | **Manter** — queries/mutations de contratos, parcelas, medições, aditivos, reajustes, cronograma |
| `useSolicitacoes.ts` | **Novo** — queries/mutations do fluxo de assinatura |
| `useMinutas.ts` | **Novo** — queries/mutations de minutas + análise AI |
| `useEquipePJ.ts` | **Novo** — queries/mutations de equipe PJ + autorizações |
| `useCompliance.ts` | **Novo** — queries/mutations de não conformidades + vigências |

---

## 11. PAIN POINTS RESOLVIDOS

| Problema | Solução |
|----------|---------|
| Coleta manual de informações para minutas | Formulário estruturado (NovaSolicitacao) com todos os dados necessários |
| Negociações fora da política da empresa | Campo `politica_aplicada` + validação obrigatória + alertas de compliance |
| Emissões emergenciais sem contrato | Flag `sem_contrato_emergencial` + alerta automático + relatório de compliance |
| Revisão de autorizações de faturamento atrasadas | n8n `con-notificar-af-atrasada` (cron diário) + dashboard de AFs pendentes |
| Leitura e adequação de minutas | IA analisa minuta e sugere adequações automaticamente |
| Acompanhamento de assinaturas | `TrackingAssinaturas` com status em tempo real via webhooks |

---

## 12. ESTIMATIVA DE ESFORÇO

| Fase | Escopo | Backend (dias) | Frontend (dias) | n8n (dias) | Total |
|------|--------|:-:|:-:|:-:|:-:|
| Fase 1 | MVP Fluxo | 3 | 8 | 1 | **12 dias** |
| Fase 2 | Assinatura + OneDrive | 2 | 3 | 5 | **10 dias** |
| Fase 3 | Equipe PJ | 2 | 5 | 2 | **9 dias** |
| Fase 4 | Compliance + IA | 3 | 7 | 4 | **14 dias** |
| **Total** | | **10** | **23** | **12** | **45 dias** |

> Estimativa considerando 1 desenvolvedor fullstack. Com equipe de 2, o prazo reduz para ~25 dias úteis (~5 semanas).

---

## 13. RISCOS DO PROJETO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:---:|:---:|-----------|
| API Certisign instável | Média | Alto | Fallback para DocuSign; opção manual |
| Complexidade OneDrive auth | Alta | Médio | Usar Microsoft Graph API com refresh token; fallback upload manual |
| Escopo do AI creep | Alta | Médio | Limitar Fase 4 a análise de minuta; features adicionais em sprints futuras |
| RLS granular quebra algo | Baixa | Alto | Testar em branch; manter policies atuais como fallback |
| Performance com muitas tabelas | Baixa | Médio | Indexes estratégicos; paginação em todas as listas |
| Adoção pelos usuários | Média | Alto | Treinamento; manter fluxo direto (sem obrigar fluxo de assinatura) |

---

## 14. DECISÕES DE ARQUITETURA

### 14.1 Por que `con_solicitacoes` separada de `con_contratos`?

A solicitação representa o **processo** de criar um contrato (7 etapas). O contrato em `con_contratos` é o **resultado** desse processo. Misturar ambos na mesma tabela criaria complexidade desnecessária nos status e queries. A FK `con_contratos.solicitacao_id` vincula o contrato à sua solicitação de origem.

### 14.2 Por que `con_equipe_pj` separada?

Contratos PJ têm lógica específica (autorizações de faturamento, conferência de NF, descontos ISS/IRRF) que não se aplica a contratos regulares. Uma tabela dedicada simplifica queries e RLS.

### 14.3 Por que não usar DocuSign MCP diretamente?

O MCP DocuSign já está conectado, mas o fluxo de assinatura precisa ser assíncrono (webhook callback quando todos assinarem). O n8n é o orquestrador ideal para esse padrão. O frontend dispara o envio, o n8n gerencia o ciclo de vida, e o callback atualiza o banco.

### 14.4 Por que n8n para CP/CR e não trigger Postgres?

Triggers Postgres são síncronos e não devem chamar APIs externas. A geração de CP/CR envolve lógica de negócio complexa (determinar centro de custo, classificação, etc.) e potencialmente notificações. O n8n permite visibilidade, retry e debugging.

---

## APÊNDICE A — Sequência de Migrations SQL

```
040_contratos_v2_fluxo.sql        ← Fase 1
041_contratos_v2_assinatura.sql   ← Fase 2
042_contratos_v2_pj.sql           ← Fase 3
043_contratos_v2_compliance.sql   ← Fase 4
```

## APÊNDICE B — Endpoints n8n (Webhooks)

```
POST /contratos/solicitacao/avancar     ← Avançar etapa do fluxo
POST /contratos/assinatura/enviar       ← Enviar para assinatura digital
POST /contratos/assinatura/callback     ← Callback do provedor
POST /contratos/onedrive/arquivar       ← Upload para OneDrive
POST /contratos/ai/analisar-minuta      ← Análise AI de minuta
POST /contratos/ai/analisar-riscos      ← Análise AI de riscos
POST /contratos/pj/gerar-cp            ← Gerar conta a pagar de AF
POST /contratos/email/enviar           ← Enviar email transacional
```

## APÊNDICE C — Rotas Frontend Completas

```
/contratos                              ← Dashboard (existente, expandido)
/contratos/lista                        ← Lista de contratos (existente)
/contratos/novo                         ← Novo contrato direto (existente)
/contratos/:id                          ← Detalhe 360 (novo)
/contratos/parcelas                     ← Parcelas (existente)
/contratos/medicoes                     ← Medições (existente)
/contratos/aditivos                     ← Aditivos (existente)
/contratos/reajustes                    ← Reajustes (existente)
/contratos/cronograma                   ← Cronograma Gantt (novo)
/contratos/solicitacoes                 ← Lista de solicitações (novo)
/contratos/solicitacoes/nova            ← Nova solicitação wizard (novo)
/contratos/solicitacoes/:id             ← Detalhe + timeline (novo)
/contratos/solicitacoes/:id/minuta      ← Preparar minuta + AI (novo)
/contratos/solicitacoes/:id/resumo      ← Resumo executivo (novo)
/contratos/minutas                      ← Biblioteca de minutas (novo)
/contratos/pj                           ← Equipe PJ (novo)
/contratos/pj/:id                       ← Detalhe PJ (novo)
/contratos/pj/autorizacoes              ← Autorizações de faturamento (novo)
/contratos/compliance                   ← Dashboard compliance (novo)
/contratos/nao-conformidades            ← Não conformidades (novo)
/contratos/vigencias                    ← Controle de vigências (novo)
/contratos/assinaturas                  ← Tracking de assinaturas (novo)
```

---

> **Próximos passos:** Revisão com equipe de negócio, aprovação do plano, início da Fase 1.
