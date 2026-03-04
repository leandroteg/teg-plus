---
title: "🛒 Compras Dashboard"
type: painel-bi
tags: [painel, bi, dashboard, compras]
atualizado: 2026-03-04
modulo: compras
completude: 95
---

```dataviewjs
// ── DATA ────────────────────────────────────────────────────
const tarefas = dv.pages('"obsidian/Database/Tarefas"').where(t => t.modulo === "compras");
const milest  = dv.pages('"obsidian/Database/Milestones"').where(m => m.modulo === "compras");

// ── HELPERS ─────────────────────────────────────────────────
const pct  = (a, b) => b ? Math.round((a / b) * 100) : 0;
const cap  = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const pOrd = { critica: 0, alta: 1, media: 2, baixa: 3 };
const goto = name => `app.workspace.openLinkText('${name}','',false)`;

function pBar(p, color, h = 8) {
  return `<div style="height:${h}px;background:rgba(128,128,128,0.12);border-radius:4px;overflow:hidden;margin:5px 0;">
    <div style="width:${p}%;height:100%;background:linear-gradient(90deg,${color},${color}99);border-radius:4px;"></div>
  </div>`;
}
function navBtn(icon, label, target) {
  return `<button onclick="${goto(target)}"
    style="display:inline-flex;align-items:center;gap:6px;background:var(--background-secondary);
           border:1px solid rgba(128,128,128,.22);border-radius:8px;padding:6px 13px;
           cursor:pointer;color:var(--text-normal);font-size:.8em;
           font-family:var(--font-interface);transition:border-color .15s;"
    onmouseover="this.style.borderColor='rgba(128,128,128,.6)'"
    onmouseout="this.style.borderColor='rgba(128,128,128,.22)'">
    <span>${icon}</span><span>${label}</span>
  </button>`;
}
function goLink(label, target) {
  return `<span onclick="${goto(target)}"
    style="cursor:pointer;font-size:.75em;color:var(--text-muted);transition:color .15s;user-select:none;"
    onmouseover="this.style.color='var(--text-accent,#4cc9f0)'"
    onmouseout="this.style.color='var(--text-muted)'">${label}</span>`;
}
function secHead(title, allTarget) {
  const link = allTarget
    ? `<span onclick="${goto(allTarget)}"
        style="cursor:pointer;font-size:.72em;color:var(--text-muted);transition:color .15s;"
        onmouseover="this.style.color='var(--text-accent,#4cc9f0)'"
        onmouseout="this.style.color='var(--text-muted)'">Ver todos →</span>` : '';
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.8px;font-weight:600;">${title}</span>
    ${link}</div>`;
}
function kpi(val, label, color, sub, p, detailTarget) {
  const detail = detailTarget
    ? `<div style="border-top:1px solid rgba(128,128,128,.1);margin-top:10px;padding-top:8px;text-align:right;">
        ${goLink('→ Detalhes', detailTarget)}</div>` : '';
  return `<div style="background:var(--background-secondary);border:1px solid ${color}20;
              border-top:3px solid ${color};border-radius:12px;padding:18px 16px;">
    <div style="font-size:2.1em;font-weight:700;color:${color};line-height:1.15;">${val}</div>
    <div style="font-size:.67em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.6px;margin:7px 0 2px;">${label}</div>
    ${p !== undefined ? pBar(p, color) : ''}
    <div style="font-size:.76em;color:var(--text-muted);margin-top:3px;">${sub}</div>
    ${detail}</div>`;
}
function card(inner) {
  return `<div style="background:var(--background-secondary);border:1px solid rgba(128,128,128,.14);border-radius:12px;padding:18px;">${inner}</div>`;
}
function taskList(tarefas, limit) {
  const items = tarefas.sort(t => pOrd[t.prioridade] ?? 9, "asc").array().slice(0, limit || 8);
  if (!items.length) return '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">Sem tarefas registradas</div>';
  const prioCols = { critica: '#ff6b6b', alta: '#ffd166', media: '#06d6a0', baixa: '#4cc9f0' };
  const prioIcons = { critica: '🔴', alta: '🟠', media: '🟡', baixa: '🟢' };
  const stCols = { concluido: '#06d6a0', 'em-andamento': '#4cc9f0', backlog: '#888', pendente: '#888', planejado: '#a855f7' };
  return items.map(t => {
    const ic = prioIcons[t.prioridade] || '⬜';
    const stCol = stCols[t.status] || '#888';
    return `<div onclick="${goto(t.file.name)}"
      style="display:flex;align-items:center;gap:10px;padding:7px 0;
             border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;
             transition:background .12s;border-radius:4px;"
      onmouseover="this.style.background='rgba(128,128,128,.06)'"
      onmouseout="this.style.background='transparent'">
      <span style="font-size:.9em;">${ic}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${t.titulo || t.file.name}</div>
        <div style="font-size:.7em;color:var(--text-muted);">${t.sprint || ''}</div>
      </div>
      <span style="font-size:.72em;color:${stCol};font-weight:600;">${cap(t.status)}</span>
    </div>`;
  }).join('');
}

const C = { blue: '#4cc9f0', green: '#06d6a0', purple: '#a855f7', orange: '#ffd166', red: '#ff6b6b', indigo: '#4361ee', pink: '#f72585', teal: '#2ec4b6' };

// ── MODULE DATA ─────────────────────────────────────────────
const tDone  = tarefas.where(t => t.status === "concluido").length;
const tWip   = tarefas.where(t => t.status === "em-andamento").length;
const tTotal = tarefas.length;
const pts    = tarefas.array().reduce((s, t) => s + (t.estimativa || 0), 0);
const ptsDone = tarefas.where(t => t.status === "concluido").array().reduce((s, t) => s + (t.estimativa || 0), 0);
const completude = 95;

const submodulos = [
  { nome: 'Requisições 3-Step Wizard', pct: 100 },
  { nome: 'AI Parse (n8n + Claude)',   pct: 100 },
  { nome: 'Aprovações 4 Alçadas',      pct: 100 },
  { nome: 'Token-Based Approval',      pct: 100 },
  { nome: 'Catálogo de Materiais',     pct: 100 },
  { nome: 'Dashboard KPIs',            pct: 100 },
  { nome: 'Cotações Multi-Fornecedor', pct: 70 },
  { nome: 'Purchase Orders (PO)',      pct: 60 },
];
const integracoes = [
  { nome: 'n8n AI Parse',          icon: '🤖', ok: true },
  { nome: 'Supabase RLS',          icon: '🔒', ok: true },
  { nome: 'WhatsApp Notificações', icon: '📱', ok: false },
  { nome: 'Estoque Auto-Baixa',    icon: '📦', ok: false },
  { nome: 'Financeiro → CP',       icon: '💰', ok: false },
];

// ── RENDER ──────────────────────────────────────────────────
const w = dv.container.createEl('div');
w.insertAdjacentHTML('afterbegin', `
<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">

  <!-- NAV BAR -->
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;
              border-bottom:1px solid rgba(128,128,128,.13);">
    ${navBtn('🏠','Início','PAINEL PRINCIPAL')}
    ${navBtn('📊','BI Geral','BI Dashboard')}
    ${navBtn('💰','Financeiro','Financeiro Dashboard')}
    ${navBtn('📦','Estoque','Estoque Dashboard')}
    ${navBtn('🚚','Logística','Logistica Dashboard')}
    ${navBtn('🚗','Frotas','Frotas Dashboard')}
    ${navBtn('👥','RH','RH Dashboard')}
  </div>

  <!-- HEADER -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
    <div style="font-size:2.4em;">🛒</div>
    <div>
      <div style="font-size:1.4em;font-weight:700;">Módulo Compras</div>
      <div style="font-size:.78em;color:var(--text-muted);">Requisições · Cotações · Aprovações · PO · Catálogo</div>
    </div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-size:2em;font-weight:700;color:${C.green};">${completude}%</div>
      <div style="font-size:.65em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;">Completude</div>
    </div>
  </div>

  <!-- KPI ROW -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
    ${kpi(submodulos.filter(s => s.pct === 100).length, 'Features Prontas', C.green,
      `de ${submodulos.length} submódulos`, pct(submodulos.filter(s=>s.pct===100).length, submodulos.length))}
    ${kpi(submodulos.filter(s => s.pct < 100).length, 'Em Desenvolvimento', C.blue,
      'Cotações e PO em progresso', undefined)}
    ${kpi(`${tDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${tTotal}</span>`,
      'Tarefas', C.purple, `🔵 ${tWip} em andamento`, pct(tDone, tTotal), 'Tasks Board')}
    ${kpi(`${ptsDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${pts}</span>`,
      'Story Points', C.orange, `${pct(ptsDone, pts)}% entregues`, pct(ptsDone, pts))}
  </div>

  <!-- SUBMÓDULOS + INTEGRAÇÕES -->
  <div style="display:grid;grid-template-columns:3fr 2fr;gap:12px;margin-bottom:12px;">
    ${card(`
      ${secHead('📦 Submódulos')}
      ${submodulos.map(s => {
        const col = s.pct === 100 ? C.green : s.pct >= 50 ? C.blue : C.orange;
        return `<div style="margin:8px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;">
            <span>${s.nome}</span>
            <span style="color:${col};font-weight:600;">${s.pct}%</span>
          </div>${pBar(s.pct, col, 7)}</div>`;
      }).join('')}
    `)}
    ${card(`
      ${secHead('🔗 Integrações')}
      ${integracoes.map(ig => {
        const col = ig.ok ? C.green : 'var(--text-muted)';
        const badge = ig.ok ? '✅' : '⬜';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;
                   border-bottom:1px solid rgba(128,128,128,.08);">
          <span style="font-size:1.1em;">${ig.icon}</span>
          <span style="flex:1;font-size:.84em;">${ig.nome}</span>
          <span style="font-size:.75em;color:${col};font-weight:600;">${badge}</span>
        </div>`;
      }).join('')}
      <div style="margin-top:14px;padding:12px;background:rgba(6,214,160,.06);border-radius:8px;border-left:3px solid ${C.green};">
        <div style="font-size:.75em;color:var(--text-muted);margin-bottom:4px;">🤖 Destaque</div>
        <div style="font-size:.84em;">AI Parse via n8n + Claude processa requisições automaticamente extraindo itens, quantidades e especificações técnicas.</div>
      </div>
    `)}
  </div>

  <!-- FLUXO + TAREFAS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    ${card(`
      ${secHead('✅ Fluxo de Aprovação')}
      ${[
        ['1️⃣','Solicitante cria requisição','3-step wizard + AI parse'],
        ['2️⃣','Gestor Obra aprova','Alçada 1 — in-app'],
        ['3️⃣','Coordenador aprova','Alçada 2 — token email'],
        ['4️⃣','Diretor aprova','Alçada 3 — token email'],
        ['5️⃣','Financeiro libera','Alçada 4 — dashboard'],
      ].map(([ic, title, sub]) =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;
               border-bottom:1px solid rgba(128,128,128,.06);">
          <span style="font-size:1.1em;">${ic}</span>
          <div><div style="font-size:.84em;font-weight:500;">${title}</div>
            <div style="font-size:.7em;color:var(--text-muted);">${sub}</div></div>
        </div>`
      ).join('')}
      <div style="margin-top:10px;padding:10px;background:rgba(76,201,240,.06);border-radius:8px;font-size:.78em;color:var(--text-muted);">
        💡 Aprovações via token permitem aprovação sem login, direto do email</div>
    `)}
    ${card(`
      ${secHead('📋 Tarefas do Módulo', 'Tasks Board')}
      ${taskList(tarefas, 8)}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);
                  display:flex;justify-content:space-between;">
        ${goLink('+ Nova tarefa →', 'Tasks Board')}
        ${goLink('Ver todas →', 'Tasks Board')}
      </div>
    `)}
  </div>
</div>
`);
```
