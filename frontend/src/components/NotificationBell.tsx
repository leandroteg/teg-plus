import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Check, X, Edit3, AlertCircle, ChevronRight, UserPlus } from 'lucide-react'
import { usePreCadastros, getEntityLabel, type PreCadastro } from '../hooks/usePreCadastros'

// ── Main Bell Component ─────────────────────────────────────────────────────────

export default function NotificationBell({ isDark = false }: { isDark?: boolean }) {
  const { pendentes, count, isAdminOrDirector } = usePreCadastros()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PreCadastro | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  // Calculate position from button rect
  const updatePos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const panelW = Math.min(320, window.innerWidth - 16)
    // Center panel horizontally on mobile, right-align on desktop
    let rightVal = window.innerWidth - r.right
    if (rightVal + panelW > window.innerWidth - 8) {
      // Panel would overflow left — center it instead
      rightVal = (window.innerWidth - panelW) / 2
    }
    setPos({
      top: r.bottom + 4,
      right: Math.max(8, rightVal),
    })
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    updatePos()
    function onClickOutside(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
      setSelected(null)
    }
    function onScroll() { updatePos() }
    document.addEventListener('mousedown', onClickOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  if (!isAdminOrDirector) return null

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => { setOpen(o => !o); setSelected(null) }}
        className={`relative p-2 rounded-lg transition-colors duration-150 ${
          isDark
            ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`}
        title="Notificacoes"
      >
        <Bell className="w-4.5 h-4.5" strokeWidth={1.8} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none shadow-sm"
            style={{ animation: 'notif-pop 0.3s ease-out' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className={`fixed z-[9999] w-80 max-h-[420px] rounded-2xl border overflow-hidden shadow-xl ${
            isDark
              ? 'bg-[#111827] border-white/10 shadow-black/50'
              : 'bg-white border-slate-200/80 shadow-slate-200/40'
          }`}
          style={{
            top: pos.top,
            right: pos.right,
            maxWidth: 'calc(100vw - 16px)',
            animation: 'notif-slide 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            isDark ? 'border-white/5' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <UserPlus className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} strokeWidth={2} />
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Pre-cadastros
              </span>
            </div>
            {count > 0 && (
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-600'
              }`}>
                {count} pendente{count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[340px]" style={{ scrollbarWidth: 'thin' }}>
            {selected ? (
              <ReviewPanel
                pre={selected}
                isDark={isDark}
                onBack={() => setSelected(null)}
                onDone={() => { setSelected(null) }}
              />
            ) : pendentes.length === 0 ? (
              <div className={`px-4 py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum pre-cadastro pendente</p>
              </div>
            ) : (
              pendentes.map(pre => (
                <button
                  key={pre.id}
                  onClick={() => setSelected(pre)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors duration-150 border-b last:border-b-0 ${
                    isDark
                      ? 'border-white/5 hover:bg-white/5'
                      : 'border-slate-50 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4 text-teal-500" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium truncate ${isDark ? 'text-white' : 'text-slate-700'}`}>
                      {getEntityLabel(pre.entidade)}: {getMainField(pre)}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {pre.solicitante_nome || 'SuperTEG'} &middot; {timeAgo(pre.created_at)}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                </button>
              ))
            )}
          </div>
        </div>
      , document.body)}

      <style>{`
        @keyframes notif-pop {
          0%   { transform: scale(0); }
          60%  { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes notif-slide {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

// ── Review Panel (inline in dropdown) ───────────────────────────────────────────

function ReviewPanel({
  pre, isDark, onBack, onDone,
}: {
  pre: PreCadastro
  isDark: boolean
  onBack: () => void
  onDone: () => void
}) {
  const { aprovar, rejeitar } = usePreCadastros()
  const [editedDados, setEditedDados] = useState<Record<string, unknown>>(pre.dados)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [busy, setBusy] = useState(false)

  // Coerce string values back to their original types before inserting (#24)
  function coerceDados(original: Record<string, unknown>, edited: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, editedVal] of Object.entries(edited)) {
      const originalVal = original[key]
      const strVal = String(editedVal ?? '')
      if (typeof originalVal === 'boolean') {
        result[key] = strVal === 'true' || strVal === '1' || strVal === 'sim'
      } else if (typeof originalVal === 'number') {
        const n = Number(strVal)
        result[key] = isNaN(n) ? originalVal : n
      } else if (originalVal === null && strVal === '') {
        result[key] = null
      } else {
        result[key] = editedVal
      }
    }
    return result
  }

  async function handleApprove() {
    setBusy(true)
    try {
      const dadosCoercidos = coerceDados(pre.dados, editedDados)
      await aprovar.mutateAsync({
        id: pre.id,
        dados: dadosCoercidos,
        entidade: pre.entidade,
        tabela_destino: pre.tabela_destino,
      })
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      alert('Erro ao aprovar: ' + msg)
    }
    setBusy(false)
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    setBusy(true)
    try {
      await rejeitar.mutateAsync({ id: pre.id, motivo: rejectReason.trim() })
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      alert('Erro ao rejeitar: ' + msg)
    }
    setBusy(false)
  }

  const fields = Object.entries(editedDados).filter(([k]) => !k.startsWith('_'))

  return (
    <div className="px-4 py-3">
      {/* Back button */}
      <button
        onClick={onBack}
        className={`flex items-center gap-1 text-[12px] font-medium mb-3 ${
          isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <ChevronRight className="w-3 h-3 rotate-180" /> Voltar
      </button>

      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {getEntityLabel(pre.entidade)}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${
          isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-600'
        }`}>
          Pendente
        </span>
      </div>

      {/* Editable fields */}
      <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {fields.map(([key, value]) => (
          <div key={key}>
            <label className={`text-[10px] font-medium uppercase tracking-wider ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {key.replace(/_/g, ' ')}
            </label>
            <input
              type="text"
              value={String(value ?? '')}
              onChange={e => setEditedDados(prev => ({ ...prev, [key]: e.target.value }))}
              className={`w-full mt-0.5 px-2.5 py-1.5 rounded-lg text-[12px] border outline-none focus:ring-2 focus:ring-teal-400/30 ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-300'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Requester info */}
      <p className={`text-[11px] mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Solicitado por {pre.solicitante_nome || 'SuperTEG'} em {new Date(pre.created_at).toLocaleDateString('pt-BR')}
      </p>

      {/* Actions */}
      {showReject ? (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeicao..."
            rows={2}
            className={`w-full px-2.5 py-2 rounded-lg text-[12px] border outline-none resize-none focus:ring-2 focus:ring-red-400/30 ${
              isDark
                ? 'bg-white/5 border-white/10 text-white placeholder-slate-600'
                : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-300'
            }`}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReject(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                isDark ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleReject}
              disabled={busy || !rejectReason.trim()}
              className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
            >
              <AlertCircle className="w-3 h-3" /> Rejeitar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setShowReject(true)}
            disabled={busy}
            className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center gap-1 ${
              isDark
                ? 'bg-white/5 text-slate-300 hover:bg-red-500/15 hover:text-red-300'
                : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <X className="w-3 h-3" /> Rejeitar
          </button>
          <button
            onClick={handleApprove}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
          >
            {busy ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check className="w-3 h-3" /> Aprovar</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getMainField(pre: PreCadastro): string {
  const d = pre.dados
  return String(
    d.razao_social || d.nome_fantasia || d.nome || d.descricao || d.codigo || 'Novo registro'
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}
