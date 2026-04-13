---
title: Disaster Recovery
type: dev-guide
status: ativo
tags: [disaster-recovery, backup, restore, rto, rpo, continuidade]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[06 - Supabase]]", "[[43 - Runbook de Incidentes]]"]
---

# 🛡️ Disaster Recovery — TEG+ ERP

---

## Objetivos

| Métrica | Meta | Significado |
|---------|------|-------------|
| **RTO** (Recovery Time Objective) | < 4 horas | Tempo máximo para restaurar o sistema |
| **RPO** (Recovery Point Objective) | < 1 hora | Perda máxima de dados aceitável |

---

## Componentes e Estratégia de Backup

### 1. Banco de Dados (Supabase PostgreSQL)

| Item | Detalhe |
|------|---------|
| Backup automático | Supabase Pro: daily snapshots (retenção 7 dias) |
| Point-in-time Recovery | Supabase Pro: até 7 dias atrás |
| Backup manual | `pg_dump` via connection string |
| Frequência recomendada | Diário automático + manual antes de migrações |

**Restaurar backup:**
1. Supabase Dashboard → Settings → Database → Backups
2. Selecionar ponto no tempo
3. Restaurar para branch ou novo projeto

**Backup manual:**
```bash
# Exportar (rodar em máquina com acesso)
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres -F c -f backup_$(date +%Y%m%d).dump

# Restaurar
pg_restore -h db.xxxxx.supabase.co -U postgres -d postgres backup_20260408.dump
```

---

### 2. Código-fonte (GitHub)

| Item | Detalhe |
|------|---------|
| Repositório | `leandroteg/teg-plus` |
| Branches protegidas | `main` |
| Backup | GitHub mantém + git local em cada dev |
| Risco | Praticamente zero (distribuído) |

---

### 3. Arquivos (Supabase Storage)

| Item | Detalhe |
|------|---------|
| Buckets | cotacoes, contratos, notas-fiscais, comprovantes, obras |
| Backup | Não automático — requer script manual |
| Risco | Médio — arquivos NF/contratos são críticos |

**Script de backup Storage (recomendado mensal):**
```bash
# Via Supabase CLI
supabase storage cp -r supabase://cotacoes ./backup/cotacoes/
supabase storage cp -r supabase://contratos ./backup/contratos/
supabase storage cp -r supabase://notas-fiscais ./backup/notas-fiscais/
```

---

### 4. n8n Workflows

| Item | Detalhe |
|------|---------|
| Instância | EasyPanel Docker |
| Backup | Exportar workflows como JSON |
| Frequência | Antes de qualquer atualização |

**Exportar todos os workflows:**
```bash
# Via n8n CLI ou API
curl -X GET "https://teg-agents-n8n.nmmcas.easypanel.host/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" > workflows_backup_$(date +%Y%m%d).json
```

---

### 5. Frontend (Vercel)

| Item | Detalhe |
|------|---------|
| Deploy | Automático a partir do GitHub |
| Rollback | Vercel dashboard → Deployments → Deploy anterior |
| Risco | Baixo — rebuild a partir do git |

---

## Cenários de Desastre

### Cenário A: Perda total do banco de dados

```
1. Parar frontend (manutenção) → Vercel: pausar
2. Restaurar backup Supabase (PITR)
3. Verificar integridade dos dados
4. Reativar frontend
5. Notificar usuários sobre possível perda de dados recentes
```

**Tempo estimado**: 2-4 horas

---

### Cenário B: Supabase project deletado

```
1. Criar novo projeto Supabase
2. Restaurar último pg_dump
3. Recriar Storage buckets + reupload arquivos
4. Atualizar variáveis de ambiente (Vercel + n8n)
5. Atualizar DNS/URLs se necessário
6. Testar auth, queries, storage
```

**Tempo estimado**: 4-8 horas

---

### Cenário C: n8n corrompido

```
1. Reimplantar container n8n no EasyPanel
2. Importar workflows do backup JSON
3. Reconfigurar credenciais (Supabase, Omie, WhatsApp)
4. Testar cada workflow crítico
```

**Tempo estimado**: 1-2 horas

---

### Cenário D: Conta GitHub comprometida

```
1. Revogar tokens e sessões
2. Ativar 2FA se não ativo
3. Verificar commits recentes (nenhum malicioso?)
4. Regenerar deploy tokens do Vercel
5. Rotacionar secrets do repositório
```

**Tempo estimado**: 1 hora

---

## Checklist de Prevenção

- [ ] Backup automático Supabase ativo (plano Pro)
- [ ] pg_dump manual semanal
- [ ] Export n8n workflows mensal
- [ ] Backup Storage mensal
- [ ] 2FA ativo no GitHub, Supabase, Vercel
- [ ] Secrets rotacionados a cada 90 dias
- [ ] Teste de restore trimestral
- [ ] Documentação atualizada

---

## Calendário de Backup

| O quê | Frequência | Responsável | Método |
|-------|-----------|-------------|--------|
| Database | Diário (auto) + semanal (manual) | Auto / DevOps | Supabase PITR + pg_dump |
| Storage | Mensal | DevOps | Script supabase CLI |
| n8n Workflows | Mensal + antes de updates | DevOps | API export JSON |
| Teste de Restore | Trimestral | Tech Lead | Restore em projeto staging |

---

## Links

- [[06 - Supabase]] — Configuração do banco
- [[10 - n8n Workflows]] — Automações
- [[15 - Deploy e GitHub]] — Deploy
- [[43 - Runbook de Incidentes]] — Resposta a incidentes
- [[41 - Segurança e RLS]] — Segurança
