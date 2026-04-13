---
title: Glossário
type: referência
status: ativo
tags: [glossário, termos, definições, referência]
criado: 2026-03-02
atualizado: 2026-04-07
relacionado: ["[[00 - TEG+ INDEX]]"]
---

# Glossário — TEG+ ERP

## Termos do Sistema

### A

**Acordo (Locação)**
Contrato de locação de equipamento entre a TEG e um fornecedor. Inclui valor, período, condições e vistoria de entrada/saída.
→ Ver módulo Locação

**Alçada**
Limite de autoridade financeira de um cargo para aprovar compras. No TEG+, há 4 níveis: Coordenador (até R$5k), Gerente (até R$25k), Diretor (até R$100k), CEO (sem limite).
→ Ver [[13 - Alçadas]]

**ApprovaAi**
Interface mobile do TEG+ otimizada para aprovadores. Rota: `/aprovaai`. Permite aprovar ou rejeitar requisições com um toque.
→ Ver [[03 - Páginas e Rotas]]

**Aprovação por Token**
Sistema de aprovação onde o aprovador recebe um link único (`/aprovacao/:token`) que pode ser aberto sem login. Cada token é um UUID válido por tempo limitado.
→ Ver [[12 - Fluxo Aprovação]]

**atLeast()**
Helper do [[09 - Auth Sistema|RBAC v2]] que verifica se o role do usuário é pelo menos tão alto quanto o informado. Ex: `atLeast('gerente')` retorna `true` para admin e gerente.

---

### B

**BaaS (Backend as a Service)**
Modelo de serviço onde funcionalidades de backend (banco de dados, autenticação, realtime) são fornecidas como serviço gerenciado. O Supabase é o BaaS do TEG+.

---

### C

**Categoria**
Classificação da requisição que determina o comprador responsável e as regras de cotação. O TEG+ possui 12+ categorias reais.
→ Ver [[14 - Compradores e Categorias]]

**CMP**
Prefixo das tabelas do módulo de Compras (`cmp_requisicoes`, `cmp_categorias`, etc.).
→ Ver [[07 - Schema Database]]

**Comprador**
Profissional responsável pela cotação e emissão de pedidos de uma ou mais categorias. No TEG+: Lauany, Fernando e Aline.
→ Ver [[14 - Compradores e Categorias]]

**Cotação**
Processo de consultar fornecedores e comparar preços para uma requisição aprovada. Obrigatório antes de emitir o pedido.

**cotacaoRecomendacao**
Motor de recomendação automática de fornecedor na cotação. Usa **scoring multi-critério** considerando: preço total, preço unitário, prazo de entrega, histórico do fornecedor e condições de pagamento. Exibe badges de recomendação no [[04 - Componentes|CotacaoComparativo]].

---

### D

**Dashboard**
Tela principal do módulo de Compras com KPIs, pipeline de requisições e gráficos por obra. Na versão atual, é um **dashboard unificado** que consolida RCs, cotações e pedidos.
→ Ver [[03 - Páginas e Rotas]]

**DashItem**
Componente interno do dashboard que representa um item individual na lista de itens recentes (requisição, cotação ou pedido).

---

### E

**EAP (Estrutura Analítica de Projeto)**
Decomposição hierárquica do escopo do projeto em pacotes de trabalho. No TEG+, gerenciada no módulo [[31 - Módulo PMO-EGP|PMO/EGP]].

**EPI/EPC**
Equipamento de Proteção Individual (EPI) / Equipamento de Proteção Coletiva (EPC). Categoria de compras gerenciada por Lauany.

**ERP**
Enterprise Resource Planning — sistema integrado de gestão empresarial. O TEG+ é um ERP modular focado em empresas de engenharia de transmissão.

---

### F

**Fallback**
Estratégia alternativa quando o serviço principal (n8n) está indisponível. O TEG+ faz insert direto no Supabase como fallback.
→ Ver [[10 - n8n Workflows]]

**file_url pattern**
Padrão de envio de arquivos grandes (>8MB) para o n8n. O frontend faz upload para Supabase Storage (`temp-uploads`) e envia apenas a URL para o workflow, em vez de base64 inline.
→ Ver [[10 - n8n Workflows]]

**Frota/Equipamentos**
Categoria de compras (veículos, máquinas pesadas) gerenciada por Fernando. Sempre exige mínimo Nível 2 (Gerente) de aprovação.

---

### H

**hasModule()**
Helper do [[09 - Auth Sistema|RBAC v2]] que verifica se o usuário tem acesso a um módulo específico. Admin sempre retorna `true`. Outros usuários são verificados via `sys_perfis.modulos`.

**hasSetorPapel()**
Helper do RBAC v2 que verifica se o usuário tem um papel específico em um setor/módulo. Parte do sistema de override de papéis por módulo (`getPapelForModule`).

**HHt**
Homem-Hora de trabalho. Módulo para tracking de horas por obra, base do custo real de mão de obra.
→ Ver [[17 - Roadmap]]

**Hook**
No contexto React, um hook customizado encapsula lógica de busca de dados (ex: `useDashboard`, `useRequisicoes`). No TEG+, todos os hooks usam TanStack Query.
→ Ver [[05 - Hooks Customizados]]

---

### I

**inlineData (Gemini)**
Método de envio de arquivos para a API do Google Gemini. O conteúdo do arquivo é enviado como base64 diretamente no payload JSON, no campo `inlineData.data` com o respectivo `mimeType`. Usado no workflow [[10 - n8n Workflows|AI Parse Cotação]].

**ItemRow**
Componente de linha de item dentro de tabelas de requisição, cotação ou pedido. Exibe descrição, quantidade, unidade e preço.

---

### K

**KPI**
Key Performance Indicator. No dashboard: total de requisições, pendentes, aprovadas, valor total, valor aprovado.

---

### L

**Locação**
Módulo para gestão de locação de equipamentos (guindastes, geradores, etc.). Fluxo: solicitação → vistoria de entrada → acordo → uso → vistoria de saída → devolução.

---

### M

**Magic Link**
Método de autenticação sem senha. O usuário recebe um email com link que faz login automaticamente. Oferecido pelo Supabase Auth.
→ Ver [[09 - Auth Sistema]]

**Migration**
Arquivo SQL versionado que altera o schema do banco de dados. O TEG+ tem 75 migrations numeradas sequencialmente.
→ Ver [[08 - Migrações SQL]]

**MOC (Map of Content)**
No Obsidian, uma nota índice que centraliza links para outras notas de um tema. `[[00 - TEG+ INDEX]]` é o MOC principal do vault.

---

### N

**n8n**
Plataforma open-source de automação de workflows. No TEG+, é o hub de orquestração entre o frontend e o Supabase.
→ Ver [[10 - n8n Workflows]]

**NF-e**
Nota Fiscal Eletrônica. Documento fiscal obrigatório para transações comerciais.

**Nível de Alçada**
Número (0-4) que indica o poder de aprovação de um usuário. Diferente do `role`, que indica a função no sistema.
→ Ver [[13 - Alçadas]]

---

### O

**Obra**
Projeto de engenharia elétrica/transmissão. No TEG+, há 6+ obras ativas, principalmente subestações (SE) em Minas Gerais.
→ Ver [[06 - Supabase]]

**Omie ERP**
Sistema ERP de gestão financeira integrado via n8n (sync CP, CR, fornecedores).
→ Ver [[19 - Integração Omie]]

---

### P

**PapelGlobal**
Hierarquia unificada de papéis no [[09 - Auth Sistema|RBAC v2]]: ceo (7), admin (6), diretor/gerente (5), supervisor/aprovador (4), gestor/equipe/comprador (3), requisitante (2), visitante (1).

**PMO**
Project Management Office. Escritório de gerenciamento de projetos. No TEG+, implementado como módulo EGP.
→ Ver [[31 - Módulo PMO-EGP]]

**PO (Purchase Order)**
Pedido de Compra. Documento emitido pelo comprador após aprovação da cotação.
→ Ver [[11 - Fluxo Requisição]]

**PrazoBar**
Componente visual que exibe uma barra de progresso do prazo de entrega de um item ou pedido. Cores mudam conforme proximidade do vencimento (verde → amarelo → vermelho).

---

### R

**RAG (Retrieval-Augmented Generation)**
Técnica de IA que combina busca em base de conhecimento com geração de linguagem natural. Planejado para o agente AI TEG+.
→ Ver [[17 - Roadmap]]

**RBAC v2**
Sistema de controle de acesso baseado em roles, segunda versão. Implementa hierarquia de papéis (`ROLE_NIVEL`), acesso por módulo (`hasModule`), comparação de nível (`atLeast`), e override por módulo (`getPapelForModule`).
→ Ver [[09 - Auth Sistema]]

**RC**
Requisição de Compra. Número no formato `RC-YYYYMM-XXXX`. Ex: `RC-202602-0042`.
→ Ver [[11 - Fluxo Requisição]]

**RDO (Relatório Diário de Obra)**
Documento que registra as atividades, condições climáticas, equipe mobilizada e ocorrências de cada dia de trabalho na obra. Gerenciado no módulo [[32 - Módulo Obras|Obras]].

**Realtime**
Funcionalidade do Supabase que envia atualizações via WebSocket quando dados mudam no banco.
→ Ver [[06 - Supabase]]

**Requisição**
Solicitação formal de compra criada por um requisitante. Passa pelos status: rascunho → em_aprovacao → aprovada → cotacao → pedido → entregue.
→ Ver [[11 - Fluxo Requisição]]

**RLS (Row Level Security)**
Funcionalidade do PostgreSQL que filtra registros baseado em políticas por usuário.
→ Ver [[06 - Supabase]]

**ROLE_NIVEL**
Constante no [[09 - Auth Sistema|AuthContext]] que mapeia cada role para um nível numérico: admin (5), gerente (4), aprovador (3), comprador (2), requisitante (1), visitante (0).

**RPC (Remote Procedure Call)**
Função executada diretamente no banco PostgreSQL via Supabase. Ex: `get_dashboard_compras()`.
→ Ver [[07 - Schema Database]]

---

### S

**Scoring multi-critério**
Algoritmo usado pelo motor de recomendação de cotações (`cotacaoRecomendacao`). Pondera preço, prazo, histórico do fornecedor e condições de pagamento para sugerir o melhor fornecedor.

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

**TAP (Termo de Abertura de Projeto)**
Documento formal que autoriza a existência de um projeto e fornece ao gerente de projeto a autoridade para aplicar recursos. No TEG+, gerenciado na tabela `egp_tap` do módulo [[31 - Módulo PMO-EGP|PMO/EGP]].

**Token de Aprovação**
UUID único gerado por aprovação, permite que o aprovador acesse a requisição sem login via URL.
→ Ver [[12 - Fluxo Aprovação]]

---

### U

**Urgência**
Classificação da necessidade da requisição: `normal`, `urgente`, `critica`. Impacta a priorização na fila de cotações.

---

### V

**Vistoria**
Inspeção documentada de um equipamento locado. Feita na entrada (recebimento) e na saída (devolução). Inclui checklist, fotos e assinatura. Permite comparação entre vistorias via [[04 - Componentes|VistoriaComparativo]].

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
| CON | Contratos (prefixo de tabela) |
| CTRL | Controladoria (prefixo de tabela) |
| EAP | Estrutura Analítica de Projeto |
| EPI | Equipamento de Proteção Individual |
| EPC | Equipamento de Proteção Coletiva |
| ERP | Enterprise Resource Planning |
| EST | Estoque (prefixo de tabela) |
| FIN | Financeiro (prefixo de tabela) |
| FIS | Fiscal (prefixo de tabela) |
| FRO | Frotas (prefixo de tabela) |
| HHt | Homem-Hora de trabalho |
| KPI | Key Performance Indicator |
| LOG | Logística (prefixo de tabela) |
| MOC | Map of Content (Obsidian) |
| NF-e | Nota Fiscal Eletrônica |
| OBR | Obras (prefixo de tabela) |
| PMO | Project Management Office |
| PO | Purchase Order (Pedido de Compra) |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| RC | Requisição de Compra |
| RDO | Relatório Diário de Obra |
| RLS | Row Level Security |
| RPC | Remote Procedure Call |
| SE | Subestação Elétrica |
| SPA | Single Page Application |
| SSM | SSMA (prefixo de tabela) |
| SYS | Sistema (prefixo de tabela) |
| TAP | Termo de Abertura de Projeto |

---

*Para navegar pelo vault completo, acesse [[00 - TEG+ INDEX]].*
