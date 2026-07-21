# EGP — Cadastro de OSC e Medição via SuperTEG (parse de anexos)

Documento operacional para o **SuperTEG** (Claude Code na VPS) registrar, **sem gerar problema**, os itens
extraídos dos documentos anexados em **EGP › Novo Registro**. O frontend cria a "casca" do registro e
sobe o anexo; o SuperTEG lê o PDF/planilha e **enriquece** a casca (preenche campos + insere itens).

> Regra de ouro: **idempotência**. Reprocessar o mesmo documento NÃO pode duplicar. Sempre
> "buscar → atualizar se existe, inserir se não existe". Nunca apagar dados de outras OSCs/competências.
> Tudo via REST do Supabase (skill `operar-erp`); a REST direta IPv6 falha — usar o endpoint REST.

Projeto Supabase: `uzfjfucrinokeuwpbeie`. Contrato CEMIG `portfolio_id = 2cd4557b-846e-4d25-bbd5-6df71406a4ed`.

---

## 1. Nova Obra / OSC  (documento de abertura da OSC)

Contexto recebido: `{ casca_id, numero_os, projeto_id, projeto_nome, portfolio_id, tipo, arquivo_nome }` + `doc_url` (assinada pelo n8n).
A casca já existe em `pmo_fluxo_os` (criada pelo frontend) — **NÃO criar outra**; **atualizar pela `casca_id`**.

Hierarquia: **Projeto/Frente (pmo_projetos) › Obra (sys_obras) › OSC (pmo_fluxo_os)**. A casca entra ligada à frente
(`projeto_id`) mas **sem `obra_id`** — é o SuperTEG que identifica a obra pelo documento. Sem `obra_id` a OSC
**não aparece** na árvore do EGP (filtra por obra).

### 1.1 `pmo_fluxo_os` (a OSC) — ATUALIZAR a linha da casca (`PATCH ?id=eq.{casca_id}`)
1. **Normalizar `numero_os`**: ler o número REAL da OSC no PDF (ex: `OSC-EA-885-031/2026`) e gravar limpo
   (sem nome de arquivo, sem sufixos tipo `-Manifesto`). O valor que veio do front é provisório.
2. **Identificar a OBRA** (`obra_id`): `GET /rest/v1/sys_obras?pmo_projeto_id=eq.{projeto_id}&select=id,nome,codigo`.
   Normalizar os nomes dos dois lados (MAIÚSCULAS, sem acento, `/` e `-` → espaço, remover `, 138 KV`/`kV`/pontuação)
   e fazer **match fuzzy por similaridade** entre o título da obra no documento (e em `arquivo_nome`) e os nomes das
   obras. O match **nunca é perfeito** — escolher a mais parecida com boa confiança e gravar `obra_id`. Se **não** houver
   candidata com confiança razoável, **deixar `obra_id` null** e incluir em `avisos`: `"obra nao identificada: <nome procurado>"`
   (a tela pede confirmação manual). **Nunca** criar `sys_obras` novo nem chutar.
3. Campos do PDF: `valor` (total da OSC, numeric), `quantidade_us`, `saldo_us`, `saldo_reais`,
   `data_osc` (YYYY-MM-DD), `vencimento` (date), `qtd_torres` (int), `tipo` (`construcao|manutencao|deposito`),
   `tipo_servico`, `tipo_obra`. Manter `etapa_atual='recebida'`. **Não** sobrescrever `abertura_path`.
- Validar: `valor >= 0`; datas em ISO; se um campo não estiver no PDF, **deixar como está** (não zerar).

### 1.2 `pmo_osc_itens` (itens/EAP da OSC) — substituição atômica por OSC
Cada item do PDF vira uma linha ligada por `fluxo_os_id` (= `casca_id`). Para não duplicar ao reprocessar:
1. `DELETE /rest/v1/pmo_osc_itens?fluxo_os_id=eq.{casca_id}` (apaga só os itens DESSA OSC).
2. `POST` os itens extraídos.

Colunas: `fluxo_os_id`, `subsec_codigo` (ex. `4.2.1`), `subsec_nome`, `secao`, `unidade` (`m³|ton|km|un|vb...`),
`quantidade` (contratada), `qty_acum` (acumulada/realizada), `valor` (valor contratado do item), `valor_acum` (faturado).
- **Conferência/carga/descarga/desmontagem de estruturas/materiais NÃO entram como driver** — o pacote desses cai em
  "Outros" (o cliente lança conferência como Outros). Manter `subsec_codigo`/`subsec_nome` originais; a classificação
  em pacote/driver é feita no cliente (`pacoteDe`/`isDriver`).
- Soma de `valor` dos itens deve bater (±1%) com `pmo_fluxo_os.valor`; se divergir muito, **logar e não falhar**.

---

## 2. Nova Medição  (documento de medição mensal)

Contexto recebido: `{ numero_os, competencia (YYYY-MM-01), storage_path, doc_url }`.
A linha do documento já existe em `pmo_medicoes` (casca + anexo). A medição precisa existir como OSC válida:
- Validar que `numero_os` existe em `pmo_fluxo_os` (senão **abortar e reportar** "OSC inexistente" — não inventar).

### 2.1 `pmo_medicao_mensal` — UPSERT por (numero_os, competencia)  [tem UNIQUE]
- `POST .../pmo_medicao_mensal` com header `Prefer: resolution=merge-duplicates` (on_conflict numero_os,competencia).
- Campos: `numero_os`, `competencia` (YYYY-MM-01), `realizado` (valor R$ medido no mês), `acumulado` (acum. lê "Acum"),
  `n_medicoes` (int), `subcontratada` (bool — true se a medição é de subcontratada).
- `realizado` = valor do mês; `acumulado` = total acumulado até a competência (coluna "Acum" do espelho).

### 2.2 `pmo_medicao_secao` — UPSERT por (numero_os, competencia, pacote)  [tem UNIQUE]
- Uma linha por **pacote/seção** medido no mês. `Prefer: resolution=merge-duplicates` (on_conflict numero_os,competencia,pacote).
- Campos: `numero_os`, `competencia`, `pacote` (nome do pacote/seção da EAP), `realizado` (R$ do pacote no mês).
- A soma de `realizado` das seções deve bater (±1%) com `pmo_medicao_mensal.realizado` da mesma OSC/competência.

---

## 3. Regras gerais (sem gerar problema)

1. **Idempotência sempre**: buscar antes de inserir; usar `Prefer: resolution=merge-duplicates` onde há UNIQUE
   (medições); usar delete-por-pai + insert onde não há (itens de OSC).
2. **Integridade referencial**: `pmo_osc_itens.fluxo_os_id` deve apontar p/ OSC existente; `pmo_medicao_*` exige
   `numero_os` existente em `pmo_fluxo_os`. Nunca inserir órfão.
3. **Não destruir o que não é seu**: deletes sempre filtrados pela OSC/competência específica do documento atual.
4. **Datas** em ISO `YYYY-MM-DD`; **competência** sempre `YYYY-MM-01`.
5. **Valores** numéricos (ponto decimal); remover "R$", milhar, %. Se ilegível, **não chutar** — deixar null e reportar.
6. **Não zerar** campos já preenchidos quando o PDF não traz o dado.
7. **Reportar** ao final: `{ ok, tabela, id, inseridos, atualizados, avisos[] }`. Em erro, `{ ok:false, motivo }` (HTTP 200).
8. **Auditar**: registrar o que escreveu no log de auditoria do SuperTEG.

---

## 4. Acionamento (n8n)  — workflow `HxbqC3F2zEAXniNd` "EGP - Parse e Cadastro (SuperTEG)"

Frontend (EGP › Novo Registro) sobe o anexo no bucket (`egp-osc-abertura` / `egp-medicoes`), cria a casca e faz
**POST** no webhook `egp-parse-cadastro` com um JSON pequeno: `{ tipo:'osc'|'medicao', bucket, path, contexto, run_id }`.
O **n8n** então: (1) **responde rápido** (202 `{ok,aceito}`) pra não travar o navegador; (2) **assina a URL no servidor**
(service role) — o front NÃO assina mais (era frágil/falhava em silêncio); (3) chama o SuperTEG `/chat` com
`doc_url + contexto` → SuperTEG lê o doc e cadastra seguindo as regras acima → grava no banco e responde resumo
`{ ok, tabela, id, numero_os, obra_id, inseridos, atualizados, avisos[] }`.

> O disparo é assíncrono: o SuperTEG roda depois do 202. O resultado aparece na árvore do EGP quando ele grava
> `obra_id` + `valor` + itens. Se `obra_id` voltar null (sem match), a OSC fica pendente de confirmação de obra.
