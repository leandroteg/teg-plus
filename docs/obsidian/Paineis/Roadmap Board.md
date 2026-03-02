---
title: "🗺️ Roadmap Board"
type: painel
tags: [painel, roadmap, milestones, timeline]
atualizado: 2026-03-02
---

# 🗺️ Roadmap Board — TEG+ ERP

> Atualize `progresso` (0-100) e `status` nos arquivos `MS-XXX` para atualizar este painel.
> **Status válidos:** `planejado` · `em-andamento` · `concluido` · `atrasado`

---

## 🏁 Timeline Geral

```dataviewjs
const milest = dv.pages('').where(p => p.tipo === "milestone").sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));
const icon = s =>
  s === "concluido"    ? "✅" :
  s === "em-andamento" ? "🔵" :
  s === "atrasado"     ? "🔴" : "📋";
const faseColor = f =>
  f === "Q1-2026" ? "🟢" : f === "Q2-2026" ? "🔵" : f === "Q3-2026" ? "🟡" : "🟣";

const rows = milest.map(m => [
  `${icon(m.status)} [[${m.file.name}|${m.titulo}]]`,
  `${faseColor(m.fase)} ${m.fase}`,
  m.data_alvo,
  `\`${bar(m.progresso)}\` **${m.progresso}%**`,
  m.modulo
]);

dv.table(["Milestone", "Fase", "Data Alvo", "Progresso", "Módulo"], rows);
```

---

## 🟢 Q1 · 2026 (Jan → Mar)

```dataviewjs
const milest  = dv.pages('').where(p => p.tipo === "milestone" && p.fase === "Q1-2026").sort(m => m.data_alvo, "asc");
const tarefas = dv.pages('').where(p => p.tipo === "tarefa");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

for (const m of milest) {
  const icon = m.status === "concluido" ? "✅" : m.status === "em-andamento" ? "🔵" : "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo}  ·  **Módulo:** \`${m.modulo}\`  ·  Progresso: \`${bar(m.progresso)}\` **${m.progresso}%**`);
  const ts = tarefas.where(t => t.milestone === m.id);
  if (ts.length > 0) {
    dv.table(["Tarefa","Status","Pts"], ts.map(t => [
      `[[${t.file.name}|${t.titulo}]]`,
      t.status === "concluido" ? "✅" : t.status === "em-andamento" ? "🔵" : "⬜",
      t.estimativa + " pts"
    ]));
  }
}
```

---

## 🔵 Q2 · 2026 (Abr → Jun)

```dataviewjs
const milest  = dv.pages('').where(p => p.tipo === "milestone" && p.fase === "Q2-2026").sort(m => m.data_alvo, "asc");
const tarefas = dv.pages('').where(p => p.tipo === "tarefa");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

for (const m of milest) {
  const icon = m.status === "concluido" ? "✅" : m.status === "em-andamento" ? "🔵" : "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo}  ·  **Módulo:** \`${m.modulo}\`  ·  Progresso: \`${bar(m.progresso)}\` **${m.progresso}%**`);
  const ts = tarefas.where(t => t.milestone === m.id);
  if (ts.length > 0) {
    dv.table(["Tarefa","Status","Pts"], ts.map(t => [
      `[[${t.file.name}|${t.titulo}]]`,
      t.status === "concluido" ? "✅" : t.status === "em-andamento" ? "🔵" : "⬜",
      t.estimativa + " pts"
    ]));
  }
}
```

---

## 🟡 Q3+ · 2026 (Jul → Dez)

```dataviewjs
const milest  = dv.pages('').where(p => p.tipo === "milestone" && (p.fase === "Q3-2026" || p.fase === "Q4-2026")).sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

for (const m of milest) {
  const icon = "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo}  ·  **Módulo:** \`${m.modulo}\`  ·  Progresso: \`${bar(m.progresso)}\` **${m.progresso}%**`);
}
```

---

## 🏆 Totais do Projeto

```dataviewjs
const tarefas = dv.pages('').where(p => p.tipo === "tarefa");
const milest  = dv.pages('').where(p => p.tipo === "milestone");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

const tDone   = tarefas.where(t => t.status === "concluido").length;
const tTotal  = tarefas.length;
const mDone   = milest.where(m => m.status === "concluido").length;
const mTotal  = milest.length;
const pts     = tarefas.map(t => t.estimativa || 0).reduce((a,b) => a+b, 0);
const ptsDone = tarefas.where(t=>t.status==="concluido").map(t=>t.estimativa||0).reduce((a,b)=>a+b,0);
const pct     = pts ? Math.round((ptsDone/pts)*100) : 0;

dv.paragraph(`
| Indicador | Valor |
|:---|:---|
| 📦 Tarefas concluídas | **${tDone} / ${tTotal}** |
| 🗺️ Milestones entregues | **${mDone} / ${mTotal}** |
| 📐 Story Points | **${ptsDone} / ${pts} pts** |
| 🏁 Progresso geral | \`${bar(pct)}\` **${pct}%** |
`);
```
