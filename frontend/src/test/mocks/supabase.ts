/**
 * Supabase client mock for unit/integration tests.
 * Provides chainable query builder + auth mocks.
 */
import { vi } from 'vitest'

// ── Query builder mock (chainable) ──────────────────────────────────────────
function createQueryBuilder(data: unknown = null, error: unknown = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'is', 'not', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'single', 'maybeSingle',
    'csv', 'geojson', 'explain', 'rollback',
    'textSearch', 'match', 'contains', 'containedBy',
    'overlaps', 'returns',
  ]
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder)
  }
  // Terminal methods resolve the promise
  builder.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data, error, count: Array.isArray(data) ? data.length : data ? 1 : 0 })
  )
  // Make it thenable
  ;(builder as any)[Symbol.toStringTag] = 'Promise'
  return builder
}

// ── Auth mock ───────────────────────────────────────────────────────────────
type AuthCallback = (event: string, session: unknown) => void
let authCallback: AuthCallback | null = null

export const mockAuth = {
  _callback: null as AuthCallback | null,
  _triggerEvent(event: string, session: unknown) {
    if (authCallback) authCallback(event, session)
  },
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  onAuthStateChange: vi.fn((cb: AuthCallback) => {
    authCallback = cb
    mockAuth._callback = cb
    return {
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    }
  }),
}

// ── RPC mock ────────────────────────────────────────────────────────────────
export const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

// ── Storage mock ────────────────────────────────────────────────────────────
export const mockStorage = {
  from: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ data: { path: 'test.pdf' }, error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.supabase.co/storage/test.pdf' } }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}

// ── Main mock ───────────────────────────────────────────────────────────────
let queryData: unknown = null
let queryError: unknown = null

export const mockSupabase = {
  auth: mockAuth,
  rpc: mockRpc,
  storage: mockStorage,
  from: vi.fn(() => createQueryBuilder(queryData, queryError)),
  // Helper to set next query result
  _setQueryResult(data: unknown, error: unknown = null) {
    queryData = data
    queryError = error
  },
  _resetQueryResult() {
    queryData = null
    queryError = null
  },
}

// ── Mock the module ─────────────────────────────────────────────────────────
vi.mock('../../services/supabase', () => ({
  supabase: mockSupabase,
}))

export function resetAllMocks() {
  vi.clearAllMocks()
  authCallback = null
  mockAuth._callback = null
  queryData = null
  queryError = null
}
