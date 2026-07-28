// ─────────────────────────────────────────────────────────────────────────────
// components/rh/DPPlanoUploadModal.tsx — sobe os relatórios da operadora.
// Não perguntamos operadora nem tipo: o SuperTEG identifica lendo o arquivo.
// A competência vem sugerida (mês passado) e é editável — quem confere decide.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react'
import { X, Upload, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useEnviarRelatorioPlano } from '../../hooks/usePlanoSaude'

// mês anterior — é o que a operadora fatura
const mesSugerido = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DPPlanoUploadModal({ onClose }: { onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const enviar = useEnviarRelatorioPlano()
  const inputRef = useRef<HTMLInputElement>(null)

  const [arquivos, setArquivos] = useState<File[]>([])
  const [competencia, setCompetencia] = useState(mesSugerido())
  const [erro, setErro] = useState<string | null>(null)

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white'
    : 'bg-white border-slate-200 text-slate-800'

  const add = (fl: FileList | null) => {
    if (!fl?.length) return
    setArquivos(a => [...a, ...Array.from(fl)])
    setErro(null)
  }

  const submeter = async () => {
    if (!arquivos.length) { setErro('Selecione ao menos um arquivo.'); return }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { setErro('Informe a competência.'); return }
    setErro(null)
    try {
      await enviar.mutateAsync({ arquivos, competenciaYm: competencia, criadoPor: perfil?.nome ?? null })
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0d1420] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-500" />
            <h3 className={`text-sm font-bold ${txt}`}>Relatórios do plano de saúde</h3>
          </div>
          <button onClick={onClose} className={`p-1 rounded-lg ${txtMuted} hover:${isDark ? 'bg-white/10' : 'bg-slate-100'}`}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className={`text-xs leading-relaxed ${txtMuted}`}>
            Suba a <b className={txt}>mensalidade</b> e/ou a <b className={txt}>coparticipação</b> de qualquer operadora.
            O SuperTEG identifica sozinho a operadora, o tipo do relatório e cada linha — e só aceita a leitura
            quando a soma bate com o total impresso no documento.
          </p>

          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${txtMuted}`}>COMPETÊNCIA</label>
            <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)}
              className={`text-sm rounded-lg px-3 py-2 border outline-none ${inputCls}`} />
            <p className={`mt-1 text-[11px] ${txtMuted}`}>Sugerimos o mês anterior. Ajuste se o relatório for de outro mês.</p>
          </div>

          <div>
            <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt"
              className="hidden" onChange={e => { add(e.target.files); e.target.value = '' }} />
            <button onClick={() => inputRef.current?.click()}
              className={`w-full flex items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors ${isDark
                ? 'border-white/15 text-slate-400 hover:border-emerald-400 hover:text-emerald-300'
                : 'border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-600'}`}>
              <Upload size={16} /> Escolher arquivos
            </button>
          </div>

          {arquivos.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {arquivos.map((f, i) => (
                <div key={`${f.name}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                  <FileText size={13} className="text-emerald-500 shrink-0" />
                  <span className={`flex-1 min-w-0 truncate ${txt}`}>{f.name}</span>
                  <span className={txtMuted}>{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button onClick={() => setArquivos(a => a.filter((_, j) => j !== i))}
                    className={`p-1 rounded ${txtMuted} hover:text-rose-500`}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}

          {erro && <p className="text-xs text-rose-500">{erro}</p>}
        </div>

        <div className={`flex justify-end gap-2 px-5 py-4 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`text-xs font-semibold px-3 py-2 rounded-lg ${txtMuted}`}>Cancelar</button>
          <button onClick={submeter} disabled={enviar.isPending || !arquivos.length}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
            {enviar.isPending ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Sparkles size={13} /> Ler com o SuperTEG</>}
          </button>
        </div>
      </div>
    </div>
  )
}
