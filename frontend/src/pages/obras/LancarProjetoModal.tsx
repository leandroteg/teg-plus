// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/LancarProjetoModal.tsx — "Lançar Projeto Técnico".
// Modal simples: Projeto → Obra (filtra por projeto) → OSC (filtra por obra) +
// endereço da pasta do projeto no OneDrive. Ao confirmar, dispara o webhook n8n
// que encaminha ao SuperTEG (/obras/lancar-projeto), que analisa os documentos
// da pasta e preenche os dados da obra/OSC.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { X, FolderSearch, Loader2, Check } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useProjetos, useObrasDoPortfolio, useOSCsDoPortfolio } from '../../hooks/usePMO'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

export default function LancarProjetoModal({ portfolioId, onClose }: { portfolioId?: string; onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()

  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: obras = [] } = useObrasDoPortfolio(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)

  const [projetoId, setProjetoId] = useState('')
  const [obraId, setObraId] = useState('')
  const [oscId, setOscId] = useState('')
  const [pasta, setPasta] = useState('')
  const [estado, setEstado] = useState<'form' | 'enviando' | 'ok' | 'erro'>('form')
  const [msg, setMsg] = useState('')

  const projetosOrd = useMemo(() => [...projetos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [projetos])
  const obrasDoProj = useMemo(() => obras.filter(o => o.pmo_projeto_id === projetoId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [obras, projetoId])
  const oscsDaObra = useMemo(() => oscs.filter(o => o.obra_id === obraId), [oscs, obraId])

  const inp = `w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`
  const lbl = `block text-[11px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`

  const podeConfirmar = projetoId && obraId && pasta.trim() && estado === 'form'

  const confirmar = async () => {
    if (!podeConfirmar) return
    setEstado('enviando'); setMsg('')
    const obra = obrasDoProj.find(o => o.id === obraId)
    const osc = oscsDaObra.find(o => o.id === oscId)
    try {
      const resp = await fetch(`${N8N_BASE}/obras-lancar-projeto`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projeto_id: projetoId,
          obra_id: obraId,
          obra_nome: obra?.nome ?? null,
          osc_id: oscId || null,
          numero_os: osc?.numero_os ?? null,
          onedrive_path: pasta.trim(),
          solicitante: perfil?.nome ?? null,
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setEstado('ok')
    } catch (e) {
      setEstado('erro'); setMsg(String((e as Error).message))
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-2xl lg:rounded-2xl border shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between gap-2 p-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`flex items-center gap-2 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <FolderSearch size={18} className="text-amber-500" /> Lançar Projeto Técnico
          </span>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
        </div>

        {estado === 'ok' ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Enviado para análise</p>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              O SuperTEG vai ler os documentos da pasta e preencher os dados da obra e da OSC. Isso roda em segundo plano — os campos aparecem quando a análise concluir.
            </p>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white">Fechar</button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div>
              <label className={lbl}>Projeto</label>
              <select value={projetoId} onChange={e => { setProjetoId(e.target.value); setObraId(''); setOscId('') }} className={inp}>
                <option value="">Selecione o projeto…</option>
                {projetosOrd.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Obra</label>
              <select value={obraId} onChange={e => { setObraId(e.target.value); setOscId('') }} disabled={!projetoId} className={`${inp} disabled:opacity-50`}>
                <option value="">{projetoId ? 'Selecione a obra…' : 'escolha o projeto primeiro'}</option>
                {obrasDoProj.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>OSC <span className="font-normal normal-case text-slate-400">(opcional)</span></label>
              <select value={oscId} onChange={e => setOscId(e.target.value)} disabled={!obraId} className={`${inp} disabled:opacity-50`}>
                <option value="">{obraId ? 'Todas / não especificar' : 'escolha a obra primeiro'}</option>
                {oscsDaObra.map(o => <option key={o.id} value={o.id}>{o.numero_os}{o.tipo ? ` · ${o.tipo}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Pasta do projeto no OneDrive</label>
              <input value={pasta} onChange={e => setPasta(e.target.value)}
                placeholder="cole o endereço/URL da pasta do projeto…" className={inp} />
              <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Ex.: link da pasta em <b>TEG - OBRAS</b> (o SuperTEG resolve a pasta e lê os documentos técnicos dentro dela).
              </p>
            </div>

            {estado === 'erro' && <p className="text-xs rounded-lg px-3 py-2 bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Falha ao enviar: {msg}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-medium border ${isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-300 text-slate-600'}`}>Cancelar</button>
              <button onClick={confirmar} disabled={!podeConfirmar}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40">
                {estado === 'enviando' ? <Loader2 size={15} className="animate-spin" /> : <FolderSearch size={15} />} Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
