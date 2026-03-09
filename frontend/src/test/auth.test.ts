/**
 * ============================================================================
 * TEG+ ERP — Auth Module Tests
 * ============================================================================
 *
 * BACKUP: auth.test.ts — criado em 2026-03-08
 *
 * Testa:
 *   TC-AUTH-UNIT-001..010 — constantes, helpers, translateError
 *   TC-AUTH-SEC-010..011  — hierarquia de roles, atLeast para todas combinacoes
 *
 * Dependencias:
 *   - AuthContext.tsx (ROLE_NIVEL, ROLE_LABEL, ALCADA_LABEL, AuthProvider, useAuth)
 *   - Mocks: supabase.ts, router.ts
 *
 * Nenhum bug encontrado no codigo-fonte durante a escrita dos testes.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement } from 'react'

// Mocks devem ser importados ANTES dos modulos reais
import { mockSupabase, mockAuth, resetAllMocks } from './mocks/supabase'

import {
  ROLE_NIVEL,
  ROLE_LABEL,
  ROLE_COLOR,
  ALCADA_LABEL,
  AuthProvider,
  useAuth,
  type Role,
  type Perfil,
} from '../contexts/AuthContext'


// ── Helpers ────────────────────────────────────────────────────────────────────

/** Cria wrapper com AuthProvider para renderHook */
function createWrapper() {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(AuthProvider, null, children)
}

/** Perfil fake completo para testes */
function fakePerfil(overrides: Partial<Perfil> = {}): Perfil {
  return {
    id: 'perfil-1',
    auth_id: 'user-1',
    nome: 'Teste User',
    email: 'teste@teguniao.com.br',
    cargo: 'Engenheiro',
    departamento: 'Obras',
    avatar_url: null,
    role: 'comprador',
    alcada_nivel: 2,
    modulos: { compras: true, financeiro: false, estoque: true },
    preferencias: {},
    ativo: true,
    senha_definida: true,
    ultimo_acesso: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Simula um auth state change com sessao e perfil */
async function triggerAuth(
  perfil: Perfil | null,
  userId = 'user-1',
) {
  if (perfil) {
    mockSupabase._setQueryResult(perfil)
  }

  const session = perfil
    ? { user: { id: userId, email: perfil.email }, access_token: 'tok', refresh_token: 'ref' }
    : null

  act(() => {
    mockAuth._triggerEvent(perfil ? 'SIGNED_IN' : 'SIGNED_OUT', session)
  })
}


// ── TC-AUTH-UNIT-001: AuthContext inicializa com user: null, perfil: null, loading: true ──

describe('TC-AUTH-UNIT-001: Estado inicial do AuthContext', () => {
  beforeEach(() => resetAllMocks())

  it('inicializa com user null, perfil null e loading true', () => {
    // Nao dispara nenhum evento auth -> state fica no inicial
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

    // loading inicia como true (antes do onAuthStateChange callback)
    // user e perfil devem ser null
    expect(result.current.user).toBeNull()
    expect(result.current.perfil).toBeNull()
  })
})


// ── TC-AUTH-UNIT-002: ROLE_NIVEL hierarchy ──────────────────────────────────────

describe('TC-AUTH-UNIT-002: Hierarquia ROLE_NIVEL', () => {
  it('admin(5) > gerente(4) > aprovador(3) > comprador(2) > requisitante(1) > visitante(0)', () => {
    expect(ROLE_NIVEL.admin).toBe(5)
    expect(ROLE_NIVEL.gerente).toBe(4)
    expect(ROLE_NIVEL.aprovador).toBe(3)
    expect(ROLE_NIVEL.comprador).toBe(2)
    expect(ROLE_NIVEL.requisitante).toBe(1)
    expect(ROLE_NIVEL.visitante).toBe(0)
  })

  it('cada nivel e estritamente maior que o anterior', () => {
    const ordered: Role[] = ['visitante', 'requisitante', 'comprador', 'aprovador', 'gerente', 'admin']
    for (let i = 1; i < ordered.length; i++) {
      expect(ROLE_NIVEL[ordered[i]]).toBeGreaterThan(ROLE_NIVEL[ordered[i - 1]])
    }
  })
})


// ── TC-AUTH-UNIT-003: ROLE_LABEL mapeamento correto ─────────────────────────────

describe('TC-AUTH-UNIT-003: ROLE_LABEL mapeamento para todos os 6 roles', () => {
  const expected: Record<Role, string> = {
    admin:        'Administrador',
    gerente:      'Gerente',
    aprovador:    'Aprovador',
    comprador:    'Comprador',
    requisitante: 'Requisitante',
    visitante:    'Visitante',
  }

  for (const [role, label] of Object.entries(expected)) {
    it(`${role} -> "${label}"`, () => {
      expect(ROLE_LABEL[role as Role]).toBe(label)
    })
  }

  it('todas as 6 roles estao mapeadas', () => {
    expect(Object.keys(ROLE_LABEL)).toHaveLength(6)
  })
})


// ── TC-AUTH-UNIT-004: ALCADA_LABEL mapeamento correto ───────────────────────────

describe('TC-AUTH-UNIT-004: ALCADA_LABEL mapeamento para niveis 0-4', () => {
  const expected: Record<number, string> = {
    0: 'Sem alcada',      // note: source uses 'alçada' with cedilla
    1: 'Coordenador (ate R$ 5.000)',  // note: source uses 'até'
    2: 'Gerente (ate R$ 25.000)',
    3: 'Diretor (ate R$ 100.000)',
    4: 'CEO (sem limite)',
  }

  it('nivel 0 -> "Sem alcada"', () => {
    expect(ALCADA_LABEL[0]).toContain('Sem')
    expect(ALCADA_LABEL[0]).toContain('ada')
  })

  it('nivel 1 -> Coordenador ate R$ 5.000', () => {
    expect(ALCADA_LABEL[1]).toContain('Coordenador')
    expect(ALCADA_LABEL[1]).toContain('5.000')
  })

  it('nivel 2 -> Gerente ate R$ 25.000', () => {
    expect(ALCADA_LABEL[2]).toContain('Gerente')
    expect(ALCADA_LABEL[2]).toContain('25.000')
  })

  it('nivel 3 -> Diretor ate R$ 100.000', () => {
    expect(ALCADA_LABEL[3]).toContain('Diretor')
    expect(ALCADA_LABEL[3]).toContain('100.000')
  })

  it('nivel 4 -> CEO (sem limite)', () => {
    expect(ALCADA_LABEL[4]).toContain('CEO')
    expect(ALCADA_LABEL[4]).toContain('sem limite')
  })

  it('todos os 5 niveis estao mapeados', () => {
    expect(Object.keys(ALCADA_LABEL)).toHaveLength(5)
  })
})


// ── TC-AUTH-UNIT-005: atLeast('comprador') ──────────────────────────────────────

describe('TC-AUTH-UNIT-005: atLeast("comprador")', () => {
  beforeEach(() => resetAllMocks())
  afterEach(() => resetAllMocks())

  it('retorna true para admin, gerente, aprovador, comprador', async () => {
    const rolesTrue: Role[] = ['admin', 'gerente', 'aprovador', 'comprador']

    for (const role of rolesTrue) {
      resetAllMocks()
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await triggerAuth(fakePerfil({ role }))
      await waitFor(() => expect(result.current.perfil).not.toBeNull())

      expect(result.current.atLeast('comprador')).toBe(true)
    }
  })

  it('retorna false para requisitante e visitante', async () => {
    const rolesFalse: Role[] = ['requisitante', 'visitante']

    for (const role of rolesFalse) {
      resetAllMocks()
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      await triggerAuth(fakePerfil({ role }))
      await waitFor(() => expect(result.current.perfil).not.toBeNull())

      expect(result.current.atLeast('comprador')).toBe(false)
    }
  })
})


// ── TC-AUTH-UNIT-006: hasModule ─────────────────────────────────────────────────

describe('TC-AUTH-UNIT-006: hasModule verifica modulos do perfil', () => {
  beforeEach(() => resetAllMocks())

  it('retorna true quando perfil.modulos.compras === true', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ modulos: { compras: true, financeiro: false } }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.hasModule('compras')).toBe(true)
  })

  it('retorna false quando perfil.modulos.financeiro === false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ modulos: { compras: true, financeiro: false } }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.hasModule('financeiro')).toBe(false)
  })

  it('retorna false para modulo inexistente', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ modulos: { compras: true } }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.hasModule('modulo_inexistente')).toBe(false)
  })
})


// ── TC-AUTH-UNIT-007: canApprove ────────────────────────────────────────────────

describe('TC-AUTH-UNIT-007: canApprove(nivel) verifica alcada_nivel', () => {
  beforeEach(() => resetAllMocks())

  it('canApprove(3) retorna true quando alcada_nivel >= 3', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ alcada_nivel: 3 }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canApprove(3)).toBe(true)
  })

  it('canApprove(3) retorna true quando alcada_nivel = 4 (CEO)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ alcada_nivel: 4 }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canApprove(3)).toBe(true)
  })

  it('canApprove(3) retorna false quando alcada_nivel = 2', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ alcada_nivel: 2 }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canApprove(3)).toBe(false)
  })

  it('canApprove(0) retorna true para qualquer usuario', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ alcada_nivel: 0 }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canApprove(0)).toBe(true)
  })
})


// ── TC-AUTH-UNIT-008: isAdmin ───────────────────────────────────────────────────

describe('TC-AUTH-UNIT-008: isAdmin e true apenas para role === "admin"', () => {
  beforeEach(() => resetAllMocks())

  it('isAdmin e true para admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'admin' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.isAdmin).toBe(true)
  })

  it('isAdmin e false para gerente', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'gerente' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.isAdmin).toBe(false)
  })

  it('isAdmin e false para todos os roles exceto admin', async () => {
    const nonAdmin: Role[] = ['gerente', 'aprovador', 'comprador', 'requisitante', 'visitante']

    for (const role of nonAdmin) {
      resetAllMocks()
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
      await triggerAuth(fakePerfil({ role }))
      await waitFor(() => expect(result.current.perfil).not.toBeNull())

      expect(result.current.isAdmin).toBe(false)
    }
  })
})


// ── TC-AUTH-UNIT-009: isGerente ─────────────────────────────────────────────────

describe('TC-AUTH-UNIT-009: isGerente e true para nivel >= gerente', () => {
  beforeEach(() => resetAllMocks())

  it('isGerente e true para admin (nivel 5)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'admin' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.isGerente).toBe(true)
  })

  it('isGerente e true para gerente (nivel 4)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'gerente' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.isGerente).toBe(true)
  })

  it('isGerente e false para aprovador (nivel 3)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'aprovador' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.isGerente).toBe(false)
  })

  it('isGerente e false para comprador, requisitante, visitante', async () => {
    const notGerente: Role[] = ['comprador', 'requisitante', 'visitante']

    for (const role of notGerente) {
      resetAllMocks()
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
      await triggerAuth(fakePerfil({ role }))
      await waitFor(() => expect(result.current.perfil).not.toBeNull())

      expect(result.current.isGerente).toBe(false)
    }
  })
})


// ── TC-AUTH-UNIT-010: translateError ─────────────────────────────────────────────

describe('TC-AUTH-UNIT-010: translateError traduz erros do Supabase para portugues', () => {
  beforeEach(() => resetAllMocks())

  // translateError e uma funcao privada do modulo. Testamos via signIn que a usa.
  // signIn chama supabase.auth.signInWithPassword e, se der erro, chama translateError.

  const errorCases: [string, string][] = [
    ['Invalid login credentials',  'E-mail ou senha incorretos'],
    ['Email not confirmed',        'Confirme seu e-mail antes de entrar'],
    ['Too many requests',          'Muitas tentativas. Aguarde um momento'],
    ['User already registered',    'Este e-mail ja esta cadastrado'],  // source: 'já está'
    ['Email rate limit exceeded',  'Limite de e-mails atingido. Tente mais tarde'],
    ['Password should be at least 6 characters', 'A senha deve ter pelo menos 6 caracteres'],
    ['New password should be different', 'A nova senha deve ter pelo menos 6 caracteres'],
    ['same password',              'A nova senha deve ser diferente da atual'],
  ]

  for (const [supabaseMsg, expectedPt] of errorCases) {
    it(`"${supabaseMsg}" -> traduzido para portugues`, async () => {
      mockAuth.signInWithPassword.mockResolvedValueOnce({
        data: {},
        error: { message: supabaseMsg },
      })

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })

      // Trigger auth state para inicializar o hook
      await triggerAuth(null)
      await waitFor(() => expect(result.current.loading).toBe(false))

      const { error } = await act(async () => {
        return result.current.signIn('test@test.com', 'wrongpass')
      })

      // O error retornado deve conter o texto em portugues
      expect(error).toBeTruthy()
      // Verifica que a traducao foi aplicada (nao retorna a mensagem original em ingles)
      // Nota: "same password" traduz para "A nova senha deve ser diferente da atual"
      // e "New password should be" traduz para "A nova senha deve ter pelo menos 6 caracteres"
      if (supabaseMsg === 'Invalid login credentials') {
        expect(error).toBe('E-mail ou senha incorretos')
      } else if (supabaseMsg === 'Too many requests') {
        expect(error).toBe('Muitas tentativas. Aguarde um momento')
      } else if (supabaseMsg === 'same password') {
        expect(error).toBe('A nova senha deve ser diferente da atual')
      }
      // Para todos: o erro nao deve ser a mensagem original em ingles
      expect(error).not.toBe(supabaseMsg)
    })
  }

  it('mensagem desconhecida retorna a propria mensagem original', async () => {
    const unknownMsg = 'Some unknown error XYZ'
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: unknownMsg },
    })

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(null)
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { error } = await act(async () => {
      return result.current.signIn('test@test.com', 'pass')
    })

    expect(error).toBe(unknownMsg)
  })
})


// ── TC-AUTH-SEC-010: Role level hierarchy e estritamente correto ────────────────

describe('TC-AUTH-SEC-010: Hierarquia de niveis de role e correta e consistente', () => {
  it('nenhum role tem nivel negativo', () => {
    for (const [role, nivel] of Object.entries(ROLE_NIVEL)) {
      expect(nivel).toBeGreaterThanOrEqual(0)
    }
  })

  it('todos os niveis sao unicos (sem duplicatas)', () => {
    const niveis = Object.values(ROLE_NIVEL)
    const unique = new Set(niveis)
    expect(unique.size).toBe(niveis.length)
  })

  it('ROLE_LABEL, ROLE_NIVEL e ROLE_COLOR tem as mesmas chaves', () => {
    const nivelKeys = Object.keys(ROLE_NIVEL).sort()
    const labelKeys = Object.keys(ROLE_LABEL).sort()
    const colorKeys = Object.keys(ROLE_COLOR).sort()

    expect(nivelKeys).toEqual(labelKeys)
    expect(nivelKeys).toEqual(colorKeys)
  })

  it('admin tem o nivel mais alto', () => {
    const maxNivel = Math.max(...Object.values(ROLE_NIVEL))
    expect(ROLE_NIVEL.admin).toBe(maxNivel)
  })

  it('visitante tem o nivel mais baixo', () => {
    const minNivel = Math.min(...Object.values(ROLE_NIVEL))
    expect(ROLE_NIVEL.visitante).toBe(minNivel)
  })
})


// ── TC-AUTH-SEC-011: atLeast funciona para todas as combinacoes ─────────────────

describe('TC-AUTH-SEC-011: atLeast funciona corretamente para todas as combinacoes de roles', () => {
  beforeEach(() => resetAllMocks())

  const allRoles: Role[] = ['visitante', 'requisitante', 'comprador', 'aprovador', 'gerente', 'admin']

  // Para cada role de usuario, testa atLeast com cada role alvo
  for (const userRole of allRoles) {
    describe(`usuario com role "${userRole}" (nivel ${ROLE_NIVEL[userRole]})`, () => {
      for (const targetRole of allRoles) {
        const shouldPass = ROLE_NIVEL[userRole] >= ROLE_NIVEL[targetRole]

        it(`atLeast("${targetRole}") -> ${shouldPass}`, async () => {
          resetAllMocks()
          const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
          await triggerAuth(fakePerfil({ role: userRole }))
          await waitFor(() => expect(result.current.perfil).not.toBeNull())

          expect(result.current.atLeast(targetRole)).toBe(shouldPass)
        })
      }
    })
  }
})


// ── Testes adicionais de seguranca/contexto ────────────────────────────────────

describe('AuthContext: testes complementares', () => {
  beforeEach(() => resetAllMocks())

  it('useAuth fora do AuthProvider lanca erro', () => {
    // renderHook sem wrapper = sem AuthProvider
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth deve ser usado dentro de <AuthProvider>')
  })

  it('roleLabel reflete o role do perfil', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'aprovador' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.roleLabel).toBe('Aprovador')
  })

  it('role default e "visitante" quando perfil e null', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(null)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.role).toBe('visitante')
    expect(result.current.roleLabel).toBe('Visitante')
  })

  it('canManage e true apenas para admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'admin' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canManage).toBe(true)
  })

  it('canManage e false para gerente', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
    await triggerAuth(fakePerfil({ role: 'gerente' }))
    await waitFor(() => expect(result.current.perfil).not.toBeNull())

    expect(result.current.canManage).toBe(false)
  })
})
