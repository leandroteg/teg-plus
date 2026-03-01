import psycopg2, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

conn = psycopg2.connect(
    host='db.uzfjfucrinokeuwpbeie.supabase.co', port=5432,
    dbname='postgres', user='postgres', password='Lm120987!Project',
    sslmode='require', connect_timeout=10
)
cur = conn.cursor()

# Cotacao do EVOLUA (RC-IMP-911)
cur.execute('SELECT id FROM cmp_requisicoes WHERE numero=%s', ('RC-IMP-911',))
req = cur.fetchone()
if req:
    cur.execute('SELECT id FROM cmp_cotacoes WHERE requisicao_id=%s', (req[0],))
    cot = cur.fetchone()
    if not cot:
        cur.execute(
            'INSERT INTO cmp_cotacoes (requisicao_id, status, fornecedor_selecionado_nome, valor_selecionado) VALUES (%s, %s, %s, %s) RETURNING id',
            (req[0], 'concluida', 'EVOLUA', 0.0)
        )
        cot_id = cur.fetchone()[0]
        cur.execute(
            'INSERT INTO cmp_cotacao_fornecedores (cotacao_id, fornecedor_nome, valor_total, selecionado) VALUES (%s, %s, %s, %s)',
            (cot_id, 'EVOLUA', 0.0, True)
        )
        print('Cotacao EVOLUA criada')
    else:
        print('Cotacao EVOLUA ja existe: ' + str(cot[0]))

conn.commit()

print()
cur.execute('SELECT COUNT(*) FROM cmp_requisicoes')
print('Total requisicoes: ' + str(cur.fetchone()[0]))
cur.execute('SELECT COUNT(*) FROM cmp_cotacoes')
print('Total cotacoes: ' + str(cur.fetchone()[0]))
cur.execute('SELECT COUNT(*) FROM cmp_cotacao_fornecedores')
print('Total fornecedores: ' + str(cur.fetchone()[0]))
cur.execute('SELECT COUNT(*) FROM sys_obras')
print('Total obras: ' + str(cur.fetchone()[0]))

print()
cur.execute(
    'SELECT obra_nome, status, COUNT(*) as total, SUM(valor_estimado) as valor '
    'FROM cmp_requisicoes GROUP BY obra_nome, status ORDER BY obra_nome, status'
)
print('Por obra e status:')
for r in cur.fetchall():
    print('  ' + str(r[0]) + ' | ' + str(r[1]) + ': ' + str(r[2]) + ' RCs | R$ ' + str(r[3] or 0))

cur.close()
conn.close()
