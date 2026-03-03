import { useState } from 'react'
import { Radio, AlertTriangle, CheckCircle, MessageSquare, XCircle } from 'lucide-react'
import { useOcorrenciasTel, useAtualizarOcorrencia } from '../../hooks/useFrotas'
import type { FroOcorrenciaTel, StatusOcorrenciaTel, TipoOcorrenciaTel } from '../../types/frotas'

// ── Maps ──────────────────────────────────────────────────────────────────────
const TIPO_CFG: Record<TipoOcorrenciaTel, { label: string; cls: string }> = {
  excesso_velocidade:  { label: 'Excesso de velocidade', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  frenagem_brusca:     { label: 'Frenagem brusca',       cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  aceleracao_brusca:   { label: 'Aceleração brusca',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  fora_horario:        { label: 'Fora do horário',       cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  fora_area:           { label: 'Fora da área',          cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  parada_nao_autorizada: { label: 'Parada não autorizada', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  outro:               { label: 'Outro',                 cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const STATUS_FLOW: Record<StatusOcorrenciaTel, { next: StatusOcorrenciaTel; label: string; cls: string; icon: React.ElementType }> = {
  registrada:     { next: 'analisada',    label: 'Marcar como Analisada', cls: 'bg-sky-600/80 hover:bg-sky-600 text-white',    icon: CheckCircle },
  analisada:      { next: 'comunicado_rh', label: 'Comunicar ao RH',     cls: 'bg-violet-600/80 hover:bg-violet-600 text-white', icon: MessageSquare },
  comunicado_rh:  { next: 'encerrada',   label: 'Encerrar Ocorrência',  cls: 'bg-emerald-600/80 hover:bg-emerald-600 text-white', icon: CheckCircle },
  encerrada:      { next: 'encerrada',   label: 'Encerrada',            cls: 'bg-slate-600 text-slate-400 cursor-default', icon: CheckCircle },
}

const STATUS_BADGE: Record<StatusOcorrenciaTel, string> = {
  registrada:    'bg-red-500/15 text-red-300 border-red-500/30',
  analisada:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
  comunicado_rh: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  encerrada:     'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function OcorrenciaModal({ oc, onClose }: { oc: FroOcorrenciaTel; onClose: () => void }) {
  const [observacoes, setObs] = useState(oc.observacoes ?? '')
  const atualizar = useAtualizarOcorrencia()
  const flow = STATUS_FLOW[oc.status]

  async function handleAdvance() {
    if (oc.status === 'encerrada') return
    await atualizar.mutateAsync({ id: oc.id, status: flow.next, observacoes })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-bold text-white">Ocorrência de Telemetria</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><XCircle size={18} /></button>
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Veículo</span>
            <span className="text-white font-semibold">{oc.veiculo?.placa} — {oc.veiculo?.marca} {oc.veiculo?.modelo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tipo</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${TIPO_CFG[oc.tipo_ocorrencia].cls}`}>
              {TIPO_CFG[oc.tipo_ocorrencia].label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Data</span>
            <span className="text-white">{new Date(oc.data_ocorrencia).toLocaleString('pt-BR')}</span>
          </div>
          {oc.velocidade && (
            <div className="flex justify-between">
              <span className="text-slate-400">Velocidade</span>
              <span className="text-red-300 font-bold">{oc.velocidade} km/h</span>
            </div>
          )}
          {oc.endereco && (
            <div className="flex justify-between">
              <span className="text-slate-400">Local</span>
              <span className="text-white text-right text-xs max-w-[60%]">{oc.endereco}</span>
            </div>
          )}
          {oc.analisado_em && (
            <div className="flex justify-between">
              <span className="text-slate-400">Analisado em</span>
              <span className="text-white">{new Date(oc.analisado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          {oc.rh_comunicado_em && (
            <div className="flex justify-between">
              <span className="text-slate-400">RH comunicado em</span>
              <span className="text-white">{new Date(oc.rh_comunicado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        {/* Observações */}
        <div>
          <label className="text-[11px] text-slate-400">Observações / Tratativa</label>
          <textarea
            className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none mt-1"
            rows={3}
            value={observacoes}
            onChange={e => setObs(e.target.value)}
            disabled={oc.status === 'encerrada'}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400">Fechar</button>
          {oc.status !== 'encerrada' && (
            <button
              onClick={handleAdvance}
              disabled={atualizar.isPending}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${flow.cls}`}
            >
              <flow.icon size={14} />
              {atualizar.isPending ? 'Salvando…' : flow.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ocorrência Row ────────────────────────────────────────────────────────────
function OcorrenciaRow({ oc, onSelect }: { oc: FroOcorrenciaTel; onSelect: () => void }) {
  const tipoCfg = TIPO_CFG[oc.tipo_ocorrencia]
  const badgeCls = STATUS_BADGE[oc.status]
  const statusLabel = { registrada: 'Registrada', analisada: 'Analisada', comunicado_rh: 'Comunicado RH', encerrada: 'Encerrada' }[oc.status]

  return (
    <button onClick={onSelect} className="glass-card w-full rounded-xl px-4 py-3 flex items-center gap-4 text-left hover:bg-white/5 transition-colors">
      <AlertTriangle size={15} className={oc.status === 'registrada' ? 'text-red-400' : oc.status === 'encerrada' ? 'text-slate-600' : 'text-amber-400'} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{oc.veiculo?.placa} — {oc.veiculo?.marca} {oc.veiculo?.modelo}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tipoCfg.cls}`}>{tipoCfg.label}</span>
      </div>
      {oc.velocidade && (
        <span className="hidden sm:block text-xs text-red-300 font-bold shrink-0">{oc.velocidade} km/h</span>
      )}
      <div className="text-right shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badgeCls}`}>{statusLabel}</span>
        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(oc.data_ocorrencia).toLocaleDateString('pt-BR')}</p>
      </div>
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS: Array<{ key: StatusOcorrenciaTel | 'todas'; label: string }> = [
  { key: 'registrada',    label: 'Pendentes' },
  { key: 'analisada',     label: 'Analisadas' },
  { key: 'comunicado_rh', label: 'Comunicadas RH' },
  { key: 'encerrada',     label: 'Encerradas' },
]

export default function Telemetria() {
  const [tabIdx, setTabIdx]   = useState(0)
  const [selected, setSelected] = useState<FroOcorrenciaTel | null>(null)

  const tabKey = TABS[tabIdx].key as StatusOcorrenciaTel
  const { data: ocorrencias = [], isLoading } = useOcorrenciasTel({ status: tabKey })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio size={20} className="text-rose-400" /> Telemetria e Compliance
        </h1>
        <p className="text-sm text-slate-500">Ocorrências registradas pelo sistema de rastreamento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit flex-wrap">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTabIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabIdx === i ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Flow info */}
      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span>Fluxo:</span>
        {['Registrada', 'Analisada', 'Comunicado RH', 'Encerrada'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded ${i === tabIdx ? 'text-rose-300 bg-rose-500/15' : ''}`}>{s}</span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />)}</div>
      ) : ocorrencias.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm text-slate-500">Nenhuma ocorrência nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ocorrencias.map(oc => (
            <OcorrenciaRow key={oc.id} oc={oc} onSelect={() => setSelected(oc)} />
          ))}
        </div>
      )}

      {selected && <OcorrenciaModal oc={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
