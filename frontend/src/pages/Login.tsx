import { useState, useRef, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import ThemeToggle from '../components/ThemeToggle'

type View = 'login' | 'reset'

function normalizeLoginUsername(v: string) {
  const cleaned = v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return cleaned.replace(/\s+/g, '.').replace(/[^a-z0-9@._-]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '')
}

// ── Sound helpers (Web Audio API) ────────────────────────────────────────────
const playHover = () => { try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 800; g.gain.value = 0.05; o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05); o.stop(c.currentTime + 0.06); setTimeout(() => c.close(), 200) } catch {} }
const playClick = () => { try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 400; g.gain.value = 0.08; o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); o.stop(c.currentTime + 0.1); setTimeout(() => c.close(), 200) } catch {} }
const playWarp = () => { try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.setValueAtTime(300, c.currentTime); o.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.6); g.gain.value = 0.1; o.start(); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7); o.stop(c.currentTime + 0.8); setTimeout(() => c.close(), 1200) } catch {} }

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
.vortex-input:focus{border-color:var(--v-focus-border)!important;box-shadow:var(--v-focus-shadow)!important}
.vortex-input::placeholder{color:var(--v-text-dim)}
.vortex-btn{position:relative;overflow:hidden}
.vortex-btn::before{content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);transition:none}
.vortex-btn:hover::before{animation:vortex-shimmer 0.8s ease}
`

export default function Login() {
  const { user, loading, signIn, resetPassword } = useAuth()
  const { isDark } = useTheme()
  const nav = useNavigate()

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

  if (!loading && user) return <Navigate to="/" replace />

  const clr = () => { setError(null); setSuccess(null) }
  const toEmail = (v: string) => v.includes('@') ? v : `${v}@login.teg.local`

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true); playClick()
    const { error: err } = await signIn(toEmail(loginUser), password)
    setBusy(false)
    if (err) {
      setError(err); setShaking(true)
      setTimeout(() => setShaking(false), 600)
    } else {
      setWarping(true); playWarp()
      setTimeout(() => nav('/'), 900)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); clr(); setBusy(true); playClick()
    const { error: err } = await resetPassword(toEmail(resetEmail))
    setBusy(false)
    if (err) { setError(err); setShaking(true); setTimeout(() => setShaking(false), 600); return }
    setSuccess('Link de recuperação enviado! Verifique seu e-mail.')
  }

  // ── Theme ──────────────────────────────────────────────────────────
  const t = isDark ? {
    bgFrom: '#040a14', bgMid: '#07111f', bgTo: '#0a1628',
    cardBg: 'rgba(10,30,60,0.65)', cardBorder: 'rgba(20,184,166,0.12)',
    cardShadow: '0 0 80px rgba(20,184,166,0.08), 0 0 1px rgba(20,184,166,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
    inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.1)',
    focusBorder: 'rgba(20,184,166,0.6)', focusShadow: '0 0 4px rgba(20,184,166,0.5), 0 0 24px rgba(20,184,166,0.12)',
    text: '#ffffff', textMuted: 'rgba(255,255,255,0.55)', textDim: 'rgba(255,255,255,0.35)',
    gridOp: 0.04, ringOp: 0.12, particleOp: 0.4,
    btnGrad: 'linear-gradient(135deg, #14b8a6, #0d9488, #0f766e)',
    errorColor: '#f87171', errorBg: 'rgba(248,113,113,0.1)', errorBorder: 'rgba(248,113,113,0.2)',
    successBg: 'rgba(52,211,153,0.1)', successBorder: 'rgba(52,211,153,0.2)', successColor: '#34d399',
    linkColor: '#5eead4', footerColor: 'rgba(255,255,255,0.2)',
    backdrop: 'blur(24px) saturate(1.2)',
  } : {
    bgFrom: '#f1f5f9', bgMid: '#e2e8f0', bgTo: '#f8fafc',
    cardBg: 'rgba(255,255,255,0.75)', cardBorder: 'rgba(99,102,241,0.1)',
    cardShadow: '0 25px 60px rgba(0,0,0,0.08), 0 0 1px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
    inputBg: '#f1f5f9', inputBorder: '#cbd5e1',
    focusBorder: 'rgba(99,102,241,0.5)', focusShadow: '0 0 4px rgba(99,102,241,0.3), 0 0 20px rgba(99,102,241,0.08)',
    text: '#1e293b', textMuted: '#64748b', textDim: '#94a3b8',
    gridOp: 0.06, ringOp: 0.1, particleOp: 0.15,
    btnGrad: 'linear-gradient(135deg, #6366F1, #4F46E5, #4338CA)',
    errorColor: '#ef4444', errorBg: 'rgba(239,68,68,0.06)', errorBorder: 'rgba(239,68,68,0.15)',
    successBg: 'rgba(16,185,129,0.06)', successBorder: 'rgba(16,185,129,0.15)', successColor: '#059669',
    linkColor: '#6366f1', footerColor: '#94a3b8',
    backdrop: 'blur(16px) saturate(1.1)',
  }

  const cssVars = { '--v-focus-border': t.focusBorder, '--v-focus-shadow': t.focusShadow, '--v-text-dim': t.textDim } as React.CSSProperties

  return (
    <>
      <style>{VORTEX_CSS}</style>
      <div className="fixed inset-0 overflow-hidden" style={{ background: `radial-gradient(ellipse at 20% 50%, ${t.bgMid}, transparent 70%), radial-gradient(ellipse at 80% 20%, ${t.bgTo}, transparent 60%), ${t.bgFrom}`, ...cssVars }}>

        {/* Radial lines — dense conic gradient for depth effect */}
        <div className="fixed pointer-events-none" style={{
          left: '50%', top: '50%', width: '200vmax', height: '200vmax',
          transform: 'translate(-50%,-50%)',
          background: `repeating-conic-gradient(from 0deg, rgba(${isDark ? '20,184,166' : '99,102,241'},${isDark ? 0.04 : 0.025}) 0deg, transparent 1.2deg, transparent 3deg)`,
          animation: 'vortex-radial-rotate 120s linear infinite',
          maskImage: 'radial-gradient(ellipse at center, black 10%, transparent 65%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 10%, transparent 65%)',
        }} />

        {/* Grid sci-fi */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundSize: '60px 60px',
          backgroundImage: `linear-gradient(rgba(${isDark ? '20,184,166' : '99,102,241'},${t.gridOp}) 1px, transparent 1px), linear-gradient(90deg, rgba(${isDark ? '20,184,166' : '99,102,241'},${t.gridOp}) 1px, transparent 1px)`,
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
            border: `${ring.width}px solid rgba(${isDark ? '20,184,166' : '99,102,241'},${t.ringOp})`,
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
              background: i % 2 === 0 ? `rgba(${isDark ? '20,184,166' : '99,102,241'},${t.particleOp})` : `rgba(${isDark ? '99,200,230' : '139,92,246'},${t.particleOp})`,
              boxShadow: isDark ? `0 0 ${p.size * 2}px rgba(20,184,166,${t.particleOp * 0.5})` : undefined,
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
          background: isDark
            ? 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
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
      </div>
    </>
  )
}
