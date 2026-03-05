import { useState, useRef, useCallback } from 'react'
import { Upload, Search, Loader2, Sparkles } from 'lucide-react'

interface AiDropZoneProps {
  onParse: (input: { type: 'cnpj' | 'cpf' | 'file' | 'text'; content: string; base64?: string; filename?: string }) => void
  parsing: boolean
  entityLabel: string
  showCnpjField?: boolean
  showCpfField?: boolean
}

export default function AiDropZone({
  onParse, parsing, entityLabel, showCnpjField, showCpfField,
}: AiDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [docInput, setDocInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    onParse({ type: 'file', content: file.name, base64, filename: file.name })
  }, [onParse])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    onParse({ type: 'file', content: file.name, base64, filename: file.name })
  }, [onParse])

  function handleDocSubmit() {
    const clean = docInput.replace(/\D/g, '')
    if (showCnpjField && clean.length === 14) {
      onParse({ type: 'cnpj', content: clean })
    } else if (showCpfField && clean.length === 11) {
      onParse({ type: 'cpf', content: clean })
    } else if (docInput.trim().length > 3) {
      onParse({ type: 'text', content: docInput.trim() })
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200 group
          ${dragOver
            ? 'border-violet-400 bg-violet-50 scale-[1.02]'
            : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
          }
          ${parsing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.txt"
          onChange={handleFileSelect} />

        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Loader2 size={22} className="text-white animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Processando com IA...</p>
              <p className="text-xs text-slate-400 mt-0.5">Analisando documento</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500
              flex items-center justify-center shadow-lg shadow-violet-500/20
              group-hover:shadow-violet-500/30 transition-shadow">
              <Upload size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Arraste um documento aqui</p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, imagem, planilha ou clique para selecionar</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase">ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
          <input
            value={docInput}
            onChange={e => setDocInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDocSubmit()}
            placeholder={
              showCnpjField ? 'Cole um CNPJ ou digite informacoes...'
                : showCpfField ? 'Cole um CPF ou digite informacoes...'
                : `Informacoes do ${entityLabel}...`
            }
            className="input-base pl-9"
            disabled={parsing}
          />
        </div>
        <button
          onClick={handleDocSubmit}
          disabled={parsing || docInput.trim().length < 3}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm
            font-semibold transition-colors disabled:opacity-40 shadow-sm flex items-center gap-1.5"
        >
          <Search size={14} /> Buscar
        </button>
      </div>
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
