import { useState, useMemo } from 'react'
import {
  Building2, Search, LayoutList, LayoutGrid, X, MapPin, Calendar, Phone,
  User, FileText, Clock, CheckCircle2, AlertTriangle, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useImoveis, useAditivos, useVistorias } from '../../hooks/useLocacao'
import type { LocImovel, LocAditivo, LocVistoria } from '../../types/locacao'

const fmtDate = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const fmtCur = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const STATUS_CFG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ativo:      { label: 'Ativo',      dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inativo:    { label: 'Inativo',    dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-600' },
  em_entrada: { label: 'Em Entrada', dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  em_saida:   { label: 'Em Saída',   dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
}

type ViewMode = 'table' | 'cards'

// ── Detail Modal ─────────────────────────────────────────────────────────────
function ImovelDetailModal({ imovel, aditivos, vistorias, onClose, isDark }: {
  imovel: LocImovel; aditivos: LocAditivo[]; vistorias: LocVistoria[]; onClose: () => void; isDark: boolean
}) {
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-400'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const contrato = (imovel as any).contrato
  const cc = (imovel as any).centro_custo
  const stCfg = STATUS_CFG[imovel.status] || STATUS_CFG.ativo
  const imovelAditivos = aditivos.filter(a => a.imovel_id === imovel.id)
  const imovelVistorias = vistorias.filter(v => v.imovel_id === imovel.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 size={18} className="text-indigo-600 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txtMain}`}>{imovel.endereco || imovel.descricao}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold px-3 py-1 text-xs ${stCfg.bg} ${stCfg.text}`}>
              <span className={`w-2 h-2 rounded-full ${stCfg.dot}`} /> {stCfg.label}
            </span>
          </div>

          {/* Endereço */}
          <div className={`rounded-xl p-4 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
            <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Endereço</p>
            <div className="space-y-1">
              <p className={`text-sm font-bold ${txtMain}`}>{imovel.endereco || imovel.descricao || 'Não informado'}{imovel.numero ? `, ${imovel.numero}` : ''}</p>
              {imovel.complemento && <p className={`text-xs ${txtMuted}`}>{imovel.complemento}</p>}
              {imovel.bairro && <p className={`text-xs ${txtMuted}`}>{imovel.bairro}</p>}
              <p className={`text-xs ${txtMuted}`}>{[imovel.cidade, imovel.uf].filter(Boolean).join(' — ') || 'Cidade não informada'}{imovel.cep ? ` · CEP ${imovel.cep}` : ''}</p>
              <p className={`text-xs ${txtMuted}`}>{imovel.area_m2 != null ? `${imovel.area_m2} m²` : 'Área não informada'}</p>
            </div>
          </div>

          {/* Contrato */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Contrato</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Número</p><p className={`font-semibold ${txtMain}`}>{contrato?.numero || 'Não informado'}</p></div>
              <div><p className={txtMuted}>Data de Entrada</p><p className={`font-semibold ${txtMain}`}>{contrato?.data_inicio ? fmtDate(contrato.data_inicio) : 'Não informada'}</p></div>
              <div><p className={txtMuted}>Vencimento</p><p className={`font-semibold ${txtMain}`}>{contrato?.data_fim_previsto ? fmtDate(contrato.data_fim_previsto) : 'Não informado'}</p></div>
              <div><p className={txtMuted}>Data Assinatura</p><p className={`font-semibold ${txtMain}`}>{contrato?.data_assinatura ? fmtDate(contrato.data_assinatura) : 'Não informada'}</p></div>
              <div><p className={txtMuted}>Status Contrato</p><p className={`font-semibold ${txtMain}`}>{contrato?.status || 'Não informado'}</p></div>
              <div><p className={txtMuted}>Cadastrado em</p><p className={`font-semibold ${txtMain}`}>{imovel.created_at ? fmtDate(imovel.created_at.split('T')[0]) : '—'}</p></div>
            </div>
          </div>

          {/* Proprietário / Imobiliária */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Proprietário / Imobiliária</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Locador / Proprietário</p><p className={`font-semibold ${txtMain}`}>{imovel.locador_nome || 'Não informado'}</p></div>
              <div><p className={txtMuted}>CPF/CNPJ</p><p className={`font-semibold ${txtMain}`}>{imovel.locador_cpf_cnpj || 'Não informado'}</p></div>
              <div className="col-span-2"><p className={txtMuted}>Contato do Proprietário</p><p className={`font-semibold ${txtMain}`}>{imovel.locador_contato || 'Não informado'}</p></div>
              {contrato?.contraparte_nome && (
                <div className="col-span-2"><p className={txtMuted}>Contraparte (contrato)</p><p className={`font-semibold ${txtMain}`}>{contrato.contraparte_nome}</p></div>
              )}
            </div>
          </div>

          {/* Dados financeiros */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Financeiro</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div><p className={txtMuted}>Aluguel Mensal</p><p className={`font-semibold ${txtMain}`}>{imovel.valor_aluguel_mensal != null ? fmtCur(imovel.valor_aluguel_mensal) : 'Não informado'}</p></div>
              <div><p className={txtMuted}>Dia Vencimento</p><p className={`font-semibold ${txtMain}`}>{imovel.dia_vencimento != null ? `Dia ${imovel.dia_vencimento}` : 'Não informado'}</p></div>
              <div className="col-span-2"><p className={txtMuted}>Centro de Custo</p><p className={`font-semibold ${txtMain}`}>{cc?.descricao ? `${cc.codigo} — ${cc.descricao}` : 'Não atribuído'}</p></div>
            </div>
          </div>

          {/* Vistorias */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Vistorias</p>
            {imovelVistorias.length === 0 ? (
              <p className={`text-xs ${txtMuted}`}>Nenhuma vistoria registrada para este imóvel.</p>
            ) : (
              <div className="space-y-3">
                {imovelVistorias.map(v => (
                  <div key={v.id} className={`rounded-lg p-3 border ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                    {/* Cabeçalho da vistoria */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${txtMain}`}>{v.tipo === 'entrada' ? 'Vistoria de Entrada' : 'Vistoria de Saída'}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          v.status === 'concluida' ? 'bg-emerald-50 text-emerald-700' :
                          v.status === 'em_andamento' ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {v.status === 'concluida' ? 'Concluída' : v.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                        </span>
                      </div>
                      {v.tem_pendencias && (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1"><AlertTriangle size={10} /> Pendências</span>
                      )}
                    </div>
                    {/* Dados */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-2">
                      <div><p className={txtMuted}>Data</p><p className={`font-semibold ${txtMain}`}>{v.data_vistoria ? fmtDate(v.data_vistoria) : 'Não realizada'}</p></div>
                      <div><p className={txtMuted}>Responsável</p><p className={`font-semibold ${txtMain}`}>{v.responsavel_id ? 'Atribuído' : 'Não atribuído'}</p></div>
                    </div>
                    {/* Observações */}
                    {v.observacoes_gerais && (
                      <p className={`text-[10px] ${txtMuted} mb-2`}>{v.observacoes_gerais}</p>
                    )}
                    {/* Checklist de itens */}
                    {v.itens && v.itens.length > 0 && (
                      <div className="mt-2">
                        <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>Checklist ({v.itens.length} itens)</p>
                        <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                          {v.itens.map(item => (
                            <div key={item.id} className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] border-b last:border-0 ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
                              <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${
                                item.divergencia ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>{item.divergencia ? '!' : '✓'}</span>
                              <span className={`flex-1 ${txtMain}`}>{item.ambiente} — {item.item}</span>
                              <span className={`text-[10px] ${txtMuted}`}>
                                {item.estado_entrada || item.estado_saida || '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* PDF Anexo */}
                    {v.pdf_url ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(v.pdf_url!, '_blank') }}
                        className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          isDark ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                        }`}>
                        <FileText size={12} /> Ver PDF da Vistoria
                      </button>
                    ) : (
                      <p className={`text-[10px] mt-2 ${txtMuted}`}>Nenhum PDF anexado.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linha do tempo — Aditivos & Renovações */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Aditivos & Renovações</p>
            {imovelAditivos.length === 0 ? (
              <p className={`text-xs ${txtMuted}`}>Nenhum aditivo ou renovação registrado.</p>
            ) : (
              <div className="space-y-0">
                {imovelAditivos.map((ad, i) => (
                  <div key={ad.id} className="flex gap-3 items-start">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 ${ad.status === 'assinado' ? 'bg-emerald-500' : ad.status === 'aguardando_assinatura' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                      {i < imovelAditivos.length - 1 && <div className={`w-px flex-1 min-h-[20px] ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className={`text-xs font-semibold ${txtMain}`}>{ad.tipo === 'renovacao' ? 'Renovação' : ad.tipo === 'reajuste' ? 'Reajuste' : ad.tipo === 'alteracao_valor' ? 'Alteração de Valor' : 'Aditivo'}</p>
                      <p className={`text-[10px] ${txtMuted}`}>
                        {ad.data_inicio ? fmtDate(ad.data_inicio) : '—'} → {ad.data_fim ? fmtDate(ad.data_fim) : '—'}
                        {ad.novo_valor != null && ` · ${fmtCur(ad.novo_valor)}`}
                      </p>
                      {ad.observacoes && <p className={`text-[10px] ${txtMuted} mt-0.5`}>{ad.observacoes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fechar */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Ativos() {
  const { isDark } = useTheme()
  const { data: imoveis = [], isLoading } = useImoveis()
  const { data: aditivos = [] } = useAditivos()
  const { data: vistorias = [] } = useVistorias()

  const [busca, setBusca] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [cidadeFilter, setCidadeFilter] = useState('')
  const [ccFilter, setCcFilter] = useState('')
  const [vencFilter, setVencFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [detail, setDetail] = useState<LocImovel | null>(null)
  const [sortCol, setSortCol] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  // Opções únicas para filtros
  const cidades = useMemo(() => [...new Set(imoveis.map(i => i.cidade).filter(Boolean))].sort() as string[], [imoveis])
  const centrosCusto = useMemo(() => {
    const seen = new Map<string, string>()
    imoveis.forEach(i => { const cc = (i as any).centro_custo; if (cc?.id) seen.set(cc.id, cc.descricao) })
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [imoveis])

  const filtrados = useMemo(() => {
    let items = [...imoveis]
    if (busca) { const q = busca.toLowerCase(); items = items.filter(i => [i.descricao, i.endereco, i.locador_nome, i.cidade].some(v => v?.toLowerCase().includes(q))) }
    if (statusFilter !== 'todos') items = items.filter(i => i.status === statusFilter)
    if (cidadeFilter) items = items.filter(i => i.cidade === cidadeFilter)
    if (ccFilter) items = items.filter(i => (i as any).centro_custo?.id === ccFilter)
    if (vencFilter) {
      const today = new Date().toISOString().split('T')[0]
      if (vencFilter === 'vencido') items = items.filter(i => { const d = (i as any).contrato?.data_fim_previsto; return d && d < today })
      else if (vencFilter === '30d') items = items.filter(i => { const d = (i as any).contrato?.data_fim_previsto; const lim = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]; return d && d >= today && d <= lim })
      else if (vencFilter === '90d') items = items.filter(i => { const d = (i as any).contrato?.data_fim_previsto; const lim = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]; return d && d >= today && d <= lim })
    }
    if (sortCol) {
      items.sort((a, b) => {
        let va: any, vb: any
        switch (sortCol) {
          case 'imovel': va = a.endereco || a.descricao || ''; vb = b.endereco || b.descricao || ''; break
          case 'locador': va = a.locador_nome || ''; vb = b.locador_nome || ''; break
          case 'cc': va = (a as any).centro_custo?.descricao || ''; vb = (b as any).centro_custo?.descricao || ''; break
          case 'cidade': va = a.cidade || ''; vb = b.cidade || ''; break
          case 'valor': va = a.valor_aluguel_mensal ?? 0; vb = b.valor_aluguel_mensal ?? 0; break
          case 'vencimento': va = (a as any).contrato?.data_fim_previsto || '9999'; vb = (b as any).contrato?.data_fim_previsto || '9999'; break
          default: return 0
        }
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return items
  }, [imoveis, busca, statusFilter, cidadeFilter, ccFilter, vencFilter, sortCol, sortDir])

  const statuses = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativo', label: 'Ativo' },
    { key: 'inativo', label: 'Inativo' },
    { key: 'em_entrada', label: 'Em Entrada' },
    { key: 'em_saida', label: 'Em Saída' },
  ]

  if (isLoading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar imóvel..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>}
        </div>

        {/* Status */}
        <div className="flex items-center gap-0.5">
          {statuses.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${statusFilter === s.key ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500' : 'text-slate-400 hover:bg-slate-50'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Centro de Custo */}
        <select value={ccFilter} onChange={e => setCcFilter(e.target.value)}
          className={`rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-600'}`}>
          <option value="">Centro de Custo</option>
          {centrosCusto.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>

        {/* Cidade */}
        <select value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)}
          className={`rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-600'}`}>
          <option value="">Cidade</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Vencimento */}
        <select value={vencFilter} onChange={e => setVencFilter(e.target.value)}
          className={`rounded-lg border px-2 py-1.5 text-[11px] ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-600'}`}>
          <option value="">Vencimento</option>
          <option value="vencido">Vencidos</option>
          <option value="30d">Próximos 30 dias</option>
          <option value="90d">Próximos 90 dias</option>
        </select>

        {/* Toggle */}
        <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setViewMode('table')} className={`p-1.5 ${viewMode === 'table' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setViewMode('cards')} className={`p-1.5 ${viewMode === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {/* Count */}
      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtrados.length} imóvel(is)</p>

      {/* Content */}
      {filtrados.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <Building2 size={36} className="mb-2" /><p className="text-sm">Nenhum imóvel encontrado</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                {[
                  { key: 'imovel', label: 'IMÓVEL', align: 'text-left' },
                  { key: 'locador', label: 'LOCADOR', align: 'text-left' },
                  { key: 'cc', label: 'C. CUSTO', align: 'text-left' },
                  { key: 'cidade', label: 'CIDADE', align: 'text-left' },
                  { key: 'valor', label: 'VALOR/MÊS', align: 'text-right' },
                  { key: 'vencimento', label: 'VENCIMENTO', align: 'text-right' },
                  { key: '', label: 'STATUS', align: 'text-center' },
                ].map(col => (
                  <th key={col.label} className={`${col.align} px-3 py-2 font-semibold ${col.key ? 'cursor-pointer select-none hover:text-slate-600' : ''}`}
                    onClick={() => col.key && toggleSort(col.key)}>
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortCol === col.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(imo => {
                const st = STATUS_CFG[imo.status] || STATUS_CFG.ativo
                const contrato = (imo as any).contrato
                const cc = (imo as any).centro_custo
                const venc = contrato?.data_fim_previsto
                const isExpiring = venc && new Date(venc) <= new Date(Date.now() + 30 * 86400000) && new Date(venc) >= new Date()
                const isExpired = venc && new Date(venc) < new Date()
                return (
                  <tr key={imo.id} onClick={() => setDetail(imo)}
                    className={`cursor-pointer transition-all ${isDark ? 'border-b border-white/[0.04] hover:bg-white/[0.04]' : 'border-b border-slate-100 hover:bg-slate-50'}`}>
                    <td className="px-3 py-2.5">
                      <p className={`font-semibold truncate max-w-[250px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{imo.endereco || imo.descricao}</p>
                    </td>
                    <td className={`px-3 py-2.5 truncate max-w-[150px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{imo.locador_nome || '—'}</td>
                    <td className={`px-3 py-2.5 truncate max-w-[100px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cc?.descricao || '—'}</td>
                    <td className={`px-3 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{imo.cidade || '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>{fmtCur(imo.valor_aluguel_mensal)}</td>
                    <td className={`px-3 py-2.5 text-right ${isExpired ? 'text-red-600 font-bold' : isExpiring ? 'text-amber-600 font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {venc ? fmtDate(venc) : '—'}
                      {isExpired && <AlertTriangle size={10} className="inline ml-1 text-red-500" />}
                      {isExpiring && !isExpired && <Clock size={10} className="inline ml-1 text-amber-500" />}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(imo => {
            const st = STATUS_CFG[imo.status] || STATUS_CFG.ativo
            const contrato = (imo as any).contrato
            const cc = (imo as any).centro_custo
            const venc = contrato?.data_fim_previsto
            return (
              <button key={imo.id} type="button" onClick={() => setDetail(imo)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{imo.endereco || imo.descricao}</p>
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.bg} ${st.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                  </span>
                </div>
                {imo.locador_nome && <p className={`text-xs flex items-center gap-1 mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><User size={11} /> {imo.locador_nome}</p>}
                <p className={`text-xs flex items-center gap-1 mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><MapPin size={11} /> {imo.cidade || '—'}</p>
                {cc?.descricao && <p className={`text-xs flex items-center gap-1 mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><FileText size={11} /> {cc.descricao}</p>}
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>{fmtCur(imo.valor_aluguel_mensal)}</span>
                  {venc && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={10} className="inline mr-1" />Venc: {fmtDate(venc)}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {detail && <ImovelDetailModal imovel={detail} aditivos={aditivos} vistorias={vistorias} onClose={() => setDetail(null)} isDark={isDark} />}
    </div>
  )
}
