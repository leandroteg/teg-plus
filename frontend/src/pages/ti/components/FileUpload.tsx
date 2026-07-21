import { useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { formatBytes } from '../lib/format'

// Seletor de arquivos controlado (seleção local). O envio fica a cargo do pai.
export function FileUpload({
  files,
  onChange,
  max = 5,
}: {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
}) {
  const ref = useRef<HTMLInputElement>(null)

  const add = (list: FileList | null) => {
    if (!list) return
    onChange([...files, ...Array.from(list)].slice(0, max))
    if (ref.current) ref.current.value = ''
  }

  return (
    <div>
      <button type="button" onClick={() => ref.current?.click()} className="btn-outline">
        <Paperclip className="h-4 w-4" /> Anexar arquivo
      </button>
      <input ref={ref} type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
      <span className="ml-2 text-xs text-slate-400">até {max} arquivos, 10 MB cada</span>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <span className="truncate text-slate-700">
                {f.name} <span className="text-slate-400">({formatBytes(f.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="text-slate-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
