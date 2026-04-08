import { useMemo, useState } from 'react'
import {
  Landmark, Plus, Search, X, Save, Loader2,
  TrendingDown, AlertTriangle, CheckCircle2, Wrench, Truck,
  ArrowLeftRight, FileText, ChevronDown, ChevronRight, RefreshCw,
  LayoutGrid, LayoutList, MapPin,
} from 'lucide-react'
import {
  useImobilizados, useSalvarImobilizado, useBaixarImobilizado,
  usePatrimonialKPIs, useCalcularDepreciacao,
  useMovimentacoesPatrimonial, useTermosResponsabilidade,
  useTransferirAtivo, useTransferencias,
} from '../../hooks/usePatrimonial'
import { useBases } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type { PatImobilizado, StatusImobilizado } from '../../types/estoque'

const STATUS_CONFIG: Record<StatusImobilizado, { label: string; bg: string; text: string; dot: string }> = {
  ativo:            { label: 'Ativo',            bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  em_manutencao:    { label: 'Em Manuten\u00e7\u00e3o',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  cedido:           { label: 'Cedido',           bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  em_transferencia:  { label: 'Em Transfer\u00eancia', bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  baixado:           { label: 'Baixado',          bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  pendente_registro: { label: 'Aguardando Entrada', bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const EMPTY_FORM: Partial<PatImobilizado> = {
  numero_patrimonio: '', descricao: '', categoria: '',
  status: 'ativo', valor_aquisicao: 0,
  vida_util_meses: 60, taxa_depreciacao_anual: 20, valor_residual: 0,
}

const COMPETENCIA = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

interface PatrimonialProps {
  forcedStatusFiltro?: string
  allowedStatuses?: StatusImobilizado[]
  showDepreciadosOnly?: boolean
  hideHeader?: boolean
}

type ViewMode = 'cards' | 'list'

export default function Patrimonial({
  forcedStatusFiltro,
  allowedStatuses,
  showDepreciadosOnly = false,
  hideHeader = false,
}: PatrimonialProps) {
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<PatImobilizado> | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showBaixaModal, setShowBaixaModal] = useState<string | null>(null)
  const [motivoBaixa, setMotivoBaixa] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [showDepreciarModal, setShowDepreciarModal] = useState(false)
  const [depreciarCompetencia, setDepreciarCompetencia] = useState(COMPETENCIA)
  const [transferirAtivo, setTransferirAtivo] = useState<PatImobilizado | null>(null)
  const [filtroBase, setFiltroBase] = useState<string>('')

  const filtroAtivo = forcedStatusFiltro ?? statusFiltro
  const { data: imobs = [], isLoading } = useImobilizados({
    ...(filtroAtivo ? { status: filtroAtivo } : {}),
    ...(filtroBase ? { base_id: filtroBase } : {}),
  })
  const { data: kpis } = usePatrimonialKPIs()
  const { data: bases = [] } = useBases()
  const salvar = useSalvarImobilizado()
  const baixar = useBaixarImobilizado()
  const calcDeprec = useCalcularDepreciacao()

  const filtrados = useMemo(() => {
    let base = allowedStatuses?.length
      ? imobs.filter(i => allowedStatuses.includes(i.status))
      : imobs

    if (showDepreciadosOnly) {
      base = base.filter(i => (i.percentual_depreciado ?? 0) >= 100)
    }

    return busca.trim()
      ? base.filter(i =>
          i.descricao.toLowerCase().includes(busca.toLowerCase()) ||
          i.numero_patrimonio.toLowerCase().includes(busca.toLowerCase()) ||
          i.categoria?.toLowerCase().includes(busca.toLowerCase())
        )
      : base
  }, [allowedStatuses, busca, imobs, showDepreciadosOnly])

  async function handleSave() {
    if (!editItem) return
    await salvar.mutateAsync(editItem)
    setShowForm(false)
    setEditItem(null)
  }

  async function handleBaixa() {
    if (!showBaixaModal || !motivoBaixa) return
    await baixar.mutateAsync({ id: showBaixaModal, motivo_baixa: motivoBaixa })
    setShowBaixaModal(null)
    setMotivoBaixa('')
  }

  const set = (k: keyof PatImobilizado, v: any) => setEditItem(p => ({ ...p, [k]: v }))

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Patrim\u00f4nio'}</h1>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filtrados.length} imobilizados</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setDepreciarCompetencia(COMPETENCIA); setShowDepreciarModal(true) }}
              disabled={calcDeprec.isPending}
              title={`Calcular deprecia\u00e7\u00e3o ${COMPETENCIA}`}
              className={`flex items-center gap-1.5 border text-sm font-semibold px-3 py-2 rounded-xl transition-colors
                ${isLight ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/[0.03] hover:bg-white/[0.05] border-white/[0.08] text-slate-300'}`}
            >
              {calcDeprec.isPending ? <Loader2 size={14} className="animate-spin" /> : <TrendingDown size={14} />}
              Depreciar
            </button>
            <button
              onClick={() => { setEditItem({ ...EMPTY_FORM }); setShowForm(true) }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
                text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus size={15} /> Novo
            </button>
          </div>
        </div>
      )}

      {/* -- KPI Summary -------------------------------------------- */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { color: 'bg-blue-500',   val: kpis.total_imobilizados, valCls: 'text-blue-600',   lbl: 'Total Ativos' },
            { color: 'bg-indigo-500', val: fmt(kpis.valor_total_liquido), valCls: 'text-indigo-600', lbl: 'Valor L\u00edquido' },
            { color: 'bg-amber-500',  val: fmt(kpis.depreciacao_acumulada ?? 0), valCls: 'text-amber-600', lbl: 'Deprecia\u00e7\u00e3o Acum.' },
            { color: 'bg-red-500',    val: kpis.termos_pendentes, valCls: 'text-red-600',    lbl: 'Termos Pendentes' },
          ].map(({ color, val, valCls, lbl }) => (
            <div key={lbl} className={`rounded-2xl border overflow-hidden flex ${card}`}>
              <div className={`w-[3px] ${color} shrink-0`} />
              <div className="p-3 flex-1">
                <p className={`text-lg font-extrabold ${valCls}`}>{val}</p>
                <p className={`text-[10px] uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{lbl}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Filtros ------------------------------------------------- */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder={'Buscar por patrim\u00f4nio, descri\u00e7\u00e3o ou categoria...'}
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
              ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
          />
        </div>
        <select
          value={filtroBase}
          onChange={e => setFiltroBase(e.target.value)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold
            focus:outline-none focus:ring-2 focus:ring-violet-500/30
            ${filtroBase
              ? isLight ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-violet-400/40 bg-violet-500/10 text-violet-300'
              : isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
            }`}
        >
          <option value="">Todas as Bases</option>
          {bases.filter(b => b.ativa).map(b => (
            <option key={b.id} value={b.id}>{b.codigo ? `${b.codigo} — ${b.nome}` : b.nome}</option>
          ))}
        </select>
        {!forcedStatusFiltro && !showDepreciadosOnly && (
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold
              focus:outline-none focus:ring-2 focus:ring-blue-500/30
              ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'}`}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
        <div className={`flex items-center rounded-xl border overflow-hidden ${
          isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]'
        }`}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-2 transition-all ${
              viewMode === 'list'
                ? isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.08] text-white'
                : isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}
            title={'Vis\u00e3o tabela'}
          >
            <LayoutList size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-2 transition-all ${
              viewMode === 'cards'
                ? isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.08] text-white'
                : isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-50' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
            }`}
            title={'Vis\u00e3o cards'}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <Landmark size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum imobilizado cadastrado</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2 p-4">
          {filtrados.map(imob => (
            <ImobilizadoCard
              key={imob.id}
              imob={imob}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onEdit={() => { setEditItem({ ...imob }); setShowForm(true) }}
              onBaixa={() => setShowBaixaModal(imob.id)}
              onTransferir={() => setTransferirAtivo(imob)}
              isLight={isLight}
              card={card}
            />
          ))}
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${card}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                <tr className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider">{'Patrim\u00f4nio'}</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider">Descricao</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wider">Responsavel</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider">Deprec.</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(imob => (
                  <ImobilizadoTableRow
                    key={imob.id}
                    imob={imob}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    onEdit={() => { setEditItem({ ...imob }); setShowForm(true) }}
                    onBaixa={() => setShowBaixaModal(imob.id)}
                    onTransferir={() => setTransferirAtivo(imob)}
                    isLight={isLight}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Modal Cadastro ----------------------------------------- */}
      {showForm && editItem && (
        <ImobilizadoFormModal
          item={editItem}
          bases={bases}
          onChange={setEditItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          saving={salvar.isPending}
          isLight={isLight}
        />
      )}

      {/* -- Modal Depreciar ---------------------------------------- */}
      {showDepreciarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Calcular Deprecia\u00e7\u00e3o'}</h2>
              <button
                onClick={() => setShowDepreciarModal(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {'Ser\u00e3o calculadas e registradas as deprecia\u00e7\u00f5es mensais de todos os imobilizados ativos, em manuten\u00e7\u00e3o e cedidos.'}
              </p>
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>{'Compet\u00eancia (AAAA-MM)'}</label>
                <input
                  type="month"
                  value={depreciarCompetencia}
                  onChange={e => setDepreciarCompetencia(e.target.value)}
                  className={inputCls}
                />
              </div>
              {kpis && (
                <div className={`rounded-xl p-3 text-xs space-y-1 ${isLight ? 'bg-amber-50 border border-amber-100' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <p className={`font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{'Imobilizados elegíveis: '}<span className="font-extrabold">{kpis.total_imobilizados}</span></p>
                  <p className={isLight ? 'text-amber-600' : 'text-amber-300'}>{'Deprecia\u00e7\u00e3o estimada: '}<span className="font-bold">{kpis.depreciacao_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
                </div>
              )}
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button
                onClick={() => setShowDepreciarModal(false)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
                  ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  calcDeprec.mutate(depreciarCompetencia, {
                    onSuccess: () => setShowDepreciarModal(false),
                  })
                }}
                disabled={calcDeprec.isPending || !depreciarCompetencia}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {calcDeprec.isPending ? <Loader2 size={14} className="animate-spin" /> : <TrendingDown size={14} />}
                {'Confirmar Deprecia\u00e7\u00e3o'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal Baixa -------------------------------------------- */}
      {showBaixaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Registrar Baixa</h2>
              <button onClick={() => setShowBaixaModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Motivo da Baixa *</label>
                <textarea
                  value={motivoBaixa}
                  onChange={e => setMotivoBaixa(e.target.value)}
                  rows={3} className={`${inputCls} resize-none`}
                  placeholder="Descreva o motivo da baixa..." />
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button onClick={() => setShowBaixaModal(null)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
                  ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                Cancelar
              </button>
              <button onClick={handleBaixa} disabled={baixar.isPending || !motivoBaixa}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {baixar.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                Confirmar Baixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Modal Transferir Ativo --------------------------------- */}
      {transferirAtivo && (
        <TransferirAtivoModal
          ativo={transferirAtivo}
          bases={bases}
          onClose={() => setTransferirAtivo(null)}
          isLight={isLight}
        />
      )}
    </div>
  )
}

// -- Detalhe do Imobilizado --------------------------------------------------------
function ImobilizadoCard({
  imob,
  expandedId,
  setExpandedId,
  onEdit,
  onBaixa,
  onTransferir,
  isLight,
  card,
}: {
  imob: PatImobilizado
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onEdit: () => void
  onBaixa: () => void
  onTransferir: () => void
  isLight: boolean
  card: string
}) {
  const cfg = STATUS_CONFIG[imob.status]
  const isExpanded = expandedId === imob.id
  const pctDeprec = imob.percentual_depreciado ?? 0

  return (
    <div className={`rounded-2xl border overflow-hidden h-full ${card}`}>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
        onClick={() => setExpandedId(isExpanded ? null : imob.id)}
      >
        <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
          <Landmark size={16} className="text-cyan-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-extrabold font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>{imob.numero_patrimonio}</p>
            <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <p className={`text-xs mt-0.5 truncate ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{imob.descricao}</p>
          <div className={`flex items-center gap-2 text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>{imob.categoria}</span>
            {imob.responsavel_nome && <span>· {imob.responsavel_nome}</span>}
            {imob.base_nome && (
              <span className="inline-flex items-center gap-0.5 text-violet-500 font-semibold">
                <MapPin size={9} /> {imob.base_nome}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 mr-2 hidden sm:block">
          <p className={`text-sm font-extrabold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{fmt(imob.valor_atual ?? imob.valor_aquisicao)}</p>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.08]'}`}>
              <div
                className={`h-full rounded-full transition-all ${pctDeprec >= 80 ? 'bg-red-500' : pctDeprec >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${pctDeprec}%` }}
              />
            </div>
            <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{pctDeprec}%</span>
          </div>
        </div>
        {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </div>

      {isExpanded && (
        <ImobilizadoDetail
          imob={imob}
          onEdit={onEdit}
          onBaixa={onBaixa}
          onTransferir={onTransferir}
          isLight={isLight}
        />
      )}
    </div>
  )
}

function ImobilizadoTableRow({
  imob,
  expandedId,
  setExpandedId,
  onEdit,
  onBaixa,
  onTransferir,
  isLight,
}: {
  imob: PatImobilizado
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onEdit: () => void
  onBaixa: () => void
  onTransferir: () => void
  isLight: boolean
}) {
  const cfg = STATUS_CONFIG[imob.status]
  const pctDeprec = imob.percentual_depreciado ?? 0
  const isExpanded = expandedId === imob.id
  const cellBorder = isLight ? 'border-slate-100' : 'border-white/[0.04]'

  return (
    <>
      <tr className={`border-t ${cellBorder} ${isLight ? 'hover:bg-slate-50/70' : 'hover:bg-white/[0.02]'}`}>
      <td className="px-4 py-2">
          <button
            type="button"
            onClick={() => setExpandedId(isExpanded ? null : imob.id)}
            className="flex items-center gap-2 text-left"
          >
            <span className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <Landmark size={14} className="text-cyan-600" />
            </span>
            <span className={`font-mono font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{imob.numero_patrimonio}</span>
          </button>
        </td>
      <td className={`px-4 py-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          <div className="min-w-[220px]">
            <p className="font-semibold">{imob.descricao}</p>
            <p className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{imob.categoria || 'Sem categoria'}</p>
          </div>
        </td>
      <td className="px-4 py-2">
          <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </td>
      <td className={`px-4 py-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          <div className="min-w-[140px]">
            <p>{imob.responsavel_nome || '--'}</p>
            <p className={`text-[11px] flex items-center gap-0.5 ${imob.base_nome ? 'text-violet-500 font-semibold' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {imob.base_nome && <MapPin size={9} />}
              {imob.base_nome || 'Sem base'}
            </p>
          </div>
        </td>
      <td className={`px-4 py-2 text-right font-extrabold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
          {fmt(imob.valor_atual ?? imob.valor_aquisicao)}
        </td>
      <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-2 min-w-[110px]">
            <div className={`w-16 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/[0.08]'}`}>
              <div
                className={`h-full rounded-full transition-all ${pctDeprec >= 80 ? 'bg-red-500' : pctDeprec >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${pctDeprec}%` }}
              />
            </div>
            <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{pctDeprec}%</span>
          </div>
        </td>
      <td className="px-4 py-2">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : imob.id)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.09]'
              }`}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Detalhes
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className={`border-t ${cellBorder}`}>
          <td colSpan={7} className="p-0">
            <ImobilizadoDetail
              imob={imob}
              onEdit={onEdit}
              onBaixa={onBaixa}
              onTransferir={onTransferir}
              isLight={isLight}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function ImobilizadoDetail({
  imob, onEdit, onBaixa, onTransferir, isLight
}: { imob: PatImobilizado; onEdit: () => void; onBaixa: () => void; onTransferir: () => void; isLight: boolean }) {
  const { data: movs = [] } = useMovimentacoesPatrimonial(imob.id)
  const { data: termos = [] } = useTermosResponsabilidade(imob.id)
  const { data: transferencias = [] } = useTransferencias(imob.id)

  const detailBg = isLight ? 'bg-slate-50' : 'bg-white/[0.03]'
  const subtext = isLight ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`border-t px-4 py-4 space-y-4 ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
      {/* Detalhes financeiros */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-3 ${detailBg}`}>
          <p className={`text-[10px] uppercase tracking-widest ${subtext}`}>Valor Aquisicao</p>
          <p className={`text-sm font-extrabold mt-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{(imob.valor_aquisicao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className={`rounded-xl p-3 ${detailBg}`}>
          <p className={`text-[10px] uppercase tracking-widest ${subtext}`}>Valor Atual</p>
          <p className="text-sm font-extrabold text-blue-600 mt-1">{(imob.valor_atual ?? imob.valor_aquisicao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className={`rounded-xl p-3 ${detailBg}`}>
          <p className={`text-[10px] uppercase tracking-widest ${subtext}`}>Depreciado</p>
          <p className={`text-sm font-extrabold mt-1 ${(imob.percentual_depreciado ?? 0) >= 80 ? 'text-red-600' : isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            {imob.percentual_depreciado ?? 0}%
          </p>
        </div>
      </div>

      {/* Informacoes adicionais */}
      <div className={`text-[10px] space-y-1 ${subtext}`}>
        {imob.marca && <p>Marca: <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{imob.marca}</span>{imob.modelo ? ` -- ${imob.modelo}` : ''}</p>}
        {imob.numero_serie && <p>{'N. S\u00e9rie:'} <span className={`font-semibold font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{imob.numero_serie}</span></p>}
        {imob.taxa_depreciacao_anual && <p>{'Taxa deprecia\u00e7\u00e3o:'} <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{imob.taxa_depreciacao_anual}% a.a.</span> {'- Vida \u00fatil:'} <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{imob.vida_util_meses} meses</span></p>}
        {imob.data_aquisicao && <p>Adquirido em: <span className={`font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{new Date(imob.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR')}</span></p>}
      </div>

      {/* Movimentacoes recentes */}
      {movs.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <ArrowLeftRight size={10} /> Movimentacoes
          </p>
          <div className="space-y-1">
            {movs.slice(0, 3).map(m => (
              <div key={m.id} className={`flex items-center justify-between text-xs py-1 border-b ${isLight ? 'border-slate-50' : 'border-white/[0.04]'}`}>
                <span className={`capitalize ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{m.tipo}</span>
                <span className={subtext}>{new Date(m.data_movimentacao).toLocaleDateString('pt-BR')}</span>
                {m.confirmado ? (
                  <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> Conf.</span>
                ) : (
                  <span className="text-amber-500">Pendente</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Termos de responsabilidade */}
      {termos.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <FileText size={10} /> Termos de Responsabilidade
          </p>
          <div className="space-y-1">
            {termos.slice(0, 2).map(t => (
              <div key={t.id} className={`flex items-center justify-between text-xs py-1 border-b ${isLight ? 'border-slate-50' : 'border-white/[0.04]'}`}>
                <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>{t.responsavel_nome}</span>
                <span className={subtext}>{t.tipo}</span>
                {t.assinado ? (
                  <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> Assinado</span>
                ) : (
                  <span className="text-amber-500">Pendente</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transferencias recentes */}
      {transferencias.length > 0 && (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <Truck size={10} /> Transferencias
          </p>
          <div className="space-y-1">
            {transferencias.slice(0, 3).map((t: any) => (
              <div key={t.id} className={`flex items-center justify-between text-xs py-1 border-b ${isLight ? 'border-slate-50' : 'border-white/[0.04]'}`}>
                <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                  {t.base_origem_nome || 'Sem base'} &rarr; {t.base_destino_nome}
                </span>
                <span className={subtext}>{new Date(t.data_transferencia).toLocaleDateString('pt-BR')}</span>
                {t.motivo && <span className={`truncate max-w-[120px] ${subtext}`} title={t.motivo}>{t.motivo}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acoes */}
      <div className="flex gap-2 pt-1">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100
            text-blue-700 text-xs font-semibold transition-colors">
          <RefreshCw size={12} /> Editar
        </button>
        {imob.status !== 'baixado' && (
          <button onClick={onTransferir}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100
              text-indigo-700 text-xs font-semibold transition-colors">
            <Truck size={12} /> Transferir
          </button>
        )}
        {imob.status !== 'baixado' && (
          <button onClick={onBaixa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100
              text-red-700 text-xs font-semibold transition-colors">
            <AlertTriangle size={12} /> Baixar
          </button>
        )}
      </div>
    </div>
  )
}

// -- Form Modal ------------------------------------------------------------------
function ImobilizadoFormModal({
  item, bases, onChange, onSave, onClose, saving, isLight
}: {
  item: Partial<PatImobilizado>
  bases: any[]
  onChange: (v: any) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  isLight: boolean
}) {
  const set = (k: keyof PatImobilizado, v: any) => onChange({ ...item, [k]: v })

  const modalBg = isLight ? 'bg-white' : 'bg-[#111827]'
  const borderB = isLight ? 'border-slate-100' : 'border-white/[0.06]'
  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'
  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB}`}>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {item.id ? 'Editar Imobilizado' : 'Novo Imobilizado'}
          </h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>{'N. Patrim\u00f4nio *'}</label>
              <input value={item.numero_patrimonio ?? ''} onChange={e => set('numero_patrimonio', e.target.value)}
                className={inputCls} placeholder="PAT-0001" />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Status</label>
              <select value={item.status ?? 'ativo'} onChange={e => set('status', e.target.value)}
                className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Descricao *</label>
            <input value={item.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              className={inputCls} placeholder="Ex: Notebook Dell Inspiron 15..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Categoria</label>
              <input value={item.categoria ?? ''} onChange={e => set('categoria', e.target.value)}
                className={inputCls} placeholder="Ex: Veiculos, TI..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Base</label>
              <select value={item.base_id ?? ''} onChange={e => set('base_id', e.target.value)}
                className={inputCls}>
                <option value="">Sem base</option>
                {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Marca</label>
              <input value={item.marca ?? ''} onChange={e => set('marca', e.target.value)}
                className={inputCls} placeholder="Ex: Dell, Toyota..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Modelo</label>
              <input value={item.modelo ?? ''} onChange={e => set('modelo', e.target.value)}
                className={inputCls} placeholder="Ex: Corolla 2023..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Valor Aquisicao (R$) *</label>
              <input type="number" min={0} step={0.01} value={item.valor_aquisicao || ''}
                onChange={e => set('valor_aquisicao', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Data Aquisicao</label>
              <input type="date" value={item.data_aquisicao ?? ''}
                onChange={e => set('data_aquisicao', e.target.value)}
                className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Vida Util (meses)</label>
              <input type="number" min={1} value={item.vida_util_meses ?? 60}
                onChange={e => set('vida_util_meses', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Taxa Deprec. (% a.a.)</label>
              <input type="number" min={0} max={100} step={0.1} value={item.taxa_depreciacao_anual ?? 20}
                onChange={e => set('taxa_depreciacao_anual', Number(e.target.value))}
                className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Valor Residual (R$)</label>
              <input type="number" min={0} step={0.01} value={item.valor_residual || ''}
                onChange={e => set('valor_residual', Number(e.target.value))}
                className={inputCls} />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Responsavel</label>
            <input value={item.responsavel_nome ?? ''} onChange={e => set('responsavel_nome', e.target.value)}
              className={inputCls} placeholder="Nome do responsavel..." />
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end gap-2 ${borderB}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
              ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// -- Modal Transferir Ativo -------------------------------------------------------
function TransferirAtivoModal({
  ativo,
  bases,
  onClose,
  isLight,
}: {
  ativo: PatImobilizado
  bases: any[]
  onClose: () => void
  isLight: boolean
}) {
  const [baseDestinoId, setBaseDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const transferir = useTransferirAtivo()

  const baseDestino = bases.find(b => b.id === baseDestinoId)
  const canSubmit = !!baseDestinoId && baseDestinoId !== ativo.base_id

  const modalBg = isLight ? 'bg-white' : 'bg-[#111827]'
  const borderB = isLight ? 'border-slate-100' : 'border-white/[0.06]'
  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'
  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  async function handleTransferir() {
    if (!canSubmit || !baseDestino) return
    await transferir.mutateAsync({
      imobilizado_id: ativo.id,
      base_origem_id: ativo.base_id ?? null,
      base_origem_nome: ativo.base_nome ?? null,
      base_destino_id: baseDestinoId,
      base_destino_nome: baseDestino.nome,
      responsavel_id: null,
      responsavel_nome: ativo.responsavel_nome ?? null,
      motivo: motivo || undefined,
      observacoes: observacoes || undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-md`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB}`}>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Transferir Ativo
          </h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Ativo info */}
          <div className={`rounded-xl p-3 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
            <p className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ativo</p>
            <p className={`text-sm font-extrabold mt-0.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {ativo.numero_patrimonio} - {ativo.descricao}
            </p>
          </div>

          {/* Origem */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Origem</label>
            <div className={`px-3 py-2 rounded-xl border text-sm ${
              isLight ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/[0.08] bg-white/[0.02] text-slate-400'
            }`}>
              {ativo.base_nome || 'Sem base definida'}
            </div>
          </div>

          {/* Destino */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Base Destino *</label>
            <select
              value={baseDestinoId}
              onChange={e => setBaseDestinoId(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione a base destino...</option>
              {bases
                .filter(b => b.id !== ativo.base_id)
                .map(b => (
                  <option key={b.id} value={b.id}>{b.nome}</option>
                ))}
            </select>
          </div>

          {/* Motivo */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Motivo</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Ex: Transferencia por demanda da obra..."
            />
          </div>

          {/* Observacoes */}
          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Observacoes</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Observacoes adicionais..."
            />
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end gap-2 ${borderB}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${
              isLight
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleTransferir}
            disabled={transferir.isPending || !canSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
          >
            {transferir.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
            Confirmar Transferencia
          </button>
        </div>
      </div>
    </div>
  )
}
