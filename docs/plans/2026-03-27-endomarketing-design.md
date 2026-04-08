# Design: Endomarketing — Comunicados com IA

**Data:** 2026-03-27
**Status:** Aprovado

## Contexto

Módulo Cultura > Endomarketing para geração de comunicados internos com IA (Google Gemini via n8n). RH fornece informações, seleciona tipo, e o sistema gera texto + imagem PNG/JPG com identidade visual da empresa.

## Estrutura

```
Cultura > Mural de Recados (existente)
       > Endomarketing (NOVO)
           ├── Gerar Comunicado
           ├── Histórico
           └── Identidade Visual
```

## Banco de Dados

- `rh_comunicados` — comunicados gerados (tipo, titulo, conteudo, imagem_url, formato, input_usuario)
- `rh_identidade_visual` — config única (logo, cores, fontes, slogan)

## Tipos de Comunicado

aviso_geral, aniversariante, boas_vindas, reconhecimento, evento, treinamento, seguranca, resultado, campanha_interna, personalizado

## Formatos

- Story (1080×1920)
- Feed (1080×1080)
- Paisagem (1920×1080)
- A4 (2480×3508)

## Fluxo

1. RH seleciona tipo + formato + digita informações
2. Frontend envia para n8n webhook /endomarketing/gerar
3. n8n: Set Node (prompt por tipo) → Gemini Flash → texto estruturado JSON
4. Frontend recebe texto, mostra preview editável
5. Frontend renderiza HTML template com identidade visual
6. Converte HTML → PNG via html2canvas (client-side)
7. Upload para Supabase Storage + salva em rh_comunicados
8. Preview + botões Baixar / Salvar

## n8n Workflow

- Webhook: POST /endomarketing/gerar
- Set Node: switch por tipo com prompts detalhados
- Google Gemini Flash: gera JSON {titulo, subtitulo, corpo, destaques[], rodape}
- Respond: retorna texto gerado

## Telas

1. **GerarComunicado** — wizard: tipo → formato → input → gerar IA → preview texto → gerar imagem → salvar
2. **HistoricoComunicados** — grid de cards com thumbnail, tipo badge, data, download
3. **IdentidadeVisual** — form com logo upload, color pickers, fontes, slogan, preview ao vivo
