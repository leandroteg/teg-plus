// ─────────────────────────────────────────────────────────────────────────────
// components/rh/JornalSection.tsx — Seção "Jornal TEG" do admin do Mural.
// Construtor (upload+recorte) + lista das edições com publicar/excluir/preview.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  Newspaper, Plus, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Loader2, FileText, X,
} from 'lucide-react'
import {
  useEdicoes, useEdicaoCards, useAtualizarEdicao, useExcluirEdicao,
  type JornalEdicao,
} from '../../hooks/useJornal'
import JornalTegBuilder from './JornalTegBuilder'
import { useTheme } from '../../contexts/ThemeContext'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function EdicaoRow({ ed }: { ed: JornalEdicao }) {
  const { isLightSidebar: isLight } = useTheme()
  const [aberto, setAberto] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const { data: cards = [], isLoading } = useEdicaoCards(aberto ? ed.id : undefined)
  const atualizar = useAtualizarEdicao()
  const excluir = useExcluirEdicao()

  return (
    <div className={`rounded-2xl overflow-hidden border ${isLight ? 'bg-white border-slate-200' : 'glass-card border-transparent'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setAberto(a => !a)} className={isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'}>
          {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {ed.capa_url
          ? <img src={ed.capa_url} alt="" className="w-9 h-12 object-cover object-top rounded-md ring-1 ring-white/10" />
          : <div className="w-9 h-12 rounded-md bg-white/5 flex items-center justify-center"><FileText size={14} className="text-slate-500" /></div>}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{ed.titulo}</p>
          <p className="text-[11px] text-slate-500">
            {ed.mes ? `${MESES[ed.mes - 1]} ` : ''}{ed.ano ?? ''}
            {ed.publicado
              ? <span className="text-emerald-400 ml-1.5">· publicada</span>
              : <span className="text-amber-400 ml-1.5">· rascunho</span>}
          </p>
        </div>
        {/* publicar / despublicar */}
        <button
          onClick={() => atualizar.mutate({ id: ed.id, publicado: !ed.publicado })}
          disabled={atualizar.isPending}
          title={ed.publicado ? 'Despublicar' : 'Publicar'}
          className="p-1.5 rounded-lg hover:bg-white/6 text-slate-400 hover:text-white"
        >
          {ed.publicado ? <Eye size={15} className="text-emerald-400" /> : <EyeOff size={15} />}
        </button>
        {/* pdf original */}
        {ed.pdf_url && (
          <a href={ed.pdf_url} target="_blank" rel="noopener noreferrer" title="PDF original"
            className="p-1.5 rounded-lg hover:bg-white/6 text-slate-400 hover:text-violet-300">
            <FileText size={15} />
          </a>
        )}
        {/* excluir */}
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={() => excluir.mutate(ed.id)} disabled={excluir.isPending}
              className="px-2 py-1 rounded-lg bg-red-600 text-[10px] font-bold text-white hover:bg-red-500 disabled:opacity-50">Excluir</button>
            <button onClick={() => setConfirmDel(false)} className="px-2 py-1 rounded-lg border border-white/10 text-[10px] text-slate-400 hover:bg-white/5">Não</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} title="Excluir edição"
            className="p-1.5 rounded-lg hover:bg-white/6 text-red-400 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* preview dos cards (mural) */}
      {aberto && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-violet-400" /></div>
          ) : cards.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-4 text-center">Sem cards nesta edição.</p>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {cards.map(c => (
                <img key={c.id} src={c.imagem_url} alt={c.titulo ?? ''}
                  className="w-full mb-3 rounded-lg ring-1 ring-white/10 break-inside-avoid" loading="lazy" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function JornalSection() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: edicoes = [], isLoading } = useEdicoes()
  const [criando, setCriando] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-500/8 border border-violet-500/20 flex-1">
          <Newspaper size={16} className="text-violet-400 mt-0.5 shrink-0" />
          <div className={`text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Suba o <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white/80'}`}>PDF do Jornal TEG</span> e recorte os blocos —
            cada bloco vira um <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white/80'}`}>card</span> do Mural (imagem exata).
            A edição nasce como rascunho; publique quando quiser exibir aos colaboradores.
          </div>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold shrink-0"
        >
          <Plus size={15} /> Importar Jornal (PDF)
        </button>
      </div>

      {/* Modal de upload + recorte */}
      {criando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className={`w-full sm:max-w-5xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 my-0 sm:my-6 ${isLight ? 'bg-white' : 'bg-[#0A1020] border border-white/10'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <Newspaper size={16} className="text-violet-400" /> Importar Jornal TEG
              </h3>
              <button onClick={() => setCriando(false)} className={isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white'}>
                <X size={20} />
              </button>
            </div>
            <JornalTegBuilder onSaved={() => { /* lista revalida via react-query; usuário fecha no X */ }} />
          </div>
        </div>
      )}

      {/* Lista de edições */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-20 animate-pulse" />)}</div>
      ) : edicoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <Newspaper size={36} className="text-slate-600" />
          <p className="text-sm text-slate-500">Nenhuma edição do Jornal ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {edicoes.map(ed => <EdicaoRow key={ed.id} ed={ed} />)}
        </div>
      )}
    </div>
  )
}
