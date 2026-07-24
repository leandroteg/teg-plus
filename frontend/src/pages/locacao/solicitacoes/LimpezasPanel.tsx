// ─────────────────────────────────────────────────────────────────────────────
// LimpezasPanel — limpezas registradas no Portal TEG, por alojamento.
// Mesmas visões lista/cards do resto do módulo; o agrupamento por alojamento é
// o padrão, porque a pergunta do dia a dia é "quando limparam o ALOJ-X?".
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import {
  Search, X, LayoutList, LayoutGrid, Building2, Sparkles, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useLimpezas, useImoveis, type LocLimpeza } from '../../../hooks/useLocacao'

type ViewMode = 'list' | 'cards'

const TIPO_LABEL: Record<string, string> = {
  rotina: 'Rotina', profunda: 'Profunda', pos_saida: 'Pós-saída',
}
const fmtData = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
const pendentesDe = (l: LocLimpeza) => (l.areas ?? []).filter(a => a.estado === 'pendente')

export default function LimpezasPanel() {
  const { isDark } = useTheme()
  const { data: limpezas = [], isLoading } = useLimpezas()
  const { data: imoveis = [] } = useImoveis()

  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [imovelFiltro, setImovelFiltro] = useState('')
  const [soPendencia, setSoPendencia] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [agrupar, setAgrupar] = useState(true)

  // O nome do imóvel não vem na tabela de limpezas — cruzamos aqui.
  const nomeImovel = useMemo(() => {
    const m = new Map<string, string>()
    imoveis.forEach(i => {
      const im = i as { id: string; descricao?: string | null; codigo?: string | null; cidade?: string | null }
      m.set(im.id, im.descricao ?? im.codigo ?? '—')
    })
    return m
  }, [imoveis])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return limpezas.filter(l => {
      if (imovelFiltro && l.imovel_id !== imovelFiltro) return false
      if (tipoFiltro && l.tipo !== tipoFiltro) return false
      if (soPendencia && pendentesDe(l).length === 0) return false
      if (q) {
        const alvo = [nomeImovel.get(l.imovel_id), l.colaborador_nome, l.observacao]
          .filter(Boolean).join(' ').toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [limpezas, busca, tipoFiltro, imovelFiltro, soPendencia, nomeImovel])

  const porImovel = useMemo(() => {
    const m = new Map<string, { nome: string; itens: LocLimpeza[] }>()
    filtradas.forEach(l => {
      const g = m.get(l.imovel_id) ?? { nome: nomeImovel.get(l.imovel_id) ?? '—', itens: [] }
      g.itens.push(l)
      m.set(l.imovel_id, g)
    })
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [filtradas, nomeImovel])

  // Só alojamentos que já têm limpeza — filtro sem opção morta.
  const opcoesImovel = useMemo(() => {
    const ids = new Set(limpezas.map(l => l.imovel_id))
    return [...ids].map(id => [id, nomeImovel.get(id) ?? '—'] as const)
      .sort((a, b) => a[1].localeCompare(b[1]))
  }, [limpezas, nomeImovel])

  const comPendencia = filtradas.filter(l => pendentesDe(l).length > 0).length
  const temFiltro = !!(busca.trim() || tipoFiltro || imovelFiltro || soPendencia)

  const inp = `px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  }`
  const card = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200 shadow-sm'
  const txtMuted = isDark ? 'text-slate-500' : 'text-slate-400'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'

  const LimpezaCard = ({ l, mostraImovel }: { l: LocLimpeza; mostraImovel?: boolean }) => {
    const pend = pendentesDe(l)
    return (
      <div className={`rounded-xl border p-3 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className={`text-xs font-bold ${txtMain}`}>
            {fmtData(l.data)} · {TIPO_LABEL[l.tipo] ?? l.tipo}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            pend.length === 0
              ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
              : (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700')
          }`}>
            {pend.length === 0 ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            {pend.length === 0 ? 'Sem pendências' : `${pend.length} pendente${pend.length > 1 ? 's' : ''}`}
          </span>
        </div>
        {mostraImovel && (
          <p className={`text-[11px] mt-1 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {nomeImovel.get(l.imovel_id) ?? '—'}
          </p>
        )}
        <p className={`text-[10px] mt-1 ${txtMuted}`}>{l.colaborador_nome ?? '—'}</p>
        {pend.length > 0 && (
          <p className={`text-[10px] mt-1 ${txtMuted}`}>Pendente: {pend.map(a => a.area).join(', ')}</p>
        )}
        {l.observacao && <p className={`text-[11px] mt-1.5 ${txtMain}`}>{l.observacao}</p>}
        {(l.fotos ?? []).length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {l.fotos.map(url => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  const LimpezaRow = ({ l, mostraImovel }: { l: LocLimpeza; mostraImovel?: boolean }) => {
    const pend = pendentesDe(l)
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? 'border-white/[0.04]' : 'border-slate-100'}`}>
        <Sparkles size={13} className={`shrink-0 ${pend.length === 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate ${txtMain}`}>
            {mostraImovel ? `${nomeImovel.get(l.imovel_id) ?? '—'} · ` : ''}{TIPO_LABEL[l.tipo] ?? l.tipo}
          </p>
          <p className={`text-[10px] truncate ${txtMuted}`}>
            {l.colaborador_nome ?? '—'}{pend.length > 0 ? ` · pendente: ${pend.map(a => a.area).join(', ')}` : ''}
          </p>
        </div>
        <span className={`w-[70px] text-right text-[11px] shrink-0 ${txtMuted}`}>{fmtData(l.data)}</span>
        <span className={`w-[86px] text-right text-[10px] font-bold shrink-0 ${
          pend.length === 0 ? 'text-emerald-600' : 'text-amber-600'
        }`}>
          {pend.length === 0 ? 'OK' : `${pend.length} pend.`}
        </span>
      </div>
    )
  }

  const render = (itens: LocLimpeza[], mostraImovel?: boolean) =>
    viewMode === 'cards'
      ? <div className="space-y-2 p-3">{itens.map(l => <LimpezaCard key={l.id} l={l} mostraImovel={mostraImovel} />)}</div>
      : <div>{itens.map(l => <LimpezaRow key={l.id} l={l} mostraImovel={mostraImovel} />)}</div>

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${txtMuted}`} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Alojamento, responsável..." className={`${inp} pl-8 w-[220px]`} />
        </div>

        <select value={imovelFiltro} onChange={e => setImovelFiltro(e.target.value)} className={`${inp} w-[210px] truncate`}>
          <option value="">Todos os alojamentos</option>
          {opcoesImovel.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>

        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className={`${inp} w-[130px] truncate`}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <label className={`flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${txtMuted}`}>
          <input type="checkbox" checked={soPendencia} className="accent-amber-500"
            onChange={e => setSoPendencia(e.target.checked)} />
          Só com pendência
        </label>

        <label className={`flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${txtMuted}`}>
          <input type="checkbox" checked={agrupar} className="accent-cyan-500"
            onChange={e => setAgrupar(e.target.checked)} />
          Agrupar por alojamento
        </label>

        {temFiltro && (
          <button onClick={() => { setBusca(''); setTipoFiltro(''); setImovelFiltro(''); setSoPendencia(false) }}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold ${
              isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
            }`}>
            <X size={12} /> Limpar
          </button>
        )}

        <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('list')} title="Lista"
            className={`p-1.5 ${viewMode === 'list' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : txtMuted}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} title="Cards"
            className={`p-1.5 ${viewMode === 'cards' ? (isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700') : txtMuted}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <Sparkles size={13} className="text-cyan-500" /> {filtradas.length} registro(s)
        </span>
        {comPendencia > 0 && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            <AlertTriangle size={13} className="text-amber-500" /> {comPendencia} com pendência
          </span>
        )}
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl overflow-hidden ${card}`}>
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Sparkles size={38} className={txtMuted} />
            <p className={`text-sm ${txtMuted}`}>Nenhuma limpeza registrada ainda.</p>
            <p className={`text-[11px] ${txtMuted}`}>Os registros chegam pelo Portal TEG, na tela de Alojamentos.</p>
          </div>
        </div>
      ) : agrupar ? (
        <div className="space-y-3">
          {porImovel.map(g => {
            const pend = g.itens.filter(l => pendentesDe(l).length > 0).length
            return (
              <div key={g.nome} className={`rounded-2xl overflow-hidden ${card}`}>
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                  <Building2 size={14} className={txtMuted} />
                  <span className={`text-xs font-bold ${txtMain}`}>{g.nome}</span>
                  <span className={`ml-auto text-[11px] font-semibold ${txtMuted}`}>
                    {g.itens.length} limpeza(s){pend > 0 ? ` · ${pend} c/ pendência` : ''}
                  </span>
                </div>
                {render(g.itens)}
              </div>
            )
          })}
        </div>
      ) : (
        <div className={`rounded-2xl overflow-hidden ${card}`}>{render(filtradas, true)}</div>
      )}
    </div>
  )
}
