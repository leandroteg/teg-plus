import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useEventosTelemetria } from '../../../hooks/useTelemetria'
import { useVeiculos } from '../../../hooks/useFrotas'
import type { TipoEventoTel } from '../../../types/telemetria'

// ── Event type config ───────────────────────────────────────────────────────

const EVENTO_CFG: Record<TipoEventoTel, { label: string; cls: string; dotColor: string }> = {
  speed_alert:                    { label: 'Excesso de velocidade',   cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',       dotColor: '#ef4444' },
  hard_brake:                     { label: 'Frenagem brusca',         cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30', dotColor: '#f97316' },
  hard_acceleration:              { label: 'Aceleração brusca',       cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30', dotColor: '#f97316' },
  hard_cornering:                 { label: 'Curva brusca',            cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30', dotColor: '#f97316' },
  desvio_rota:                    { label: 'Desvio de rota',          cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 ring-1 ring-red-500/20', dotColor: '#ef4444' },
  geofence_enter:                 { label: 'Entrou em geofence',      cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',   dotColor: '#3b82f6' },
  geofence_exit:                  { label: 'Saiu de geofence',        cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', dotColor: '#f59e0b' },
  ignition_on:                    { label: 'Veículo ligado',          cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dotColor: '#22c55e' },
  ignition_off:                   { label: 'Veículo desligado',       cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dotColor: '#6b7280' },
  low_external_battery:           { label: 'Bateria baixa',           cls: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30', dotColor: '#eab308' },
  disconnected_external_battery:  { label: 'Bateria desconectada',    cls: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',       dotColor: '#ef4444' },
  reconnected_external_battery:   { label: 'Bateria reconectada',     cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dotColor: '#22c55e' },
}

const TIPO_OPTIONS: { value: TipoEventoTel | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'speed_alert', label: 'Excesso de velocidade' },
  { value: 'hard_brake', label: 'Frenagem brusca' },
  { value: 'hard_acceleration', label: 'Aceleração brusca' },
  { value: 'hard_cornering', label: 'Curva brusca' },
  { value: 'desvio_rota', label: 'Desvio de rota' },
  { value: 'geofence_enter', label: 'Entrou em geofence' },
  { value: 'geofence_exit', label: 'Saiu de geofence' },
  { value: 'ignition_on', label: 'Veículo ligado' },
  { value: 'ignition_off', label: 'Veículo desligado' },
  { value: 'low_external_battery', label: 'Bateria baixa' },
  { value: 'disconnected_external_battery', label: 'Bateria desconectada' },
  { value: 'reconnected_external_battery', label: 'Bateria reconectada' },
]

// ── Component ───────────────────────────────────────────────────────────────

export default function AlertasTelemetria() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [] } = useVeiculos()

  const [tipoEvento, setTipoEvento] = useState<TipoEventoTel | ''>('')
  const [veiculoId, setVeiculoId] = useState('')
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')

  const { data: eventos = [], isLoading } = useEventosTelemetria({
    tipo_evento: tipoEvento || undefined,
    veiculo_id: veiculoId || undefined,
    desde: desde ? desde + 'T00:00:00' : undefined,
    ate: ate ? ate + 'T23:59:59' : undefined,
  })

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'

  const inputCls = `px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight ? 'bg-white border border-slate-200 shadow-sm text-slate-800' : 'bg-white/[0.04] border border-white/[0.08] text-white'
  }`

  const selectCls = inputCls + (isLight ? '' : ' [&>option]:bg-slate-900')

  const lblCls = `text-[10px] font-bold uppercase tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className="space-y-4">
      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 ${cardCls}`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px]">
            <label className={`block mb-1 ${lblCls}`}>Tipo de evento</label>
            <select
              className={selectCls}
              value={tipoEvento}
              onChange={e => setTipoEvento(e.target.value as TipoEventoTel | '')}
            >
              {TIPO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className={`block mb-1 ${lblCls}`}>Veículo</label>
            <select
              className={selectCls}
              value={veiculoId}
              onChange={e => setVeiculoId(e.target.value)}
            >
              <option value="">Todos os veículos</option>
              {veiculos
                .filter(v => v.status !== 'baixado')
                .map(v => (
                  <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>
                ))
              }
            </select>
          </div>

          <div>
            <label className={`block mb-1 ${lblCls}`}>De</label>
            <input
              type="date"
              className={inputCls}
              value={desde}
              onChange={e => setDesde(e.target.value)}
            />
          </div>

          <div>
            <label className={`block mb-1 ${lblCls}`}>Até</label>
            <input
              type="date"
              className={inputCls}
              value={ate}
              onChange={e => setAte(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Event list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-xl h-16 animate-pulse ${cardCls}`} />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={36} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum evento encontrado para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => {
            const cfg = EVENTO_CFG[ev.tipo_evento] ?? EVENTO_CFG.ignition_off
            return (
              <div
                key={ev.id}
                className={`rounded-xl px-4 py-3 transition-colors ${cardCls}`}
              >
                <div className="flex items-center gap-3">
                  {/* Left — dot + label */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cfg.dotColor }}
                    />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Center — vehicle */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {ev.placa}
                      {ev.veiculo && (
                        <span className="text-slate-400 font-normal ml-2 text-xs">
                          {ev.veiculo.marca} {ev.veiculo.modelo}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Right — timestamp */}
                  <div className="shrink-0 text-right">
                    <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {new Date(ev.cobli_ts).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(ev.cobli_ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Below — extra info */}
                {(ev.latitude || ev.velocidade != null) && (
                  <div className="flex gap-4 mt-1.5 text-[10px] text-slate-400">
                    {ev.latitude != null && ev.longitude != null && (
                      <span>
                        {ev.latitude.toFixed(5)}, {ev.longitude.toFixed(5)}
                      </span>
                    )}
                    {ev.velocidade != null && (
                      <span className="font-semibold">
                        {ev.velocidade} km/h
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
