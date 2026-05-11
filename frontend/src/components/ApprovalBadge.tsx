import { useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import { useAprovacaoKPIs } from '../hooks/useAprovacoes'
import { useAuth } from '../contexts/AuthContext'

/**
 * Compact badge that shows pending approval count.
 * Clicking navigates to /aprovaai (AprovAi).
 * Visible para qualquer usuário que possa aprovar em algum nível
 * (admin, CEO, diretor, supervisor com alçada, gestor com alçada explícita).
 */
export default function ApprovalBadge({ isDark = false }: { isDark?: boolean }) {
  const navigate = useNavigate()
  const { canApprove } = useAuth()
  const { data: kpis } = useAprovacaoKPIs()

  // canApprove(1) = pode aprovar pelo menos no nível mais baixo
  if (!canApprove(1)) return null

  const count = kpis?.totalPendentes ?? 0
  const title =
    count > 0
      ? `${count} aprovacao${count !== 1 ? 'es' : ''} pendente${count !== 1 ? 's' : ''}`
      : 'AprovAi - Centro de Aprovacoes'

  return (
    <button
      onClick={() => navigate('/aprovaai')}
      className={`relative p-2 rounded-lg transition-colors duration-150 ${
        isDark
          ? 'text-slate-400 hover:text-violet-300 hover:bg-violet-500/10'
          : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
      }`}
      title={title}
    >
      <ClipboardCheck className="w-4.5 h-4.5" strokeWidth={1.8} />
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-violet-500 text-white text-[10px] font-bold leading-none shadow-sm"
          style={{ animation: 'notif-pop 0.3s ease-out' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
