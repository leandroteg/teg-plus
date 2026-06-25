import { useState, useMemo } from 'react'
import {
  ClipboardCheck, Search, X, LayoutList, LayoutGrid, Plus, Loader2,
  FileText, Calendar, AlertTriangle, Clock, CheckSquare, ArrowUp, ArrowDown, Send, ExternalLink,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useDocumentos, useCriarDocumento, usePublicarDocumento, useAdesaoDocumento } from '../../hooks/useSgi'
import { STATUS_DOC_LABEL, TIPO_DOC_LABEL } from '../../types/sgi'
import type { SgiDocumento, StatusDocumento, TipoDocumento } from '../../types/sgi'

const fmtDate = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')

// ── Abas por status (padrão Gestao.tsx) ───────────────────────────────────────
const TABS: { key: StatusDocumento; label: string }[] = [
  { key: 'rascunho',     label: 'Rascunhos' },
  { key: 'em_revisao',   label: 'Em Revisão' },
  { key: 'em_aprovacao', label: 'Em Aprovação' },
  { key: 'vigente',      label: 'Políticas e Processos' },
  { key: 'obsoleto',     label: 'Obsoletos' },
]
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }
const TAB_ACCENT: Record<StatusDocumento, AccentSet> = {
  rascunho:     { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   badge:'bg-slate-200/80 text-slate-700',     border:'border-slate-200' },
  em_revisao:   { bg:'bg-blue-50',    bgActive:'bg-blue-100',    text:'text-blue-500',    textActive:'text-blue-800',    badge:'bg-blue-200/80 text-blue-700',       border:'border-blue-200' },
  em_aprovacao: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   badge:'bg-amber-200/80 text-amber-700',     border:'border-amber-200' },
  vigente:      { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  obsoleto:     { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-400',   textActive:'text-slate-700',   badge:'bg-slate-200/80 text-slate-500',     border:'border-slate-200' },
}
const TAB_ACCENT_DARK: Record<StatusDocumento, AccentSet> = {
  rascunho:     { bg:'bg-slate-500/5',  bgActive:'bg-slate-500/15',  text:'text-slate-400',   textActive:'text-slate-200',   badge:'bg-slate-500/15 text-slate-300',   border:'border-slate-500/20' },
  em_revisao:   { bg:'bg-blue-500/5',   bgActive:'bg-blue-500/15',   text:'text-blue-400',    textActive:'text-blue-200',    badge:'bg-blue-500/15 text-blue-300',     border:'border-blue-500/20' },
  em_aprovacao: { bg:'bg-amber-500/5',  bgActive:'bg-amber-500/15',  text:'text-amber-400',   textActive:'text-amber-200',   badge:'bg-amber-500/15 text-amber-300',   border:'border-amber-500/20' },
  vigente:      { bg:'bg-emerald-500/5',bgActive:'bg-emerald-500/15',text:'text-emerald-400', textActive:'text-emerald-200', badge:'bg-emerald-500/15 text-emerald-300',border:'border-emerald-500/20' },
  obsoleto:     { bg:'bg-slate-500/5',  bgActive:'bg-slate-500/15',  text:'text-slate-400',   textActive:'text-slate-300',   badge:'bg-slate-500/15 text-slate-400',   border:'border-slate-500/20' },
}

// ── Modal de detalhe (padrão Ativos.tsx) ──────────────────────────────────────
function DocDetailModal({ doc, onClose, isDark }: { doc: SgiDocumento; onClose: () => void; isDark: boolean }) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-400'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const st = STATUS_DOC_LABEL[doc.status]
  const today = new Date().toISOString().split('T')[0]
  const revVencida = doc.proxima_revisao && doc.proxima_revisao < today && doc.status === 'vigente'
  const publicar = usePublicarDocumento()
  const { data: adesao = [] } = useAdesaoDocumento(doc.requer_ciencia ? doc.id : undefined)
  const concl = adesao.filter(a => a.status === 'concluida').length
  const handlePublicar = async () => {
    const r = await publicar.mutateAsync(doc.id)
    if (r.ok) alert(r.requer_ciencia ? `Publicado e enviado: ${r.missoes_criadas ?? 0} missão(ões) de ciência criada(s) no Portal TEG.` : 'Documento publicado (vigente).')
    else alert('Erro ao publicar: ' + (r.erro || ''))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-violet-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txtMain}`}>{doc.codigo ? `${doc.codigo} · ` : ''}{doc.titulo}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${st.bg} ${st.text}`}>
              <span className={`w-2 h-2 rounded-full ${st.dot}`} /> {st.label}
            </span>
          </div>

          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Identificação</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Código</p><p className={`font-semibold ${txtMain}`}>{doc.codigo || '—'}</p></div>
              <div><p className={txtMuted}>Tipo</p><p className={`font-semibold ${txtMain}`}>{TIPO_DOC_LABEL[doc.tipo]}</p></div>
              <div><p className={txtMuted}>Área / Processo</p><p className={`font-semibold ${txtMain}`}>{doc.area_processo || '—'}</p></div>
              <div><p className={txtMuted}>Versão</p><p className={`font-semibold ${txtMain}`}>v{doc.versao}</p></div>
            </div>
          </div>

          {doc.descricao && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Descrição</p>
              <p className={`text-xs ${txtMain}`}>{doc.descricao}</p>
            </div>
          )}

          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Revisão & Ciência</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <p className={txtMuted}>Próxima revisão</p>
                <p className={`font-semibold ${revVencida ? 'text-red-500' : txtMain}`}>
                  {fmtDate(doc.proxima_revisao)}{revVencida && <AlertTriangle size={11} className="inline ml-1" />}
                </p>
              </div>
              <div><p className={txtMuted}>Periodicidade</p><p className={`font-semibold ${txtMain}`}>{doc.periodicidade_revisao_meses ? `${doc.periodicidade_revisao_meses} meses` : '—'}</p></div>
              <div className="col-span-2"><p className={txtMuted}>Exige ciência</p><p className={`font-semibold ${txtMain}`}>{doc.requer_ciencia ? 'Sim — via Missões do Portal TEG' : 'Não'}</p></div>
            </div>
          </div>

          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Auditoria</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Criado por</p><p className={`font-semibold ${txtMain}`}>{doc.criado_por_nome || '—'}</p></div>
              <div><p className={txtMuted}>Atualizado por</p><p className={`font-semibold ${txtMain}`}>{doc.atualizado_por_nome || '—'}</p></div>
              <div><p className={txtMuted}>Cadastrado em</p><p className={`font-semibold ${txtMain}`}>{fmtDate(doc.created_at?.split('T')[0])}</p></div>
            </div>
          </div>

          {doc.requer_ciencia && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ciência (Missões do Portal)</p>
                {adesao.length > 0 && <span className={`text-[10px] font-bold ${txtMain}`}>{concl}/{adesao.length} ciente(s)</span>}
              </div>
              {adesao.length === 0 ? (
                <p className={`text-xs ${txtMuted}`}>Ainda não publicado para ciência.</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {adesao.slice(0, 8).map(a => (
                    <div key={a.colaborador_id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={`truncate ${txtMain}`}>{a.nome || '—'}</span>
                      <span className={a.status === 'concluida' ? 'text-emerald-500 font-semibold' : txtMuted}>{a.status === 'concluida' ? `Ciente ${fmtDate(a.concluida_em ? a.concluida_em.split('T')[0] : null)}` : 'Pendente'}</span>
                    </div>
                  ))}
                  {adesao.length > 8 && <p className={`text-[10px] ${txtMuted}`}>+{adesao.length - 8} colaborador(es)</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {doc.arquivo_url && (
              <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer"
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${isDark ? 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
                <ExternalLink size={15} /> Abrir documento
              </a>
            )}
            {doc.status !== 'obsoleto' && (
              <button onClick={handlePublicar} disabled={publicar.isPending} className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {publicar.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {doc.status === 'vigente' ? 'Republicar ciência' : 'Publicar'}
              </button>
            )}
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal Novo Documento (padrão modal de formulário) ─────────────────────────
function NovoDocModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criar = useCriarDocumento()
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoDocumento>('procedimento')
  const [area, setArea] = useState('')
  const [descricao, setDescricao] = useState('')
  const [requerCiencia, setRequerCiencia] = useState(false)
  const [periodicidade, setPeriodicidade] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-violet-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-violet-400'}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    await criar.mutateAsync({
      titulo: titulo.trim(),
      tipo,
      area_processo: area || undefined,
      descricao: descricao || undefined,
      requer_ciencia: requerCiencia,
      periodicidade_revisao_meses: periodicidade ? Number(periodicidade) : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Novo Documento</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Procedimento de Bloqueio e Etiquetagem" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoDocumento)} className={inputCls}>
                {Object.entries(TIPO_DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Área / Processo</label>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: QSMS" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descrição</label>
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Objetivo / escopo do documento..." className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Revisão a cada (meses)</label>
              <input type="number" value={periodicidade} onChange={e => setPeriodicidade(e.target.value)} placeholder="12" className={inputCls} />
            </div>
            <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer py-2 ${txtMuted}`}>
              <input type="checkbox" checked={requerCiencia} onChange={e => setRequerCiencia(e.target.checked)} className="w-4 h-4 accent-violet-600" />
              Exige ciência (Portal TEG)
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending || !titulo.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar Documento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SgiPadronizacao() {
  const { isDark } = useTheme()
  const { data: documentos = [], isLoading } = useDocumentos()

  const [tab, setTab] = useState<StatusDocumento>('vigente')
  const [busca, setBusca] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [detail, setDetail] = useState<SgiDocumento | null>(null)
  const [showNovo, setShowNovo] = useState(false)
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const toggleSort = (c: string) => { if (sortCol === c) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(c); setSortDir('asc') } }

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    documentos.forEach(d => { m[d.status] = (m[d.status] || 0) + 1 })
    return m
  }, [documentos])

  const filtrados = useMemo(() => {
    let items = documentos.filter(d => d.status === tab)
    if (busca) { const q = busca.toLowerCase(); items = items.filter(d => [d.codigo, d.titulo, d.area_processo].some(v => v?.toLowerCase().includes(q))) }
    if (tipoFilter) items = items.filter(d => d.tipo === tipoFilter)
    if (sortCol) {
      items = [...items].sort((a, b) => {
        let va: string | number = '', vb: string | number = ''
        switch (sortCol) {
          case 'codigo': va = a.codigo || ''; vb = b.codigo || ''; break
          case 'titulo': va = a.titulo; vb = b.titulo; break
          case 'tipo': va = a.tipo; vb = b.tipo; break
          case 'versao': va = a.versao; vb = b.versao; break
          case 'revisao': va = a.proxima_revisao || '9999'; vb = b.proxima_revisao || '9999'; break
        }
        const cmp = typeof va === 'number' ? (va as number) - (vb as number) : String(va).localeCompare(String(vb))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return items
  }, [documentos, tab, busca, tipoFilter, sortCol, sortDir])

  const today = new Date().toISOString().split('T')[0]

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <ClipboardCheck size={18} className="text-violet-500" /> Padronização
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Controle documental — versão, aprovação, vigência e ciência</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors shrink-0">
          <Plus size={14} /> Novo Documento
        </button>
      </div>

      {/* Abas (padrão Gestao.tsx) */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TABS.map(t => {
          const count = counts[t.key] || 0
          const isActive = tab === t.key
          const a = isDark ? TAB_ACCENT_DARK[t.key] : TAB_ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Toolbar (padrão Ativos.tsx) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar documento..."
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>}
          </div>
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
            className={`rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-600'}`}>
            <option value="">Tipo</option>
            {Object.entries(TIPO_DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button onClick={() => setView('table')} className={`p-1.5 ${view === 'table' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
            <button onClick={() => setView('cards')} className={`p-1.5 ${view === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
          </div>
        </div>

        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtrados.length} documento(s)</p>

        {filtrados.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <FileText size={36} className="mb-2" /><p className="text-sm">Nenhum documento nesta etapa</p>
          </div>
        ) : view === 'table' ? (
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                  {[
                    { key: 'codigo', label: 'CÓDIGO', align: 'text-left' },
                    { key: 'titulo', label: 'DOCUMENTO', align: 'text-left' },
                    { key: 'tipo', label: 'TIPO', align: 'text-left' },
                    { key: '', label: 'ÁREA', align: 'text-left' },
                    { key: 'versao', label: 'VERSÃO', align: 'text-center' },
                    { key: 'revisao', label: 'PRÓX. REVISÃO', align: 'text-right' },
                    { key: '', label: 'CIÊNCIA', align: 'text-center' },
                  ].map(col => (
                    <th key={col.label} className={`${col.align} px-3 py-2 font-semibold ${col.key ? 'cursor-pointer select-none hover:text-slate-600' : ''}`} onClick={() => col.key && toggleSort(col.key)}>
                      <span className="inline-flex items-center gap-1">{col.label}{sortCol === col.key && col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(doc => {
                  const venc = doc.proxima_revisao
                  const isVencida = venc && venc < today && doc.status === 'vigente'
                  const isVencendo = venc && venc >= today && venc <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
                  return (
                    <tr key={doc.id} onClick={() => setDetail(doc)} className={`cursor-pointer transition-all ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}`}>
                      <td className={`px-3 py-2.5 font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{doc.codigo || '—'}</td>
                      <td className="px-3 py-2.5"><p className={`font-semibold truncate max-w-[260px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{doc.titulo}</p></td>
                      <td className={`px-3 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{TIPO_DOC_LABEL[doc.tipo]}</td>
                      <td className={`px-3 py-2.5 truncate max-w-[120px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{doc.area_processo || '—'}</td>
                      <td className={`px-3 py-2.5 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>v{doc.versao}</td>
                      <td className={`px-3 py-2.5 text-right ${isVencida ? 'text-red-600 font-bold' : isVencendo ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {fmtDate(venc)}
                        {isVencida && <AlertTriangle size={10} className="inline ml-1 text-red-500" />}
                        {isVencendo && !isVencida && <Clock size={10} className="inline ml-1 text-amber-500" />}
                      </td>
                      <td className="px-3 py-2.5 text-center">{doc.requer_ciencia ? <CheckSquare size={14} className="inline text-violet-500" /> : <span className="text-slate-400">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(doc => {
              const st = STATUS_DOC_LABEL[doc.status]
              return (
                <button key={doc.id} type="button" onClick={() => setDetail(doc)} className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{doc.codigo ? `${doc.codigo} · ` : ''}{doc.titulo}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.text}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
                  </div>
                  <p className={`text-xs flex items-center gap-1 mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><FileText size={11} /> {TIPO_DOC_LABEL[doc.tipo]} · v{doc.versao}{doc.area_processo ? ` · ${doc.area_processo}` : ''}</p>
                  <div className="flex items-center justify-between mt-1">
                    {doc.proxima_revisao
                      ? <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={10} className="inline mr-1" />Revisão: {fmtDate(doc.proxima_revisao)}</span>
                      : <span />}
                    {doc.requer_ciencia && <span className="text-[10px] font-semibold text-violet-500 flex items-center gap-1"><CheckSquare size={11} /> Ciência</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {detail && <DocDetailModal doc={detail} onClose={() => setDetail(null)} isDark={isDark} />}
      {showNovo && <NovoDocModal onClose={() => setShowNovo(false)} isDark={isDark} />}
    </div>
  )
}
