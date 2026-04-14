import { useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Plus, Minus, X, Camera, Loader2, Save,
  User, Package, Calendar,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCriarCautela } from '../../hooks/useCautelas'
import { useCadObras, useCadColaboradores } from '../../hooks/useCadastros'
import { useBases, useEstoqueItens, useSaldos } from '../../hooks/useEstoque'
import { supabase } from '../../services/supabase'
import type { NovaCautelaPayload } from '../../types/cautela'

type ItemLinha = {
  item_id: string
  descricao: string
  codigo: string
  unidade: string
  quantidade: number
}

export default function NovaCautela() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const navigate = useNavigate()
  const criarCautela = useCriarCautela()

  // ── Data sources ────────────────────────────────────────────────────────
  const { data: colaboradores = [] } = useCadColaboradores()
  const { data: obras = [] } = useCadObras()
  const { data: bases = [] } = useBases()
  const { data: catalogoItens = [] } = useEstoqueItens()

  // ── Form state ──────────────────────────────────────────────────────────
  const [solicitanteId, setSolicitanteId] = useState('')
  const [solicitanteNome, setSolicitanteNome] = useState('')
  const [colabSearch, setColabSearch] = useState('')
  const [showColabDropdown, setShowColabDropdown] = useState(false)

  const [obraId, setObraId] = useState('')
  const [baseId, setBaseId] = useState('')

  const [itens, setItens] = useState<ItemLinha[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState(false)

  const defaultDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])
  const [dataDevolucao, setDataDevolucao] = useState(defaultDate)
  const [observacao, setObservacao] = useState('')

  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [erro, setErro] = useState('')

  // ── Saldos for selected base ────────────────────────────────────────────
  const { data: saldos = [] } = useSaldos(baseId || undefined)
  const saldoMap = useMemo(() => {
    const map = new Map<string, number>()
    saldos.forEach((s: any) => map.set(s.item_id, s.saldo ?? 0))
    return map
  }, [saldos])

  // ── Colaborador autocomplete ────────────────────────────────────────────
  const colabFiltered = useMemo(() => {
    if (!colabSearch.trim()) return []
    const q = colabSearch.toLowerCase()
    return colaboradores
      .filter(c => c.nome?.toLowerCase().includes(q))
      .slice(0, 10)
  }, [colaboradores, colabSearch])

  const selectColab = useCallback((c: typeof colaboradores[0]) => {
    setSolicitanteId(c.id)
    setSolicitanteNome(c.nome)
    setColabSearch(c.nome)
    setShowColabDropdown(false)
  }, [])

  // ── Item search ─────────────────────────────────────────────────────────
  const itemFiltered = useMemo(() => {
    if (!itemSearch.trim()) return []
    const q = itemSearch.toLowerCase()
    return catalogoItens
      .filter(i =>
        i.descricao?.toLowerCase().includes(q) ||
        i.codigo?.toLowerCase().includes(q)
      )
      .filter(i => !itens.some(l => l.item_id === i.id))
      .slice(0, 10)
  }, [catalogoItens, itemSearch, itens])

  const addItem = useCallback((item: typeof catalogoItens[0]) => {
    setItens(prev => [...prev, {
      item_id: item.id,
      descricao: item.descricao,
      codigo: item.codigo,
      unidade: item.unidade ?? 'UN',
      quantidade: 1,
    }])
    setItemSearch('')
    setShowItemDropdown(false)
  }, [])

  const updateQty = (idx: number, delta: number) => {
    setItens(prev => prev.map((it, i) =>
      i === idx ? { ...it, quantidade: Math.max(1, it.quantidade + delta) } : it
    ))
  }

  const removeItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Foto ────────────────────────────────────────────────────────────────
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setFotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  const canSubmit = solicitanteId && obraId && baseId && itens.length > 0 && dataDevolucao

  async function handleSubmit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setErro('')

    try {
      // Upload photo if present
      let fotoUrl: string | undefined
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop() || 'jpg'
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('cautelas-fotos')
          .upload(path, fotoFile, { contentType: fotoFile.type })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('cautelas-fotos')
            .getPublicUrl(path)
          fotoUrl = urlData?.publicUrl
        }
      }

      const obraSel = obras.find(o => o.id === obraId)
      const payload = {
        solicitante_id: solicitanteId,
        solicitante_nome: solicitanteNome,
        obra_id: obraId,
        obra_nome: obraSel?.nome ?? '',
        base_id: baseId,
        status: 'em_aberto',
        data_retirada: new Date().toISOString(),
        data_devolucao_prevista: dataDevolucao,
        observacao: observacao || undefined,
        ...(fotoUrl ? { foto_retirada_url: [fotoUrl] } : {}),
        itens: itens.map(i => ({
          item_id: i.item_id,
          quantidade: i.quantidade,
        })),
      } as NovaCautelaPayload & { status: string; data_retirada: string; foto_retirada_url?: string[] }

      await criarCautela.mutateAsync(payload)
      navigate('/estoque/cautelas')
    } catch (err: any) {
      setErro(err?.message || 'Erro ao registrar cautela')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Styling helpers ─────────────────────────────────────────────────────
  const labelCls = `block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
    isDark
      ? 'bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'
      : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400'
  }`
  const cardCls = `rounded-2xl border p-4 ${
    isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  }`

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/estoque/cautelas')}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Nova Cautela
        </h1>
      </div>

      {/* ── Colaborador ──────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <User size={15} className="text-teal-500" />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Colaborador
          </span>
        </div>
        <div className="relative">
          <label className={labelCls}>Nome do colaborador *</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={colabSearch}
              onChange={e => {
                setColabSearch(e.target.value)
                setShowColabDropdown(true)
                if (!e.target.value) { setSolicitanteId(''); setSolicitanteNome('') }
              }}
              onFocus={() => colabSearch && setShowColabDropdown(true)}
              onBlur={() => setTimeout(() => setShowColabDropdown(false), 200)}
              placeholder="Buscar por nome..."
              className={`${inputCls} pl-9`}
            />
          </div>
          {showColabDropdown && colabFiltered.length > 0 && (
            <div className={`absolute z-20 w-full mt-1 rounded-xl border shadow-lg max-h-48 overflow-y-auto ${
              isDark ? 'bg-[#1e293b] border-white/[0.08]' : 'bg-white border-slate-200'
            }`}>
              {colabFiltered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => selectColab(c)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold">{c.nome}</span>
                  {c.cargo && <span className={`ml-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.cargo}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Obra + Base ──────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Obra *</label>
            <select
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione...</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Base / Almoxarifado *</label>
            <select
              value={baseId}
              onChange={e => setBaseId(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione...</option>
              {bases.map(b => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Itens ────────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <Package size={15} className="text-teal-500" />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Itens
          </span>
          <span className={`ml-auto text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Item search */}
        <div className="relative mb-3">
          <label className={labelCls}>Adicionar item do catalogo</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={itemSearch}
              onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true) }}
              onFocus={() => itemSearch && setShowItemDropdown(true)}
              onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
              placeholder="Buscar por descricao ou codigo..."
              className={`${inputCls} pl-9`}
            />
          </div>
          {showItemDropdown && itemFiltered.length > 0 && (
            <div className={`absolute z-20 w-full mt-1 rounded-xl border shadow-lg max-h-56 overflow-y-auto ${
              isDark ? 'bg-[#1e293b] border-white/[0.08]' : 'bg-white border-slate-200'
            }`}>
              {itemFiltered.map(item => {
                const saldo = saldoMap.get(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={() => addItem(item)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isDark ? 'text-slate-200 hover:bg-white/[0.06]' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-[10px] font-mono mr-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>{item.codigo}</span>
                        <span className="font-semibold">{item.descricao}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.unidade}</span>
                        {saldo !== undefined && (
                          <span className={`ml-2 text-[10px] font-semibold ${saldo > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            Disp: {saldo}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Item list */}
        {itens.length === 0 ? (
          <div className={`rounded-xl border border-dashed p-6 text-center ${
            isDark ? 'border-white/[0.08] text-slate-600' : 'border-slate-200 text-slate-300'
          }`}>
            <Package size={24} className="mx-auto mb-1" />
            <p className="text-xs font-medium">Nenhum item adicionado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {itens.map((item, idx) => {
              const saldo = saldoMap.get(item.item_id)
              return (
                <div
                  key={item.item_id}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 ${
                    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {item.descricao}
                    </p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {item.codigo} - {item.unidade}
                      {saldo !== undefined && <span className="ml-2">Disp: {saldo}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Minus size={12} />
                    </button>
                    <span className={`w-8 text-center text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {item.quantidade}
                    </span>
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Detalhes ─────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} className="text-teal-500" />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Detalhes
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Data de devolucao prevista *</label>
            <input
              type="date"
              value={dataDevolucao}
              onChange={e => setDataDevolucao(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Observacao</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Observacoes opcionais..."
            />
          </div>
        </div>
      </div>

      {/* ── Foto ─────────────────────────────────────────────────────── */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <Camera size={15} className="text-teal-500" />
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Foto do Colaborador
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFoto}
        />

        {fotoPreview ? (
          <div className="relative">
            <img
              src={fotoPreview}
              alt="Foto do colaborador"
              className="w-full max-h-48 object-cover rounded-xl"
            />
            <button
              onClick={() => { setFotoFile(null); setFotoPreview(null) }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full rounded-xl border-2 border-dashed py-8 flex flex-col items-center gap-2 transition-colors ${
              isDark
                ? 'border-white/[0.08] text-slate-500 hover:border-teal-500/30 hover:text-teal-400'
                : 'border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-500'
            }`}
          >
            <Camera size={28} />
            <span className="text-xs font-semibold">Tirar foto ou selecionar</span>
          </button>
        )}
      </div>

      {/* ── Error message ────────────────────────────────────────────── */}
      {erro && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
          bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold
          transition-colors disabled:opacity-50 shadow-sm"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Registrar Cautela
      </button>
    </div>
  )
}
