---
title: Módulo RH — Colaboradores
type: modulo
modulo: rh-colaboradores
status: ativo
tags: [rh, headcount, colaboradores, cadastro, centro-custo, departamento, ficha, onedrive]
criado: 2026-07-21
atualizado: 2026-08-03
relacionado: ["[[PILAR - RH]]", "[[51 - Módulo RH — Admissão]]", "[[53 - Módulo DP — Ponto]]", "[[33 - Módulo SSMA]]", "[[03 - Páginas e Rotas]]"]
---

# Módulo RH — Colaboradores (Headcount)

> Cadastro-mestre de pessoas do TEG+. Ficha completa (dados, dependentes, documentos, treinamentos&saúde), filtros de alto nível com KPIs reativos, e o vínculo de cada colaborador a **base**, **centro de custo** e **departamento**. É a fonte que os módulos de Obras, Ponto, Frotas e Painéis consomem.

---

## Visão Geral

`rh_colaboradores` é a tabela central de RH. Um colaborador nasce na esteira de **Admissão** (etapa Registro cria o cadastro; Liberação o ativa — ver [[51 - Módulo RH — Admissão]]) e vive aqui até o desligamento. A tela de Colaboradores é o **headcount navegável**: busca, filtros avançados, KPIs, exportação e a **ficha completa** por pessoa.

### Estrutura organizacional (3 eixos, não confundir)
- **`departamento`** — o organograma (deriva do cargo). Ex.: Obras, Logística e Patrimônio, RH, TI. Valores **normalizados** (13 canônicos; ver nota abaixo).
- **`setor`** — subárea dentro do departamento (ex.: Frotas, Almoxarifado, Equipes Produção).
- **`base_id`** (`est_bases`) — a **frente/canteiro** física (fonte de obra para o Secullum).
- **`centro_custo_id`** (`sys_centros_custo`) — o rateio contábil.

> ⚠️ **Departamentos normalizados (2026-07):** duplicatas de caixa/variante foram mescladas (`OBRAS`→`Obras`, `PRODUCAO`→`Obras`). 13 valores canônicos: Adm, Compras, Contratos, Controladoria, Diretoria, EGP, Financeiro, Logística e Patrimônio, Obras, QSMA, RH, TI, TST. Ao gravar departamento, usar sempre o canônico.

> ⚠️ **Regra de Centro de Custo (`sys_centros_custo`):** áreas corporativas **CC-001…CC-020** (Diretoria, Contratos, EGP, Suprimentos|Compras/Logística/Frotas, Financeiro, Controladoria, RH, SS/MA, TI, Obras|Sala Técnica/Engenharia/Administrativo/Diretoria, Administrativo|Matriz…) e **polos CEMIG CC-101…CC-110** (Frutal, Rio Paranaíba, Paracatu, Patrocínio/Ituiutaba, Três Marias, Uberlândia, Araxá/Perdizes, Comendador Gomes…). **Corporativo** → CC pela área/departamento; **engenheiro/supervisor de obra** → **polo** (derivado da obra alocada em `obr_planejamento_equipe`); **coordenador de obra** → CC-017 Obras|Engenharia.

---

## Páginas e Componentes

### `RHColaboradoresHome.tsx` → `RHColaboradores.tsx` — `/rh/headcount/colaboradores`
Lista/headcount. Componentes-chave:
- **KPI cards (reativos ao filtro):** Ativos, CLT, PJ, Aprendiz, Admissões 30d. **Calculados sobre o conjunto filtrado** (`filtered`), então acompanham qualquer filtro.
- **Chips rápidos:** Ativos, Inativos, Processo (trabalhista), Sem CPF/Nasc., Experiência vencendo (35–45 ou 80–90 dias de admissão).
- **Filtros Avançados:** Tipo Contrato · **Departamento (multi-select popover com "Selecionar todos")** · Setor · Base · Idade min/máx · Tempo de empresa min/máx. Busca textual (nome/CPF/matrícula/cargo/email).
- **`MultiSelectField`** — componente reutilizável de multi-seleção (botão que abre popover, fecha ao clicar fora, com "Selecionar todos"). Hoje no Departamento; pronto para Setor/Base.
- **View modes** cards/tabela + **Exportar CSV**.
- Clique numa linha → `RHColaboradorDetalhe`.

### `RHColaboradorDetalhe.tsx` — ficha completa
Abas/blocos: dados pessoais, contratuais, **Dependentes**, **Documentos (OneDrive)**, **Treinamentos & Saúde** (`qsma_treinamentos`, link do certificado), movimentações. Central de Missões RH (envio de documento para assinatura no Portal).

### `RHMovimentacoes.tsx` — `/rh/headcount/movimentacoes`
Promoção, transferência, mudança de departamento, desligamento (`rh_movimentacoes`).

---

## Hooks (`src/hooks/useRH.ts`)

| Hook | Responsabilidade |
|------|------------------|
| `useRHColaboradores(filtros?)` | Lista de colaboradores (headcount) |
| `useHeadcountDataset()` | Dataset consolidado do headcount |
| `useRHColaborador(id)` | Ficha completa de um colaborador |
| `useSalvarRHColaborador()` | Cria/atualiza cadastro |
| `useDepartamentos()` | Lista de departamentos (para filtros) |
| `useRHDependentes()` / `useSalvarRHDependente()` / `useRemoverRHDependente()` | Dependentes |
| `useRHDocumentos()` / `useSalvarRHDocumento()` | Documentos |
| `useRHMovimentacoes()` / `useSalvarRHMovimentacao()` | Movimentações |
| `useRHAdmissoes()` / `useSalvarRHAdmissao()` | Ponte com admissão (legado) |
| `useRHDesligamentos()` / `useSalvarRHDesligamento()` | Desligamentos |
| `useRHStats()` | Estatísticas de RH |

---

## Schema do Banco

Tabela central: **`rh_colaboradores`**.

**Colunas-chave:**
- Identidade: `nome`, `cpf`, `matricula`, `data_nascimento`, `foto_url`
- Cargo/estrutura: `cargo`, `departamento`, `setor`, `base_id` → `est_bases`, `centro_custo_id` → `sys_centros_custo`
- Contrato: `tipo_contrato` (CLT / PJ / Aprendiz / Equipe PJ), `salario`, `data_admissao`, `data_demissao`, `motivo_demissao`, `ativo`, `status_admissao`
- Uniforme/EPI: `tamanho_camisa`, `tamanho_calca`, `tamanho_calcado` (populados pela **Mobilização** via trigger `trg_rh_mobilizacao_sync_tamanhos`)
- OneDrive: `onedrive_item_id`, `onedrive_web_url`
- Flags: `tem_processo_trabalhista`

**Tabelas satélite:** `rh_dependentes`, `rh_documentos`, `rh_movimentacoes`, `rh_desligamentos`.

> ⚠️ **Cargo é TEXTO LIVRE — não existe cadastro de cargos.** E as matrizes do QSMA casam com ele **por texto exato**, então grafia divergente faz a linha existir numa matriz e sumir na outra. A regra canônica vive em **`public.rh_cargo_normalizado(text)`** (2026-08-03): tira acento, sobe para maiúscula e **preserva o nível no fim** (I..V, NIVEL X, JR/PL/SR).
>
> **As decisões de nomenclatura vieram do HOLERITE**, que é o nome contratual — não da grafia mais frequente: `APRENDIZ` (não "Jovem/Menor Aprendiz"), `TECNICO EM SEGURANCA DO TRABALHO` (sem nível), `MOTORISTA OPERADOR DE GUINDAUTO` (mantém o "MOTORISTA"), `SERVENTE` absorve "Servente de Obras", `MOTORISTA DE CAMINHAO` absorve "Motorista". `OPERADOR DE MAQUINAS` / `PESADAS` / `DE CONSTRUCAO CIVIL` seguem **separados** (habilitação e NR diferentes).
>
> Ao mexer em cargo: rodar tudo pela função e atualizar as 4 matrizes QSMA + `rh_colaboradores` + `rh_admissao_candidatos` + `rh_ponto_dia`. **Mesclar antes de renomear** (as matrizes têm unique `(cargo, item)` e as duas grafias podem coexistir; vence `obrigatorio`). **NÃO tocar** em `rh_movimentacoes`, `qsma_os_seguranca` e `rh_admissao_pareceres` — guardam o cargo da época. A função **não roda sozinha**: a admissão continua gravando texto livre.

> ⚠️ **Analisar sempre com `ativo = true`.** São 827 cadastros para **349 ativos** — 478 desligados inflam qualquer diagnóstico de cargo (82 → 51 cargos distintos).

> ⚠️ **Matrícula:** única; **PJ não tem matrícula**. A matrícula canônica é o "REGISTRO DE EMPREGADO Nº" da Ficha de Empregado (Domínio) — não inventar sequência.

---

## Integração com Outros Módulos e Externos

| Alvo | Integração |
|------|-----------|
| **RH Admissão** | O cadastro nasce no Registro e é ativado na Liberação. Ver [[51 - Módulo RH — Admissão]] |
| **DP Ponto** | `rh_ponto_linkcolab` liga func↔colaborador; **base e CC do HHt vêm daqui**. Ver [[53 - Módulo DP — Ponto]] |
| **Obras** | Fonte de colaboradores para `obr_planejamento_equipe`; base_id → frente de trabalho. Ver [[32 - Módulo Obras]] |
| **SSMA / Treinamentos** | Bloco Treinamentos & Saúde lê `qsma_treinamentos`. Ver [[33 - Módulo SSMA]] |
| **Portal TEG** | Central de Missões RH (`rh_missao_enviar`) para assinatura de documentos |
| **OneDrive (Graph)** | Edge `rh-colaborador-onedrive` resolve a pasta por nome e persiste `onedrive_item_id`/`web_url` |
| **Estrutura** | `est_bases` (frentes/canteiros) e `sys_centros_custo` (áreas + polos) |

---

## Armadilhas conhecidas (para evolução segura)

1. **Departamento** deve ser gravado no valor **canônico** (a normalização de 2026-07 mesclou variantes de caixa).
2. **CC de obra é polo, não área** — engenheiros/supervisores de campo vão para o polo CEMIG (derivado da obra alocada), não para "Obras|Administrativo".
3. **PJ** entram no rateio de CC pela área, mas **sem matrícula** e frequentemente **sem base** (cargo de confiança/não bate ponto).
4. **Não preencher salário de PJ** no `rh_colaboradores` (valores individuais de equipe PJ vivem em `con_equipe_pj` — ver Contratos).

---

## Links Relacionados

- [[PILAR - RH]] — Pilar RH
- [[51 - Módulo RH — Admissão]] — Origem do cadastro
- [[53 - Módulo DP — Ponto]] — Consome base/CC do cadastro
- [[33 - Módulo SSMA]] — Treinamentos & saúde
- [[32 - Módulo Obras]] — Alocação de equipe
- [[03 - Páginas e Rotas]] — Rotas do módulo
