// ─────────────────────────────────────────────────────────────────────────────
// components/MuralSidebar.tsx — Mural de Recados (desktop sidebar)
// Elegant card panel matching the mobile popup aesthetic
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight,
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

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  return (
    <aside
      className={`flex flex-col rounded-2xl overflow-hidden border ${
        isLight
          ? 'bg-white border-slate-200/80 shadow-lg shadow-slate-200/50'
          : 'bg-[#0A1020] border-white/[0.08] shadow-2xl shadow-black/30'
      }`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ── Card header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isLight
              ? 'bg-teal-50 border border-teal-100'
              : 'bg-teal-500/10 border border-teal-500/20'
          }`}>
            <Newspaper size={14} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
          </div>
          <div>
            <h2 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
              Mural de Recados
            </h2>
            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {slides.length} comunicado{slides.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Paused indicator */}
        {paused && slides.length > 1 && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-medium ${
            isLight
              ? 'bg-slate-100 text-slate-400'
              : 'bg-white/5 text-white/30'
          }`}>
            <span className="flex gap-0.5">
              <span className={`w-[2px] h-2.5 rounded-full ${isLight ? 'bg-slate-300' : 'bg-white/30'}`} />
              <span className={`w-[2px] h-2.5 rounded-full ${isLight ? 'bg-slate-300' : 'bg-white/30'}`} />
            </span>
            pausado
          </div>
        )}
      </div>

      {/* ── Banner slideshow (16:10 horizontal) ─────────────────── */}
      <div
        className="relative mx-3 mb-4 rounded-xl overflow-hidden ring-1 ring-white/[0.07]"
        style={{ aspectRatio: '16 / 10' }}
      >
        {slides.map((slide, i) => {
          const isActive = i === current
          return (
            <div
              key={slide.id}
              className="absolute inset-0 transition-opacity duration-600"
              style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 1 }}
              aria-hidden={!isActive}
            >
              {/* Image */}
              <img
                src={slide.imagem_url}
                alt={slide.titulo}
                className="absolute inset-0 w-full h-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />

              {/* Type badge — top right */}
              <div className="absolute top-3 right-3 z-20">
                <TypeBadge banner={slide} />
              </div>

              {/* Text content — bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'translateY(0)' : 'translateY(10px)',
                  transition: 'opacity 0.5s 0.1s ease, transform 0.5s 0.1s ease',
                }}
              >
                {/* Eyebrow */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Megaphone size={8} className="text-teal-400/80" />
                  <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-teal-400/70">
                    TEG+ Comunicados
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="text-sm font-black text-white leading-tight"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                >
                  {slide.titulo}
                </h3>

                {/* Subtitle */}
                {slide.subtitulo && (
                  <p className="text-[10px] text-white/55 mt-1 leading-relaxed line-clamp-2">
                    {slide.subtitulo}
                  </p>
                )}

                {/* Controls */}
                {slides.length > 1 && (
                  <div className="flex items-center gap-2.5 mt-2.5">
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

        {/* Navigation arrows — left/right, visible on hover */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className={[
                'absolute left-2 top-1/2 -translate-y-1/2 z-30',
                'flex w-7 h-7 items-center justify-center',
                'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                'text-white transition-all duration-300',
                'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
              ].join(' ')}
              aria-label="Anterior"
            >
              <ChevronLeft size={14} strokeWidth={2.5} />
            </button>

            <button
              onClick={goNext}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2 z-30',
                'flex w-7 h-7 items-center justify-center',
                'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                'text-white transition-all duration-300',
                'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
              ].join(' ')}
              aria-label="Próximo"
            >
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* ── Footer hint ──────────────────────────────────────────── */}
      <p className={`text-center text-[9px] pb-3 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
        Passe o mouse para pausar · ← → para navegar
      </p>
    </aside>
  )
}
