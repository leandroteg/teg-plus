// ─────────────────────────────────────────────────────────────────────────────
// components/rh/EnviarLoteHoleritesCard.tsx
// Upload de 1 PDF consolidado de holerites → SuperTEG splita por colaborador.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { FileUp, Upload, X, Send, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react'
import { useEnviarLoteHolerites, type TipoLoteHolerite, type LoteResultado } from '../../hooks/useHolerites'

const TIPOS: { value: TipoLoteHolerite; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: '13_salario', label: '13º Salário' },
  { value: 'ferias', label: 'Férias' },
]

export default function EnviarLoteHoleritesCard({ isDark }: { isDark: boolean }) {
  const enviar = useEnviarLoteHolerites()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [tipo, setTipo] = useState<TipoLoteHolerite>('mensal')
  const [resultado, setResultado] = useState<LoteResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const card = isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-white border-slate-200'
  const label = `text-xs font-semibold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`
  const input = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-white/5 border-white/10 text-white focus:ring-2 focus:ring-teal-500/30' : 'bg-white border-slate-200 focus:ring-2 focus:ring-teal-400/30'}`

  async function handleEnviar() {
    setErro(null); setResultado(null)
    if (!file) { setErro('Selecione o PDF consolidado'); return }
    if (!competencia) { setErro('Selecione a competência'); return }
    try {
      const r = await enviar.mutateAsync({ competencia, tipo, file })
      setResultado(r)
      if (r.status === 'erro') setErro(r.error || 'Falha ao acionar o SuperTEG')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar')
    }
  }

  const semMatch = (resultado?.sem_match as string[] | undefined) ?? []

  return (
    <div className={`rounded-2xl border p-5 ${card}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
          <Sparkles size={18} className="text-teal-500" />
        </div>
        <div>
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Enviar lote consolidado</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            1 PDF com todos os holerites → o SuperTEG separa por colaborador, salva no Drive e publica no Portal TEG
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={label}>Competência (mês/ano) *</label>
          <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoLoteHolerite)} className={input}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Dropzone */}
      <div className="mt-3">
        <label className={label}>PDF consolidado *</label>
        {!file ? (
          <div
            className={`rounded-2xl border-2 border-dashed p-4 transition-all cursor-pointer ${isDark ? 'border-white/10 bg-white/[0.02] hover:border-teal-400/40' : 'border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/20'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f) }}
          >
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isDark ? 'bg-white/5 text-slate-400' : 'bg-white text-slate-400 shadow-sm'}`}>
                <Upload size={18} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Anexar PDF consolidado de holerites</p>
                <p className="text-[11px] text-slate-400">Arraste aqui ou clique para selecionar.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0"><FileUp size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{file.name}</p>
              <p className="text-[11px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button onClick={() => setFile(null)} className="rounded-full p-1.5 text-slate-400 hover:text-red-500"><X size={14} /></button>
          </div>
        )}
      </div>

      {/* Ação */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={handleEnviar} disabled={enviar.isPending || !file}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-60 shadow-sm">
          {enviar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {enviar.isPending ? 'Enviando ao SuperTEG...' : 'Enviar para o SuperTEG'}
        </button>
      </div>

      {/* Feedback */}
      {resultado && !erro && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={15} /> Enviado ao SuperTEG
          </p>
          <p className="text-xs text-emerald-700">
            {resultado.job_id ? <>Job <span className="font-mono">{resultado.job_id}</span> · </> : null}
            status: <strong>{resultado.status ?? 'processando'}</strong>. O processamento é assíncrono — os holerites aparecem no Portal TEG conforme forem gerados.
          </p>
          {semMatch.length > 0 && (
            <p className="text-xs text-amber-700 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {semMatch.length} sem correspondência de nome (resolver no RH): {semMatch.join(', ')}
            </p>
          )}
        </div>
      )}

      {erro && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle size={14} /> {erro}
          </p>
          {resultado?.uploaded && (
            <p className="text-[11px] text-amber-700 mt-1">O PDF foi salvo no Storage (<span className="font-mono">{resultado.storage_path}</span>). Reenvie quando o SuperTEG estiver disponível.</p>
          )}
        </div>
      )}
    </div>
  )
}
