import psycopg2, os

sql_path = os.path.expanduser('~/teg-plus/supabase/008_fixes_escalabilidade.sql')

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
    print('SQL migration 008 executed successfully')
except Exception as e:
    print('ERROR:', str(e)[:500])

# Verify RPC
cur.execute("SELECT get_dashboard_compras('mes', NULL)")
result = cur.fetchone()[0]
ps = result.get('por_status')
po = result.get('por_obra')
rc = result.get('recentes')
print('por_status type/len:', type(ps).__name__, '/', len(ps) if ps else 0)
print('por_obra type/len:', type(po).__name__, '/', len(po) if po else 0)
print('recentes count:', len(rc) if rc else 0)
print('kpis:', result.get('kpis'))

cur.close()
conn.close()
