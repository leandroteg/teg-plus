---
title: Changelog
type: dev-guide
status: ativo
tags: [changelog, releases, historico, versoes]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[17 - Roadmap]]", "[[15 - Deploy e GitHub]]"]
---

# 📝 Changelog — TEG+ ERP

> Histórico de releases e mudanças significativas.
> Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/)

---

## Como usar este documento

- Atualizar a cada deploy significativo
- Agrupar por tipo: Added, Changed, Fixed, Removed
- Referenciar issues/PRs quando aplicável
- Mais recente no topo

---

## [2026-06-26] — Controladoria: NIBO, Plano Orçamentário, Acompanhamento + Portal TEG

### Added
- **NIBO import** — 21.655 linhas de custos NIBO (dez/2023→jul/2025) carregadas em `fin_legado_custos` com `origem='nibo'`, R$ 68,4mi. Base total agora: 31.312 linhas (totvs 9.657 + nibo 21.655), R$ 95,2mi. TOTVS não foi tocado.
- **Plano Orçamentário V1/2026** — 168 linhas carregadas em `ctrl_orcamento_linhas` (14 categorias × 12 meses), R$ 65,72mi.
- **Investimentos** adicionado como categoria em `PlanoOrcamentario.tsx` (grupo "DESPESAS APÓS O LUCRO").
- **`vw_ctrl_realizado_categoria`** — nova view que agrega `fin_legado_custos` por (ano, mes, categoria) mapeando `grupo_dre` → categoria do plano; alimenta o Acompanhamento.
- **Filtro De → Até** em Relatórios Legado (seletores mês/ano independentes, default dez/23 → hoje); substituiu toggle "jun/25–mai/26 / Tudo".
- **Nomes de polo** no Relatórios Legado: F1→Frutal, F2→Três Marias, F3.1/3.2→Araxá/Perdizes, F3.3/3.4→Patrocínio/Ituiutaba, F3.5/3.6/3.7→Uberlândia, F3.12→Paracatu, F4→Rio Paranaíba, F8→Comendador Gomes.
- **Filtro por trimestre** no Acompanhamento: 1º-4º Tri (codificados 101-104); `mesesDoFiltro()` em `useControladoria.ts`.
- **"Ano todo"** como filtro padrão do Acompanhamento (antes era mês atual).
- **Portal TEG** — botão Ponto corrigido para `https://autenticador.secullum.com.br/Authorization?...`; logos atualizadas (login: "Teg União TRANSIÇÃO", header: "Teg TRANSIÇÃO").

### Changed
- **Budget por Centro de Custo** — `Orcamentos.tsx` agora filtra/exibe por `centro_custo_id` em vez de `obra_id`; migration `ctrl_orcamentos_centro_custo` adicionou FK + tornou `obra_id` nullable.
- **Materiais sem EPIs** — "Materiais (Aço, Concreto, EPIs)" → "Materiais (Aço, Concreto)" em `PlanoOrcamentario.tsx` e `ControleOrcamentario.tsx`.
- **Acompanhamento sem subtítulos** — removidos textos "Painel Executivo de Acompanhamento..." e "Contas marcadas com ★..." para ganhar espaço.

### Removed
- **"Controle Projetos"** removido da navegação lateral da Controladoria (`ControladoriaLayout.tsx`).
- **"Cenários"** removido da navegação lateral da Controladoria.
- **"Visão Executiva"** removida do hub Controle Orçamentário (`ControleOrcamentarioHub.tsx`).
- **4 KPI cards** removidos do `PlanoOrcamentario.tsx` (Faturamento Real vs Meta, Margem Líquida, Desvio de Custos, Fluxo de Caixa).

---

## [2026-06-17] — Painel de Pagamentos Previstos + Fatura ↔ CP (Cartão & Locação)

### Added
- **Painel de Pagamentos — filtro de escopo**: dropdown ao lado de "Exportar PDF" com opções **Todos em aberto / Apenas previstos / Apenas confirmados**. Filtra a lista exibida na tela (`useCPsParaPagamento` aceita lista de statuses) e o título/rodapé/arquivo do PDF gerencial refletem o escopo. CPs não-aprovados ficam visíveis mas não-selecionáveis para batch payment; cada linha ganha badge de status (`Previsto` / `Confirmado` / `Aguard. Aprov.` / `Aprovado` / `Em pagamento`).
- **Cartão → CP (Previsão de Pagamento)** — migration **146**: `fin_contas_pagar.fatura_id` (FK `fin_faturas_cartao`) + RPC `cartao_enviar_fatura_financeiro(uuid[])` cria CP `previsto` por fatura, idempotente (pula se já enviada, sem valor ou sem vencimento), retorna `{enviadas, puladas, motivos[]}`. Botão **"Enviar ao Financeiro"** na tela de Conciliação Cartões; faixa verde "Fatura enviada · CP {status}" com pílula amber "Conciliação parcial (X/Y)" enquanto itens não estão 100% conciliados. Badge **"Fatura X/Y"** no Painel de Pagamentos por linha de CP de fatura (verde se 100%, amber se parcial).
- **Locação → CP** — migration **147**: `fin_contas_pagar.loc_fatura_id` (FK `loc_faturas`) + RPC `loc_enviar_faturas_financeiro` atualizado para preencher o vínculo, ficar idempotente e retornar `motivos[]`. Badge indigo **"Locação YYYY-MM"** no Painel de Pagamentos com tooltip de imóvel + tipo de fatura.

### Fixed
- **Check constraint `fin_contas_pagar_origem_check`** (migration 146b) — ampliada para aceitar `'cartao_fatura'` e `'locacao'`. Antes do fix, **TODO envio de fatura de locação ao financeiro falhava em silêncio** porque a constraint não incluía `'locacao'`. RPC `loc_enviar_faturas_financeiro` (criado em 124) ficou inerte por meses por causa disso.
- **Label `Emissão`** com escape Unicode literal (`Emissão`) no card de Contas a Pagar — JSX text não processa `\u`, renderizava cru. Mesmo bug em 4 ocorrências de `Divergência` no mesmo arquivo (essas funcionavam por estarem dentro de strings JS).

### Changed
- `useEnviarFaturasFinanceiro` (locação) e novo `useEnviarFaturaFinanceiro` (cartão) retornam `motivos[]` para feedback granular ao operador.
- `OrigemCP` aceita `'cartao_fatura' | 'locacao'` (TS).

---

## [2026-04-08] — Correções Contratos & Docs Overhaul

### Fixed
- **Timezone dates** — Datas date-only não deslocam mais -1 dia em BRT (#198)
- **AprovAi back button** — Botão voltar sempre visível, inclusive em PWA standalone (#200)
- **Resumo Executivo** — Dados factuais do contrato priorizados sobre parecer AI (#199)

### Changed
- Label "Parecer / Resumo Executivo" → "Resumo do Contrato" no AprovAi

### Added
- Documentação completa: 14 novos docs DEV (onboarding, ADRs, APIs, testes, segurança, etc.)
- Cores no grafo Obsidian por tipo de documento
- 32 design docs conectados ao Roadmap
- Phantom nodes eliminados (links com acentos corrigidos)

---

## [2026-04-07] — Módulo Contratos v2

### Added
- Fluxo completo: Solicitação → Análise → Minuta → Aprovação → Assinatura
- Resumo Executivo AI (análise automática de minutas)
- Parcelas com geração automática
- Medições contratuais
- Equipe PJ vinculada a contratos
- Regra R$2.000 para obrigatoriedade de contrato

---

## [2026-03-25] — Integração Omie

### Added
- Sync contas a pagar TEG+ ↔ Omie
- Sync contas a receber
- Mapeamento de categorias e centros de custo
- n8n workflows de reconciliação

---

## [2026-03-20] — Upload Inteligente Cotações

### Added
- AI parse de PDFs de cotação (extração automática de itens e valores)
- Recomendação AI de melhor cotação
- Comparativo automático entre fornecedores

---

## [2026-03-15] — AprovAi PWA

### Added
- AprovAi como PWA standalone (instalar no celular)
- Aprovação via token por WhatsApp e email
- Suporte offline básico

---

## [2026-03-10] — Aprovações Multi-nível

### Added
- 4 alçadas de aprovação por valor
- Token único para aprovação externa
- Notificações WhatsApp automáticas
- Dashboard de aprovações pendentes

---

## [2026-03-01] — MVP TEG+

### Added
- Módulo Compras (requisições, cotações, pedidos)
- Módulo Financeiro (CP, CR básico)
- Auth com Supabase (email + magic link)
- Dashboard principal com KPIs
- Deploy Vercel + Supabase + n8n

---

## Template para nova entrada

```markdown
## [YYYY-MM-DD] — Título da Release

### Added
- Nova feature X

### Changed
- Alteração em Y

### Fixed
- Correção do bug Z (#issue)

### Removed
- Remoção de W (depreciado)
```

---

## Links

- [[17 - Roadmap]] — Planejamento futuro
- [[15 - Deploy e GitHub]] — Pipeline de deploy
- [[40 - ADRs Index]] — Decisões arquiteturais
