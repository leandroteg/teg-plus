#!/usr/bin/env node
// Script para criar o workflow "Parse Documento AI" no n8n com typeVersion 2.1

const N8N_URL = 'https://teg-agents-n8n.nmmcas.easypanel.host'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI'

const geminiCode = `
const body = $input.first().json.body || $input.first().json;
const { base64, nome, mime_type, texto_extra } = body;
if (!base64) throw new Error('Campo base64 é obrigatório');
const GEMINI_KEY = $env.GEMINI_API_KEY;
if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada');

const prompt = \`Analise este documento (cotação, proposta comercial, lista de materiais ou similar) e extraia TODOS os itens para uma requisição de compra.

Retorne SOMENTE JSON válido (sem markdown, sem blocos de código) no formato:
{"itens":[{"descricao":"descrição completa do item","quantidade":1,"unidade":"un","valor_unitario_estimado":0.00}],"obra_sugerida":"","urgencia_sugerida":"normal","categoria_sugerida":"consumo","justificativa_sugerida":"","confianca":0.85,"fornecedor_nome":"","fornecedor_cnpj":"","condicao_pagamento":"","validade_proposta":""}

Regras:
- Unidades: un, par, jg, kg, ton, m, m², m³, L, pc, cx, rl, hr, vb
- Se o valor unitário não estiver claro, use 0
- Inclua TODOS os itens encontrados
- Se for proposta com valor total por item, calcule o unitário dividindo pela quantidade
- categoria_sugerida: eletrico|civil|ferramentas|epi|servicos|consumo
\${texto_extra ? '\\nContexto: ' + texto_extra : ''}
Nome do arquivo: \${nome || 'documento'}\`;

const mimeType = mime_type || 'application/pdf';
const parts = [
  { inline_data: { mime_type: mimeType, data: base64 } },
  { text: prompt }
];

const resp = await fetch(
  \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${GEMINI_KEY}\`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    })
  }
);

if (!resp.ok) {
  const errText = await resp.text();
  throw new Error(\`Gemini API \${resp.status}: \${errText.substring(0, 500)}\`);
}

const geminiData = await resp.json();
const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

let jsonStr = rawText.replace(/\\\`\\\`\\\`json\\n?/g, '').replace(/\\\`\\\`\\\`\\n?/g, '').trim();
let result;
try {
  result = JSON.parse(jsonStr);
} catch {
  const match = jsonStr.match(/\\{[\\s\\S]*\\}/);
  if (match) result = JSON.parse(match[0]);
  else throw new Error('Gemini não retornou JSON válido: ' + rawText.substring(0, 300));
}

if (!result.itens || !Array.isArray(result.itens)) result.itens = [];
result.itens = result.itens.map(item => ({
  descricao: String(item.descricao || '').trim(),
  quantidade: Number(item.quantidade || item.qtd || 1),
  unidade: String(item.unidade || 'un').toLowerCase(),
  valor_unitario_estimado: Number(item.valor_unitario_estimado || item.valor_unit || 0)
})).filter(i => i.descricao.length > 1);

result.confianca = result.itens.length > 0 ? 0.9 : 0.3;
result.justificativa_sugerida = result.justificativa_sugerida || \`Itens extraídos de \${nome || 'documento'}\`;
result.categoria_sugerida = result.categoria_sugerida || 'consumo';
result.urgencia_sugerida = result.urgencia_sugerida || 'normal';
result.obra_sugerida = result.obra_sugerida || '';

return [{ json: result }];
`.trim()

const workflow = {
  name: 'TEG+ | Compras - Parse Documento AI v2',
  nodes: [
    {
      parameters: { path: 'compras/parse-documento-ai', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
      id: 'wh1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [250, 300],
      webhookId: 'parse-doc-ai-v2',
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: geminiCode },
      id: 'gemini1', name: 'Parse Gemini', type: 'n8n-nodes-base.code', typeVersion: 2, position: [500, 300],
      onError: 'continueErrorOutput',
    },
    {
      parameters: { respondWith: 'firstIncomingItem', options: {} },
      id: 'resp1', name: 'Responder OK', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [750, 300],
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: "const e = $input.first().json?.error?.message || 'Erro ao processar documento';\nreturn [{json:{success:false,error:e,itens:[]}}];" },
      id: 'err1', name: 'Tratar Erro', type: 'n8n-nodes-base.code', typeVersion: 2, position: [750, 520],
    },
    {
      parameters: { respondWith: 'firstIncomingItem', options: { responseCode: 500 } },
      id: 'resp-err1', name: 'Responder Erro', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [980, 520],
    },
  ],
  connections: {
    'Webhook': { main: [[{ node: 'Parse Gemini', type: 'main', index: 0 }]] },
    'Parse Gemini': { main: [[{ node: 'Responder OK', type: 'main', index: 0 }], [{ node: 'Tratar Erro', type: 'main', index: 0 }]] },
    'Tratar Erro': { main: [[{ node: 'Responder Erro', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
}

async function main() {
  console.log('Criando workflow...')
  const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY },
    body: JSON.stringify(workflow),
  })

  if (!createRes.ok) {
    console.error('Erro ao criar:', createRes.status, await createRes.text())
    process.exit(1)
  }

  const created = await createRes.json()
  console.log('Workflow criado:', created.id, created.name)

  console.log('Ativando...')
  const activateRes = await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': API_KEY },
  })

  const activated = await activateRes.json()
  console.log('Ativo:', activated.active)

  // Testar
  console.log('Testando webhook...')
  await new Promise(r => setTimeout(r, 3000))
  const testRes = await fetch(`${N8N_URL}/webhook/compras/parse-documento-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: 'SGVsbG8=', nome: 'test.txt', mime_type: 'text/plain' }),
  })
  console.log('Webhook status:', testRes.status)
  if (testRes.ok || testRes.status === 500) {
    console.log('Webhook REGISTRADO com sucesso!')
  } else {
    console.log('Webhook ainda não registrado:', await testRes.text().catch(() => ''))
  }
}

main()
