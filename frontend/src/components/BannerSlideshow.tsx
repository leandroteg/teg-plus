// ─────────────────────────────────────────────────────────────────────────────
// components/BannerSlideshow.tsx — Painel de Comunicação Empresarial
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Megaphone, Pin, Calendar } from 'lucide-react'
import { useBanners, type MuralBanner } from '../hooks/useMural'

// ── Config ─────────────────────────────────────────────────────────────────────
const SLIDE_DURATION = 5500 // ms

// ── Default slides (quando não há banners cadastrados) ──────────────────────────
const DEFAULTS: MuralBanner[] = [
  {
    id: '__d1',
    titulo: 'Bem-vindo ao TEG+ ERP',
    subtitulo: 'Sistema integrado para gestão de obras de engenharia elétrica e transmissão de energia',
    imagem_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=80',
    tipo: 'fixa', ativo: true, ordem: 0,
    created_at: '', updated_at: '',
  },
  {
    id: '__d2',
    titulo: 'Módulos Disponíveis',
    subtitulo: 'Compras · Financeiro · Estoque · Logística · Frotas — todos operacionais agora',
    imagem_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80',
    tipo: 'fixa', ativo: true, ordem: 1,
    created_at: '', updated_at: '',
  },
  {
    id: '__d3',
    titulo: 'Segurança em Primeiro Lugar',
    subtitulo: 'Mantenha os checklists de frota e os registros de SSMA sempre atualizados',
    imagem_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80',
    tipo: 'fixa', ativo: true, ordem: 2,
    created_at: '', updated_at: '',
  },
]

// ── Badge de tipo ──────────────────────────────────────────────────────────────
function TypeBadge({ banner }: { banner: MuralBanner }) {
  if (banner.tipo === 'campanha') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
        bg-black/55 backdrop-blur-md border border-white/15
        text-[10px] font-semibold">
        <Calendar size={10} className="text-rose-400 shrink-0" />
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
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
      bg-black/55 backdrop-blur-md border border-white/15
      text-[10px] font-semibold">
      <Pin size={9} className="text-teal-400 shrink-0" />
      <span className="text-white/90">Comunicado</span>
    </div>
  )
}

// ── Dot indicator ──────────────────────────────────────────────────────────────
function Dots({
  total, current, onSelect,
}: {
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
              ? 'w-5 h-1.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
              : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
          }`}
        />
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BannerSlideshow() {
  const { data: fetched = [] } = useBanners()
  const slides = fetched.length > 0 ? fetched : DEFAULTS

  const [current, setCurrent]   = useState(0)
  const [paused, setPaused]     = useState(false)
  const touchStartX             = useRef(0)

  const goNext = useCallback(
    () => setCurrent(c => (c + 1) % slides.length),
    [slides.length],
  )
  const goPrev = useCallback(
    () => setCurrent(c => ((c - 1) + slides.length) % slides.length),
    [slides.length],
  )

  // Reset quando lista muda
  useEffect(() => { setCurrent(0) }, [slides.length])

  // Auto-advance
  useEffect(() => {
    if (paused || slides.length <= 1) return
    const id = setInterval(goNext, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [paused, slides.length, goNext])

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  return (
    <section
      className="relative w-full px-4 sm:px-6 max-w-4xl mx-auto"
      style={{ animation: 'fadeInUp 0.6s ease-out both 0.35s' }}
    >
      {/* ── Outer ambient glow ─────────────────────────────────────── */}
      <div
        className="absolute -inset-1 rounded-[26px] -z-10 opacity-60"
        style={{
          background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(20,184,166,0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* ── Slideshow container ─────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden select-none ring-1 ring-white/[0.07]"
        style={{ aspectRatio: '21 / 8' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX
          if (Math.abs(diff) > 48) diff > 0 ? goNext() : goPrev()
        }}
      >
        {/* ── Slide stack ──────────────────────────────────────────── */}
        {slides.map((slide, i) => {
          const isActive = i === current
          return (
            <div
              key={slide.id}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 1 }}
              aria-hidden={!isActive}
            >
              {/* Image — Ken Burns subtle zoom */}
              <img
                src={slide.imagem_url}
                alt={slide.titulo}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  animation: 'kenBurns 12s ease-in-out infinite alternate',
                  animationPlayState: isActive ? 'running' : 'paused',
                  transformOrigin: '55% 45%',
                }}
                loading={i === 0 ? 'eager' : 'lazy'}
              />

              {/* Gradient layers — cinema look */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/10 to-transparent" />
              {/* Edge vignette */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%)',
                }}
              />

              {/* ── Type badge — top right ─────────────────────────── */}
              <div className="absolute top-3 right-3 z-20">
                <TypeBadge banner={slide} />
              </div>

              {/* ── Text content — bottom left ─────────────────────── */}
              <div
                className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-4 sm:pb-5 z-10"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 0.65s 0.2s ease, transform 0.65s 0.2s ease',
                }}
              >
                {/* Eyebrow */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Megaphone size={9} className="text-teal-400/80" />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400/75">
                    TEG+ Comunicados
                  </span>
                </div>

                {/* Title */}
                <h2
                  className="text-sm sm:text-xl md:text-[22px] font-black text-white leading-tight"
                  style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                >
                  {slide.titulo}
                </h2>

                {/* Subtitle */}
                {slide.subtitulo && (
                  <p className="text-[11px] sm:text-sm text-white/60 mt-1 sm:mt-1.5 max-w-xs sm:max-w-md leading-relaxed">
                    {slide.subtitulo}
                  </p>
                )}

                {/* ── Controls row ─────────────────────────────────── */}
                {slides.length > 1 && (
                  <div className="flex items-center gap-3 mt-3">
                    <Dots total={slides.length} current={current} onSelect={setCurrent} />
                    <span className="text-[10px] text-white/30 font-medium tabular-nums">
                      {current + 1} / {slides.length}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Progress bar — glowing line at bottom ─────────── */}
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

        {/* ── Navigation arrows (desktop, visible on hover) ────────── */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className={[
                'absolute left-3 top-1/2 -translate-y-1/2 z-30',
                'hidden sm:flex w-9 h-9 items-center justify-center',
                'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                'text-white transition-all duration-300',
                'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
              ].join(' ')}
              aria-label="Slide anterior"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>

            <button
              onClick={goNext}
              className={[
                'absolute right-3 top-1/2 -translate-y-1/2 z-30',
                'hidden sm:flex w-9 h-9 items-center justify-center',
                'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                'text-white transition-all duration-300',
                'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-95',
                paused ? 'opacity-100' : 'opacity-0 pointer-events-none',
              ].join(' ')}
              aria-label="Próximo slide"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* ── Paused indicator (desktop) ───────────────────────────── */}
        {paused && slides.length > 1 && (
          <div className="absolute top-3 left-3 z-30 hidden sm:flex items-center gap-1.5
            px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10
            text-[9px] text-white/35">
            <span className="flex gap-0.5">
              <span className="w-[3px] h-3 bg-white/40 rounded-full" />
              <span className="w-[3px] h-3 bg-white/40 rounded-full" />
            </span>
            pausado
          </div>
        )}
      </div>
    </section>
  )
}
