# 🏗️ TEG+ ERP World-Class — Avaliação Estratégica Completa
**TEG União Engenharia | Fev/2026**
*Baseado na Arquitetura Oficial — Págs. 02 e 03 do SistemaTEGPlus_Documentacao.pdf*

---

## 📐 A Arquitetura Definida no PDF (Fiel ao Documento)

O documento define **4 Camadas**:

```
CAMADA 1 — SISTEMAS DE TERCEIROS (best-in-class)
  ├── Omie ERP         → Financeiro, Fiscal, C.Pagar, C.Receber, NF-e, DRE
  ├── Monday.com       → EGP/PMO, Cronograma, Portfólio
  ├── RDO App          → Campo mobile, Relatório Diário de Obra
  ├── Gestão de Frotas → TBD (interno ou terceiro)
  ├── Gestão Contratos → TBD (interno ou terceiro)
  ├── Logística/Almox  → TBD (interno ou terceiro)
  └── Portal Compras   → TBD (interno ou terceiro) ← JÁ CONSTRUÍMOS ✅

CAMADA 2 — CORAÇÃO TEG (desenvolvimento próprio)
  ├── n8n              → Hub central de integração + automação
  ├── Supabase         → Fonte ÚNICA da verdade (PostgreSQL)
  └── Lovable/React    → Interfaces próprias TEG

CAMADA 3 — AI TEG+ (agente de ação)
  └── Claude API + RAG + Multi-agente via n8n
      Acesso por: WhatsApp | Painel Lovable | E-mail/Outlook

CAMADA 4 — 10 ÁREAS SERVIDAS
```

---

## 🎯 As 10 Áreas do Sistema TEG+

| # | Área | Escopo |
|---|------|--------|
| 1 | 👔 **Diretoria** | Painel executivo · Alçadas · KPIs |
| 2 | 📊 **EGP** | Portfólio · SPI/CPI · Relatórios |
| 3 | 🏗 **Obras** | RDO · HHt · Custos · Mobile |
| 4 | 📦 **Suprimentos** | Req. · Patrimônio · Frota |
| 5 | 🦺 **SSMA** | Ocorrências · NRs · CEMIG |
| 6 | 👥 **RH + DP** | Folha · eSocial · Mobilização |
| 7 | 💰 **Financeiro** | Caixa · Pagar · NF-e Auto |
| 8 | 📈 **Controladoria** | DRE · Margem · Cenários |
| 9 | 📋 **Contratos** | Faturamento · Pleitos · CEMIG |
| 10 | 💻 **TI** | Arquitetura · SLA · Monit. |

---

## 📊 O que o Supabase armazena (dados exclusivos TEG)

Per o PDF, estes são os dados que **só o TEG+ possui** e que geram diferencial real:

- 📊 **HHt por colaborador / obra / atividade** (Homens-Hora trabalhados)
- 📊 **Custo real por projeto** (consolidado de todas as fontes)
- 📊 **Patrimônio completo (R$22,5M)** — ativos físicos catalogados
- 📊 **Histórico de preços / fornecedores** (inteligência de compras)
- 📊 **Indicadores gerenciais históricos**
- 📊 **Logs de aprovações e alçadas**

---

## ✅ O que já foi entregue

| Módulo | Status | Mapeamento no PDF |
|--------|--------|--------------------|
| Portal de Requisições (Suprimentos) | ✅ LIVE | Camada 2 — Lovable próprio |
| Cotações + Aprovações (4 alçadas) | ✅ LIVE | Camada 2 — fluxo n8n |
| ApprovaAi (mobile branded) | ✅ LIVE | Camada 2 |
| Dashboard KPIs | ✅ LIVE | Área 1 — Diretoria |
| Supabase schema base | ✅ LIVE | Camada 2 — Fonte da verdade |
| n8n AI Parse (keyword) | ✅ LIVE | Camada 3 — AI TEG+ básica |

**Conclusão**: Entregamos o "Portal de Compras" que estava como "TBD (interno ou terceiro)" no PDF. ✅

---

## 🚀 Próximos Módulos — Ordem de Prioridade e Esforço

### **🥇 PRIORIDADE 1 — HHt App (Campo Mobile)**
> Area: 🏗 Obras | "App HHt — campo mobile simples"

**Por que primeiro**: É a base de custo real de tudo. Sem HHt, não tem custo real por obra. O PDF lista como dado exclusivo TEG no Supabase.

**O que construir**:
- App mobile ultra-simples para encarregado/técnico de campo
- Lançamento: colaborador + atividade + horas + obra (5 campos no máximo)
- Geolocalização no check-in/out
- Funciona offline (sync ao recuperar sinal)
- Supervisor aprova lançamentos do dia
- Dashboard: HHt planejado vs realizado por obra

**Supabase tables**:
```sql
colaboradores (id, nome, matricula, funcao, obra_id, ativo)
atividades_hht (id, codigo, descricao, unidade_medida, categoria)
lancamentos_hht (
  id, colaborador_id, obra_id, atividade_id,
  data, horas_normais, horas_extras,
  status, aprovador_id, created_at
)
```

**n8n automações**:
```
HHt lançado → supervisor aprova/rejeita → Supabase
HHt diário → consolida custo mão-de-obra → atualiza custo obra
Fim semana → gera relatório HHt por obra → WhatsApp gestor
```

**Esforço**: 2-3 semanas | **Impacto**: CRÍTICO — base do custo real

---

### **🥇 PRIORIDADE 1 — Integração Omie (Financeiro)**
> Area: 💰 Financeiro | Camada 1 — Terceiro best-in-class

**Fluxo principal definido no PDF**:
```
⚡ Requisição → Cotação → Aprovação → Omie
⚡ NF-e entrada → Lançamento automático C. Pagar
```

**O que construir no n8n**:
1. Workflow: RC Aprovada → cria Conta a Pagar no Omie via API REST
2. Workflow: NF-e XML chega → lança automaticamente no Omie + fecha RC no TEG+
3. Workflow: Vencimentos do dia → WhatsApp para aprovador + financeiro

**O que construir no React (Dashboard Financeiro)**:
- Pull da API Omie: saldo contas, previsão de caixa 30 dias
- Contas a pagar por obra (custo comprometido)
- Alertas visuais de vencimentos

**Credenciais necessárias**:
- API Omie: app_key + app_secret (configurar no n8n)
- Endpoint: https://app.omie.com.br/api/v1/

**Esforço**: 2-3 semanas | **Impacto**: ALTÍSSIMO — fecha o ciclo financeiro

---

### **🥈 PRIORIDADE 2 — Patrimônio & Ativos (R$22,5M)**
> Area: 📦 Suprimentos | Dados exclusivos TEG no Supabase

**Por que importante**: O PDF cita explicitamente "Patrimônio completo (R$22,5M)" como dado exclusivo TEG. É um dos maiores diferenciais de dados.

**O que construir**:
- Catálogo de ativos: código TEG, descrição, valor aquisição, depreciação
- Localização atual (obra) + histórico de transferências
- QR Code por ativo (etiqueta física)
- Check-in/out com responsável
- Manutenção programada por ativo
- Relatório de depreciação para Controladoria

**Supabase tables**:
```sql
patrimonio (
  id, codigo_teg, descricao, categoria, valor_aquisicao,
  data_aquisicao, vida_util_anos, obra_atual_id,
  status, numero_serie, qr_code_hash
)
movimentacoes_patrimonio (
  id, ativo_id, obra_origem_id, obra_destino_id,
  responsavel_saida, responsavel_entrada,
  data_saida, data_entrada, observacao
)
```

**Esforço**: 2-3 semanas | **Impacto**: ALTO — controle de R$22,5M em ativos

---

### **🥈 PRIORIDADE 2 — Almoxarifado & Logística**
> Area: 📦 Suprimentos | "Logística & Almoxarifado — TBD interno"

**Decisão**: Construir internamente (como o Portal de Compras que já fizemos)

**O que construir**:
- Catálogo de materiais com código TEG unificado entre obras
- Entrada por NF: leitura XML → lança automaticamente
- Saída por requisição: QR Code no material
- Transferência entre obras com rastreabilidade completa
- Inventário periódico com app mobile
- Alerta de estoque mínimo → gera RC automaticamente

**Diferencial IA** (já no AI TEG+):
- "Obra Frutal tem 200m do cabo que você quer. Transferir em vez de comprar?"
- Sugestão automática baseada em estoque de outras obras

**Esforço**: 3-4 semanas | **Impacto**: ALTO — elimina compras duplicadas

---

### **🥈 PRIORIDADE 2 — Painel de Obras (Supervisores)**
> Area: 🏗 Obras + 📊 EGP | Integração Monday.com

**Fluxos do PDF**:
```
⚡ RDO → Avanço físico → Monday → EGP
```

**O que construir no TEG+** (Monday faz o cronograma):
- Dashboard de obra para supervisor: RDO resumido, headcount, HHt, custo dia
- Curva S automática (planejado Monday vs realizado Supabase)
- Alerta de desvio: obra X gastou 60% mas está em 40% do físico
- KPIs SPI (Schedule Performance Index) e CPI (Cost Performance Index)

**Integração n8n → Monday.com**:
```javascript
// Monday GraphQL API
mutation { create_item(board_id: xxx, item_name: "Obra Frutal - Semana 8") }
// webhook Monday → TEG+: task concluída → atualiza % físico
```

**Esforço**: 3 semanas | **Impacto**: CRÍTICO — visibilidade total EGP/Diretoria

---

### **🥉 PRIORIDADE 3 — Controle de Frotas**
> Area: 📦 Suprimentos | "Gestão de Frotas — TBD interno ou terceiro"

**Decisão recomendada**: Construir internamente (simples, não precisa de GPS tracking externo)

**O que construir**:
- Cadastro de veículos e equipamentos
- Horímetro/hodômetro: lançamento mobile diário pelo operador
- Saída/retorno: QR Code do veículo + responsável + destino/obra
- Abastecimento: volume + valor + km/hora + obra
- Manutenção preventiva por km/hora com alerta automático
- Custo por veículo/obra para Controladoria

**Esforço**: 2 semanas | **Impacto**: MÉDIO-ALTO

---

### **🥉 PRIORIDADE 3 — SSMA**
> Area: 🦺 SSMA | "Ocorrências · NRs · CEMIG"

**Diferencial**: CEMIG (cliente principal) exige relatórios específicos de SSMA

**O que construir**:
- Cadastro e controle de EPIs por colaborador
- Permissão de Trabalho (PT) digital com workflow de aprovação
- Inspeção de segurança mobile com fotos geo-referenciadas
- Registro de ocorrências (quase-acidente, acidente, observação)
- Controle de treinamentos NR por colaborador
- Geração automática de relatórios CEMIG

**Automação n8n**:
```
⚡ Alertas de vencimento (EPI, NR, ASO) → WhatsApp coordenador SSMA
⚡ Ocorrência registrada → notifica SSMA + Diretoria
⚡ Relatório CEMIG → gerado e enviado automaticamente
```

**Esforço**: 3 semanas | **Impacto**: OBRIGAÇÃO LEGAL + relação com CEMIG

---

### **🔷 PRIORIDADE 4 — RH + DP (Mobilização)**
> Area: 👥 RH + DP | "Folha · eSocial · Mobilização"

**Escopo TEG+** (Omie faz folha/eSocial):
- Cadastro de colaboradores com obra, função, ASO, NRs, CNH
- Processo de mobilização: contratação até chegada na obra
- Desmobilização: checklist de saída (devolução EPI, equipamentos)
- Banco de talentos: histórico de obras por colaborador
- Dashboard: headcount por obra vs planejado

**Esforço**: 2-3 semanas | **Impacto**: MÉDIO-ALTO

---

### **🔷 PRIORIDADE 4 — Contratos + Faturamento**
> Area: 📋 Contratos | "Faturamento · Pleitos · CEMIG"

**O que construir**:
- Cadastro de contratos com CEMIG e outros clientes
- Medições: billings por avanço físico, aprovadas pelo cliente
- Fluxo de aprovação de medição (mesmo ApprovaAi já construído)
- Gestão de pleitos (reclames de desvio de escopo)
- Alertas de vencimento, reajuste, garantias

**Esforço**: 3 semanas | **Impacto**: ALTO — controla o faturamento da empresa

---

### **🔷 PRIORIDADE 4 — Dashboard Diretoria + Controladoria**
> Area: 👔 Diretoria + 📈 Controladoria | "DRE · Margem · Cenários"

**O CEO Dashboard (conforme PDF)**:
- Painel executivo consolidando TODAS as 10 áreas
- KPIs: Margem real vs orçado, Cash burn, RCs pendentes, Headcount, SSMA
- DRE por obra e consolidado (integra Omie)
- Análise de margem: custo real (HHt + compras + frota) vs contrato
- Cenários: "se atrasar 2 semanas, qual impacto no caixa?"

**Relatório automático** (fluxo n8n definido no PDF):
```
⚡ Relatórios automáticos CEMIG / Diretoria → n8n gera + envia
```

**Esforço**: 3 semanas (base) | **Impacto**: MÁXIMO — produto para CEO

---

## 🤖 AI TEG+ — O Grande Diferencial

O PDF define a AI TEG+ como **agente de ação** (não só resposta). Exemplos reais do documento:

| Comando (WhatsApp/Chat) | O que o agente FAZ |
|-------------------------|-------------------|
| "Cria requisição de R$45k de cabos para Frutal" | Abre RC no sistema preenchida |
| "Abre projeto Ituiutaba Fase 2 no Monday" | Cria estrutura completa no Monday |
| "Aprova os pedidos abaixo de R$10k pendentes" | Executa aprovações em lote |
| "Cadastra fornecedor XYZ com os dados que te mandei" | Lança no Omie via API |
| "Qual custo real vs orçado de Paracatu?" | Busca, consolida e responde |
| "Gera e envia relatório semanal para Laucídio" | Gera PDF + envia por email/WhatsApp |

**3 canais de acesso**:
1. **WhatsApp** — campo, supervisores, gestores enviam texto → agente age
2. **Painel Lovable** — chat integrado ao TEG+ sem sair da tela
3. **E-mail/Outlook** — aprovações e relatórios via Microsoft 365 + n8n

**Como construir o AI TEG+**:
```
n8n AI Agent workflow:
  Webhook (WhatsApp/Chat) →
  Claude API (Claude 3.5 Sonnet) com system prompt + tools →
  Tools: supabase_query | omie_api | monday_api | criar_rc | aprovar_rc | gerar_pdf →
  Responde via WhatsApp/Chat com resultado da ação
```

**RAG (Retrieval Augmented Generation)**:
- Dados do Supabase como contexto: preços históricos, obras, colaboradores
- Agente sabe o contexto real da empresa antes de responder

**Esforço**: 4-6 semanas (MVP funcional) | **Impacto**: REVOLUCIONÁRIO

---

## 📅 Roadmap de Implementação — Cronograma

### **SPRINT 1 — Fev/Mar 2026 (4 semanas)**
**Tema: Fechar o ciclo de compras + base de custo**

| Semana | Entrega |
|--------|---------|
| 1 | Schema HHt (Supabase) + App HHt mobile (React) |
| 2 | Integração Omie: RC aprovada → C. Pagar automático |
| 3 | Patrimônio: cadastro + QR Code + transferências |
| 4 | Dashboard financeiro: pull Omie + alertas vencimento |

**Resultado**: Ciclo Compra → Omie fechado + HHt funcionando + Patrimônio controlado

---

### **SPRINT 2 — Abr/Mai 2026 (4 semanas)**
**Tema: Visibilidade de obras + SSMA**

| Semana | Entrega |
|--------|---------|
| 5 | Almoxarifado: entrada/saída/transferência por obra |
| 6 | Monday.com: integração n8n → Curva S automática |
| 7 | Painel Obras supervisores: KPIs, HHt, custo diário |
| 8 | SSMA: EPI, PT digital, inspeções, relatório CEMIG |

**Resultado**: 6 obras visíveis em tempo real + SSMA conforme + relatório CEMIG automático

---

### **SPRINT 3 — Jun/Jul 2026 (4 semanas)**
**Tema: RH, Frotas, Contratos**

| Semana | Entrega |
|--------|---------|
| 9 | Frotas: horímetro, saída/retorno, abastecimento |
| 10 | RH: cadastro colaboradores, mobilização, desmobilização |
| 11 | Contratos: medições, pleitos, alertas CEMIG |
| 12 | EGP: portfólio obras, SPI/CPI, DRE por obra |

**Resultado**: Controle completo de pessoas, equipamentos e contratos

---

### **SPRINT 4 — Ago/Set 2026 (4 semanas)**
**Tema: AI TEG+ MVP + Dashboard Diretoria**

| Semana | Entrega |
|--------|---------|
| 13 | AI TEG+ via WhatsApp: 5 ações básicas funcionando |
| 14 | AI TEG+ via Painel Lovable: chat integrado |
| 15 | Dashboard Diretoria consolidado (todas as 10 áreas) |
| 16 | Relatório automático semanal → email + WhatsApp |

**Resultado**: ERP completo + agente de IA operacional

---

### **SPRINT 5 — Out/Dez 2026 (contínuo)**
**Tema: Inteligência + Otimização**

- Controladoria: DRE automático, análise de margem, cenários
- AI preditiva: alerta de desvio orçamentário antes de acontecer
- RAG: agente com conhecimento completo do histórico TEG
- Benchmark de fornecedores (IA aprende padrão de preço)
- Relatórios automáticos CEMIG avançados

---

## 💡 Os 6 Diferencias World-Class do TEG+

### 1. 🤖 AI TEG+ — Agente que EXECUTA (não só responde)
Nenhum ERP do mercado tem um agente que age sobre múltiplos sistemas via WhatsApp. Isso é literalmente o futuro do ERP.

### 2. 📊 Supabase como Fonte Única da Verdade
HHt, custos reais, patrimônio, histórico de preços — dados que nenhum sistema de mercado tem juntos. Gera inteligência de negócio impossível de comprar pronta.

### 3. ⚡ n8n como Orquestrador Inteligente
Omie + Monday + RDO + WhatsApp + Email todos conversando automaticamente. Zero redigitação, zero planilha de integração.

### 4. 📱 Mobile-First para Campo
Campo de engenharia tem 90% das pessoas no celular, não em desktop. HHt, SSMA, RDO, Almoxarifado — tudo funciona offline no celular.

### 5. 🏗️ Custo Real por Obra (impossível com ERPs genéricos)
HHt + Compras + Frota + Equipamentos + Patrimônio consolidados por obra em tempo real. Margem real, não estimada.

### 6. 📋 Relatórios CEMIG Automáticos
CEMIG é cliente principal. Relatórios automáticos gerados e enviados pelo sistema = diferencial de relacionamento com cliente.

---

## 🔗 Mapa de Integrações (conforme PDF pág. 03)

```
                    ┌──────────────────┐
                    │       n8n        │
                    │  (Hub Central)   │
                    └────────┬─────────┘
           ┌─────────────────┼─────────────────────┐
           │                 │                     │
    ┌──────▼──────┐  ┌───────▼───────┐  ┌─────────▼───────┐
    │  Omie ERP   │  │  Monday.com   │  │    Supabase     │
    │  Financeiro │  │  EGP/PMO      │  │  Fonte Verdade  │
    │  Fiscal     │  │  Cronograma   │  │  HHt, Custo,    │
    │  NF-e       │  │               │  │  Patrimônio     │
    └─────────────┘  └───────────────┘  └─────────────────┘
           │                 │                     │
    ┌──────▼──────┐  ┌───────▼───────┐  ┌─────────▼───────┐
    │  RDO App    │  │  WhatsApp/    │  │  Lovable/React  │
    │  Campo      │  │  Email/M365   │  │  Portal TEG+    │
    │  Mobile     │  │  AI TEG+      │  │  (nos já built) │
    └─────────────┘  └───────────────┘  └─────────────────┘
```

**Fluxos definidos no PDF**:
1. `⚡ Requisição → Cotação → Aprovação → Omie` ← **FEITO ✅** (falta Omie)
2. `⚡ RDO → Avanço físico → Monday → EGP` ← Sprint 2
3. `⚡ NF-e entrada → Lançamento automático C. Pagar` ← Sprint 1
4. `⚡ HHt campo → Folha → Custo por obra` ← Sprint 1
5. `⚡ Alertas de vencimento, EPI, contratos` ← Sprint 1-2
6. `⚡ Relatórios automáticos CEMIG / Diretoria` ← Sprint 2

---

## 🎯 Próximas 3 Ações Concretas (Esta Semana)

### Ação 1 — Instalar pypdf (FEITO ✅)
```bash
py -m pip install pypdf  # Instalado durante esta sessão
```
Agora é possível ler PDFs diretamente no Claude Code.

### Ação 2 — Schema HHt no Supabase
Adicionar ao `EXECUTAR_NO_SUPABASE.sql`:
```sql
CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  matricula VARCHAR(50) UNIQUE,
  funcao VARCHAR(100),
  obra_id UUID REFERENCES obras(id),
  nivel_alcada INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lancamentos_hht (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID REFERENCES colaboradores(id),
  obra_id UUID REFERENCES obras(id) NOT NULL,
  data DATE NOT NULL,
  horas_normais DECIMAL(5,2) DEFAULT 0,
  horas_extras DECIMAL(5,2) DEFAULT 0,
  atividade VARCHAR(200),
  status VARCHAR(20) DEFAULT 'pendente',
  aprovador_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Ação 3 — Credenciais Omie no n8n
1. Abrir n8n → Credentials → New → HTTP Header Auth
2. Configurar: `app_key` e `app_secret` do Omie
3. Criar workflow: trigger "RC aprovada" (webhook Supabase) → POST Omie `/financas/contapagar/`

---

## 💰 Custo Total de Tecnologia

| Sistema | Decisão | Custo/mês estimado |
|---------|---------|-------------------|
| Omie ERP | Terceiro (já usa) | ~R$ 500-800 |
| Monday.com | Terceiro (já usa) | ~R$ 800-1.500 |
| RDO App | Terceiro | ~R$ 300-600 |
| Supabase Pro | TEG próprio | ~R$ 150 |
| n8n Cloud/VPS | TEG próprio | ~R$ 200-400 |
| Vercel Pro | TEG próprio | ~R$ 100 |
| Claude API | TEG próprio (AI) | ~R$ 200-500 |
| **TOTAL** | | **~R$ 2.250-4.350/mês** |

**Para faturamento de R$50M: menos de 0,1% da receita.**
**ROI estimado**: 300h/mês de trabalho manual eliminado × R$80/h = **R$24.000/mês** de produtividade.

---

*Documento atualizado em 28/02/2026 com base nas páginas 2-3 do PDF oficial*
*TEG+ Strategic Roadmap v2.0 — baseado na arquitetura definida*
