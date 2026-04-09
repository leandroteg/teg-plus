import { useState } from 'react'
import { X, LogIn, Loader2, Car, Cog } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useSalvarVeiculo, useVeiculos } from '../../hooks/useFrotas'
import type { FroVeiculo, CategoriaVeiculo, CombustivelVeiculo, PropriedadeVeiculo, TipoAtivo } from '../../types/frotas'

const CATEGORIAS: { value: CategoriaVeiculo; label: string }[] = [
  { value: 'passeio', label: 'Passeio' },
  { value: 'pickup',  label: 'Pickup' },
  { value: 'van',     label: 'Van' },
  { value: 'vuc',     label: 'VUC' },
  { value: 'truck',   label: 'Truck' },
  { value: 'carreta', label: 'Carreta' },
  { value: 'moto',    label: 'Moto' },
  { value: 'onibus',  label: 'Ônibus' },
]

const COMBUSTIVEIS: { value: CombustivelVeiculo; label: string }[] = [
  { value: 'flex',      label: 'Flex' },
  { value: 'gasolina',  label: 'Gasolina' },
  { value: 'diesel',    label: 'Diesel' },
  { value: 'etanol',    label: 'Etanol' },
  { value: 'eletrico',  label: 'Elétrico' },
  { value: 'gnv',       label: 'GNV' },
]

const PROPRIEDADES: { value: PropriedadeVeiculo; label: string }[] = [
  { value: 'propria', label: 'Própria' },
  { value: 'locada',  label: 'Locada' },
  { value: 'cedida',  label: 'Cedida' },
]

interface Props {
  onClose: () => void
}

export default function RegistrarEntradaModal({ onClose }: Props) {
  const { isDark } = useTheme()
  const salvar = useSalvarVeiculo()

  const [tipoAtivo, setTipoAtivo] = useState<TipoAtivo>('veiculo')
  const [placa, setPlaca] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [anoFab, setAnoFab] = useState('')
  const [anoMod, setAnoMod] = useState('')
  const [categoria, setCategoria] = useState<CategoriaVeiculo>('passeio')
  const [combustivel, setCombustivel] = useState<CombustivelVeiculo>('flex')
  const [propriedade, setPropriedade] = useState<PropriedadeVeiculo>('propria')
  const [hodometro, setHodometro] = useState('')
  const [numeroSerie, setNumeroSerie] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'

  const isVeiculo = tipoAtivo === 'veiculo'
  const canSubmit = isVeiculo ? placa.trim() && marca.trim() && modelo.trim() : numeroSerie.trim() && marca.trim() && modelo.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return

    const payload: Partial<FroVeiculo> = {
      tipo_ativo: tipoAtivo,
      placa: isVeiculo ? placa.trim().toUpperCase() : `MAQ-${Date.now().toString(36).toUpperCase()}`,
      marca: marca.trim(),
      modelo: modelo.trim(),
      ano_fab: anoFab ? Number(anoFab) : undefined,
      ano_mod: anoMod ? Number(anoMod) : undefined,
      categoria,
      combustivel,
      propriedade,
      hodometro_atual: hodometro ? Number(hodometro) : 0,
      numero_serie: numeroSerie.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      status: 'em_entrada' as any,
    }

    try {
      await salvar.mutateAsync(payload)
      onClose()
    } catch (err) {
      console.error('[RegistrarEntradaModal] Erro ao salvar:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-lg mx-4 max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
              <LogIn size={16} className="text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${txt}`}>Registrar Entrada</h3>
              <p className={`text-[11px] ${txtMuted}`}>Novo ativo entrando na frota</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Tipo ativo */}
          <div className="flex gap-2">
            <button
              onClick={() => setTipoAtivo('veiculo')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                isVeiculo
                  ? isDark ? 'border-rose-500/40 bg-rose-500/15 text-rose-300' : 'border-rose-300 bg-rose-50 text-rose-700'
                  : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
              }`}
            >
              <Car size={15} /> Veículo
            </button>
            <button
              onClick={() => setTipoAtivo('maquina')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                !isVeiculo
                  ? isDark ? 'border-violet-500/40 bg-violet-500/15 text-violet-300' : 'border-violet-300 bg-violet-50 text-violet-700'
                  : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
              }`}
            >
              <Cog size={15} /> Máquina
            </button>
          </div>

          {/* Placa / Num Serie */}
          <div className="grid grid-cols-2 gap-3">
            {isVeiculo ? (
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Placa *</label>
                <input
                  value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  maxLength={7}
                  className={`w-full text-sm font-bold uppercase rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
                />
              </div>
            ) : (
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Nº Série *</label>
                <input
                  value={numeroSerie} onChange={e => setNumeroSerie(e.target.value)}
                  placeholder="SN-00000"
                  className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
                />
              </div>
            )}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Hodômetro (km)</label>
              <input
                type="number" inputMode="numeric"
                value={hodometro} onChange={e => setHodometro(e.target.value)}
                placeholder="0"
                className={`w-full text-sm tabular-nums rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
          </div>

          {/* Marca / Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Marca *</label>
              <input
                value={marca} onChange={e => setMarca(e.target.value)}
                placeholder="Toyota, Volvo..."
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Modelo *</label>
              <input
                value={modelo} onChange={e => setModelo(e.target.value)}
                placeholder="Hilux, FH 540..."
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
          </div>

          {/* Ano Fab / Ano Mod */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Ano Fab.</label>
              <input
                type="number" inputMode="numeric"
                value={anoFab} onChange={e => setAnoFab(e.target.value)}
                placeholder="2024"
                className={`w-full text-sm tabular-nums rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Ano Mod.</label>
              <input
                type="number" inputMode="numeric"
                value={anoMod} onChange={e => setAnoMod(e.target.value)}
                placeholder="2025"
                className={`w-full text-sm tabular-nums rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>
          </div>

          {/* Categoria / Combustível / Propriedade */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Categoria</label>
              <select
                value={categoria} onChange={e => setCategoria(e.target.value as CategoriaVeiculo)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              >
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Combustível</label>
              <select
                value={combustivel} onChange={e => setCombustivel(e.target.value as CombustivelVeiculo)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              >
                {COMBUSTIVEIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Propriedade</label>
              <select
                value={propriedade} onChange={e => setPropriedade(e.target.value as PropriedadeVeiculo)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              >
                {PROPRIEDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Observações</label>
            <textarea
              rows={2}
              value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Detalhes da entrada, procedência, condição..."
              className={`w-full text-sm rounded-xl px-3 py-2 border outline-none resize-none ${inputCls}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
              isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || salvar.isPending}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              canSubmit
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
                : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-400'
            } ${salvar.isPending ? 'opacity-50' : ''}`}
          >
            {salvar.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            Registrar Entrada
          </button>
        </div>
      </div>
    </div>
  )
}
