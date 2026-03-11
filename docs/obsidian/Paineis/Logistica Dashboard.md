---
title: "🚚 Logística Dashboard"
type: painel-bi
tags: [painel, bi, dashboard, logistica]
atualizado: 2026-03-11
modulo: logistica
completude: 85
---

```dataviewjs
const tarefas = dv.pages('"obsidian/Database/Tarefas"').where(t => t.modulo === "logistica");
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

const C={blue:'#4cc9f0',green:'#06d6a0',purple:'#a855f7',orange:'#ffd166',red:'#ff6b6b',indigo:'#4361ee',teal:'#2ec4b6',cyan:'#00b4d8'};
const tDone=tarefas.where(t=>t.status==="concluido").length,tWip=tarefas.where(t=>t.status==="em-andamento").length,tTotal=tarefas.length;

const submodulos=[
  {nome:'Solicitações de Transporte',pct:100},{nome:'Tracking 9 Etapas',pct:100},{nome:'Transportes / Fretes',pct:90},
  {nome:'Recebimentos / Conferência',pct:90},{nome:'Expedição / Despacho',pct:85},{nome:'Cadastro Transportadoras',pct:80},
  {nome:'NF-e Validação SEFAZ',pct:0},{nome:'GPS Tracking Real-Time',pct:0},{nome:'API Transportadoras',pct:0},{nome:'Roteirização Inteligente',pct:0},
];
const etapas=['Solicitação','Aprovação','Cotação Frete','Coleta','Em Trânsito','Chegada Base','Conferência','Almoxarifado','Concluído'];
const etCols=[C.blue,C.cyan,C.indigo,C.teal,C.green,C.green,C.purple,C.orange,C.green];

const w = dv.container.createEl('div');
w.insertAdjacentHTML('afterbegin', `
<div style="font-family:var(--font-interface);color:var(--text-normal);padding:0 0 20px;">
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(128,128,128,.13);">
    ${navBtn('🏠','Início','PAINEL PRINCIPAL')} ${navBtn('📊','BI Geral','BI Dashboard')}
    ${navBtn('🛒','Compras','Compras Dashboard')} ${navBtn('💰','Financeiro','Financeiro Dashboard')}
    ${navBtn('📦','Estoque','Estoque Dashboard')} ${navBtn('🚗','Frotas','Frotas Dashboard')}
    ${navBtn('👥','RH','RH Dashboard')}
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
    <div style="font-size:2.4em;">🚚</div>
    <div><div style="font-size:1.4em;font-weight:700;">Módulo Logística</div>
      <div style="font-size:.78em;color:var(--text-muted);">Transportes · Recebimentos · Expedição · Tracking 9 Etapas</div></div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-size:2em;font-weight:700;color:${C.green};">85%</div>
      <div style="font-size:.65em;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;">Completude</div></div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px;">
    ${kpi(submodulos.filter(s=>s.pct>=80).length,'Features Prontas',C.green,`≥80% de ${submodulos.length}`,pct(submodulos.filter(s=>s.pct>=80).length,submodulos.length))}
    ${kpi(9,'Etapas de Tracking',C.indigo,'Pipeline completo implementado',undefined)}
    ${kpi(`${tDone}<span style="font-size:.44em;opacity:.5;font-weight:400;"> / ${tTotal}</span>`,'Tarefas',C.purple,`🔵 ${tWip} em andamento`,pct(tDone,tTotal),'Tasks Board')}
    ${kpi(submodulos.filter(s=>s.pct===0).length,'Pendentes',C.red,'NF-e, GPS, APIs, Roteirização',undefined)}
  </div>

  <div style="display:grid;grid-template-columns:3fr 2fr;gap:12px;margin-bottom:12px;">
    ${card(`${secHead('📊 Submódulos')}${submodulos.map(s=>{const col=s.pct>=80?C.green:s.pct>=40?C.blue:s.pct>0?C.orange:'#555';return `<div style="margin:7px 0;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:.8em;"><span>${s.nome}</span><span style="color:${col};font-weight:600;">${s.pct}%</span></div>${pBar(s.pct,col,7)}</div>`;}).join('')}`)}
    ${card(`${secHead('🔄 Pipeline 9 Etapas')}${etapas.map((et,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;"><div style="width:24px;height:24px;border-radius:50%;background:${etCols[i]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65em;font-weight:700;flex-shrink:0;">${i+1}</div><span style="font-size:.82em;flex:1;">${et}</span><span style="font-size:.65em;color:var(--text-muted);">✅</span></div>`).join('')}
      <div style="margin-top:12px;padding:10px;background:rgba(6,214,160,.06);border-radius:8px;font-size:.78em;color:var(--text-muted);">✅ Pipeline completo — cada transporte passa por todas as 9 etapas com status real-time</div>`)}
  </div>

  <div style="display:grid;grid-template-columns:1fr;gap:12px;">
    ${card(`${secHead('📋 Tarefas do Módulo','Tasks Board')}${taskList(tarefas,8)}
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(128,128,128,.1);display:flex;justify-content:space-between;">${goLink('+ Nova tarefa →','Tasks Board')} ${goLink('Ver todas →','Tasks Board')}</div>`)}
  </div>
</div>
`);
```
