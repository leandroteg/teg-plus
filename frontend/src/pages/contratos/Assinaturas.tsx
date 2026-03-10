import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature, Search, Clock, CheckCircle2, XCircle,
  ExternalLink, Building2, Calendar, AlertTriangle, Send,
  Eye, FileText,
} from 'lucide-react'
import { useSolicitacoes } from '../../hooks/useSolicitacoes'
import { useContratos } from '../../hooks/useContratos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

type StatusAssinatura = 'pendente' | 'enviado' | 'assinado' | 'recusado'

const STATUS_CFG: Record<StatusAssinatura, { label: string; dot: string; bg: string; text: string; icon: typeof Clock }> = {
  pendente: { label: 'Pendente',     dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   icon: Clock },
  enviado:  { label: 'Enviado',      dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700',    icon: Send },
  assinado: { label: 'Assinado',     dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: CheckCircle2 },
  recusado: { label: 'Recusado',     dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600',     icon: XCircle },
}

const FILTROS = [
  { label: 'Todos',     value: '' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Enviados',  value: 'enviado' },
  { label: 'Assinados', value: 'assinado' },
  { label: 'Recusados', value: 'recusado' },
]

export default function Assinaturas() {
  const nav = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // Solicitacoes na etapa de assinatura
  const { data: solicitacoes = [], isLoading: loadingSol } = useSolicitacoes({
    etapa_atual: 'enviar_assinatura',
  })

  // Contratos assinados recentemente
  const { data: contratos = [], isLoading: loadingCon } = useContratos({ status: 'assinado' })

  const isLoading = loadingSol || loadingCon

  // Build unified list
  type Item = {
    id: string
    tipo: 'solicitacao' | 'contrato'
    numero: string
    objeto: string
    contraparte: string
    valor?: number
    status: StatusAssinatura
    data: string
    link?: string
  }

  const items: Item[] = [
    ...solicitacoes.map(s => ({
      id: s.id,
      tipo: 'solicitacao' as const,
      numero: s.numero,
      objeto: s.objeto,
      contraparte: s.contraparte_nome,
      valor: s.valor_estimado ?? undefined,
      status: 'pendente' as StatusAssinatura,
      data: s.updated_at,
    })),
    ...contratos.map(c => ({
      id: c.id,
      tipo: 'contrato' as const,
      numero: c.numero,
      objeto: c.objeto,
      contraparte: c.cliente?.nome ?? c.fornecedor?.razao_social ?? '—',
      valor: c.valor_total,
      status: 'assinado' as StatusAssinatura,
      data: c.data_assinatura ?? c.updated_at,
    })),
  ]

  const filtered = items.filter(i => {
    if (filtroStatus && i.status !== filtroStatus) return false
    if (busca) {
      const q = busca.toLowerCase()
      return (
        i.numero.toLowerCase().includes(q) ||
        i.objeto.toLowerCase().includes(q) ||
        i.contraparte.toLowerCase().includes(q)
      )
    }
    return true
  })

  const pendentes = items.filter(i => i.status === 'pendente').length
  const assinados = items.filter(i => i.status === 'assinado').length

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
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <FileSignature size={20} className="text-indigo-500" />
          Assinaturas
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Controle de envio e recebimento de assinaturas contratuais
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-extrabold text-slate-800 mt-1">{items.length}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pendentes</p>
          <p className="text-2xl font-extrabold text-amber-700 mt-1">{pendentes}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Assinados</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{assinados}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por numero, objeto ou contraparte..."
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
            <FileSignature size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma assinatura encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Solicitacoes avancarao para ca apos preparacao da minuta</p>
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
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                          {item.numero}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${
                          item.tipo === 'solicitacao' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.tipo === 'solicitacao' ? 'Solicitacao' : 'Contrato'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 shrink-0">{fmtData(item.data)}</p>
                    </div>

                    <p className="text-sm font-bold text-slate-800 mt-1 truncate">{item.objeto}</p>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Building2 size={11} className="text-slate-400" />
                        {item.contraparte}
                      </div>
                      {item.valor != null && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                          {fmt(item.valor)}
                        </div>
                      )}
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
