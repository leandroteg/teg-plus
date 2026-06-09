// ─────────────────────────────────────────────────────────────────────────────
// RHHolerites.tsx — Admin: RH faz upload de holerites (1 colaborador por vez
// OU batch por arquivo nomeado MATRICULA.pdf / CPF.pdf).
// Mig 131 + bucket rh-holerites. RLS permite escrita so pra RH/admin.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react'
import { Receipt, Upload, Loader2, X, Search, CheckCircle2, AlertTriangle, FileText, FilePlus2 } from 'lucide-react'
import { useUploadHolerite, useHolerites, useRemoverHolerite, type TipoHolerite } from '../../hooks/useHolerites'
import { useRHColaboradores } from '../../hooks/useRH'
import { useTheme } from '../../contexts/ThemeContext'
import ImportarHoleritesZipModal from '../../components/rh/ImportarHoleritesZipModal'
import EnviarLoteHoleritesCard from '../../components/rh/EnviarLoteHoleritesCard'

const TIPOS: { value: TipoHolerite; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: '13o', label: '13º Salário' },
  { value: 'ferias', label: 'Férias' },
  { value: 'rescisao', label: 'Rescisão' },
  { value: 'adiantamento', label: 'Adiantamento' },
]

const fmtCompetencia = (s: string) => {
  const d = new Date(s + (s.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
}

export default function RHHolerites() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight

  const { data: colabs = [] } = useRHColaboradores()
  const upload = useUploadHolerite()
  const remover = useRemoverHolerite()

  const [colaboradorId, setColaboradorId] = useState('')
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [tipo, setTipo] = useState<TipoHolerite>('mensal')
  const [valorLiquido, setValorLiquido] = useState('')
  const [observacao, setObservacao] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [filtroColab, setFiltroColab] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [showImportZip, setShowImportZip] = useState(false)

  const { data: lista = [] } = useHolerites(colaboradorId || undefined)

  const colabsFiltrados = useMemo(() => {
    const q = filtroColab.trim().toLowerCase()
    if (!q) return colabs
    return colabs.filter(c =>
      (c.nome ?? '').toLowerCase().includes(q) ||
      (c.cpf ?? '').includes(q) ||
      (c.matricula ?? '').toLowerCase().includes(q)
    )
  }, [colabs, filtroColab])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleUpload() {
    if (!colaboradorId || !competencia || !file) {
      showToast('error', 'Selecione colaborador, competência e arquivo.')
      return
    }
    try {
      await upload.mutateAsync({
        colaboradorId,
        competencia,
        tipo,
        file,
        valorLiquido: valorLiquido ? Number(valorLiquido.replace(',', '.')) : undefined,
        observacao: observacao.trim() || undefined,
      })
      setFile(null)
      setValorLiquido('')
      setObservacao('')
      if (fileRef.current) fileRef.current.value = ''
      showToast('success', 'Holerite enviado com sucesso')
    } catch (e: any) {
      showToast('error', `Erro: ${e?.message ?? 'desconhecido'}`)
    }
  }

  async function handleRemover(id: string) {
    if (!confirm('Remover este holerite? Esta ação não pode ser desfeita.')) return
    try {
      await remover.mutateAsync(id)
      showToast('success', 'Holerite removido')
    } catch (e: any) {
      showToast('error', `Erro: ${e?.message ?? 'desconhecido'}`)
    }
  }

  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = `rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const inputCls = `w-full rounded-xl border px-3 py-2 text-sm ${isDark ? 'border-white/[0.06] bg-white/[0.02] text-slate-200' : 'border-slate-200 bg-white text-slate-800'} focus:outline-none focus:ring-2 focus:ring-emerald-400/40`

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${txtMain}`}>
            <Receipt size={20} className="text-emerald-600" />
            Holerites (RH)
          </h1>
          <p className={`text-xs mt-0.5 ${txtMuted}`}>
            Envie holerite por colaborador ou em lote (ZIP). Cada colaborador vê os seus em <code>/meus-holerites</code>.
          </p>
        </div>
        <button
          onClick={() => setShowImportZip(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
          title="Subir vários holerites de uma vez via ZIP"
        >
          <FilePlus2 size={13} /> Importar ZIP
        </button>
      </div>

      {showImportZip && (
        <ImportarHoleritesZipModal isLight={isLight} onClose={() => setShowImportZip(false)} />
      )}

      {/* Lote consolidado → SuperTEG */}
      <EnviarLoteHoleritesCard isDark={isDark} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form de upload */}
        <div className={`${cardCls} p-4 space-y-3`}>
          <h2 className={`text-sm font-bold ${txtMain}`}>Enviar holerite (individual)</h2>

          <div>
            <label className={`text-[11px] font-semibold ${txtMuted}`}>Colaborador</label>
            <div className="relative mt-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou matrícula"
                value={filtroColab}
                onChange={e => setFiltroColab(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
            <select
              value={colaboradorId}
              onChange={e => setColaboradorId(e.target.value)}
              className={`${inputCls} mt-2`}
            >
              <option value="">Selecione...</option>
              {colabsFiltrados.slice(0, 100).map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome ?? '—'}{c.matricula ? ` (${c.matricula})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-[11px] font-semibold ${txtMuted}`}>Competência</label>
              <input
                type="month"
                value={competencia.slice(0, 7)}
                onChange={e => setCompetencia(`${e.target.value}-01`)}
                className={`${inputCls} mt-1`}
              />
            </div>
            <div>
              <label className={`text-[11px] font-semibold ${txtMuted}`}>Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as TipoHolerite)}
                className={`${inputCls} mt-1`}
              >
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={`text-[11px] font-semibold ${txtMuted}`}>Valor líquido (opcional)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="3500,00"
              value={valorLiquido}
              onChange={e => setValorLiquido(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-semibold ${txtMuted}`}>Observação (opcional)</label>
            <input
              type="text"
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-semibold ${txtMuted}`}>Arquivo PDF</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className={`${inputCls} mt-1`}
            />
            {file && <p className={`text-[11px] mt-1 ${txtMuted}`}>{file.name}</p>}
          </div>

          <button
            onClick={handleUpload}
            disabled={upload.isPending || !colaboradorId || !file}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {upload.isPending ? 'Enviando...' : 'Enviar holerite'}
          </button>
        </div>

        {/* Lista do colaborador selecionado */}
        <div className={`${cardCls} p-4`}>
          <h2 className={`text-sm font-bold mb-3 ${txtMain}`}>
            Holerites {colaboradorId ? 'do colaborador' : 'enviados'}
            <span className={`text-xs font-normal ml-2 ${txtMuted}`}>({lista.length})</span>
          </h2>
          {lista.length === 0 ? (
            <div className={`py-8 text-center ${txtMuted}`}>
              <FileText size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum holerite encontrado.</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[460px] overflow-y-auto">
              {lista.map(h => (
                <div
                  key={h.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}
                >
                  <FileText size={14} className="text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${txtMain}`}>
                      {fmtCompetencia(h.competencia)} · {TIPOS.find(t => t.value === h.tipo)?.label}
                    </p>
                    <p className={`text-[11px] ${txtMuted} truncate`}>{h.arquivo_nome}</p>
                  </div>
                  <button
                    onClick={() => handleRemover(h.id)}
                    disabled={remover.isPending}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="Remover"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
