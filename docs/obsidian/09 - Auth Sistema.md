---
title: Auth Sistema
type: segurança
status: ativo
tags: [auth, supabase, autenticação, permissões, roles, rbac]
criado: 2026-03-02
atualizado: 2026-04-08
relacionado: ["[[06 - Supabase]]", "[[02 - Frontend Stack]]", "[[03 - Páginas e Rotas]]"]
---

# Auth Sistema — TEG+ ERP

## Visão Geral

```mermaid
flowchart TD
    U[Usuário] --> L[/login]
    L -->|Email + Senha| SP[Supabase Auth\nsignIn]
    L -->|Magic Link| ML[Supabase Auth\nsignInMagicLink]
    ML -->|Email enviado| EMAIL[Link no email]
    EMAIL -->|Clique| CB[Callback Auth]
    SP --> CB
    CB --> AP[Auto-provisioning\nPerfil criado se não existe]
    AP --> SPW{senha_definida?}
    SPW -->|Não| SET[SetPasswordModal]
    SET --> MOD[ModuloSelector]
    SPW -->|Sim| MOD
    MOD --> MR[ModuleRoute\nhasModule check]
    MR --> LAYOUT[Layout do Módulo]
```

---

## Métodos de Autenticação

| Método | Função | Uso |
|--------|--------|-----|
| Email + Senha | `signIn(email, password)` | Login padrão |
| Magic Link | `signInMagicLink(email)` | Sem senha (primeiro acesso) |
| Reset Senha | `resetPassword(email)` | Recuperação |
| Update Senha | `updatePassword(newPassword)` | Troca de senha |
| Logout | `signOut()` | Encerrar sessão |

---

## AuthContext (`contexts/AuthContext.tsx`)

Provider global que expõe:

```ts
interface AuthContextType {
  user: User | null           // Supabase auth user
  perfil: Perfil | null       // Perfil do sistema
  session: Session | null     // Sessão Supabase
  loading: boolean            // Estado de carregamento
  perfilReady: boolean        // Perfil carregado com sucesso

  // Auth methods
  signIn: (email, password) => Promise<{ error: string | null }>
  signInMagicLink: (email) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email) => Promise<{ error: string | null }>
  updatePassword: (newPassword) => Promise<{ error: string | null }>

  // Perfil methods
  updatePerfil: (dados) => Promise<{ error: string | null }>
  reloadPerfil: () => Promise<void>
  markSenhaDefinida: () => Promise<{ error: string | null }>

  // Password reset state
  pendingPasswordReset: boolean
  clearPasswordReset: () => void

  // RBAC helpers
  role: Role
  roleLabel: string
  isAdmin: boolean
  isGerente: boolean
  canManage: boolean
  hasModule: (mod: string) => boolean
  canApprove: (nivel: number) => boolean
  atLeast: (role: Role) => boolean
}
```

**Session management:**
- `onAuthStateChange` subscription ativa durante toda a sessão
- Timeout de segurança: 8s para conexões lentas
- Graceful handling de usuários deletados do banco

---

## RBAC v2 — Sistema de Permissões

O TEG+ implementa um sistema RBAC (Role-Based Access Control) com **duas camadas**: roles legados e PapelGlobal.

### Roles Legados (6 Roles)

Roles do campo `sys_perfis.role`:

| Role | ROLE_NIVEL | Descrição |
|------|-----------|-----------|
| `admin` | 5 | Acesso total ao sistema |
| `gerente` | 4 | Gerencia requisições e aprovações |
| `aprovador` | 3 | Pode aprovar requisições |
| `comprador` | 2 | Acessa fila de cotações, emite pedidos |
| `requisitante` | 1 | Cria requisições |
| `visitante` | 0 | Leitura apenas |

> **`PAPEL_TO_LEGACY_ROLE`** — mapa de PapelGlobal → Role legado usado em `atLeast()`. Correção aplicada em 2026-04-07: `supervisor` agora mapeia para `'supervisor'` (nível 4), e não mais para `'gestor'` (nível 3) como era antes.

### PapelGlobal — Hierarquia Unificada

O PapelGlobal é a hierarquia de cargos usada transversalmente em todos os módulos:

| PapelGlobal | Nível | Escopo |
|-------------|-------|--------|
| `ceo` | 7 | Aprovação final, visão completa |
| `admin` | 6 | Acesso total ao sistema |
| `diretor` / `gerente` | 5 | Aprovação de todos os níveis |
| `supervisor` / `aprovador` | 4 | Aprovação N1 |
| `gestor` / `equipe` / `comprador` | 3 | Operação do módulo |
| `requisitante` | 2 | Criação de solicitações |
| `visitante` | 1 | Leitura apenas |

### RBAC v2 — Tabelas (Planejado)

```
sys_perfil_setores    → Vínculo usuário ↔ setor/módulo com papel específico
sys_roles             → Definição de roles customizados
sys_role_permissoes   → Permissões granulares por role
```

> **Status:** A estrutura RBAC v2 com tabelas dedicadas está planejada. Atualmente, o controle é feito via `sys_perfis.role` + `sys_perfis.modulos` + helpers no `AuthContext`.

> **permissoes_especiais.modulo_papeis** — campo JSON em `sys_perfis` que permite atribuir um PapelGlobal por módulo sem precisar do RBAC v2 completo:
> ```json
> { "modulo_papeis": { "contratos": "supervisor", "fiscal": "gestor" } }
> ```
> Usado como fallback em `papelGlobal`, `hasSetorPapel` e `canTechnicalApprove`.

---

## Helpers de Permissão

### `hasModule(mod: string)`

Verifica se o usuário tem acesso a um módulo específico.

```ts
// Implementação
hasModule: (mod) => {
  if (role === 'admin') return true
  return perfil?.modulos?.[mod] === true
}
```

O campo `modulos` em `sys_perfis` é um `Record<string, boolean>`:
```json
{ "compras": true, "financeiro": true, "estoque": false }
```

### `atLeast(role: Role)`

Verifica se o role atual é pelo menos tão alto quanto o informado.

```ts
atLeast: (r) => ROLE_NIVEL[role] >= ROLE_NIVEL[r]
```

**Exemplos:**
```ts
atLeast('gerente')     // admin(5) >= gerente(4) → true
atLeast('aprovador')   // comprador(2) >= aprovador(3) → false
```

### `canApprove(nivel: number)`

Verifica se o usuário pode aprovar no nível de alçada informado.

```ts
canApprove: (nivel) => role === 'admin' || (perfil?.alcada_nivel ?? 0) >= nivel
```

**Regras de aprovação:**
| Quem | Pode aprovar |
|------|-------------|
| Admin / CEO | Todos os níveis (sempre) |
| Diretor | Todos os níveis (alçada 3+) |
| Supervisor | Apenas N1 (alçada 1) |
| Demais | Conforme `alcada_nivel` |

### `getPapelForModule(moduleKey: string)`

Retorna o papel específico do usuário para um módulo (override por módulo).

```ts
// Exemplo: usuário é requisitante globalmente, mas supervisor em contratos
getPapelForModule('contratos') // → 'supervisor'
```

### `hasSetorPapel(mod, papeis[])`

Verifica se o usuário possui um dos papéis especificados no módulo informado. Prioridade:
1. RBAC v2 (`sys_perfil_setores`) — se ativo
2. `permissoes_especiais.modulo_papeis[mod]` — fallback sem RBAC v2
3. PapelGlobal — último fallback

### `canTechnicalApprove(mod)`

Usado no fluxo de validação técnica (aprovação não-financeira). Verifica, em ordem:
1. `permissoes_especiais.modulo_papeis[mod]` ∈ `{supervisor, diretor, ceo}`
2. PapelGlobal ≥ supervisor

Permite que equipe técnica valide documentos, laudos ou checklists sem autoridade de alçada financeira.

---

## Alçadas de Aprovação

| Nível | Cargo | Limite Inferior | Limite Superior |
|-------|-------|----------------|----------------|
| 0 | Sem alçada | — | — |
| 1 | Coordenador | R$ 0 | R$ 5.000 |
| 2 | Gerente | R$ 5.001 | R$ 25.000 |
| 3 | Diretor | R$ 25.001 | R$ 100.000 |
| 4 | CEO | R$ 100.001 | Sem limite |

Ver [[13 - Alçadas]] para detalhes completos.

---

## Perfil do Usuário (`sys_perfis`)

```ts
interface Perfil {
  id: string              // UUID do perfil
  auth_id: string         // = auth.uid()
  nome: string
  email: string
  cargo: string | null
  departamento: string | null
  avatar_url: string | null
  role: Role              // admin | gerente | aprovador | comprador | requisitante | visitante
  alcada_nivel: number    // 0-4
  modulos: Record<string, boolean>  // { compras: true, financeiro: false, ... }
  preferencias: Record<string, unknown>
  ativo: boolean
  senha_definida: boolean // Tracking de primeiro acesso
  ultimo_acesso: string | null
  created_at: string
  updated_at: string
}
```

---

## ROLE_NIVEL — Constantes

```ts
export const ROLE_NIVEL: Record<Role, number> = {
  admin: 5,
  gerente: 4,
  aprovador: 3,
  comprador: 2,
  requisitante: 1,
  visitante: 0,
}
```

---

## Módulos por Usuário

O campo `modulos` no perfil controla quais módulos o usuário vê no `ModuloSelector`.

```ts
// Módulos disponíveis no sistema (agrupados)
const MODULOS_ERP_GROUPED = [
  { label: 'Projetos',     modulos: ['egp', 'obras', 'ssma'] },
  { label: 'Suprimentos',  modulos: ['compras', 'logistica', 'estoque', 'patrimonial', 'frotas'] },
  { label: 'Backoffice',   modulos: ['financeiro', 'fiscal', 'controladoria', 'contratos', 'cadastros'] },
  { label: 'RH',           modulos: ['rh'] },
]

// Admin vê todos; outros veem apenas os habilitados
const modulosVisiveis = isAdmin ? MODULOS_ERP : MODULOS_ERP.filter(m => perfil.modulos[m.key])
```

---

## Auto-Provisionamento de Perfil

Quando um usuário loga pela primeira vez sem perfil cadastrado:

```sql
-- Trigger: on_auth_user_created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO sys_perfis (id, auth_id, email, nome, role, alcada_nivel)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'requisitante',  -- role padrão
    0                -- sem alçada
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Também há auto-provisionamento no frontend (`AuthContext`) caso o trigger falhe.

---

## Guards de Rota

### `PrivateRoute` — Autenticação

```tsx
// Redireciona para /login se não autenticado
<PrivateRoute>
  <ComponenteProtegido />
</PrivateRoute>
```

### `AdminRoute` — Administração

```tsx
// Bloqueia não-admins → redireciona para /
<AdminRoute>
  <AdminUsuarios />
</AdminRoute>
```

### `ModuleRoute` — Acesso por Módulo

```tsx
// Verifica hasModule(moduleKey), admin bypassa
<ModuleRoute moduleKey="financeiro">
  <FinanceiroLayout />
</ModuleRoute>
```

**Implementação:**
```tsx
export default function ModuleRoute({ moduleKey, children }: Props) {
  const { isAdmin, hasModule, perfilReady, perfil } = useAuth()
  if (!perfilReady || !perfil) return null
  if (isAdmin) return children ? <>{children}</> : <Outlet />
  if (!hasModule(moduleKey)) return <Navigate to="/" replace />
  return children ? <>{children}</> : <Outlet />
}
```

---

## Permissões por Funcionalidade

| Funcionalidade | Admin | Gerente | Aprovador | Comprador | Requisitante |
|---|:---:|:---:|:---:|:---:|:---:|
| Criar requisição | X | X | X | X | X |
| Ver todas requisições | X | X | X | — | — |
| Ver próprias requisições | X | X | X | X | X |
| Aprovar requisições | X | X | X | — | — |
| Acessar cotações | X | X | — | X | — |
| Emitir pedidos | X | X | — | X | — |
| Gerenciar usuários | X | — | — | — | — |
| Aprovação de contratos | X | X (todos) | — | — | — |
| Supervisor em contratos | X | X | X* | — | — |
| Ver dashboard | X | X | X | X | X |

*\* Supervisor: apenas N1 em contratos via `getPapelForModule()`*

---

## Aprovação Pública (sem auth)

A rota `/aprovacao/:token` permite aprovação sem login:

```
Aprovador recebe link:
https://tegplus.com.br/aprovacao/abc123-token-uuid

→ Frontend carrega dados via token (sem auth)
→ Supabase policy permite SELECT por token
→ Decisão enviada via POST direto no Supabase
```

---

## Links Relacionados

- [[06 - Supabase]] — Supabase Auth configuration
- [[03 - Páginas e Rotas]] — Guards e rotas protegidas
- [[04 - Componentes]] — ModuleRoute, PrivateRoute, AdminRoute
- [[05 - Hooks Customizados]] — usePermissoes
- [[13 - Alçadas]] — Detalhes das alçadas de aprovação
- [[12 - Fluxo Aprovação]] — Fluxo de aprovação completo
- [[08 - Migrações SQL]] — Migrations 006, 025_rls, 029
