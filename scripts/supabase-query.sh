#!/usr/bin/env bash
# =============================================================
# TEG+ - Helper para consultas rápidas ao Supabase
# =============================================================
# Uso:
#   bash scripts/supabase-query.sh tables              # lista tabelas
#   bash scripts/supabase-query.sh select <tabela>     # SELECT * LIMIT 10
#   bash scripts/supabase-query.sh count <tabela>      # COUNT de registros
#   bash scripts/supabase-query.sh sql "<query>"       # SQL via RPC
# =============================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${SUPABASE_URL:?Defina SUPABASE_URL no .env}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Defina SUPABASE_SERVICE_ROLE_KEY no .env}"

CMD="${1:-help}"
ARG="${2:-}"

HEADERS=(
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  -H "Content-Type: application/json"
)

pretty() {
  python3 -m json.tool 2>/dev/null || cat
}

case "$CMD" in
  tables)
    echo "=== Tabelas públicas no Supabase ==="
    curl -s "${HEADERS[@]}" \
      "$SUPABASE_URL/rest/v1/?" | pretty
    # Alternativa via RPC
    curl -s "${HEADERS[@]}" \
      "$SUPABASE_URL/rest/v1/rpc/get_schema_info" \
      -d '{}' 2>/dev/null | pretty || true

    echo ""
    echo "(Listando via REST - principais tabelas conhecidas:)"
    for TABLE in sys_obras sys_perfis req_requisicoes req_itens req_aprovacoes cot_cotacoes fin_contas_pagar est_produtos; do
      CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEADERS[@]}" \
        "$SUPABASE_URL/rest/v1/$TABLE?select=count&limit=0")
      if [ "$CODE" == "200" ]; then
        COUNT=$(curl -s "${HEADERS[@]}" \
          -H "Prefer: count=exact" \
          "$SUPABASE_URL/rest/v1/$TABLE?select=*&limit=0" \
          -I 2>/dev/null | grep -i "content-range" | grep -oP '\d+$' || echo "?")
        echo "  ✔ $TABLE  ($COUNT registros)"
      else
        echo "  ✘ $TABLE  (HTTP $CODE)"
      fi
    done
    ;;

  select)
    [ -z "$ARG" ] && { echo "Uso: $0 select <tabela> [limit=10]"; exit 1; }
    LIMIT="${3:-10}"
    echo "=== SELECT * FROM $ARG LIMIT $LIMIT ==="
    curl -s "${HEADERS[@]}" \
      "$SUPABASE_URL/rest/v1/$ARG?select=*&limit=$LIMIT" | pretty
    ;;

  count)
    [ -z "$ARG" ] && { echo "Uso: $0 count <tabela>"; exit 1; }
    echo "=== COUNT $ARG ==="
    curl -s "${HEADERS[@]}" \
      -H "Prefer: count=exact" \
      "$SUPABASE_URL/rest/v1/$ARG?select=*&limit=0" \
      -I | grep -i "content-range"
    ;;

  rpc)
    [ -z "$ARG" ] && { echo "Uso: $0 rpc <nome_funcao> [json_payload]"; exit 1; }
    PAYLOAD="${3:-{}}"
    echo "=== RPC: $ARG ==="
    curl -s "${HEADERS[@]}" \
      "$SUPABASE_URL/rest/v1/rpc/$ARG" \
      -d "$PAYLOAD" | pretty
    ;;

  help|*)
    echo ""
    echo "TEG+ Supabase Query Helper"
    echo ""
    echo "Comandos disponíveis:"
    echo "  tables               - Lista tabelas e contagem de registros"
    echo "  select <tabela>      - SELECT das primeiras 10 linhas"
    echo "  count <tabela>       - Conta registros da tabela"
    echo "  rpc <func> [json]    - Chama uma RPC function"
    echo ""
    echo "Exemplos:"
    echo "  bash scripts/supabase-query.sh tables"
    echo "  bash scripts/supabase-query.sh select obras"
    echo "  bash scripts/supabase-query.sh rpc get_dashboard_compras"
    echo ""
    ;;
esac
