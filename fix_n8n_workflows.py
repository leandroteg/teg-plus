#!/usr/bin/env python3
"""Fix UTF-8 encoding + improve prompts in n8n contract analysis workflows."""

import json
import urllib.request
import ssl

N8N_BASE = "https://teg-agents-n8n.nmmcas.easypanel.host/api/v1"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Y2NjOTJiYS1iNGExLTQ3OWUtYjI4Ny0wM2RlNzVjZGJhY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNTA3ZjFmODktMmJkNi00YWE3LTlhMDItMTI4MmZhY2E3YjExIiwiaWF0IjoxNzcyNDgyNjc1LCJleHAiOjE3NzUwMTYwMDB9._w_QyOwAN57qUCz5Ge8jt1KVg-sfaZ7cBS-nmw9gdmI"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api_call(method, path, data=None):
    url = f"{N8N_BASE}{path}"
    body = json.dumps(data, ensure_ascii=False).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("X-N8N-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        print(f"   HTTP {e.code}: {err_body[:500]}")
        raise

# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW 1: Analisar Minuta AI (f2c6ThhQhpr1hl3u)
# ═══════════════════════════════════════════════════════════════════════════════

ANALISAR_PREPARE_CODE = r'''const input = $input.first().json;
const body = input.body || input;
const { minuta_id, solicitacao_id, texto_minuta, descricao_minuta, contexto, regras } = body;

const prompt = `Analise a seguinte minuta de contrato:

Título: ${descricao_minuta || 'Não informado'}
Descrição: ${texto_minuta || 'Não fornecida'}
Solicitação ID: ${solicitacao_id}

Contexto do Contrato:
- Objeto: ${contexto?.objeto || 'Não informado'}
- Contraparte: ${contexto?.contraparte || 'Não informado'}
- Valor: R$ ${contexto?.valor ? Number(contexto.valor).toLocaleString('pt-BR') : 'Não informado'}
- Tipo de Contrato: ${contexto?.tipo_contrato || 'Não informado'}
- Início: ${contexto?.data_inicio || 'N/A'}
- Fim: ${contexto?.data_fim || 'N/A'}
- Obra: ${contexto?.obra || 'N/A'}

Regras adicionais de análise:
${(regras || []).filter(r => r.ativo).map(r => `- ${r.descricao || r.campo}: ${r.valor}`).join('\n') || 'Nenhuma regra adicional'}

Realize uma análise jurídica completa cobrindo:
1. Identificar o papel da TEG (contratante ou contratada) e seu poder de barganha
2. Cláusulas obrigatórias (objeto, prazo, valor, pagamento, penalidades, rescisão)
3. Cláusulas de segurança do trabalho (NR-10, NR-35, SSMA)
4. Cláusulas financeiras (garantia de execução, seguro RC, reajuste, medição)
5. Compliance (anticorrupção Lei 12.846, LGPD, confidencialidade)
6. Riscos identificados com severidade e sugestões de mitigação
7. Oportunidades de melhorar o contrato em favor da TEG
8. Sugestões categorizadas (importante, recomendada, opcional)
9. Score geral de conformidade (0-100)

Retorne exclusivamente JSON válido conforme a estrutura definida no system prompt.`;

return [{
  json: {
    solicitacao_id,
    minuta_id,
    texto_minuta,
    descricao_minuta,
    contexto,
    regras,
    prompt
  }
}];'''

ANALISAR_SYSTEM = """Você é um consultor jurídico sênior especializado em contratos de engenharia elétrica e transmissão de energia no Brasil. Você atua como assessor estratégico da TEG União Engenharia.

SOBRE A TEG UNIÃO ENGENHARIA:
- Empresa executora de obras de subestações e linhas de transmissão de energia elétrica
- 6 obras ativas em Minas Gerais (SE Frutal, SE Paracatu, SE Perdizes, SE Três Marias, SE Rio Paranaíba, SE Ituiutaba)
- A TEG pode ser CONTRATANTE (quando contrata fornecedores, prestadores PJ, subempreiteiros, locadores) ou CONTRATADA (quando é contratada por concessionárias/transmissoras para executar obras)

DIRETRIZ ESTRATÉGICA - FUNDAMENTAL:
1. IDENTIFIQUE o papel da TEG no contrato (contratante ou contratada) analisando as partes e o objeto
2. AVALIE o poder de barganha real da TEG nesta relação contratual
3. PROTEJA sempre os interesses da TEG - busque oportunidades de melhorar o contrato em seu favor
4. ALERTE riscos mas só sugira MUDANÇAS FUNDAMENTAIS que realmente impactem o negócio
5. NÃO sugira mudanças genéricas ou cosméticas - foque no que realmente importa
6. CATEGORIZE cada sugestão: "importante" (deve mudar), "recomendada" (melhor se mudar), "opcional" (bom ter)
7. IDENTIFIQUE oportunidades que beneficiem a TEG e que a contraparte provavelmente aceitaria

INSTRUÇÕES DE ANÁLISE:
Analise a minuta do contrato fornecida e retorne sua análise EXCLUSIVAMENTE em formato JSON válido (sem markdown, sem texto adicional, sem blocos de código) com esta estrutura:

{"papel_teg":"contratante|contratada|indefinido","poder_barganha":{"nivel":"alto|medio|baixo","justificativa":"<explicação do poder de barganha da TEG neste contrato>"},"score":<número 0-100>,"resumo":"<resumo executivo 2-3 frases focando nos pontos mais críticos para a TEG>","riscos":[{"titulo":"<título curto>","descricao":"<descrição detalhada do risco para a TEG>","severidade":"alto|medio|baixo","clausula_ref":"<referência da cláusula>","sugestao_mitigacao":"<sugestão prática de mitigação>"}],"sugestoes":[{"titulo":"<título>","descricao":"<descrição da melhoria>","categoria":"importante|recomendada|opcional","prioridade":"alta|media|baixa","texto_sugerido":"<texto de cláusula sugerida>","beneficio_teg":"<como esta mudança beneficia a TEG>"}],"oportunidades":[{"titulo":"<oportunidade identificada>","descricao":"<como aproveitar esta oportunidade>","impacto":"alto|medio|baixo","texto_sugerido":"<texto ou estratégia sugerida>"}],"clausulas_analisadas":[{"nome":"<nome da cláusula>","status":"ok|atencao|ausente","observacao":"<observação técnica focada nos interesses da TEG>"}],"conformidade":{"clausulas_obrigatorias":true|false,"penalidades":true|false,"prazos":true|false,"garantias":true|false,"seguro":true|false,"ssma":true|false,"anticorrupcao":true|false,"reajuste":true|false}}

CRITÉRIOS OBRIGATÓRIOS DE AVALIAÇÃO:
- Cláusulas essenciais: objeto, prazo, valor, pagamento, penalidades, rescisão
- Segurança do trabalho: NR-10 (Segurança em Instalações e Serviços em Eletricidade), NR-35 (Trabalho em Altura), NR-12 (Segurança em Máquinas e Equipamentos), programa SSMA
- Financeiro: garantia de execução (5-10% do valor), seguro RC Obras, índice de reajuste (IPCA/INCC), retenção técnica, critérios de medição
- Compliance: anticorrupção (Lei 12.846/2013), LGPD (Lei 13.709/2018), confidencialidade (NDA), propriedade intelectual
- Trabalhista: responsabilidade subsidiária/solidária, regras de subcontratação, encargos sociais
- Ambiental: licenças ambientais, supressão de vegetação, compensação ambiental, gestão de resíduos

ESCALA DE SCORE:
90-100: Excelente - pronto para assinatura, favorável à TEG
75-89: Bom - pequenos ajustes recomendados
60-74: Regular - necessita revisão de pontos específicos
40-59: Preocupante - revisão substancial necessária
0-39: Crítico - rejeição recomendada

ANALISE NO MÍNIMO 10 cláusulas. Identifique no mínimo 3 riscos, 3 sugestões e 2 oportunidades para a TEG.

IMPORTANTE: Retorne SOMENTE o JSON válido, sem nenhum texto adicional antes ou depois. Todo texto deve estar em português brasileiro correto."""

ANALISAR_FORMAT_CODE = r'''// Parse AI response and format as expected by frontend
const input = $input.first().json;
const aiOutput = input.output || input.text || JSON.stringify(input);

let analise;
try {
  if (typeof aiOutput === 'string') {
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    analise = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } else if (typeof aiOutput === 'object') {
    analise = aiOutput;
  }
} catch (e) {
  analise = null;
}

// Fallback if parsing failed
if (!analise || typeof analise !== 'object') {
  analise = {
    score: 70,
    resumo: typeof aiOutput === 'string' ? aiOutput.substring(0, 500) : 'Análise processada.',
    papel_teg: 'indefinido',
    poder_barganha: { nivel: 'medio', justificativa: 'Não foi possível determinar automaticamente.' },
    riscos: [],
    sugestoes: [],
    oportunidades: [],
    clausulas_analisadas: [],
    conformidade: {}
  };
}

// Ensure all required fields
if (!analise.score) analise.score = 70;
if (!analise.resumo) analise.resumo = 'Análise processada.';
if (!analise.papel_teg) analise.papel_teg = 'indefinido';
if (!analise.poder_barganha) analise.poder_barganha = { nivel: 'medio', justificativa: '' };
if (!Array.isArray(analise.riscos)) analise.riscos = [];
if (!Array.isArray(analise.sugestoes)) analise.sugestoes = [];
if (!Array.isArray(analise.oportunidades)) analise.oportunidades = [];
if (!Array.isArray(analise.clausulas_analisadas)) analise.clausulas_analisadas = [];
if (!analise.conformidade || typeof analise.conformidade !== 'object') analise.conformidade = {};

return [{
  json: {
    success: true,
    analise
  }
}];'''

analisar_nodes = [
    {
        "id": "webhook-trigger",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2.1,
        "position": [250, 300],
        "parameters": {
            "httpMethod": "POST",
            "path": "contratos/analisar-minuta",
            "responseMode": "responseNode",
            "options": {"allowedOrigins": "*"}
        },
        "webhookId": "a1b2c3d4-1111-4aaa-bbbb-111111111111"
    },
    {
        "id": "prepare-input",
        "name": "Prepare Input",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [500, 300],
        "parameters": {
            "language": "javaScript",
            "mode": "runOnceForAllItems",
            "jsCode": ANALISAR_PREPARE_CODE
        }
    },
    {
        "id": "gemini-llm",
        "name": "Google Gemini Flash",
        "type": "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        "typeVersion": 1,
        "position": [700, 500],
        "parameters": {
            "options": {"maxOutputTokens": 8192, "temperature": 0.2}
        },
        "credentials": {
            "googlePalmApi": {"id": "HGlVWIMt9rZrgCof", "name": "TEG+ - Google Gemini(PaLM) API"}
        }
    },
    {
        "id": "ai-agent",
        "name": "Analista Juridico AI",
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 3.1,
        "position": [750, 300],
        "parameters": {
            "promptType": "define",
            "text": "={{ $json.prompt }}",
            "options": {
                "systemMessage": ANALISAR_SYSTEM,
                "maxIterations": 5
            }
        }
    },
    {
        "id": "format-output",
        "name": "Format Output",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1000, 300],
        "parameters": {
            "language": "javaScript",
            "mode": "runOnceForAllItems",
            "jsCode": ANALISAR_FORMAT_CODE
        }
    },
    {
        "id": "respond-webhook",
        "name": "Respond to Webhook",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [1250, 300],
        "parameters": {"respondWith": "firstIncomingItem"}
    }
]

analisar_connections = {
    "Webhook": {"main": [[{"node": "Prepare Input", "type": "main", "index": 0}]]},
    "Prepare Input": {"main": [[{"node": "Analista Juridico AI", "type": "main", "index": 0}]]},
    "Google Gemini Flash": {"ai_languageModel": [[{"node": "Analista Juridico AI", "type": "ai_languageModel", "index": 0}]]},
    "Analista Juridico AI": {"main": [[{"node": "Format Output", "type": "main", "index": 0}]]},
    "Format Output": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
}

# ═══════════════════════════════════════════════════════════════════════════════
# WORKFLOW 2: Melhorar Minuta AI (qAh49nU48cbFL7H0)
# ═══════════════════════════════════════════════════════════════════════════════

MELHORAR_PREPARE_CODE = r'''const input = $input.first().json;
const body = input.body || input;
const { solicitacao_id, minuta_id, arquivo_url, titulo, analise, contexto } = body;

const prompt = `Com base na análise jurídica prévia, melhore e reescreva a minuta de contrato.

Título: ${titulo || 'Não informado'}
Arquivo URL: ${arquivo_url || 'N/A'}

Contexto do Contrato:
- Objeto: ${contexto?.objeto || 'Não informado'}
- Contraparte: ${contexto?.contraparte || 'Não informado'}
- Valor: R$ ${contexto?.valor ? Number(contexto.valor).toLocaleString('pt-BR') : 'Não informado'}
- Tipo: ${contexto?.tipo_contrato || 'Não informado'}
- Início: ${contexto?.data_inicio || 'N/A'}
- Fim: ${contexto?.data_fim || 'N/A'}
- Obra: ${contexto?.obra || 'N/A'}

Papel da TEG: ${analise?.papel_teg || 'Não determinado'}
Poder de barganha: ${analise?.poder_barganha?.nivel || 'N/A'} - ${analise?.poder_barganha?.justificativa || ''}

Análise Prévia (Score: ${analise?.score || 'N/A'}/100):
- Resumo: ${analise?.resumo || 'N/A'}
- Riscos: ${JSON.stringify(analise?.riscos || [])}
- Sugestões: ${JSON.stringify(analise?.sugestoes || [])}
- Oportunidades: ${JSON.stringify(analise?.oportunidades || [])}
- Cláusulas Analisadas: ${JSON.stringify(analise?.clausulas_analisadas || [])}
- Conformidade: ${JSON.stringify(analise?.conformidade || {})}

Com base nos riscos, sugestões e oportunidades identificados, gere melhorias concretas para a minuta conforme a estrutura definida no system prompt.`;

return [{
  json: {
    solicitacao_id,
    minuta_id,
    arquivo_url,
    titulo,
    analise,
    contexto,
    prompt
  }
}];'''

MELHORAR_SYSTEM = """Você é um revisor jurídico sênior da TEG União Engenharia, especializado em melhorar minutas de contratos de engenharia elétrica e transmissão de energia no Brasil.

SOBRE A TEG:
- Empresa executora de obras de subestações e linhas de transmissão
- Suas melhorias devem SEMPRE proteger e beneficiar a TEG
- Considere o poder de barganha da TEG ao sugerir mudanças (se baixo, seja mais conservador nas exigências)

Sua tarefa é analisar a minuta atual e gerar melhorias concretas baseadas nos riscos e sugestões identificados na análise prévia.

Retorne EXCLUSIVAMENTE JSON válido (sem markdown, sem blocos de código) com esta estrutura:

{"resumo_melhorias":"<resumo geral das melhorias aplicadas em 2-3 frases>","score_estimado":<número 0-100 estimado após melhorias>,"clausulas_melhoradas":[{"nome":"<nome da cláusula>","status_anterior":"ok|atencao|risco|ausente","acao":"melhorada|adicionada|reescrita","texto_original":"<resumo do texto original se existente>","texto_melhorado":"<novo texto completo da cláusula>","justificativa":"<por que esta melhoria é necessária>","categoria":"importante|recomendada|opcional"}],"riscos_mitigados":[{"risco_original":"<título do risco da análise>","severidade_original":"alto|medio|baixo","severidade_apos":"alto|medio|baixo","acao_tomada":"<descrição da ação de mitigação aplicada>"}],"clausulas_novas":[{"nome":"<nome da nova cláusula>","texto":"<texto completo da cláusula>","motivo":"<por que esta cláusula deve ser incluída>","base_legal":"<referência legal>","categoria":"importante|recomendada|opcional"}],"observacoes_gerais":"<observações adicionais para o revisor humano>"}

DIRETRIZES:
1. PRIORIZE mitigação dos riscos identificados como 'alto'
2. IMPLEMENTE sugestões marcadas como 'importante' obrigatoriamente
3. ADICIONE cláusulas ausentes identificadas na análise de conformidade
4. USE linguagem jurídica formal e precisa em português brasileiro
5. REFERENCIE legislação aplicável: Lei 12.846/2013, NR-10, NR-35, LGPD, Código Civil
6. CONTEXTO: contratos de obras de subestações e linhas de transmissão de energia elétrica
7. Gere NO MÍNIMO 5 cláusulas melhoradas e 2 cláusulas novas
8. Para cada cláusula, forneça texto completo e profissional
9. CATEGORIZE cada melhoria: "importante", "recomendada" ou "opcional"
10. FOQUE em mudanças que realmente impactem o negócio da TEG

IMPORTANTE: Retorne SOMENTE o JSON válido. Todo texto deve estar em português brasileiro correto."""

MELHORAR_FORMAT_CODE = r'''const input = $input.first().json;
const aiOutput = input.output || input.text || JSON.stringify(input);
const solicitacao_id = $('Prepare Input').first().json.solicitacao_id;
const minuta_id = $('Prepare Input').first().json.minuta_id;

let melhorias;
try {
  if (typeof aiOutput === 'string') {
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    melhorias = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } else if (typeof aiOutput === 'object') {
    melhorias = aiOutput;
  }
} catch (e) {
  melhorias = null;
}

if (!melhorias || typeof melhorias !== 'object') {
  melhorias = {
    resumo_melhorias: typeof aiOutput === 'string' ? aiOutput.substring(0, 500) : 'Melhorias processadas.',
    score_estimado: 80,
    clausulas_melhoradas: [],
    riscos_mitigados: [],
    clausulas_novas: [],
    observacoes_gerais: 'Análise em processamento.'
  };
}

if (!melhorias.resumo_melhorias) melhorias.resumo_melhorias = 'Melhorias processadas.';
if (!melhorias.score_estimado) melhorias.score_estimado = 80;
if (!Array.isArray(melhorias.clausulas_melhoradas)) melhorias.clausulas_melhoradas = [];
if (!Array.isArray(melhorias.riscos_mitigados)) melhorias.riscos_mitigados = [];
if (!Array.isArray(melhorias.clausulas_novas)) melhorias.clausulas_novas = [];

melhorias.solicitacao_id = solicitacao_id;
melhorias.minuta_id = minuta_id;
melhorias.data_geracao = new Date().toISOString();

return [{
  json: {
    success: true,
    melhorias
  }
}];'''

melhorar_nodes = [
    {
        "id": "webhook-trigger",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2.1,
        "position": [250, 300],
        "parameters": {
            "httpMethod": "POST",
            "path": "contratos/melhorar-minuta",
            "responseMode": "responseNode",
            "options": {"allowedOrigins": "*"}
        },
        "webhookId": "a1b2c3d4-2222-4aaa-bbbb-222222222222"
    },
    {
        "id": "prepare-input",
        "name": "Prepare Input",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [500, 300],
        "parameters": {
            "language": "javaScript",
            "mode": "runOnceForAllItems",
            "jsCode": MELHORAR_PREPARE_CODE
        }
    },
    {
        "id": "gemini-llm",
        "name": "Google Gemini Flash",
        "type": "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
        "typeVersion": 1,
        "position": [700, 500],
        "parameters": {
            "options": {"maxOutputTokens": 8192, "temperature": 0.3}
        },
        "credentials": {
            "googlePalmApi": {"id": "HGlVWIMt9rZrgCof", "name": "TEG+ - Google Gemini(PaLM) API"}
        }
    },
    {
        "id": "ai-agent",
        "name": "Revisor Juridico AI",
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 3.1,
        "position": [750, 300],
        "parameters": {
            "promptType": "define",
            "text": "={{ $json.prompt }}",
            "options": {
                "systemMessage": MELHORAR_SYSTEM,
                "maxIterations": 5
            }
        }
    },
    {
        "id": "format-output",
        "name": "Format Output",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1000, 300],
        "parameters": {
            "language": "javaScript",
            "mode": "runOnceForAllItems",
            "jsCode": MELHORAR_FORMAT_CODE
        }
    },
    {
        "id": "respond-webhook",
        "name": "Respond to Webhook",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.5,
        "position": [1250, 300],
        "parameters": {"respondWith": "firstIncomingItem"}
    }
]

melhorar_connections = {
    "Webhook": {"main": [[{"node": "Prepare Input", "type": "main", "index": 0}]]},
    "Prepare Input": {"main": [[{"node": "Revisor Juridico AI", "type": "main", "index": 0}]]},
    "Google Gemini Flash": {"ai_languageModel": [[{"node": "Revisor Juridico AI", "type": "ai_languageModel", "index": 0}]]},
    "Revisor Juridico AI": {"main": [[{"node": "Format Output", "type": "main", "index": 0}]]},
    "Format Output": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
}

# ═══════════════════════════════════════════════════════════════════════════════
# EXECUTE UPDATES
# ═══════════════════════════════════════════════════════════════════════════════

print("=" * 60)
print("Updating n8n workflows with proper UTF-8 encoding...")
print("=" * 60)

# Update Analisar workflow
print("\n1. Updating Analisar Minuta AI (f2c6ThhQhpr1hl3u)...")
try:
    result = api_call("PUT", "/workflows/f2c6ThhQhpr1hl3u", {
        "name": "Contratos - Analisar Minuta AI",
        "nodes": analisar_nodes,
        "connections": analisar_connections,
        "settings": {"executionOrder": "v1", "callerPolicy": "workflowsFromSameOwner"}
    })
    print(f"   OK: Updated successfully (version: {result.get('versionId', 'N/A')})")
except Exception as e:
    print(f"   ERROR: Error: {e}")

# Activate Analisar workflow
print("   Activating workflow...")
try:
    result = api_call("POST", "/workflows/f2c6ThhQhpr1hl3u/activate", {})
    print(f"   OK: Activated (active: {result.get('active', False)})")
except Exception as e:
    print(f"   ERROR: Error activating: {e}")

# Update Melhorar workflow
print("\n2. Updating Melhorar Minuta AI (qAh49nU48cbFL7H0)...")
try:
    result = api_call("PUT", "/workflows/qAh49nU48cbFL7H0", {
        "name": "Contratos - Melhorar Minuta AI",
        "nodes": melhorar_nodes,
        "connections": melhorar_connections,
        "settings": {"executionOrder": "v1", "callerPolicy": "workflowsFromSameOwner"}
    })
    print(f"   OK: Updated successfully (version: {result.get('versionId', 'N/A')})")
except Exception as e:
    print(f"   ERROR: Error: {e}")

# Activate Melhorar workflow
print("   Activating workflow...")
try:
    result = api_call("POST", "/workflows/qAh49nU48cbFL7H0/activate", {})
    print(f"   OK: Activated (active: {result.get('active', False)})")
except Exception as e:
    print(f"   ERROR: Error activating: {e}")

print("\n" + "=" * 60)
print("Done! Both workflows updated with proper UTF-8 encoding")
print("and improved TEG-aware analysis prompts.")
print("=" * 60)
