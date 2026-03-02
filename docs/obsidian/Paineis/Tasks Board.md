---
title: "📋 Tasks Board"
type: painel
tags: [painel, tasks, kanban, sprints]
atualizado: 2026-03-02
---

# 📋 Tasks Board — TEG+ ERP

> Atualize o campo `status` em qualquer nota de `Database/Tarefas/` para mover automaticamente entre colunas.
> **Status válidos:** `backlog` · `em-andamento` · `revisao` · `concluido` · `cancelado`

---

## 📊 Resumo de Sprint

```dataviewjs
const tarefas = dv.pages('"Database/Tarefas"');
const sprints = [...new Set(tarefas.map(t => t.sprint).filter(Boolean))].sort();

const rows = sprints.map(sp => {
  const ts   = tarefas.where(t => t.sprint === sp);
  const done = ts.where(t => t.status === "concluido").length;
  const prog = ts.where(t => t.status === "em-andamento").length;
  const back = ts.where(t => t.status === "backlog").length;
  const pts  = ts.map(t => t.estimativa || 0).reduce((a,b) => a+b, 0);
  const ptsDone = ts.where(t => t.status === "concluido").map(t => t.estimativa || 0).reduce((a,b)=>a+b,0);
  const pct  = pts ? Math.round((ptsDone/pts)*100) : 0;
  const bar  = "█".repeat(Math.round(pct/10)) + "░".repeat(10-Math.round(pct/10));
  return [sp, `✅${done} 🔵${prog} ⬜${back}`, pts + " pts", `\`${bar}\` ${pct}%`];
});

dv.table(["Sprint","Status","Story Points","Velocidade"], rows);
```

---

## ✅ Concluído

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Tarefa",
  choice(prioridade = "critica","🔴", choice(prioridade = "alta","🟠", choice(prioridade = "media","🟡","🟢"))) AS "P",
  modulo AS "Módulo",
  estimativa + " pts" AS "Pts",
  data_fim AS "Entregue"
FROM "Database/Tarefas"
WHERE status = "concluido"
SORT data_fim DESC
```

---

## 🔵 Em Andamento

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Tarefa",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  modulo AS "Módulo",
  sprint AS "Sprint",
  milestone AS "Milestone",
  estimativa + " pts" AS "Estimativa",
  gasto + " pts" AS "Gasto"
FROM "Database/Tarefas"
WHERE status = "em-andamento"
SORT prioridade ASC
```

---

## 🟡 Em Revisão

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Tarefa",
  choice(prioridade = "critica","🔴", choice(prioridade = "alta","🟠", choice(prioridade = "media","🟡","🟢"))) AS "P",
  modulo AS "Módulo",
  sprint AS "Sprint"
FROM "Database/Tarefas"
WHERE status = "revisao"
SORT prioridade ASC
```

> *Nenhuma tarefa em revisão no momento.*

---

## ⬜ Backlog

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Tarefa",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  modulo AS "Módulo",
  sprint AS "Sprint Alvo",
  milestone AS "Milestone",
  estimativa + " pts" AS "Estimativa"
FROM "Database/Tarefas"
WHERE status = "backlog"
SORT prioridade ASC, estimativa DESC
```

---

## 📈 Burndown Simulado por Módulo

```dataviewjs
const tarefas = dv.pages('"Database/Tarefas"');
const modulos = [...new Set(tarefas.map(t => t.modulo).filter(Boolean))].sort();
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

const rows = modulos.map(mod => {
  const ts       = tarefas.where(t => t.modulo === mod);
  const totalPts = ts.map(t => t.estimativa || 0).reduce((a,b)=>a+b,0);
  const donePts  = ts.where(t=>t.status==="concluido").map(t=>t.estimativa||0).reduce((a,b)=>a+b,0);
  const pct      = totalPts ? Math.round((donePts/totalPts)*100) : 0;
  const statusCount = `✅${ts.where(t=>t.status==="concluido").length} 🔵${ts.where(t=>t.status==="em-andamento").length} ⬜${ts.where(t=>t.status==="backlog").length}`;
  return [
    mod.charAt(0).toUpperCase() + mod.slice(1),
    statusCount,
    `${donePts} / ${totalPts} pts`,
    `\`${bar(pct)}\` ${pct}%`
  ];
});

dv.table(["Módulo", "Tarefas", "Pontos", "Progresso"], rows);
```

---

## ➕ Como Criar Nova Tarefa

1. Duplicar qualquer nota de `Database/Tarefas/`
2. Renomear: `TASK-XXX - Titulo da Tarefa.md`
3. Atualizar o frontmatter YAML (id, titulo, status, prioridade, etc.)
4. A tarefa aparecerá automaticamente neste board

**Campos obrigatórios:** `id`, `titulo`, `status`, `prioridade`, `modulo`
