---
title: "🏠 PAINEL PRINCIPAL"
type: painel
tags: [painel, dashboard, moc, gestao]
atualizado: 2026-03-02
---

# 🏠 TEG+ ERP — Central de Gestão

> **Vault auto-atualizado** — edite qualquer nota do `Database/` e os painéis refletem instantaneamente.
> Requer plugin **Dataview** com **Enable JavaScript Queries** ativado.

---

## ⚡ Visão Executiva

```dataviewjs
const tarefas = dv.pages('').where(p => p.tipo === "tarefa");
const issues  = dv.pages('').where(p => p.tipo === "issue");
const milest  = dv.pages('').where(p => p.tipo === "milestone");
const req     = dv.pages('').where(p => p.tipo === "requisito");

const tDone   = tarefas.where(t => t.status === "concluido").length;
const tTotal  = tarefas.length;
const tPct    = tTotal ? Math.round((tDone / tTotal) * 100) : 0;
const bar     = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

const iAberto = issues.where(i => i.status === "aberto").length;
const iCrit   = issues.where(i => i.status === "aberto" && i.severidade === "critica").length;
const mAtivo  = milest.where(m => m.status === "em-andamento").length;
const rEnt    = req.where(r => r.status === "entregue").length;
const rTotal  = req.length;

dv.paragraph(`
| 📦 Tarefas | 🐛 Issues abertas | 🗺️ Milestones ativos | 📋 Requisitos |
|:---:|:---:|:---:|:---:|
| **${tDone}/${tTotal}** concluídas | **${iAberto}** abertas (${iCrit} 🔴 críticas) | **${mAtivo}** em andamento | **${rEnt}/${rTotal}** entregues |
`);

dv.paragraph(`### Progresso Geral do Projeto\n\`${bar(tPct)}\` **${tPct}%**`);
```

---

## 🔥 Em Andamento Agora

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "📌 Tarefa",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  modulo AS "Módulo",
  sprint AS "Sprint",
  (estimativa - gasto) + " pts restantes" AS "Esforço"
FROM ""
WHERE tipo = "tarefa" AND status = "em-andamento"
SORT prioridade ASC
```

---

## 🔴 Issues Críticas e Altas

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "🐛 Issue",
  choice(severidade = "critica","🔴 Crítica", choice(severidade = "alta","🟠 Alta", choice(severidade = "media","🟡 Média","🟢 Baixa"))) AS "Severidade",
  modulo AS "Módulo",
  data_report AS "Reportado"
FROM ""
WHERE tipo = "issue" AND status = "aberto" AND (severidade = "critica" OR severidade = "alta")
SORT data_report ASC
```

---

## 🗺️ Milestones — Visão Geral

```dataviewjs
const milest = dv.pages('').where(p => p.tipo === "milestone").sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
const icon = s =>
  s === "concluido"    ? "✅" :
  s === "em-andamento" ? "🔵" :
  s === "atrasado"     ? "🔴" : "📋";

const rows = milest.map(m => [
  `${icon(m.status)} [[${m.file.name}|${m.titulo}]]`,
  m.fase,
  m.data_alvo,
  `\`${bar(m.progresso)}\` ${m.progresso}%`
]);

dv.table(["Milestone", "Fase", "Data Alvo", "Progresso"], rows);
```

---

## 📊 Progresso por Módulo

```dataviewjs
const tarefas = dv.pages('').where(p => p.tipo === "tarefa");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
const modulos = [...new Set(tarefas.map(t => t.modulo).filter(Boolean))].sort();

const rows = modulos.map(mod => {
  const ts   = tarefas.where(t => t.modulo === mod);
  const done = ts.where(t => t.status === "concluido").length;
  const prog = ts.where(t => t.status === "em-andamento").length;
  const back = ts.where(t => t.status === "backlog").length;
  const pct  = ts.length ? Math.round((done / ts.length) * 100) : 0;
  return [
    mod.charAt(0).toUpperCase() + mod.slice(1),
    `✅ ${done}`,
    `🔵 ${prog}`,
    `⬜ ${back}`,
    `\`${bar(pct)}\` ${pct}%`
  ];
});

dv.table(["Módulo", "Concluído", "Andamento", "Backlog", "Progresso"], rows);
```

---

## 📅 Próximas do Backlog

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "📌 Tarefa",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  sprint AS "Sprint Alvo",
  estimativa + " pts" AS "Esforço"
FROM ""
WHERE tipo = "tarefa" AND status = "backlog"
SORT prioridade ASC
LIMIT 8
```

---

## 🔗 Navegação

| Painel | |
|--------|---|
| [[Tasks Board\|📋 Tasks Board]] | Kanban de tarefas |
| [[Roadmap Board\|🗺️ Roadmap]] | Timeline de milestones |
| [[Issues Board\|🐛 Issues]] | Tracker de bugs |
| [[Requisitos Board\|📦 Requisitos]] | Rastreabilidade |
| [[00 - TEG+ INDEX\|🏗️ Arquitetura]] | Documentação técnica |
