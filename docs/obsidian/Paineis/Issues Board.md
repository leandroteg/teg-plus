---
title: "🐛 Issues Board"
type: painel
tags: [painel, issues, bugs, qualidade]
atualizado: 2026-03-02
---

# 🐛 Issues Board — TEG+ ERP

> Atualize `status` nas notas `ISSUE-XXX` para movimentar entre colunas.

---

## 🚨 Saúde do Projeto

```dataviewjs
const issues     = dv.pages('"obsidian/Database/Issues"');
const abertos    = issues.where(i => i.status === "aberto");
const criticos   = abertos.where(i => i.severidade === "critica");
const altos      = abertos.where(i => i.severidade === "alta");
const medios     = abertos.where(i => i.severidade === "media");
const baixos     = abertos.where(i => i.severidade === "baixa");
const resolvidos = issues.where(i => i.status === "resolvido");

const saude = criticos.length > 0 ? "🔴 ATENÇÃO" :
              altos.length > 1    ? "🟠 MODERADO" :
              abertos.length > 0  ? "🟡 ESTÁVEL"  : "✅ SAUDÁVEL";

dv.paragraph(`
| Estado | Abertas | 🔴 Críticas | 🟠 Altas | 🟡 Médias | 🟢 Baixas | ✅ Resolvidas |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **${saude}** | **${abertos.length}** | ${criticos.length} | ${altos.length} | ${medios.length} | ${baixos.length} | ${resolvidos.length} |
`);
```

---

## 🔴 Críticas

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  reportado_por AS "Por",
  data_report AS "Data"
FROM "obsidian/Database/Issues"
WHERE status = "aberto" AND severidade = "critica"
SORT data_report ASC
```

---

## 🟠 Altas

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  reportado_por AS "Por",
  data_report AS "Data"
FROM "obsidian/Database/Issues"
WHERE status = "aberto" AND severidade = "alta"
SORT data_report ASC
```

---

## 🟡 Médias

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  sprint AS "Sprint Alvo",
  data_report AS "Data"
FROM "obsidian/Database/Issues"
WHERE status = "aberto" AND severidade = "media"
SORT data_report ASC
```

---

## 🟢 Baixas

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  sprint AS "Sprint Alvo"
FROM "obsidian/Database/Issues"
WHERE status = "aberto" AND severidade = "baixa"
```

---

## 🔵 Em Andamento

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  choice(severidade = "critica","🔴 Crítica", choice(severidade = "alta","🟠 Alta", choice(severidade = "media","🟡 Média","🟢 Baixa"))) AS "Severidade",
  modulo AS "Módulo"
FROM "obsidian/Database/Issues"
WHERE status = "em-andamento"
```

---

## ✅ Resolvidas

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  choice(severidade = "critica","🔴", choice(severidade = "alta","🟠", choice(severidade = "media","🟡","🟢"))) AS "Sev",
  modulo AS "Módulo"
FROM "obsidian/Database/Issues"
WHERE status = "resolvido"
SORT data_report DESC
LIMIT 5
```

---

## 📊 Por Módulo

```dataviewjs
const issues  = dv.pages('"obsidian/Database/Issues"');
const modulos = [...new Set(issues.map(i => i.modulo).filter(Boolean))].sort();

dv.table(
  ["Módulo","🔴 Críticas","🟠 Altas","Total Abertas","✅ Resolvidas"],
  modulos.map(mod => {
    const ms   = issues.where(i => i.modulo === mod);
    const crit = ms.where(i=>i.severidade==="critica"&&i.status==="aberto").length;
    const alt  = ms.where(i=>i.severidade==="alta"&&i.status==="aberto").length;
    return [
      mod.charAt(0).toUpperCase() + mod.slice(1),
      crit > 0 ? `🔴 ${crit}` : "—",
      alt  > 0 ? `🟠 ${alt}`  : "—",
      ms.where(i=>i.status==="aberto").length,
      ms.where(i=>i.status==="resolvido").length
    ];
  })
);
```
