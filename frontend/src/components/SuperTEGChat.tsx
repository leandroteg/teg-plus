import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSuperTEG, type ChatMessage } from '../hooks/useSuperTEG'

// ── Quick-action chips ──────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { emoji: '📊', label: 'Resumo',     prompt: 'Me dê um resumo geral do sistema — KPIs e status' },
  { emoji: '📋', label: 'Requisições', prompt: 'Quais requisições de compra estão abertas?' },
  { emoji: '📦', label: 'Pedidos',     prompt: 'Qual o status dos pedidos em andamento?' },
  { emoji: '💡', label: 'Ajuda',       prompt: 'O que você pode fazer por mim?' },
]

// ── Main Component ──────────────────────────────────────────────────────────────

export default function SuperTEGChat() {
  const { perfil }    = useAuth()
  const navigate      = useNavigate()
  const location      = useLocation()
  const [isOpen, setIsOpen]   = useState(false)
  const [input, setInput]     = useState('')
  const { messages, isLoading, sendMessage, clearMessages } = useSuperTEG()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  /* auto-scroll on new messages */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  /* focus input on open */
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const nav = useCallback((path: string) => {
    navigate(path)
    setIsOpen(false)
  }, [navigate])

  /* hide for unauthenticated / login page */
  if (!perfil || location.pathname === '/login' || location.pathname === '/nova-senha') return null

  const firstName = perfil.nome?.split(' ')[0] || 'Usuário'

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] group"
          aria-label="Abrir SuperTEG"
        >
          <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
          <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-110 active:scale-95 transition-all duration-200">
            <span className="text-2xl select-none">🦸‍♂️</span>
          </span>
        </button>
      )}

      {/* ── Chat Panel ─────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[9999] w-full sm:w-[400px] h-[100dvh] sm:h-[620px] sm:max-h-[85vh] flex flex-col bg-[#0c0f1a]/[.97] backdrop-blur-2xl sm:rounded-2xl border border-white/[.08] shadow-2xl shadow-black/50 overflow-hidden"
          style={{ animation: 'steg-slide 0.3s cubic-bezier(.22,1,.36,1)' }}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between px-4 py-3 shrink-0 overflow-hidden">
            {/* gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,.12),transparent_60%)]" />

            <div className="relative flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg ring-2 ring-white/10">
                🦸‍♂️
              </div>
              <div>
                <h3 className="text-white font-semibold text-[13px] leading-tight tracking-wide">
                  SuperTEG
                </h3>
                <p className="text-white/60 text-[11px]">Assistente Inteligente</p>
              </div>
            </div>

            <div className="relative flex items-center gap-0.5">
              <button
                onClick={clearMessages}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Nova conversa"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" id="steg-msgs">
            {messages.length === 0 ? (
              <WelcomeState
                name={firstName}
                onAction={sendMessage}
              />
            ) : (
              <>
                {messages.map(m => (
                  <Bubble key={m.id} msg={m} onNav={nav} />
                ))}
                {isLoading && <Typing />}
                <div ref={scrollRef} />
              </>
            )}
          </div>

          {/* Quick actions (compact, after first message) */}
          {messages.length > 0 && !isLoading && (
            <div className="px-3 pb-1.5 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.prompt)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/[.04] border border-white/[.06] text-slate-400 text-[10px] hover:bg-white/[.08] hover:text-slate-200 transition-all shrink-0"
                >
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 shrink-0">
            <div className="flex items-center gap-2 bg-white/[.04] rounded-xl px-3 py-2 border border-white/[.08] focus-within:border-indigo-500/40 focus-within:bg-white/[.06] transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-500 outline-none min-w-0"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 disabled:opacity-20 disabled:cursor-not-allowed hover:from-indigo-500 hover:to-violet-500 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-600 mt-1.5 select-none">
              SuperTEG · Powered by AI
            </p>
          </div>
        </div>
      )}

      {/* ── Keyframes ──────────────────────────────────────── */}
      <style>{`
        @keyframes steg-slide {
          from { opacity: 0; transform: translateY(16px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes steg-dot {
          0%, 80%, 100% { transform: scale(.5); opacity: .35; }
          40%            { transform: scale(1);  opacity: 1;   }
        }
        #steg-msgs::-webkit-scrollbar { width: 4px; }
        #steg-msgs::-webkit-scrollbar-track { background: transparent; }
        #steg-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 4px; }
        #steg-msgs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.15); }
      `}</style>
    </>
  )
}

// ── Welcome State ───────────────────────────────────────────────────────────────

function WelcomeState({ name, onAction }: { name: string; onAction: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/20 flex items-center justify-center text-3xl mb-5 shadow-lg shadow-indigo-500/5">
        🦸‍♂️
      </div>
      <h4 className="text-white font-semibold text-lg mb-1 tracking-tight">
        Olá, {name}!
      </h4>
      <p className="text-slate-400 text-sm mb-8 max-w-[280px] leading-relaxed">
        Sou o SuperTEG, seu assistente inteligente. Posso navegar pelo sistema,
        consultar dados e registrar problemas.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => onAction(a.prompt)}
            className="px-3.5 py-2 rounded-xl bg-white/[.04] border border-white/[.08] text-slate-300 text-xs hover:bg-indigo-600/10 hover:border-indigo-500/25 hover:text-white transition-all duration-200"
          >
            <span className="mr-1">{a.emoji}</span>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Message Bubble ──────────────────────────────────────────────────────────────

function Bubble({ msg, onNav }: { msg: ChatMessage; onNav: (p: string) => void }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600/30 to-violet-600/30 border border-indigo-500/20 flex items-center justify-center text-[10px] mr-2 mt-1 shrink-0 select-none">
          🦸
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl rounded-br-md shadow-md shadow-indigo-500/10'
            : 'bg-white/[.05] text-slate-200 border border-white/[.06] rounded-2xl rounded-bl-md'
        }`}
      >
        <Content text={msg.content} onNav={onNav} isUser={isUser} />
      </div>
    </div>
  )
}

// ── Content Renderer (handles code blocks, headers, markdown links + bold) ───────

function Content({ text, onNav, isUser }: { text: string; onNav: (p: string) => void; isUser: boolean }) {
  // Separar code blocks do texto normal usando matchAll
  const codePattern = /```(\w*)\n?([\s\S]*?)```/g
  const parts: Array<{ kind: 'text' | 'code'; content: string; lang?: string }> = []
  let cursor = 0
  for (const m of text.matchAll(codePattern)) {
    if (m.index! > cursor) parts.push({ kind: 'text', content: text.slice(cursor, m.index) })
    parts.push({ kind: 'code', content: m[2].trim(), lang: m[1] || undefined })
    cursor = m.index! + m[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', content: text.slice(cursor) })

  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'code' ? (
          <pre key={i} className="my-2 p-3 rounded-xl bg-black/40 border border-white/10 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {part.lang && (
              <span className="block text-[9px] text-slate-500 mb-1.5 uppercase tracking-wider">{part.lang}</span>
            )}
            {part.content}
          </pre>
        ) : (
          <span key={i}>
            {part.content.split('\n').map((line, j) => {
              const h2 = line.match(/^##\s+(.+)/)
              const h3 = line.match(/^###\s+(.+)/)
              if (h2) return <p key={j} className="font-bold text-white/90 text-[14px] mt-2 mb-1">{h2[1]}</p>
              if (h3) return <p key={j} className="font-semibold text-white/80 text-[13px] mt-1.5 mb-0.5">{h3[1]}</p>
              return <span key={j}>{j > 0 && <br />}<Line line={line} onNav={onNav} isUser={isUser} /></span>
            })}
          </span>
        )
      )}
    </>
  )
}

function Line({ line, onNav, isUser }: { line: string; onNav: (p: string) => void; isUser: boolean }) {
  /* split by: **[text](url)**, [text](url), **text** */
  const tokens = line.split(/(\*\*\[.*?\]\(.*?\)\*\*|\[.*?\]\(.*?\)|\*\*.*?\*\*)/g)

  return (
    <>
      {tokens.map((tok, i) => {
        /* bold link: **[text](url)** */
        const blink = tok.match(/\*\*\[(.*?)\]\((.*?)\)\*\*/)
        if (blink) {
          return (
            <button
              key={i}
              onClick={() => blink[2].startsWith('/') ? onNav(blink[2]) : window.open(blink[2], '_blank')}
              className={`inline font-semibold underline underline-offset-2 transition-colors ${
                isUser
                  ? 'text-white/90 decoration-white/40 hover:decoration-white/70'
                  : 'text-indigo-300 decoration-indigo-400/30 hover:text-indigo-200 hover:decoration-indigo-300/60'
              }`}
            >
              {blink[1]}
            </button>
          )
        }

        /* regular link: [text](url) */
        const link = tok.match(/\[(.*?)\]\((.*?)\)/)
        if (link) {
          return (
            <button
              key={i}
              onClick={() => link[2].startsWith('/') ? onNav(link[2]) : window.open(link[2], '_blank')}
              className={`inline underline underline-offset-2 transition-colors ${
                isUser
                  ? 'text-white/90 decoration-white/40 hover:decoration-white/70'
                  : 'text-indigo-300 decoration-indigo-400/30 hover:text-indigo-200 hover:decoration-indigo-300/60'
              }`}
            >
              {link[1]}
            </button>
          )
        }

        /* bold: **text** */
        const bold = tok.match(/\*\*(.*?)\*\*/)
        if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>

        return <span key={i}>{tok}</span>
      })}
    </>
  )
}

// ── Typing Indicator ────────────────────────────────────────────────────────────

function Typing() {
  return (
    <div className="flex justify-start">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600/30 to-violet-600/30 border border-indigo-500/20 flex items-center justify-center text-[10px] mr-2 mt-1 shrink-0 select-none">
        🦸
      </div>
      <div className="bg-white/[.05] border border-white/[.06] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-indigo-400"
            style={{
              animation: 'steg-dot 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
