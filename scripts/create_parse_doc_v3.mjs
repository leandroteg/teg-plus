#!/usr/bin/env node
// Criar workflow Parse Documento AI usando o node nativo Google Gemini do n8n

const N8N_URL = 'https://teg-agents-n8n.nmmcas.easypanel.host'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI'
const GEMINI_CRED_ID = 'HGlVWIMt9rZrgCof'

const prompt = `Analise este documento (cotação, proposta comercial, lista de materiais ou similar) e extraia TODOS os itens para uma requisição de compra.

Retorne SOMENTE JSON válido (sem markdown, sem blocos de código) no formato:
{"itens":[{"descricao":"descrição completa do item","quantidade":1,"unidade":"un","valor_unitario_estimado":0.00}],"obra_sugerida":"","urgencia_sugerida":"normal","categoria_sugerida":"consumo","justificativa_sugerida":"","confianca":0.85,"fornecedor_nome":"","fornecedor_cnpj":"","condicao_pagamento":"","validade_proposta":""}

Regras:
- Unidades: un, par, jg, kg, ton, m, m², m³, L, pc, cx, rl, hr, vb
- Se o valor unitário não estiver claro, use 0
- Inclua TODOS os itens encontrados
- Se for proposta com valor total por item, calcule o unitário dividindo pela quantidade
- categoria_sugerida: eletrico|civil|ferramentas|epi|servicos|consumo`

// Código que prepara o prompt com o base64 do documento
const prepareCode = `
const body = $input.first().json.body || $input.first().json;
const { base64, nome, mime_type, texto_extra } = body;
if (!base64) throw new Error('Campo base64 é obrigatório');

const promptBase = ${JSON.stringify(prompt)};
const fullPrompt = promptBase + (texto_extra ? '\\nContexto: ' + texto_extra : '') + '\\nNome do arquivo: ' + (nome || 'documento');

return [{
  json: {
    base64,
    nome: nome || 'documento',
    mime_type: mime_type || 'application/pdf',
    prompt: fullPrompt
  }
}];
`.trim()

// Código que processa a resposta do Gemini
const parseResponseCode = `
const geminiOutput = $input.first().json;
// O output do Gemini node vem como text
const rawText = typeof geminiOutput === 'string' ? geminiOutput : (geminiOutput.text || geminiOutput.output || JSON.stringify(geminiOutput));

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
result.justificativa_sugerida = result.justificativa_sugerida || 'Itens extraídos de ' + ($('Preparar Request').first().json.nome || 'documento');
result.categoria_sugerida = result.categoria_sugerida || 'consumo';
result.urgencia_sugerida = result.urgencia_sugerida || 'normal';
result.obra_sugerida = result.obra_sugerida || '';

return [{ json: result }];
`.trim()

const workflow = {
  name: 'TEG+ | Compras - Parse Documento AI v3',
  nodes: [
    // 1. Webhook
    {
      parameters: { path: 'compras/parse-documento-ai', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
      id: 'wh1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [200, 300],
      webhookId: 'parse-doc-ai-v3',
    },
    // 2. Preparar o request (extrair base64 e montar prompt)
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: prepareCode },
      id: 'prep1', name: 'Preparar Request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [420, 300],
    },
    // 3. Chamar Gemini via HTTP Request com a API key da credential
    {
      parameters: {
        method: 'POST',
        url: '=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googlePalmApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{\n  JSON.stringify({\n    contents: [{\n      parts: [\n        { inline_data: { mime_type: $json.mime_type, data: $json.base64 } },\n        { text: $json.prompt }\n      ]\n    }],\n    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }\n  })\n}}`,
        options: { timeout: 90000 },
      },
      id: 'gemini1', name: 'Chamar Gemini', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [650, 300],
      credentials: { googlePalmApi: { id: GEMINI_CRED_ID, name: 'TEG+ - Google Gemini(PaLM) API' } },
      onError: 'continueErrorOutput',
    },
    // 4. Parsear resposta do Gemini
    {
      parameters: {
        mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: `
const resp = $input.first().json;
const rawText = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';

let jsonStr = rawText.replace(/\\\`\\\`\\\`json\\n?/g, '').replace(/\\\`\\\`\\\`\\n?/g, '').trim();
let result;
try {
  result = JSON.parse(jsonStr);
} catch {
  const match = jsonStr.match(/\\{[\\s\\S]*\\}/);
  if (match) result = JSON.parse(match[0]);
  else throw new Error('JSON invalido: ' + rawText.substring(0, 300));
}

if (!result.itens || !Array.isArray(result.itens)) result.itens = [];
result.itens = result.itens.map(item => ({
  descricao: String(item.descricao || '').trim(),
  quantidade: Number(item.quantidade || item.qtd || 1),
  unidade: String(item.unidade || 'un').toLowerCase(),
  valor_unitario_estimado: Number(item.valor_unitario_estimado || item.valor_unit || 0)
})).filter(i => i.descricao.length > 1);

result.confianca = result.itens.length > 0 ? 0.9 : 0.3;
result.justificativa_sugerida = result.justificativa_sugerida || 'Itens extraidos do documento';
result.categoria_sugerida = result.categoria_sugerida || 'consumo';
result.urgencia_sugerida = result.urgencia_sugerida || 'normal';
result.obra_sugerida = result.obra_sugerida || '';

return [{ json: result }];
`.trim()
      },
      id: 'parse1', name: 'Parsear Resposta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [880, 300],
    },
    // 5. Responder sucesso
    {
      parameters: { respondWith: 'firstIncomingItem', options: {} },
      id: 'resp1', name: 'Responder OK', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [1100, 300],
    },
    // 6. Error handler
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: "const e = $input.first().json?.error?.message || 'Erro ao processar documento';\nreturn [{json:{success:false,error:e,itens:[]}}];" },
      id: 'err1', name: 'Tratar Erro', type: 'n8n-nodes-base.code', typeVersion: 2, position: [880, 520],
    },
    // 7. Responder erro
    {
      parameters: { respondWith: 'firstIncomingItem', options: { responseCode: 500 } },
      id: 'resp-err1', name: 'Responder Erro', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [1100, 520],
    },
  ],
  connections: {
    'Webhook': { main: [[{ node: 'Preparar Request', type: 'main', index: 0 }]] },
    'Preparar Request': { main: [[{ node: 'Chamar Gemini', type: 'main', index: 0 }]] },
    'Chamar Gemini': { main: [[{ node: 'Parsear Resposta', type: 'main', index: 0 }], [{ node: 'Tratar Erro', type: 'main', index: 0 }]] },
    'Parsear Resposta': { main: [[{ node: 'Responder OK', type: 'main', index: 0 }]] },
    'Tratar Erro': { main: [[{ node: 'Responder Erro', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
}

async function main() {
  console.log('Criando workflow v3...')
  const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY },
    body: JSON.stringify(workflow),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    console.error('Erro ao criar:', createRes.status, errText.substring(0, 500))
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

  console.log('Aguardando registro do webhook...')
  await new Promise(r => setTimeout(r, 3000))

  console.log('Testando...')
  const testRes = await fetch(`${N8N_URL}/webhook/compras/parse-documento-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64: Buffer.from('Item 1: Cabo XLPE 35mm - 100m - R$ 15,00/m\nItem 2: Disjuntor 100A - 5 un - R$ 250,00').toString('base64'),
      nome: 'cotacao.txt',
      mime_type: 'text/plain',
    }),
  })
  console.log('HTTP:', testRes.status)
  const body = await testRes.text()
  console.log('Response:', body.substring(0, 500))
}

main()
