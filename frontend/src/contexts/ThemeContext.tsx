import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react'

// ── Types ───────────────────────────────────────────────────────────────────────

export type Theme = 'original' | 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** true when dark theme is active (content area should be dark) */
  isDark: boolean
  /** true when light theme is active (sidebar should be light) */
  isLightSidebar: boolean
}

// ── Context ─────────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | null>(null)

const STORAGE_KEY = 'teg-theme'

// ── Provider ────────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored && ['original', 'dark', 'light'].includes(stored)) return stored
    } catch { /* SSR / restricted storage */ }
    return 'original'
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* noop */ }
  }, [])

  // Sync data-theme attribute and dark class on <html>
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)

    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDark: theme === 'dark',
        isLightSidebar: theme !== 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
