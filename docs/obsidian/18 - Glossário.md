---
title: Glossário
type: referência
status: ativo
tags: [glossário, termos, definições, referência]
criado: 2026-03-02
relacionado: ["[[00 - TEG+ INDEX]]"]
---

# Glossário — TEG+ ERP

## Termos do Sistema

### A

**Alçada**
Limite de autoridade financeira de um cargo para aprovar compras. No TEG+, há 4 níveis: Coordenador (até R$5k), Gerente (até R$25k), Diretor (até R$100k), CEO (sem limite).
→ Ver [[13 - Alçadas]]

**ApprovaAi**
Interface mobile do TEG+ otimizada para aprovadores. Rota: `/aprovaai`. Permite aprovar ou rejeitar requisições com um toque.
→ Ver [[03 - Páginas e Rotas]]

**Aprovação por Token**
Sistema de aprovação onde o aprovador recebe um link único (`/aprovacao/:token`) que pode ser aberto sem login. Cada token é um UUID válido por tempo limitado.
→ Ver [[12 - Fluxo Aprovação]]

---

### B

**BaaS (Backend as a Service)**
Modelo de serviço onde funcionalidades de backend (banco de dados, autenticação, realtime) são fornecidas como serviço gerenciado. O Supabase é o BaaS do TEG+.

---

### C

**Categoria**
Classificação da requisição que determina o comprador responsável e as regras de cotação. O TEG+ possui 12 categorias reais.
→ Ver [[14 - Compradores e Categorias]]

**Comprador**
Profissional responsável pela cotação e emissão de pedidos de uma ou mais categorias. No TEG+: Lauany, Fernando e Aline.
→ Ver [[14 - Compradores e Categorias]]

**Cotação**
Processo de consultar fornecedores e comparar preços para uma requisição aprovada. Obrigatório antes de emitir o pedido.

**CMP**
Prefixo das tabelas do módulo de Compras (`cmp_requisicoes`, `cmp_categorias`, etc.).
→ Ver [[07 - Schema Database]]

---

### D

**Dashboard**
Tela principal do módulo de Compras com KPIs, pipeline de requisições e gráficos por obra.
→ Ver [[03 - Páginas e Rotas]]

---

### E

**EPI/EPC**
Equipamento de Proteção Individual (EPI) / Equipamento de Proteção Coletiva (EPC). Categoria de compras gerenciada por Lauany.

**ERP**
Enterprise Resource Planning — sistema integrado de gestão empresarial. O TEG+ é um ERP modular focado em empresas de engenharia de transmissão.

---

### F

**Fallback**
Estratégia alternativa quando o serviço principal (n8n) está indisponível. O TEG+ faz insert direto no Supabase como fallback.
→ Ver [[10 - n8n Workflows]]

**Frota/Equipamentos**
Categoria de compras (veículos, máquinas pesadas) gerenciada por Fernando. Sempre exige mínimo Nível 2 (Gerente) de aprovação.

---

### H

**Hook**
No contexto React, um hook customizado encapsula lógica de busca de dados (ex: `useDashboard`, `useRequisicoes`). No TEG+, todos os hooks usam TanStack Query.
→ Ver [[05 - Hooks Customizados]]

**HHt**
Homem-Hora de trabalho. Módulo planejado para tracking de horas por obra.
→ Ver [[17 - Roadmap]]

---

### K

**KPI**
Key Performance Indicator. No dashboard: total de requisições, pendentes, aprovadas, valor total.

---

### M

**Magic Link**
Método de autenticação sem senha. O usuário recebe um email com link que faz login automaticamente. Oferecido pelo Supabase Auth.
→ Ver [[09 - Auth Sistema]]

**Migration**
Arquivo SQL versionado que altera o schema do banco de dados. O TEG+ tem 11 migrations numeradas sequencialmente.
→ Ver [[08 - Migrações SQL]]

**MOC (Map of Content)**
No Obsidian, uma nota índice que centraliza links para outras notas de um tema. `[[00 - TEG+ INDEX]]` é o MOC principal do vault.

---

### N

**n8n**
Plataforma open-source de automação de workflows. No TEG+, é o hub de orquestração entre o frontend e o Supabase.
→ Ver [[10 - n8n Workflows]]

**NF-e**
Nota Fiscal Eletrônica. Documento fiscal previsto na integração futura com Omie ERP.
→ Ver [[17 - Roadmap]]

**Nível de Alçada**
Número (1-4) que indica o poder de aprovação de um usuário. Diferente do `role`, que indica a função no sistema.
→ Ver [[13 - Alçadas]]

---

### O

**Obra**
Projeto de engenharia elétrica/transmissão. No TEG+, há 6 obras ativas, todas subestações (SE) em Minas Gerais.
→ Ver [[06 - Supabase]]

**Omie ERP**
Sistema ERP de gestão financeira previsto para integração futura via n8n.
→ Ver [[17 - Roadmap]]

---

### P

**PO (Purchase Order)**
Pedido de Compra. Documento emitido pelo comprador após aprovação da cotação.
→ Ver [[11 - Fluxo Requisição]]

**PMO**
Project Management Office. Escritório de gerenciamento de projetos. Integração planejada com Monday.com.

---

### R

**RAG (Retrieval-Augmented Generation)**
Técnica de IA que combina busca em base de conhecimento com geração de linguagem natural. Planejado para o agente AI TEG+.
→ Ver [[17 - Roadmap]]

**RC**
Requisição de Compra. Número no formato `RC-YYYYMM-XXXX`. Ex: `RC-202602-0042`.
→ Ver [[11 - Fluxo Requisição]]

**Realtime**
Funcionalidade do Supabase que envia atualizações via WebSocket quando dados mudam no banco. Usado para atualizar o dashboard automaticamente.
→ Ver [[06 - Supabase]]

**Requisição**
Solicitação formal de compra criada por um requisitante. Passa pelos status: rascunho → em_aprovacao → aprovada → cotacao → pedido → entregue.
→ Ver [[11 - Fluxo Requisição]]

**RLS (Row Level Security)**
Funcionalidade do PostgreSQL que filtra registros baseado em políticas por usuário. Garante que cada usuário veja apenas seus dados autorizados.
→ Ver [[06 - Supabase]]

**RPC (Remote Procedure Call)**
Função executada diretamente no banco PostgreSQL via Supabase. Ex: `get_dashboard_compras()`.
→ Ver [[07 - Schema Database]]

---

### S

**SE (Subestação Elétrica)**
Instalação elétrica que transforma tensão para transmissão ou distribuição de energia. As obras do TEG+ são todas SEs.

**SPA (Single Page Application)**
Aplicação web onde toda a navegação acontece sem recarregar a página. O TEG+ é uma SPA com React Router.

**Supabase**
BaaS open-source baseado em PostgreSQL. Fornece banco de dados, autenticação, realtime e APIs automáticas.
→ Ver [[06 - Supabase]]

**sys_**
Prefixo das tabelas de sistema (obras, usuários, logs, configurações).
→ Ver [[07 - Schema Database]]

---

### T

**TanStack Query**
Biblioteca de gerenciamento de estado assíncrono para React. Antes chamada React Query. Usada para fetching, caching e invalidação de dados.
→ Ver [[05 - Hooks Customizados]]

**Token de Aprovação**
UUID único gerado por aprovação, permite que o aprovador acesse a requisição sem login via URL.
→ Ver [[12 - Fluxo Aprovação]]

---

### U

**Urgência**
Classificação da necessidade da requisição: `normal`, `urgente`, `critica`. Impacta a priorização na fila de cotações.

---

### V

**Vite**
Build tool moderno para projetos web. Mais rápido que Webpack. Usado no TEG+ para build e dev server.
→ Ver [[02 - Frontend Stack]]

---

### W

**Webhook**
URL que aceita requisições HTTP para disparar workflows. O n8n expõe webhooks que o frontend chama.
→ Ver [[10 - n8n Workflows]]

---

## Siglas Rápidas

| Sigla | Significado |
|-------|------------|
| APR | Aprovações (prefixo de tabela) |
| CMP | Compras (prefixo de tabela) |
| EPI | Equipamento de Proteção Individual |
| EPC | Equipamento de Proteção Coletiva |
| ERP | Enterprise Resource Planning |
| HHt | Homem-Hora de trabalho |
| KPI | Key Performance Indicator |
| MOC | Map of Content (Obsidian) |
| NF-e | Nota Fiscal Eletrônica |
| PO | Purchase Order (Pedido de Compra) |
| PMO | Project Management Office |
| RAG | Retrieval-Augmented Generation |
| RC | Requisição de Compra |
| RLS | Row Level Security |
| RPC | Remote Procedure Call |
| SE | Subestação Elétrica |
| SPA | Single Page Application |
| SYS | Sistema (prefixo de tabela) |

---

*Para navegar pelo vault completo, acesse [[00 - TEG+ INDEX]].*
