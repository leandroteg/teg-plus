import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ClipboardList, CheckCircle2, Clock, Loader2, FileText } from 'lucide-react'
import { supabase } from '../../services/supabase'
import type { PortalUser } from '../../hooks/usePortalAuth'

interface Missao {
  id: string
  categoria: string
  titulo: string
  descricao: string | null
  status: string
  prazo: string | null
  acao_url: string | null
  acao_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  concluida_em: string | null
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '')

export default function PortalMissoes({ user, onBack }: { user: PortalUser; onBack: () => void }) {
  const [missoes, setMissoes] = useState<Missao[]>([])
  const [loading, setLoading] = useState(true)
  const [concluindo, setConcluindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('portalteg_missoes_listar', { p_colaborador_id: user.id })
    setMissoes((data ?? []) as Missao[])
    setLoading(false)
  }, [user.id])

  useEffect(() => { carregar() }, [carregar])

  const concluir = async (m: Missao) => {
    setConcluindo(m.id)
    const { data } = await supabase.rpc('portalteg_missao_concluir', { p_colaborador_id: user.id, p_missao_id: m.id })
    setConcluindo(null)
    if (data) carregar()
  }

  const pendentes = missoes.filter(m => m.status === 'pendente')
  const concluidas = missoes.filter(m => m.status === 'concluida')

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #0F172A 0%, #134E4A 50%, #0F766E 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <header className="px-4 sm:px-6 pt-5 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white transition-all">
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-white font-extrabold text-sm flex items-center gap-1.5">
            <ClipboardList size={16} className="text-teal-300" /> Minhas Missões
          </p>
          <p className="text-slate-400 text-[10px] mt-0.5">Procedimentos e ciência · {pendentes.length} pendente(s)</p>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-teal-300" /></div>
        ) : missoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <CheckCircle2 size={40} className="text-teal-400/60" />
            <p className="text-slate-300 text-sm font-semibold">Nenhuma missão no momento</p>
            <p className="text-slate-500 text-xs">Você está em dia! 🎉</p>
          </div>
        ) : (
          <>
            {pendentes.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendentes</p>
                {pendentes.map(m => (
                  <div key={m.id} className="rounded-2xl bg-white/[0.05] border border-white/[0.08] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-amber-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm">{m.titulo}</p>
                        {m.descricao && <p className="text-slate-400 text-xs mt-0.5">{m.descricao}</p>}
                        {m.prazo && <p className="text-amber-300 text-[10px] mt-1 flex items-center gap-1"><Clock size={10} /> Prazo {fmtDate(m.prazo)}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {m.acao_url && (
                        <a href={m.acao_url} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-center py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-200 text-xs font-semibold">
                          Abrir documento
                        </a>
                      )}
                      <button onClick={() => concluir(m)} disabled={concluindo === m.id}
                        className="flex-1 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                        {concluindo === m.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Li e estou ciente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {concluidas.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Concluídas</p>
                {concluidas.map(m => (
                  <div key={m.id} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="text-slate-300 text-xs flex-1 truncate">{m.titulo}</span>
                    <span className="text-slate-500 text-[10px]">{fmtDate(m.concluida_em)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
