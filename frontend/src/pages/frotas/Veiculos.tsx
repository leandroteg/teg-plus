import { useState } from 'react'
import { Plus, Search, AlertTriangle, Car, Edit2 } from 'lucide-react'
import { useVeiculos, useSalvarVeiculo } from '../../hooks/useFrotas'
import { useTheme } from '../../contexts/ThemeContext'
import type { FroVeiculo, StatusVeiculo, CategoriaVeiculo, CombustivelVeiculo, PropriedadeVeiculo } from '../../types/frotas'

// ── Maps ──────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<StatusVeiculo, { label: string; cls: string }> = {
  disponivel:    { label: 'Disponivel',   cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  em_uso:        { label: 'Em Uso',       cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  em_manutencao: { label: 'Manutencao',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  bloqueado:     { label: 'Bloqueado',    cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  baixado:       { label: 'Baixado',      cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
}

const CATEGORIA_LABEL: Record<CategoriaVeiculo, string> = {
  passeio: 'Passeio', pickup: 'Pickup', van: 'Van', vuc: 'VUC',
  truck: 'Truck', carreta: 'Carreta', moto: 'Moto', onibus: 'Onibus',
}

const COMBUSTIVEL_LABEL: Record<CombustivelVeiculo, string> = {
  flex: 'Flex', gasolina: 'Gasolina', diesel: 'Diesel',
  etanol: 'Etanol', eletrico: 'Eletrico', gnv: 'GNV',
}

// ── Doc expiry helper ──────────────────────────────────────────────────────────
function docStatus(dateStr?: string) {
  if (!dateStr) return null
  const hoje = new Date()
  const d    = new Date(dateStr)
  const diff = Math.floor((d.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0)   return { cls: 'text-red-400',   icon: true, label: 'Vencido' }
  if (diff <= 30) return { cls: 'text-amber-400',  icon: true, label: `${diff}d` }
  return null
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function VeiculoModal({
  inicial,
  onClose,
  isLight,
}: {
  inicial?: Partial<FroVeiculo>
  onClose: () => void
  isLight: boolean
}) {
  const salvar = useSalvarVeiculo()
  const [form, setForm] = useState<Partial<FroVeiculo>>({
    placa: '', marca: '', modelo: '', categoria: 'passeio',
    combustivel: 'flex', propriedade: 'propria', status: 'disponivel',
    hodometro_atual: 0,
    ...inicial,
  })

  const set = (k: keyof FroVeiculo, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await salvar.mutateAsync(form)
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isLight
      ? 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-rose-400/50'
      : 'bg-white/6 border border-white/10 text-white focus:border-rose-400/50'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="glass-card rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto styled-scrollbar"
      >
        <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{inicial?.id ? 'Editar' : 'Novo'} Veiculo</h2>

        {/* Linha 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Placa *</label>
            <input className={inp} value={form.placa} onChange={e => set('placa', e.target.value.toUpperCase())} required placeholder="ABC-1234" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Renavam</label>
            <input className={inp} value={form.renavam ?? ''} onChange={e => set('renavam', e.target.value)} placeholder="00000000000" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Status</label>
            <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Marca *</label>
            <input className={inp} value={form.marca} onChange={e => set('marca', e.target.value)} required placeholder="Toyota" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Modelo *</label>
            <input className={inp} value={form.modelo} onChange={e => set('modelo', e.target.value)} required placeholder="Hilux" />
          </div>
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Ano Fab.</label>
            <input type="number" className={inp} value={form.ano_fab ?? ''} onChange={e => set('ano_fab', +e.target.value)} placeholder="2022" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Ano Mod.</label>
            <input type="number" className={inp} value={form.ano_mod ?? ''} onChange={e => set('ano_mod', +e.target.value)} placeholder="2023" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Cor</label>
            <input className={inp} value={form.cor ?? ''} onChange={e => set('cor', e.target.value)} placeholder="Branca" />
          </div>
        </div>

        {/* Linha 4 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Categoria</label>
            <select className={sel} value={form.categoria} onChange={e => set('categoria', e.target.value as CategoriaVeiculo)}>
              {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Combustivel</label>
            <select className={sel} value={form.combustivel} onChange={e => set('combustivel', e.target.value as CombustivelVeiculo)}>
              {Object.entries(COMBUSTIVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Propriedade</label>
            <select className={sel} value={form.propriedade} onChange={e => set('propriedade', e.target.value as PropriedadeVeiculo)}>
              <option value="propria">Propria</option>
              <option value="locada">Locada</option>
              <option value="cedida">Cedida</option>
            </select>
          </div>
        </div>

        {/* Hodometro */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Hodometro atual (km)</label>
            <input type="number" className={inp} value={form.hodometro_atual} onChange={e => set('hodometro_atual', +e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Proxima prev. (km)</label>
            <input type="number" className={inp} value={form.km_proxima_preventiva ?? ''} onChange={e => set('km_proxima_preventiva', +e.target.value)} placeholder="55000" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Proxima prev. (data)</label>
            <input type="date" className={inp} value={form.data_proxima_preventiva ?? ''} onChange={e => set('data_proxima_preventiva', e.target.value)} />
          </div>
        </div>

        {/* Documentos */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Venc. CRLV</label>
            <input type="date" className={inp} value={form.vencimento_crlv ?? ''} onChange={e => set('vencimento_crlv', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Venc. Seguro</label>
            <input type="date" className={inp} value={form.vencimento_seguro ?? ''} onChange={e => set('vencimento_seguro', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Venc. Tacografo</label>
            <input type="date" className={inp} value={form.vencimento_tacografo ?? ''} onChange={e => set('vencimento_tacografo', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Observacoes</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl border text-sm ${
            isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}>
            Cancelar
          </button>
          <button type="submit" disabled={salvar.isPending} className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Veiculos() {
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca]     = useState('')
  const [modal, setModal]     = useState<Partial<FroVeiculo> | null>(null)
  const [statusFiltro, setStatusFiltro] = useState<StatusVeiculo | ''>('')
  const [catFiltro, setCatFiltro] = useState<CategoriaVeiculo | ''>('')
  const { data: veiculos = [], isLoading } = useVeiculos({
    status: statusFiltro || undefined,
    categoria: catFiltro || undefined,
  })

  const filtrados = veiculos.filter(v => {
    const q = busca.toLowerCase()
    return (
      v.placa.toLowerCase().includes(q) ||
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Car size={20} className="text-rose-400" /> Veiculos
          </h1>
          <p className="text-sm text-slate-500">{veiculos.length} veiculo{veiculos.length !== 1 ? 's' : ''} cadastrado{veiculos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold transition-colors"
        >
          <Plus size={15} /> Novo Veiculo
        </button>
      </div>

      {/* Busca + Filtros */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              isLight
                ? 'bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400'
                : 'bg-white/6 border border-white/10 text-white placeholder:text-slate-600'
            }`}
            placeholder="Buscar placa, marca, modelo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Status</label>
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value as StatusVeiculo | '')}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              isLight ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white [&>option]:bg-slate-900'
            }`}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Categoria</label>
          <select
            value={catFiltro}
            onChange={e => setCatFiltro(e.target.value as CategoriaVeiculo | '')}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              isLight ? 'bg-slate-50 border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/10 text-white [&>option]:bg-slate-900'
            }`}
          >
            <option value="">Todas</option>
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum veiculo encontrado</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(v => {
            const st    = STATUS_CFG[v.status]
            const crlv  = docStatus(v.vencimento_crlv)
            const seg   = docStatus(v.vencimento_seguro)
            const prev  = v.data_proxima_preventiva ? docStatus(v.data_proxima_preventiva) : null
            const warnPrev = v.km_proxima_preventiva && v.km_proxima_preventiva <= v.hodometro_atual + 500

            return (
              <div key={v.id} className="glass-card rounded-xl px-4 py-3 flex items-center gap-4">

                {/* Placa */}
                <div className="w-24 shrink-0">
                  <p className={`text-sm font-black tracking-widest ${isLight ? 'text-slate-800' : 'text-white'}`}>{v.placa}</p>
                  <p className="text-[10px] text-slate-500">{CATEGORIA_LABEL[v.categoria]}</p>
                </div>

                {/* Modelo */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{v.marca} {v.modelo}</p>
                  <p className="text-[11px] text-slate-500">{v.ano_fab}/{v.ano_mod} · {COMBUSTIVEL_LABEL[v.combustivel]}</p>
                </div>

                {/* Hodometro */}
                <div className="hidden sm:block w-24 text-right">
                  <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{v.hodometro_atual.toLocaleString('pt-BR')} km</p>
                  {warnPrev && <p className="text-[10px] text-amber-400">prev. proxima</p>}
                </div>

                {/* Alertas de documentos */}
                <div className="hidden md:flex items-center gap-1.5">
                  {crlv && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${crlv.cls}`}>
                      <AlertTriangle size={10} /> CRLV {crlv.label}
                    </span>
                  )}
                  {seg && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${seg.cls}`}>
                      <AlertTriangle size={10} /> Seg. {seg.label}
                    </span>
                  )}
                  {prev && (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${prev.cls}`}>
                      <AlertTriangle size={10} /> Prev. {prev.label}
                    </span>
                  )}
                </div>

                {/* Status */}
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${st.cls}`}>{st.label}</span>

                {/* Edit */}
                <button
                  onClick={() => setModal(v)}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <VeiculoModal inicial={modal} onClose={() => setModal(null)} isLight={isLight} />
      )}
    </div>
  )
}
