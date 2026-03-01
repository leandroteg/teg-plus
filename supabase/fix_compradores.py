import psycopg2, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = psycopg2.connect(
    host='db.uzfjfucrinokeuwpbeie.supabase.co', port=5432,
    dbname='postgres', user='postgres', password='Lm120987!Project',
    sslmode='require', connect_timeout=10
)
cur = conn.cursor()

# Colunas reais de sys_usuarios
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sys_usuarios'
    ORDER BY ordinal_position
""")
cols = [r[0] for r in cur.fetchall()]
print('sys_usuarios colunas:', cols)

print()
cur.execute('SELECT id, nome, email FROM sys_usuarios ORDER BY nome')
print('=== sys_usuarios atual ===')
for r in cur.fetchall():
    print('  ' + str(r[0])[:8] + '... | ' + str(r[1]) + ' | ' + str(r[2]))

print()
print('=== Requisitantes importados ===')
cur.execute('SELECT DISTINCT solicitante_nome FROM cmp_requisicoes ORDER BY 1')
for r in cur.fetchall():
    print('  ' + str(r[0]))

# ── Corrige compradores: deleta fictícios, insere reais ──────────────
print()
print('=== Atualizando compradores ===')

# Limpa compradores fictícios do seed
cur.execute('DELETE FROM cmp_compradores')
print('Compradores antigos removidos')

# Insere Aline, Fernando, Lauany (equipe real de compras)
compradores = [
    ('Aline',   'aline@teguniao.com.br'),
    ('Fernando','fernando@teguniao.com.br'),
    ('Lauany',  'lauany@teguniao.com.br'),
]
ids = {}
for nome, email in compradores:
    cur.execute(
        'INSERT INTO cmp_compradores (nome, email) VALUES (%s, %s) RETURNING id',
        (nome, email)
    )
    ids[nome] = cur.fetchone()[0]
    print('  Criado: ' + nome + ' | ' + email)

# Também garante que existem em sys_usuarios
for nome, email in compradores:
    cur.execute(
        'INSERT INTO sys_usuarios (nome, email, cargo, departamento) VALUES (%s, %s, %s, %s) ON CONFLICT (email) DO NOTHING',
        (nome, email, 'Comprador', 'Suprimentos')
    )

conn.commit()

# Distribui requisicoes entre os compradores
cur.execute("SELECT id, solicitante_nome FROM cmp_requisicoes WHERE status = 'comprada'")
reqs = cur.fetchall()
compradores_ids = list(ids.values())
for i, (req_id, _) in enumerate(reqs):
    c_id = compradores_ids[i % len(compradores_ids)]
    cur.execute('UPDATE cmp_requisicoes SET comprador_id=%s WHERE id=%s', (c_id, req_id))

conn.commit()
print()
print('Requisicoes distribuidas entre compradores: ' + str(len(reqs)))

# Verifica resultado
print()
cur.execute("""
    SELECT c.nome, COUNT(r.id) as total
    FROM cmp_compradores c
    LEFT JOIN cmp_requisicoes r ON r.comprador_id = c.id
    GROUP BY c.nome ORDER BY c.nome
""")
print('=== Compradores com requisicoes ===')
for r in cur.fetchall():
    print('  ' + str(r[0]) + ': ' + str(r[1]) + ' RCs')

cur.close()
conn.close()
