# Assinatura Eletrônica Própria (TEG+) — Spec

**Objetivo:** assinatura eletrônica **avançada** própria (não ICP-Brasil, não provedor externo). Válida entre as partes (CC arts. 219/221 + MP 2.200-2/2001 art. 10 §2º + Lei 14.063/2020) e aceita para contrato de trabalho. Como NÃO tem a presunção automática da ICP-Brasil, **a defesa jurídica é a trilha de auditoria** → o esforço vai todo em prova de **autoria + integridade + tempo + imutabilidade**.

> Não é aconselhamento jurídico. Validar o texto de consentimento e o nível com o jurídico da TEG.

## Provas que o sistema precisa gerar
- **Integridade:** hash SHA-256 do PDF exato que foi assinado (detecta qualquer alteração).
- **Autoria:** o signatário se autenticou no ato (OTP por e-mail/SMS vinculado ao colaborador) + CPF.
- **Tempo:** timestamp **server-side** (`now()` do Postgres), não manipulável pelo cliente.
- **Consentimento:** texto exato exibido + aceite explícito, vinculado àquele hash.
- **Contexto:** IP, user-agent, geolocalização (quando disponível).
- **Imutabilidade:** registros append-only, garantidos por **trigger no banco** (pega até `service_role`) + **hash-chain** (cada registro carrega o hash do anterior → adulteração quebra a cadeia).

## Schema (tabelas `sig_*`)
- **`sig_documento`** — um documento a assinar.
  `id uuid pk · escopo text (ex: 'admissao_contrato') · ref_id uuid (candidato/anexo) · titulo · arquivo_path (bucket) · arquivo_hash text (sha256 do PDF) · mime · criado_por uuid · created_at timestamptz default now()`
- **`sig_assinatura`** — evento de assinatura (APPEND-ONLY).
  `id uuid pk · documento_id fk · signatario_colaborador_id uuid · signatario_nome · signatario_cpf · doc_hash text (hash assinado, = arquivo_hash no ato) · consentimento_texto text · auth_metodo text ('otp_email'|'otp_sms') · otp_verificado_em timestamptz · ip inet · user_agent text · geo jsonb · assinado_em timestamptz default now() · seq bigserial · prev_hash text · registro_hash text`
- **`sig_evento`** — trilha fina (APPEND-ONLY): aberto, otp_enviado, otp_verificado, assinado, verificado.
  `id uuid pk · documento_id · assinatura_id · evento text · detalhe jsonb · ip inet · user_agent · created_at timestamptz default now()`

### Hash-chain
`registro_hash = sha256(prev_hash || documento_id || signatario_cpf || doc_hash || assinado_em)`; `prev_hash` = `registro_hash` da última `sig_assinatura` (cadeia global). Calculado na **edge function** dentro de transação com lock (evita corrida).

### Imutabilidade (trigger — NÃO só RLS)
`BEFORE UPDATE OR DELETE` em `sig_assinatura` e `sig_evento` → `RAISE EXCEPTION`. Triggers disparam mesmo para `service_role`. RLS: `SELECT` para authenticated; `INSERT` só via edge function (service_role). `sig_documento` pode ter UPDATE só do hash antes de existir assinatura.

## Fluxo
1. **RH (TEG+)** clica "Enviar p/ assinatura" → baixa o PDF, calcula `arquivo_hash` (Web Crypto), cria `sig_documento` + a missão no Portal (categoria `assinaturas`, já existe). `sig_documento.id` vai no metadata da missão.
2. **Colaborador (PortalTEG)** abre a missão → vê o PDF → lê o texto de consentimento → clica "Assinar".
3. Portal dispara **OTP** (`supabase.auth.signInWithOtp`) pro e-mail/telefone do colaborador → grava `sig_evento` (otp_enviado).
4. Colaborador digita o OTP → Portal chama a edge function **`sig-selar`**.
5. **`sig-selar`** (edge): valida OTP verificado + rebaixa o PDF e reconfirma o hash + insere `sig_assinatura` (com hash-chain, `now()`, ip/ua/geo) + `sig_evento` (assinado) + conclui a missão + gera o **PDF carimbado** (bloco de assinatura + QR → `/verificar/{id}`) no Storage. Tudo numa transação.
6. **Verificação pública** `/verificar/{assinatura_id}` (rota Vite): mostra signatário, CPF mascarado, doc, hash, timestamp, status da cadeia (íntegra?), sem login.

## Edge Function `sig-selar` (contrato)
`POST { documento_id, consentimento_texto, geo? }` com JWT do colaborador (autenticado via OTP na sessão). Valida: sessão recente (OTP), documento existe, colaborador = signatário esperado. Retorna `{ ok, assinatura_id, registro_hash }`. Idempotente (se já assinado, retorna o existente).

## Build incremental (commits separados)
1. Migration `sig_*` + triggers de imutabilidade + RLS. **← increment 1**
2. Edge `sig-selar` (hash-chain, insert append-only, conclui missão).
3. TEG+: no "Enviar p/ assinatura", calcular hash + criar `sig_documento` (liga na missão).
4. Carimbo PDF (`pdf-lib` + `qrcode`) + salvar no Storage.
5. Rota pública `/verificar/[id]`.
6. **PortalTEG (repo separado):** tela de assinatura da missão (mostra doc + consentimento + OTP → chama `sig-selar`).

## Testes (Vitest) — o que separa demo de prova judicial
- `UPDATE`/`DELETE` em `sig_assinatura` e `sig_evento` **falham** (trigger).
- hash-chain: adulterar um registro quebra a verificação da cadeia.
- `sig-selar` recusa sem OTP verificado / signatário errado.
