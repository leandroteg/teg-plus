# Plano de adequação — OS de Gestão de Imóveis ↔ OS de Frotas

Levantado em 05/08/2026 lendo o código e o banco (não é estimativa de memória).

## 1. Onde cada um está hoje

| Recurso | Frotas | Gestão de Imóveis |
|---|---|---|
| Tabela principal | `fro_ordens_servico` | `loc_solicitacoes` |
| Orçamentos por fornecedor | `fro_cotacoes_os` (N por OS) | **não existe** — só um campo `valor_estimado` |
| Itens (peça / mão de obra) | `fro_itens_os`, com garantia em dias/km e histórico de preço | **não existe** |
| Anexos por etapa | `fro_os_anexos` (requisição / cotação / execução) | **não existe** — só 1 `anexo_url` + array `fotos` |
| Histórico de status | `fro_os_status_hist` | **não existe** |
| Comentários | `fro_os_comentarios` | **não existe** |
| Alçada | calculada (`alcadaDe(total)`) e exibida no botão | texto fixo na tela |
| SLA | contador de dias na cotação, vira vermelho ao estourar | **não existe** |
| Modal | 9 corpos, um por etapa (1.731 linhas) | 1 modal com blocos condicionais (403 linhas) |
| Etapas do pipeline | 6 + Aguardando | 6 + Aguardando (**já são iguais**) |

O pipeline dos dois já bate. A diferença é **o que se consegue registrar dentro de cada etapa**.

## 2. O problema do anexo de cotação — vale detalhar, porque é diferente nos dois

**Frotas:** existe `OSAnexos etapa="cotacao"`, mas é uma **pilha solta** de arquivos da
etapa. A tabela `fro_cotacoes_os` (fornecedor, valor, prazo) **não tem coluna de
arquivo**. Ou seja: dá pra anexar 3 PDFs e lançar 3 orçamentos, mas **nada diz qual
PDF é de qual fornecedor**. Na hora de aprovar, o aprovador vê números sem lastro.

**Locação:** não tem nem a pilha nem a tabela de orçamentos. A tela chega a dizer
*"Política de Compras: manutenção predial pede 2 orçamentos antes da aprovação"* —
mas **não existe onde lançar o segundo**. Hoje o campo é um só: "Valor cotado".

É por isso que a dor aparece nos dois, mas a correção é diferente em cada um.

## 3. Plano — 5 fases, cada uma publicável sozinha

### Fase 1 — Anexo amarrado ao orçamento (resolve a dor explícita)
- **Banco (aditivo):** `fro_cotacoes_os` ganha `anexo_url`, `anexo_nome`, `anexo_path`.
- **Banco (novo):** `loc_cotacoes` — espelho de `fro_cotacoes_os` (solicitacao_id,
  fornecedor_id, valor_total, prazo_dias, validade, observacoes, selecionado, anexo_*).
- **Frotas:** o `NovaCotacao` passa a aceitar o PDF junto do valor; a lista de
  orçamentos mostra o clipe para abrir o arquivo daquele fornecedor.
- **Locação:** a etapa Cotação ganha o bloco de orçamentos (mesmo desenho do Frotas),
  com N fornecedores, cada um com valor, prazo e o PDF.
- **Trava:** manter a regra dos 2 orçamentos — abaixo disso, justificativa obrigatória
  (o Frotas já faz; a Locação passa a fazer).

### Fase 2 — Locação ganha anexos por etapa
- **Banco:** `loc_solicitacao_anexos`, espelho de `fro_os_anexos` (etapa, rótulo,
  arquivo, quem enviou).
- **Front:** extrair o `OSAnexos` do Frotas para um componente compartilhado
  parametrizado por tabela/bucket, em vez de duplicar 212 linhas.
- Rótulos da locação: Foto, Orçamento, Nota fiscal, Laudo, Termo, Outro.

### Fase 3 — Rastro: histórico e comentários na Locação
- **Banco:** `loc_solicitacao_hist` (de/para, quem, quando) e `loc_solicitacao_coment`.
- O histórico é o que hoje falta para auditar "quem mandou isso pra aprovação e quando".
- Registro por trigger na mudança de status, como no Frotas.

### Fase 4 — Alçada calculada e SLA
- Alçada vira função (hoje é texto fixo "até 3.000 Welton"): o botão de aprovação
  mostra quem é o aprovador daquele valor, e a tela não deixa aprovar fora da alçada.
- SLA de cotação com contador de dias, igual ao Frotas.

### Fase 5 (avaliar antes) — Itens estruturados na Locação
- `loc_solicitacao_itens`, espelho de `fro_itens_os`.
- **Ressalva honesta:** para manutenção predial isso pode ser peso morto. O Frotas
  precisa por causa da garantia por peça (dias/km) e do histórico de preço de peça.
  Em imóvel, "trocar a resistência do chuveiro" raramente vira lista de itens.
  Sugiro decidir isso depois da Fase 1 — com os orçamentos anexados, talvez já
  resolva sem a granularidade de itens.

## 4. Ordem sugerida e por quê

1. **Fase 1** primeiro: é a dor que você levantou, e é a que muda a decisão de quem aprova.
2. **Fase 2** logo em seguida: sem anexo por etapa, a locação continua sem NF nem laudo.
3. **Fase 3** quando quiser fechar auditoria.
4. **Fase 4** é barata e some com o texto fixo.
5. **Fase 5** só se a Fase 1 não tiver resolvido.

## 5. Riscos e cuidados

- **Migrações aditivas.** Nada de alterar coluna existente — `loc_solicitacoes` já
  tem dado em produção (5 solicitações, e as de limpeza vêm do Portal).
- **O Portal TEG grava em `loc_solicitacoes`** (RPCs `portalteg_manutencao_solicitar`
  e `portalteg_limpeza_salvar`). Qualquer mudança na tabela tem que manter as duas
  funcionando — elas são de outro repositório e não deployam junto.
- **Bucket:** o Frotas usa `fro-checklist-fotos` (público). A locação usa
  `locacao-faturas` (**privado** — exige URL assinada na hora de exibir). O componente
  compartilhado da Fase 2 precisa saber disso, senão o anexo abre quebrado.
- **`valor_estimado` continua sendo a fonte da alçada** enquanto os orçamentos não
  estiverem em uso — a Fase 1 deve preencher `valor_estimado` a partir do orçamento
  selecionado, para não quebrar as telas que já leem esse campo.

---

## 6. Garantias de não-quebra (levantado no banco em 05/08/2026, 16h)

O que existe em produção agora:

| Tabela | Linhas |
|---|---|
| `fro_ordens_servico` | 16 |
| `fro_cotacoes_os` | 1 |
| `fro_os_anexos` | 2 |
| `fro_os_status_hist` | 8 |
| `fro_os_comentarios` | 5 |
| `loc_solicitacoes` | 20 (15 manutenção + 5 NC) |

**Regras que a execução tem de obedecer — sem exceção:**

1. **Só migração aditiva, e `DROP`/`REPLACE` são PROIBIDOS — inclusive em rollback.**
   Permitido: `ADD COLUMN ... NULL` e `CREATE TABLE`. Proibido: `DROP TABLE`,
   `DROP COLUMN`, `DROP FUNCTION`, `CREATE OR REPLACE FUNCTION` sobre função que já
   está em produção, `ALTER COLUMN`, `RENAME`, `NOT NULL` em coluna existente.
   Coluna nova entra sempre anulável e sem default que reescreva linha.
2. **Nenhum backfill nas 16 OS e nas 20 solicitações.** Elas continuam exatamente
   como estão; o recurso novo aparece vazio nelas, não migrado à força.
3. **Nada de tocar em `fro_cotacoes_os` além de acrescentar colunas** — só 1 linha,
   mas é dado real de uma OS viva.
4. **As RPCs do Portal TEG (`portalteg_manutencao_solicitar`,
   `portalteg_limpeza_salvar`) não podem mudar de assinatura.** São outro repositório,
   com deploy independente: se a assinatura mudar, o Portal quebra em silêncio e o
   colaborador perde o chamado sem aviso. Parâmetro novo, se preciso, só com DEFAULT.
5. **Tela nova lê campo novo com fallback.** Toda leitura de coluna nova assume
   `null` para os registros antigos — nenhuma tela pode depender do campo existir.
6. **Publicar fase por fase**, cada uma com o `tsc` comparado ao baseline da main, e
   com a main sincronizada imediatamente antes do push (há várias sessões
   trabalhando no mesmo repositório ao mesmo tempo).

7. **Função em produção não se altera: cria-se outra, com outro nome.** Se um
   comportamento novo exigir mudar uma RPC existente, o caminho é `portalteg_x_v2`
   convivendo com a `portalteg_x` — nunca substituir a que está no ar. Quem chama a
   antiga continua funcionando; a migração de chamador é decisão separada e sua.

**Rollback — sem apagar nada.** Como tudo é aditivo, desfazer é **parar de usar**:
o front deixa de ler/escrever o campo, e a coluna ou tabela nova fica lá, vazia e
inerte. Nenhum `DROP` em nenhuma hipótese. Coluna anulável sem uso não custa nada e
não afeta consulta nenhuma; apagar, sim, é risco. Se um dia for realmente para
remover, isso é uma decisão à parte, com backup e fora deste plano.
