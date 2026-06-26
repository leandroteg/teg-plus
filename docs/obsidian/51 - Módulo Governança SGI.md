---
title: Módulo Governança / SGI
type: modulo
modulo: sgi
status: ativo
tags: [sgi, governanca, iso9001, pdca, melhoria-continua, padronizacao, objetivos, missoes, documentos]
criado: 2026-06-26
atualizado: 2026-06-26
relacionado: ["[[00 - TEG+ INDEX]]", "[[49 - SuperTEG AI Agent]]", "[[PILAR - RH]]"]
---

# Módulo Governança / SGI

> Sistema de Gestão Integrado (SGI) voltado a superar o SGI360. Pilar **Governança** do TEG+ ERP. Accent cor violeta. Fases 1–3 implementadas e em produção.

---

## Visão Geral

O módulo SGI organiza a gestão da qualidade e governança corporativa em 4 disciplinas:

1. **Padronização** — controle documental ISO 9001 (políticas, processos, procedimentos, formulários)
2. **Melhoria Contínua** — kanban PDCA + registro de ações
3. **Objetivos e Metas** — farol de indicadores com check-ins mensais e gatilho de alerta
4. **(Futuro) Auditoria/Segurança** — reutiliza `sgi_acoes`, não implementado ainda

---

## Estrutura de Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/sgi` | `SgiPainel` / `SgiPainelMobile` | Dashboard executivo de metas e indicadores |
| `/sgi/novo` | `SgiNovoRegistro` | Novo registro de ação / ocorrência |
| `/sgi/objetivos` | `SgiObjetivos` | Objetivos e Metas com farol |
| `/sgi/melhoria` | `SgiMelhoriaContinua` | Kanban PDCA de ações |
| `/sgi/padronizacao` | `SgiPadronizacao` | Gestão documental ISO 9001 |

**Layout:** `SgiLayout` (accent violeta; sidebar com 5 itens acima).

---

## Tela: Painel (`SgiPainel.tsx`)

Dashboard de metas anuais dividido em 2 blocos lado a lado de igual altura:

### Bloco esquerdo — Resultados Principais (1 linha, 3 cards grandes)
| Meta | Indicador |
|------|-----------|
| Produção | R$ faturado acumulado (fonte: EGP painel) |
| Lucratividade | Margem líquida % |
| Acidentes | Nº de acidentes com afastamento |

### Bloco direito — Pessoas & Crescimento (grid 2×2)
| Meta | Indicador |
|------|-----------|
| Produtividade | R$/HH |
| Novos Contratos | Nº de contratos novos |
| Turnover | % de desligamentos |
| Clima | NPS interno |

**Números grandes** (`text-5xl sm:text-6xl`) nos 3 cards do bloco esquerdo; `text-3xl` nos demais.

Check-ins de meta são registrados via `sgi_resultados` (um por mês por meta). A aba Produção do EGP é a fonte primária do valor de faturamento para o check-in de Produção.

---

## Tela: Padronização (`SgiPadronizacao.tsx`)

Controle documental no padrão ISO 9001. Abas:

| Aba (status) | Label UI | Conteúdo |
|-------------|---------|---------|
| `vigente` | Políticas e Processos | Documentos publicados/vigentes |
| `rascunho` | Em elaboração | Documentos em rascunho |
| `obsoleto` | Obsoletos | Histórico |

**Tipos de documento:**
- `politica` — Política corporativa
- `processo` — Processo (macro)
- `procedimento` — Procedimento operacional (POP/IT)
- `formulario` — Formulário padrão
- `instrucao` — Instrução de trabalho

**Campos principais de `portalteg_documentos`:**

| Campo | Descrição |
|-------|-----------|
| `codigo` | Código ISO (ex: POL-001, PRO-RH-001) |
| `titulo` | Título do documento |
| `tipo` | politica / processo / procedimento / formulario / instrucao |
| `categoria` | Setor/área (ex: RH, Obras, Financeiro) |
| `versao` | Número da versão |
| `status` | vigente / rascunho / obsoleto |
| `requer_ciencia` | boolean — exige confirmação do colaborador |
| `arquivo_url` | Link do arquivo (OneDrive / Storage) |
| `ordem` | Ordenação numérica dentro do tipo+categoria |

**Trigger:** `fn_portalteg_docs_unica_versao_ativa` — mantém apenas 1 documento ativo por `(tipo, categoria)`.

**Modal de edição:** footer com botão "Abrir documento" (linha própria) + "Publicar/Republicar" e "Fechar" (linha inferior em `flex gap-2`).

---

## Tela: Objetivos e Metas (`SgiObjetivos.tsx`)

- Lista de metas anuais com farol de status (verde/amarelo/vermelho)
- Gatilho automático de alerta quando meta está abaixo do limite
- Integração com check-ins mensais de `sgi_resultados`

---

## Tela: Melhoria Contínua (`SgiMelhoriaContinua.tsx`)

- Kanban PDCA: colunas Plan / Do / Check / Act
- Cada card = uma ação (`sgi_acoes`) com responsável, prazo, status, evidências
- Ações podem ser originadas de auditorias, não-conformidades ou oportunidades de melhoria

---

## Schema do Banco

Prefixo: `sgi_`

| Tabela | Descrição |
|--------|-----------|
| `sgi_objetivos` | Objetivos/metas anuais com título, tipo, unidade, alvo |
| `sgi_resultados` | Check-ins mensais de resultado por objetivo |
| `sgi_acoes` | Ações do PDCA (melhoria, auditoria, NC) |
| `sgi_documentos` | (legado/planejado) — controle documental próprio do SGI |

**Tabelas compartilhadas:**

| Tabela | Origem | Uso |
|--------|--------|-----|
| `portalteg_documentos` | Portal TEG | Documentos publicados (Padronização) |
| `portalteg_missoes` | Portal TEG | Missões do colaborador (ciência de documentos) |

---

## Missões e Ciência de Documentos

Quando um documento é publicado com `requer_ciencia = true`:
- RPC `portalteg_documentos_lista(p_tipo)` lista documentos por tipo
- Uma missão é criada em `portalteg_missoes` para cada colaborador elegível
- O colaborador confirma ciência pelo **Portal TEG** (botão Missões)
- O SGI acompanha a adesão via painel de missões

> Tela de Missões do colaborador no Portal TEG está na branch `claude/musing-perlman` (não mergeada na main ainda).

---

## Integração com Outros Módulos

| Módulo | Integração |
|--------|-----------|
| **Portal TEG** | Missões de ciência de documentos; procedimentos publicados aqui aparecem lá |
| **EGP/PMO** | Aba Produção do EGP alimenta check-in de meta de Produção do SGI |
| **RH** | Procedimentos de RH cadastrados na Padronização e espelhados no Portal |
| **Painéis** | `SgiPainel` registrado no hub `/paineis` (pilar Governança) |

---

## Procedimentos de RH (Jun/2026)

Procedimentos cadastrados na aba "Políticas e Processos" (tipo `procedimento`, categoria `RH`), numerados e ordenados por setor seguindo ISO 9001:

- Arquivo em `G:\Meu Drive\20_TEG UNIÃO\07 - RH\Procedimentos\v1\`
- Espelhados no Portal TEG (sem exigir ciência)
- Ordenação numérica por setor via campo `ordem`

---

## Links Relacionados

- [[49 - SuperTEG AI Agent]] — Missões e publicação de documentos via RPC
- [[PILAR - RH]] — Procedimentos RH padronizados aqui
- [[31 - Módulo PMO-EGP]] — Fonte do check-in de Produção
