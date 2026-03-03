#!/usr/bin/env python3
"""
TEG+ - Teste de Conectividade
Verifica acesso ao Supabase (REST API + PostgreSQL) e n8n API.

Uso:
    python supabase/test_connections.py

Requer:
    pip install requests python-dotenv
    pip install psycopg2-binary  # opcional, para teste direto ao PostgreSQL
"""

import os
import sys
import json

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass  # sem python-dotenv, usa variáveis de ambiente do sistema

try:
    import requests
except ImportError:
    print("ERRO: instale requests  →  pip install requests")
    sys.exit(1)

# ──────────────────────────────────────────────
# Configuração
# ──────────────────────────────────────────────
SUPABASE_URL     = os.environ.get("SUPABASE_URL",        "https://uzfjfucrinokeuwpbeie.supabase.co")
SUPABASE_SERVICE = os.environ.get("SUPABASE_SERVICE_KEY", "")
N8N_BASE_URL     = os.environ.get("N8N_BASE_URL",         "https://teg-agents-n8n.nmmcas.easypanel.host")
N8N_API_KEY      = os.environ.get("N8N_API_KEY",          "")
DATABASE_URL     = os.environ.get("DATABASE_URL",          "")


def ok(msg):  print(f"  ✓  {msg}")
def err(msg): print(f"  ✗  {msg}")
def hdr(msg): print(f"\n{'─'*50}\n  {msg}\n{'─'*50}")


# ──────────────────────────────────────────────
# 1. Supabase REST API
# ──────────────────────────────────────────────
def test_supabase_rest():
    hdr("1/3  Supabase REST API")
    headers = {
        "apikey":        SUPABASE_SERVICE,
        "Authorization": f"Bearer {SUPABASE_SERVICE}",
        "Content-Type":  "application/json",
    }

    # Ping básico
    url = f"{SUPABASE_URL}/rest/v1/"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code in (200, 400):  # 400 é esperado sem query params
            ok(f"REST API acessível  (status {r.status_code})")
        else:
            err(f"Status inesperado: {r.status_code} — {r.text[:120]}")
            return False
    except Exception as e:
        err(f"Falha ao conectar: {e}")
        return False

    # Lista tabelas via information_schema
    url2 = (
        f"{SUPABASE_URL}/rest/v1/rpc/get_dashboard_compras"
    )
    try:
        r2 = requests.post(url2, headers=headers, json={}, timeout=15)
        if r2.status_code == 200:
            ok("RPC get_dashboard_compras  → OK")
        elif r2.status_code == 404:
            err("RPC get_dashboard_compras não encontrada (migration não aplicada?)")
        else:
            err(f"RPC status {r2.status_code}: {r2.text[:120]}")
    except Exception as e:
        err(f"Falha RPC: {e}")

    # Testa tabelas principais (nome real detectado: cmp_requisicoes)
    for tabela in ("cmp_requisicoes", "cmp_aprovacoes", "obras"):
        url3 = f"{SUPABASE_URL}/rest/v1/{tabela}?limit=1"
        try:
            r3 = requests.get(url3, headers=headers, timeout=10)
            if r3.status_code == 200:
                data = r3.json()
                ok(f"Tabela {tabela}  → {len(data)} registro(s)")
            else:
                err(f"Tabela {tabela} status {r3.status_code}: {r3.text[:80]}")
        except Exception as e:
            err(f"Falha ao ler {tabela}: {e}")

    return True


# ──────────────────────────────────────────────
# 2. PostgreSQL Direto
# ──────────────────────────────────────────────
def test_postgres():
    hdr("2/3  PostgreSQL Direto")
    if not DATABASE_URL:
        err("DATABASE_URL não definida — pulando teste")
        return

    try:
        import psycopg2
    except ImportError:
        print("  ⚠  psycopg2 não instalado — pulando teste direto ao PG")
        print("     Para instalar: pip install psycopg2-binary")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        cur  = conn.cursor()
        cur.execute("SELECT current_database(), current_user, version()")
        row = cur.fetchone()
        ok(f"Conectado!  DB={row[0]}  user={row[1]}")
        ok(f"Versão: {row[2][:60]}")

        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        tables = [r[0] for r in cur.fetchall()]
        ok(f"Tabelas públicas ({len(tables)}): {', '.join(tables[:10])}")

        cur.close()
        conn.close()
    except Exception as e:
        err(f"Falha ao conectar ao PostgreSQL: {e}")


# ──────────────────────────────────────────────
# 3. n8n API
# ──────────────────────────────────────────────
def test_n8n():
    hdr("3/3  n8n API")
    if not N8N_API_KEY:
        err("N8N_API_KEY não definida — pulando teste")
        return

    headers = {
        "X-N8N-API-KEY": N8N_API_KEY,
        "Accept":        "application/json",
    }

    # Health check
    try:
        r = requests.get(f"{N8N_BASE_URL}/healthz", timeout=10)
        if r.status_code == 200:
            ok(f"n8n online  → {r.text[:60]}")
        else:
            err(f"Health status {r.status_code}")
    except Exception as e:
        err(f"n8n inacessível: {e}")
        return

    # Lista workflows via API
    try:
        r2 = requests.get(
            f"{N8N_BASE_URL}/api/v1/workflows",
            headers=headers,
            timeout=15,
        )
        if r2.status_code == 200:
            data = r2.json()
            workflows = data.get("data", data) if isinstance(data, dict) else data
            ok(f"Workflows encontrados: {len(workflows)}")
            for wf in workflows[:5]:
                name   = wf.get("name", "?")
                active = "ativo" if wf.get("active") else "inativo"
                print(f"       • {name}  [{active}]")
        elif r2.status_code == 401:
            err("API Key inválida ou expirada (401)")
        else:
            err(f"API status {r2.status_code}: {r2.text[:120]}")
    except Exception as e:
        err(f"Falha ao listar workflows: {e}")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "═"*50)
    print("  TEG+ — Teste de Conectividade")
    print("═"*50)

    test_supabase_rest()
    test_postgres()
    test_n8n()

    print(f"\n{'═'*50}\n  Concluído.\n{'═'*50}\n")
