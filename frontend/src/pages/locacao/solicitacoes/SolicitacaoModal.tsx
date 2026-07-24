// ─────────────────────────────────────────────────────────────────────────────
// SolicitacaoModal — ficha da solicitação com avanço pelo pipeline.
// Mesmo fluxo da OS de Frotas: Pendente → Cotação → Aprovação → Programação →
// Execução → Liberado. O corpo muda conforme a etapa: o que se preenche em cada
// uma é o que aquela etapa exige (valor na Cotação, data na Programação…).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import {
  X, Loader2, CheckCircle2, Ban, ImageIcon, MapPin, User, Clock, ExternalLink,
  ArrowRight, RotateCcw, CalendarClock, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAtualizarSolicitacaoLocacao } from '../../../hooks/useLocacao'
import { STAGES, stageDe, proximaEtapa, type StageKey } from './solicitacaoStages'
import { TIPO_CFG, URGENCIA, BRL, diasEmAberto } from './SolicitacaoCards'
import type { LocSolicitacao } from '../../../types/locacao'

const dataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function SolicitacaoModal({ sol, onClose, isDark }: {
  sol: LocSolicitacao; onClose: () => void; isDark: boolean
}) {
  const atualizar = useAtualizarSolicitacaoLocacao()
  const [anexo, setAnexo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const etapa = stageDe(sol.status)
  const prox = proximaEtapa(etapa)

  // Campos que a etapa atual pede antes de deixar avançar.
  const [valorEstimado, setValorEstimado] = useState(sol.valor_estimado != null ? String(sol.valor_estimado) : '')
  const [valorFinal, setValorFinal] = useState(sol.valor_final != null ? String(sol.valor_final) : '')
  const [dataProgramada, setDataProgramada] = useState(sol.data_programada ?? '')

  // Portal grava URL pública; o ERP grava caminho no bucket privado.
  useEffect(() => {
    let vivo = true
    const raw = sol.anexo_url
    if (!raw) { setAnexo(null); return }
    if (/^https?:\/\//i.test(raw)) { setAnexo(raw); return }
    supabase.storage.from('locacao-faturas').createSignedUrl(raw, 3600).then(({ data }) => {
      if (vivo) setAnexo(data?.signedUrl ?? null)
    })
    return () => { vivo = false }
  }, [sol.anexo_url])

  const salvar = async (patch: Partial<LocSolicitacao>) => {
    setSalvando(true)
    try { await atualizar.mutateAsync({ id: sol.id, ...patch }); onClose() }
    finally { setSalvando(false) }
  }

  // Cada etapa carrega junto o dado que ela produziu.
  const avancar = () => {
    if (!prox) return
    const patch: Partial<LocSolicitacao> = { status: prox.key }
    if (etapa === 'em_cotacao' && valorEstimado) patch.valor_estimado = Number(valorEstimado)
    if (etapa === 'aprovada' && dataProgramada) patch.data_programada = dataProgramada
    if (etapa === 'em_execucao') {
      patch.data_conclusao = new Date().toISOString()
      patch.valor_final = valorFinal ? Number(valorFinal) : (sol.valor_estimado ?? null) as number | undefined
    }
    salvar(patch)
  }

  const bloqueio =
    etapa === 'em_cotacao' && !valorEstimado ? 'Informe o valor cotado para mandar à aprovação.' :
    etapa === 'aprovada' && !dataProgramada ? 'Defina a data programada para iniciar a execução.' :
    null

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 ${
    isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const encerrada = sol.status === 'concluida' || sol.status === 'cancelada' || sol.status === 'rejeitada'
  const u = URGENCIA[sol.urgencia] ?? URGENCIA.normal
  const t = TIPO_CFG[sol.tipo] ?? TIPO_CFG.manutencao

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0 ${border}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${u.cls}`}>{u.label}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${t.cls}`}>
                <t.icon size={9} /> {t.label}
              </span>
              <span className={`text-[10px] font-semibold ${txtMuted}`}>{diasEmAberto(sol)} dias em aberto</span>
            </div>
            <p className={`text-base font-extrabold leading-tight ${txt}`}>{sol.titulo}</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={18} />
          </button>
        </div>

        {/* Stepper — onde a solicitação está no fluxo */}
        <div className={`flex items-center gap-1 px-5 py-3 border-b overflow-x-auto hide-scrollbar shrink-0 ${border}`}>
          {STAGES.map((s, i) => {
            const idx = STAGES.findIndex(x => x.key === etapa)
            const passou = i < idx, atual = i === idx
            const Icon = s.icon
            return (
              <div key={s.key} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap ${
                  atual ? 'bg-indigo-600 text-white'
                  : passou ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                  : (isDark ? 'text-slate-600' : 'text-slate-300')
                }`}>
                  <Icon size={11} /> {s.label}
                </div>
                {i < STAGES.length - 1 && (
                  <span className={`w-2 h-px ${passou ? 'bg-emerald-400' : isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Imóvel</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                <MapPin size={13} className={txtMuted} /> {sol.imovel?.descricao ?? '—'}
              </p>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Aberta em</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                <Clock size={13} className={txtMuted} /> {dataHora(sol.created_at)}
              </p>
            </div>
            {sol.criado_por_nome && (
              <div className="col-span-2">
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Solicitante</p>
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${txt}`}>
                  <User size={13} className={txtMuted} /> {sol.criado_por_nome}
                </p>
              </div>
            )}
          </div>

          {sol.descricao && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Descrição</p>
              <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{sol.descricao}</p>
            </div>
          )}

          {sol.anexo_url && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>Anexo</p>
              {anexo ? (
                <a href={anexo} target="_blank" rel="noopener noreferrer" className="inline-block">
                  <img src={anexo} alt={sol.anexo_nome ?? 'Anexo'}
                    className={`max-h-56 rounded-xl border object-contain ${border}`}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                </a>
              ) : (
                <p className={`text-xs flex items-center gap-1.5 ${txtMuted}`}>
                  <ImageIcon size={13} /> {sol.anexo_nome ?? 'carregando anexo…'}
                </p>
              )}
            </div>
          )}

          {/* ── O que a etapa atual pede ─────────────────────────────────── */}
          {etapa === 'em_cotacao' && !encerrada && (
            <div className={`rounded-xl border p-3 ${isDark ? 'border-sky-500/20 bg-sky-500/5' : 'border-sky-200 bg-sky-50/60'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Cotação</p>
              <label className={`block text-[11px] font-semibold mb-1 ${txtMuted}`}>Valor cotado (R$)</label>
              <input type="number" step="0.01" value={valorEstimado} onChange={e => setValorEstimado(e.target.value)}
                placeholder="0,00" className={inputCls} />
              <p className={`text-[10px] mt-1.5 ${txtMuted}`}>
                Política de Compras: manutenção predial pede 2 orçamentos antes da aprovação.
              </p>
            </div>
          )}

          {etapa === 'aguardando_aprovacao' && !encerrada && (
            <div className={`rounded-xl border p-3 ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Aprovação</p>
              <p className={`text-sm font-bold ${txt}`}>{BRL(sol.valor_estimado)}</p>
              <p className={`text-[11px] mt-1 ${txtMuted}`}>
                Alçada: até R$ 3.000 aprova o Welton; acima disso, o Laucídio.
              </p>
            </div>
          )}

          {etapa === 'aprovada' && !encerrada && (
            <div className={`rounded-xl border p-3 ${isDark ? 'border-teal-500/20 bg-teal-500/5' : 'border-teal-200 bg-teal-50/60'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Programação</p>
              <label className={`block text-[11px] font-semibold mb-1 ${txtMuted}`}>Data programada</label>
              <input type="date" value={dataProgramada} onChange={e => setDataProgramada(e.target.value)} className={inputCls} />
              {sol.valor_estimado != null && (
                <p className={`text-[11px] mt-2 ${txtMuted}`}>Aprovado por {BRL(sol.valor_estimado)}.</p>
              )}
            </div>
          )}

          {etapa === 'em_execucao' && !encerrada && (
            <div className={`rounded-xl border p-3 ${isDark ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50/60'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>Execução</p>
              {sol.data_programada && (
                <p className={`text-[11px] mb-2 flex items-center gap-1.5 ${txtMuted}`}>
                  <CalendarClock size={12} /> Programada para {new Date(sol.data_programada + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              )}
              <label className={`block text-[11px] font-semibold mb-1 ${txtMuted}`}>Valor final (R$)</label>
              <input type="number" step="0.01" value={valorFinal} onChange={e => setValorFinal(e.target.value)}
                placeholder={sol.valor_estimado != null ? String(sol.valor_estimado) : '0,00'} className={inputCls} />
              <p className={`text-[10px] mt-1.5 ${txtMuted}`}>Em branco, usa o valor cotado.</p>
            </div>
          )}

          {encerrada && (
            <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Encerrada em</p>
                  <p className={`text-sm font-semibold ${txt}`}>{dataHora(sol.data_conclusao)}</p>
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Valor final</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{BRL(sol.valor_final ?? sol.valor_estimado)}</p>
                </div>
              </div>
            </div>
          )}

          {sol.cmp_requisicao_id && (
            <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isDark ? 'border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-300 text-indigo-700 hover:bg-indigo-50'
            }`}>
              <ExternalLink size={12} /> Ver no Compras
            </button>
          )}

          {bloqueio && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-600 font-semibold">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {bloqueio}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className={`px-5 py-4 border-t shrink-0 ${border}`}>
          {encerrada ? (
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs ${txtMuted}`}>
                Solicitação {sol.status === 'concluida' ? 'concluída' : sol.status === 'rejeitada' ? 'rejeitada' : 'cancelada'}.
              </p>
              <button onClick={() => salvar({ status: 'em_execucao' })} disabled={salvando}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
                  isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                } disabled:opacity-50`}>
                <RotateCcw size={13} /> Reabrir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {prox && (
                <button onClick={avancar} disabled={salvando || !!bloqueio}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40">
                  {salvando ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {prox.key === 'concluida' ? 'Liberar' : `Enviar para ${prox.label}`}
                </button>
              )}
              {etapa === 'aguardando_aprovacao' && (
                <button onClick={() => salvar({ status: 'rejeitada' })} disabled={salvando}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
                    isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'
                  } disabled:opacity-50`}>
                  Rejeitar
                </button>
              )}
              <button onClick={() => salvar({ status: 'concluida', data_conclusao: new Date().toISOString() })} disabled={salvando}
                title="Encerrar direto, sem passar pelas etapas"
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
                  isDark ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                } disabled:opacity-50`}>
                <CheckCircle2 size={14} />
              </button>
              <button onClick={() => salvar({ status: 'cancelada' })} disabled={salvando}
                title="Cancelar"
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
                  isDark ? 'border-white/10 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                } disabled:opacity-50`}>
                <Ban size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
