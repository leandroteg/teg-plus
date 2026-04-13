---
title: Módulo SSMA — Segurança, Saúde e Meio Ambiente
type: modulo
modulo: ssma
status: planejado
tags: [ssma, seguranca, saude, meio-ambiente, nr, epi, dds]
criado: 2026-03-12
atualizado: 2026-03-12
relacionado: ["[[PILAR - Projetos]]", "[[32 - Módulo Obras]]", "[[17 - Roadmap]]", "[[03 - Páginas e Rotas]]"]
---

# Módulo SSMA — Segurança, Saúde e Meio Ambiente

> Módulo planejado para gestão de segurança do trabalho, saúde ocupacional e meio ambiente nas obras da TEG. Atualmente implementado como stub informativo com roadmap de desenvolvimento Q2-Q4 2026.

---

## Estado Atual (2026-03-12)

O módulo SSMA está presente no sistema como uma **tela informativa** (`/ssma`) que exibe:
- Lista de funcionalidades planejadas com descrição
- Timeline de desenvolvimento por trimestre
- Botão de navegação de volta ao módulo seletor

Não há funcionalidades operacionais disponíveis neste momento.

---

## Implementação Atual

### `SSMA.tsx` — `/ssma`

Tela stub com roadmap visual:
- 8 funcionalidades planejadas listadas com ícone e descrição
- Timeline de 3 trimestres (Q2, Q3, Q4 2026)
- Paleta visual: verde esmeralda (identidade do módulo)

```
src/pages/SSMA.tsx   ← arquivo único, não possui subpáginas
```

---

## Funcionalidades Planejadas

| Funcionalidade | Regulação | Trimestre |
|----------------|-----------|-----------|
| Registro de ocorrências (acidentes, incidentes, quase-acidentes) | NR-4 | Q2 2026 |
| Gestão de EPIs (entrega, validade, devolução) | NR-6 | Q2 2026 |
| Checklist de segurança (inspeções periódicas digitais) | NR-10/NR-35 | Q3 2026 |
| Treinamentos NR (controle de capacitações obrigatórias) | NR-1 | Q3 2026 |
| Indicadores LTIFR e TRIFR | Benchmarking | Q3 2026 |
| Auditorias internas (planejamento + planos de ação) | NR-10/NR-35 | Q4 2026 |
| Gestão ambiental (resíduos, licenças, consumo) | CONAMA | Q4 2026 |
| PPRA / PCMSO Digital | NR-7/NR-9 | Q4 2026 |

---

## Roadmap de Desenvolvimento

### Q2 2026 — Base Operacional
- Registro de acidentes e incidentes (CAT — Comunicação de Acidente de Trabalho)
- Gestão de EPIs por colaborador com validade e histórico de entrega
- DDS Digital (Diálogo Diário de Segurança) com lista de presença
- Permissão de Trabalho (PT) para atividades de risco

### Q3 2026 — Checklists e Indicadores
- Checklists de inspeção digital com foto e assinatura eletrônica em campo
- Controle de treinamentos NR com alertas de vencimento de validade
- Indicadores LTIFR (Lost Time Injury Frequency Rate) e TRIFR
- Dashboard de segurança por obra

### Q4 2026 — Gestão Avançada
- Auditorias internas com planejamento e rastreamento de planos de ação corretiva
- Gestão ambiental: monitoramento de resíduos, licenças ambientais
- PPRA (Programa de Prevenção de Riscos Ambientais) digital
- PCMSO (Programa de Controle Médico de Saúde Ocupacional)
- ASO e exames periódicos dos colaboradores

---

## Integrações Previstas

| Módulo | Integração |
|--------|-----------|
| **Obras** | Ocorrências de campo registradas no RDO podem alimentar o SSMA |
| **RH** | Treinamentos NR vinculados ao cadastro de colaboradores |
| **Cadastros** | Colaboradores referenciados em `rh_colaboradores` |
| **PMO/EGP** | Indicadores de segurança podem compor o Status Report de obra |

---

## Schema do Banco (Planejado)

Prefixo de tabelas: `ssm_`

| Tabela | Descrição |
|--------|-----------|
| `ssm_ocorrencias` | Acidentes, incidentes e quase-acidentes |
| `ssm_epis` | Cadastro de EPIs disponíveis |
| `ssm_entrega_epi` | Histórico de entrega/devolução de EPIs por colaborador |
| `ssm_treinamentos` | Treinamentos e capacitações NR |
| `ssm_dds` | Registros de DDS com lista de presença |
| `ssm_permissoes_trabalho` | Permissões de Trabalho (PT) |
| `ssm_checklists` | Checklists de inspeção de segurança |
| `ssm_auditorias` | Auditorias internas e planos de ação |
| `ssm_indicadores` | Snapshots de LTIFR/TRIFR por obra e período |

---

## Controle de Vencimentos

O módulo implementa rastreamento automático de vencimento para 3 tipos de item:

| Item | Validade Típica | Alerta |
|------|-----------------|--------|
| **Treinamentos NR** | 1-2 anos conforme NR | 30 dias antes do vencimento |
| **EPIs** | Conforme fabricante (CA) | 30 dias antes da validade |
| **ASOs** | 6-12 meses conforme função | 30 dias antes do vencimento |

### Função `ssm_gerar_alertas_vencimento()`

Função PostgreSQL executada diariamente via cron/n8n que:
1. Verifica todos os treinamentos, EPIs e ASOs com validade nos próximos 30 dias
2. Gera alertas na tabela de notificações do sistema
3. Notifica o gestor de SSMA e o colaborador afetado

---

## Links Relacionados

- [[03 - Páginas e Rotas]] — Rota `/ssma`
- [[17 - Roadmap]] — Planejamento de desenvolvimento
- [[32 - Módulo Obras]] — Campo de execução
