---
title: "📊 BI Dashboard"
type: painel-bi
tags: [painel, bi, dashboard, kpi]
atualizado: 2026-03-02
---
	
```dataviewjs
// ── DATA ────────────────────────────────────────────────────
const req     = dv.pages('"obsidian/Database/Requisitos"');
const milest  = dv.pages('"obsidian/Database/Milestones"');
const tarefas = dv.pages('"obsidian/Database/Tarefas"');
const issues  = dv.pages('"obsidian/Database/Issues"');

// ── HELPERS ─────────────────────────────────────────────────
const pct  = (a, b) => b ? Math.round((a / b) * 100) : 0;
const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const pOrd = { critica: 0, alta: 1, media: 2, baixa: 3 };

// Abre nota interna do Obsidian ao clicar
const goto = name => `app.workspace.openLinkText('${name}','',false)`;

function pBar(p, color, h = 8) {
  return `<div style="height:${h}px;background:rgba(128,128,128,0.12);border-radius:4px;overflow:hidden;margin:5px 0;">
    <div style="width:${p}%;height:100%;background:linear-gradient(90deg,${color},${color}99);border-radius:4px;"></div>
  </div>`;
}

// Botão de nav (barra superior)
function navBtn(icon, label, target) {
  return `<button onclick="${goto(target)}"
    style="display:inline-flex;align-items:center;gap:6px;background:var(--background-secondary);
           border:1px solid rgba(128,128,128,.22);border-radius:8px;padding:6px 13px;
           cursor:pointer;color:var(--text-normal);font-size:.8em;
           font-family:var(--font-interface);transition:border-color .15s,opacity .15s;"
    onmouseover="this.style.borderColor='rgba(128,128,128,.6)'"
    onmouseout="this.style.borderColor='rgba(128,128,128,.22)'">
    <span>${icon}</span><span>${label}</span>
  </button>`;
}

// Link inline pequeno (usa-se em footers e headers de card)
function goLink(label, target) {
  return `<span onclick="${goto(target)}"
    style="cursor:pointer;font-size:.75em;color:var(--text-muted);
           transition:color .15s;user-select:none;"
    onmouseover="this.style.color='var(--text-accent,#4cc9f0)'"
    onmouseout="this.style.color='var(--text-muted)'">${label}</span>`;
}

// Header de seção com link "Ver todos →" opcional
function secHead(title, allTarget) {
  const link = allTarget
    ? `<span onclick="${goto(allTarget)}"
        style="cursor:pointer;font-size:.72em;color:var(--text-muted);transition:color .15s;"
        onmouseover="this.style.color='var(--text-accent,#4cc9f0)'"
        onmouseout="this.style.color='var(--text-muted)'">Ver todos →</span>`
    : '';
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.8px;font-weight:600;">${title}</span>
    ${link}
  </div>`;
}

// KPI card com link "→ Detalhes" no rodapé
function kpi(val, label, color, sub, p, detailTarget) {
  const detail = detailTarget
    ? `<div style="border-top:1px solid rgba(128,128,128,.1);margin-top:10px;padding-top:8px;text-align:right;">
        ${goLink('→ Detalhes', detailTarget)}
       </div>`
    : '';
  return `
  <div style="background:var(--background-secondary);border:1px solid ${color}20;
              border-top:3px solid ${color};border-radius:12px;padding:18px 16px;">
    <div style="font-size:2.1em;font-weight:700;color:${color};line-height:1.15;">${val}</div>
    <div style="font-size:.67em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.6px;margin:7px 0 2px;">${label}</div>
    ${p !== undefined ? pBar(p, color) : ''}
    <div style="font-size:.76em;color:var(--text-muted);margin-top:3px;">${sub}</div>
    ${detail}
  </div>`;
}

function hBar(label, val, total, color, target) {
  const p    = pct(val, total);
  const link = target
    ? `<span onclick="${goto(target)}"
        style="cursor:pointer;opacity:.5;font-size:.85em;transition:opacity .15s;"
        onmouseover="this.style.opacity='1'"
        onmouseout="this.style.opacity='.5'">↗</span>`
    : '';
  return `<div style="margin:8px 0;">
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;align-items:center;">
      <span style="color:var(--text-normal);display:flex;align-items:center;gap:5px;">${label} ${link}</span>
      <span style="color:${color};font-weight:600;">${val}&thinsp;/&thinsp;${total} &nbsp;<span style="opacity:.7;">${p}%</span></span>
    </div>
    ${pBar(p, color, 9)}
  </div>`;
}

function card(inner, cols) {
  const span = cols ? `grid-column:span ${cols};` : '';
  return `<div style="${span}background:var(--background-secondary);border:1px solid rgba(128,128,128,.14);border-radius:12px;padding:18px;">${inner}</div>`;
}

// ── METRICS ─────────────────────────────────────────────────
const tDone   = tarefas.where(t => t.status === "concluido").length;
const tWip    = tarefas.where(t => t.status === "em-andamento").length;
const tBack   = tarefas.where(t => t.status === "backlog").length;
const tTotal  = tarefas.length;

const iAberto = issues.where(i => i.status === "aberto").length;
const iCrit   = issues.where(i => i.status === "aberto" && i.severidade === "critica").length;
const iRes    = issues.where(i => i.status === "resolvido").length;
const iDev    = issues.where(i => i.status === "em-andamento").length;

const mAtivo  = milest.where(m => m.status === "em-andamento").length;
const mDone   = milest.where(m => m.status === "concluido").length;

const pts     = tarefas.array().reduce((s, t) => s + (t.estimativa || 0), 0);
const ptsDone = tarefas.where(t => t.status === "concluido").array().reduce((s, t) => s + (t.estimativa || 0), 0);
const rEnt    = req.where(r => r.status === "entregue").length;

// ── COLORS ──────────────────────────────────────────────────
const C = {
  blue:   '#4cc9f0',
  green:  '#06d6a0',
  purple: '#a855f7',
  orange: '#ffd166',
  red:    '#ff6b6b',
  indigo: '#4361ee',
  pink:   '#f72585',
};
const modColors = [C.blue, C.green, C.purple, C.orange, C.red, C.indigo, C.pink];

// ── DATASETS ────────────────────────────────────────────────
const modulos    = [...new Set(tarefas.map(t => t.modulo).filter(Boolean))].sort();
const wipTasks   = tarefas.where(t => t.status === "em-andamento")
                     .sort(t => pOrd[t.prioridade] ?? 9, "asc").array().slice(0, 6);
const milestList = milest.sort(m => m.data_alvo, "asc").array().slice(0, 6);

function prioStyle(p) {
  return p === "critica" ? ['🔴', C.red]
       : p === "alta"    ? ['🟠', C.orange]
       : p === "media"   ? ['🟡', C.green]
       :                   ['🟢', C.blue];
}

// ── RENDER ──────────────────────────────────────────────────
const w = dv.container.createEl('div');
w.innerHTML = `
<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">

  <!-- ── NAV BAR ──────────────────────────────────────── -->
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;
              border-bottom:1px solid rgba(128,128,128,.13);">
    ${navBtn('🏠', 'Início',     'PAINEL PRINCIPAL')}
    ${navBtn('📋', 'Tasks',      'Tasks Board')}
    ${navBtn('🗺️', 'Roadmap',    'Roadmap Board')}
    ${navBtn('🐛', 'Issues',     'Issues Board')}
    ${navBtn('📦', 'Requisitos', 'Requisitos Board')}
  </div>

  <!-- ── KPI ROW ─────────────────────────────────────── -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
    ${kpi(
      `${tDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${tTotal}</span>`,
      'Tarefas Concluídas', C.blue,
      `🔵 ${tWip} andamento &nbsp;·&nbsp; ⬜ ${tBack} backlog`,
      pct(tDone, tTotal),
      'Tasks Board'
    )}
    ${kpi(
      iAberto,
      'Issues Abertas', iCrit > 0 ? C.red : C.orange,
      iCrit > 0 ? `🔴 ${iCrit} crítica(s) em aberto` : '✅ Nenhuma crítica aberta',
      undefined,
      'Issues Board'
    )}
    ${kpi(
      mAtivo,
      'Milestones Ativos', C.green,
      `✅ ${mDone} entregue(s) &nbsp;·&nbsp; ${milest.length} total`,
      pct(mDone, milest.length),
      'Roadmap Board'
    )}
    ${kpi(
      `${ptsDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${pts} pts</span>`,
      'Story Points', C.purple,
      `📋 ${req.length} requisitos &nbsp;·&nbsp; ${rEnt} entregues`,
      pct(ptsDone, pts),
      'Requisitos Board'
    )}
  </div>

  <!-- ── CHARTS ROW ──────────────────────────────────── -->
  <div style="display:grid;grid-template-columns:3fr 2fr;gap:12px;margin-bottom:12px;">

    ${card(`
      ${secHead('📦 Progresso por Módulo', 'Tasks Board')}
      ${modulos.length
        ? modulos.map((mod, i) => {
            const ts   = tarefas.where(t => t.modulo === mod);
            const done = ts.where(t => t.status === "concluido").length;
            return hBar(cap(mod), done, ts.length, modColors[i % modColors.length], 'Tasks Board');
          }).join('')
        : '<span style="color:var(--text-muted);font-size:.85em;">Sem dados de módulo</span>'
      }
    `)}

    ${card(`
      ${secHead('🐛 Issues por Severidade', 'Issues Board')}
      ${[['🔴 Crítica','critica',C.red],['🟠 Alta','alta',C.orange],['🟡 Média','media',C.green],['🟢 Baixa','baixa',C.blue]]
        .map(([lbl, sev, col]) =>
          hBar(lbl, issues.where(i => i.severidade === sev).length, issues.length, col, 'Issues Board')
        ).join('')}
      <div style="border-top:1px solid rgba(128,128,128,.12);margin-top:10px;padding-top:10px;
                  display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:.78em;color:var(--text-muted);">
          ✅ <strong style="color:${C.green};">${iRes}</strong> resolvidas
          &nbsp;·&nbsp;
          🔵 <strong style="color:${C.blue};">${iDev}</strong> em dev
        </span>
        ${goLink('+ Nova issue →', 'Issues Board')}
      </div>
    `)}
  </div>

  <!-- ── BOTTOM ROW ──────────────────────────────────── -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">

    ${card(`
      ${secHead('⚡ Em Andamento', 'Tasks Board')}
      ${wipTasks.length
        ? wipTasks.map(t => {
            const [ic, col] = prioStyle(t.prioridade);
            return `<div onclick="${goto(t.file.name)}"
              style="display:flex;align-items:center;gap:10px;padding:7px 0;
                     border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;
                     transition:background .12s;border-radius:4px;"
              onmouseover="this.style.background='rgba(128,128,128,.06)'"
              onmouseout="this.style.background='transparent'">
              <span style="font-size:.9em;">${ic}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${t.titulo || t.file.name}
                </div>
                <div style="font-size:.7em;color:var(--text-muted);">${t.modulo || ''} &nbsp;·&nbsp; ${t.sprint || ''}</div>
              </div>
              <span style="font-size:.75em;color:${col};font-weight:600;white-space:nowrap;">${t.estimativa || 0}&thinsp;pts</span>
            </div>`;
          }).join('')
        : '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">✅ Nenhuma em andamento</div>'
      }
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);
                  display:flex;justify-content:space-between;">
        ${goLink('+ Nova tarefa →', 'Tasks Board')}
        ${goLink('Ver backlog →', 'Tasks Board')}
      </div>
    `)}

    ${card(`
      ${secHead('🗺️ Milestones', 'Roadmap Board')}
      ${milestList.length
        ? milestList.map(m => {
            const [ic, col] = m.status === "concluido"    ? ['✅', C.green]
                             : m.status === "em-andamento" ? ['🔵', C.blue]
                             : m.status === "atrasado"     ? ['🔴', C.red]
                             :                              ['📋', 'var(--text-muted)'];
            const p = m.progresso || 0;
            return `<div onclick="${goto(m.file.name)}"
              style="padding:7px 0;border-bottom:1px solid rgba(128,128,128,.08);
                     cursor:pointer;border-radius:4px;transition:background .12s;"
              onmouseover="this.style.background='rgba(128,128,128,.06)'"
              onmouseout="this.style.background='transparent'">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                <span>${ic}</span>
                <span style="font-size:.84em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${m.titulo || m.file.name}
                </span>
                <span style="font-size:.75em;color:${col};font-weight:600;">${p}%</span>
              </div>
              ${pBar(p, col, 4)}
            </div>`;
          }).join('')
        : '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">Sem milestones</div>'
      }
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);
                  display:flex;justify-content:space-between;">
        ${goLink('+ Novo milestone →', 'Roadmap Board')}
        ${goLink('Ver timeline →', 'Roadmap Board')}
      </div>
    `)}
  </div>

</div>
`;
```
