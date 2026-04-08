---
title: Runbook de Incidentes
type: dev-guide
status: ativo
tags: [runbook, incidentes, operacao, producao, emergencia]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[06 - Supabase]]", "[[10 - n8n Workflows]]", "[[15 - Deploy e GitHub]]", "[[37 - Troubleshooting FAQ]]"]
---

# 🚨 Runbook de Incidentes — TEG+ ERP

> Guia operacional para quando as coisas dão errado em produção.

---

## Severidade

| Nível | Descrição | Tempo resposta | Exemplo |
|-------|-----------|---------------|---------|
| 🔴 **SEV-1** | Sistema indisponível | < 30 min | App fora do ar, banco inacessível |
| 🟠 **SEV-2** | Funcionalidade crítica quebrada | < 2h | Aprovações não funcionam, login falha |
| 🟡 **SEV-3** | Funcionalidade secundária afetada | < 24h | Dashboard lento, relatório com erro |
| 🟢 **SEV-4** | Cosmético / menor | Próximo sprint | Texto errado, alinhamento, UX |

---

## Cenário 1: App Fora do Ar (SEV-1)

### Diagnóstico rápido

```
1. Vercel está online?
   → https://tegplus.com.br (abre?)
   → Vercel dashboard: https://vercel.com/dashboard

2. Supabase está online?
   → https://supabase.com/dashboard (status do projeto)
   → Verificar: Database, Auth, Storage

3. DNS está resolvendo?
   → nslookup tegplus.com.br
```

### Ações

| Causa | Ação |
|-------|------|
| Vercel deploy falhou | Reverter deploy anterior no dashboard Vercel |
| Supabase fora | Verificar status.supabase.com, aguardar ou abrir ticket |
| DNS | Verificar registros no provedor de domínio |
| Build quebrado | Verificar logs do último deploy, fazer rollback |

---

## Cenário 2: Login Não Funciona (SEV-2)

### Diagnóstico

```
1. Console do browser mostra que erro?
   → "Invalid login credentials" → Senha errada
   → "JWT expired" → Sessão expirou, limpar localStorage
   → "Network error" → Supabase Auth offline

2. Supabase Auth está respondendo?
   → Dashboard → Authentication → Users
```

### Ações

| Causa | Ação |
|-------|------|
| Auth service down | Aguardar Supabase, verificar status |
| Token expirado em massa | Bug no refresh — verificar `onAuthStateChange` |
| Variável de ambiente errada | Verificar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vercel |

---

## Cenário 3: Aprovações Travadas (SEV-2)

### Diagnóstico

```
1. Solicitações aparecem na lista?
   → Sim: Verificar se aprovador recebeu notificação
   → Não: Query do dashboard pode ter filtro errado

2. Token de aprovação funciona?
   → Testar URL do token manualmente
   → Verificar n8n workflow de aprovação

3. n8n workflow está ativo?
   → Verificar painel n8n → Executions
```

### Ações

| Causa | Ação |
|-------|------|
| n8n workflow inativo | Ativar workflow no painel n8n |
| WhatsApp não enviou | Verificar Evolution API, verificar número |
| Token inválido | Verificar se `apr_aprovacoes` tem registro com token |
| Alçada sem aprovador | Verificar `apr_alcadas` → aprovadores configurados |

---

## Cenário 4: Dados Errados / Desapareceram (SEV-2)

### Diagnóstico

```
1. RLS está bloqueando?
   → Testar mesma query com service_role key
   → Se retorna dados: problema é na policy

2. Dados foram deletados?
   → Verificar sys_log_atividades
   → Verificar se há soft delete (deleted_at)

3. Sync com Omie sobrescreveu?
   → Verificar execuções recentes do n8n
```

### Ações

| Causa | Ação |
|-------|------|
| RLS bloqueando | Ajustar policy ou perfil do usuário |
| Delete acidental | Restaurar do backup Supabase (ponto no tempo) |
| Omie sync errou | Corrigir mapeamento no n8n, reprocessar |

---

## Cenário 5: Performance Degradada (SEV-3)

### Diagnóstico

```
1. Qual tela está lenta?
   → DevTools → Network: qual query demora?
   → Supabase dashboard → Database → Query Performance

2. Tabela muito grande?
   → SELECT count(*) FROM tabela;

3. Índice faltando?
   → EXPLAIN ANALYZE <query lenta>;
```

### Ações

| Causa | Ação |
|-------|------|
| Query sem índice | `CREATE INDEX idx_xxx ON tabela(coluna);` |
| Select * desnecessário | Selecionar apenas colunas necessárias |
| Sem paginação | Implementar `.range()` no Supabase |
| Cache não configurado | Ajustar `staleTime` no TanStack Query |

---

## Cenário 6: n8n Parou (SEV-2)

### Diagnóstico

```
1. n8n está acessível?
   → Abrir painel: https://teg-agents-n8n.nmmcas.easypanel.host

2. Container está rodando?
   → EasyPanel dashboard → Status do serviço

3. Disco cheio?
   → Verificar espaço no EasyPanel
```

### Ações

| Causa | Ação |
|-------|------|
| Container parou | Restart no EasyPanel |
| Memória insuficiente | Aumentar recursos do container |
| Disco cheio | Limpar executions antigas no n8n (Settings → Pruning) |
| Atualização quebrou | Rollback da versão no EasyPanel |

---

## Contatos de Emergência

| Serviço | Onde escalar |
|---------|-------------|
| Vercel | https://vercel.com/support |
| Supabase | https://supabase.com/support + status page |
| EasyPanel (n8n) | Dashboard do provider |
| Domínio/DNS | Provedor de domínio |

---

## Post-Mortem Template

Após resolver qualquer SEV-1 ou SEV-2:

```markdown
## Post-Mortem — [Data] — [Título]

### Resumo
O que aconteceu em 1-2 frases.

### Timeline
- HH:MM — Problema detectado
- HH:MM — Diagnóstico iniciado
- HH:MM — Causa identificada
- HH:MM — Fix aplicado
- HH:MM — Sistema restaurado

### Causa raiz
Por que aconteceu.

### Impacto
Quantos usuários afetados, por quanto tempo.

### Ações preventivas
- [ ] O que fazer para não acontecer de novo
```

---

## Links

- [[37 - Troubleshooting FAQ]] — Erros comuns do dia a dia
- [[15 - Deploy e GitHub]] — Pipeline de deploy
- [[06 - Supabase]] — Configuração do banco
- [[10 - n8n Workflows]] — Automações
- [[41 - Segurança e RLS]] — Policies e permissões
