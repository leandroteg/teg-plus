# Runbook — Canal WhatsApp do Helpdesk (1 página)

Número do helpdesk: **(67) 9604-7609** · Painel: **/ti → Configurações → WhatsApp**

## Está tudo bem? (30 segundos)

1. Painel `/ti → Configurações → WhatsApp`: deve mostrar **Conectado**, o número
   e "visto agora" (o heartbeat pulsa a cada ~4s).
2. Se preferir SQL (Supabase → SQL Editor):

```sql
select worker_versao, status, numero, now() - worker_visto_em as visto_ha
from ti_whatsapp where id = 1;
```

- `status` deve ser `ready` e `visto_ha` menor que 1 minuto.
- `worker_versao` diz **qual código está no ar** — confira aqui antes de
  reportar qualquer bug de comportamento (um deploy que não pegou já custou
  uma hora de investigação).

## Sintomas → o que fazer

| Sintoma | Causa provável | Ação |
|---|---|---|
| Painel "Desconectado" / `status` ≠ ready | Sessão do WhatsApp caiu | Painel → **Conectar** → escanear o QR com o celular do helpdesk |
| `visto_ha` parado (> 2 min) | Bridge caiu | Easypanel → `whatsapp-bridge` → **Deploy** |
| Usuário diz que não recebeu resposta | Envio falhando | Logs do bridge: procurar `envio falhou` ou `MENSAGEM PERDIDA` |
| Mensagens chegam mas não viram chamado | Erro no banco | Logs: `ERRO handleOne`; conferir Supabase |
| Erro 401 nos logs (`reconcile`) | Chave da Evolution divergente | Igualar `EVOLUTION_APIKEY` (bridge) e `AUTHENTICATION_API_KEY` (evolution-api) |

**Logs**: Easypanel → serviço `whatsapp-bridge` → aba Logs.

## Desligar rápido (rollback)

- **Só o acompanhamento automático** (mensagem dos 15 min):
  Environment do bridge → `WHATSAPP_FOLLOWUP_ESPERA_MIN=0` → Deploy.
- **Só o aviso de mudança de status**: não há chave própria — mova o card menos,
  ou peça um ajuste.
- **O canal inteiro** (para de receber e de responder):
  Easypanel → `whatsapp-bridge` → botão **Stop**. Os chamados já abertos
  continuam no painel; nada é perdido, mas ninguém recebe/envia por WhatsApp.
- **Reverter código**: Easypanel → `whatsapp-bridge` → Deployments → redeploy da
  versão anterior.

## O que o sistema faz sozinho (para a equipe não se assustar)

- Mensagem nova → pergunta o setor → abre o chamado e responde o número.
- Mensagem de quem já tem chamado aberto (6h, ou citando CH-xxxx, ou em
  "Aguardando") → vira **comentário** no chamado.
- **Arrastar o card no Quadro avisa o usuário no WhatsApp** (~30s depois).
  Voltar para "Aberto" não avisa.
- Chamado parado em "Aberto" sem responsável por 15 min → o **Assistente
  Virtual** comenta dizendo que está na fila (máx. 2 vezes).
- Responder no chamado **envia para o WhatsApp**; marcar "Nota interna" não.
  A tela avisa qual dos dois vai acontecer.

## Regras de ouro para a equipe (dia 1)

1. Antes de escrever, olhe o aviso verde/âmbar abaixo do campo de resposta.
2. Assumir o chamado (definir responsável) silencia o robô de 15 minutos.
3. O nome que aparece é o do WhatsApp da pessoa — confira o telefone no topo do
   chamado se tiver dúvida de quem é.
4. Qualquer coisa estranha: print dos **Logs** + horário. Isso resolve 90% dos
   diagnósticos.

## Limites conhecidos (não são bugs)

- Mídia (foto/áudio/PDF) só é anexada **depois** que o chamado existe; a
  primeira mensagem com mídia entra no fluxo de setor normalmente.
- Reação com emoji, enquete, localização e contato não viram chamado.
- Mensagem em grupo é ignorada — o canal é 1:1.
- Se o funcionário não tiver telefone cadastrado no sistema, o chamado nasce
  como contato externo (nome do WhatsApp + telefone).
