# n8n Workflows — TEG+

## Setup: Variável de Ambiente GEMINI_API_KEY

Todos os workflows que usam Gemini referenciam `$env.GEMINI_API_KEY`.
Configure no EasyPanel antes de importar:

1. Acesse EasyPanel → teg-agents-n8n → Settings → Environment
2. Adicione: `GEMINI_API_KEY=<sua-key>`
3. Reinicie o container

## Workflows

### EGP Gerar TAP (`egp-gerar-tap.json`)
- **Webhook**: `POST /egp/gerar-tap`
- **Payload**: `{ portfolio_id, obra_nome, numero_osc?, resumo_osc?, tipo_osc?, contrato_texto? }`
- **Retorna**: JSON com campos da TAP preenchidos via Gemini
- **Modelo**: gemini-2.0-flash

### Importar no n8n
1. Acesse https://teg-agents-n8n.nmmcas.easypanel.host
2. Menu → Import from File → selecione o JSON
3. Ative o workflow
4. Teste com: `curl -X POST .../webhook/egp/gerar-tap -H "Content-Type: application/json" -d '{"obra_nome":"Teste","portfolio_id":"xxx"}'`

## Atualizar Gemini Key nos workflows existentes

Se precisar trocar a key, basta alterar a variável de ambiente `GEMINI_API_KEY` no EasyPanel e reiniciar.
Workflows que usam Gemini via HTTP Request com `$env.GEMINI_API_KEY` serão atualizados automaticamente.

**Workflows que precisam ser atualizados manualmente** (usam key hardcoded no node):
- AI Parse Cotação (P5xDZQJ2Hh6mVXO0) — trocar a URL do Gemini para usar `$env.GEMINI_API_KEY`
