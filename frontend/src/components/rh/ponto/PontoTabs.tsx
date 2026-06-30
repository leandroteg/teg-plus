// components/rh/ponto/PontoTabs.tsx — conteúdo das 6 abas do DP > Ponto
import { useMemo, useState } from 'react'
import { Loader2, ChevronRight, ChevronDown, Check, X, FileText, Lock, Filter, Send, Users, Clock, Timer, UserX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAuth } from '../../../contexts/AuthContext'
import {
  usePontoResumoMes, usePontoCartao, usePontoRetificacoes, usePontoHorasExtras,
  usePontoAtestados, useAprovarItem, useEnviarItens, usePontoDia,
} from '../../../hooks/usePonto'
import { fmtHoras, fmtHora, intervalToMin, minToHoras, labelMes } from '../../../lib/ponto'
import type { PontoResumoMes, PontoTabProps, AprovStatus, AprovKey, AprovTipo, PontoRetificacao } from '../../../types/ponto'

// ── helpers visuais ──────────────────────────────────────────────────────────
function Painel({ children }: { children: React.ReactNode }) {
  const { isLightSidebar: isLight } = useTheme()
  return <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'}`}>{children}</div>
}
function Loading() { return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-500" size={26} /></div> }
function Vazio({ msg }: { msg: string }) {
  const { isLightSidebar: isLight } = useTheme()
  return <div className={`text-center py-16 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{msg}</div>
}
const TH = 'text-left text-[10px] uppercase tracking-widest font-bold px-3 py-2.5'
const TD = 'px-3 py-2 text-xs'
function useThemeCls() {
  const { isLightSidebar: isLight } = useTheme()
  return {
    isLight,
    head: isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/[0.03] text-slate-400',
    row: isLight ? 'border-slate-100 hover:bg-slate-50/70' : 'border-white/[0.05] hover:bg-white/[0.03]',
    txt: isLight ? 'text-slate-700' : 'text-slate-200',
    sub: isLight ? 'text-slate-400' : 'text-slate-500',
    input: isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-700 bg-slate-800 text-white',
  }
}
const STATUS_CLS: Record<string, string> = { pendente: 'bg-amber-500/15 text-amber-500', em_aprovacao: 'bg-sky-500/15 text-sky-500', aprovado: 'bg-emerald-500/15 text-emerald-500', reprovado: 'bg-rose-500/15 text-rose-500' }
const STATUS_LBL: Record<string, string> = { pendente: 'pendente', em_aprovacao: 'em aprovação', aprovado: 'aprovado', reprovado: 'reprovado' }
function Status({ s }: { s: AprovStatus }) {
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${STATUS_CLS[s] || STATUS_CLS.pendente}`}>{STATUS_LBL[s] || s}</span>
}
function useAprovador() {
  const { user } = useAuth()
  return (user as { nome?: string; email?: string } | null)?.nome || (user as { email?: string } | null)?.email || 'RH'
}
export const RUIDO_MIGRACAO = /aplicativo|sistema|teste/i
const tipoLabel: Record<AprovTipo, string> = { retificacao: 'Retificação', hora_extra: 'Hora extra', atestado: 'Atestado' }
const tipoCor: Record<AprovTipo, string> = { retificacao: 'text-amber-500', hora_extra: 'text-orange-500', atestado: 'text-rose-500' }
function matchPessoa(nome: string | null | undefined, q: string) {
  return !q.trim() || (nome ?? '').toLowerCase().includes(q.trim().toLowerCase())
}

// seleção em lote (checkbox por linha + marcar/desmarcar todos)
function useSelecao() {
  const [sel, setSel] = useState<Set<string>>(new Set())
  return {
    sel,
    toggle: (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }),
    setAll: (ids: string[]) => setSel(new Set(ids)),
    clear: () => setSel(new Set()),
  }
}
function SelecaoBar({ n, onEnviar, pending }: { n: number; onEnviar: () => void; pending: boolean }) {
  const c = useThemeCls()
  if (!n) return null
  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-xl ${c.isLight ? 'bg-violet-50 border border-violet-100' : 'bg-violet-500/10 border border-violet-500/20'}`}>
      <span className={`text-xs font-semibold ${c.txt}`}>{n} selecionado(s)</span>
      <button onClick={onEnviar} disabled={pending} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"><Send size={12} /> Enviar para aprovação</button>
    </div>
  )
}
export function MultiSelectJustif({ motivos, ocultos, toggle }: { motivos: string[]; ocultos: Set<string>; toggle: (m: string) => void }) {
  const c = useThemeCls()
  const [open, setOpen] = useState(false)
  const sel = motivos.filter(m => !ocultos.has(m)).length
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${c.input}`}>
        Justificativas <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-500">{sel}/{motivos.length}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className={`absolute z-20 mt-1 min-w-[230px] max-h-64 overflow-y-auto rounded-xl border shadow-xl p-1.5 ${c.isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10'}`}>
          {!motivos.length && <div className={`text-xs px-2 py-1.5 ${c.sub}`}>Nenhuma justificativa</div>}
          {motivos.map(m => (
            <label key={m} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg cursor-pointer ${c.isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.05]'} ${c.txt}`}>
              <input type="checkbox" checked={!ocultos.has(m)} onChange={() => toggle(m)} className="accent-violet-500" /> {m}
            </label>
          ))}
        </div>
      </>)}
    </div>
  )
}
// célula de checkbox no header
function ThCheck({ all, none, onToggle }: { all: boolean; none: boolean; onToggle: () => void }) {
  return <th className={`${TH} w-px`}><input type="checkbox" checked={all} onChange={onToggle} disabled={none} className="accent-violet-500" /></th>
}

// ════════════════════════════════════════════════════════════════════════════
// 1) REGISTROS PONTO
// ════════════════════════════════════════════════════════════════════════════
export const REG_CHIPS: { k: string; label: string; icon: LucideIcon }[] = [
  { k: 'todos', label: 'Todos', icon: Users },
  { k: 'aberto', label: 'Pontos em aberto', icon: Clock },
  { k: 'extras', label: 'Horas extras', icon: Timer },
  { k: 'ausencias', label: 'Ausências', icon: UserX },
]

export function RegistrosPontoTab(props: PontoTabProps) {
  return props.vista === 'dia' ? <RegistrosDia {...props} /> : <RegistrosMes {...props} />
}

function RegistrosMes({ anoMes, baseId, pessoa, quickReg }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const { data: atestados = [] } = usePontoAtestados(anoMes)
  const c = useThemeCls()
  const [sel, setSel] = useState<PontoResumoMes | null>(null)
  const afastados = new Set(atestados.map(a => a.colaborador_id).filter(Boolean))
  const lista = data.filter(r => matchPessoa(r.colaborador_nome, pessoa) && (
    quickReg === 'aberto' ? (intervalToMin(r.faltas) > 0 || intervalToMin(r.atrasos) > 0)
      : quickReg === 'extras' ? intervalToMin(r.extras) > 0
        : quickReg === 'ausencias' ? (!!r.colaborador_id && afastados.has(r.colaborador_id))
          : true
  ))

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-4">
      {!lista.length ? <Painel><Vazio msg={`Nenhum registro nesse filtro em ${labelMes(anoMes)}.`} /></Painel> : (
      <Painel>
        <table className="w-full">
          <thead><tr className={c.head}>
            <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Dias</th>
            <th className={`${TH} hidden sm:table-cell`}>HH Trab.</th><th className={TH}>Extras</th><th className={TH}>Faltas</th><th className={TH}></th>
          </tr></thead>
          <tbody>{lista.map(r => (
            <tr key={r.colaborador_id ?? r.colaborador_nome} onClick={() => setSel(r)} className={`border-t cursor-pointer ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome ?? '—'}<div className={`text-[10px] ${c.sub}`}>{r.cargo}</div></td>
              <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
              <td className={`${TD} ${c.txt}`}>{r.dias_batidos}/{r.dias}</td>
              <td className={`${TD} hidden sm:table-cell ${c.txt}`}>{fmtHoras(r.hh_trabalhada)}</td>
              <td className={`${TD} font-semibold ${intervalToMin(r.extras) > 0 ? 'text-orange-500' : c.sub}`}>{fmtHoras(r.extras)}</td>
              <td className={`${TD} font-semibold ${intervalToMin(r.faltas) > 0 ? 'text-rose-500' : c.sub}`}>{fmtHoras(r.faltas)}</td>
              <td className={TD}><ChevronRight size={14} className={c.sub} /></td>
            </tr>
          ))}</tbody>
        </table>
      </Painel>
      )}
      {sel && <CartaoDiario colab={sel} anoMes={anoMes} onClose={() => setSel(null)} />}
    </div>
  )
}

function CartaoDiario({ colab, anoMes, onClose }: { colab: PontoResumoMes; anoMes: string; onClose: () => void }) {
  const { data = [], isLoading } = usePontoCartao(colab.colaborador_id ?? undefined, anoMes)
  const c = useThemeCls()
  return (
    <Painel>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${c.isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div><p className={`text-sm font-bold ${c.txt}`}>{colab.colaborador_nome}</p><p className={`text-[10px] ${c.sub}`}>Cartão de ponto · {labelMes(anoMes)}</p></div>
        <button onClick={onClose} className={`p-1.5 rounded-lg ${c.isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}><X size={16} className={c.sub} /></button>
      </div>
      {isLoading ? <Loading /> : (
        <table className="w-full">
          <thead><tr className={c.head}>
            <th className={TH}>Dia</th><th className={TH}>E1</th><th className={TH}>S1</th><th className={TH}>E2</th><th className={TH}>S2</th>
            <th className={`${TH} hidden sm:table-cell`}>Normais</th><th className={TH}>Faltas</th><th className={`${TH} hidden md:table-cell`}>Extras</th><th className={TH}></th>
          </tr></thead>
          <tbody>{data.map(d => {
            const ex = intervalToMin(d.ex50) + intervalToMin(d.ex70) + intervalToMin(d.ex100)
            const falta = intervalToMin(d.faltas) > 0
            const dt = new Date(d.data + 'T00:00:00')
            return (
              <tr key={d.data} className={`border-t ${c.row}`}>
                <td className={`${TD} ${c.txt}`}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span className={c.sub}>{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]}</span></td>
                <td className={`${TD} ${c.txt}`}>{fmtHora(d.entrada1)}</td><td className={`${TD} ${c.txt}`}>{fmtHora(d.saida1)}</td>
                <td className={`${TD} ${c.txt}`}>{fmtHora(d.entrada2)}</td><td className={`${TD} ${c.txt}`}>{fmtHora(d.saida2)}</td>
                <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(d.normais)}</td>
                <td className={`${TD} ${falta ? 'text-rose-500 font-semibold' : c.sub}`}>{fmtHoras(d.faltas)}</td>
                <td className={`${TD} hidden md:table-cell ${ex > 0 ? 'text-orange-500 font-semibold' : c.sub}`}>{ex > 0 ? minToHoras(ex) : '—'}</td>
                <td className={TD}>{d.folga ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500">folga</span> : d.compensado ? <span className={`text-[9px] ${c.sub}`}>comp.</span> : null}</td>
              </tr>
            )
          })}</tbody>
        </table>
      )}
    </Painel>
  )
}

// visão diária — registros de UM dia (todos os colaboradores)
function RegistrosDia({ baseId, pessoa, diaData, quickReg }: PontoTabProps) {
  const { data = [], isLoading } = usePontoDia(diaData, baseId || undefined)
  const c = useThemeCls()
  const lista = data
    .filter(r => matchPessoa(r.colaborador?.nome, pessoa) && (
      quickReg === 'aberto' ? intervalToMin(r.faltas) > 0
        : quickReg === 'extras' ? (intervalToMin(r.ex50) + intervalToMin(r.ex70) + intervalToMin(r.ex100)) > 0
          : quickReg === 'ausencias' ? !r.entrada1
            : true
    ))
    .sort((a, b) => (a.colaborador?.nome || '').localeCompare(b.colaborador?.nome || ''))
  if (isLoading) return <Painel><Loading /></Painel>
  if (!lista.length) return <Painel><Vazio msg={`Sem registros em ${new Date(diaData + 'T00:00:00').toLocaleDateString('pt-BR')}.`} /></Painel>
  return (
    <Painel>
      <table className="w-full">
        <thead><tr className={c.head}>
          <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th>
          <th className={TH}>E1</th><th className={TH}>S1</th><th className={TH}>E2</th><th className={TH}>S2</th>
          <th className={`${TH} hidden sm:table-cell`}>Normais</th><th className={TH}>Faltas</th><th className={TH}>Extras</th>
        </tr></thead>
        <tbody>{lista.map((r, i) => {
          const ex = intervalToMin(r.ex50) + intervalToMin(r.ex70) + intervalToMin(r.ex100)
          const falta = intervalToMin(r.faltas) > 0
          return (
            <tr key={i} className={`border-t ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador?.nome ?? '—'}</td>
              <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base?.nome ?? '—'}</td>
              <td className={`${TD} ${c.txt}`}>{fmtHora(r.entrada1)}</td>
              <td className={`${TD} ${c.txt}`}>{fmtHora(r.saida1)}</td>
              <td className={`${TD} ${c.txt}`}>{fmtHora(r.entrada2)}</td>
              <td className={`${TD} ${c.txt}`}>{fmtHora(r.saida2)}</td>
              <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(r.normais)}</td>
              <td className={`${TD} ${falta ? 'text-rose-500 font-semibold' : c.sub}`}>{fmtHoras(r.faltas)}</td>
              <td className={`${TD} ${ex > 0 ? 'text-orange-500 font-semibold' : c.sub}`}>{ex > 0 ? minToHoras(ex) : '—'}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </Painel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) RETIFICAÇÕES — selecionável + enviar p/ aprovação
// ════════════════════════════════════════════════════════════════════════════
export function RetificacoesTab({ anoMes, baseId, pessoa, status, ocultosJustif }: PontoTabProps) {
  const { data = [], isLoading } = usePontoRetificacoes(anoMes)
  const c = useThemeCls()
  const aprovador = useAprovador()
  const enviar = useEnviarItens()
  const { sel, toggle, setAll, clear } = useSelecao()
  const semNoise = data.filter(r => r.motivo && !RUIDO_MIGRACAO.test(r.motivo) && (!baseId || r.colaborador?.base_id === baseId))
  const lista = semNoise.filter(r => !ocultosJustif.has(r.motivo!) && matchPessoa(r.colaborador?.nome, pessoa) && (!status || r.aprov_status === status))
  const idOf = (r: PontoRetificacao) => String(r.nsr)
  const pend = lista.filter(r => r.aprov_status === 'pendente')
  const allSel = pend.length > 0 && pend.every(r => sel.has(idOf(r)))
  const onEnviar = () => enviar.mutate({ keys: lista.filter(r => sel.has(idOf(r))).map(r => ({ tipo: 'retificacao', nsr: r.nsr } as AprovKey)), por: aprovador }, { onSuccess: clear })

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <SelecaoBar n={sel.size} onEnviar={onEnviar} pending={enviar.isPending} />
      <Painel>
        {!lista.length ? <Vazio msg="Nenhuma retificação no filtro." /> : (
          <table className="w-full">
            <thead><tr className={c.head}>
              <ThCheck all={allSel} none={!pend.length} onToggle={() => allSel ? clear() : setAll(pend.map(idOf))} />
              <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Data/Hora</th><th className={TH}>Tipo (motivo)</th><th className={TH}>Status</th>
            </tr></thead>
            <tbody>{lista.map((r, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
                <td className={`${TD} w-px`}>{r.aprov_status === 'pendente' && <input type="checkbox" checked={sel.has(idOf(r))} onChange={() => toggle(idOf(r))} className="accent-violet-500" />}</td>
                <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador?.nome ?? '—'}</td>
                <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.colaborador?.base?.nome ?? '—'}</td>
                <td className={`${TD} ${c.sub}`}>{new Date(r.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={`${TD} ${c.txt}`}>{r.motivo}</td>
                <td className={TD}><Status s={r.aprov_status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) HORAS EXTRAS — selecionável + enviar p/ aprovação
// ════════════════════════════════════════════════════════════════════════════
export function HorasExtrasTab({ anoMes, baseId, pessoa, status }: PontoTabProps) {
  const { data = [], isLoading } = usePontoHorasExtras(anoMes, baseId || undefined)
  const c = useThemeCls()
  const aprovador = useAprovador()
  const enviar = useEnviarItens()
  const { sel, toggle, setAll, clear } = useSelecao()
  const lista = data.filter(r => matchPessoa(r.colaborador_nome, pessoa) && (!status || r.aprov_status === status))
  const total = lista.reduce((s, r) => s + intervalToMin(r.extras_total), 0)
  const idOf = (r: { data: string; secullum_func_id: number }) => `${r.data}|${r.secullum_func_id}`
  const pend = lista.filter(r => r.aprov_status === 'pendente')
  const allSel = pend.length > 0 && pend.every(r => sel.has(idOf(r)))
  const onEnviar = () => enviar.mutate({ keys: lista.filter(r => sel.has(idOf(r))).map(r => ({ tipo: 'hora_extra', data: r.data, secullum_func_id: r.secullum_func_id } as AprovKey)), por: aprovador }, { onSuccess: clear })

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className={`rounded-2xl border px-4 py-2.5 ${c.isLight ? 'bg-orange-50 border-orange-100' : 'bg-orange-500/10 border-orange-500/20'}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Horas extras · {labelMes(anoMes)}</span>
          <p className={`text-lg font-extrabold ${c.txt}`}>{minToHoras(total)} <span className={`text-xs font-normal ${c.sub}`}>· {lista.length} lançamentos</span></p>
        </div>
        <SelecaoBar n={sel.size} onEnviar={onEnviar} pending={enviar.isPending} />
      </div>
      <Painel>
        {!lista.length ? <Vazio msg="Nenhuma hora extra no filtro." /> : (
          <table className="w-full">
            <thead><tr className={c.head}>
              <ThCheck all={allSel} none={!pend.length} onToggle={() => allSel ? clear() : setAll(pend.map(idOf))} />
              <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Data</th><th className={`${TH} hidden sm:table-cell`}>50%</th><th className={`${TH} hidden sm:table-cell`}>100%</th><th className={TH}>Total</th><th className={TH}>Status</th>
            </tr></thead>
            <tbody>{lista.map((r, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
                <td className={`${TD} w-px`}>{r.aprov_status === 'pendente' && <input type="checkbox" checked={sel.has(idOf(r))} onChange={() => toggle(idOf(r))} className="accent-violet-500" />}</td>
                <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome ?? '—'}</td>
                <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
                <td className={`${TD} ${c.sub}`}>{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(r.ex50)}</td>
                <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(r.ex100)}</td>
                <td className={`${TD} font-bold text-orange-500`}>{fmtHoras(r.extras_total)}</td>
                <td className={TD}><Status s={r.aprov_status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) ATESTADOS — selecionável + enviar p/ aprovação
// ════════════════════════════════════════════════════════════════════════════
export function AtestadosTab({ anoMes, baseId, pessoa, status }: PontoTabProps) {
  const { data = [], isLoading } = usePontoAtestados(anoMes)
  const c = useThemeCls()
  const aprovador = useAprovador()
  const enviar = useEnviarItens()
  const { sel, toggle, setAll, clear } = useSelecao()
  const lista = data.filter(a => (!baseId || a.colaborador?.base_id === baseId) && matchPessoa(a.colaborador?.nome, pessoa) && (!status || a.aprov_status === status))
  const pend = lista.filter(a => a.aprov_status === 'pendente')
  const allSel = pend.length > 0 && pend.every(a => sel.has(a.id))
  const onEnviar = () => enviar.mutate({ keys: lista.filter(a => sel.has(a.id)).map(a => ({ tipo: 'atestado', id: a.id } as AprovKey)), por: aprovador }, { onSuccess: clear })

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap"><SelecaoBar n={sel.size} onEnviar={onEnviar} pending={enviar.isPending} /></div>
      <Painel>
        {!lista.length ? <Vazio msg={`Nenhum afastamento no filtro em ${labelMes(anoMes)}.`} /> : (
          <table className="w-full">
            <thead><tr className={c.head}>
              <ThCheck all={allSel} none={!pend.length} onToggle={() => allSel ? clear() : setAll(pend.map(a => a.id))} />
              <th className={TH}>Colaborador</th><th className={TH}>Tipo</th><th className={TH}>Início</th><th className={TH}>Fim</th><th className={TH}>Status</th>
            </tr></thead>
            <tbody>{lista.map(a => (
              <tr key={a.id} className={`border-t ${c.row}`}>
                <td className={`${TD} w-px`}>{a.aprov_status === 'pendente' && <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} className="accent-violet-500" />}</td>
                <td className={`${TD} font-semibold ${c.txt}`}><span className="inline-flex items-center gap-1.5"><FileText size={12} className="text-rose-400" />{a.colaborador?.nome ?? '—'}</span></td>
                <td className={`${TD} ${c.txt}`}>{a.justificativa ?? a.motivo ?? '—'}</td>
                <td className={`${TD} ${c.sub}`}>{new Date(a.inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className={`${TD} ${c.sub}`}>{a.fim ? new Date(a.fim + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                <td className={TD}><Status s={a.aprov_status} /></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}

// ── fila de aprovação ────────────────────────────────────────────────────────
interface FilaItem { tipo: AprovTipo; key: AprovKey; nome: string; baseId: string; baseNome: string; quando: string; desc: string }

// ════════════════════════════════════════════════════════════════════════════
// 5) APROVAÇÃO — itens "em aprovação", agrupados por base + modal c/ filtros
// ════════════════════════════════════════════════════════════════════════════
export function AprovacaoTab({ anoMes }: PontoTabProps) {
  const ret = usePontoRetificacoes(anoMes)
  const he = usePontoHorasExtras(anoMes)
  const at = usePontoAtestados(anoMes)
  const c = useThemeCls()
  const [aberta, setAberta] = useState<string | null>(null)
  const [modal, setModal] = useState<{ base: string; itens: FilaItem[] } | null>(null)

  const itens: FilaItem[] = useMemo(() => {
    const out: FilaItem[] = []
    for (const r of (ret.data ?? [])) if (r.motivo && !RUIDO_MIGRACAO.test(r.motivo) && r.aprov_status === 'em_aprovacao')
      out.push({ tipo: 'retificacao', key: { tipo: 'retificacao', nsr: r.nsr }, nome: r.colaborador?.nome ?? '—', baseId: r.colaborador?.base_id ?? '', baseNome: r.colaborador?.base?.nome ?? '(sem base)', quando: r.data_hora, desc: r.motivo ?? '' })
    for (const r of (he.data ?? [])) if (r.aprov_status === 'em_aprovacao')
      out.push({ tipo: 'hora_extra', key: { tipo: 'hora_extra', data: r.data, secullum_func_id: r.secullum_func_id }, nome: r.colaborador_nome ?? '—', baseId: r.base_id ?? '', baseNome: r.base_nome ?? '(sem base)', quando: r.data, desc: fmtHoras(r.extras_total) })
    for (const a of (at.data ?? [])) if (a.aprov_status === 'em_aprovacao')
      out.push({ tipo: 'atestado', key: { tipo: 'atestado', id: a.id }, nome: a.colaborador?.nome ?? '—', baseId: a.colaborador?.base_id ?? '', baseNome: a.colaborador?.base?.nome ?? '(sem base)', quando: a.inicio, desc: a.justificativa ?? a.motivo ?? '' })
    return out
  }, [ret.data, he.data, at.data])

  const grupos = useMemo(() => {
    const m = new Map<string, FilaItem[]>()
    for (const it of itens) { if (!m.has(it.baseNome)) m.set(it.baseNome, []); m.get(it.baseNome)!.push(it) }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [itens])

  if (ret.isLoading || he.isLoading || at.isLoading) return <Painel><Loading /></Painel>
  if (!itens.length) return <Painel><div className="text-center py-16"><Check className="mx-auto mb-3 text-emerald-500" size={26} /><p className={`text-sm ${c.sub}`}>Nada em aprovação em {labelMes(anoMes)}.</p><p className={`text-xs ${c.sub}`}>Itens enviados nas abas Retificações/Horas Extras/Atestados aparecem aqui.</p></div></Painel>

  const cont = (its: FilaItem[]) => {
    const r = its.filter(i => i.tipo === 'retificacao').length, h = its.filter(i => i.tipo === 'hora_extra').length, a = its.filter(i => i.tipo === 'atestado').length
    return [r && `${r} retif.`, h && `${h} extra`, a && `${a} atest.`].filter(Boolean).join(' · ')
  }

  return (
    <div className="space-y-2">
      <div className={`text-xs ${c.sub}`}><b className={c.txt}>{itens.length}</b> em aprovação em {labelMes(anoMes)}, em {grupos.length} área(s).</div>
      {grupos.map(([base, its]) => {
        const open = aberta === base
        return (
          <Painel key={base}>
            <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${c.row}`} onClick={() => setAberta(open ? null : base)}>
              <ChevronRight size={15} className={`${c.sub} transition-transform ${open ? 'rotate-90' : ''}`} />
              <div className="flex-1 min-w-0"><p className={`text-sm font-bold ${c.txt}`}>{base}</p><p className={`text-[10px] ${c.sub}`}>{its.length} itens · {cont(its)}</p></div>
              <button onClick={e => { e.stopPropagation(); setModal({ base, itens: its }) }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"><Filter size={12} /> Filtrar / aprovar</button>
            </div>
            {open && <ListaFila itens={its.slice(0, 30)} />}
            {open && its.length > 30 && <div className={`px-4 py-2 text-[11px] ${c.sub}`}>+{its.length - 30} itens — use “Filtrar / aprovar”.</div>}
          </Painel>
        )
      })}
      {modal && <FilaModal base={modal.base} itens={modal.itens} onClose={() => setModal(null)} />}
    </div>
  )
}

function ListaFila({ itens }: { itens: FilaItem[] }) {
  const c = useThemeCls()
  return (
    <table className="w-full border-t border-dashed">
      <tbody>{itens.map((it, i) => (
        <tr key={i} className={`border-t ${c.row}`}>
          <td className={`${TD} font-semibold ${c.txt}`}>{it.nome}</td>
          <td className={`${TD} ${tipoCor[it.tipo]} hidden sm:table-cell`}>{tipoLabel[it.tipo]}</td>
          <td className={`${TD} ${c.sub}`}>{new Date(it.quando).toLocaleDateString('pt-BR')}</td>
          <td className={`${TD} ${c.txt}`}>{it.desc}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

function FilaModal({ base, itens, onClose }: { base: string; itens: FilaItem[]; onClose: () => void }) {
  const c = useThemeCls()
  const aprovar = useAprovarItem()
  const aprovador = useAprovador()
  const [de, setDe] = useState(''); const [ate, setAte] = useState(''); const [pessoa, setPessoa] = useState('')
  const pessoas = useMemo(() => [...new Set(itens.map(i => i.nome))].sort(), [itens])
  const filtrados = itens.filter(it => {
    const d = it.quando.slice(0, 10)
    if (de && d < de) return false
    if (ate && d > ate) return false
    if (pessoa && it.nome !== pessoa) return false
    return true
  })
  const act = (key: AprovKey, st: AprovStatus) => aprovar.mutate({ key, status: st, aprovador })
  const aprovarTodos = () => filtrados.forEach(it => aprovar.mutate({ key: it.key, status: 'aprovado', aprovador }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${c.isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${c.isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div><p className={`text-sm font-bold ${c.txt}`}>Aprovação · {base}</p><p className={`text-[10px] ${c.sub}`}>{filtrados.length} de {itens.length} itens</p></div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${c.isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}><X size={16} className={c.sub} /></button>
        </div>
        <div className={`flex items-center gap-2 flex-wrap px-4 py-3 border-b ${c.isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <label className={`text-[10px] ${c.sub}`}>De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className={`px-2 py-1.5 rounded-lg border text-xs ${c.input}`} />
          <label className={`text-[10px] ${c.sub}`}>Até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={`px-2 py-1.5 rounded-lg border text-xs ${c.input}`} />
          <select value={pessoa} onChange={e => setPessoa(e.target.value)} className={`px-2 py-1.5 rounded-lg border text-xs ${c.input}`}>
            <option value="">Todas as pessoas</option>
            {pessoas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex-1" />
          <button disabled={aprovar.isPending || !filtrados.length} onClick={aprovarTodos}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-40"><Check size={12} /> Aprovar filtrados ({filtrados.length})</button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={`${TH} hidden sm:table-cell`}>Tipo</th><th className={TH}>Data</th><th className={TH}>Detalhe</th><th className={TH}></th></tr></thead>
            <tbody>{filtrados.map((it, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
                <td className={`${TD} font-semibold ${c.txt}`}>{it.nome}</td>
                <td className={`${TD} ${tipoCor[it.tipo]} hidden sm:table-cell`}>{tipoLabel[it.tipo]}</td>
                <td className={`${TD} ${c.sub}`}>{new Date(it.quando).toLocaleDateString('pt-BR')}</td>
                <td className={`${TD} ${c.txt}`}>{it.desc}</td>
                <td className={`${TD} w-px`}><div className="flex gap-1.5 justify-end">
                  <button disabled={aprovar.isPending} onClick={() => act(it.key, 'aprovado')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"><Check size={12} /></button>
                  <button disabled={aprovar.isPending} onClick={() => act(it.key, 'reprovado')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25"><X size={12} /></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          {!filtrados.length && <Vazio msg="Nenhum item no filtro." />}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) CONSOLIDAÇÃO — só aprovados
// ════════════════════════════════════════════════════════════════════════════
export function ConsolidacaoTab({ anoMes }: PontoTabProps) {
  const he = usePontoHorasExtras(anoMes)
  const ret = usePontoRetificacoes(anoMes)
  const at = usePontoAtestados(anoMes)
  const c = useThemeCls()
  const heAprov = (he.data ?? []).filter(r => r.aprov_status === 'aprovado')
  const retAprov = (ret.data ?? []).filter(r => r.aprov_status === 'aprovado')
  const atAprov = (at.data ?? []).filter(a => a.aprov_status === 'aprovado')

  const porBase = useMemo(() => {
    const m = new Map<string, { base: string; extras: number; lanc: number }>()
    for (const r of heAprov) {
      const k = r.base_nome ?? '—'
      if (!m.has(k)) m.set(k, { base: k, extras: 0, lanc: 0 })
      const a = m.get(k)!; a.extras += intervalToMin(r.extras_total); a.lanc++
    }
    return [...m.values()].sort((a, b) => b.extras - a.extras)
  }, [he.data])

  if (he.isLoading || ret.isLoading || at.isLoading) return <Painel><Loading /></Painel>
  if (!heAprov.length && !retAprov.length && !atAprov.length)
    return <Painel><div className="text-center py-16"><Lock className="mx-auto mb-3 text-slate-400" size={26} /><p className={`text-sm ${c.sub}`}>Nada aprovado em {labelMes(anoMes)}.</p><p className={`text-xs ${c.sub}`}>A consolidação mostra só o que foi aprovado.</p></div></Painel>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-emerald-500"><Lock size={14} /> Ponto fechado de {labelMes(anoMes)} — só itens aprovados.</div>
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl border p-3 ${c.isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'}`}><p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Horas extras</p><p className={`text-lg font-extrabold ${c.txt}`}>{minToHoras(heAprov.reduce((s, r) => s + intervalToMin(r.extras_total), 0))}</p></div>
        <div className={`rounded-2xl border p-3 ${c.isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'}`}><p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Retificações</p><p className={`text-lg font-extrabold ${c.txt}`}>{retAprov.length}</p></div>
        <div className={`rounded-2xl border p-3 ${c.isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'}`}><p className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Atestados</p><p className={`text-lg font-extrabold ${c.txt}`}>{atAprov.length}</p></div>
      </div>
      {porBase.length > 0 && (
        <Painel>
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Base</th><th className={TH}>Lançamentos</th><th className={TH}>Horas extras aprovadas</th></tr></thead>
            <tbody>{porBase.map((l, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
                <td className={`${TD} font-semibold ${c.txt}`}>{l.base}</td>
                <td className={`${TD} ${c.sub}`}>{l.lanc}</td>
                <td className={`${TD} font-bold text-orange-500`}>{minToHoras(l.extras)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Painel>
      )}
    </div>
  )
}
