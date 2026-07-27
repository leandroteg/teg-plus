import { useRef, useState } from 'react'
import {
  FileText, Upload, Trash2, Loader2, Download, AlertTriangle, CheckCircle2, Paperclip,
} from 'lucide-react'
import {
  CATEGORIAS, tiposPorCategoria, docTipoLabel, getAnexoUrl,
  useSolicitacaoAnexos, useUploadSolicitacaoAnexo, useRemoverSolicitacaoAnexo,
  motivoBloqueioDocsObrigatorios,
  type StagedDoc, type SolicitacaoAnexo, type SolicitacaoDocCategoria, type SolicitacaoDocTipo,
} from '../hooks/useSolicitacaoDocs'

interface Props {
  /** Solicitação já existente → uploads imediatos. Ausente = nova (staged). */
  solicitacaoId?: string | null
  staged: StagedDoc[]
  onStagedChange: (next: StagedDoc[]) => void
}

const fmtSize = (b?: number | null) =>
  b == null ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

export default function SolicitacaoDocsSection({ solicitacaoId, staged, onStagedChange }: Props) {
  const isExisting = Boolean(solicitacaoId)
  const { data: anexos = [], isLoading } = useSolicitacaoAnexos(solicitacaoId)
  const upload = useUploadSolicitacaoAnexo()
  const remover = useRemoverSolicitacaoAnexo()
  const [erro, setErro] = useState<string | null>(null)

  const pendencia = motivoBloqueioDocsObrigatorios(anexos, staged)

  async function abrir(path: string) {
    try {
      const url = await getAnexoUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch {
      setErro('Não foi possível abrir o arquivo.')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip size={10} /> Documentos
          </p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Obrigatórios para enviar: <strong>Cartão CNPJ</strong> + (<strong>CNH</strong> ou <strong>CPF</strong>) +
            {' '}(<strong>Proposta Comercial</strong> ou <strong>Ordem de Compra</strong>). PDF ou imagem, até 15 MB.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 ${
          pendencia ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {pendencia ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          {pendencia ? 'Docs pendentes' : 'Docs ok'}
        </span>
      </div>

      {erro && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> {erro}</p>}

      {CATEGORIAS.map(cat => (
        <CategoriaBlock
          key={cat.value}
          categoria={cat.value}
          label={cat.label}
          hint={cat.hint}
          isExisting={isExisting}
          isLoading={isLoading && isExisting}
          uploadPending={upload.isPending}
          removerPending={remover.isPending}
          anexos={anexos.filter(a => a.categoria === cat.value)}
          staged={staged.filter(s => s.categoria === cat.value)}
          onSetErro={setErro}
          onUpload={async (tipo, file) => {
            await upload.mutateAsync({ solicitacaoId: solicitacaoId as string, categoria: cat.value, tipo, file })
          }}
          onStage={(tipo, file) => onStagedChange([
            ...staged,
            { tempId: crypto.randomUUID(), categoria: cat.value, tipo, file },
          ])}
          onRemoveStaged={(tempId) => onStagedChange(staged.filter(x => x.tempId !== tempId))}
          onRemoveAnexo={(a) => remover.mutate(a)}
          onAbrir={abrir}
        />
      ))}
    </div>
  )
}

// ── Bloco por categoria ──────────────────────────────────────────────────────
interface BlockProps {
  categoria: SolicitacaoDocCategoria
  label: string
  hint: string
  isExisting: boolean
  isLoading: boolean
  uploadPending: boolean
  removerPending: boolean
  anexos: SolicitacaoAnexo[]
  staged: StagedDoc[]
  onSetErro: (m: string | null) => void
  onUpload: (tipo: SolicitacaoDocTipo, file: File) => Promise<void>
  onStage: (tipo: SolicitacaoDocTipo, file: File) => void
  onRemoveStaged: (tempId: string) => void
  onRemoveAnexo: (a: SolicitacaoAnexo) => void
  onAbrir: (path: string) => void
}

function CategoriaBlock({
  categoria, label, hint, isExisting, isLoading, uploadPending, removerPending,
  anexos, staged, onSetErro, onUpload, onStage, onRemoveStaged, onRemoveAnexo, onAbrir,
}: BlockProps) {
  const opcoes = tiposPorCategoria(categoria)
  const [tipo, setTipo] = useState<SolicitacaoDocTipo>(opcoes[0].value)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePick(file: File | undefined) {
    onSetErro(null)
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      onSetErro('Arquivo maior que 15 MB.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    try {
      if (isExisting) await onUpload(tipo, file)
      else onStage(tipo, file)
    } catch (e) {
      onSetErro(e instanceof Error ? e.message : 'Falha ao anexar.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const vazio = !isLoading && anexos.length === 0 && staged.length === 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
        </div>
      </div>

      {/* Adicionar */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wide mb-1 text-slate-400">Tipo</label>
          <select
            value={tipo}
            onChange={e => { setTipo(e.target.value as SolicitacaoDocTipo); onSetErro(null) }}
            className="text-sm rounded-lg border border-slate-200 bg-white text-slate-700 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {opcoes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {uploadPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Anexar
        </button>
        <input ref={fileRef} type="file" className="hidden"
          accept="application/pdf,image/*"
          onChange={e => handlePick(e.target.files?.[0])} />
      </div>

      {/* Lista */}
      <div className="mt-3 space-y-1.5">
        {isLoading && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando…</p>
        )}

        {anexos.map(a => (
          <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <FileText size={14} className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-slate-700">{a.nome}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>{docTipoLabel(a.tipo)}</span>
                {a.tamanho_bytes && <span>· {fmtSize(a.tamanho_bytes)}</span>}
              </p>
            </div>
            <button type="button" onClick={() => onAbrir(a.storage_path)} title="Abrir"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <Download size={13} />
            </button>
            <button type="button" onClick={() => onRemoveAnexo(a)} disabled={removerPending} title="Remover"
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50">
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {staged.map(s => (
          <div key={s.tempId} className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2">
            <FileText size={14} className="text-indigo-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-slate-700">{s.file.name}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>{docTipoLabel(s.tipo)}</span>
                <span>· {fmtSize(s.file.size)}</span>
                <span className="text-indigo-600 font-bold">· será enviado ao salvar</span>
              </p>
            </div>
            <button type="button" onClick={() => onRemoveStaged(s.tempId)} title="Remover"
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {vazio && <p className="text-[11px] text-slate-400 py-1">Nenhum documento anexado.</p>}
      </div>
    </div>
  )
}
