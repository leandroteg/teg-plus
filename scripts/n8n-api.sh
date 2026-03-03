#!/usr/bin/env bash
# =============================================================
# TEG+ - Helper CLI para a API do n8n
# =============================================================
# Uso:
#   bash scripts/n8n-api.sh workflows          # lista todos os workflows
#   bash scripts/n8n-api.sh workflow <id>       # detalha um workflow
#   bash scripts/n8n-api.sh executions <id>     # execuções de um workflow
#   bash scripts/n8n-api.sh activate <id>       # ativa um workflow
#   bash scripts/n8n-api.sh deactivate <id>     # desativa um workflow
#   bash scripts/n8n-api.sh credentials         # lista credenciais
# =============================================================

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${N8N_API_URL:?Defina N8N_API_URL no .env}"
: "${N8N_API_KEY:?Defina N8N_API_KEY no .env}"

CMD="${1:-help}"
ARG="${2:-}"

n8n_get() {
  curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_API_URL/$1"
}

n8n_patch() {
  curl -s -X PATCH -H "X-N8N-API-KEY: $N8N_API_KEY" \
       -H "Content-Type: application/json" \
       -d "$2" "$N8N_API_URL/$1"
}

pretty() {
  python3 -m json.tool 2>/dev/null || cat
}

case "$CMD" in
  workflows)
    echo "=== Workflows n8n ==="
    n8n_get "workflows?limit=50" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for w in d.get('data',[]):
    status = '🟢 ATIVO  ' if w.get('active') else '⚪ inativo'
    print(f\"  {status}  {w['id']:36s}  {w['name']}\")
print(f\"\\nTotal: {len(d.get('data',[]))}\")
" 2>/dev/null || n8n_get "workflows?limit=50" | pretty
    ;;

  workflow)
    [ -z "$ARG" ] && { echo "Uso: $0 workflow <id>"; exit 1; }
    echo "=== Workflow: $ARG ==="
    n8n_get "workflows/$ARG" | pretty
    ;;

  executions)
    [ -z "$ARG" ] && { echo "Uso: $0 executions <workflow_id>"; exit 1; }
    echo "=== Execuções do workflow $ARG ==="
    n8n_get "executions?workflowId=$ARG&limit=10" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('data',[]):
    status = e.get('status','?')
    started = e.get('startedAt','?')[:19]
    print(f\"  {e['id']:6}  {status:10}  {started}\")
" 2>/dev/null || n8n_get "executions?workflowId=$ARG&limit=10" | pretty
    ;;

  activate)
    [ -z "$ARG" ] && { echo "Uso: $0 activate <id>"; exit 1; }
    echo "Ativando workflow $ARG..."
    n8n_patch "workflows/$ARG/activate" '{}' | pretty
    ;;

  deactivate)
    [ -z "$ARG" ] && { echo "Uso: $0 deactivate <id>"; exit 1; }
    echo "Desativando workflow $ARG..."
    n8n_patch "workflows/$ARG/deactivate" '{}' | pretty
    ;;

  credentials)
    echo "=== Credenciais n8n ==="
    n8n_get "credentials?limit=50" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for c in d.get('data',[]):
    print(f\"  {c['id']:36s}  {c['type']:30s}  {c['name']}\")
" 2>/dev/null || n8n_get "credentials?limit=50" | pretty
    ;;

  help|*)
    echo ""
    echo "TEG+ n8n API Helper"
    echo ""
    echo "Comandos disponíveis:"
    echo "  workflows            - Lista todos os workflows"
    echo "  workflow <id>        - Detalha um workflow"
    echo "  executions <id>      - Execuções recentes de um workflow"
    echo "  activate <id>        - Ativa um workflow"
    echo "  deactivate <id>      - Desativa um workflow"
    echo "  credentials          - Lista credenciais cadastradas"
    echo ""
    echo "Exemplo:"
    echo "  bash scripts/n8n-api.sh workflows"
    echo ""
    ;;
esac
