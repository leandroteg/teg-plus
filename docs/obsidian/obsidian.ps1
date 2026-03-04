# ==============================================
# Setup Obsidian TEG+ — execute no PowerShell
# PS C:\teg-plus> .\setup-obsidian-teg.ps1
# ==============================================

$vault = "C:\teg-plus\docs\obsidian"

Write-Host "Configurando vault Obsidian TEG+..." -ForegroundColor Cyan

# Pastas
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\plugins\obsidian-git" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\plugins\dataview" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\plugins\templater-obsidian" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\plugins\calendar" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\plugins\obsidian-kanban" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\.obsidian\snippets" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\templates" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\daily" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\meetings" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\weekly" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\inbox" | Out-Null
New-Item -ItemType Directory -Force -Path "$vault\_assets" | Out-Null

# ---------- app.json ----------
@'
{
  "vimMode": false,
  "spellcheck": true,
  "defaultViewMode": "source",
  "foldHeading": true,
  "showLineNumber": true,
  "readableLineLength": true,
  "showFrontmatter": true,
  "autoConvertHtml": true,
  "alwaysUpdateLinks": true,
  "newFileLocation": "folder",
  "newFileFolderPath": "inbox",
  "attachmentFolderPath": "_assets",
  "promptDelete": true,
  "trashOption": "local"
}
'@ | Set-Content "$vault\.obsidian\app.json" -Encoding UTF8

# ---------- appearance.json ----------
@'
{
  "accentColor": "#7c3aed",
  "baseFontSize": 16,
  "interfaceFontSize": 14,
  "translucency": false
}
'@ | Set-Content "$vault\.obsidian\appearance.json" -Encoding UTF8

# ---------- community-plugins.json ----------
@'
["obsidian-git","dataview","templater-obsidian","obsidian-kanban","calendar"]
'@ | Set-Content "$vault\.obsidian\community-plugins.json" -Encoding UTF8

# ---------- hotkeys.json ----------
@'
{
  "templater-obsidian:insert-templater": [{"modifiers":["Alt"],"key":"t"}],
  "app:go-back": [{"modifiers":["Alt"],"key":"ArrowLeft"}],
  "app:go-forward": [{"modifiers":["Alt"],"key":"ArrowRight"}]
}
'@ | Set-Content "$vault\.obsidian\hotkeys.json" -Encoding UTF8

# ---------- Obsidian Git config ----------
@'
{
  "commitMessage": "vault backup: {{date}}",
  "autoSaveInterval": 10,
  "autoPullInterval": 10,
  "autoPullOnBoot": true,
  "disablePush": false,
  "pullBeforePush": true,
  "showStatusBar": true,
  "syncMethod": "merge"
}
'@ | Set-Content "$vault\.obsidian\plugins\obsidian-git\data.json" -Encoding UTF8

@'
{"id":"obsidian-git","name":"Obsidian Git","version":"2.27.0","minAppVersion":"0.15.0","description":"Backup your vault with Git","author":"Vinzent03","isDesktopOnly":true}
'@ | Set-Content "$vault\.obsidian\plugins\obsidian-git\manifest.json" -Encoding UTF8

# ---------- Dataview config ----------
@'
{
  "renderNullAs": "-",
  "taskCompletionTracking": true,
  "defaultDateFormat": "DD/MM/YYYY",
  "defaultDateTimeFormat": "DD/MM/YYYY HH:mm",
  "enableDataviewJs": true,
  "enableInlineDataviewJs": true,
  "prettyRenderInlineFields": true,
  "showResultCount": true
}
'@ | Set-Content "$vault\.obsidian\plugins\dataview\data.json" -Encoding UTF8

@'
{"id":"dataview","name":"Dataview","version":"0.5.67","minAppVersion":"0.13.11","description":"Complex data views for the data-obsessed","author":"Michael Brenan","isDesktopOnly":false}
'@ | Set-Content "$vault\.obsidian\plugins\dataview\manifest.json" -Encoding UTF8

# ---------- Templater config ----------
@'
{
  "templates_folder": "templates",
  "trigger_on_file_creation": true,
  "auto_jump_to_cursor": true,
  "enable_system_commands": false,
  "enable_folder_templates": true,
  "folder_templates": [{"folder":"daily","template":"templates/Template - Daily Note.md"}]
}
'@ | Set-Content "$vault\.obsidian\plugins\templater-obsidian\data.json" -Encoding UTF8

@'
{"id":"templater-obsidian","name":"Templater","version":"2.9.0","minAppVersion":"0.15.0","description":"Create and use templates","author":"SilentVoid","isDesktopOnly":false}
'@ | Set-Content "$vault\.obsidian\plugins\templater-obsidian\manifest.json" -Encoding UTF8

# ---------- Calendar config ----------
@'
{"shouldConfirmBeforeCreate":false,"weekStart":"monday","showWeeklyNote":true,"weeklyNoteFolder":"weekly","localeOverride":"pt-br"}
'@ | Set-Content "$vault\.obsidian\plugins\calendar\data.json" -Encoding UTF8

@'
{"id":"calendar","name":"Calendar","version":"1.5.10","minAppVersion":"0.9.11","description":"Simple calendar widget","author":"Liam Cain","isDesktopOnly":false}
'@ | Set-Content "$vault\.obsidian\plugins\calendar\manifest.json" -Encoding UTF8

# ---------- Kanban manifest ----------
@'
{"id":"obsidian-kanban","name":"Kanban","version":"2.0.57","minAppVersion":"0.13.25","description":"Create markdown-backed Kanban boards","author":"mgmeyers","isDesktopOnly":false}
'@ | Set-Content "$vault\.obsidian\plugins\obsidian-kanban\manifest.json" -Encoding UTF8

# ---------- CSS Snippet: TEG+ Theme ----------
@'
:root { --accent-h:263; --accent-s:70%; --accent-l:50%; }
.tag { background-color:var(--interactive-accent); color:white; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:500; }
.markdown-rendered h1 { border-bottom:2px solid var(--interactive-accent); padding-bottom:6px; }
.markdown-rendered h2 { color:var(--interactive-accent); }
table { width:100%; border-collapse:collapse; }
th { background-color:var(--background-modifier-hover); font-weight:600; }
td, th { padding:6px 12px; border:1px solid var(--background-modifier-border); }
'@ | Set-Content "$vault\.obsidian\snippets\teg-theme.css" -Encoding UTF8

# ---------- Template: Daily Note ----------
@'
---
date: "{{date}}"
type: daily
tags:
  - daily
---

# {{date:dddd, DD MMMM YYYY}}

## Foco do dia
- [ ]

## Reunioes
| Hora | Reuniao | Notas |
|------|---------|-------|
|      |         |       |

## Tasks TEG+
- [ ]

## Notas rapidas


## Revisao do dia
> O que foi feito? O que ficou pendente?
'@ | Set-Content "$vault\templates\Template - Daily Note.md" -Encoding UTF8

# ---------- Template: Meeting ----------
@'
---
date: "{{date}}"
type: meeting
project: TEG+
participants:
tags:
  - meeting
---

# Reuniao: {{title}}

**Data:** {{date:DD/MM/YYYY}}
**Participantes:**

## Pauta
1.

## Decisoes
-

## Action Items
- [ ] @pessoa - tarefa - prazo

## Links
- [[00 - TEG+ INDEX]]
'@ | Set-Content "$vault\templates\Template - Meeting Note.md" -Encoding UTF8

# ---------- Template: Bug Report ----------
@'
---
date: "{{date}}"
type: bug
status: open
priority: medium
module:
tags:
  - bug
---

# Bug: {{title}}

## Descricao

## Comportamento esperado

## Steps to reproduce
1.

## Ambiente
- **Branch:**
- **Browser:**

## Fix
- **Causa raiz:**
- **Solucao:**
'@ | Set-Content "$vault\templates\Template - Bug Report.md" -Encoding UTF8

# ---------- Template: Feature Spec ----------
@'
---
date: "{{date}}"
type: feature
status: draft
priority: medium
sprint:
tags:
  - feature
---

# Feature: {{title}}

## Problema

## Solucao proposta

## User Stories
- Como **[role]**, quero **[acao]** para **[beneficio]**

## Requisitos
### Must have
- [ ]

### Nice to have
- [ ]

## Criterios de aceite
- [ ]
'@ | Set-Content "$vault\templates\Template - Feature Spec.md" -Encoding UTF8

# ---------- Dashboard Dataview ----------
@'
---
type: dashboard
tags:
  - dashboard
---

# Dashboard TEG+ ERP

```dataviewjs
const bugs = dv.pages('"."').where(p => p.type === "bug" && p.status === "open")
const features = dv.pages('"."').where(p => p.type === "feature" && p.status !== "done")
const meetings = dv.pages('"."').where(p => p.type === "meeting")
const dailies = dv.pages('"."').where(p => p.type === "daily")
dv.paragraph(`> Bugs abertos: **${bugs.length}** | Features em andamento: **${features.length}** | Reunioes: **${meetings.length}** | Daily notes: **${dailies.length}**`)
```

---

## Bugs Abertos

```dataview
TABLE priority AS "Prioridade", module AS "Modulo", dateformat(date, "DD/MM/YYYY") AS "Data"
FROM "."
WHERE type = "bug" AND status = "open"
SORT priority ASC, date DESC
```

---

## Features em Andamento

```dataview
TABLE status AS "Status", sprint AS "Sprint", dateformat(date, "DD/MM/YYYY") AS "Criada em"
FROM "."
WHERE type = "feature" AND status != "done"
SORT date DESC
```

---

## Tasks Abertas

```dataview
TASK FROM "."
WHERE !completed
GROUP BY file.link
SORT file.mtime DESC
```

---

## Reunioes Recentes

```dataview
TABLE dateformat(date, "DD/MM/YYYY") AS "Data", participants AS "Participantes"
FROM "."
WHERE type = "meeting"
SORT date DESC
LIMIT 10
```

---

## Todas as Notas

```dataview
TABLE type AS "Tipo", dateformat(file.mtime, "DD/MM/YYYY HH:mm") AS "Ultima edicao"
FROM "."
WHERE file.name != "Dashboard TEG+"
SORT file.mtime DESC
```
'@ | Set-Content "$vault\Dashboard TEG+.md" -Encoding UTF8

# ---------- Kanban Board ----------
@'
---
kanban-plugin: board
tags:
  - kanban
---

## Backlog

- [ ] Modulo Financeiro
- [ ] Relatorios exportaveis PDF/Excel
- [ ] Notificacoes push mobile
- [ ] Integracao NF-e

## Em andamento

- [ ] Testes E2E Playwright
- [ ] Documentacao API publica
- [ ] Refactor aprovacao multi-nivel

## Review / QA

- [ ] Modulo Compras 7 etapas
- [ ] AprovAI

## Concluido

- [x] Setup Supabase + RLS
- [x] Auth com roles e alcadas
- [x] Deploy Vercel
- [x] Redesign dashboard
- [x] Dark theme
- [x] n8n workflows 4 ativos

%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
'@ | Set-Content "$vault\TEG+ Kanban.md" -Encoding UTF8

Write-Host ""
Write-Host "Pronto! Arquivos criados em $vault" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos no Obsidian:" -ForegroundColor Yellow
Write-Host "  1. Settings > Community plugins > desative Safe mode"
Write-Host "  2. Browse e instale: Obsidian Git, Dataview, Templater, Calendar, Kanban"
Write-Host "  3. Settings > Appearance > CSS Snippets > ative teg-theme"
Write-Host "  4. Abra o arquivo 'Dashboard TEG+' no vault"
Write-Host ""