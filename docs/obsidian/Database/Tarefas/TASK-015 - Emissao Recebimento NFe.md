---
tipo: tarefa
id: TASK-015
titulo: "Emissão NF-e/NFS-e e Recebimento de NF de Entrada"
status: backlog
prioridade: alta
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
estimativa: 8
gasto: 0
tags: [task, financeiro, nfe, nfse, sefaz, prefeitura, fiscal]
---

# 📋 TASK-015 — Emissão e Recebimento de NF

## Descrição
Integração fiscal para emissão de NF-e (SEFAZ) e NFS-e (Prefeitura), além do recebimento e processamento de NFs de fornecedores.

## Subtarefas

### Emissão NF-e / NFS-e
- [ ] Avaliar: emissão própria TEG+ × delegação para Omie via API
- [ ] Integração com SEFAZ: autorização, cancelamento, inutilização
- [ ] Integração com Prefeitura: emissão e cancelamento NFS-e
- [ ] NF emitida → CR criado automaticamente no Omie
- [ ] Armazenamento XML + DANFE vinculado ao lançamento

### Recebimento de NF de Entrada (Fornecedores)
- [ ] Importação automática de XML via e-mail ou portal SEFAZ
- [ ] Validação XML contra PO (valores, itens, CNPJ)
- [ ] Divergências alertadas ao comprador
- [ ] NF vinculada ao CP correspondente no Omie
- [ ] Histórico de NFs acessível para Contabilidade

### Consulta CNPJ
- [ ] Busca automática de dados de fornecedor via CNPJ (Receita Federal)

## Requisitos Relacionados
- [[REQ-011 - Emissao NF-e NFS-e]]
- [[REQ-012 - Contas a Receber e NF Entrada]]

## Milestone
[[MS-004 - Modulo Financeiro]]
