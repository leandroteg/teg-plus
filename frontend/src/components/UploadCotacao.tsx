import { useState, useRef, useCallback } from 'react'
import { Upload, FileImage, Loader2, CheckCircle, AlertTriangle, Sparkles, X } from 'lucide-react'
import { api } from '../services/api'

// ── Gemini direto para arquivos grandes ────────────────────────────────────
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const LARGE_FILE_THRESHOLD = 8 * 1024 * 1024 // 8 MB — acima disso usa Gemini File API

async function parseCotacaoViaGemini(file: File): Promise<{
  success: boolean
  fornecedores?: { fornecedor_nome: string; fornecedor_cnpj?: string; fornecedor_contato?: string; valor_total: number; prazo_entrega_dias?: number; condicao_pagamento?: string; itens?: { descricao: string; qtd: number; valor_unitario: number; valor_total: number }[]; observacao?: string }[]
  error?: string
}> {
  if (!GEMINI_KEY) throw new Error('Gemini API key não configurada')

  const mimeType = file.type || 'application/pdf'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)

  try {
    let filePart: Record<string, unknown>

    if (file.size > LARGE_FILE_THRESHOLD) {
      // Upload via File API
      const uploadResp = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: {
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Header-Content-Length': String(file.size),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': mimeType,
          },
          body: file,
          signal: controller.signal,
        }
      )
      if (!uploadResp.ok) throw new Error(`Upload falhou: ${uploadResp.status}`)
      const uploadData = await uploadResp.json()
      const fileUri = uploadData.file?.uri
      if (!fileUri) throw new Error('File API não retornou URI')

      // Aguardar processamento
      const fileName = uploadData.file?.name
      if (fileName) {
        for (let i = 0; i < 30; i++) {
          const st = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_KEY}`, { signal: controller.signal })
          if (st.ok) {
            const sd = await st.json()
            if (sd.state === 'ACTIVE') break
            if (sd.state === 'FAILED') throw new Error('Processamento do arquivo falhou')
          }
          await new Promise(r => setTimeout(r, 2000))
        }
      }
      filePart = { file_data: { mime_type: mimeType, file_uri: fileUri } }
    } else {
      // Inline base64
      const buf = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      filePart = { inline_data: { mime_type: mimeType, data: base64 } }
    }

    const prompt = `Analise esta cotação/proposta comercial e extraia os dados de cada fornecedor.

Retorne SOMENTE JSON válido (sem markdown) no formato:
{"fornecedores":[{"fornecedor_nome":"","fornecedor_cnpj":"","fornecedor_contato":"","valor_total":0,"prazo_entrega_dias":0,"condicao_pagamento":"","itens":[{"descricao":"","qtd":1,"valor_unitario":0,"valor_total":0}],"observacao":""}]}

Regras:
- Extraia TODOS os itens com descrição, quantidade, valor unitário e total
- Se houver múltiplos fornecedores, liste cada um separadamente
- CNPJ no formato XX.XXX.XXX/XXXX-XX
- Valores numéricos sem formatação (usar ponto decimal)
- Se o documento for uma proposta/orçamento de um único fornecedor, retorne um array com 1 fornecedor`

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [filePart, { text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
        signal: controller.signal,
      }
    )
    if (!resp.ok) throw new Error(`Gemini ${resp.status}`)
    const gd = await resp.json()
    const raw = gd.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let data: Record<string, unknown>
    try { data = JSON.parse(cleaned) } catch {
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) data = JSON.parse(m[0])
      else return { success: false, error: 'Resposta inválida da IA' }
    }
    const fornecedores = (data.fornecedores as Record<string, unknown>[]) || []
    if (fornecedores.length === 0) return { success: false, error: 'Nenhum fornecedor encontrado' }
    return { success: true, fornecedores: fornecedores as never[] }
  } finally {
    clearTimeout(timeout)
  }
}

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

    try {
      let result: { success: boolean; fornecedores?: FornecedorParsed[]; error?: string }

      // Sempre preferir Gemini direto quando key disponível (n8n parse-cotacao é instável)
      const useGeminiDirect = !!GEMINI_KEY

      if (useGeminiDirect) {
        try {
          result = await parseCotacaoViaGemini(file)
        } catch (geminiErr) {
          // Fallback para n8n se Gemini falhar e arquivo for pequeno
          if (file.size <= LARGE_FILE_THRESHOLD) {
            const base64 = await fileToBase64(file)
            result = await api.parseCotacaoFile({ file_base64: base64, file_name: file.name, mime_type: file.type, cotacao_id: cotacaoId, requisicao_id: requisicaoId })
          } else {
            throw geminiErr
          }
        }
      } else {
        // Arquivo pequeno sem Gemini key: n8n
        const base64 = await fileToBase64(file)
        try {
          result = await api.parseCotacaoFile({ file_base64: base64, file_name: file.name, mime_type: file.type, cotacao_id: cotacaoId, requisicao_id: requisicaoId })
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : ''
          if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('AbortError') || msg.includes('Tempo limite') || msg.includes('ECONNREFUSED')) {
            setError('Serviço de IA indisponível no momento. Preencha os dados manualmente.')
          } else if (msg.includes('Erro 5')) {
            setError('Erro interno no serviço de IA (500). Tente novamente em instantes.')
          } else {
            setError(msg || 'Erro ao conectar com o serviço de IA. Preencha manualmente.')
          }
          setStatus('error')
          return
        }
      }

      if (result.success && result.fornecedores?.length) {
        setStatus('success')
        onParsed(result.fornecedores, file)
      } else {
        setError(result.error || 'A IA não conseguiu extrair dados do documento. Tente uma imagem mais nítida ou preencha manualmente.')
        setStatus('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao processar arquivo.')
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
            JPG, PNG, WebP, PDF · Máx 50 MB
          </p>
        </div>
      )}
    </div>
  )
}
