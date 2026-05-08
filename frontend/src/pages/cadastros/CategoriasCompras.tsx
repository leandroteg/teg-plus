import { useState, useMemo } from 'react'
import {
  ShoppingCart, Search, Pencil, X, Save, Loader2,
  CheckCircle2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Users, ShieldCheck, Receipt, FileText, Tag,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { UpperInput } from '../../components/UpperInput'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CotacoesRegras {
  ate_500:   number
  '501_a_2k': number
  acima_2k:  number
}

interface Categoria {
  id:               string
  codigo:           string
  nome:             string
  tipo:             string
  ativo:            boolean
  comprador_nome:   string | null
  alcada1_aprovador:string | null
  alcada1_limite:   number
  cotacoes_regras:  CotacoesRegras
  politica_resumo:  string | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useCategoriasCompras() {
  return useQuery<Categoria[]>({
    queryKey: ['admin-categorias-compras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_categorias')
        .select('id, codigo, nome, tipo, ativo, comprador_nome, alcada1_aprovador, alcada1_limite, cotacoes_regras, politica_resumo')
        .order('nome')
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
    staleTime: 30_000,
  })
}

function useSalvarCategoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cat: Partial<Categoria> & { id: string }) => {
      const { id, ...payload } = cat
      const { error } = await supabase.from('cmp_categorias').update(payload).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categorias-compras'] })
      qc.invalidateQueries({ queryKey: ['categorias'] })
    },
  })
}

// ── Form de edição ────────────────────────────────────────────────────────────

function EditDrawer({ cat, compradores, onClose }: {
  cat: Categoria
  compradores: string[]
  onClose: () => void
}) {
  const salvar = useSalvarCategoria()

  const [comprador,  setComprador]  = useState(cat.comprador_nome ?? '')
  const [aprovador,  setAprovador]  = useState(cat.alcada1_aprovador ?? '')
  const [limite,     setLimite]     = useState(cat.alcada1_limite?.toString() ?? '3000')
  const [regAte500,  setRegAte500]  = useState(cat.cotacoes_regras?.ate_500?.toString() ?? '1')
  const [reg501_2k,  setReg501_2k]  = useState(cat.cotacoes_regras?.['501_a_2k']?.toString() ?? '2')
  const [regAcima,   setRegAcima]   = useState(cat.cotacoes_regras?.acima_2k?.toString() ?? '3')
  const [politica,   setPolitica]   = useState(cat.politica_resumo ?? '')
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await salvar.mutateAsync({
      id:                cat.id,
      comprador_nome:    comprador || null,
      alcada1_aprovador: aprovador || null,
      alcada1_limite:    parseFloat(limite) || 0,
      cotacoes_regras: {
        ate_500:   parseInt(regAte500)  || 1,
        '501_a_2k': parseInt(reg501_2k) || 2,
        acima_2k:  parseInt(regAcima)  || 3,
      },
      politica_resumo: politica || null,
    })
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div>
            <p className="text-sm font-bold text-slate-800">{cat.nome}</p>
            <p className="text-[11px] text-slate-400">{cat.codigo} · {cat.tipo === 'servico' ? 'Serviço' : 'Produto'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Comprador */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <Users size={12} className="text-teal-500" /> Comprador responsável
            </label>
            <input
              list="compradores-list"
              value={comprador}
              onChange={e => setComprador(e.target.value)}
              placeholder="Nome do comprador"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
            />
            <datalist id="compradores-list">
              {compradores.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Alçada */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} className="text-violet-500" /> Alçada de Aprovação
              </p>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Aprovador</label>
                <input
                  value={aprovador}
                  onChange={e => setAprovador(e.target.value)}
                  placeholder="Nome do aprovador"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Limite (R$) — acima vai para diretoria
                </label>
                <input
                  type="number" min="0" step="100"
                  value={limite}
                  onChange={e => setLimite(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {parseFloat(limite) === 0 && (
                  <p className="text-[10px] text-amber-500 mt-0.5">Limite 0 = sempre vai para diretoria</p>
                )}
              </div>
            </div>
          </div>

          {/* Cotações mínimas */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Receipt size={11} className="text-blue-500" /> Cotações mínimas por faixa de valor
              </p>
            </div>
            <div className="p-3 grid grid-cols-3 gap-3">
              {[
                { label: '≤ R$500', value: regAte500, set: setRegAte500 },
                { label: 'R$501–R$2k', value: reg501_2k, set: setReg501_2k },
                { label: '> R$2k', value: regAcima, set: setRegAcima },
              ].map(({ label, value, set }) => (
                <div key={label} className="text-center">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">{label}</label>
                  <input
                    type="number" min="1" max="10" step="1"
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="w-full text-center text-sm font-bold border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Política */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <FileText size={12} className="text-slate-400" /> Política resumida
            </label>
            <textarea
              value={politica}
              onChange={e => setPolitica(e.target.value)}
              rows={4}
              placeholder="Descreva a política de compras desta categoria..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 py-4 bg-white border-t border-slate-100">
          {salvar.isError && (
            <p className="text-xs text-red-600 mb-2">Erro ao salvar. Tente novamente.</p>
          )}
          <button
            onClick={handleSave}
            disabled={salvar.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {salvar.isPending
              ? <Loader2 size={15} className="animate-spin" />
              : saved
                ? <CheckCircle2 size={15} />
                : <Save size={15} />
            }
            {salvar.isPending ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Linha da tabela ───────────────────────────────────────────────────────────

function CatRow({ cat, compradores, onEdit, onToggle }: {
  cat: Categoria
  compradores: string[]
  onEdit: (cat: Categoria) => void
  onToggle: (cat: Categoria) => void
}) {
  const salvar = useSalvarCategoria()

  return (
    <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!cat.ativo ? 'opacity-50' : ''}`}>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{cat.nome}</p>
          <p className="text-[10px] text-slate-400">{cat.codigo}</p>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.tipo === 'servico' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {cat.tipo === 'servico' ? 'Serviço' : 'Produto'}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700 font-medium">
        {cat.comprador_nome ?? <span className="text-slate-300 italic text-xs">não definido</span>}
      </td>
      <td className="px-3 py-3">
        <div className="text-sm text-slate-700">{cat.alcada1_aprovador ?? <span className="text-slate-300 italic text-xs">—</span>}</div>
        <div className="text-[10px] text-slate-400">
          {cat.alcada1_limite === 0
            ? 'Sempre diretoria'
            : `até ${Number(cat.alcada1_limite).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}`
          }
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold">{cat.cotacoes_regras?.ate_500 ?? 1}</span>
          <span className="text-slate-300">/</span>
          <span className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold">{cat.cotacoes_regras?.['501_a_2k'] ?? 2}</span>
          <span className="text-slate-300">/</span>
          <span className="px-1.5 py-0.5 bg-slate-100 rounded font-semibold">{cat.cotacoes_regras?.acima_2k ?? 3}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(cat)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onToggle(cat)}
            disabled={salvar.isPending}
            className={`p-1.5 rounded-lg transition-colors ${cat.ativo ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
            title={cat.ativo ? 'Desativar' : 'Ativar'}
          >
            {cat.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CategoriasCompras() {
  const { data: categorias = [], isLoading } = useCategoriasCompras()
  const salvar = useSalvarCategoria()

  const [busca, setBusca]       = useState('')
  const [editCat, setEditCat]   = useState<Categoria | null>(null)
  const [showInativas, setShowInativas] = useState(false)
  const [sortCol, setSortCol]   = useState<'nome' | 'comprador' | 'aprovador'>('nome')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')

  // Lista de compradores únicos para datalist
  const compradores = useMemo(() => {
    const nomes = categorias.map(c => c.comprador_nome).filter(Boolean) as string[]
    return [...new Set(nomes)].sort()
  }, [categorias])

  const filtered = useMemo(() => {
    let list = categorias.filter(c => showInativas ? true : c.ativo)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        (c.comprador_nome ?? '').toLowerCase().includes(q) ||
        (c.alcada1_aprovador ?? '').toLowerCase().includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      const va = sortCol === 'nome' ? a.nome : sortCol === 'comprador' ? (a.comprador_nome ?? '') : (a.alcada1_aprovador ?? '')
      const vb = sortCol === 'nome' ? b.nome : sortCol === 'comprador' ? (b.comprador_nome ?? '') : (b.alcada1_aprovador ?? '')
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return list
  }, [categorias, busca, showInativas, sortCol, sortDir])

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const handleToggle = async (cat: Categoria) => {
    await salvar.mutateAsync({ id: cat.id, ativo: !cat.ativo })
  }

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col
      ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : <ChevronDown size={12} className="opacity-30" />

  const ativas   = categorias.filter(c => c.ativo).length
  const inativas = categorias.filter(c => !c.ativo).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={20} className="text-teal-600" />
            Categorias de Compras
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Comprador, alçadas de aprovação e regras de cotação por categoria
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">{ativas} ativas</span>
          {inativas > 0 && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold">{inativas} inativas</span>}
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, código, comprador..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300"
          />
        </div>
        <button
          onClick={() => setShowInativas(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${showInativas ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
        >
          {showInativas ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          Mostrar inativas
        </button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-teal-500" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('nome')} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                    Categoria <SortIcon col="nome" />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-3 py-3">
                  <button onClick={() => handleSort('comprador')} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                    Comprador <SortIcon col="comprador" />
                  </button>
                </th>
                <th className="text-left px-3 py-3">
                  <button onClick={() => handleSort('aprovador')} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                    Aprovador / Limite <SortIcon col="aprovador" />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Cotações<br /><span className="text-[9px] font-normal normal-case tracking-normal">≤500 / ≤2k / +2k</span>
                </th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-slate-400">
                    Nenhuma categoria encontrada
                  </td>
                </tr>
              ) : filtered.map(cat => (
                <CatRow
                  key={cat.id}
                  cat={cat}
                  compradores={compradores}
                  onEdit={setEditCat}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><Tag size={10} className="text-violet-400" /> Cotações mínimas: faixas ≤R$500 / R$501–R$2k / {'>'} R$2k</span>
        <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-violet-400" /> Limite 0 = aprovação sempre da diretoria</span>
      </div>

      {/* Drawer de edição */}
      {editCat && (
        <EditDrawer
          cat={editCat}
          compradores={compradores}
          onClose={() => setEditCat(null)}
        />
      )}
    </div>
  )
}
