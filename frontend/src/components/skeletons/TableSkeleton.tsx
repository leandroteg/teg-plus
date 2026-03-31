import { useTheme } from '../../contexts/ThemeContext'

export default function TableSkeleton({ rows = 8 }: { rows?: number }) {
  const { isDark } = useTheme()
  const bg = isDark ? 'bg-white/[0.04]' : 'bg-slate-200/60'
  const shimmer = 'skeleton-shimmer'

  return (
    <div className="animate-fade-in">
      {/* Toolbar */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className={`h-8 w-52 rounded-lg ${bg} ${shimmer}`} />
        <div className="flex-1" />
        <div className={`h-7 w-16 rounded-lg ${bg} ${shimmer}`} />
      </div>

      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-2 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        {[60, 120, 100, 80, 60].map((w, i) => (
          <div key={i} className={`h-3 rounded ${bg} ${shimmer}`} style={{ width: w, animationDelay: `${i * 50}ms` }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
          <div className={`h-4 w-14 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 40}ms` }} />
          <div className={`h-4 w-28 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 40 + 20}ms` }} />
          <div className={`h-4 w-24 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 40 + 40}ms` }} />
          <div className="flex-1" />
          <div className={`h-4 w-16 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 40 + 60}ms` }} />
          <div className={`h-4 w-12 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 40 + 80}ms` }} />
        </div>
      ))}
    </div>
  )
}
