#!/usr/bin/env bash
# =============================================================
# TEG+ - Testa conexões com Supabase e n8n
# Uso: bash scripts/test-connections.sh
# =============================================================

set -euo pipefail

# Carrega .env se existir
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✔ $1${NC}"; }
fail() { echo -e "${RED}  ✘ $1${NC}"; }
info() { echo -e "${YELLOW}  → $1${NC}"; }

echo ""
echo "============================================"
echo "   TEG+ - Verificação de Conexões"
echo "============================================"
echo ""

# ---- 1. SUPABASE REST API -------------------------------------------
echo "[ SUPABASE REST ]"
info "Testando: $SUPABASE_URL"

HTTP_CODE=$(curl -s -o /tmp/supa_response.json -w "%{http_code}" \
  "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "404" ]; then
  ok "REST API acessível (HTTP $HTTP_CODE)"
else
  fail "REST API retornou HTTP $HTTP_CODE"
  cat /tmp/supa_response.json 2>/dev/null || true
fi

# ---- 2. SUPABASE - listar tabelas via REST ---------------------------
echo ""
echo "[ SUPABASE - Tabelas ]"
TABLES_CODE=$(curl -s -o /tmp/supa_tables.json -w "%{http_code}" \
  "$SUPABASE_URL/rest/v1/sys_obras?select=id&limit=3" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

if [ "$TABLES_CODE" == "200" ]; then
  ok "Tabela 'sys_obras' acessível via REST"
  COUNT=$(python3 -c "import json; d=json.load(open('/tmp/supa_tables.json')); print(len(d))" 2>/dev/null || echo "?")
  info "$COUNT registro(s) retornado(s)"
else
  fail "Tabela 'sys_obras' retornou HTTP $TABLES_CODE"
  cat /tmp/supa_tables.json 2>/dev/null || true
fi

# ---- 3. SUPABASE PostgreSQL direto ----------------------------------
echo ""
echo "[ POSTGRESQL DIRETO ]"
if command -v psql &>/dev/null; then
  info "Testando conexão PostgreSQL..."
  if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
       -c "SELECT 'OK' AS status;" -t --no-password 2>/dev/null | grep -q "OK"; then
    ok "PostgreSQL conectado com sucesso"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      -c "SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" \
      --no-password 2>/dev/null || true
  else
    fail "Falha na conexão PostgreSQL"
  fi
else
  info "psql não instalado - pulando teste direto de banco"
  info "Instale com: apt-get install postgresql-client"
fi

# ---- 4. N8N API -----------------------------------------------------
echo ""
echo "[ N8N API ]"
info "Testando: $N8N_API_URL"

N8N_CODE=$(curl -s -o /tmp/n8n_response.json -w "%{http_code}" \
  "$N8N_API_URL/workflows?limit=5" \
  -H "X-N8N-API-KEY: $N8N_API_KEY")

if [ "$N8N_CODE" == "200" ]; then
  ok "n8n API acessível"
  WORKFLOWS=$(python3 -c "import json,sys; d=json.load(open('/tmp/n8n_response.json')); [print('  -',w['name'],'[',w['active'] and 'ATIVO' or 'inativo',']') for w in d.get('data',[])]" 2>/dev/null || true)
  echo "$WORKFLOWS"
elif [ "$N8N_CODE" == "401" ]; then
  fail "n8n retornou 401 - API Key inválida ou expirada"
else
  fail "n8n retornou HTTP $N8N_CODE"
  cat /tmp/n8n_response.json 2>/dev/null || true
fi

# ---- 5. N8N Webhook (ping) -------------------------------------------
echo ""
echo "[ N8N WEBHOOK BASE ]"
WH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 \
  "$N8N_WEBHOOK_URL/compras/status" 2>/dev/null || echo "000")

if [ "$WH_CODE" == "200" ] || [ "$WH_CODE" == "404" ] || [ "$WH_CODE" == "405" ]; then
  ok "Endpoint webhook acessível (HTTP $WH_CODE)"
else
  info "Webhook retornou HTTP $WH_CODE (pode ser normal se rota não existe)"
fi

echo ""
echo "============================================"
echo "   Concluído"
echo "============================================"
echo ""
