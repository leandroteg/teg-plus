---
tipo: requisito
id: REQ-011
titulo: "Emissão de NF-e e NFS-e (SEFAZ / Prefeitura)"
categoria: funcional
prioridade: critica
status: planejado
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
tags: [requisito, financeiro, nfe, nfse, sefaz, prefeitura, fiscal]
---

# 📋 REQ-011 — Emissão de NF-e e NFS-e

## Descrição
Emissão de notas fiscais diretamente pelo TEG+ ou via Omie:
- **NF-e** (SEFAZ) — notas fiscais de produto/mercadoria
- **NFS-e** (Prefeitura) — notas fiscais de serviço

## Critérios de Aceite
- [ ] Emissão de NF-e integrada com SEFAZ (autorização, cancelamento, inutilização)
- [ ] Emissão de NFS-e integrada com a prefeitura municipal
- [ ] NF de Venda emitida gera automaticamente lançamento em Contas a Receber
- [ ] Armazenamento do XML e DANFE vinculado ao lançamento financeiro
- [ ] Cancelamento de NF registrado e vinculado ao estorno no financeiro
- [ ] Consulta de status da NF (autorizada, cancelada, denegada) em tempo real

## Integração com Omie
- Omie já possui emissão de NF — avaliar se o TEG+ delega para Omie via API
  ou se mantém emissão própria com dados espelhados

## Tarefas Relacionadas
- [[TASK-015 - Emissao Recebimento NFe]]
