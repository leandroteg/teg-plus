// ─────────────────────────────────────────────────────────────────────────────
// components/MuralSidebar.tsx — Mural de Recados (desktop sidebar)
// Vertical banner slideshow for the right column of the split layout
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Megaphone, Pin, Calendar, Newspaper,
} from 'lucide-react'
import { useBanners, type MuralBanner } from '../hooks/useMural'
import { useTheme } from '../contexts/ThemeContext'

// ── Config ──────────────────────────────────────────────────────────────────
const SLIDE_DURATION = 6000

// ── Default slides ──────────────────────────────────────────────────────────
const DEFAULTS: MuralBanner[] = [
  {
    id: '__d1',
    titulo: 'Bem-vindo ao TEG+ ERP',
    subtitulo: 'Sistema integrado para gestão de obras de engenharia elétrica e transmissão de energia',
    imagem_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
    tipo: 'fixa', ativo: true, ordem: 0,
    created_at: '', updated_at: '',
  },
  {
    id: '__d2',
    titulo: 'Módulos Disponíveis',
    subtitulo: 'Compras · Financeiro · Estoque · Logística · Frotas — todos operacionais',
    imagem_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    tipo: 'fixa', ativo: true, ordem: 1,
    created_at: '', updated_at: '',
  },
  {
    id: '__d3',
    titulo: 'Segurança em Primeiro Lugar',
    subtitulo: 'Checklists de frota e registros de SSMA sempre atualizados',
    imagem_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
    tipo: 'fixa', ativo: true, ordem: 2,
    created_at: '', updated_at: '',
  },
]

// ── Type badge ──────────────────────────────────────────────────────────────
function TypeBadge({ banner }: { banner: MuralBanner }) {
  if (banner.tipo === 'campanha') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full
        bg-black/55 backdrop-blur-md border border-white/15
        text-[9px] font-semibold">
        <Calendar size={9} className="text-rose-400 shrink-0" />
        <span className="text-white/90">Campanha</span>
        {banner.data_fim && (
          <span className="text-white/45 border-l border-white/20 pl-1.5 ml-0.5">
            até {new Date(banner.data_fim + 'T12:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'short',
            })}
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full
      bg-black/55 backdrop-blur-md border border-white/15
      text-[9px] font-semibold">
      <Pin size={8} className="text-teal-400 shrink-0" />
      <span className="text-white/90">Comunicado</span>
    </div>
  )
}

// ── Dots indicator ──────────────────────────────────────────────────────────
function Dots({ total, current, onSelect }: {
  total: number; current: number; onSelect: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          aria-label={`Slide ${i + 1}`}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-5 h-1.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]'
              : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MuralSidebar() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: fetched = [] } = useBanners()
  const slides = fetched.length > 0 ? fetched : DEFAULTS

  const [current, setCurrent] = useState(0)
  const [paused, setPaused]   = useState(false)
  const touchStartY           = useRef(0)

  const goNext = useCallback(
    () => setCurrent(c => (c + 1) % slides.length),
    [slides.length],
  )
  const goPrev = useCallback(
    () => setCurrent(c => ((c - 1) + slides.length) % slides.length),
    [slides.length],
  )

  // Reset on slide list change
  useEffect(() => { setCurrent(0) }, [slides.length])

  // Auto-advance
  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(goNext, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [paused, slides.length, goNext])

  return (
    <aside className="flex flex-col h-full py-2">
      {/* ── Sidebar header ──────────────────────────────────────── */}
      <div className="px-1 mb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isLight
              ? 'bg-teal-50 border border-teal-100'
              : 'bg-teal-500/10 border border-teal-500/20'
          }`}>
            <Newspaper size={15} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
          </div>
          <div>
            <h2 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
              Mural de Recados
            </h2>
            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Comunicados e avisos internos
            </p>
          </div>
        </div>
      </div>

      {/* ── Banner card slideshow ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className={`relative flex-1 rounded-2xl overflow-hidden select-none ring-1 ${
            isLight ? 'ring-slate-200/80' : 'ring-white/[0.07]'
          }`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => {
            const diff = touchStartY.current - e.changedTouches[0].clientY
            if (Math.abs(diff) > 48) diff > 0 ? goNext() : goPrev()
          }}
        >
          {/* ── Slide stack ──────────────────────────────────── */}
          {slides.map((slide, i) => {
            const isActive = i === current
            return (
              <div
                key={slide.id}
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 1 }}
                aria-hidden={!isActive}
              >
                {/* Image */}
                <img
                  src={slide.imagem_url}
                  alt={slide.titulo}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    animation: 'kenBurns 14s ease-in-out infinite alternate',
                    animationPlayState: isActive ? 'running' : 'paused',
                    transformOrigin: '55% 45%',
                  }}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />

                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/5" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, rgba(0,0,0,0.3) 100%)',
                  }}
                />

                {/* Type badge — top right */}
                <div className="absolute top-3 right-3 z-20">
                  <TypeBadge banner={slide} />
                </div>

                {/* Text content — bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-4 z-10"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity 0.6s 0.15s ease, transform 0.6s 0.15s ease',
                  }}
                >
                  {/* Eyebrow */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Megaphone size={8} className="text-teal-400/80" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-teal-400/70">
                      TEG+ Comunicados
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-base font-black text-white leading-tight"
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                  >
                    {slide.titulo}
                  </h3>

                  {/* Subtitle */}
                  {slide.subtitulo && (
                    <p className="text-[11px] text-white/55 mt-1 leading-relaxed line-clamp-2">
                      {slide.subtitulo}
                    </p>
                  )}

                  {/* Controls */}
                  {slides.length > 1 && (
                    <div className="flex items-center gap-2.5 mt-3">
                      <Dots total={slides.length} current={current} onSelect={setCurrent} />
                      <span className="text-[9px] text-white/25 font-medium tabular-nums">
                        {current + 1}/{slides.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {slides.length > 1 && isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/8 z-20">
                    <div
                      key={`${current}-${paused ? 'p' : 'r'}`}
                      className="h-full bg-gradient-to-r from-teal-400 via-cyan-300 to-teal-400"
                      style={{
                        animation: paused
                          ? 'none'
                          : `slideProgress ${SLIDE_DURATION}ms linear forwards`,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Navigation arrows (visible on hover) */}
          {slides.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className={[
                  'absolute top-3 left-3 z-30',
                  'flex w-7 h-7 items-center justify-center',
                  'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                  'text-white transition-all duration-300',
                  'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                  paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
                ].join(' ')}
                aria-label="Anterior"
              >
                <ChevronUp size={14} strokeWidth={2.5} />
              </button>

              <button
                onClick={goNext}
                className={[
                  'absolute bottom-10 left-3 z-30',
                  'flex w-7 h-7 items-center justify-center',
                  'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                  'text-white transition-all duration-300',
                  'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                  paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
                ].join(' ')}
                aria-label="Próximo"
              >
                <ChevronDown size={14} strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Paused indicator */}
          {paused && slides.length > 1 && (
            <div className="absolute top-3 left-12 z-30 flex items-center gap-1
              px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10
              text-[8px] text-white/35">
              <span className="flex gap-0.5">
                <span className="w-[2px] h-2.5 bg-white/40 rounded-full" />
                <span className="w-[2px] h-2.5 bg-white/40 rounded-full" />
              </span>
              pausado
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
