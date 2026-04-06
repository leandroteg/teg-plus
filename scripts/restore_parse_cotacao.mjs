import fs from 'node:fs/promises';

const N8N = 'https://teg-agents-n8n.nmmcas.easypanel.host';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiM2U5NDNlZjMtNmE4My00OTQ5LTlhMTQtMDBjZGM0ZmMxOGNhIiwiaWF0IjoxNzc1NDg0MzU2fQ.zoZesxPDFwgH5m4GdMV7rjXCKyp7p5bAGyOo6yuNmpU';
const WF = 'P5xDZQJ2Hh6mVXO0';
const GEM_KEY = 'AIzaSyBAh--5NxDXwpsNpBqPGVHLzc_4da_jSvg';

// Load the WORKING backup
const wf = JSON.parse(await fs.readFile('C:/teg-plus/n8n-docs/workflow-parse-cotacao-backup-2026-04-06T14-07-04-181Z.json', 'utf8'));

// Build new prep code with file_url + File API support
const prepCode = `const body = $input.first().json.body || $input.first().json;
let { file_base64, file_name, mime_type } = body;

// Se recebeu file_url em vez de file_base64, baixar o arquivo
if (!file_base64 && body.file_url) {
  const dlResp = await this.helpers.httpRequest({
    method: 'GET',
    url: body.file_url,
    encoding: 'arraybuffer',
    returnFullResponse: true,
  });
  file_base64 = Buffer.from(dlResp.body).toString('base64');
  if (!mime_type) mime_type = dlResp.headers['content-type'] || 'application/pdf';
}

if (!file_base64) throw new Error('Campo obrigatorio: file_base64 ou file_url');

const prompt = 'Analise este documento de cotacao/proposta de fornecedor e extraia os dados em JSON valido (sem markdown, sem blocos de codigo).\\n\\n' +
  'Formato EXATO esperado:\\n' +
  JSON.stringify({
    fornecedor_nome: "Nome do fornecedor",
    fornecedor_cnpj: "XX.XXX.XXX/XXXX-XX ou null",
    fornecedor_contato: "telefone ou email do fornecedor ou null",
    valor_total: 12345.67,
    prazo_entrega_dias: 15,
    condicao_pagamento: "30 dias, a vista, etc. ou null",
    itens: [{ descricao: "Item 1", qtd: 10, valor_unitario: 25.50, valor_total: 255.00 }],
    observacao: "qualquer observacao relevante ou null"
  }, null, 2) + '\\n\\n' +
  'REGRAS:\\n' +
  '- Se o valor_total nao estiver explicito, some os valores dos itens\\n' +
  '- Se prazo nao estiver explicito, retorne null\\n' +
  '- Valores monetarios em numeros (sem R$, sem pontos de milhar)\\n' +
  '- Use ponto como separador decimal (ex: 1234.56)\\n' +
  '- CNPJ formatado XX.XXX.XXX/XXXX-XX\\n' +
  '- Se for screenshot de WhatsApp/email com proposta, extraia os dados\\n' +
  '- Se houver multiplos fornecedores no mesmo doc, retorne um array\\n' +
  '- Se for apenas 1 fornecedor, retorne o objeto diretamente (nao array)\\n' +
  '- Responda SOMENTE o JSON valido, nada mais\\n\\n' +
  'Nome do arquivo: ' + (file_name || 'documento');

const mimeType = mime_type || 'image/jpeg';
const isImage = mimeType.startsWith('image/');
const isPdf = mimeType.includes('pdf');

let cleanBase64 = file_base64.replace(/[\\r\\n\\s]/g, '');
if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',').pop();

let parts;
if (isImage || isPdf) {
  if (cleanBase64.length > 15000000) {
    // Large file: use Gemini File API
    const blob = Buffer.from(cleanBase64, 'base64');
    const upResp = await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEM_KEY}',
      headers: {
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(blob.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: blob,
      returnFullResponse: false,
    });
    const fileUri = upResp.file && upResp.file.uri;
    if (!fileUri) throw new Error('Gemini File API: URI nao retornada');
    const fName = upResp.file && upResp.file.name;
    if (fName) {
      for (let i = 0; i < 30; i++) {
        const sr = await this.helpers.httpRequest({
          method: 'GET',
          url: 'https://generativelanguage.googleapis.com/v1beta/' + fName + '?key=${GEM_KEY}',
        });
        if (sr.state === 'ACTIVE') break;
        if (sr.state === 'FAILED') throw new Error('Gemini: falha processar arquivo');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    parts = [
      { file_data: { mime_type: mimeType, file_uri: fileUri } },
      { text: prompt }
    ];
  } else {
    parts = [
      { inline_data: { mime_type: mimeType, data: cleanBase64 } },
      { text: prompt }
    ];
  }
} else {
  const textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8').substring(0, 15000);
  parts = [{ text: prompt + '\\n\\nConteudo do documento:\\n' + textContent }];
}

const geminiBody = {
  contents: [{ parts }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
};

return [{ json: { __bodyJson: JSON.stringify(geminiBody) } }];`;

// Update prep node
const prepNode = wf.nodes.find(n => n.id === 'prep-payload');
prepNode.parameters.jsCode = prepCode;

// Increase HTTP timeout
const httpNode = wf.nodes.find(n => n.id === 'gemini-http');
if (httpNode) {
  httpNode.parameters.options = { ...(httpNode.parameters.options || {}), timeout: 120000 };
}

const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings,
};

async function apiCall(path, opts = {}) {
  const res = await fetch(`${N8N}/api/v1${path}`, {
    ...opts,
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`n8n ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

// Deploy
await apiCall(`/workflows/${WF}`, { method: 'PUT', body: JSON.stringify(payload) });
console.log('Workflow updated');

try { await apiCall(`/workflows/${WF}/deactivate`, { method: 'POST', body: '{}' }); } catch {}
await apiCall(`/workflows/${WF}/activate`, { method: 'POST', body: '{}' });
console.log('Workflow activated');

await new Promise(r => setTimeout(r, 2000));

// Test
const testResp = await fetch(`${N8N}/webhook/compras/parse-cotacao`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    file_base64: Buffer.from(
      'PROPOSTA COMERCIAL\nFornecedor: MSA EQUIPAMENTOS\nCNPJ: 12345678000199\n\n1) Capacete seguranca - 15 und - R$ 89,90 cada\n2) Oculos protecao - 15 und - R$ 18,40\n\nTotal: R$ 1.624,50'
    ).toString('base64'),
    file_name: 'cotacao_epi.txt',
    mime_type: 'text/plain',
  }),
});
const result = await testResp.json();
console.log('Test result:', JSON.stringify(result, null, 2).slice(0, 500));

if (result.success !== undefined ? result.success : result.fornecedor_nome) {
  console.log('SUCCESS!');
} else {
  console.log('Test may have issues - check output above');
}
