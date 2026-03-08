import {
  useState, useRef, useEffect, useCallback,
  type KeyboardEvent,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSuperTEG, type ChatMessage } from '../hooks/useSuperTEG'
import {
  Sparkles, X, RotateCcw, Send,
  BarChart3, ClipboardList, Package, Lightbulb,
  type LucideIcon,
} from 'lucide-react'

// ── Quick-action chips (Lucide icons, zero emojis) ──────────────────────────────

const QUICK_ACTIONS: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: BarChart3,     label: 'Resumo',       prompt: 'Me dê um resumo geral do sistema — KPIs e status' },
  { icon: ClipboardList, label: 'Requisições',   prompt: 'Quais requisições de compra estão abertas?' },
  { icon: Package,       label: 'Pedidos',       prompt: 'Qual o status dos pedidos em andamento?' },
  { icon: Lightbulb,     label: 'Ajuda',         prompt: 'O que você pode fazer por mim?' },
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
          <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25 group-hover:shadow-xl group-hover:shadow-teal-500/40 group-hover:scale-105 active:scale-95 transition-all duration-200">
            <Sparkles className="w-6 h-6" strokeWidth={1.8} />
          </span>
        </button>
      )}

      {/* ── Chat Panel ─────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[9999] w-full sm:w-[420px] h-[100dvh] sm:h-[640px] sm:max-h-[85vh] flex flex-col bg-white sm:rounded-2xl border border-slate-200/60 overflow-hidden"
          style={{
            animation: 'steg-slide 0.35s cubic-bezier(.22,1,.36,1)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08), 0 12px 24px -8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 shrink-0 bg-white border-b border-slate-100">
            <div className="flex items-center gap-3">
              <BotAvatar size="md" />
              <div>
                <h3 className="text-slate-800 font-semibold text-[13.5px] leading-tight tracking-[-0.01em]">
                  SuperTEG
                </h3>
                <p className="text-slate-400 text-[11px] leading-tight mt-0.5">
                  Assistente IA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={clearMessages}
                className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors duration-150"
                title="Nova conversa"
              >
                <RotateCcw className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-colors duration-150"
                title="Fechar"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/40" id="steg-msgs">
            {messages.length === 0 ? (
              <WelcomeState name={firstName} onAction={sendMessage} />
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

          {/* Quick actions (compact, visible after first message) */}
          {messages.length > 0 && !isLoading && (
            <div className="px-3 pb-1.5 pt-1.5 flex gap-1.5 overflow-x-auto shrink-0 bg-white border-t border-slate-100/60" style={{ scrollbarWidth: 'none' }}>
              {QUICK_ACTIONS.map(a => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.prompt)}
                  className="whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-500 text-[10.5px] font-medium hover:bg-teal-50 hover:text-teal-600 transition-all duration-150 shrink-0"
                >
                  <a.icon className="w-3 h-3" strokeWidth={2} />
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 shrink-0 bg-white">
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200/80 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-50 transition-all duration-200">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-transparent text-slate-700 text-[13px] placeholder-slate-400 outline-none min-w-0"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-teal-500 active:scale-90 transition-all duration-150"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={2.2} />
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-300 mt-1.5 select-none tracking-wide">
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
        @keyframes steg-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes steg-dot {
          0%, 80%, 100% { transform: scale(.6); opacity: .3; }
          40%            { transform: scale(1);  opacity: .9; }
        }
        @keyframes steg-welcome-in {
          from { opacity: 0; transform: translateY(12px) scale(.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        #steg-msgs::-webkit-scrollbar { width: 3px; }
        #steg-msgs::-webkit-scrollbar-track { background: transparent; }
        #steg-msgs::-webkit-scrollbar-thumb { background: rgba(0,0,0,.06); border-radius: 3px; }
        #steg-msgs::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.12); }
      `}</style>
    </>
  )
}

// ── Bot Avatar ──────────────────────────────────────────────────────────────────

function BotAvatar({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm:  { box: 'w-6 h-6',   icon: 'w-3 h-3',   stroke: 2.5 },
    md:  { box: 'w-8 h-8',   icon: 'w-4 h-4',   stroke: 2   },
    lg:  { box: 'w-14 h-14', icon: 'w-7 h-7',   stroke: 1.6 },
  }
  const s = sizes[size]
  return (
    <div className={`${s.box} rounded-full bg-gradient-to-br from-teal-500 to-violet-500 flex items-center justify-center shrink-0 shadow-sm`}>
      <Sparkles className={`${s.icon} text-white`} strokeWidth={s.stroke} />
    </div>
  )
}

// ── Welcome State ───────────────────────────────────────────────────────────────

function WelcomeState({ name, onAction }: { name: string; onAction: (p: string) => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      style={{ animation: 'steg-welcome-in 0.5s ease-out both' }}
    >
      <div className="mb-5">
        <BotAvatar size="lg" />
      </div>

      <h4 className="text-slate-800 font-semibold text-lg mb-1 tracking-[-0.02em]">
        Olá, {name}!
      </h4>
      <p className="text-slate-400 text-[13px] mb-8 max-w-[280px] leading-relaxed">
        Sou o SuperTEG, seu assistente inteligente. Posso navegar pelo sistema,
        consultar dados e registrar problemas.
      </p>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[300px]">
        {QUICK_ACTIONS.map((a, i) => (
          <button
            key={a.label}
            onClick={() => onAction(a.prompt)}
            className="group flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-white border border-slate-200 text-left hover:border-teal-200 hover:bg-teal-50/30 active:scale-[0.98] transition-all duration-200"
            style={{ animation: `steg-msg-in 0.4s ease-out ${0.15 + i * 0.07}s both` }}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100/80 flex items-center justify-center shrink-0 group-hover:bg-teal-100/60 transition-colors duration-200">
              <a.icon className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors duration-200" strokeWidth={1.8} />
            </div>
            <span className="text-slate-600 text-[12px] font-medium leading-tight group-hover:text-slate-700 transition-colors duration-200">
              {a.label}
            </span>
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
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animation: 'steg-msg-in 0.3s ease-out both' }}
    >
      {!isUser && (
        <div className="mr-2 mt-1">
          <BotAvatar size="sm" />
        </div>
      )}
      <div
        className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-teal-600 text-white rounded-2xl rounded-br-md shadow-sm shadow-teal-600/10'
            : 'bg-white text-slate-600 border border-slate-100 rounded-2xl rounded-bl-md shadow-sm shadow-black/[.02]'
        }`}
      >
        <Content text={msg.content} onNav={onNav} isUser={isUser} />
      </div>
    </div>
  )
}

// ── Content Renderer (handles code blocks, headers, markdown links + bold) ─────

function Content({ text, onNav, isUser }: { text: string; onNav: (p: string) => void; isUser: boolean }) {
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
          <pre key={i} className="my-2 p-3 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {part.lang && (
              <span className="block text-[9px] text-slate-500 mb-1.5 uppercase tracking-wider font-sans">{part.lang}</span>
            )}
            {part.content}
          </pre>
        ) : (
          <span key={i}>
            {part.content.split('\n').map((line, j) => {
              const h3 = line.match(/^###\s+(.+)/)
              const h2 = line.match(/^##\s+(.+)/)
              if (h3) return <p key={j} className={`font-semibold text-[13px] mt-1.5 mb-0.5 ${isUser ? 'text-white/90' : 'text-slate-700'}`}>{h3[1]}</p>
              if (h2) return <p key={j} className={`font-bold text-[14px] mt-2 mb-1 ${isUser ? 'text-white' : 'text-slate-800'}`}>{h2[1]}</p>
              return <span key={j}>{j > 0 && <br />}<Line line={line} onNav={onNav} isUser={isUser} /></span>
            })}
          </span>
        )
      )}
    </>
  )
}

function Line({ line, onNav, isUser }: { line: string; onNav: (p: string) => void; isUser: boolean }) {
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
              className={`inline font-semibold underline underline-offset-2 transition-colors duration-150 ${
                isUser
                  ? 'text-white/90 decoration-white/40 hover:decoration-white/70'
                  : 'text-teal-600 decoration-teal-300/40 hover:text-teal-500 hover:decoration-teal-400/60'
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
              className={`inline underline underline-offset-2 transition-colors duration-150 ${
                isUser
                  ? 'text-white/90 decoration-white/40 hover:decoration-white/70'
                  : 'text-teal-600 decoration-teal-300/40 hover:text-teal-500 hover:decoration-teal-400/60'
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
    <div className="flex justify-start" style={{ animation: 'steg-msg-in 0.3s ease-out both' }}>
      <div className="mr-2 mt-1">
        <BotAvatar size="sm" />
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5 shadow-sm shadow-black/[.02]">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-teal-400"
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
