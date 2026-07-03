// ─────────────────────────────────────────────────────────────────────────────
// components/qsma/ModalBits.tsx — anatomia comum dos modais QSMA
// Shell (overlay+painel), upload múltiplo de evidências (bucket qsma-evidencias)
// e rodapé com validação fail-visible (erros travam, avisos deixam passar).
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { X, Paperclip, Loader2, AlertTriangle, Camera } from 'lucide-react'
import { uploadEvidencia, evidenciaUrl } from '../../hooks/useQsma'

export function QsmaModal({
  isDark, titulo, subtitulo, onClose, children, wide,
}: {
  isDark: boolean
  titulo: string
  subtitulo?: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[88vh] overflow-y-auto ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 rounded-t-2xl ${bg} ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</h3>
            {subtitulo && <p className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitulo}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

// Rodapé padrão: erros (vermelho, travam) · avisos (âmbar) · Cancelar/Salvar
export function ModalFooter({
  isDark, erros = [], avisos = [], salvando, onCancel, onSave, saveLabel = 'Salvar',
}: {
  isDark: boolean
  erros?: string[]
  avisos?: string[]
  salvando?: boolean
  onCancel: () => void
  onSave: () => void
  saveLabel?: string
}) {
  return (
    <div className="space-y-2">
      {(erros.length > 0 || avisos.length > 0) && (
        <p className={`inline-flex items-start gap-1 text-[10px] font-medium ${erros.length ? 'text-red-500' : 'text-amber-500'}`}>
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{[...erros, ...avisos].join(' · ')}</span>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={erros.length > 0 || salvando}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {salvando && <Loader2 size={12} className="animate-spin" />}
          {salvando ? 'Salvando…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

// Upload múltiplo de evidências → bucket qsma-evidencias; devolve paths ao pai
export function FotosUpload({
  isDark, pasta, paths, onChange, label = 'Evidências (fotos/PDF)',
}: {
  isDark: boolean
  pasta: string
  paths: string[]
  onChange: (paths: string[]) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subindo, setSubindo] = useState(false)

  async function handle(files: FileList | null) {
    if (!files?.length) return
    setSubindo(true)
    try {
      const novos: string[] = []
      for (const f of Array.from(files)) {
        if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" tem mais de 10MB — reduza o arquivo`); continue }
        novos.push(await uploadEvidencia(pasta, f))
      }
      onChange([...paths, ...novos])
    } catch (err: any) {
      alert(`Erro no upload: ${err?.message ?? 'desconhecido'}`)
    } finally {
      setSubindo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function abrir(path: string) {
    const url = await evidenciaUrl(path)
    if (url) window.open(url, '_blank')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subindo}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors disabled:opacity-50 ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {subindo ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
          {subindo ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
      <input
        ref={inputRef} type="file" multiple className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={e => handle(e.target.files)}
      />
      {paths.length === 0 ? (
        <p className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Nenhum anexo</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {paths.map((p, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-0.5 text-[10px] font-medium ${
                isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <button type="button" onClick={() => abrir(p)} className="inline-flex items-center gap-1 hover:underline">
                <Paperclip size={9} /> {p.split('/').pop()?.replace(/^\d+_/, '').slice(0, 24)}
              </button>
              <button type="button" onClick={() => onChange(paths.filter((_, j) => j !== i))} className="p-0.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-500">
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export const fmtData = (d?: string) =>
  d ? new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
