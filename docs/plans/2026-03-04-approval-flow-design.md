# Fluxo de Aprovação Completo — Design

**Data:** 2026-03-04
**Status:** Aprovado

## Contexto

O sistema TEG+ precisa de melhorias no fluxo de aprovação de requisições de compra:
1. "Pedir esclarecimentos" com flag dedicada
2. Campo de comentários nas decisões
3. Integração com AprovAi (tabela `apr_aprovacoes` atualmente vazia)
4. Página de detalhes da requisição (`/requisicoes/:id`)

## Decisões

- **Esclarecimento**: novo status `em_esclarecimento` (enum `status_requisicao` + `status_aprovacao`)
- **Detalhes**: página inteira `/requisicoes/:id` (consistente com padrão `/cotacoes/:id`)
- **AprovAi**: auto-criar registro em `apr_aprovacoes` quando admin decide

## 1. Banco de Dados

### Novos valores enum
- `status_requisicao`: adicionar `em_esclarecimento`
- `status_aprovacao`: adicionar `esclarecimento`

### Novas colunas em `cmp_requisicoes`
- `esclarecimento_msg` text — mensagem do aprovador
- `esclarecimento_por` varchar — nome de quem pediu
- `esclarecimento_em` timestamptz — quando pediu

## 2. Auto-criação de `apr_aprovacoes`

Quando admin decide via ListaRequisicoes ou RequisicaoDetalhe:
- Cria registro em `apr_aprovacoes` com dados do perfil logado
- `entidade_id` = RC id, `nivel` = alcada_nivel da RC
- `status` = decisão (aprovada/rejeitada/esclarecimento)
- `observacao` = comentário, `data_decisao` = now()

## 3. Página `/requisicoes/:id`

### Hook `useRequisicao(id)`
- Busca RC + join `cmp_requisicao_itens(*)`

### Componente `RequisicaoDetalhe.tsx`
- Header: número, urgência, status badge
- FluxoTimeline
- Grid metadados: obra, solicitante, categoria, valor, data
- Tabela de itens
- Justificativa
- Bloco esclarecimento (se flag ativa)
- Botões admin: Aprovar / Rejeitar / Pedir Esclarecimento + campo comentário

### Cards clicáveis em ListaRequisicoes
- `onClick` → navigate(`/requisicoes/${r.id}`)

## 4. Pedir Esclarecimento

- Botão âmbar, terceiro botão ao lado de Aprovar/Rejeitar
- Campo mensagem obrigatório
- Ação: status RC → `em_esclarecimento`, salva campos, cria registro apr_aprovacoes
- Pipeline tab "Esclarec." na ListaRequisicoes
- Badge + chip com mensagem truncada

## 5. AprovAi

- Já funciona quando `apr_aprovacoes` tem dados
- Adicionar botão esclarecimento no AprovacaoCard
- Link "Ver detalhes" → `/requisicoes/:id`

## 6. Comentários

- Textarea em todos os pontos de decisão
- Obrigatório para esclarecimento, opcional para aprovar/rejeitar
- Salvo em `apr_aprovacoes.observacao`


## Links
- [[obsidian/12 - Fluxo Aprovação]]
