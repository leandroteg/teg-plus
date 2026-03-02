---
title: "📦 Requisitos Board"
type: painel
tags: [painel, requisitos, rastreabilidade, backlog]
atualizado: 2026-03-02
---

# 📦 Requisitos Board — TEG+ ERP

> Rastreabilidade completa: cada requisito tem status, prioridade e vínculo com tarefas.
> Atualize os arquivos em `Database/Requisitos/` para ver as mudanças aqui.
> **Status válidos:** `ideacao` · `planejado` · `em-dev` · `entregue` · `cancelado`

---

## 📊 Cobertura de Requisitos

```dataviewjs
const req = dv.pages('"Database/Requisitos"');
const bar = v => "█".repeat(Math.round(v/10)) + "░".repeat(10-Math.round(v/10));

const entregue  = req.where(r => r.status === "entregue").length;
const emDev     = req.where(r => r.status === "em-dev").length;
const planejado = req.where(r => r.status === "planejado").length;
const ideacao   = req.where(r => r.status === "ideacao").length;
const cancelado = req.where(r => r.status === "cancelado").length;
const total     = req.length;
const pct       = total ? Math.round((entregue/total)*100) : 0;

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
FROM "Database/Requisitos"
WHERE status = "entregue"
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
FROM "Database/Requisitos"
WHERE status = "em-dev"
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
  sprint AS "Sprint Alvo",
  milestone AS "Milestone"
FROM "Database/Requisitos"
WHERE status = "planejado"
SORT prioridade ASC
```

---

## 💡 Em Ideação

```dataview
TABLE WITHOUT ID
  ("[[" + file.name + "|" + titulo + "]]") AS "Requisito",
  choice(categoria = "funcional","⚙️ Funcional", choice(categoria = "nao-funcional","📐 Não-Funcional","🔧 Técnico")) AS "Categoria",
  prioridade AS "Prioridade",
  modulo AS "Módulo"
FROM "Database/Requisitos"
WHERE status = "ideacao"
SORT prioridade ASC
```

---

## 📊 Por Módulo e Categoria

```dataviewjs
const req = dv.pages('"Database/Requisitos"');
const modulos = [...new Set(req.map(r => r.modulo).filter(Boolean))].sort();

const rows = modulos.map(mod => {
  const rs = req.where(r => r.modulo === mod);
  return [
    mod.charAt(0).toUpperCase() + mod.slice(1),
    rs.where(r=>r.categoria==="funcional").length,
    rs.where(r=>r.categoria==="nao-funcional").length,
    rs.where(r=>r.categoria==="tecnico").length,
    `✅${rs.where(r=>r.status==="entregue").length} 🔵${rs.where(r=>r.status==="em-dev").length} 📋${rs.where(r=>r.status==="planejado").length}`
  ];
});

dv.table(["Módulo","⚙️ Funcionais","📐 Não-Funcionais","🔧 Técnicos","Status"], rows);
```

---

## 🔗 Rastreabilidade Reversa

```dataviewjs
// Mostra cada requisito com sua tarefa vinculada
const req    = dv.pages('"Database/Requisitos"').where(r => r.status !== "cancelado");
const tarefas = dv.pages('"Database/Tarefas"');

const rows = req.sort(r => r.id).map(r => {
  // Tenta vincular por milestone
  const linked = tarefas.where(t => {
    const body = t.file.content || "";
    return body.includes(r.file.name) || body.includes(r.id);
  });
  const statusIcon = r.status === "entregue" ? "✅" : r.status === "em-dev" ? "🔵" : "📋";
  return [
    `${statusIcon} [[${r.file.name}|${r.id}]]`,
    r.titulo,
    r.modulo,
    r.prioridade
  ];
});

dv.table(["ID","Título","Módulo","Prioridade"], rows);
```

---

## ➕ Como Criar um Requisito

1. Duplicar qualquer nota de `Database/Requisitos/`
2. Renomear: `REQ-XXX - Titulo do requisito.md`
3. Preencher o frontmatter:
```yaml
id: REQ-XXX
titulo: "Título claro e objetivo"
categoria: funcional      # funcional | nao-funcional | tecnico
prioridade: alta
status: planejado         # ideacao | planejado | em-dev | entregue | cancelado
modulo: compras
sprint: Sprint-X
milestone: MS-XXX
```
4. Aparece automaticamente neste board
