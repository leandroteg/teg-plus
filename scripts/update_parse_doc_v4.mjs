#!/usr/bin/env node
// Recriar workflow Parse Documento AI com prompt melhorado

const N8N_URL = 'https://teg-agents-n8n.nmmcas.easypanel.host'
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI'
const GEMINI_CRED_ID = 'HGlVWIMt9rZrgCof'
const OLD_WF_ID = 'xchcpCiOD4A1WHJO' // will be auto-cleaned

const prompt = `Você é um especialista em compras corporativas. Analise este documento (cotação, proposta comercial, orçamento ou lista de materiais) e extraia os itens para uma requisição de compra.

INSTRUÇÕES IMPORTANTES:
1. Identifique o TIPO do documento: proposta de serviço, cotação de materiais, orçamento, etc.
2. Extraia cada ITEM ou SERVIÇO individualmente — NÃO agrupe tudo em um único item
3. Para propostas de serviço com planos/pacotes (ex: "Plano Essencial", "Plano Premium"), cada plano é UM item separado
4. A descrição deve ser CURTA e OBJETIVA (máximo 80 caracteres) — o nome do serviço/produto, NÃO a descrição completa
5. Se o documento mostra valores mensais, o valor unitário é o MENSAL
6. Se há tabela de preços, extraia cada linha como um item
7. Identifique o fornecedor pelo nome/razão social, CNPJ se visível
8. Identifique condições de pagamento e validade da proposta

EXEMPLOS de boas descrições:
- "Plano Marketing Essencial - mensal" (NÃO "Serviço mensal de estratégia de marketing COMEIHA ESSENCIAL. Inclui posicionamento de marca, site institucional, gestão de...")
- "Cabo XLPE 35mm 1kV" (NÃO "Cabo de energia XLPE com isolação de 35mm para tensão de 1kV conforme norma NBR...")
- "Disjuntor tripolar 100A" (NÃO "Disjuntor trifásico com capacidade de 100 ampères para quadro de distribuição...")
- "Locação guindaste 25ton - diária" (NÃO "Serviço de locação de guindaste hidráulico modelo LTM 1025 com capacidade...")

Retorne SOMENTE JSON válido (sem markdown, sem blocos de código):
{
  "itens": [
    {"descricao": "nome curto e claro do item", "quantidade": 1, "unidade": "un", "valor_unitario_estimado": 0.00}
  ],
  "obra_sugerida": "",
  "urgencia_sugerida": "normal",
  "categoria_sugerida": "servicos",
  "justificativa_sugerida": "breve justificativa",
  "confianca": 0.85,
  "fornecedor_nome": "nome do fornecedor",
  "fornecedor_cnpj": "CNPJ se encontrado",
  "condicao_pagamento": "condição se mencionada",
  "validade_proposta": "validade se mencionada"
}

Categorias válidas: eletrico, civil, ferramentas, epi, servicos, consumo, materiais_obra, frota_equip, locacao_veic, mobilizacao, alimentacao, escritorio
Unidades: un, par, jg, kg, ton, m, m2, m3, L, pc, cx, rl, hr, vb, mes, dia`

const prepareCode = `
const body = $input.first().json.body || $input.first().json;
const { base64, nome, mime_type, texto_extra } = body;
if (!base64) throw new Error('Campo base64 é obrigatório');

const promptBase = ${JSON.stringify(prompt)};
const fullPrompt = promptBase + (texto_extra ? '\\nContexto adicional: ' + texto_extra : '') + '\\nNome do arquivo: ' + (nome || 'documento');

return [{
  json: {
    base64,
    nome: nome || 'documento',
    mime_type: mime_type || 'application/pdf',
    prompt: fullPrompt
  }
}];
`.trim()

const parseResponseCode = `
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
  descricao: String(item.descricao || '').trim().substring(0, 120),
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

const workflow = {
  name: 'TEG+ | Compras - Parse Documento AI',
  nodes: [
    {
      parameters: { path: 'compras/parse-documento-ai', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
      id: 'wh1', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [200, 300],
      webhookId: 'parse-doc-ai-v4',
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: prepareCode },
      id: 'prep1', name: 'Preparar Request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [420, 300],
    },
    {
      parameters: {
        method: 'POST',
        url: '=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googlePalmApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={{\n  JSON.stringify({\n    contents: [{\n      parts: [\n        { inline_data: { mime_type: $json.mime_type, data: $json.base64 } },\n        { text: $json.prompt }\n      ]\n    }],\n    generationConfig: { temperature: 0.05, maxOutputTokens: 4096 }\n  })\n}}`,
        options: { timeout: 90000 },
      },
      id: 'gemini1', name: 'Chamar Gemini', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [650, 300],
      credentials: { googlePalmApi: { id: GEMINI_CRED_ID, name: 'TEG+ - Google Gemini(PaLM) API' } },
      onError: 'continueErrorOutput',
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: parseResponseCode },
      id: 'parse1', name: 'Parsear Resposta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [880, 300],
    },
    {
      parameters: { respondWith: 'firstIncomingItem', options: {} },
      id: 'resp1', name: 'Responder OK', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [1100, 300],
    },
    {
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript',
        jsCode: "const e = $input.first().json?.error?.message || 'Erro ao processar documento';\nreturn [{json:{success:false,error:e,itens:[]}}];" },
      id: 'err1', name: 'Tratar Erro', type: 'n8n-nodes-base.code', typeVersion: 2, position: [880, 520],
    },
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
  // 1. Desativar e deletar o antigo
  console.log('Desativando workflow antigo...')
  await fetch(`${N8N_URL}/api/v1/workflows/${OLD_WF_ID}/deactivate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY },
  })
  await fetch(`${N8N_URL}/api/v1/workflows/${OLD_WF_ID}`, {
    method: 'DELETE', headers: { 'X-N8N-API-KEY': API_KEY },
  })
  console.log('Antigo removido.')

  await new Promise(r => setTimeout(r, 2000))

  // 2. Criar novo
  console.log('Criando workflow v4...')
  const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': API_KEY },
    body: JSON.stringify(workflow),
  })

  if (!createRes.ok) {
    console.error('Erro ao criar:', createRes.status, await createRes.text().then(t => t.substring(0, 500)))
    process.exit(1)
  }

  const created = await createRes.json()
  console.log('Criado:', created.id, created.name)

  // 3. Ativar
  console.log('Ativando...')
  const actRes = await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY },
  })
  const act = await actRes.json()
  console.log('Ativo:', act.active)

  await new Promise(r => setTimeout(r, 3000))

  // 4. Testar com dados que simulam uma proposta de serviço
  console.log('\nTestando com proposta de serviço...')
  const testData = Buffer.from(`PROPOSTA COMERCIAL - COMEIHA MARKETING

Prezado cliente,

Segue nossa proposta de serviços de marketing digital:

PLANO ESSENCIAL - R$ 25.000,00/mês
- Posicionamento de marca
- Gestão de redes sociais (3 posts/semana)
- Site institucional

PLANO PREMIUM - R$ 42.000,00/mês
- Tudo do Essencial +
- Google Ads e Meta Ads
- Produção de conteúdo audiovisual
- Relatórios semanais

Condição: pagamento mensal via boleto
Validade: 30 dias
CNPJ: 12.345.678/0001-90`).toString('base64')

  const testRes = await fetch(`${N8N_URL}/webhook/compras/parse-documento-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: testData, nome: 'proposta_marketing.txt', mime_type: 'text/plain' }),
  })
  console.log('HTTP:', testRes.status)
  const body = await testRes.json()
  console.log('Itens:', JSON.stringify(body.itens, null, 2))
  console.log('Fornecedor:', body.fornecedor_nome)
  console.log('CNPJ:', body.fornecedor_cnpj)
  console.log('Categoria:', body.categoria_sugerida)
  console.log('Pagamento:', body.condicao_pagamento)
}

main()
