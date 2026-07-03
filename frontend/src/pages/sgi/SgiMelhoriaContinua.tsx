import { useState, useMemo, useEffect, useRef } from 'react'
import {
  RefreshCcw, Plus, X, Search, LayoutList, LayoutGrid, Loader2, Calendar, CheckCircle2, Circle,
  Check, Target, FlaskConical, ListChecks, ClipboardCheck, Lock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useRegistros, useCriarRegistro, useAtualizarRegistro,
  useAcoes, useCriarAcao, useAtualizarAcao,
  useObjetivos, useAnaliseCausa, useSalvarAnaliseCausa,
  useVerificacao, useSalvarVerificacao,
} from '../../hooks/useSgi'
import { useLookupObras } from '../../hooks/useLookups'
import {
  PDCA_STAGES, TIPO_REGISTRO_LABEL, ORIGEM_REGISTRO_LABEL, GRAVIDADE_CFG, STATUS_ACAO_LABEL,
  ISHIKAWA_6M, ISHIKAWA_LABEL,
} from '../../types/sgi'
import type {
  SgiRegistro, StatusPdca, TipoRegistro, OrigemRegistro, Gravidade, Ishikawa6M,
} from '../../types/sgi'

const fmtDate = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—')

// ── Accent por etapa (padrão EntradasPipeline) ────────────────────────────────
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }
const TAB_ACCENT: Record<StatusPdca, AccentSet> = {
  pendente:      { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',     border:'border-slate-200' },
  analise_causa: { bg:'bg-blue-50',    bgActive:'bg-blue-100',    text:'text-blue-500',    textActive:'text-blue-800',    dot:'bg-blue-500',    badge:'bg-blue-200/80 text-blue-700',       border:'border-blue-200' },
  plano_acao:    { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700',   border:'border-violet-200' },
  execucao:      { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',     border:'border-amber-200' },
  verificacao:   { bg:'bg-cyan-50',    bgActive:'bg-cyan-100',    text:'text-cyan-500',    textActive:'text-cyan-800',    dot:'bg-cyan-500',    badge:'bg-cyan-200/80 text-cyan-700',       border:'border-cyan-200' },
  encerrado:     { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
}
const TAB_ACCENT_DARK: Record<StatusPdca, AccentSet> = {
  pendente:      { bg:'bg-white/[0.02]', bgActive:'bg-white/[0.06]', text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',  border:'border-white/[0.08]' },
  analise_causa: { bg:'bg-blue-500/5',   bgActive:'bg-blue-500/15',  text:'text-blue-400',    textActive:'text-blue-200',    dot:'bg-blue-400',    badge:'bg-blue-500/15 text-blue-300',    border:'border-blue-500/20' },
  plano_acao:    { bg:'bg-violet-500/5', bgActive:'bg-violet-500/15',text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',border:'border-violet-500/20' },
  execucao:      { bg:'bg-amber-500/5',  bgActive:'bg-amber-500/15', text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',  border:'border-amber-500/20' },
  verificacao:   { bg:'bg-cyan-500/5',   bgActive:'bg-cyan-500/15',  text:'text-cyan-400',    textActive:'text-cyan-200',    dot:'bg-cyan-400',    badge:'bg-cyan-500/15 text-cyan-300',    border:'border-cyan-500/20' },
  encerrado:     { bg:'bg-emerald-500/5',bgActive:'bg-emerald-500/15',text:'text-emerald-400',textActive:'text-emerald-200', dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300',border:'border-emerald-500/20' },
}

// ── Modal de detalhe — fluxo ISO 9001 §10.2 (NC e ação corretiva) ─────────────
// 1 Identificação/Triagem → 2 Análise de Causa → 3 Plano de Ação →
// 4 Verificação de Eficácia → 5 Encerramento. Stepper visual + guard-rails.
function RegistroModal({ registro, onClose, isDark }: { registro: SgiRegistro; onClose: () => void; isDark: boolean }) {
  const atualizar = useAtualizarRegistro()
  const { data: acoes = [] } = useAcoes({ origem_id: registro.id })
  const obras = useLookupObras()
  const criarAcao = useCriarAcao()
  const atualizarAcao = useAtualizarAcao()
  const { perfil } = useAuth()
  const [novaAcao, setNovaAcao] = useState('')
  const [novaPrazo, setNovaPrazo] = useState('')

  // Análise de causa (Ishikawa + 5 Porquês) → sgi_analise_causa
  // AUTO-SAVE: popula o form UMA vez (guard), depois salva com debounce a cada
  // digitação — o refetch da query nunca sobrescreve o que está sendo digitado.
  const { data: analise, isFetched: analiseFetched } = useAnaliseCausa(registro.id)
  const salvarAnalise = useSalvarAnaliseCausa()
  const [metodoCausa, setMetodoCausa] = useState<'5porques' | 'ishikawa'>('5porques')
  const [porques, setPorques] = useState<string[]>(['', '', '', '', ''])
  const [ishikawa, setIshikawa] = useState<Record<Ishikawa6M, string>>({ metodo: '', maquina: '', mao_obra: '', material: '', medicao: '', meio_ambiente: '' })
  const [causaRaiz, setCausaRaiz] = useState('')
  const [causaSave, setCausaSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const causaLoaded = useRef(false)
  const analiseIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!analiseFetched || causaLoaded.current) return
    causaLoaded.current = true
    if (!analise) return
    analiseIdRef.current = analise.id
    const c = analise.conteudo || {}
    setPorques([...(c.porques ?? []), '', '', '', '', ''].slice(0, 5))
    const ish = c.ishikawa
    if (ish) setIshikawa({
      metodo: (ish.metodo ?? []).join('\n'), maquina: (ish.maquina ?? []).join('\n'), mao_obra: (ish.mao_obra ?? []).join('\n'),
      material: (ish.material ?? []).join('\n'), medicao: (ish.medicao ?? []).join('\n'), meio_ambiente: (ish.meio_ambiente ?? []).join('\n'),
    })
    if (analise.metodo === 'ishikawa' || analise.metodo === '5porques') setMetodoCausa(analise.metodo)
    setCausaRaiz(analise.causa_raiz ?? '')
  }, [analiseFetched, analise])
  // debounce de 1,5s após a última digitação
  useEffect(() => {
    if (!causaLoaded.current) return
    setCausaSave('saving')
    const t = setTimeout(async () => {
      try {
        const ish = Object.fromEntries(ISHIKAWA_6M.map(k => [k, ishikawa[k].split('\n').map(s => s.trim()).filter(Boolean)])) as Record<Ishikawa6M, string[]>
        const r = await salvarAnalise.mutateAsync({
          id: analiseIdRef.current, registro_id: registro.id, metodo: metodoCausa,
          conteudo: { porques: porques.map(p => p.trim()), ishikawa: ish },
          causa_raiz: causaRaiz.trim() || null,
        })
        analiseIdRef.current = r.id
        setCausaSave('saved')
      } catch { setCausaSave('idle') }
    }, 1500)
    return () => clearTimeout(t)
  }, [porques, ishikawa, causaRaiz, metodoCausa]) // eslint-disable-line react-hooks/exhaustive-deps

  // Verificação de eficácia → sgi_verificacao (ISO 10.2.1.d) — mesmo auto-save
  const { data: verif, isFetched: verifFetched } = useVerificacao(registro.id)
  const salvarVerif = useSalvarVerificacao()
  const [eficaz, setEficaz] = useState<boolean | null>(null)
  const [evidencia, setEvidencia] = useState('')
  const [obsVerif, setObsVerif] = useState('')
  const [verifSave, setVerifSave] = useState<'idle' | 'saving' | 'saved'>('idle')
  const verifLoaded = useRef(false)
  const verifIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!verifFetched || verifLoaded.current) return
    verifLoaded.current = true
    if (!verif) return
    verifIdRef.current = verif.id
    setEficaz(verif.eficaz)
    setEvidencia(verif.evidencia ?? '')
    setObsVerif(verif.observacao ?? '')
  }, [verifFetched, verif])
  useEffect(() => {
    if (!verifLoaded.current || eficaz == null) return
    setVerifSave('saving')
    const t = setTimeout(async () => {
      try {
        const r = await salvarVerif.mutateAsync({
          id: verifIdRef.current, registro_id: registro.id, eficaz,
          evidencia: evidencia.trim() || null, observacao: obsVerif.trim() || null,
          criado_por_nome: perfil?.nome ?? null,
        })
        verifIdRef.current = r.id
        setVerifSave('saved')
      } catch { setVerifSave('idle') }
    }, 1200)
    return () => clearTimeout(t)
  }, [eficaz, evidencia, obsVerif]) // eslint-disable-line react-hooks/exhaustive-deps

  // indicador discreto de auto-save (substitui os botões "Salvar")
  const SaveDot = ({ st }: { st: 'idle' | 'saving' | 'saved' }) => (
    st === 'idle' ? null : (
      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold ${st === 'saving' ? (isDark ? 'text-slate-500' : 'text-slate-400') : 'text-emerald-500'}`}>
        {st === 'saving' ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
        {st === 'saving' ? 'Salvando…' : 'Salvo'}
      </span>
    )
  )

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBorder = isDark ? 'border-white/[0.07]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-xs rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`
  const g = GRAVIDADE_CFG[registro.gravidade]
  const obraNome = registro.obra_id ? (obras.find(o => o.id === registro.obra_id)?.nome ?? null) : null
  const stageIdx = PDCA_STAGES.findIndex(s => s.key === registro.status_pdca)
  const hoje = new Date().toISOString().split('T')[0]

  const temCausa = !!(analise?.causa_raiz?.trim() || causaRaiz.trim())
  const abertas = acoes.filter(a => a.status !== 'concluida' && a.status !== 'cancelada').length
  const concluidas = acoes.filter(a => a.status === 'concluida').length
  const eficaciaAvaliada = verif?.eficaz != null
  const encerrado = registro.status_pdca === 'encerrado'

  // guard-rails ISO: avisa (não trava duro) quando falta evidência da etapa anterior
  const setStatus = (s: StatusPdca) => {
    if (s === registro.status_pdca) return
    if (s === 'plano_acao' && !temCausa && !confirm('A causa raiz ainda não foi registrada (§10.2.1.b). Avançar para o Plano de Ação mesmo assim?')) return
    if (s === 'encerrado') {
      if (abertas > 0 && !confirm(`Ainda há ${abertas} ação(ões) em aberto. Encerrar mesmo assim?`)) return
      if (!eficaciaAvaliada && !confirm('A eficácia das ações não foi avaliada (§10.2.1.d). Encerrar sem verificação?')) return
      if (verif?.eficaz === false && !confirm('A verificação indicou que as ações NÃO foram eficazes. O ideal é reabrir a análise. Encerrar mesmo assim?')) return
    }
    atualizar.mutate({ id: registro.id, status_pdca: s, ...(s === 'encerrado' ? { encerrado_em: new Date().toISOString() } : {}) })
  }
  const setClassif = (c: 'nc' | 'registro' | 'dispensado') => atualizar.mutate({ id: registro.id, classificacao: c, ...(c === 'nc' && registro.status_pdca === 'pendente' ? { status_pdca: 'analise_causa' as StatusPdca } : {}) })

  const addAcao = async () => {
    if (!novaAcao.trim()) return
    await criarAcao.mutateAsync({ origem_tipo: 'registro', origem_id: registro.id, titulo: novaAcao.trim(), prazo: novaPrazo || undefined, status: 'aberta' })
    setNovaAcao(''); setNovaPrazo('')
  }

  // cabeçalho de seção numerada (padrão do fluxo ISO)
  const Secao = ({ n, cor, corBg, icon: Icon, titulo, sub, extra }: {
    n: number; cor: string; corBg: string; icon: typeof Target; titulo: string; sub: string; extra?: React.ReactNode
  }) => (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-7 h-7 rounded-lg ${corBg} ${cor} flex items-center justify-center shrink-0`}>
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <p className={`text-xs font-bold leading-tight ${txt}`}>{n}. {titulo}</p>
          <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</p>
        </div>
      </div>
      {extra}
    </div>
  )

  const okBadge = (ok: boolean, lblOk: string, lblPend: string) => (
    <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
      ok
        ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
        : isDark ? 'bg-white/[0.05] text-slate-500' : 'bg-slate-100 text-slate-400'
    }`}>
      {ok ? <Check size={9} /> : <Circle size={8} />} {ok ? lblOk : lblPend}
    </span>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={`text-base font-bold truncate ${txt}`}>
                  {registro.codigo && <span className={`font-mono text-xs mr-1.5 ${muted}`}>{registro.codigo}</span>}
                  {registro.titulo}
                </h3>
                {registro.classificacao === 'nc' && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">NC</span>}
                <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${g.bg} ${g.text}`}><span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />{g.label}</span>
              </div>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Tratamento de não conformidade e ação corretiva · ISO 9001:2015 §10.2
              </p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
          </div>

          {/* Stepper PDCA */}
          <div className="mt-3 flex items-center">
            {PDCA_STAGES.map((s, i) => {
              const feita = i < stageIdx
              const atual = i === stageIdx
              return (
                <div key={s.key} className={`flex items-center ${i > 0 ? 'flex-1' : ''}`}>
                  {i > 0 && <div className={`h-0.5 flex-1 mx-1 rounded ${feita || atual ? s.bar : isDark ? 'bg-white/[0.08]' : 'bg-slate-200'}`} />}
                  <button
                    onClick={() => setStatus(s.key)}
                    disabled={atualizar.isPending}
                    title={s.label}
                    className="group flex flex-col items-center gap-1 shrink-0"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      atual ? `${s.bar} text-white ring-4 ${isDark ? 'ring-white/10' : 'ring-slate-100'}`
                        : feita ? `${s.bar} text-white opacity-80`
                        : isDark ? 'bg-white/[0.06] text-slate-500 group-hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                      {feita ? <Check size={13} /> : i + 1}
                    </span>
                    <span className={`text-[8px] font-semibold leading-none whitespace-nowrap ${
                      atual ? txt : isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {s.label.split(' ')[0]}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* ── 1 · Identificação & Triagem ── */}
          <div className={`rounded-xl border p-4 ${cardBorder}`}>
            <Secao n={1} cor="text-slate-500" corBg={isDark ? 'bg-white/[0.06]' : 'bg-slate-100'} icon={ClipboardCheck}
              titulo="Identificação & Triagem" sub="Reagir à não conformidade — §10.2.1.a"
              extra={okBadge(registro.classificacao !== 'pendente', 'Classificado', 'Aguardando triagem')}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-xs mb-3">
              <div><p className={muted}>Tipo</p><p className={`font-semibold ${txt}`}>{TIPO_REGISTRO_LABEL[registro.tipo]}</p></div>
              <div><p className={muted}>Origem</p><p className={`font-semibold ${txt}`}>{ORIGEM_REGISTRO_LABEL[registro.origem]}</p></div>
              <div><p className={muted}>Departamento</p><p className={`font-semibold ${txt}`}>{registro.area_processo || '—'}</p></div>
              <div><p className={muted}>Projeto</p><p className={`font-semibold ${txt}`}>{obraNome ?? '—'}</p></div>
            </div>
            {registro.descricao && (
              <p className={`text-xs mb-3 rounded-lg px-3 py-2 ${isDark ? 'bg-white/[0.03] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>{registro.descricao}</p>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {([['nc', 'É Não Conformidade'], ['registro', 'Só registro'], ['dispensado', 'Dispensar']] as const).map(([c, lbl]) => (
                <button key={c} onClick={() => setClassif(c)} disabled={atualizar.isPending}
                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                    registro.classificacao === c
                      ? c === 'nc' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-600 text-white border-slate-600'
                      : isDark ? 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* ── 2 · Análise de Causa ── */}
          <div className={`rounded-xl border p-4 ${isDark ? 'border-blue-500/20' : 'border-blue-200'}`}>
            <Secao n={2} cor="text-blue-500" corBg={isDark ? 'bg-blue-500/15' : 'bg-blue-50'} icon={Search}
              titulo="Análise de Causa" sub="Determinar a causa raiz — §10.2.1.b"
              extra={
                <div className="flex items-center gap-2">
                  <SaveDot st={causaSave} />
                  {okBadge(temCausa, 'Causa raiz definida', 'Sem causa raiz')}
                  <div className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg border ${isDark ? 'border-white/[0.08] bg-white/[0.03]' : 'border-slate-200 bg-slate-100'}`}>
                    {(['5porques', 'ishikawa'] as const).map(mt => (
                      <button key={mt} type="button" onClick={() => setMetodoCausa(mt)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${metodoCausa === mt ? 'bg-blue-600 text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {mt === '5porques' ? '5 Porquês' : 'Ishikawa 6M'}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
            {metodoCausa === '5porques' ? (
              <div className="space-y-1">
                {porques.map((p, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ paddingLeft: i * 14 }}>
                    <span className={`shrink-0 text-blue-400 text-xs font-bold ${i === 0 ? 'invisible' : ''}`}>↳</span>
                    <span className="w-5 h-5 shrink-0 rounded-md bg-blue-500/15 text-blue-500 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <input value={p} onChange={e => setPorques(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={i === 0 ? 'Por que o problema ocorreu?' : 'Por quê?'}
                      className={`flex-1 ${inputCls}`} />
                  </div>
                ))}
              </div>
            ) : (
              /* espinha de peixe: 3M em cima, espinha central com diagonais, 3M embaixo */
              (() => {
                const bone = isDark ? 'rgba(147,197,253,0.28)' : 'rgba(96,165,250,0.45)'
                const caixa = (k: Ishikawa6M) => (
                  <div key={k} className={`rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.08] bg-[#1e293b]' : 'border-slate-200 bg-white'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>{ISHIKAWA_LABEL[k]}</p>
                    <textarea rows={2} value={ishikawa[k]} onChange={e => setIshikawa(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder="uma causa por linha"
                      className={`w-full text-[11px] px-2 py-1.5 outline-none resize-none border-0 ${isDark ? 'bg-transparent text-white placeholder-slate-600' : 'bg-white'}`} />
                  </div>
                )
                return (
                  <div>
                    <div className="grid grid-cols-3 gap-2">{(['metodo', 'maquina', 'mao_obra'] as Ishikawa6M[]).map(caixa)}</div>
                    <svg className="w-full h-9 -my-0.5" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
                      {/* espinha central */}
                      <line x1="1.5" y1="12" x2="95.5" y2="12" stroke={bone} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      {/* cabeça (seta → efeito/causa raiz) */}
                      <path d="M95.5 12 L92.5 8.5 M95.5 12 L92.5 15.5" stroke={bone} strokeWidth="1" fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                      {/* diagonais das categorias de cima (desembocam na espinha) */}
                      {[16.6, 50, 83.3].map(x => (
                        <line key={`t${x}`} x1={x} y1="0" x2={x + 5.5} y2="12" stroke={bone} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      ))}
                      {/* diagonais das categorias de baixo */}
                      {[16.6, 50, 83.3].map(x => (
                        <line key={`b${x}`} x1={x} y1="24" x2={x + 5.5} y2="12" stroke={bone} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      ))}
                    </svg>
                    <div className="grid grid-cols-3 gap-2">{(['material', 'medicao', 'meio_ambiente'] as Ishikawa6M[]).map(caixa)}</div>
                  </div>
                )
              })()
            )}
            <div className={`mt-3 rounded-xl border-2 border-dashed p-3 ${temCausa ? (isDark ? 'border-blue-500/40 bg-blue-500/[0.06]' : 'border-blue-300 bg-blue-50/60') : (isDark ? 'border-white/10' : 'border-slate-200')}`}>
              <p className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                <Target size={10} /> Causa raiz identificada
              </p>
              <input value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} placeholder="Conclusão da análise…" className={inputCls} />
            </div>
          </div>

          {/* ── 3 · Plano de Ação ── */}
          <div className={`rounded-xl border p-4 ${isDark ? 'border-violet-500/20' : 'border-violet-200'}`}>
            <Secao n={3} cor="text-violet-500" corBg={isDark ? 'bg-violet-500/15' : 'bg-violet-50'} icon={ListChecks}
              titulo="Plano de Ação" sub="Implementar ações corretivas — §10.2.1.c"
              extra={acoes.length > 0 ? (
                <span className={`shrink-0 text-[10px] font-bold ${concluidas === acoes.length ? 'text-emerald-500' : muted}`}>{concluidas}/{acoes.length}</span>
              ) : undefined}
            />
            {acoes.length > 0 && (
              <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                <div className={`h-full rounded-full transition-all ${concluidas === acoes.length ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${(concluidas / acoes.length) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1.5 mb-3">
              {acoes.length === 0 && <p className={`text-xs italic ${muted}`}>Nenhuma ação ainda — defina o quê será feito e até quando.</p>}
              {acoes.map(a => {
                const sa = STATUS_ACAO_LABEL[a.status]
                const done = a.status === 'concluida'
                const atrasada = !done && a.prazo && a.prazo < hoje
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border ${
                    atrasada
                      ? isDark ? 'border-red-500/25 bg-red-500/[0.05]' : 'border-red-200 bg-red-50/50'
                      : isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-white'
                  }`}>
                    <button onClick={() => atualizarAcao.mutate({ id: a.id, status: done ? 'aberta' : 'concluida', concluida_em: done ? null : new Date().toISOString() })} className="shrink-0">
                      {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-400 hover:text-violet-500" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${done ? 'line-through ' + muted : txt}`}>{a.titulo}</p>
                    </div>
                    {a.prazo && (
                      <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] ${atrasada ? 'text-red-500 font-bold' : muted}`}>
                        <Calendar size={10} />{fmtDate(a.prazo)}
                      </span>
                    )}
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sa.bg} ${sa.text}`}>{sa.label}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input value={novaAcao} onChange={e => setNovaAcao(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAcao() }}
                placeholder="O que será feito?" className={`flex-1 ${inputCls}`} />
              <input type="date" value={novaPrazo} onChange={e => setNovaPrazo(e.target.value)} title="Até quando"
                className={`w-32 text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200'}`} />
              <button onClick={addAcao} disabled={criarAcao.isPending || !novaAcao.trim()} className="px-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                {criarAcao.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </div>

          {/* ── 4 · Verificação de Eficácia ── */}
          <div className={`rounded-xl border p-4 ${isDark ? 'border-cyan-500/20' : 'border-cyan-200'}`}>
            <Secao n={4} cor="text-cyan-500" corBg={isDark ? 'bg-cyan-500/15' : 'bg-cyan-50'} icon={FlaskConical}
              titulo="Verificação de Eficácia" sub="As ações eliminaram a causa raiz? — §10.2.1.d"
              extra={
                <div className="flex items-center gap-2">
                  <SaveDot st={verifSave} />
                  {okBadge(eficaciaAvaliada, verif?.eficaz ? 'Eficaz' : 'Avaliada', 'Não avaliada')}
                </div>
              }
            />
            <div className="flex gap-2 mb-3">
              {([[true, 'Eficaz — problema não recorreu', 'emerald'], [false, 'Não eficaz — recorreu / persiste', 'red']] as const).map(([v, lbl, tone]) => (
                <button key={String(v)} onClick={() => setEficaz(v)}
                  className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                    eficaz === v
                      ? tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-red-600 border-red-600 text-white'
                      : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${muted}`}>Evidência da verificação</label>
                <input value={evidencia} onChange={e => setEvidencia(e.target.value)} placeholder="Ex.: auditoria de campo em 15/08, sem recorrência" className={inputCls} />
              </div>
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${muted}`}>Observações</label>
                <input value={obsVerif} onChange={e => setObsVerif(e.target.value)} className={inputCls} />
              </div>
            </div>
            {eficaz == null && (
              <p className={`mt-2 text-[10px] italic ${muted}`}>Escolha Eficaz/Não eficaz — o restante salva automaticamente.</p>
            )}
          </div>

          {/* ── 5 · Encerramento ── */}
          <div className={`rounded-xl border p-4 ${encerrado ? (isDark ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-emerald-300 bg-emerald-50/50') : cardBorder}`}>
            <Secao n={5} cor="text-emerald-500" corBg={isDark ? 'bg-emerald-500/15' : 'bg-emerald-50'} icon={Lock}
              titulo="Encerramento" sub="Reter informação documentada — §10.2.2"
              extra={okBadge(encerrado, `Encerrado ${registro.encerrado_em ? fmtDate(registro.encerrado_em.slice(0, 10)) : ''}`, 'Em aberto')}
            />
            {encerrado ? (
              <p className={`text-xs ${muted}`}>
                Registro encerrado{registro.encerrado_em ? ` em ${fmtDate(registro.encerrado_em.slice(0, 10))}` : ''} com {concluidas} ação(ões) concluída(s)
                {eficaciaAvaliada ? ` e eficácia ${verif?.eficaz ? 'confirmada' : 'reprovada'}` : ''}. Evidências retidas neste registro.
              </p>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className={`text-[11px] ${muted}`}>
                  {abertas > 0 ? `${abertas} ação(ões) em aberto · ` : ''}
                  {!temCausa ? 'causa raiz pendente · ' : ''}
                  {!eficaciaAvaliada ? 'eficácia não avaliada' : 'pré-requisitos ok ✓'}
                </p>
                <button onClick={() => setStatus('encerrado')} disabled={atualizar.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  <Lock size={12} /> Encerrar registro
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal nova anomalia (categorização inicial) ───────────────────────────────
function NovaAnomaliaModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criar = useCriarRegistro()
  const obras = useLookupObras()
  const { data: objetivos = [] } = useObjetivos()
  const departamentos = useMemo(() => objetivos.filter(o => o.indicador === 'OKR').map(o => o.titulo), [objetivos])
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoRegistro>('anomalia')
  const [origem, setOrigem] = useState<OrigemRegistro>('campo')
  const [gravidade, setGravidade] = useState<Gravidade>('media')
  const [area, setArea] = useState('')
  const [obraId, setObraId] = useState('')
  const [descricao, setDescricao] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-amber-500' : 'bg-white border-slate-200 text-slate-800 focus:border-amber-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    await criar.mutateAsync({ titulo: titulo.trim(), tipo, origem, gravidade, area_processo: area || undefined, obra_id: obraId || undefined, descricao: descricao || undefined, status_pdca: 'pendente', classificacao: 'pendente' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Nova Anomalia / Falha</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que aconteceu?" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoRegistro)} className={inputCls}>
                {Object.entries(TIPO_REGISTRO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as OrigemRegistro)} className={inputCls}>
                {Object.entries(ORIGEM_REGISTRO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Gravidade</label>
              <select value={gravidade} onChange={e => setGravidade(e.target.value as Gravidade)} className={inputCls}>
                {Object.entries(GRAVIDADE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Departamento</label>
              <select value={area} onChange={e => setArea(e.target.value)} className={inputCls}>
                <option value="">Selecione…</option>
                {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Projeto / Obra <span className="font-normal opacity-60">(se operacional)</span></label>
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={inputCls}>
              <option value="">— Nenhum / não operacional</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} · ` : ''}{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Descrição</label>
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes / evidências..." className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending || !titulo.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />} Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card / Row ────────────────────────────────────────────────────────────────
function RegistroCard({ r, isDark, onClick }: { r: SgiRegistro; isDark: boolean; onClick: () => void }) {
  const g = GRAVIDADE_CFG[r.gravidade]
  const hoje = new Date().toISOString().split('T')[0]
  const atrasado = r.prazo && r.prazo < hoje && r.status_pdca !== 'encerrado'
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-xl border p-3 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.codigo ? `${r.codigo} · ` : ''}{r.titulo}</p>
        {r.classificacao === 'nc' && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">NC</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${g.bg} ${g.text}`}>{g.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{TIPO_REGISTRO_LABEL[r.tipo]}</span>
        <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ORIGEM_REGISTRO_LABEL[r.origem]}</span>
        {r.prazo && <span className={`text-[10px] flex items-center gap-0.5 ${atrasado ? 'text-red-500 font-bold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={10} />{fmtDate(r.prazo)}</span>}
      </div>
    </button>
  )
}

function RegistroRow({ r, isDark, onClick }: { r: SgiRegistro; isDark: boolean; onClick: () => void }) {
  const g = GRAVIDADE_CFG[r.gravidade]
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-all ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
      <span className={`w-[64px] text-xs font-semibold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.codigo || '—'}</span>
      <span className={`flex-1 text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.titulo}</span>
      <span className={`w-[90px] text-xs truncate shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{TIPO_REGISTRO_LABEL[r.tipo]}</span>
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.bg} ${g.text}`}>{g.label}</span>
      <span className={`w-[64px] text-xs text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(r.prazo)}</span>
    </button>
  )
}

// ── Main (card + abas por etapa + toolbar, padrão da casa) ────────────────────
export default function SgiMelhoriaContinua() {
  const { isDark } = useTheme()
  const { data: registros = [], isLoading } = useRegistros()
  const [tab, setTab] = useState<StatusPdca>('pendente')
  const [busca, setBusca] = useState('')
  const [view, setView] = useState<'cards' | 'list'>('cards')
  const [detail, setDetail] = useState<SgiRegistro | null>(null)
  const [showNovo, setShowNovo] = useState(false)

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    registros.forEach(r => { m[r.status_pdca] = (m[r.status_pdca] || 0) + 1 })
    return m
  }, [registros])

  const filtrados = useMemo(() => {
    let items = registros.filter(r => r.status_pdca === tab)
    if (busca) { const q = busca.toLowerCase(); items = items.filter(r => [r.codigo, r.titulo, r.area_processo].some(v => v?.toLowerCase().includes(q))) }
    return items
  }, [registros, tab, busca])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <RefreshCcw size={18} className="text-amber-500" /> Melhoria Contínua
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Anomalias, não conformidades e ações corretivas (PDCA)</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors shrink-0">
          <Plus size={14} /> Nova Anomalia
        </button>
      </div>

      {/* Abas por etapa */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {PDCA_STAGES.map(s => {
          const count = counts[s.key] || 0
          const isActive = tab === s.key
          const a = isDark ? TAB_ACCENT_DARK[s.key] : TAB_ACCENT[s.key]
          return (
            <button key={s.key} onClick={() => setTab(s.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              {s.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar registro..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white'}`} />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <div className={`flex items-center rounded-lg border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <button onClick={() => setView('list')} className={`p-1.5 ${view === 'list' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
          <button onClick={() => setView('cards')} className={`p-1.5 ${view === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
        </div>
        <span className={`ml-auto text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}</span>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto min-h-[200px]">
        {filtrados.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <RefreshCcw size={40} className="mb-3" /><p className="text-sm font-medium">Nenhum registro nesta etapa</p>
          </div>
        ) : view === 'cards' ? (
          <div className="space-y-2 p-4">
            {filtrados.map(r => <RegistroCard key={r.id} r={r} isDark={isDark} onClick={() => setDetail(r)} />)}
          </div>
        ) : (
          <div>
            <div className={`flex items-center gap-2 px-3 py-1 border-b text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <span className="w-[64px] shrink-0">Código</span><span className="flex-1">Título</span><span className="w-[90px] shrink-0">Tipo</span><span className="w-[58px] shrink-0">Grav.</span><span className="w-[64px] shrink-0 text-right">Prazo</span>
            </div>
            {filtrados.map(r => <RegistroRow key={r.id} r={r} isDark={isDark} onClick={() => setDetail(r)} />)}
          </div>
        )}
      </div>

      {detail && <RegistroModal registro={detail} onClose={() => setDetail(null)} isDark={isDark} />}
      {showNovo && <NovaAnomaliaModal onClose={() => setShowNovo(false)} isDark={isDark} />}
    </div>
  )
}
