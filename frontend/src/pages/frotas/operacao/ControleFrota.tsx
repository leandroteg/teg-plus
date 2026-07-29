// ─────────────────────────────────────────────────────────────────────────────
// ControleFrota — visão de controle de todos os ativos no período.
//
// Duas métricas próprias desta tela:
//   Disponibilidade % = (dias do período − dias parado em OS) / dias do período
//   Ociosidade %      = (dias disponíveis − dias de uso) / dias disponíveis,
//                       onde dias disponíveis já desconta os dias parado em OS —
//                       não se cobra uso de um ativo que estava na oficina.
//
// Ociosidade depende de telemetria: ativo sem rastreador aparece como "—".
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutList, LayoutGrid, ArrowUp, ArrowDown, Search, X, Car, Cog, Printer } from 'lucide-react'
import { imprimirQrAtivos } from '../../../components/frotas/QrAtivo'
import { useVeiculos, useAlocacoes, useOrdensServico } from '../../../hooks/useFrotas'
import { useUtilizacaoVeiculos } from '../../../hooks/useTelemetria'
import { useTheme } from '../../../contexts/ThemeContext'
import MultiSelectPopover from '../../../components/MultiSelectPopover'
import VeiculoDetalhesModal from '../../../components/frotas/VeiculoDetalhesModal'
import { formatCodigoCategoria, parseObsInfo } from '../../../components/frotas/veiculoObs'
import { CATEGORIA_LABEL, type CategoriaVeiculo } from '../../../constants/categoriaVeiculo'
import type { FroVeiculo, FroAlocacao, FroOrdemServico } from '../../../types/frotas'

const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível', em_uso: 'Em Uso', em_manutencao: 'Em Manutenção', parado: 'Parado',
  bloqueado: 'Bloqueado', em_entrada: 'Em Entrada', aguardando_saida: 'Aguardando Saída',
  baixado: 'Baixado',
}
const STATUS_DOT: Record<string, string> = {
  disponivel: 'bg-emerald-500', em_uso: 'bg-sky-500', em_manutencao: 'bg-amber-500', parado: 'bg-rose-600',
  bloqueado: 'bg-red-500', em_entrada: 'bg-violet-500', aguardando_saida: 'bg-rose-500',
  baixado: 'bg-slate-400',
}
const PROP_LABEL: Record<string, string> = { propria: 'Próprio', locada: 'Locado', cedida: 'Cedido' }

const DIA = 86_400_000
const hojeISO = () => new Date().toISOString().slice(0, 10)
const diasAtras = (n: number) => new Date(Date.now() - n * DIA).toISOString().slice(0, 10)

/** Dias em que a OS manteve o ativo parado dentro da janela [ini, fim]. */
function diasParadoNoPeriodo(oss: FroOrdemServico[], ini: Date, fim: Date): number {
  let ms = 0
  for (const os of oss) {
    // A parada começa na entrada da oficina; sem ela, cai para a abertura da OS.
    const inicioParada = os.data_entrada_oficina ?? os.data_abertura
    if (!inicioParada) continue
    const encerrada = os.status === 'concluida' || os.status === 'cancelada' || os.status === 'rejeitada'
    const fimParada = encerrada ? (os.data_conclusao ?? os.data_abertura) : new Date().toISOString()
    if (!fimParada) continue

    const a = Math.max(new Date(inicioParada).getTime(), ini.getTime())
    const b = Math.min(new Date(fimParada).getTime(), fim.getTime())
    if (b > a) ms += b - a
  }
  return ms / DIA
}

type SortKey = 'codigo' | 'placa' | 'categoria' | 'status' | 'obra' | 'hodometro' | 'disp' | 'ocio'
type ViewMode = 'list' | 'cards'

export default function ControleFrota() {
  const { isDark } = useTheme()
  const isLight = !isDark

  const [inicio, setInicio] = useState(diasAtras(30))
  const [fim, setFim] = useState(hojeISO())
  const [busca, setBusca] = useState('')
  const [fCategoria, setFCategoria] = useState<Set<string>>(new Set())
  const [fStatus, setFStatus] = useState<Set<string>>(new Set())
  const [fPropriedade, setFPropriedade] = useState<Set<string>>(new Set())
  const [fObra, setFObra] = useState<Set<string>>(new Set())
  const [fLocal, setFLocal] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'codigo', dir: 'asc' })
  const [detalhe, setDetalhe] = useState<{ v: FroVeiculo; a?: FroAlocacao } | null>(null)

  // Deep link do Portal (QR do ativo): ?veiculo=<id> abre a ficha completa dele,
  // que já traz alocação, QR e histórico de serviços.
  const [searchParams] = useSearchParams()
  const veiculoLink = searchParams.get('veiculo')
  const abriuLink = useRef(false)

  const { data: veiculos = [], isLoading } = useVeiculos()
  const { data: alocacoes = [] } = useAlocacoes({ status: 'ativa' })
  const { data: ordens = [] } = useOrdensServico()
  const { data: utilizacao = [] } = useUtilizacaoVeiculos(inicio, fim)

  const alocByVeic = useMemo(() => new Map(alocacoes.map(a => [a.veiculo_id, a])), [alocacoes])

  // Abre a ficha assim que os dados chegam (uma vez só).
  useEffect(() => {
    if (!veiculoLink || abriuLink.current || !veiculos.length) return
    const v = veiculos.find(x => x.id === veiculoLink)
    if (!v) return
    abriuLink.current = true
    setDetalhe({ v, a: alocByVeic.get(v.id) })
  }, [veiculoLink, veiculos, alocByVeic])
  const utilByVeic = useMemo(() => new Map(utilizacao.map(u => [u.veiculo_id, u])), [utilizacao])
  const osByVeic = useMemo(() => {
    const m = new Map<string, FroOrdemServico[]>()
    ordens.forEach(o => {
      const l = m.get(o.veiculo_id) ?? []
      l.push(o)
      m.set(o.veiculo_id, l)
    })
    return m
  }, [ordens])

  // ── Linhas com métricas do período ────────────────────────────────────────
  const linhas = useMemo(() => {
    const ini = new Date(inicio + 'T00:00:00')
    const f = new Date(fim + 'T23:59:59')
    const diasPeriodo = Math.max(1, (f.getTime() - ini.getTime()) / DIA)

    return veiculos.filter(v => v.status !== 'baixado').map(v => {
      const obs = parseObsInfo(v.observacoes)
      const aloc = alocByVeic.get(v.id)
      const util = utilByVeic.get(v.id)
      const diasOS = diasParadoNoPeriodo(osByVeic.get(v.id) ?? [], ini, f)

      const disp = Math.max(0, Math.min(100, ((diasPeriodo - diasOS) / diasPeriodo) * 100))

      // Ociosidade: só faz sentido com telemetria e com dias disponíveis > 0.
      let ocio: number | null = null
      if (util) {
        const base = (util.dias_uteis_ajustado || util.dias_uteis_periodo) - diasOS
        if (base > 0) ocio = Math.max(0, Math.min(100, ((base - util.dias_uso) / base) * 100))
      }

      const { codigo, categoria } = formatCodigoCategoria(v)
      return {
        v, aloc, obs, diasOS, disp, ocio,
        codigo, categoriaLabel: categoria || (CATEGORIA_LABEL[v.categoria as CategoriaVeiculo] ?? v.categoria),
        obra: aloc?.obra?.nome ?? '',
        local: obs.local ?? '',
        responsavel: aloc?.responsavel_nome ?? obs.responsavel ?? '',
      }
    })
  }, [veiculos, alocByVeic, utilByVeic, osByVeic, inicio, fim])

  // ── Opções dos filtros ────────────────────────────────────────────────────
  const opts = useMemo(() => ({
    categoria: [...new Set(linhas.map(l => l.categoriaLabel).filter(Boolean))].sort(),
    status: [...new Set(linhas.map(l => STATUS_LABEL[l.v.status] ?? l.v.status))].sort(),
    propriedade: [...new Set(linhas.map(l => PROP_LABEL[l.v.propriedade] ?? l.v.propriedade))].sort(),
    obra: [...new Set(linhas.map(l => l.obra).filter(Boolean))].sort(),
    local: [...new Set(linhas.map(l => l.local).filter(Boolean))].sort(),
  }), [linhas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return linhas.filter(l => {
      if (fCategoria.size && !fCategoria.has(l.categoriaLabel)) return false
      if (fStatus.size && !fStatus.has(STATUS_LABEL[l.v.status] ?? l.v.status)) return false
      if (fPropriedade.size && !fPropriedade.has(PROP_LABEL[l.v.propriedade] ?? l.v.propriedade)) return false
      if (fObra.size && !fObra.has(l.obra)) return false
      if (fLocal.size && !fLocal.has(l.local)) return false
      if (q) {
        const alvo = [l.codigo, l.v.placa, l.v.marca, l.v.modelo, l.responsavel, l.obra]
          .filter(Boolean).join(' ').toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [linhas, fCategoria, fStatus, fPropriedade, fObra, fLocal, busca])

  const ordenadas = useMemo(() => {
    const arr = [...filtradas]
    const dir = sort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (sort.key) {
        case 'placa':     return dir * (a.v.placa ?? '').localeCompare(b.v.placa ?? '')
        case 'categoria': return dir * a.categoriaLabel.localeCompare(b.categoriaLabel)
        case 'status':    return dir * (STATUS_LABEL[a.v.status] ?? '').localeCompare(STATUS_LABEL[b.v.status] ?? '')
        case 'obra':      return dir * a.obra.localeCompare(b.obra)
        case 'hodometro': return dir * ((a.v.hodometro_atual ?? 0) - (b.v.hodometro_atual ?? 0))
        case 'disp':      return dir * (a.disp - b.disp)
        case 'ocio':      return dir * ((a.ocio ?? -1) - (b.ocio ?? -1))
        default:          return dir * a.codigo.localeCompare(b.codigo)
      }
    })
    return arr
  }, [filtradas, sort])

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const seta = (key: SortKey) => sort.key !== key ? null
    : sort.dir === 'asc' ? <ArrowUp size={9} className="inline" /> : <ArrowDown size={9} className="inline" />

  // Médias do que está filtrado
  const mediaDisp = filtradas.length ? filtradas.reduce((s, l) => s + l.disp, 0) / filtradas.length : 0
  const comOcio = filtradas.filter(l => l.ocio != null)
  const mediaOcio = comOcio.length ? comOcio.reduce((s, l) => s + (l.ocio ?? 0), 0) / comOcio.length : null

  const temFiltro = !!(fCategoria.size || fStatus.size || fPropriedade.size || fObra.size || fLocal.size || busca.trim())
  const limpar = () => {
    setFCategoria(new Set()); setFStatus(new Set()); setFPropriedade(new Set())
    setFObra(new Set()); setFLocal(new Set()); setBusca('')
  }

  const card = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
  const txtMuted = isLight ? 'text-slate-400' : 'text-slate-500'
  const txtMain = isLight ? 'text-slate-800' : 'text-white'
  const inp = `px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.04] border-white/[0.1] text-slate-200'
  }`
  const th = `px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none ${txtMuted}`

  const corPct = (p: number, invertido = false) => {
    const bom = invertido ? p < 30 : p > 85
    const ruim = invertido ? p > 60 : p < 60
    return bom ? (isLight ? 'text-emerald-600' : 'text-emerald-400')
      : ruim ? (isLight ? 'text-red-600' : 'text-red-400')
      : (isLight ? 'text-amber-600' : 'text-amber-400')
  }

  return (
    <div className="pb-4 space-y-3">
      {/* Filtros — tudo em uma linha, caixas selecionáveis */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${txtMuted}`} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Código, placa, modelo..." className={`${inp} pl-8 w-[190px]`} />
        </div>
        <MultiSelectPopover label="Categoria" options={opts.categoria} selected={fCategoria} onChange={setFCategoria} isLight={isLight} />
        <MultiSelectPopover label="Situação" options={opts.status} selected={fStatus} onChange={setFStatus} isLight={isLight} />
        <MultiSelectPopover label="Propriedade" options={opts.propriedade} selected={fPropriedade} onChange={setFPropriedade} isLight={isLight} />
        <MultiSelectPopover label="Obra" options={opts.obra} selected={fObra} onChange={setFObra} isLight={isLight} />
        <MultiSelectPopover label="Base" options={opts.local} selected={fLocal} onChange={setFLocal} isLight={isLight} />

        <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={`${inp} w-[135px]`} title="Início do período" />
        <span className={`text-xs ${txtMuted}`}>a</span>
        <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={`${inp} w-[135px]`} title="Fim do período" />

        {temFiltro && (
          <button onClick={limpar} className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold ${
            isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.06]'
          }`}>
            <X size={12} /> Limpar
          </button>
        )}

        <button
          onClick={() => imprimirQrAtivos(ordenadas.map(l => l.v), 'QR de Ativos — Frota')}
          disabled={!ordenadas.length}
          title="Imprimir o QR de todos os ativos filtrados"
          className={`ml-auto flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold transition-colors disabled:opacity-40 ${
            isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]'
          }`}
        >
          <Printer size={13} /> QR ({ordenadas.length})
        </button>

        <div className={`flex items-center rounded-lg border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <button onClick={() => setViewMode('list')} title="Lista"
            className={`p-1.5 ${viewMode === 'list' ? (isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.08] text-white') : txtMuted}`}>
            <LayoutList size={14} />
          </button>
          <button onClick={() => setViewMode('cards')} title="Cards"
            className={`p-1.5 ${viewMode === 'cards' ? (isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.08] text-white') : txtMuted}`}>
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Resumo do recorte */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <span className={txtMuted}><b className={txtMain}>{filtradas.length}</b> ativos</span>
        <span className={txtMuted}>Disponibilidade média <b className={corPct(mediaDisp)}>{mediaDisp.toFixed(1)}%</b></span>
        <span className={txtMuted}>
          Ociosidade média {mediaOcio == null
            ? <b className={txtMuted}>—</b>
            : <b className={corPct(mediaOcio, true)}>{mediaOcio.toFixed(1)}%</b>}
          {comOcio.length < filtradas.length && (
            <span className="ml-1 opacity-70">({comOcio.length} de {filtradas.length} com rastreador)</span>
          )}
        </span>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ordenadas.length === 0 ? (
        <div className={`rounded-2xl py-14 text-center text-sm ${card} ${txtMuted}`}>
          Nenhum ativo para os filtros selecionados.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2">
          {ordenadas.map(l => (
            <button key={l.v.id} onClick={() => setDetalhe({ v: l.v, a: l.aloc })}
              className={`w-full text-left rounded-2xl p-3 transition-all hover:shadow-md ${card}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  l.v.tipo_ativo === 'maquina'
                    ? (isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400')
                    : (isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/10 text-sky-400')
                }`}>
                  {l.v.tipo_ativo === 'maquina' ? <Cog size={16} /> : <Car size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-sm font-extrabold ${txtMain}`}>{l.codigo}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                      {l.categoriaLabel}
                    </span>
                  </span>
                  <span className={`block text-[11px] ${txtMuted}`}>
                    {l.v.marca} {l.v.modelo} · <span className="font-mono">{l.v.placa}</span>
                  </span>
                </span>

                <span className={`flex items-center gap-1.5 text-[11px] ${txtMuted}`}>
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[l.v.status] ?? 'bg-slate-400'}`} />
                  {STATUS_LABEL[l.v.status] ?? l.v.status}
                </span>

                {l.obra && <span className={`text-[11px] truncate max-w-[220px] ${txtMuted}`}>📍 {l.obra}</span>}

                <span className="ml-auto flex items-center gap-4 shrink-0">
                  <span className="text-right">
                    <span className={`block text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>Disponib.</span>
                    <span className={`text-sm font-black ${corPct(l.disp)}`}>{l.disp.toFixed(0)}%</span>
                  </span>
                  <span className="text-right">
                    <span className={`block text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>Ociosid.</span>
                    <span className={`text-sm font-black ${l.ocio == null ? txtMuted : corPct(l.ocio, true)}`}>
                      {l.ocio == null ? '—' : `${l.ocio.toFixed(0)}%`}
                    </span>
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={`rounded-2xl overflow-hidden ${card}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                  <th className={`${th} text-left`} onClick={() => toggleSort('codigo')}>Ativo {seta('codigo')}</th>
                  <th className={`${th} text-left`} onClick={() => toggleSort('placa')}>Placa {seta('placa')}</th>
                  <th className={`${th} text-left`} onClick={() => toggleSort('categoria')}>Categoria {seta('categoria')}</th>
                  <th className={`${th} text-left`} onClick={() => toggleSort('status')}>Situação {seta('status')}</th>
                  <th className={`${th} text-left`} onClick={() => toggleSort('obra')}>Obra / Base {seta('obra')}</th>
                  <th className={`${th} text-right`} onClick={() => toggleSort('hodometro')}>Hodôm. {seta('hodometro')}</th>
                  <th className={`${th} text-right`} onClick={() => toggleSort('disp')}>Disponib. {seta('disp')}</th>
                  <th className={`${th} text-right`} onClick={() => toggleSort('ocio')}>Ociosid. {seta('ocio')}</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(l => (
                  <tr key={l.v.id} onClick={() => setDetalhe({ v: l.v, a: l.aloc })}
                    className={`cursor-pointer border-t ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.04]'}`}>
                    <td className="px-2 py-2">
                      <span className={`font-mono text-xs font-extrabold ${txtMain}`}>{l.codigo}</span>
                      <span className={`block text-[10px] truncate max-w-[170px] ${txtMuted}`}>{l.v.marca} {l.v.modelo}</span>
                    </td>
                    <td className={`px-2 py-2 font-mono text-xs ${txtMuted}`}>{l.v.placa}</td>
                    <td className={`px-2 py-2 text-[11px] ${txtMuted}`}>{l.categoriaLabel}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] ${txtMuted}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[l.v.status] ?? 'bg-slate-400'}`} />
                        {STATUS_LABEL[l.v.status] ?? l.v.status}
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-[11px] max-w-[200px] truncate ${txtMuted}`}>
                      {l.obra || l.local || '—'}
                    </td>
                    <td className={`px-2 py-2 text-right text-[11px] tabular-nums ${txtMuted}`}>
                      {l.v.hodometro_atual != null ? l.v.hodometro_atual.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className={`px-2 py-2 text-right text-xs font-bold tabular-nums ${corPct(l.disp)}`}
                      title={`${l.diasOS.toFixed(1)} dia(s) parado em OS no período`}>
                      {l.disp.toFixed(0)}%
                    </td>
                    <td className={`px-2 py-2 text-right text-xs font-bold tabular-nums ${l.ocio == null ? txtMuted : corPct(l.ocio, true)}`}
                      title={l.ocio == null ? 'Sem telemetria no período' : undefined}>
                      {l.ocio == null ? '—' : `${l.ocio.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalhe && (
        <VeiculoDetalhesModal
          veiculo={detalhe.v}
          isLight={isLight}
          onClose={() => setDetalhe(null)}
          alocacaoInfo={detalhe.a ? {
            id: detalhe.a.id,
            obraId: detalhe.a.obra_id,
            obra: detalhe.a.obra?.nome,
            responsavel: detalhe.a.responsavel_nome,
            dataSaida: detalhe.a.data_saida,
            dataRetornoPrev: detalhe.a.data_retorno_prev,
            observacoes: detalhe.a.observacoes,
          } : undefined}
        />
      )}
    </div>
  )
}
