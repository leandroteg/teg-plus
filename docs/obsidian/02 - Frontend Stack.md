---
title: Frontend Stack
type: frontend
status: ativo
tags: [frontend, react, vite, typescript, tailwind]
criado: 2026-03-02
atualizado: 2026-04-07
relacionado: ["[[01 - Arquitetura Geral]]", "[[03 - Paginas e Rotas]]", "[[04 - Componentes]]", "[[05 - Hooks Customizados]]"]
---

# Frontend Stack — TEG+ ERP

## Numeros do Frontend

| Metrica | Valor |
|---------|-------|
| Paginas | 200+ across 16 modulos |
| Hooks customizados | 47 |
| Module layouts | 18 (lazy-loaded) |
| Componentes compartilhados | 60+ |
| Arquivos de tipos | 30+ (4.551 linhas) |
| Utility files | 16 |
| Entry points | 2 (main.tsx + aprovaai-main.tsx) |

---

## Tecnologias

### Runtime Dependencies

| Pacote | Versao | Uso |
|--------|--------|-----|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.28.0 | Roteamento SPA |
| `@tanstack/react-query` | ^5.60.0 | Data fetching & cache |
| `@supabase/supabase-js` | ^2.45.0 | DB + Auth client |
| `lucide-react` | ^0.460.0 | Icones SVG |

### Dev Dependencies

| Pacote | Versao | Uso |
|--------|--------|-----|
| `vite` | ^6.0.0 | Build tool + dev server |
| `typescript` | ^5.6.3 | Type system |
| `tailwindcss` | ^3.4.15 | CSS utility framework |
| `@vitejs/plugin-react` | ^4.3.4 | JSX transform |
| `postcss` | ^8.4.49 | CSS processing |
| `autoprefixer` | ^10.4.20 | CSS vendor prefixes |

---

## Code Splitting e Lazy Loading

Todas as paginas sao carregadas via `React.lazy()` + `Suspense` com 3 tipos de skeleton:

| Skeleton | Uso |
|----------|-----|
| `DashboardSkeleton` | Dashboards e home pages dos modulos |
| `TableSkeleton` | Listas, tabelas e grids de dados |
| `FormSkeleton` | Formularios e wizards |

```tsx
const Dashboard = React.lazy(() => import('./pages/compras/Dashboard'))

<Suspense fallback={<DashboardSkeleton />}>
  <Dashboard />
</Suspense>
```

Os 18 module layouts sao lazy-loaded individualmente, garantindo que o bundle inicial carregue apenas o necessario.

---

## PWA Support

O TEG+ funciona como Progressive Web App:

- **Install prompt** — detecta se pode ser instalado e oferece ao usuario
- **Offline banner** — notifica quando sem conexao
- **Push notifications** — notificacoes de aprovacoes pendentes e alertas
- Service worker para cache de assets estaticos

---

## Dark Mode

Implementado via `ThemeContext` que gerencia o tema globalmente:
- Toggle no header do app
- Persiste preferencia no localStorage
- Todas as 200+ paginas suportam dark mode
- Classes Tailwind `dark:` aplicadas consistentemente

---

## Entry Points

### `main.tsx` — Aplicacao principal
```tsx
<QueryClientProvider client={queryClient}>
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
</QueryClientProvider>
```

### `aprovaai-main.tsx` — AprovAi (bundle separado)
Entry point independente para a interface de aprovacao mobile. Bundle separado para carregamento rapido em dispositivos moveis via link de aprovacao.

---

## Scripts npm

```bash
npm run dev      # Dev server -> http://localhost:5173
npm run build    # Build de producao -> /dist
npm run preview  # Preview do build local
```

---

## Configuracao Vite (`vite.config.ts`)

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        aprovaai: 'aprovaai.html'  // Entry point separado
      }
    }
  }
})
```

---

## Configuracao TypeScript (`tsconfig.json`)

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
| `primary` | Indigo `#6366F1` | Acoes principais, links |
| `success` | Green `#10B981` | Status positivo |
| `warning` | Amber `#F59E0B` | Alertas, pendencias |
| `danger` | Red `#EF4444` | Erros, rejeicoes |
| `navy` | `#0F172A` | Background sidebar |
| `teal` | `#14B8A6` | Accent, hover |
| `cyan` | `#06B6D4` | Accent secundario |

### Animacoes Custom

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
shadow-card      -> Card padrao
shadow-card-md   -> Card elevado
shadow-glow-teal -> Glow teal
shadow-glow-cyan -> Glow cyan
shadow-sidebar   -> Sidebar shadow
```

---

## Clientes de Servico

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

- [[03 - Paginas e Rotas]] — Estrutura de rotas do app
- [[04 - Componentes]] — Componentes reutilizaveis
- [[05 - Hooks Customizados]] — Hooks de dados
- [[09 - Auth Sistema]] — AuthContext e providers
- [[16 - Variaveis de Ambiente]] — Configuracao de env vars
