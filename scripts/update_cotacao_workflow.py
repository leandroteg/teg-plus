import json, subprocess, base64, time

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI"
BASE = "https://teg-agents-n8n.nmmcas.easypanel.host"
WF_ID = "P5xDZQJ2Hh6mVXO0"

# ── Code: Preparar Payload ──────────────────────────────────────────
prep_code = """const body = $input.first().json.body || $input.first().json;
const { file_base64, file_name, mime_type } = body;

if (!file_base64) throw new Error('Campo obrigatorio: file_base64');

const prompt = `Analise este documento de cotacao/proposta de fornecedor e extraia os dados em JSON valido (sem markdown, sem blocos de codigo).

Formato EXATO esperado:
{
  "fornecedor_nome": "Nome do fornecedor",
  "fornecedor_cnpj": "XX.XXX.XXX/XXXX-XX ou null",
  "fornecedor_contato": "telefone ou email do fornecedor ou null",
  "valor_total": 12345.67,
  "prazo_entrega_dias": 15,
  "condicao_pagamento": "30 dias, a vista, etc. ou null",
  "itens": [
    {"descricao": "Item 1", "qtd": 10, "valor_unitario": 25.50, "valor_total": 255.00}
  ],
  "observacao": "qualquer observacao relevante ou null"
}

REGRAS:
- Se o valor_total nao estiver explicito, some os valores dos itens
- Se prazo nao estiver explicito, retorne null
- Valores monetarios em numeros (sem R$, sem pontos de milhar)
- Use ponto como separador decimal (ex: 1234.56)
- CNPJ formatado XX.XXX.XXX/XXXX-XX
- Se for screenshot de WhatsApp/email com proposta, extraia os dados
- Se houver multiplos fornecedores no mesmo doc, retorne um array
- Se for apenas 1 fornecedor, retorne o objeto diretamente (nao array)
- Responda SOMENTE o JSON valido, nada mais

Nome do arquivo: ${file_name || 'documento'}`;

const mimeType = mime_type || 'image/jpeg';
const isImage = mimeType.startsWith('image/');
const isPdf = mimeType.includes('pdf');

// Clean base64: remove whitespace, data URI prefix
let cleanBase64 = file_base64.replace(/[\\r\\n\\s]/g, '');
if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',').pop();

let parts;
if (isImage || isPdf) {
  parts = [
    { inline_data: { mime_type: mimeType, data: cleanBase64 } },
    { text: prompt }
  ];
} else {
  const textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8').substring(0, 15000);
  parts = [{ text: prompt + '\\n\\nConteudo do documento:\\n' + textContent }];
}

const geminiBody = {
  contents: [{ parts }],
  generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
};

// Pre-stringify to avoid n8n expression engine corrupting large base64
return [{ json: { __bodyJson: JSON.stringify(geminiBody) } }];"""

# ── Code: Parsear Resposta ──────────────────────────────────────────
parse_code = """const geminiData = $input.first().json;
const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

let jsonStr = rawText.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
let parsed;
try {
  parsed = JSON.parse(jsonStr);
} catch {
  const arrMatch = jsonStr.match(/\\[[\\s\\S]*\\]/);
  const objMatch = jsonStr.match(/\\{[\\s\\S]*\\}/);
  if (arrMatch) {
    parsed = JSON.parse(arrMatch[0]);
  } else if (objMatch) {
    parsed = JSON.parse(objMatch[0]);
  } else {
    throw new Error('Gemini nao retornou JSON valido: ' + rawText.substring(0, 300));
  }
}

const fornecedores = Array.isArray(parsed) ? parsed : [parsed];
return [{ json: { success: true, fornecedores } }];"""

# ── Code: Tratar Erro ───────────────────────────────────────────────
error_code = """const err = $input.first().json;
const errorMsg = err?.error?.message || err?.message || JSON.stringify(err).substring(0, 500) || 'Erro desconhecido';
return [{ json: { success: false, error: errorMsg, fornecedores: [] } }];"""

# ── Workflow Structure ──────────────────────────────────────────────
nodes = [
    {
        "parameters": {
            "httpMethod": "POST",
            "path": "compras/parse-cotacao",
            "responseMode": "responseNode",
            "options": {}
        },
        "id": "cotacao-parse-webhook",
        "name": "Webhook Parse Cotacao",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [0, 300],
        "webhookId": "8a51fac2-d983-430f-a517-551e04ea5a48"
    },
    {
        "parameters": {
            "jsCode": prep_code,
            "mode": "runOnceForAllItems"
        },
        "id": "prep-payload",
        "name": "Preparar Payload Gemini",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [250, 300],
        "onError": "continueErrorOutput"
    },
    {
        "parameters": {
            "method": "POST",
            "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyBqG01e0fXQDBNAxNNmvA4JoQ0s6U-IHBM",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ $json.__bodyJson }}",
            "options": {
                "timeout": 60000
            }
        },
        "id": "gemini-http",
        "name": "Chamar Gemini API",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [500, 300],
        "onError": "continueErrorOutput"
    },
    {
        "parameters": {
            "jsCode": parse_code,
            "mode": "runOnceForAllItems"
        },
        "id": "parse-response",
        "name": "Parsear Resposta Gemini",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [750, 300],
        "onError": "continueErrorOutput"
    },
    {
        "parameters": {
            "respondWith": "firstIncomingItem",
            "options": {}
        },
        "id": "respond-sucesso",
        "name": "Responder Sucesso",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [1000, 300]
    },
    {
        "parameters": {
            "jsCode": error_code,
            "mode": "runOnceForAllItems"
        },
        "id": "tratar-erro",
        "name": "Tratar Erro",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [500, 550]
    },
    {
        "parameters": {
            "respondWith": "firstIncomingItem",
            "options": {"responseCode": 200}
        },
        "id": "respond-erro",
        "name": "Responder Erro",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [750, 550]
    }
]

connections = {
    "Webhook Parse Cotacao": {
        "main": [[{"node": "Preparar Payload Gemini", "type": "main", "index": 0}]]
    },
    "Preparar Payload Gemini": {
        "main": [
            [{"node": "Chamar Gemini API", "type": "main", "index": 0}],
            [{"node": "Tratar Erro", "type": "main", "index": 0}]
        ]
    },
    "Chamar Gemini API": {
        "main": [
            [{"node": "Parsear Resposta Gemini", "type": "main", "index": 0}],
            [{"node": "Tratar Erro", "type": "main", "index": 0}]
        ]
    },
    "Parsear Resposta Gemini": {
        "main": [
            [{"node": "Responder Sucesso", "type": "main", "index": 0}],
            [{"node": "Tratar Erro", "type": "main", "index": 0}]
        ]
    },
    "Tratar Erro": {
        "main": [[{"node": "Responder Erro", "type": "main", "index": 0}]]
    }
}

payload = {
    "name": "TEG+ | Compras - AI Parse Cotacao",
    "nodes": nodes,
    "connections": connections,
    "settings": {
        "executionOrder": "v1",
        "callerPolicy": "workflowsFromSameOwner",
        "availableInMCP": True
    }
}

def api(method, path, data=None):
    cmd = ['curl', '-s', '-X', method, f'{BASE}{path}', '-H', f'X-N8N-API-KEY: {N8N_KEY}', '--max-time', '15']
    if data:
        cmd += ['-H', 'Content-Type: application/json', '-d', json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

# 1. Update workflow
print("1. Updating workflow...")
resp = api('PUT', f'/api/v1/workflows/{WF_ID}', payload)
print(f"   Name: {resp.get('name','?')}")
print(f"   Nodes: {[n['name'] for n in resp.get('nodes',[])]}")

# 2. Deactivate + Activate
print("2. Re-registering webhook...")
api('POST', f'/api/v1/workflows/{WF_ID}/deactivate')
time.sleep(1)
resp = api('POST', f'/api/v1/workflows/{WF_ID}/activate')
print(f"   Active: {resp.get('active')}")

# 3. Test
print("3. Testing webhook...")
time.sleep(1)
cotacao = "PROPOSTA COMERCIAL\nFornecedor: Eletro Seguranca LTDA\nCNPJ: 12.345.678/0001-90\nContato: vendas@eletroseg.com.br\n\nItem 1: Luva isolante classe 2 - Qtd: 10 pares - R$ 185,00/par - Total: R$ 1.850,00\nItem 2: Capacete com jugular - Qtd: 20 un - R$ 45,00/un - Total: R$ 900,00\nItem 3: Bota isolante 20kV - Qtd: 15 pares - R$ 320,00/par - Total: R$ 4.800,00\n\nValor Total: R$ 7.550,00\nPrazo de entrega: 15 dias uteis\nCondicao: 30/60 dias"
b64 = base64.b64encode(cotacao.encode()).decode()

test_payload = {"file_base64": b64, "file_name": "cotacao_eletroseg.txt", "mime_type": "text/plain"}
r = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'{BASE}/webhook/compras/parse-cotacao',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps(test_payload),
    '--max-time', '30'
], capture_output=True, text=True, timeout=35)

try:
    result = json.loads(r.stdout)
    print(f"   Success: {result.get('success')}")
    if result.get('error'):
        print(f"   Error: {result['error']}")
    for f in result.get('fornecedores', []):
        print(f"   Fornecedor: {f.get('fornecedor_nome','?')}")
        print(f"   CNPJ: {f.get('fornecedor_cnpj','?')}")
        print(f"   Total: R$ {f.get('valor_total',0)}")
        print(f"   Prazo: {f.get('prazo_entrega_dias','?')} dias")
        print(f"   Itens: {len(f.get('itens',[]))}")
        for item in f.get('itens', []):
            print(f"     - {item.get('descricao')}: {item.get('qtd')}x R${item.get('valor_unitario',0)} = R${item.get('valor_total',0)}")
except Exception as e:
    print(f"   Raw response: {r.stdout[:500]}")
    print(f"   Error: {e}")
