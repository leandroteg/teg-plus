import { useState, useRef, useEffect } from 'react'
import { Link2, Loader2, Package, Search, X } from 'lucide-react'
import { useItemCatalogSearchAll } from '../hooks/useEstoque'
import { useVincularItemManual } from '../hooks/useRequisicoes'
import { toUpperNorm } from './UpperInput'
import type { EstItem } from '../types/estoque'

// Pega as primeiras N palavras da descrição livre como busca inicial — evita
// que a marca/modelo no fim do texto (que o catálogo não tem) zere o resultado.
function primeirasPalavras(s: string, n = 3): string {
  return (s || '').trim().split(/\s+/).slice(0, n).join(' ')
}

interface Props {
  riId: string
  descricaoLivre: string
  onDone?: (msg: { type: 'success' | 'error'; msg: string }) => void
}

// Vínculo MANUAL de item órfão de RC a um item do catálogo. O comprador aponta a
// linha para o item certo por busca — sem depender de match de descrição.
export default function VincularItemCatalogo({ riId, descricaoLivre, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState(() => primeirasPalavras(descricaoLivre))
  const wrapRef = useRef<HTMLDivElement>(null)
  const { data: itens = [], isLoading } = useItemCatalogSearchAll(busca)
  const vincular = useVincularItemManual()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function pick(item: EstItem) {
    try {
      await vincular.mutateAsync({ riId, itemId: item.id })
      setOpen(false)
      onDone?.({ type: 'success', msg: `Item vinculado a ${item.codigo} — ${item.descricao}` })
    } catch (e) {
      onDone?.({ type: 'error', msg: (e as Error).message })
    }
  }

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-md border border-orange-300 bg-white text-orange-600 text-[10px] font-bold hover:bg-orange-50 transition-all"
      >
        <Link2 size={11} /> Vincular
      </button>

      {open && (
        <div className="absolute z-50 right-0 top-full mt-1 w-80 bg-white rounded-xl border border-orange-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(toUpperNorm(e.target.value))}
                placeholder="Buscar item do catálogo..."
                className="w-full border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs focus:ring-2 focus:ring-orange-300 outline-none"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {busca.trim().length < 2 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Digite ao menos 2 letras.</p>
            ) : isLoading || vincular.isPending ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> {vincular.isPending ? 'Vinculando…' : 'Buscando…'}
              </p>
            ) : itens.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Nenhum item encontrado.</p>
            ) : (
              itens.map(item => (
                <button
                  key={item.id}
                  disabled={vincular.isPending}
                  onClick={() => pick(item)}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-orange-50 transition-colors flex items-center gap-2 border-b border-slate-50 last:border-0 disabled:opacity-50"
                >
                  <Package size={13} className="text-orange-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-slate-400 shrink-0">{item.codigo}</span>
                      <span className="truncate">{item.descricao}</span>
                    </div>
                    {item.categoria_financeira_descricao && (
                      <span className="text-[10px] text-slate-400 truncate block">{item.categoria_financeira_descricao}</span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 shrink-0">{item.unidade}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
