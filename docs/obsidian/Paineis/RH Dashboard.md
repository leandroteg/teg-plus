---
title: "👥 RH Dashboard"
type: painel-bi
tags: [painel, bi, dashboard, rh]
atualizado: 2026-03-04
modulo: rh
completude: 5
---

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"').where(t => t.modulo === "rh");
const pct=(a,b)=>b?Math.round((a/b)*100):0;const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const pOrd={critica:0,alta:1,media:2,baixa:3};
const goto=name=>`app.workspace.openLinkText('${name}','',false)`;
function pBar(p,color,h=8){return `<div style="height:${h}px;background:rgba(128,128,128,0.12);border-radius:4px;overflow:hidden;margin:5px 0;"><div style="width:${p}%;height:100%;background:linear-gradient(90deg,${color},${color}99);border-radius:4px;"></div></div>`;}
function navBtn(icon,label,target){return `<button onclick="${goto(target)}" style="display:inline-flex;align-items:center;gap:6px;background:var(--background-secondary);border:1px solid rgba(128,128,128,.22);border-radius:8px;padding:6px 13px;cursor:pointer;color:var(--text-normal);font-size:.8em;font-family:var(--font-interface);transition:border-color .15s;" onmouseover="this.style.borderColor='rgba(128,128,128,.6)'" onmouseout="this.style.borderColor='rgba(128,128,128,.22)'"><span>${icon}</span><span>${label}</span></button>`;}
function goLink(l,t){return `<span onclick="${goto(t)}" style="cursor:pointer;font-size:.75em;color:var(--text-muted);transition:color .15s;user-select:none;" onmouseover="this.style.color='var(--text-accent,#4cc9f0)'" onmouseout="this.style.color='var(--text-muted)'">${l}</span>`;}
function secHead(title,at){const lk=at?`<span onclick="${goto(at)}" style="cursor:pointer;font-size:.72em;color:var(--text-muted);transition:color .15s;" onmouseover="this.style.color='var(--text-accent,#4cc9f0)'" onmouseout="this.style.color='var(--text-muted)'">Ver todos →</span>`:'';return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><span style="font-size:.68em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.8px;font-weight:600;">${title}</span>${lk}</div>`;}
function kpi(val,label,color,sub,p,dt){const d=dt?`<div style="border-top:1px solid rgba(128,128,128,.1);margin-top:10px;padding-top:8px;text-align:right;">${goLink('→ Detalhes',dt)}</div>`:'';return `<div style="background:var(--background-secondary);border:1px solid ${color}20;border-top:3px solid ${color};border-radius:12px;padding:18px 16px;"><div style="font-size:2.1em;font-weight:700;color:${color};line-height:1.15;">${val}</div><div style="font-size:.67em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.6px;margin:7px 0 2px;">${label}</div>${p!==undefined?pBar(p,color):''}<div style="font-size:.76em;color:var(--text-muted);margin-top:3px;">${sub}</div>${d}</div>`;}
function card(inner){return `<div style="background:var(--background-secondary);border:1px solid rgba(128,128,128,.14);border-radius:12px;padding:18px;">${inner}</div>`;}
function taskList(tarefas,limit){const items=tarefas.sort(t=>pOrd[t.prioridade]??9,"asc").array().slice(0,limit||8);if(!items.length)return '<div style="color:var(--text-muted);font-size:.85em;text-align:center;padding:18px 0;">Sem tarefas</div>';const pI={critica:'🔴',alta:'🟠',media:'🟡',baixa:'🟢'};const sC={concluido:'#06d6a0','em-andamento':'#4cc9f0',backlog:'#888',pendente:'#888',planejado:'#a855f7'};return items.map(t=>{const ic=pI[t.prioridade]||'⬜';const sc=sC[t.status]||'#888';return `<div onclick="${goto(t.file.name)}" style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(128,128,128,.08);cursor:pointer;transition:background .12s;border-radius:4px;" onmouseover="this.style.background='rgba(128,128,128,.06)'" onmouseout="this.style.background='transparent'"><span style="font-size:.9em;">${ic}</span><div style="flex:1;min-width:0;"><div style="font-size:.84em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.titulo||t.file.name}</div><div style="font-size:.7em;color:var(--text-muted);">${t.sprint||''}</div></div><span style="font-size:.72em;color:${sc};font-weight:600;">${cap(t.status)}</span></div>`;}).join('');}

const C={blue:'#4cc9f0',green:'#06d6a0',purple:'#a855f7',orange:'#ffd166',red:'#ff6b6b',indigo:'#4361ee',teal:'#2ec4b6'};
const tDone=tarefas.where(t=>t.status==="concluido").length,tWip=tarefas.where(t=>t.status==="em-andamento").length,tTotal=tarefas.length;

const submodulos=[
  {nome:'Mural de Recados',pct:100},{nome:'Cadastro de Colaboradores',pct:0},{nome:'Cargos e Departamentos',pct:0},
  {nome:'Controle de Ponto',pct:0},{nome:'HHt (Homem-Hora Trabalhada)',pct:0},{nome:'Folha de Pagamento',pct:0},
  {nome:'Férias e Afastamentos',pct:0},{nome:'eSocial',pct:0},{nome:'Relatórios RH',pct:0},
];
const roadmap=[
  {mes:'Abr/26',item:'Cadastro + Ponto',icon:'👤',col:'#4cc9f0'},
  {mes:'Mai/26',item:'HHt + Folha',icon:'⏱️',col:'#06d6a0'},
  {mes:'Jun/26',item:'eSocial + Relatórios',icon:'📄',col:'#a855f7'},
  {mes:'Jul/26',item:'Férias + Afastamentos',icon:'🏖️',col:'#ffd166'},
];
const integracoes=[
  {nome:'eSocial',icon:'🏛️',st:'⬜ Q2 2026'},{nome:'Financeiro CP',icon:'💰',st:'⬜ Q2 2026'},
  {nome:'SSMA',icon:'🦺',st:'⬜ Q3 2026'},{nome:'Controladoria',icon:'📊',st:'⬜ Q3 2026'},
  {nome:'HHt App Mobile',icon:'📱',st:'⬜ Q3 2026'},
];
const tabelasPlan=['rh_colaboradores','rh_cargos','rh_departamentos','rh_ponto','rh_hht','rh_folha','rh_ferias','rh_afastamentos','rh_documentos','rh_dependentes'];

const w = dv.container.createEl('div');
w.insertAdjacentHTML('afterbegin', `
<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.13);">
    ${navBtn('🏠','Início','PAINEL PRINCIPAL')} ${navBtn('📊','BI Geral','BI Dashboard')}
    ${navBtn('🛒','Compras','Compras Dashboard')} ${navBtn('💰','Financeiro','Financeiro Dashboard')}
    ${navBtn('📦','Estoque','Estoque Dashboard')} ${navBtn('🚚','Logística','Logistica Dashboard')}
    ${navBtn('🚗','Frotas','Frotas Dashboard')}
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
    <div style="font-size:2.4em;">👥</div>
    <div><div style="font-size:1.4em;font-weight:700;">Módulo RH</div>
      <div style="font-size:.78em;color:var(--text-muted);">Colaboradores · Ponto · HHt · Folha · eSocial · Férias</div></div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-size:2em;font-weight:700;color:${C.red};">5%</div>
      <div style="font-size:.65em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;">Completude</div></div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
    ${kpi(submodulos.filter(s=>s.pct===100).length,'Feature Pronta',C.green,'Mural de Recados (BannerSlideshow)',pct(1,submodulos.length))}
    ${kpi(tabelasPlan.length,'Tabelas Planejadas',C.indigo,'rh_* — a criar no Supabase',undefined)}
    ${kpi(`${tDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${tTotal}</span>`,'Tarefas',C.purple,`🔵 ${tWip} em andamento`,pct(tDone,tTotal),'Tasks Board')}
    ${kpi('Q2','Início Previsto',C.orange,'Abril 2026 — Sprint 7',undefined)}
  </div>

  <div style="display:grid;grid-template-columns:3fr 2fr;gap:12px;margin-bottom:12px;">
    ${card(`${secHead('📊 Submódulos')}${submodulos.map(s=>{const col=s.pct===100?C.green:s.pct>0?C.blue:'#555';return `<div style="margin:7px 0;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;"><span>${s.nome}</span><span style="color:${col};font-weight:600;">${s.pct}%</span></div>${pBar(s.pct,col,7)}</div>`;}).join('')}`)}
    ${card(`${secHead('🗓️ Roadmap de Entrega')}${roadmap.map(r=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(128,128,128,.08);"><div style="width:28px;height:28px;border-radius:50%;background:${r.col};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8em;flex-shrink:0;">${r.icon}</div><div style="flex:1;"><div style="font-size:.88em;font-weight:500;">${r.item}</div><div style="font-size:.7em;color:var(--text-muted);">${r.mes}</div></div><span style="font-size:.72em;color:var(--text-muted);">⬜ Planejado</span></div>`).join('')}
      <div style="margin-top:14px;">${secHead('🔗 Integrações Futuras')}${integracoes.map(ig=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.82em;"><span>${ig.icon}</span><span style="flex:1;">${ig.nome}</span><span style="font-size:.72em;color:var(--text-muted);">${ig.st}</span></div>`).join('')}</div>`)}
  </div>

  <div style="display:grid;grid-template-columns:2fr 3fr;gap:12px;">
    ${card(`${secHead('🗄️ Schema Planejado')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${tabelasPlan.map(t=>`<div style="font-family:monospace;font-size:.72em;padding:5px 8px;background:${C.purple}10;border-radius:6px;border-left:2px solid ${C.purple};color:var(--text-normal);">${t}</div>`).join('')}</div>
      <div style="margin-top:14px;padding:12px;background:rgba(255,107,107,.06);border-radius:8px;border-left:3px solid ${C.red};"><div style="font-size:.75em;color:var(--text-muted);margin-bottom:4px;">⚠️ Status</div><div style="font-size:.84em;">Módulo em planejamento. Apenas o Mural de Recados (BannerSlideshow + MuralAdmin) está operacional.</div></div>`)}
    ${card(`${secHead('📋 Tarefas do Módulo','Tasks Board')}${taskList(tarefas,8)}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;">${goLink('+ Nova tarefa →','Tasks Board')} ${goLink('Ver todas →','Tasks Board')}</div>`)}
  </div>
</div>
`);
```
