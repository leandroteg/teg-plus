// ---------------------------------------------------------------------------
// VehicleDiagramInspection.tsx -- Multi-angle vehicle inspection diagram
// Shows 6 views (left, front, right, rear, roof, interior) with clean
// SVG illustrations and clickable zones for damage marking.
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from 'react'
import {
  X, Camera, ChevronDown,
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

// -- Zone definitions per view ------------------------------------------------

export interface VehicleZone {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
}

type ViewKey = 'lateral_esq' | 'frente' | 'lateral_dir' | 'traseira' | 'teto' | 'interior'

interface ViewDef {
  key: ViewKey
  label: string
  zones: VehicleZone[]
}

const VIEW_DEFS: ViewDef[] = [
  {
    key: 'lateral_esq',
    label: 'Lateral E',
    zones: [
      { id: 'parachoque_diant', label: 'Para-choque Dianteiro', x: 5, y: 55, width: 15, height: 20 },
      { id: 'capo',             label: 'Capo',                  x: 20, y: 38, width: 15, height: 20 },
      { id: 'parabrisa',        label: 'Para-brisa',            x: 35, y: 15, width: 12, height: 30 },
      { id: 'porta_diant_esq',  label: 'Porta Diant. Esq.',     x: 47, y: 28, width: 14, height: 30 },
      { id: 'porta_tras_esq',   label: 'Porta Tras. Esq.',      x: 61, y: 28, width: 14, height: 30 },
      { id: 'vidro_lat_esq',    label: 'Vidro Lateral Esq.',     x: 47, y: 15, width: 28, height: 13 },
      { id: 'coluna_esq',       label: 'Coluna Esq.',            x: 45, y: 12, width: 4, height: 48 },
      { id: 'lateral_esq',      label: 'Lateral/Saia Esq.',      x: 35, y: 58, width: 40, height: 10 },
      { id: 'parachoque_tras',  label: 'Para-choque Traseiro',   x: 80, y: 48, width: 15, height: 22 },
      { id: 'roda_de',          label: 'Roda Dianteira',          x: 18, y: 62, width: 16, height: 16 },
      { id: 'roda_te',          label: 'Roda Traseira',           x: 66, y: 62, width: 16, height: 16 },
    ],
  },
  {
    key: 'frente',
    label: 'Frente',
    zones: [
      { id: 'capo',             label: 'Capo',                   x: 20, y: 5, width: 60, height: 20 },
      { id: 'parabrisa',        label: 'Para-brisa',             x: 22, y: 25, width: 56, height: 15 },
      { id: 'farol_esq',        label: 'Farol Esquerdo',         x: 10, y: 40, width: 18, height: 12 },
      { id: 'farol_dir',        label: 'Farol Direito',          x: 72, y: 40, width: 18, height: 12 },
      { id: 'grade',            label: 'Grade',                  x: 28, y: 42, width: 44, height: 10 },
      { id: 'parachoque_diant', label: 'Para-choque Dianteiro',  x: 8, y: 55, width: 84, height: 16 },
    ],
  },
  {
    key: 'lateral_dir',
    label: 'Lateral D',
    zones: [
      { id: 'parachoque_diant_d', label: 'Para-choque Dianteiro', x: 80, y: 55, width: 15, height: 20 },
      { id: 'capo_d',             label: 'Capo',                  x: 65, y: 38, width: 15, height: 20 },
      { id: 'parabrisa_d',        label: 'Para-brisa',            x: 53, y: 15, width: 12, height: 30 },
      { id: 'porta_diant_dir',    label: 'Porta Diant. Dir.',     x: 39, y: 28, width: 14, height: 30 },
      { id: 'porta_tras_dir',     label: 'Porta Tras. Dir.',      x: 25, y: 28, width: 14, height: 30 },
      { id: 'vidro_lat_dir',      label: 'Vidro Lateral Dir.',    x: 25, y: 15, width: 28, height: 13 },
      { id: 'coluna_dir',         label: 'Coluna Dir.',           x: 51, y: 12, width: 4, height: 48 },
      { id: 'lateral_dir',        label: 'Lateral/Saia Dir.',     x: 25, y: 58, width: 40, height: 10 },
      { id: 'parachoque_tras_d',  label: 'Para-choque Traseiro',  x: 5, y: 48, width: 15, height: 22 },
      { id: 'roda_dd',            label: 'Roda Dianteira',        x: 66, y: 62, width: 16, height: 16 },
      { id: 'roda_td',            label: 'Roda Traseira',         x: 18, y: 62, width: 16, height: 16 },
    ],
  },
  {
    key: 'traseira',
    label: 'Traseira',
    zones: [
      { id: 'tampa_traseira',     label: 'Tampa Traseira',        x: 20, y: 5, width: 60, height: 22 },
      { id: 'vidro_traseiro',     label: 'Vidro Traseiro',        x: 22, y: 27, width: 56, height: 13 },
      { id: 'lanterna_esq',      label: 'Lanterna Esq.',         x: 10, y: 40, width: 18, height: 14 },
      { id: 'lanterna_dir',      label: 'Lanterna Dir.',         x: 72, y: 40, width: 18, height: 14 },
      { id: 'parachoque_tras',   label: 'Para-choque Traseiro',  x: 8, y: 58, width: 84, height: 16 },
    ],
  },
  {
    key: 'teto',
    label: 'Teto',
    zones: [
      { id: 'teto',              label: 'Teto',                  x: 15, y: 10, width: 70, height: 65 },
      { id: 'antena',            label: 'Antena',                x: 44, y: 5, width: 12, height: 10 },
      { id: 'rack_bagageiro',    label: 'Rack/Bagageiro',        x: 20, y: 25, width: 60, height: 40 },
    ],
  },
  {
    key: 'interior',
    label: 'Interior',
    zones: [
      { id: 'painel',            label: 'Painel',                x: 10, y: 5, width: 80, height: 16 },
      { id: 'volante',           label: 'Volante',               x: 15, y: 22, width: 20, height: 20 },
      { id: 'banco_motorista',   label: 'Banco Motorista',       x: 10, y: 44, width: 25, height: 22 },
      { id: 'banco_passageiro',  label: 'Banco Passageiro',      x: 65, y: 44, width: 25, height: 22 },
      { id: 'banco_traseiro',    label: 'Banco Traseiro',        x: 15, y: 70, width: 70, height: 18 },
      { id: 'console_central',   label: 'Console Central',       x: 38, y: 22, width: 24, height: 44 },
      { id: 'forro_teto',        label: 'Forro Teto',            x: 10, y: 90, width: 80, height: 8 },
    ],
  },
]

// Flat list of all zones for external consumers (e.g. ChecklistDivergenciasModal)
export const VEHICLE_ZONES: VehicleZone[] = (() => {
  const seen = new Set<string>()
  const result: VehicleZone[] = []
  for (const view of VIEW_DEFS) {
    for (const zone of view.zones) {
      if (!seen.has(zone.id)) {
        seen.add(zone.id)
        result.push(zone)
      }
    }
  }
  return result
})()

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

// -- SVG view renderers -------------------------------------------------------

function SvgLateralEsq({ isDark }: { isDark: boolean }) {
  const body = isDark ? '#1e293b' : '#e2e8f0'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  const glass = isDark ? '#1e3a5f' : '#bfdbfe'
  const wheel = isDark ? '#334155' : '#475569'
  return (
    <>
      {/* Body silhouette */}
      <path
        d="M 12 68 L 12 58 Q 12 52 18 50 L 32 42 Q 36 26 40 18 L 45 14
           Q 48 12 55 12 L 75 14 Q 82 16 84 24 L 88 40 Q 92 44 92 52
           L 92 68"
        fill={body} stroke={stroke} strokeWidth="1.2"
      />
      {/* Windows */}
      <path
        d="M 40 38 L 44 18 Q 46 14 52 14 L 58 14 L 58 38 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      <path
        d="M 60 14 L 74 14 Q 78 15 80 24 L 82 38 L 60 38 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      {/* Door line */}
      <line x1="59" y1="14" x2="59" y2="58" stroke={stroke} strokeWidth="0.6" />
      {/* Wheels */}
      <ellipse cx="26" cy="70" rx="10" ry="10" fill={wheel} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="26" cy="70" rx="5" ry="5" fill={isDark ? '#1e293b' : '#cbd5e1'} />
      <ellipse cx="74" cy="70" rx="10" ry="10" fill={wheel} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="74" cy="70" rx="5" ry="5" fill={isDark ? '#1e293b' : '#cbd5e1'} />
      {/* Bumper details */}
      <line x1="8" y1="62" x2="14" y2="62" stroke={stroke} strokeWidth="0.8" />
      <line x1="86" y1="55" x2="94" y2="55" stroke={stroke} strokeWidth="0.8" />
      {/* Headlight */}
      <rect x="6" y="54" width="6" height="6" rx="1" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.7" />
      {/* Taillight */}
      <rect x="90" y="46" width="4" height="8" rx="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.7" />
      {/* Side mirror */}
      <ellipse cx="38" cy="36" rx="3" ry="2" fill={stroke} />
    </>
  )
}

function SvgFrente({ isDark }: { isDark: boolean }) {
  const body = isDark ? '#1e293b' : '#e2e8f0'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  const glass = isDark ? '#1e3a5f' : '#bfdbfe'
  return (
    <>
      {/* Body outline */}
      <path
        d="M 16 72 L 16 52 Q 16 46 20 42 L 24 38 Q 30 28 34 20
           Q 38 14 50 14 Q 62 14 66 20 L 76 38 Q 80 42 84 46
           Q 88 50 88 56 L 88 72"
        fill={body} stroke={stroke} strokeWidth="1.2"
      />
      {/* Windshield */}
      <path
        d="M 30 36 Q 34 20 50 18 Q 66 20 70 36 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      {/* Hood line */}
      <path d="M 24 38 Q 50 42 76 38" fill="none" stroke={stroke} strokeWidth="0.5" />
      {/* Headlights */}
      <rect x="14" y="44" width="14" height="8" rx="3" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.7" />
      <rect x="72" y="44" width="14" height="8" rx="3" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.7" />
      {/* Grille */}
      <rect x="32" y="46" width="36" height="8" rx="2" fill={isDark ? '#0f172a' : '#cbd5e1'} stroke={stroke} strokeWidth="0.5" />
      <line x1="40" y1="46" x2="40" y2="54" stroke={stroke} strokeWidth="0.3" />
      <line x1="50" y1="46" x2="50" y2="54" stroke={stroke} strokeWidth="0.3" />
      <line x1="60" y1="46" x2="60" y2="54" stroke={stroke} strokeWidth="0.3" />
      {/* Bumper */}
      <rect x="12" y="58" width="76" height="12" rx="4" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.5" />
      {/* Fog lights */}
      <circle cx="22" cy="64" r="3" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.4" />
      <circle cx="78" cy="64" r="3" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.4" />
      {/* Mirrors */}
      <rect x="10" y="38" width="6" height="4" rx="1" fill={stroke} />
      <rect x="84" y="38" width="6" height="4" rx="1" fill={stroke} />
    </>
  )
}

function SvgLateralDir({ isDark }: { isDark: boolean }) {
  const body = isDark ? '#1e293b' : '#e2e8f0'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  const glass = isDark ? '#1e3a5f' : '#bfdbfe'
  const wheel = isDark ? '#334155' : '#475569'
  return (
    <>
      {/* Body silhouette (mirrored) */}
      <path
        d="M 88 68 L 88 58 Q 88 52 82 50 L 68 42 Q 64 26 60 18 L 55 14
           Q 52 12 45 12 L 25 14 Q 18 16 16 24 L 12 40 Q 8 44 8 52
           L 8 68"
        fill={body} stroke={stroke} strokeWidth="1.2"
      />
      {/* Windows */}
      <path
        d="M 60 38 L 56 18 Q 54 14 48 14 L 42 14 L 42 38 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      <path
        d="M 40 14 L 26 14 Q 22 15 20 24 L 18 38 L 40 38 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      {/* Door line */}
      <line x1="41" y1="14" x2="41" y2="58" stroke={stroke} strokeWidth="0.6" />
      {/* Wheels */}
      <ellipse cx="74" cy="70" rx="10" ry="10" fill={wheel} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="74" cy="70" rx="5" ry="5" fill={isDark ? '#1e293b' : '#cbd5e1'} />
      <ellipse cx="26" cy="70" rx="10" ry="10" fill={wheel} stroke={stroke} strokeWidth="0.8" />
      <ellipse cx="26" cy="70" rx="5" ry="5" fill={isDark ? '#1e293b' : '#cbd5e1'} />
      {/* Bumper details */}
      <line x1="92" y1="62" x2="86" y2="62" stroke={stroke} strokeWidth="0.8" />
      <line x1="14" y1="55" x2="6" y2="55" stroke={stroke} strokeWidth="0.8" />
      {/* Headlight */}
      <rect x="88" y="54" width="6" height="6" rx="1" fill={isDark ? '#fbbf24' : '#fde68a'} opacity="0.7" />
      {/* Taillight */}
      <rect x="6" y="46" width="4" height="8" rx="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.7" />
      {/* Side mirror */}
      <ellipse cx="62" cy="36" rx="3" ry="2" fill={stroke} />
    </>
  )
}

function SvgTraseira({ isDark }: { isDark: boolean }) {
  const body = isDark ? '#1e293b' : '#e2e8f0'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  const glass = isDark ? '#1e3a5f' : '#bfdbfe'
  return (
    <>
      {/* Body outline */}
      <path
        d="M 16 72 L 16 50 Q 16 40 22 34 L 28 28
           Q 34 16 50 16 Q 66 16 72 28 L 78 34
           Q 84 40 84 50 L 84 72"
        fill={body} stroke={stroke} strokeWidth="1.2"
      />
      {/* Rear window */}
      <path
        d="M 28 38 Q 36 24 50 22 Q 64 24 72 38 Z"
        fill={glass} stroke={stroke} strokeWidth="0.6" opacity="0.6"
      />
      {/* Trunk line */}
      <path d="M 22 26 Q 50 20 78 26" fill="none" stroke={stroke} strokeWidth="0.5" />
      {/* Taillights */}
      <rect x="14" y="44" width="14" height="10" rx="3" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.7" />
      <rect x="72" y="44" width="14" height="10" rx="3" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.7" />
      {/* Trunk handle */}
      <rect x="42" y="40" width="16" height="2" rx="1" fill={stroke} />
      {/* Bumper */}
      <rect x="12" y="60" width="76" height="12" rx="4" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.5" />
      {/* Exhaust pipes */}
      <circle cx="24" cy="70" r="3" fill={isDark ? '#0f172a' : '#cbd5e1'} stroke={stroke} strokeWidth="0.4" />
      <circle cx="76" cy="70" r="3" fill={isDark ? '#0f172a' : '#cbd5e1'} stroke={stroke} strokeWidth="0.4" />
      {/* License plate area */}
      <rect x="36" y="62" width="28" height="8" rx="1" fill={isDark ? '#0f172a' : '#fff'} stroke={stroke} strokeWidth="0.4" />
    </>
  )
}

function SvgTeto({ isDark }: { isDark: boolean }) {
  const body = isDark ? '#1e293b' : '#e2e8f0'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  return (
    <>
      {/* Roof outline (top-down) */}
      <rect x="20" y="10" width="60" height="78" rx="14" fill={body} stroke={stroke} strokeWidth="1.2" />
      {/* Roof panel lines */}
      <rect x="28" y="24" width="44" height="48" rx="6" fill="none" stroke={stroke} strokeWidth="0.4" strokeDasharray="2 2" />
      {/* Center ridge */}
      <line x1="50" y1="18" x2="50" y2="82" stroke={stroke} strokeWidth="0.3" strokeDasharray="1.5 1.5" />
      {/* Antenna area */}
      <circle cx="50" cy="12" r="3" fill={isDark ? '#475569' : '#94a3b8'} stroke={stroke} strokeWidth="0.5" />
      <line x1="50" y1="9" x2="50" y2="5" stroke={stroke} strokeWidth="0.8" />
      {/* Rack rails */}
      <line x1="26" y1="30" x2="26" y2="62" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      <line x1="74" y1="30" x2="74" y2="62" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
      {/* Cross bars */}
      <line x1="26" y1="38" x2="74" y2="38" stroke={stroke} strokeWidth="0.6" />
      <line x1="26" y1="54" x2="74" y2="54" stroke={stroke} strokeWidth="0.6" />
      {/* Windshield area markers */}
      <path d="M 26 18 Q 50 12 74 18" fill="none" stroke={stroke} strokeWidth="0.5" />
      <path d="M 26 80 Q 50 86 74 80" fill="none" stroke={stroke} strokeWidth="0.5" />
    </>
  )
}

function SvgInterior({ isDark }: { isDark: boolean }) {
  const panel = isDark ? '#334155' : '#cbd5e1'
  const stroke = isDark ? '#64748b' : '#94a3b8'
  const seat = isDark ? '#1e293b' : '#e2e8f0'
  return (
    <>
      {/* Dashboard */}
      <rect x="10" y="6" width="80" height="14" rx="3" fill={panel} stroke={stroke} strokeWidth="0.8" />
      {/* Instrument cluster */}
      <rect x="18" y="8" width="16" height="10" rx="2" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.4" />
      {/* Center screen */}
      <rect x="42" y="8" width="20" height="10" rx="2" fill={isDark ? '#1e3a5f' : '#bfdbfe'} stroke={stroke} strokeWidth="0.4" opacity="0.6" />
      {/* Glove box */}
      <rect x="66" y="8" width="18" height="10" rx="2" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.4" />

      {/* Steering wheel */}
      <circle cx="25" cy="32" r="10" fill="none" stroke={stroke} strokeWidth="1.2" />
      <circle cx="25" cy="32" r="4" fill={panel} stroke={stroke} strokeWidth="0.5" />
      {/* Spokes */}
      <line x1="25" y1="22" x2="25" y2="26" stroke={stroke} strokeWidth="0.8" />
      <line x1="15" y1="32" x2="19" y2="32" stroke={stroke} strokeWidth="0.8" />
      <line x1="31" y1="32" x2="35" y2="32" stroke={stroke} strokeWidth="0.8" />

      {/* Console central */}
      <rect x="38" y="22" width="24" height="42" rx="3" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.6" />
      {/* Gear shifter */}
      <rect x="46" y="36" width="8" height="12" rx="2" fill={panel} stroke={stroke} strokeWidth="0.4" />
      {/* Cup holders */}
      <circle cx="44" cy="56" r="3" fill={isDark ? '#0f172a' : '#fff'} stroke={stroke} strokeWidth="0.3" />
      <circle cx="56" cy="56" r="3" fill={isDark ? '#0f172a' : '#fff'} stroke={stroke} strokeWidth="0.3" />

      {/* Driver seat */}
      <rect x="10" y="46" width="24" height="18" rx="4" fill={seat} stroke={stroke} strokeWidth="0.8" />
      <path d="M 12 46 Q 22 42 32 46" fill="none" stroke={stroke} strokeWidth="0.4" />

      {/* Passenger seat */}
      <rect x="66" y="46" width="24" height="18" rx="4" fill={seat} stroke={stroke} strokeWidth="0.8" />
      <path d="M 68 46 Q 78 42 88 46" fill="none" stroke={stroke} strokeWidth="0.4" />

      {/* Rear bench seat */}
      <rect x="14" y="72" width="72" height="14" rx="4" fill={seat} stroke={stroke} strokeWidth="0.8" />
      <line x1="50" y1="72" x2="50" y2="86" stroke={stroke} strokeWidth="0.3" strokeDasharray="1 1" />

      {/* Headliner line */}
      <rect x="10" y="90" width="80" height="6" rx="2" fill={panel} stroke={stroke} strokeWidth="0.4" opacity="0.5" />
    </>
  )
}

const SVG_RENDERERS: Record<ViewKey, React.FC<{ isDark: boolean }>> = {
  lateral_esq: SvgLateralEsq,
  frente: SvgFrente,
  lateral_dir: SvgLateralDir,
  traseira: SvgTraseira,
  teto: SvgTeto,
  interior: SvgInterior,
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
  const [activeView, setActiveView] = useState<ViewKey>('lateral_esq')
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const currentViewDef = VIEW_DEFS.find(v => v.key === activeView)!
  const currentZones = currentViewDef.zones

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

  const selectedZoneData = selectedZone
    ? currentZones.find(z => z.id === selectedZone) || VEHICLE_ZONES.find(z => z.id === selectedZone)
    : null
  const selectedDamage = selectedZone ? getDamage(selectedZone) : null

  const allZones = VEHICLE_ZONES
  const totalZones = allZones.length
  const inspectedZones = damages.filter(d => d.condition).length
  const issueZones = damages.filter(
    d => d.condition && d.condition !== 'sem_avaria',
  ).length

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const borderCls = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const SvgRenderer = SVG_RENDERERS[activeView]

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

      {/* View tabs */}
      <div className={`rounded-2xl border overflow-hidden ${borderCls} ${bg}`}>
        <div className={`flex overflow-x-auto gap-1 px-2 py-2 border-b ${borderCls} scrollbar-hide`}>
          {VIEW_DEFS.map(view => {
            const isActive = activeView === view.key
            const viewDamageCount = view.zones.filter(z => {
              const d = getDamage(z.id)
              return d?.condition && d.condition !== 'sem_avaria'
            }).length
            return (
              <button
                key={view.key}
                onClick={() => {
                  setActiveView(view.key)
                  setSelectedZone(null)
                }}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                  isActive
                    ? 'bg-rose-500 text-white shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-300'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
                ].join(' ')}
              >
                {view.label}
                {viewDamageCount > 0 && (
                  <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                    isActive ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'
                  }`}>
                    {viewDamageCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* SVG diagram */}
        <div className="relative">
          <svg
            viewBox="0 0 100 100"
            className="w-full"
            style={{ maxHeight: '340px' }}
          >
            {/* Background */}
            <rect x="0" y="0" width="100" height="100" fill={isDark ? '#0f172a' : '#f8fafc'} />

            {/* Vehicle illustration */}
            <SvgRenderer isDark={isDark} />

            {/* Clickable zones */}
            {currentZones.map(zone => {
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
                    rx="1.5"
                    ry="1.5"
                    fill={
                      hasCondition && damage?.condition !== 'sem_avaria'
                        ? condColor + '22'
                        : isSelected
                          ? (isDark ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.1)')
                          : 'transparent'
                    }
                    stroke={
                      isSelected ? '#f43f5e'
                      : hasCondition ? condColor
                      : isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.3)'
                    }
                    strokeWidth={isSelected ? '1' : '0.5'}
                    strokeDasharray={isSelected || hasCondition ? '' : '1.5 1'}
                    className="cursor-pointer"
                    onClick={() => handleZoneClick(zone.id)}
                    style={{ pointerEvents: 'all' }}
                  />
                  {/* Zone label (small) */}
                  <text
                    x={zone.x + zone.width / 2}
                    y={zone.y + zone.height / 2 + (hasCondition ? -1.5 : 0.8)}
                    textAnchor="middle"
                    fill={isSelected ? '#f43f5e' : isDark ? '#94a3b8' : '#64748b'}
                    fontSize={zone.width < 16 ? '2' : '2.5'}
                    fontWeight="600"
                    className="pointer-events-none select-none"
                    opacity="0.8"
                  >
                    {zone.label.length > 14 ? zone.label.slice(0, 12) + '..' : zone.label}
                  </text>
                  {/* Damage indicator dot */}
                  {hasCondition && (
                    <circle
                      cx={zone.x + zone.width / 2}
                      cy={zone.y + zone.height / 2 + 2}
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
                      cy={zone.y + zone.height / 2 + 0.5}
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
          </svg>
        </div>

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
                        'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all min-h-[44px] min-w-[44px]',
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
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors min-h-[44px] ${
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
                  className={`w-16 h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] ${
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
          activeView={activeView}
          onViewChange={(v) => { setActiveView(v); setSelectedZone(null) }}
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
  activeView,
  onViewChange,
}: {
  damages: ZoneDamage[]
  selectedZone: string | null
  onSelectZone: (id: string) => void
  isDark: boolean
  activeView: ViewKey
  onViewChange: (v: ViewKey) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const borderCls = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'

  const allZones = VEHICLE_ZONES
  const uninspected = allZones.filter(z => !damages.find(d => d.zone === z.id))

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
        <div className={`border-t ${borderCls}`}>
          {VIEW_DEFS.map(view => (
            <div key={view.key}>
              <div className={`px-4 py-1.5 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>
                  {view.label}
                </span>
              </div>
              <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                {view.zones.map(zone => {
                  const damage = damages.find(d => d.zone === zone.id)
                  const isSelected = selectedZone === zone.id && activeView === view.key
                  return (
                    <button
                      key={`${view.key}-${zone.id}`}
                      onClick={() => {
                        if (activeView !== view.key) onViewChange(view.key)
                        onSelectZone(zone.id)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors min-h-[44px] ${
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Utility: export for PDF --------------------------------------------------

export { getConditionColor, getConditionLabel, CONDITIONS }
