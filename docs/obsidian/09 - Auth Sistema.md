---
title: Auth Sistema
type: segurança
status: ativo
tags: [auth, supabase, autenticação, permissões, roles]
criado: 2026-03-02
relacionado: ["[[06 - Supabase]]", "[[02 - Frontend Stack]]", "[[03 - Páginas e Rotas]]"]
---

# Auth Sistema — TEG+ ERP

## Visão Geral

```mermaid
flowchart TD
    U[Usuário] --> L[/login]
    L -->|Email + Senha| SP[Supabase Auth\nsignIn]
    L -->|Magic Link| ML[Supabase Auth\nsignInMagicLink]
    ML -->|Email enviado| EMAIL[📧 Link no email]
    EMAIL -->|Clique| CB[Callback Auth]
    SP --> CB
    CB --> AP[Auto-provisioning\nPerfil criado se não existe]
    AP --> MOD[/\nModuloSelector]
```

---

## Métodos de Autenticação

| Método | Função | Uso |
|--------|--------|-----|
| Email + Senha | `signIn(email, password)` | Login padrão |
| Magic Link | `signInMagicLink(email)` | Sem senha |
| Reset Senha | `resetPassword(email)` | Recuperação |
| Update Senha | `updatePassword(newPassword)` | Troca de senha |
| Logout | `signOut()` | Encerrar sessão |

---

## AuthContext (`contexts/AuthContext.tsx`)

Provider global que expõe:

```ts
interface AuthContextType {
  user: User | null           // Supabase auth user
  perfil: Perfil | null       // Perfil do sistema (role, alçada, etc.)
  loading: boolean            // Estado de carregamento
  signIn: (email, password) => Promise<void>
  signInMagicLink: (email) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email) => Promise<void>
  updatePassword: (newPassword) => Promise<void>
  updatePerfil: (dados) => Promise<void>  // Atualiza nome, cargo, etc.
}
```

**Session management:**
- `onAuthStateChange` subscription ativa durante toda a sessão
- Timeout de segurança: 8s para conexões lentas
- Graceful handling de usuários deletados do banco

---

## Roles e Permissões

### 6 Roles do Sistema

| Role | Nível | Permissões |
|------|-------|-----------|
| `admin` | 5 | Acesso total ao sistema |
| `gerente` | 4 | Gerencia requisições e aprovações |
| `aprovador` | 3 | Pode aprovar requisições |
| `comprador` | 2 | Acessa fila de cotações, emite pedidos |
| `requisitante` | 1 | Cria requisições |
| `visitante` | 0 | Leitura apenas |

### Permissões por funcionalidade

| Funcionalidade | Admin | Gerente | Aprovador | Comprador | Requisitante |
|---|:---:|:---:|:---:|:---:|:---:|
| Criar requisição | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver todas requisições | ✅ | ✅ | ✅ | — | — |
| Ver próprias requisições | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aprovar requisições | ✅ | ✅ | ✅ | — | — |
| Acessar cotações | ✅ | ✅ | — | ✅ | — |
| Emitir pedidos | ✅ | ✅ | — | ✅ | — |
| Gerenciar usuários | ✅ | — | — | — | — |
| Ver dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Alçadas de Aprovação

> Relacionado às permissões de aprovação por valor monetário.

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
  id: string              // = auth.uid()
  nome: string
  email: string
  cargo: string
  departamento: string
  avatar_url?: string
  role: Role              // admin | gerente | ...
  nivel_alcada: number    // 0-4
  modulos: string[]       // ['compras', 'financeiro', ...]
  preferencias: {
    tema: 'dark' | 'light'
    notificacoes: boolean
    idioma: 'pt-BR'
  }
  ultimo_acesso: string
}
```

---

## Auto-Provisionamento de Perfil

Quando um usuário loga pela primeira vez sem perfil cadastrado:

```sql
-- Trigger: on_auth_user_created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO sys_perfis (id, email, nome, role, nivel_alcada)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'requisitante',  -- role padrão
    0                -- sem alçada por padrão
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Guards de Rota

```tsx
// src/components/PrivateRoute.tsx

// PrivateRoute — redireciona para /login se não autenticado
export function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" />
  return children
}

// AdminRoute — bloqueia não-admins
export function AdminRoute({ children }) {
  const { perfil, loading } = useAuth()
  if (loading) return <Spinner />
  if (perfil?.role !== 'admin') return <Navigate to="/compras" />
  return children
}
```

---

## Módulos por Usuário

O campo `modulos` no perfil controla quais módulos o usuário vê no `ModuloSelector`:

```ts
// Módulos disponíveis no sistema
const MODULOS = ['compras', 'financeiro', 'rh', 'ssma', 'estoque', 'contratos']

// Admin vê todos; outros veem apenas os habilitados no perfil
const modulosVisiveis = perfil.role === 'admin'
  ? MODULOS
  : perfil.modulos
```

---

## Aprovação Pública (sem auth)

A rota `/aprovacao/:token` permite aprovação sem login:

```
Aprovador recebe link:
https://tegplus.com.br/aprovacao/abc123-token-uuid

→ Frontend carrega dados via token (sem auth)
→ Supabase policy permite SELECT por token
→ Decisão enviada para n8n via POST /compras/aprovacao
```

---

## Links Relacionados

- [[06 - Supabase]] — Supabase Auth configuration
- [[03 - Páginas e Rotas]] — Guards e rotas protegidas
- [[13 - Alçadas]] — Detalhes das alçadas de aprovação
- [[12 - Fluxo Aprovação]] — Fluxo de aprovação completo
