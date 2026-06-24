// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/Verificacoes.tsx — Caixa de comando para o SuperTEG + lista de tasks.
// Assíncrono: cada envio vira uma task "processando" na lista; pode enviar várias.
// Ao concluir, o PDF aparece na aba "Relatórios".
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Send, Loader2, CheckCircle2, AlertTriangle, Clock, ShieldCheck, FileSearch, ScrollText, FileQuestion } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useVerificacoes, useCriarVerificacao, type VerificacaoTipo } from '../../hooks/useVerificacoes'

const TIPOS: { key: VerificacaoTipo; label: string; icon: typeof ShieldCheck }[] = [
  { key: 'verificacao', label: 'Verificação', icon: ShieldCheck },
  { key: 'parecer',     label: 'Parecer',     icon: FileSearch },
  { key: 'historico',   label: 'Histórico',   icon: ScrollText },
  { key: 'outros',      label: 'Outros',      icon: FileQuestion },
]

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}

export default function Verificacoes() {
  const { isDark } = useTheme()
  const { data: verificacoes = [] } = useVerificacoes()
  const criar = useCriarVerificacao()

  const [tipo, setTipo] = useState<VerificacaoTipo>('verificacao')
  const [titulo, setTitulo] = useState('')
  const [comando, setComando] = useState('')
  const [enviado, setEnviado] = useState(false)

  const card = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'

  async function enviar() {
    if (!comando.trim() || criar.isPending) return
    try {
      await criar.mutateAsync({ tipo, comando: comando.trim(), titulo: titulo.trim() || undefined })
      setComando(''); setTitulo('')
      setEnviado(true); setTimeout(() => setEnviado(false), 6000)
    } catch { /* erro mostrado abaixo */ }
  }

  const statusCfg = {
    processando: { label: 'Processando', icon: Loader2, cls: isDark ? 'text-amber-300 bg-amber-500/15' : 'text-amber-700 bg-amber-50', spin: true },
    concluido:   { label: 'Concluído',   icon: CheckCircle2, cls: isDark ? 'text-emerald-300 bg-emerald-500/15' : 'text-emerald-700 bg-emerald-50', spin: false },
    erro:        { label: 'Erro',        icon: AlertTriangle, cls: isDark ? 'text-red-300 bg-red-500/15' : 'text-red-700 bg-red-50', spin: false },
  } as const

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* Caixa de comando */}
      <div className={`rounded-2xl border p-4 ${card}`}>
        <p className={`text-sm font-bold mb-3 ${txtMain}`}>Enviar comando ao SuperTEG</p>

        {/* Tipo */}
        <div className="flex flex-wrap gap-2 mb-3">
          {TIPOS.map(t => {
            const Icon = t.icon
            const active = tipo === t.key
            return (
              <button key={t.key} onClick={() => setTipo(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  active
                    ? (isDark ? 'bg-violet-500/20 text-violet-200 border-violet-500/30' : 'bg-violet-100 text-violet-800 border-violet-200')
                    : (isDark ? 'bg-white/[0.03] text-slate-400 border-white/[0.06]' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-white')
                }`}>
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>

        <input
          value={titulo} onChange={e => setTitulo(e.target.value)}
          placeholder="Título (opcional) — ex.: Verificação ASO João Silva"
          className={`w-full mb-2 px-3 py-2 rounded-lg text-sm border outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />
        <textarea
          value={comando} onChange={e => setComando(e.target.value)}
          rows={4}
          placeholder="Descreva o comando para o SuperTEG…"
          className={`w-full px-3 py-2 rounded-lg text-sm border outline-none resize-y ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
        />

        <div className="flex items-center justify-between mt-3 gap-3">
          <div className="text-xs">
            {criar.isError && <span className="text-red-500 font-semibold">Falha ao enviar: {(criar.error as Error)?.message}</span>}
            {enviado && !criar.isError && (
              <span className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
                <CheckCircle2 size={14} /> Enviado — acompanhe abaixo; o PDF aparece na aba <b>Relatórios</b>
              </span>
            )}
          </div>
          <button onClick={enviar} disabled={!comando.trim() || criar.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 ${isDark ? 'bg-violet-500/90 hover:bg-violet-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}>
            {criar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar
          </button>
        </div>
      </div>

      {/* Lista de tasks */}
      <div className={`rounded-2xl border p-4 ${card}`}>
        <p className={`text-sm font-bold mb-3 ${txtMain}`}>Tarefas ({verificacoes.length})</p>
        {verificacoes.length === 0 ? (
          <p className={`text-xs ${txtMuted}`}>Nenhuma verificação ainda. Envie um comando acima.</p>
        ) : (
          <div className="space-y-2">
            {verificacoes.map(v => {
              const sc = statusCfg[v.status]
              const SIcon = sc.icon
              const tipoLabel = TIPOS.find(t => t.key === v.tipo)?.label ?? v.tipo
              return (
                <div key={v.id} className={`flex items-start gap-3 p-3 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
                  <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.cls}`}>
                    <SIcon size={11} className={sc.spin ? 'animate-spin' : ''} /> {sc.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${txtMain}`}>{v.titulo || tipoLabel}</p>
                    <p className={`text-xs truncate ${txtMuted}`}>{v.comando}</p>
                    {v.status === 'erro' && v.erro && <p className="text-xs text-red-500 mt-0.5">{v.erro}</p>}
                    {v.status === 'concluido' && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>✓ Pronto — veja o PDF na aba <b>Relatórios</b></p>}
                  </div>
                  <span className={`text-[10px] shrink-0 flex items-center gap-1 ${txtMuted}`}><Clock size={10} /> {fmtDate(v.created_at)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
