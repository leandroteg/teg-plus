import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Send, PlusCircle, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, Check, Layers, FileText, Search, Upload, FileUp,
  ChevronDown, X, FileImage, Eye, Pencil, CheckCircle2, Loader2,
  Package, MapPin, Zap, Save,
} from 'lucide-react'
import { useCriarRequisicao } from '../hooks/useRequisicoes'
import { useAiParse, readFileForAi, isBinaryFile, isImageFile } from '../hooks/useAiParse'
import { useCategorias } from '../hooks/useCategorias'
import { useLookupObras } from '../hooks/useLookups'
import { useAuth } from '../contexts/AuthContext'
import CategoryCard from '../components/CategoryCard'
import NumericInput from '../components/NumericInput'
import ItemAutocomplete from '../components/ItemAutocomplete'
import { toUpperNorm, UpperTextarea } from '../components/UpperInput'
import type { RequisicaoItem, Urgencia, AiParseResult, CategoriaMaterial } from '../types'
import { minCotacoesPorValor } from '../utils/cotacoesPolicy'


const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyItem = (): RequisicaoItem => ({
  descricao: '',
  quantidade: 1,
  unidade: 'un',
  valor_unitario_estimado: 0,
  destino_operacional: 'estoque',
})

function Stepper({ step }: { step: number }) {
  const steps = ['Categoria', 'Detalhes', 'Confirmar']
  return (
    <div className="mb-6 flex justify-center">
      <div className="flex w-full max-w-3xl items-start justify-center px-4 sm:px-6">
        {steps.map((label, i) => {
          const idx = i + 1
          const done = idx < step
          const active = idx === step
          return (
            <div key={label} className="flex min-w-0 items-center">
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
                <div className={`h-px w-24 sm:w-40 md:w-52 mx-3 sm:mx-5 mt-[-12px] ${done ? 'bg-teal-400' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>
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

function buildResumoRequisicao(itens: RequisicaoItem[], detalhes: string) {
  if (detalhes.trim()) return toUpperNorm(detalhes.trim())

  const descricoes = itens
    .map((item) => item.descricao.trim())
    .filter(Boolean)

  if (descricoes.length === 0) return 'SOLICITACAO DE COMPRA'
  if (descricoes.length === 1) return descricoes[0]
  if (descricoes.length === 2) return `${descricoes[0]} e ${descricoes[1]}`
  return `${descricoes[0]}, ${descricoes[1]} e mais ${descricoes.length - 2} item(ns)`
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function NovaRequisicao() {
  const nav = useNavigate()
  const mutation = useCriarRequisicao()
  const aiParse = useAiParse()
  const { data: categorias = [], isLoading: catLoading } = useCategorias()
  const obras = useLookupObras()
  const { perfil } = useAuth()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenciaInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep]                 = useState(1)
  const [searchCat, setSearchCat]       = useState('')
  const [showAiHelper, setShowAiHelper] = useState(false)
  const [textoAi, setTextoAi]           = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [referenciaFile, setReferenciaFile] = useState<File | null>(null)
  const [dragOver, setDragOver]         = useState(false)

  const [categoria, setCategoria]           = useState<CategoriaMaterial | null>(null)
  const [solicitante, setSolicitante]       = useState(perfil?.nome ?? '')
  const [obraId, setObraId]                 = useState('')
  const obraNome = obras.find(o => o.id === obraId)?.nome ?? ''
  const [descricao, setDescricao]           = useState('')
  const [justificativa, setJustificativa]   = useState('')
  const [urgencia, setUrgencia]             = useState<Urgencia>('normal')
  const [justificativaUrgencia, setJustificativaUrgencia] = useState('')
  const [dataNecessidade, setDataNecessidade] = useState('')
  const [compraRecorrente, setCompraRecorrente] = useState(false)
  const [valorMensal, setValorMensal] = useState('')
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
  const minCot = categoria ? minCotacoesPorValor(total, categoria.cotacoes_regras) : 1

  // ── Prefill from SuperTEG (sessionStorage) ──────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('superteg-prefill-rc')
      if (!raw) return
      sessionStorage.removeItem('superteg-prefill-rc')
      const pf = JSON.parse(raw)


      // Clean item names: remove leading verbs/articles ("Fornecimento de" → keep noun)
      const cleanName = (s: string) =>
        s.replace(/^(fornecimento|contrata[cç][aã]o|presta[cç][aã]o|aquisi[cç][aã]o|servi[cç]os?)\s+d[eao]s?\s+/i, '')
         .replace(/^(o|a|os|as|um|uma|uns|umas|de|do|da|dos|das)\s+/i, '')
         .trim()

      // Apply extracted items from parse-cotacao
      const fornecedores = pf.fornecedores as Array<{ nome_fornecedor?: string; itens?: RequisicaoItem[] }> | undefined
      if (fornecedores?.length && fornecedores[0]?.itens?.length) {
        const rawItens = fornecedores[0].itens.map((it: any) => ({
          descricao: toUpperNorm(cleanName(String(it.descricao ?? it.nome ?? '').trim())),
          quantidade: parseFloat(String(it.quantidade ?? it.qtd ?? 1)) || 1,
          unidade: String(it.unidade ?? 'un').toLowerCase(),
          valor_unitario_estimado: parseFloat(String(it.valor_unitario ?? it.valor_unitario_estimado ?? 0)) || 0,
        })).filter((it: RequisicaoItem) => it.descricao.length > 0)
        if (rawItens.length > 0) setItens(rawItens)

        // Build smart description from item names
        const nomes = rawItens.map((it: RequisicaoItem) => it.descricao)
        const desc = nomes.length <= 3
          ? nomes.join(', ')
          : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2} item(ns)`
        const fornNome = fornecedores[0].nome_fornecedor
        setDescricao(toUpperNorm(fornNome ? `${desc} - ${fornNome}` : desc))

        // User message goes to justificativa only if it's not just the filename
        if (pf.mensagem_usuario && !pf.mensagem_usuario.includes(pf.cotacao_referencia_nome || '___')) {
          setJustificativa(toUpperNorm(pf.mensagem_usuario))
        }

        // Skip to step 2 (Detalhes) since items are already filled
        setStep(2)
      } else {
        // No items extracted — just fill description
        if (pf.descricao) setDescricao(toUpperNorm(pf.descricao))
        if (pf.mensagem_usuario) setJustificativa(toUpperNorm(pf.mensagem_usuario))
      }
    } catch { /* ignore parse errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        descricao: toUpperNorm(String(item.descricao ?? '').trim()),
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

    // Match obra_sugerida against obras list (accent-insensitive)
    if (result.obra_sugerida) {
      const sugerida = result.obra_sugerida.trim()
      const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const obraMatch = obras.find(o =>
        o.nome === sugerida ||
        normalizeStr(o.nome) === normalizeStr(sugerida) ||
        normalizeStr(o.nome).includes(normalizeStr(sugerida)) ||
        normalizeStr(sugerida).includes(normalizeStr(o.nome))
      )
      if (obraMatch) setObraId(obraMatch.id)
    }

    // Validate urgencia before setting
    if (result.urgencia_sugerida && ['normal', 'urgente', 'critica'].includes(result.urgencia_sugerida)) {
      setUrgencia(result.urgencia_sugerida)
    }

    if (result.justificativa_sugerida)  setJustificativa(toUpperNorm(String(result.justificativa_sugerida)))
    if (result.comprador_sugerido)      setCompradorSugerido(result.comprador_sugerido)
    if (result.categoria_sugerida) {
      const catEncontrada = categorias.find(c =>
        c.codigo === result.categoria_sugerida ||
        c.nome.toLowerCase().includes((result.categoria_sugerida ?? '').toLowerCase())
      )
      if (catEncontrada) setCategoria(catEncontrada)
    }
    setConfianca(typeof result.confianca === 'number' ? result.confianca : 0.5)
    if (!descricao.trim()) setDescricao(toUpperNorm(textoOriginal || `Requisicao processada via IA (${parsedItens.length} itens)`))
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
            if (!descricao.trim()) setDescricao(toUpperNorm(`Itens importados de ${selectedFile.name} (${csvItems.length} itens)`))
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
  const [savingDraft, setSavingDraft] = useState(false)
  const urgente = urgencia !== 'normal'

  const buildPayload = (rascunho = false) => ({
    solicitante_nome: solicitante,
    obra_nome:        obraNome,
    obra_id:          obraId || undefined,
    descricao:        buildResumoRequisicao(itens, descricao),
    justificativa:     toUpperNorm(justificativa),
    urgencia,
    justificativa_urgencia: urgencia !== 'normal' ? toUpperNorm(justificativaUrgencia) : undefined,
    categoria:        categoria?.codigo,
    itens:             itens.map(item => ({ ...item, descricao: toUpperNorm(item.descricao) })),
    data_necessidade: dataNecessidade || undefined,
    texto_original:   textoAi || undefined,
    comprador_id:     compradorSugerido?.id,
    ai_confianca:     confianca,
    arquivo_referencia: referenciaFile || undefined,
    compra_recorrente: compraRecorrente,
    valor_mensal: undefined, // preenchido na etapa de cotação
    rascunho,
  })

  const submit = async () => {
    if (!justificativa.trim()) {
      setSubmitError('Preencha o Motivo da compra antes de enviar.')
      return
    }
    if (urgencia !== 'normal' && !justificativaUrgencia.trim()) {
      setSubmitError('Preencha a justificativa de urgência antes de enviar.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await mutation.mutateAsync(buildPayload(false))
      nav('/requisicoes')
    } catch (err) {
      const msg = (err as Error)?.message || 'Erro ao enviar. Tente novamente.'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const saveDraft = async () => {
    setSubmitError(null)
    setSavingDraft(true)
    try {
      await mutation.mutateAsync(buildPayload(true))
      nav('/requisicoes')
    } catch (err) {
      const msg = (err as Error)?.message || 'Erro ao salvar rascunho. Tente novamente.'
      setSubmitError(msg)
    } finally {
      setSavingDraft(false)
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
          <div className="border-t border-teal-100 dark:border-teal-900 bg-teal-50 dark:bg-slate-800 px-4 py-3 space-y-2.5">
            <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider">Fluxo desta Categoria</p>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-teal-500 dark:text-teal-400">Comprador</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">{categoria.comprador_nome ?? '—'}</p>
              </div>
              <div>
                <span className="text-teal-500 dark:text-teal-400">Aprovação ≤R$2k</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">{categoria.alcada1_aprovador ?? 'Welton'}</p>
              </div>
              <div>
                <span className="text-teal-500 dark:text-teal-400">Aprovação &gt;R$2k</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">Laucídio</p>
              </div>
              <div>
                <span className="text-teal-500 dark:text-teal-400">Cotações mínimas</span>
                <p className="font-bold text-slate-700 dark:text-slate-200">≤R$500: 1 · ≤R$2k: 2 · &gt;R$2k: 3</p>
              </div>
            </div>
            {categoria.politica_resumo && (
              <div className="bg-white dark:bg-slate-700 rounded-xl p-2.5 border border-teal-100 dark:border-slate-600">
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-teal-700 dark:text-teal-400">Política: </span>{categoria.politica_resumo}
                </p>
              </div>
            )}
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
          IA preencheu com {Math.round(confianca * 100)}% de confianca - revise se necessario
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Solicitante</label>
        <input disabled className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600 cursor-not-allowed outline-none opacity-100"
          value={solicitante} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Motivo <span className="text-red-400">*</span></label>
        <UpperTextarea rows={3} required
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Por que essa compra é necessária? Para qual finalidade?"
          value={justificativa} onChange={e => setJustificativa(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Refer&ecirc;ncia de cota&ccedil;&atilde;o</label>
        <div
          className={`rounded-2xl border-2 border-dashed p-4 transition-all cursor-pointer ${
            referenciaFile
              ? 'border-teal-300 bg-teal-50/40'
              : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20'
          }`}
          onClick={() => referenciaInputRef.current?.click()}
        >
          <input
            ref={referenciaInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setReferenciaFile(file)
              // Auto-parse: lê itens com IA automaticamente ao anexar
              try {
                const fileData = await readFileForAi(file)
                const result = await aiParse.mutateAsync({
                  texto: fileData.texto ?? '',
                  solicitante_nome: solicitante,
                  arquivo: fileData.arquivo,
                })
                if (result.itens?.length > 0) {
                  setItens(sanitizeItems(result.itens))
                  if (typeof result.confianca === 'number') setConfianca(result.confianca)
                }
              } catch { /* erro silencioso — usuário pode preencher manualmente */ }
            }}
          />

          {referenciaFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm">
                    <FileUp size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{referenciaFile.name}</p>
                    <p className="text-[11px] text-slate-400">{(referenciaFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {aiParse.isPending && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-2.5 py-1">
                      <Loader2 size={12} className="animate-spin" /> Lendo itens...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setReferenciaFile(null)
                      if (referenciaInputRef.current) referenciaInputRef.current.value = ''
                    }}
                    className="rounded-full bg-white p-2 text-slate-400 transition hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                <Upload size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Anexar refer&ecirc;ncia de cota&ccedil;&atilde;o</p>
                <p className="text-[11px] text-slate-400">PDF, planilha, imagem ou documento de apoio.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Obra *</label>
          <select required className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none ${
            stepErrors.some(e => e.includes('obra')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
          }`}
            value={obraId} onChange={e => setObraId(e.target.value)}>
            <option value="">Selecione a obra</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>)}
          </select>
          {(() => { const o = obras.find(x => x.id === obraId); return o?.centro_custo_id ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5">
              <span className="font-bold">CC preenchido automaticamente:</span>
              <span className="font-mono font-semibold">{o.centro_custo_codigo}</span>
              {o.centro_custo_descricao && <span className="text-teal-500">— {o.centro_custo_descricao}</span>}
            </p>
          ) : null })()}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de necessidade</label>
          <input type="date"
            min={new Date().toISOString().split('T')[0]}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
            value={dataNecessidade} onChange={e => setDataNecessidade(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block">Urgente</label>
            <p className="text-[11px] text-slate-400 mt-0.5">Sinaliza prioridade para atendimento.</p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { label: 'Não', value: false },
            { label: 'Sim', value: true },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setUrgencia(option.value ? 'urgente' : 'normal')}
              className={`min-w-[72px] rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                urgente === option.value
                  ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
          </div>
        </div>

        <div className={`rounded-2xl border px-4 py-3 space-y-3 ${
        compraRecorrente ? 'border-indigo-200 bg-indigo-50/60' : 'border-red-300 bg-red-100'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 block">Compra/Serviço Recorrente</label>
            <p className="text-xs text-slate-500 mt-1">
              Esta solicitação passará pela área de Contratos para formalização
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              { label: 'Nao', value: false },
              { label: 'Sim', value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  setCompraRecorrente(option.value)
                  if (!option.value) setValorMensal('')
                }}
                className={`min-w-[72px] rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  compraRecorrente === option.value
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        </div>
      </div>

      {/* Justificativa de urgência (linha separada abaixo do grid) */}
      {urgencia !== 'normal' && (
        <div className={`rounded-2xl border px-4 py-3 ${
          urgencia === 'critica' ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'
        }`}>
          <label className={`text-xs font-semibold block mb-1.5 ${
            urgencia === 'critica' ? 'text-red-600' : 'text-amber-600'
          }`}>
            Justificativa de urgência *
          </label>
          <UpperTextarea
            rows={2}
            required
            className={`w-full border rounded-xl px-3 py-2 text-sm outline-none transition-all ${
              urgencia === 'critica'
                ? 'border-red-300 bg-white focus:ring-2 focus:ring-red-300 placeholder:text-red-300'
                : 'border-amber-300 bg-white focus:ring-2 focus:ring-amber-300 placeholder:text-amber-300'
            }`}
            placeholder="Explique o motivo da urgência desta requisição..."
            value={justificativaUrgencia}
            onChange={e => setJustificativaUrgencia(e.target.value)}
          />
        </div>
      )}

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
                  <Trash2 size={14} className="text-red-400 hover:text-red-600 transition" />
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
                  classe_financeira_id: cat.classe_financeira_id,
                  classe_financeira_codigo: cat.classe_financeira_codigo,
                  classe_financeira_descricao: cat.classe_financeira_descricao,
                  categoria_financeira_codigo: cat.categoria_financeira_codigo,
                  categoria_financeira_descricao: cat.categoria_financeira_descricao,
                  destino_operacional: cat.destino_operacional ?? 'estoque',
                } : it))
              }}
              categoriaRC={categoria?.codigo ?? ''}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Qtd</label>
                <NumericInput required min={0.01} step={0.01}
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.quantidade} onChange={v => updateItem(idx, 'quantidade', v)} />
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
                <NumericInput min={0} step={0.01}
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.valor_unitario_estimado} onChange={v => updateItem(idx, 'valor_unitario_estimado', v)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Detalhes adicionais</label>
        <UpperTextarea rows={3}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Informações complementares para a compra, entrega ou especificação."
          value={descricao} onChange={e => setDescricao(e.target.value)} />
      </div>

      {total > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <span className="text-xs text-teal-500 font-semibold">Total estimado</span>
            <p className="text-lg font-black text-teal-700">{fmt(total)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-teal-500">Cotações mínimas</span>
            <p className="text-2xl font-black text-teal-600">
              {minCot}
            </p>
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
        <div className="flex gap-3">
          <button
            onClick={saveDraft}
            disabled={savingDraft || submitting || (!solicitante.trim() && itens.every(i => !i.descricao.trim()))}
            className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            {savingDraft
              ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <><Save size={15} /> Salvar Rascunho</>}
          </button>

          <button
            onClick={() => {
              const errs: string[] = []
              if (!solicitante.trim()) errs.push('Informe o nome do solicitante')
              if (!obraNome) errs.push('Selecione a obra')
              if (itens.every(i => !i.descricao.trim())) errs.push('Adicione ao menos um item com descricao')
              // valor mensal agora é preenchido na etapa de cotação, não na requisição
              if (dataNecessidade) {
                const today = new Date().toISOString().split('T')[0]
                if (dataNecessidade < today) errs.push('Data de necessidade nao pode ser no passado')
              }
              setStepErrors(errs)
              if (errs.length === 0) setStep(3)
            }}
            className="flex-[2] bg-teal-500 text-white rounded-2xl py-3 font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all"
          >
            Revisar e Confirmar <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  if (step === -2) return (
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
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Solicitante</label>
        <input disabled className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-600 cursor-not-allowed outline-none opacity-100"
          value={solicitante} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Obra *</label>
        <select required className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none ${
          stepErrors.some(e => e.includes('obra')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
        }`}
          value={obraId} onChange={e => setObraId(e.target.value)}>
          <option value="">Selecione a obra</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} - ` : ''}{o.nome}</option>)}
        </select>
        {(() => { const o = obras.find(x => x.id === obraId); return o?.centro_custo_id ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2.5 py-1.5">
            <span className="font-bold">CC preenchido automaticamente:</span>
            <span className="font-mono font-semibold">{o.centro_custo_codigo}</span>
            {o.centro_custo_descricao && <span className="text-teal-500">— {o.centro_custo_descricao}</span>}
          </p>
        ) : null })()}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição *</label>
          <UpperTextarea rows={3}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none ${
            stepErrors.some(e => e.includes('descricao')) ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
          }`}
          placeholder="Informacoes complementares para a compra, entrega ou especificacao."
          value={descricao} onChange={e => setDescricao(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Motivo <span className="text-red-400">*</span></label>
        <UpperTextarea rows={3} required
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Por que essa compra é necessária? Para qual finalidade?"
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

        {/* Justificativa de urgência (aparece quando urgência != normal) */}
        {urgencia !== 'normal' && (
          <div className="mt-3">
            <label className={`text-xs font-semibold mb-1 block ${urgencia === 'critica' ? 'text-red-600' : 'text-amber-600'}`}>
              Justificativa de urgência <span className="text-red-400">*</span>
            </label>
            <UpperTextarea
              rows={2}
              required
              className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all ${
                urgencia === 'critica'
                  ? 'border-red-300 bg-red-50/50 focus:ring-2 focus:ring-red-300 placeholder:text-red-300'
                  : 'border-amber-300 bg-amber-50/50 focus:ring-2 focus:ring-amber-300 placeholder:text-amber-300'
              }`}
              placeholder="Explique o motivo da urgência desta requisição..."
              value={justificativaUrgencia}
              onChange={e => setJustificativaUrgencia(e.target.value)}
            />
          </div>
        )}
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
                  <Trash2 size={14} className="text-red-400 hover:text-red-600 transition" />
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
                  classe_financeira_id: cat.classe_financeira_id,
                  classe_financeira_codigo: cat.classe_financeira_codigo,
                  classe_financeira_descricao: cat.classe_financeira_descricao,
                  categoria_financeira_codigo: cat.categoria_financeira_codigo,
                  categoria_financeira_descricao: cat.categoria_financeira_descricao,
                  destino_operacional: cat.destino_operacional ?? 'estoque',
                } : it))
              }}
              categoriaRC={categoria?.codigo ?? ''}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Qtd</label>
                <NumericInput required min={0.01} step={0.01}
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.quantidade} onChange={v => updateItem(idx, 'quantidade', v)} />
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
                <NumericInput min={0} step={0.01}
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.valor_unitario_estimado} onChange={v => updateItem(idx, 'valor_unitario_estimado', v)} />
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
        <div className="flex gap-3">
          <button
            onClick={saveDraft}
            disabled={savingDraft || submitting || (!solicitante.trim() && itens.every(i => !i.descricao.trim()))}
            className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            {savingDraft
              ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              : <><Save size={15} /> Salvar Rascunho</>}
          </button>

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
            className="flex-[2] bg-teal-500 text-white rounded-2xl py-3 font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all"
          >
            Revisar e Confirmar <ChevronRight size={16} />
          </button>
        </div>
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
              ['Fluxo', compraRecorrente ? 'Contratos' : 'Pedidos'],
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
              {urgencia !== 'normal' && justificativaUrgencia && (
                <p className={`text-xs mt-0.5 italic ${urgencia === 'critica' ? 'text-red-500' : 'text-amber-500'}`}>
                  {justificativaUrgencia}
                </p>
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Valor estimado</span>
              <p className="font-extrabold text-teal-700 text-base">{fmt(total)}</p>
            </div>
            {compraRecorrente && (
              <div>
                <span className="text-[11px] text-slate-400">Tipo</span>
                <p className="font-extrabold text-indigo-700 text-base">Recorrente</p>
              </div>
            )}
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
          {compraRecorrente && (
            <div className="mt-3 flex items-start gap-2 bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-2.5">
              <AlertCircle size={13} className="text-fuchsia-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-fuchsia-700">
                Depois da aprovacao financeira, a RC segue para <strong>Contratos &gt; Elaboracao</strong> e o pedido volta com o contrato vinculado.
              </p>
            </div>
          )}
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

      <div className="flex gap-3">
        <button onClick={saveDraft} disabled={savingDraft || submitting}
          className="flex-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-200 active:scale-[0.98] transition-all">
          {savingDraft
            ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            : <><Save size={16} /> Salvar Rascunho</>}
        </button>

        <button onClick={submit} disabled={submitting || savingDraft}
          className="flex-[2] bg-teal-500 text-white rounded-2xl py-3.5 font-extrabold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-teal-500/30 active:scale-[0.98] transition-all">
          {submitting
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <><Send size={18} /> Enviar Requisição</>}
        </button>
      </div>

      {submitError && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">
          {submitError}
        </p>
      )}
    </div>
  )
}
