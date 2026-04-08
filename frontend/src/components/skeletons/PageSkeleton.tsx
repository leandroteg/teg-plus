import { useTheme } from '../../contexts/ThemeContext'

export default function PageSkeleton() {
  const { isDark } = useTheme()
  const bg = isDark ? 'bg-white/[0.04]' : 'bg-slate-200/60'
  const shimmer = 'skeleton-shimmer'

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex items-center gap-4">
        <div className={`h-8 w-48 rounded-xl ${bg} ${shimmer}`} />
        <div className="flex-1" />
        <div className={`h-9 w-28 rounded-xl ${bg} ${shimmer}`} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-24 rounded-2xl ${bg} ${shimmer}`} style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>

      {/* Table/content area */}
      <div className={`rounded-2xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'} overflow-hidden`}>
        {/* Table header */}
        <div className={`h-10 ${bg} ${shimmer}`} />
        {/* Rows */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-12 border-t ${isDark ? 'border-white/[0.04]' : 'border-slate-100'} flex items-center gap-4 px-4`}>
            <div className={`h-4 w-16 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 60}ms` }} />
            <div className={`h-4 w-32 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 60 + 30}ms` }} />
            <div className="flex-1" />
            <div className={`h-4 w-20 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 60 + 60}ms` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
