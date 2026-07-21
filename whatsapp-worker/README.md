# TEG+ · WhatsApp Worker (on-prem)

Serviço Node que conecta um número de WhatsApp ao TEG+ e transforma a conversa em
chamados de TI. Usa **`whatsapp-web.js`** (WhatsApp Web via QR Code) e grava direto
no **Supabase** do TEG+ (tabelas `ti_*` + Storage). É o canal do antigo Helpdesk TEG.

> ⚠️ **Integração não-oficial.** Use um **número dedicado/corporativo** (não o
> pessoal de ninguém). A Meta pode bloquear números que automatizam o WhatsApp Web.

## O que ele faz

- **Recebe** mensagens 1:1 e:
  - casa o telefone com um **funcionário cadastrado** (pelos últimos 8 dígitos) — ou trata como **contato externo** (sem criar funcionário; nome/telefone vão em `ti_chamados.contato_externo`);
  - **abre um chamado** (`canal = whatsapp`), perguntando antes **"de qual setor?"**;
  - mensagens dentro de 6h (configurável) viram **comentário** no mesmo chamado;
  - **anexa** foto/vídeo/áudio/PDF/documento na conversa do chamado (Supabase Storage);
  - filtra **spam** (cassino/apostas/etc.).
- **Envia** de volta ao WhatsApp do solicitante a **resposta do agente** feita no painel (comentário não-interno) e a confirmação de abertura.
- **Painel:** o estado (QR, conectado, número) é publicado na tabela `ti_whatsapp` e aparece em **/ti → Configurações → WhatsApp**. Os botões Conectar/Desconectar/Testar mandam comandos que este worker executa.

## Pré-requisitos (Windows)

1. **Node.js 20 LTS** — https://nodejs.org
   - ⚠️ **Evite o Node 24 no Windows:** há uma instabilidade do libuv
     (`Assertion failed … src\win\async.c`) que pode **travar as chamadas ao
     Supabase**. O **20 LTS** é estável. (No Windows, dá pra ter várias versões
     com o `nvm-windows`.)
2. A máquina precisa ficar **sempre ligada** e com **internet**.
3. A primeira instalação baixa o **Chromium** (via Puppeteer, embutido no `whatsapp-web.js`) — ~150 MB.

## Instalação

Abra o **PowerShell** na pasta `whatsapp-worker`:

```powershell
npm install
Copy-Item .env.example .env
notepad .env   # preencha SUPABASE_SERVICE_ROLE_KEY
```

A `SUPABASE_SERVICE_ROLE_KEY` está em **Supabase → Project Settings → API → `service_role`**.
É **secreta** — fica só nesta máquina, nunca no frontend nem no Git.

## Rodar

```powershell
npm start
```

- No primeiro start aparece um **QR Code no terminal**. No celular do número
  corporativo: **WhatsApp → Aparelhos conectados → Conectar um aparelho** e escaneie.
- Depois de pareado, a sessão fica salva em `.wwebjs_auth/` — **não precisa
  reescanear** a cada restart.
- O mesmo QR também aparece em **/ti → Configurações → WhatsApp** (admin).

## Deixar sempre ligado (Windows)

Use um gerenciador de processos para reiniciar sozinho após queda/reboot:

```powershell
npm install -g pm2
pm2 start src/index.js --name teg-whatsapp
pm2 save
pm2 startup    # siga a instrução para iniciar no boot do Windows
```

(Alternativas: NSSM para registrar como Serviço do Windows, ou Agendador de Tarefas.)

## Configuração (.env)

| Variável | Função |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase do TEG+ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role (**secreta**) |
| `WHATSAPP_ENABLED` | `true` conecta no boot; `false` espera o botão Conectar do painel |
| `WHATSAPP_CONVERSA_JANELA_MIN` | Janela do "um chamado por conversa" (min, padrão 360) |
| `WHATSAPP_PERFIL_EXTERNO_EMAIL` | E-mail da conta de sistema dos contatos externos |
| `WHATSAPP_BUCKET` | Bucket de Storage dos anexos (`ti-chamados`) |

## Observações

- **Banco:** depende da migração `ti_whatsapp_canal_controle_e_conta_externa`
  (tabela `ti_whatsapp` + conta "WhatsApp (externo)"), já aplicada no projeto.
- **Uma instância só** por número — não rode dois workers com o mesmo `.wwebjs_auth`.
- **Logs:** tudo no stdout (o `pm2 logs teg-whatsapp` mostra).
- Notificações de **mudança de status** (resolvido/fechado) ao usuário ainda não
  são enviadas por aqui (só as respostas/comentários) — pode ser adicionado depois.

## Solução de problemas

- **Worker trava após `canal: ON` (não imprime "conta externa")** ou erro
  `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) … src\win\async.c`:
  é a instabilidade do **libuv no Node 24 (Windows)**. Use **Node 20 LTS**. Se já
  rodou várias vezes, **reinicie a máquina** (ou encerre os `node.exe`/Chromium
  órfãos) e rode `npm start` de novo.
- **QR não aparece / `auth_failure`:** apague a pasta `.wwebjs_auth/` e reconecte
  (vai gerar um novo QR para parear).
- **Mensagens não viram chamado:** confira no painel se o status está
  **Conectado**; veja os logs com `pm2 logs teg-whatsapp`.

## Segurança

- A `SUPABASE_SERVICE_ROLE_KEY` dá acesso **total** ao banco. Mantenha só no `.env`
  desta máquina (o `.gitignore` já o exclui do Git). Se ela vazar (ex.: colada num
  chat), **rotacione**: Supabase → Settings → API → *Reset service_role* e atualize
  o `.env`.
