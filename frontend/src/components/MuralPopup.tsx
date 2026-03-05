// ─────────────────────────────────────────────────────────────────────────────
// components/MuralPopup.tsx — Mural de Recados
// Mobile: bottom-sheet · Desktop: centered floating modal
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Megaphone, Pin, Calendar, Newspaper } from 'lucide-react'
import { useBanners, type MuralBanner } from '../hooks/useMural'
import { useTheme } from '../contexts/ThemeContext'

// ── Config ──────────────────────────────────────────────────────────────────
const SLIDE_DURATION = 5500

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

// ── Dots ────────────────────────────────────────────────────────────────────
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
export default function MuralPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const { data: fetched = [] } = useBanners()
  const slides = fetched.length > 0 ? fetched : DEFAULTS

  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused]   = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const goNext = useCallback(
    () => setCurrent(c => (c + 1) % slides.length),
    [slides.length],
  )
  const goPrev = useCallback(
    () => setCurrent(c => ((c - 1) + slides.length) % slides.length),
    [slides.length],
  )

  // Animate in/out
  useEffect(() => {
    if (open) {
      setCurrent(0)
      requestAnimationFrame(() => setVisible(true))
      document.body.style.overflow = 'hidden'
    } else {
      setVisible(false)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC + Arrow key navigation
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goNext, goPrev])

  // Auto-advance
  useEffect(() => {
    if (!open || paused || slides.length <= 1) return
    const id = setInterval(goNext, SLIDE_DURATION)
    return () => clearInterval(id)
  }, [open, paused, slides.length, goNext])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* ── Backdrop ──────────────────────────────────────────── */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: isLight ? 'rgba(241,245,249,0.85)' : 'rgba(6,13,27,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
        }}
        onClick={onClose}
      />

      {/* ── Mobile: Bottom sheet · Desktop: Centered modal ──── */}
      <div
        className={[
          // Base
          'absolute z-10 flex flex-col',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0',
          // Desktop: centered modal with max dimensions
          'lg:bottom-auto lg:left-1/2 lg:right-auto lg:top-1/2',
          'lg:w-[520px] lg:max-h-[85vh]',
        ].join(' ')}
        style={{
          // Mobile: slide up from bottom
          // Desktop: scale + fade from center
          ...(typeof window !== 'undefined' && window.innerWidth >= 1024
            ? {
                transform: visible
                  ? 'translate(-50%, -50%) scale(1)'
                  : 'translate(-50%, -50%) scale(0.95)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
              }
            : {
                maxHeight: '75vh',
                transform: visible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              }),
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* ── Sheet/Modal body ──────────────────────────────── */}
        <div className={[
          'overflow-hidden border',
          // Mobile: rounded top only (bottom sheet)
          'rounded-t-3xl',
          // Desktop: fully rounded (floating modal)
          'lg:rounded-3xl',
          isLight
            ? 'bg-white border-slate-200/80 lg:shadow-2xl lg:shadow-slate-300/50'
            : 'bg-[#0A1020] border-white/10 lg:shadow-2xl lg:shadow-black/50',
        ].join(' ')}>

          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 pb-2 lg:hidden">
            <div className={`w-10 h-1 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />
          </div>

          {/* ── Header ───────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pb-3 lg:pt-5 lg:pb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isLight
                  ? 'bg-teal-50 border border-teal-100'
                  : 'bg-teal-500/10 border border-teal-500/20'
              }`}>
                <Newspaper size={16} className={isLight ? 'text-teal-600' : 'text-teal-400'} />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  Mural de Recados
                </h2>
                <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {slides.length} comunicado{slides.length !== 1 ? 's' : ''} · TEG+ Comunicados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Paused indicator */}
              {paused && slides.length > 1 && (
                <div className={`hidden lg:flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-medium ${
                  isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/30'
                }`}>
                  <span className="flex gap-0.5">
                    <span className={`w-[2px] h-2.5 rounded-full ${isLight ? 'bg-slate-300' : 'bg-white/30'}`} />
                    <span className={`w-[2px] h-2.5 rounded-full ${isLight ? 'bg-slate-300' : 'bg-white/30'}`} />
                  </span>
                  pausado
                </div>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                }`}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Banner slideshow ──────────────────────────────── */}
          <div
            className="relative mx-4 mb-4 rounded-2xl overflow-hidden ring-1 ring-white/[0.07]"
            style={{ aspectRatio: '16 / 10' }}
            onTouchStart={e => {
              touchStartX.current = e.touches[0].clientX
              touchStartY.current = e.touches[0].clientY
            }}
            onTouchEnd={e => {
              const dx = touchStartX.current - e.changedTouches[0].clientX
              const dy = touchStartY.current - e.changedTouches[0].clientY
              // Horizontal swipe → navigate slides
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
                dx > 0 ? goNext() : goPrev()
              }
              // Vertical swipe down → close
              if (dy < -80 && Math.abs(dy) > Math.abs(dx)) {
                onClose()
              }
            }}
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
                  <img
                    src={slide.imagem_url}
                    alt={slide.titulo}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />

                  {/* Badge */}
                  <div className="absolute top-3 right-3 z-20">
                    <TypeBadge banner={slide} />
                  </div>

                  {/* Content */}
                  <div
                    className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(10px)',
                      transition: 'opacity 0.5s 0.1s ease, transform 0.5s 0.1s ease',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Megaphone size={8} className="text-teal-400/80" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-teal-400/70">
                        TEG+ Comunicados
                      </span>
                    </div>

                    <h3
                      className="text-base lg:text-lg font-black text-white leading-tight"
                      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                    >
                      {slide.titulo}
                    </h3>

                    {slide.subtitulo && (
                      <p className="text-[11px] lg:text-xs text-white/55 mt-1 leading-relaxed line-clamp-2">
                        {slide.subtitulo}
                      </p>
                    )}

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
                        key={`popup-${current}-${paused ? 'p' : 'r'}`}
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

            {/* Nav arrows */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className={[
                    'absolute left-2 top-1/2 -translate-y-1/2 z-30',
                    'flex w-8 h-8 items-center justify-center',
                    'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                    'text-white transition-all duration-300',
                    'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-90',
                    // Mobile: always visible · Desktop: show on hover
                    'lg:opacity-0 lg:pointer-events-none',
                    paused ? 'lg:!opacity-100 lg:!pointer-events-auto' : '',
                  ].join(' ')}
                  aria-label="Anterior"
                >
                  <ChevronLeft size={15} strokeWidth={2.5} />
                </button>
                <button
                  onClick={goNext}
                  className={[
                    'absolute right-2 top-1/2 -translate-y-1/2 z-30',
                    'flex w-8 h-8 items-center justify-center',
                    'rounded-full bg-black/50 backdrop-blur-sm border border-white/15',
                    'text-white transition-all duration-300',
                    'hover:bg-black/70 hover:border-white/30 hover:scale-110 active:scale-90',
                    // Mobile: always visible · Desktop: show on hover
                    'lg:opacity-0 lg:pointer-events-none',
                    paused ? 'lg:!opacity-100 lg:!pointer-events-auto' : '',
                  ].join(' ')}
                  aria-label="Próximo"
                >
                  <ChevronRight size={15} strokeWidth={2.5} />
                </button>
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <p className={`text-center text-[10px] pb-4 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className="lg:hidden">Deslize para navegar · Puxe para baixo para fechar</span>
            <span className="hidden lg:inline">Passe o mouse para pausar · ← → para navegar · ESC para fechar</span>
          </p>
        </div>
      </div>
    </div>
  )
}
