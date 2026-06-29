// components/rh/ponto/PontoTabs.tsx — conteúdo das 6 abas do DP > Ponto
import { useMemo, useState } from 'react'
import { Clock, Loader2, ChevronRight, Send, Check, X, MapPin, FileText, AlertTriangle, Lock } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAuth } from '../../../contexts/AuthContext'
import {
  usePontoResumoMes, usePontoCartao, usePontoAfastamentos, usePontoPendencias,
  usePontoAprovacoes, useEnviarAprovacao, useDecidirAprovacao,
} from '../../../hooks/usePonto'
import { fmtHoras, fmtHora, intervalToMin, minToHoras, labelMes } from '../../../lib/ponto'
import type { PontoResumoMes, PontoTabProps } from '../../../types/ponto'

// ── helpers visuais ────────────────────────────────────────────────────────
function Painel({ children }: { children: React.ReactNode }) {
  const { isLightSidebar: isLight } = useTheme()
  return <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.08]'}`}>{children}</div>
}
function Loading() {
  return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-500" size={26} /></div>
}
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

// ════════════════════════════════════════════════════════════════════════════
// 1) REGISTROS PONTO — resumo por colaborador + cartão diário expansível
// ════════════════════════════════════════════════════════════════════════════
export function RegistrosPontoTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const c = useThemeCls()
  const [sel, setSel] = useState<PontoResumoMes | null>(null)

  if (isLoading) return <Painel><Loading /></Painel>
  if (!data.length) return <Painel><Vazio msg={`Sem registros de ponto em ${labelMes(anoMes)}${baseId ? ' nesta base' : ''}.`} /></Painel>

  return (
    <div className="space-y-4">
      <Painel>
        <table className="w-full">
          <thead><tr className={c.head}>
            <th className={TH}>Colaborador</th>
            <th className={`${TH} hidden md:table-cell`}>Base</th>
            <th className={TH}>Dias</th>
            <th className={`${TH} hidden sm:table-cell`}>HH Trab.</th>
            <th className={TH}>Extras</th>
            <th className={TH}>Faltas</th>
            <th className={`${TH} hidden lg:table-cell`}>Atrasos</th>
            <th className={TH}></th>
          </tr></thead>
          <tbody>
            {data.map(r => (
              <tr key={r.colaborador_id ?? r.colaborador_nome} onClick={() => setSel(r)}
                className={`border-t cursor-pointer ${c.row}`}>
                <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome ?? '—'}<div className={`text-[10px] ${c.sub}`}>{r.cargo}</div></td>
                <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
                <td className={`${TD} ${c.txt}`}>{r.dias_batidos}/{r.dias}</td>
                <td className={`${TD} hidden sm:table-cell ${c.txt}`}>{fmtHoras(r.hh_trabalhada)}</td>
                <td className={`${TD} font-semibold ${intervalToMin(r.extras) > 0 ? 'text-orange-500' : c.sub}`}>{fmtHoras(r.extras)}</td>
                <td className={`${TD} font-semibold ${intervalToMin(r.faltas) > 0 ? 'text-rose-500' : c.sub}`}>{fmtHoras(r.faltas)}</td>
                <td className={`${TD} hidden lg:table-cell ${c.sub}`}>{fmtHoras(r.atrasos)}</td>
                <td className={TD}><ChevronRight size={14} className={c.sub} /></td>
              </tr>
            ))}
          </tbody>
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
          <tbody>
            {data.map(d => {
              const ex = intervalToMin(d.ex50) + intervalToMin(d.ex70) + intervalToMin(d.ex100)
              const falta = intervalToMin(d.faltas) > 0
              const dt = new Date(d.data + 'T00:00:00')
              return (
                <tr key={d.data} className={`border-t ${c.row}`}>
                  <td className={`${TD} ${c.txt}`}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}<span className={`ml-1 ${c.sub}`}>{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]}</span></td>
                  <td className={`${TD} ${c.txt}`}>{fmtHora(d.entrada1)}</td>
                  <td className={`${TD} ${c.txt}`}>{fmtHora(d.saida1)}</td>
                  <td className={`${TD} ${c.txt}`}>{fmtHora(d.entrada2)}</td>
                  <td className={`${TD} ${c.txt}`}>{fmtHora(d.saida2)}</td>
                  <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(d.normais)}</td>
                  <td className={`${TD} ${falta ? 'text-rose-500 font-semibold' : c.sub}`}>{fmtHoras(d.faltas)}</td>
                  <td className={`${TD} hidden md:table-cell ${ex > 0 ? 'text-orange-500 font-semibold' : c.sub}`}>{ex > 0 ? minToHoras(ex) : '—'}</td>
                  <td className={TD}>{d.folga ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-500">folga</span> : d.compensado ? <span className={`text-[9px] ${c.sub}`}>comp.</span> : d.ajuste ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">ajuste</span> : null}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Painel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2) RETIFICAÇÕES — dias com ajuste/falta (correção é feita no Secullum)
// ════════════════════════════════════════════════════════════════════════════
export function RetificacoesTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const c = useThemeCls()
  const comPendencia = data.filter(r => intervalToMin(r.faltas) > 0 || intervalToMin(r.atrasos) > 0)
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-amber-500"><AlertTriangle size={14} /> Correções de marcação são feitas no Secullum; aqui ficam os pontos que precisam de atenção no mês.</div>
      <Painel>
        {!comPendencia.length ? <Vazio msg="Nenhum colaborador com faltas/atrasos no mês." /> : (
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={TH}>Faltas</th><th className={TH}>Atrasos</th></tr></thead>
            <tbody>{comPendencia.map(r => (
              <tr key={r.colaborador_id} className={`border-t ${c.row}`}>
                <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome}</td>
                <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
                <td className={`${TD} font-semibold text-rose-500`}>{fmtHoras(r.faltas)}</td>
                <td className={`${TD} ${c.sub}`}>{fmtHoras(r.atrasos)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3) HORAS EXTRAS
// ════════════════════════════════════════════════════════════════════════════
export function HorasExtrasTab({ anoMes, baseId }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const c = useThemeCls()
  const comExtra = data.filter(r => intervalToMin(r.extras) > 0).sort((a, b) => intervalToMin(b.extras) - intervalToMin(a.extras))
  const total = comExtra.reduce((s, r) => s + intervalToMin(r.extras), 0)
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border px-4 py-3 ${c.isLight ? 'bg-orange-50 border-orange-100' : 'bg-orange-500/10 border-orange-500/20'}`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Total de horas extras · {labelMes(anoMes)}</span>
        <p className={`text-xl font-extrabold ${c.txt}`}>{minToHoras(total)} <span className={`text-xs font-normal ${c.sub}`}>· {comExtra.length} colaboradores</span></p>
      </div>
      <Painel>
        {!comExtra.length ? <Vazio msg="Nenhuma hora extra no mês." /> : (
          <table className="w-full">
            <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th><th className={`${TH} hidden lg:table-cell`}>Centro de Custo</th><th className={TH}>Extras</th></tr></thead>
            <tbody>{comExtra.map(r => (
              <tr key={r.colaborador_id} className={`border-t ${c.row}`}>
                <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador_nome}</td>
                <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
                <td className={`${TD} hidden lg:table-cell ${c.sub}`}>{r.cc_nome ?? '—'}</td>
                <td className={`${TD} font-bold text-orange-500`}>{fmtHoras(r.extras)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Painel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 4) ATESTADOS / AFASTAMENTOS
// ════════════════════════════════════════════════════════════════════════════
export function AtestadosTab({ anoMes }: PontoTabProps) {
  const { data = [], isLoading } = usePontoAfastamentos(anoMes)
  const c = useThemeCls()
  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <Painel>
      {!data.length ? <Vazio msg={`Nenhum afastamento vigente em ${labelMes(anoMes)}.`} /> : (
        <table className="w-full">
          <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={TH}>Justificativa</th><th className={TH}>Início</th><th className={TH}>Fim</th><th className={`${TH} hidden md:table-cell`}>Motivo</th></tr></thead>
          <tbody>{data.map(a => (
            <tr key={a.id} className={`border-t ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt}`}><span className="inline-flex items-center gap-1.5"><FileText size={12} className="text-rose-400" />{a.colaborador?.nome ?? '—'}</span></td>
              <td className={`${TD} ${c.txt}`}>{a.justificativa ?? '—'}</td>
              <td className={`${TD} ${c.sub}`}>{new Date(a.inicio + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td className={`${TD} ${c.sub}`}>{a.fim ? new Date(a.fim + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td className={`${TD} hidden md:table-cell ${c.sub}`}>{a.motivo ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Painel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 5) APROVAÇÃO — por área (base), colapsável, cada gestor aprova
// ════════════════════════════════════════════════════════════════════════════
export function AprovacaoTab({ anoMes }: PontoTabProps) {
  const { data: resumo = [], isLoading } = usePontoResumoMes(anoMes)
  const { data: aprovacoes = [] } = usePontoAprovacoes(anoMes)
  const enviar = useEnviarAprovacao()
  const decidir = useDecidirAprovacao()
  const { user } = useAuth()
  const c = useThemeCls()
  const [aberta, setAberta] = useState<string | null>(null)

  const areas = useMemo(() => {
    const map = new Map<string, { base_id: string; base_nome: string; pessoas: number; extras: number; faltas: number; rows: PontoResumoMes[] }>()
    for (const r of resumo) {
      const k = r.base_id ?? 'sembase'
      if (!map.has(k)) map.set(k, { base_id: r.base_id ?? '', base_nome: r.base_nome ?? '(sem base)', pessoas: 0, extras: 0, faltas: 0, rows: [] })
      const a = map.get(k)!; a.pessoas++; a.extras += intervalToMin(r.extras); a.faltas += intervalToMin(r.faltas); a.rows.push(r)
    }
    return [...map.values()].sort((a, b) => b.pessoas - a.pessoas)
  }, [resumo])

  const apMap = new Map(aprovacoes.map(a => [a.base_id ?? '', a]))
  const nome = (user as { nome?: string; email?: string } | null)?.nome || (user as { email?: string } | null)?.email || 'RH'

  if (isLoading) return <Painel><Loading /></Painel>
  if (!areas.length) return <Painel><Vazio msg={`Sem ponto para aprovar em ${labelMes(anoMes)}.`} /></Painel>

  const badge = (st?: string) => {
    const m: Record<string, string> = { enviado: 'bg-amber-500/15 text-amber-500', aprovado: 'bg-emerald-500/15 text-emerald-500', reprovado: 'bg-rose-500/15 text-rose-500', pendente: 'bg-slate-400/15 text-slate-400' }
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m[st || 'pendente']}`}>{st || 'pendente'}</span>
  }

  return (
    <div className="space-y-2">
      {areas.map(a => {
        const ap = apMap.get(a.base_id)
        const st = ap?.status || 'pendente'
        const open = aberta === a.base_id
        return (
          <Painel key={a.base_id || 'sembase'}>
            <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${c.row}`} onClick={() => setAberta(open ? null : a.base_id)}>
              <ChevronRight size={15} className={`${c.sub} transition-transform ${open ? 'rotate-90' : ''}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${c.txt}`}>{a.base_nome}</p>
                <p className={`text-[10px] ${c.sub}`}>{a.pessoas} pessoas · extras {minToHoras(a.extras)} · faltas {minToHoras(a.faltas)}</p>
              </div>
              {badge(st)}
              <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                {st === 'pendente' && a.base_id && (
                  <button onClick={() => enviar.mutate({ anoMes, baseId: a.base_id })} disabled={enviar.isPending}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"><Send size={12} /> Enviar</button>
                )}
                {st === 'enviado' && (
                  <>
                    <button onClick={() => decidir.mutate({ anoMes, baseId: a.base_id, aprovar: true, aprovador: nome })} disabled={decidir.isPending}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"><Check size={12} /> Aprovar</button>
                    <button onClick={() => decidir.mutate({ anoMes, baseId: a.base_id, aprovar: false, aprovador: nome })} disabled={decidir.isPending}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25"><X size={12} /> Reprovar</button>
                  </>
                )}
              </div>
            </div>
            {open && (
              <table className="w-full border-t border-dashed">
                <thead><tr className={c.head}><th className={TH}>Colaborador</th><th className={TH}>HH Trab.</th><th className={TH}>Extras</th><th className={TH}>Faltas</th></tr></thead>
                <tbody>{a.rows.map(r => (
                  <tr key={r.colaborador_id} className={`border-t ${c.row}`}>
                    <td className={`${TD} ${c.txt}`}>{r.colaborador_nome}</td>
                    <td className={`${TD} ${c.sub}`}>{fmtHoras(r.hh_trabalhada)}</td>
                    <td className={`${TD} ${intervalToMin(r.extras) > 0 ? 'text-orange-500' : c.sub}`}>{fmtHoras(r.extras)}</td>
                    <td className={`${TD} ${intervalToMin(r.faltas) > 0 ? 'text-rose-500' : c.sub}`}>{fmtHoras(r.faltas)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Painel>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) CONSOLIDAÇÃO — só meses/áreas APROVADOS (ponto fechado)
// ════════════════════════════════════════════════════════════════════════════
export function ConsolidacaoTab({ anoMes }: PontoTabProps) {
  const { data: resumo = [], isLoading } = usePontoResumoMes(anoMes)
  const { data: aprovacoes = [] } = usePontoAprovacoes(anoMes)
  const c = useThemeCls()
  const aprovadas = new Set(aprovacoes.filter(a => a.status === 'aprovado').map(a => a.base_id ?? ''))

  const linhas = useMemo(() => {
    const map = new Map<string, { base_nome: string; cc: string; pessoas: number; hh: number; extras: number; faltas: number }>()
    for (const r of resumo) {
      if (!aprovadas.has(r.base_id ?? '')) continue
      const k = (r.base_id ?? '') + (r.cc_codigo ?? '')
      if (!map.has(k)) map.set(k, { base_nome: r.base_nome ?? '—', cc: r.cc_nome ?? '—', pessoas: 0, hh: 0, extras: 0, faltas: 0 })
      const a = map.get(k)!; a.pessoas++; a.hh += intervalToMin(r.hh_trabalhada); a.extras += intervalToMin(r.extras); a.faltas += intervalToMin(r.faltas)
    }
    return [...map.values()]
  }, [resumo, aprovacoes])

  if (isLoading) return <Painel><Loading /></Painel>
  if (!aprovadas.size) return <Painel><div className="text-center py-16"><Lock className="mx-auto mb-3 text-slate-400" size={26} /><p className={`text-sm ${c.sub}`}>Aguardando aprovação do ponto de {labelMes(anoMes)}.</p><p className={`text-xs ${c.sub}`}>A consolidação aparece quando ao menos uma área é aprovada.</p></div></Painel>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-emerald-500"><Lock size={14} /> Ponto fechado de {labelMes(anoMes)} — {aprovadas.size} área(s) aprovada(s).</div>
      <Painel>
        <table className="w-full">
          <thead><tr className={c.head}><th className={TH}>Base</th><th className={TH}>Centro de Custo</th><th className={TH}>Pessoas</th><th className={TH}>HH Trab.</th><th className={TH}>Extras</th><th className={TH}>Faltas</th></tr></thead>
          <tbody>{linhas.map((l, i) => (
            <tr key={i} className={`border-t ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt}`}>{l.base_nome}</td>
              <td className={`${TD} ${c.sub}`}>{l.cc}</td>
              <td className={`${TD} ${c.txt}`}>{l.pessoas}</td>
              <td className={`${TD} ${c.txt}`}>{minToHoras(l.hh)}</td>
              <td className={`${TD} text-orange-500`}>{minToHoras(l.extras)}</td>
              <td className={`${TD} text-rose-500`}>{minToHoras(l.faltas)}</td>
            </tr>
          ))}</tbody>
        </table>
      </Painel>
    </div>
  )
}
