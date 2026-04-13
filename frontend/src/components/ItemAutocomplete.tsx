import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Plus, Loader2, Check, Package } from 'lucide-react'
import { useItemCatalogSearch } from '../hooks/useEstoque'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import type { EstItem } from '../types/estoque'
import { toUpperNorm } from './UpperInput'

// ── Map RC category (cmp_categorias.codigo) → est_itens.categoria ───────────
const CATEGORY_MAP: Record<string, string[]> = {
  ACO:             ['Almoxarifado Geral'],
  CONCRETO:        ['Almoxarifado Geral'],
  OUTROS_MAT_OBRA: ['Material Elétrico', 'Almoxarifado Geral'],
  EQUIPAMENTOS:    ['Ferramental', 'Almoxarifado Geral'],
  FERRAMENTAS:     ['Ferramental'],
  EPI_EPC_UNIFORME:['EPI/EPC'],
  ALIMENTACAO_CANTEIRO: [],
  ITENS_ALOJAMENTO: [],
  PRODUTOS_LIMPEZA: [],
  LOCACAO_IMOVEIS: [],
  SERV_OBRA_LOG:   [],
  MAT_ESCRITORIO_CD: ['Material de Escritório'],
  MANUT_FROTA:     ['Ferramental', 'Almoxarifado Geral'],
  AQUISICAO_ATIVOS: [],
  SERV_ADMIN:      ['Material de Escritório', 'Almoxarifado Geral'],
  SOFTWARE_HARDWARE_TI: ['Material de Escritório'],
  MAT_ESCRITORIO_SEDE: ['Material de Escritório'],
  COMPRAS_EXTRA:   ['Material Elétrico', 'Almoxarifado Geral', 'EPI/EPC', 'Ferramental', 'Material de Escritório'],
  // Uppercase codes from cmp_categorias table
  MATERIAIS_OBRA:  ['Material Elétrico', 'Almoxarifado Geral'],
  EPI_EPC:         ['EPI/EPC'],
  FERRAMENTAL:     ['Ferramental'],
  FROTA_EQUIP:     ['Ferramental', 'Almoxarifado Geral'],
  SERVICOS:        [],
  LOCACAO:         [],
  MOBILIZACAO:     [],
  ALIMENTACAO:     [],
  ALOJAMENTO:      [],
  ESCRITORIO:      ['Material de Escritório'],
  CENTRO_DIST:     ['Almoxarifado Geral'],
  AQUISICOES_ESP:  ['Material Elétrico', 'Almoxarifado Geral', 'EPI/EPC', 'Ferramental', 'Material de Escritório'],
  // Lowercase fallback (for AI parser)
  materiais_obra:  ['Material Elétrico', 'Almoxarifado Geral'],
  epi_epc:         ['EPI/EPC'],
  ferramental:     ['Ferramental'],
  frota_equip:     ['Ferramental', 'Almoxarifado Geral'],
  servicos:        [],
  locacao_veic:    [],
  mobilizacao:     [],
  alimentacao:     [],
  escritorio:      ['Material de Escritório'],
  consumo:         ['Almoxarifado Geral'],
}

export function getCategoriaEstoque(categoriaRC: string): string[] {
  return CATEGORY_MAP[categoriaRC] ?? CATEGORY_MAP[categoriaRC.toUpperCase()] ?? []
}

// ── Unidades do enum est_unidade ────────────────────────────────────────────
const UNIDADES_ESTOQUE = ['UN', 'M', 'M2', 'M3', 'KG', 'TON', 'L', 'CX', 'PCT', 'RL', 'PR', 'JG']

// Map DB enum → RC select values (NovaRequisicao uses lowercase)
const UNIDADE_DB_TO_RC: Record<string, string> = {
  UN: 'un', M: 'm', M2: 'm²', M3: 'm³', KG: 'kg', TON: 'ton',
  L: 'L', CX: 'cx', PCT: 'pc', RL: 'rl', PR: 'par', JG: 'jg',
}

// ── Props ───────────────────────────────────────────────────────────────────
interface ItemAutocompleteProps {
  value: string
  onChange: (desc: string) => void
  onSelectCatalog: (item: {
    id: string
    codigo: string
    descricao: string
    unidade: string
    valor_medio: number
    classe_financeira_id?: string
    classe_financeira_codigo?: string
    classe_financeira_descricao?: string
    categoria_financeira_codigo?: string
    categoria_financeira_descricao?: string
    destino_operacional?: 'estoque' | 'patrimonio' | 'nenhum'
    grupo_compra_codigo?: string
  }) => void
  categoriaRC: string
  placeholder?: string
  isDark?: boolean
}

export default function ItemAutocomplete({
  value, onChange, onSelectCatalog, categoriaRC, placeholder, isDark,
}: ItemAutocompleteProps) {
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newUnidade, setNewUnidade] = useState('UN')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const categoriasEstoque = getCategoriaEstoque(categoriaRC)
  const hasAutocomplete = Boolean(categoriaRC)

  const { data: results = [], isLoading } = useItemCatalogSearch(categoriaRC, categoriasEstoque, search)
  const { perfil } = useAuth()

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowCreateForm(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleInputChange = useCallback((v: string) => {
    const next = toUpperNorm(v)
    onChange(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(next.trim()), 300)
    setShowDropdown(true)
    setShowCreateForm(false)
  }, [onChange])

  function selectItem(item: EstItem) {
    const dbUnit = (item.unidade || 'UN').toUpperCase()
    onSelectCatalog({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: UNIDADE_DB_TO_RC[dbUnit] || dbUnit.toLowerCase(),
      valor_medio: item.valor_medio ?? 0,
      classe_financeira_id: item.classe_financeira_id,
      classe_financeira_codigo: item.classe_financeira_codigo,
      classe_financeira_descricao: item.classe_financeira_descricao,
      categoria_financeira_codigo: item.categoria_financeira_codigo,
      categoria_financeira_descricao: item.categoria_financeira_descricao,
      destino_operacional: item.destino_operacional,
      grupo_compra_codigo: item.subcategoria,
    })
    setShowDropdown(false)
    setShowCreateForm(false)
    setSearch('')
  }

  function openCreateForm() {
    setNewDesc(toUpperNorm(value || search))
    setNewUnidade('UN')
    setShowCreateForm(true)
  }

  async function handleCreate() {
    if (!newDesc.trim()) return
    setSaving(true)
    try {
      const categoria = categoriasEstoque[0] || 'Almoxarifado Geral'
      const prefix = categoria === 'Material Elétrico' ? 'ME'
        : categoria === 'EPI/EPC' ? 'EP'
        : categoria === 'Ferramental' ? 'FE'
        : categoria === 'Material de Escritório' ? 'ES'
        : 'AG'
      const code = `${prefix}-${Date.now().toString(36).toUpperCase()}`

      // 1. Call n8n SuperTEG to standardize nomenclature (fix typos, casing)
      let descPadronizada = toUpperNorm(newDesc.trim())
      try {
        const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'
        const res = await fetch(`${N8N_URL}/padronizar-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: descPadronizada,
            categoria,
            unidade: newUnidade,
          }),
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const json = await res.json()
          if (json.descricao) descPadronizada = toUpperNorm(json.descricao)
        }
      } catch {
        // n8n indisponível — usa descrição original
      }

      // 2. Sempre cria pré-cadastro para aprovação do admin
      await supabase.from('sys_pre_cadastros').insert({
        entidade: 'itens',
        tabela_destino: 'est_itens',
        dados: {
          codigo: code,
          descricao: descPadronizada,
          categoria,
          subcategoria: categoriaRC || null,
          unidade: newUnidade,
          ativo: true,
          valor_medio: 0,
        },
        status: 'pendente',
        solicitado_por: perfil?.auth_id,
        solicitante_nome: perfil?.nome,
      })

      // Use a descrição padronizada no campo
      onChange(descPadronizada)

      setShowDropdown(false)
      setShowCreateForm(false)
    } catch (err) {
      console.error('Erro ao criar item:', err)
    } finally {
      setSaving(false)
    }
  }

  // Highlight matching text
  function highlight(text: string) {
    if (!search.trim()) return text
    const idx = text.toLowerCase().indexOf(search.toLowerCase())
    if (idx < 0) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-teal-600">{text.slice(idx, idx + search.length)}</span>
        {text.slice(idx + search.length)}
      </>
    )
  }

  const showResults = showDropdown && hasAutocomplete
  const bg = isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
  const dropdownBg = isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
  const hoverBg = isDark ? 'hover:bg-slate-700' : 'hover:bg-teal-50'
  const textColor = isDark ? 'text-slate-200' : 'text-slate-700'
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-400'

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {hasAutocomplete && (
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedText}`} />
        )}
        <input
          value={value}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => { if (hasAutocomplete) setShowDropdown(true) }}
          placeholder={placeholder || (hasAutocomplete ? 'Buscar item do catálogo...' : 'Descrição do item')}
          className={`w-full border rounded-xl ${hasAutocomplete ? 'pl-9' : 'px-3'} pr-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none ${bg} ${textColor}`}
          required
        />
        {isLoading && hasAutocomplete && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {showResults && (
        <div className={`absolute z-50 left-0 right-0 top-full mt-1 ${dropdownBg} rounded-xl border shadow-lg overflow-hidden max-h-64 overflow-y-auto`}>
          {results.length > 0 ? (
            <>
              {results.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => selectItem(item)}
                  className={`w-full text-left px-3 py-2.5 text-sm ${textColor} ${hoverBg} transition-colors flex items-center gap-2 border-b border-slate-100 last:border-0`}
                >
                  <Package size={14} className="text-teal-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono ${mutedText} shrink-0`}>{item.codigo}</span>
                      <span className="truncate">{highlight(item.descricao)}</span>
                    </div>
                    <div className={`text-[11px] ${mutedText} truncate flex items-center gap-2`}>
                      {item.descricao_complementar && <span>{item.descricao_complementar}</span>}
                      {item.categoria_financeira_descricao && <span>{item.categoria_financeira_descricao}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[10px] ${mutedText}`}>{item.unidade}</div>
                    {item.destino_operacional && (
                      <div className="text-[10px] text-slate-400">
                        {item.destino_operacional === 'estoque'
                          ? 'Estoque'
                          : item.destino_operacional === 'patrimonio'
                            ? 'Patrimonio'
                            : 'Nenhum'}
                      </div>
                    )}
                    {(item.valor_medio ?? 0) > 0 && (
                      <div className="text-[11px] font-semibold text-teal-600">
                        R$ {(item.valor_medio ?? 0).toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          ) : !isLoading ? (
            <div className={`px-3 py-3 text-sm ${mutedText} text-center`}>
              Nenhum item encontrado para "{search}"
            </div>
          ) : null}

          {/* + Cadastrar Item button */}
          {!showCreateForm && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={openCreateForm}
              className={`w-full text-left px-3 py-2.5 text-sm font-semibold text-teal-600 ${hoverBg} transition-colors flex items-center gap-2 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}
            >
              <Plus size={14} />
              Solicitar cadastro de item
            </button>
          )}

          {/* Inline create form */}
          {showCreateForm && (
            <div className={`p-3 border-t ${isDark ? 'border-slate-600 bg-slate-750' : 'border-slate-200 bg-slate-50'} space-y-2`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>
                Pré-cadastro de Item
              </div>
              <input
                value={newDesc}
                onChange={e => setNewDesc(toUpperNorm(e.target.value))}
                placeholder="Descrição do item"
                className={`w-full border rounded-lg px-2.5 py-1.5 text-sm ${bg} ${textColor} focus:ring-2 focus:ring-teal-300 outline-none`}
                autoFocus
                onMouseDown={e => e.preventDefault()}
              />
              <div className="flex gap-2">
                <select
                  value={newUnidade}
                  onChange={e => setNewUnidade(e.target.value)}
                  className={`border rounded-lg px-2 py-1.5 text-sm ${bg} ${textColor} focus:ring-2 focus:ring-teal-300 outline-none`}
                >
                  {UNIDADES_ESTOQUE.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!newDesc.trim() || saving}
                  onMouseDown={e => e.preventDefault()}
                  onClick={handleCreate}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 text-white text-sm font-semibold rounded-lg px-3 py-1.5 hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Enviar
                </button>
              </div>
              <p className={`text-[10px] ${mutedText}`}>
                A nomenclatura será padronizada e enviada para aprovação
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
