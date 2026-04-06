import { useState, useRef, useCallback } from 'react'
import { Upload, FileImage, Loader2, CheckCircle, AlertTriangle, Sparkles, X } from 'lucide-react'
import { api } from '../services/api'
import { supabase } from '../services/supabase'

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
  onParsed: (fornecedores: FornecedorParsed[], file: File) => void
  disabled?: boolean
  cotacaoId?: string
  requisicaoId?: string
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
// Acima deste limiar, faz upload pro Storage e manda URL pro n8n (evita body enorme)
const STORAGE_THRESHOLD = 8 * 1024 * 1024 // 8 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Upload para Supabase Storage e retorna URL pública temporária */
async function uploadToStorage(file: File): Promise<{ path: string; url: string }> {
  const ext = file.name.split('.').pop() || 'pdf'
  const path = `cotacao-parse/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from('temp-uploads').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data } = supabase.storage.from('temp-uploads').getPublicUrl(path)
  return { path, url: data.publicUrl }
}

/** Remove arquivo temporário do Storage */
async function cleanupStorage(path: string) {
  try { await supabase.storage.from('temp-uploads').remove([path]) } catch { /* best effort */ }
}

type Status = 'idle' | 'processing' | 'success' | 'error'

export default function UploadCotacao({ onParsed, disabled, cotacaoId, requisicaoId }: Props) {
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
      setError('Arquivo muito grande. Máximo 50 MB.')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('processing')
    setError('')

    let storagePath: string | null = null

    try {
      let result

      if (file.size > STORAGE_THRESHOLD) {
        // Arquivo grande: upload pro Storage, envia URL pro n8n (que baixa e processa)
        const uploaded = await uploadToStorage(file)
        storagePath = uploaded.path

        try {
          result = await api.parseCotacaoFile({
            file_base64: '',
            file_name: file.name,
            mime_type: file.type,
            cotacao_id: cotacaoId,
            requisicao_id: requisicaoId,
            file_url: uploaded.url,
          })
        } catch (fetchErr) {
          handleFetchError(fetchErr)
          return
        } finally {
          cleanupStorage(uploaded.path)
          storagePath = null
        }
      } else {
        // Arquivo até 8MB: base64 inline direto
        const base64 = await fileToBase64(file)
        try {
          result = await api.parseCotacaoFile({
            file_base64: base64,
            file_name: file.name,
            mime_type: file.type,
            cotacao_id: cotacaoId,
            requisicao_id: requisicaoId,
          })
        } catch (fetchErr) {
          handleFetchError(fetchErr)
          return
        }
      }

      if (result.success && result.fornecedores?.length > 0) {
        setStatus('success')
        onParsed(result.fornecedores, file)
      } else {
        setError(result.error || 'A IA não conseguiu extrair dados do documento. Tente uma imagem mais nítida ou preencha manualmente.')
        setStatus('error')
      }
    } catch (err) {
      // Cleanup storage se ficou pendente
      if (storagePath) cleanupStorage(storagePath)
      setError(err instanceof Error ? err.message : 'Erro inesperado ao processar arquivo.')
      setStatus('error')
    }

    function handleFetchError(fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : ''
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('AbortError') || msg.includes('Tempo limite') || msg.includes('ECONNREFUSED')) {
        setError('Serviço de IA indisponível no momento. Preencha os dados manualmente.')
      } else if (msg.includes('Erro 5')) {
        setError('Erro interno no serviço de IA (500). Tente novamente em instantes.')
      } else {
        setError(msg || 'Erro ao conectar com o serviço de IA. Preencha manualmente.')
      }
      setStatus('error')
    }
  }, [onParsed, cotacaoId, requisicaoId])

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
            JPG, PNG, WebP, PDF · Máx 50 MB
          </p>
        </div>
      )}
    </div>
  )
}
