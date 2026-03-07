---
title: "🚀 Dev Hub BI — Business Intelligence"
type: painel-bi
tags: [painel, dev-hub, bi, issues, github, analytics]
atualizado: 2026-03-07
---

```dataviewjs
// ── DATA ────────────────────────────────────────────────────
const issues  = dv.pages('"obsidian/Database/Issues"');
const tarefas = dv.pages('"obsidian/Database/Tarefas"');

// ── HELPERS ─────────────────────────────────────────────────
const pct  = (a, b) => b ? Math.round((a / b) * 100) : 0;
const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const goto = name => `app.workspace.openLinkText('${name}','',false)`;

function pBar(p, color, h) {
  h = h || 8;
  return '<div style="height:' + h + 'px;background:rgba(128,128,128,0.12);border-radius:4px;overflow:hidden;margin:5px 0;">'
    + '<div style="width:' + p + '%;height:100%;background:linear-gradient(90deg,' + color + ',' + color + '99);border-radius:4px;"></div>'
    + '</div>';
}

function navBtn(icon, label, target) {
  return '<button onclick="' + goto(target) + '"'
    + ' style="display:inline-flex;align-items:center;gap:6px;background:var(--background-secondary);'
    + 'border:1px solid rgba(128,128,128,.22);border-radius:8px;padding:6px 13px;'
    + 'cursor:pointer;color:var(--text-normal);font-size:.8em;'
    + 'font-family:var(--font-interface);transition:border-color .15s,opacity .15s;"'
    + ' onmouseover="this.style.borderColor=\'rgba(128,128,128,.6)\'"'
    + ' onmouseout="this.style.borderColor=\'rgba(128,128,128,.22)\'">'
    + '<span>' + icon + '</span><span>' + label + '</span>'
    + '</button>';
}

function goLink(label, target) {
  return '<span onclick="' + goto(target) + '"'
    + ' style="cursor:pointer;font-size:.75em;color:var(--text-muted);'
    + 'transition:color .15s;user-select:none;"'
    + ' onmouseover="this.style.color=\'var(--text-accent,#4cc9f0)\'"'
    + ' onmouseout="this.style.color=\'var(--text-muted)\'">' + label + '</span>';
}

function secHead(title, allTarget) {
  var link = allTarget
    ? '<span onclick="' + goto(allTarget) + '"'
      + ' style="cursor:pointer;font-size:.72em;color:var(--text-muted);transition:color .15s;"'
      + ' onmouseover="this.style.color=\'var(--text-accent,#4cc9f0)\'"'
      + ' onmouseout="this.style.color=\'var(--text-muted)\'">Ver todos →</span>'
    : '';
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">'
    + '<span style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.8px;font-weight:600;">' + title + '</span>'
    + link + '</div>';
}

function kpi(val, label, color, sub, p, detailTarget) {
  var detail = detailTarget
    ? '<div style="border-top:1px solid rgba(128,128,128,.1);margin-top:10px;padding-top:8px;text-align:right;">'
      + goLink('→ Detalhes', detailTarget) + '</div>'
    : '';
  return '<div style="background:var(--background-secondary);border:1px solid ' + color + '20;'
    + 'border-top:3px solid ' + color + ';border-radius:12px;padding:18px 16px;">'
    + '<div style="font-size:2.1em;font-weight:700;color:' + color + ';line-height:1.15;">' + val + '</div>'
    + '<div style="font-size:.67em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.6px;margin:7px 0 2px;">' + label + '</div>'
    + (p !== undefined ? pBar(p, color) : '')
    + '<div style="font-size:.76em;color:var(--text-muted);margin-top:3px;">' + sub + '</div>'
    + detail + '</div>';
}

function hBar(label, val, total, color, target) {
  var p = pct(val, total);
  var link = target
    ? '<span onclick="' + goto(target) + '"'
      + ' style="cursor:pointer;opacity:.5;font-size:.85em;transition:opacity .15s;"'
      + ' onmouseover="this.style.opacity=\'1\'"'
      + ' onmouseout="this.style.opacity=\'.5\'">↗</span>'
    : '';
  return '<div style="margin:8px 0;">'
    + '<div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;align-items:center;">'
    + '<span style="color:var(--text-normal);display:flex;align-items:center;gap:5px;">' + label + ' ' + link + '</span>'
    + '<span style="color:' + color + ';font-weight:600;">' + val + '&thinsp;/&thinsp;' + total + ' &nbsp;<span style="opacity:.7;">' + p + '%</span></span>'
    + '</div>' + pBar(p, color, 9) + '</div>';
}

function card(inner, cols) {
  var span = cols ? 'grid-column:span ' + cols + ';' : '';
  return '<div style="' + span + 'background:var(--background-secondary);border:1px solid rgba(128,128,128,.14);border-radius:12px;padding:18px;">' + inner + '</div>';
}

// Tag helper: Dataview returns tags with # prefix
function hasTag(item, tag) {
  if (!item.tags) return false;
  return item.tags.includes(tag) || item.tags.includes('#' + tag);
}

// ── METRICS ─────────────────────────────────────────────────
var total      = issues.length;
var abertos    = issues.where(function(i){return i.status === "aberto"}).length;
var emAndam    = issues.where(function(i){return i.status === "em-andamento"}).length;
var resolvidos = issues.where(function(i){return i.status === "resolvido"}).length;
var pendentes  = abertos + emAndam;

var bugs    = issues.where(function(i){return hasTag(i, "bug")}).length;
var enh     = issues.where(function(i){return hasTag(i, "enhancement")}).length;
var outros  = total - bugs - enh;

var ghCount    = issues.where(function(i){return i.github_issue}).length;
var agentCount = issues.where(function(i){return i.origem === "superteg-agent"}).length;
var manualCount= total - agentCount;

var criticos = issues.where(function(i){return i.status !== "resolvido" && i.severidade === "critica"}).length;
var altos    = issues.where(function(i){return i.status !== "resolvido" && i.severidade === "alta"}).length;
var medios   = issues.where(function(i){return i.status !== "resolvido" && i.severidade === "media"}).length;
var baixos   = issues.where(function(i){return i.status !== "resolvido" && i.severidade === "baixa"}).length;

var resolveRate = pct(resolvidos, total);

var bugsResolved = issues.where(function(i){return hasTag(i, "bug") && i.status === "resolvido"}).length;
var enhResolved  = issues.where(function(i){return hasTag(i, "enhancement") && i.status === "resolvido"}).length;

var modulos    = [...new Set(issues.map(function(i){return i.modulo}).filter(Boolean))].sort();
var modEmoji   = { compras:'🛒', financeiro:'💰', estoque:'📦', logistica:'🚛', frotas:'🚗', geral:'⚙️', infra:'🔧' };

var sevOrder = {"critica": 0, "alta": 1, "media": 2, "baixa": 3};
var topIssues = issues.where(function(i){return i.status !== "resolvido"})
  .sort(function(i){var v = sevOrder[i.severidade]; return v !== undefined ? v : 9;}, "asc").array().slice(0, 6);

// ── COLORS ──────────────────────────────────────────────────
var C = {
  blue:   '#4cc9f0', green:  '#06d6a0', purple: '#a855f7',
  orange: '#ffd166', red:    '#ff6b6b', indigo: '#4361ee',
  pink:   '#f72585', cyan:   '#22d3ee', teal:   '#14b8a6',
};
var modColors = [C.blue, C.green, C.purple, C.orange, C.red, C.indigo, C.pink, C.cyan, C.teal];

function sevStyle(s) {
  return s === "critica" ? ['🔴', C.red]
       : s === "alta"    ? ['🟠', C.orange]
       : s === "media"   ? ['🟡', C.green]
       :                   ['🟢', C.blue];
}

// ── BUILD HTML ──────────────────────────────────────────────
var html = [];
html.push('<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">');

// NAV BAR
html.push('<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.13);">');
html.push(navBtn('🏠', 'Início', 'PAINEL PRINCIPAL'));
html.push(navBtn('📋', 'Tasks', 'Tasks Board'));
html.push(navBtn('🐛', 'Issues', 'Issues Board'));
html.push(navBtn('⚡', 'Execução', 'Execucao Board'));
html.push(navBtn('📈', 'Relatório', 'Relatorio Desenvolvimento'));
html.push(navBtn('🗺️', 'Roadmap', 'Roadmap Board'));
html.push(navBtn('📊', 'BI Geral', 'BI Dashboard'));
html.push('</div>');

// HEADER
var healthBg = criticos > 0 ? C.red : altos > 0 ? C.orange : C.green;
var healthTxt = criticos > 0 ? '⚠ ' + criticos + ' CRÍTICA' + (criticos > 1 ? 'S' : '')
              : altos > 0 ? '⚠ ' + altos + ' ALTA' + (altos > 1 ? 'S' : '')
              : '✓ SAUDÁVEL';
html.push('<div style="margin-bottom:16px;">');
html.push('<div style="font-size:1.5em;font-weight:700;display:flex;align-items:center;gap:10px;">');
html.push('🚀 Dev Hub BI');
html.push('<span style="font-size:.45em;background:' + healthBg + ';color:#fff;padding:3px 10px;border-radius:20px;font-weight:600;letter-spacing:.5px;">');
html.push(healthTxt);
html.push('</span></div>');
html.push('<div style="font-size:.78em;color:var(--text-muted);margin-top:4px;">');
html.push('Issues internas + GitHub + Feedbacks SuperTEG &nbsp;·&nbsp; Atualizado: ' + new Date().toLocaleDateString('pt-BR'));
html.push('</div></div>');

// KPI ROW
html.push('<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">');
html.push(kpi(total, 'Total Issues', C.indigo,
  '🐛 ' + bugs + ' bugs &nbsp;·&nbsp; 💡 ' + enh + ' melhorias &nbsp;·&nbsp; 📋 ' + outros + ' outros',
  undefined));
html.push(kpi(pendentes, 'Pendentes', pendentes > 0 ? C.orange : C.green,
  '🔴 ' + abertos + ' abertas &nbsp;·&nbsp; 🔵 ' + emAndam + ' em dev',
  undefined, 'Execucao Board'));
html.push(kpi(resolvidos, 'Resolvidas', C.green,
  '🐛 ' + bugsResolved + ' bugs &nbsp;·&nbsp; 💡 ' + enhResolved + ' melhorias',
  resolveRate, 'Issues Board'));
html.push(kpi(resolveRate + '<span style="font-size:.5em;opacity:.6;font-weight:400;">%</span>',
  'Taxa Resolução', resolveRate >= 70 ? C.green : resolveRate >= 40 ? C.orange : C.red,
  'Meta: 80% &nbsp;·&nbsp; ' + (resolveRate >= 80 ? '✅ Atingida' : '⏳ Em progresso'),
  resolveRate));
html.push('</div>');

// CHARTS ROW 1: Pipeline + Severidade
html.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">');

var pipelineInner = secHead('🔄 Pipeline de Desenvolvimento', 'Execucao Board')
  + hBar('🔴 Backlog (aberto)', abertos, total || 1, C.red, 'Execucao Board')
  + hBar('🔵 Em Andamento', emAndam, total || 1, C.blue, 'Execucao Board')
  + hBar('✅ Resolvido', resolvidos, total || 1, C.green, 'Issues Board')
  + '<div style="border-top:1px solid rgba(128,128,128,.12);margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">'
  + '<span style="font-size:.78em;color:var(--text-muted);">Progresso: <strong style="color:' + C.green + ';">' + resolveRate + '%</strong></span>'
  + goLink('→ Execução Board', 'Execucao Board') + '</div>';
html.push(card(pipelineInner));

var sevInner = secHead('🎯 Severidade (não resolvidas)', 'Issues Board')
  + hBar('🔴 Crítica', criticos, pendentes || 1, C.red, 'Issues Board')
  + hBar('🟠 Alta', altos, pendentes || 1, C.orange, 'Issues Board')
  + hBar('🟡 Média', medios, pendentes || 1, C.green, 'Issues Board')
  + hBar('🟢 Baixa', baixos, pendentes || 1, C.blue, 'Issues Board')
  + '<div style="border-top:1px solid rgba(128,128,128,.12);margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">'
  + '<span style="font-size:.78em;color:var(--text-muted);">'
  + (criticos > 0 ? '<span style="color:' + C.red + ';font-weight:600;">⚠️ ' + criticos + ' crítica(s)!</span>' : '✅ Nenhuma crítica aberta')
  + '</span>' + goLink('→ Issues Board', 'Issues Board') + '</div>';
html.push(card(sevInner));
html.push('</div>');

// CHARTS ROW 2: Módulos + Tipo/Origem
html.push('<div style="display:grid;grid-template-columns:3fr 2fr;gap:12px;margin-bottom:12px;">');

var modInner = secHead('📦 Issues por Módulo', 'Issues Board');
if (modulos.length) {
  modulos.forEach(function(mod, i) {
    var ms   = issues.where(function(ii){return ii.modulo === mod});
    var open = ms.where(function(ii){return ii.status !== "resolvido"}).length;
    var emoji = modEmoji[mod] || '📋';
    modInner += hBar(emoji + ' ' + cap(mod), open, pendentes || 1, modColors[i % modColors.length], 'Issues Board');
  });
} else {
  modInner += '<span style="color:var(--text-muted);font-size:.85em;">Sem dados de módulo</span>';
}
html.push(card(modInner));

var compInner = secHead('📊 Composição')
  + '<div style="margin-bottom:16px;">'
  + '<div style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:600;">Por Tipo</div>'
  + hBar('🐛 Bugs', bugs, total || 1, C.red)
  + hBar('💡 Melhorias', enh, total || 1, C.purple)
  + hBar('📋 Outros', outros, total || 1, C.blue)
  + '</div>'
  + '<div style="border-top:1px solid rgba(128,128,128,.12);padding-top:12px;">'
  + '<div style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:600;">Por Origem</div>'
  + hBar('🤖 SuperTEG Agent', agentCount, total || 1, C.pink)
  + hBar('👤 Manual / GitHub', manualCount, total || 1, C.indigo)
  + '<div style="margin-top:8px;font-size:.76em;color:var(--text-muted);">🔗 ' + ghCount + ' vinculadas ao GitHub</div>'
  + '</div>';
html.push(card(compInner));
html.push('</div>');

// BOTTOM ROW: Top Issues + Saúde Módulos
html.push('<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;">');

var topInner = secHead('⚡ Próximas a Resolver', 'Execucao Board');
if (topIssues.length) {
  topIssues.forEach(function(i) {
    var sv = sevStyle(i.severidade);
    var ic = sv[0]; var col = sv[1];
    var tipo = hasTag(i, "bug") ? "🐛"
             : hasTag(i, "enhancement") ? "💡" : "📋";
    var gh = i.github_issue ? '<span style="font-size:.7em;opacity:.6;margin-left:4px;">GH#' + i.github_issue + '</span>' : '';
    var orig = i.origem === "superteg-agent" ? ' 🤖' : '';
    var stLabel = i.status === "em-andamento" ? "🔵 DEV" : "ABERTA";
    topInner += '<div onclick="' + goto(i.file.name) + '"'
      + ' style="display:flex;align-items:center;gap:10px;padding:7px 0;'
      + 'border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;'
      + 'transition:background .12s;border-radius:4px;"'
      + ' onmouseover="this.style.background=\'rgba(128,128,128,.06)\'"'
      + ' onmouseout="this.style.background=\'transparent\'">'
      + '<span style="font-size:.9em;">' + ic + '</span>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + tipo + ' ' + (i.titulo || i.file.name).substring(0, 48) + ' ' + gh
      + '</div>'
      + '<div style="font-size:.7em;color:var(--text-muted);">' + (i.modulo || '') + orig + '</div>'
      + '</div>'
      + '<span style="font-size:.68em;color:' + col + ';font-weight:600;white-space:nowrap;'
      + 'padding:2px 8px;border-radius:6px;background:' + col + '15;">'
      + stLabel + '</span></div>';
  });
} else {
  topInner += '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">✅ Nenhuma issue pendente!</div>';
}
topInner += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;">'
  + goLink('→ Execução Board', 'Execucao Board')
  + goLink('→ Gerar AI Spec', 'Execucao Board') + '</div>';
html.push(card(topInner));

var healthInner = secHead('🏥 Saúde por Módulo');
if (modulos.length) {
  modulos.forEach(function(mod) {
    var ms   = issues.where(function(ii){return ii.modulo === mod});
    var open = ms.where(function(ii){return ii.status !== "resolvido"}).length;
    var crit = ms.where(function(ii){return ii.status !== "resolvido" && ii.severidade === "critica"}).length;
    var hi   = ms.where(function(ii){return ii.status !== "resolvido" && ii.severidade === "alta"}).length;
    var done = ms.where(function(ii){return ii.status === "resolvido"}).length;
    var rate = pct(done, ms.length);
    var emoji = modEmoji[mod] || '📋';
    var health, hCol;
    if (crit > 0) { health = '🔴 Crítico'; hCol = C.red; }
    else if (hi > 0) { health = '🟠 Atenção'; hCol = C.orange; }
    else if (open > 0) { health = '🟡 OK'; hCol = C.green; }
    else { health = '✅ Limpo'; hCol = C.green; }
    healthInner += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.08);">'
      + '<span style="font-size:1.1em;">' + emoji + '</span>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:.84em;font-weight:500;">' + cap(mod) + '</div>'
      + '<div style="font-size:.68em;color:var(--text-muted);">' + open + ' abertas · ' + done + ' resolvidas</div>'
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-size:.72em;color:' + hCol + ';font-weight:600;">' + health + '</div>'
      + '<div style="font-size:.65em;color:var(--text-muted);">' + rate + '% resolvido</div>'
      + '</div></div>';
  });
} else {
  healthInner += '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">Sem dados</div>';
}
healthInner += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;">'
  + goLink('→ BI Dashboard', 'BI Dashboard')
  + goLink('→ Relatório Dev', 'Relatorio Desenvolvimento') + '</div>';
html.push(card(healthInner));

html.push('</div>');
html.push('</div>');

// ── RENDER ──────────────────────────────────────────────────
var w = dv.container.createEl('div');
w.innerHTML = html.join('');
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
      const labels = i.tags ? i.tags.filter(t => t !== "issue" && t !== "github" && t !== "#issue" && t !== "#github").map(t => t.replace(/^#/, '')).join(", ") : "—";
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
      const ht = (item, tag) => item.tags && (item.tags.includes(tag) || item.tags.includes('#' + tag));
      const tipo = ht(i, "bug") ? "🐛 Bug" :
                   ht(i, "enhancement") ? "💡 Melhoria" : "📋 Tarefa";
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
