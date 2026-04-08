/**
 * Animated card list container — applies staggered fade-in to children.
 * Use this to wrap pipeline card lists for premium loading feel.
 *
 * Does NOT use CSS transform on the container itself (avoids breaking
 * fixed-position modals inside children).
 */
export default function CardList({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`stagger-children ${className}`}>
      {children}
    </div>
  )
}
