// ─────────────────────────────────────────────────────────────────────────────
// OSAnexos — bloco de anexos da OS (N arquivos por etapa) e visualizador dos
// relatórios (Parecer Técnico / Conclusão de OS).
//
// A foto obrigatória da abertura continua em foto_antes_url (CorpoAbertura);
// aqui entram as DEMAIS fotos e os documentos (orçamento, NF, laudo…).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Camera, Trash2, Loader2, X, Download, FileText, Share2, Mail } from 'lucide-react'
import { useAnexosOS, useEnviarAnexoOS, useRemoverAnexoOS } from '../../../hooks/useFrotas'
import { useAuth } from '../../../contexts/AuthContext'
import { buildOSReportHtml, nomeArquivoOSReport, type TipoRelatorioOS } from '../../../utils/os-report-html'

const ROTULOS = ['Foto', 'Orçamento', 'Nota fiscal', 'Laudo', 'Termo de garantia', 'Outro']

export function OSAnexos({ osId, etapa, isDark, titulo = 'Anexos', somenteLeitura }: {
  osId: string
  /** requisicao | cotacao | execucao — marca de onde veio o arquivo. */
  etapa: string
  isDark: boolean
  titulo?: string
  somenteLeitura?: boolean
}) {
  const { perfil } = useAuth()
  const { data: todos = [], isLoading } = useAnexosOS(osId)
  const enviar = useEnviarAnexoOS()
  const remover = useRemoverAnexoOS()
  const [rotulo, setRotulo] = useState<string>('Foto')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const anexos = todos.filter(a => a.etapa === etapa)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const borda = isDark ? 'border-white/10' : 'border-slate-200'

  async function subir(files: FileList | null) {
    if (!files?.length) return
    try {
      for (const file of Array.from(files)) {
        await enviar.mutateAsync({
          osId, file, etapa, rotulo,
          autorId: perfil?.id ?? null, autorNome: perfil?.nome ?? null,
        })
      }
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: any) {
      alert(`Erro ao anexar: ${e?.message ?? 'desconhecido'}`)
    }
  }

  return (
    <div className={`rounded-xl border p-3 ${borda} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${txtMuted}`}>
          <Paperclip size={11} /> {titulo}{anexos.length ? ` (${anexos.length})` : ''}
        </p>
        {!somenteLeitura && (
          <span className="flex items-center gap-1.5">
            <select
              value={rotulo}
              onChange={e => setRotulo(e.target.value)}
              className={`text-[10px] rounded-lg px-2 py-1 border ${isDark ? 'bg-white/[0.05] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              {ROTULOS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1 ${
              enviar.isPending ? 'opacity-50 pointer-events-none' : ''
            } ${isDark ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
              {enviar.isPending ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
              {enviar.isPending ? 'Enviando…' : 'Anexar'}
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={e => subir(e.target.files)}
              />
            </label>
          </span>
        )}
      </div>

      {isLoading ? (
        <p className={`text-[11px] flex items-center gap-1.5 ${txtMuted}`}>
          <Loader2 size={11} className="animate-spin" /> carregando…
        </p>
      ) : anexos.length === 0 ? (
        <p className={`text-[11px] ${txtMuted}`}>Nenhum anexo nesta etapa.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {anexos.map(a => (
            <div key={a.id} className={`relative rounded-lg border overflow-hidden group ${borda} ${isDark ? 'bg-white/[0.03]' : 'bg-white'}`}>
              <a href={a.arquivo_url} target="_blank" rel="noopener noreferrer" className="block">
                {a.is_imagem ? (
                  <img src={a.arquivo_url} alt={a.arquivo_nome} className="w-full h-20 object-cover" />
                ) : (
                  <div className={`w-full h-20 flex items-center justify-center ${txtMuted}`}>
                    <FileText size={22} />
                  </div>
                )}
                <p className={`text-[9px] px-1.5 py-1 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {a.rotulo ? `${a.rotulo} · ` : ''}{a.arquivo_nome}
                </p>
              </a>
              {!somenteLeitura && (
                <button
                  onClick={() => { if (window.confirm('Remover este anexo?')) remover.mutate({ id: a.id, osId, path: a.arquivo_path }) }}
                  className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover anexo"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Visualizador do relatório (mesmo padrão do RDO: iframe + print → PDF) ─────
export function OSRelatorioModal({ osId, numeroOS, tipo, isDark, onClose }: {
  osId: string
  numeroOS?: string | null
  tipo: TipoRelatorioOS
  isDark: boolean
  onClose: () => void
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const titulo = tipo === 'parecer' ? 'Parecer Técnico' : 'Conclusão de OS'

  useEffect(() => {
    let vivo = true
    buildOSReportHtml(osId, tipo)
      .then(h => { if (vivo) setHtml(h) })
      .catch(e => { if (vivo) setErro(e?.message ?? 'Falha ao gerar o relatório') })
    return () => { vivo = false }
  }, [osId, tipo])

  // "Baixar": imprime o iframe — o navegador oferece Salvar como PDF, com as fotos
  const baixar = () => {
    const win = frameRef.current?.contentWindow
    if (win) { win.focus(); win.print() }
  }

  const compartilhar = async () => {
    if (!html) return
    const arquivo = nomeArquivoOSReport(numeroOS, tipo).replace(/\.pdf$/, '.html')
    const file = new File([html], arquivo, { type: 'text/html' })
    const nav = navigator as any
    try {
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${titulo} — ${numeroOS ?? ''}` })
        return
      }
    } catch { /* usuário cancelou ou navegador não suporta */ }
    // fallback: baixa o HTML para anexar onde quiser
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url; a.download = arquivo; a.click()
    URL.revokeObjectURL(url)
  }

  const email = () => {
    const assunto = `${titulo} — OS ${numeroOS ?? ''}`
    const corpo = `Segue em anexo o ${titulo.toLowerCase()} da OS ${numeroOS ?? ''}.\n\n` +
      `Use "Baixar PDF" ou "Compartilhar" nesta tela para gerar o arquivo e anexá-lo a este e-mail.`
    window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`
  }

  const btn = `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${
    isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-4xl h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}
      >
        <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <FileText size={15} className={isDark ? 'text-slate-300' : 'text-slate-600'} />
          <p className={`text-sm font-bold flex-1 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {titulo} <span className="font-normal opacity-70">— {numeroOS ?? ''}</span>
          </p>
          <button onClick={compartilhar} disabled={!html} className={btn}><Share2 size={13} /> Compartilhar</button>
          <button onClick={email} disabled={!html} className={btn}><Mail size={13} /> E-mail</button>
          <button onClick={baixar} disabled={!html}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
            <Download size={13} /> Baixar PDF
          </button>
          <button onClick={onClose} className={isDark ? 'text-slate-400 p-1' : 'text-slate-500 p-1'}><X size={16} /></button>
        </div>

        <div className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
          {erro ? (
            <div className="h-full flex items-center justify-center text-sm text-red-500 px-6 text-center">{erro}</div>
          ) : !html ? (
            <div className={`h-full flex items-center justify-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 size={16} className="animate-spin" /> montando o relatório…
            </div>
          ) : (
            <iframe ref={frameRef} title={titulo} srcDoc={html} className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}
