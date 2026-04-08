import { useTheme } from '../../contexts/ThemeContext'

export default function DashboardSkeleton() {
  const { isDark } = useTheme()
  const bg = isDark ? 'bg-white/[0.04]' : 'bg-slate-200/60'
  const shimmer = 'skeleton-shimmer'

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`h-9 w-56 rounded-xl ${bg} ${shimmer}`} />
        <div className="flex-1" />
        <div className={`h-8 w-8 rounded-lg ${bg} ${shimmer}`} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`rounded-2xl p-5 border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <div className={`h-3 w-20 rounded mb-3 ${bg} ${shimmer}`} style={{ animationDelay: `${i * 80}ms` }} />
            <div className={`h-7 w-16 rounded-lg mb-2 ${bg} ${shimmer}`} style={{ animationDelay: `${i * 80 + 40}ms` }} />
            <div className={`h-2.5 w-24 rounded ${bg} ${shimmer}`} style={{ animationDelay: `${i * 80 + 80}ms` }} />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className={`h-4 w-32 rounded mb-6 ${bg} ${shimmer}`} />
        <div className={`h-48 rounded-xl ${bg} ${shimmer}`} style={{ animationDelay: '200ms' }} />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className={`rounded-2xl border p-5 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <div className={`h-4 w-28 rounded mb-4 ${bg} ${shimmer}`} />
            {[0, 1, 2].map(j => (
              <div key={j} className={`h-10 rounded-lg mb-2 ${bg} ${shimmer}`} style={{ animationDelay: `${(i * 3 + j) * 60}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
