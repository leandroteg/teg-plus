import { useState, useCallback, useRef } from 'react'
import { Plus, Search, AlertTriangle, Car, Edit2, Loader2, Sparkles, X } from 'lucide-react'
import { useVeiculos, useSalvarVeiculo } from '../../hooks/useFrotas'
import { useTheme } from '../../contexts/ThemeContext'
import { api } from '../../services/api'
import type { FroVeiculo, StatusVeiculo, CategoriaVeiculo, CombustivelVeiculo, PropriedadeVeiculo } from '../../types/frotas'

// ── Maps ──────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<StatusVeiculo, { label: string; cls: string }> = {
  disponivel:      { label: 'Disponivel',     cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  em_uso:          { label: 'Em Uso',         cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  em_manutencao:   { label: 'Manutencao',     cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  bloqueado:       { label: 'Bloqueado',      cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
  baixado:         { label: 'Baixado',        cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-500 border-slate-500/20' },
  em_entrada:      { label: 'Em Entrada',     cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  aguardando_saida:{ label: 'Ag. Saida',      cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30' },
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
  if (diff < 0)   return { cls: 'text-red-600 dark:text-red-400',   icon: true, label: 'Vencido' }
  if (diff <= 30) return { cls: 'text-amber-600 dark:text-amber-400',  icon: true, label: `${diff}d` }
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
  const [placaLoading, setPlacaLoading] = useState(false)
  const [placaMsg, setPlacaMsg] = useState('')
  const placaTimer = useRef<ReturnType<typeof setTimeout>>()

  const set = (k: keyof FroVeiculo, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handlePlacaChange = useCallback((raw: string) => {
    const val = raw.toUpperCase()
    set('placa', val)
    setPlacaMsg('')
    if (placaTimer.current) clearTimeout(placaTimer.current)
    const limpa = val.replace(/[^A-Z0-9]/g, '')
    if (limpa.length === 7 && !inicial?.id) {
      placaTimer.current = setTimeout(async () => {
        setPlacaLoading(true)
        try {
          const r = await api.consultarPlaca(limpa)
          if (!r.error && r.marca) {
            setForm(f => ({
              ...f,
              marca: r.marca || f.marca,
              modelo: r.modelo || f.modelo,
              ano_fab: r.ano_fab ?? f.ano_fab,
              ano_mod: r.ano_mod ?? f.ano_mod,
              cor: r.cor || f.cor,
              combustivel: (r.combustivel as CombustivelVeiculo) || f.combustivel,
              categoria: (r.categoria as CategoriaVeiculo) || f.categoria,
            }))
            setPlacaMsg('Dados preenchidos automaticamente')
          }
        } catch { /* silencioso */ }
        setPlacaLoading(false)
      }, 400)
    }
  }, [inicial?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await salvar.mutateAsync(form)
    onClose()
  }

  const lbl = 'block text-xs font-bold mb-1 ' + (!isDark ? 'text-slate-600' : 'text-slate-300')

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300'
      : 'bg-white/6 border border-white/12 text-white hover:border-white/20'
  }`
  const sel = inp + (!isDark ? '' : ' [&>option]:bg-slate-900')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto styled-scrollbar ${
          !isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${!isDark ? 'text-slate-800' : 'text-white'}`}>{inicial?.id ? 'Editar' : 'Novo'} Veiculo</h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${!isDark ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Linha 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Placa * {placaLoading && <Loader2 size={12} className="inline animate-spin text-teal-400 ml-1" />}{placaMsg && <span className="text-[10px] text-emerald-400 ml-1"><Sparkles size={10} className="inline -mt-0.5 mr-0.5" />{placaMsg}</span>}</label>
            <input className={inp} value={form.placa} onChange={e => handlePlacaChange(e.target.value)} required placeholder="ABC-1234" />
          </div>
          <div>
            <label className={lbl}>Renavam</label>
            <input className={inp} value={form.renavam ?? ''} onChange={e => set('renavam', e.target.value)} placeholder="00000000000" />
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select className={sel} value={form.status} onChange={e => set('status', e.target.value)}>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Marca *</label>
            <input className={inp} value={form.marca} onChange={e => set('marca', e.target.value)} required placeholder="Toyota" />
          </div>
          <div>
            <label className={lbl}>Modelo *</label>
            <input className={inp} value={form.modelo} onChange={e => set('modelo', e.target.value)} required placeholder="Hilux" />
          </div>
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Ano Fab.</label>
            <input type="number" className={inp} value={form.ano_fab ?? ''} onChange={e => set('ano_fab', +e.target.value)} placeholder="2022" />
          </div>
          <div>
            <label className={lbl}>Ano Mod.</label>
            <input type="number" className={inp} value={form.ano_mod ?? ''} onChange={e => set('ano_mod', +e.target.value)} placeholder="2023" />
          </div>
          <div>
            <label className={lbl}>Cor</label>
            <input className={inp} value={form.cor ?? ''} onChange={e => set('cor', e.target.value)} placeholder="Branca" />
          </div>
        </div>

        {/* Linha 4 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Categoria</label>
            <select className={sel} value={form.categoria} onChange={e => set('categoria', e.target.value as CategoriaVeiculo)}>
              {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Combustivel</label>
            <select className={sel} value={form.combustivel} onChange={e => set('combustivel', e.target.value as CombustivelVeiculo)}>
              {Object.entries(COMBUSTIVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Propriedade</label>
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
            <label className={lbl}>Hodometro atual (km)</label>
            <input type="number" className={inp} value={form.hodometro_atual} onChange={e => set('hodometro_atual', +e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Proxima prev. (km)</label>
            <input type="number" className={inp} value={form.km_proxima_preventiva ?? ''} onChange={e => set('km_proxima_preventiva', +e.target.value)} placeholder="55000" />
          </div>
          <div>
            <label className={lbl}>Proxima prev. (data)</label>
            <input type="date" className={inp} value={form.data_proxima_preventiva ?? ''} onChange={e => set('data_proxima_preventiva', e.target.value)} />
          </div>
        </div>

        {/* Documentos */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Venc. CRLV</label>
            <input type="date" className={inp} value={form.vencimento_crlv ?? ''} onChange={e => set('vencimento_crlv', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Venc. Seguro</label>
            <input type="date" className={inp} value={form.vencimento_seguro ?? ''} onChange={e => set('vencimento_seguro', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Venc. Tacografo</label>
            <input type="date" className={inp} value={form.vencimento_tacografo ?? ''} onChange={e => set('vencimento_tacografo', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={lbl}>Observacoes</label>
          <textarea className={inp + ' resize-none'} rows={2} value={form.observacoes ?? ''} onChange={e => set('observacoes', e.target.value)} />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            !isDark ? 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:border-white/20'
          }`}>
            Cancelar
          </button>
          <button type="submit" disabled={salvar.isPending} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Veiculos() {
  const { isDark } = useTheme()
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
          <h1 className={`text-xl font-bold flex items-center gap-2 ${!isDark ? 'text-slate-800' : 'text-white'}`}>
            <Car size={20} className="text-teal-500" /> Veiculos
          </h1>
          <p className="text-sm text-slate-500">{veiculos.length} veiculo{veiculos.length !== 1 ? 's' : ''} cadastrado{veiculos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-sm shadow-teal-500/20 text-sm text-white font-semibold transition-colors"
        >
          <Plus size={15} /> Novo Veiculo
        </button>
      </div>

      {/* Busca + Filtros */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              isLight
                ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300 placeholder:text-slate-400'
                : 'bg-white/6 border border-white/12 text-white hover:border-white/20 placeholder:text-slate-600'
            }`}
            placeholder="Buscar placa, marca, modelo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div>
          <label className={`block text-xs font-medium mb-1 ${!isDark ? 'text-slate-600' : 'text-slate-300'}`}>Status</label>
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value as StatusVeiculo | '')}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              !isDark ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300' : 'bg-white/6 border border-white/12 text-white hover:border-white/20 [&>option]:bg-slate-900'
            }`}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className={`block text-xs font-medium mb-1 ${!isDark ? 'text-slate-600' : 'text-slate-300'}`}>Categoria</label>
          <select
            value={catFiltro}
            onChange={e => setCatFiltro(e.target.value as CategoriaVeiculo | '')}
            className={`px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
              !isDark ? 'bg-white border border-slate-200 shadow-sm text-slate-800 hover:border-slate-300' : 'bg-white/6 border border-white/12 text-white hover:border-white/20 [&>option]:bg-slate-900'
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
            <div key={i} className={`rounded-xl h-16 animate-pulse ${!isDark ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'}`} />
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
              <div key={v.id} className={`rounded-xl shadow-sm px-4 py-3 flex items-center gap-4 ${
                !isDark ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
              }`}>

                {/* Placa */}
                <div className="w-24 shrink-0">
                  <p className={`text-sm font-black tracking-widest ${!isDark ? 'text-slate-800' : 'text-white'}`}>{v.placa}</p>
                  <p className="text-[10px] text-slate-500">{CATEGORIA_LABEL[v.categoria]}</p>
                </div>

                {/* Modelo */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${!isDark ? 'text-slate-800' : 'text-white'}`}>{v.marca} {v.modelo}</p>
                  <p className="text-[11px] text-slate-500">{v.ano_fab}/{v.ano_mod} · {COMBUSTIVEL_LABEL[v.combustivel]}</p>
                </div>

                {/* Hodometro */}
                <div className="hidden sm:block w-24 text-right">
                  <p className={`text-sm font-semibold ${!isDark ? 'text-slate-800' : 'text-white'}`}>{v.hodometro_atual.toLocaleString('pt-BR')} km</p>
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
                  className="text-slate-500 hover:text-teal-400 transition-colors"
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
