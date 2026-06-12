import { useRef, useState, useEffect, useCallback } from 'react'
import { X, PackageCheck, Eraser, Loader2, PenLine, CheckCircle2, AlertTriangle, Package } from 'lucide-react'
import type { Cautela, CautelaItem } from '../../types/cautela'
import { useDevolverItens } from '../../hooks/useCautelas'
import { supabase } from '../../services/supabase'

interface Props {
  cautela: Cautela
  isDark: boolean
  onClose: () => void
}

type CondicaoDev = 'bom' | 'usado' | 'danificado'

const COND_OPTS: { value: CondicaoDev; label: string; color: string }[] = [
  { value: 'bom',        label: 'Bom',        color: 'emerald' },
  { value: 'usado',      label: 'Usado',      color: 'amber' },
  { value: 'danificado', label: 'Danificado', color: 'red' },
]

export default function DevolucaoModal({ cautela, isDark, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [savedOk, setSavedOk] = useState(false)
  const devolverMutation = useDevolverItens()

  const itens = cautela.itens ?? []

  // Estado por item: quantidade a devolver agora + condição
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

  // ── Canvas setup (HiDPI) ───────────────────────────────────────────────────
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

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasSignature) setHasSignature(true)
  }
  const end = () => { drawing.current = false }
  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [])

  function canvasToPngBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const c = canvasRef.current
      if (!c) return reject(new Error('canvas indisponível'))
      c.toBlob(b => (b ? resolve(b) : reject(new Error('falha ao gerar PNG'))), 'image/png')
    })
  }

  function setLinha(id: string, patch: Partial<typeof linhas[number]>) {
    setLinhas(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  async function handleConfirmar() {
    if (busy) return
    setErro(null)
    if (!algumPraDevolver) {
      setErro('Nenhum item com quantidade a devolver. Ajuste os valores antes.')
      return
    }
    // Validações
    for (const l of linhas) {
      if (l.quantidade_devolver < 0) {
        setErro(`Quantidade negativa em ${l.descricao}.`)
        return
      }
      if (l.quantidade_devolver > l.restante) {
        setErro(`Devolução de ${l.descricao} maior que o saldo em aberto (${l.restante}).`)
        return
      }
    }
    if (!hasSignature) {
      setErro('Peça a assinatura do colaborador antes de confirmar.')
      return
    }

    setBusy(true)
    try {
      // 1) Upload assinatura de devolução
      const assBlob = await canvasToPngBlob()
      const ts = Date.now()
      const assPath = `${cautela.id}/assinatura_devolucao_${ts}.png`
      const { error: upErr } = await supabase.storage
        .from('cautelas-termos')
        .upload(assPath, assBlob, { contentType: 'image/png', upsert: false })
      if (upErr) throw upErr

      // 2) Grava path no est_cautelas (não bloqueia se falhar a 1ª, mas é raro)
      await supabase
        .from('est_cautelas')
        .update({ assinatura_devolucao_url: assPath })
        .eq('id', cautela.id)

      // 3) Chama RPC que insere devolucao em est_movimentacoes (pelo delta)
      //    e transita status pra em_devolucao | encerrada
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

      setSavedOk(true)
      setTimeout(() => onClose(), 1500)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao confirmar devolução.')
    } finally {
      setBusy(false)
    }
  }

  const panelCls = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

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

          {/* Lista de itens */}
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
            {linhas.length === 0 && (
              <p className={`text-xs ${txtMuted}`}>Cautela sem itens.</p>
            )}
          </div>

          {/* Assinatura */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${txtMuted}`}>
                <PenLine size={13} /> Assinatura do colaborador
              </label>
              <button
                onClick={clear}
                disabled={!hasSignature || busy}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                  isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Eraser size={12} /> Limpar
              </button>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onPointerLeave={end}
              className={`w-full h-32 rounded-xl border bg-white touch-none ${
                isDark ? 'border-white/[0.12]' : 'border-slate-300'
              }`}
              style={{ touchAction: 'none' }}
            />
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
              disabled={busy || !algumPraDevolver || !hasSignature}
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
