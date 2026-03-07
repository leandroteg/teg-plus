---
title: "📈 Relatorio de Desenvolvimento"
type: painel
tags: [painel, relatorio, desenvolvimento, weekly, report]
atualizado: 2026-03-07
---

# 📈 Relatorio de Desenvolvimento — TEG+ ERP

> Relatorio consolidado de progresso: issues, tarefas, milestones e qualidade.
> Use para reunioes semanais e acompanhamento gerencial.

---

## 🏆 Scorecard Geral

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const milest = dv.pages('"obsidian/Database/Milestones"');
const req = dv.pages('"obsidian/Database/Requisitos"');

const iTotal = issues.length;
const iAberto = issues.where(i => i.status === "aberto").length;
const iResolvido = issues.where(i => i.status === "resolvido").length;

const tTotal = tarefas.length;
const tDone = tarefas.where(t => t.status === "concluido").length;
const tAndamento = tarefas.where(t => t.status === "em-andamento").length;

const mTotal = milest.length;
const mDone = milest.where(m => m.status === "concluido").length;

const rTotal = req.length;
const rEntregue = req.where(r => r.status === "entregue").length;

const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

dv.paragraph(`
| Area | Progresso | Numeros |
|:-----|:----------|--------:|
| 📋 **Tarefas** | ${bar(pct(tDone, tTotal))} ${pct(tDone, tTotal)}% | ${tDone}/${tTotal} concluidas |
| 🏁 **Milestones** | ${bar(pct(mDone, mTotal))} ${pct(mDone, mTotal)}% | ${mDone}/${mTotal} concluidos |
| 📐 **Requisitos** | ${bar(pct(rEntregue, rTotal))} ${pct(rEntregue, rTotal)}% | ${rEntregue}/${rTotal} entregues |
| 🐛 **Issues** | ${bar(pct(iResolvido, iTotal))} ${pct(iResolvido, iTotal)}% | ${iResolvido}/${iTotal} resolvidas |
`);
```

---

## ⚠️ Atencao Imediata — Issues Criticas e Altas

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.status !== "resolvido" && (i.severidade === "critica" || i.severidade === "alta"));

if (issues.length === 0) {
  dv.paragraph("✅ **Nenhuma issue critica ou alta aberta.** Sistema estavel.");
} else {
  dv.paragraph("⚠️ **" + issues.length + " issue(s) requerem atencao:**");
  dv.table(
    ["Sev", "Issue", "Modulo", "Dias Aberta"],
    issues.sort(i => i.severidade === "critica" ? 0 : 1, "asc").map(i => {
      const icon = i.severidade === "critica" ? "🔴 CRITICA" : "🟠 ALTA";
      const dias = i.data_report ? Math.floor((new Date() - new Date(i.data_report)) / 86400000) : "?";
      return [
        icon,
        dv.fileLink(i.file.name, false, i.titulo),
        i.modulo || "—",
        dias + " dias"
      ];
    })
  );
}
```

---

## 📊 Velocidade de Desenvolvimento

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const sprints = [...new Set(tarefas.map(t => t.sprint).filter(Boolean))].sort();

const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));

dv.table(
  ["Sprint", "Concluidas", "Em Andamento", "Backlog", "Story Points", "Progresso"],
  sprints.map(sp => {
    const ts = tarefas.where(t => t.sprint === sp);
    const done = ts.where(t => t.status === "concluido").length;
    const wip = ts.where(t => t.status === "em-andamento" || t.status === "revisao").length;
    const back = ts.where(t => t.status === "backlog").length;
    const pts = ts.map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const ptsDone = ts.where(t => t.status === "concluido").map(t => t.estimativa || 0).reduce((a, b) => a + b, 0);
    const pct = ts.length > 0 ? Math.round((done / ts.length) * 100) : 0;
    return [
      sp,
      "✅ " + done,
      "🔵 " + wip,
      "⬜ " + back,
      ptsDone + "/" + pts + " pts",
      bar(pct) + " " + pct + "%"
    ];
  })
);
```

---

## 🗺️ Milestones Ativos

```dataviewjs
const milest = dv.pages('"obsidian/Database/Milestones"')
  .where(m => m.status === "em-andamento" || m.status === "atrasado")
  .sort(m => m.data_alvo, "asc");

const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));

if (milest.length === 0) {
  dv.paragraph("Nenhum milestone ativo no momento.");
} else {
  dv.table(
    ["Milestone", "Fase", "Alvo", "Progresso"],
    milest.map(m => {
      const stIcon = m.status === "atrasado" ? "🔴" : "🔵";
      const prog = m.progresso || 0;
      return [
        stIcon + " " + dv.fileLink(m.file.name, false, m.titulo),
        m.fase || "—",
        m.data_alvo || "—",
        bar(prog) + " " + prog + "%"
      ];
    })
  );
}
```

---

## 📦 Progresso por Modulo

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const issues = dv.pages('"obsidian/Database/Issues"');
const modulos = [...new Set([
  ...tarefas.map(t => t.modulo),
  ...issues.map(i => i.modulo)
].filter(Boolean))].sort();

const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));

dv.table(
  ["Modulo", "Tarefas", "Issues Abertas", "Saude"],
  modulos.map(mod => {
    const ts = tarefas.where(t => t.modulo === mod);
    const tDone = ts.where(t => t.status === "concluido").length;
    const is = issues.where(i => i.modulo === mod);
    const iOpen = is.where(i => i.status !== "resolvido").length;
    const iCrit = is.where(i => i.status !== "resolvido" && i.severidade === "critica").length;

    const saude = iCrit > 0 ? "🔴 Critico" :
                  iOpen > 2 ? "🟠 Atencao" :
                  iOpen > 0 ? "🟡 OK" : "✅ Saudavel";
    const emoji = mod === "compras" ? "🛒" :
                  mod === "financeiro" ? "💰" :
                  mod === "estoque" ? "📦" :
                  mod === "logistica" ? "🚛" :
                  mod === "frotas" ? "🚗" :
                  mod === "geral" ? "⚙️" :
                  mod === "infra" ? "🔧" : "📋";

    return [
      emoji + " " + mod.charAt(0).toUpperCase() + mod.slice(1),
      tDone + "/" + ts.length,
      iOpen > 0 ? "🔴 " + iOpen : "✅ 0",
      saude
    ];
  })
);
```

---

## 🔗 Navegacao

| Destino | Link |
|:--------|:-----|
| 🚀 Dev Hub BI | [[Dev Hub BI]] |
| ⚡ Execucao Board | [[Execucao Board]] |
| 🐛 Issues Board | [[Issues Board]] |
| 📋 Tasks Board | [[Tasks Board]] |
| 🗺️ Roadmap Board | [[Roadmap Board]] |
| 🏠 PAINEL PRINCIPAL | [[PAINEL PRINCIPAL]] |
