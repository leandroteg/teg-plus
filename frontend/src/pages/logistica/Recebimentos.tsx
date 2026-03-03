import { useState } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, X, Save, Loader2, Star,
} from 'lucide-react'
import { useRecebimentos, useConfirmarRecebimento, useAvaliarTransportadora } from '../../hooks/useLogistica'
import type { LogRecebimento } from '../../types/logistica'

const STATUS_RECEB = {
  pendente:   { label: 'Pendente',   bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  confirmado: { label: 'Confirmado', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  parcial:    { label: 'Parcial',    bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  recusado:   { label: 'Recusado',   bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
}

const fmtDataHora = (d?: string) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function Recebimentos() {
  const [statusFiltro, setStatusFiltro] = useState('pendente')
  const [confirmModal, setConfirmModal] = useState<LogRecebimento | null>(null)
  const [avaliacaoModal, setAvaliacaoModal] = useState<{ recebimento: LogRecebimento; transportadora_id: string; numero: string } | null>(null)
  const [checklist, setChecklist] = useState({
    quantidades_conferidas: false,
    estado_verificado: false,
    seriais_conferidos: false,
    temperatura_verificada: false,
  })
  const [statusReceb, setStatusReceb] = useState<'confirmado' | 'parcial' | 'recusado'>('confirmado')
  const [divergencias, setDivergencias] = useState('')
  const [avaliacao, setAvaliacao] = useState({ prazo: 5, qualidade: 5, comunicacao: 5, comentario: '' })

  const { data: recebimentos = [], isLoading } = useRecebimentos(statusFiltro ? { status: statusFiltro } : undefined)
  const confirmar = useConfirmarRecebimento()
  const avaliar = useAvaliarTransportadora()

  async function handleConfirmar() {
    if (!confirmModal) return
    await confirmar.mutateAsync({
      id: confirmModal.id,
      solicitacao_id: confirmModal.solicitacao_id,
      checklist,
      status: statusReceb,
      divergencias: divergencias || undefined,
    })
    setConfirmModal(null)
    setChecklist({ quantidades_conferidas: false, estado_verificado: false, seriais_conferidos: false, temperatura_verificada: false })
    setDivergencias('')
  }

  async function handleAvaliar() {
    if (!avaliacaoModal) return
    await avaliar.mutateAsync({
      transportadora_id: avaliacaoModal.transportadora_id,
      solicitacao_id: avaliacaoModal.recebimento.solicitacao_id,
      ...avaliacao,
    })
    setAvaliacaoModal(null)
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Recebimentos</h1>
          <p className="text-xs text-slate-400 mt-0.5">Confirmação de entrega pelo destinatário</p>
        </div>
      </div>

      {/* SLA Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <Clock size={15} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 font-medium">
          <strong>SLA de confirmação:</strong> Até 4 horas após a entrega física. Confirmações pendentes por mais de 24h geram alerta automático ao gestor.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[['pendente','Pendentes'],['confirmado','Confirmados'],['parcial','Parcial'],['recusado','Recusado'],['','Todos']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFiltro(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              statusFiltro === v ? 'bg-orange-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recebimentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum recebimento {statusFiltro === 'pendente' ? 'pendente' : 'encontrado'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recebimentos.map(r => {
            const cfg = STATUS_RECEB[r.status]
            const s = r.solicitacao
            const entregadoHa = r.entregue_em
              ? Math.round((Date.now() - new Date(r.entregue_em).getTime()) / 3600000)
              : null
            const atrasado = entregadoHa != null && entregadoHa > 4 && r.status === 'pendente'

            return (
              <div key={r.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${atrasado ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.status === 'confirmado' ? 'bg-emerald-50' : r.status === 'pendente' ? 'bg-amber-50' : 'bg-red-50'}`}>
                    {r.status === 'confirmado'
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : r.status === 'pendente'
                      ? <Clock size={16} className="text-amber-600" />
                      : <AlertTriangle size={16} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-800 font-mono">{s?.numero}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      {atrasado && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle size={9} /> {entregadoHa}h sem confirmar
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {s?.origem} → {s?.destino}
                      {s?.obra_nome ? ` · ${s?.obra_nome}` : ''}
                      {s?.solicitante_nome ? ` · ${s?.solicitante_nome}` : ''}
                    </p>
                    {r.entregue_em && (
                      <p className="text-[10px] text-slate-400">
                        Entregue em: {fmtDataHora(r.entregue_em)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {r.status === 'pendente' ? (
                      <button onClick={() => setConfirmModal(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700
                          text-white text-xs font-semibold transition-colors">
                        <CheckCircle2 size={12} /> Confirmar
                      </button>
                    ) : r.status === 'confirmado' && s?.transportadora?.nome_fantasia ? (
                      <button
                        onClick={() => setAvaliacaoModal({
                          recebimento: r,
                          transportadora_id: s?.transportadora_id ?? '',
                          numero: s?.numero ?? '',
                        })}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100
                          text-amber-700 text-xs font-semibold border border-amber-200 transition-colors"
                      >
                        <Star size={12} /> Avaliar
                      </button>
                    ) : null}
                  </div>
                </div>
                {r.status !== 'pendente' && (r.divergencias || r.confirmado_em) && (
                  <div className="border-t border-slate-50 px-4 py-2.5 space-y-1">
                    {r.confirmado_em && (
                      <p className="text-[10px] text-slate-400">
                        Confirmado por <strong>{r.confirmado_nome ?? '—'}</strong> em {fmtDataHora(r.confirmado_em)}
                      </p>
                    )}
                    {r.divergencias && (
                      <p className="text-[10px] text-amber-600 font-medium">Divergências: {r.divergencias}</p>
                    )}
                    {r.assinatura_digital && (
                      <p className="text-[9px] text-slate-400 font-mono">Assinatura: {r.assinatura_digital}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Confirmação ──────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Confirmar Recebimento</h2>
              <button onClick={() => setConfirmModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-xs font-bold text-slate-700">{confirmModal.solicitacao?.numero}</p>
                <p className="text-[10px] text-slate-400">
                  {confirmModal.solicitacao?.origem} → {confirmModal.solicitacao?.destino}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">Checklist de Recebimento</p>
                <div className="space-y-2">
                  {([
                    ['quantidades_conferidas', 'Quantidades conferidas contra NF-e'],
                    ['estado_verificado',      'Estado dos itens verificado (avarias, violação)'],
                    ['seriais_conferidos',     'Itens de alta precisão conferidos individualmente'],
                    ['temperatura_verificada', 'Temperatura verificada (itens com controle especial)'],
                  ] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox"
                        checked={checklist[k as keyof typeof checklist]}
                        onChange={e => setChecklist(p => ({ ...p, [k]: e.target.checked }))}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs text-slate-600">{l}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Resultado *</label>
                <div className="flex gap-2">
                  {([
                    ['confirmado', 'Confirmado', 'bg-emerald-600'],
                    ['parcial',    'Parcial',    'bg-blue-600'],
                    ['recusado',   'Recusado',   'bg-red-600'],
                  ] as const).map(([v, l, c]) => (
                    <button key={v} onClick={() => setStatusReceb(v)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors text-white ${statusReceb === v ? c : 'bg-slate-200 text-slate-600'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {(statusReceb === 'parcial' || statusReceb === 'recusado') && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Descrição das Divergências *</label>
                  <textarea value={divergencias} onChange={e => setDivergencias(e.target.value)}
                    rows={2} className="input-base resize-none" placeholder="Descreva as divergências encontradas..." />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleConfirmar} disabled={confirmar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {confirmar.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmar Recebimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Avaliação ────────────────────────────────────── */}
      {avaliacaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Avaliar Transportadora</h2>
              <button onClick={() => setAvaliacaoModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {([
                ['prazo',        'Prazo de Entrega'],
                ['qualidade',    'Qualidade / Integridade'],
                ['comunicacao',  'Comunicação'],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{label}</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setAvaliacao(p => ({ ...p, [k]: n }))}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                          avaliacao[k] >= n
                            ? 'bg-amber-400 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-400 hover:bg-amber-100'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Comentário</label>
                <textarea value={avaliacao.comentario} onChange={e => setAvaliacao(p => ({ ...p, comentario: e.target.value }))}
                  rows={2} className="input-base resize-none" placeholder="Observações sobre o serviço..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAvaliacaoModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Pular
              </button>
              <button onClick={handleAvaliar} disabled={avaliar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {avaliar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                Enviar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
