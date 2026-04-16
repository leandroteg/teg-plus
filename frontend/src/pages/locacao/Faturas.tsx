import { useState, useMemo } from 'react'
import { FileText, Search, X } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useImoveis, useFaturas, useCriarFatura, useAtualizarFatura } from '../../hooks/useLocacao'
import type { TipoFatura, StatusFatura, LocFatura, LocImovel } from '../../types/locacao'
import { TIPO_FATURA_LABEL, STATUS_FATURA_LABEL } from '../../types/locacao'

// ── Constants ────────────────────────────────────────────────────────────────

const TIPOS: TipoFatura[] = ['energia', 'agua', 'internet', 'iptu', 'condominio', 'limpeza', 'seguro', 'caucao']

const STATUS_OPTS: { value: StatusFatura | ''; label: string }[] = [
  { value: '',                  label: 'Todos' },
  { value: 'previsto',          label: 'Previsto' },
  { value: 'lancado',           label: 'Lancado' },
  { value: 'enviado_pagamento', label: 'Enviado Pgto' },
  { value: 'pago',              label: 'Pago' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

function buildCompetenciaOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

const COMPETENCIA_OPTS = buildCompetenciaOptions()

// ── Cell Component ───────────────────────────────────────────────────────────

function FaturaCell({ fatura, isDark, onClick }: { fatura: LocFatura | null; isDark: boolean; onClick: () => void }) {
  if (!fatura) return (
    <td
      onClick={onClick}
      className={`cursor-pointer text-center px-2 py-2 ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-teal-50/50'}`}
    >
      <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>—</span>
    </td>
  )
  const isOverdue = fatura.vencimento && new Date(fatura.vencimento + 'T00:00:00') < new Date() && fatura.status !== 'pago'
  const stCfg = STATUS_FATURA_LABEL[fatura.status]
  return (
    <td
      onClick={onClick}
      className={`cursor-pointer px-2 py-2 text-center ${
        isOverdue
          ? isDark ? 'bg-red-500/10' : 'bg-red-50'
          : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
      }`}
    >
      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {fmtCurrency(fatura.valor_confirmado || fatura.valor_previsto)}
      </p>
      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold ${stCfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
        {stCfg.label}
      </span>
    </td>
  )
}

// ── Modal Component ──────────────────────────────────────────────────────────

interface ModalState {
  imovel: LocImovel
  tipo: TipoFatura
  fatura: LocFatura | null
}

function FaturaModal({
  modal,
  competencia,
  isDark,
  onClose,
}: {
  modal: ModalState
  competencia: string
  isDark: boolean
  onClose: () => void
}) {
  const criarFatura = useCriarFatura()
  const atualizarFatura = useAtualizarFatura()
  const isEdit = !!modal.fatura?.id

  const [vencimento, setVencimento] = useState(modal.fatura?.vencimento ?? '')
  const [valorPrevisto, setValorPrevisto] = useState<string>(modal.fatura?.valor_previsto?.toString() ?? '')
  const [valorConfirmado, setValorConfirmado] = useState<string>(modal.fatura?.valor_confirmado?.toString() ?? '')
  const [status, setStatus] = useState<StatusFatura>(modal.fatura?.status ?? 'previsto')
  const [descricao, setDescricao] = useState(modal.fatura?.descricao ?? '')

  const saving = criarFatura.isPending || atualizarFatura.isPending

  const handleSave = () => {
    const payload: Partial<LocFatura> = {
      vencimento: vencimento || undefined,
      valor_previsto: valorPrevisto ? parseFloat(valorPrevisto) : undefined,
      valor_confirmado: valorConfirmado ? parseFloat(valorConfirmado) : undefined,
      status,
      descricao: descricao || undefined,
    }

    if (isEdit) {
      atualizarFatura.mutate({ id: modal.fatura!.id, ...payload }, { onSuccess: onClose })
    } else {
      criarFatura.mutate(
        { imovel_id: modal.imovel.id, tipo: modal.tipo, competencia: competencia + '-01', ...payload },
        { onSuccess: onClose },
      )
    }
  }

  const bg = isDark ? 'bg-[#1e1e2e]' : 'bg-white'
  const border = isDark ? 'border-white/10' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm outline-none ${
    isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
  }`

  const endereco = [modal.imovel.endereco, modal.imovel.numero].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${bg} ${border}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div>
            <h3 className={`text-sm font-bold ${txt}`}>
              {TIPO_FATURA_LABEL[modal.tipo]} — {modal.imovel.descricao}
            </h3>
            {endereco && <p className={`text-xs mt-0.5 ${txtMuted}`}>{endereco}</p>}
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={16} className={txtMuted} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={`text-xs font-semibold ${txtMuted}`}>Vencimento</label>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold ${txtMuted}`}>Valor Previsto</label>
              <input type="number" step="0.01" value={valorPrevisto} onChange={e => setValorPrevisto(e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={`text-xs font-semibold ${txtMuted}`}>Valor Confirmado</label>
              <input type="number" step="0.01" value={valorConfirmado} onChange={e => setValorConfirmado(e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold ${txtMuted}`}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as StatusFatura)} className={inputCls}>
              <option value="previsto">Previsto</option>
              <option value="lancado">Lancado</option>
              <option value="enviado_pagamento">Enviado Pagamento</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div>
            <label className={`text-xs font-semibold ${txtMuted}`}>Descricao</label>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} className={inputCls} placeholder="Opcional" />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${border}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Faturas() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: imoveis = [], isLoading: loadingImoveis } = useImoveis()
  const { data: faturas = [], isLoading: loadingFaturas } = useFaturas()

  const [search, setSearch] = useState('')
  const [competencia, setCompetencia] = useState(COMPETENCIA_OPTS[0].value)
  const [statusFilter, setStatusFilter] = useState<StatusFatura | ''>('')
  const [editModal, setEditModal] = useState<ModalState | null>(null)

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // Filter imoveis by search
  const filteredImoveis = useMemo(() => {
    if (!search) return imoveis
    const q = search.toLowerCase()
    return imoveis.filter(imo =>
      imo.descricao?.toLowerCase().includes(q) ||
      imo.endereco?.toLowerCase().includes(q) ||
      imo.cidade?.toLowerCase().includes(q)
    )
  }, [imoveis, search])

  // Build grid: each row = imovel, columns = tipos
  const grid = useMemo(() => {
    return filteredImoveis.map(imo => {
      const row: Record<string, LocFatura | null> = {}
      TIPOS.forEach(tipo => {
        row[tipo] = faturas.find(f =>
          f.imovel_id === imo.id &&
          f.tipo === tipo &&
          f.competencia?.startsWith(competencia)
        ) || null
      })
      return { imovel: imo, faturas: row }
    })
  }, [filteredImoveis, faturas, competencia])

  // Filter grid rows by status if selected
  const filteredGrid = useMemo(() => {
    if (!statusFilter) return grid
    return grid.filter(row =>
      TIPOS.some(tipo => {
        const f = row.faturas[tipo]
        return f && f.status === statusFilter
      })
    )
  }, [grid, statusFilter])

  const isLoading = loadingImoveis || loadingFaturas

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Faturas</h1>
        <p className={`text-xs ${txtMuted}`}>Visao consolidada de contas por imovel</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px]
          ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar imovel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none
              ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>

        {/* Competencia */}
        <select
          value={competencia}
          onChange={e => setCompetencia(e.target.value)}
          className={`text-xs rounded-xl border px-3 py-2 outline-none font-semibold
            ${isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          {COMPETENCIA_OPTS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isDark
                  ? 'border-white/10 text-slate-400 hover:border-white/20'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Counter */}
      <p className={`text-xs ${txtMuted}`}>
        {filteredGrid.length} imovel(is) — {TIPOS.length} tipos de conta
      </p>

      {/* Grid */}
      {filteredGrid.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum imovel encontrado</p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden
          ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50'}`}>
                  <th className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 sticky left-0 z-10 min-w-[180px]
                    ${isDark ? 'bg-[#1a1a2e] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                    Imovel
                  </th>
                  {TIPOS.map(tipo => (
                    <th key={tipo} className={`text-center text-[10px] font-bold uppercase tracking-wider px-2 py-3 min-w-[90px] ${txtMuted}`}>
                      {TIPO_FATURA_LABEL[tipo]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGrid.map(row => {
                  const addr = [row.imovel.endereco, row.imovel.numero].filter(Boolean).join(', ')
                  return (
                    <tr
                      key={row.imovel.id}
                      className={`border-b ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}
                    >
                      <td className={`px-4 py-2 sticky left-0 z-10 min-w-[180px]
                        ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'}`}>
                        <p className={`text-xs font-semibold truncate max-w-[160px] ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {row.imovel.descricao}
                        </p>
                        {(addr || row.imovel.cidade) && (
                          <p className={`text-[10px] truncate max-w-[160px] ${txtMuted}`}>
                            {[addr, row.imovel.cidade].filter(Boolean).join(' - ')}
                          </p>
                        )}
                      </td>
                      {TIPOS.map(tipo => (
                        <FaturaCell
                          key={tipo}
                          fatura={row.faturas[tipo]}
                          isDark={isDark}
                          onClick={() => setEditModal({ imovel: row.imovel, tipo, fatura: row.faturas[tipo] })}
                        />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {editModal && (
        <FaturaModal
          modal={editModal}
          competencia={competencia}
          isDark={isDark}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}
