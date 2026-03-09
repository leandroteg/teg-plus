/**
 * React Router mock for unit tests.
 */
import { vi } from 'vitest'

export const mockNavigate = vi.fn()
export const mockLocation = { pathname: '/', search: '', hash: '', state: null }
export const mockParams: Record<string, string> = {}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    useParams: () => mockParams,
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to)
      return null
    },
  }
})

export function resetRouterMocks() {
  mockNavigate.mockClear()
  mockLocation.pathname = '/'
  mockLocation.search = ''
  Object.keys(mockParams).forEach(k => delete mockParams[k])
}
