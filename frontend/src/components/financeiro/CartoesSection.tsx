import { useState, useEffect, type FormEvent } from 'react'
import { CreditCard, Plus, Pencil, X, Save, Loader2, AlertTriangle } from 'lucide-react'
import { useCartoesAll, useCriarCartao, useAtualizarCartao } from '../../hooks/useCartoes'
import { UpperInput, UpperTextarea } from '../UpperInput'
import type { CartaoCredito, BandeiraCartao } from '../../types/financeiro'

const BANDEIRAS: { value: BandeiraCartao; label: string }[] = [
  { value: 'visa',       label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo',        label: 'Elo' },
  { value: 'amex',       label: 'Amex' },
  { value: 'hipercard',  label: 'Hipercard' },
  { value: 'outro',      label: 'Outro' },
]

const fmtMoney = (v?: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface FormState {
  nome: string
  bandeira: BandeiraCartao
  ultimos4: string
  limite: string
  observacoes: string
  ativo: boolean
}

const EMPTY: FormState = {
  nome: '', bandeira: 'visa', ultimos4: '', limite: '', observacoes: '', ativo: true,
}

function toForm(c: CartaoCredito): FormState {
  return {
    nome: c.nome ?? '',
    bandeira: c.bandeira,
    ultimos4: c.ultimos4 ?? '',
    limite: c.limite != null ? String(c.limite) : '',
    observacoes: c.observacoes ?? '',
    ativo: c.ativo,
  }
}

export default function CartoesSection({ isDark, isAdmin }: { isDark: boolean; isAdmin: boolean }) {
  const { data: cartoes, isLoading } = useCartoesAll()
  const criar = useCriarCartao()
  const atualizar = useAtualizarCartao()

  const [editing, setEditing] = useState<CartaoCredito | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) setErr(null)
  }, [open])

  function openNovo() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  function openEdit(c: CartaoCredito) {
    setEditing(c)
    setForm(toForm(c))
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)

    const nome = form.nome.trim()
    if (!nome) {
      setErr('Informe o nome do cartao.')
      return
    }
    if (form.ultimos4 && !/^\d{4}$/.test(form.ultimos4)) {
      setErr('Ultimos 4 digitos devem ser 4 numeros.')
      return
    }
    const limiteNum = form.limite ? Number(form.limite.replace(',', '.')) : null
    if (limiteNum != null && (!Number.isFinite(limiteNum) || limiteNum < 0)) {
      setErr('Limite invalido.')
      return
    }

    const payload: Partial<CartaoCredito> = {
      nome,
      bandeira: form.bandeira,
      ultimos4: form.ultimos4 || undefined,
      limite: limiteNum ?? undefined,
      observacoes: form.observacoes.trim() || undefined,
      ativo: form.ativo,
    }

    try {
      if (editing) {
        await atualizar.mutateAsync({ id: editing.id, ...payload })
      } else {
        await criar.mutateAsync(payload)
      }
      setOpen(false)
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message :
        typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) :
        'Falha ao salvar.'
      setErr(msg)
    }
  }

  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-slate-200' : 'text-slate-700'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm placeholder-slate-400
    focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400
    disabled:opacity-50 disabled:cursor-not-allowed
    ${isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
      <div className={`px-5 py-4 border-b flex items-center justify-between gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-emerald-600" />
          <h2 className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Cartoes de Credito</h2>
        </div>
        {isAdmin && (
          <button
            onClick={openNovo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white
              text-[11px] font-bold shadow-sm hover:bg-emerald-700 transition-all"
          >
            <Plus size={12} />
            Novo cartao
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-emerald-500" />
          </div>
        ) : !cartoes || cartoes.length === 0 ? (
          <p className={`text-xs italic py-4 text-center ${muted}`}>
            Nenhum cartao cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {cartoes.map(c => (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5
                  ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}
                  ${!c.ativo ? 'opacity-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold truncate ${txt}`}>{c.nome}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                      ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                      {c.bandeira}
                    </span>
                    {!c.ativo && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide
                        ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] ${muted}`}>
                    {c.ultimos4 ? `**** ${c.ultimos4}` : 'sem ultimos 4'} · Limite {fmtMoney(c.limite)}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => openEdit(c)}
                    className={`p-2 rounded-lg transition-colors
                      ${isDark ? 'text-slate-400 hover:text-emerald-400 hover:bg-white/[0.04]' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                    title="Editar"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal cadastro/edicao ──────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmit}
            className={`w-full max-w-md rounded-2xl border shadow-xl ${card} max-h-[90vh] flex flex-col`}
          >
            <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200/60'}`}>
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-emerald-500" />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {editing ? 'Editar cartao' : 'Novo cartao'}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {/* Nome */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${muted}`}>Nome *</label>
                <UpperInput
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="VISA CORPORATIVO"
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Bandeira + Ultimos 4 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${muted}`}>Bandeira *</label>
                  <select
                    value={form.bandeira}
                    onChange={e => setForm(f => ({ ...f, bandeira: e.target.value as BandeiraCartao }))}
                    className={inputCls}
                  >
                    {BANDEIRAS.map(b => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${muted}`}>Ultimos 4</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.ultimos4}
                    onChange={e => setForm(f => ({ ...f, ultimos4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="1234"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Limite */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${muted}`}>Limite (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.limite}
                  onChange={e => setForm(f => ({ ...f, limite: e.target.value.replace(/[^\d.,]/g, '') }))}
                  placeholder="10000.00"
                  className={inputCls}
                />
              </div>

              {/* Observacoes */}
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${muted}`}>Observacoes</label>
                <UpperTextarea
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className={inputCls}
                />
              </div>

              {/* Ativo (somente edicao) */}
              {editing && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-sm font-semibold ${txt}`}>Ativo</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                      ${form.ativo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
                      ${form.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}

              {err && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium
                  bg-red-50 border border-red-200 text-red-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  {err}
                </div>
              )}
            </div>

            <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200/60'}`}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all
                  ${isDark ? 'bg-[#1e293b] border-white/[0.06] text-slate-300 hover:border-slate-400' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criar.isPending || atualizar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white
                  text-[11px] font-bold shadow-sm hover:bg-emerald-700 transition-all
                  disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(criar.isPending || atualizar.isPending) ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
