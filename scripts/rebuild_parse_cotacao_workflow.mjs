import fs from 'node:fs/promises';
import path from 'node:path';

const N8N='https://teg-agents-n8n.nmmcas.easypanel.host';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI';
const WF='P5xDZQJ2Hh6mVXO0';
const SB='https://uzfjfucrinokeuwpbeie.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.IBpdP0V0UNn3Grtc6cbhKeWqN_P1oU6SZYkZG6Ubujg';
const GEM='AIzaSyBAh--5NxDXwpsNpBqPGVHLzc_4da_jSvg';
const root='C:/teg-plus';
const docs=path.join(root,'n8n-docs');

const code = String.raw`
const body = $input.first().json.body || $input.first().json || {};
const SB = '${SB}';
const SB_KEY = '${SB_KEY}';
const GEM = '${GEM}';
// Se recebeu file_url em vez de file_base64, baixar e converter
if (!body.file_base64 && body.file_url) {
  const dlResp = await fetch(body.file_url);
  if (!dlResp.ok) throw new Error('Falha ao baixar arquivo: ' + dlResp.status);
  const buf = await dlResp.arrayBuffer();
  body.file_base64 = Buffer.from(buf).toString('base64');
  if (!body.mime_type) body.mime_type = dlResp.headers.get('content-type') || 'application/pdf';
}
if (!body.file_base64) throw new Error('Campo obrigat\u00f3rio: file_base64 ou file_url');
const strip = (v='') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (v='') => strip(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const dig = (v='') => String(v||'').replace(/\D/g,'');
const stop = new Set(['de','da','do','das','dos','para','com','sem','por','e','ou','a','o','as','os','na','no','nas','nos','em','un','und','pc','pcs','item','itens','marca','modelo','tipo','cor']);
const syn = {oculos:'oculos',�culos:'oculos',protecao:'protecao',prote��o:'protecao',capacetes:'capacete',luvas:'luva',notebooks:'notebook',termica:'termica',t�rmica:'termica',disj:'disjuntor',tripolar:'tripolar',xlpe:'xlpe',mcm:'mcm'};
const tok = (v='') => norm(v).split(' ').filter(t => t && !stop.has(t)).map(t => syn[t] || t);
const unit = (u='') => {
  const x = norm(u).replace(/\s+/g,'');
  const map = {un:'UN',und:'UN',unidade:'UN',unidades:'UN',pc:'UN',pcs:'UN',par:'PR',pares:'PR',pr:'PR',cx:'CX',caixa:'CX',caixas:'CX',rl:'RL',rolo:'RL',rolos:'RL',jg:'JG',jogo:'JG',jogos:'JG',kg:'KG',m:'M',metro:'M',metros:'M',m2:'M2','m�':'M2',m3:'M3','m�':'M3',l:'L',litro:'L',litros:'L',ton:'TON',vb:'VB',hr:'HR',hora:'HR',horas:'HR'};
  return map[x] || (x ? x.toUpperCase() : 'UN');
};
const money = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/R\$/gi,'').replace(/\s+/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (v) => Math.round((Number(v||0)+Number.EPSILON)*100)/100;
function xjson(text=''){ const c=String(text).replace(/```json\s*/gi,'').replace(/```/g,'').trim(); try{return JSON.parse(c)}catch{} const a=c.match(/\[[\s\S]*\]/); if(a){try{return JSON.parse(a[0])}catch{}} const o=c.match(/\{[\s\S]*\}/); if(o){try{return JSON.parse(o[0])}catch{}} throw new Error('LLM n�o retornou JSON v�lido: '+c.slice(0,400)); }
async function sb(path){ const res=await fetch(`${SB}/rest/v1/${path}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,Accept:'application/json'}}); const text=await res.text(); if(!res.ok) throw new Error('Supabase '+res.status+': '+text.slice(0,300)); return text?JSON.parse(text):[]; }
async function gem(parts,max=8192,temp=0.1){ const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEM}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:temp,maxOutputTokens:max,responseMimeType:'application/json'}})}); const text=await res.text(); if(!res.ok) throw new Error('Gemini '+res.status+': '+text.slice(0,500)); const data=JSON.parse(text); return xjson(data?.candidates?.[0]?.content?.parts?.[0]?.text || ''); }
async function reqId(){ if(body.requisicao_id) return body.requisicao_id; if(!body.cotacao_id) return null; const rows=await sb(`cmp_cotacoes?select=requisicao_id&id=eq.${body.cotacao_id}&limit=1`); return rows?.[0]?.requisicao_id || null; }
const requisicao_id = await reqId();
const [cat,sup,reqItems] = await Promise.all([
  sb('est_itens?select=id,codigo,descricao,categoria,subcategoria,unidade,valor_medio,classe_financeira_codigo,destino_operacional&ativo=eq.true&limit=5000'),
  sb('cmp_fornecedores?select=id,razao_social,nome_fantasia,cnpj,email,telefone,contato_nome&ativo=eq.true&limit=2000'),
  requisicao_id ? sb(`cmp_requisicao_itens?select=id,requisicao_id,descricao,quantidade,unidade,valor_unitario_estimado,est_item_id,est_item_codigo,classe_financeira_codigo,destino_operacional&requisicao_id=eq.${requisicao_id}&limit=200`) : Promise.resolve([])
]);
function prepSup(raw){ const items = (Array.isArray(raw.itens)?raw.itens:[]).map(it => ({ linha_original:String(it.linha_original||it.descricao||'').trim(), codigo_fornecedor:String(it.codigo_fornecedor||it.codigo||'').trim()||null, descricao:String(it.descricao||it.nome||it.item||'').trim(), qtd:Number(it.qtd??it.quantidade??0)||0, unidade:unit(it.unidade||'UN'), valor_unitario:money(it.valor_unitario??it.valorUnitario??0), valor_total:money(it.valor_total??it.valorTotal??0) })).filter(it => it.descricao || it.linha_original);
  return { fornecedor_nome:String(raw.fornecedor_nome||raw.nome||'').trim(), fornecedor_cnpj:dig(raw.fornecedor_cnpj||raw.cnpj||'')||null, fornecedor_contato:String(raw.fornecedor_contato||raw.contato||'').trim()||null, condicao_pagamento:String(raw.condicao_pagamento||'').trim()||null, prazo_entrega_dias:Number(raw.prazo_entrega_dias||raw.prazo||0)||null, validade_proposta:String(raw.validade_proposta||'').trim()||null, frete_incluso:raw.frete_incluso===true, valor_total:money(raw.valor_total||0), observacao:String(raw.observacao||raw.observacoes||'').trim()||null, itens:items };
}
const mime = body.mime_type || 'application/pdf'; let file = String(body.file_base64||'').replace(/[\r\n\s]/g,''); if(file.includes(',')) file=file.split(',').pop();
const extractPrompt = [
  'Analise este documento de cota��o, proposta comercial ou or�amento.',
  'Extraia os dados em JSON v�lido, sem markdown.',
  'Sempre retorne o formato:',
  JSON.stringify({fornecedores:[{fornecedor_nome:'Nome do fornecedor',fornecedor_cnpj:'somente d�gitos ou null',fornecedor_contato:'email/telefone/contato ou null',condicao_pagamento:'texto ou null',prazo_entrega_dias:0,validade_proposta:'texto ou null',frete_incluso:false,valor_total:0,observacao:'texto ou null',itens:[{linha_original:'linha original',codigo_fornecedor:'c�digo ou null',descricao:'descri��o limpa',qtd:1,unidade:'UN',valor_unitario:0,valor_total:0}]}]}, null, 2),
  'Regras:',
  '- Mesmo que exista um �nico fornecedor, use fornecedores[0].',
  '- Valores em n�mero, sem s�mbolo monet�rio.',
  '- Se a linha for frete, desconto ou imposto, leve para observacao e n�o para itens.',
  '- Preserve marca, cor, modelo, tens�o, bitola, volume e c�digos do fornecedor.'
].join('\n\n');
const parts = [];
if (mime.startsWith('image/') || mime.includes('pdf')) {
  if (file.length > 15000000) {
    const blob = Buffer.from(file, 'base64');
    const upResp = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + GEM, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Header-Content-Length': String(blob.length), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': mime },
      body: blob
    });
    if (!upResp.ok) throw new Error('Gemini File API upload ' + upResp.status);
    const upData = await upResp.json();
    const fileUri = upData.file?.uri;
    if (!fileUri) throw new Error('Gemini File API: URI nao retornada');
    const fName = upData.file?.name;
    if (fName) { for (let i = 0; i < 30; i++) { const sr = await fetch('https://generativelanguage.googleapis.com/v1beta/' + fName + '?key=' + GEM); if (sr.ok) { const sd = await sr.json(); if (sd.state === 'ACTIVE') break; if (sd.state === 'FAILED') throw new Error('Gemini: falha ao processar arquivo'); } await new Promise(r => setTimeout(r, 2000)); } }
    parts.push({ file_data: { mime_type: mime, file_uri: fileUri } });
  } else {
    parts.push({ inline_data: { mime_type: mime, data: file } });
  }
} else {
  parts.push({ text: 'Conteúdo do documento:
' + Buffer.from(file,'base64').toString('utf8').slice(0,20000) });
}
parts.push({ text: extractPrompt });
const extracted = await gem(parts, 8192, 0.1);
const suppliersRaw = Array.isArray(extracted.fornecedores) ? extracted.fornecedores : Array.isArray(extracted) ? extracted : [];
const extractedSuppliers = suppliersRaw.map(prepSup).filter(s => s.fornecedor_nome || s.itens.length);
if (!extractedSuppliers.length) return [{json:{success:false,error:'A IA n�o conseguiu extrair fornecedores do documento.',fornecedores:[]}}];
function hscoreSupplier(ex){ const cnpj=dig(ex.fornecedor_cnpj||''); if(cnpj){ const exact = sup.find(s => dig(s.cnpj) === cnpj); if(exact) return {matched: exact, status:'matched', confidence:0.99}; } const target=norm(ex.fornecedor_nome||''); const tt=tok(ex.fornecedor_nome||''); const scored=sup.map(s => { const names=[norm(s.razao_social||''), norm(s.nome_fantasia||'')].filter(Boolean); let score=0; for(const name of names){ if(name===target) score=Math.max(score,98); else if(name.includes(target)||target.includes(name)) score=Math.max(score,86); const nt=tok(name); const common=tt.filter(t=>nt.includes(t)); score=Math.max(score, r2((common.length / Math.max(tt.length||1, nt.length||1))*100)); } return {supplier:s, score}; }).sort((a,b)=>b.score-a.score); const top=scored[0]; if(top && top.score>=92) return {matched:top.supplier,status:'matched',confidence:0.94}; if(top && top.score>=72) return {matched:top.supplier,status:'suggested',confidence:0.76}; return {matched:null,status:'new',confidence:0.2}; }
function candBase(src,kind){ return {id:src.id||null, kind, codigo:src.codigo||src.est_item_codigo||null, descricao:src.descricao, unidade:unit(src.unidade||'UN'), quantidade_ref:Number(src.quantidade||0), grupo_compra_codigo:src.subcategoria||null, classe_financeira_codigo:src.classe_financeira_codigo||null, destino_operacional:src.destino_operacional||null, est_item_id:src.est_item_id || (kind==='catalog' ? src.id : null)}; }
function scoreItem(item,cand){ const it=tok(item.descricao||item.linha_original||''); const ct=tok(cand.descricao||''); if(!it.length||!ct.length) return 0; const common=it.filter(t=>ct.includes(t)); let score=(common.length / Math.max(it.length, ct.length))*100; const inorm=norm(item.descricao||item.linha_original||''); const cnorm=norm(cand.descricao||''); if(cnorm===inorm) score+=40; if(cnorm.includes(inorm)||inorm.includes(cnorm)) score+=25; if(cand.codigo && inorm.includes(norm(cand.codigo))) score+=50; if(unit(item.unidade||'')===unit(cand.unidade||'')) score+=8; if(cand.kind==='reference') score+=12; return r2(score); }
function topCands(item){ const all=[]; for(const ref of reqItems){ const c=candBase(ref,'reference'); const score=scoreItem(item,c); all.push({...c,score}); } for(const c0 of cat){ const c=candBase(c0,'catalog'); const score=scoreItem(item,c); if(score>18) all.push({...c,score}); } return all.sort((a,b)=>b.score-a.score).filter((c,idx,arr)=>idx===arr.findIndex(o=>o.kind===c.kind&&o.codigo===c.codigo&&o.descricao===c.descricao)).slice(0, reqItems.length ? 6 : 5); }
async function matchItems(exSup){ const items=(Array.isArray(exSup.itens)?exSup.itens:[]); if(!items.length) return []; const promptData = { items: items.map((item,index)=>({ index, linha_original:item.linha_original||item.descricao, descricao_extraida:item.descricao, qtd:Number(item.qtd||0), unidade:unit(item.unidade||'UN'), valor_unitario:r2(item.valor_unitario||0), valor_total:r2(item.valor_total||0), candidates: topCands(item).map(c=>({ candidate_id:c.id, candidate_kind:c.kind, est_item_id:c.est_item_id, codigo:c.codigo, descricao:c.descricao, unidade:c.unidade, score:c.score, quantidade_ref:c.quantidade_ref, grupo_compra_codigo:c.grupo_compra_codigo, classe_financeira_codigo:c.classe_financeira_codigo, destino_operacional:c.destino_operacional })) })) };
  const prompt = [
    'Voc� est� conciliando itens extra�dos de uma cota��o com itens do sistema TEG+.',
    reqItems.length ? 'Priorize mapear cada linha para os itens da requisi��o, porque a cota��o foi feita para essa RC.' : 'N�o h� contexto da requisi��o. Escolha item do cat�logo somente quando houver forte ader�ncia.',
    'Use somente candidate_id que veio nos candidatos. Se estiver amb�guo use review. Se n�o houver equivalente use unmatched. Preserve n�meros da cota��o.',
    JSON.stringify(promptData, null, 2),
    'Resposta JSON: [{"index":0,"candidate_id":"... ou null","status":"auto_match|review|unmatched","confidence":0.0,"normalized_description":"...","reason":"..."}]'
  ].join('\n\n');
  let llm=[]; try { llm = await gem([{text:prompt}], 4096, 0.05); } catch {}
  const map = new Map((Array.isArray(llm)?llm:[]).map(m => [Number(m.index), m]));
  return promptData.items.map(item => {
    const sel = map.get(item.index) || {};
    const chosen = item.candidates.find(c => c.candidate_id === sel.candidate_id) || item.candidates[0] || null;
    const qty = Number(item.qtd || (chosen?.quantidade_ref || 0) || 1);
    const vu = r2(item.valor_unitario || (item.valor_total && qty ? item.valor_total / qty : 0));
    const vt = r2(item.valor_total || qty * vu);
    const status = sel.status || (chosen?.score >= 90 ? 'auto_match' : chosen?.score >= 70 ? 'review' : 'unmatched');
    const confidence = r2(Number(sel.confidence || (chosen ? Math.min(chosen.score/100, 0.97) : 0.2)));
    return { descricao: sel.normalized_description || chosen?.descricao || item.descricao_extraida || item.linha_original, qtd: qty, valor_unitario: vu, valor_total: vt, matched_item_id: chosen?.est_item_id || null, matched_reference_item_id: chosen && chosen.candidate_kind==='reference' ? chosen.candidate_id : null, matched_item_codigo: chosen?.codigo || null, match_status: status, confidence, linha_original: item.linha_original };
  });
}
const warnings=[]; const fornecedores=[];
for(const ex of extractedSuppliers){ const sm=hscoreSupplier(ex); const items=await matchItems(ex); const totalItems=r2(items.reduce((s,i)=>s+Number(i.valor_total||0),0)); const explicit=r2(ex.valor_total||0); if(explicit && totalItems && Math.abs(explicit-totalItems) > 1) warnings.push(`Diferen�a entre total expl�cito e soma dos itens para ${ex.fornecedor_nome}.`); const missing=reqItems.filter(r => !items.some(i => norm(i.descricao)===norm(r.descricao) || i.matched_reference_item_id===r.id)); if(missing.length) warnings.push(`${ex.fornecedor_nome}: ${missing.length} item(ns) da RC n�o apareceram claramente na proposta.`); fornecedores.push({ fornecedor_nome: ex.fornecedor_nome || sm.matched?.razao_social || '', fornecedor_cnpj: ex.fornecedor_cnpj || dig(sm.matched?.cnpj||'') || undefined, fornecedor_contato: ex.fornecedor_contato || sm.matched?.email || sm.matched?.telefone || undefined, matched_supplier_id: sm.matched?.id || undefined, supplier_match_status: sm.status, supplier_confidence: r2(sm.confidence||0), valor_total: explicit || totalItems, prazo_entrega_dias: ex.prazo_entrega_dias || undefined, condicao_pagamento: ex.condicao_pagamento || undefined, observacao: ex.observacao || undefined, itens: items.map(i => ({ descricao:i.descricao, qtd:Number(i.qtd||0)||1, valor_unitario:r2(i.valor_unitario||0), valor_total:r2(i.valor_total||0), matched_item_id:i.matched_item_id || undefined, matched_item_codigo:i.matched_item_codigo || undefined, match_status:i.match_status, confidence:i.confidence, linha_original:i.linha_original })) }); }
const parser_confidence = fornecedores.length ? r2(fornecedores.reduce((s,f) => s + (f.itens?.length ? f.itens.reduce((a,i)=>a+Number(i.confidence||0),0)/f.itens.length : Number(f.supplier_confidence||0.4)), 0) / fornecedores.length) : 0.2;
return [{json:{success:true, fornecedores, warnings:[...new Set(warnings)], parser_confidence, requisicao_id: requisicao_id || undefined}}];
`;

const errorCode = `
const source = $input.first().json || {};
const error = source?.error?.message || source?.message || JSON.stringify(source).slice(0, 500) || 'Erro desconhecido';
return [{ json: { success: false, error, fornecedores: [] } }];
`;

const workflow = {
  name: 'TEG+ | Compras - AI Parse Cotacao',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'compras/parse-cotacao', responseMode: 'responseNode', options: {} }, id: 'cotacao-parse-webhook', name: 'Webhook Parse Cotacao', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0,300], webhookId: '8a51fac2-d983-430f-a517-551e04ea5a48' },
    { parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: code }, id: 'parse-and-match', name: 'Extrair e Conciliar Cotacao', type: 'n8n-nodes-base.code', typeVersion: 2, position: [320,300], onError: 'continueErrorOutput' },
    { parameters: { respondWith: 'firstIncomingItem', options: {} }, id: 'respond-ok', name: 'Responder Sucesso', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.5, position: [640,260] },
    { parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: errorCode }, id: 'handle-error', name: 'Tratar Erro', type: 'n8n-nodes-base.code', typeVersion: 2, position: [640,520] },
    { parameters: { respondWith: 'firstIncomingItem', options: { responseCode: 200 } }, id: 'respond-error', name: 'Responder Erro', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.5, position: [900,520] }
  ],
  connections: {
    'Webhook Parse Cotacao': { main: [[{ node: 'Extrair e Conciliar Cotacao', type: 'main', index: 0 }]] },
    'Extrair e Conciliar Cotacao': { main: [[{ node: 'Responder Sucesso', type: 'main', index: 0 }],[{ node: 'Tratar Erro', type: 'main', index: 0 }]] },
    'Tratar Erro': { main: [[{ node: 'Responder Erro', type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false }
};

async function api(path, opts={}){ const res = await fetch(`${N8N}/api/v1${path}`, { ...opts, headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', ...(opts.headers||{}) } }); const text = await res.text(); const json = text ? JSON.parse(text) : {}; if(!res.ok) throw new Error(`n8n ${res.status}: ${text.slice(0,500)}`); return json; }
async function hook(body){ const res = await fetch(`${N8N}/webhook/compras/parse-cotacao`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const text = await res.text(); const json = text ? JSON.parse(text) : {}; if(!res.ok) throw new Error(`Webhook ${res.status}: ${text.slice(0,500)}`); return json; }
const b64 = (s) => Buffer.from(s,'utf8').toString('base64');

await fs.mkdir(docs, { recursive: true });
const current = await api(`/workflows/${WF}`, { method: 'GET' });
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
await fs.writeFile(path.join(docs, `workflow-parse-cotacao-backup-${stamp}.json`), JSON.stringify(current, null, 2));
await fs.writeFile(path.join(docs, 'workflow-parse-cotacao-ai.json'), JSON.stringify(workflow, null, 2));
await api(`/workflows/${WF}`, { method:'PUT', body: JSON.stringify(workflow) });
try { await api(`/workflows/${WF}/deactivate`, { method:'PATCH', body:'{}' }); } catch {}
await api(`/workflows/${WF}/activate`, { method:'PATCH', body:'{}' });
await new Promise(r => setTimeout(r, 1500));

const tests = [];
const t1 = await hook({ file_base64: b64(`PROPOSTA COMERCIAL\nFornecedor: MSA EQUIPAMENTOS DE SEGURANCA\nCNPJ: 12345678000199\nContato: vendas@msa.com.br\n\n1) Capacete seguran�a azul MSA c/ jugular - 15 und - R$ 89,90 cada - total R$ 1.348,50\n2) Oculos protecao lente escura - 15 und - R$ 18,40 - total R$ 276,00\n3) Luva vaqueta punho curto - 15 und - R$ 22,00 - total R$ 330,00\n\nPrazo: 7 dias uteis\nPagamento: 28 dias\nValor total: R$ 1.954,50`), file_name:'cotacao_epi.txt', mime_type:'text/plain', requisicao_id:'1ec13e3a-4550-4d72-bd79-42d016afd37a' });
if(!t1.success || !t1.fornecedores?.[0] || t1.fornecedores[0].itens.length < 3) throw new Error('Teste 1 falhou: resposta insuficiente');
for (const token of ['CAPACETE','OCULOS','LUVA']) if (!t1.fornecedores[0].itens.some(i => String(i.descricao||'').toUpperCase().includes(token))) throw new Error('Teste 1 falhou: item n�o conciliado '+token);
tests.push({ name:'contexto-rc-multi-item', preview:t1.fornecedores[0], warnings:t1.warnings||[], parser_confidence:t1.parser_confidence||0 });

const t2 = await hook({ file_base64: b64(`PROPOSTA DELL COMPUTADORES DO BRASIL LTDA\nCNPJ 72.381.189/0001-10\nContato comercial@dell.com\n\nNotebook corporativo latitude 14 pol\nQuantidade: 4 un\nValor unit�rio: R$ 5.450,00\nValor total: R$ 21.800,00\nCondi��o: 30 dias\nPrazo de entrega: 12 dias �teis`), file_name:'notebook_dell.txt', mime_type:'text/plain', requisicao_id:'1698385a-a727-49eb-9714-c31302654b8a' });
if(!t2.success || !t2.fornecedores?.[0]?.matched_supplier_id) throw new Error('Teste 2 falhou: fornecedor n�o casou');
tests.push({ name:'fornecedor-dell', preview:t2.fornecedores[0], warnings:t2.warnings||[], parser_confidence:t2.parser_confidence||0 });

const t3 = await hook({ file_base64: b64(`ORCAMENTO TECNICO\nFornecedor: Eletro Rede Minas\n\nDisjuntor tripolar 70A - 3 un - R$ 240,00 cada\nCabo energia 350 mcm xlpe - 120 m - R$ 54,90\n\nValor total: R$ 7.308,00`), file_name:'catalogo_fallback.txt', mime_type:'text/plain' });
if(!t3.success || !t3.fornecedores?.[0] || !t3.fornecedores[0].itens.some(i => i.matched_item_codigo)) throw new Error('Teste 3 falhou: fallback cat�logo sem match');
tests.push({ name:'fallback-catalogo', preview:t3.fornecedores[0], warnings:t3.warnings||[], parser_confidence:t3.parser_confidence||0 });

const summary = { workflow_id: WF, tests, updated_at: new Date().toISOString() };
await fs.writeFile(path.join(docs, 'workflow-parse-cotacao-test-results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
