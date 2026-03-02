---
title: "🐛 Issues Board"
type: painel
tags: [painel, issues, bugs, qualidade, tracker]
atualizado: 2026-03-02
---

# 🐛 Issues Board — TEG+ ERP

> Atualize `status` nas notas de `Database/Issues/` para movimentar entre colunas.
> **Status válidos:** `aberto` · `em-andamento` · `resolvido` · `wontfix`
> **Severidades:** `critica` · `alta` · `media` · `baixa`

---

## 🚨 Resumo de Saúde

```dataviewjs
const issues = dv.pages('"Database/Issues"');

const abertos   = issues.where(i => i.status === "aberto");
const criticos  = abertos.where(i => i.severidade === "critica");
const altos     = abertos.where(i => i.severidade === "alta");
const medios    = abertos.where(i => i.severidade === "media");
const baixos    = abertos.where(i => i.severidade === "baixa");
const resolvidos= issues.where(i => i.status === "resolvido");

const saude = criticos.length > 0 ? "🔴 ATENÇÃO" :
              altos.length > 1    ? "🟠 MODERADO" :
              abertos.length > 0  ? "🟡 ESTÁVEL" : "✅ SAUDÁVEL";

dv.paragraph(`
| Estado do Projeto | Issues Abertas | Críticas | Altas | Médias | Baixas | Resolvidas |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **${saude}** | **${abertos.length}** | 🔴 ${criticos.length} | 🟠 ${altos.length} | 🟡 ${medios.length} | 🟢 ${baixos.length} | ✅ ${resolvidos.length} |
`);
```

---

## 🔴 Críticas — Requer Ação Imediata

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  reportado_por AS "Por",
  data_report AS "Data"
FROM "Database/Issues"
WHERE status = "aberto" AND severidade = "critica"
SORT data_report ASC
```

> *Nenhuma issue crítica aberta no momento.* ✅

---

## 🟠 Altas — Alta Prioridade

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  modulo AS "Módulo",
  reportado_por AS "Por",
  data_report AS "Data"
FROM "Database/Issues"
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
FROM "Database/Issues"
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
FROM "Database/Issues"
WHERE status = "aberto" AND severidade = "baixa"
SORT data_report ASC
```

---

## 🔵 Em Andamento

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  choice(severidade = "critica","🔴 Crítica", choice(severidade = "alta","🟠 Alta", choice(severidade = "media","🟡 Média","🟢 Baixa"))) AS "Severidade",
  modulo AS "Módulo"
FROM "Database/Issues"
WHERE status = "em-andamento"
```

---

## ✅ Resolvidas Recentemente

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Issue",
  choice(severidade = "critica","🔴", choice(severidade = "alta","🟠", choice(severidade = "media","🟡","🟢"))) AS "Sev",
  modulo AS "Módulo"
FROM "Database/Issues"
WHERE status = "resolvido"
SORT data_report DESC
LIMIT 5
```

---

## 📊 Issues por Módulo

```dataviewjs
const issues  = dv.pages('"Database/Issues"');
const modulos = [...new Set(issues.map(i => i.modulo).filter(Boolean))].sort();

const rows = modulos.map(mod => {
  const ms  = issues.where(i => i.modulo === mod);
  return [
    mod.charAt(0).toUpperCase() + mod.slice(1),
    ms.where(i=>i.severidade==="critica" && i.status==="aberto").length > 0
      ? `🔴 ${ms.where(i=>i.severidade==="critica"&&i.status==="aberto").length}` : "—",
    ms.where(i=>i.severidade==="alta"&&i.status==="aberto").length > 0
      ? `🟠 ${ms.where(i=>i.severidade==="alta"&&i.status==="aberto").length}` : "—",
    ms.where(i=>i.status==="aberto").length,
    ms.where(i=>i.status==="resolvido").length
  ];
});

dv.table(["Módulo","Críticas","Altas","Total Abertas","Resolvidas"], rows);
```

---

## ➕ Como Reportar uma Issue

1. Duplicar qualquer nota de `Database/Issues/`
2. Renomear: `ISSUE-XXX - Titulo do problema.md`
3. Preencher o frontmatter:
```yaml
id: ISSUE-XXX
titulo: "Descrição curta"
status: aberto
severidade: alta
modulo: compras
reportado_por: SeuNome
data_report: YYYY-MM-DD
```
4. Issue aparece automaticamente no board
