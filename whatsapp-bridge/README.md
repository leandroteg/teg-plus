# TEG+ WhatsApp Bridge (Evolution API)

Liga o WhatsApp ao Helpdesk TEG via **Evolution API** (webhook + REST), gravando
direto no Supabase. Substitui o `whatsapp-worker/` (whatsapp-web.js on-prem):
a sessão do WhatsApp agora mora na Evolution (VPS/Easypanel) e este bridge só
faz a ponte de negócio.

```
WhatsApp ⇄ Evolution API ──webhook──► bridge ──service key──► Supabase (ti_*)
                 ▲                      │
                 └────── REST (sendText)┘
```

## O que ele faz

- **Entrada** (`MESSAGES_UPSERT`): resolve o remetente (funcionário por telefone
  ou contato externo), anti-spam, decide novo chamado × comentário (cita CH-xxxx
  ou janela de 6h), mini-fluxo "de qual setor?", cria chamado `canal='whatsapp'`
  e salva mídia no bucket `ti-chamados`.
- **Saída**: respostas (não-internas) dos agentes no painel → WhatsApp do
  solicitante (polling, igual ao worker).
- **Painel**: mantém `ti_whatsapp` (status/QR/número/heartbeat) e executa os
  comandos Conectar/Desconectar/Testar de `/ti → Configurações → WhatsApp`.
- **Dedup**: webhook é entrega at-least-once; cada `key.id` processado é
  registrado em `ti_whatsapp_mensagens` (reentregas são ignoradas).

## Deploy no Easypanel (projeto `chamadowhatsapp`)

1. **+ Service → App**, nome `whatsapp-bridge`.
2. **Source**: este repositório GitHub, **Build Path** `/whatsapp-bridge`
   (build via Dockerfile).
3. **Environment**: copie de `.env.example` e preencha (chaves reais só aqui).
4. Deploy. Health-check: `GET http://chamadowhatsapp_whatsapp-bridge:3000/health`.
5. **Environment do serviço `evolution-api`**: garanta
   `DATABASE_SAVE_DATA_NEW_MESSAGE=true` (default da Evolution é false quando
   ausente). Sem isso, o `getBase64FromMediaMessage` — caminho pelo qual o
   bridge baixa TODA mídia — responde 400 "Message not found" e anexos se perdem.
6. **Webhook da instância** (Manager da Evolution → instância `teg-helpdesk` →
   Webhook):
   - URL: `http://chamadowhatsapp_whatsapp-bridge:3000/webhook`
   - Enabled: ON · **Webhook base64: OFF** (mídia é buscada via REST; payload do
     webhook fica pequeno e arquivos grandes não estouram o body do bridge)
   - Headers: `x-webhook-token: <WEBHOOK_TOKEN>`
   - Eventos: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`
   - "By events" (URL por evento): OFF

   Tudo em rede interna do Easypanel — o bridge **não** precisa de domínio nem
   porta pública.

## Rodar local (dev)

```bash
cp .env.example .env   # preencher
npm install
npm start
```

Obs.: local, o `EVOLUTION_URL` interno não resolve — use `https://evo.teguniao.com.br`
e um túnel p/ receber webhook, ou teste só os loops de saída/comando.
