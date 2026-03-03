---
title: "📋 Tasks Board"
type: painel
tags: [painel, tasks, kanban, sprints]
atualizado: 2026-03-02
---

# 📋 Tasks Board — TEG+ ERP

> Altere `status` em qualquer `TASK-XXX` para mover entre colunas automaticamente.

---

## 📊 Velocidade por Sprint

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const sprints = [...new Set(tarefas.map(t => t.sprint).filter(Boolean))].sort();
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

dv.table(
  ["Sprint", "Status", "Story Points", "Velocidade"],
  sprints.map(sp => {
    const ts      = tarefas.where(t => t.sprint === sp);
    const done    = ts.where(t => t.status === "concluido").length;
    const prog    = ts.where(t => t.status === "em-andamento").length;
    const back    = ts.where(t => t.status === "backlog").length;
    const pts     = ts.map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const ptsDone = ts.where(t => t.status === "concluido").map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const pct     = pts ? Math.round((ptsDone / pts) * 100) : 0;
    return [sp, `✅ ${done}  🔵 ${prog}  ⬜ ${back}`, `${ptsDone}/${pts} pts`, `\`${bar(pct)}\` ${pct}%`];
  })
);
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
FROM "obsidian/Database/Tarefas"
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
  gasto + "/" + estimativa + " pts" AS "Progresso"
FROM "obsidian/Database/Tarefas"
WHERE status = "em-andamento"
SORT prioridade ASC
```

---

## 🟡 Em Revisão

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Tarefa",
  modulo AS "Módulo",
  sprint AS "Sprint"
FROM "obsidian/Database/Tarefas"
WHERE status = "revisao"
```

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
FROM "obsidian/Database/Tarefas"
WHERE status = "backlog"
SORT prioridade ASC
```

---

## 📈 Burndown por Módulo

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
const modulos = [...new Set(tarefas.map(t => t.modulo).filter(Boolean))].sort();

dv.table(
  ["Módulo", "Tarefas", "Pontos", "Progresso"],
  modulos.map(mod => {
    const ts       = tarefas.where(t => t.modulo === mod);
    const totalPts = ts.map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const donePts  = ts.where(t => t.status === "concluido").map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const pct      = totalPts ? Math.round((donePts / totalPts) * 100) : 0;
    const count    = `✅ ${ts.where(t=>t.status==="concluido").length}  🔵 ${ts.where(t=>t.status==="em-andamento").length}  ⬜ ${ts.where(t=>t.status==="backlog").length}`;
    return [mod.charAt(0).toUpperCase() + mod.slice(1), count, `${donePts}/${totalPts} pts`, `\`${bar(pct)}\` ${pct}%`];
  })
);
```
