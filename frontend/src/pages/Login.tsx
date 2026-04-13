import { useState, useRef, useCallback, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff, Download, X, Share2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { usePWAInstall } from '../hooks/usePWAInstall'
import LogoTeg from '../components/LogoTeg'
import ThemeToggle from '../components/ThemeToggle'

type View = 'login' | 'reset'

function normalizeLoginUsername(v: string) {
  const cleaned = v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return cleaned.replace(/\s+/g, '.').replace(/[^a-z0-9@._-]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '')
}

// ── Sound helpers (Mixkit audio files) ───────────────────────────────────────
const playSound = (src: string, vol = 0.3) => { try { const a = new Audio(src); a.volume = vol; a.play().catch(() => {}) } catch {} }
const playHover = () => playSound('/sounds/options/mixkit-sci-fi-click.wav', 0.2)
const playClick = () => playSound('/sounds/options/mixkit-confirmation-tone.wav', 0.3)
const playError = () => playSound('/sounds/options/mixkit-wrong-answer.wav', 0.35)
const playWarp = () => playSound('/sounds/options/mixkit-achievement-bell.wav', 0.4)

// ── Particles (deterministic) ────────────────────────────────────────────────
const PARTICLES = [
  { left: 5, size: 3, delay: 0, dur: 8 }, { left: 12, size: 2, delay: 2, dur: 10 },
  { left: 22, size: 4, delay: 1, dur: 7 }, { left: 30, size: 2, delay: 4, dur: 12 },
  { left: 40, size: 3, delay: 0.5, dur: 9 }, { left: 50, size: 2, delay: 3, dur: 11 },
  { left: 60, size: 3, delay: 1.5, dur: 8 }, { left: 68, size: 2, delay: 5, dur: 14 },
  { left: 75, size: 4, delay: 2.5, dur: 6 }, { left: 82, size: 2, delay: 0, dur: 10 },
  { left: 90, size: 3, delay: 3.5, dur: 9 }, { left: 95, size: 2, delay: 1, dur: 13 },
]

// ── CSS Keyframes ────────────────────────────────────────────────────────────
const VORTEX_CSS = `
@keyframes vortex-entrance{from{opacity:0;transform:translateY(40px);filter:blur(8px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
@keyframes vortex-logo-glow{0%,100%{transform:scale(1);filter:drop-shadow(0 0 12px rgba(20,184,166,0.4))}50%{transform:scale(1.1);filter:drop-shadow(0 0 30px rgba(20,184,166,0.7))}}
@keyframes vortex-orbit{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes vortex-orbit-rev{to{transform:translate(-50%,-50%) rotate(-360deg)}}
@keyframes vortex-particle{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-110vh);opacity:0}}
@keyframes vortex-shimmer{to{transform:translateX(200%)}}
@keyframes vortex-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes vortex-warp-spin{to{transform:rotate(360deg) scale(3)}}
@keyframes vortex-warp-zoom{to{transform:scale(2.5);filter:blur(20px);opacity:0}}
@keyframes vortex-spin{to{transform:rotate(360deg)}}
@keyframes vortex-radial-rotate{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes vortex-pulse-ring{0%,100%{opacity:0.08;transform:translate(-50%,-50%) scale(1)}50%{opacity:0.15;transform:translate(-50%,-50%) scale(1.02)}}
@keyframes vortex-glow-float-1{0%,100%{transform:translate(0,0) scale(1);opacity:0.4}25%{transform:translate(80px,-60px) scale(1.3);opacity:0.7}50%{transform:translate(-40px,-120px) scale(0.9);opacity:0.3}75%{transform:translate(-80px,40px) scale(1.1);opacity:0.6}}
@keyframes vortex-glow-float-2{0%,100%{transform:translate(0,0) scale(1.1);opacity:0.3}33%{transform:translate(-100px,70px) scale(0.8);opacity:0.6}66%{transform:translate(60px,-80px) scale(1.4);opacity:0.5}}
@keyframes vortex-glow-float-3{0%,100%{transform:translate(0,0) scale(0.9);opacity:0.5}50%{transform:translate(120px,60px) scale(1.2);opacity:0.3}}
@keyframes vortex-lightning{0%,100%{opacity:0}48%{opacity:0}50%{opacity:0.8}52%{opacity:0}54%{opacity:0.4}56%{opacity:0}}
.vortex-input:focus{border-color:var(--v-focus-border)!important;box-shadow:var(--v-focus-shadow)!important}
.vortex-input::placeholder{color:var(--v-text-dim)}
.vortex-btn{position:relative;overflow:hidden}
.vortex-btn::before{content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);transition:none}
.vortex-btn:hover::before{animation:vortex-shimmer 0.8s ease}
@keyframes vortex-loading-bar{from{width:0%}to{width:100%}}
@keyframes vortex-fade-in{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
@keyframes vortex-text-glow{0%,100%{text-shadow:0 0 20px rgba(20,184,166,0.3)}50%{text-shadow:0 0 40px rgba(20,184,166,0.6),0 0 80px rgba(99,102,241,0.2)}}
@keyframes vortex-ring-pulse{0%{transform:translate(-50%,-50%) scale(0.8);opacity:0.6}50%{transform:translate(-50%,-50%) scale(1.2);opacity:0.2}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
@keyframes vortex-dots{0%,80%,100%{opacity:0.3}40%{opacity:1}}
`

export default function Login() {
  const { user, loading, signIn, resetPassword } = useAuth()
  const { theme, isDark, isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const { isInstalled, promptInstall, isIOS } = usePWAInstall()

  const [showInstallGuide, setShowInstallGuide] = useState(false)

  const [view, setView] = useState<View>('login')
  const [loginUser, setLoginUser] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warping, setWarping] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)

  // Background music — desktop only, loop, low volume
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768
    if (!isDesktop) return
    const audio = new Audio('/sounds/login-bg.mp4')
    audio.loop = true
    audio.volume = 0.08
    bgMusicRef.current = audio
    // Autoplay needs user interaction; start on first click
    const startMusic = () => {
      audio.play().catch(() => {})
      document.removeEventListener('click', startMusic)
    }
    document.addEventListener('click', startMusic)
    return () => {
      document.removeEventListener('click', startMusic)
      audio.pause()
      audio.src = ''
    }
  }, [])

  if (!loading && user) return <Navigate to="/" replace />

  const clr = () => { setError(null); setSuccess(null) }
  const toEmail = (v: string) => v.includes('@') ? v : `${v}@login.teg.local`

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true); playClick()
    const { error: err } = await signIn(toEmail(loginUser), password)
    setBusy(false)
    if (err) {
      setError(err); setShaking(true); playError()
      setTimeout(() => setShaking(false), 600)
    } else {
      // Fase 1: warp visual (0.8s)
      setWarping(true); playWarp()
      // Fade out music
      if (bgMusicRef.current) {
        const m = bgMusicRef.current
        const fadeOut = setInterval(() => { m.volume = Math.max(0, m.volume - 0.01); if (m.volume <= 0) { clearInterval(fadeOut); m.pause() } }, 30)
      }
      // Fase 2: loading transition (3s)
      setTimeout(() => {
        setWarping(false); setTransitioning(true); setLoadProgress(0)
        // Animate progress bar
        const start = Date.now()
        const dur = 3000
        const tick = () => {
          const elapsed = Date.now() - start
          const pct = Math.min(elapsed / dur, 1)
          setLoadProgress(pct * 100)
          if (pct < 1) requestAnimationFrame(tick)
          else setTimeout(() => nav('/'), 200)
        }
        requestAnimationFrame(tick)
      }, 900)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true); playClick()
    const { error: err } = await resetPassword(toEmail(resetEmail))
    setBusy(false)
    if (err) { setError(err); setShaking(true); setTimeout(() => setShaking(false), 600); return }
    setSuccess('Link de recuperação enviado! Verifique seu e-mail.')
  }

  // ── Theme (3 variantes: dark / original / light) ────────────────────
  const THEMES = {
    dark: {
      bgFrom: '#040a14', bgMid: '#07111f', bgTo: '#0a1628',
      cardBg: 'rgba(10,30,60,0.55)', cardBorder: 'rgba(20,184,166,0.15)',
      cardShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 1px rgba(20,184,166,0.4), 0 0 40px rgba(20,184,166,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
      inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.1)',
      focusBorder: 'rgba(20,184,166,0.6)', focusShadow: '0 0 4px rgba(20,184,166,0.5), 0 0 24px rgba(20,184,166,0.12)',
      text: '#ffffff', textMuted: 'rgba(255,255,255,0.55)', textDim: 'rgba(255,255,255,0.35)',
      gridOp: 0.04, ringOp: 0.12, particleOp: 0.4,
      glowColor: '20,184,166', glowColor2: '99,102,241', accentRgb: '20,184,166',
      btnGrad: 'linear-gradient(135deg, #14b8a6, #0d9488, #0f766e)',
      errorColor: '#f87171', errorBg: 'rgba(248,113,113,0.1)', errorBorder: 'rgba(248,113,113,0.2)',
      successBg: 'rgba(52,211,153,0.1)', successBorder: 'rgba(52,211,153,0.2)', successColor: '#34d399',
      linkColor: '#5eead4', footerColor: 'rgba(255,255,255,0.2)',
      backdrop: 'blur(24px) saturate(1.2)',
      showLightning: true,
    },
    original: {
      // Meio-termo: fundo claro, mas efeitos coloridos vibrantes
      bgFrom: '#eef2f7', bgMid: '#e0e7f1', bgTo: '#f0f4fa',
      cardBg: 'rgba(255,255,255,0.85)', cardBorder: 'rgba(99,102,241,0.18)',
      cardShadow: '0 30px 80px rgba(99,102,241,0.1), 0 0 1px rgba(99,102,241,0.3), 0 0 50px rgba(99,102,241,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
      inputBg: 'rgba(241,245,249,0.9)', inputBorder: 'rgba(99,102,241,0.15)',
      focusBorder: 'rgba(99,102,241,0.6)', focusShadow: '0 0 4px rgba(99,102,241,0.4), 0 0 24px rgba(99,102,241,0.1)',
      text: '#1e293b', textMuted: '#475569', textDim: '#94a3b8',
      gridOp: 0.08, ringOp: 0.15, particleOp: 0.3,
      glowColor: '99,102,241', glowColor2: '20,184,166', accentRgb: '99,102,241',
      btnGrad: 'linear-gradient(135deg, #6366F1, #4F46E5, #4338CA)',
      errorColor: '#ef4444', errorBg: 'rgba(239,68,68,0.08)', errorBorder: 'rgba(239,68,68,0.15)',
      successBg: 'rgba(16,185,129,0.08)', successBorder: 'rgba(16,185,129,0.15)', successColor: '#059669',
      linkColor: '#6366f1', footerColor: '#94a3b8',
      backdrop: 'blur(20px) saturate(1.15)',
      showLightning: false,
    },
    light: {
      // Clean minimal: fundo branco, efeitos muito sutis
      bgFrom: '#f8fafc', bgMid: '#f1f5f9', bgTo: '#ffffff',
      cardBg: '#ffffff', cardBorder: '#e2e8f0',
      cardShadow: '0 25px 50px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
      inputBg: '#f8fafc', inputBorder: '#e2e8f0',
      focusBorder: 'rgba(99,102,241,0.4)', focusShadow: '0 0 3px rgba(99,102,241,0.2), 0 0 12px rgba(99,102,241,0.05)',
      text: '#1e293b', textMuted: '#64748b', textDim: '#94a3b8',
      gridOp: 0.03, ringOp: 0.05, particleOp: 0.08,
      glowColor: '99,102,241', glowColor2: '139,92,246', accentRgb: '99,102,241',
      btnGrad: 'linear-gradient(135deg, #6366F1, #4F46E5, #4338CA)',
      errorColor: '#ef4444', errorBg: 'rgba(239,68,68,0.05)', errorBorder: 'rgba(239,68,68,0.1)',
      successBg: 'rgba(16,185,129,0.05)', successBorder: 'rgba(16,185,129,0.1)', successColor: '#059669',
      linkColor: '#6366f1', footerColor: '#cbd5e1',
      backdrop: undefined as string | undefined,
      showLightning: false,
    },
  }
  const t = THEMES[theme]

  const cssVars = { '--v-focus-border': t.focusBorder, '--v-focus-shadow': t.focusShadow, '--v-text-dim': t.textDim } as React.CSSProperties

  // ── Loading transition screen ──────────────────────────────────────
  if (transitioning) {
    return (
      <>
        <style>{VORTEX_CSS}</style>
        <div className="fixed inset-0 flex flex-col items-center justify-center" style={{
          background: `radial-gradient(ellipse at 50% 40%, #07111f, #040a14)`,
        }}>
          {/* Pulsing rings behind logo */}
          {[1, 2, 3].map(i => (
            <div key={i} className="absolute pointer-events-none" style={{
              left: '50%', top: '45%', width: 200 + i * 80, height: 200 + i * 80,
              borderRadius: '50%', border: '1px solid rgba(20,184,166,0.15)',
              transform: 'translate(-50%,-50%)',
              animation: `vortex-ring-pulse ${2 + i * 0.5}s ${i * 0.3}s ease-out infinite`,
            }} />
          ))}

          {/* Center glow */}
          <div className="absolute pointer-events-none" style={{
            left: '50%', top: '45%', transform: 'translate(-50%,-50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 60%)',
          }} />

          {/* Logo */}
          <div style={{ animation: 'vortex-fade-in 0.6s ease-out', marginBottom: 32 }}>
            <LogoTeg size={100} animated={false} glowing={false} />
          </div>

          {/* TEG+ text */}
          <h1 style={{
            color: '#fff', fontSize: '2rem', fontWeight: 900, letterSpacing: '0.3em',
            animation: 'vortex-text-glow 2s ease-in-out infinite',
            marginBottom: 8,
          }}>TEG+</h1>

          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 40 }}>
            Carregando seu ambiente
          </p>

          {/* Progress bar */}
          <div style={{ width: 280, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #14b8a6, #6366f1)',
              width: `${loadProgress}%`,
              transition: 'width 0.05s linear',
              boxShadow: '0 0 12px rgba(20,184,166,0.4)',
            }} />
          </div>

          {/* Loading dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(20,184,166,0.6)',
                animation: `vortex-dots 1.2s ${i * 0.2}s ease-in-out infinite`,
              }} />
            ))}
          </div>

          {/* Floating particles in transition */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            {PARTICLES.slice(0, 8).map((p, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${p.left}%`, bottom: '-10px',
                width: p.size + 1, height: p.size + 1, borderRadius: '50%',
                background: `rgba(20,184,166,0.3)`,
                boxShadow: `0 0 ${p.size * 3}px rgba(20,184,166,0.2)`,
                animation: `vortex-particle ${p.dur}s ${p.delay}s linear infinite`,
              }} />
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{VORTEX_CSS}</style>
      <div className="fixed inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 20% 50%, ${t.bgMid}, transparent 70%), radial-gradient(ellipse at 80% 20%, ${t.bgTo}, transparent 60%), ${t.bgFrom}`, ...cssVars }}>

        {/* Floating glow orbs */}
        {[
          { x: '20%', y: '30%', size: 300, colorKey: 0, anim: 'vortex-glow-float-1', dur: 12 },
          { x: '70%', y: '20%', size: 250, colorKey: 1, anim: 'vortex-glow-float-2', dur: 16 },
          { x: '50%', y: '70%', size: 350, colorKey: 0, anim: 'vortex-glow-float-3', dur: 20 },
          { x: '80%', y: '60%', size: 200, colorKey: 1, anim: 'vortex-glow-float-1', dur: 14 },
          { x: '10%', y: '70%', size: 220, colorKey: 0, anim: 'vortex-glow-float-2', dur: 18 },
        ].map((orb, i) => {
          const color = orb.colorKey === 0 ? t.glowColor : t.glowColor2
          const intensity = theme === 'dark' ? 0.15 : theme === 'original' ? 0.12 : 0.06
          return (
            <div key={`glow-${i}`} className="fixed pointer-events-none" style={{
              left: orb.x, top: orb.y, width: orb.size, height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${color},${intensity}) 0%, transparent 70%)`,
              filter: `blur(${theme === 'dark' ? 40 : theme === 'original' ? 35 : 25}px)`,
              animation: `${orb.anim} ${orb.dur}s ease-in-out infinite`,
            }} />
          )
        })}

        {/* Lightning / energy flashes */}
        {t.showLightning && [
          { x: '15%', y: '25%', w: 2, h: 80, rot: 35, delay: 0 },
          { x: '78%', y: '40%', w: 1.5, h: 60, rot: -20, delay: 4 },
          { x: '45%', y: '15%', w: 1, h: 50, rot: 70, delay: 8 },
          { x: '85%', y: '70%', w: 2, h: 70, rot: -45, delay: 2 },
          { x: '25%', y: '80%', w: 1.5, h: 55, rot: 15, delay: 6 },
        ].map((l, i) => (
          <div key={`lightning-${i}`} className="fixed pointer-events-none" style={{
            left: l.x, top: l.y, width: l.w, height: l.h,
            background: `linear-gradient(180deg, transparent, rgba(${t.glowColor},0.8), rgba(${t.glowColor2},0.6), transparent)`,
            transform: `rotate(${l.rot}deg)`,
            borderRadius: 2,
            animation: `vortex-lightning 8s ${l.delay}s ease infinite`,
            filter: 'blur(1px)',
            boxShadow: `0 0 8px rgba(${t.glowColor},0.4), 0 0 20px rgba(${t.glowColor},0.15)`,
          }} />
        ))}

        {/* Grid sci-fi */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundSize: '60px 60px',
          backgroundImage: `linear-gradient(rgba(${t.accentRgb},${t.gridOp}) 1px, transparent 1px), linear-gradient(90deg, rgba(${t.accentRgb},${t.gridOp}) 1px, transparent 1px)`,
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 60%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 60%)',
        }} />

        {/* Orbital rings */}
        {[
          { size: 400, dur: 40, anim: 'vortex-orbit', width: 1 },
          { size: 600, dur: 55, anim: 'vortex-orbit', width: 1 },
          { size: 850, dur: 80, anim: 'vortex-orbit-rev', width: 1 },
          { size: 520, dur: 70, anim: 'vortex-pulse-ring', width: 2 },
        ].map((ring, i) => (
          <div key={i} className="fixed pointer-events-none" style={{
            left: '50%', top: '50%', width: ring.size, height: ring.size,
            borderRadius: '50%',
            border: `${ring.width}px solid rgba(${t.accentRgb},${t.ringOp})`,
            transform: 'translate(-50%,-50%)',
            animation: `${ring.anim} ${ring.dur}s linear infinite`,
          }} />
        ))}

        {/* Particles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {PARTICLES.map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${p.left}%`, bottom: '-10px',
              width: p.size + 1, height: p.size + 1, borderRadius: '50%',
              background: i % 2 === 0 ? `rgba(${t.glowColor},${t.particleOp})` : `rgba(${t.glowColor2},${t.particleOp})`,
              boxShadow: theme !== 'light' ? `0 0 ${p.size * 2}px rgba(${t.glowColor},${t.particleOp * 0.5})` : undefined,
              animation: `vortex-particle ${p.dur}s ${p.delay}s linear infinite`,
            }} />
          ))}
        </div>

        {/* Warp lines */}
        <div className="fixed inset-0 pointer-events-none transition-all duration-700" style={{
          background: 'repeating-conic-gradient(from 0deg, rgba(99,102,241,0.08) 0deg, transparent 2deg, transparent 8deg)',
          opacity: warping ? 1 : 0,
          animation: warping ? 'vortex-warp-spin 0.8s ease forwards' : 'none',
        }} />

        {/* Center glow */}
        <div className="fixed pointer-events-none" style={{
          left: '50%', top: '45%', transform: 'translate(-50%,-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${t.glowColor},${theme === 'dark' ? 0.08 : theme === 'original' ? 0.06 : 0.03}) 0%, transparent 70%)`,
        }} />

        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-sm" style={{ animation: 'vortex-entrance 0.8s ease-out' }}>

            {/* Theme toggle */}
            <div className="flex justify-center mb-4">
              <ThemeToggle variant={isDark ? 'dark' : 'light'} compact />
            </div>

            {/* Logo */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center mb-2" style={{ animation: 'vortex-logo-glow 3s ease-in-out infinite' }}>
                <LogoTeg size={120} animated={false} glowing={false} />
              </div>
              <p style={{ color: t.textDim, fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Sistema ERP · Acesso Restrito
              </p>
            </div>

            {/* Card */}
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              background: t.cardBg, border: `1px solid ${t.cardBorder}`,
              boxShadow: t.cardShadow,
              backdropFilter: t.backdrop, WebkitBackdropFilter: t.backdrop,
              animation: shaking ? 'vortex-shake 0.5s ease' : warping ? 'vortex-warp-zoom 0.8s ease forwards' : undefined,
            }}>

              {/* LOGIN VIEW */}
              {view === 'login' && (
                <form onSubmit={handleLogin} style={{ padding: 20 }}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>Usuário ou e-mail</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textDim, pointerEvents: 'none' }} />
                      <input
                        className="vortex-input"
                        type="text" autoFocus autoComplete="username email" required
                        placeholder="nome.sobrenome ou email"
                        value={loginUser}
                        onChange={e => { setLoginUser(normalizeLoginUsername(e.target.value)); clr() }}
                        style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>Senha</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textDim, pointerEvents: 'none' }} />
                      <input
                        className="vortex-input"
                        type={showPass ? 'text' : 'password'} autoComplete="current-password" required
                        placeholder="••••••••"
                        value={password}
                        onChange={e => { setPassword(e.target.value); clr() }}
                        style={{ width: '100%', paddingLeft: 36, paddingRight: 40, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      />
                      <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.textDim, cursor: 'pointer', padding: 0 }}>
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', marginBottom: 16 }}>
                    <button type="button" onClick={() => { setView('reset'); setResetEmail(''); clr() }} style={{ background: 'none', border: 'none', color: t.linkColor, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      Esqueci a senha
                    </button>
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.errorBg, border: `1px solid ${t.errorBorder}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: t.errorColor }}>
                      <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: t.successColor }}>
                      <CheckCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Button */}
                  <button
                    type="submit" disabled={busy}
                    className="vortex-btn"
                    onMouseEnter={playHover}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                      background: t.btnGrad,
                      color: '#fff', fontSize: 14, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: busy ? 0.6 : 1, transition: 'opacity 0.2s, transform 0.1s',
                    }}
                  >
                    {busy
                      ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'vortex-spin 0.7s linear infinite' }} />
                      : <><span>Entrar</span><ArrowRight size={14} /></>
                    }
                  </button>
                </form>
              )}

              {/* RESET VIEW */}
              {view === 'reset' && (
                <form onSubmit={handleReset} style={{ padding: 20 }}>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 700, color: t.text, fontSize: 15 }}>Recuperar senha</p>
                    <p style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Enviaremos um link para redefinir sua senha</p>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 6 }}>Usuário ou e-mail</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textDim, pointerEvents: 'none' }} />
                      <input
                        className="vortex-input"
                        type="text" autoFocus autoComplete="username email" required
                        placeholder="nome.sobrenome ou email"
                        value={resetEmail}
                        onChange={e => { setResetEmail(normalizeLoginUsername(e.target.value)); clr() }}
                        style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 14, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                      />
                    </div>
                  </div>

                  {error && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.errorBg, border: `1px solid ${t.errorBorder}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: t.errorColor }}>
                      <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: t.successBg, border: `1px solid ${t.successBorder}`, borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: t.successColor }}>
                      <CheckCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} /><span>{success}</span>
                    </div>
                  )}

                  <button
                    type="submit" disabled={busy}
                    className="vortex-btn"
                    onMouseEnter={playHover}
                    style={{
                      width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                      background: t.btnGrad,
                      color: '#fff', fontSize: 14, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: busy ? 0.6 : 1, marginBottom: 12,
                    }}
                  >
                    {busy
                      ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'vortex-spin 0.7s linear infinite' }} />
                      : <><span>Enviar link de recuperação</span><ArrowRight size={14} /></>
                    }
                  </button>

                  <button type="button" onClick={() => { setView('login'); clr() }}
                    style={{ width: '100%', textAlign: 'center', background: 'none', border: 'none', fontSize: 12, color: t.textMuted, cursor: 'pointer', padding: '8px 0' }}>
                    ← Voltar ao login
                  </button>
                </form>
              )}
            </div>

            {/* Footer */}
            <p style={{ textAlign: 'center', fontSize: 11, color: t.footerColor, marginTop: 20 }}>
              TEG+ ERP v2.0 · Acesso apenas para colaboradores autorizados
            </p>
          </div>
        </div>

        {/* Install App Button — hidden if already installed as PWA */}
        {!isInstalled && (
          <button
            onClick={async () => {
              const accepted = await promptInstall()
              if (!accepted && isIOS) setShowInstallGuide(true)
            }}
            className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              isDark
                ? 'bg-teal-500/15 border border-teal-400/25 text-teal-300 hover:bg-teal-500/25'
                : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100'
            }`}
          >
            <Download size={16} />
            Instalar App TEG+
          </button>
        )}

        {/* Install Guide Modal — iOS only (Safari has no auto-install API) */}
        {showInstallGuide && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-sm rounded-2xl p-6 space-y-5 ${
              isDark ? 'bg-slate-900 border border-white/10' : 'bg-white border border-slate-200 shadow-2xl'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Instalar TEG+
                </h3>
                <button onClick={() => setShowInstallGuide(false)} className="p-1 rounded-lg hover:bg-slate-100/10">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <InstallStep n={1} isDark={isDark}>
                  Toque em <Share2 size={14} className="inline text-blue-500 -mt-0.5" /> <strong>Compartilhar</strong> na barra do Safari
                </InstallStep>
                <InstallStep n={2} isDark={isDark}>
                  Role e toque em <strong>{"Adicionar à Tela de Início"}</strong>
                </InstallStep>
                <InstallStep n={3} isDark={isDark}>
                  Toque em <strong>{"Adicionar"}</strong>
                </InstallStep>
              </div>
              <p className={`text-[11px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                O TEG+ vai abrir como um app nativo no seu dispositivo
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InstallStep({ n, isDark, children }: { n: number; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
        isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
      }`}>
        {n}
      </div>
      <p className={`text-sm pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {children}
      </p>
    </div>
  )
}
