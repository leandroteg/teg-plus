---
title: Módulo QSMA — EPI, EPC e Ordem de Serviço
type: modulo
modulo: qsma-epi-epc-os
status: ativo
tags: [qsma, sst, epi, epc, ordem-de-servico, nr-01, nr-06, matriz, assinatura, portal]
criado: 2026-08-03
atualizado: 2026-08-03
relacionado: ["[[33 - Módulo SSMA]]", "[[54 - Módulo QSMA — Matriz de Treinamentos]]", "[[51 - Módulo RH — Admissão]]", "[[52 - Módulo RH — Colaboradores]]", "[[PILAR - RH]]"]
---

# Módulo QSMA — EPI, EPC e Ordem de Serviço

> A outra metade da Segurança (SST) do QSMA, ao lado dos treinamentos. Define **o que cada cargo usa (EPI)**, **quais medidas coletivas se aplicam (EPC)** e emite a **Ordem de Serviço (NR-01)** — o documento que o colaborador assina declarando ciência dos riscos da função.

---

## Visão Geral

Quatro matrizes por **cargo-base** alimentam os dois documentos que o colaborador assina:

| Matriz | Tabela | Célula |
|---|---|---|
| Riscos | `qsma_matriz_risco` | risco + fonte geradora + medidas administrativas |
| EPI | `qsma_matriz_epi` | quantidade (· → 1 → 2) |
| **EPC** | `qsma_matriz_epc` | binária (✓ / ·) |
| Treinamentos | `qsma_matriz_treinamento` | Obrigatório / N.A. |

Os documentos:
- **Ficha de EPI** — o que foi entregue, com tamanho. Assinada no Portal TEG.
- **Ordem de Serviço (NR-01)** — riscos da função, EPI, EPC, treinamentos e diretrizes de SST.

---

## Matriz de EPI e EPC (mesma tela, duas visões)

`QsmaSeguranca.tsx` → aba **EPIs** → sub-aba **Matriz**, com toggle **EPI | EPC**.
Linhas = cargos (união de `qsma_matriz_epi` + `qsma_matriz_treinamento`); colunas = itens do catálogo.

> ⚠️ **EPC não tem quantidade.** Ou a medida coletiva se aplica à função ou não — por isso a célula é binária, diferente da de EPI que cicla `· → 1 → 2`.

### Cadastro de EPC (`qsma_epcs`)

Criado em 2026-08-03. Antes disso a proteção coletiva era **texto livre digitado a cada OS**, o que na prática deixava a coluna vazia. Os **30 itens iniciais foram extraídos das OS assinadas do OneDrive** — nenhum inventado.

Quatro categorias (`categoria`), que colorem a coluna na matriz:

| categoria | exemplos |
|---|---|
| `procedimento` | Análises preliminares de riscos, POPs, DDS, Permissões e Liberações para Trabalhos Seguros, Trabalho sem Energia Viva |
| `engenharia` | Mecanismos para constatação de ausência de Tensão, Proteção de elementos energizados dentro da Zona Controlada, Pisos sem saliência |
| `administrativa` | Pausas periódicas, Rodízio e alternância entre posições, Fixar posição fora do raio de ação |
| `sinalizacao` | Sinalização de segurança, Sinalização quanto a diferenças de níveis |

### Como a matriz de EPC foi preenchida

Comparando as OS reais, os EPC do Topógrafo são **subconjunto** dos do Montador, e são exatamente os ergonômicos/procedimentais. Conclusão: **o EPC segue o RISCO, não o cargo**. O preenchimento inicial (34 cargos, 661 marcações) foi derivado de `qsma_matriz_risco` por gatilhos:

| gatilho | dispara em |
|---|---|
| `universal` (9 itens) | sempre |
| `eletrico` (8) | Choques Elétricos, Arco Elétrico |
| `ergonomico` (7) | qualquer risco do grupo Ergonômico |
| `queda` (3) | Trabalho em altura, Queda no mesmo nível, Queda de objetos |
| `maquina` (2) | Máquinas Rotativas, Ferramentas Manuais, Prensamento, Projeção de fragmentos |
| `transito` (1) | Acidentes de Trânsito |

Conferido contra a OS assinada do Montador: **29 dos 30 itens bateram**.

---

## Ordem de Serviço (NR-01)

`OsSegurancaModal.tsx` + `utils/os-seguranca-pdf.ts`, gravada em `qsma_os_seguranca`.
Aberta pela coluna **OS** em Treinamentos › Integração. Todos os campos são **editáveis** antes de emitir; há **Ver prévia** que abre o PDF sem salvar.

### Riscos agrupados por tipo

A tabela de riscos sai agrupada na ordem do modelo do SESMT:

**Físico → Químico → Biológico → Ergonômico → Acidente**

A classificação vem de `qsma_riscos.grupo` (já existia; até 2026-08-03 não era lida e a tabela saía achatada). Risco acrescentado à mão no modal tem `<select>` de tipo, e o que ficar sem cai em "Outros" no fim.

Constante `ORDEM_TIPO_RISCO` + helper `ordenaPorTipo()` em `useQsma.ts`.

### Cabeçalho

Matrícula · Cargo · Setor · **CBO** · Admissão. O CBO vem de `rh_colaboradores.cbo`, extraído da **FICHA DE REGISTRO** (não da Ficha de Empregado da contabilidade, cujo texto sai fora de ordem).

---

## Ficha de EPI — assinatura no Portal

Fluxo reaproveitado do de assinaturas (`rh_missao_enviar` → `sig_documento` + `portalteg_missoes` categoria `assinaturas` → `/assinar/:id` → edge `sig-assinatura` → `sig_registrar_assinatura`). **Só o colaborador assina.**

Estados do ícone na coluna Ficha de EPI (Integração):

| ícone | significado |
|---|---|
| vermelho | sem ficha |
| laranja | criada, falta enviar |
| âmbar | enviada, aguardando assinatura |
| **verde** | assinada ou arquivada — **clicar baixa o arquivo assinado** |

> ⚠️ **Bucket do documento assinado é `rh-admissao-docs`, não `qsma-evidencias`.** Usar `docAssinadoUrl()`; ler do bucket errado devolve `null` em silêncio e o ícone verde "não faz nada".

> ⚠️ **Anexar Ficha Manual** é o caminho para documento no **formato antigo já assinado**: vai direto para verde e **não exige tamanho** (a exigência de tamanho vale só para gerar ficha nova).

> ⚠️ **Formato antigo conta como resolvido.** Quem tem o documento anexado em `rh_admissao_treinamentos` já está em dia, mesmo sem registro na tabela nova. Tratar só o formato novo faz 255 fichas `arquivada` voltarem a aparecer como pendentes.

---

## Schema

| Tabela | Papel |
|---|---|
| `qsma_riscos` | catálogo de 32 riscos, com `grupo` (Físico/Químico/Biológico/Ergonômico/Acidente) |
| `qsma_matriz_risco` | cargo × risco + `fontes` + `medidas_administrativas` |
| `qsma_epis` / `qsma_matriz_epi` | catálogo e matriz de EPI |
| **`qsma_epcs`** | catálogo de medidas coletivas (`nome`, `categoria`, `descricao`, `ativo`) |
| **`qsma_matriz_epc`** | cargo × EPC, unique `(cargo, epc_id)` |
| `qsma_epi_fichas` | ficha de entrega + `missao_id` + `arquivo_assinado_path` |
| `qsma_os_seguranca` | OS emitida (snapshot: `cargo`, `setor`, `matricula`, `dados` jsonb) |

RLS igual às demais do módulo: `select` livre, escrita por `can_access_modulo('qsma', auth.uid())`.

---

## Armadilhas conhecidas

1. **Cargo casa por TEXTO EXATO** entre as matrizes. Grafia divergente faz a linha existir numa e sumir na outra. Normalizar por `rh_cargo_normalizado()` — ver [[52 - Módulo RH — Colaboradores]].
2. **PostgREST corta em 1000 linhas, sem erro.** `useTreinamentos` e `useEpiEntregas` paginam com `.range()`. Já causou 615 OS e 2.891 entregas invisíveis.
3. **`qsma_riscos.controles` está vazio em toda a base.** A medida que a OS mostra vem de `qsma_matriz_risco.medidas_administrativas`; a fonte geradora, de `fontes`.
4. **O rodapé do PDF colide com o carimbo da assinatura.** Os PDFs de ficha e OS não têm rodapé de propósito, e a assinatura é centralizada.
5. **`qsma_os_seguranca.cargo` é snapshot** do documento emitido — não normalizar junto com o cadastro vigente.

---

## Estado (2026-08-03)

- OS fecha completa para **9 cargos** (~140 pessoas ativas).
- **`SERVENTE` — 113 ativos, ZERO riscos na matriz.** É o maior cargo da empresa e a OS **não emite** (o modal exige ≥ 1 risco). Tem EPI e treinamento configurados; só a matriz de riscos ficou para trás.
- Outros sem risco: Encarregado de Montagem LD (12), Mestre Civil (8), Técnico em Segurança do Trabalho (7), Topógrafo (6), Supervisor de Obras (5), Engenheiro Eletricista (4).
- `Choques Elétricos` é o único risco do Montador **sem medida administrativa**.
- Pendente: salvar o assinado no OneDrive ao finalizar a integração (worker SuperTEG, nos moldes do `finalizar_worker.py`).

---

## Links Relacionados

- [[33 - Módulo SSMA]] — módulo QSMA (pai)
- [[54 - Módulo QSMA — Matriz de Treinamentos]] — a outra matriz por cargo
- [[51 - Módulo RH — Admissão]] — Integração (etapa 8) é onde a ficha e a OS aparecem
- [[52 - Módulo RH — Colaboradores]] — cargo, CBO e normalização
