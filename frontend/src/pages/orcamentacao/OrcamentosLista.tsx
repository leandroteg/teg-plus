import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, Plus, RefreshCw, ArrowRight, Pencil, Trash2, X, Check, RotateCw, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrcamentos, useExcluirOrcamento, useReprocessarOrcamento, useAtualizarOrcamento } from '../../hooks/useOrcamentacao'
import type { Orcamento } from '../../types/orcamentacao'
import { fmtMM, fmtNum, fmtData, StatusBadge, CARD } from './_ui'

export default function OrcamentosLista() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: orcamentos = [], isLoading, refetch } = useOrcamentos()
  const excluir = useExcluirOrcamento()
  const reprocessar = useReprocessarOrcamento()
  const atualizar = useAtualizarOrcamento()

  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  function abrirEdicao(o: Orcamento) {
    setEditando(o); setNome(o.nome); setDescricao(o.descricao ?? '')
  }
  async function salvarEdicao() {
    if (!editando) return
    await atualizar.mutateAsync({ id: editando.id, nome, descricao })
    setEditando(null)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const btn = `p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <MapIcon size={22} className="text-amber-500" /> Orçamentos
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>Criar, editar, reprocessar e excluir orçamentos de LT</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={16} />
          </button>
          <button onClick={() => nav('/orcamentacao/novo')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm">
            <Plus size={16} /> Novo Orçamento
          </button>
        </div>
      </div>

      <section className={`${CARD(isDark)} overflow-hidden`}>
        <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
          <h2 className={`text-sm font-extrabold ${txt}`}>Todos os orçamentos</h2>
          <span className={`text-[11px] ${txtMuted}`}>{orcamentos.length} registro(s)</span>
        </div>

        {orcamentos.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
              <MapIcon size={26} className="text-amber-500" />
            </div>
            <p className={`text-sm font-bold ${txt}`}>Nenhum orçamento ainda</p>
            <button onClick={() => nav('/orcamentacao/novo')} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              <Plus size={16} /> Criar primeiro orçamento
            </button>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-slate-100'}`}>
            {orcamentos.map(o => {
              const r = o.resultado?.resumo
              const delConfirm = confirmDel === o.id
              return (
                <div key={o.id} className={`flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/60'}`}>
                  <button onClick={() => nav(`/orcamentacao/${o.id}`)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{o.numero ?? '—'}</span>
                      <StatusBadge status={o.status} isDark={isDark} />
                    </div>
                    <p className={`text-sm font-semibold truncate ${txt}`}>{o.nome}</p>
                    <p className={`text-[11px] truncate ${txtMuted}`}>
                      {r ? `${fmtNum(r.extensao_km, 1)} km · ${fmtNum(r.us)} US · custo ${fmtMM(r.custo_total)}` : (o.descricao || 'Aguardando estimativa')}
                      {' · '}{fmtData(o.created_at)}
                    </p>
                  </button>

                  {/* Ações */}
                  {delConfirm ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>Excluir?</span>
                      <button
                        onClick={async () => { await excluir.mutateAsync(o.id); setConfirmDel(null) }}
                        disabled={excluir.isPending}
                        className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60"
                        title="Confirmar exclusão"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => setConfirmDel(null)} className={btn} title="Cancelar"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => abrirEdicao(o)} className={btn} title="Editar nome/descrição"><Pencil size={15} /></button>
                      <button
                        onClick={() => reprocessar.mutate(o.id)}
                        disabled={reprocessar.isPending || o.status === 'processando'}
                        className={btn} title="Reprocessar (rodar o SuperTEG de novo)"
                      >
                        <RotateCw size={15} className={o.status === 'processando' ? 'animate-spin' : ''} />
                      </button>
                      <button onClick={() => setConfirmDel(o.id)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/15 text-slate-400 hover:text-rose-300' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`} title="Excluir"><Trash2 size={15} /></button>
                      <button onClick={() => nav(`/orcamentacao/${o.id}`)} className={btn} title="Abrir"><ArrowRight size={15} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              <p className={`text-sm font-extrabold flex items-center gap-1.5 ${txt}`}><Pencil size={14} className="text-amber-500" /> Editar orçamento</p>
              <button onClick={() => setEditando(null)} className={btn}><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider ${txtMuted}`}>Nome</label>
                <input className={`w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div>
                <label className={`text-[11px] font-bold uppercase tracking-wider ${txtMuted}`}>Descrição</label>
                <input className={`w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none ${isDark ? 'bg-white/[0.04] border-white/[0.08] text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={descricao} onChange={e => setDescricao(e.target.value)} />
              </div>
              <div className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 ${isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <span>Para mudar premissas (US, terreno) ou o KMZ, crie um novo orçamento e reprocesse.</span>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditando(null)} className={`px-3 py-2 rounded-xl text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}>Cancelar</button>
                <button onClick={salvarEdicao} disabled={atualizar.isPending || !nome.trim()} className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60">
                  {atualizar.isPending ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
