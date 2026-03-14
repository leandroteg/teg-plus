import { useState } from 'react'
import { Package2, Plus, Search, X, Save, Loader2, ChevronsUpDown } from 'lucide-react'
import { useEstoqueItens, useSalvarItem } from '../../hooks/useEstoque'
import { useCadClasses } from '../../hooks/useCadastros'
import type { EstItem } from '../../types/estoque'
import AutoCodeField from '../../components/AutoCodeField'
import SmartTextField from '../../components/SmartTextField'

const UNIDADES = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']
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
  const [classeBusca, setClasseBusca] = useState('')
  const [classeDropdownOpen, setClasseDropdownOpen] = useState(false)

  const { data: itens = [], isLoading } = useEstoqueItens(
    curvaFiltro ? { curva: curvaFiltro as 'A' | 'B' | 'C' } : undefined,
  )
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const salvar = useSalvarItem()

  const filtrados = busca.trim()
    ? itens.filter((item) =>
      item.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      item.codigo.toLowerCase().includes(busca.toLowerCase()))
    : itens

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

  function openNew() {
    setEditItem({ ...EMPTY })
    setClasseBusca('')
    setClasseDropdownOpen(false)
    setShowForm(true)
  }

  function openEdit(item: EstItem) {
    setEditItem({ ...item })
    setClasseBusca(
      item.classe_financeira_codigo && item.classe_financeira_descricao
        ? `${item.classe_financeira_codigo} - ${item.classe_financeira_descricao}`
        : item.classe_financeira_descricao || item.classe_financeira_codigo || ''
    )
    setClasseDropdownOpen(false)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
    setClasseBusca('')
    setClasseDropdownOpen(false)
  }

  function handleClasseChange(classeId: string) {
    if (!editItem) return
    const classe = classes.find((item) => item.id === classeId)
    setClasseBusca(formatClasseLabel(classe))
    setClasseDropdownOpen(false)
    setEditItem({
      ...editItem,
      classe_financeira_id: classe?.id || undefined,
      classe_financeira_codigo: classe?.codigo || '',
      classe_financeira_descricao: classe?.descricao || '',
      categoria_financeira_codigo: classe?.categoria?.codigo || '',
      categoria_financeira_descricao: classe?.categoria?.descricao || '',
      // Compatibilidade temporaria com o catalogo legado de estoque.
      categoria: classe?.categoria?.descricao || editItem.categoria || '',
    })
  }

  async function handleSave() {
    if (!editItem) return
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
    closeForm()
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

      {showForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">{editItem.id ? 'Editar Item' : 'Novo Item'}</h2>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
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
                    onChange={(event) => setEditItem({
                      ...editItem,
                      unidade: event.target.value as import('../../types/estoque').UnidadeEstoque,
                    })}
                    className="input-base"
                  >
                    {UNIDADES.map((unidade) => <option key={unidade}>{unidade}</option>)}
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
                        onChange={(event) => {
                          setClasseBusca(event.target.value)
                          setClasseDropdownOpen(true)
                        }}
                        onFocus={() => setClasseDropdownOpen(true)}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setClasseDropdownOpen(false)
                            if (!editItem.classe_financeira_id) {
                              setClasseBusca('')
                              return
                            }
                            const selecionada = classes.find((item) => item.id === editItem.classe_financeira_id)
                            setClasseBusca(formatClasseLabel(selecionada))
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
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  handleClasseChange(classe.id)
                                }}
                                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                                  editItem.classe_financeira_id === classe.id ? 'bg-slate-50' : ''
                                }`}
                              >
                                <span className="font-semibold text-slate-700">{classe.codigo}</span>
                                <span className="text-slate-500">{classe.descricao}</span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-slate-500">
                              Nenhuma classe encontrada
                            </div>
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
                  <label className="block text-xs font-bold text-slate-600 mb-1">Destino Operacional</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'estoque', label: 'Estoque' },
                      { value: 'patrimonio', label: 'Patrimonio' },
                      { value: 'nenhum', label: 'Nenhum' },
                    ].map((option) => {
                      const active = (editItem.destino_operacional ?? 'estoque') === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setEditItem({
                            ...editItem,
                            destino_operacional: option.value as EstItem['destino_operacional'],
                          })}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              active
                                ? 'border-teal-500 bg-white text-teal-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {option.label}
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Parametros de Estoque</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Mantidos por compatibilidade operacional para itens que geram estoque.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Curva ABC</label>
                      <select
                        value={editItem.curva_abc ?? 'C'}
                        onChange={(event) => setEditItem({
                          ...editItem,
                          curva_abc: event.target.value as import('../../types/estoque').CurvaABC,
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
                        onChange={(event) => setEditItem({ ...editItem, valor_medio: Number(event.target.value) })}
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
                        onChange={(event) => setEditItem({ ...editItem, estoque_minimo: Number(event.target.value) })}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Est. Maximo</label>
                      <input
                        type="number"
                        min={0}
                        value={editItem.estoque_maximo ?? 0}
                        onChange={(event) => setEditItem({ ...editItem, estoque_maximo: Number(event.target.value) })}
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={closeForm}
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
      )}
    </div>
  )
}
