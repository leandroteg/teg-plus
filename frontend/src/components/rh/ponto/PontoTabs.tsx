// components/rh/ponto/PontoTabs.tsx — conteúdo das 6 abas do DP > Ponto
import { useMemo, useState } from 'react'
import { Loader2, ChevronRight, Check, X, AlertTriangle, FileText, Lock } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAuth } from '../../../contexts/AuthContext'
import {
  usePontoResumoMes, usePontoCartao, usePontoRetificacoes, usePontoHorasExtras,
  usePontoAtestados, useAprovarItem,
} from '../../../hooks/usePonto'
import { fmtHoras, fmtHora, intervalToMin, minToHoras, labelMes } from '../../../lib/ponto'
import type { PontoResumoMes, PontoTabProps, AprovStatus, AprovKey } from '../../../types/ponto'

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
  }
}
function Status({ s }: { s: AprovStatus }) {
  const m: Record<AprovStatus, string> = {
    pendente: 'bg-amber-500/15 text-amber-500', aprovado: 'bg-emerald-500/15 text-emerald-500', reprovado: 'bg-rose-500/15 text-rose-500',
  }
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${m[s] || m.pendente}`}>{s}</span>
}
function useAprovador() {
  const { user } = useAuth()
  return (user as { nome?: string; email?: string } | null)?.nome || (user as { email?: string } | null)?.email || 'RH'
}

const RUIDO_MIGRACAO = /aplicativo|sistema|teste/i

// ════════════════════════════════════════════════════════════════════════════
// 1) REGISTROS PONTO — resumo por colaborador + cartão diário
// ════════════════════════════════════════════════════════════════════════════
export function RegistrosPontoTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const c = useThemeCls()
  const [sel, setSel] = useState<PontoResumoMes | null>(null)
  if (isLoading) return <Painel><Loading /></Painel>
  if (!data.length) return <Painel><Vazio msg={`Sem registros de ponto em ${labelMes(anoMes)}.`} /></Painel>
  return (
    <div className="space-y-4">
      <Painel>
        <table className="w-full">
          <thead><tr className={c.head}>
            <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Dias</th>
            <th className={`${TH} hidden sm:table-cell`}>HH Trab.</th><th className={TH}>Extras</th><th className={TH}>Faltas</th><th className={TH}></th>
          </tr></thead>
          <tbody>{data.map(r => (
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

// ════════════════════════════════════════════════════════════════════════════
// 2) RETIFICAÇÕES — lista de marcações com motivo + status
// ════════════════════════════════════════════════════════════════════════════
export function RetificacoesTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoRetificacoes(anoMes)
  const c = useThemeCls()
  const lista = data.filter(r => r.motivo && !RUIDO_MIGRACAO.test(r.motivo) && (!baseId || r.colaborador?.base_id === baseId))
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-amber-500"><AlertTriangle size={14} /> Inclusões/correções de marcação com justificativa. Itens pendentes vão para a aba Aprovação.</div>
      <Painel>
        {!lista.length ? <Vazio msg="Nenhuma retificação no mês." /> : (
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Data/Hora</th><th className={TH}>Tipo (motivo)</th><th className={TH}>Status</th></tr></thead>
            <tbody>{lista.map((r, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
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
// 3) HORAS EXTRAS — lista de dias com extra + status
// ════════════════════════════════════════════════════════════════════════════
export function HorasExtrasTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoHorasExtras(anoMes, baseId || undefined)
  const c = useThemeCls()
  const total = data.reduce((s, r) => s + intervalToMin(r.extras_total), 0)
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border px-4 py-3 ${c.isLight ? 'bg-orange-50 border-orange-100' : 'bg-orange-500/10 border-orange-500/20'}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Horas extras · {labelMes(anoMes)}</span>
        <p className={`text-xl font-extrabold ${c.txt}`}>{minToHoras(total)} <span className={`text-xs font-normal ${c.sub}`}>· {data.length} lançamentos</span></p>
      </div>
      <Painel>
        {!data.length ? <Vazio msg="Nenhuma hora extra no mês." /> : (
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Data</th><th className={`${TH} hidden sm:table-cell`}>50%</th><th className={`${TH} hidden sm:table-cell`}>100%</th><th className={TH}>Total</th><th className={TH}>Status</th></tr></thead>
            <tbody>{data.map((r, i) => (
              <tr key={i} className={`border-t ${c.row}`}>
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
// 4) ATESTADOS / AFASTAMENTOS — lista + status
// ════════════════════════════════════════════════════════════════════════════
export function AtestadosTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoAtestados(anoMes)
  const c = useThemeCls()
  const lista = data.filter(a => !baseId || a.colaborador?.base_id === baseId)
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <Painel>
      {!lista.length ? <Vazio msg={`Nenhum afastamento vigente em ${labelMes(anoMes)}.`} /> : (
        <table className="w-full">
          <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={TH}>Tipo</th><th className={TH}>Início</th><th className={TH}>Fim</th><th className={TH}>Status</th></tr></thead>
          <tbody>{lista.map(a => (
            <tr key={a.id} className={`border-t ${c.row}`}>
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
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) APROVAÇÃO — fila de pendentes (retificações + horas extras + atestados)
// ════════════════════════════════════════════════════════════════════════════
export function AprovacaoTab({ anoMes }: PontoTabProps) {
  const ret = usePontoRetificacoes(anoMes)
  const he = usePontoHorasExtras(anoMes)
  const at = usePontoAtestados(anoMes)
  const aprovar = useAprovarItem()
  const aprovador = useAprovador()
  const c = useThemeCls()

  const pendRet = (ret.data ?? []).filter(r => r.motivo && !RUIDO_MIGRACAO.test(r.motivo) && r.aprov_status === 'pendente')
  const pendHE = (he.data ?? []).filter(r => r.aprov_status === 'pendente')
  const pendAt = (at.data ?? []).filter(a => a.aprov_status === 'pendente')
  const totalPend = pendRet.length + pendHE.length + pendAt.length
  const loading = ret.isLoading || he.isLoading || at.isLoading

  const act = (key: AprovKey, status: AprovStatus) => aprovar.mutate({ key, status, aprovador })

  if (loading) return <Painel><Loading /></Painel>
  if (!totalPend) return <Painel><div className="text-center py-16"><Check className="mx-auto mb-3 text-emerald-500" size={26} /><p className={`text-sm ${c.sub}`}>Nada pendente em {labelMes(anoMes)}. Tudo aprovado. 🎉</p></div></Painel>

  const Botoes = ({ k }: { k: AprovKey }) => (
    <div className="flex gap-1.5 justify-end">
      <button disabled={aprovar.isPending} onClick={() => act(k, 'aprovado')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"><Check size={12} /> Aprovar</button>
      <button disabled={aprovar.isPending} onClick={() => act(k, 'reprovado')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25"><X size={12} /></button>
    </div>
  )
  const Secao = ({ titulo, cor, children, n }: { titulo: string; cor: string; n: number; children: React.ReactNode }) => (
    <Painel>
      <div className={`px-4 py-2.5 border-b text-xs font-bold flex items-center gap-2 ${c.isLight ? 'border-slate-200' : 'border-white/10'} ${cor}`}>{titulo} <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">{n}</span></div>
      {children}
    </Painel>
  )

  return (
    <div className="space-y-3">
      <div className={`text-xs ${c.sub}`}><b className={c.txt}>{totalPend}</b> item(s) pendente(s) de aprovação em {labelMes(anoMes)}.</div>

      {pendRet.length > 0 && <Secao titulo="Retificações" cor="text-amber-500" n={pendRet.length}>
        <table className="w-full"><tbody>{pendRet.map((r, i) => (
          <tr key={i} className={`border-t ${c.row}`}>
            <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador?.nome ?? '—'}</td>
            <td className={`${TD} ${c.sub} hidden md:table-cell`}>{new Date(r.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
            <td className={`${TD} ${c.txt}`}>{r.motivo}</td>
            <td className={`${TD} w-px`}><Botoes k={{ tipo: 'retificacao', nsr: r.nsr }} /></td>
          </tr>
        ))}</tbody></table>
      </Secao>}

      {pendHE.length > 0 && <Secao titulo="Horas Extras" cor="text-orange-500" n={pendHE.length}>
        <table className="w-full"><tbody>{pendHE.map((r, i) => (
          <tr key={i} className={`border-t ${c.row}`}>
            <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome ?? '—'}</td>
            <td className={`${TD} ${c.sub} hidden md:table-cell`}>{new Date(r.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
            <td className={`${TD} font-bold text-orange-500`}>{fmtHoras(r.extras_total)}</td>
            <td className={`${TD} w-px`}><Botoes k={{ tipo: 'hora_extra', data: r.data, secullum_func_id: r.secullum_func_id }} /></td>
          </tr>
        ))}</tbody></table>
      </Secao>}

      {pendAt.length > 0 && <Secao titulo="Atestados" cor="text-rose-500" n={pendAt.length}>
        <table className="w-full"><tbody>{pendAt.map(a => (
          <tr key={a.id} className={`border-t ${c.row}`}>
            <td className={`${TD} font-semibold ${c.txt}`}>{a.colaborador?.nome ?? '—'}</td>
            <td className={`${TD} ${c.txt}`}>{a.justificativa ?? a.motivo ?? '—'}</td>
            <td className={`${TD} ${c.sub} hidden md:table-cell`}>{new Date(a.inicio + 'T00:00:00').toLocaleDateString('pt-BR')}{a.fim ? ' a ' + new Date(a.fim + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</td>
            <td className={`${TD} w-px`}><Botoes k={{ tipo: 'atestado', id: a.id }} /></td>
          </tr>
        ))}</tbody></table>
      </Secao>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) CONSOLIDAÇÃO — só itens APROVADOS (ponto fechado)
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
  const nada = !heAprov.length && !retAprov.length && !atAprov.length
  if (nada) return <Painel><div className="text-center py-16"><Lock className="mx-auto mb-3 text-slate-400" size={26} /><p className={`text-sm ${c.sub}`}>Nada aprovado em {labelMes(anoMes)}.</p><p className={`text-xs ${c.sub}`}>A consolidação mostra só o que foi aprovado.</p></div></Painel>

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
