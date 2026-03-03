#!/usr/bin/env python3
"""
TEG+ — Cliente n8n API
Permite listar, ativar/desativar workflows e disparar execuções via API.

Uso direto:
    python n8n-docs/n8n_api.py list
    python n8n-docs/n8n_api.py activate <workflow-id>
    python n8n-docs/n8n_api.py deactivate <workflow-id>
    python n8n-docs/n8n_api.py executions <workflow-id>

Uso como módulo:
    from n8n_docs.n8n_api import N8nClient
    client = N8nClient()
    workflows = client.list_workflows()
"""

import os
import sys
import json

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

try:
    import requests
except ImportError:
    print("ERRO: pip install requests")
    sys.exit(1)

N8N_BASE_URL = os.environ.get("N8N_BASE_URL", "https://teg-agents-n8n.nmmcas.easypanel.host")
N8N_API_KEY  = os.environ.get("N8N_API_KEY",  "")


class N8nClient:
    def __init__(self, base_url: str = N8N_BASE_URL, api_key: str = N8N_API_KEY):
        self.base = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "X-N8N-API-KEY": api_key,
            "Accept":        "application/json",
            "Content-Type":  "application/json",
        })

    def _get(self, path: str, **params) -> dict:
        r = self.session.get(f"{self.base}/api/v1{path}", params=params, timeout=15)
        r.raise_for_status()
        return r.json()

    def _patch(self, path: str, body: dict) -> dict:
        r = self.session.patch(f"{self.base}/api/v1{path}", json=body, timeout=15)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: dict = None) -> dict:
        r = self.session.post(f"{self.base}/api/v1{path}", json=body or {}, timeout=30)
        r.raise_for_status()
        return r.json()

    # ── Workflows ──────────────────────────────────────────────
    def list_workflows(self, active_only: bool = False) -> list:
        """Retorna todos os workflows (ou apenas ativos)."""
        data = self._get("/workflows")
        workflows = data.get("data", data) if isinstance(data, dict) else data
        if active_only:
            workflows = [w for w in workflows if w.get("active")]
        return workflows

    def get_workflow(self, workflow_id: str) -> dict:
        """Detalhes de um workflow específico."""
        return self._get(f"/workflows/{workflow_id}")

    def activate_workflow(self, workflow_id: str) -> dict:
        """Ativa um workflow."""
        return self._patch(f"/workflows/{workflow_id}/activate", {})

    def deactivate_workflow(self, workflow_id: str) -> dict:
        """Desativa um workflow."""
        return self._patch(f"/workflows/{workflow_id}/deactivate", {})

    # ── Execuções ──────────────────────────────────────────────
    def list_executions(self, workflow_id: str = None, limit: int = 10) -> list:
        """Lista execuções recentes (opcionalmente filtra por workflow)."""
        params = {"limit": limit}
        if workflow_id:
            params["workflowId"] = workflow_id
        data = self._get("/executions", **params)
        return data.get("data", data) if isinstance(data, dict) else data

    def get_execution(self, execution_id: str) -> dict:
        """Detalhes de uma execução específica."""
        return self._get(f"/executions/{execution_id}")

    # ── Credenciais ────────────────────────────────────────────
    def list_credentials(self) -> list:
        """Lista credenciais configuradas no n8n."""
        data = self._get("/credentials")
        return data.get("data", data) if isinstance(data, dict) else data

    # ── Health ─────────────────────────────────────────────────
    def health(self) -> bool:
        """Verifica se o n8n está online."""
        try:
            r = self.session.get(f"{self.base}/healthz", timeout=10)
            return r.status_code == 200
        except Exception:
            return False


# ──────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────
def _print_json(obj):
    print(json.dumps(obj, indent=2, ensure_ascii=False, default=str))


def main():
    args = sys.argv[1:]
    client = N8nClient()

    if not args or args[0] == "list":
        workflows = client.list_workflows()
        print(f"\n{'─'*60}")
        print(f"  n8n Workflows  ({len(workflows)} encontrados)")
        print(f"{'─'*60}")
        for wf in workflows:
            status = "🟢 ativo  " if wf.get("active") else "⚪ inativo"
            print(f"  {status}  [{wf['id']}]  {wf['name']}")
        print()

    elif args[0] == "activate" and len(args) > 1:
        result = client.activate_workflow(args[1])
        print(f"Workflow {args[1]} ativado.")
        _print_json(result)

    elif args[0] == "deactivate" and len(args) > 1:
        result = client.deactivate_workflow(args[1])
        print(f"Workflow {args[1]} desativado.")
        _print_json(result)

    elif args[0] == "executions":
        wf_id = args[1] if len(args) > 1 else None
        execs = client.list_executions(workflow_id=wf_id, limit=10)
        print(f"\n  Últimas {len(execs)} execuções:")
        for ex in execs:
            status = ex.get("status", "?")
            wf     = ex.get("workflowData", {}).get("name", ex.get("workflowId", "?"))
            start  = ex.get("startedAt", "?")
            print(f"  [{ex['id']}]  {status:12}  {wf}  {start}")
        print()

    elif args[0] == "credentials":
        creds = client.list_credentials()
        print(f"\n  Credenciais ({len(creds)}):")
        for c in creds:
            print(f"  [{c['id']}]  {c.get('type','?'):20}  {c.get('name','?')}")
        print()

    elif args[0] == "health":
        online = client.health()
        print("  n8n: ONLINE ✓" if online else "  n8n: OFFLINE ✗")

    else:
        print("""
Uso:
  python n8n-docs/n8n_api.py list                     # lista workflows
  python n8n-docs/n8n_api.py activate   <id>          # ativa workflow
  python n8n-docs/n8n_api.py deactivate <id>          # desativa workflow
  python n8n-docs/n8n_api.py executions [<id>]        # últimas execuções
  python n8n-docs/n8n_api.py credentials              # lista credenciais
  python n8n-docs/n8n_api.py health                   # verifica se online
""")


if __name__ == "__main__":
    main()
