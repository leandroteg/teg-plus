import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Search, UserCheck, UserX, Clock, FileText,
  Building2, Calendar, Briefcase, BadgeDollarSign,
  Plus, Eye,
} from 'lucide-react'
import { useContratos } from '../../hooks/useContratos'
import { useSolicitacoes } from '../../hooks/useSolicitacoes'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type StatusPJ = 'ativo' | 'em_processo' | 'encerrado'

const STATUS_CFG: Record<StatusPJ, { label: string; dot: string; bg: string; text: string; icon: typeof UserCheck }> = {
  ativo:       { label: 'Ativo',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: UserCheck },
  em_processo: { label: 'Em Processo', dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   icon: Clock },
  encerrado:   { label: 'Encerrado',   dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-600',   icon: UserX },
}

const FILTROS = [
  { label: 'Todos',       value: '' },
  { label: 'Ativos',      value: 'ativo' },
  { label: 'Em Processo',  value: 'em_processo' },
  { label: 'Encerrados',  value: 'encerrado' },
]

export default function EquipePJ() {
  const nav = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // PJ contracts (is_pj or tipo_contrato pj)
  const { data: contratos = [], isLoading: loadingCon } = useContratos()
  // PJ solicitacoes
  const { data: solicitacoes = [], isLoading: loadingSol } = useSolicitacoes()

  const isLoading = loadingCon || loadingSol

  // Build unified PJ list
  type PJItem = {
    id: string
    tipo: 'contrato' | 'solicitacao'
    nome: string
    cnpj?: string
    numero: string
    objeto: string
    valor?: number
    status: StatusPJ
    vigencia_inicio?: string
    vigencia_fim?: string
    obra?: string
    centro_custo?: string
  }

  const pjContratos: PJItem[] = contratos
    .filter(c => c.is_pj || c.tipo_contrato === 'pj')
    .map(c => {
      const nome = c.fornecedor?.razao_social ?? c.fornecedor?.nome_fantasia ?? c.cliente?.nome ?? '—'
      const statusPJ: StatusPJ = c.status === 'vigente' || c.status === 'assinado'
        ? 'ativo'
        : c.status === 'encerrado' || c.status === 'rescindido'
          ? 'encerrado'
          : 'em_processo'
      return {
        id: c.id,
        tipo: 'contrato' as const,
        nome,
        cnpj: c.fornecedor?.cnpj ?? c.cliente?.cnpj,
        numero: c.numero,
        objeto: c.objeto,
        valor: c.valor_total,
        status: statusPJ,
        vigencia_inicio: c.data_inicio,
        vigencia_fim: c.data_fim_previsto,
        obra: c.obra?.nome,
        centro_custo: c.centro_custo,
      }
    })

  const pjSolicitacoes: PJItem[] = solicitacoes
    .filter(s => s.tipo_contraparte === 'pj')
    .filter(s => s.status !== 'cancelado')
    .map(s => ({
      id: s.id,
      tipo: 'solicitacao' as const,
      nome: s.contraparte_nome,
      cnpj: s.contraparte_cnpj ?? undefined,
      numero: s.numero,
      objeto: s.objeto,
      valor: s.valor_estimado ?? undefined,
      status: 'em_processo' as StatusPJ,
      vigencia_inicio: s.data_inicio_prevista ?? undefined,
      vigencia_fim: s.data_fim_prevista ?? undefined,
      centro_custo: s.centro_custo ?? undefined,
    }))

  // Deduplicate: if a solicitacao already has a contrato, skip it
  const contratoSolIds = new Set(contratos.filter(c => c.solicitacao_id).map(c => c.solicitacao_id))
  const uniqueSol = pjSolicitacoes.filter(s => !contratoSolIds.has(s.id))

  const items: PJItem[] = [...pjContratos, ...uniqueSol]

  const filtered = items.filter(i => {
    if (filtroStatus && i.status !== filtroStatus) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        i.nome.toLowerCase().includes(q) ||
        i.numero.toLowerCase().includes(q) ||
        i.objeto.toLowerCase().includes(q) ||
        (i.cnpj?.includes(q) ?? false)
      )
    }
    return true
  })

  const ativos = items.filter(i => i.status === 'ativo').length
  const emProcesso = items.filter(i => i.status === 'em_processo').length
  const totalValor = items.filter(i => i.status === 'ativo').reduce((s, i) => s + (i.valor ?? 0), 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-500" />
            Equipe PJ
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Prestadores de servico pessoa juridica vinculados a contratos
          </p>
        </div>
        <button
          onClick={() => nav('/contratos/solicitacoes/nova')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
            text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <Plus size={14} />
          Novo PJ
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total PJs</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-1">{items.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ativos</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{ativos}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Em Processo</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{emProcesso}</p>
        </div>
        <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Valor Mensal</p>
          <p className="text-lg font-extrabold text-indigo-700 mt-1">{fmt(totalValor)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar prestador, CNPJ, contrato..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
              placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="flex gap-1">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroStatus(f.value)}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${
                filtroStatus === f.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum prestador PJ encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie uma solicitacao de contrato PJ para comecar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const st = STATUS_CFG[item.status]
            const Icon = st.icon
            return (
              <div
                key={`${item.tipo}-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md
                  transition-all p-4 cursor-pointer"
                onClick={() => {
                  if (item.tipo === 'solicitacao') nav(`/contratos/solicitacoes/${item.id}`)
                  else nav(`/contratos/gestao`)
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${st.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={16} className={st.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{item.nome}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </div>
                      {item.valor != null && (
                        <p className="text-sm font-extrabold text-indigo-600 shrink-0">{fmt(item.valor)}</p>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1 truncate">{item.objeto}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <FileText size={10} />
                        <span className="font-mono font-semibold">{item.numero}</span>
                      </div>
                      {item.cnpj && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Building2 size={10} />
                          {item.cnpj}
                        </div>
                      )}
                      {item.vigencia_inicio && item.vigencia_fim && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Calendar size={10} />
                          {fmtData(item.vigencia_inicio)} — {fmtData(item.vigencia_fim)}
                        </div>
                      )}
                      {item.obra && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Briefcase size={10} />
                          {item.obra}
                        </div>
                      )}
                      {item.centro_custo && (
                        <div className="flex items-center gap-1.5 text-[10px] text-indigo-500 font-medium">
                          <BadgeDollarSign size={10} />
                          {item.centro_custo}
                        </div>
                      )}
                      <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${
                        item.tipo === 'solicitacao' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.tipo === 'solicitacao' ? 'Solicitacao' : 'Contrato'}
                      </span>
                    </div>
                  </div>
                  <Eye size={14} className="text-slate-300 mt-1 shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
