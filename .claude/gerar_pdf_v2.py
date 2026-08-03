"""Gera PDF em formato LISTA (não tabela) para melhor parse por LLM."""
import sys, io, os, glob
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether
from reportlab.lib.units import mm
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

IN_DIR = r'C:\Users\elton\Downloads\pedidos_padronizados'

styles = getSampleStyleSheet()
title_st = ParagraphStyle('title', parent=styles['Title'], fontSize=15,
    textColor=colors.HexColor('#1F4E78'), spaceAfter=6, alignment=1)
sub_st = ParagraphStyle('sub', parent=styles['Normal'], fontSize=10,
    textColor=colors.HexColor('#555555'), spaceAfter=2, alignment=1)
meta_st = ParagraphStyle('meta', parent=styles['Normal'], fontSize=10, spaceAfter=2)
item_num_st = ParagraphStyle('inum', parent=styles['Normal'], fontSize=11,
    textColor=colors.HexColor('#1F4E78'), fontName='Helvetica-Bold', spaceBefore=5, spaceAfter=2)
item_st = ParagraphStyle('item', parent=styles['Normal'], fontSize=10, leftIndent=12, spaceAfter=1)

for fp in sorted(glob.glob(os.path.join(IN_DIR, 'PEDIDO_*.xlsx'))):
    df = pd.read_excel(fp, header=None)
    out_pdf = fp.replace('.xlsx', '.pdf')

    # Metadados
    meta = {}
    for i in range(1, 8):
        k, v = df.iloc[i, 0], df.iloc[i, 1]
        if pd.notna(k) and pd.notna(v):
            meta[str(k).strip()] = str(v).strip()

    # Dados
    data = df.iloc[10:].copy()
    data.columns = list(range(data.shape[1]))
    data = data[data[1].notna()]

    doc = SimpleDocTemplate(out_pdf, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=15*mm)

    flow = []
    flow.append(Paragraph(f"REQUISIÇÃO DE COMPRA — TEG UNIÃO", title_st))
    flow.append(Paragraph(meta.get('Categoria', ''), sub_st))
    flow.append(Spacer(1, 4*mm))

    for k, v in meta.items():
        flow.append(Paragraph(f"<b>{k}:</b> {v}", meta_st))
    flow.append(Spacer(1, 4*mm))

    flow.append(Paragraph("<b>ITENS SOLICITADOS:</b>", meta_st))
    flow.append(Spacer(1, 2*mm))

    # Cada item como bloco "ITEM N: descrição. Quantidade: X UN. Marca: Y."
    for _, r in data.iterrows():
        n = '' if pd.isna(r[0]) else str(r[0])
        desc = '' if pd.isna(r[1]) else str(r[1]).strip()
        marca = '' if pd.isna(r[2]) else str(r[2]).strip()
        qtd = '' if pd.isna(r[3]) else str(r[3])
        unid = '' if pd.isna(r[4]) else str(r[4]).strip()
        urg = '' if pd.isna(r[5]) else str(r[5]).strip()
        obs = '' if pd.isna(r[6]) else str(r[6]).strip()

        # Bloco do item — formato natural pra LLM
        partes_marca = f", marca {marca}" if marca else ""
        partes_obs = f", obs: {obs}" if obs else ""

        block = [
            Paragraph(f"Item {n}: {desc}", item_num_st),
            Paragraph(f"Quantidade: <b>{qtd} {unid}</b>{partes_marca}. Urgência: {urg}{partes_obs}", item_st),
        ]
        flow.append(KeepTogether(block))

    doc.build(flow)
    print(f'OK | {os.path.basename(out_pdf)} ({len(data)} itens)')
