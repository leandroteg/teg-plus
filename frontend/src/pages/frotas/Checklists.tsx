import { useState } from 'react'
import { Plus, ClipboardCheck, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'
import { UpperTextarea } from '../../components/UpperInput'
import { useChecklists, useCriarChecklist, useVeiculos } from '../../hooks/useFrotas'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { FroChecklist, TipoChecklist } from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<TipoChecklist, string> = {
  pre_viagem: 'Pre-viagem', pos_viagem: 'Pos-viagem', pos_manutencao: 'Pos-manutencao',
}

const ITENS_CHECKLIST = [
  { key: 'nivel_oleo_ok'       as keyof FroChecklist, label: 'Nivel de oleo, agua e fluido de freio' },
  { key: 'calibragem_pneus_ok' as keyof FroChecklist, label: 'Calibragem dos pneus' },
  { key: 'lanternas_ok'        as keyof FroChecklist, label: 'Funcionamento de lanternas e farois' },
  { key: 'freios_ok'           as keyof FroChecklist, label: 'Freios e buzina' },
  { key: 'documentacao_ok'     as keyof FroChecklist, label: 'Documentacao do veiculo (CRLV, seguro)' },
  { key: 'nivel_agua_ok'       as keyof FroChecklist, label: 'Nivel de agua do radiador' },
  { key: 'limpeza_ok'          as keyof FroChecklist, label: 'Limpeza e conservacao interna/externa' },
]

// ── Nova Checklist Modal ──────────────────────────────────────────────────────
function NovaChecklistModal({ onClose, isLight }: { onClose: () => void; isLight: boolean }) {
  const criar = useCriarChecklist()
  const { data: veiculos = [] } = useVeiculos()
  const { user } = useAuth()
  const [erro, setErro] = useState('')

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
    setErro('')
    try {
      await criar.mutateAsync({
        veiculo_id: form.veiculo_id,
        motorista_id: user?.id,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar checklist'
      setErro(msg.includes('row-level security') ? 'Voce nao tem permissao para registrar checklists. Contate o administrador.' : msg)
    }
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300' : 'bg-white/6 border border-white/12 text-white hover:border-white/20'
  }`
  const lbl = 'block text-xs font-bold mb-1 ' + (isLight ? 'text-slate-600' : 'text-slate-300')
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto styled-scrollbar ${isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Novo Checklist</h2>
          <button type="button" onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Veiculo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione...</option>
              {veiculos.filter(v => v.status !== 'baixado').map(v => (
                <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select className={sel} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoChecklist }))}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={lbl}>Hodometro atual (km)</label>
          <input type="number" className={inp} value={form.hodometro} onChange={e => setForm(f => ({ ...f, hodometro: e.target.value }))} placeholder="Ex: 55432" />
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <label className={lbl + ' uppercase tracking-wider'}>Itens de Verificacao</label>
          {ITENS_CHECKLIST.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleItem(item.key as keyof typeof form)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all border ${
                form[item.key as keyof typeof form]
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    : 'bg-white/4 border-white/8 text-slate-400 hover:border-white/15'
              }`}
            >
              {form[item.key as keyof typeof form]
                ? <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                : <div className={`w-[15px] h-[15px] rounded-full border shrink-0 ${isLight ? 'border-slate-300' : 'border-slate-600'}`} />
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
          {allOk ? 'Veiculo liberado para uso' : `${ITENS_CHECKLIST.filter(i => !form[i.key as keyof typeof form]).length} item(s) pendente(s) — veiculo NAO liberado`}
        </div>

        <div>
          <label className={lbl}>Observacoes</label>
          <UpperTextarea className={inp + ' resize-none'} rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Anomalias, observacoes adicionais..." />
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/30">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400 font-medium">{erro}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium ${
            isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}>Cancelar</button>
          <button type="submit" disabled={criar.isPending || !form.veiculo_id} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold disabled:opacity-50">
            {criar.isPending ? 'Registrando...' : 'Registrar Checklist'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Checklist Row ─────────────────────────────────────────────────────────────
function ChecklistRow({ ck, isLight }: { ck: FroChecklist; isLight: boolean }) {
  const okCount = ITENS_CHECKLIST.filter(i => ck[i.key as keyof FroChecklist] === true).length
  const total   = ITENS_CHECKLIST.length

  return (
    <div className={`rounded-xl shadow-sm px-4 py-3 flex items-center gap-4 ${isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ck.liberado ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
        {ck.liberado
          ? <CheckCircle size={16} className="text-emerald-400" />
          : <XCircle size={16} className="text-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{ck.veiculo?.placa} — {ck.veiculo?.marca} {ck.veiculo?.modelo}</p>
        <p className="text-[11px] text-slate-500">{TIPO_LABEL[ck.tipo]} · {okCount}/{total} itens OK</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400">{new Date(ck.data_checklist).toLocaleDateString('pt-BR')}</p>
        <p className={`text-[10px] font-bold ${ck.liberado ? 'text-emerald-400' : 'text-red-400'}`}>
          {ck.liberado ? 'Liberado' : 'Nao liberado'}
        </p>
      </div>
      {ck.observacoes && (
        <div className="hidden sm:block max-w-xs text-[11px] text-amber-400 truncate" title={ck.observacoes}>
          {ck.observacoes}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Checklists() {
  const { isDark } = useTheme()
  const isLight = !isDark
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
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <ClipboardCheck size={20} className="text-teal-500" /> Checklists
          </h1>
          <p className="text-sm text-slate-500">
            {liberados} liberados · <span className="text-red-400">{naoLiberados} nao liberados</span>
          </p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold">
          <Plus size={15} /> Novo Checklist
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Data</label>
          <input
            type="date"
            value={dataFiltro}
            onChange={e => setDataFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white'
            }`}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Tipo</label>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as TipoChecklist | '')}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white [&>option]:bg-slate-900'
            }`}
          >
            <option value="">Todos</option>
            {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`rounded-xl h-16 animate-pulse ${isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'}`} />)}</div>
      ) : checklists.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum checklist encontrado para esta data</p>
      ) : (
        <div className="space-y-2">
          {checklists.map(ck => <ChecklistRow key={ck.id} ck={ck} isLight={isLight} />)}
        </div>
      )}

      {modal && <NovaChecklistModal onClose={() => setModal(false)} isLight={isLight} />}
    </div>
  )
}
