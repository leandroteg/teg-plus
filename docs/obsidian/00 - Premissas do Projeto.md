---
title: Premissas do Projeto
type: premissas
status: ativo
tags: [premissas, arquitetura, design, desenvolvimento, estrategia]
criado: 2026-03-10
atualizado: 2026-04-07
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[17 - Roadmap]]"]
---

# Premissas Centrais — TEG+ ERP

## 1. Premissas de Negocio

- **ERP modular para gestao de obras de engenharia eletrica e transmissao**
- 6 Polos operacionais totalizando 19 obras de construcao cadastradas (16 LDs + CD + DC + SEDE)
- Todas as obras em Minas Gerais, com SEDE em Campo Grande/MS
- **Cobertura completa** — 16 modulos implementados:

| # | Modulo | Status | Descricao |
|---|--------|--------|-----------|
| 1 | **Compras** | Implementado | Requisicoes 3-step wizard + AI, aprovacoes 4 alcadas token-based, cotacoes com recomendacao AI, PO |
| 2 | **Financeiro** | Implementado | CP, CR, aprovacoes, conciliacao CNAB, relatorios, NF, config, Omie ERP |
| 3 | **Contratos** | Implementado | Gestao, medicoes, aditivos, reajustes, parcelas, assinaturas, equipe PJ, solicitacoes, minutas AI |
| 4 | **Controladoria** | Implementado | Orcamentos, DRE, KPIs, cenarios, plano/controle orcamentario, alertas desvio, indicadores |
| 5 | **Logistica** | Implementado | Transportes, recebimentos, expedicao, solicitacoes, planejamento de rota |
| 6 | **Estoque** | Implementado | Itens, movimentacoes, inventario |
| 7 | **Patrimonio** | Implementado | Imobilizados, depreciacao, baixas |
| 8 | **Frotas** | Implementado | Veiculos, OS manutencao, checklists, abastecimentos, telemetria, 3 sub-hubs |
| 9 | **Obras** | Implementado | Apontamentos, RDO, adiantamentos, prestacao de contas, planejamento equipe |
| 10 | **EGP/PMO** | Implementado | Portfolio, EAP, cronograma, medicoes, histograma, custos, TAP, reunioes, multas, status report |
| 11 | **RH** | Em evolucao | Headcount, cultura, endomarketing, Mural Admin |
| 12 | **Fiscal** | Implementado | Pipeline Kanban NF, solicitacao NF, historico |
| 13 | **Cadastros** | Implementado | Empresas, fornecedores, obras, itens, colaboradores, centros custo, classes/categorias/grupos financeiros |
| 14 | **Locacao** | **NOVO Abr 2026** | Contratos de locacao de equipamentos, medicoes, devolucoes |
| 15 | **SSMA** | Stub | Seguranca, Saude e Meio Ambiente — roadmap planejado |
| 16 | **HHT** | Planejado | Horas de trabalho e apontamentos |

### Modulos Planejados / Em Evolucao
- RH completo (colaboradores, ponto, folha) — Q2 2026
- SSMA completo (ocorrencias, EPIs, checklists NR, auditorias) — Q2-Q4 2026
- HHT (horas de trabalho) — Q3 2026
- AI TEG+ Agent (Claude API nativo) — Q2-Q3 2026
- Monday.com PMO integracao — Q4 2026

---

## 2. Premissas de Design

> **#1 WORLD CLASS TOP TIER** em UI/UX, estetica e retencao

- Cada tela deve ser **visualmente impecavel**, com micro-interacoes e feedback claro
- Padrao visual: `rounded-2xl`, shadows suaves, paleta consistente (**teal/violet/slate**)
- Sempre propor solucoes e melhorias com base nessa premissa
- Design responsivo e acessivel
- Animacoes sutis que agregam valor (nao decorativas)
- Hierarquia visual clara com espacamento generoso
- Dark mode completo via ThemeContext
- PWA-ready: install prompt, offline banner, push notifications

---

## 3. Premissas de Desenvolvimento

- **Baseado em Arquitetura Limpa** — separacao clara de responsabilidades
- **Estruturado para escalar** — modulos independentes, prefixos de tabela, hooks customizados
- **Suporte imediato a 100 usuarios simultaneos** e mais de **5.000 movimentacoes/mes**
- TypeScript como linguagem padrao (tipagem estatica)
- 47 hooks customizados para cada dominio
- TanStack Query para cache inteligente e state management
- Code splitting com React.lazy + Suspense (3 tipos de skeleton)
- 60+ componentes compartilhados, 30+ arquivos de tipos (4.551 linhas)

---

## 4. Premissas Arquiteturais

- **n8n como hub de logica complexa** — orquestra workflows, AI parse, notificacoes, integracoes
- **Fallback direto ao Supabase** se n8n estiver indisponivel — resiliencia do sistema
- **Token-based approvals** — aprovadores externos acessam via link publico, sem login
- **RLS ativado em todas as tabelas** — seguranca por design no nivel do banco
- **RBAC v2 com roles por setor** — `sys_perfil_setores`, `sys_roles`, `sys_role_permissoes` para controle granular de acesso por modulo e funcao
- **Cache agressivo** — TanStack Query com stale time configurado
- **Modular** — cada modulo tem prefixo de tabela proprio e escopo isolado (18 prefixos)
- **Motor de recomendacao** — `cotacaoRecomendacao` para sugestao inteligente de fornecedores em cotacoes
- **AI integrations** — Gemini 2.5 Flash para parsing de documentos, BrasilAPI como fallback para dados cadastrais
- **AprovAi como entry point separado** — `aprovaai-main.tsx` com bundle independente

---

## 5. Premissas de Stack

| Camada | Tecnologia | Versao | Responsabilidade |
|--------|-----------|--------|-----------------|
| Frontend | React + Vite + TypeScript + Tailwind CSS | 18.3 / 6.0 / 5.6 / 3.4 | UI, SPA, design system |
| Roteamento | React Router v6 | 6.28 | Navegacao SPA |
| State/Cache | TanStack Query v5 | 5.60 | Fetching, cache, state |
| Backend/DB | Supabase (PostgreSQL 15 + Auth + Realtime + RLS + Storage) | 2.45 | Persistencia, autenticacao, tempo real, arquivos |
| Automacao | n8n (EasyPanel Docker) | 2.35.6 | Logica de negocio complexa, webhooks |
| Deploy | Vercel (auto-deploy on main push) | — | Hosting + CDN |
| AI Parse | Gemini 2.5 Flash via n8n | — | Parsing de documentos e cotacoes |
| AI Cadastro | BrasilAPI | — | Fallback para CNPJ/CPF lookup |

---

## 6. Premissas de Qualidade

- Codigo limpo e legivel
- Componentes reutilizaveis e bem tipados
- Padronizacao de nomenclatura (prefixos por modulo: cmp_, fin_, con_, ctrl_, log_, est_, pat_, fro_, obr_, pmo_, rh_, ssm_, fis_, egp_, loc_, sys_)
- Documentacao viva no Vault Obsidian (35+ docs)
- GitHub Issues integrado ao Dev Hub para tracking
- 200+ paginas, 18 module layouts, lazy-loaded

---

## Links Relacionados

- [[01 - Arquitetura Geral]] — Visao tecnica completa
- [[17 - Roadmap]] — Planejamento de entregas
- [[02 - Frontend Stack]] — Detalhes do frontend
- [[06 - Supabase]] — Banco de dados e auth
- [[10 - n8n Workflows]] — Automacoes e webhooks
