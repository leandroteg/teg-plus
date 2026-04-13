import { useState, useMemo } from 'react'
import {
  X, Package, ChevronDown, ChevronUp, Check,
  AlertTriangle, Warehouse, FileText, Hash, Info,
  ArchiveRestore, Gem, Ban,
} from 'lucide-react'
import { UpperInput, UpperTextarea } from './UpperInput'
import type { Pedido } from '../types'
import type { RecebimentoItemForm, TipoDestino } from '../types/estoque'
import {
  useItensRequisicao,
  useBases,
  useCriarRecebimento,
} from '../hooks/useRecebimento'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

/** Derive the default tipo_destino from destino_operacional */
function derivarDestinoPadrao(
  destino_operacional?: 'estoque' | 'patrimonio' | 'nenhum',
): TipoDestino {
  if (destino_operacional === 'patrimonio') return 'patrimonial'
  if (destino_operacional === 'nenhum') return 'nenhum'
  return 'consumo'
}

const DESTINO_OPTIONS: { value: TipoDestino; label: string; icon: typeof Package; color: string; activeColor: string }[] = [
  { value: 'consumo',     label: 'Estoque',     icon: ArchiveRestore, color: 'teal',   activeColor: 'bg-teal-100 text-teal-700 border-teal-300 ring-1 ring-teal-200' },
  { value: 'patrimonial', label: 'Patrimonio', icon: Gem,            color: 'violet', activeColor: 'bg-violet-100 text-violet-700 border-violet-300 ring-1 ring-violet-200' },
  { value: 'nenhum',      label: 'Nenhum',      icon: Ban,            color: 'slate',  activeColor: 'bg-slate-100 text-slate-600 border-slate-300 ring-1 ring-slate-200' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecebimentoModal({
  pedido,
  onClose,
}: {
  pedido: Pedido
  onClose: () => void
}) {
  const { data: itensRC, isLoading: loadingItens } = useItensRequisicao(pedido.requisicao_id)
  const { data: bases, isLoading: loadingBases }   = useBases()
  const criarRecebimento = useCriarRecebimento()

  // Form state
  const [baseId, setBaseId]                 = useState('')
  const [nfNumero, setNfNumero]             = useState('')
  const [nfChave, setNfChave]               = useState('')
  const [observacao, setObservacao]          = useState('')
  const [erro, setErro]                     = useState('')
  const [showAdvanced, setShowAdvanced]     = useState(false)
  const [success, setSuccess]               = useState(false)

  // Items state — initialized from RC items
  const [itens, setItens] = useState<RecebimentoItemForm[]>([])
  const [initialized, setInitialized]       = useState(false)

  // Initialize items when RC items load — with smart pre-fill from catalog
  if (itensRC && !initialized) {
    setItens(
      itensRC.map(item => {
        const destino = derivarDestinoPadrao(item.destino_operacional)
        return {
          requisicao_item_id: item.id,
          item_estoque_id: item.est_item_id,
          descricao: item.descricao,
          quantidade_esperada: item.quantidade,
          quantidade_recebida: item.quantidade,
          valor_unitario: item.valor_unitario_estimado,
          tipo_destino: destino,
          destino_padrao: item.est_item_id ? destino : undefined,
        }
      })
    )
    setInitialized(true)
  }

  // Computed
  const totalRecebido = useMemo(
    () => itens.reduce((sum, i) => sum + i.quantidade_recebida * i.valor_unitario, 0),
    [itens],
  )
  const temPatrimonial = itens.some(i => i.tipo_destino === 'patrimonial' && i.quantidade_recebida > 0)
  const temNenhum = itens.some(i => i.tipo_destino === 'nenhum' && i.quantidade_recebida > 0)
  const qtdComRecebimento = itens.filter(i => i.quantidade_recebida > 0).length

  // Check if any item has an override without justification
  const temOverrideSemJustificativa = itens.some(
    i => i.destino_padrao && i.tipo_destino !== i.destino_padrao
      && i.quantidade_recebida > 0
      && !i.justificativa_destino?.trim()
  )

  // Item updaters
  const updateItem = (idx: number, patch: Partial<RecebimentoItemForm>) => {
    setItens(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const handleSubmit = async () => {
    if (qtdComRecebimento === 0) {
      setErro('Informe a quantidade recebida em pelo menos 1 item.')
      return
    }
    if (temOverrideSemJustificativa) {
      setErro('Preencha a justificativa dos itens com destino alterado.')
      return
    }
    setErro('')
    try {
      await criarRecebimento.mutateAsync({
        pedidoId: pedido.id,
        baseId: baseId || undefined,
        nfNumero: nfNumero || undefined,
        nfChave: nfChave || undefined,
        dataRecebimento: new Date().toISOString().split('T')[0],
        observacao: observacao || undefined,
        itens,
      })
      setSuccess(true)
      setTimeout(() => onClose(), 1200)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao registrar recebimento.')
    }
  }

  const isLoading = loadingItens || loadingBases

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Package size={17} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Receber Pedido</p>
              <p className="text-[11px] text-slate-400">
                #{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}
                {' · '}
                <span className="text-slate-500 font-medium">{pedido.fornecedor_nome}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body (scrollable) ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto styled-scrollbar p-5 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : success ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check size={28} className="text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-emerald-700">Recebimento registrado!</p>
              <p className="text-xs text-slate-400">Estoque e patrimonial atualizados automaticamente.</p>
            </div>
          ) : (
            <>
              {/* ── Base de destino ──────────────────────────────── */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  <Warehouse size={12} className="inline mr-1 -mt-0.5" />
                  Base / Almoxarifado
                </label>
                <select
                  value={baseId}
                  onChange={e => setBaseId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
                >
                  <option value="">Selecione a base...</option>
                  {(bases ?? []).map(b => (
                    <option key={b.id} value={b.id}>
                      {b.codigo} — {b.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Items table ───────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                  <Package size={12} />
                  Itens ({itens.length})
                </p>
                <div className="space-y-2">
                  {itens.map((item, idx) => (
                    <ItemRow
                      key={idx}
                      item={item}
                      onChange={patch => updateItem(idx, patch)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Advanced: obs ─────────────────────────────────── */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Observacoes
              </button>
              {showAdvanced && (
                <UpperTextarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Observacoes sobre o recebimento..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
                />
              )}

              {/* ── Patrimonial notice ────────────────────────────── */}
              {temPatrimonial && (
                <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-xs text-violet-700">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold">Itens patrimoniais</span> serao registrados como pendentes
                    no modulo Patrimonial para complementacao de dados (vida util, taxa, responsavel).
                  </p>
                </div>
              )}

              {/* ── Nenhum notice ──────────────────────────────────── */}
              {temNenhum && (
                <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Itens com destino <span className="font-bold">Nenhum</span> serao registrados
                    apenas no recebimento, sem entrada no Estoque ou Patrimonial.
                  </p>
                </div>
              )}

              {/* ── Error ─────────────────────────────────────────── */}
              {erro && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {erro}
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        {!success && !isLoading && (
          <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 space-y-2">
            {/* Total */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {qtdComRecebimento} de {itens.length} itens
              </span>
              <span className="font-bold text-teal-700 text-sm">{fmt(totalRecebido)}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={criarRecebimento.isPending || qtdComRecebimento === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {criarRecebimento.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Package size={16} />
              )}
              {criarRecebimento.isPending ? 'Processando...' : 'Confirmar Recebimento'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────

function destinoLabel(d: TipoDestino) {
  if (d === 'patrimonial') return 'Patrimonio'
  if (d === 'nenhum') return 'Nenhum'
  return 'Estoque'
}

function ItemRow({
  item,
  onChange,
}: {
  item: RecebimentoItemForm
  onChange: (patch: Partial<RecebimentoItemForm>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const parcial = item.quantidade_recebida < item.quantidade_esperada && item.quantidade_recebida > 0
  const zero = item.quantidade_recebida === 0

  // Detect if user changed from the catalog default
  const isOverride = item.destino_padrao != null && item.tipo_destino !== item.destino_padrao
  const needsJustificativa = isOverride && item.quantidade_recebida > 0

  const handleSetDestino = (novoDestino: TipoDestino) => {
    const voltouAoPadrao = item.destino_padrao != null && novoDestino === item.destino_padrao
    onChange({
      tipo_destino: novoDestino,
      ...(voltouAoPadrao ? { justificativa_destino: '' } : {}),
    })
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      zero ? 'border-slate-100 bg-slate-50/50 opacity-60'
        : isOverride ? 'border-amber-300 bg-amber-50/40'
        : parcial ? 'border-amber-200 bg-amber-50/30'
        : 'border-slate-200'
    }`}>
      {/* Main row */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate">{item.descricao}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] text-slate-400">
                Esperado: {item.quantidade_esperada} · {fmt(item.valor_unitario)}/un
              </p>
              {/* Badge showing catalog default */}
              {item.destino_padrao && (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  item.destino_padrao === 'patrimonial'
                    ? 'bg-violet-100 text-violet-600'
                    : item.destino_padrao === 'nenhum'
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-teal-100 text-teal-600'
                }`}>
                  {item.destino_padrao === 'patrimonial' ? 'PAT' : item.destino_padrao === 'nenhum' ? '—' : 'EST'}
                </span>
              )}
            </div>
          </div>

          {/* Quantity input */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="number"
              min={0}
              max={item.quantidade_esperada}
              step={1}
              value={item.quantidade_recebida}
              onChange={e => onChange({ quantidade_recebida: Math.max(0, Number(e.target.value)) })}
              className="w-16 text-center text-sm font-bold border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
            />
          </div>

          {/* Expand */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1 rounded text-slate-300 hover:text-slate-500"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Destino: elegant entry selector */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl px-3 py-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Entrada no sistema</p>
          <div className="flex gap-1.5">
            {DESTINO_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isActive = item.tipo_destino === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSetDestino(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-bold border-2 transition-all ${
                    isActive
                      ? opt.value === 'consumo'
                        ? 'bg-teal-50 text-teal-700 border-teal-400 shadow-sm shadow-teal-100'
                        : opt.value === 'patrimonial'
                        ? 'bg-violet-50 text-violet-700 border-violet-400 shadow-sm shadow-violet-100'
                        : 'bg-slate-100 text-slate-600 border-slate-400 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-500'
                  }`}
                >
                  <Icon size={13} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Override warning + justificativa */}
      {needsJustificativa && (
        <div className="px-3 pb-2.5 pt-1 border-t border-amber-200/60">
          <div className="flex items-start gap-1.5 mb-1.5">
            <Info size={11} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-600 font-medium">
              Destino alterado de <span className="font-bold">{destinoLabel(item.destino_padrao!)}</span> para{' '}
              <span className="font-bold">{destinoLabel(item.tipo_destino)}</span>.
              Justificativa obrigatoria:
            </p>
          </div>
          <UpperInput
            type="text"
            value={item.justificativa_destino ?? ''}
            onChange={e => onChange({ justificativa_destino: e.target.value })}
            placeholder="Motivo da alteracao..."
            className={`w-full text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 transition-colors ${
              !item.justificativa_destino?.trim()
                ? 'border-amber-300 bg-amber-50 focus:ring-amber-400 placeholder:text-amber-300'
                : 'border-slate-200 bg-white focus:ring-teal-300 placeholder:text-slate-300'
            }`}
          />
        </div>
      )}

      {/* Expanded: lote, serie, validade */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Lote</label>
            <UpperInput
              type="text"
              value={item.lote ?? ''}
              onChange={e => onChange({ lote: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-300"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">N. Serie</label>
            <UpperInput
              type="text"
              value={item.numero_serie ?? ''}
              onChange={e => onChange({ numero_serie: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-300"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Validade</label>
            <input
              type="date"
              value={item.data_validade ?? ''}
              onChange={e => onChange({ data_validade: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-300"
            />
          </div>
        </div>
      )}

      {/* Partial badge */}
      {parcial && (
        <div className="px-3 pb-2">
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            Parcial: {item.quantidade_recebida}/{item.quantidade_esperada}
          </span>
        </div>
      )}
    </div>
  )
}
