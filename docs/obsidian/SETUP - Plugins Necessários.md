---
title: "⚙️ SETUP — Plugins e Configuração"
type: setup
tags: [setup, obsidian, plugins, dataview, configuracao]
criado: 2026-03-02
atualizado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]"]
---

# ⚙️ Setup do Vault TEG+

> Siga estes passos na primeira vez que abrir este vault no Obsidian.

---

## 1. Plugin Obrigatório — Dataview

Os painéis de gestão dependem do **Dataview** para funcionar.

### Instalação:
1. Abra o Obsidian → `Settings (⚙️)` → `Community plugins`
2. Desabilite o **Safe mode** se necessário
3. Clique em **Browse** → pesquise **"Dataview"**
4. Instale e **habilite** o plugin

### Configuração do Dataview:
Após instalar, vá em `Settings → Dataview` e habilite:
- ✅ **Enable JavaScript Queries** — necessário para os painéis com `dataviewjs`
- ✅ **Enable Inline Queries**
- ✅ **Automatic View Refreshing**

---

## 2. Plugins Recomendados (Opcionais)

| Plugin | Uso | Prioridade |
|--------|-----|-----------|
| **Obsidian Git** | Sync automático com GitHub | 🔴 Alta |
| **Calendar** | Visualizar notas por data | 🟡 Média |
| **Kanban** | Board visual de tarefas | 🟡 Média |
| **Templater** | Templates para novas notas | 🟢 Baixa |
| **Minimal Theme Settings** | Tema minimalista | 🟢 Baixa |

---

## 3. Obsidian Git — Sync com GitHub

Para manter o vault sincronizado com o repositório:

1. Instale o plugin **Obsidian Git**
2. Abra `Settings → Obsidian Git`
3. Configure:
   - **Auto pull interval:** `10` (minutos)
   - **Auto push interval:** `5` (minutos)
   - **Commit message:** `vault: auto-sync {{date}}`
4. Pronto — o vault sincroniza automaticamente!

---

## 4. Estrutura do Vault

```
docs/obsidian/                 ← Raiz do vault
│
├── 📊 Paineis/                ← Dashboards Dataview (NÃO editar diretamente)
│   ├── PAINEL PRINCIPAL.md    → Central de comando com KPIs
│   ├── BI Dashboard.md        → Visao executiva com graficos
│   ├── Dev Hub BI.md          → Analytics de desenvolvimento
│   ├── Tasks Board.md         → Kanban de tarefas
│   ├── Roadmap Board.md       → Timeline de milestones
│   ├── Issues Board.md        → Tracker de bugs
│   ├── Execucao Board.md      → Pipeline de melhorias (GitHub)
│   ├── Requisitos Board.md    → Rastreabilidade de requisitos
│   ├── Relatorio Dev.md       → Scorecard semanal
│   ├── Compras Dashboard.md   → Dashboard modulo Compras
│   ├── Financeiro Dashboard   → Dashboard modulo Financeiro
│   ├── Estoque Dashboard.md   → Dashboard modulo Estoque
│   ├── Logistica Dashboard    → Dashboard modulo Logistica
│   ├── Frotas Dashboard.md    → Dashboard modulo Frotas
│   ├── Cadastros Dashboard    → Dashboard modulo Cadastros
│   └── RH Dashboard.md        → Dashboard modulo RH
│
├── 🗄️ Database/               ← AQUI voce edita para atualizar os paineis
│   ├── Tarefas/               → TASK-XXX.md (30 tarefas)
│   ├── Issues/                → ISSUE-XXX.md (8 issues)
│   ├── Requisitos/            → REQ-XXX.md (18 requisitos)
│   └── Milestones/            → MS-XXX.md (14 milestones)
│
├── 📋 Requisitos/             ← Planos de arquitetura
│   └── PLAN-CONTRATOS-v2.md   → Plano contratos v2 (concluido)
│
├── 📚 Documentacao Tecnica    ← Notas numeradas (00 a 34)
│   ├── 00 - TEG+ INDEX.md    → Mapa central (comece aqui!)
│   ├── 00 - Premissas.md     → Premissas do projeto
│   ├── 01..18 - Infra         → Arquitetura, frontend, DB, auth, etc.
│   ├── 19..26 - Funcional     → Integracao Omie, financeiro, estoque, etc.
│   └── 27..34 - Modulos       → Contratos, fiscal, controladoria, etc.
│
└── SETUP - Plugins Necessarios.md ← Esta nota
```

---

## 5. Como Atualizar os Painéis

Os painéis são **100% automáticos** — você só edita os arquivos de banco de dados:

### Mover uma tarefa no kanban:
```yaml
# Abra Database/Tarefas/TASK-005 - Notificacoes WhatsApp.md
# Mude o campo:
status: em-andamento  →  status: revisao
```
→ A tarefa muda de coluna no **Tasks Board** instantaneamente.

### Atualizar progresso de milestone:
```yaml
# Abra Database/Milestones/MS-002 - Cotacoes e Notificacoes.md
# Mude o campo:
progresso: 20  →  progresso: 45
```
→ A barra de progresso atualiza no **Roadmap Board**.

### Criar nova tarefa:
1. Duplicar qualquer nota de `Database/Tarefas/`
2. Renomear: `TASK-013 - Nome da Tarefa.md`
3. Editar frontmatter
4. Aparece automaticamente em todos os painéis

### Reportar um bug:
1. Duplicar qualquer nota de `Database/Issues/`
2. Renomear: `ISSUE-006 - Descricao do Bug.md`
3. Preencher frontmatter
4. Aparece no **Issues Board**

---

## 6. Campos do Frontmatter

### Tarefa (`Database/Tarefas/`)
```yaml
tipo: tarefa
id: TASK-XXX
titulo: "Título"
status: backlog | em-andamento | revisao | concluido | cancelado
prioridade: critica | alta | media | baixa
modulo: compras | financeiro | infra | rh | ssma | ai | geral
responsavel: NomeDoResponsavel
milestone: MS-XXX
sprint: Sprint-X
estimativa: 8     # story points
gasto: 0          # story points gastos
data_inicio: YYYY-MM-DD
data_fim: YYYY-MM-DD
```

### Issue (`Database/Issues/`)
```yaml
tipo: issue
id: ISSUE-XXX
titulo: "Descrição do problema"
status: aberto | em-andamento | resolvido | wontfix
severidade: critica | alta | media | baixa
modulo: compras | financeiro | infra | ...
reportado_por: NomeDoResponsavel
data_report: YYYY-MM-DD
sprint: Sprint-X
```

### Requisito (`Database/Requisitos/`)
```yaml
tipo: requisito
id: REQ-XXX
titulo: "Título"
categoria: funcional | nao-funcional | tecnico
prioridade: critica | alta | media | baixa
status: ideacao | planejado | em-dev | entregue | cancelado
modulo: compras | financeiro | ...
sprint: Sprint-X
milestone: MS-XXX
```

### Milestone (`Database/Milestones/`)
```yaml
tipo: milestone
id: MS-XXX
titulo: "Título"
status: planejado | em-andamento | concluido | atrasado
fase: Q1-2026 | Q2-2026 | Q3-2026 | Q4-2026
data_alvo: YYYY-MM-DD
progresso: 0        # 0 a 100
modulo: compras | ...
```
