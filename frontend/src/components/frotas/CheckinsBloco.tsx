// ─────────────────────────────────────────────────────────────────────────────
// CheckinsBloco — o último check-in diário na ficha do ativo, com atalho para a
// lista completa. Só o último fica visível: a ficha já é longa, e o histórico
// inteiro pertence ao submodal.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { ClipboardCheck, X, Loader, Gauge, Fuel, Users, Plus, Check } from 'lucide-react'
import { useCheckinsVeiculo, useCriarCheckinManual } from '../../hooks/useFrotas'
import { useAuth } from '../../contexts/AuthContext'
import { NotaIcone, AvariaIcone, ESCALA } from './CheckinIndicadores'

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

// ── Submodal: histórico de check-ins ─────────────────────────────────────────
function ListaCheckinsModal({ veiculoId, titulo, isLight, onClose }: {
  veiculoId: string; titulo: string; isLight: boolean; onClose: () => void
}) {
  const { data: lista = [], isLoading } = useCheckinsVeiculo(veiculoId)
  const isDark = !isLight
  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const border = isDark ? 'border-white/[0.08]' : 'border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const rowBg = isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-slate-200'

  return (
    // z-[60]: fica acima do modal do ativo, que é z-50.
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl shadow-2xl border ${border} ${bg}`}
      >
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${border}`}>
          <div className="min-w-0">
            <p className={`text-sm font-extrabold flex items-center gap-1.5 ${txtMain}`}>
              <ClipboardCheck size={15} className="text-blue-500" /> Check-ins diários
            </p>
            <p className={`text-[11px] truncate ${txtMuted}`}>{titulo}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className={`flex items-center justify-center gap-2 py-8 text-xs ${txtMuted}`}>
              <Loader size={14} className="animate-spin" /> Carregando…
            </div>
          ) : lista.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ClipboardCheck size={34} className={txtMuted} />
              <p className={`text-sm ${txtMuted}`}>Nenhum check-in registrado neste ativo.</p>
              <p className={`text-[11px] ${txtMuted}`}>
                Os check-ins chegam pelo Portal TEG, ao ler o QR do veículo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lista.map(c => (
                <div key={c.id} className={`rounded-xl border p-3 ${rowBg}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-xs font-bold ${txtMain}`}>{fmtDataHora(c.created_at)}</span>
                    <span className="flex items-center gap-2">
                      <NotaIcone nota={c.aval_funcional} size={15} titulo="Condição" />
                      <NotaIcone nota={c.aval_limpeza} size={15} titulo="Limpeza" />
                      <AvariaIcone temAvaria={c.tem_avaria} descricao={c.avarias_novas} size={15} />
                    </span>
                  </div>

                  <p className={`text-[11px] mt-1 ${txtMuted}`}>
                    {c.colaborador_nome ?? '—'}{c.obra_nome ? ` · ${c.obra_nome}` : ''}
                  </p>

                  <div className={`flex items-center gap-3 mt-1.5 text-[11px] flex-wrap ${txtMuted}`}>
                    {c.km_informado != null && (
                      <span className="inline-flex items-center gap-1">
                        <Gauge size={11} /> {fmtNum(Number(c.km_informado))} km
                      </span>
                    )}
                    {c.nivel_combustivel && (
                      <span className="inline-flex items-center gap-1">
                        <Fuel size={11} /> {c.nivel_combustivel}
                      </span>
                    )}
                    {c.qtd_passageiros > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} /> {c.qtd_passageiros} passageiro(s)
                      </span>
                    )}
                    {c.aval_funcional != null && ESCALA[c.aval_funcional] && (
                      <span>Condição: <b className={ESCALA[c.aval_funcional].cor}>{ESCALA[c.aval_funcional].label}</b></span>
                    )}
                    {c.aval_limpeza != null && ESCALA[c.aval_limpeza] && (
                      <span>Limpeza: <b className={ESCALA[c.aval_limpeza].cor}>{ESCALA[c.aval_limpeza].label}</b></span>
                    )}
                  </div>

                  {c.tem_avaria && c.avarias_novas && (
                    <p className="text-[11px] mt-1.5 font-semibold text-amber-600">Avaria: {c.avarias_novas}</p>
                  )}

                  {(c.foto_painel_url || c.foto_avaria_url) && (
                    <div className="flex gap-1.5 mt-2">
                      {[c.foto_painel_url, c.foto_avaria_url].filter(Boolean).map(url => (
                        <a key={url as string} href={url as string} target="_blank" rel="noopener noreferrer">
                          <img src={url as string} alt=""
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Bloco na ficha do ativo ──────────────────────────────────────────────────
export default function CheckinsBloco({ veiculoId, titulo, isLight }: {
  veiculoId: string
  /** Identificação do ativo no cabeçalho do submodal (código/placa). */
  titulo: string
  isLight: boolean
}) {
  const { data: lista = [], isLoading } = useCheckinsVeiculo(veiculoId, 1)
  const [verTodos, setVerTodos] = useState(false)
  const [novo, setNovo] = useState(false)
  const ultimo = lista[0]

  const isDark = !isLight
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const cardBg = isDark ? 'bg-white/[0.03]' : 'bg-slate-50'

  const Indicador = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <span className="flex flex-col items-center gap-0.5">
      {children}
      <span className={`text-[9px] font-bold uppercase tracking-wider ${txtMuted}`}>{label}</span>
    </span>
  )

  return (
    <div className={`rounded-xl border p-4 ${border} ${cardBg}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${txtMuted}`}>
          <ClipboardCheck size={11} /> Check-in diário
        </p>
        <span className="flex items-center gap-1">
          <button
            onClick={() => setNovo(v => !v)}
            title="Lançar check-in manual"
            className={`text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1 transition-colors ${
              novo
                ? isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'
                : isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <Plus size={11} /> Check-in
          </button>
          <button
            onClick={() => setVerTodos(true)}
            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
              isDark ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            Ver check-ins
          </button>
        </span>
      </div>

      {novo && (
        <CheckinManualForm
          veiculoId={veiculoId}
          isDark={isDark}
          onPronto={() => setNovo(false)}
        />
      )}

      {isLoading ? (
        <div className={`flex items-center justify-center gap-2 py-3 text-xs ${txtMuted}`}>
          <Loader size={13} className="animate-spin" /> Carregando…
        </div>
      ) : !ultimo ? (
        <p className={`text-xs text-center py-3 ${txtMuted}`}>Nenhum check-in registrado neste ativo.</p>
      ) : (
        <div className="flex items-center gap-5 flex-wrap">
          <Indicador label="Condição">
            <NotaIcone nota={ultimo.aval_funcional} size={20} titulo="Condição" />
          </Indicador>
          <Indicador label="Limpeza">
            <NotaIcone nota={ultimo.aval_limpeza} size={20} titulo="Limpeza" />
          </Indicador>
          <Indicador label="Avarias">
            <AvariaIcone temAvaria={ultimo.tem_avaria} descricao={ultimo.avarias_novas} size={20} />
          </Indicador>
          <span className="min-w-0">
            <span className={`block text-[11px] font-semibold ${txtMain}`}>{fmtDataHora(ultimo.created_at)}</span>
            <span className={`block text-[10px] truncate ${txtMuted}`}>{ultimo.colaborador_nome ?? '—'}</span>
          </span>
        </div>
      )}

      {verTodos && (
        <ListaCheckinsModal
          veiculoId={veiculoId}
          titulo={titulo}
          isLight={isLight}
          onClose={() => setVerTodos(false)}
        />
      )}
    </div>
  )
}

// ── Check-in manual (escritório) ─────────────────────────────────────────────
// Todos os campos são opcionais: preenche só o que se sabe. A data/hora do
// lançamento é sempre gravada (created_at).
function CheckinManualForm({ veiculoId, isDark, onPronto }: {
  veiculoId: string; isDark: boolean; onPronto: () => void
}) {
  const { perfil } = useAuth()
  const criar = useCriarCheckinManual()
  const [cond, setCond] = useState<number | null>(null)
  const [limp, setLimp] = useState<number | null>(null)
  const [km, setKm] = useState('')
  const [avaria, setAvaria] = useState('')
  const [obs, setObs] = useState('')

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inp = `w-full text-[11px] rounded-lg border px-2 py-1.5 outline-none ${
    isDark ? 'bg-white/[0.04] border-white/10 text-slate-100 placeholder-slate-500'
           : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'}`

  const nada = cond == null && limp == null && !km.trim() && !avaria.trim() && !obs.trim()

  const Escala = ({ valor, onSel, label }: { valor: number | null; onSel: (n: number | null) => void; label: string }) => (
    <div>
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>{label}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(n => {
          const e = ESCALA[n]
          const Ic = e.icon
          const on = valor === n
          return (
            <button
              key={n}
              type="button"
              title={e.label}
              onClick={() => onSel(on ? null : n)}
              className={`p-1 rounded-lg transition-all ${on ? `${e.bg} ${e.cor} ring-1 ring-current` : `${txtMuted} hover:opacity-100 opacity-50`}`}
            >
              <Ic size={16} />
            </button>
          )
        })}
      </div>
    </div>
  )

  async function salvar() {
    if (nada) return
    try {
      await criar.mutateAsync({
        veiculoId,
        avalFuncional: cond,
        avalLimpeza: limp,
        kmInformado: km.trim() ? Number(km.replace(/\D/g, '')) : null,
        avariasNovas: avaria.trim() || null,
        temAvaria: !!avaria.trim(),
        observacao: obs.trim() || null,
        colaboradorId: perfil?.colaborador_id ?? null,
        registradoPorNome: perfil?.nome ?? null,
      })
      onPronto()
    } catch (e: any) {
      alert(`Erro ao lançar check-in: ${e?.message ?? 'desconhecido'}`)
    }
  }

  return (
    <div className={`rounded-lg border p-3 mb-3 ${isDark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap gap-4 mb-2">
        <Escala valor={cond} onSel={setCond} label="Condição" />
        <Escala valor={limp} onSel={setLimp} label="Limpeza" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={km} onChange={e => setKm(e.target.value)} inputMode="numeric" placeholder="Hodômetro (opcional)" className={inp} />
        <input value={avaria} onChange={e => setAvaria(e.target.value)} placeholder="Avaria observada (opcional)" className={inp} />
      </div>
      <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)" className={`${inp} mb-2`} />
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] ${txtMuted}`}>
          {nada ? 'Preencha ao menos um campo' : 'Só o preenchido será gravado'}
        </span>
        <span className="flex items-center gap-1">
          <button onClick={onPronto} className={`text-[10px] font-bold px-2 py-1.5 rounded-lg ${txtMuted}`}>Cancelar</button>
          <button
            onClick={salvar}
            disabled={nada || criar.isPending}
            className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 inline-flex items-center gap-1"
          >
            {criar.isPending ? <Loader size={11} className="animate-spin" /> : <Check size={11} />}
            Salvar
          </button>
        </span>
      </div>
    </div>
  )
}
