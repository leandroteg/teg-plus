import { useRef, useState } from 'react'
import { Paperclip, Loader2, X, FileText, Image as ImageIcon, Download, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAnexos, uploadAnexo, getAnexoUrl, removerAnexo } from './hooks'
import { ANEXO_MAX_BYTES, ANEXO_MAX_BYTES_LABEL, formatBytes, type Anexo } from './types'

interface Props {
  chamadoId: string
  podeAnexar?: boolean
  podeRemover?: boolean
}

export default function AnexosBox({ chamadoId, podeAnexar = true, podeRemover = true }: Props) {
  const { perfil } = useAuth()
  const { items, loading, reload } = useAnexos(chamadoId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !perfil?.id) return
    setEnviando(true)
    setErro(null)
    try {
      for (const f of Array.from(files)) {
        if (f.size > ANEXO_MAX_BYTES) {
          throw new Error(`"${f.name}" passa do limite de ${ANEXO_MAX_BYTES_LABEL}.`)
        }
        await uploadAnexo({ file: f, chamado_id: chamadoId, autor_id: perfil.id })
      }
      reload()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar arquivo.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleOpen(a: Anexo) {
    try {
      const url = await getAnexoUrl(a.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir arquivo.')
    }
  }

  async function handleRemove(a: Anexo) {
    if (!confirm(`Remover "${a.nome}"?`)) return
    try {
      await removerAnexo(a)
      reload()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  function isImage(mime: string | null) {
    return !!mime && mime.startsWith('image/')
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Anexos {items.length > 0 && <span className="text-slate-400">({items.length})</span>}
        </h2>
        {podeAnexar && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            Anexar
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Dropzone */}
      {podeAnexar && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={`mb-3 rounded-xl border-2 border-dashed p-4 text-center text-xs transition-colors ${
            dragOver
              ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          Arraste arquivos aqui ou clique em <strong>Anexar</strong>. Máx. {ANEXO_MAX_BYTES_LABEL} por arquivo.
        </div>
      )}

      {erro && (
        <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-300 flex items-start justify-between gap-2">
          <span>{erro}</span>
          <button onClick={() => setErro(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading && (
        <div className="text-xs text-slate-400 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando anexos...
        </div>
      )}

      {!loading && items.length === 0 && !podeAnexar && (
        <p className="text-xs text-slate-400 italic">Nenhum arquivo anexado.</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map(a => {
            const meu = a.autor_id === perfil?.id
            const Icon = isImage(a.mime) ? ImageIcon : FileText
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <button
                  onClick={() => handleOpen(a)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm text-slate-900 dark:text-slate-100 font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBytes(a.tamanho_bytes)} · {new Date(a.created_at).toLocaleString('pt-BR')}
                  </p>
                </button>
                <button
                  onClick={() => handleOpen(a)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  title="Abrir / Baixar"
                >
                  <Download className="w-4 h-4" />
                </button>
                {podeRemover && meu && (
                  <button
                    onClick={() => handleRemove(a)}
                    className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-500 hover:text-rose-500"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
