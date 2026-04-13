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
