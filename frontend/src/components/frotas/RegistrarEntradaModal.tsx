import { useState, useMemo } from 'react'
import { X, LogIn, Loader2, Car, Cog, Search } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSalvarVeiculo, useVeiculos } from '../../hooks/useFrotas'
import type { FroVeiculo } from '../../types/frotas'

interface Props {
  onClose: () => void
}

export default function RegistrarEntradaModal({ onClose }: Props) {
  const { isDark } = useTheme()
  const salvar = useSalvarVeiculo()

  // Busca veículos que podem retornar (em_uso, em_manutencao, bloqueado, aguardando_saida)
  const { data: todosVeiculos = [], isLoading } = useVeiculos()

  const veiculosRetorno = useMemo(
    () => todosVeiculos.filter(v =>
      v.status === 'em_uso' || v.status === 'em_manutencao' || v.status === 'bloqueado' || v.status === 'aguardando_saida'
    ),
    [todosVeiculos],
  )

  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState<FroVeiculo | null>(null)
  const [observacoes, setObservacoes] = useState('')

  const filtrados = useMemo(() => {
    if (!busca.trim()) return veiculosRetorno
    const term = busca.toLowerCase()
    return veiculosRetorno.filter(v =>
      v.placa?.toLowerCase().includes(term) ||
      v.marca?.toLowerCase().includes(term) ||
      v.modelo?.toLowerCase().includes(term) ||
      v.numero_serie?.toLowerCase().includes(term)
    )
  }, [veiculosRetorno, busca])

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'

  const STATUS_LABEL: Record<string, string> = {
    em_uso: 'Em Uso',
    em_manutencao: 'Em Manutenção',
    bloqueado: 'Bloqueado',
    aguardando_saida: 'Aguardando Saída',
  }

  const STATUS_COLOR: Record<string, string> = {
    em_uso: isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700',
    em_manutencao: isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700',
    bloqueado: isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700',
    aguardando_saida: isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-700',
  }

  const handleConfirmar = async () => {
    if (!selected) return
    try {
      await salvar.mutateAsync({
        id: selected.id,
        status: 'em_entrada' as any,
        observacoes: observacoes.trim() || selected.observacoes || undefined,
      })
      onClose()
    } catch (err) {
      console.error('[RegistrarEntradaModal] Erro:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-lg mx-4 max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
              <LogIn size={16} className="text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${txt}`}>Registrar Retorno</h3>
              <p className={`text-[11px] ${txtMuted}`}>Selecione o veículo que está retornando à frota</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Search */}
        <div className={`px-5 py-3 border-b shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="relative">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${txtMuted}`} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por placa, marca, modelo..."
              className={`w-full text-sm rounded-xl pl-9 pr-3 py-2 border outline-none transition-colors ${inputCls}`}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-rose-500" />
            </div>
          )}

          {!isLoading && filtrados.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {busca ? 'Nenhum veículo encontrado' : 'Nenhum veículo disponível para retorno'}
              </p>
              <p className={`text-xs mt-1 ${txtMuted}`}>
                {busca ? 'Tente outra busca' : 'Apenas veículos em uso, manutenção ou bloqueados podem retornar'}
              </p>
            </div>
          )}

          {filtrados.map(v => {
            const isMaquina = v.tipo_ativo === 'maquina'
            const identificador = isMaquina && v.numero_serie ? v.numero_serie : v.placa
            const isSelected = selected?.id === v.id
            return (
              <button
                key={v.id}
                onClick={() => setSelected(isSelected ? null : v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? isDark
                      ? 'border-rose-500/40 bg-rose-500/10 ring-1 ring-rose-500/30'
                      : 'border-rose-300 bg-rose-50 ring-1 ring-rose-200'
                    : isDark
                      ? 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isMaquina
                    ? (isDark ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600')
                    : (isDark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600')
                }`}>
                  {isMaquina ? <Cog size={16} /> : <Car size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {identificador}
                  </p>
                  <p className={`text-xs truncate ${txtMuted}`}>
                    {v.marca} {v.modelo}{v.ano_mod ? ` ${v.ano_mod}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[v.status] || ''}`}>
                  {STATUS_LABEL[v.status] || v.status}
                </span>
              </button>
            )
          })}
        </div>

        {/* Observações + Footer (visible when selected) */}
        {selected && (
          <div className={`shrink-0 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <div className="px-5 pt-3">
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Motivo / Observações</label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Retorno de obra, fim de locação, devolvido pelo motorista..."
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`}
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4">
              <button
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
                  isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={salvar.isPending}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30 transition-all ${salvar.isPending ? 'opacity-50' : ''}`}
              >
                {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                Registrar Retorno
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
