import psycopg2, os

sql_path = os.path.expanduser('~/teg-plus/supabase/009_admin_rls_fix.sql')

conn = psycopg2.connect(
    host='db.uzfjfucrinokeuwpbeie.supabase.co', port=5432,
    dbname='postgres', user='postgres', password='Lm120987!Project',
    sslmode='require', connect_timeout=15
)
conn.autocommit = True
cur = conn.cursor()

with open(sql_path, 'r', encoding='utf-8') as f:
    sql = f.read()

try:
    cur.execute(sql)
    print('SQL migration 009 executed successfully')
except Exception as e:
    print('ERROR:', str(e)[:500])

# Verify: list active policies on sys_perfis
try:
    cur.execute("""
        SELECT policyname, cmd, permissive
        FROM pg_policies
        WHERE tablename = 'sys_perfis'
        ORDER BY cmd, policyname
    """)
    rows = cur.fetchall()
    print(f'\nPolicies ativas em sys_perfis ({len(rows)} total):')
    for row in rows:
        print(f'  [{row[1]:8s}] {row[0]} (permissive={row[2]})')
except Exception as e:
    print('Verify ERROR:', str(e)[:300])

# Verify: check is_admin function exists
try:
    cur.execute("SELECT proname, prosecdef FROM pg_proc WHERE proname = 'is_admin'")
    fn = cur.fetchone()
    if fn:
        print(f'\nFuncao is_admin: existe (security_definer={fn[1]})')
    else:
        print('\nFuncao is_admin: NAO encontrada')
except Exception as e:
    print('Function check ERROR:', str(e)[:300])

cur.close()
conn.close()
