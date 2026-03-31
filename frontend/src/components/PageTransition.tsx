import type { ReactNode } from 'react'

/**
 * Wraps page content with a subtle fade + slide-up animation.
 * Uses CSS-only — no Framer Motion dependency.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  )
}
