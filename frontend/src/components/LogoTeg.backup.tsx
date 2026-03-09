import { useId } from 'react'

interface LogoTegProps {
  size?: number
  animated?: boolean
  className?: string
  glowing?: boolean
}

/**
 * TEG+ brand logo — SVG network T with glowing cyan + symbol.
 * Matches the uploaded brand image: teal/cyan gradient strokes,
 * network node circles at intersections, diagonal cross-connections,
 * and a cyan glowing + mark at the top-right.
 */
export default function LogoTeg({
  size = 64,
  animated = true,
  className = '',
  glowing = false,
}: LogoTegProps) {
  // useId gives unique IDs for gradient/filter defs (prevents conflicts when mounted multiple times)
  const uid = useId().replace(/:/g, '_')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animated ? 'animate-float' : ''} ${glowing ? 'animate-pulse-glow' : ''} ${className}`}
      aria-label="TEG+ Logo"
    >
      <defs>
        {/* Teal → Cyan gradient for T strokes */}
        <linearGradient id={`gs${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>

        {/* Cyan radial gradient for + symbol */}
        <radialGradient id={`gp${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#06B6D4" />
        </radialGradient>

        {/* Subtle glow filter for T lines and nodes */}
        <filter id={`gf${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Strong glow filter for + symbol */}
        <filter id={`gfp${uid}`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="3.5" result="blur1" />
          <feGaussianBlur stdDeviation="1.5" result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── T skeleton: main lines ──────────────────────────────── */}

      {/* Horizontal top bar: left end → right end */}
      <line
        x1="6" y1="21" x2="60" y2="21"
        stroke={`url(#gs${uid})`} strokeWidth="2.3" strokeLinecap="round"
        filter={`url(#gf${uid})`}
      />

      {/* Vertical stem: junction → bottom */}
      <line
        x1="33" y1="21" x2="33" y2="63"
        stroke={`url(#gs${uid})`} strokeWidth="2.3" strokeLinecap="round"
        filter={`url(#gf${uid})`}
      />

      {/* ── Interior network: diagonal cross-connections ─────────── */}
      {/* These form a triangular network pattern in the T junction area */}

      {/* Left diagonal: (20,21) → (33,37) */}
      <line
        x1="20" y1="21" x2="33" y2="37"
        stroke={`url(#gs${uid})`} strokeWidth="1.4" strokeLinecap="round"
        opacity="0.7"
      />

      {/* Right diagonal: (46,21) → (33,37) */}
      <line
        x1="46" y1="21" x2="33" y2="37"
        stroke={`url(#gs${uid})`} strokeWidth="1.4" strokeLinecap="round"
        opacity="0.7"
      />

      {/* Horizontal connector at mid-junction */}
      <line
        x1="22" y1="37" x2="44" y2="37"
        stroke={`url(#gs${uid})`} strokeWidth="1.1" strokeLinecap="round"
        opacity="0.38"
      />

      {/* Subtle cross-diagonals (network texture) */}
      <line
        x1="20" y1="21" x2="44" y2="37"
        stroke={`url(#gs${uid})`} strokeWidth="0.75" strokeLinecap="round"
        opacity="0.22"
      />
      <line
        x1="46" y1="21" x2="22" y2="37"
        stroke={`url(#gs${uid})`} strokeWidth="0.75" strokeLinecap="round"
        opacity="0.22"
      />

      {/* ── Network node dots ───────────────────────────────────── */}

      {/* Top bar nodes: outer endpoints larger */}
      <circle cx="6"  cy="21" r="3.4" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />
      <circle cx="20" cy="21" r="2.9" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />
      <circle cx="33" cy="21" r="3.2" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />
      <circle cx="46" cy="21" r="2.9" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />
      <circle cx="60" cy="21" r="3.4" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />

      {/* Junction / interior nodes */}
      <circle cx="22" cy="37" r="2.2" fill={`url(#gs${uid})`} opacity="0.72" />
      <circle cx="33" cy="37" r="2.8" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />
      <circle cx="44" cy="37" r="2.2" fill={`url(#gs${uid})`} opacity="0.72" />

      {/* Stem nodes */}
      <circle cx="33" cy="51" r="2.5" fill={`url(#gs${uid})`} opacity="0.85" />
      <circle cx="33" cy="63" r="3.2" fill={`url(#gs${uid})`} filter={`url(#gf${uid})`} />

      {/* ── Glowing + symbol (top-right corner) ─────────────────── */}
      <g filter={`url(#gfp${uid})`}>
        {/* Horizontal bar of + */}
        <rect x="51" y="6.5" width="13" height="3.2" rx="1.6" fill={`url(#gp${uid})`} />
        {/* Vertical bar of + */}
        <rect x="55.9" y="1.5" width="3.2" height="13" rx="1.6" fill={`url(#gp${uid})`} />
      </g>
    </svg>
  )
}
