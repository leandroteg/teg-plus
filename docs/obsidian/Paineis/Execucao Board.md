---
title: "⚡ Execucao Board — Melhorias & Bug Fixes"
type: painel
tags: [painel, execucao, dev, melhorias, bugs, acompanhamento]
atualizado: 2026-03-07
---

# ⚡ Execucao Board — Melhorias & Bug Fixes

> Acompanhamento de execucao: o que corrigir, o que melhorar, e o status de cada item.
> Atualize o `status` nas notas ISSUE-XXX para movimentar entre colunas.

---

## 🎯 Resumo Operacional

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');
const total = issues.length;
const abertos = issues.where(i => i.status === "aberto").length;
const andamento = issues.where(i => i.status === "em-andamento").length;
const resolvidos = issues.where(i => i.status === "resolvido").length;
const ht = (item, tag) => item.tags && (item.tags.includes(tag) || item.tags.includes('#' + tag));
const bugs = issues.where(i => ht(i, "bug")).length;
const enh = issues.where(i => ht(i, "enhancement")).length;

const bar = v => "█".repeat(Math.round(v / 5)) + "░".repeat(20 - Math.round(v / 5));
const pctDone = total > 0 ? Math.round((resolvidos / total) * 100) : 0;

dv.paragraph(`
### Pipeline de Desenvolvimento

| Etapa | Qtd | Barra |
|:------|:---:|:------|
| 🔴 Backlog (aberto) | **${abertos}** | ${bar(total > 0 ? (abertos/total)*100 : 0)} |
| 🔵 Em Andamento | **${andamento}** | ${bar(total > 0 ? (andamento/total)*100 : 0)} |
| ✅ Resolvido | **${resolvidos}** | ${bar(pctDone)} |

> **Progresso geral:** ${bar(pctDone)} **${pctDone}%** (${resolvidos}/${total})
> 🐛 Bugs: ${bugs} | 💡 Melhorias: ${enh} | 📋 Outros: ${total - bugs - enh}
`);
```

---

## 🔴 BACKLOG — Aguardando Execucao

> Issues abertas ordenadas por severidade. Comece pelas de cima.

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.status === "aberto");

const sevOrder = {"critica": 0, "alta": 1, "media": 2, "baixa": 3};
const sorted = issues.sort(i => sevOrder[i.severidade] ?? 99, "asc");

if (sorted.length === 0) {
  dv.paragraph("✅ Backlog vazio! Todas as issues estao em andamento ou resolvidas.");
} else {
  dv.table(
    ["Prioridade", "Issue", "Tipo", "Modulo", "Sprint", "Acao"],
    sorted.map(i => {
      const icon = i.severidade === "critica" ? "🔴 CRITICA" :
                   i.severidade === "alta" ? "🟠 ALTA" :
                   i.severidade === "media" ? "🟡 MEDIA" : "🟢 BAIXA";
      const tipo = i.tags && (i.tags.includes("bug") || i.tags.includes("#bug")) ? "🐛 Bug" :
                   i.tags && (i.tags.includes("enhancement") || i.tags.includes("#enhancement")) ? "💡 Melhoria" : "📋 Task";
      const gh = i.github_issue ? `[GH#${i.github_issue}](${i.github_url})` : "—";
      return [
        icon,
        dv.fileLink(i.file.name, false, i.id + " — " + (i.titulo || "").substring(0, 45)),
        tipo,
        i.modulo || "—",
        i.sprint || "—",
        gh
      ];
    })
  );
}
```

### 📝 Como Executar
1. Abra a issue no Obsidian → leia a **Solucao Proposta**
2. Mude `status: aberto` para `status: em-andamento`
3. Se tem GitHub Issue vinculada, gere a **AI Spec** no [Dev Hub](https://teg-plus.vercel.app/admin/desenvolvimento)
4. Implemente seguindo a spec
5. Ao concluir, mude para `status: resolvido`

---

## 🔵 EM ANDAMENTO — Sendo Trabalhadas

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.status === "em-andamento");

if (issues.length === 0) {
  dv.paragraph("Nenhuma issue em andamento no momento.");
} else {
  dv.table(
    ["Issue", "Sev", "Modulo", "Responsavel", "GitHub"],
    issues.map(i => {
      const icon = i.severidade === "critica" ? "🔴" :
                   i.severidade === "alta" ? "🟠" :
                   i.severidade === "media" ? "🟡" : "🟢";
      const gh = i.github_issue ? `[#${i.github_issue}](${i.github_url})` : "—";
      return [
        dv.fileLink(i.file.name, false, i.id + " — " + (i.titulo || "").substring(0, 50)),
        icon,
        i.modulo || "—",
        i.reportado_por || "—",
        gh
      ];
    })
  );
}
```

---

## ✅ RESOLVIDAS — Concluidas

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"')
  .where(i => i.status === "resolvido")
  .sort(i => i.data_report, "desc");

if (issues.length === 0) {
  dv.paragraph("Nenhuma issue resolvida ainda. Mao na massa! 💪");
} else {
  dv.table(
    ["Data", "Issue", "Tipo", "Modulo"],
    issues.map(i => {
      const tipo = i.tags && (i.tags.includes("bug") || i.tags.includes("#bug")) ? "🐛" :
                   i.tags && (i.tags.includes("enhancement") || i.tags.includes("#enhancement")) ? "💡" : "📋";
      return [
        i.data_report || "—",
        dv.fileLink(i.file.name, false, "✅ " + (i.titulo || "").substring(0, 55)),
        tipo,
        i.modulo || "—"
      ];
    })
  );
}
```

---

## 📊 Bugs vs Melhorias — Distribuicao

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');

const ht = (item, tag) => item.tags && (item.tags.includes(tag) || item.tags.includes('#' + tag));
const bugs = issues.where(i => ht(i, "bug"));
const enh = issues.where(i => ht(i, "enhancement"));
const outros = issues.where(i => !ht(i, "bug") && !ht(i, "enhancement"));

const bugsOpen = bugs.where(i => i.status !== "resolvido").length;
const bugsDone = bugs.where(i => i.status === "resolvido").length;
const enhOpen = enh.where(i => i.status !== "resolvido").length;
const enhDone = enh.where(i => i.status === "resolvido").length;
const outOpen = outros.where(i => i.status !== "resolvido").length;
const outDone = outros.where(i => i.status === "resolvido").length;

dv.table(
  ["Tipo", "Abertas", "Resolvidas", "Total", "% Concluido"],
  [
    ["🐛 Bugs", bugsOpen, bugsDone, bugs.length, bugs.length > 0 ? Math.round((bugsDone / bugs.length) * 100) + "%" : "—"],
    ["💡 Melhorias", enhOpen, enhDone, enh.length, enh.length > 0 ? Math.round((enhDone / enh.length) * 100) + "%" : "—"],
    ["📋 Outros", outOpen, outDone, outros.length, outros.length > 0 ? Math.round((outDone / outros.length) * 100) + "%" : "—"]
  ]
);
```

---

## 🔥 Severidade — Mapa de Calor

```dataviewjs
const issues = dv.pages('"obsidian/Database/Issues"');
const modulos = [...new Set(issues.map(i => i.modulo).filter(Boolean))].sort();

dv.table(
  ["Modulo", "🔴 Critica", "🟠 Alta", "🟡 Media", "🟢 Baixa"],
  modulos.map(mod => {
    const ms = issues.where(i => i.modulo === mod && i.status !== "resolvido");
    const c = ms.where(i => i.severidade === "critica").length;
    const a = ms.where(i => i.severidade === "alta").length;
    const m = ms.where(i => i.severidade === "media").length;
    const b = ms.where(i => i.severidade === "baixa").length;
    return [
      mod.charAt(0).toUpperCase() + mod.slice(1),
      c > 0 ? "🔴 " + c : "—",
      a > 0 ? "🟠 " + a : "—",
      m > 0 ? "🟡 " + m : "—",
      b > 0 ? "🟢 " + b : "—"
    ];
  })
);
```

---

## 🔗 Links Rapidos

| Destino | Link |
|:--------|:-----|
| 🚀 Dev Hub BI | [[Dev Hub BI]] |
| 🐛 Issues Board | [[Issues Board]] |
| 📋 Tasks Board | [[Tasks Board]] |
| 💻 Dev Hub Web | [Abrir](https://teg-plus.vercel.app/admin/desenvolvimento) |
| 🐙 GitHub Issues | [Abrir](https://github.com/leandroteg/teg-plus/issues) |
