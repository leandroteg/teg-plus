import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Send, PlusCircle, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, Check, Layers, FileText, Search, Upload, FileUp,
  ChevronDown, X, FileImage, Eye, Pencil, CheckCircle2, Loader2,
  Package, MapPin, Zap,
} from 'lucide-react'
import { useCriarRequisicao } from '../hooks/useRequisicoes'
import { useAiParse, readFileForAi, isBinaryFile, isImageFile } from '../hooks/useAiParse'
import { useCategorias } from '../hooks/useCategorias'
import { useAuth } from '../contexts/AuthContext'
import CategoryCard from '../components/CategoryCard'
import ItemAutocomplete from '../components/ItemAutocomplete'
import type { RequisicaoItem, Urgencia, AiParseResult, CategoriaMaterial } from '../types'

// ── Obras fixas (alinhadas com seed do SQL) ────────────────────────────────
const OBRAS = [
  { id: 'FRUTAL',      nome: 'SE Frutal'       },
  { id: 'PARACATU',   nome: 'SE Paracatu'     },
  { id: 'PERDIZES',   nome: 'SE Perdizes'     },
  { id: 'TRESMARIAS', nome: 'SE Três Marias'  },
  { id: 'RIOPAR',     nome: 'Rio Paranaíba'   },
  { id: 'ITUIUTABA',  nome: 'SE Ituiutaba'    },
  { id: 'CD_MATRIZ',  nome: 'CD — Matriz'     },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyItem = (): RequisicaoItem => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario_estimado: 0 })

function minCotacoes(valor: number, regras?: { ate_500: number; '501_a_2k': number; acima_2k: number }) {
  if (!regras) return valor <= 500 ? 1 : valor <= 2000 ? 2 : 3
  if (valor <= 500) return regras.ate_500
  if (valor <= 2000) return regras['501_a_2k']
  return regras.acima_2k
}

function Stepper({ step }: { step: number }) {
  const steps = ['Categoria', 'Detalhes', 'Confirmar']
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 transition-all
                ${done   ? 'bg-teal-500 text-white' : ''}
                ${active ? 'bg-teal-400 text-white ring-4 ring-teal-400/20' : ''}
                ${!done && !active ? 'bg-slate-100 text-slate-400' : ''}
              `}>
                {done ? <Check size={13} strokeWidth={3} /> : idx}
              </div>
              <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap
                ${active ? 'text-teal-600' : done ? 'text-teal-500' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-1 mt-[-12px] ${done ? 'bg-teal-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function parseCSVItems(text: string): RequisicaoItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 1) return []

  const firstLine = lines[0].toLowerCase()
  const sep = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
  const hasHeader = firstLine.includes('desc') || firstLine.includes('item')
    || firstLine.includes('qtd') || firstLine.includes('quant')
    || firstLine.includes('material') || firstLine.includes('produto')
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''))
    return {
      descricao: cols[0] || '',
      quantidade: parseFloat((cols[1] || '1').replace(',', '.')) || 1,
      unidade: cols[2] || 'un',
      valor_unitario_estimado: parseFloat((cols[3] || '0').replace(',', '.')) || 0,
    }
  }).filter(i => i.descricao.length > 1)
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function NovaRequisicao() {
  const nav = useNavigate()
  const mutation = useCriarRequisicao()
  const aiParse = useAiParse()
  const { data: categorias = [], isLoading: catLoading } = useCategorias()
  const { perfil } = useAuth()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep]                 = useState(1)
  const [searchCat, setSearchCat]       = useState('')
  const [showAiHelper, setShowAiHelper] = useState(false)
  const [textoAi, setTextoAi]           = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver]         = useState(false)

  const [categoria, setCategoria]           = useState<CategoriaMaterial | null>(null)
  const [solicitante, setSolicitante]       = useState(perfil?.nome ?? '')
  const [obraNome, setObraNome]             = useState('')
  const [descricao, setDescricao]           = useState('')
  const [justificativa, setJustificativa]   = useState('')
  const [urgencia, setUrgencia]             = useState<Urgencia>('normal')
  const [dataNecessidade, setDataNecessidade] = useState('')
  const [itens, setItens]                   = useState<RequisicaoItem[]>([emptyItem()])
  const [compradorSugerido, setCompradorSugerido] = useState<{ id: string; nome: string } | null>(null)
  const [confianca, setConfianca]           = useState(0)
  const [stepErrors, setStepErrors]         = useState<string[]>([])
  const [submitError, setSubmitError]       = useState<string | null>(null)

  // ── Issue #17: AI progress + preview state ─────────────────────────────────
  const [aiProgress, setAiProgress]         = useState<'idle' | 'reading' | 'parsing' | 'done' | 'error'>('idle')
  const [aiPreview, setAiPreview]           = useState<AiParseResult | null>(null)
  const [previewItens, setPreviewItens]     = useState<RequisicaoItem[]>([])
  const [showPreview, setShowPreview]       = useState(false)

  const total  = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_estimado, 0)
  const minCot = categoria ? minCotacoes(total, categoria.cotacoes_regras) : 1

  const filteredCats = categorias.filter(cat =>
    !searchCat.trim() ||
    cat.nome.toLowerCase().includes(searchCat.toLowerCase()) ||
    cat.codigo.toLowerCase().includes(searchCat.toLowerCase()) ||
    (cat.keywords ?? []).some((kw: string) => kw.toLowerCase().includes(searchCat.toLowerCase()))
  )

  // ── Sanitize AI parsed items (reusable) ──────────────────────────────────
  const sanitizeItems = useCallback((items: RequisicaoItem[]): RequisicaoItem[] =>
    (items ?? [])
      .map(item => ({
        descricao: String(item.descricao ?? '').trim(),
        quantidade: typeof item.quantidade === 'number' ? item.quantidade : parseFloat(String(item.quantidade)) || 1,
        unidade: String(item.unidade || 'un').toLowerCase(),
        valor_unitario_estimado: typeof item.valor_unitario_estimado === 'number'
          ? item.valor_unitario_estimado
          : parseFloat(String(item.valor_unitario_estimado)) || 0,
      }))
      .filter(item => item.descricao.length > 0)
  , [])

  // ── Apply AI result to the form (shared between direct-apply and preview-confirm)
  const applyAiResult = useCallback((result: AiParseResult, parsedItens: RequisicaoItem[], textoOriginal: string) => {
    setItens(parsedItens.length > 0 ? parsedItens : [emptyItem()])

    // Issue #18: Auto-fill solicitante with current user's name
    if (perfil?.nome && !solicitante.trim()) {
      setSolicitante(perfil.nome)
    }

    // Match obra_sugerida against OBRAS list (accent-insensitive)
    if (result.obra_sugerida) {
      const sugerida = result.obra_sugerida.trim()
      const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const obraMatch = OBRAS.find(o =>
        o.nome === sugerida ||
        normalizeStr(o.nome) === normalizeStr(sugerida) ||
        normalizeStr(o.nome).includes(normalizeStr(sugerida)) ||
        normalizeStr(sugerida).includes(normalizeStr(o.nome))
      )
      if (obraMatch) setObraNome(obraMatch.nome)
    }

    // Validate urgencia before setting
    if (result.urgencia_sugerida && ['normal', 'urgente', 'critica'].includes(result.urgencia_sugerida)) {
      setUrgencia(result.urgencia_sugerida)
    }

    if (result.justificativa_sugerida)  setJustificativa(String(result.justificativa_sugerida))
    if (result.comprador_sugerido)      setCompradorSugerido(result.comprador_sugerido)
    if (result.categoria_sugerida) {
      const catEncontrada = categorias.find(c =>
        c.codigo === result.categoria_sugerida ||
        c.nome.toLowerCase().includes((result.categoria_sugerida ?? '').toLowerCase())
      )
      if (catEncontrada) setCategoria(catEncontrada)
    }
    setConfianca(typeof result.confianca === 'number' ? result.confianca : 0.5)
    if (!descricao.trim()) setDescricao(textoOriginal || `Requisição processada via IA (${parsedItens.length} itens)`)
    setStep(2)
  }, [perfil, solicitante, categorias, descricao])

  // ── AI Parse Handler (with progress + preview) ──────────────────────────────
  const handleAiParse = async () => {
    let textoFinal = textoAi
    let arquivoPayload: { base64: string; nome: string; mime: string } | undefined

    setAiProgress('reading')
    setAiPreview(null)
    setShowPreview(false)

    if (selectedFile) {
      try {
        // CSV fast path -- parse directly without AI
        if (selectedFile.name.match(/\.csv$/i)) {
          const fileText = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsText(selectedFile)
          })
          const csvItems = parseCSVItems(fileText)
          if (csvItems.length > 0) {
            setItens(csvItems)
            if (!descricao.trim()) setDescricao(`Itens importados de ${selectedFile.name} (${csvItems.length} itens)`)
            setConfianca(0.95)
            // Issue #18: Auto-fill solicitante
            if (perfil?.nome && !solicitante.trim()) setSolicitante(perfil.nome)
            setAiProgress('done')
            setTimeout(() => { setAiProgress('idle'); setStep(2) }, 600)
            return
          }
        }

        // Read file (auto-detect: binary -> base64, text -> string)
        const fileData = await readFileForAi(selectedFile)

        if (fileData.arquivo) {
          arquivoPayload = fileData.arquivo
        } else if (fileData.texto) {
          textoFinal = textoFinal
            ? `${textoFinal}\n\nConteudo do arquivo ${selectedFile.name}:\n${fileData.texto}`
            : fileData.texto
        }
      } catch {
        // File read error -> continue with text only
      }
    }

    if (!textoFinal.trim() && !arquivoPayload) {
      setAiProgress('idle')
      return
    }

    setAiProgress('parsing')

    try {
      const result: AiParseResult = await aiParse.mutateAsync({
        texto: textoFinal,
        solicitante_nome: perfil?.nome || solicitante,
        arquivo: arquivoPayload,
      })

      const sanitized = sanitizeItems(result.itens)
      setAiProgress('done')

      // Issue #17: Show preview before applying
      setAiPreview(result)
      setPreviewItens(sanitized.length > 0 ? sanitized : [emptyItem()])
      setShowPreview(true)
    } catch {
      setAiProgress('error')
      setTimeout(() => setAiProgress('idle'), 3000)
    }
  }

  // ── Confirm preview: apply AI results to form ──────────────────────────
  const confirmPreview = () => {
    if (!aiPreview) return
    applyAiResult(aiPreview, previewItens, textoAi || `Requisicao processada via IA`)
    setShowPreview(false)
    setAiProgress('idle')
  }

  // ── Dismiss preview ─────────────────────────────────────────────────────
  const dismissPreview = () => {
    setShowPreview(false)
    setAiPreview(null)
    setPreviewItens([])
    setAiProgress('idle')
  }

  // ── Update preview item (editable in preview) ──────────────────────────
  const updatePreviewItem = (idx: number, field: keyof RequisicaoItem, value: string | number) =>
    setPreviewItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))

  const updateItem = (idx: number, field: keyof RequisicaoItem, value: string | number) =>
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))

  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      await mutation.mutateAsync({
        solicitante_nome: solicitante,
        obra_nome:        obraNome,
        descricao,
        justificativa,
        urgencia,
        categoria:        categoria?.codigo,
        itens,
        data_necessidade: dataNecessidade || undefined,
        texto_original:   textoAi || undefined,
        comprador_id:     compradorSugerido?.id,
        ai_confianca:     confianca,
      })
      nav('/requisicoes')
    } catch (err) {
      const msg = (err as Error)?.message || 'Erro ao enviar. Tente novamente.'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════════════════
  // ETAPA 1 — Categoria (Unified)
  // ═══════════════════════════════════════
  if (step === 1) return (
    <div className="space-y-5">
      <Stepper step={1} />

      {/* ── Category Selector Box ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={15} /> Selecione a Categoria
          </p>
          {categoria && (
            <span className="text-[11px] bg-white/20 text-white px-2.5 py-0.5 rounded-lg font-semibold backdrop-blur-sm">
              {categoria.nome}
            </span>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-300 outline-none bg-slate-50/50 placeholder:text-slate-400"
              placeholder="Buscar por nome, código ou palavra-chave..."
              value={searchCat}
              onChange={e => setSearchCat(e.target.value)}
            />
            {searchCat && (
              <button type="button" onClick={() => setSearchCat('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Grid */}
          {catLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {filteredCats.map(cat => (
                <CategoryCard key={cat.id} categoria={cat}
                  selected={categoria?.id === cat.id}
                  onClick={() => setCategoria(cat.id === categoria?.id ? null : cat)}
                />
              ))}
              {filteredCats.length === 0 && searchCat && (
                <p className="col-span-full text-center text-sm text-slate-400 py-6">
                  Nenhuma categoria encontrada para &quot;{searchCat}&quot;
                </p>
              )}
            </div>
          )}
        </div>

        {/* Selected Category Details */}
        {categoria && (
          <div className="border-t border-teal-100 bg-gradient-to-b from-teal-50/80 to-teal-50/30 px-4 py-3 space-y-2.5">
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Fluxo desta Categoria</p>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-teal-500">Comprador</span>
                <p className="font-bold text-slate-800">{categoria.comprador_nome ?? '—'}</p>
              </div>
              <div>
                <span className="text-teal-500">Aprovação ≤R$2k</span>
                <p className="font-bold text-slate-800">{categoria.alcada1_aprovador ?? 'Welton'}</p>
              </div>
              <div>
                <span className="text-teal-500">Aprovação &gt;R$2k</span>
                <p className="font-bold text-slate-800">Laucídio</p>
              </div>
              <div>
                <span className="text-teal-500">Cotações mínimas</span>
                <p className="font-bold text-slate-800">≤R$500: 1 · ≤R$2k: 2 · &gt;R$2k: 3</p>
              </div>
            </div>
            {categoria.politica_resumo && (
              <div className="bg-white/80 rounded-xl p-2.5 border border-teal-100">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-teal-700">Política: </span>{categoria.politica_resumo}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── AI Helper (Optional, Collapsible) ─────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
        showAiHelper
          ? 'border-violet-200 bg-violet-50/20 shadow-sm shadow-violet-100'
          : 'border-slate-200 bg-white hover:border-violet-200'
      }`}>
        <button
          type="button"
          onClick={() => setShowAiHelper(!showAiHelper)}
          className="w-full flex items-center justify-between px-4 py-3 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
              showAiHelper
                ? 'bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-violet-200'
                : 'bg-violet-100 group-hover:bg-violet-200'
            }`}>
              <Sparkles size={15} className={showAiHelper ? 'text-white' : 'text-violet-500'} />
            </div>
            <div>
              <p className={`text-sm font-bold transition-colors ${
                showAiHelper ? 'text-violet-700' : 'text-slate-700 group-hover:text-violet-600'
              }`}>
                Assistente IA
              </p>
              <p className="text-[11px] text-slate-400">
                Extraia itens de textos ou arquivos automaticamente
              </p>
            </div>
          </div>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
            showAiHelper ? 'bg-violet-200 rotate-180' : 'bg-slate-100 group-hover:bg-violet-100'
          }`}>
            <ChevronDown size={14} className={showAiHelper ? 'text-violet-600' : 'text-slate-400'} />
          </div>
        </button>

        {showAiHelper && (
          <div className="px-4 pb-4 space-y-3 border-t border-violet-100/60">
            {/* Text Input */}
            <div className="pt-3">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">
                Descreva sua necessidade
              </label>
              <textarea rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none resize-none bg-white"
                placeholder="Ex: 500m de cabo XLPE 15kV e 200 conectores terminais para a SE Frutal, urgente..."
                value={textoAi} onChange={e => setTextoAi(e.target.value)} />
            </div>

            {/* File Upload Area */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Ou envie um arquivo com a lista de itens
              </label>
              <div
                className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-violet-400 bg-violet-50 scale-[1.01]'
                    : selectedFile
                      ? 'border-violet-300 bg-violet-50/50'
                      : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  if (e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0])
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp"
                  onChange={e => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
                  }}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isImageFile(selectedFile.name) ? 'bg-pink-100' : 'bg-violet-100'
                    }`}>
                      {isImageFile(selectedFile.name)
                        ? <FileImage size={18} className="text-pink-500" />
                        : <FileUp size={18} className="text-violet-500" />
                      }
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold text-violet-700 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-violet-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button type="button" onClick={e => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                      className="ml-1 w-7 h-7 rounded-full bg-violet-100 hover:bg-red-100 flex items-center justify-center transition-colors flex-shrink-0">
                      <X size={13} className="text-violet-500 hover:text-red-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                      <Upload size={20} className="text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500">
                      Arraste um arquivo ou <span className="text-violet-600 font-bold">clique para enviar</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Imagem · PDF · Excel · CSV · TXT
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* AI Progress Steps Indicator */}
            {aiProgress !== 'idle' && aiProgress !== 'error' && (
              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {[
                    { key: 'reading', label: 'Lendo arquivo', icon: FileUp },
                    { key: 'parsing', label: 'Processando IA', icon: Sparkles },
                    { key: 'done',    label: 'Concluido',      icon: CheckCircle2 },
                  ].map((s, i) => {
                    const isActive = s.key === aiProgress
                    const isDone = (aiProgress === 'parsing' && s.key === 'reading')
                      || (aiProgress === 'done' && (s.key === 'reading' || s.key === 'parsing'))
                    const Icon = s.icon
                    return (
                      <div key={s.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          isDone ? 'bg-violet-500' : isActive ? 'bg-violet-400 ring-2 ring-violet-200' : 'bg-slate-200'
                        }`}>
                          {isDone ? <Check size={10} strokeWidth={3} className="text-white" />
                            : isActive ? <Loader2 size={10} className="text-white animate-spin" />
                            : <Icon size={10} className="text-slate-400" />}
                        </div>
                        <span className={`text-[10px] font-semibold truncate ${
                          isDone ? 'text-violet-600' : isActive ? 'text-violet-700' : 'text-slate-400'
                        }`}>{s.label}</span>
                        {i < 2 && <div className={`flex-shrink-0 w-4 h-px ${isDone ? 'bg-violet-400' : 'bg-slate-200'}`} />}
                      </div>
                    )
                  })}
                </div>
                {aiProgress === 'parsing' && (
                  <div className="h-1 bg-violet-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full animate-pulse" style={{ width: '70%' }} />
                  </div>
                )}
              </div>
            )}

            {/* Process Button */}
            <button onClick={handleAiParse}
              disabled={(!textoAi.trim() && !selectedFile) || aiParse.isPending || aiProgress !== 'idle'}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all">
              {aiParse.isPending || (aiProgress !== 'idle' && aiProgress !== 'error')
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando...</>
                : <><Sparkles size={15} /> Processar com IA</>}
            </button>

            {/* Error feedback */}
            {(aiParse.isError || aiProgress === 'error') && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-xs text-center font-medium">
                  {(aiParse.error as Error)?.message || 'Erro ao processar. Tente novamente.'}
                </p>
              </div>
            )}

            {/* ── AI Preview Modal (Issue #17) ──────────────────────────────── */}
            {showPreview && aiPreview && (
              <div className="bg-white border-2 border-violet-300 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Preview header */}
                <div className="bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye size={15} className="text-white" />
                    <p className="text-sm font-bold text-white">Resultado da IA</p>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                      {Math.round((aiPreview.confianca ?? 0.5) * 100)}% confianca
                    </span>
                  </div>
                  <button type="button" onClick={dismissPreview} className="text-white/80 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {/* Preview summary */}
                <div className="p-4 space-y-3">
                  {/* Metadata chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {aiPreview.obra_sugerida && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold bg-teal-50 text-teal-700 px-2 py-1 rounded-lg border border-teal-200">
                        <MapPin size={10} /> {aiPreview.obra_sugerida}
                      </span>
                    )}
                    {aiPreview.urgencia_sugerida && aiPreview.urgencia_sugerida !== 'normal' && (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${
                        aiPreview.urgencia_sugerida === 'critica'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <Zap size={10} /> {aiPreview.urgencia_sugerida === 'critica' ? 'Critica' : 'Urgente'}
                      </span>
                    )}
                    {aiPreview.categoria_sugerida && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg border border-violet-200">
                        <Layers size={10} /> {aiPreview.categoria_sugerida.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] font-semibold bg-slate-50 text-slate-700 px-2 py-1 rounded-lg border border-slate-200">
                      <Package size={10} /> {previewItens.filter(i => i.descricao.trim()).length} iten{previewItens.filter(i => i.descricao.trim()).length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Editable items list */}
                  <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {previewItens.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 flex-shrink-0">#{idx + 1}</span>
                          <input
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-violet-300 outline-none"
                            value={item.descricao}
                            onChange={e => updatePreviewItem(idx, 'descricao', e.target.value)}
                          />
                          {previewItens.length > 1 && (
                            <button type="button" onClick={() => setPreviewItens(p => p.filter((_, i) => i !== idx))}
                              className="text-slate-300 hover:text-red-500 transition flex-shrink-0">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <input type="number" min="0.01" step="0.01"
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] focus:ring-1 focus:ring-violet-300 outline-none"
                            placeholder="Qtd"
                            value={item.quantidade || ''}
                            onChange={e => updatePreviewItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
                          <select className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] focus:ring-1 focus:ring-violet-300 outline-none"
                            value={item.unidade}
                            onChange={e => updatePreviewItem(idx, 'unidade', e.target.value)}>
                            {['un', 'kg', 'm', 'm2', 'm3', 'L', 'pc', 'cx', 'hr', 'vb'].map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <input type="number" min="0" step="0.01"
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] focus:ring-1 focus:ring-violet-300 outline-none"
                            placeholder="R$ unit."
                            value={item.valor_unitario_estimado || ''}
                            onChange={e => updatePreviewItem(idx, 'valor_unitario_estimado', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Preview total */}
                  {previewItens.some(i => i.valor_unitario_estimado > 0) && (
                    <div className="flex justify-between items-center text-xs bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                      <span className="text-teal-600 font-semibold">Total estimado</span>
                      <span className="font-extrabold text-teal-700">
                        {fmt(previewItens.reduce((s, i) => s + i.quantidade * i.valor_unitario_estimado, 0))}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" onClick={dismissPreview}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all">
                      Descartar
                    </button>
                    <button type="button" onClick={confirmPreview}
                      className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                      <Check size={14} strokeWidth={3} /> Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Skip AI link */}
            <button type="button" onClick={() => {
              if (textoAi.trim()) setDescricao(textoAi)
              // Issue #18: Auto-fill solicitante when skipping AI too
              if (perfil?.nome && !solicitante.trim()) setSolicitante(perfil.nome)
              setStep(2)
            }}
              className="w-full text-xs text-slate-400 text-center py-0.5 hover:text-slate-600 transition">
              Pular IA e preencher manualmente →
            </button>
          </div>
        )}
      </div>

      {/* ── Next Step Button ──────────────────────────────────────────────── */}
      <button onClick={() => setStep(2)} disabled={!categoria}
        className="w-full bg-teal-500 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all">
        Próxima Etapa <ChevronRight size={16} />
      </button>
    </div>
  )

  // ═══════════════════════════════════════
  // ETAPA 2 — Detalhes
  // ═══════════════════════════════════════
  if (step === 2) return (
    <div className="space-y-5">
      <Stepper step={2} />
      <button onClick={() => { setStep(1); setStepErrors([]) }} className="flex items-center gap-1 text-slate-500 text-sm -mt-2">
        <ChevronLeft size={16} /> Voltar
      </button>

      {categoria && (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-teal-700">{categoria.nome}</span>
          <span className="text-teal-400">·</span>
          <span className="text-xs text-teal-600">Comprador: {categoria.comprador_nome}</span>
        </div>
      )}

      {confianca > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
          confianca >= 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <Sparkles size={13} />
          IA preencheu com {Math.round(confianca * 100)}% de confiança — revise se necessário
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Solicitante *</label>
        <input required className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none ${
          stepErrors.some(e => e.includes('solicitante')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
        }`}
          placeholder="Seu nome completo" value={solicitante} onChange={e => setSolicitante(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Obra *</label>
        <select required className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none ${
          stepErrors.some(e => e.includes('obra')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
        }`}
          value={obraNome} onChange={e => setObraNome(e.target.value)}>
          <option value="">Selecione a obra</option>
          {OBRAS.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição *</label>
        <textarea required rows={2}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none ${
            stepErrors.some(e => e.includes('descricao')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
          }`}
          placeholder="Resumo do que precisa ser comprado"
          value={descricao} onChange={e => setDescricao(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Justificativa</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Por que é necessário? Impacto se não atendido?"
          value={justificativa} onChange={e => setJustificativa(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-2 block">Urgência</label>
        <div className="flex gap-2">
          {(['normal', 'urgente', 'critica'] as const).map(u => (
            <button key={u} type="button" onClick={() => setUrgencia(u)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                urgencia === u
                  ? u === 'critica' ? 'bg-red-500 text-white border-red-500'
                  : u === 'urgente' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-teal-500 text-white border-teal-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}>
              {u === 'critica' ? 'Crítica' : u === 'urgente' ? 'Urgente' : 'Normal'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de necessidade</label>
        <input type="date"
          min={new Date().toISOString().split('T')[0]}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          value={dataNecessidade} onChange={e => setDataNecessidade(e.target.value)} />
      </div>

      {/* Itens */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-500">Itens *</label>
          <button type="button" onClick={() => setItens(p => [...p, emptyItem()])}
            className="text-teal-600 text-xs flex items-center gap-1 font-semibold">
            <PlusCircle size={13} /> Adicionar
          </button>
        </div>

        {itens.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3 mb-2 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Item {idx + 1}</span>
              {itens.length > 1 && (
                <button type="button" onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} className="text-slate-300 hover:text-red-500 transition" />
                </button>
              )}
            </div>
            <ItemAutocomplete
              value={item.descricao}
              onChange={v => updateItem(idx, 'descricao', v)}
              onSelectCatalog={cat => {
                setItens(prev => prev.map((it, i) => i === idx ? {
                  ...it,
                  descricao: cat.descricao,
                  unidade: cat.unidade,
                  valor_unitario_estimado: cat.valor_medio,
                  est_item_id: cat.id,
                  est_item_codigo: cat.codigo,
                } : it))
              }}
              categoriaRC={categoria?.codigo ?? ''}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Qtd</label>
                <input required type="number" min="0.01" step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.quantidade || ''} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Unidade</label>
                <select className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}>
                  {['un', 'par', 'jg', 'kg', 'ton', 'm', 'm²', 'm³', 'L', 'pc', 'cx', 'rl', 'hr', 'vb'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Vlr. Unit.</label>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.valor_unitario_estimado || ''} onChange={e => updateItem(idx, 'valor_unitario_estimado', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <span className="text-xs text-teal-500 font-semibold">Total estimado</span>
            <p className="text-lg font-black text-teal-700">{fmt(total)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-teal-500">Cotações mínimas</span>
            <p className="text-2xl font-black text-teal-600">{minCot}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {stepErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
            {stepErrors.map(err => (
              <p key={err} className="text-red-600 text-xs font-medium flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0" /> {err}
              </p>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            const errs: string[] = []
            if (!solicitante.trim()) errs.push('Informe o nome do solicitante')
            if (!obraNome) errs.push('Selecione a obra')
            if (!descricao.trim()) errs.push('Informe a descricao do que precisa ser comprado')
            if (itens.every(i => !i.descricao.trim())) errs.push('Adicione ao menos um item com descricao')
            if (dataNecessidade) {
              const today = new Date().toISOString().split('T')[0]
              if (dataNecessidade < today) errs.push('Data de necessidade nao pode ser no passado')
            }
            setStepErrors(errs)
            if (errs.length === 0) setStep(3)
          }}
          className="w-full bg-teal-500 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all"
        >
          Revisar e Confirmar <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )

  // ═══════════════════════════════════════
  // ETAPA 3 — Confirmar
  // ═══════════════════════════════════════
  return (
    <div className="space-y-5">
      <Stepper step={3} />
      <button onClick={() => { setStep(2); setStepErrors([]) }} className="flex items-center gap-1 text-slate-500 text-sm -mt-2">
        <ChevronLeft size={16} /> Editar
      </button>

      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Confirmar Requisição</h2>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-teal-500/10 border-b border-teal-200 px-4 py-3">
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
            <FileText size={12} /> Resumo
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-y-2.5 text-sm">
            {[
              ['Solicitante', solicitante],
              ['Obra', obraNome],
              ['Categoria', categoria?.nome ?? '—'],
              ['Comprador', categoria?.comprador_nome ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-[11px] text-slate-400">{label}</span>
                <p className="font-semibold text-slate-800">{value}</p>
              </div>
            ))}
            <div>
              <span className="text-[11px] text-slate-400">Urgência</span>
              <p className={`font-bold ${urgencia === 'critica' ? 'text-red-600' : urgencia === 'urgente' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {urgencia.charAt(0).toUpperCase() + urgencia.slice(1)}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Valor estimado</span>
              <p className="font-extrabold text-teal-700 text-base">{fmt(total)}</p>
            </div>
          </div>
          {descricao && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Descrição</span>
              <p className="text-sm text-slate-700 mt-0.5">{descricao}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100">
          <div className="px-4 py-2 bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {itens.filter(i => i.descricao).length} iten{itens.filter(i => i.descricao).length !== 1 ? 's' : ''}
            </p>
          </div>
          {itens.filter(i => i.descricao).map((item, idx) => (
            <div key={idx} className="flex justify-between items-start px-4 py-2 text-sm border-t border-slate-50">
              <span className="text-slate-700 flex-1">{item.descricao}</span>
              <span className="text-slate-500 ml-2">{item.quantidade} {item.unidade}</span>
              <span className="text-teal-700 font-bold ml-3">{fmt(item.quantidade * item.valor_unitario_estimado)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fluxo visual */}
      {categoria && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Fluxo após envio</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { label: '① Sua RC',   color: 'bg-slate-200 text-slate-700' },
              { label: `② ${total > 2000 ? 'Laucídio' : (categoria.alcada1_aprovador ?? 'Welton')} aprova`, color: 'bg-blue-100 text-blue-700' },
              { label: `③ ${categoria.comprador_nome} cota`, color: 'bg-violet-100 text-violet-700' },
              { label: '④ Aprov. Fin.', color: 'bg-indigo-100 text-indigo-700' },
              { label: '⑤ Pedido',    color: 'bg-cyan-100 text-cyan-700' },
              { label: '⑥ Entrega',   color: 'bg-teal-100 text-teal-700' },
              { label: '⑦ Pagamento', color: 'bg-emerald-100 text-emerald-700' },
            ].map((s, i) => (
              <span key={i} className={`px-2 py-1 rounded-lg font-semibold ${s.color}`}>{s.label}</span>
            ))}
          </div>
          {total > 500 && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">
                Valor {fmt(total)} exige <strong>{minCot} cotação{minCot > 1 ? 'ões' : ''}</strong> mínima{minCot > 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>
      )}

      <button onClick={submit} disabled={submitting}
        className="w-full bg-teal-500 text-white rounded-2xl py-4 font-extrabold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-teal-500/30 active:scale-[0.98] transition-all">
        {submitting
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <><Send size={18} /> Enviar Requisição</>}
      </button>

      {submitError && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">
          {submitError}
        </p>
      )}
    </div>
  )
}
