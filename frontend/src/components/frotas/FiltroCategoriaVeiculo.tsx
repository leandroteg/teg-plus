// ─────────────────────────────────────────────────────────────────────────────
// FiltroCategoriaVeiculo — dropdown padronizado de filtro de categoria
// 5 categorias finais (sem subcategorias):
// Leve · Ônibus/Van · Pesados · Guindauto · Máquinas
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Filter } from 'lucide-react'
import {
  CATEGORIA_VEICULO_ATIVAS,
  CATEGORIA_LABEL,
  CATEGORIA_COLOR,
  type CategoriaVeiculo,
} from '../../constants/categoriaVeiculo'

interface Props {
  selecionadas: Set<CategoriaVeiculo>
  onChange: (next: Set<CategoriaVeiculo>) => void
  /** Contagem opcional por categoria (key: categoria → número de itens). */
  contagem?: Record<string, number>
  isLight: boolean
  className?: string
}

export default function FiltroCategoriaVeiculo({
  selecionadas, onChange, contagem, isLight, className = '',
}: Props) {
  const [open, setOpen] = useState(false)

  const todasSelecionadas = selecionadas.size === CATEGORIA_VEICULO_ATIVAS.length

  function toggle(cat: CategoriaVeiculo) {
    const next = new Set(selecionadas)
    if (next.has(cat)) next.delete(cat); else next.add(cat)
    onChange(next)
  }

  const txtMain  = isLight ? 'text-slate-800' : 'text-white'
  const txtMuted = isLight ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            : 'bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08]'
        }`}
      >
        <Filter size={13} />
        Filtrar tipos
        {!todasSelecionadas && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold">
            {selecionadas.size}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 mt-1 w-[240px] rounded-xl border shadow-xl z-50 overflow-hidden ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.1]'
          }`}>
            {/* Marcar todos / Limpar */}
            <div className={`px-3 py-2 border-b flex items-center justify-between ${
              isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.06] bg-white/[0.02]'
            }`}>
              <p className={`text-xs font-bold ${txtMain}`}>
                {selecionadas.size}/{CATEGORIA_VEICULO_ATIVAS.length}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => onChange(new Set(CATEGORIA_VEICULO_ATIVAS))}
                  className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${
                    isLight ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-500 text-white hover:bg-blue-400'
                  }`}
                >
                  Marcar todos
                </button>
                <button
                  onClick={() => onChange(new Set())}
                  className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                    isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]'
                  }`}
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Lista flat das 5 categorias */}
            <div>
              {CATEGORIA_VEICULO_ATIVAS.map(c => {
                const n = contagem?.[c] ?? 0
                const cor = CATEGORIA_COLOR[c]
                return (
                  <label key={c} className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.04]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selecionadas.has(c)}
                      onChange={() => toggle(c)}
                      className="accent-blue-500"
                    />
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      isLight ? cor.lightBg.replace('-50', '-500') : cor.darkBg.replace('/15', '')
                    }`} />
                    <span className={`text-xs font-semibold ${txtMain}`}>{CATEGORIA_LABEL[c]}</span>
                    {contagem !== undefined && (
                      <span className={`ml-auto text-[10px] font-mono ${
                        n > 0 ? txtMain : txtMuted
                      }`}>
                        {n}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
