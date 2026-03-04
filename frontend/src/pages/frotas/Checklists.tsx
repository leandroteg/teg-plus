import { useState } from 'react'
import { Plus, ClipboardCheck, CheckCircle, XCircle } from 'lucide-react'
import { useChecklists, useCriarChecklist, useVeiculos } from '../../hooks/useFrotas'
import type { FroChecklist, TipoChecklist } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<TipoChecklist, string> = {
  pre_viagem: 'Pré-viagem', pos_viagem: 'Pós-viagem', pos_manutencao: 'Pós-manutenção',
}

const ITENS_CHECKLIST = [
  { key: 'nivel_oleo_ok'       as keyof FroChecklist, label: 'Nível de óleo, água e fluido de freio' },
  { key: 'calibragem_pneus_ok' as keyof FroChecklist, label: 'Calibragem dos pneus' },
  { key: 'lanternas_ok'        as keyof FroChecklist, label: 'Funcionamento de lanternas e faróis' },
  { key: 'freios_ok'           as keyof FroChecklist, label: 'Freios e buzina' },
  { key: 'documentacao_ok'     as keyof FroChecklist, label: 'Documentação do veículo (CRLV, seguro)' },
  { key: 'nivel_agua_ok'       as keyof FroChecklist, label: 'Nível de água do radiador' },
  { key: 'limpeza_ok'          as keyof FroChecklist, label: 'Limpeza e conservação interna/externa' },
]

// ── Nova Checklist Modal ──────────────────────────────────────────────────────
function NovaChecklistModal({ onClose }: { onClose: () => void }) {
  const criar = useCriarChecklist()
  const { data: veiculos = [] } = useVeiculos()

  const [form, setForm] = useState({
    veiculo_id: '', tipo: 'pre_viagem' as TipoChecklist, hodometro: '',
    nivel_oleo_ok: false, nivel_agua_ok: false, calibragem_pneus_ok: false,
    lanternas_ok: false, freios_ok: false, documentacao_ok: false, limpeza_ok: false,
    observacoes: '',
  })

  const toggleItem = (k: keyof typeof form) =>
    setForm(f => ({ ...f, [k]: !f[k as keyof typeof f] }))

  const allOk = form.nivel_oleo_ok && form.nivel_agua_ok && form.calibragem_pneus_ok &&
    form.lanternas_ok && form.freios_ok && form.documentacao_ok && form.limpeza_ok

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id,
      tipo: form.tipo,
      hodometro: form.hodometro ? +form.hodometro : undefined,
      nivel_oleo_ok: form.nivel_oleo_ok,
      nivel_agua_ok: form.nivel_agua_ok,
      calibragem_pneus_ok: form.calibragem_pneus_ok,
      lanternas_ok: form.lanternas_ok,
      freios_ok: form.freios_ok,
      documentacao_ok: form.documentacao_ok,
      limpeza_ok: form.limpeza_ok,
      observacoes: form.observacoes || undefined,
    })
    onClose()
  }

  const inp = 'w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30'
  const sel = inp + ' [&>option]:bg-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto styled-scrollbar">
        <h2 className="text-base font-bold text-white">Novo Checklist</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Veículo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione…</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Tipo</label>
            <select className={sel} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoChecklist }))}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Hodômetro atual (km)</label>
          <input type="number" className={inp} value={form.hodometro} onChange={e => setForm(f => ({ ...f, hodometro: e.target.value }))} placeholder="Ex: 55432" />
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <label className="text-[11px] text-slate-400 uppercase tracking-wider">Itens de Verificação</label>
          {ITENS_CHECKLIST.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleItem(item.key as keyof typeof form)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all border ${
                form[item.key as keyof typeof form]
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/4 border-white/8 text-slate-400 hover:border-white/15'
              }`}
            >
              {form[item.key as keyof typeof form]
                ? <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                : <div className="w-[15px] h-[15px] rounded-full border border-slate-600 shrink-0" />
              }
              {item.label}
            </button>
          ))}
        </div>

        {/* Status total */}
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold ${
          allOk ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {allOk ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {allOk ? 'Veículo liberado para uso' : `${ITENS_CHECKLIST.filter(i => !form[i.key as keyof typeof form]).length} item(s) pendente(s) — veículo NÃO liberado`}
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Observações</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Anomalias, observações adicionais…" />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/5">Cancelar</button>
          <button type="submit" disabled={criar.isPending || !form.veiculo_id} className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold disabled:opacity-50">
            {criar.isPending ? 'Registrando…' : 'Registrar Checklist'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Checklist Row ─────────────────────────────────────────────────────────────
function ChecklistRow({ ck }: { ck: FroChecklist }) {
  const okCount = ITENS_CHECKLIST.filter(i => ck[i.key as keyof FroChecklist] === true).length
  const total   = ITENS_CHECKLIST.length

  return (
    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ck.liberado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
        {ck.liberado
          ? <CheckCircle size={16} className="text-emerald-400" />
          : <XCircle size={16} className="text-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{ck.veiculo?.placa} — {ck.veiculo?.marca} {ck.veiculo?.modelo}</p>
        <p className="text-[11px] text-slate-500">{TIPO_LABEL[ck.tipo]} · {okCount}/{total} itens OK</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400">{new Date(ck.data_checklist).toLocaleDateString('pt-BR')}</p>
        <p className={`text-[10px] font-bold ${ck.liberado ? 'text-emerald-400' : 'text-red-400'}`}>
          {ck.liberado ? 'Liberado' : 'Não liberado'}
        </p>
      </div>
      {ck.observacoes && (
        <div className="hidden sm:block max-w-xs text-[11px] text-amber-400 truncate" title={ck.observacoes}>
          ⚠ {ck.observacoes}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Checklists() {
  const [modal, setModal]   = useState(false)
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])
  const [tipoFiltro, setTipoFiltro] = useState<TipoChecklist | ''>('')

  const { data: checklists = [], isLoading } = useChecklists({
    data: dataFiltro || undefined,
    tipo: tipoFiltro || undefined,
  })

  const liberados    = checklists.filter(c => c.liberado).length
  const naoLiberados = checklists.filter(c => !c.liberado).length

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck size={20} className="text-rose-400" /> Checklists
          </h1>
          <p className="text-sm text-slate-500">
            {liberados} liberados · <span className="text-red-400">{naoLiberados} não liberados</span>
          </p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold">
          <Plus size={15} /> Novo Checklist
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Data</label>
          <input
            type="date"
            value={dataFiltro}
            onChange={e => setDataFiltro(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Tipo</label>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as TipoChecklist | '')}
            className="px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 [&>option]:bg-slate-900"
          >
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />)}</div>
      ) : checklists.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum checklist encontrado para esta data</p>
      ) : (
        <div className="space-y-2">
          {checklists.map(ck => <ChecklistRow key={ck.id} ck={ck} />)}
        </div>
      )}

      {modal && <NovaChecklistModal onClose={() => setModal(false)} />}
    </div>
  )
}
