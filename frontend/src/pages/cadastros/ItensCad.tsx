import { useState } from 'react'
import { Package2, Plus, Search } from 'lucide-react'
import { useEstoqueItens } from '../../hooks/useEstoque'
import type { EstItem } from '../../types/estoque'
import ItemFormModal from '../../components/ItemFormModal'

const CURVA_COLOR = {
  A: { bg: 'bg-red-100', text: 'text-red-700', label: 'Curva A' },
  B: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Curva B' },
  C: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Curva C' },
}

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

export default function ItensCad() {
  const [busca, setBusca] = useState('')
  const [curvaFiltro, setCurvaFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<EstItem> | null>(null)
  const [modalKey, setModalKey] = useState(0)

  const { data: itens = [], isLoading } = useEstoqueItens(
    curvaFiltro ? { curva: curvaFiltro as 'A' | 'B' | 'C' } : undefined,
  )

  const filtrados = busca.trim()
    ? itens.filter((item) =>
      item.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      item.codigo.toLowerCase().includes(busca.toLowerCase()))
    : itens

  function getGrupoCompraNome(codigo?: string) {
    return itens.find((i) => i.subcategoria === codigo)?.subcategoria ?? codigo ?? ''
  }

  function openNew() {
    setEditItem({ ...EMPTY })
    setModalKey((k) => k + 1)
    setShowForm(true)
  }

  function openEdit(item: EstItem) {
    setEditItem({ ...item })
    setModalKey((k) => k + 1)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Catalogo de Itens</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtrados.length} itens</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Novo Item
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por codigo ou descricao..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </div>
        {(['', 'A', 'B', 'C'] as const).map((curva) => (
          <button
            key={curva}
            onClick={() => setCurvaFiltro(curva)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              curvaFiltro === curva
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            {curva === '' ? 'Todos' : `Curva ${curva}`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package2 size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Codigo</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descricao</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest hidden md:table-cell">Curva</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Medio</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map((item) => {
                const curva = CURVA_COLOR[item.curva_abc] || CURVA_COLOR.C
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 truncate max-w-[200px]">{item.descricao}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {item.subcategoria && (
                          <span className="text-[10px] text-slate-500">{getGrupoCompraNome(item.subcategoria)}</span>
                        )}
                        {item.categoria_financeira_descricao && (
                          <span className="text-[10px] text-slate-400">{item.categoria_financeira_descricao}</span>
                        )}
                        {item.destino_operacional && (
                          <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                            {item.destino_operacional === 'estoque'
                              ? 'Gera estoque'
                              : item.destino_operacional === 'patrimonio'
                                ? 'Gera patrimonio'
                                : 'Sem projecao'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 ${curva.bg} ${curva.text}`}>
                        {curva.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-700">
                        {(item.valor_medio ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(item)} className="text-[10px] text-violet-600 font-semibold hover:underline">
                        Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ItemFormModal
        key={modalKey}
        open={showForm && !!editItem}
        initialData={editItem ?? undefined}
        onClose={closeForm}
      />
    </div>
  )
}
