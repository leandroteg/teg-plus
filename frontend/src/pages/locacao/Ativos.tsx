import { useState } from 'react'
import { Building2, MapPin, DollarSign, Calendar, Search } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useImoveis } from '../../hooks/useLocacao'
import type { LocImovel } from '../../types/locacao'

const fmtCurrency = (v?: number) =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

const STATUS_BADGE: Record<string, string> = {
  ativo:      'bg-green-100 text-green-700',
  inativo:    'bg-slate-100 text-slate-600',
  em_entrada: 'bg-blue-100 text-blue-700',
  em_saida:   'bg-amber-100 text-amber-700',
}

const STATUS_LABEL: Record<string, string> = {
  ativo:      'Ativo',
  inativo:    'Inativo',
  em_entrada: 'Em Entrada',
  em_saida:   'Em Saida',
}

function ImovelCard({ imovel, isDark }: { imovel: LocImovel; isDark: boolean }) {
  const bg = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
          <Building2 size={20} className="text-indigo-500" />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[imovel.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {STATUS_LABEL[imovel.status] ?? imovel.status}
        </span>
      </div>

      <div>
        <p className={`text-sm font-bold leading-tight ${txt}`}>{imovel.descricao}</p>
        {imovel.codigo && <p className={`text-[10px] mt-0.5 ${txtMuted}`}>#{imovel.codigo}</p>}
      </div>

      {(imovel.endereco || imovel.cidade) && (
        <p className={`text-xs flex items-center gap-1 ${txtMuted}`}>
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">
            {[imovel.endereco, imovel.numero, imovel.cidade, imovel.uf].filter(Boolean).join(', ')}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg p-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${txtMuted}`}>Aluguel</p>
          <p className={`text-sm font-bold mt-0.5 ${txt}`}>{fmtCurrency(imovel.valor_aluguel_mensal)}</p>
        </div>
        <div className={`rounded-lg p-2 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${txtMuted}`}>Vencimento</p>
          <p className={`text-sm font-bold mt-0.5 ${txt}`}>
            {imovel.dia_vencimento ? `Dia ${imovel.dia_vencimento}` : '—'}
          </p>
        </div>
      </div>

      {imovel.locador_nome && (
        <p className={`text-xs ${txtMuted}`}>
          Locador: <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{imovel.locador_nome}</span>
        </p>
      )}
    </div>
  )
}

export default function Ativos() {
  const { isDark } = useTheme()
  const { data: imoveis = [], isLoading } = useImoveis()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ativo')

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'

  const filtered = imoveis.filter(im => {
    if (statusFilter && im.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        im.descricao.toLowerCase().includes(q) ||
        im.cidade?.toLowerCase().includes(q) ||
        im.endereco?.toLowerCase().includes(q) ||
        im.codigo?.toLowerCase().includes(q)
      )
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`text-xl font-extrabold ${txt}`}>Imoveis Ativos</h1>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>{imoveis.filter(i => i.status === 'ativo').length} imoveis ativos</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 min-w-[180px] ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input
            type="text"
            placeholder="Buscar imovel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`}
          />
        </div>
        <div className="flex gap-1">
          {[
            { value: '', label: 'Todos' },
            { value: 'ativo', label: 'Ativos' },
            { value: 'inativo', label: 'Inativos' },
            { value: 'em_entrada', label: 'Em Entrada' },
            { value: 'em_saida', label: 'Em Saida' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : isDark
                  ? 'border-white/10 text-slate-400 hover:border-white/20'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Building2 size={40} className={txtMuted} />
          <p className={`text-sm ${txtMuted}`}>Nenhum imovel encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(im => (
            <ImovelCard key={im.id} imovel={im} isDark={isDark} />
          ))}
        </div>
      )}
    </div>
  )
}
