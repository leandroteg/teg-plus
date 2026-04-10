// ---------------------------------------------------------------------------
// VehicleDiagramInspection.tsx -- Interactive top-down vehicle diagram
// Professional vehicle inspection interface with clickable zones,
// damage marking, photos, and comments. Rental-car-company quality.
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from 'react'
import {
  X, Camera, MessageSquare, Check, ChevronDown,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// -- Zone types ---------------------------------------------------------------

export type DamageCondition =
  | 'sem_avaria'
  | 'risco'
  | 'amassado'
  | 'quebrado'
  | 'faltando'

export interface ZoneDamage {
  zone: string
  condition: DamageCondition
  comment: string
  photos: ZonePhoto[]
}

export interface ZonePhoto {
  id: string
  dataUrl: string
}

// -- Zone definitions (top-down car) ------------------------------------------

export interface VehicleZone {
  id: string
  label: string
  // SVG positioning (percentages of viewBox)
  x: number
  y: number
  width: number
  height: number
}

export const VEHICLE_ZONES: VehicleZone[] = [
  // Front
  { id: 'parachoque_diant', label: 'Para-choque Dianteiro', x: 30, y: 2, width: 40, height: 8 },
  { id: 'capo',             label: 'Capo',                  x: 30, y: 10, width: 40, height: 12 },
  { id: 'parabrisa',        label: 'Para-brisa',            x: 32, y: 22, width: 36, height: 6 },
  // Left side
  { id: 'porta_diant_esq',  label: 'Porta Diant. Esq.',     x: 10, y: 28, width: 16, height: 18 },
  { id: 'porta_tras_esq',   label: 'Porta Tras. Esq.',      x: 10, y: 46, width: 16, height: 18 },
  { id: 'lateral_esq',      label: 'Lateral Esquerda',       x: 10, y: 64, width: 16, height: 8 },
  // Right side
  { id: 'porta_diant_dir',  label: 'Porta Diant. Dir.',      x: 74, y: 28, width: 16, height: 18 },
  { id: 'porta_tras_dir',   label: 'Porta Tras. Dir.',       x: 74, y: 46, width: 16, height: 18 },
  { id: 'lateral_dir',      label: 'Lateral Direita',        x: 74, y: 64, width: 16, height: 8 },
  // Center
  { id: 'teto',             label: 'Teto',                   x: 30, y: 30, width: 40, height: 32 },
  // Rear
  { id: 'vidro_traseiro',   label: 'Vidro Traseiro',         x: 32, y: 72, width: 36, height: 6 },
  { id: 'tampa_traseira',   label: 'Tampa Traseira',         x: 30, y: 78, width: 40, height: 10 },
  { id: 'parachoque_tras',  label: 'Para-choque Traseiro',   x: 30, y: 88, width: 40, height: 8 },
  // Wheels
  { id: 'roda_de',          label: 'Roda Diant. Esq.',       x: 14, y: 16, width: 12, height: 12 },
  { id: 'roda_dd',          label: 'Roda Diant. Dir.',        x: 74, y: 16, width: 12, height: 12 },
  { id: 'roda_te',          label: 'Roda Tras. Esq.',         x: 14, y: 68, width: 12, height: 12 },
  { id: 'roda_td',          label: 'Roda Tras. Dir.',          x: 74, y: 68, width: 12, height: 12 },
]

// -- Condition config ---------------------------------------------------------

const CONDITIONS: {
  value: DamageCondition
  label: string
  color: string
  dotColor: string
  bgLight: string
  bgDark: string
  selectedLight: string
  selectedDark: string
}[] = [
  {
    value: 'sem_avaria', label: 'Sem Avaria',
    color: '#10b981', dotColor: '#10b981',
    bgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    selectedLight: 'bg-emerald-500 text-white border-emerald-500',
    selectedDark: 'bg-emerald-500 text-white border-emerald-500',
  },
  {
    value: 'risco', label: 'Risco',
    color: '#eab308', dotColor: '#eab308',
    bgLight: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    bgDark: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    selectedLight: 'bg-yellow-500 text-white border-yellow-500',
    selectedDark: 'bg-yellow-500 text-white border-yellow-500',
  },
  {
    value: 'amassado', label: 'Amassado',
    color: '#f97316', dotColor: '#f97316',
    bgLight: 'bg-orange-50 text-orange-700 border-orange-200',
    bgDark: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    selectedLight: 'bg-orange-500 text-white border-orange-500',
    selectedDark: 'bg-orange-500 text-white border-orange-500',
  },
  {
    value: 'quebrado', label: 'Quebrado',
    color: '#ef4444', dotColor: '#ef4444',
    bgLight: 'bg-red-50 text-red-700 border-red-200',
    bgDark: 'bg-red-500/10 text-red-400 border-red-500/20',
    selectedLight: 'bg-red-500 text-white border-red-500',
    selectedDark: 'bg-red-500 text-white border-red-500',
  },
  {
    value: 'faltando', label: 'Faltando',
    color: '#ef4444', dotColor: '#dc2626',
    bgLight: 'bg-red-50 text-red-700 border-red-200',
    bgDark: 'bg-red-500/10 text-red-400 border-red-500/20',
    selectedLight: 'bg-red-600 text-white border-red-600',
    selectedDark: 'bg-red-600 text-white border-red-600',
  },
]

function getConditionColor(c?: DamageCondition): string {
  return CONDITIONS.find(cc => cc.value === c)?.dotColor || '#94a3b8'
}

function getConditionLabel(c?: DamageCondition): string {
  return CONDITIONS.find(cc => cc.value === c)?.label || '--'
}

// -- Props --------------------------------------------------------------------

interface Props {
  damages: ZoneDamage[]
  onChange: (damages: ZoneDamage[]) => void
  readOnly?: boolean
}

// -- Component ----------------------------------------------------------------

export default function VehicleDiagramInspection({
  damages,
  onChange,
  readOnly = false,
}: Props) {
  const { isDark } = useTheme()
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const getDamage = (zoneId: string): ZoneDamage | undefined =>
    damages.find(d => d.zone === zoneId)

  const setDamage = useCallback(
    (zoneId: string, update: Partial<ZoneDamage>) => {
      const existing = damages.find(d => d.zone === zoneId)
      if (existing) {
        onChange(
          damages.map(d =>
            d.zone === zoneId ? { ...d, ...update } : d,
          ),
        )
      } else {
        onChange([
          ...damages,
          {
            zone: zoneId,
            condition: 'sem_avaria',
            comment: '',
            photos: [],
            ...update,
          },
        ])
      }
    },
    [damages, onChange],
  )

  const handleZoneClick = (zoneId: string) => {
    if (readOnly) return
    setSelectedZone(prev => (prev === zoneId ? null : zoneId))
  }

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && selectedZone) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const photo: ZonePhoto = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: reader.result as string,
        }
        const existing = getDamage(selectedZone)
        setDamage(selectedZone, {
          photos: [...(existing?.photos || []), photo],
        })
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removePhoto = (zoneId: string, photoId: string) => {
    const existing = getDamage(zoneId)
    if (existing) {
      setDamage(zoneId, {
        photos: existing.photos.filter(p => p.id !== photoId),
      })
    }
  }

  const selectedZoneData = selectedZone ? VEHICLE_ZONES.find(z => z.id === selectedZone) : null
  const selectedDamage = selectedZone ? getDamage(selectedZone) : null

  const totalZones = VEHICLE_ZONES.length
  const inspectedZones = damages.filter(d => d.condition).length
  const issueZones = damages.filter(
    d => d.condition && d.condition !== 'sem_avaria',
  ).length

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const borderCls = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Summary bar */}
      <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${borderCls} ${bg}`}>
        <span className={`text-xs font-semibold ${txtMuted}`}>
          Vistoria Visual
        </span>
        <div className="flex-1" />
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          inspectedZones === totalZones
            ? 'bg-emerald-100 text-emerald-700'
            : inspectedZones > 0
              ? 'bg-amber-100 text-amber-700'
              : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'
        }`}>
          {inspectedZones}/{totalZones} zonas
        </span>
        {issueZones > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {issueZones} avaria{issueZones > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Diagram */}
      <div className={`relative rounded-2xl border overflow-hidden ${borderCls} ${bg}`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full"
          style={{ maxHeight: '420px' }}
        >
          {/* Background */}
          <rect x="0" y="0" width="100" height="100" fill={isDark ? '#0f172a' : '#f1f5f9'} />

          {/* Car body outline - top down view */}
          {/* Main body */}
          <rect x="26" y="8" width="48" height="84" rx="10" ry="10"
            fill={isDark ? '#1e293b' : '#e2e8f0'}
            stroke={isDark ? '#334155' : '#cbd5e1'}
            strokeWidth="0.5"
          />
          {/* Hood curve */}
          <path d="M 30 22 Q 50 18 70 22" fill="none"
            stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="0.3" />
          {/* Windshield line */}
          <rect x="32" y="22" width="36" height="6" rx="2" ry="2"
            fill={isDark ? '#1e3a5f' : '#bfdbfe'}
            stroke={isDark ? '#1e40af' : '#93c5fd'}
            strokeWidth="0.3"
            opacity="0.5"
          />
          {/* Rear windshield line */}
          <rect x="32" y="72" width="36" height="6" rx="2" ry="2"
            fill={isDark ? '#1e3a5f' : '#bfdbfe'}
            stroke={isDark ? '#1e40af' : '#93c5fd'}
            strokeWidth="0.3"
            opacity="0.5"
          />
          {/* Trunk curve */}
          <path d="M 30 78 Q 50 82 70 78" fill="none"
            stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="0.3" />
          {/* Center line (roof) */}
          <line x1="50" y1="30" x2="50" y2="70" stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="0.2" strokeDasharray="1 1" />
          {/* Door lines */}
          <line x1="26" y1="46" x2="30" y2="46" stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="0.3" />
          <line x1="70" y1="46" x2="74" y2="46" stroke={isDark ? '#475569' : '#94a3b8'} strokeWidth="0.3" />

          {/* Wheels */}
          {[
            { cx: 20, cy: 22 }, // DE
            { cx: 80, cy: 22 }, // DD
            { cx: 20, cy: 74 }, // TE
            { cx: 80, cy: 74 }, // TD
          ].map((w, i) => (
            <g key={i}>
              <rect x={w.cx - 4} y={w.cy - 5} width="8" height="10" rx="2" ry="2"
                fill={isDark ? '#334155' : '#475569'}
                stroke={isDark ? '#475569' : '#334155'}
                strokeWidth="0.3"
              />
              {/* Tire tread lines */}
              <line x1={w.cx - 2} y1={w.cy - 3} x2={w.cx + 2} y2={w.cy - 3}
                stroke={isDark ? '#1e293b' : '#1e293b'} strokeWidth="0.3" opacity="0.3" />
              <line x1={w.cx - 2} y1={w.cy} x2={w.cx + 2} y2={w.cy}
                stroke={isDark ? '#1e293b' : '#1e293b'} strokeWidth="0.3" opacity="0.3" />
              <line x1={w.cx - 2} y1={w.cy + 3} x2={w.cx + 2} y2={w.cy + 3}
                stroke={isDark ? '#1e293b' : '#1e293b'} strokeWidth="0.3" opacity="0.3" />
            </g>
          ))}

          {/* Headlights */}
          <rect x="30" y="5" width="8" height="3" rx="1" ry="1" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.6" />
          <rect x="62" y="5" width="8" height="3" rx="1" ry="1" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.6" />
          {/* Taillights */}
          <rect x="30" y="92" width="8" height="3" rx="1" ry="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.6" />
          <rect x="62" y="92" width="8" height="3" rx="1" ry="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.6" />

          {/* Side mirrors */}
          <ellipse cx="24" cy="26" rx="2" ry="1.5" fill={isDark ? '#334155' : '#94a3b8'} />
          <ellipse cx="76" cy="26" rx="2" ry="1.5" fill={isDark ? '#334155' : '#94a3b8'} />

          {/* Clickable zones */}
          {VEHICLE_ZONES.map(zone => {
            const damage = getDamage(zone.id)
            const isSelected = selectedZone === zone.id
            const hasCondition = !!damage?.condition
            const condColor = getConditionColor(damage?.condition)

            return (
              <g key={zone.id}>
                {/* Clickable area */}
                <rect
                  x={zone.x}
                  y={zone.y}
                  width={zone.width}
                  height={zone.height}
                  rx="1"
                  ry="1"
                  fill={isSelected ? (isDark ? 'rgba(244,63,94,0.2)' : 'rgba(244,63,94,0.15)') : 'transparent'}
                  stroke={
                    isSelected ? '#f43f5e'
                    : hasCondition ? condColor
                    : 'transparent'
                  }
                  strokeWidth={isSelected ? '0.8' : '0.5'}
                  strokeDasharray={isSelected ? '' : hasCondition ? '' : '1 1'}
                  className="cursor-pointer"
                  onClick={() => handleZoneClick(zone.id)}
                  style={{ pointerEvents: 'all' }}
                />
                {/* Damage indicator dot */}
                {hasCondition && (
                  <circle
                    cx={zone.x + zone.width / 2}
                    cy={zone.y + zone.height / 2}
                    r="2"
                    fill={condColor}
                    stroke={isDark ? '#0f172a' : '#fff'}
                    strokeWidth="0.5"
                    className="pointer-events-none"
                  />
                )}
                {/* Photo indicator */}
                {damage && damage.photos.length > 0 && (
                  <circle
                    cx={zone.x + zone.width / 2 + 3}
                    cy={zone.y + zone.height / 2 - 2}
                    r="1.5"
                    fill="#3b82f6"
                    stroke={isDark ? '#0f172a' : '#fff'}
                    strokeWidth="0.3"
                    className="pointer-events-none"
                  />
                )}
              </g>
            )
          })}

          {/* Direction labels */}
          <text x="50" y="1.5" textAnchor="middle" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="2.5" fontWeight="bold">FRENTE</text>
          <text x="50" y="99" textAnchor="middle" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="2.5" fontWeight="bold">TRASEIRA</text>
          <text x="5" y="50" textAnchor="middle" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="2.2" fontWeight="bold" transform="rotate(-90,5,50)">ESQUERDA</text>
          <text x="95" y="50" textAnchor="middle" fill={isDark ? '#64748b' : '#94a3b8'} fontSize="2.2" fontWeight="bold" transform="rotate(90,95,50)">DIREITA</text>
        </svg>

        {/* Legend */}
        <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2 border-t ${borderCls}`}>
          {CONDITIONS.map(c => (
            <div key={c.value} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dotColor }} />
              <span className={`text-[9px] font-medium ${txtMuted}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone inspection panel */}
      {selectedZone && selectedZoneData && !readOnly && (
        <div className={`rounded-2xl border overflow-hidden ${borderCls} ${bg} animate-fadeIn`}>
          {/* Panel header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${borderCls} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: getConditionColor(selectedDamage?.condition) }}
              />
              <span className={`text-sm font-bold truncate ${txt}`}>{selectedZoneData.label}</span>
            </div>
            <button
              onClick={() => setSelectedZone(null)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'}`}
            >
              <X size={14} className={txtMuted} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Condition selector */}
            <div>
              <label className={`block text-[10px] font-semibold mb-1.5 uppercase tracking-wider ${txtMuted}`}>
                Condicao
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CONDITIONS.map(c => {
                  const isActive = selectedDamage?.condition === c.value
                  return (
                    <button
                      key={c.value}
                      onClick={() => setDamage(selectedZone, { condition: c.value })}
                      className={[
                        'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                        isActive
                          ? isDark ? c.selectedDark : c.selectedLight
                          : isDark ? c.bgDark : c.bgLight,
                      ].join(' ')}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className={`block text-[10px] font-semibold mb-1.5 uppercase tracking-wider ${txtMuted}`}>
                Comentario
              </label>
              <input
                type="text"
                placeholder="Descrever avaria..."
                value={selectedDamage?.comment || ''}
                onChange={e => setDamage(selectedZone, { comment: e.target.value })}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${
                  isDark
                    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'
                }`}
              />
            </div>

            {/* Photo section */}
            <div>
              <label className={`block text-[10px] font-semibold mb-1.5 uppercase tracking-wider ${txtMuted}`}>
                Fotos
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedDamage?.photos.map(photo => (
                  <div key={photo.id} className="relative w-16 h-16 rounded-xl overflow-hidden ring-1 ring-black/5">
                    <img src={photo.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(selectedZone, photo.id)}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X size={14} className="text-white drop-shadow" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => cameraRef.current?.click()}
                  className={`w-16 h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                    isDark
                      ? 'border-white/10 text-slate-500 hover:border-rose-500/30 hover:text-rose-400'
                      : 'border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-500'
                  }`}
                >
                  <Camera size={16} />
                  <span className="text-[8px] font-bold">Foto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Read-only damage list */}
      {readOnly && damages.filter(d => d.condition && d.condition !== 'sem_avaria').length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${borderCls} ${bg}`}>
          <div className={`px-4 py-2.5 border-b ${borderCls} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
            <span className={`text-xs font-bold ${txt}`}>Avarias Registradas</span>
          </div>
          <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
            {damages
              .filter(d => d.condition && d.condition !== 'sem_avaria')
              .map(d => {
                const zone = VEHICLE_ZONES.find(z => z.id === d.zone)
                return (
                  <div key={d.zone} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getConditionColor(d.condition) }} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-xs font-semibold ${txt}`}>{zone?.label || d.zone}</span>
                      <span className={`text-[10px] ml-2 ${txtMuted}`}>{getConditionLabel(d.condition)}</span>
                      {d.comment && (
                        <p className={`text-[10px] mt-0.5 ${txtMuted}`}>{d.comment}</p>
                      )}
                    </div>
                    {d.photos.length > 0 && (
                      <span className={`text-[9px] font-bold ${txtMuted}`}>{d.photos.length} foto{d.photos.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Zone list for quick access (collapsed) */}
      {!readOnly && (
        <ZoneQuickList
          damages={damages}
          selectedZone={selectedZone}
          onSelectZone={handleZoneClick}
          isDark={isDark}
        />
      )}
    </div>
  )
}

// -- Zone Quick List (collapsible) --------------------------------------------

function ZoneQuickList({
  damages,
  selectedZone,
  onSelectZone,
  isDark,
}: {
  damages: ZoneDamage[]
  selectedZone: string | null
  onSelectZone: (id: string) => void
  isDark: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const borderCls = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'

  const uninspected = VEHICLE_ZONES.filter(z => !damages.find(d => d.zone === z.id))

  if (uninspected.length === 0 && !expanded) return null

  return (
    <div className={`rounded-2xl border overflow-hidden ${borderCls} ${bg}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-2.5 ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}
      >
        <span className={`text-xs font-semibold ${txtMuted}`}>
          {uninspected.length > 0
            ? `${uninspected.length} zona${uninspected.length > 1 ? 's' : ''} pendente${uninspected.length > 1 ? 's' : ''}`
            : 'Todas as zonas inspecionadas'}
        </span>
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''} ${txtMuted}`} />
      </button>
      {expanded && (
        <div className={`border-t ${borderCls} divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
          {VEHICLE_ZONES.map(zone => {
            const damage = damages.find(d => d.zone === zone.id)
            const isSelected = selectedZone === zone.id
            return (
              <button
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  isSelected
                    ? isDark ? 'bg-rose-500/10' : 'bg-rose-50'
                    : isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                }`}
              >
                {damage?.condition ? (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getConditionColor(damage.condition) }} />
                ) : (
                  <span className={`w-2.5 h-2.5 rounded-full border shrink-0 ${isDark ? 'border-white/20' : 'border-slate-300'}`} />
                )}
                <span className={`text-xs font-medium flex-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {zone.label}
                </span>
                {damage?.condition && (
                  <span className={`text-[9px] font-semibold ${txtMuted}`}>
                    {getConditionLabel(damage.condition)}
                  </span>
                )}
                {damage && damage.photos.length > 0 && (
                  <Camera size={10} className={txtMuted} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -- Utility: export for PDF --------------------------------------------------

export { getConditionColor, getConditionLabel, CONDITIONS }
