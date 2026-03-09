/**
 * ============================================================================
 * TEG+ ERP -- Test Helper: renderWithProviders
 * ============================================================================
 *
 * Provides a render function that wraps components in the full provider stack
 * (QueryClient, ThemeProvider, AuthContext, MemoryRouter) for E2E-level smoke
 * tests that need the app's real provider hierarchy without hitting Supabase.
 *
 * Usage:
 *   import { renderWithProviders, createMockPerfil } from '../test/helpers/renderApp'
 *
 *   it('renders dashboard for admin', () => {
 *     const { getByText } = renderWithProviders(<Dashboard />, {
 *       initialEntries: ['/compras'],
 *       perfilOverrides: { role: 'gerente' },
 *     })
 *     expect(getByText('Dashboard')).toBeInTheDocument()
 *   })
 *
 * Dependencies:
 *   - test/mocks/supabase.ts  (must be imported before this helper in test files)
 *   - contexts/ThemeContext    (used directly -- simple provider, no side effects)
 *   - contexts/AuthContext     (mocked via vi.mock -- useAuth() returns controlled state)
 *
 * ============================================================================
 */

import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { ThemeProvider } from '../../contexts/ThemeContext'
import {
  type Role,
  type Perfil,
  ROLE_NIVEL,
  ROLE_LABEL,
} from '../../contexts/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────

/** Mirrors AuthContextType from contexts/AuthContext.tsx */
interface AuthContextValue {
  user: { id: string; email: string } | null
  perfil: Perfil | null
  session: { access_token: string; refresh_token: string } | null
  loading: boolean
  perfilReady: boolean

  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>

  updatePerfil: (data: Partial<Pick<Perfil, 'nome' | 'cargo' | 'departamento'>>) => Promise<{ error: string | null }>
  reloadPerfil: () => Promise<void>
  markSenhaDefinida: () => Promise<{ error: string | null }>

  pendingPasswordReset: boolean
  clearPasswordReset: () => void

  role: Role
  roleLabel: string
  isAdmin: boolean
  isGerente: boolean
  canManage: boolean
  hasModule: (mod: string) => boolean
  canApprove: (nivel: number) => boolean
  atLeast: (role: Role) => boolean
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route entries for MemoryRouter. Defaults to ['/'] */
  initialEntries?: string[]
  /** Overrides applied to the auth context value (merged on top of defaults) */
  authOverrides?: Partial<AuthContextValue>
  /** Overrides applied to the mock perfil (merged on top of createMockPerfil defaults) */
  perfilOverrides?: Partial<Perfil>
}

// ── Module-scoped auth state ─────────────────────────────────────────────────
//
// This variable is read by the mocked useAuth() below. Tests control what
// useAuth returns by calling `setMockAuthValue()` or, more commonly, by
// passing `authOverrides` / `perfilOverrides` to `renderWithProviders()`.

let _mockAuthValue: AuthContextValue | null = null

/**
 * Set the value that useAuth() will return. Primarily used internally by
 * renderWithProviders, but exported for advanced test scenarios that need
 * to change auth state mid-test (e.g. simulating logout).
 */
export function setMockAuthValue(value: AuthContextValue) {
  _mockAuthValue = value
}

// ── Mock the AuthContext module ──────────────────────────────────────────────
//
// vi.mock is hoisted to the top of the file by Vitest, so this runs before
// any import that pulls in useAuth or AuthProvider.

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../contexts/AuthContext')>(
    '../../contexts/AuthContext'
  )

  return {
    ...actual,
    // Replace AuthProvider with a passthrough -- providers are set up by
    // renderWithProviders itself.
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    // Return the module-scoped mock value
    useAuth: () => {
      if (!_mockAuthValue) {
        throw new Error(
          'useAuth called but no mock auth value has been set. ' +
          'Use renderWithProviders() or call setMockAuthValue() before rendering.'
        )
      }
      return _mockAuthValue
    },
  }
})

// ── Factory: Mock Perfil ─────────────────────────────────────────────────────

/**
 * Creates a complete Perfil object with sensible admin defaults.
 * Pass `overrides` to customise individual fields.
 */
export function createMockPerfil(overrides: Partial<Perfil> = {}): Perfil {
  return {
    id: 'perfil-test-001',
    auth_id: 'auth-test-001',
    nome: 'Admin Teste',
    email: 'admin@teguniao.com.br',
    cargo: 'Administrador',
    departamento: 'TI',
    avatar_url: null,
    role: 'admin',
    alcada_nivel: 4,
    modulos: {
      compras: true,
      financeiro: true,
      estoque: true,
      logistica: true,
      frotas: true,
      rh: true,
      ssma: true,
      contratos: true,
    },
    preferencias: {},
    ativo: true,
    senha_definida: true,
    ultimo_acesso: '2026-03-09T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-09T00:00:00Z',
    ...overrides,
  }
}

// ── Factory: Auth Context Value ──────────────────────────────────────────────

/**
 * Creates a complete AuthContextValue with an authenticated admin user.
 * All async methods are vi.fn() stubs that resolve successfully.
 *
 * @param overrides  - partial overrides merged onto the default context value
 * @param perfil     - the Perfil to use (defaults to createMockPerfil())
 */
export function createAuthContextValue(
  overrides: Partial<AuthContextValue> = {},
  perfil?: Perfil,
): AuthContextValue {
  const p = perfil ?? createMockPerfil()
  const role: Role = overrides.role ?? p.role

  return {
    user: { id: p.auth_id, email: p.email },
    perfil: p,
    session: { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' },
    loading: false,
    perfilReady: true,

    signIn: vi.fn().mockResolvedValue({ error: null }),
    signInMagicLink: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),

    updatePerfil: vi.fn().mockResolvedValue({ error: null }),
    reloadPerfil: vi.fn().mockResolvedValue(undefined),
    markSenhaDefinida: vi.fn().mockResolvedValue({ error: null }),

    pendingPasswordReset: false,
    clearPasswordReset: vi.fn(),

    role,
    roleLabel: ROLE_LABEL[role],
    isAdmin: role === 'admin',
    isGerente: ROLE_NIVEL[role] >= ROLE_NIVEL['gerente'],
    canManage: role === 'admin',
    hasModule: (mod: string) => p.modulos?.[mod] === true,
    canApprove: (nivel: number) => (p.alcada_nivel ?? 0) >= nivel,
    atLeast: (r: Role) => ROLE_NIVEL[role] >= ROLE_NIVEL[r],

    ...overrides,
  }
}

// ── renderWithProviders ──────────────────────────────────────────────────────

/**
 * Renders a React element wrapped in the full TEG+ provider stack:
 *   QueryClientProvider > ThemeProvider > MemoryRouter
 *
 * AuthContext is mocked at the module level -- useAuth() returns a controlled
 * value built from `authOverrides` and `perfilOverrides`.
 *
 * @returns The standard @testing-library/react RenderResult
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const {
    initialEntries = ['/'],
    authOverrides = {},
    perfilOverrides = {},
    ...renderOptions
  } = options

  // Build the perfil and auth context value
  const perfil = createMockPerfil(perfilOverrides)
  const authValue = createAuthContextValue(authOverrides, perfil)

  // Set the module-scoped mock so useAuth() picks it up
  _mockAuthValue = authValue

  // Fresh QueryClient per render -- prevents test cross-contamination
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  function AllProviders({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: AllProviders, ...renderOptions })
}
