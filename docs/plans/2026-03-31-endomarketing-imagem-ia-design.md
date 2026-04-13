# Design: Endomarketing — Geração de Imagem por IA (Gemini Generate Image)

**Data:** 2026-03-31
**Status:** Aprovado

## Contexto

O módulo Endomarketing já existe com geração de texto via Gemini + renderização HTML (html2canvas). Esta iteração adiciona um segundo caminho: geração de imagem nativa via node Gemini Generate Image do n8n (Imagen 3), removendo a dependência de html2canvas para esse fluxo. O modo template existente é simplificado — o usuário preenche os campos manualmente, sem chamada de IA para texto.

## Modos de Operação

```
Wizard:
  Passo 1 → Tipo de comunicado
  Passo 2 → Formato (Story / Feed / Paisagem / A4)
  Passo 3 → Seletor de modo:
              [Usar Template]   [Gerar com IA]
                   ↙                   ↘
         Campos manuais          Texto livre (instrucoes)
         (titulo, corpo, etc.)        ↓
                ↓               n8n → Gemini Generate Image
         html2canvas → PNG           ↓
                ↓               Preview da imagem gerada
         Salvar / Baixar        Salvar ✓  ou  Descartar ✗
```

## n8n — Novo Workflow

**Nome:** `Endomarketing - Gerar Imagem IA`
**Webhook:** `POST /endomarketing/gerar-imagem`

```
Webhook → Code Node (monta prompt) → Gemini Generate Image → Supabase Storage Upload → Respond
```

### Prompt construído no Code Node

```
Gere uma imagem de comunicado corporativo interno.
Tipo: {tipo_label}
Formato: {formato_label} ({dimensoes}px)
Empresa: {nome_empresa} — {slogan}
Identidade visual: cor primária {cor_primaria}, cor secundária {cor_secundaria}
Instrucoes: {instrucoes_usuario}
Estilo: profissional, moderno, clean, corporativo.
Use as cores da empresa com destaque para o conteúdo principal.
```

### Payload recebido do frontend

```json
{
  "tipo": "aniversariante",
  "tipo_label": "Aniversariante",
  "formato": "feed",
  "formato_label": "Feed Instagram",
  "dimensoes": "1080x1080",
  "instrucoes": "Aniversário da Maria, 5 anos de empresa",
  "identidade": {
    "nome_empresa": "TEG União Energia",
    "slogan": "Energia que conecta",
    "cor_primaria": "#6366f1",
    "cor_secundaria": "#8b5cf6",
    "logo_url": "https://..."
  }
}
```

### Resposta ao frontend

```json
{
  "imagem_url": "https://uzfjfucrinokeuwpbeie.supabase.co/storage/v1/object/public/endomarketing/geradas/aniversariante_feed_1743000000.png"
}
```

## Storage Supabase

- **Bucket:** `endomarketing` (público, já existente ou novo)
- **Pasta:** `geradas/`
- **Filename:** `{tipo}_{formato}_{unix_timestamp}.png`
- **Permanência:** URL definitiva desde o upload — não precisa mover arquivo
- **Descarte:** usuário descartando não remove o arquivo (limpeza por cron futura)

## Mudanças no Frontend (Endomarketing.tsx)

| Componente | Mudança |
|---|---|
| Wizard Passo 3 | Adiciona seletor `Usar Template` / `Gerar com IA` |
| Modo Template | Remove chamada n8n para texto — campos preenchidos manualmente |
| Modo IA | Campo textarea instrucoes + botão "Gerar Imagem" |
| Preview modo IA | `<img src={imagemUrl} />` com botões Salvar / Descartar |
| Hook novo | `useGerarImagemIA` — POST para `/endomarketing/gerar-imagem` |
| Salvar modo IA | `useSalvarComunicado` com imagem_url, tipo, formato, input_usuario |

## Hooks

### `useGerarImagemIA` (novo)
```ts
// POST /endomarketing/gerar-imagem
// Retorna: { imagem_url: string }
```

## Workflow n8n Existente

O workflow `Endomarketing - Gerar Comunicado` (texto) **não muda** — continua disponível mas o frontend deixa de chamá-lo no modo Template (usuário preenche manualmente). Pode ser desativado futuramente se não for mais necessário.

## Sequência de Implementação

1. Criar novo workflow n8n com webhook, Code node, Gemini Generate Image, Supabase upload, Respond
2. Adicionar hook `useGerarImagemIA` no frontend
3. Refatorar wizard: adicionar seletor de modo no passo 3
4. Modo Template: remover chamada IA, tornar campos editáveis diretamente
5. Modo IA: implementar textarea + botão Gerar + preview + Salvar/Descartar
6. Testar fluxo completo end-to-end


## Links
- [[obsidian/25 - Mural de Recados]]
