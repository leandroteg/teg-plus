# Design: Sistema de Permissões Granulares

**Data:** 2026-03-22
**Status:** Aprovado

## Contexto

O sistema atual tem 6 roles (admin, gerente, aprovador, comprador, requisitante, visitante) mas na prática só admin está em uso. Precisamos de um sistema de permissões mais claro, com 5 perfis hierárquicos e controle granular por módulo, incluindo escopo por grupo de contrato.

## 5 Perfis

| # | Perfil | Nível | Descrição |
|---|---|---|---|
| 5 | **Administrador** | 5 | Acesso total: vê, solicita, edita, apaga, aprova tudo em todos os módulos |
| 4 | **Diretor** | 4 | Vê tudo, solicita tudo, edita/apaga em módulos específicos, aprova pela sua política/alçada |
| 3 | **Gestor** | 3 | Vê módulos selecionados, solicita/requisita nos seus módulos, edita/apaga específicos, aprova pela alçada |
| 2 | **Requisitante** | 2 | Vê/requisita/edita em módulos específicos, sem aprovação, arquivos privados restritos (Gestor+) |
| 1 | **Visitante** | 1 | Visualização limitada, sem ações |

## Mapeamento de Roles Antigos

| Role Antigo | Perfil Novo |
|---|---|
| admin | administrador |
| gerente | diretor |
| aprovador | gestor |
| comprador | gestor |
| requisitante | requisitante |
| visitante | visitante |

## Matriz de Permissões por Perfil

### Ações disponíveis:
- `visualizar` — ver dados e listas
- `criar` — criar novas solicitações/requisições/registros
- `editar` — modificar registros existentes
- `excluir` — apagar registros
- `aprovar` — aprovar/rejeitar solicitações e fluxos

### Por módulo:

| Módulo | Administrador | Diretor | Gestor | Requisitante | Visitante |
|---|---|---|---|---|---|
| **Compras** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **Financeiro** | Tudo | ver, criar, aprovar | ver, criar | ver | — |
| **Estoque** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **Logística** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **Frotas** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **Contratos** | Tudo | ver, criar, aprovar | ver, criar, editar (escopo grupo) | ver, criar (escopo grupo) | ver |
| **Fiscal** | Tudo | ver, aprovar | ver, criar | ver | — |
| **Controladoria** | Tudo | Tudo | ver | — | — |
| **PMO/EGP** | Tudo | Tudo | ver, criar, editar | ver | — |
| **Obras** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **SSMA** | Tudo | Tudo | ver, criar, editar | ver, criar | ver |
| **Cadastros** | Tudo | ver, criar, editar | ver | ver | — |

### Contratos — Escopo por grupo:

Para perfis **Gestor** e **Requisitante**, o admin pode restringir quais `grupo_contrato` o usuário acessa. Se nenhum grupo definido → acessa todos os que o módulo permite.

Armazenado em `sys_perfis.permissoes_contratos` (JSONB):
```json
{
  "grupos_permitidos": ["locacao_imovel", "prestacao_servicos"],
  "pode_aprovar": false
}
```

## Alterações no Banco

### 1. Migrar role values
```sql
UPDATE sys_perfis SET role = CASE role
  WHEN 'admin' THEN 'administrador'
  WHEN 'gerente' THEN 'diretor'
  WHEN 'aprovador' THEN 'gestor'
  WHEN 'comprador' THEN 'gestor'
  WHEN 'requisitante' THEN 'requisitante'
  WHEN 'visitante' THEN 'visitante'
  ELSE role
END;
```

### 2. Alterar CHECK constraint
```sql
ALTER TABLE sys_perfis DROP CONSTRAINT IF EXISTS sys_perfis_role_check;
ALTER TABLE sys_perfis ADD CONSTRAINT sys_perfis_role_check
  CHECK (role IN ('administrador','diretor','gestor','requisitante','visitante'));
```

### 3. Adicionar coluna permissoes_contratos
```sql
ALTER TABLE sys_perfis ADD COLUMN IF NOT EXISTS permissoes_contratos JSONB DEFAULT '{}'::jsonb;
```

### 4. Atualizar funções RLS
- `auth_role()` — sem mudança (retorna o role)
- `auth_at_least()` — atualizar mapeamento de níveis para novos nomes
- `is_admin()` — verificar `role = 'administrador'`

## Alterações no Frontend

### 1. AuthContext
- Atualizar `Role` type: `'administrador' | 'diretor' | 'gestor' | 'requisitante' | 'visitante'`
- Atualizar `ROLE_LABEL` e `ROLE_NIVEL`
- Adicionar `canDo(modulo, acao)` → consulta matriz de permissões
- Adicionar `gruposContratoPermitidos()` → retorna grupos do JSONB

### 2. AdminUsuarios
- Atualizar botões de role para os 5 novos perfis
- Adicionar seção "Permissões Contratos" quando módulo contratos habilitado:
  - Checkboxes dos 12 grupos de contrato
  - Toggle "Pode aprovar"

### 3. Módulos
- Substituir `atLeast('gerente')` por `canDo('modulo', 'acao')` gradualmente
- No módulo contratos, filtrar por `gruposContratoPermitidos()` quando Gestor/Requisitante

## Fluxo de Cadastro

```
AdminUsuarios → Editar Usuário
  ├─ Nome, Email, Cargo, Departamento
  ├─ Perfil: [Administrador | Diretor | Gestor | Requisitante | Visitante]
  ├─ Alçada: [Sem | Coordenador | Gerente | Diretor | CEO]
  ├─ Módulos Habilitados: [checkboxes]
  └─ Se módulo Contratos habilitado:
     ├─ Grupos Permitidos: [checkboxes dos 12 grupos]
     └─ Pode Aprovar: [toggle]
```


## Links
- [[obsidian/09 - Auth Sistema]]
