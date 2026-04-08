---
title: Performance e Monitoring
type: dev-guide
status: ativo
tags: [performance, monitoring, metricas, alertas, observabilidade]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[06 - Supabase]]", "[[43 - Runbook de Incidentes]]"]
---

# 📊 Performance & Monitoring — TEG+ ERP

---

## Métricas Chave

### Frontend

| Métrica | Meta | Onde medir |
|---------|------|-----------|
| LCP (Largest Contentful Paint) | < 2.5s | Vercel Analytics / Lighthouse |
| FID (First Input Delay) | < 100ms | Vercel Analytics |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| Bundle size | < 500KB gzip | `npm run build` → output |
| Tempo de login | < 3s | Manual / E2E test |

### Backend (Supabase)

| Métrica | Meta | Onde medir |
|---------|------|-----------|
| Query response time | < 200ms (p95) | Supabase Dashboard → Database |
| Auth response time | < 500ms | Supabase Dashboard → Auth |
| Storage upload | < 5s (5MB) | Manual |
| Conexões ativas | < 50 | Supabase Dashboard |
| Disco usado | < 80% limite | Supabase Dashboard |

### n8n

| Métrica | Meta | Onde medir |
|---------|------|-----------|
| Execução por workflow | < 10s | n8n Executions |
| Taxa de erro | < 5% | n8n Executions (filtrar failed) |
| Fila pendente | < 20 | n8n dashboard |

---

## Onde Olhar Quando "Tá Lento"

### Passo 1: Identificar o gargalo

```
Browser DevTools → Network tab
├── Vermelho/lento? → Supabase query lenta
├── Muitas requests? → N+1 query (falta join)
├── Bundle grande? → Code splitting necessário
└── Render lento? → React DevTools Profiler
```

### Passo 2: Diagnóstico por camada

| Camada | Ferramenta | Como verificar |
|--------|-----------|----------------|
| Frontend render | React DevTools Profiler | Componentes re-renderizando demais? |
| Network | DevTools Network | Qual request demora? |
| Cache | TanStack Query DevTools | Cache está funcionando? `staleTime` ok? |
| Database | Supabase SQL Editor | `EXPLAIN ANALYZE <query>` |
| n8n | n8n Executions | Qual nó demora no workflow? |

### Passo 3: Soluções comuns

| Problema | Solução |
|----------|---------|
| Query sem índice | `CREATE INDEX` na coluna filtrada |
| `SELECT *` | Selecionar apenas colunas necessárias |
| Sem paginação | `.range(0, 49)` no Supabase |
| Cache não usado | `staleTime: 5 * 60 * 1000` no useQuery |
| Re-render excessivo | `useMemo`, `React.memo` |
| Bundle grande | `React.lazy()` + `Suspense` |
| N+1 queries | Usar joins no Supabase: `.select('*, tabela(*)')` |

---

## TanStack Query — Configuração de Cache

```typescript
// Padrão recomendado por tipo de dado
const CACHE_CONFIG = {
  // Dados que mudam pouco (obras, categorias, config)
  estatico: { staleTime: 30 * 60 * 1000 },  // 30 min
  
  // Dados operacionais (requisições, contratos)
  operacional: { staleTime: 2 * 60 * 1000 },  // 2 min
  
  // Dados em tempo real (dashboard, aprovações)
  realtime: { staleTime: 30 * 1000 },  // 30 seg
}
```

---

## Índices Importantes

```sql
-- Índices que devem existir para performance
CREATE INDEX IF NOT EXISTS idx_requisicoes_obra ON cmp_requisicoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON cmp_requisicoes(status);
CREATE INDEX IF NOT EXISTS idx_contratos_obra ON con_contratos(obra_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON con_contratos(status);
CREATE INDEX IF NOT EXISTS idx_cp_obra ON fin_contas_pagar(obra_id);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON fin_contas_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_ref ON apr_aprovacoes(referencia_id);
CREATE INDEX IF NOT EXISTS idx_log_solicitacoes_viagem ON log_solicitacoes(viagem_id);
CREATE INDEX IF NOT EXISTS idx_transportes_viagem ON log_transportes(viagem_id);
```

---

## Alertas Recomendados

| Alerta | Condição | Canal |
|--------|----------|-------|
| App offline | HTTP 5xx por 2+ min | WhatsApp tech lead |
| DB lento | Query > 5s | Email dev team |
| n8n falha | 3+ executions failed consecutivas | WhatsApp |
| Disco > 80% | Supabase storage | Email |
| Auth failures spike | > 50 em 5 min | Email (possível ataque) |

---

## Links

- [[01 - Arquitetura Geral]] — Stack completo
- [[06 - Supabase]] — Configuração do banco
- [[43 - Runbook de Incidentes]] — O que fazer quando cai
- [[37 - Troubleshooting FAQ]] — Problemas comuns
