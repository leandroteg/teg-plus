---
title: "🗺️ Roadmap Board"
type: painel
tags: [painel, roadmap, milestones, timeline, estrategia]
atualizado: 2026-03-02
---

# 🗺️ Roadmap Board — TEG+ ERP

> Atualize `progresso` (0-100) e `status` nos arquivos de `Database/Milestones/` para atualizar este painel.
> **Status válidos:** `planejado` · `em-andamento` · `concluido` · `atrasado`

---

## 🏁 Visão de Timeline

```dataviewjs
const milest = dv.pages('"Database/Milestones"').sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

const statusIcon = s =>
  s === "concluido"    ? "✅" :
  s === "em-andamento" ? "🔵" :
  s === "atrasado"     ? "🔴" : "📋";

const phaseColor = f =>
  f === "Q1-2026" ? "🟢" :
  f === "Q2-2026" ? "🔵" :
  f === "Q3-2026" ? "🟡" : "🟣";

const rows = milest.map(m => [
  `${statusIcon(m.status)} [[${m.file.name}|${m.titulo}]]`,
  `${phaseColor(m.fase)} ${m.fase}`,
  m.data_alvo,
  `\`${bar(m.progresso)}\` **${m.progresso}%**`,
  m.modulo
]);

dv.table(["Milestone", "Fase", "Data Alvo", "Progresso", "Módulo"], rows);
```

---

## 🟢 Q1 · 2026 — Jan → Mar

```dataviewjs
const milest = dv.pages('"Database/Milestones"').where(m => m.fase === "Q1-2026").sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

for (const m of milest) {
  const icon = m.status === "concluido" ? "✅" : m.status === "em-andamento" ? "🔵" : "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo} · **Módulo:** \`${m.modulo}\` · **Progresso:** \`${bar(m.progresso)}\` ${m.progresso}%`);

  const tarefas = dv.pages('"Database/Tarefas"').where(t => t.milestone === m.id);
  if (tarefas.length > 0) {
    const rows = tarefas.map(t => [
      `[[${t.file.name}|${t.titulo}]]`,
      t.status === "concluido" ? "✅" : t.status === "em-andamento" ? "🔵" : "⬜",
      t.estimativa + " pts"
    ]);
    dv.table(["Tarefa", "Status", "Pts"], rows);
  }
}
```

---

## 🔵 Q2 · 2026 — Abr → Jun

```dataviewjs
const milest = dv.pages('"Database/Milestones"').where(m => m.fase === "Q2-2026").sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

for (const m of milest) {
  const icon = m.status === "concluido" ? "✅" : m.status === "em-andamento" ? "🔵" : "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo} · **Módulo:** \`${m.modulo}\` · **Progresso:** \`${bar(m.progresso)}\` ${m.progresso}%`);

  const tarefas = dv.pages('"Database/Tarefas"').where(t => t.milestone === m.id);
  if (tarefas.length > 0) {
    const rows = tarefas.map(t => [
      `[[${t.file.name}|${t.titulo}]]`,
      t.status === "concluido" ? "✅" : t.status === "em-andamento" ? "🔵" : "⬜",
      t.estimativa + " pts"
    ]);
    dv.table(["Tarefa","Status","Pts"], rows);
  }
}
```

---

## 🟡 Q3 · 2026 — Jul → Set

```dataviewjs
const milest = dv.pages('"Database/Milestones"').where(m => m.fase === "Q3-2026" || m.fase === "Q4-2026").sort(m => m.data_alvo, "asc");
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

for (const m of milest) {
  const icon = m.status === "concluido" ? "✅" : m.status === "em-andamento" ? "🔵" : "📋";
  dv.paragraph(`### ${icon} [[${m.file.name}|${m.titulo}]]`);
  dv.paragraph(`> **Alvo:** ${m.data_alvo} · **Módulo:** \`${m.modulo}\` · **Progresso:** \`${bar(m.progresso)}\` ${m.progresso}%`);
}
```

---

## 🏆 Progresso Acumulado do Projeto

```dataviewjs
const tarefas  = dv.pages('"Database/Tarefas"');
const milest   = dv.pages('"Database/Milestones"');

const tDone    = tarefas.where(t => t.status === "concluido").length;
const tTotal   = tarefas.length;
const mDone    = milest.where(m => m.status === "concluido").length;
const mTotal   = milest.length;

const tPts     = tarefas.map(t => t.estimativa||0).reduce((a,b)=>a+b,0);
const tPtsDone = tarefas.where(t=>t.status==="concluido").map(t=>t.estimativa||0).reduce((a,b)=>a+b,0);
const pct      = tPts ? Math.round((tPtsDone/tPts)*100) : 0;
const bar      = "█".repeat(Math.round(pct/10)) + "░".repeat(10-Math.round(pct/10));

dv.paragraph(`
| Indicador | Valor |
|:---|:---|
| 📦 Tarefas concluídas | **${tDone} / ${tTotal}** |
| 🗺️ Milestones entregues | **${mDone} / ${mTotal}** |
| 📐 Story Points entregues | **${tPtsDone} / ${tPts} pts** |
| 🏁 Progresso geral | \`${bar}\` **${pct}%** |
`);
```

---

## ➕ Como Atualizar o Roadmap

1. Abra o milestone em `Database/Milestones/`
2. Altere `progresso: XX` (0 a 100)
3. Altere `status:` conforme avança
4. Este painel atualiza automaticamente
