import { useState } from 'react'
import { Plus, Radio, AlertTriangle, CheckCircle, MessageSquare, XCircle, X } from 'lucide-react'
import { useOcorrenciasTel, useAtualizarOcorrencia, useRegistrarOcorrencia, useVeiculos } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroOcorrenciaTel, StatusOcorrenciaTel, TipoOcorrenciaTel } from '../../../types/frotas'

// ── Maps ──────────────────────────────────────────────────────────────────────
const TIPO_CFG: Record<TipoOcorrenciaTel, { label: string; cls: string }> = {
  excesso_velocidade:      { label: 'Excesso de velocidade',   cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
  frenagem_brusca:         { label: 'Frenagem brusca',         cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  aceleracao_brusca:       { label: 'Aceleração brusca',       cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  fora_horario:            { label: 'Fora do horário',         cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  fora_area:               { label: 'Fora da área',            cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  parada_nao_autorizada:   { label: 'Parada não autorizada',   cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  outro:                   { label: 'Outro',                   cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
}

const STATUS_FLOW: Record<StatusOcorrenciaTel, { next: StatusOcorrenciaTel; label: string; cls: string; icon: React.ElementType }> = {
  registrada:     { next: 'analisada',     label: 'Marcar como Analisada', cls: 'bg-sky-600/80 hover:bg-sky-600 text-white',     icon: CheckCircle },
  analisada:      { next: 'comunicado_rh', label: 'Comunicar ao RH',       cls: 'bg-violet-600/80 hover:bg-violet-600 text-white', icon: MessageSquare },
  comunicado_rh:  { next: 'encerrada',     label: 'Encerrar Ocorrência',   cls: 'bg-emerald-600/80 hover:bg-emerald-600 text-white', icon: CheckCircle },
  encerrada:      { next: 'encerrada',     label: 'Encerrada',             cls: 'bg-slate-600 text-slate-400 cursor-default',       icon: CheckCircle },
}

const STATUS_BADGE: Record<StatusOcorrenciaTel, string> = {
  registrada:    'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  analisada:     'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  comunicado_rh: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  encerrada:     'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function OcorrenciaModal({ oc, onClose, isLight }: { oc: FroOcorrenciaTel; onClose: () => void; isLight: boolean }) {
  const [observacoes, setObs] = useState(oc.observacoes ?? '')
  const atualizar = useAtualizarOcorrencia()
  const flow = STATUS_FLOW[oc.status]

  async function handleAdvance() {
    if (oc.status === 'encerrada') return
    await atualizar.mutateAsync({ id: oc.id, status: flow.next, observacoes })
    onClose()
  }

  const valCls = isLight ? 'text-slate-800' : 'text-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 ${isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
        <div className="flex items-start justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Ocorrência de Telemetria</h2>
          <button onClick={onClose} className={`${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}`}><XCircle size={18} /></button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Veículo</span>
            <span className={`${valCls} font-semibold`}>{oc.veiculo?.placa} — {oc.veiculo?.marca} {oc.veiculo?.modelo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tipo</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${TIPO_CFG[oc.tipo_ocorrencia].cls}`}>
              {TIPO_CFG[oc.tipo_ocorrencia].label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Data</span>
            <span className={valCls}>{new Date(oc.data_ocorrencia).toLocaleString('pt-BR')}</span>
          </div>
          {oc.velocidade && (
            <div className="flex justify-between">
              <span className="text-slate-400">Velocidade</span>
              <span className="text-red-600 dark:text-red-300 font-bold">{oc.velocidade} km/h</span>
            </div>
          )}
          {oc.endereco && (
            <div className="flex justify-between">
              <span className="text-slate-400">Local</span>
              <span className={`${valCls} text-right text-xs max-w-[60%]`}>{oc.endereco}</span>
            </div>
          )}
          {oc.analisado_em && (
            <div className="flex justify-between">
              <span className="text-slate-400">Analisado em</span>
              <span className={valCls}>{new Date(oc.analisado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
          {oc.rh_comunicado_em && (
            <div className="flex justify-between">
              <span className="text-slate-400">RH comunicado em</span>
              <span className={valCls}>{new Date(oc.rh_comunicado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        <div>
          <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Observações / Tratativa</label>
          <textarea
            className={`w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 resize-none mt-1 ${
              isLight ? 'bg-white border border-slate-200 shadow-sm text-slate-800' : 'bg-white/6 border border-white/12 text-white'
            }`}
            rows={3}
            value={observacoes}
            onChange={e => setObs(e.target.value)}
            disabled={oc.status === 'encerrada'}
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
            isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}>Fechar</button>
          {oc.status !== 'encerrada' && (
            <button
              onClick={handleAdvance}
              disabled={atualizar.isPending}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${flow.cls}`}
            >
              <flow.icon size={14} />
              {atualizar.isPending ? 'Salvando...' : flow.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ocorrência Row ────────────────────────────────────────────────────────────
function OcorrenciaRow({ oc, onSelect, isLight }: { oc: FroOcorrenciaTel; onSelect: () => void; isLight: boolean }) {
  const tipoCfg = TIPO_CFG[oc.tipo_ocorrencia]
  const badgeCls = STATUS_BADGE[oc.status]
  const statusLabel = { registrada: 'Registrada', analisada: 'Analisada', comunicado_rh: 'Comunicado RH', encerrada: 'Encerrada' }[oc.status]

  return (
    <button onClick={onSelect} className={`w-full rounded-xl shadow-sm px-4 py-3 flex items-center gap-4 text-left transition-colors ${
      isLight ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'bg-[#1e293b] border border-white/[0.06] hover:bg-white/5'
    }`}>
      <AlertTriangle size={15} className={oc.status === 'registrada' ? 'text-red-400' : oc.status === 'encerrada' ? 'text-slate-600' : 'text-amber-400'} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{oc.veiculo?.placa} — {oc.veiculo?.marca} {oc.veiculo?.modelo}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${tipoCfg.cls}`}>{tipoCfg.label}</span>
      </div>
      {oc.velocidade && (
        <span className="hidden sm:block text-xs text-red-600 dark:text-red-300 font-bold shrink-0">{oc.velocidade} km/h</span>
      )}
      <div className="text-right shrink-0">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badgeCls}`}>{statusLabel}</span>
        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(oc.data_ocorrencia).toLocaleDateString('pt-BR')}</p>
      </div>
    </button>
  )
}

// ── Nova Ocorrência Modal ─────────────────────────────────────────────────────
function NovaOcorrenciaModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
  const registrar = useRegistrarOcorrencia()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id: '', tipo_ocorrencia: 'excesso_velocidade' as TipoOcorrenciaTel,
    velocidade: '', endereco: '', data_ocorrencia: new Date().toISOString().slice(0, 16),
    observacoes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await registrar.mutateAsync({
      veiculo_id: form.veiculo_id,
      tipo_ocorrencia: form.tipo_ocorrencia,
      velocidade: form.velocidade ? +form.velocidade : undefined,
      endereco: form.endereco || undefined,
      data_ocorrencia: form.data_ocorrencia ? new Date(form.data_ocorrencia).toISOString() : new Date().toISOString(),
      status: 'registrada',
      observacoes: form.observacoes || undefined,
    })
    onClose()
  }

  const lbl = 'block text-xs font-bold mb-1 ' + (isLight ? 'text-slate-600' : 'text-slate-300')
  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 shadow-sm text-slate-800' : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 ${isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Registrar Ocorrência</h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Veículo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo *</label>
            <select className={sel} value={form.tipo_ocorrencia} onChange={e => setForm(f => ({ ...f, tipo_ocorrencia: e.target.value as TipoOcorrenciaTel }))}>
              {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data/hora *</label>
            <input type="datetime-local" className={inp} value={form.data_ocorrencia} onChange={e => setForm(f => ({ ...f, data_ocorrencia: e.target.value }))} required />
          </div>
          <div>
            <label className={lbl}>Velocidade (km/h)</label>
            <input type="number" className={inp} value={form.velocidade} onChange={e => setForm(f => ({ ...f, velocidade: e.target.value }))} placeholder="Ex: 120" />
          </div>
        </div>

        <div>
          <label className={lbl}>Endereço / Local</label>
          <input className={inp} value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rodovia BR-040, km 512" />
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Detalhes adicionais..." />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
            isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}>Cancelar</button>
          <button type="submit" disabled={registrar.isPending} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold disabled:opacity-50">
            {registrar.isPending ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS: Array<{ key: StatusOcorrenciaTel; label: string }> = [
  { key: 'registrada',    label: 'Pendentes' },
  { key: 'analisada',     label: 'Analisadas' },
  { key: 'comunicado_rh', label: 'Comunicadas RH' },
  { key: 'encerrada',     label: 'Encerradas' },
]

export default function TelemetriaOp() {
  const { isLightSidebar: isLight } = useTheme()
  const [tabIdx, setTabIdx]     = useState(0)
  const [selected, setSelected] = useState<FroOcorrenciaTel | null>(null)
  const [novaModal, setNovaModal] = useState(false)

  const tabKey = TABS[tabIdx].key
  const { data: ocorrencias = [], isLoading } = useOcorrenciasTel({ status: tabKey })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Radio size={20} className="text-teal-500" /> Telemetria e Compliance
          </h1>
          <p className="text-sm text-slate-500">Ocorrências registradas pelo sistema de rastreamento</p>
        </div>
        <button onClick={() => setNovaModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold w-full sm:w-auto">
          <Plus size={15} /> Registrar Ocorrência
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl w-fit flex-wrap ${
        isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/4 border border-white/8'
      }`}>
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTabIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabIdx === i
                ? 'bg-teal-600 text-white'
                : isLight
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-slate-400 hover:text-white'
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
            <span className={`px-1.5 py-0.5 rounded ${i === tabIdx ? 'text-teal-700 dark:text-teal-300 bg-teal-500/15' : ''}`}>{s}</span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`rounded-xl h-16 animate-pulse ${isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'}`} />)}</div>
      ) : ocorrencias.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2 opacity-60" />
          <p className="text-sm text-slate-500">Nenhuma ocorrência nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ocorrencias.map(oc => (
            <OcorrenciaRow key={oc.id} oc={oc} onSelect={() => setSelected(oc)} isLight={isLight} />
          ))}
        </div>
      )}

      {selected && <OcorrenciaModal oc={selected} onClose={() => setSelected(null)} isLight={isLight} />}
      {novaModal && <NovaOcorrenciaModal onClose={() => setNovaModal(false)} isLight={isLight} />}
    </div>
  )
}
