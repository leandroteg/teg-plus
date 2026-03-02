---
title: "📦 Requisitos Board"
type: painel
tags: [painel, requisitos, rastreabilidade]
atualizado: 2026-03-02
---

# 📦 Requisitos Board — TEG+ ERP

> Atualize os arquivos `REQ-XXX` para mover requisitos entre estágios automaticamente.
> **Status válidos:** `ideacao` · `planejado` · `em-dev` · `entregue` · `cancelado`

---

## 📊 Cobertura

```dataviewjs
const req = dv.pages('').where(p => p.tipo === "requisito");
const bar = v => "█".repeat(Math.round(v / 10)) + "░".repeat(10 - Math.round(v / 10));

const entregue  = req.where(r => r.status === "entregue").length;
const emDev     = req.where(r => r.status === "em-dev").length;
const planejado = req.where(r => r.status === "planejado").length;
const ideacao   = req.where(r => r.status === "ideacao").length;
const total     = req.length;
const pct       = total ? Math.round((entregue / total) * 100) : 0;

dv.paragraph(`
| ✅ Entregues | 🔵 Em Dev | 📋 Planejados | 💡 Ideação | Total |
|:---:|:---:|:---:|:---:|:---:|
| **${entregue}** | **${emDev}** | **${planejado}** | **${ideacao}** | **${total}** |

**Cobertura de entrega:** \`${bar(pct)}\` **${pct}%**
`);
```

---

## ✅ Entregues

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Requisito",
  choice(categoria = "funcional","⚙️ Funcional", choice(categoria = "nao-funcional","📐 Não-Funcional","🔧 Técnico")) AS "Categoria",
  choice(prioridade = "critica","🔴", choice(prioridade = "alta","🟠", choice(prioridade = "media","🟡","🟢"))) AS "P",
  modulo AS "Módulo"
FROM ""
WHERE tipo = "requisito" AND status = "entregue"
SORT prioridade ASC
```

---

## 🔵 Em Desenvolvimento

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Requisito",
  choice(categoria = "funcional","⚙️ Funcional", choice(categoria = "nao-funcional","📐 Não-Funcional","🔧 Técnico")) AS "Categoria",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  modulo AS "Módulo",
  sprint AS "Sprint"
FROM ""
WHERE tipo = "requisito" AND status = "em-dev"
SORT prioridade ASC
```

---

## 📋 Planejados

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Requisito",
  choice(categoria = "funcional","⚙️ Funcional", choice(categoria = "nao-funcional","📐 Não-Funcional","🔧 Técnico")) AS "Categoria",
  choice(prioridade = "critica","🔴 Crítica", choice(prioridade = "alta","🟠 Alta", choice(prioridade = "media","🟡 Média","🟢 Baixa"))) AS "Prioridade",
  modulo AS "Módulo",
  milestone AS "Milestone"
FROM ""
WHERE tipo = "requisito" AND status = "planejado"
SORT prioridade ASC
```

---

## 💡 Em Ideação

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Requisito",
  prioridade AS "Prioridade",
  modulo AS "Módulo"
FROM ""
WHERE tipo = "requisito" AND status = "ideacao"
```

---

## 📊 Por Módulo

```dataviewjs
const req     = dv.pages('').where(p => p.tipo === "requisito");
const modulos = [...new Set(req.map(r => r.modulo).filter(Boolean))].sort();

const rows = modulos.map(mod => {
  const rs = req.where(r => r.modulo === mod);
  return [
    mod.charAt(0).toUpperCase() + mod.slice(1),
    rs.where(r=>r.categoria==="funcional").length,
    rs.where(r=>r.categoria==="nao-funcional").length,
    `✅${rs.where(r=>r.status==="entregue").length} 🔵${rs.where(r=>r.status==="em-dev").length} 📋${rs.where(r=>r.status==="planejado").length}`
  ];
});

dv.table(["Módulo","⚙️ Func.","📐 Não-Func.","Status"], rows);
```
