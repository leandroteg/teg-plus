import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map as MapIcon, UploadCloud, FileText, X, Sparkles, ChevronLeft, AlertCircle, MountainSnow } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCriarOrcamento, type NovoArquivo } from '../../hooks/useOrcamentacao'
import type { OrcArquivoTipo, OrcPremissas } from '../../types/orcamentacao'
import { CARD } from './_ui'

const TIPO_OPTS: { value: OrcArquivoTipo; label: string }[] = [
  { value: 'kmz', label: 'KMZ / Traçado' },
  { value: 'spec', label: 'Especificação' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'outro', label: 'Outro' },
]

function detectarTipo(name: string): OrcArquivoTipo {
  const n = name.toLowerCase()
  if (n.endsWith('.kmz') || n.endsWith('.kml')) return 'kmz'
  if (n.endsWith('.pdf') || n.endsWith('.doc') || n.endsWith('.docx')) return 'spec'
  return 'outro'
}

export default function NovoOrcamento() {
  const nav = useNavigate()
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const inputRef = useRef<HTMLInputElement>(null)
  const criar = useCriarOrcamento()

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [premissas, setPremissas] = useState<OrcPremissas>({ tensao_kv: 138, n_circuitos: 1, fundacao_tipo: 'tubulão', terreno: 'medio', observacoes: '' })
  const [arquivos, setArquivos] = useState<NovoArquivo[]>([])
  const [erro, setErro] = useState('')

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm transition-colors ${
    isDark ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-500 focus:border-amber-400/50'
           : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-amber-400'
  } outline-none`
  const labelCls = `text-[11px] font-bold uppercase tracking-wider ${txtMuted}`

  function addFiles(files: FileList | null) {
    if (!files) return
    const novos: NovoArquivo[] = Array.from(files).map(f => ({ file: f, tipo: detectarTipo(f.name) }))
    setArquivos(prev => [...prev, ...novos])
  }

  const temKmz = arquivos.some(a => a.tipo === 'kmz')
  const podeEnviar = nome.trim().length > 1 && temKmz && !criar.isPending

  async function handleEstimar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome do projeto/LT.'); return }
    if (!temKmz) { setErro('Anexe ao menos um arquivo KMZ/KML com o traçado da LT.'); return }
    try {
      const id = await criar.mutateAsync({ nome, descricao, premissas, arquivos })
      nav(`/orcamentacao/${id}`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar o orçamento.')
    }
  }

  return (
    <div className="space-y-4 p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/orcamentacao')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txt}`}>
            <MapIcon size={22} className="text-amber-500" /> Novo Orçamento
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>O SuperTEG lê o KMZ + especificações e estima custo, prazo e recursos</p>
        </div>
      </div>

      {/* Identificação */}
      <section className={`${CARD(isDark)} p-4 space-y-3`}>
        <p className={`text-sm font-bold ${txt}`}>Identificação</p>
        <div>
          <label className={labelCls}>Nome do projeto / LT *</label>
          <input className={`${inputCls} mt-1`} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: LT 138 kV Três Marias – Frente 2" />
        </div>
        <div>
          <label className={labelCls}>Descrição (opcional)</label>
          <input className={`${inputCls} mt-1`} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Observações gerais do escopo" />
        </div>
      </section>

      {/* Premissas */}
      <section className={`${CARD(isDark)} p-4 space-y-3`}>
        <p className={`text-sm font-bold flex items-center gap-1.5 ${txt}`}><MountainSnow size={14} className="text-amber-500" /> Premissas</p>
        <div>
          <label className={labelCls}>Observações para a análise</label>
          <textarea className={`${inputCls} mt-1 resize-none`} rows={3} value={premissas.observacoes} onChange={e => setPremissas(p => ({ ...p, observacoes: e.target.value }))}
            placeholder="Qual lote regional pegar (ex.: Triângulo) e observações do edital. O relevo, travessias, acesso e canteiro saem automáticos do KMZ × mapas (SRTM/OSM)." />
        </div>
      </section>

      {/* Lote de arquivos */}
      <section className={`${CARD(isDark)} p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <p className={`text-sm font-bold ${txt}`}>Arquivos do lote</p>
          <span className={`text-[11px] ${txtMuted}`}>KMZ obrigatório · specs/contrato opcionais</span>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-xl border-2 border-dashed py-7 flex flex-col items-center gap-2 transition-colors ${
            isDark ? 'border-white/[0.12] hover:border-amber-400/40 hover:bg-white/[0.02]' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
          }`}
        >
          <UploadCloud size={26} className="text-amber-500" />
          <span className={`text-sm font-semibold ${txt}`}>Selecionar arquivos (vários)</span>
          <span className={`text-[11px] ${txtMuted}`}>KMZ / KML, PDF de especificação, contrato…</span>
        </button>
        <input ref={inputRef} type="file" multiple className="hidden"
          accept=".kmz,.kml,.pdf,.doc,.docx,image/*,application/octet-stream"
          onChange={e => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />

        {arquivos.length > 0 && (
          <div className="space-y-2">
            {arquivos.map((a, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
                <FileText size={15} className={a.tipo === 'kmz' ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium truncate ${txt}`}>{a.file.name}</p>
                  <p className={`text-[10px] ${txtMuted}`}>{(a.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <select
                  value={a.tipo}
                  onChange={e => setArquivos(prev => prev.map((x, j) => j === i ? { ...x, tipo: e.target.value as OrcArquivoTipo } : x))}
                  className={`text-[11px] font-semibold rounded-lg px-2 py-1 border ${isDark ? 'bg-white/[0.04] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  {TIPO_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button onClick={() => setArquivos(prev => prev.filter((_, j) => j !== i))} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-500' : 'hover:bg-slate-200 text-slate-400'}`}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {erro && (
        <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2.5 ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
          <AlertCircle size={14} className="shrink-0" /> {erro}
        </div>
      )}

      {/* Ação */}
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] ${txtMuted}`}>Custo real por US (R$ 639/US · Nibo+TOTVS) · exato se informar as US do edital</p>
        <button
          onClick={handleEstimar}
          disabled={!podeEnviar}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
            podeEnviar ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          {criar.isPending
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando…</>
            : <><Sparkles size={16} /> Estimar com SuperTEG</>}
        </button>
      </div>
    </div>
  )
}
