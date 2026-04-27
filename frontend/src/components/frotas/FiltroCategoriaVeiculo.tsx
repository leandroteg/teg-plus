// ─────────────────────────────────────────────────────────────────────────────
// FiltroCategoriaVeiculo — dropdown padronizado de filtro de categoria
// Usado em: Frotas → Operação (Em Entrada, Pátio, Checklist Saída, Alocados)
// e Obras → Alocação (Kanban, Cronograma — esses ainda têm versão inline).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Filter } from 'lucide-react'
import {
  CATEGORIA_VEICULO,
  CATEGORIA_LABEL,
  CATEGORIA_GRUPO,
  CATEGORIA_GRUPO_LABEL,
  type CategoriaVeiculo,
} from '../../constants/categoriaVeiculo'

interface Props {
  /** Set de categorias selecionadas. Vazio = nenhuma. */
  selecionadas: Set<CategoriaVeiculo>
  onChange: (next: Set<CategoriaVeiculo>) => void
  /** Contagem opcional por categoria (key: categoria → número de itens). Mostrada à direita. */
  contagem?: Record<string, number>
  /** Tema. */
  isLight: boolean
  /** Largura mínima do botão (auto se omitido). */
  className?: string
}

export default function FiltroCategoriaVeiculo({
  selecionadas, onChange, contagem, isLight, className = '',
}: Props) {
  const [open, setOpen] = useState(false)

  const todasSelecionadas = selecionadas.size === CATEGORIA_VEICULO.length

  function toggle(cat: CategoriaVeiculo) {
    const next = new Set(selecionadas)
    if (next.has(cat)) next.delete(cat); else next.add(cat)
    onChange(next)
  }

  function selecionarGrupo(grupo: 'leve' | 'caminhao' | 'maquina' | 'todos') {
    if (grupo === 'todos') onChange(new Set(CATEGORIA_VEICULO))
    else onChange(new Set(CATEGORIA_VEICULO.filter(c => CATEGORIA_GRUPO[c] === grupo)))
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
          <div className={`absolute right-0 mt-1 w-[260px] max-h-[480px] rounded-xl border shadow-xl z-50 overflow-hidden ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.1]'
          }`}>
            <div className={`px-3 py-2 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <p className={`text-xs font-bold mb-1.5 ${txtMain}`}>Atalhos</p>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => selecionarGrupo('todos')} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]'
                }`}>Todos</button>
                <button onClick={() => selecionarGrupo('leve')} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  isLight ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}>Leves</button>
                <button onClick={() => selecionarGrupo('caminhao')} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  isLight ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                }`}>Caminhões</button>
                <button onClick={() => selecionarGrupo('maquina')} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  isLight ? 'bg-violet-50 text-violet-700 hover:bg-violet-100' : 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25'
                }`}>Máquinas</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[360px]">
              {(['leve', 'caminhao', 'maquina'] as const).map(grupo => (
                <div key={grupo}>
                  <p className={`text-[9px] font-bold uppercase tracking-wider px-3 pt-2 pb-1 ${txtMuted}`}>
                    {CATEGORIA_GRUPO_LABEL[grupo]}
                  </p>
                  {CATEGORIA_VEICULO.filter(c => CATEGORIA_GRUPO[c] === grupo).map(c => {
                    const n = contagem?.[c] ?? 0
                    return (
                      <label key={c} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
                        isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.04]'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selecionadas.has(c)}
                          onChange={() => toggle(c)}
                          className="accent-blue-500"
                        />
                        <span className={`text-xs ${txtMain}`}>{CATEGORIA_LABEL[c]}</span>
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
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
