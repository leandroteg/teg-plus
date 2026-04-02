import { useState } from 'react'
import { X, Save, Loader2, ChevronsUpDown, AlertCircle } from 'lucide-react'
import { useSalvarItem } from '../hooks/useEstoque'
import { useCadClasses } from '../hooks/useCadastros'
import { useCategorias } from '../hooks/useCategorias'
import type { EstItem } from '../types/estoque'
import AutoCodeField from './AutoCodeField'
import SmartTextField from './SmartTextField'

const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']

const EMPTY: Partial<EstItem> = {
  codigo: '',
  descricao: '',
  categoria: '',
  unidade: 'UN',
  curva_abc: 'C',
  estoque_minimo: 0,
  estoque_maximo: 0,
  ponto_reposicao: 0,
  lead_time_dias: 0,
  controla_lote: false,
  controla_serie: false,
  tem_validade: false,
  valor_medio: 0,
  destino_operacional: 'estoque',
}

interface ItemFormModalProps {
  open: boolean
  /** Pre-fill fields (e.g. from a pre-cadastro). Pass `id` to enable edit mode. */
  initialData?: Partial<EstItem>
  onClose: () => void
  /** Called after the item is successfully saved */
  onSaved?: (item: Partial<EstItem>) => void | Promise<void>
  /** When provided, shows a "Rejeitar" button; called with the reject reason */
  onReject?: (motivo: string) => Promise<void>
  /** Optional info about who requested this pre-cadastro */
  solicitanteNome?: string
  solicitadoEm?: string
}

export default function ItemFormModal({ open, initialData, onClose, onSaved, onReject, solicitanteNome, solicitadoEm }: ItemFormModalProps) {
  const [editItem, setEditItem] = useState<Partial<EstItem>>(() => ({ ...EMPTY, ...initialData }))
  const [classeBusca, setClasseBusca] = useState(() => {
    if (initialData?.classe_financeira_codigo && initialData?.classe_financeira_descricao) {
      return `${initialData.classe_financeira_codigo} - ${initialData.classe_financeira_descricao}`
    }
    return ''
  })
  const [classeDropdownOpen, setClasseDropdownOpen] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const { data: gruposCompra = [] } = useCategorias()
  const salvar = useSalvarItem()

  if (!open) return null

  const classesFiltradas = classes
    .filter((classe) => {
      const termo = classeBusca.trim().toLowerCase()
      if (!termo) return true
      return `${classe.codigo} ${classe.descricao}`.toLowerCase().includes(termo)
    })
    .slice(0, 12)

  function formatClasseLabel(classe?: typeof classes[number]) {
    if (!classe) return ''
    return `${classe.codigo} - ${classe.descricao}`
  }

  function handleClasseChange(classeId: string) {
    const classe = classes.find((c) => c.id === classeId)
    setClasseBusca(formatClasseLabel(classe))
    setClasseDropdownOpen(false)
    setEditItem((prev) => ({
      ...prev,
      classe_financeira_id: classe?.id || undefined,
      classe_financeira_codigo: classe?.codigo || '',
      classe_financeira_descricao: classe?.descricao || '',
      categoria_financeira_codigo: classe?.categoria?.codigo || '',
      categoria_financeira_descricao: classe?.categoria?.descricao || '',
      categoria: classe?.categoria?.descricao || prev.categoria || '',
    }))
  }

  async function handleReject() {
    if (!rejectReason.trim() || !onReject) return
    setRejecting(true)
    try {
      await onReject(rejectReason.trim())
    } finally {
      setRejecting(false)
    }
  }

  async function handleSave() {
    const payload = {
      ...editItem,
      categoria: editItem.categoria_financeira_descricao || editItem.categoria || 'GERAL',
      estoque_minimo: editItem.destino_operacional === 'estoque' ? (editItem.estoque_minimo ?? 0) : 0,
      estoque_maximo: editItem.destino_operacional === 'estoque' ? (editItem.estoque_maximo ?? 0) : 0,
      ponto_reposicao: editItem.destino_operacional === 'estoque'
        ? (editItem.ponto_reposicao ?? editItem.estoque_minimo ?? 0)
        : 0,
    }
    await salvar.mutateAsync(payload)
    await onSaved?.(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">{editItem.id ? 'Editar Item' : 'Novo Item'}</h2>
            {solicitanteNome && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Solicitado por <span className="font-semibold text-slate-500">{solicitanteNome}</span>
                {solicitadoEm && ` em ${new Date(solicitadoEm).toLocaleDateString('pt-BR')}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <AutoCodeField
              prefix="ITM"
              table="est_itens"
              value={editItem.codigo ?? ''}
              onChange={(value) => setEditItem({ ...editItem, codigo: value })}
              disabled={!!editItem.id}
            />
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Unidade *</label>
              <select
                value={editItem.unidade ?? 'UN'}
                onChange={(e) => setEditItem({
                  ...editItem,
                  unidade: e.target.value as import('../types/estoque').UnidadeEstoque,
                })}
                className="input-base"
              >
                {UNIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <SmartTextField
            table="est_itens"
            column="descricao"
            value={editItem.descricao ?? ''}
            onChange={(value) => setEditItem({ ...editItem, descricao: value })}
            label="Descricao"
            placeholder="Nome completo do item"
            required
          />

          <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Classe Financeira</label>
                <div className="relative">
                  <input
                    value={classeBusca}
                    onChange={(e) => { setClasseBusca(e.target.value); setClasseDropdownOpen(true) }}
                    onFocus={() => setClasseDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setClasseDropdownOpen(false)
                        if (!editItem.classe_financeira_id) {
                          setClasseBusca('')
                          return
                        }
                        const sel = classes.find((c) => c.id === editItem.classe_financeira_id)
                        setClasseBusca(formatClasseLabel(sel))
                      }, 120)
                    }}
                    placeholder="Digite codigo ou descricao..."
                    className="input-base pr-10"
                  />
                  <ChevronsUpDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {classeDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {classesFiltradas.length > 0 ? (
                        classesFiltradas.map((classe) => (
                          <button
                            key={classe.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); handleClasseChange(classe.id) }}
                            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                              editItem.classe_financeira_id === classe.id ? 'bg-slate-50' : ''
                            }`}
                          >
                            <span className="font-semibold text-slate-700">{classe.codigo}</span>
                            <span className="text-slate-500">{classe.descricao}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">Nenhuma classe encontrada</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Categoria Financeira</label>
                <input
                  value={editItem.categoria_financeira_descricao ?? ''}
                  className="input-base bg-slate-50 text-slate-500"
                  placeholder="Preenchida pela classe"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Grupo de Compra</label>
              <select
                value={editItem.subcategoria ?? ''}
                onChange={(e) => setEditItem({ ...editItem, subcategoria: e.target.value || undefined })}
                className="input-base"
              >
                <option value="">Selecionar grupo...</option>
                {gruposCompra.map((grupo) => (
                  <option key={grupo.id} value={grupo.codigo}>{grupo.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Destino Operacional</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'estoque', label: 'Estoque' },
                  { value: 'patrimonio', label: 'Patrimonio' },
                  { value: 'nenhum', label: 'Nenhum' },
                ].map((opt) => {
                  const active = (editItem.destino_operacional ?? 'estoque') === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditItem({
                        ...editItem,
                        destino_operacional: opt.value as EstItem['destino_operacional'],
                      })}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-teal-500 bg-white text-teal-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">Resumo operacional</p>
              <p className="mt-1 text-xs text-slate-600">
                {editItem.destino_operacional === 'estoque'
                  ? 'Recebimento gera pendencia no estoque.'
                  : editItem.destino_operacional === 'patrimonio'
                    ? 'Recebimento gera pendencia no patrimonial.'
                    : 'Recebimento nao projeta em estoque nem patrimonio.'}
              </p>
            </div>
          </div>

          {editItem.destino_operacional === 'estoque' && (
            <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Parametros de Estoque</p>
                <p className="mt-1 text-xs text-slate-500">
                  Mantidos por compatibilidade operacional para itens que geram estoque.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Curva ABC</label>
                  <select
                    value={editItem.curva_abc ?? 'C'}
                    onChange={(e) => setEditItem({
                      ...editItem,
                      curva_abc: e.target.value as import('../types/estoque').CurvaABC,
                    })}
                    className="input-base"
                  >
                    <option value="A">A - Alta rotatividade</option>
                    <option value="B">B - Media rotatividade</option>
                    <option value="C">C - Baixa rotatividade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Valor Medio R$</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editItem.valor_medio ?? 0}
                    onChange={(e) => setEditItem({ ...editItem, valor_medio: Number(e.target.value) })}
                    className="input-base"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Est. Minimo</label>
                  <input
                    type="number"
                    min={0}
                    value={editItem.estoque_minimo ?? 0}
                    onChange={(e) => setEditItem({ ...editItem, estoque_minimo: Number(e.target.value) })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Est. Maximo</label>
                  <input
                    type="number"
                    min={0}
                    value={editItem.estoque_maximo ?? 0}
                    onChange={(e) => setEditItem({ ...editItem, estoque_maximo: Number(e.target.value) })}
                    className="input-base"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 space-y-3">
          {/* Reject reason input (shown when clicking "Rejeitar") */}
          {showReject && onReject && (
            <div className="flex gap-2">
              <input
                autoFocus
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeicao..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReject()
                  if (e.key === 'Escape') setShowReject(false)
                }}
              />
              <button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {rejecting ? <Loader2 size={13} className="animate-spin" /> : <AlertCircle size={13} />}
                Confirmar
              </button>
              <button
                onClick={() => setShowReject(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="flex justify-between gap-2">
            {/* Left: Rejeitar (only when onReject is provided) */}
            <div>
              {onReject && !showReject && (
                <button
                  onClick={() => setShowReject(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={14} /> Rejeitar
                </button>
              )}
            </div>
            {/* Right: Cancelar + Salvar */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={salvar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
              >
                {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
