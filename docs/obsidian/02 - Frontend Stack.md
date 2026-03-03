---
title: Frontend Stack
type: frontend
status: ativo
tags: [frontend, react, vite, typescript, tailwind]
criado: 2026-03-02
relacionado: ["[[01 - Arquitetura Geral]]", "[[03 - Páginas e Rotas]]", "[[04 - Componentes]]", "[[05 - Hooks Customizados]]"]
---

# Frontend Stack — TEG+ ERP

## Tecnologias

### Runtime Dependencies

| Pacote | Versão | Uso |
|--------|--------|-----|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.28.0 | Roteamento SPA |
| `@tanstack/react-query` | ^5.60.0 | Data fetching & cache |
| `@supabase/supabase-js` | ^2.45.0 | DB + Auth client |
| `lucide-react` | ^0.460.0 | Ícones SVG |

### Dev Dependencies

| Pacote | Versão | Uso |
|--------|--------|-----|
| `vite` | ^6.0.0 | Build tool + dev server |
| `typescript` | ^5.6.3 | Type system |
| `tailwindcss` | ^3.4.15 | CSS utility framework |
| `@vitejs/plugin-react` | ^4.3.4 | JSX transform |
| `postcss` | ^8.4.49 | CSS processing |
| `autoprefixer` | ^10.4.20 | CSS vendor prefixes |

---

## Scripts npm

```bash
npm run dev      # Dev server → http://localhost:5173
npm run build    # Build de produção → /dist
npm run preview  # Preview do build local
```

---

## Configuração Vite (`vite.config.ts`)

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
})
```

---

## Configuração TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": false,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

> **Nota:** `strict: false` — checagem relaxada de tipos

---

## Tailwind — Design System

### Paleta de Cores Custom

| Token | Valor | Uso |
|-------|-------|-----|
| `primary` | Indigo `#6366F1` | Ações principais, links |
| `success` | Green `#10B981` | Status positivo |
| `warning` | Amber `#F59E0B` | Alertas, pendências |
| `danger` | Red `#EF4444` | Erros, rejeições |
| `navy` | `#0F172A` | Background sidebar |
| `teal` | `#14B8A6` | Accent, hover |
| `cyan` | `#06B6D4` | Accent secundário |

### Animações Custom

| Classe | Efeito |
|--------|--------|
| `animate-fade-in-up` | Slide + fade entry |
| `animate-fade-in` | Fade entry |
| `animate-float` | Floating loop |
| `animate-pulse-glow` | Pulsing glow |
| `animate-slide-in-left` | Slide from left |
| `animate-scale-in` | Scale entry |
| `animate-shimmer` | Loading shimmer |

### Shadows Custom

```
shadow-card      → Card padrão
shadow-card-md   → Card elevado
shadow-glow-teal → Glow teal
shadow-glow-cyan → Glow cyan
shadow-sidebar   → Sidebar shadow
```

---

## Entry Point (`main.tsx`)

```tsx
// Setup global providers
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
</QueryClientProvider>
```

---

## Clientes de Serviço

### `services/supabase.ts`
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### `services/api.ts` — Cliente n8n
```ts
const BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL

export const api = {
  criarRequisicao: (payload) =>
    fetch(`${BASE_URL}/compras/requisicao`, { method: 'POST', body: JSON.stringify(payload) }),

  parseRequisicaoAi: (texto, solicitante_nome) =>
    fetch(`${BASE_URL}/compras/requisicao-ai`, { method: 'POST', ... }),

  processarAprovacao: (token, decisao, observacao) =>
    fetch(`${BASE_URL}/compras/aprovacao`, { method: 'POST', ... }),

  submeterCotacao: (data) =>
    fetch(`${BASE_URL}/compras/cotacao`, { method: 'POST', ... }),

  getDashboard: (params) =>
    fetch(`${BASE_URL}/painel/compras?${queryString}`)
}
```

---

## Links Relacionados

- [[03 - Páginas e Rotas]] — Estrutura de rotas do app
- [[04 - Componentes]] — Componentes reutilizáveis
- [[05 - Hooks Customizados]] — Hooks de dados
- [[09 - Auth Sistema]] — AuthContext e providers
- [[16 - Variáveis de Ambiente]] — Configuração de env vars
