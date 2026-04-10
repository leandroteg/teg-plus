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

// -- SVG view renderers (professional silhouettes) ----------------------------

function SvgDefs({ isDark }: { isDark: boolean }) {
  return (
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#334155' : '#e2e8f0'} />
        <stop offset="100%" stopColor={isDark ? '#1e293b' : '#cbd5e1'} />
      </linearGradient>
      <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#1e3a5f' : '#93c5fd'} stopOpacity="0.9" />
        <stop offset="100%" stopColor={isDark ? '#0f2440' : '#bfdbfe'} stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="wheelGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={isDark ? '#475569' : '#374151'} />
        <stop offset="100%" stopColor={isDark ? '#1e293b' : '#1f2937'} />
      </linearGradient>
      <radialGradient id="rimGrad">
        <stop offset="0%" stopColor={isDark ? '#64748b' : '#9ca3af'} />
        <stop offset="100%" stopColor={isDark ? '#334155' : '#6b7280'} />
      </radialGradient>
      <linearGradient id="headlightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#fde68a" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id="taillightGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#fca5a5" stopOpacity="0.5" />
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
        <feDropShadow dx="0" dy="0.5" stdDeviation="0.8" floodColor={isDark ? '#000' : '#64748b'} floodOpacity={isDark ? 0.5 : 0.2} />
      </filter>
    </defs>
  )
}

function SvgWheel({ cx, cy, r = 9 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#wheelGrad)" />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="url(#rimGrad)" />
      <circle cx={cx} cy={cy} r={r * 0.22} fill="url(#wheelGrad)" />
      {/* Spokes */}
      {[0, 72, 144, 216, 288].map(a => {
        const rad = (a * Math.PI) / 180
        const ir = r * 0.28, or = r * 0.58
        return <line key={a} x1={cx + ir * Math.cos(rad)} y1={cy + ir * Math.sin(rad)} x2={cx + or * Math.cos(rad)} y2={cy + or * Math.sin(rad)} stroke="#94a3b8" strokeWidth="0.5" strokeOpacity="0.6" />
      })}
    </g>
  )
}

function SvgLateralEsq({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const detail = isDark ? '#334155' : '#cbd5e1'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Body */}
      <path d="M 7 66 L 7 60 C 7 56 9 54 11 52 L 16 48 L 26 44 L 33 40 C 35 32 38 24 41 19 L 44 16 C 46 14 49 13 53 13 L 70 13 C 74 13 77 14 79 16 L 82 20 C 84 26 86 34 87 40 L 90 44 C 92 46 93 50 93 54 L 93 66" fill="url(#bodyGrad)" stroke={stroke} strokeWidth="0.8" filter="url(#shadow)" strokeLinejoin="round" />
      {/* Roofline highlight */}
      <path d="M 42 18 C 46 14 52 13 56 13 L 68 13 C 72 13 76 14 78 17" fill="none" stroke={isDark ? '#64748b' : '#f1f5f9'} strokeWidth="0.4" opacity="0.6" />
      {/* Windows */}
      <path d="M 39 39 L 43 20 C 44 16 47 15 50 15 L 56 15 L 56 39 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      <path d="M 58 15 L 72 15 C 75 15 77 17 78 20 L 81 39 L 58 39 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      {/* B-pillar */}
      <line x1="57" y1="15" x2="57" y2="52" stroke={stroke} strokeWidth="0.7" />
      {/* Door handle front */}
      <rect x="49" y="43" width="5" height="1.2" rx="0.6" fill={detail} />
      {/* Door handle rear */}
      <rect x="66" y="43" width="5" height="1.2" rx="0.6" fill={detail} />
      {/* Belt line */}
      <path d="M 32 40 L 88 40" fill="none" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      {/* Rocker panel */}
      <path d="M 15 62 L 85 62" fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.4" />
      {/* Wheel arches */}
      <path d="M 14 66 C 14 56 22 52 28 52 C 34 52 40 56 40 66" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={stroke} strokeWidth="0.5" />
      <path d="M 62 66 C 62 56 68 52 75 52 C 82 52 88 56 88 66" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={stroke} strokeWidth="0.5" />
      {/* Wheels */}
      <SvgWheel cx={27} cy={66} r={10} />
      <SvgWheel cx={75} cy={66} r={10} />
      {/* Headlight */}
      <path d="M 8 52 L 12 50 L 14 54 L 14 58 L 8 60 Z" fill="url(#headlightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* Taillight */}
      <path d="M 92 46 L 93 48 L 93 56 L 91 58 L 90 54 Z" fill="url(#taillightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* Mirror */}
      <path d="M 37 36 C 35 35 34 37 35 39 L 39 38 Z" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Front bumper */}
      <path d="M 7 60 C 7 62 8 64 10 64 L 16 64" fill="none" stroke={stroke} strokeWidth="0.5" />
      {/* Rear bumper */}
      <path d="M 86 64 L 93 64 C 94 64 94 62 93 60" fill="none" stroke={stroke} strokeWidth="0.5" />
      {/* Fuel cap */}
      <rect x="83" y="42" width="2" height="2" rx="0.5" fill="none" stroke={detail} strokeWidth="0.3" />
    </>
  )
}

function SvgFrente({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const detail = isDark ? '#334155' : '#cbd5e1'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Body */}
      <path d="M 14 72 L 14 56 C 14 50 16 46 20 42 L 26 36 C 30 28 36 20 42 16 C 44 14 47 13 50 13 C 53 13 56 14 58 16 C 64 20 70 28 74 36 L 80 42 C 84 46 86 50 86 56 L 86 72" fill="url(#bodyGrad)" stroke={stroke} strokeWidth="0.8" filter="url(#shadow)" strokeLinejoin="round" />
      {/* Windshield */}
      <path d="M 28 36 C 32 22 40 18 50 17 C 60 18 68 22 72 36 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      {/* Hood line */}
      <path d="M 22 40 C 36 43 64 43 78 40" fill="none" stroke={stroke} strokeWidth="0.4" />
      {/* Hood crease */}
      <line x1="50" y1="38" x2="50" y2="48" stroke={stroke} strokeWidth="0.2" opacity="0.3" />
      {/* Headlights */}
      <path d="M 14 44 L 14 50 L 28 50 L 30 44 C 28 42 18 42 14 44 Z" fill="url(#headlightGrad)" stroke={stroke} strokeWidth="0.4" />
      <path d="M 86 44 L 86 50 L 72 50 L 70 44 C 72 42 82 42 86 44 Z" fill="url(#headlightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* DRL strips */}
      <path d="M 16 49 L 27 49" stroke="#fbbf24" strokeWidth="0.6" opacity="0.8" strokeLinecap="round" />
      <path d="M 73 49 L 84 49" stroke="#fbbf24" strokeWidth="0.6" opacity="0.8" strokeLinecap="round" />
      {/* Grille */}
      <rect x="30" y="48" width="40" height="8" rx="2" fill={isDark ? '#0f172a' : '#e2e8f0'} stroke={stroke} strokeWidth="0.5" />
      {/* Grille slats */}
      {[34, 40, 46, 52, 58, 64].map(x => <line key={x} x1={x} y1="49" x2={x} y2="55" stroke={stroke} strokeWidth="0.25" opacity="0.5" />)}
      {/* Brand badge */}
      <circle cx="50" cy="52" r="2" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Lower bumper */}
      <path d="M 12 58 C 12 56 14 55 18 55 L 82 55 C 86 55 88 56 88 58 L 88 68 C 88 70 86 72 84 72 L 16 72 C 14 72 12 70 12 68 Z" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.4" />
      {/* Air intake */}
      <rect x="28" y="60" width="44" height="6" rx="2" fill={isDark ? '#020617' : '#e2e8f0'} stroke={stroke} strokeWidth="0.3" />
      {/* Fog lights */}
      <ellipse cx="20" cy="64" rx="4" ry="3" fill={isDark ? '#fbbf24' : '#fef3c7'} opacity="0.4" stroke={stroke} strokeWidth="0.3" />
      <ellipse cx="80" cy="64" rx="4" ry="3" fill={isDark ? '#fbbf24' : '#fef3c7'} opacity="0.4" stroke={stroke} strokeWidth="0.3" />
      {/* Mirrors */}
      <path d="M 10 38 L 8 36 L 8 42 L 12 40 Z" fill={detail} stroke={stroke} strokeWidth="0.3" />
      <path d="M 90 38 L 92 36 L 92 42 L 88 40 Z" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* License plate */}
      <rect x="38" y="62" width="24" height="6" rx="0.5" fill={isDark ? '#1e293b' : '#fff'} stroke={stroke} strokeWidth="0.3" />
    </>
  )
}

function SvgLateralDir({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const detail = isDark ? '#334155' : '#cbd5e1'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Body (mirrored) */}
      <path d="M 93 66 L 93 60 C 93 56 91 54 89 52 L 84 48 L 74 44 L 67 40 C 65 32 62 24 59 19 L 56 16 C 54 14 51 13 47 13 L 30 13 C 26 13 23 14 21 16 L 18 20 C 16 26 14 34 13 40 L 10 44 C 8 46 7 50 7 54 L 7 66" fill="url(#bodyGrad)" stroke={stroke} strokeWidth="0.8" filter="url(#shadow)" strokeLinejoin="round" />
      {/* Roofline */}
      <path d="M 58 18 C 54 14 48 13 44 13 L 32 13 C 28 13 24 14 22 17" fill="none" stroke={isDark ? '#64748b' : '#f1f5f9'} strokeWidth="0.4" opacity="0.6" />
      {/* Windows */}
      <path d="M 61 39 L 57 20 C 56 16 53 15 50 15 L 44 15 L 44 39 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      <path d="M 42 15 L 28 15 C 25 15 23 17 22 20 L 19 39 L 42 39 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      {/* B-pillar */}
      <line x1="43" y1="15" x2="43" y2="52" stroke={stroke} strokeWidth="0.7" />
      {/* Door handles */}
      <rect x="46" y="43" width="5" height="1.2" rx="0.6" fill={detail} />
      <rect x="29" y="43" width="5" height="1.2" rx="0.6" fill={detail} />
      {/* Belt line */}
      <path d="M 68 40 L 12 40" fill="none" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      {/* Rocker panel */}
      <path d="M 85 62 L 15 62" fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.4" />
      {/* Wheel arches */}
      <path d="M 86 66 C 86 56 78 52 72 52 C 66 52 60 56 60 66" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={stroke} strokeWidth="0.5" />
      <path d="M 38 66 C 38 56 32 52 25 52 C 18 52 12 56 12 66" fill={isDark ? '#0f172a' : '#f8fafc'} stroke={stroke} strokeWidth="0.5" />
      {/* Wheels */}
      <SvgWheel cx={73} cy={66} r={10} />
      <SvgWheel cx={25} cy={66} r={10} />
      {/* Taillight */}
      <path d="M 8 46 L 7 48 L 7 56 L 9 58 L 10 54 Z" fill="url(#taillightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* Headlight */}
      <path d="M 92 52 L 88 50 L 86 54 L 86 58 L 92 60 Z" fill="url(#headlightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* Mirror */}
      <path d="M 63 36 C 65 35 66 37 65 39 L 61 38 Z" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Bumpers */}
      <path d="M 93 60 C 93 62 92 64 90 64 L 84 64" fill="none" stroke={stroke} strokeWidth="0.5" />
      <path d="M 14 64 L 7 64 C 6 64 6 62 7 60" fill="none" stroke={stroke} strokeWidth="0.5" />
      {/* Fuel cap */}
      <rect x="15" y="42" width="2" height="2" rx="0.5" fill="none" stroke={detail} strokeWidth="0.3" />
    </>
  )
}

function SvgTraseira({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const detail = isDark ? '#334155' : '#cbd5e1'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Body */}
      <path d="M 14 72 L 14 52 C 14 44 18 38 24 32 L 30 26 C 34 20 40 16 50 16 C 60 16 66 20 70 26 L 76 32 C 82 38 86 44 86 52 L 86 72" fill="url(#bodyGrad)" stroke={stroke} strokeWidth="0.8" filter="url(#shadow)" strokeLinejoin="round" />
      {/* Rear window */}
      <path d="M 28 36 C 34 24 42 20 50 20 C 58 20 66 24 72 36 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.5" />
      {/* Trunk line */}
      <path d="M 22 28 C 36 22 64 22 78 28" fill="none" stroke={stroke} strokeWidth="0.4" />
      {/* Trunk crease */}
      <line x1="50" y1="26" x2="50" y2="38" stroke={stroke} strokeWidth="0.2" opacity="0.3" />
      {/* Taillights */}
      <path d="M 14 42 L 14 54 L 28 52 L 28 44 C 24 42 18 42 14 42 Z" fill="url(#taillightGrad)" stroke={stroke} strokeWidth="0.4" />
      <path d="M 86 42 L 86 54 L 72 52 L 72 44 C 76 42 82 42 86 42 Z" fill="url(#taillightGrad)" stroke={stroke} strokeWidth="0.4" />
      {/* LED strips */}
      <path d="M 16 50 L 26 49" stroke="#ef4444" strokeWidth="0.5" opacity="0.7" strokeLinecap="round" />
      <path d="M 74 49 L 84 50" stroke="#ef4444" strokeWidth="0.5" opacity="0.7" strokeLinecap="round" />
      {/* Connecting bar */}
      <rect x="30" y="46" width="40" height="2" rx="1" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Trunk handle */}
      <rect x="44" y="39" width="12" height="1.5" rx="0.75" fill={detail} stroke={stroke} strokeWidth="0.2" />
      {/* Brand badge */}
      <circle cx="50" cy="43" r="2" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Bumper */}
      <path d="M 12 58 C 12 56 14 55 18 55 L 82 55 C 86 55 88 56 88 58 L 88 68 C 88 70 86 72 84 72 L 16 72 C 14 72 12 70 12 68 Z" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.4" />
      {/* Reflectors */}
      <rect x="18" y="62" width="6" height="3" rx="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.3" />
      <rect x="76" y="62" width="6" height="3" rx="1" fill={isDark ? '#ef4444' : '#fca5a5'} opacity="0.3" />
      {/* Exhaust */}
      <ellipse cx="26" cy="70" rx="3.5" ry="2.5" fill={isDark ? '#020617' : '#d1d5db'} stroke={stroke} strokeWidth="0.3" />
      <ellipse cx="74" cy="70" rx="3.5" ry="2.5" fill={isDark ? '#020617' : '#d1d5db'} stroke={stroke} strokeWidth="0.3" />
      {/* License plate */}
      <rect x="36" y="60" width="28" height="8" rx="1" fill={isDark ? '#1e293b' : '#fff'} stroke={stroke} strokeWidth="0.3" />
      <rect x="38" y="61" width="24" height="6" rx="0.5" fill="none" stroke={stroke} strokeWidth="0.15" />
    </>
  )
}

function SvgTeto({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const detail = isDark ? '#334155' : '#cbd5e1'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Body outline */}
      <path d="M 28 10 C 36 6 64 6 72 10 L 76 14 C 80 20 82 30 82 42 L 82 56 C 82 68 80 78 76 84 L 72 88 C 64 92 36 92 28 88 L 24 84 C 20 78 18 68 18 56 L 18 42 C 18 30 20 20 24 14 Z" fill="url(#bodyGrad)" stroke={stroke} strokeWidth="0.8" filter="url(#shadow)" />
      {/* Windshield area */}
      <path d="M 30 16 C 38 12 62 12 70 16 L 72 20 L 72 26 L 28 26 L 28 20 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.4" opacity="0.7" />
      {/* Rear window */}
      <path d="M 30 82 C 38 86 62 86 70 82 L 72 78 L 72 74 L 28 74 L 28 78 Z" fill="url(#glassGrad)" stroke={stroke} strokeWidth="0.4" opacity="0.7" />
      {/* Roof panel */}
      <rect x="26" y="28" width="48" height="44" rx="8" fill="none" stroke={stroke} strokeWidth="0.3" opacity="0.4" />
      {/* Center ridge */}
      <line x1="50" y1="22" x2="50" y2="78" stroke={stroke} strokeWidth="0.2" opacity="0.3" strokeDasharray="2 2" />
      {/* A-pillar lines */}
      <line x1="28" y1="22" x2="22" y2="34" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      <line x1="72" y1="22" x2="78" y2="34" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      {/* C-pillar lines */}
      <line x1="28" y1="76" x2="22" y2="64" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      <line x1="72" y1="76" x2="78" y2="64" stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      {/* Antenna */}
      <rect x="48" y="8" width="4" height="3" rx="1" fill={detail} stroke={stroke} strokeWidth="0.3" />
      {/* Sunroof */}
      <rect x="36" y="36" width="28" height="22" rx="4" fill={isDark ? '#0f172a' : '#e2e8f0'} stroke={stroke} strokeWidth="0.3" opacity="0.5" />
      {/* Side mirrors */}
      <ellipse cx="16" cy="28" rx="3" ry="2" fill={detail} stroke={stroke} strokeWidth="0.3" />
      <ellipse cx="84" cy="28" rx="3" ry="2" fill={detail} stroke={stroke} strokeWidth="0.3" />
    </>
  )
}

function SvgInterior({ isDark }: { isDark: boolean }) {
  const stroke = isDark ? '#475569' : '#94a3b8'
  const panel = isDark ? '#334155' : '#cbd5e1'
  const seat = isDark ? '#1e293b' : '#e2e8f0'
  const seatStitch = isDark ? '#475569' : '#d1d5db'
  return (
    <>
      <SvgDefs isDark={isDark} />
      {/* Dashboard */}
      <path d="M 8 6 L 92 6 C 93 6 94 7 94 8 L 94 18 C 94 19 93 20 92 20 L 8 20 C 7 20 6 19 6 18 L 6 8 C 6 7 7 6 8 6 Z" fill={panel} stroke={stroke} strokeWidth="0.6" />
      {/* Instrument cluster */}
      <rect x="14" y="8" width="18" height="10" rx="2.5" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.3" />
      <circle cx="20" cy="13" r="3" fill="none" stroke={isDark ? '#22d3ee' : '#06b6d4'} strokeWidth="0.3" opacity="0.5" />
      <circle cx="28" cy="13" r="3" fill="none" stroke={isDark ? '#22d3ee' : '#06b6d4'} strokeWidth="0.3" opacity="0.5" />
      {/* Center screen */}
      <rect x="40" y="8" width="22" height="10" rx="2" fill={isDark ? '#1e3a5f' : '#bfdbfe'} stroke={stroke} strokeWidth="0.3" opacity="0.8" />
      <rect x="42" y="10" width="18" height="6" rx="1" fill={isDark ? '#0f172a' : '#eff6ff'} stroke="none" opacity="0.4" />
      {/* AC vents */}
      <rect x="36" y="10" width="3" height="6" rx="0.5" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.2" />
      <rect x="63" y="10" width="3" height="6" rx="0.5" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.2" />
      {/* Glove box */}
      <rect x="68" y="8" width="22" height="10" rx="2" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.3" />

      {/* Steering wheel */}
      <circle cx="24" cy="32" r="10" fill="none" stroke={stroke} strokeWidth="1" />
      <circle cx="24" cy="32" r="9" fill="none" stroke={stroke} strokeWidth="0.3" opacity="0.3" />
      <ellipse cx="24" cy="32" rx="4.5" ry="3.5" fill={panel} stroke={stroke} strokeWidth="0.4" />
      {/* Spokes */}
      <line x1="24" y1="22" x2="24" y2="27" stroke={stroke} strokeWidth="0.7" strokeLinecap="round" />
      <line x1="14" y1="32" x2="18" y2="32" stroke={stroke} strokeWidth="0.7" strokeLinecap="round" />
      <line x1="30" y1="32" x2="34" y2="32" stroke={stroke} strokeWidth="0.7" strokeLinecap="round" />
      <line x1="18" y1="38" x2="21" y2="36" stroke={stroke} strokeWidth="0.5" strokeLinecap="round" />
      <line x1="30" y1="38" x2="27" y2="36" stroke={stroke} strokeWidth="0.5" strokeLinecap="round" />

      {/* Console central */}
      <rect x="38" y="22" width="24" height="44" rx="4" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.5" />
      {/* Climate controls */}
      <circle cx="44" cy="28" r="2" fill={panel} stroke={stroke} strokeWidth="0.3" />
      <circle cx="50" cy="28" r="2" fill={panel} stroke={stroke} strokeWidth="0.3" />
      <circle cx="56" cy="28" r="2" fill={panel} stroke={stroke} strokeWidth="0.3" />
      {/* Gear */}
      <rect x="44" y="34" width="12" height="14" rx="3" fill={panel} stroke={stroke} strokeWidth="0.4" />
      <circle cx="50" cy="40" r="2.5" fill={isDark ? '#64748b' : '#94a3b8'} stroke={stroke} strokeWidth="0.3" />
      {/* Cup holders */}
      <circle cx="44" cy="56" r="3.5" fill={isDark ? '#020617' : '#e5e7eb'} stroke={stroke} strokeWidth="0.2" />
      <circle cx="56" cy="56" r="3.5" fill={isDark ? '#020617' : '#e5e7eb'} stroke={stroke} strokeWidth="0.2" />
      {/* Armrest */}
      <rect x="42" y="62" width="16" height="4" rx="2" fill={panel} stroke={stroke} strokeWidth="0.3" />

      {/* Driver seat */}
      <rect x="8" y="46" width="26" height="20" rx="5" fill={seat} stroke={stroke} strokeWidth="0.6" />
      <path d="M 12 46 C 18 42 28 42 34 46" fill="none" stroke={seatStitch} strokeWidth="0.3" />
      <path d="M 12 52 L 32 52" fill="none" stroke={seatStitch} strokeWidth="0.2" opacity="0.4" />
      <path d="M 12 58 L 32 58" fill="none" stroke={seatStitch} strokeWidth="0.2" opacity="0.4" />

      {/* Passenger seat */}
      <rect x="66" y="46" width="26" height="20" rx="5" fill={seat} stroke={stroke} strokeWidth="0.6" />
      <path d="M 68 46 C 74 42 84 42 92 46" fill="none" stroke={seatStitch} strokeWidth="0.3" />
      <path d="M 68 52 L 90 52" fill="none" stroke={seatStitch} strokeWidth="0.2" opacity="0.4" />
      <path d="M 68 58 L 90 58" fill="none" stroke={seatStitch} strokeWidth="0.2" opacity="0.4" />

      {/* Rear bench */}
      <rect x="12" y="74" width="76" height="14" rx="5" fill={seat} stroke={stroke} strokeWidth="0.6" />
      <line x1="50" y1="74" x2="50" y2="88" stroke={seatStitch} strokeWidth="0.3" opacity="0.5" />
      <path d="M 14 80 L 86 80" fill="none" stroke={seatStitch} strokeWidth="0.2" opacity="0.3" />

      {/* Floor mats */}
      <rect x="10" y="92" width="80" height="5" rx="2" fill={isDark ? '#0f172a' : '#f1f5f9'} stroke={stroke} strokeWidth="0.3" opacity="0.4" />
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
