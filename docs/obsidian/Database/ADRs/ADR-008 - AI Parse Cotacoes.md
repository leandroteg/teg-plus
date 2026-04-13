---
tipo: adr
id: ADR-008
titulo: "Upload inteligente de cotações com AI"
status: aceito
data: 2026-03-20
autor: Time DEV
tags: [adr, ai, cotacoes, upload, parse, openai]
---

# ADR-008 — Upload Inteligente de Cotações com AI

## Status
✅ Aceito

## Contexto
Compradores recebem cotações em PDF/imagem de fornecedores. Digitar manualmente cada item, quantidade e valor era lento e propenso a erro.

## Decisão
Usar GPT-4 Vision (via n8n) para extrair automaticamente itens, quantidades e valores de PDFs/imagens de cotações. O comprador valida e ajusta antes de salvar.

## Alternativas Consideradas
1. **OCR tradicional (Tesseract)** — Baixa precisão em tabelas complexas
2. **Template fixo de planilha** — Fornecedores não seguiriam padrão
3. **Entrada manual apenas** — Status quo, lento e com erros

## Consequências
### Positivas
- Cotação registrada em segundos vs minutos
- Menor erro humano
- Suporta qualquer formato de PDF/imagem
- Comprador sempre valida (AI não decide sozinha)

### Negativas
- Custo por chamada API (GPT-4 Vision)
- Pode errar em PDFs muito complexos/escaneados
- Depende de n8n estar online

## Links
- [[26 - Upload Inteligente Cotacao]]
- [[10 - n8n Workflows]]
- [[40 - ADRs Index]]
