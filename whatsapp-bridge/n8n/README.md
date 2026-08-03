# Agente IA do Helpdesk (n8n) — setup

Fluxo: `fluxo-agente-ia-helpdesk.json`. A IA é a 1ª linha do WhatsApp do
Helpdesk: o **bridge** repassa conversas novas de texto para o n8n; o agente
conversa, orienta e abre chamados via tools (endpoints `/ai/*` do bridge).
O n8n **não** guarda chave da Evolution nem do Supabase.

```
bridge ──POST /webhook/teg-ai-atendimento──► n8n (debounce → agente Claude)
   ▲                                              │
   └── /ai/setores /ai/abrir-chamado /ai/status-chamado /ai/responder ◄──┘
```

## Pré-requisitos

- n8n rodando no MESMO projeto Easypanel (`chamadowhatsapp`), serviço chamado
  `n8n` (senão, troque `chamadowhatsapp_n8n` nas URLs). Sem n8n? Instale pelo
  template do Easypanel dentro do projeto.
- Um token compartilhado novo (gere 64 hex aleatórios). Ele vai em DOIS lugares:
  - Environment do serviço **n8n**: `AI_SHARED_TOKEN=<token>`
  - Environment do serviço **whatsapp-bridge**: `AI_SHARED_TOKEN=<token>` e
    `N8N_WEBHOOK_URL=http://chamadowhatsapp_n8n:5678/webhook/teg-ai-atendimento`
  - (Deploy nos dois; o bridge loga "agente IA (n8n): LIGADO" no boot.)

## Credenciais no n8n (criar antes de importar)

| Credencial | Tipo | Valores |
|---|---|---|
| Anthropic | Anthropic API | a ANTHROPIC_API_KEY da TEG (a mesma usada no assistente do Supabase) |
| Redis Evolution | Redis | host `chamadowhatsapp_evolution-api-redis`, porta `6379`, senha = a do `CACHE_REDIS_URI` do serviço evolution-api |
| Postgres Evolution | Postgres | copie host/db/usuário/senha do `DATABASE_CONNECTION_URI` do serviço evolution-api (host `chamadowhatsapp_evolution-api-db`, porta 5432). A memória usa a tabela própria `n8n_ai_memoria_helpdesk` (criada sozinha) |

## Importar e ligar

1. n8n → Workflows → **Import from File** → `fluxo-agente-ia-helpdesk.json`.
2. Abra cada nó com credencial (Claude, BufferMsg/LeBuffer1/LeBuffer2/LimpaBuffer,
   Memoria) e selecione a credencial criada. No nó **Claude**, confirme o modelo
   na lista (Claude Sonnet 5; para custo mínimo, Haiku).
3. **Activate** no workflow (webhook de produção fica ativo).
4. Preencha os envs do bridge (acima) e dê Deploy nele.

## Comportamento

- Debounce de 15s: mensagens picadas viram UMA chamada ao agente.
- Chamado aberto (cita CH-xxxx ou janela de 6h) → equipe humana (bridge roteia
  como comentário; IA fica de fora). A tool abrir_chamado é idempotente na
  janela: se já há chamado aberto da conversa, retorna o existente.
- Mídia sem chamado aberto → fluxo clássico do bridge (mini-fluxo de setor),
  nada se perde. IA v1 é só texto.
- O 200 ao bridge só sai DEPOIS de token validado + mensagem no buffer
  (Respond_OK). Token errado (401), Redis fora ou n8n fora do ar → bridge cai
  sozinho no fluxo clássico. O helpdesk nunca para.
- Falha DEPOIS do 200 (ex.: erro no modelo) é rara mas possível: o usuário fica
  sem resposta e, ao reenviar, um ciclo novo começa. Sem chamado duplicado
  (idempotência) e sem mensagem processada 2x.
- Desligar a IA = remover `N8N_WEBHOOK_URL` do bridge + Deploy.

## Observações técnicas

- As expressões usam `$env.AI_SHARED_TOKEN` → NÃO defina
  `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` no n8n (deixe ausente).
- `status_chamado` só responde chamados do PRÓPRIO telefone da conversa
  (não-titular recebe "não encontrado" — sem enumeração de chamados alheios).
- Os corpos das tools são serializados com JSON.stringify (aspas/quebras de
  linha na descrição não quebram nem injetam nada).

## Teste (nesta ordem)

1. Bridge logs: "agente IA (n8n): LIGADO → http://chamadowhatsapp_n8n:5678/...".
2. De um número SEM chamado aberto, mande "oi" → a IA deve se apresentar.
3. Descreva um problema → ela coleta título/descrição/setor e abre CH-xxxx.
4. Responda de novo (janela 6h) → vira comentário no chamado (IA de fora).
5. Pergunte "status do CH-<n>" numa conversa nova → tool status_chamado.
6. Pare o n8n e mande mensagem → deve cair no mini-fluxo de setor clássico.
