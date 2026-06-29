import { Download, Trash2, FileText, Mic, Image as ImageIcon, Video } from 'lucide-react'
import type { Attachment } from '../data/shapes'
import { formatBytes } from '../lib/format'

// Anexos com prévia inline (áudio/imagem/vídeo). As URLs são signed URLs do
// Storage (a.url), geradas na camada de dados — servem para baixar e exibir.
const isAudio = (m: string) => (m || '').startsWith('audio/')
const isImage = (m: string) => (m || '').startsWith('image/')
const isVideo = (m: string) => (m || '').startsWith('video/')

function KindIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return <ImageIcon className="h-5 w-5 shrink-0 text-slate-400" />
  if (isAudio(mime)) return <Mic className="h-5 w-5 shrink-0 text-emerald-500" />
  if (isVideo(mime)) return <Video className="h-5 w-5 shrink-0 text-slate-400" />
  return <FileText className="h-5 w-5 shrink-0 text-slate-400" />
}

export function AttachmentList({
  attachments,
  canDelete,
  onDelete,
}: {
  attachments: Attachment[]
  canDelete?: (a: Attachment) => boolean
  onDelete?: (a: Attachment) => void
}) {
  if (!attachments.length) return <p className="text-sm text-slate-400">Nenhum anexo</p>
  return (
    <ul className="space-y-2">
      {attachments.map((a) => (
        <li key={a.id} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex items-center gap-3">
            <KindIcon mime={a.mimeType} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-700">{a.originalName}</div>
              <div className="text-xs text-slate-400">
                {formatBytes(a.size)}
                {a.uploadedBy ? ` · ${a.uploadedBy.name}` : ''}
              </div>
            </div>
            <a
              href={a.url}
              download={a.originalName}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-600"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </a>
            {canDelete?.(a) && onDelete && (
              <button
                onClick={() => onDelete(a)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {isAudio(a.mimeType) && (
            <audio controls preload="metadata" src={a.url} className="mt-2 w-full">
              Seu navegador não suporta áudio.
            </audio>
          )}
          {isImage(a.mimeType) && (
            <a href={a.url} target="_blank" rel="noreferrer" className="mt-2 block">
              <img src={a.url} alt={a.originalName} loading="lazy" className="max-h-56 rounded-md border border-slate-200 object-contain" />
            </a>
          )}
          {isVideo(a.mimeType) && (
            <video controls preload="none" src={a.url} className="mt-2 max-h-72 w-full rounded-md border border-slate-200">
              Seu navegador não suporta vídeo.
            </video>
          )}
        </li>
      ))}
    </ul>
  )
}
