interface LogoTegProps {
  size?: number
  animated?: boolean
  className?: string
  glowing?: boolean
}

/**
 * TEG+ brand logo — uses the official PNG image.
 * The source image is cropped tight (195x215), so `size` controls the width
 * and height scales proportionally.
 * Backup SVG version available at LogoTeg.backup.tsx for rollback.
 */
export default function LogoTeg({
  size = 100,
  animated = true,
  className = '',
  glowing = false,
}: LogoTegProps) {
  return (
    <img
      src="/logo-teg-plus.png"
      alt="TEG+ Logo"
      width={size}
      draggable={false}
      className={[
        'object-contain select-none',
        animated ? 'animate-float' : '',
        glowing ? 'animate-pulse-glow' : '',
        className,
      ].filter(Boolean).join(' ')}
    />
  )
}
