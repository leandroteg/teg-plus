import { useState } from 'react'
import {
  Landmark, Plus, Search, X, Save, Loader2,
  TrendingDown, AlertTriangle, CheckCircle2, Wrench,
  ArrowLeftRight, FileText, ChevronDown, ChevronRight, RefreshCw,
} from 'lucide-react'
import {
  useImobilizados, useSalvarImobilizado, useBaixarImobilizado,
  usePatrimonialKPIs, useCalcularDepreciacao,
  useMovimentacoesPatrimonial, useTermosResponsabilidade,
} from '../../hooks/usePatrimonial'
import { useBases } from '../../hooks/useEstoque'
import type { PatImobilizado, StatusImobilizado } from '../../types/estoque'

const STATUS_CONFIG: Record<StatusImobilizado, { label: string; bg: string; text: string; dot: string }> = {
  ativo:            { label: 'Ativo',            bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  em_manutencao:    { label: 'Em Manutenção',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  cedido:           { label: 'Cedido',           bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  em_transferencia:  { label: 'Em Transferência', bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  baixado:           { label: 'Baixado',          bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  pendente_registro: { label: 'Pendente',         bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
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

export default function Patrimonial() {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<PatImobilizado> | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showBaixaModal, setShowBaixaModal] = useState<string | null>(null)
  const [motivoBaixa, setMotivoBaixa] = useState('')

  const { data: imobs = [], isLoading } = useImobilizados(
    statusFiltro ? { status: statusFiltro } : undefined
  )
  const { data: kpis } = usePatrimonialKPIs()
  const { data: bases = [] } = useBases()
  const salvar = useSalvarImobilizado()
  const baixar = useBaixarImobilizado()
  const calcDeprec = useCalcularDepreciacao()

  const filtrados = busca.trim()
    ? imobs.filter(i =>
        i.descricao.toLowerCase().includes(busca.toLowerCase()) ||
        i.numero_patrimonio.toLowerCase().includes(busca.toLowerCase()) ||
        i.categoria?.toLowerCase().includes(busca.toLowerCase())
      )
    : imobs

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

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Patrimonial</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} imobilizados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => calcDeprec.mutate(COMPETENCIA)}
            disabled={calcDeprec.isPending}
            title={`Calcular depreciação ${COMPETENCIA}`}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200
              text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
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

      {/* ── KPI Summary ─────────────────────────────────────────── */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex">
            <div className="w-[3px] bg-blue-500 shrink-0" />
            <div className="p-3 flex-1">
              <p className="text-lg font-extrabold text-blue-600">{kpis.total_imobilizados}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Total Ativos</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex">
            <div className="w-[3px] bg-indigo-500 shrink-0" />
            <div className="p-3 flex-1">
              <p className="text-lg font-extrabold text-indigo-600">{fmt(kpis.valor_total_liquido)}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Valor Líquido</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex">
            <div className="w-[3px] bg-amber-500 shrink-0" />
            <div className="p-3 flex-1">
              <p className="text-lg font-extrabold text-amber-600">{kpis.imobilizados_em_manutencao}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Em Manutenção</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex">
            <div className="w-[3px] bg-red-500 shrink-0" />
            <div className="p-3 flex-1">
              <p className="text-lg font-extrabold text-red-600">{kpis.termos_pendentes}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Termos Pendentes</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por patrimônio, descrição ou categoria..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={e => setStatusFiltro(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold
            text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Landmark size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum imobilizado cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(imob => {
            const cfg = STATUS_CONFIG[imob.status]
            const isExpanded = expandedId === imob.id
            const pctDeprec = imob.percentual_depreciado ?? 0
            return (
              <div key={imob.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : imob.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                    <Landmark size={16} className="text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-800 font-mono">{imob.numero_patrimonio}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{imob.descricao}</p>
                    <p className="text-[10px] text-slate-400">
                      {imob.categoria}
                      {imob.responsavel_nome ? ` · ${imob.responsavel_nome}` : ''}
                      {imob.base_nome ? ` · ${imob.base_nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-2 hidden sm:block">
                    <p className="text-sm font-extrabold text-slate-700">{fmt(imob.valor_atual ?? imob.valor_aquisicao)}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pctDeprec >= 80 ? 'bg-red-500' : pctDeprec >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${pctDeprec}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{pctDeprec}%</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                </div>

                {isExpanded && (
                  <ImobilizadoDetail
                    imob={imob}
                    onEdit={() => { setEditItem({ ...imob }); setShowForm(true) }}
                    onBaixa={() => setShowBaixaModal(imob.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Cadastro ─────────────────────────────────────── */}
      {showForm && editItem && (
        <ImobilizadoFormModal
          item={editItem}
          bases={bases}
          onChange={setEditItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          saving={salvar.isPending}
        />
      )}

      {/* ── Modal Baixa ────────────────────────────────────────── */}
      {showBaixaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Registrar Baixa</h2>
              <button onClick={() => setShowBaixaModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Motivo da Baixa *</label>
                <textarea
                  value={motivoBaixa}
                  onChange={e => setMotivoBaixa(e.target.value)}
                  rows={3} className="input-base resize-none"
                  placeholder="Descreva o motivo da baixa..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowBaixaModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
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
    </div>
  )
}

// ── Detalhe do Imobilizado ────────────────────────────────────────────────────
function ImobilizadoDetail({
  imob, onEdit, onBaixa
}: { imob: PatImobilizado; onEdit: () => void; onBaixa: () => void }) {
  const { data: movs = [] } = useMovimentacoesPatrimonial(imob.id)
  const { data: termos = [] } = useTermosResponsabilidade(imob.id)

  return (
    <div className="border-t border-slate-100 px-4 py-4 space-y-4">
      {/* Detalhes financeiros */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Valor Aquisição</p>
          <p className="text-sm font-extrabold text-slate-700 mt-1">{(imob.valor_aquisicao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Valor Atual</p>
          <p className="text-sm font-extrabold text-blue-600 mt-1">{(imob.valor_atual ?? imob.valor_aquisicao ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Depreciado</p>
          <p className={`text-sm font-extrabold mt-1 ${(imob.percentual_depreciado ?? 0) >= 80 ? 'text-red-600' : 'text-slate-700'}`}>
            {imob.percentual_depreciado ?? 0}%
          </p>
        </div>
      </div>

      {/* Informações adicionais */}
      <div className="text-[10px] text-slate-400 space-y-1">
        {imob.marca && <p>Marca: <span className="text-slate-600 font-semibold">{imob.marca}</span>{imob.modelo ? ` — ${imob.modelo}` : ''}</p>}
        {imob.numero_serie && <p>N° Série: <span className="text-slate-600 font-semibold font-mono">{imob.numero_serie}</span></p>}
        {imob.taxa_depreciacao_anual && <p>Taxa depreciação: <span className="text-slate-600 font-semibold">{imob.taxa_depreciacao_anual}% a.a.</span> · Vida útil: <span className="text-slate-600 font-semibold">{imob.vida_util_meses} meses</span></p>}
        {imob.data_aquisicao && <p>Adquirido em: <span className="text-slate-600 font-semibold">{new Date(imob.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR')}</span></p>}
      </div>

      {/* Movimentações recentes */}
      {movs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <ArrowLeftRight size={10} /> Movimentações
          </p>
          <div className="space-y-1">
            {movs.slice(0, 3).map(m => (
              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-600 capitalize">{m.tipo}</span>
                <span className="text-slate-400">{new Date(m.data_movimentacao).toLocaleDateString('pt-BR')}</span>
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <FileText size={10} /> Termos de Responsabilidade
          </p>
          <div className="space-y-1">
            {termos.slice(0, 2).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <span className="text-slate-600">{t.responsavel_nome}</span>
                <span className="text-slate-400">{t.tipo}</span>
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

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100
            text-blue-700 text-xs font-semibold transition-colors">
          <RefreshCw size={12} /> Editar
        </button>
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

// ── Form Modal ────────────────────────────────────────────────────────────────
function ImobilizadoFormModal({
  item, bases, onChange, onSave, onClose, saving
}: {
  item: Partial<PatImobilizado>
  bases: any[]
  onChange: (v: any) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  const set = (k: keyof PatImobilizado, v: any) => onChange({ ...item, [k]: v })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-800">
            {item.id ? 'Editar Imobilizado' : 'Novo Imobilizado'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">N° Patrimônio *</label>
              <input value={item.numero_patrimonio ?? ''} onChange={e => set('numero_patrimonio', e.target.value)}
                className="input-base" placeholder="PAT-0001" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
              <select value={item.status ?? 'ativo'} onChange={e => set('status', e.target.value)}
                className="input-base">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Descrição *</label>
            <input value={item.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
              className="input-base" placeholder="Ex: Notebook Dell Inspiron 15..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Categoria</label>
              <input value={item.categoria ?? ''} onChange={e => set('categoria', e.target.value)}
                className="input-base" placeholder="Ex: Veículos, TI..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Base</label>
              <select value={item.base_id ?? ''} onChange={e => set('base_id', e.target.value)}
                className="input-base">
                <option value="">Sem base</option>
                {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Marca</label>
              <input value={item.marca ?? ''} onChange={e => set('marca', e.target.value)}
                className="input-base" placeholder="Ex: Dell, Toyota..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Modelo</label>
              <input value={item.modelo ?? ''} onChange={e => set('modelo', e.target.value)}
                className="input-base" placeholder="Ex: Corolla 2023..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Valor Aquisição (R$) *</label>
              <input type="number" min={0} step={0.01} value={item.valor_aquisicao ?? 0}
                onChange={e => set('valor_aquisicao', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Data Aquisição</label>
              <input type="date" value={item.data_aquisicao ?? ''}
                onChange={e => set('data_aquisicao', e.target.value)}
                className="input-base" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Vida Útil (meses)</label>
              <input type="number" min={1} value={item.vida_util_meses ?? 60}
                onChange={e => set('vida_util_meses', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Taxa Deprec. (% a.a.)</label>
              <input type="number" min={0} max={100} step={0.1} value={item.taxa_depreciacao_anual ?? 20}
                onChange={e => set('taxa_depreciacao_anual', Number(e.target.value))}
                className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Valor Residual (R$)</label>
              <input type="number" min={0} step={0.01} value={item.valor_residual ?? 0}
                onChange={e => set('valor_residual', Number(e.target.value))}
                className="input-base" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Responsável</label>
            <input value={item.responsavel_nome ?? ''} onChange={e => set('responsavel_nome', e.target.value)}
              className="input-base" placeholder="Nome do responsável..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors">
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
