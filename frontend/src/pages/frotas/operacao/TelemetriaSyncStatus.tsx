import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, RadioTower } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useTelSyncLog } from '../../../hooks/useFrotas'
import type { FroTelSyncLog } from '../../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const ENDPOINT_LABEL: Record<string, string> = {
  positions: 'Posições',
  behaviors: 'Comportamentos',
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

// Traduz erros técnicos recorrentes para algo acionável pela operação.
function explicarErro(erro: string | null): string {
  if (!erro) return 'Falha não detalhada'
  if (erro.includes('403')) return 'Acesso negado pela Mobi7 — IP do servidor não autorizado'
  if (erro.includes('401')) return 'Credencial da Mobi7 inválida ou expirada'
  if (erro.includes('429')) return 'Limite de requisições da Mobi7 atingido'
  if (erro.includes('400')) return 'Requisição inválida ao provedor/banco'
  if (/timeout|ETIMEDOUT|ECONNRESET/i.test(erro)) return 'Tempo de resposta esgotado'
  return erro.length > 90 ? erro.slice(0, 90) + '…' : erro
}

// ── Component ───────────────────────────────────────────────────────────────
export default function TelemetriaSyncStatus() {
  const { isDark } = useTheme()
  const { data: logs = [], isLoading, isError } = useTelSyncLog(20)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const { ultimo, falhasRecentes, statusGeral } = useMemo(() => {
    const ultimo: FroTelSyncLog | null = logs[0] ?? null
    // status = baseado na última execução de cada endpoint
    const ultimoPorEndpoint = new Map<string, FroTelSyncLog>()
    for (const l of logs) if (!ultimoPorEndpoint.has(l.endpoint)) ultimoPorEndpoint.set(l.endpoint, l)
    const correntes = [...ultimoPorEndpoint.values()]
    const falhasRecentes = correntes.filter(l => !l.ok).length
    const statusGeral: 'ok' | 'falha' | 'vazio' =
      logs.length === 0 ? 'vazio' : falhasRecentes > 0 ? 'falha' : 'ok'
    return { ultimo, falhasRecentes, statusGeral }
  }, [logs])

  // Discreto: não renderiza nada enquanto carrega pela 1ª vez.
  if (isLoading && logs.length === 0) return null

  // Estilo do pill conforme estado
  const dotCls =
    statusGeral === 'falha'
      ? 'bg-rose-500'
      : statusGeral === 'ok'
        ? 'bg-emerald-500'
        : isDark ? 'bg-slate-500' : 'bg-slate-400'

  const pillCls = isDark
    ? 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'

  const label =
    isError ? 'Telemetria: status indisponível'
      : statusGeral === 'falha' ? `Telemetria: ${falhasRecentes} ${falhasRecentes === 1 ? 'falha' : 'falhas'}`
        : statusGeral === 'ok' ? `Telemetria sincronizada${ultimo ? ' · ' + tempoRelativo(ultimo.created_at) : ''}`
          : 'Telemetria: sem registros'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Status de sincronização da telemetria"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${pillCls}`}
      >
        <span className="relative flex h-2 w-2">
          {statusGeral === 'falha' && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotCls}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotCls}`} />
        </span>
        {label}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-xl ${
            isDark ? 'border-white/[0.08] bg-[#1e293b]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className={`flex items-center gap-2 border-b px-4 py-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <RadioTower size={15} className="text-teal-500" />
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Sincronização de Telemetria</span>
          </div>

          {statusGeral === 'falha' && (
            <div className={`flex items-start gap-2 px-4 py-2.5 text-[11px] ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{ultimo ? explicarErro(logs.find(l => !l.ok)?.erro ?? null) : 'Última sincronização falhou'}</span>
            </div>
          )}

          <div className="max-h-72 overflow-auto py-1">
            {logs.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Nenhuma execução registrada ainda.</p>
            ) : (
              logs.map(l => (
                <div
                  key={l.id}
                  className={`flex items-center gap-3 px-4 py-2 ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                >
                  {l.ok
                    ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    : <AlertTriangle size={14} className="shrink-0 text-rose-500" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {ENDPOINT_LABEL[l.endpoint] ?? l.endpoint}
                      </span>
                      <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                        {l.provider}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-slate-500">
                      {l.ok
                        ? `${l.inseridos ?? 0} registro(s) · ${l.veiculos ?? 0} veículos`
                        : explicarErro(l.erro)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500">{tempoRelativo(l.created_at)}</span>
                </div>
              ))
            )}
          </div>

          <div className={`flex items-center gap-1.5 border-t px-4 py-2 text-[10px] text-slate-500 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <Activity size={11} />
            Atualiza automaticamente a cada minuto
          </div>
        </div>
      )}
    </div>
  )
}
