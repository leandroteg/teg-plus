import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, PackageCheck, Eraser, Loader2, PenLine, CheckCircle2, AlertTriangle, Package, ShieldCheck, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import type { Cautela } from '../../types/cautela'
import { useDevolverItens } from '../../hooks/useCautelas'
import { supabase, verifySenha } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { gerarTermoPdfBlob } from '../../utils/termo-aceite-cautela-pdf'

interface Props {
  cautela: Cautela
  isDark: boolean
  onClose: () => void
}

type CondicaoDev = 'bom' | 'usado' | 'danificado'

const COND_OPTS: { value: CondicaoDev; label: string }[] = [
  { value: 'bom',        label: 'Bom' },
  { value: 'usado',      label: 'Usado' },
  { value: 'danificado', label: 'Danificado' },
]

// ── SignaturePad: canvas reaproveitavel (HiDPI + pointer events) ──────────────
export interface SignaturePadHandle {
  hasSignature: () => boolean
  toBlob: () => Promise<Blob>
  clear: () => void
}

const SignaturePad = forwardRef<SignaturePadHandle, { isDark: boolean; disabled?: boolean }>(
  function SignaturePad({ isDark, disabled }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const [touched, setTouched] = useState(false)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, rect.width * ratio)
      canvas.height = Math.max(1, rect.height * ratio)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#0f172a'
      }
    }, [])

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      drawing.current = true
      const { x, y } = pos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
      canvasRef.current?.setPointerCapture(e.pointerId)
    }
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const { x, y } = pos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      if (!touched) setTouched(true)
    }
    const end = () => { drawing.current = false }

    useImperativeHandle(ref, () => ({
      hasSignature: () => touched,
      toBlob: () => new Promise<Blob>((resolve, reject) => {
        const c = canvasRef.current
        if (!c) return reject(new Error('canvas indisponivel'))
        c.toBlob(b => (b ? resolve(b) : reject(new Error('falha ao gerar PNG'))), 'image/png')
      }),
      clear: () => {
        const c = canvasRef.current
        const ctx = c?.getContext('2d')
        if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
        setTouched(false)
      },
    }), [touched])

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className={`w-full h-32 rounded-xl border bg-white touch-none ${
          isDark ? 'border-white/[0.12]' : 'border-slate-300'
        } ${disabled ? 'opacity-40' : ''}`}
        style={{ touchAction: 'none' }}
      />
    )
  }
)

export default function DevolucaoModal({ cautela, isDark, onClose }: Props) {
  const { perfil } = useAuth()
  const colaboradorPadRef = useRef<SignaturePadHandle>(null)
  const recebedorPadRef = useRef<SignaturePadHandle>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const devolverMutation = useDevolverItens()

  // Recebedor (almoxarife/admin que recebe o material de volta)
  const [recebedorEmail, setRecebedorEmail] = useState(perfil?.email ?? '')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [senhaOk, setSenhaOk] = useState<null | { userId: string; nome: string }>(null)
  const [verificando, setVerificando] = useState(false)

  const itens = cautela.itens ?? []

  const [linhas, setLinhas] = useState(() =>
    itens.map(it => {
      const restante = Math.max(0, (it.quantidade ?? 0) - (it.quantidade_devolvida ?? 0))
      return {
        id: it.id,
        item_id: it.item_id,
        descricao: it.item?.descricao || it.descricao_livre || 'Item',
        codigo: it.item?.codigo,
        unidade: it.item?.unidade,
        quantidade_total: it.quantidade,
        quantidade_devolvida_antes: it.quantidade_devolvida ?? 0,
        quantidade_devolver: restante,
        restante,
        condicao: 'bom' as CondicaoDev,
      }
    })
  )

  const algumPraDevolver = linhas.some(l => l.quantidade_devolver > 0)

  function setLinha(id: string, patch: Partial<typeof linhas[number]>) {
    setLinhas(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  // Quando email muda, invalida senha checada
  useEffect(() => { setSenhaOk(null) }, [recebedorEmail])

  async function handleVerificarSenha() {
    setErro(null)
    if (!recebedorEmail.trim() || !senha) {
      setErro('Informe e-mail e senha do recebedor.')
      return
    }
    setVerificando(true)
    try {
      const res = await verifySenha(recebedorEmail.trim().toLowerCase(), senha)
      if (!res.ok) {
        setErro('E-mail ou senha do recebedor invalidos.')
        setSenhaOk(null)
        return
      }
      // Busca o perfil pra ter o nome canonico
      const { data: perfilRec } = await supabase
        .from('sys_perfis')
        .select('id, nome')
        .eq('auth_id', res.userId)
        .maybeSingle()
      if (!perfilRec) {
        setErro('Recebedor autenticado mas sem perfil cadastrado em sys_perfis.')
        return
      }
      setSenhaOk({ userId: perfilRec.id, nome: perfilRec.nome })
    } finally {
      setVerificando(false)
    }
  }

  async function handleConfirmar() {
    if (busy) return
    setErro(null)
    if (!algumPraDevolver) {
      setErro('Nenhum item com quantidade a devolver. Ajuste os valores antes.')
      return
    }
    for (const l of linhas) {
      if (l.quantidade_devolver < 0) {
        setErro(`Quantidade negativa em ${l.descricao}.`)
        return
      }
      if (l.quantidade_devolver > l.restante) {
        setErro(`Devolucao de ${l.descricao} maior que o saldo em aberto (${l.restante}).`)
        return
      }
    }
    if (!colaboradorPadRef.current?.hasSignature()) {
      setErro('Peca a assinatura do colaborador que devolve.')
      return
    }
    if (!senhaOk) {
      setErro('Recebedor precisa validar a senha antes de confirmar.')
      return
    }
    if (!recebedorPadRef.current?.hasSignature()) {
      setErro('Recebedor precisa assinar.')
      return
    }

    setBusy(true)
    try {
      const ts = Date.now()

      // Uploads
      const assColabBlob = await colaboradorPadRef.current!.toBlob()
      const assRecBlob = await recebedorPadRef.current!.toBlob()
      const assColabPath = `${cautela.id}/assinatura_devolucao_${ts}.png`
      const assRecPath   = `${cautela.id}/assinatura_recebedor_devolucao_${ts}.png`

      const up1 = await supabase.storage.from('cautelas-termos')
        .upload(assColabPath, assColabBlob, { contentType: 'image/png', upsert: false })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from('cautelas-termos')
        .upload(assRecPath, assRecBlob, { contentType: 'image/png', upsert: false })
      if (up2.error) throw up2.error

      // Grava paths + recebedor na cautela
      const { error: updErr } = await supabase
        .from('est_cautelas')
        .update({
          assinatura_devolucao_url: assColabPath,
          assinatura_recebedor_devolucao_url: assRecPath,
          recebedor_id: senhaOk.userId,
          recebedor_nome: senhaOk.nome,
        })
        .eq('id', cautela.id)
      if (updErr) throw updErr

      // Chama RPC que registra mov de devolucao + transita status
      const itensPayload = linhas
        .filter(l => l.quantidade_devolver > 0)
        .map(l => ({
          id: l.id,
          quantidade_devolvida: l.quantidade_devolvida_antes + l.quantidade_devolver,
          condicao_devolucao: l.condicao,
        }))
      await devolverMutation.mutateAsync({
        cautela_id: cautela.id,
        itens: itensPayload,
      })

      // Regenera o termo (agora com a seção DEVOLUÇÃO + as 2 assinaturas) e
      // substitui o termo_url. Não bloqueia a devolução se falhar.
      try {
        const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result as string)
          r.onerror = rej
          r.readAsDataURL(b)
        })

        // Assinatura de retirada (arquivada no storage) → dataURL, p/ manter no PDF
        let assinaturaRetiradaDataUrl: string | undefined
        if (cautela.assinatura_retirada_url) {
          const { data: signed } = await supabase.storage
            .from('cautelas-termos')
            .createSignedUrl(cautela.assinatura_retirada_url, 120)
          if (signed?.signedUrl) {
            const resp = await fetch(signed.signedUrl)
            if (resp.ok) assinaturaRetiradaDataUrl = await blobToDataUrl(await resp.blob())
          }
        }

        // Registro atualizado (data_devolucao_real / status pós-RPC)
        const { data: freshRow } = await supabase
          .from('est_cautelas').select('*').eq('id', cautela.id).single()

        const cautelaPdf: Cautela = {
          ...((freshRow as Cautela) ?? cautela),
          itens: cautela.itens ?? [],
          recebedor_nome: senhaOk.nome,
        }

        const termoBlob = await gerarTermoPdfBlob({
          cautela: cautelaPdf,
          baseNome: cautela.base?.nome,
          assinaturaDataUrl: assinaturaRetiradaDataUrl,
          assinaturaDevolucaoColaboradorDataUrl: await blobToDataUrl(assColabBlob),
          assinaturaDevolucaoRecebedorDataUrl: await blobToDataUrl(assRecBlob),
        })

        const termoPath = `${cautela.id}/termo_${ts}.pdf`
        const upT = await supabase.storage.from('cautelas-termos')
          .upload(termoPath, termoBlob, { contentType: 'application/pdf', upsert: true })
        if (!upT.error) {
          await supabase.from('est_cautelas').update({ termo_url: termoPath }).eq('id', cautela.id)
        }
      } catch (regenErr) {
        console.warn('Falha ao regenerar termo com devolução:', regenErr)
      }

      setSavedOk(true)
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao confirmar devolucao.')
    } finally {
      setBusy(false)
    }
  }

  const panelCls = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.06] text-white' : 'border-slate-200 bg-white text-slate-700'
  }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto ${panelCls}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
            <PackageCheck size={18} className="text-violet-500" />
          </div>
          <div className="min-w-0">
            <h2 className={`text-sm font-extrabold truncate ${txtMain}`}>Devolução de Cautela</h2>
            <p className={`text-xs ${txtMuted}`}>Cautela {cautela.numero || '—'}</p>
          </div>
          <button
            onClick={onClose}
            className={`ml-auto w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {savedOk && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} /> Devolução registrada. Estoque atualizado.
            </div>
          )}
          {erro && (
            <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 text-xs font-bold px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} /> {erro}
            </div>
          )}

          {/* ─ Itens ───────────────────────────────────────────────────── */}
          <div>
            <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5 ${txtMuted}`}>
              <Package size={13} /> Itens a devolver
            </label>
            <div className="space-y-2">
              {linhas.map(l => {
                const tudoDevolvido = l.restante === 0
                return (
                  <div
                    key={l.id}
                    className={`rounded-xl border p-2.5 space-y-2 ${
                      tudoDevolvido
                        ? (isDark ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-emerald-50/60 border-emerald-200 opacity-60')
                        : (isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-100')
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${txtMain}`}>{l.descricao}</p>
                        <p className={`text-[10px] ${txtMuted}`}>
                          {l.codigo ? `${l.codigo} · ` : ''}Retirado {l.quantidade_total}{l.unidade ? ` ${l.unidade}` : ''}
                          {l.quantidade_devolvida_antes > 0 && ` · Já devolvido ${l.quantidade_devolvida_antes}`}
                        </p>
                      </div>
                      {tudoDevolvido && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 rounded px-1.5 py-0.5 shrink-0">
                          Devolvido
                        </span>
                      )}
                    </div>
                    {!tudoDevolvido && (
                      <div className="grid grid-cols-[1fr,auto] gap-2 items-end">
                        <div>
                          <label className={`block text-[10px] font-semibold mb-0.5 ${txtMuted}`}>
                            Quantidade (máx {l.restante})
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={l.restante}
                            step="0.001"
                            value={l.quantidade_devolver}
                            onChange={e => setLinha(l.id, { quantidade_devolver: Math.max(0, Number(e.target.value) || 0) })}
                            disabled={busy}
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
                              isDark ? 'bg-white/[0.04] border-white/[0.06] text-white' : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-[10px] font-semibold mb-0.5 ${txtMuted}`}>Condição</label>
                          <select
                            value={l.condicao}
                            onChange={e => setLinha(l.id, { condicao: e.target.value as CondicaoDev })}
                            disabled={busy}
                            className={`px-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
                              isDark ? 'bg-white/[0.04] border-white/[0.06] text-white' : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            {COND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─ Assinatura do colaborador ───────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${txtMuted}`}>
                <PenLine size={13} /> Quem está devolvendo (colaborador)
              </label>
              <button
                onClick={() => colaboradorPadRef.current?.clear()}
                disabled={busy}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                  isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Eraser size={12} /> Limpar
              </button>
            </div>
            <SignaturePad ref={colaboradorPadRef} isDark={isDark} disabled={busy} />
          </div>

          {/* ─ Recebedor: senha + assinatura ───────────────────────────── */}
          <div className={`rounded-xl border p-3 space-y-2.5 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-200'}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-amber-600" />
              <p className={`text-xs font-extrabold uppercase tracking-wider ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                Quem está recebendo (almoxarife/admin)
              </p>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-amber-200/80' : 'text-amber-700'}`}>
              Confirme sua identidade com sua senha. A devolução só finaliza após valida-la.
            </p>

            {/* Email */}
            <div>
              <label className={`block text-[10px] font-semibold mb-0.5 ${txtMuted}`}>
                <Mail size={10} className="inline mr-1" /> E-mail
              </label>
              <input
                type="email"
                value={recebedorEmail}
                onChange={e => setRecebedorEmail(e.target.value)}
                disabled={busy || verificando || !!senhaOk}
                placeholder="seu.email@teguniao.com.br"
                className={inputCls}
              />
            </div>

            {/* Senha + verificar */}
            {!senhaOk ? (
              <div>
                <label className={`block text-[10px] font-semibold mb-0.5 ${txtMuted}`}>
                  <Lock size={10} className="inline mr-1" /> Senha
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      disabled={busy || verificando}
                      placeholder="••••••••"
                      className={`${inputCls} pr-9`}
                      onKeyDown={e => { if (e.key === 'Enter') handleVerificarSenha() }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={handleVerificarSenha}
                    disabled={busy || verificando || !recebedorEmail.trim() || !senha}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {verificando ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    Validar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-100 border border-emerald-300 px-2.5 py-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <p className="text-xs font-bold text-emerald-800 flex-1 truncate">
                  Recebedor: {senhaOk.nome}
                </p>
                <button
                  onClick={() => { setSenhaOk(null); setSenha('') }}
                  className="text-[10px] font-semibold text-emerald-700 hover:underline"
                >
                  Trocar
                </button>
              </div>
            )}

            {/* Assinatura recebedor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${txtMuted}`}>
                  <PenLine size={11} /> Assinatura do recebedor
                </label>
                <button
                  onClick={() => recebedorPadRef.current?.clear()}
                  disabled={busy}
                  className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${
                    isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Eraser size={11} /> Limpar
                </button>
              </div>
              <SignaturePad ref={recebedorPadRef} isDark={isDark} disabled={busy || !senhaOk} />
              {!senhaOk && (
                <p className={`text-[10px] mt-1 ${txtMuted}`}>Valide a senha antes de assinar.</p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className={`flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-colors disabled:opacity-50 ${
                isDark ? 'border-white/[0.12] text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={busy || !algumPraDevolver || !senhaOk}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
              Confirmar devolução
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
