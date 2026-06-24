import { useState } from 'react'
import { ChevronDown, Check, FolderKanban } from 'lucide-react'

export interface ProjetoLite {
  id: string
  nome: string
  status?: string | null
  centro_custo?: { codigo?: string | null; descricao?: string | null } | null
}

/**
 * Barra compacta de projetos (substitui o card de chips "Projetos do Contrato").
 * Multi-select "Projetos: X/X" no estilo da tela OSC/Obra + botão "Projeto" pra criar.
 * `excluded` = ids de projeto ocultados; vazio = todos selecionados.
 */
export function ProjetosFilterBar({
  projetos, loadingProjetos, excluded, setExcluded, accentText, isLight, rightSlot,
}: {
  projetos: ProjetoLite[]
  loadingProjetos: boolean
  excluded: Set<string>
  setExcluded: React.Dispatch<React.SetStateAction<Set<string>>>
  criando?: boolean
  setCriando?: (v: boolean) => void
  novoProjeto?: { nome: string; centro_custo_id: string }
  setNovoProjeto?: React.Dispatch<React.SetStateAction<{ nome: string; centro_custo_id: string }>>
  handleCriarProjeto?: () => void
  criarProjetoPending?: boolean
  lookupsCC?: { id: string; codigo: string; descricao: string }[]
  accentText: string
  accentBg?: string
  isLight: boolean
  rightSlot?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ativos = projetos.filter(p => p.status !== 'cancelado')
  const total = ativos.length
  const sel = ativos.filter(p => !excluded.has(p.id)).length
  const toggleAll = () => setExcluded(excluded.size === 0 ? new Set(ativos.map(p => p.id)) : new Set())
  const toggle = (id: string) => setExcluded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const nomeProjeto = (p: ProjetoLite) => (p.centro_custo?.descricao || p.nome).replace(/^CEMIG\s*\|\s*/, '')

  const btn = 'text-sm rounded-xl border px-2.5 py-2 outline-none cursor-pointer shrink-0 inline-flex items-center gap-1.5 ' +
    (excluded.size > 0
      ? (isLight ? 'border-teal-300 text-teal-700 bg-teal-50 font-semibold' : 'border-teal-500/40 text-teal-300 bg-teal-500/10 font-semibold')
      : (isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/[0.03] border-white/[0.06] text-slate-300'))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className={`text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        <FolderKanban size={14} className={accentText} /> Projetos
      </h2>
      <div className="relative shrink-0">
        <button onClick={() => setOpen(o => !o)} className={btn} disabled={loadingProjetos}>
          Projetos: {sel}/{total}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className={`absolute z-20 mt-1 left-0 w-64 rounded-xl border shadow-lg p-1.5 max-h-72 overflow-y-auto ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
              <button onClick={toggleAll} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.06]'}`}>
                <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border ${excluded.size === 0 ? 'bg-teal-600 border-teal-600 text-white' : (isLight ? 'border-slate-300' : 'border-white/20')}`}>{excluded.size === 0 && <Check size={11} />}</span>
                Selecionar todos
              </button>
              <div className={`my-1 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`} />
              {ativos.map(p => {
                const on = !excluded.has(p.id)
                return (
                  <button key={p.id} onClick={() => toggle(p.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-white/[0.06]'}`}>
                    <span className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border ${on ? 'bg-teal-600 border-teal-600 text-white' : (isLight ? 'border-slate-300' : 'border-white/20')}`}>{on && <Check size={11} />}</span>
                    {p.centro_custo?.codigo && <span className={`shrink-0 font-mono text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{p.centro_custo.codigo}</span>}
                    <span className="truncate text-left">{nomeProjeto(p)}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      {rightSlot}
    </div>
  )
}
