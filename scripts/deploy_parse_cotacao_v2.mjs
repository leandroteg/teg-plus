import fs from 'node:fs/promises';
import path from 'node:path';

const N8N='https://teg-agents-n8n.nmmcas.easypanel.host';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiM2U5NDNlZjMtNmE4My00OTQ5LTlhMTQtMDBjZGM0ZmMxOGNhIiwiaWF0IjoxNzc1NDg0MzU2fQ.zoZesxPDFwgH5m4GdMV7rjXCKyp7p5bAGyOo6yuNmpU';
const WF='P5xDZQJ2Hh6mVXO0';
const SB='https://uzfjfucrinokeuwpbeie.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.IBpdP0V0UNn3Grtc6cbhKeWqN_P1oU6SZYkZG6Ubujg';
const GEM='AIzaSyBAh--5NxDXwpsNpBqPGVHLzc_4da_jSvg';
const root='C:/teg-plus';
const docs=path.join(root,'n8n-docs');

// Build the JS code that runs inside n8n Code node
// Using array.join to avoid encoding issues with template literals
const codeParts = [];
codeParts.push(`const body = $input.first().json.body || $input.first().json || {};`);
codeParts.push(`const SB = '${SB}';`);
codeParts.push(`const SB_KEY = '${SB_KEY}';`);
codeParts.push(`const GEM = '${GEM}';`);

// Support file_url: download and convert to base64
codeParts.push(`if (!body.file_base64 && body.file_url) {`);
codeParts.push(`  const dlResp = await fetch(body.file_url);`);
codeParts.push(`  if (!dlResp.ok) throw new Error('Falha ao baixar arquivo: ' + dlResp.status);`);
codeParts.push(`  const buf = await dlResp.arrayBuffer();`);
codeParts.push(`  body.file_base64 = Buffer.from(buf).toString('base64');`);
codeParts.push(`  if (!body.mime_type) body.mime_type = dlResp.headers.get('content-type') || 'application/pdf';`);
codeParts.push(`}`);
codeParts.push(`if (!body.file_base64) throw new Error('Campo obrigat\\u00f3rio: file_base64 ou file_url');`);

// Utility functions
codeParts.push(`const strip = (v='') => String(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');`);
codeParts.push(`const norm = (v='') => strip(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim();`);
codeParts.push(`const dig = (v='') => String(v||'').replace(/\\D/g,'');`);
codeParts.push(`const stop = new Set(['de','da','do','das','dos','para','com','sem','por','e','ou','a','o','as','os','na','no','nas','nos','em','un','und','pc','pcs','item','itens','marca','modelo','tipo','cor']);`);
codeParts.push(`const syn = {oculos:'oculos','\\u00f3culos':'oculos',protecao:'protecao','prote\\u00e7\\u00e3o':'protecao',capacetes:'capacete',luvas:'luva',notebooks:'notebook',termica:'termica','t\\u00e9rmica':'termica',disj:'disjuntor',tripolar:'tripolar',xlpe:'xlpe',mcm:'mcm'};`);
codeParts.push(`const tok = (v='') => norm(v).split(' ').filter(t => t && !stop.has(t)).map(t => syn[t] || t);`);
codeParts.push(`const unit = (u='') => { const x = norm(u).replace(/\\s+/g,''); const map = {un:'UN',und:'UN',unidade:'UN',unidades:'UN',pc:'UN',pcs:'UN',par:'PR',pares:'PR',pr:'PR',cx:'CX',caixa:'CX',caixas:'CX',rl:'RL',rolo:'RL',rolos:'RL',jg:'JG',jogo:'JG',jogos:'JG',kg:'KG',m:'M',metro:'M',metros:'M',m2:'M2','m\\u00b2':'M2',m3:'M3','m\\u00b3':'M3',l:'L',litro:'L',litros:'L',ton:'TON',vb:'VB',hr:'HR',hora:'HR',horas:'HR'}; return map[x] || (x ? x.toUpperCase() : 'UN'); };`);
codeParts.push(`const money = (v) => { if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return Number.isFinite(v) ? v : 0; const cleaned = String(v).replace(/R\\$/gi,'').replace(/\\s+/g,'').replace(/\\.(?=\\d{3}(\\D|$))/g,'').replace(',', '.'); const n = Number(cleaned); return Number.isFinite(n) ? n : 0; };`);
codeParts.push(`const r2 = (v) => Math.round((Number(v||0)+Number.EPSILON)*100)/100;`);
codeParts.push(`function xjson(text=''){ const c=String(text).replace(/\`\`\`json\\s*/gi,'').replace(/\`\`\`/g,'').trim(); try{return JSON.parse(c)}catch{} const a=c.match(/\\[[\\s\\S]*\\]/); if(a){try{return JSON.parse(a[0])}catch{}} const o=c.match(/\\{[\\s\\S]*\\}/); if(o){try{return JSON.parse(o[0])}catch{}} throw new Error('LLM n\\u00e3o retornou JSON v\\u00e1lido: '+c.slice(0,400)); }`);

// Supabase + Gemini helpers
codeParts.push(`async function sb(path){ const res=await fetch(\`\${SB}/rest/v1/\${path}\`,{headers:{apikey:SB_KEY,Authorization:\`Bearer \${SB_KEY}\`,Accept:'application/json'}}); const text=await res.text(); if(!res.ok) throw new Error('Supabase '+res.status+': '+text.slice(0,300)); return text?JSON.parse(text):[]; }`);
codeParts.push(`async function gem(parts,max=8192,temp=0.1){ const res=await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${GEM}\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:temp,maxOutputTokens:max,responseMimeType:'application/json'}})}); const text=await res.text(); if(!res.ok) throw new Error('Gemini '+res.status+': '+text.slice(0,500)); const data=JSON.parse(text); return xjson(data?.candidates?.[0]?.content?.parts?.[0]?.text || ''); }`);

// Requisicao lookup
codeParts.push(`async function reqId(){ if(body.requisicao_id) return body.requisicao_id; if(!body.cotacao_id) return null; const rows=await sb(\`cmp_cotacoes?select=requisicao_id&id=eq.\${body.cotacao_id}&limit=1\`); return rows?.[0]?.requisicao_id || null; }`);
codeParts.push(`const requisicao_id = await reqId();`);

// Fetch catalog, suppliers, requisition items
codeParts.push(`const [cat,sup,reqItems] = await Promise.all([`);
codeParts.push(`  sb('est_itens?select=id,codigo,descricao,categoria,subcategoria,unidade,valor_medio,classe_financeira_codigo,destino_operacional&ativo=eq.true&limit=5000'),`);
codeParts.push(`  sb('cmp_fornecedores?select=id,razao_social,nome_fantasia,cnpj,email,telefone,contato_nome&ativo=eq.true&limit=2000'),`);
codeParts.push(`  requisicao_id ? sb(\`cmp_requisicao_itens?select=id,requisicao_id,descricao,quantidade,unidade,valor_unitario_estimado,est_item_id,est_item_codigo,classe_financeira_codigo,destino_operacional&requisicao_id=eq.\${requisicao_id}&limit=200\`) : Promise.resolve([])`);
codeParts.push(`]);`);

// prepSup helper
codeParts.push(`function prepSup(raw){ const items = (Array.isArray(raw.itens)?raw.itens:[]).map(it => ({ linha_original:String(it.linha_original||it.descricao||'').trim(), codigo_fornecedor:String(it.codigo_fornecedor||it.codigo||'').trim()||null, descricao:String(it.descricao||it.nome||it.item||'').trim(), qtd:Number(it.qtd??it.quantidade??0)||0, unidade:unit(it.unidade||'UN'), valor_unitario:money(it.valor_unitario??it.valorUnitario??0), valor_total:money(it.valor_total??it.valorTotal??0) })).filter(it => it.descricao || it.linha_original); return { fornecedor_nome:String(raw.fornecedor_nome||raw.nome||'').trim(), fornecedor_cnpj:dig(raw.fornecedor_cnpj||raw.cnpj||'')||null, fornecedor_contato:String(raw.fornecedor_contato||raw.contato||'').trim()||null, condicao_pagamento:String(raw.condicao_pagamento||'').trim()||null, prazo_entrega_dias:Number(raw.prazo_entrega_dias||raw.prazo||0)||null, validade_proposta:String(raw.validade_proposta||'').trim()||null, frete_incluso:raw.frete_incluso===true, valor_total:money(raw.valor_total||0), observacao:String(raw.observacao||raw.observacoes||'').trim()||null, itens:items }; }`);

// File preparation + Gemini extraction with File API support for large files
codeParts.push(`const mime = body.mime_type || 'application/pdf'; let file = String(body.file_base64||'').replace(/[\\r\\n\\s]/g,''); if(file.includes(',')) file=file.split(',').pop();`);
codeParts.push(`const extractPrompt = [`);
codeParts.push(`  'Analise este documento de cota\\u00e7\\u00e3o, proposta comercial ou or\\u00e7amento.',`);
codeParts.push(`  'Extraia os dados em JSON v\\u00e1lido, sem markdown.',`);
codeParts.push(`  'Sempre retorne o formato:',`);
codeParts.push(`  JSON.stringify({fornecedores:[{fornecedor_nome:'Nome do fornecedor',fornecedor_cnpj:'somente d\\u00edgitos ou null',fornecedor_contato:'email/telefone/contato ou null',condicao_pagamento:'texto ou null',prazo_entrega_dias:0,validade_proposta:'texto ou null',frete_incluso:false,valor_total:0,observacao:'texto ou null',itens:[{linha_original:'linha original',codigo_fornecedor:'c\\u00f3digo ou null',descricao:'descri\\u00e7\\u00e3o limpa',qtd:1,unidade:'UN',valor_unitario:0,valor_total:0}]}]}, null, 2),`);
codeParts.push(`  'Regras:',`);
codeParts.push(`  '- Mesmo que exista um \\u00fanico fornecedor, use fornecedores[0].',`);
codeParts.push(`  '- Valores em n\\u00famero, sem s\\u00edmbolo monet\\u00e1rio.',`);
codeParts.push(`  '- Se a linha for frete, desconto ou imposto, leve para observacao e n\\u00e3o para itens.',`);
codeParts.push(`  '- Preserve marca, cor, modelo, tens\\u00e3o, bitola, volume e c\\u00f3digos do fornecedor.'`);
codeParts.push(`].join('\\n\\n');`);

// Build parts with File API support for large files
codeParts.push(`const parts = [];`);
codeParts.push(`if (mime.startsWith('image/') || mime.includes('pdf')) {`);
codeParts.push(`  if (file.length > 15000000) {`);
codeParts.push(`    const blob = Buffer.from(file, 'base64');`);
codeParts.push(`    const upResp = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + GEM, { method: 'POST', headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Header-Content-Length': String(blob.length), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': mime }, body: blob });`);
codeParts.push(`    if (!upResp.ok) throw new Error('Gemini File API upload ' + upResp.status);`);
codeParts.push(`    const upData = await upResp.json();`);
codeParts.push(`    const fileUri = upData.file?.uri;`);
codeParts.push(`    if (!fileUri) throw new Error('Gemini File API: URI nao retornada');`);
codeParts.push(`    const fName = upData.file?.name;`);
codeParts.push(`    if (fName) { for (let i = 0; i < 30; i++) { const sr = await fetch('https://generativelanguage.googleapis.com/v1beta/' + fName + '?key=' + GEM); if (sr.ok) { const sd = await sr.json(); if (sd.state === 'ACTIVE') break; if (sd.state === 'FAILED') throw new Error('Gemini: falha ao processar arquivo'); } await new Promise(r => setTimeout(r, 2000)); } }`);
codeParts.push(`    parts.push({ file_data: { mime_type: mime, file_uri: fileUri } });`);
codeParts.push(`  } else {`);
codeParts.push(`    parts.push({ inline_data: { mime_type: mime, data: file } });`);
codeParts.push(`  }`);
codeParts.push(`} else {`);
codeParts.push(`  parts.push({ text: 'Conte\\u00fado do documento:\\n' + Buffer.from(file,'base64').toString('utf8').slice(0,20000) });`);
codeParts.push(`}`);
codeParts.push(`parts.push({ text: extractPrompt });`);
codeParts.push(`const extracted = await gem(parts, 8192, 0.1);`);

// Process extracted suppliers
codeParts.push(`const suppliersRaw = Array.isArray(extracted.fornecedores) ? extracted.fornecedores : Array.isArray(extracted) ? extracted : [];`);
codeParts.push(`const extractedSuppliers = suppliersRaw.map(prepSup).filter(s => s.fornecedor_nome || s.itens.length);`);
codeParts.push(`if (!extractedSuppliers.length) return [{json:{success:false,error:'A IA n\\u00e3o conseguiu extrair fornecedores do documento.',fornecedores:[]}}];`);

// Supplier matching
codeParts.push(`function hscoreSupplier(ex){ const cnpj=dig(ex.fornecedor_cnpj||''); if(cnpj){ const exact = sup.find(s => dig(s.cnpj) === cnpj); if(exact) return {matched: exact, status:'matched', confidence:0.99}; } const target=norm(ex.fornecedor_nome||''); const tt=tok(ex.fornecedor_nome||''); const scored=sup.map(s => { const names=[norm(s.razao_social||''), norm(s.nome_fantasia||'')].filter(Boolean); let score=0; for(const name of names){ if(name===target) score=Math.max(score,98); else if(name.includes(target)||target.includes(name)) score=Math.max(score,86); const nt=tok(name); const common=tt.filter(t=>nt.includes(t)); score=Math.max(score, r2((common.length / Math.max(tt.length||1, nt.length||1))*100)); } return {supplier:s, score}; }).sort((a,b)=>b.score-a.score); const top=scored[0]; if(top && top.score>=92) return {matched:top.supplier,status:'matched',confidence:0.94}; if(top && top.score>=72) return {matched:top.supplier,status:'suggested',confidence:0.76}; return {matched:null,status:'new',confidence:0.2}; }`);

// Item candidate + scoring
codeParts.push(`function candBase(src,kind){ return {id:src.id||null, kind, codigo:src.codigo||src.est_item_codigo||null, descricao:src.descricao, unidade:unit(src.unidade||'UN'), quantidade_ref:Number(src.quantidade||0), grupo_compra_codigo:src.subcategoria||null, classe_financeira_codigo:src.classe_financeira_codigo||null, destino_operacional:src.destino_operacional||null, est_item_id:src.est_item_id || (kind==='catalog' ? src.id : null)}; }`);
codeParts.push(`function scoreItem(item,cand){ const it=tok(item.descricao||item.linha_original||''); const ct=tok(cand.descricao||''); if(!it.length||!ct.length) return 0; const common=it.filter(t=>ct.includes(t)); let score=(common.length / Math.max(it.length, ct.length))*100; const inorm=norm(item.descricao||item.linha_original||''); const cnorm=norm(cand.descricao||''); if(cnorm===inorm) score+=40; if(cnorm.includes(inorm)||inorm.includes(cnorm)) score+=25; if(cand.codigo && inorm.includes(norm(cand.codigo))) score+=50; if(unit(item.unidade||'')===unit(cand.unidade||'')) score+=8; if(cand.kind==='reference') score+=12; return r2(score); }`);
codeParts.push(`function topCands(item){ const all=[]; for(const ref of reqItems){ const c=candBase(ref,'reference'); const score=scoreItem(item,c); all.push({...c,score}); } for(const c0 of cat){ const c=candBase(c0,'catalog'); const score=scoreItem(item,c); if(score>18) all.push({...c,score}); } return all.sort((a,b)=>b.score-a.score).filter((c,idx,arr)=>idx===arr.findIndex(o=>o.kind===c.kind&&o.codigo===c.codigo&&o.descricao===c.descricao)).slice(0, reqItems.length ? 6 : 5); }`);

// LLM item matching
codeParts.push(`async function matchItems(exSup){ const items=(Array.isArray(exSup.itens)?exSup.itens:[]); if(!items.length) return []; const promptData = { items: items.map((item,index)=>({ index, linha_original:item.linha_original||item.descricao, descricao_extraida:item.descricao, qtd:Number(item.qtd||0), unidade:unit(item.unidade||'UN'), valor_unitario:r2(item.valor_unitario||0), valor_total:r2(item.valor_total||0), candidates: topCands(item).map(c=>({ candidate_id:c.id, candidate_kind:c.kind, est_item_id:c.est_item_id, codigo:c.codigo, descricao:c.descricao, unidade:c.unidade, score:c.score, quantidade_ref:c.quantidade_ref, grupo_compra_codigo:c.grupo_compra_codigo, classe_financeira_codigo:c.classe_financeira_codigo, destino_operacional:c.destino_operacional })) })) };`);
codeParts.push(`  const prompt = [`);
codeParts.push(`    'Voc\\u00ea est\\u00e1 conciliando itens extra\\u00eddos de uma cota\\u00e7\\u00e3o com itens do sistema TEG+.',`);
codeParts.push(`    reqItems.length ? 'Priorize mapear cada linha para os itens da requisi\\u00e7\\u00e3o, porque a cota\\u00e7\\u00e3o foi feita para essa RC.' : 'N\\u00e3o h\\u00e1 contexto da requisi\\u00e7\\u00e3o. Escolha item do cat\\u00e1logo somente quando houver forte ader\\u00eancia.',`);
codeParts.push(`    'Use somente candidate_id que veio nos candidatos. Se estiver amb\\u00edguo use review. Se n\\u00e3o houver equivalente use unmatched. Preserve n\\u00fameros da cota\\u00e7\\u00e3o.',`);
codeParts.push(`    JSON.stringify(promptData, null, 2),`);
codeParts.push(`    'Resposta JSON: [{"index":0,"candidate_id":"... ou null","status":"auto_match|review|unmatched","confidence":0.0,"normalized_description":"...","reason":"..."}]'`);
codeParts.push(`  ].join('\\n\\n');`);
codeParts.push(`  let llm=[]; try { llm = await gem([{text:prompt}], 4096, 0.05); } catch {}`);
codeParts.push(`  const map = new Map((Array.isArray(llm)?llm:[]).map(m => [Number(m.index), m]));`);
codeParts.push(`  return promptData.items.map(item => {`);
codeParts.push(`    const sel = map.get(item.index) || {};`);
codeParts.push(`    const chosen = item.candidates.find(c => c.candidate_id === sel.candidate_id) || item.candidates[0] || null;`);
codeParts.push(`    const qty = Number(item.qtd || (chosen?.quantidade_ref || 0) || 1);`);
codeParts.push(`    const vu = r2(item.valor_unitario || (item.valor_total && qty ? item.valor_total / qty : 0));`);
codeParts.push(`    const vt = r2(item.valor_total || qty * vu);`);
codeParts.push(`    const status = sel.status || (chosen?.score >= 90 ? 'auto_match' : chosen?.score >= 70 ? 'review' : 'unmatched');`);
codeParts.push(`    const confidence = r2(Number(sel.confidence || (chosen ? Math.min(chosen.score/100, 0.97) : 0.2)));`);
codeParts.push(`    return { descricao: sel.normalized_description || chosen?.descricao || item.descricao_extraida || item.linha_original, qtd: qty, valor_unitario: vu, valor_total: vt, matched_item_id: chosen?.est_item_id || null, matched_reference_item_id: chosen && chosen.candidate_kind==='reference' ? chosen.candidate_id : null, matched_item_codigo: chosen?.codigo || null, match_status: status, confidence, linha_original: item.linha_original };`);
codeParts.push(`  });`);
codeParts.push(`}`);

// Final assembly
codeParts.push(`const warnings=[]; const fornecedores=[];`);
codeParts.push(`for(const ex of extractedSuppliers){ const sm=hscoreSupplier(ex); const items=await matchItems(ex); const totalItems=r2(items.reduce((s,i)=>s+Number(i.valor_total||0),0)); const explicit=r2(ex.valor_total||0); if(explicit && totalItems && Math.abs(explicit-totalItems) > 1) warnings.push('Diferen\\u00e7a entre total expl\\u00edcito e soma dos itens para '+ex.fornecedor_nome+'.'); const missing=reqItems.filter(r => !items.some(i => norm(i.descricao)===norm(r.descricao) || i.matched_reference_item_id===r.id)); if(missing.length) warnings.push(ex.fornecedor_nome+': '+missing.length+' item(ns) da RC n\\u00e3o apareceram claramente na proposta.'); fornecedores.push({ fornecedor_nome: ex.fornecedor_nome || sm.matched?.razao_social || '', fornecedor_cnpj: ex.fornecedor_cnpj || dig(sm.matched?.cnpj||'') || undefined, fornecedor_contato: ex.fornecedor_contato || sm.matched?.email || sm.matched?.telefone || undefined, matched_supplier_id: sm.matched?.id || undefined, supplier_match_status: sm.status, supplier_confidence: r2(sm.confidence||0), valor_total: explicit || totalItems, prazo_entrega_dias: ex.prazo_entrega_dias || undefined, condicao_pagamento: ex.condicao_pagamento || undefined, observacao: ex.observacao || undefined, itens: items.map(i => ({ descricao:i.descricao, qtd:Number(i.qtd||0)||1, valor_unitario:r2(i.valor_unitario||0), valor_total:r2(i.valor_total||0), matched_item_id:i.matched_item_id || undefined, matched_item_codigo:i.matched_item_codigo || undefined, match_status:i.match_status, confidence:i.confidence, linha_original:i.linha_original })) }); }`);
codeParts.push(`const parser_confidence = fornecedores.length ? r2(fornecedores.reduce((s,f) => s + (f.itens?.length ? f.itens.reduce((a,i)=>a+Number(i.confidence||0),0)/f.itens.length : Number(f.supplier_confidence||0.4)), 0) / fornecedores.length) : 0.2;`);
codeParts.push(`return [{json:{success:true, fornecedores, warnings:[...new Set(warnings)], parser_confidence, requisicao_id: requisicao_id || undefined}}];`);

const code = codeParts.join('\n');

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

// Backup current workflow
const current = await api(`/workflows/${WF}`, { method: 'GET' });
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
await fs.writeFile(path.join(docs, `workflow-parse-cotacao-backup-${stamp}.json`), JSON.stringify(current, null, 2));

// Deploy new workflow
await api(`/workflows/${WF}`, { method:'PUT', body: JSON.stringify(workflow) });
try { await api(`/workflows/${WF}/deactivate`, { method:'POST', body:'{}' }); } catch {}
await api(`/workflows/${WF}/activate`, { method:'POST', body:'{}' });
console.log('Workflow deployed and activated. Waiting 1.5s before test...');
await new Promise(r => setTimeout(r, 1500));

// Quick smoke test
const t1 = await hook({
  file_base64: b64(`PROPOSTA COMERCIAL\nFornecedor: MSA EQUIPAMENTOS DE SEGURANCA\nCNPJ: 12345678000199\n\n1) Capacete MSA - 15 und - R$ 89,90 cada\n2) Oculos protecao - 15 und - R$ 18,40\n\nValor total: R$ 1.624,50`),
  file_name: 'cotacao_epi.txt',
  mime_type: 'text/plain'
});
console.log('Test result:', JSON.stringify({ success: t1.success, fornecedores_count: t1.fornecedores?.length, items_count: t1.fornecedores?.[0]?.itens?.length }, null, 2));

if (!t1.success) {
  console.error('TEST FAILED:', t1.error);
  process.exit(1);
}
console.log('All OK!');
