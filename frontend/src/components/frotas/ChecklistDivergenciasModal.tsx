// ---------------------------------------------------------------------------
// ChecklistDivergenciasModal.tsx -- Compares exit (pre_viagem) vs entry
// (pos_viagem) checklist to highlight new damages and divergences.
// Opens automatically after concluding an entrada checklist.
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react'
import {
  X, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert,
  ChevronDown, ChevronUp, FileDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import type { FroChecklistExecucaoItem, FroVeiculo, EstadoItemVeiculo } from '../../types/frotas'
import type { ZoneDamage, DamageCondition } from './VehicleDiagramInspection'
import { VEHICLE_ZONES, getConditionLabel, getConditionColor } from './VehicleDiagramInspection'

// -- Types --------------------------------------------------------------------

export interface DivergenciaItem {
  descricao: string
  saidaEstado: EstadoItemVeiculo | null
  entradaEstado: EstadoItemVeiculo | null
  saidaObs: string
  entradaObs: string
  piorou: boolean
}

export interface DivergenciaZona {
  zone: string
  label: string
  saidaCondition: DamageCondition | null
  entradaCondition: DamageCondition | null
  saidaComment: string
  entradaComment: string
  piorou: boolean
  nova: boolean // new damage not present in saida
}

// -- Helpers ------------------------------------------------------------------

const SEVERITY_ORDER: Record<string, number> = {
  otimo: 0,
  bom: 1,
  regular: 2,
  ruim: 3,
  nao_se_aplica: -1,
}

const CONDITION_SEVERITY: Record<string, number> = {
  sem_avaria: 0,
  risco: 1,
  amassado: 2,
  quebrado: 3,
  faltando: 4,
}

function estadoLabel(e: EstadoItemVeiculo | null): string {
  if (!e) return '--'
  const map: Record<EstadoItemVeiculo, string> = {
    otimo: 'Otimo',
    bom: 'Bom',
    regular: 'Regular',
    ruim: 'Ruim',
    nao_se_aplica: 'N/A',
  }
  return map[e] || e
}

function estadoColor(e: EstadoItemVeiculo | null): string {
  if (!e) return '#94a3b8'
  const map: Record<EstadoItemVeiculo, string> = {
    otimo: '#10b981',
    bom: '#3b82f6',
    regular: '#f59e0b',
    ruim: '#ef4444',
    nao_se_aplica: '#94a3b8',
  }
  return map[e] || '#94a3b8'
}

// -- Compare functions --------------------------------------------------------

export function compareChecklistItems(
  saidaItens: FroChecklistExecucaoItem[],
  entradaItens: FroChecklistExecucaoItem[],
): DivergenciaItem[] {
  const divergencias: DivergenciaItem[] = []

  for (const entrada of entradaItens) {
    const descricao = entrada.template_item?.descricao || ''
    const saida = saidaItens.find(
      s => s.template_item_id === entrada.template_item_id,
    )

    const saidaEstado = saida?.estado || null
    const entradaEstado = entrada.estado || null

    // Check if estado got worse
    const saidaSev = saidaEstado ? (SEVERITY_ORDER[saidaEstado] ?? -1) : -1
    const entradaSev = entradaEstado ? (SEVERITY_ORDER[entradaEstado] ?? -1) : -1
    const piorou = entradaSev > saidaSev && saidaSev >= 0 && entradaSev >= 0

    if (piorou || saidaEstado !== entradaEstado) {
      divergencias.push({
        descricao,
        saidaEstado,
        entradaEstado,
        saidaObs: saida?.observacao || '',
        entradaObs: entrada.observacao || '',
        piorou,
      })
    }
  }

  return divergencias
}

export function compareZoneDamages(
  saidaDamages: ZoneDamage[],
  entradaDamages: ZoneDamage[],
): DivergenciaZona[] {
  const divergencias: DivergenciaZona[] = []

  for (const entrada of entradaDamages) {
    const saida = saidaDamages.find(d => d.zone === entrada.zone)
    const zone = VEHICLE_ZONES.find(z => z.id === entrada.zone)

    const saidaCond = saida?.condition || null
    const entradaCond = entrada.condition || null

    const saidaSev = saidaCond ? (CONDITION_SEVERITY[saidaCond] ?? -1) : -1
    const entradaSev = entradaCond ? (CONDITION_SEVERITY[entradaCond] ?? -1) : -1

    const piorou = entradaSev > saidaSev && entradaSev > 0
    const nova = !saida && entradaCond !== 'sem_avaria' && entradaCond !== null

    if (piorou || nova || (saidaCond !== entradaCond && entradaCond !== 'sem_avaria')) {
      divergencias.push({
        zone: entrada.zone,
        label: zone?.label || entrada.zone,
        saidaCondition: saidaCond,
        entradaCondition: entradaCond,
        saidaComment: saida?.comment || '',
        entradaComment: entrada.comment || '',
        piorou,
        nova,
      })
    }
  }

  return divergencias
}

// -- Props --------------------------------------------------------------------

interface Props {
  veiculo: FroVeiculo
  divergenciasItens: DivergenciaItem[]
  divergenciasZonas: DivergenciaZona[]
  onClose: () => void
}

// -- Component ----------------------------------------------------------------

export default function ChecklistDivergenciasModal({
  veiculo,
  divergenciasItens,
  divergenciasZonas,
  onClose,
}: Props) {
  const { isDark } = useTheme()
  const [showItens, setShowItens] = useState(true)
  const [showZonas, setShowZonas] = useState(true)

  const totalDivergencias = divergenciasItens.length + divergenciasZonas.length
  const itensPioraram = divergenciasItens.filter(d => d.piorou).length
  const zonasPioraram = divergenciasZonas.filter(d => d.piorou).length
  const novasDanos = divergenciasZonas.filter(d => d.nova).length
  const totalPioraram = itensPioraram + zonasPioraram

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const borderCls = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const headerBg = isDark ? 'bg-white/[0.02]' : 'bg-slate-50'

  const veiculoLabel = `${veiculo.placa} -- ${veiculo.marca} ${veiculo.modelo}`

  const noDivergencias = totalDivergencias === 0

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-lg mx-4 max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`shrink-0 px-5 py-4 border-b ${borderCls}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                noDivergencias
                  ? isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'
                  : isDark ? 'bg-amber-500/15' : 'bg-amber-50'
              }`}>
                {noDivergencias ? (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                ) : (
                  <ShieldAlert size={20} className="text-amber-500" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className={`text-sm font-bold ${txt}`}>
                  {noDivergencias ? 'Sem Divergencias' : 'Divergencias Encontradas'}
                </h3>
                <p className={`text-[11px] truncate ${txtMuted}`}>{veiculoLabel}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {/* Summary pills */}
          {!noDivergencias && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
              }`}>
                {totalDivergencias} divergencia{totalDivergencias > 1 ? 's' : ''}
              </span>
              {totalPioraram > 0 && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  {totalPioraram} item(ns) pioraram
                </span>
              )}
              {novasDanos > 0 && (
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  {novasDanos} novo{novasDanos > 1 ? 's' : ''} dano{novasDanos > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {noDivergencias && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
              <p className={`text-sm font-semibold ${txt}`}>
                Veiculo retornou sem divergencias
              </p>
              <p className={`text-xs mt-1 ${txtMuted}`}>
                O checklist de entrada esta em conformidade com o de saida.
              </p>
            </div>
          )}

          {/* Zone divergences */}
          {divergenciasZonas.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${borderCls}`}>
              <button
                onClick={() => setShowZonas(!showZonas)}
                className={`w-full flex items-center justify-between px-4 py-3 ${headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="text-amber-500" />
                  <span className={`text-xs font-bold ${txt}`}>
                    Vistoria Visual ({divergenciasZonas.length})
                  </span>
                </div>
                {showZonas ? <ChevronUp size={14} className={txtMuted} /> : <ChevronDown size={14} className={txtMuted} />}
              </button>
              {showZonas && (
                <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                  {divergenciasZonas.map(d => (
                    <div key={d.zone} className={`px-4 py-3 ${
                      d.nova
                        ? isDark ? 'bg-red-500/[0.03]' : 'bg-red-50/30'
                        : d.piorou
                          ? isDark ? 'bg-amber-500/[0.03]' : 'bg-amber-50/30'
                          : ''
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold ${txt}`}>{d.label}</span>
                        {d.nova && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">NOVO</span>
                        )}
                        {d.piorou && !d.nova && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PIOROU</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.saidaCondition ? getConditionColor(d.saidaCondition) : '#94a3b8' }} />
                          <span className={txtMuted}>
                            Saida: {d.saidaCondition ? getConditionLabel(d.saidaCondition) : '--'}
                          </span>
                        </div>
                        <ArrowRight size={10} className={txtMuted} />
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.entradaCondition ? getConditionColor(d.entradaCondition) : '#94a3b8' }} />
                          <span className={d.piorou || d.nova ? 'text-red-500 font-semibold' : txtMuted}>
                            Entrada: {d.entradaCondition ? getConditionLabel(d.entradaCondition) : '--'}
                          </span>
                        </div>
                      </div>
                      {d.entradaComment && (
                        <p className={`text-[10px] mt-1 ${txtMuted}`}>{d.entradaComment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Item divergences */}
          {divergenciasItens.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${borderCls}`}>
              <button
                onClick={() => setShowItens(!showItens)}
                className={`w-full flex items-center justify-between px-4 py-3 ${headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span className={`text-xs font-bold ${txt}`}>
                    Itens do Checklist ({divergenciasItens.length})
                  </span>
                </div>
                {showItens ? <ChevronUp size={14} className={txtMuted} /> : <ChevronDown size={14} className={txtMuted} />}
              </button>
              {showItens && (
                <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                  {divergenciasItens.map((d, i) => (
                    <div key={i} className={`px-4 py-3 ${
                      d.piorou
                        ? isDark ? 'bg-red-500/[0.03]' : 'bg-red-50/30'
                        : ''
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-semibold ${txt}`}>{d.descricao}</span>
                        {d.piorou && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">PIOROU</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estadoColor(d.saidaEstado) }} />
                          <span className={txtMuted}>
                            Saida: {estadoLabel(d.saidaEstado)}
                          </span>
                        </div>
                        <ArrowRight size={10} className={txtMuted} />
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: estadoColor(d.entradaEstado) }} />
                          <span className={d.piorou ? 'text-red-500 font-semibold' : txtMuted}>
                            Entrada: {estadoLabel(d.entradaEstado)}
                          </span>
                        </div>
                      </div>
                      {d.entradaObs && (
                        <p className={`text-[10px] mt-1 ${txtMuted}`}>{d.entradaObs}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`shrink-0 border-t ${borderCls} px-5 py-4`}>
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              noDivergencias
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : isDark
                  ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {noDivergencias ? 'Tudo certo!' : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  )
}
