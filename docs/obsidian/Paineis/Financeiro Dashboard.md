---
title: "💰 Financeiro Dashboard"
type: painel-bi
tags: [painel, bi, dashboard, financeiro]
atualizado: 2026-03-04
modulo: financeiro
completude: 50
---

```dataviewjs
// ── DATA ────────────────────────────────────────────────────
const tarefas = dv.pages('"obsidian/Database/Tarefas"').where(t => t.modulo === "financeiro");
const milest  = dv.pages('"obsidian/Database/Milestones"').where(m => m.modulo === "financeiro");

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
           cursor:pointer;color:var(--text-normal);font-size:.8em;font-family:var(--font-interface);transition:border-color .15s;"
    onmouseover="this.style.borderColor='rgba(128,128,128,.6)'"
    onmouseout="this.style.borderColor='rgba(128,128,128,.22)'">
    <span>${icon}</span><span>${label}</span></button>`;
}
function goLink(label, target) {
  return `<span onclick="${goto(target)}"
    style="cursor:pointer;font-size:.75em;color:var(--text-muted);transition:color .15s;user-select:none;"
    onmouseover="this.style.color='var(--text-accent,#4cc9f0)'"
    onmouseout="this.style.color='var(--text-muted)'">${label}</span>`;
}
function secHead(title, allTarget) {
  const link = allTarget ? `<span onclick="${goto(allTarget)}" style="cursor:pointer;font-size:.72em;color:var(--text-muted);transition:color .15s;" onmouseover="this.style.color='var(--text-accent,#4cc9f0)'" onmouseout="this.style.color='var(--text-muted)'">Ver todos →</span>` : '';
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.8px;font-weight:600;">${title}</span>${link}</div>`;
}
function kpi(val, label, color, sub, p, dt) {
  const detail = dt ? `<div style="border-top:1px solid rgba(128,128,128,.1);margin-top:10px;padding-top:8px;text-align:right;">${goLink('→ Detalhes', dt)}</div>` : '';
  return `<div style="background:var(--background-secondary);border:1px solid ${color}20;border-top:3px solid ${color};border-radius:12px;padding:18px 16px;">
    <div style="font-size:2.1em;font-weight:700;color:${color};line-height:1.15;">${val}</div>
    <div style="font-size:.67em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.6px;margin:7px 0 2px;">${label}</div>
    ${p !== undefined ? pBar(p, color) : ''}
    <div style="font-size:.76em;color:var(--text-muted);margin-top:3px;">${sub}</div>${detail}</div>`;
}
function card(inner) { return `<div style="background:var(--background-secondary);border:1px solid rgba(128,128,128,.14);border-radius:12px;padding:18px;">${inner}</div>`; }
function taskList(tarefas, limit) {
  const items = tarefas.sort(t => pOrd[t.prioridade] ?? 9, "asc").array().slice(0, limit || 8);
  if (!items.length) return '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">Sem tarefas registradas</div>';
  const pI = { critica: '🔴', alta: '🟠', media: '🟡', baixa: '🟢' };
  const sC = { concluido: '#06d6a0', 'em-andamento': '#4cc9f0', backlog: '#888', pendente: '#888', planejado: '#a855f7' };
  return items.map(t => { const ic = pI[t.prioridade]||'⬜'; const sc = sC[t.status]||'#888';
    return `<div onclick="${goto(t.file.name)}" style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;transition:background .12s;border-radius:4px;" onmouseover="this.style.background='rgba(128,128,128,.06)'" onmouseout="this.style.background='transparent'">
      <span style="font-size:.9em;">${ic}</span>
      <div style="flex:1;min-width:0;"><div style="font-size:.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.titulo||t.file.name}</div>
        <div style="font-size:.7em;color:var(--text-muted);">${t.sprint||''}</div></div>
      <span style="font-size:.72em;color:${sc};font-weight:600;">${cap(t.status)}</span></div>`; }).join('');
}

const C = { blue:'#4cc9f0', green:'#06d6a0', purple:'#a855f7', orange:'#ffd166', red:'#ff6b6b', indigo:'#4361ee', pink:'#f72585', teal:'#2ec4b6' };

// ── MODULE DATA ─────────────────────────────────────────────
const tDone=tarefas.where(t=>t.status==="concluido").length, tWip=tarefas.where(t=>t.status==="em-andamento").length, tTotal=tarefas.length;
const pts=tarefas.array().reduce((s,t)=>s+(t.estimativa||0),0), ptsDone=tarefas.where(t=>t.status==="concluido").array().reduce((s,t)=>s+(t.estimativa||0),0);

const submodulos = [
  {nome:'Contas a Pagar (CP)',pct:80},{nome:'Contas a Receber (CR)',pct:60},{nome:'Aprovações Financeiras',pct:70},
  {nome:'Conciliação CNAB',pct:40},{nome:'Relatórios Financeiros',pct:30},{nome:'Gestão Fornecedores',pct:50},
  {nome:'Integração Omie ERP',pct:45},{nome:'DRE / Controladoria',pct:0},
];
const n8nSquads = [
  {nome:'Sync Contas a Pagar',st:'✅',wh:'omie-sync-cp'},{nome:'Sync Contas a Receber',st:'✅',wh:'omie-sync-cr'},
  {nome:'Sync Fornecedores',st:'✅',wh:'omie-sync-fornecedores'},{nome:'Aprovação Pagamento',st:'✅',wh:'omie-aprovacao-pgto'},
  {nome:'Agent NF-e',st:'⬜',wh:'—'},{nome:'Agent Remessa CNAB',st:'⬜',wh:'—'},{nome:'Agent Conciliação OFX',st:'⬜',wh:'—'},
];
const extInteg = [
  {nome:'Omie ERP API',icon:'🔄',status:'✅ Ativo',col:'#06d6a0'},{nome:'CNAB 240/400',icon:'🏦',status:'🟡 Parcial',col:'#ffd166'},
  {nome:'OFX Import',icon:'📄',status:'🟡 Parcial',col:'#ffd166'},{nome:'SEFAZ NF-e',icon:'📜',status:'⬜ Planejado',col:'#888'},
  {nome:'NFS-e Municipal',icon:'🏛️',status:'⬜ Planejado',col:'#888'},
];

// ── RENDER ──────────────────────────────────────────────────
const w = dv.container.createEl('div');
w.insertAdjacentHTML('afterbegin', `
<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.13);">
    ${navBtn('🏠','Início','PAINEL PRINCIPAL')} ${navBtn('📊','BI Geral','BI Dashboard')}
    ${navBtn('🛒','Compras','Compras Dashboard')} ${navBtn('📦','Estoque','Estoque Dashboard')}
    ${navBtn('🚚','Logística','Logistica Dashboard')} ${navBtn('🚗','Frotas','Frotas Dashboard')}
    ${navBtn('👥','RH','RH Dashboard')}
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
    <div style="font-size:2.4em;">💰</div>
    <div><div style="font-size:1.4em;font-weight:700;">Módulo Financeiro</div>
      <div style="font-size:.78em;color:var(--text-muted);">CP · CR · Aprovações · CNAB · Omie · Relatórios</div></div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-size:2em;font-weight:700;color:${C.orange};">50%</div>
      <div style="font-size:.65em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;">Completude</div></div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
    ${kpi(submodulos.filter(s=>s.pct>=60).length,'Módulos Avançados',C.green,'≥60% completos',pct(submodulos.filter(s=>s.pct>=60).length,submodulos.length))}
    ${kpi(n8nSquads.filter(s=>s.st==='✅').length,'n8n Squads Ativos',C.blue,`de ${n8nSquads.length} workflows`,pct(n8nSquads.filter(s=>s.st==='✅').length,n8nSquads.length))}
    ${kpi(`${tDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${tTotal}</span>`,'Tarefas',C.purple,`🔵 ${tWip} em andamento`,pct(tDone,tTotal),'Tasks Board')}
    ${kpi(extInteg.filter(i=>i.status.includes('✅')).length,'Integrações Ativas',C.indigo,`de ${extInteg.length} planejadas`,undefined)}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
    ${card(`${secHead('📊 Submódulos')}${submodulos.map(s=>{const col=s.pct>=80?C.green:s.pct>=40?C.orange:s.pct>0?C.red:'#555';return `<div style="margin:8px 0;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;"><span>${s.nome}</span><span style="color:${col};font-weight:600;">${s.pct}%</span></div>${pBar(s.pct,col,7)}</div>`;}).join('')}`)}
    ${card(`${secHead('🤖 n8n AI Squads')}${n8nSquads.map(sq=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.08);"><span>${sq.st}</span><div style="flex:1;"><div style="font-size:.84em;">${sq.nome}</div><div style="font-size:.68em;color:var(--text-muted);font-family:monospace;">${sq.wh}</div></div></div>`).join('')}
      <div style="margin-top:12px;padding:10px;background:rgba(76,201,240,.06);border-radius:8px;font-size:.78em;color:var(--text-muted);">⚡ 4 squads ativos sincronizando Omie ↔ Supabase via webhooks n8n</div>`)}
  </div>

  <div style="display:grid;grid-template-columns:2fr 3fr;gap:12px;">
    ${card(`${secHead('🔗 Integrações Externas')}${extInteg.map(ig=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(128,128,128,.08);"><span style="font-size:1.2em;">${ig.icon}</span><span style="flex:1;font-size:.84em;">${ig.nome}</span><span style="font-size:.73em;color:${ig.col};font-weight:600;">${ig.status}</span></div>`).join('')}
      <div style="margin-top:14px;padding:12px;background:rgba(255,209,102,.06);border-radius:8px;border-left:3px solid ${C.orange};"><div style="font-size:.75em;color:var(--text-muted);margin-bottom:4px;">🎯 Próximo Passo</div><div style="font-size:.84em;">Configurar <strong>vars</strong> no n8n (supabase_url, service_role_key) e ativar os 4 workflows Omie.</div></div>`)}
    ${card(`${secHead('📋 Tarefas do Módulo','Tasks Board')}${taskList(tarefas,8)}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;">${goLink('+ Nova tarefa →','Tasks Board')} ${goLink('Ver todas →','Tasks Board')}</div>`)}
  </div>
</div>
`);
```
