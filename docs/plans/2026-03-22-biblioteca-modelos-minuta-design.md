# Design: Biblioteca de Modelos de Minuta por Tipo de Contrato

**Data:** 2026-03-22
**Status:** Aprovado

## Contexto

O módulo Contratos possui 27 categorias hardcoded no frontend, mas o banco aceita apenas 7 (constraint desatualizada). A aba Modelos já existe (`con_modelos_contrato`) mas não tem vínculo com tipo de contrato nem upload de arquivo template. O objetivo é padronizar os tipos, vincular modelos a cada tipo e permitir que na elaboração de minuta o usuário escolha um template da biblioteca.

## Decisões

- **Agrupar** as 27 categorias em 12 grupos por semelhança
- **Upload de arquivo** (PDF/DOCX) como template base no modelo
- **Aproveitar** a aba Modelos existente, adicionando campos
- **Substituir** `categoria_contrato` por `grupo_contrato` + `subtipo_contrato`

## 12 Grupos Padronizados

| # | Slug (`grupo_contrato`) | Label | Subtipos |
|---|---|---|---|
| 1 | `locacao_imovel` | Locação de Imóvel | alojamento, canteiro, deposito |
| 2 | `locacao_veiculos` | Locação de Veículos | — |
| 3 | `locacao_equipamentos` | Locação de Equipamentos/Máquinas | equipamentos, ferramental |
| 4 | `equipe_pj` | Equipe PJ | — |
| 5 | `prestacao_servicos` | Prestação de Serviços | terceiros, pontual |
| 6 | `servico_recorrente` | Serviço Recorrente | vigilancia, ti, contabilidade, telefonia |
| 7 | `aquisicao` | Aquisição | equipamentos, veiculos, imovel, ferramental |
| 8 | `subcontratacao_empreitada` | Subcontratação / Empreitada | subcontratacao, empreitada |
| 9 | `consultoria_juridico` | Consultoria / Jurídico | consultoria, advocacia |
| 10 | `apoio_operacional` | Apoio Operacional | alimentacao, hospedagem, frete |
| 11 | `seguros` | Seguros | — |
| 12 | `outro` | Outro | — |

## Alterações

### Banco de Dados

1. **`con_modelos_contrato`** — adicionar colunas:
   - `grupo_contrato TEXT` — vínculo com grupo (obrigatório)
   - `arquivo_url TEXT` — URL do template PDF/DOCX no storage
   - `versao INT DEFAULT 1` — controle de versão

2. **`con_solicitacoes`** — alterar constraint:
   - Remover `categoria_contrato` CHECK antigo (7 valores)
   - Adicionar `grupo_contrato TEXT NOT NULL` com CHECK dos 12 grupos
   - Adicionar `subtipo_contrato TEXT` (opcional, livre)

3. **Migração de dados**: mapear registros existentes com `categoria_contrato` para os novos grupos

### Frontend

1. **`NovaSolicitacao.tsx`**:
   - Substituir 27 categorias por select de 12 grupos
   - Adicionar select de subtipo (dinâmico por grupo)
   - Campo salva `grupo_contrato` + `subtipo_contrato`

2. **`ModelosContrato.tsx`** (aba Modelos):
   - Adicionar campo "Grupo de Contrato" (select dos 12 grupos)
   - Adicionar upload de arquivo template (PDF/DOCX)
   - Mostrar versão e permitir upload de nova versão
   - Filtro por grupo na listagem

3. **`PreparaMinuta.tsx`**:
   - Na elaboração, buscar modelos pelo `grupo_contrato` da solicitação
   - Mostrar lista de modelos disponíveis com versão
   - Ao selecionar, copiar arquivo do modelo como base da minuta

4. **Types** (`contratos.ts`):
   - Substituir `CategoriaContrato` por `GrupoContrato`
   - Adicionar tipo `SubtipoContrato`

### Storage

- Bucket: `contratos-anexos/modelos/` para templates de modelos

## Fluxo do Usuário

```
NovaSolicitação
  └─ Step 1: Seleciona grupo ("Locação de Imóvel")
  └─ Step 1: Seleciona subtipo ("Alojamento") — opcional
  └─ ... demais steps normais

PreparaMinuta (etapa preparar_minuta)
  └─ Sistema filtra con_modelos_contrato WHERE grupo_contrato = solicitacao.grupo_contrato
  └─ Lista: "Contrato Padrão Locação v3", "Contrato Simplificado v1"
  └─ Usuário escolhe modelo → arquivo copiado para minutas da solicitação
  └─ Pode editar/ajustar a partir do template

Aba Modelos (admin/gerente)
  └─ CRUD de modelos com grupo + upload de arquivo
  └─ Versionamento: nova versão = novo upload mantendo histórico
```
