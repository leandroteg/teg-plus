// ─────────────────────────────────────────────────────────────────────────────
// HistoricoOS — acervo de OS encerradas (concluídas, rejeitadas, canceladas).
// Usa os mesmos cartão/linha da tela de OS (OSCards) para que a mesma OS não
// tenha duas aparências no sistema.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, LayoutList, LayoutGrid, CheckCircle2, XCircle, Ban } from 'lucide-react'
import { useOrdensServico, useVeiculos, useAlocacoes } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import { OSCard, OSRow, TIPO_LABEL, BRL } from '../../../components/frotas/os/OSCards'
import OSModal from '../../../components/frotas/os/OSModal'
import VeiculoDetalhesModal from '../../../components/frotas/VeiculoDetalhesModal'
import { formatCodigoCategoria } from '../../../components/frotas/veiculoObs'
import type { TipoOS, StatusOS, FroOrdemServico, FroVeiculo, FroAlocacao } from '../../../types/frotas'

type ViewMode = 'list' | 'cards'

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  concluida: { label: 'Concluídas', cls: 'text-emerald-500', icon: CheckCircle2 },
  rejeitada: { label: 'Rejeitadas', cls: 'text-red-500',     icon: XCircle },
  cancelada: { label: 'Canceladas', cls: 'text-slate-400',   icon: Ban },
}

const mesAtual = () => new Date().toISOString().slice(0, 7)

export default function HistoricoOS() {
  const { isDark } = useTheme()
  const isLight = !isDark

  const [mes, setMes] = useState(mesAtual())
  const [semFiltroMes, setSemFiltroMes] = useState(false)

  // Deep link do Portal (?veiculo=<id>): já abre filtrado naquele ativo,
  // sem recorte de mês — o analista quer o histórico inteiro dele.
  const [searchParams] = useSearchParams()
  const veiculoLink = searchParams.get('veiculo')
  useEffect(() => { if (veiculoLink) setSemFiltroMes(true) }, [veiculoLink])
  const [filtroTipo, setFiltroTipo] = useState<TipoOS | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusOS | ''>('')
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [detail, setDetail] = useState<FroOrdemServico | null>(null)

  const { data: historico = [], isLoading } = useOrdensServico({
    status: ['concluida', 'rejeitada', 'cancelada'] as StatusOS[],
  })
  const { data: veiculos = [] } = useVeiculos()
  const { data: alocacoes = [] } = useAlocacoes({ status: 'ativa' })

  const veicMap = useMemo(() => new Map(veiculos.map(v => [v.id, v])), [veiculos])
  const alocByVeic = useMemo(() => new Map(alocacoes.map(a => [a.veiculo_id, a])), [alocacoes])
  const [detalheVeic, setDetalheVeic] = useState<{ v: FroVeiculo; a?: FroAlocacao } | null>(null)
  const openVeicDetalhe = (veiculo_id: string) => {
    const v = veicMap.get(veiculo_id)
    if (v) setDetalheVeic({ v, a: alocByVeic.get(veiculo_id) })
  }

  // Busca casa com placa, código de frota, nº da OS, modelo e problema.
  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return historico.filter(os => {
      if (veiculoLink && os.veiculo_id !== veiculoLink) return false
      if (!semFiltroMes) {
        const ref = os.data_conclusao ?? os.data_abertura
        if (ref < mes + '-01' || ref > mes + '-31') return false
      }
      if (filtroTipo && os.tipo !== filtroTipo) return false
      if (filtroStatus && os.status !== filtroStatus) return false
      if (q) {
        const v = veicMap.get(os.veiculo_id)
        const codigo = v ? formatCodigoCategoria(v).codigo : ''
        const alvo = [
          os.veiculo?.placa, codigo, os.numero_os, os.veiculo?.modelo,
          os.veiculo?.marca, os.descricao_problema,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!alvo.includes(q)) return false
      }
      return true
    })
  }, [historico, mes, semFiltroMes, filtroTipo, filtroStatus, busca, veicMap, veiculoLink])

  const concluidas = filtrado.filter(os => os.status === 'concluida')
  const valorTotal = concluidas.reduce((s, os) => s + (os.valor_final ?? 0), 0)

  const temFiltro = !!(filtroTipo || filtroStatus || busca.trim() || semFiltroMes)
  const limpar = () => {
    setFiltroTipo(''); setFiltroStatus(''); setBusca(''); setSemFiltroMes(false); setMes(mesAtual())
  }

  const inp = `px-2.5 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-400/30 ${
    isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/[0.04] border-white/[0.1] text-slate-200'
  }`
  const card = isLight ? 'bg-white border border-slate-200 shadow-sm' : 'bg-[#1e293b] border border-white/[0.06]'
  const txtMuted = isLight ? 'text-slate-400' : 'text-slate-500'

  return (
    /* O hub já dá o padding lateral e o espaço abaixo das abas. */
    <div className="pb-4 space-y-3">
      {/* Filtros — tudo numa linha, quebrando quando não couber */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${txtMuted}`} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Placa, código, nº da OS..."
            className={`${inp} pl-8 w-[210px]`}
          />
        </div>

        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoOS | '')}
          className={`${inp} w-[140px] truncate`}>
          <option value="">Todos os tipos</option>
          {(Object.keys(TIPO_LABEL) as TipoOS[]).map(k => (
            <option key={k} value={k}>{TIPO_LABEL[k].label}</option>
          ))}
        </select>

        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusOS | '')}
          className={`${inp} w-[140px] truncate`}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>

        <input type="month" value={mes} disabled={semFiltroMes}
          onChange={e => setMes(e.target.value)}
          className={`${inp} w-[150px] ${semFiltroMes ? 'opacity-40' : ''}`} />

        <label className={`flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer ${txtMuted}`}>
          <input type="checkbox" checked={semFiltroMes} className="accent-teal-500"
            onChange={e => setSemFiltroMes(e.target.checked)} />
          Todo o período
        </label>

        {temFiltro && (
          <button onClick={limpar}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.06]'
            }`}>
            <X size={12} /> Limpar
          </button>
        )}

        <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
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

      {/* Resumo do que está filtrado */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(STATUS_CFG).map(([k, c]) => {
          const n = filtrado.filter(os => os.status === k).length
          const Icon = c.icon
          return (
            <span key={k} className={`flex items-center gap-1.5 text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <Icon size={13} className={c.cls} /> {n} {c.label.toLowerCase()}
            </span>
          )
        })}
        <span className={`ml-auto text-xs font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
          {BRL(valorTotal)} <span className={`font-normal ${txtMuted}`}>em serviços concluídos</span>
        </span>
      </div>

      {/* Conteúdo */}
      <div className={`rounded-2xl overflow-hidden ${card}`}>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrado.length === 0 ? (
          <p className={`text-sm text-center py-14 ${txtMuted}`}>
            Nenhuma OS encontrada para os filtros selecionados.
          </p>
        ) : viewMode === 'cards' ? (
          <div className="space-y-2 p-4">
            {filtrado.map(os => (
              <OSCard key={os.id} os={os} veicFull={veicMap.get(os.veiculo_id)} isDark={isDark}
                onClick={() => setDetail(os)} onVeicClick={() => openVeicDetalhe(os.veiculo_id)} />
            ))}
          </div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${
              isLight ? 'border-slate-100 text-slate-400' : 'border-white/[0.06] text-slate-600'
            }`}>
              <span className="w-[3px]" /><span className="w-2" /><span className="flex-1">Veículo</span>
              <span className="w-[60px]">Tipo</span><span className="w-[60px]">Prior.</span>
              <span className="w-[50px] text-right">Dias</span><span className="w-[70px] text-right">Valor</span>
            </div>
            {filtrado.map(os => (
              <OSRow key={os.id} os={os} veicFull={veicMap.get(os.veiculo_id)} isDark={isDark}
                onClick={() => setDetail(os)} onVeicClick={() => openVeicDetalhe(os.veiculo_id)} />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <OSModal os={detail} veiculo={veicMap.get(detail.veiculo_id)} isDark={isDark}
          onClose={() => setDetail(null)}
          onVeiculoClick={() => { setDetail(null); openVeicDetalhe(detail.veiculo_id) }} />
      )}
      {detalheVeic && (
        <VeiculoDetalhesModal
          veiculo={detalheVeic.v}
          isLight={isLight}
          onClose={() => setDetalheVeic(null)}
          alocacaoInfo={detalheVeic.a ? {
            id: detalheVeic.a.id,
            obraId: detalheVeic.a.obra_id,
            obra: detalheVeic.a.obra?.nome,
            responsavel: detalheVeic.a.responsavel_nome,
            dataSaida: detalheVeic.a.data_saida,
            dataRetornoPrev: detalheVeic.a.data_retorno_prev,
            observacoes: detalheVeic.a.observacoes,
          } : undefined}
        />
      )}
    </div>
  )
}
