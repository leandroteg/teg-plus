import { useState } from 'react'
import {
  Car, Cog, X, Tag, User, Radio, Building2,
  Gauge, Timer, FileText, ShieldAlert, Wrench, MapPin, ClipboardList, CornerDownLeft,
  Pencil, Check, Loader2, Activity, Navigation,
} from 'lucide-react'
import { useAtualizarAlocacao } from '../../hooks/useFrotas'
import { useObras } from '../../hooks/useFinanceiro'
import type { FroVeiculo } from '../../types/frotas'
import { parseObsInfo } from './veiculoObs'

// ── Shared helpers ──────────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function diasAte(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function docAlertColor(dias: number | null, isLight: boolean): string {
  if (dias === null) return ''
  if (dias <= 0)  return isLight ? 'text-red-600'    : 'text-red-400'
  if (dias <= 15) return isLight ? 'text-orange-600' : 'text-orange-400'
  if (dias <= 30) return isLight ? 'text-amber-600'  : 'text-amber-400'
  return ''
}

function preventivaColor(
  kmProx?: number, kmAtual?: number, dataProx?: string
): 'green' | 'yellow' | 'red' {
  if (dataProx) {
    const d = diasAte(dataProx)
    if (d !== null) {
      if (d <= 0)  return 'red'
      if (d <= 30) return 'yellow'
    }
  }
  if (kmProx !== undefined && kmAtual !== undefined) {
    const diff = kmProx - kmAtual
    if (diff <= 0)    return 'red'
    if (diff <= 2000) return 'yellow'
  }
  return 'green'
}

const PREV_STYLES = {
  green:  { light: 'bg-emerald-50 text-emerald-700 border-emerald-200', dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  yellow: { light: 'bg-amber-50 text-amber-700 border-amber-200',       dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  red:    { light: 'bg-red-50 text-red-700 border-red-200',             dark: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const PROP_MAP = {
  propria: { label: 'Próprio', light: 'bg-emerald-50 text-emerald-700',  dark: 'bg-emerald-500/10 text-emerald-400' },
  locada:  { label: 'Locado',  light: 'bg-amber-50 text-amber-700',      dark: 'bg-amber-500/10 text-amber-400'    },
  cedida:  { label: 'Cedido',  light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/10 text-slate-400'    },
}

// ── Modal ───────────────────────────────────────────────────────────────────────

export interface VeiculoDetalhesModalProps {
  veiculo: FroVeiculo
  osCount?: number
  isLight: boolean
  onClose: () => void
  /** Ações opcionais — renderiza só se o handler for passado */
  onAlocar?: () => void
  onOS?: () => void
  onChecklist?: () => void
  onRegistrarRetorno?: () => void
  /** Info extra da alocação corrente (se houver) */
  alocacaoInfo?: {
    id?: string
    obraId?: string
    obra?: string
    responsavel?: string
    responsavelId?: string
    dataSaida?: string
    dataRetornoPrev?: string
    observacoes?: string
  }
  /** Info de telemetria em tempo real (se houver) */
  telemetriaInfo?: {
    velocidade?: number
    statusLabel?: string
    statusColor?: string
    ignicao?: boolean
    hodometro?: number
    ultimaAtualizacao?: string
    latitude?: number
    longitude?: number
  }
}

export default function VeiculoDetalhesModal({
  veiculo: v, osCount = 0, isLight, onClose,
  onAlocar, onOS, onChecklist, onRegistrarRetorno,
  alocacaoInfo, telemetriaInfo,
}: VeiculoDetalhesModalProps) {
  const isDark = !isLight
  const atualizar = useAtualizarAlocacao()
  const { data: obras = [] } = useObras()
  const [editMode, setEditMode] = useState(false)
  const [editResp, setEditResp] = useState(alocacaoInfo?.responsavel ?? '')
  const [editObra, setEditObra] = useState(alocacaoInfo?.obraId ?? '')
  const [editDataRet, setEditDataRet] = useState(alocacaoInfo?.dataRetornoPrev ?? '')
  const [editObs, setEditObs] = useState(alocacaoInfo?.observacoes ?? '')

  const canEdit = !!alocacaoInfo?.id

  async function handleSaveAloc() {
    if (!alocacaoInfo?.id) return
    try {
      await atualizar.mutateAsync({
        id: alocacaoInfo.id,
        responsavel_nome: editResp.trim() || undefined,
        obra_id: editObra || undefined,
        data_retorno_prev: editDataRet || undefined,
        observacoes: editObs.trim() || undefined,
      })
      setEditMode(false)
    } catch (err) {
      alert('Erro ao atualizar: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }
  const isMaquina = v.tipo_ativo === 'maquina'
  const obs = parseObsInfo(v.observacoes)
  const prop = PROP_MAP[v.propriedade]
  const prevColor = preventivaColor(v.km_proxima_preventiva, v.hodometro_atual, v.data_proxima_preventiva)
  const prevStyle = PREV_STYLES[prevColor]

  const diasCrlv   = diasAte(v.vencimento_crlv)
  const diasSeguro = diasAte(v.vencimento_seguro)
  const crlvColor   = docAlertColor(diasCrlv, isLight)
  const seguroColor = docAlertColor(diasSeguro, isLight)

  const codigo = v.codigo_interno || obs.codigo || obs.codFrota || (isMaquina && v.numero_serie) || v.placa
  const categoriaOrigem = obs.categoriaOrigem || v.categoria.toUpperCase()

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardBg = isDark ? 'bg-white/[0.03]' : 'bg-slate-50'

  function Info({ icon: Icon, label, value, color }: { icon: typeof Tag; label: string; value?: string | number | null; color?: string }) {
    if (!value && value !== 0) return null
    return (
      <div className="flex items-start gap-2">
        <Icon size={13} className={`mt-0.5 shrink-0 ${color || txtMuted}`} />
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{label}</p>
          <p className={`text-sm font-semibold ${txtMain} break-words`}>{value}</p>
        </div>
      </div>
    )
  }

  const hasActions = onAlocar || onOS || onChecklist || onRegistrarRetorno

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border ${border} ${bg}`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b ${border} ${bg} rounded-t-2xl`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isMaquina
                ? (isLight ? 'bg-violet-50' : 'bg-violet-500/10')
                : (isLight ? 'bg-sky-50'    : 'bg-sky-500/10')
            }`}>
              {isMaquina
                ? <Cog  size={20} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
                : <Car  size={20} className={isLight ? 'text-sky-600'    : 'text-sky-400'} />
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-base font-extrabold font-mono ${txtMain}`}>{codigo}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                  {categoriaOrigem}
                </span>
              </div>
              <p className={`text-xs ${txtMuted}`}>
                {v.marca} {v.modelo}
                <span className={isLight ? 'text-slate-300' : 'text-slate-600'}> · </span>
                <span className="font-mono font-semibold">{v.placa}</span>
                {v.ano_mod && <> · {v.ano_mod}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/[0.06] text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? prop.light : prop.dark}`}>
              {prop.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isLight ? prevStyle.light : prevStyle.dark}`}>
              <Wrench size={9} />
              {isMaquina && v.km_proxima_preventiva
                ? `Prev. ${fmtNum(v.km_proxima_preventiva)} h`
                : v.km_proxima_preventiva
                ? `Prev. ${fmtNum(v.km_proxima_preventiva)} km`
                : v.data_proxima_preventiva
                ? `Prev. ${new Date(v.data_proxima_preventiva).toLocaleDateString('pt-BR')}`
                : 'Preventiva OK'}
            </span>
            {osCount > 0 && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                <Wrench size={9} /> {osCount} OS aberta{osCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Telemetria em tempo real (se fornecida) */}
          {telemetriaInfo && (
            <div className={`rounded-xl border p-4 ${border} ${
              isLight ? 'bg-emerald-50/40 border-emerald-200' : 'bg-emerald-500/[0.04] border-emerald-500/15'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                  <Activity size={11} className="animate-pulse" />
                  Telemetria em tempo real
                </p>
                {telemetriaInfo.statusLabel && telemetriaInfo.statusColor && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: telemetriaInfo.statusColor + '22',
                      color: telemetriaInfo.statusColor,
                    }}
                  >
                    ● {telemetriaInfo.statusLabel}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Info
                  icon={Gauge}
                  label="Velocidade"
                  value={telemetriaInfo.velocidade != null ? `${telemetriaInfo.velocidade} km/h` : undefined}
                />
                <Info
                  icon={Radio}
                  label="Ignição"
                  value={telemetriaInfo.ignicao != null ? (telemetriaInfo.ignicao ? 'Ligada' : 'Desligada') : undefined}
                />
                <Info
                  icon={Gauge}
                  label="Hodômetro (tel.)"
                  value={telemetriaInfo.hodometro != null ? `${Math.round(telemetriaInfo.hodometro).toLocaleString('pt-BR')} km` : undefined}
                />
                <Info
                  icon={Timer}
                  label="Última atualização"
                  value={telemetriaInfo.ultimaAtualizacao ? new Date(telemetriaInfo.ultimaAtualizacao).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : undefined}
                />
                {telemetriaInfo.latitude != null && telemetriaInfo.longitude != null && (
                  <div className="col-span-2 flex items-start gap-2">
                    <Navigation size={13} className={`mt-0.5 shrink-0 ${txtMuted}`} />
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Localização</p>
                      <p className={`text-sm font-semibold ${txtMain}`}>
                        {telemetriaInfo.latitude.toFixed(5)}, {telemetriaInfo.longitude.toFixed(5)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${telemetriaInfo.latitude},${telemetriaInfo.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-[10px] font-semibold ${isLight ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
                      >
                        Abrir no Google Maps ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alocação atual (se fornecida) — com modo de edição */}
          {alocacaoInfo && (
            <div className={`rounded-xl border p-4 ${border} ${
              isLight ? 'bg-rose-50/40 border-rose-200' : 'bg-rose-500/[0.04] border-rose-500/15'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
                  Alocação atual
                </p>
                {canEdit && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                      isLight ? 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200' : 'bg-white/[0.06] text-rose-300 hover:bg-white/[0.1]'
                    }`}
                  >
                    <Pencil size={11} /> Editar
                  </button>
                )}
              </div>

              {!editMode ? (
                <div className="grid grid-cols-2 gap-4">
                  <Info icon={Building2} label="Obra / CC" value={alocacaoInfo.obra} />
                  <Info icon={User}      label="Responsável" value={alocacaoInfo.responsavel} />
                  <Info icon={Tag}       label="Saída"       value={alocacaoInfo.dataSaida ? new Date(alocacaoInfo.dataSaida).toLocaleDateString('pt-BR') : undefined} />
                  <Info icon={Tag}       label="Retorno previsto" value={alocacaoInfo.dataRetornoPrev ? new Date(alocacaoInfo.dataRetornoPrev).toLocaleDateString('pt-BR') : undefined} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${txtMuted}`}>
                        Motorista / Responsável
                      </label>
                      <input
                        value={editResp}
                        onChange={e => setEditResp(e.target.value)}
                        placeholder="Nome completo..."
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
                          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${txtMuted}`}>
                        Retorno previsto
                      </label>
                      <input
                        type="date"
                        value={editDataRet}
                        onChange={e => setEditDataRet(e.target.value)}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
                          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-white'
                        }`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${txtMuted}`}>
                      Obra / Canteiro
                    </label>
                    <select
                      value={editObra}
                      onChange={e => setEditObra(e.target.value)}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-white'
                      }`}
                    >
                      <option value="">— Manter atual —</option>
                      {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${txtMuted}`}>
                      Observações
                    </label>
                    <textarea
                      value={editObs}
                      onChange={e => setEditObs(e.target.value)}
                      rows={2}
                      className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none resize-none focus:ring-2 focus:ring-rose-500/30 ${
                        isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-white'
                      }`}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditMode(false)
                        setEditResp(alocacaoInfo?.responsavel ?? '')
                        setEditObra(alocacaoInfo?.obraId ?? '')
                        setEditDataRet(alocacaoInfo?.dataRetornoPrev ?? '')
                        setEditObs(alocacaoInfo?.observacoes ?? '')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${
                        isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]'
                      }`}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveAloc}
                      disabled={atualizar.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                    >
                      {atualizar.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Operacional */}
          <div className={`rounded-xl border p-4 ${border} ${cardBg}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${txtMuted}`}>Operacional</p>
            <div className="grid grid-cols-2 gap-4">
              <Info icon={Tag}       label="Cód. Sistema" value={obs.codigo} />
              <Info icon={Tag}       label="Cód. Frota"   value={obs.codFrota} />
              <Info icon={isMaquina ? Timer : Gauge} label={isMaquina ? 'Horímetro' : 'Hodômetro'}
                value={isMaquina
                  ? (v.horimetro_atual !== undefined ? `${fmtNum(v.horimetro_atual)} h` : '—')
                  : `${fmtNum(v.hodometro_atual)} km`} />
              <Info icon={User}      label="Responsável"  value={obs.responsavel} />
              <Info icon={Building2} label="Local / Sede" value={obs.local} />
              <Info icon={Radio}     label="Rastreador"   value={obs.rastreador} />
            </div>
          </div>

          {/* Dados do Veículo */}
          <div className={`rounded-xl border p-4 ${border} ${cardBg}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${txtMuted}`}>Dados do {isMaquina ? 'Ativo' : 'Veículo'}</p>
            <div className="grid grid-cols-2 gap-4">
              <Info icon={Tag} label="Marca"        value={v.marca} />
              <Info icon={Tag} label="Modelo"       value={v.modelo} />
              <Info icon={Tag} label="Cor"          value={v.cor} />
              <Info icon={Tag} label="Ano Fab / Mod" value={v.ano_fab || v.ano_mod ? `${v.ano_fab ?? '—'} / ${v.ano_mod ?? '—'}` : null} />
              <Info icon={Tag} label="RENAVAM"      value={v.renavam} />
              <Info icon={Tag} label="Nº Série / Chassi" value={v.numero_serie} />
              <Info icon={Tag} label="Categoria sistema" value={v.categoria} />
              <Info icon={Tag} label="Combustível"  value={v.combustivel} />
            </div>
          </div>

          {/* Documentos */}
          {(v.vencimento_crlv || v.vencimento_seguro || v.vencimento_tacografo) && (
            <div className={`rounded-xl border p-4 ${border} ${cardBg}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${txtMuted}`}>Documentos</p>
              <div className="grid grid-cols-2 gap-4">
                {v.vencimento_crlv && (
                  <Info icon={FileText} label={`CRLV ${diasCrlv !== null && diasCrlv <= 0 ? '(VENCIDO)' : diasCrlv !== null ? `(${diasCrlv}d)` : ''}`}
                    value={new Date(v.vencimento_crlv).toLocaleDateString('pt-BR')} color={crlvColor} />
                )}
                {v.vencimento_seguro && (
                  <Info icon={ShieldAlert} label={`Seguro ${diasSeguro !== null && diasSeguro <= 0 ? '(VENCIDO)' : diasSeguro !== null ? `(${diasSeguro}d)` : ''}`}
                    value={new Date(v.vencimento_seguro).toLocaleDateString('pt-BR')} color={seguroColor} />
                )}
                {v.vencimento_tacografo && (
                  <Info icon={FileText} label="Tacógrafo"
                    value={new Date(v.vencimento_tacografo).toLocaleDateString('pt-BR')} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        {hasActions && (
          <div className={`sticky bottom-0 z-10 px-5 py-4 border-t flex flex-col sm:flex-row gap-2 ${border} ${bg}`}>
            {onAlocar && (
              <button
                onClick={onAlocar}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/30"
              >
                <MapPin size={14} /> Alocar
              </button>
            )}
            {onRegistrarRetorno && (
              <button
                onClick={onRegistrarRetorno}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/30"
              >
                <CornerDownLeft size={14} /> Registrar Retorno
              </button>
            )}
            {onOS && (
              <button
                onClick={onOS}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <Wrench size={14} /> Abrir OS
              </button>
            )}
            {onChecklist && (
              <button
                onClick={onChecklist}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-white/[0.08]'
                }`}
              >
                <ClipboardList size={14} /> Checklist
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
