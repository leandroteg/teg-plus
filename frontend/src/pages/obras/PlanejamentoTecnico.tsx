// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/PlanejamentoTecnico.tsx — aba "Planejamento" da Gestão de Obras.
// Réplica da planilha "ACOMPANHAMENTO MODELO": matriz ATIVIDADES (catálogo
// padrão, por seção) × ESTRUTURAS/TORRES da obra. Cada célula = DATA + AVANÇO.
// Bloco esquerdo: QTD PREV · EXECUTADO (qtd/%) · FALTANTE. Tabelas:
// obr_estruturas (colunas) + obr_atividade_avanco (células).
// O preenchimento do RDO atualizará estas células (integração futura).
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Loader2, Search, Trash2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useObrasDoPortfolio, useOSCsDoPortfolio, useProjetos } from '../../hooks/usePMO'
import { useObrasFiltros, ObrasFiltrosBar, agruparOscsPorObra, obraPassa } from './obrasFiltros'


// Catálogo padrão (planilha ACOMPANHAMENTO MODELO — 32 atividades por seção)
const CATALOGO: { secao: string; atividades: string[] }[] = [
  { secao: 'Preliminar Fundação', atividades: [
    'CONFERÊNCIA TOPOGRÁFICA', 'LOCAÇÃO DE CAVAS', 'ABERTURA E IDENTIFICAÇÃO DE ACESSO',
  ]},
  { secao: 'Fundação', atividades: [
    'ARMAÇÃO/MONTAGEM DE FERRAGENS', 'ESCAVAÇÃO DE CAVAS', 'NIVELAMENTO DE STUBS E FORMAS',
    'CONCRETAGEM DE FUNDAÇÃO', 'RETIRADA DE FORMAS',
  ]},
  { secao: 'Aterramento', atividades: [
    'INSTALAÇÃO DE FIO CONTRAPESO', 'MEDIÇÃO DE RESISTÊNCIA',
  ]},
  { secao: 'Montagem', atividades: [
    'CONFERÊNCIA DE POSIÇÕES', 'TRANSPORTE DE FERRAGENS PARA O CAMPO', 'PRÉ-MONTAGEM DE ESTRUTURAS',
    'MONTAGEM DE ESTRUTURAS', 'REVISÃO DE ESTRUTURAS',
  ]},
  { secao: 'Lançamento', atividades: [
    'ABERTURA DE FAIXA DE SERVIDÃO', 'PREPARAÇÃO CONDUTOR', 'LANÇAMENTO DE CABOS CONDUTORES',
    'NIVELAMENTO DE CABOS CONDUTOR', 'GRAMPEAÇÃO E ENCABEÇAMENTO DE CONDUTOR', 'REVISÃO FINAL DE CABO CONDUTOR',
    'PREPARAÇÃO DE CABO PARA-RAIO', 'LANÇAMENTO DE CABO PARA-RAIO', 'NIVELAMENTO DE CABO PARA-RAIO',
    'GRAMPEAÇÃO E ENCABEÇAMENTO DE PARA-RAIO', 'REVISÃO FINAL DE CABO PARA-RAIO', 'INSTALAÇÃO DE SINALIZAÇÃO AÉREA',
  ]},
  { secao: 'Acabamento', atividades: [
    'SECCIONAMENTO E ATERRAMENTO DE CERCAS', 'PINTURA, NUMERAÇÃO, ETC', 'ACABAMENTO FINAL DE SOLO - PRAD',
  ]},
  { secao: 'Outros', atividades: [
    'COMISSIONAMENTO FINAL', 'ENERGIZAÇÃO',
  ]},
]
const SECAO_COR: Record<string, string> = {
  'Preliminar Fundação': '#64748b', 'Fundação': '#f59e0b', 'Aterramento': '#10b981',
  'Montagem': '#6366f1', 'Lançamento': '#0ea5e9', 'Acabamento': '#8b5cf6', 'Outros': '#94a3b8',
}

interface Estrutura { id: string; obra_id: string; nome: string; tipo: string | null; peso_ton: number | null; dist_prox_m: number | null; ordem: number }
interface Celula { id: string; estrutura_id: string; atividade: string; data: string | null; avanco: number; data_prev: string | null; avanco_prev: number; responsavel_nome: string | null }

function useEstruturas(obraId?: string) {
  return useQuery<Estrutura[]>({
    queryKey: ['obr-estruturas', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_estruturas').select('*').eq('obra_id', obraId!).order('ordem').order('nome')
      return (data ?? []) as Estrutura[]
    },
  })
}
function useCelulas(obraId?: string) {
  return useQuery<Celula[]>({
    queryKey: ['obr-ativ-avanco', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data } = await supabase.from('obr_atividade_avanco').select('id, estrutura_id, atividade, data, avanco, data_prev, avanco_prev, responsavel_nome').eq('obra_id', obraId!)
      return (data ?? []) as Celula[]
    },
  })
}

export default function PlanejamentoTecnico({ portfolioId }: { portfolioId?: string }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const { data: obras = [] } = useObrasDoPortfolio(portfolioId)
  const { data: projetos = [] } = useProjetos(portfolioId)
  const { data: oscs = [] } = useOSCsDoPortfolio(portfolioId)
  const [obraId, setObraId] = useState('')

  // filtros padrão da Gestão de Obras (compartilhados entre as abas)
  const f = useObrasFiltros()

  // métricas por obra (OSCs + medição + engine EAP) pra alimentar os filtros
  const oscsPorObra = useMemo(() => agruparOscsPorObra(oscs), [oscs])



  // obras filtradas → alimentam o select de Obra
  const obrasFiltradas = useMemo(() => obras.filter(o => obraPassa(o, oscsPorObra, f)), [obras, oscsPorObra, f])

  const obraSel = (obraId && obrasFiltradas.some(o => o.id === obraId)) ? obraId : obrasFiltradas[0]?.id
  const { data: estruturas = [], isLoading } = useEstruturas(obraSel)
  const { data: celulas = [] } = useCelulas(obraSel)

  const [qTorre, setQTorre] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [novo, setNovo] = useState({ nome: '', tipo: '', peso: '', dist: '' })
  const [edit, setEdit] = useState<{ est: Estrutura; atividade: string; cel?: Celula; lado: 'prev' | 'real' } | null>(null)

  const cel = useMemo(() => {
    const m = new Map<string, Celula>()
    for (const c of celulas) m.set(`${c.estrutura_id}|${c.atividade}`, c)
    return m
  }, [celulas])

  const cols = useMemo(() => estruturas.filter(e => !qTorre.trim() || e.nome.toLowerCase().includes(qTorre.toLowerCase())), [estruturas, qTorre])

  const addEstrutura = useMutation({
    mutationFn: async () => {
      if (!novo.nome.trim() || !obraSel) return
      const { error } = await supabase.from('obr_estruturas').insert({
        obra_id: obraSel, nome: novo.nome.trim(), tipo: novo.tipo.trim() || null,
        peso_ton: novo.peso.trim() ? Number(novo.peso.replace(',', '.')) : null,
        dist_prox_m: novo.dist.trim() ? Number(novo.dist.replace(',', '.')) : null,
        ordem: estruturas.length + 1,
      })
      if (error) throw error
    },
    onSuccess: () => { setNovo({ nome: '', tipo: '', peso: '', dist: '' }); setAddOpen(false); qc.invalidateQueries({ queryKey: ['obr-estruturas', obraSel] }) },
  })
  const delEstrutura = useMutation({
    mutationFn: async (id: string) => { await supabase.from('obr_estruturas').delete().eq('id', id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['obr-estruturas', obraSel] }); qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraSel] }) },
  })
  const salvarCel = useMutation({
    mutationFn: async (p: { estrutura_id: string; atividade: string; data: string | null; avanco: number; lado: 'prev' | 'real' }) => {
      // upsert só grava as colunas enviadas — o outro lado (prev/real) fica intacto
      const campos = p.lado === 'prev'
        ? { data_prev: p.data, avanco_prev: p.avanco }
        : { data: p.data, avanco: p.avanco }
      const { error } = await supabase.from('obr_atividade_avanco').upsert({
        obra_id: obraSel, estrutura_id: p.estrutura_id, atividade: p.atividade,
        ...campos, responsavel_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
      }, { onConflict: 'estrutura_id,atividade' })
      if (error) throw error
    },
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraSel] }) },
  })

  // apaga só o lado editado (Prev ou Real); se o outro lado também ficar vazio, remove a linha
  const apagarCel = useMutation({
    mutationFn: async (p: { estrutura_id: string; atividade: string; cel?: Celula; lado: 'prev' | 'real' }) => {
      const outroVazio = p.lado === 'prev'
        ? !p.cel?.data && !(p.cel?.avanco ?? 0)
        : !p.cel?.data_prev && !(p.cel?.avanco_prev ?? 0)
      if (outroVazio) {
        const { error } = await supabase.from('obr_atividade_avanco').delete()
          .eq('estrutura_id', p.estrutura_id).eq('atividade', p.atividade)
        if (error) throw error
        return
      }
      const campos = p.lado === 'prev' ? { data_prev: null, avanco_prev: 0 } : { data: null, avanco: 0 }
      const { error } = await supabase.from('obr_atividade_avanco').update({
        ...campos, responsavel_nome: perfil?.nome ?? null, updated_at: new Date().toISOString(),
      }).eq('estrutura_id', p.estrutura_id).eq('atividade', p.atividade)
      if (error) throw error
    },
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['obr-ativ-avanco', obraSel] }) },
  })

  const card = isDark ? 'bg-[#111827] border border-white/[0.06]' : 'bg-white border border-slate-200'
  const sel = `appearance-none rounded-lg px-2.5 py-1.5 border text-xs font-semibold cursor-pointer ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`
  const th = `text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  const prevCor = (av: number) => av >= 1 ? 'bg-sky-500 text-white' : av > 0 ? 'bg-sky-200 text-sky-900' : (isDark ? 'bg-white/[0.03] text-slate-600' : 'bg-slate-50 text-slate-400')
  const celCor = (av: number) => av >= 1 ? 'bg-emerald-500 text-white' : av > 0 ? 'bg-amber-400 text-slate-900' : (isDark ? 'bg-white/[0.04] text-slate-600' : 'bg-slate-100 text-slate-400')

  return (
    <div className="space-y-3">
      {/* Filtros — todos na 1ª linha, mesmo padrão de caixa de seleção múltipla */}
      <div className={`rounded-2xl ${card} p-3 flex items-center gap-2 flex-wrap`}>
        <ObrasFiltrosBar projetos={projetos} oscs={oscs} f={f} isDark={isDark} onChange={() => setObraId('')} />
        <select value={obraSel ?? ''} onChange={e => setObraId(e.target.value)} className={`${sel} max-w-[280px] truncate font-bold`}>
          {obrasFiltradas.length === 0 && <option value="">— nenhuma obra no filtro —</option>}
          {obrasFiltradas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        {/* cresce/encolhe com a tela, sem estourar a linha */}
        <div className="relative flex-1 min-w-[110px] max-w-[240px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={qTorre} onChange={e => setQTorre(e.target.value)} placeholder="filtrar torre..." className={`w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`} />
        </div>
        <div className="flex-1" />
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{obrasFiltradas.length} obra(s) · {estruturas.length} estrutura(s)</span>
        <button onClick={() => setAddOpen(v => !v)} title="Adicionar estrutura/torre"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-orange-600 hover:bg-orange-700 text-white">
          <Plus size={15} />
        </button>
      </div>

      {addOpen && (
        <div className={`rounded-xl ${card} p-3 flex items-end gap-2 flex-wrap`}>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">TORRE / ESTRUTURA
            <input value={novo.nome} onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))} placeholder="76B" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">TIPO
            <input value={novo.tipo} onChange={e => setNovo(n => ({ ...n, tipo: e.target.value }))} placeholder="DL3A" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">PESO (t)
            <input value={novo.peso} onChange={e => setNovo(n => ({ ...n, peso: e.target.value }))} placeholder="273,3" className={`${sel} w-24`} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">DIST. PRÓX. TORRE (m)
            <input value={novo.dist} onChange={e => setNovo(n => ({ ...n, dist: e.target.value }))} placeholder="380" className={`${sel} w-28`} /></label>
          <button onClick={() => addEstrutura.mutate()} disabled={!novo.nome.trim() || addEstrutura.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
            {addEstrutura.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Adicionar'}
          </button>
        </div>
      )}

      {/* Matriz */}
      <div className={`rounded-xl ${card} overflow-x-auto`}>
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400 flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" /> carregando…</div>
        ) : (
          <table className="border-collapse text-xs min-w-full">
            <thead>
              <tr>
                <th rowSpan={2} className={`sticky left-0 z-10 px-2 py-1.5 text-left align-bottom ${th} ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>Seção</th>
                <th rowSpan={2} className={`sticky left-[86px] z-10 px-2 py-1.5 text-left align-bottom ${th} min-w-[230px] ${isDark ? 'bg-[#111827]' : 'bg-white'}`}>Atividade</th>
                <th rowSpan={2} className={`px-1.5 py-1.5 align-bottom ${th} text-right`} title="Quantidade prevista (estruturas)">Qtd prev.</th>
                <th rowSpan={2} className={`px-1.5 py-1.5 align-bottom ${th} text-right`} title="Executado (qtd)">Exec.</th>
                <th rowSpan={2} className={`px-1.5 py-1.5 align-bottom ${th} text-right`} title="Executado (%)">%</th>
                <th rowSpan={2} className={`px-1.5 py-1.5 align-bottom ${th} text-right`} title="Faltante (qtd)">Falt.</th>
                <th rowSpan={2} className={`px-1.5 py-1.5 align-bottom ${th} text-right`} title="Faltante (%)">%</th>
                {cols.map(e => (
                  <th key={e.id} colSpan={2} className={`px-1 py-1.5 text-center min-w-[120px] ${isDark ? 'bg-teal-500/[0.10] border-l border-white/[0.12]' : 'bg-teal-50 border-l border-slate-300'}`}>
                    <div className={`text-[11px] font-extrabold ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>{e.nome}</div>
                    <div className={`text-[9px] font-semibold ${isDark ? 'text-teal-400/70' : 'text-teal-600/80'}`}>{e.tipo ?? '—'}{e.peso_ton ? ` · ${e.peso_ton}t` : ''}</div>
                    {e.dist_prox_m != null && <div className="text-[9px] text-sky-500 font-semibold">→ {e.dist_prox_m.toLocaleString('pt-BR')} m</div>}
                    <button onClick={() => { if (confirm(`Remover ${e.nome}?`)) delEstrutura.mutate(e.id) }} className="text-slate-300 hover:text-rose-500"><X size={10} /></button>
                  </th>
                ))}
              </tr>
              {/* sub-cabeçalho: cada torre tem Previsto | Realizado */}
              <tr>
                {cols.map(e => [
                  <th key={e.id + '-p'} className={`px-0.5 pb-1 text-center text-[8px] font-bold uppercase tracking-wide ${isDark ? 'bg-sky-500/[0.10] text-sky-300 border-l border-white/[0.12]' : 'bg-sky-50 text-sky-700 border-l border-slate-300'}`}>Prev</th>,
                  <th key={e.id + '-r'} className={`px-0.5 pb-1 text-center text-[8px] font-bold uppercase tracking-wide ${isDark ? 'bg-emerald-500/[0.10] text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>Real</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {CATALOGO.map(g => g.atividades.map((atv, ai) => {
                const prev = cols.length
                const exec = cols.reduce((s, e) => s + Math.min(1, cel.get(`${e.id}|${atv}`)?.avanco ?? 0), 0)
                const pct = prev ? Math.round((exec / prev) * 100) : 0
                const falt = Math.max(0, prev - exec)          // planilha: FALTANTE (qtd)
                const pctFalt = prev ? Math.round((falt / prev) * 100) : 0
                return (
                  <tr key={g.secao + atv} className={isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-50'}>
                    {ai === 0 && (
                      <td rowSpan={g.atividades.length}
                        className={`sticky left-0 z-10 px-2 py-1 align-top text-[10px] font-bold w-[86px] ${isDark ? 'bg-[#111827]' : 'bg-white'}`}
                        style={{ color: SECAO_COR[g.secao] }}>{g.secao}</td>
                    )}
                    <td className={`sticky left-[86px] z-10 px-2 py-1 text-[11px] ${isDark ? 'bg-[#111827] text-slate-300' : 'bg-white text-slate-600'}`}>{atv}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{prev || '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{exec ? exec.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold ${pct >= 100 ? 'text-emerald-500' : pct > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{pct ? `${pct}%` : '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums ${falt > 0 ? (isDark ? 'text-slate-300' : 'text-slate-600') : 'text-slate-400'}`}>{prev ? falt.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className={`px-1.5 py-1 text-right tabular-nums ${pctFalt > 0 ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>{prev ? `${pctFalt}%` : '—'}</td>
                    {cols.map(e => {
                      const c = cel.get(`${e.id}|${atv}`)
                      const avP = c?.avanco_prev ?? 0     // Previsto (manual)
                      const avR = c?.avanco ?? 0          // Realizado (manual ou via RDO)
                      const mini = (av: number, dt: string | null | undefined, lado: 'prev' | 'real', cor: string) => (
                        <button onClick={() => setEdit({ est: e, atividade: atv, cel: c, lado })}
                          className={`w-full rounded px-1 py-1 text-[10px] font-bold transition-colors hover:opacity-80 ${cor}`}
                          title={`${atv} · ${e.nome} · ${lado === 'prev' ? 'Previsto' : 'Realizado'}${dt ? ` · ${dt}` : ''}`}>
                          {av >= 1 ? '✓' : av > 0 ? `${Math.round(av * 100)}%` : '·'}
                          {dt && <span className="block text-[8px] font-normal opacity-80">{dt.slice(8, 10)}/{dt.slice(5, 7)}</span>}
                        </button>
                      )
                      return [
                        <td key={e.id + '-p'} className={`px-0.5 py-0.5 text-center ${isDark ? 'border-l border-white/[0.12]' : 'border-l border-slate-300'}`}>
                          {mini(avP, c?.data_prev, 'prev', prevCor(avP))}
                        </td>,
                        <td key={e.id + '-r'} className="px-0.5 py-0.5 text-center">
                          {mini(avR, c?.data, 'real', celCor(avR))}
                        </td>,
                      ]
                    })}
                  </tr>
                )
              }))}
            </tbody>
          </table>
        )}
        {!isLoading && estruturas.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">Nenhuma estrutura cadastrada nesta obra — use “+ Estrutura” para montar as colunas (76B, 77B…).</div>
        )}
      </div>

      <p className={`text-[10px] px-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        Modelo da planilha ACOMPANHAMENTO: célula = avanço da atividade naquela estrutura (data + %). O RDO passará a atualizar estas células automaticamente.
      </p>

      {/* editor de célula */}
      {edit && (
        <CelulaEditor
          est={edit.est} atividade={edit.atividade} cel={edit.cel}
          onClose={() => setEdit(null)}
          lado={edit.lado}
          onSave={(data, avanco) => salvarCel.mutate({ estrutura_id: edit.est.id, atividade: edit.atividade, data, avanco, lado: edit.lado })}
          onDelete={() => apagarCel.mutate({ estrutura_id: edit.est.id, atividade: edit.atividade, cel: edit.cel, lado: edit.lado })}
          apagando={apagarCel.isPending}
          salvando={salvarCel.isPending}
          isDark={isDark}
        />
      )}
    </div>
  )
}

function CelulaEditor({ est, atividade, cel, lado, onClose, onSave, onDelete, salvando, apagando, isDark }: {
  est: Estrutura; atividade: string; cel?: Celula; lado: 'prev' | 'real'; onClose: () => void
  onSave: (data: string | null, avanco: number) => void; onDelete: () => void
  salvando: boolean; apagando: boolean; isDark: boolean
}) {
  const ehPrev = lado === 'prev'
  const [data, setData] = useState((ehPrev ? cel?.data_prev : cel?.data) ?? new Date().toISOString().slice(0, 10))
  const [av, setAv] = useState(String(Math.round(((ehPrev ? cel?.avanco_prev : cel?.avanco) ?? 0) * 100)))
  const temRegistro = ehPrev ? !!(cel?.data_prev || cel?.avanco_prev) : !!(cel?.data || cel?.avanco)
  const inp = `rounded-lg border px-2 py-1.5 text-xs ${isDark ? 'bg-white/[0.06] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200'}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-2xl border shadow-2xl p-4 ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{est.nome} <span className="text-slate-400 font-normal">· {est.tipo ?? ''}</span></p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{atividade}</p>
            <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ehPrev ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{ehPrev ? 'PREVISTO' : 'REALIZADO'}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">DATA
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} /></label>
          <label className="text-[10px] font-bold text-slate-400 flex flex-col gap-1">AVANÇO
            <select value={av} onChange={e => setAv(e.target.value)} className={inp}>
              {['0', '25', '50', '75', '100'].map(p => <option key={p} value={p}>{p}%</option>)}
            </select></label>
          <button onClick={() => onSave(data || null, Number(av) / 100)} disabled={salvando || apagando}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
            {salvando ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
          </button>
          {temRegistro && (
            <button onClick={() => { if (confirm('Apagar este registro?')) onDelete() }} disabled={salvando || apagando}
              title="Apagar registro"
              className={`p-1.5 rounded-lg disabled:opacity-50 ${isDark ? 'text-slate-500 hover:text-rose-400 hover:bg-white/[0.06]' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}>
              {apagando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
        {cel?.responsavel_nome && <p className="text-[10px] text-slate-400 mt-2">último registro por {cel.responsavel_nome}</p>}
      </div>
    </div>
  )
}
