import { useState, useRef, useCallback, useMemo } from 'react'
import {
  FileText, Search, Download, Upload, X, Check, Loader2,
  Package, CreditCard, FileSignature, PenLine, Calendar,
  CheckSquare, Square, SquareCheck, Trash2, AlertTriangle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useNotasFiscais, useNfResumo, useUploadNF,
  useDeleteNF, useParseNF, useDownloadZip,
} from '../../hooks/useNotasFiscais'
import {
  useCadCentrosCusto, useCadClasses, useCadEmpresas,
  useCadObras, useCadFornecedores,
} from '../../hooks/useCadastros'
import type { NotaFiscal, NotaFiscalFilters, OrigemNF } from '../../types/fiscal'

// ── Formatters ──────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })

// ── Constants ───────────────────────────────────────────────────────────────

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Marco' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

const ORIGEM_CONFIG: Record<OrigemNF, {
  label: string; icon: typeof Package
  bg: string; text: string; border: string
  darkBg: string; darkText: string; darkBorder: string
}> = {
  pedido: {
    label: 'Pedido', icon: Package,
    bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200',
    darkBg: 'bg-blue-500/10', darkText: 'text-blue-400', darkBorder: 'border-blue-500/20',
  },
  cp: {
    label: 'CP', icon: CreditCard,
    bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200',
    darkBg: 'bg-emerald-500/10', darkText: 'text-emerald-400', darkBorder: 'border-emerald-500/20',
  },
  contrato: {
    label: 'Contrato', icon: FileSignature,
    bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200',
    darkBg: 'bg-violet-500/10', darkText: 'text-violet-400', darkBorder: 'border-violet-500/20',
  },
  avulso: {
    label: 'Avulso', icon: PenLine,
    bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200',
    darkBg: 'bg-amber-500/10', darkText: 'text-amber-400', darkBorder: 'border-amber-500/20',
  },
}

// ── Origin Badge ────────────────────────────────────────────────────────────

function OrigemBadge({ origem, isDark }: { origem: OrigemNF; isDark: boolean }) {
  const cfg = ORIGEM_CONFIG[origem]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border transition-colors ${
      isDark
        ? `${cfg.darkBg} ${cfg.darkText} ${cfg.darkBorder}`
        : `${cfg.bg} ${cfg.text} ${cfg.border}`
    }`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 animate-pulse ${
      isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className={`h-4 rounded w-48 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-4 rounded w-24 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          </div>
          <div className="flex gap-2">
            <div className={`h-3 rounded w-20 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-3 rounded w-28 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-3 rounded w-16 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NF Card ─────────────────────────────────────────────────────────────────

function NFCard({
  nf, isDark, selected, onToggle, onDelete,
}: {
  nf: NotaFiscal
  isDark: boolean
  selected: boolean
  onToggle: () => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={`group rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-md ${
      selected
        ? isDark
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : 'border-emerald-300 bg-emerald-50/30'
        : isDark
          ? 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
          : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      <div className="p-4 flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-0.5 shrink-0 transition-colors ${
            selected
              ? 'text-emerald-500'
              : isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
          }`}
        >
          {selected ? <SquareCheck size={18} /> : <Square size={18} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Line 1: NF number + fornecedor + valor */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm font-bold truncate ${
                isDark ? 'text-slate-100' : 'text-slate-800'
              }`}>
                NF {nf.numero || '---'}
              </span>
              {nf.fornecedor_nome && (
                <span className={`text-xs truncate hidden sm:inline ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {nf.fornecedor_nome}
                </span>
              )}
              {!nf.fornecedor_nome && nf.fornecedor?.razao_social && (
                <span className={`text-xs truncate hidden sm:inline ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {nf.fornecedor.razao_social}
                </span>
              )}
            </div>
            <span className={`text-sm font-extrabold shrink-0 ${
              isDark ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {fmt(nf.valor_total)}
            </span>
          </div>

          {/* Fornecedor on mobile (visible on small) */}
          {(nf.fornecedor_nome || nf.fornecedor?.razao_social) && (
            <p className={`text-[11px] truncate sm:hidden mb-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {nf.fornecedor_nome || nf.fornecedor?.razao_social}
            </p>
          )}

          {/* Line 2: date + centro custo + classe + origem */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className={`flex items-center gap-1 ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <Calendar size={10} />
              {fmtDate(nf.data_emissao)}
            </span>

            {nf.centro_custo?.descricao && (
              <span className={`font-medium ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {nf.centro_custo.descricao}
              </span>
            )}

            {nf.classe?.descricao && (
              <span className={isDark ? 'text-violet-400' : 'text-violet-500'}>
                {nf.classe.descricao}
              </span>
            )}

            <OrigemBadge origem={nf.origem} isDark={isDark} />

            {nf.serie && (
              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>
                Serie {nf.serie}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Delete button (confirm flow) */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(nf.id); setConfirmDelete(false) }}
                className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
                title="Confirmar exclusao"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className={`p-1.5 rounded-lg transition-all ${
                  isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Cancelar"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                isDark
                  ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                  : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
              }`}
              title="Excluir NF"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Download PDF */}
          {nf.pdf_url && (
            <a
              href={nf.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-1.5 rounded-lg transition-all ${
                isDark
                  ? 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              title="Baixar PDF"
            >
              <Download size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Upload Modal ────────────────────────────────────────────────────────────

interface UploadFormData {
  numero: string
  serie: string
  fornecedor_id: string
  valor_total: string
  data_emissao: string
  empresa_id: string
  centro_custo_id: string
  obra_id: string
  classe_id: string
  origem: OrigemNF
  observacoes: string
}

const EMPTY_FORM: UploadFormData = {
  numero: '', serie: '1', fornecedor_id: '', valor_total: '',
  data_emissao: new Date().toISOString().split('T')[0],
  empresa_id: '', centro_custo_id: '', obra_id: '', classe_id: '',
  origem: 'avulso', observacoes: '',
}

function UploadModal({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState<UploadFormData>(EMPTY_FORM)
  const [step, setStep] = useState<'drop' | 'parsing' | 'form'>('drop')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: fornecedores = [] } = useCadFornecedores()
  const { data: empresas = [] } = useCadEmpresas()
  const { data: centros = [] } = useCadCentrosCusto()
  const { data: obras = [] } = useCadObras()
  const { data: classes = [] } = useCadClasses()
  const parseNF = useParseNF()
  const uploadNF = useUploadNF()

  const set = (key: keyof UploadFormData, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setError('')
    setStep('parsing')

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || result)
        }
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
        reader.readAsDataURL(f)
      })

      const parsed = await parseNF.mutateAsync({ arquivo: base64, nome: f.name })

      // Pre-fill form with parsed data
      setForm(prev => ({
        ...prev,
        numero: parsed.numero || prev.numero,
        serie: parsed.serie || prev.serie,
        valor_total: parsed.valor_total?.toString() || prev.valor_total,
        data_emissao: parsed.data_emissao || prev.data_emissao,
      }))

      // Try to match fornecedor by CNPJ
      if (parsed.cnpj_emitente) {
        const cleanCnpj = parsed.cnpj_emitente.replace(/\D/g, '')
        const match = fornecedores.find(f => f.cnpj?.replace(/\D/g, '') === cleanCnpj)
        if (match) {
          setForm(prev => ({ ...prev, fornecedor_id: match.id }))
        }
      }

      setStep('form')
    } catch {
      // AI parse failed -- go straight to manual form
      setStep('form')
    }
  }, [parseNF, fornecedores])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleSave = async () => {
    if (!file) { setError('Selecione um arquivo PDF'); return }
    if (!form.numero.trim()) { setError('Numero da NF obrigatorio'); return }
    if (!form.valor_total) { setError('Valor total obrigatorio'); return }

    setError('')
    try {
      await uploadNF.mutateAsync({
        file,
        dados: {
          numero: form.numero.trim(),
          serie: form.serie.trim() || '1',
          fornecedor_id: form.fornecedor_id || undefined,
          valor_total: parseFloat(form.valor_total),
          valor_desconto: 0,
          valor_liquido: parseFloat(form.valor_total),
          data_emissao: form.data_emissao,
          empresa_id: form.empresa_id || undefined,
          centro_custo_id: form.centro_custo_id || undefined,
          obra_id: form.obra_id || undefined,
          classe_id: form.classe_id || undefined,
          origem: form.origem,
          observacoes: form.observacoes.trim() || undefined,
        },
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar NF')
    }
  }

  // Shared styles
  const cardBg = isDark ? 'bg-slate-800' : 'bg-white'
  const labelCls = `text-[11px] font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
    isDark
      ? 'bg-slate-900/60 border-slate-700 text-slate-200 placeholder-slate-600'
      : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
  }`
  const selectCls = `${inputCls} appearance-none cursor-pointer`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
          isDark ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-emerald-500" />
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Upload de Nota Fiscal
            </h3>
          </div>
          <button onClick={onClose} className={isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Step: Dropzone */}
          {step === 'drop' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 py-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                dragOver
                  ? isDark
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-emerald-400 bg-emerald-50'
                  : isDark
                    ? 'border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
              }`}>
                <Upload size={24} className={isDark ? 'text-emerald-400' : 'text-emerald-500'} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Arraste o PDF aqui ou clique para selecionar
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  PDF, XML ou imagem. AI ira extrair os dados automaticamente.
                </p>
              </div>
            </div>
          )}

          {/* Step: Parsing */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="relative">
                <div className="w-12 h-12 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileText size={16} className="text-emerald-500" />
                </div>
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Processando com AI...
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {file?.name}
                </p>
              </div>
            </div>
          )}

          {/* Step: Form */}
          {step === 'form' && (
            <>
              {/* File indicator */}
              {file && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <FileText size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                  <span className={`text-xs font-semibold truncate ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {file.name}
                  </span>
                  <span className={`text-[10px] ml-auto ${isDark ? 'text-emerald-500' : 'text-emerald-500'}`}>
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              )}

              {/* Row: Numero + Serie */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Numero *</label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={e => set('numero', e.target.value)}
                    placeholder="000123"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Serie</label>
                  <input
                    type="text"
                    value={form.serie}
                    onChange={e => set('serie', e.target.value)}
                    placeholder="1"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Fornecedor */}
              <div>
                <label className={labelCls}>Fornecedor</label>
                <select
                  value={form.fornecedor_id}
                  onChange={e => set('fornecedor_id', e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecionar fornecedor...</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.razao_social}{f.cnpj ? ` (${f.cnpj})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row: Valor + Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valor_total}
                    onChange={e => set('valor_total', e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Data Emissao *</label>
                  <input
                    type="date"
                    value={form.data_emissao}
                    onChange={e => set('data_emissao', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Empresa */}
              <div>
                <label className={labelCls}>Empresa</label>
                <select
                  value={form.empresa_id}
                  onChange={e => set('empresa_id', e.target.value)}
                  className={selectCls}
                >
                  <option value="">Selecionar empresa...</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.razao_social}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row: Centro Custo + Obra */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Centro de Custo</label>
                  <select
                    value={form.centro_custo_id}
                    onChange={e => set('centro_custo_id', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Selecionar...</option>
                    {centros.map(cc => (
                      <option key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.descricao}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Obra</label>
                  <select
                    value={form.obra_id}
                    onChange={e => set('obra_id', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Selecionar...</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.codigo} - {o.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Classe + Origem */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Classe Financeira</label>
                  <select
                    value={form.classe_id}
                    onChange={e => set('classe_id', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Selecionar...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} - {c.descricao}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Origem</label>
                  <select
                    value={form.origem}
                    onChange={e => set('origem', e.target.value as OrigemNF)}
                    className={selectCls}
                  >
                    <option value="avulso">Avulso</option>
                    <option value="pedido">Pedido</option>
                    <option value="cp">Conta a Pagar</option>
                    <option value="contrato">Contrato</option>
                  </select>
                </div>
              </div>

              {/* Observacoes */}
              <div>
                <label className={labelCls}>Observacoes</label>
                <textarea
                  value={form.observacoes}
                  onChange={e => set('observacoes', e.target.value)}
                  placeholder="Observacoes adicionais..."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2 border ${
              isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
            }`}>
              <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
              <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-700'}`}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className={`flex gap-2 px-5 py-4 border-t shrink-0 ${
            isDark ? 'border-slate-700' : 'border-slate-100'
          }`}>
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-700/50'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={uploadNF.isPending}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold
                hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2
                shadow-sm shadow-emerald-600/20"
            >
              {uploadNF.isPending
                ? <Loader2 size={15} className="animate-spin" />
                : <Check size={15} />}
              Salvar
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.xml,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleSelectFile}
        />
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function NotasFiscais() {
  const { isDark } = useTheme()
  const now = new Date()

  // ── Filters ─────────────────────────────────────────────────────────────
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [ccFilter, setCcFilter] = useState('')
  const [busca, setBusca] = useState('')

  const filters: NotaFiscalFilters = useMemo(() => ({
    mes,
    ano,
    centro_custo_id: ccFilter || undefined,
    busca: busca.trim() || undefined,
  }), [mes, ano, ccFilter, busca])

  const { data: notas = [], isLoading } = useNotasFiscais(filters)
  const { total, count } = useNfResumo(notas)
  const { data: centros = [] } = useCadCentrosCusto()

  // ── Selection ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allSelected = notas.length > 0 && selected.size === notas.length

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(notas.map(n => n.id)))
    }
  }

  // ── Mutations ───────────────────────────────────────────────────────────
  const deleteNF = useDeleteNF()
  const downloadZip = useDownloadZip()
  const [showUpload, setShowUpload] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const handleDelete = (id: string) => {
    deleteNF.mutate(id, {
      onSuccess: () => {
        setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
        showToast('success', 'Nota fiscal excluida')
      },
      onError: () => showToast('error', 'Erro ao excluir nota'),
    })
  }

  const handleDownloadZip = async () => {
    const ids = selected.size > 0 ? Array.from(selected) : notas.map(n => n.id)
    if (ids.length === 0) return

    try {
      const blob = await downloadZip.mutateAsync(ids)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notas-fiscais-${ano}-${String(mes).padStart(2, '0')}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('success', `Download de ${ids.length} nota(s) iniciado`)
    } catch {
      showToast('error', 'Erro ao gerar ZIP')
    }
  }

  // ── Year range for selector ─────────────────────────────────────────────
  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 animate-[slideDown_0.3s_ease] ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
            : 'bg-red-500 text-white shadow-red-500/30'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}>
            <FileText size={20} className="text-emerald-500" />
            Notas Fiscais
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Repositorio de notas -- organizar e baixar
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white
            text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20
            shrink-0"
        >
          <Upload size={15} />
          <span className="hidden sm:inline">Upload NF</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Month */}
        <select
          value={mes}
          onChange={e => setMes(Number(e.target.value))}
          className={`rounded-xl border px-3 py-2 text-sm transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
            isDark
              ? 'bg-slate-800/60 border-slate-700 text-slate-200'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          {MESES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={ano}
          onChange={e => setAno(Number(e.target.value))}
          className={`rounded-xl border px-3 py-2 text-sm transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
            isDark
              ? 'bg-slate-800/60 border-slate-700 text-slate-200'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Centro de Custo */}
        <select
          value={ccFilter}
          onChange={e => setCcFilter(e.target.value)}
          className={`rounded-xl border px-3 py-2 text-sm transition-all duration-200 min-w-0 sm:max-w-[200px]
            focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
            isDark
              ? 'bg-slate-800/60 border-slate-700 text-slate-200'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <option value="">Todos os CCs</option>
          {centros.map(cc => (
            <option key={cc.id} value={cc.id}>
              {cc.codigo} - {cc.descricao}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar numero, fornecedor..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 ${
              isDark
                ? 'bg-slate-800/60 border-slate-700 text-slate-200 placeholder-slate-600'
                : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* ── Summary bar ──────────────────────────────────────── */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
        isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          {/* Select all */}
          <button
            onClick={toggleAll}
            disabled={notas.length === 0}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${
              allSelected
                ? 'text-emerald-500'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            {allSelected ? 'Desmarcar' : 'Selecionar'}
          </button>

          {/* Count + total */}
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {count} {count === 1 ? 'nota' : 'notas'}
            <span className={isDark ? 'text-slate-500' : 'text-slate-400'}> &bull; </span>
            <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>{fmt(total)}</span>
          </span>

          {selected.size > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {selected.size} selecionada{selected.size > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={downloadZip.isPending || notas.length === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all
            disabled:opacity-40 disabled:cursor-not-allowed ${
            isDark
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {downloadZip.isPending
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />}
          {downloadZip.isPending ? 'Gerando...' : 'Baixar ZIP'}
        </button>
      </div>

      {/* ── NF List ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} isDark={isDark} />)}
        </div>
      ) : notas.length === 0 ? (
        <div className="text-center py-20">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
          }`}>
            <FileText size={28} className={isDark ? 'text-emerald-500/40' : 'text-emerald-300'} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhuma nota encontrada
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Ajuste os filtros ou faca upload de uma nova NF
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notas.map(nf => (
            <NFCard
              key={nf.id}
              nf={nf}
              isDark={isDark}
              selected={selected.has(nf.id)}
              onToggle={() => toggleSelect(nf.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Upload Modal ─────────────────────────────────────── */}
      {showUpload && (
        <UploadModal isDark={isDark} onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}
