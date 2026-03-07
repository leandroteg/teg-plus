---
title: "🚀 Dev Hub BI — Business Intelligence"
type: painel
tags: [painel, dev-hub, bi, issues, github, analytics]
atualizado: 2026-03-07
---

# 🚀 Dev Hub BI — Business Intelligence

> Dashboard de inteligencia para desenvolvimento do TEG+ ERP.
> Issues internas + GitHub + Feedbacks SuperTEG unificados.

---

## ⚡ Visao Executiva

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');
const tarefas = dv.pages('"obsidian/Database/Tarefas"');

const total = issues.length;
const abertos = issues.where(i => i.status === "aberto").length;
const emAndamento = issues.where(i => i.status === "em-andamento").length;
const resolvidos = issues.where(i => i.status === "resolvido").length;

const bugs = issues.where(i => i.tags && i.tags.includes("bug")).length;
const enhancements = issues.where(i => i.tags && i.tags.includes("enhancement")).length;
const ghIssues = issues.where(i => i.github_issue).length;
const agentIssues = issues.where(i => i.origem === "superteg-agent").length;

const criticos = issues.where(i => i.status === "aberto" && i.severidade === "critica").length;
const altos = issues.where(i => i.status === "aberto" && i.severidade === "alta").length;

const resolveRate = total > 0 ? Math.round((resolvidos / total) * 100) : 0;
const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));

dv.paragraph(`
| Metrica | Valor |
|:--------|------:|
| 📊 **Total Issues** | **${total}** |
| 🔴 Abertas | **${abertos}** |
| 🔵 Em Andamento | **${emAndamento}** |
| ✅ Resolvidas | **${resolvidos}** |
| 📈 Taxa Resolucao | ${bar(resolveRate)} **${resolveRate}%** |
| — | — |
| 🐛 Bugs | ${bugs} |
| 💡 Melhorias | ${enhancements} |
| 🔗 Vinculadas ao GitHub | ${ghIssues} |
| 🤖 Via SuperTEG Agent | ${agentIssues} |
| — | — |
| 🔴 Criticas Abertas | ${criticos > 0 ? "⚠️ **" + criticos + "**" : "✅ 0"} |
| 🟠 Altas Abertas | ${altos > 0 ? "⚠️ **" + altos + "**" : "✅ 0"} |
`);
```

---

## 🎯 Prioridade de Acao — O Que Resolver Agora

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.status === "aberto" || i.status === "em-andamento");

// Sort: critica > alta > media > baixa
const sevOrder = {"critica": 0, "alta": 1, "media": 2, "baixa": 3};
const sorted = issues.sort(i => sevOrder[i.severidade] ?? 99, "asc");

if (sorted.length === 0) {
  dv.paragraph("✅ **Nenhuma issue aberta!** Sistema saudavel.");
} else {
  dv.table(
    ["#", "Sev", "Issue", "Modulo", "Sprint", "Origem"],
    sorted.map((i, idx) => {
      const icon = i.severidade === "critica" ? "🔴" :
                   i.severidade === "alta" ? "🟠" :
                   i.severidade === "media" ? "🟡" : "🟢";
      const ghLink = i.github_issue ? ` [GH#${i.github_issue}](${i.github_url})` : "";
      const orig = i.origem === "superteg-agent" ? "🤖" : "👤";
      return [
        idx + 1,
        icon,
        dv.fileLink(i.file.name, false, i.titulo),
        i.modulo || "—",
        i.sprint || "—",
        orig + ghLink
      ];
    })
  );
}
```

---

## 📊 Distribuicao por Modulo

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');
const modulos = [...new Set(issues.map(i => i.modulo).filter(Boolean))].sort();

const bar = (v, max) => {
  const pct = max > 0 ? Math.round((v / max) * 15) : 0;
  return "█".repeat(pct) + "░".repeat(15 - pct);
};
const maxTotal = Math.max(...modulos.map(m => issues.where(i => i.modulo === m).length), 1);

dv.table(
  ["Modulo", "Abertas", "Resolvidas", "Total", "Grafico"],
  modulos.map(mod => {
    const ms = issues.where(i => i.modulo === mod);
    const ab = ms.where(i => i.status === "aberto" || i.status === "em-andamento").length;
    const res = ms.where(i => i.status === "resolvido").length;
    const total = ms.length;
    const emoji = mod === "compras" ? "🛒" :
                  mod === "financeiro" ? "💰" :
                  mod === "estoque" ? "📦" :
                  mod === "logistica" ? "🚛" :
                  mod === "frotas" ? "🚗" :
                  mod === "geral" ? "⚙️" :
                  mod === "infra" ? "🔧" : "📋";
    return [
      emoji + " " + mod.charAt(0).toUpperCase() + mod.slice(1),
      ab > 0 ? `🔴 ${ab}` : "—",
      res > 0 ? `✅ ${res}` : "—",
      total,
      bar(total, maxTotal)
    ];
  })
);
```

---

## 📅 Timeline — Issues por Data de Criacao

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .sort(i => i.data_report, "desc");

dv.table(
  ["Data", "Issue", "Sev", "Status", "Modulo"],
  issues.map(i => {
    const icon = i.severidade === "critica" ? "🔴" :
                 i.severidade === "alta" ? "🟠" :
                 i.severidade === "media" ? "🟡" : "🟢";
    const stIcon = i.status === "resolvido" ? "✅" :
                   i.status === "em-andamento" ? "🔵" : "🔴";
    return [
      i.data_report || "—",
      dv.fileLink(i.file.name, false, i.id + " — " + (i.titulo || "").substring(0, 50)),
      icon,
      stIcon + " " + (i.status || ""),
      i.modulo || "—"
    ];
  })
);
```

---

## 🔗 Issues Vinculadas ao GitHub

```dataviewjs
const ghIssues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.github_issue);

if (ghIssues.length === 0) {
  dv.paragraph("Nenhuma issue vinculada ao GitHub ainda.");
} else {
  dv.table(
    ["GH#", "Issue", "Status", "Labels"],
    ghIssues.map(i => {
      const stIcon = i.status === "resolvido" ? "✅" :
                     i.status === "em-andamento" ? "🔵" : "🔴";
      const ghLink = `[#${i.github_issue}](${i.github_url})`;
      const labels = i.tags ? i.tags.filter(t => t !== "issue" && t !== "github").join(", ") : "—";
      return [
        ghLink,
        dv.fileLink(i.file.name, false, i.titulo),
        stIcon + " " + (i.status || ""),
        labels
      ];
    })
  );
}
```

---

## 🤖 Feedbacks via SuperTEG Agent

```dataviewjs
const agentIssues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.origem === "superteg-agent");

if (agentIssues.length === 0) {
  dv.paragraph("Nenhum feedback registrado via SuperTEG Agent.");
} else {
  dv.table(
    ["Data", "Tipo", "Issue", "Modulo", "Status"],
    agentIssues.sort(i => i.data_report, "desc").map(i => {
      const tipo = i.tags && i.tags.includes("bug") ? "🐛 Bug" :
                   i.tags && i.tags.includes("enhancement") ? "💡 Melhoria" : "📋 Tarefa";
      const stIcon = i.status === "resolvido" ? "✅" :
                     i.status === "em-andamento" ? "🔵" : "🔴";
      return [
        i.data_report || "—",
        tipo,
        dv.fileLink(i.file.name, false, i.titulo),
        i.modulo || "—",
        stIcon + " " + (i.status || "")
      ];
    })
  );
}
```

---

## 🔗 Navegacao

| Painel | Link |
|:-------|:-----|
| 🐛 Issues Board | [[Issues Board]] |
| 📋 Tasks Board | [[Tasks Board]] |
| 🗺️ Roadmap Board | [[Roadmap Board]] |
| 📊 Requisitos Board | [[Requisitos Board]] |
| 🚀 Execucao Board | [[Execucao Board]] |
| 🏠 PAINEL PRINCIPAL | [[PAINEL PRINCIPAL]] |
| 🌐 GitHub Issues | [Abrir no GitHub](https://github.com/leandroteg/teg-plus/issues) |
| 💻 Dev Hub Frontend | [Abrir Dev Hub](https://teg-plus.vercel.app/admin/desenvolvimento) |
