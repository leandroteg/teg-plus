// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/Endomarketing.tsx — Endomarketing: Comunicados + Identidade Visual
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react'
import {
  Megaphone, Cake, UserPlus, Trophy, Calendar, GraduationCap,
  ShieldAlert, TrendingUp, Sparkles, Pencil, ArrowLeft, ArrowRight,
  Download, Save, CheckCircle2, Trash2, Plus, X, Image as ImageIcon,
  Upload, Eye, Palette, History, FileText, XCircle, Search,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useIdentidadeVisual, useSalvarIdentidadeVisual, useUploadLogo,
  useComunicados, useSalvarComunicado, useExcluirComunicado,
  useUploadComunicadoImagem, useGerarImagemIA,
  type GerarComunicadoResponse,
} from '../../hooks/useEndomarketing'
import type { TipoComunicado, FormatoComunicado, IdentidadeVisual } from '../../types/rh'

// ── Constantes ──────────────────────────────────────────────────────────────

const TIPOS: { value: TipoComunicado; label: string; icon: typeof Megaphone; placeholder: string }[] = [
  { value: 'aviso_geral',       label: 'Aviso Geral',       icon: Megaphone,    placeholder: 'Descreva o aviso que deseja comunicar...' },
  { value: 'aniversariante',    label: 'Aniversariante',    icon: Cake,         placeholder: 'Nome do aniversariante, data, mensagem...' },
  { value: 'boas_vindas',       label: 'Boas-vindas',       icon: UserPlus,     placeholder: 'Nome do novo colaborador, cargo, equipe...' },
  { value: 'reconhecimento',    label: 'Reconhecimento',    icon: Trophy,       placeholder: 'Quem sera reconhecido, motivo, conquista...' },
  { value: 'evento',            label: 'Evento',            icon: Calendar,     placeholder: 'Nome do evento, data, local, detalhes...' },
  { value: 'treinamento',       label: 'Treinamento',       icon: GraduationCap, placeholder: 'Tema do treinamento, data, publico-alvo...' },
  { value: 'seguranca',         label: 'Seguranca',         icon: ShieldAlert,  placeholder: 'Assunto de seguranca, orientacoes, alerta...' },
  { value: 'resultado',         label: 'Resultado',         icon: TrendingUp,   placeholder: 'Resultado alcancado, numeros, equipe...' },
  { value: 'campanha_interna',  label: 'Campanha',          icon: Sparkles,     placeholder: 'Tema da campanha, periodo, instrucoes...' },
  { value: 'personalizado',     label: 'Personalizado',     icon: Pencil,       placeholder: 'Descreva livremente o comunicado desejado...' },
]

const FORMATOS: { value: FormatoComunicado; label: string; dims: string; w: number; h: number; aspect: string }[] = [
  { value: 'story',    label: 'Story',     dims: '1080 x 1920', w: 1080, h: 1920, aspect: '9/16' },
  { value: 'feed',     label: 'Feed',      dims: '1080 x 1080', w: 1080, h: 1080, aspect: '1/1' },
  { value: 'paisagem', label: 'Paisagem',  dims: '1920 x 1080', w: 1920, h: 1080, aspect: '16/9' },
  { value: 'a4',       label: 'A4',        dims: '2480 x 3508', w: 2480, h: 3508, aspect: '210/297' },
]

const FONTES_TITULO = ['Montserrat', 'Poppins', 'Roboto', 'Inter', 'Playfair Display', 'Raleway']
const FONTES_CORPO  = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Source Sans Pro']

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  aviso_geral:      { bg: 'bg-blue-500/15 border-blue-500/30',     text: 'text-blue-300' },
  aniversariante:   { bg: 'bg-pink-500/15 border-pink-500/30',     text: 'text-pink-300' },
  boas_vindas:      { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300' },
  reconhecimento:   { bg: 'bg-amber-500/15 border-amber-500/30',   text: 'text-amber-300' },
  evento:           { bg: 'bg-violet-500/15 border-violet-500/30', text: 'text-violet-300' },
  treinamento:      { bg: 'bg-cyan-500/15 border-cyan-500/30',     text: 'text-cyan-300' },
  seguranca:        { bg: 'bg-red-500/15 border-red-500/30',       text: 'text-red-300' },
  resultado:        { bg: 'bg-teal-500/15 border-teal-500/30',     text: 'text-teal-300' },
  campanha_interna: { bg: 'bg-indigo-500/15 border-indigo-500/30', text: 'text-indigo-300' },
  personalizado:    { bg: 'bg-slate-500/15 border-slate-500/30',   text: 'text-slate-300' },
}

const DEFAULT_IDENTIDADE: IdentidadeVisual = {
  id: '',
  logo_url: null,
  cor_primaria: '#6366f1',
  cor_secundaria: '#8b5cf6',
  cor_fundo: '#ffffff',
  cor_texto: '#1e293b',
  fonte_titulo: 'Montserrat',
  fonte_corpo: 'Inter',
  slogan: null,
  updated_at: '',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Template de Comunicado (renderizado em HTML para captura) ────────────────

interface TemplateProps {
  formato: FormatoComunicado
  texto: GerarComunicadoResponse
  identidade: IdentidadeVisual
  templateRef: React.RefObject<HTMLDivElement | null>
}

function ComunicadoTemplate({ formato, texto, identidade, templateRef }: TemplateProps) {
  const iv = identidade
  const fmt = FORMATOS.find(f => f.value === formato)!
  // scale down for preview
  const maxPreviewW = 480
  const scale = Math.min(maxPreviewW / fmt.w, 1)
  const previewW = fmt.w * scale
  const previewH = fmt.h * scale

  const baseStyle: React.CSSProperties = {
    width: fmt.w,
    height: fmt.h,
    backgroundColor: iv.cor_fundo,
    color: iv.cor_texto,
    fontFamily: `'${iv.fonte_corpo}', sans-serif`,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }

  const titleStyle: React.CSSProperties = {
    fontFamily: `'${iv.fonte_titulo}', sans-serif`,
    fontWeight: 800,
    color: iv.cor_primaria,
    lineHeight: 1.15,
  }

  const subtitleStyle: React.CSSProperties = {
    color: iv.cor_secundaria,
    fontWeight: 600,
  }

  const accentBar: React.CSSProperties = {
    background: `linear-gradient(135deg, ${iv.cor_primaria}, ${iv.cor_secundaria})`,
  }

  const renderContent = () => {
    switch (formato) {
      case 'feed':
        return (
          <div style={baseStyle}>
            {/* Top accent */}
            <div style={{ ...accentBar, height: 12, width: '100%' }} />
            {/* Logo */}
            {iv.logo_url && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0 24px' }}>
                <img src={iv.logo_url} alt="logo" style={{ height: 80, objectFit: 'contain' }} crossOrigin="anonymous" />
              </div>
            )}
            {/* Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 64px', textAlign: 'center', gap: 24 }}>
              <h1 style={{ ...titleStyle, fontSize: 56 }}>{texto.titulo}</h1>
              {texto.subtitulo && <p style={{ ...subtitleStyle, fontSize: 28 }}>{texto.subtitulo}</p>}
              <p style={{ fontSize: 24, lineHeight: 1.6, opacity: 0.85 }}>{texto.corpo}</p>
              {texto.destaques.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 }}>
                  {texto.destaques.map((d, i) => (
                    <span key={i} style={{ background: iv.cor_primaria + '20', color: iv.cor_primaria, padding: '8px 20px', borderRadius: 999, fontSize: 20, fontWeight: 600 }}>{d}</span>
                  ))}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ ...accentBar, padding: '16px 64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{texto.rodape}</span>
              {iv.slogan && <span style={{ color: '#fff', fontSize: 14, opacity: 0.8 }}>{iv.slogan}</span>}
            </div>
          </div>
        )

      case 'story':
        return (
          <div style={{ ...baseStyle, background: `linear-gradient(180deg, ${iv.cor_primaria}15, ${iv.cor_fundo}, ${iv.cor_secundaria}15)` }}>
            {/* Logo */}
            {iv.logo_url && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0 40px' }}>
                <img src={iv.logo_url} alt="logo" style={{ height: 80, objectFit: 'contain' }} crossOrigin="anonymous" />
              </div>
            )}
            {/* Title top-third */}
            <div style={{ padding: '40px 64px', textAlign: 'center' }}>
              <h1 style={{ ...titleStyle, fontSize: 72 }}>{texto.titulo}</h1>
              {texto.subtitulo && <p style={{ ...subtitleStyle, fontSize: 32, marginTop: 20 }}>{texto.subtitulo}</p>}
            </div>
            {/* Body center */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 64px' }}>
              <p style={{ fontSize: 28, lineHeight: 1.7, textAlign: 'center', opacity: 0.85 }}>{texto.corpo}</p>
            </div>
            {/* Destaques bottom-third */}
            {texto.destaques.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '0 64px 40px' }}>
                {texto.destaques.map((d, i) => (
                  <span key={i} style={{ background: iv.cor_primaria + '20', color: iv.cor_primaria, padding: '10px 28px', borderRadius: 999, fontSize: 22, fontWeight: 600 }}>{d}</span>
                ))}
              </div>
            )}
            {/* Footer */}
            <div style={{ ...accentBar, padding: '24px 64px', textAlign: 'center' }}>
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 600 }}>{texto.rodape}</span>
            </div>
          </div>
        )

      case 'paisagem':
        return (
          <div style={{ ...baseStyle, flexDirection: 'row' }}>
            {/* Left side text */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 80px', gap: 28 }}>
              {iv.logo_url && <img src={iv.logo_url} alt="logo" style={{ height: 60, objectFit: 'contain', alignSelf: 'flex-start' }} crossOrigin="anonymous" />}
              <h1 style={{ ...titleStyle, fontSize: 56 }}>{texto.titulo}</h1>
              {texto.subtitulo && <p style={{ ...subtitleStyle, fontSize: 26 }}>{texto.subtitulo}</p>}
              <p style={{ fontSize: 22, lineHeight: 1.6, opacity: 0.85 }}>{texto.corpo}</p>
              {texto.destaques.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {texto.destaques.map((d, i) => (
                    <span key={i} style={{ background: iv.cor_primaria + '20', color: iv.cor_primaria, padding: '6px 16px', borderRadius: 999, fontSize: 18, fontWeight: 600 }}>{d}</span>
                  ))}
                </div>
              )}
              <span style={{ fontSize: 16, opacity: 0.6, marginTop: 8 }}>{texto.rodape}</span>
            </div>
            {/* Right side accent */}
            <div style={{ width: '35%', background: `linear-gradient(135deg, ${iv.cor_primaria}, ${iv.cor_secundaria})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {iv.slogan && <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, textAlign: 'center', padding: 40, lineHeight: 1.4 }}>{iv.slogan}</p>}
            </div>
          </div>
        )

      case 'a4':
        return (
          <div style={baseStyle}>
            {/* Header */}
            <div style={{ ...accentBar, padding: '48px 80px', display: 'flex', alignItems: 'center', gap: 32 }}>
              {iv.logo_url && <img src={iv.logo_url} alt="logo" style={{ height: 64, objectFit: 'contain' }} crossOrigin="anonymous" />}
              <div>
                <h1 style={{ color: '#fff', fontFamily: `'${iv.fonte_titulo}', sans-serif`, fontSize: 48, fontWeight: 800 }}>{texto.titulo}</h1>
                {texto.subtitulo && <p style={{ color: '#ffffffcc', fontSize: 24, marginTop: 4 }}>{texto.subtitulo}</p>}
              </div>
            </div>
            {/* Body */}
            <div style={{ flex: 1, padding: '64px 80px', display: 'flex', flexDirection: 'column', gap: 40 }}>
              <p style={{ fontSize: 26, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{texto.corpo}</p>
              {texto.destaques.length > 0 && (
                <div style={{ padding: 32, borderLeft: `4px solid ${iv.cor_primaria}`, background: iv.cor_primaria + '08' }}>
                  <p style={{ fontWeight: 700, fontSize: 22, marginBottom: 16, color: iv.cor_primaria }}>Destaques:</p>
                  <ul style={{ margin: 0, paddingLeft: 24, fontSize: 22, lineHeight: 2 }}>
                    {texto.destaques.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '32px 80px', borderTop: `2px solid ${iv.cor_primaria}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, opacity: 0.6 }}>{texto.rodape}</span>
              {iv.slogan && <span style={{ fontSize: 16, opacity: 0.5, fontStyle: 'italic' }}>{iv.slogan}</span>}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="overflow-auto styled-scrollbar flex justify-center">
      <div style={{ width: previewW, height: previewH, overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <div ref={templateRef}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Gerar Comunicado (Wizard) ──────────────────────────────────────────

function TabGerarComunicado({ identidade }: { identidade: IdentidadeVisual }) {
  const { isLightSidebar: isLight } = useTheme()
  const [step, setStep] = useState(1)

  // Step 1
  const [tipo, setTipo] = useState<TipoComunicado>('aviso_geral')
  const [formato, setFormato] = useState<FormatoComunicado>('feed')

  // Step 2 — modo
  const [modo, setModo] = useState<'template' | 'ia'>('template')

  // Step 3a — Template: campos manuais
  const [texto, setTexto] = useState<GerarComunicadoResponse>({
    titulo: '', subtitulo: '', corpo: '', destaques: [], rodape: '',
  })

  // Step 3b — IA: instrucoes livres
  const [instrucoes, setInstrucoes] = useState('')
  const [incluirLogo, setIncluirLogo] = useState(true)
  const gerarImagemIA = useGerarImagemIA()
  const [imagemGeradaUrl, setImagemGeradaUrl] = useState('')
  const [imagemGeradaTexto, setImagemGeradaTexto] = useState('')
  const [imagemGeradaFooter, setImagemGeradaFooter] = useState('')
  const [imagemGeradaCor1, setImagemGeradaCor1] = useState('')
  const [imagemGeradaCor2, setImagemGeradaCor2] = useState('')
  const iaCompositeRef = useRef<HTMLDivElement | null>(null)

  // Step 4 shared
  const templateRef = useRef<HTMLDivElement | null>(null)
  const salvarCom = useSalvarComunicado()
  const uploadImg = useUploadComunicadoImagem()
  const [saved, setSaved] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saving, setSaving] = useState(false)

  const tipoInfo = TIPOS.find(t => t.value === tipo)!
  const fmtInfo = FORMATOS.find(f => f.value === formato)!

  const inp = isLight
    ? 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50'
    : 'w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50'

  async function handleGerarImagemIAClick() {
    const result = await gerarImagemIA.mutateAsync({
      tipo,
      tipo_label: tipoInfo.label,
      formato,
      formato_label: fmtInfo.label,
      dimensoes: fmtInfo.dims,
      instrucoes,
      identidade: {
        nome_empresa: 'TEG União Energia',
        slogan: identidade.slogan ?? null,
        cor_primaria: identidade.cor_primaria,
        cor_secundaria: identidade.cor_secundaria,
        logo_url: identidade.logo_url ?? null,
      },
    })
    setImagemGeradaUrl(result.imagem_url)
    setImagemGeradaTexto(result.instrucoes || instrucoes)
    setImagemGeradaFooter(result.footer_text || '')
    setImagemGeradaCor1(result.cor_primaria || identidade.cor_primaria)
    setImagemGeradaCor2(result.cor_secundaria || identidade.cor_secundaria)
    setStep(4)
  }

  async function captureCanvas(): Promise<HTMLCanvasElement | null> {
    if (!templateRef.current) return null
    // Target the actual content div (has explicit w/h), not the wrapper
    const target = (templateRef.current.firstElementChild as HTMLElement) ?? templateRef.current
    const fmt = FORMATOS.find(f => f.value === formato)!
    // Wait for Google Fonts to finish loading before capture
    await document.fonts.ready
    const html2canvas = (await import('html2canvas')).default
    return html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: identidade.cor_fundo,
      width: fmt.w,
      height: fmt.h,
      windowWidth: fmt.w,
      windowHeight: fmt.h,
      logging: false,
      ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore'),
    })
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) return
      const link = document.createElement('a')
      link.download = `comunicado-${tipo}-${formato}-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  async function handleSalvar() {
    setSaving(true)
    try {
      const canvas = await captureCanvas()
      if (!canvas) return
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png')
      })
      const imagemUrl = await uploadImg.mutateAsync(blob)
      await salvarCom.mutateAsync({
        tipo,
        formato,
        titulo: texto.titulo,
        subtitulo: texto.subtitulo || null,
        conteudo_texto: texto.corpo,
        conteudo_html: null,
        imagem_url: imagemUrl,
        largura: fmtInfo.w,
        altura: fmtInfo.h,
        input_usuario: null,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleSalvarImagemIA() {
    setSaving(true)
    try {
      // Capture the composite (background + text overlay) using html2canvas
      let finalUrl = imagemGeradaUrl
      if (iaCompositeRef.current) {
        try {
          const { default: html2canvas } = await import('html2canvas')
          const canvas = await html2canvas(iaCompositeRef.current, {
            useCORS: true,
            allowTaint: false,
            scale: 2,
            width: iaCompositeRef.current.offsetWidth,
            height: iaCompositeRef.current.offsetHeight,
          })
          const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
          finalUrl = await uploadImg.mutateAsync(blob)
        } catch {
          // fallback to background URL if canvas fails
        }
      }
      await salvarCom.mutateAsync({
        tipo,
        formato,
        titulo: tipoInfo.label,
        imagem_url: finalUrl,
        largura: fmtInfo.w,
        altura: fmtInfo.h,
        input_usuario: instrucoes,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  function handleNovoDestaque() {
    setTexto(t => ({ ...t, destaques: [...t.destaques, ''] }))
  }
  function handleRemoveDestaque(i: number) {
    setTexto(t => ({ ...t, destaques: t.destaques.filter((_, idx) => idx !== i) }))
  }
  function handleDestaqueChange(i: number, val: string) {
    setTexto(t => ({ ...t, destaques: t.destaques.map((d, idx) => idx === i ? val : d) }))
  }

  // ── Step indicators ──
  const steps = [
    { n: 1, label: 'Tipo + Formato' },
    { n: 2, label: 'Modo' },
    { n: 3, label: modo === 'ia' ? 'Instrucoes' : 'Conteudo' },
    { n: 4, label: 'Imagem' },
  ]

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => s.n < step && setStep(s.n)}
              disabled={s.n > step}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                s.n === step
                  ? 'bg-indigo-600 text-white'
                  : s.n < step
                    ? isLight ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'
                    : isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                s.n === step ? 'bg-white/20' : s.n < step ? isLight ? 'bg-indigo-200' : 'bg-indigo-500/30' : isLight ? 'bg-slate-200' : 'bg-white/10'
              }`}>{s.n < step ? '\u2713' : s.n}</span>
              {s.label}
            </button>
            {i < steps.length - 1 && <div className={`w-6 h-px ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Tipo + Formato */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className={`text-xs font-semibold mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tipo de Comunicado</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {TIPOS.map(t => {
                const sel = tipo === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => setTipo(t.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center ${
                      sel
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : isLight
                          ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm text-slate-700'
                          : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/40 hover:bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <t.icon size={20} className={sel ? 'text-white' : 'text-indigo-400'} />
                    <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className={`text-xs font-semibold mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Formato</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FORMATOS.map(f => {
                const sel = formato === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => setFormato(f.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                      sel
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : isLight
                          ? 'border-slate-200 bg-white hover:border-indigo-300 text-slate-700'
                          : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/40 text-slate-300'
                    }`}
                  >
                    <div
                      className={`border-2 rounded-lg ${sel ? 'border-white/50' : isLight ? 'border-slate-300' : 'border-white/20'}`}
                      style={{
                        aspectRatio: f.aspect,
                        width: f.value === 'story' ? 28 : f.value === 'a4' ? 30 : 44,
                      }}
                    />
                    <span className="text-xs font-bold">{f.label}</span>
                    <span className={`text-[10px] ${sel ? 'text-white/70' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>{f.dims}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
            >
              Proximo <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Seletor de Modo */}
      {step === 2 && (
        <div className="space-y-4">
          <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Como deseja criar o comunicado?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Usar Template */}
            <button
              onClick={() => setModo('template')}
              className={`flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-all ${
                modo === 'template'
                  ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : isLight
                    ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                    : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                modo === 'template' ? 'bg-white/20' : isLight ? 'bg-indigo-50' : 'bg-indigo-500/15'
              }`}>
                <FileText size={20} className={modo === 'template' ? 'text-white' : 'text-indigo-400'} />
              </div>
              <div>
                <p className={`text-sm font-bold ${modo === 'template' ? 'text-white' : isLight ? 'text-slate-800' : 'text-white'}`}>
                  Usar Template
                </p>
                <p className={`text-[11px] mt-0.5 ${modo === 'template' ? 'text-white/70' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Preencha os campos manualmente e visualize o layout antes de salvar.
                </p>
              </div>
            </button>

            {/* Gerar com IA */}
            <button
              onClick={() => setModo('ia')}
              className={`flex flex-col items-start gap-3 p-5 rounded-2xl border text-left transition-all ${
                modo === 'ia'
                  ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : isLight
                    ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                    : 'border-white/10 bg-white/[0.03] hover:border-indigo-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                modo === 'ia' ? 'bg-white/20' : isLight ? 'bg-indigo-50' : 'bg-indigo-500/15'
              }`}>
                <Sparkles size={20} className={modo === 'ia' ? 'text-white' : 'text-indigo-400'} />
              </div>
              <div>
                <p className={`text-sm font-bold ${modo === 'ia' ? 'text-white' : isLight ? 'text-slate-800' : 'text-white'}`}>
                  Gerar com IA
                </p>
                <p className={`text-[11px] mt-0.5 ${modo === 'ia' ? 'text-white/70' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Descreva o que deseja e a IA gera a imagem completa com a identidade visual da empresa.
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              <ArrowLeft size={15} /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
            >
              Proximo <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3a: Template — campos manuais */}
      {step === 3 && modo === 'template' && (
        <div className="space-y-4">
          <div className={`p-5 rounded-2xl border space-y-4 ${isLight ? 'bg-white border-slate-200' : 'glass-card'}`}>
            <div>
              <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Titulo</label>
              <input className={inp} value={texto.titulo} onChange={e => setTexto(t => ({ ...t, titulo: e.target.value }))} placeholder="Ex: Parabéns, Maria!" />
            </div>
            <div>
              <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Subtitulo</label>
              <input className={inp} value={texto.subtitulo} onChange={e => setTexto(t => ({ ...t, subtitulo: e.target.value }))} placeholder="Ex: 5 anos de empresa" />
            </div>
            <div>
              <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Corpo</label>
              <textarea className={`${inp} min-h-[100px] resize-y`} value={texto.corpo} onChange={e => setTexto(t => ({ ...t, corpo: e.target.value }))} placeholder="Texto principal do comunicado..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-[11px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Destaques</label>
                <button onClick={handleNovoDestaque} className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold">
                  <Plus size={11} /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {texto.destaques.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={`${inp} flex-1`} value={d} onChange={e => handleDestaqueChange(i, e.target.value)} placeholder={`Destaque ${i + 1}`} />
                    <button onClick={() => handleRemoveDestaque(i)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rodape</label>
              <input className={inp} value={texto.rodape} onChange={e => setTexto(t => ({ ...t, rodape: e.target.value }))} placeholder="Ex: TEG União Energia" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              <ArrowLeft size={15} /> Voltar
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!texto.titulo.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-50"
            >
              <Palette size={15} /> Visualizar
            </button>
          </div>
        </div>
      )}

      {/* Step 3b: IA — instrucoes + gerar imagem */}
      {step === 3 && modo === 'ia' && (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'glass-card'}`}>
            <label className={`text-xs font-semibold block mb-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Descreva o comunicado que deseja gerar
            </label>
            <textarea
              className={`${inp} min-h-[160px] resize-y`}
              value={instrucoes}
              onChange={e => setInstrucoes(e.target.value)}
              placeholder={tipoInfo.placeholder}
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {instrucoes.length} caracteres
              </span>
              <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                A IA usará as cores e identidade visual da empresa automaticamente.
              </span>
            </div>
          </div>

          {/* Toggle: Incluir Logo */}
          {identidade.logo_url && (
            <button
              type="button"
              onClick={() => setIncluirLogo(v => !v)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-colors ${
                incluirLogo
                  ? isLight ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/30'
                  : isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'glass-card hover:bg-white/5'
              }`}
            >
              {/* Switch visual */}
              <div className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${incluirLogo ? 'bg-indigo-500' : isLight ? 'bg-slate-300' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${incluirLogo ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <img src={identidade.logo_url} alt="Logo" className="h-5 object-contain opacity-80" />
              <span className={`text-xs font-semibold ${incluirLogo ? isLight ? 'text-indigo-700' : 'text-indigo-300' : isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Incluir logo no comunicado
              </span>
            </button>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              <ArrowLeft size={15} /> Voltar
            </button>
            <button
              onClick={handleGerarImagemIAClick}
              disabled={!instrucoes.trim() || gerarImagemIA.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gerarImagemIA.isPending ? (
                <>
                  <Sparkles size={15} className="animate-pulse" />
                  Gerando imagem...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Gerar Imagem
                </>
              )}
            </button>
          </div>

          {gerarImagemIA.isError && (
            <div className={`p-3 rounded-xl text-xs ${isLight ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
              Erro ao gerar imagem. Verifique a conexão com o n8n e tente novamente.
            </div>
          )}
        </div>
      )}

      {/* Step 4a: Template — preview html2canvas + Download/Salvar */}
      {step === 4 && modo === 'template' && (
        <div className="space-y-4">
          {saved ? (
            <div className={`flex flex-col items-center gap-4 py-12 rounded-2xl border ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <CheckCircle2 size={48} className="text-emerald-400" />
              <p className={`text-lg font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>Comunicado salvo com sucesso!</p>
              <button
                onClick={() => { setSaved(false); setStep(1); setTexto({ titulo: '', subtitulo: '', corpo: '', destaques: [], rodape: '' }); setInstrucoes(''); setIncluirLogo(true); setImagemGeradaUrl(''); setImagemGeradaTexto(''); setImagemGeradaFooter(''); setImagemGeradaCor1(''); setImagemGeradaCor2('') }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
              >
                <Plus size={14} /> Novo Comunicado
              </button>
            </div>
          ) : (
            <>
              <ComunicadoTemplate
                formato={formato}
                texto={texto}
                identidade={identidade}
                templateRef={templateRef}
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => setStep(3)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <ArrowLeft size={15} /> Editar Texto
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    isLight ? 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20'
                  }`}
                >
                  <Download size={15} /> {downloading ? 'Gerando...' : 'Baixar PNG'}
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-50"
                >
                  <Save size={15} /> {saving ? 'Salvando...' : 'Salvar no Sistema'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 4b: IA — preview imagem gerada + Salvar/Descartar */}
      {step === 4 && modo === 'ia' && (
        <div className="space-y-4">
          {saved ? (
            <div className={`flex flex-col items-center gap-4 py-12 rounded-2xl border ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <CheckCircle2 size={48} className="text-emerald-400" />
              <p className={`text-lg font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>Comunicado salvo com sucesso!</p>
              <button
                onClick={() => { setSaved(false); setStep(1); setTexto({ titulo: '', subtitulo: '', corpo: '', destaques: [], rodape: '' }); setInstrucoes(''); setIncluirLogo(true); setImagemGeradaUrl(''); setImagemGeradaTexto(''); setImagemGeradaFooter(''); setImagemGeradaCor1(''); setImagemGeradaCor2('') }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
              >
                <Plus size={14} /> Novo Comunicado
              </button>
            </div>
          ) : (
            <>
              {/* Composite: AI background + text overlay */}
              <div className="flex justify-center">
                <div
                  ref={iaCompositeRef}
                  className="relative rounded-2xl overflow-hidden border shadow-lg"
                  style={{
                    maxWidth: 480,
                    width: '100%',
                    aspectRatio: fmtInfo.aspect,
                    background: `linear-gradient(135deg, ${imagemGeradaCor1 || '#6366f1'}, ${imagemGeradaCor2 || '#8b5cf6'})`,
                  }}
                >
                  {/* Background image from Imagen */}
                  <img
                    src={imagemGeradaUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                  {/* Logo — top-left (condicional ao toggle) */}
                  {incluirLogo && identidade.logo_url && (
                    <div className="absolute top-4 left-4 z-10">
                      <img
                        src={identidade.logo_url}
                        alt="Logo"
                        crossOrigin="anonymous"
                        style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
                      />
                    </div>
                  )}
                  {/* Text overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <p className="text-white font-bold text-center leading-snug drop-shadow-lg"
                      style={{ fontSize: 'clamp(1rem, 4vw, 2rem)', textShadow: '0 2px 8px rgba(0,0,0,0.6)', maxWidth: '85%' }}>
                      {imagemGeradaTexto}
                    </p>
                  </div>
                  {/* Footer strip */}
                  {imagemGeradaFooter && (
                    <div className="absolute bottom-0 inset-x-0 px-4 py-2 text-center"
                      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                      <p className="text-white/90 text-xs font-semibold tracking-wide drop-shadow">{imagemGeradaFooter}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => { setImagemGeradaUrl(''); setImagemGeradaTexto(''); setImagemGeradaFooter(''); setImagemGeradaCor1(''); setImagemGeradaCor2(''); setStep(3) }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <XCircle size={15} /> Descartar
                </button>
                <div className="flex-1" />
                <a
                  href={imagemGeradaUrl}
                  download={`comunicado-ia-${tipo}-${formato}-${Date.now()}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    isLight ? 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20'
                  }`}
                >
                  <Download size={15} /> Baixar PNG
                </a>
                <button
                  onClick={handleSalvarImagemIA}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-50"
                >
                  <Save size={15} /> {saving ? 'Salvando...' : 'Salvar no Sistema'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Historico ──────────────────────────────────────────────────────────

function TabHistorico() {
  const { isLightSidebar: isLight } = useTheme()
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const { data: comunicados = [], isLoading } = useComunicados(filtroTipo || undefined)
  const excluir = useExcluirComunicado()
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const sel = isLight
    ? 'px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
    : 'px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 [&>option]:bg-slate-900'

  const preview = comunicados.find(c => c.id === previewId)

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Search size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select
          className={sel}
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-2xl h-48 animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`} />
          ))}
        </div>
      ) : comunicados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FileText size={36} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Nenhum comunicado gerado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {comunicados.map(c => {
            const tc = TIPO_COLORS[c.tipo] || TIPO_COLORS.personalizado
            return (
              <div
                key={c.id}
                className={`rounded-2xl border overflow-hidden transition-all hover:shadow-lg ${
                  isLight ? 'bg-white border-slate-200' : 'glass-card'
                }`}
              >
                {/* Thumbnail */}
                {c.imagem_url ? (
                  <button onClick={() => setPreviewId(c.id)} className="w-full">
                    <img src={c.imagem_url} alt={c.titulo} className="w-full h-40 object-cover object-top" loading="lazy" />
                  </button>
                ) : (
                  <div className={`w-full h-40 flex items-center justify-center ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}>
                    <ImageIcon size={32} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
                  </div>
                )}

                {/* Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc.bg} ${tc.text}`}>
                      {TIPOS.find(t => t.value === c.tipo)?.label || c.tipo}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-500'}`}>
                      {FORMATOS.find(f => f.value === c.formato)?.label || c.formato}
                    </span>
                  </div>
                  <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{c.titulo}</p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(c.created_at)}</p>
                </div>

                {/* Actions */}
                <div className={`px-3 pb-3 flex gap-2`}>
                  {c.imagem_url && (
                    <button
                      onClick={() => setPreviewId(c.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        isLight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
                      }`}
                    >
                      <Eye size={12} /> Ver
                    </button>
                  )}
                  {confirmDel === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { excluir.mutate(c.id); setConfirmDel(null) }}
                        className="px-2 py-1 rounded-lg bg-red-600 text-[10px] font-bold text-white hover:bg-red-500 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDel(null)}
                        className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${isLight ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                      >
                        Nao
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDel(c.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} /> Excluir
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewId(null)}>
          <div className="relative max-w-3xl max-h-[90vh] overflow-auto rounded-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewId(null)} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
              <XCircle size={20} />
            </button>
            {preview.imagem_url && (
              <img src={preview.imagem_url} alt={preview.titulo} className="max-w-full rounded-2xl" />
            )}
            <div className="mt-3 flex justify-center">
              <a
                href={preview.imagem_url || '#'}
                download={`comunicado-${preview.tipo}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
              >
                <Download size={15} /> Baixar PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Identidade Visual ──────────────────────────────────────────────────

function TabIdentidadeVisual() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: ivData } = useIdentidadeVisual()
  const salvar = useSalvarIdentidadeVisual()
  const uploadLogo = useUploadLogo()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<Partial<IdentidadeVisual>>(() => ({
    cor_primaria: ivData?.cor_primaria || '#6366f1',
    cor_secundaria: ivData?.cor_secundaria || '#8b5cf6',
    cor_fundo: ivData?.cor_fundo || '#ffffff',
    cor_texto: ivData?.cor_texto || '#1e293b',
    fonte_titulo: ivData?.fonte_titulo || 'Montserrat',
    fonte_corpo: ivData?.fonte_corpo || 'Inter',
    slogan: ivData?.slogan || '',
    logo_url: ivData?.logo_url || null,
  }))
  const [saved, setSaved] = useState(false)

  // Sync when data loads
  const [synced, setSynced] = useState(false)
  if (ivData && !synced) {
    setForm({
      cor_primaria: ivData.cor_primaria,
      cor_secundaria: ivData.cor_secundaria,
      cor_fundo: ivData.cor_fundo,
      cor_texto: ivData.cor_texto,
      fonte_titulo: ivData.fonte_titulo,
      fonte_corpo: ivData.fonte_corpo,
      slogan: ivData.slogan || '',
      logo_url: ivData.logo_url,
    })
    setSynced(true)
  }

  const set = (k: keyof IdentidadeVisual, v: unknown) => {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadLogo.mutateAsync(file)
      set('logo_url', url)
    } catch { /* ignore */ }
  }

  async function handleSalvar() {
    await salvar.mutateAsync(form)
    setSaved(true)
  }

  const inp = isLight
    ? 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
    : 'w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30'
  const selectCls = isLight ? inp : inp + ' [&>option]:bg-slate-900'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className={`p-5 rounded-2xl border space-y-4 ${isLight ? 'bg-white border-slate-200' : 'glass-card'}`}>
        {/* Logo */}
        <div>
          <label className={`text-[11px] font-semibold block mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Logo</label>
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${isLight ? 'border-slate-200' : 'border-white/15'}`}>
                <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                <ImageIcon size={20} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadLogo.isPending}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <Upload size={13} /> {uploadLogo.isPending ? 'Enviando...' : 'Upload'}
            </button>
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          {([
            ['cor_primaria', 'Cor Primaria'],
            ['cor_secundaria', 'Cor Secundaria'],
            ['cor_fundo', 'Cor Fundo'],
            ['cor_texto', 'Cor Texto'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(form[key] as string) || '#000000'}
                  onChange={e => set(key, e.target.value)}
                  className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
                />
                <input
                  className={inp}
                  value={(form[key] as string) || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder="#000000"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Fonts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fonte Titulo</label>
            <select className={selectCls} value={form.fonte_titulo || 'Montserrat'} onChange={e => set('fonte_titulo', e.target.value)}>
              {FONTES_TITULO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fonte Corpo</label>
            <select className={selectCls} value={form.fonte_corpo || 'Inter'} onChange={e => set('fonte_corpo', e.target.value)}>
              {FONTES_CORPO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* Slogan */}
        <div>
          <label className={`text-[11px] font-semibold block mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Slogan</label>
          <input className={inp} value={form.slogan || ''} onChange={e => set('slogan', e.target.value)} placeholder="Sua tagline ou slogan" />
        </div>

        {/* Save */}
        <button
          onClick={handleSalvar}
          disabled={salvar.isPending}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            saved
              ? isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
        >
          {saved ? <><CheckCircle2 size={15} /> Salvo!</> : salvar.isPending ? 'Salvando...' : <><Save size={15} /> Salvar Identidade Visual</>}
        </button>
      </div>

      {/* Live Preview */}
      <div className={`p-5 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'glass-card'}`}>
        <p className={`text-xs font-semibold mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Pre-visualizacao</p>
        <div
          className="rounded-xl overflow-hidden border"
          style={{
            backgroundColor: form.cor_fundo || '#ffffff',
            borderColor: (form.cor_primaria || '#6366f1') + '30',
          }}
        >
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${form.cor_primaria || '#6366f1'}, ${form.cor_secundaria || '#8b5cf6'})`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {form.logo_url && <img src={form.logo_url} alt="logo" style={{ height: 28, objectFit: 'contain' }} />}
            <span style={{ color: '#fff', fontFamily: `'${form.fonte_titulo || 'Montserrat'}', sans-serif`, fontWeight: 800, fontSize: 16 }}>Exemplo de Comunicado</span>
          </div>
          {/* Body */}
          <div style={{ padding: '20px', color: form.cor_texto || '#1e293b', fontFamily: `'${form.fonte_corpo || 'Inter'}', sans-serif` }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              Este e um exemplo de como seu comunicado ficara com as cores e fontes selecionadas.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: (form.cor_primaria || '#6366f1') + '20', color: form.cor_primaria || '#6366f1', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Destaque 1</span>
              <span style={{ background: (form.cor_secundaria || '#8b5cf6') + '20', color: form.cor_secundaria || '#8b5cf6', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Destaque 2</span>
            </div>
            {form.slogan && (
              <p style={{ marginTop: 16, fontSize: 11, opacity: 0.5, fontStyle: 'italic' }}>{form.slogan}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

type TabKey = 'gerar' | 'historico' | 'identidade'
const TABS: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'gerar',       label: 'Gerar Comunicado',  icon: Sparkles },
  { key: 'historico',   label: 'Historico',          icon: History },
  { key: 'identidade',  label: 'Identidade Visual',  icon: Palette },
]

export default function Endomarketing() {
  const { isLightSidebar: isLight } = useTheme()
  const [tab, setTab] = useState<TabKey>('gerar')
  const { data: ivData } = useIdentidadeVisual()
  const identidade = ivData || DEFAULT_IDENTIDADE

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Megaphone size={20} className="text-indigo-400" />
          Endomarketing
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Comunicados internos, campanhas e identidade visual
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl w-fit ${isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/4 border border-white/8'}`}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'gerar' && <TabGerarComunicado identidade={identidade} />}
      {tab === 'historico' && <TabHistorico />}
      {tab === 'identidade' && <TabIdentidadeVisual />}
    </div>
  )
}
