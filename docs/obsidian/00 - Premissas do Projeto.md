---
title: Premissas do Projeto
type: premissas
status: ativo
tags: [premissas, arquitetura, design, desenvolvimento, estrategia]
criado: 2026-03-10
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[17 - Roadmap]]"]
---

# Premissas Centrais — TEG+ ERP

## 1. Premissas de Negocio

- **ERP modular para gestao de obras de engenharia eletrica e transmissao**
- 6 Polos operacionais totalizando 19 obras cadastradas (16 LDs + CD + DC + SEDE)
- Todas as obras em Minas Gerais, com SEDE em Campo Grande/MS
- **Cobertura completa** — 13 modulos implementados:

| # | Modulo | Status | Descricao |
|---|--------|--------|-----------|
| 1 | **Compras** | Implementado | Requisicoes 3-step wizard + AI, aprovacoes 4 alcadas token-based, cotacoes, PO |
| 2 | **Financeiro** | Implementado | CP, CR, aprovacoes, conciliacao CNAB, relatorios, NF, config, Omie ERP |
| 3 | **Estoque** | Implementado | Itens, movimentacoes, inventario, patrimonial/depreciacao |
| 4 | **Logistica** | Implementado | Transportes, recebimentos, expedicao, solicitacoes, transportadoras |
| 5 | **Frotas** | Implementado | Veiculos, OS manutencao, checklists, abastecimentos, telemetria |
| 6 | **Contratos** | Implementado | Gestao, medicoes, aditivos, reajustes, parcelas, assinaturas, equipe PJ, solicitacoes |
| 7 | **Cadastros** | Implementado | Empresas, fornecedores, obras, itens, colaboradores, centros custo, classes/categorias/grupos financeiros |
| 8 | **Fiscal** | Implementado | Emissao NF, solicitacao NF |
| 9 | **Controladoria** | Implementado | Orcamentos, DRE, KPIs, cenarios, plano/controle orcamentario, alertas desvio, indicadores |
| 10 | **PMO/EGP** | Implementado | Portfolio, EAP, cronograma, medicoes, histograma, custos, TAP, reunioes, multas, status report |
| 11 | **Obras** | Implementado | Apontamentos, RDO, adiantamentos, prestacao de contas, planejamento equipe |
| 12 | **RH/Mural** | Implementado | BannerSlideshow + MuralAdmin (admin only), RH Home |
| 13 | **SSMA** | Implementado | Seguranca, Saude e Meio Ambiente |

### Modulos Planejados
- RH completo (colaboradores, ponto, folha) — Q2 2026
- AI TEG+ Agent (Claude API nativo) — Q2-Q3 2026
- Monday.com PMO integracao — Q4 2026

---

## 2. Premissas de Design

> **WORLD CLASS TOP TIER** em UI/UX, estetica e retencao

- Cada tela deve ser **visualmente impecavel**, com micro-interacoes e feedback claro
- Padrao visual: `rounded-2xl`, shadows suaves, paleta consistente (**teal/violet/slate**)
- Sempre propor solucoes e melhorias com base nessa premissa
- Design responsivo e acessivel
- Animacoes sutis que agregam valor (nao decorativas)
- Hierarquia visual clara com espacamento generoso

---

## 3. Premissas de Desenvolvimento

- **Baseado em Arquitetura Limpa** — separacao clara de responsabilidades
- **Estruturado para escalar** — modulos independentes, prefixos de tabela, hooks customizados
- **Suporte imediato a 100 usuarios simultaneos** e mais de **5.000 movimentacoes/mes**
- TypeScript como linguagem padrao (tipagem estatica)
- Hooks customizados para cada dominio (17+ hooks)
- TanStack Query para cache inteligente e state management

---

## 4. Premissas Arquiteturais

- **n8n como hub de logica complexa** — orquestra workflows, AI parse, notificacoes, integracoes
- **Fallback direto ao Supabase** se n8n estiver indisponivel — resiliencia do sistema
- **Token-based approvals** — aprovadores externos acessam via link publico, sem login
- **RLS ativado em todas as tabelas** — seguranca por design no nivel do banco
- **6 roles de usuario** com controle de acesso granular
- **Cache agressivo** — TanStack Query com stale time configurado
- **Modular** — cada modulo tem prefixo de tabela proprio e escopo isolado

---

## 5. Premissas de Stack

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS 3.4 | UI, SPA, design system |
| Roteamento | React Router v6 | Navegacao SPA |
| State/Cache | TanStack Query v5 | Fetching, cache, state |
| Backend/DB | Supabase (PostgreSQL 15 + Auth + Realtime + RLS) | Persistencia, autenticacao, tempo real |
| Automacao | n8n (webhooks, orquestracao) | Logica de negocio complexa |
| Deploy | Vercel | Hosting + CDN |
| AI | Claude API (planejado) + LLM parse via n8n | Parsing, agente conversacional |

---

## 6. Premissas de Qualidade

- Codigo limpo e legivel
- Componentes reutilizaveis e bem tipados
- Padronizacao de nomenclatura (prefixos por modulo)
- Documentacao viva no Vault Obsidian (25+ docs)
- GitHub Issues integrado ao Dev Hub para tracking

---

## Links Relacionados

- [[01 - Arquitetura Geral]] — Visao tecnica completa
- [[17 - Roadmap]] — Planejamento de entregas
- [[02 - Frontend Stack]] — Detalhes do frontend
- [[06 - Supabase]] — Banco de dados e auth
- [[10 - n8n Workflows]] — Automacoes e webhooks
