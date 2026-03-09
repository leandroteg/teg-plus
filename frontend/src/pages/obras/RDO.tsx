import { useState } from 'react'
import { CloudSun, Plus, Filter, Users, Wrench } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useRDOs } from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { CondicaoClimatica, StatusRDO } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const WEATHER_ICON: Record<CondicaoClimatica, string> = {
  sol:          '\u2600\uFE0F',
  nublado:      '\u26C5',
  chuva:        '\uD83C\uDF27\uFE0F',
  chuva_forte:  '\u26C8\uFE0F',
  tempestade:   '\uD83C\uDF2A\uFE0F',
}

const WEATHER_LABEL: Record<CondicaoClimatica, string> = {
  sol:          'Sol',
  nublado:      'Nublado',
  chuva:        'Chuva',
  chuva_forte:  'Chuva Forte',
  tempestade:   'Tempestade',
}

const STATUS_CONFIG: Record<StatusRDO, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  finalizado: { label: 'Finalizado', light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RDO() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')

  const { data: rdos = [], isLoading } = useRDOs({
    obra_id: obraFilter || undefined,
  })

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <CloudSun size={20} className={isLight ? 'text-amber-600' : 'text-amber-400'} />
            RDO - Relatorio Diario de Obra
          </h1>
          <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {rdos.length} registros
          </p>
        </div>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors ${isLight
            ? 'bg-teal-600 hover:bg-teal-700 shadow-sm'
            : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          <Plus size={15} /> Novo RDO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className={selectClass}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-teal-500 border-t-transparent'
            : 'border-teal-400 border-t-transparent'
          }`} />
        </div>
      ) : rdos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <CloudSun size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhum RDO encontrado
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Crie um novo Relatorio Diario de Obra
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-center px-4 py-3">Clima</th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Users size={12} /> Efetivo
                    </span>
                  </th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Wrench size={12} /> Equip.
                    </span>
                  </th>
                  <th className="text-right px-4 py-3">Hrs Improd.</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rdos.map(rdo => {
                  const st = STATUS_CONFIG[rdo.status] ?? STATUS_CONFIG.rascunho
                  const totalEfetivo = rdo.efetivo_proprio + rdo.efetivo_terceiro
                  const totalEquip = rdo.equipamentos_operando + rdo.equipamentos_parados
                  return (
                    <tr
                      key={rdo.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(rdo.data)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {rdo.obra?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg" title={WEATHER_LABEL[rdo.condicao_climatica]}>
                          {WEATHER_ICON[rdo.condicao_climatica] ?? '—'}
                        </span>
                        <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {WEATHER_LABEL[rdo.condicao_climatica]}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEfetivo}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {rdo.efetivo_proprio}P + {rdo.efetivo_terceiro}T
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                          {totalEquip}
                        </p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className="text-emerald-500">{rdo.equipamentos_operando}</span>
                          {' / '}
                          <span className={rdo.equipamentos_parados > 0 ? 'text-red-400' : ''}>{rdo.equipamentos_parados}</span>
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right ${rdo.horas_improdutivas > 0
                        ? 'text-red-500 font-bold'
                        : isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {rdo.horas_improdutivas > 0 ? `${rdo.horas_improdutivas}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
