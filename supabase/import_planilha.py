import psycopg2, urllib.request, ssl, csv, io, sys, re
from datetime import datetime, date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── Baixa a planilha ────────────────────────────────────────────────
ctx = ssl.create_default_context()
url = ('https://docs.google.com/spreadsheets/d/'
       '1WVDEVdimE7glJcaEBreb1eSuGQCDm3Zr/export?format=csv&gid=1527762839')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    content = r.read().decode('utf-8', errors='replace')
rows = list(csv.reader(content.splitlines()))

# ── Filtra linhas com dados reais (a partir da linha 4) ─────────────
data_rows = [r for r in rows[4:] if len(r) >= 6 and (r[0].strip() or r[5].strip())]
print(f'Linhas para importar: {len(data_rows)}')

# ── Helpers ─────────────────────────────────────────────────────────
def parse_valor(s):
    if not s:
        return None
    s = re.sub(r'[R$\s]', '', s).replace('.', '').replace(',', '.')
    try:
        return float(s)
    except Exception:
        return None


def parse_data(s):
    s = s.strip()
    if not s:
        return None
    for fmt in ('%d/%m/%Y', '%d/%m/%y', '%d/%m'):
        try:
            d = datetime.strptime(s, fmt)
            if fmt == '%d/%m':
                d = d.replace(year=2026)
            return d.date()
        except Exception:
            pass
    return None


def map_status(s):
    s = s.strip().upper()
    if s == 'CONCLUIDO':
        return 'comprada'
    if s == 'EM ANDAMENTO':
        return 'em_cotacao'
    if s == 'RECUSADA':
        return 'rejeitada'
    if s == 'CANCELADA':
        return 'cancelada'
    return 'pendente'


# ── Mapeamento POLO -> obra ──────────────────────────────────────────
polo_map = {
    'ALMOXARIFADO TRES MARIAS - FILIAL 2':              ('TRESMARIAS', 'SE Tres Marias'),
    'ALMOXARIFADO RIO PARANAIBA MG - FILIAL 2':         ('RIOPAR',     'SE Rio Paranaiba'),
    'LD RIO PARANAIBA 2 - SAO GOTARDO 1 - 138 (31593)': ('RIOPAR',     'SE Rio Paranaiba'),
    'ITUITABA':                                          ('ITUIUTABA',  'SE Ituiutaba'),
    'PERDIZES MG':                                       ('PERDIZES',   'SE Perdizes'),
    'CENTRO DE DISTRIBUICAO':                            ('CD',         'Centro de Distribuicao'),
    'CENTRO DE DISTRIBUIÇÃO':                            ('CD',         'Centro de Distribuicao'),
}

# ── Conecta ao banco ─────────────────────────────────────────────────
conn = psycopg2.connect(
    host='db.uzfjfucrinokeuwpbeie.supabase.co', port=5432,
    dbname='postgres', user='postgres', password='Lm120987!Project',
    sslmode='require', connect_timeout=10
)
cur = conn.cursor()

# ── Carrega obras e cria CD se faltar ────────────────────────────────
cur.execute('SELECT id, codigo FROM sys_obras')
obras_db = {r[1]: r[0] for r in cur.fetchall()}

if 'CD' not in obras_db:
    cur.execute(
        "INSERT INTO sys_obras (nome, codigo, status) VALUES ('Centro de Distribuicao', 'CD', 'ativa') RETURNING id"
    )
    obras_db['CD'] = cur.fetchone()[0]
    print('Obra criada: Centro de Distribuicao (CD)')
conn.commit()

# ── Importa cada linha ───────────────────────────────────────────────
def col(row, i):
    return row[i].strip() if len(row) > i else ''


importados = 0
cotacoes_criadas = 0
seq = 900

for row in data_rows:
    requisitante = col(row, 0)
    data_req     = col(row, 2)
    totvs        = col(row, 3)
    polo         = col(row, 4)
    descricao    = col(row, 5)
    data_nec     = col(row, 6)
    status_raw   = col(row, 7)
    data_concl   = col(row, 9)
    fornecedor   = col(row, 10)
    valor_ini    = col(row, 11)
    valor_neg    = col(row, 12)
    aprovacao    = col(row, 13)
    data_aprov   = col(row, 14)
    forma_pgto   = col(row, 15)
    obs          = col(row, 16)

    if not descricao and not requisitante:
        continue

    # Resolve obra
    polo_upper = polo.upper()
    obra_info = polo_map.get(polo, polo_map.get(polo_upper))
    if not obra_info:
        for k, v in polo_map.items():
            if k in polo_upper or polo_upper in k:
                obra_info = v
                break
    if not obra_info:
        obra_info = ('TRESMARIAS', 'SE Tres Marias')

    obra_cod, obra_nome = obra_info
    obra_id = obras_db.get(obra_cod)

    # Numero da requisicao
    totvs_clean = totvs.upper().strip()
    if totvs_clean and totvs_clean not in ('NAO', 'NÃO', 'NAO TEM ACESSO'):
        numero = 'RC-' + totvs_clean.zfill(4)
    else:
        seq += 1
        numero = 'RC-IMP-' + str(seq)

    status = map_status(status_raw)
    valor  = parse_valor(valor_ini) or parse_valor(valor_neg) or 0.0

    # Justificativa consolida campos extras
    justificativa_parts = []
    if obs:
        justificativa_parts.append('Obs: ' + obs)
    if forma_pgto:
        justificativa_parts.append('Pagamento: ' + forma_pgto)
    if aprovacao:
        justificativa_parts.append('Aprovacao: ' + aprovacao.strip())
    justificativa = ' | '.join(justificativa_parts) if justificativa_parts else None

    d_req   = parse_data(data_req) or date(2026, 2, 1)
    d_nec   = parse_data(data_nec)
    d_concl = parse_data(data_concl)
    d_aprov = parse_data(data_aprov)

    try:
        cur.execute("""
            INSERT INTO cmp_requisicoes
              (numero, obra_id, obra_nome, solicitante_nome, descricao,
               justificativa, valor_estimado, status, urgencia, alcada_nivel,
               data_necessidade, data_aprovacao, data_conclusao, created_at)
            VALUES
              (%s, %s, %s, %s, %s,
               %s, %s, %s, 'normal', 1,
               %s, %s, %s, %s)
            ON CONFLICT (numero) DO NOTHING
            RETURNING id
        """, (
            numero, obra_id, obra_nome,
            requisitante if requisitante else 'Importado',
            descricao or '(sem descricao)',
            justificativa,
            valor,
            status,
            d_nec,
            d_aprov,
            d_concl,
            d_req,
        ))
        result = cur.fetchone()
        if not result:
            print('  SKIP (duplicado): ' + numero)
            continue

        req_id = result[0]
        importados += 1
        print('  OK: ' + numero + ' | ' + obra_nome + ' | ' + status)

        # Cotacao + fornecedor para registros com fornecedor preenchido
        if fornecedor and status in ('comprada', 'em_cotacao'):
            v_forn = parse_valor(valor_neg) or parse_valor(valor_ini)
            # cmp_cotacoes nao tem numero — usa apenas requisicao_id, status, observacao
            cur.execute("""
                INSERT INTO cmp_cotacoes
                  (requisicao_id, status, observacao,
                   fornecedor_selecionado_nome, valor_selecionado, data_conclusao)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (req_id,
                  'concluida' if status == 'comprada' else 'em_andamento',
                  forma_pgto or None,
                  fornecedor if status == 'comprada' else None,
                  v_forn if status == 'comprada' else None,
                  d_concl))
            cot_row = cur.fetchone()
            if cot_row:
                cot_id = cot_row[0]
                cur.execute("""
                    INSERT INTO cmp_cotacao_fornecedores
                      (cotacao_id, fornecedor_nome, valor_total,
                       condicao_pagamento, selecionado)
                    VALUES (%s, %s, %s, %s, %s)
                """, (cot_id, fornecedor, v_forn, forma_pgto or None, True))
                cotacoes_criadas += 1

        conn.commit()

    except Exception as e:
        conn.rollback()
        print('  ERRO em ' + numero + ': ' + str(e)[:120])

print()
print('=== RESULTADO ===')
print('Requisicoes importadas : ' + str(importados))
print('Cotacoes criadas       : ' + str(cotacoes_criadas))
print()

cur.execute('SELECT status, COUNT(*) FROM cmp_requisicoes GROUP BY status ORDER BY COUNT(*) DESC')
print('Distribuicao por status:')
for r in cur.fetchall():
    print('  ' + r[0] + ': ' + str(r[1]))

cur.close()
conn.close()
