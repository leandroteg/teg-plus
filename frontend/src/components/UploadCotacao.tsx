import { useState, useRef, useCallback } from 'react'
import { Upload, FileImage, Loader2, CheckCircle, AlertTriangle, Sparkles, X } from 'lucide-react'
import { api } from '../services/api'

interface FornecedorParsed {
  fornecedor_nome: string
  fornecedor_cnpj?: string
  fornecedor_contato?: string
  valor_total: number
  prazo_entrega_dias?: number
  condicao_pagamento?: string
  itens?: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]
  observacao?: string
}

interface Props {
  onParsed: (fornecedores: FornecedorParsed[]) => void
  disabled?: boolean
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

type Status = 'idle' | 'processing' | 'success' | 'error'

export default function UploadCotacao({ onParsed, disabled }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    // Validações
    if (!ACCEPTED.includes(file.type)) {
      setError('Formato não suportado. Use JPG, PNG, WebP ou PDF.')
      setStatus('error')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('Arquivo muito grande. Máximo 10 MB.')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('processing')
    setError('')

    try {
      // Converter para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // Remove data:...;base64, prefix
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Enviar para n8n
      const result = await api.parseCotacaoFile({
        file_base64: base64,
        file_name: file.name,
        mime_type: file.type,
      })

      if (result.success && result.fornecedores?.length > 0) {
        setStatus('success')
        onParsed(result.fornecedores)
      } else {
        setError(result.error || 'Não foi possível extrair dados do documento.')
        setStatus('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo.')
      setStatus('error')
    }
  }, [onParsed])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    if (inputRef.current) inputRef.current.value = '' // Reset para permitir re-upload
  }, [processFile])

  const reset = () => {
    setStatus('idle')
    setError('')
    setFileName('')
  }

  if (disabled) return null

  return (
    <div className="space-y-2">
      {/* Zona de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => status !== 'processing' && inputRef.current?.click()}
        className={`
          relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${dragOver
            ? 'border-violet-400 bg-violet-50 scale-[1.01]'
            : status === 'processing'
              ? 'border-amber-300 bg-amber-50/50 cursor-wait'
              : status === 'success'
                ? 'border-emerald-300 bg-emerald-50/50'
                : status === 'error'
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-slate-200 bg-gradient-to-br from-violet-50/40 to-slate-50 hover:border-violet-300 hover:from-violet-50/80 hover:to-slate-50'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Ícone */}
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${status === 'processing'
              ? 'bg-amber-100'
              : status === 'success'
                ? 'bg-emerald-100'
                : status === 'error'
                  ? 'bg-red-100'
                  : 'bg-violet-100'
            }
          `}>
            {status === 'processing' ? (
              <Loader2 size={20} className="text-amber-600 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle size={20} className="text-emerald-600" />
            ) : status === 'error' ? (
              <AlertTriangle size={20} className="text-red-500" />
            ) : (
              <Sparkles size={20} className="text-violet-600" />
            )}
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            {status === 'idle' && (
              <>
                <p className="text-sm font-bold text-slate-700">
                  <Upload size={14} className="inline mr-1.5 -mt-0.5" />
                  Upload inteligente de cotação
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arraste foto, PDF ou screenshot — a IA preenche tudo automaticamente
                </p>
              </>
            )}

            {status === 'processing' && (
              <>
                <p className="text-sm font-bold text-amber-700">
                  Analisando com Gemini Flash...
                </p>
                <p className="text-[11px] text-amber-500 mt-0.5 truncate">
                  {fileName}
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <p className="text-sm font-bold text-emerald-700">
                  Dados extraídos com sucesso!
                </p>
                <p className="text-[11px] text-emerald-500 mt-0.5 truncate">
                  {fileName} — campos preenchidos automaticamente
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <p className="text-sm font-bold text-red-600">
                  Falha na extração
                </p>
                <p className="text-[11px] text-red-400 mt-0.5">
                  {error}
                </p>
              </>
            )}
          </div>

          {/* Botão de reset */}
          {(status === 'success' || status === 'error') && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); reset() }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Barra de progresso animada */}
        {status === 'processing' && (
          <div className="h-1 bg-amber-100">
            <div className="h-full bg-amber-400 rounded-full animate-pulse" style={{ width: '70%' }} />
          </div>
        )}
      </div>

      {/* Tipos aceitos */}
      {status === 'idle' && (
        <div className="flex items-center gap-2 px-1">
          <FileImage size={12} className="text-slate-300" />
          <p className="text-[10px] text-slate-300">
            JPG, PNG, WebP, PDF · Máx 10 MB
          </p>
        </div>
      )}
    </div>
  )
}
