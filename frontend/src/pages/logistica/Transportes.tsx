import { useState, useMemo } from 'react'
import {
  Truck, AlertTriangle, CheckCircle2, X, Save, Loader2,
  MapPin, Clock, ChevronDown, Route,
} from 'lucide-react'
import {
  useTransportes, useRegistrarOcorrencia, useResolverOcorrencia,
  useConfirmarEntregaFisica,
} from '../../hooks/useLogistica'
import { useTheme } from '../../contexts/ThemeContext'
import { StatusBadge } from './LogisticaHome'
import type { TipoOcorrencia, LogTransporte } from '../../types/logistica'

type DisplayItem =
  | { kind: 'solo'; transport: LogTransporte }
  | { kind: 'viagem'; viagemId: string; viagem: LogTransporte['viagem']; transportes: LogTransporte[] }

const OCORRENCIA_LABEL: Record<TipoOcorrencia, { label: string; cor: string }> = {
  avaria_veiculo:          { label: 'Avaria do Veículo',        cor: 'text-amber-700'  },
  acidente:                { label: 'Acidente',                 cor: 'text-red-700'    },
  atraso:                  { label: 'Atraso',                   cor: 'text-orange-700' },
  desvio_rota:             { label: 'Desvio de Rota',           cor: 'text-violet-700' },
  parada_nao_programada:   { label: 'Parada Não Programada',    cor: 'text-blue-700'   },
  avaria_carga:            { label: 'Avaria na Carga',          cor: 'text-red-700'    },
  roubo:                   { label: 'Roubo / Furto',            cor: 'text-red-900'    },
  outro:                   { label: 'Outro',                    cor: 'text-slate-600'  },
}

const fmtHora = (d?: string) =>
  d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

const fmtDataHora = (d?: string) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function Transportes() {
  const { isDark } = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [ocorrenciaModal, setOcorrenciaModal] = useState<{ transporte_id: string; solicitacao_id: string } | null>(null)
  const [ocForm, setOcForm] = useState<{ tipo: TipoOcorrencia; descricao: string; localizacao?: string }>({
    tipo: 'atraso', descricao: '',
  })
  const [entregaModal, setEntregaModal] = useState<{ transporte_id: string; solicitacao_id: string; numero: string; viagem_id?: string } | null>(null)

  const { data: transportes = [], isLoading } = useTransportes()
  const registrarOcorrencia = useRegistrarOcorrencia()
  const resolverOcorrencia = useResolverOcorrencia()
  const confirmarEntrega = useConfirmarEntregaFisica()

  const displayItems = useMemo<DisplayItem[]>(() => {
    const viagemMap = new Map<string, LogTransporte[]>()
    const solos: LogTransporte[] = []

    for (const t of transportes) {
      if (t.viagem_id) {
        const list = viagemMap.get(t.viagem_id) ?? []
        list.push(t)
        viagemMap.set(t.viagem_id, list)
      } else {
        solos.push(t)
      }
    }

    const items: DisplayItem[] = []

    for (const [viagemId, list] of viagemMap) {
      list.sort((a, b) => (a.solicitacao?.ordem_na_viagem ?? 0) - (b.solicitacao?.ordem_na_viagem ?? 0))
      items.push({ kind: 'viagem', viagemId, viagem: list[0].viagem, transportes: list })
    }

    for (const t of solos) {
      items.push({ kind: 'solo', transport: t })
    }

    return items
  }, [transportes])

  async function handleRegistrarOcorrencia() {
    if (!ocorrenciaModal || !ocForm.descricao) return
    await registrarOcorrencia.mutateAsync({
      ...ocorrenciaModal,
      ...ocForm,
    })
    setOcorrenciaModal(null)
    setOcForm({ tipo: 'atraso', descricao: '' })
  }

  async function handleConfirmarEntrega() {
    if (!entregaModal) return
    await confirmarEntrega.mutateAsync({
      transporte_id: entregaModal.transporte_id,
      solicitacao_id: entregaModal.solicitacao_id,
      viagem_id: entregaModal.viagem_id,
    })
    setEntregaModal(null)
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Transportes em Trânsito</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{transportes.length} transporte(s) ativo(s)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transportes.length === 0 ? (
        <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <Truck size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
          <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum transporte em trânsito</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Quando uma carga for despachada, ela aparecerá aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map(item => {
            if (item.kind === 'viagem') {
              return (
                <ViagemTransportCard
                  key={`vg-${item.viagemId}`}
                  item={item}
                  isDark={isDark}
                  expandedId={expandedId}
                  setExpandedId={setExpandedId}
                  setOcorrenciaModal={setOcorrenciaModal}
                  setEntregaModal={setEntregaModal}
                  resolverOcorrencia={resolverOcorrencia}
                />
              )
            }

            const t = item.transport
            const s = t.solicitacao
            const isExp = expandedId === t.id
            const ocorrencias = t.ocorrencias ?? []
            const ocAberta = ocorrencias.filter(o => !o.resolvido)
            const atrasado = t.eta_atual && new Date(t.eta_atual) < new Date()

            return (
              <div key={t.id} className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? `bg-[#1e293b] ${ocAberta.length > 0 ? 'border-red-500/30' : atrasado ? 'border-amber-500/30' : 'border-white/[0.06]'}` : `bg-white ${ocAberta.length > 0 ? 'border-red-200' : atrasado ? 'border-amber-200' : 'border-slate-200'}`}`}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  onClick={() => setExpandedId(isExp ? null : t.id)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ocAberta.length > 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                    {ocAberta.length > 0
                      ? <AlertTriangle size={16} className="text-red-500" />
                      : <Truck size={16} className="text-orange-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s?.numero}</p>
                      {s?.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">URGENTE</span>}
                      {ocAberta.length > 0 && (
                        <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                          {ocAberta.length} ocorrencia(s)
                        </span>
                      )}
                      {atrasado && !ocAberta.length && (
                        <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">ATRASADO</span>
                      )}
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {s?.origem} → {s?.destino}
                      {s?.obra_nome ? ` · ${s?.obra_nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-2 hidden sm:block">
                    <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.motorista_nome ?? '—'}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.placa ?? '—'}</p>
                    {t.eta_atual && (
                      <p className={`text-[10px] font-semibold ${atrasado ? 'text-red-500' : 'text-slate-400'}`}>
                        ETA: {fmtDataHora(t.eta_atual)}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                </div>

                {isExp && (
                  <div className={`px-4 py-4 space-y-4 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                    {/* Info do transporte */}
                    <div className="grid grid-cols-3 gap-3">
                      <Detail label="Saida" value={fmtDataHora(t.hora_saida)} />
                      <Detail label="ETA Original" value={fmtDataHora(t.eta_original)} />
                      <Detail label="ETA Atual" value={fmtDataHora(t.eta_atual)} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Detail label="Placa" value={t.placa ?? '—'} />
                      <Detail label="Motorista" value={t.motorista_nome ?? '—'} />
                      <Detail label="Telefone" value={t.motorista_telefone ?? '—'} />
                    </div>
                    {t.codigo_rastreio && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <MapPin size={12} className="text-blue-500" />
                        <p className="text-xs text-blue-700 font-mono">Rastreio: {t.codigo_rastreio}</p>
                      </div>
                    )}

                    {/* Ocorrencias */}
                    {ocorrencias.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-slate-600 mb-2">Ocorrencias</p>
                        <div className="space-y-2">
                          {ocorrencias.map(oc => (
                            <div key={oc.id} className={`rounded-xl px-3 py-2 border ${oc.resolvido ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold ${OCORRENCIA_LABEL[oc.tipo]?.cor ?? 'text-slate-700'}`}>
                                  {OCORRENCIA_LABEL[oc.tipo]?.label ?? oc.tipo}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-400">{fmtDataHora(oc.registrado_em)}</span>
                                  {oc.resolvido
                                    ? <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">Resolvido</span>
                                    : (
                                      <button
                                        onClick={() => resolverOcorrencia.mutate({ id: oc.id, resolucao: 'Resolvido pelo operador' })}
                                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded-full"
                                      >
                                        Resolver
                                      </button>
                                    )
                                  }
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-600 mt-0.5">{oc.descricao}</p>
                              {oc.localizacao && <p className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin size={9} />{oc.localizacao}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Acoes */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOcorrenciaModal({ transporte_id: t.id, solicitacao_id: t.solicitacao_id })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100
                          text-amber-700 text-xs font-semibold transition-colors border border-amber-200"
                      >
                        <AlertTriangle size={12} /> Registrar Ocorrencia
                      </button>
                      <button
                        onClick={() => setEntregaModal({ transporte_id: t.id, solicitacao_id: t.solicitacao_id, numero: s?.numero ?? '' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700
                          text-white text-xs font-semibold transition-colors"
                      >
                        <CheckCircle2 size={12} /> Confirmar Entrega
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Ocorrência ───────────────────────────────────── */}
      {ocorrenciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Registrar Ocorrência</h2>
              <button onClick={() => setOcorrenciaModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Ocorrência *</label>
                <select value={ocForm.tipo} onChange={e => setOcForm(p => ({ ...p, tipo: e.target.value as TipoOcorrencia }))}
                  className="input-base">
                  {Object.entries(OCORRENCIA_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição *</label>
                <textarea value={ocForm.descricao} onChange={e => setOcForm(p => ({ ...p, descricao: e.target.value }))}
                  rows={3} className="input-base resize-none" placeholder="Descreva a ocorrência..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Localização</label>
                <input value={ocForm.localizacao ?? ''} onChange={e => setOcForm(p => ({ ...p, localizacao: e.target.value }))}
                  className="input-base" placeholder="Rodovia, km, cidade..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setOcorrenciaModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleRegistrarOcorrencia} disabled={registrarOcorrencia.isPending || !ocForm.descricao}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {registrarOcorrencia.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmar Entrega ────────────────────────────── */}
      {entregaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className="px-6 py-5 text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                <CheckCircle2 size={24} className="text-emerald-600" />
              </div>
              <h2 className={`text-lg font-extrabold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>Confirmar Entrega Física</h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Confirmar que a carga <strong>{entregaModal.numero}</strong> foi entregue fisicamente no destino.
                O destinatário deverá confirmar o recebimento via checklist.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setEntregaModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleConfirmarEntrega} disabled={confirmarEntrega.isPending}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white
                  text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {confirmarEntrega.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ViagemTransportCard({
  item,
  isDark,
  expandedId,
  setExpandedId,
  setOcorrenciaModal,
  setEntregaModal,
  resolverOcorrencia,
}: {
  item: Extract<DisplayItem, { kind: 'viagem' }>
  isDark: boolean
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  setOcorrenciaModal: (v: { transporte_id: string; solicitacao_id: string } | null) => void
  setEntregaModal: (v: { transporte_id: string; solicitacao_id: string; numero: string; viagem_id?: string } | null) => void
  resolverOcorrencia: ReturnType<typeof useResolverOcorrencia>
}) {
  const { viagem, transportes, viagemId } = item
  const isExp = expandedId === `vg-${viagemId}`
  const delivered = transportes.filter(t => !!t.hora_chegada).length
  const total = transportes.length
  const allOcAbertas = transportes.flatMap(t => (t.ocorrencias ?? []).filter(o => !o.resolvido))

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark
      ? `bg-[#1e293b] ${allOcAbertas.length > 0 ? 'border-red-500/30' : 'border-white/[0.06]'}`
      : `bg-white ${allOcAbertas.length > 0 ? 'border-red-200' : 'border-slate-200'}`
    }`}>
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
        onClick={() => setExpandedId(isExp ? null : `vg-${viagemId}`)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
          <Route size={16} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {viagem?.numero ?? `VG-${viagemId.slice(0, 4).toUpperCase()}`}
            </p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              delivered === total
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {delivered}/{total} entregues
            </span>
            {allOcAbertas.length > 0 && (
              <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                {allOcAbertas.length} ocorrencia(s)
              </span>
            )}
          </div>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {viagem?.origem_principal ?? transportes[0]?.solicitacao?.origem} → {viagem?.destino_final ?? transportes[transportes.length - 1]?.solicitacao?.destino}
          </p>
        </div>
        <div className="text-right shrink-0 mr-2 hidden sm:block">
          <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{viagem?.motorista_nome ?? transportes[0]?.motorista_nome ?? '—'}</p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{viagem?.veiculo_placa ?? transportes[0]?.placa ?? '—'}</p>
        </div>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
      </div>

      {/* Progress bar */}
      <div className={`px-4 pb-2 ${!isExp ? '' : 'hidden'}`}>
        <div className="flex gap-1">
          {transportes.map((t, i) => (
            <div
              key={t.id}
              className={`h-1.5 rounded-full flex-1 ${
                t.hora_chegada
                  ? 'bg-emerald-400'
                  : isDark ? 'bg-white/10' : 'bg-slate-200'
              }`}
              title={`Parada ${i + 1}: ${t.solicitacao?.numero ?? ''} - ${t.hora_chegada ? 'Entregue' : 'Em transito'}`}
            />
          ))}
        </div>
      </div>

      {/* Expanded sub-items */}
      {isExp && (
        <div className={`px-4 py-3 space-y-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
          {/* Progress bar inside expanded */}
          <div className="flex gap-1 mb-3">
            {transportes.map((t, i) => (
              <div
                key={t.id}
                className={`h-2 rounded-full flex-1 ${
                  t.hora_chegada
                    ? 'bg-emerald-400'
                    : isDark ? 'bg-white/10' : 'bg-slate-200'
                }`}
                title={`Parada ${i + 1}: ${t.solicitacao?.numero ?? ''}`}
              />
            ))}
          </div>

          {transportes.map((t, idx) => {
            const s = t.solicitacao
            const ocorrencias = t.ocorrencias ?? []
            const ocAberta = ocorrencias.filter(o => !o.resolvido)
            const isDelivered = !!t.hora_chegada
            const atrasado = !isDelivered && t.eta_atual && new Date(t.eta_atual) < new Date()

            return (
              <div
                key={t.id}
                className={`rounded-xl border px-3 py-2.5 ${isDark
                  ? `${isDelivered ? 'bg-emerald-500/5 border-emerald-500/20' : ocAberta.length > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02] border-white/[0.06]'}`
                  : `${isDelivered ? 'bg-emerald-50 border-emerald-200' : ocAberta.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[10px] font-bold shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${
                      isDelivered
                        ? 'bg-emerald-100 text-emerald-700'
                        : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {s?.ordem_na_viagem ?? idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s?.numero}</p>
                        {isDelivered ? (
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <CheckCircle2 size={8} /> Entregue {fmtHora(t.hora_chegada)}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
                            Em transito
                          </span>
                        )}
                        {atrasado && (
                          <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">ATRASADO</span>
                        )}
                      </div>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {s?.origem} → {s?.destino}
                        {s?.obra_nome ? ` · ${s.obra_nome}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.eta_atual && !isDelivered && (
                      <p className={`text-[10px] font-semibold ${atrasado ? 'text-red-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        ETA: {fmtDataHora(t.eta_atual)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Occurrence badges */}
                {ocAberta.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ocAberta.map(oc => (
                      <span key={oc.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 ${OCORRENCIA_LABEL[oc.tipo]?.cor ?? 'text-red-700'}`}>
                        {OCORRENCIA_LABEL[oc.tipo]?.label ?? oc.tipo}
                        <button
                          onClick={() => resolverOcorrencia.mutate({ id: oc.id, resolucao: 'Resolvido pelo operador' })}
                          className="ml-1 opacity-70 hover:opacity-100"
                          title="Resolver"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions for in-transit stops */}
                {!isDelivered && (
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => setOcorrenciaModal({ transporte_id: t.id, solicitacao_id: t.solicitacao_id })}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100
                        text-amber-700 text-[10px] font-semibold transition-colors border border-amber-200"
                    >
                      <AlertTriangle size={10} /> Ocorrencia
                    </button>
                    <button
                      onClick={() => setEntregaModal({
                        transporte_id: t.id,
                        solicitacao_id: t.solicitacao_id,
                        numero: s?.numero ?? '',
                        viagem_id: t.viagem_id,
                      })}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700
                        text-white text-[10px] font-semibold transition-colors"
                    >
                      <CheckCircle2 size={10} /> Confirmar Entrega
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-lg px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
      <p className={`text-[9px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}
