// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/Relatorios.tsx — PDFs das verificações do SuperTEG.
// Ver (modal), baixar e apagar (com confirmação).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { FileText, Eye, Download, Trash2, X, Loader2, AlertTriangle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useVerificacoes, useApagarVerificacao, getVerificacaoPdfUrl, type RHVerificacao } from '../../hooks/useVerificacoes'

const TIPO_LABEL: Record<string, string> = {
  verificacao: 'Verificação', parecer: 'Parecer', historico: 'Histórico', outros: 'Outros',
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return s }
}

export default function Relatorios() {
  const { isDark } = useTheme()
  const { data: verificacoes = [] } = useVerificacoes()
  const apagar = useApagarVerificacao()

  const [viewing, setViewing] = useState<{ v: RHVerificacao; url: string } | null>(null)
  const [loadingView, setLoadingView] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<RHVerificacao | null>(null)

  const prontos = verificacoes.filter(v => v.status === 'concluido' && v.pdf_path)

  const card = isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'

  async function abrir(v: RHVerificacao, modo: 'ver' | 'baixar') {
    if (!v.pdf_path) return
    setLoadingView(v.id + modo)
    const url = await getVerificacaoPdfUrl(v.pdf_path)
    setLoadingView(null)
    if (!url) return
    if (modo === 'ver') setViewing({ v, url })
    else window.open(url, '_blank')
  }

  return (
    <div className="h-full overflow-auto">
      <div className={`rounded-2xl border p-4 ${card}`}>
        <p className={`text-sm font-bold mb-3 ${txtMain}`}>Relatórios ({prontos.length})</p>
        {prontos.length === 0 ? (
          <p className={`text-xs ${txtMuted}`}>Nenhum relatório pronto. Os PDFs concluídos na aba Verificações aparecem aqui.</p>
        ) : (
          <div className="space-y-2">
            {prontos.map(v => (
              <div key={v.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/50'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${txtMain}`}>{v.titulo || TIPO_LABEL[v.tipo] || v.tipo}</p>
                  <p className={`text-xs truncate ${txtMuted}`}>{TIPO_LABEL[v.tipo] || v.tipo} · {fmtDate(v.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => abrir(v, 'ver')} title="Ver"
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                    {loadingView === v.id + 'ver' ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => abrir(v, 'baixar')} title="Baixar"
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}>
                    {loadingView === v.id + 'baixar' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  </button>
                  <button onClick={() => setConfirmDel(v)} title="Apagar"
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-red-50 text-red-500'}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de visualização do PDF */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewing(null)}>
          <div className={`w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <p className={`text-sm font-bold truncate ${txtMain}`}>{viewing.v.titulo || TIPO_LABEL[viewing.v.tipo]}</p>
              <button onClick={() => setViewing(null)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}><X size={18} /></button>
            </div>
            <iframe src={viewing.url} title="PDF" className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDel(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 ${isDark ? 'bg-[#0f172a] border border-white/[0.06]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={20} className="text-red-500" />
              <p className={`text-base font-bold ${txtMain}`}>Apagar relatório?</p>
            </div>
            <p className={`text-sm mb-4 ${txtMuted}`}>
              "{confirmDel.titulo || TIPO_LABEL[confirmDel.tipo]}" e seu PDF serão removidos. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
              <button onClick={async () => { await apagar.mutateAsync({ id: confirmDel.id, pdf_path: confirmDel.pdf_path }); setConfirmDel(null) }}
                disabled={apagar.isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {apagar.isPending && <Loader2 size={14} className="animate-spin" />} Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
