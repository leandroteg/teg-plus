import { useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'

const THEME_COLORS: Record<string, string> = {
  dark: '#060D1B',
  light: '#f8fafc',
  original: '#0F172A',
}

/**
 * Syncs <meta name="theme-color"> with the active theme.
 * This makes the browser/OS chrome (status bar, title bar) match the app.
 */
export function useThemeColor() {
  const { theme } = useTheme()

  useEffect(() => {
    const color = THEME_COLORS[theme] || THEME_COLORS.dark
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = color
  }, [theme])
}
