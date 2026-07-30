// components/rh/ponto/PontoTabs.tsx — conteúdo das 6 abas do DP > Ponto
import { useMemo, useState } from 'react'
import { Loader2, ChevronRight, ChevronDown, X, FileText, Send, Users, Clock, Timer, UserX, AlarmClock, CalendarX2, CalendarCheck2, MapPinOff, ArrowUpDown, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAuth } from '../../../contexts/AuthContext'
import {
  usePontoResumoMes, usePontoCartao, usePontoRetificacoes, usePontoHorasExtras, useColabAtivosIds,
  usePontoAtestados, useEnviarItens, usePontoDia, usePontoDispositivos,
  type PontoElegiveis,
} from '../../../hooks/usePonto'
import { fmtHoras, fmtHora, intervalToMin, minToHoras, labelMes, batidasForaHorario, pontoEmAberto } from '../../../lib/ponto'
import type { PontoResumoMes, PontoTabProps, PontoDiaLista, AprovStatus, AprovKey, PontoRetificacao, HoraExtraItem } from '../../../types/ponto'
import PontoConsolidacao from './PontoConsolidacao'

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

// ── ordenação por clique no cabeçalho (colaborador · base · dia) ─────────────
type SortDir = 'asc' | 'desc'
type SortCampo = 'nome' | 'base' | 'data'
function useOrdem(inicial: SortCampo = 'data', dirInicial: SortDir = 'desc') {
  const [campo, setCampo] = useState<SortCampo>(inicial)
  const [dir, setDir] = useState<SortDir>(dirInicial)
  // clicar na mesma coluna inverte; trocar de coluna começa em asc (data em desc)
  const clicar = (k: SortCampo) => {
    if (k === campo) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setCampo(k); setDir(k === 'data' ? 'desc' : 'asc') }
  }
  return { campo, dir, clicar }
}
type Ordem = ReturnType<typeof useOrdem>

function ordenar<T>(lista: T[], o: Ordem, get: (r: T) => { nome: string; base: string; data: string }): T[] {
  const m = o.dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    const A = get(a), B = get(b)
    const cmp = o.campo === 'data' ? A.data.localeCompare(B.data)
      : o.campo === 'base' ? A.base.localeCompare(B.base, 'pt-BR')
        : A.nome.localeCompare(B.nome, 'pt-BR')
    return (cmp !== 0 ? cmp : A.nome.localeCompare(B.nome, 'pt-BR')) * m
  })
}

function ThSort({ label, k, o, className = '' }: { label: string; k: SortCampo; o: Ordem; className?: string }) {
  const on = o.campo === k
  return (
    <th className={`${TH} ${className} cursor-pointer select-none`} onClick={() => o.clicar(k)} title={`Ordenar por ${label.toLowerCase()}`}>
      <span className={`inline-flex items-center gap-1 ${on ? 'text-violet-500' : ''}`}>
        {label}
        {on ? <span className="text-[8px] leading-none">{o.dir === 'asc' ? '▲' : '▼'}</span>
            : <ArrowUpDown size={10} className="opacity-30" />}
      </span>
    </th>
  )
}

// ── filtro + resumo compartilhados com a barra de filtros (DPPonto) ──────────
// Ficam aqui para a linha de total no topo e a tabela nunca divergirem.
export function filtrarRetificacoes(data: PontoRetificacao[], f: { baseId: string; pessoa: string; status: string; ocultosJustif: Set<string> }) {
  // o motivo só existe até 29/06 (quando o /FonteDados saiu do sync). Onde ele
  // existe vale o filtro de justificativa + o ruído da migração; onde não existe
  // a linha passa — senão julho em diante sumiria da tela.
  return data.filter(r => (!f.baseId || r.base_id === f.baseId)
    && matchPessoa(r.colaborador_nome, f.pessoa)
    && (!f.status || r.aprov_status === f.status)
    && (!r.motivo || (!RUIDO_MIGRACAO.test(r.motivo) && !f.ocultosJustif.has(r.motivo))))
}
export function resumoRetificacoes(lista: PontoRetificacao[]) {
  if (!lista.length) return 'nenhuma retificação'
  const batidas = lista.reduce((s, r) => s + r.n_ret, 0)
  const diaTodo = lista.filter(r => r.dia_todo).length
  const comAtraso = lista.filter(r => r.atraso_dias != null)
  const atraso = comAtraso.length ? Math.round(comAtraso.reduce((s, r) => s + (r.atraso_dias ?? 0), 0) / comAtraso.length) : null
  return [`${lista.length} dias`, `${batidas} batidas`,
    diaTodo > 0 && `${diaTodo} à mão`,
    atraso != null && `+${atraso}d em média`].filter(Boolean).join(' · ')
}
export function filtrarHorasExtras(data: HoraExtraItem[], f: { pessoa: string; status: string }) {
  return data.filter(r => matchPessoa(r.colaborador_nome, f.pessoa) && (!f.status || r.aprov_status === f.status))
}
export function resumoHorasExtras(lista: HoraExtraItem[]) {
  if (!lista.length) return 'nenhuma hora extra'
  return `${lista.length} lançamentos · ${minToHoras(lista.reduce((s, r) => s + intervalToMin(r.extras_total), 0))}`
}

// Totalizador textual que vive na BARRA DE FILTROS. Componentes próprios (e não
// um cálculo solto no DPPonto) para o hook só montar na aba correspondente —
// caem no mesmo cache do TanStack que a tabela, sem request extra.
function TotalTxt({ children }: { children: React.ReactNode }) {
  const c = useThemeCls()
  return <span className={`ml-auto text-xs font-semibold whitespace-nowrap ${c.sub}`}>{children}</span>
}
export function TotalRetificacoes({ anoMes, baseId, pessoa, status, ocultosJustif }:
  { anoMes: string; baseId: string; pessoa: string; status: string; ocultosJustif: Set<string> }) {
  const { data = [], isLoading } = usePontoRetificacoes(anoMes)
  return <TotalTxt>{isLoading ? '…' : resumoRetificacoes(filtrarRetificacoes(data, { baseId, pessoa, status, ocultosJustif }))}</TotalTxt>
}
export function TotalHorasExtras({ anoMes, baseId, pessoa, status }:
  { anoMes: string; baseId: string; pessoa: string; status: string }) {
  const { data = [], isLoading } = usePontoHorasExtras(anoMes, baseId || undefined)
  return <TotalTxt>{isLoading ? '…' : resumoHorasExtras(filtrarHorasExtras(data, { pessoa, status }))}</TotalTxt>
}

// ════════════════════════════════════════════════════════════════════════════
// 1) REGISTROS PONTO
// ════════════════════════════════════════════════════════════════════════════
export const REG_CHIPS: { k: string; label: string; icon: LucideIcon }[] = [
  { k: 'todos', label: 'Todos', icon: Users },
  { k: 'aberto', label: 'Pontos em aberto', icon: Clock },
  { k: 'fora_horario', label: 'Pontos fora do horário', icon: AlarmClock },
  { k: 'extras', label: 'Horas extras', icon: Timer },
  { k: 'ausencias', label: 'Ausências', icon: UserX },
  { k: 'sem_registro', label: 'Sem registro de ponto', icon: CalendarX2 },
  { k: 'com_registro', label: 'Somente com registro', icon: CalendarCheck2 },
  { k: 'fora_base', label: 'Fora da base (dispositivo ≠ base)', icon: MapPinOff },
]

export function RegistrosPontoTab(props: PontoTabProps) {
  return props.vista === 'dia' ? <RegistrosDia {...props} /> : <RegistrosMes {...props} />
}

// Situação é múltipla escolha. Cada pessoa cai em UMA categoria; nada marcado
// (ou set ainda não carregado) = sem filtro. Cargo de confiança e afastado ficam
// fora de "Ativo" — senão entram todo mês com o mês inteiro de falta.
export const SITUACOES_PONTO = ['Ativo', 'Afastado', 'Cargo de confiança', 'Inativo']

function situacaoDoColab(id: string, eleg: PontoElegiveis): string {
  if (!eleg.ativos.has(id)) return 'Inativo'
  if (eleg.afastados.has(id)) return 'Afastado'
  if (eleg.confianca.has(id)) return 'Cargo de confiança'
  return 'Ativo'
}

function matchSituacao(colaboradorId: string | null | undefined, situacao: PontoTabProps['situacao'], eleg?: PontoElegiveis): boolean {
  if (!eleg || !situacao || situacao.size === 0) return true
  return situacao.has(situacaoDoColab(colaboradorId ?? '', eleg))
}

function RegistrosMes({ anoMes, baseId, pessoa, quickReg, dispositivo, situacao }: PontoTabProps) {
  const { data = [], isLoading } = usePontoResumoMes(anoMes, baseId || undefined)
  const { data: atestados = [] } = usePontoAtestados(anoMes)
  const { data: elegiveis } = useColabAtivosIds()
  const c = useThemeCls()
  const [sel, setSel] = useState<PontoResumoMes | null>(null)
  const afastados = new Set(atestados.map(a => a.colaborador_id).filter(Boolean))
  const lista = data.filter(r => matchPessoa(r.colaborador_nome, pessoa)
    && (!dispositivo || r.dispositivo === dispositivo)
    && matchSituacao(r.colaborador_id, situacao, elegiveis)
    && (
    quickReg === 'aberto' ? r.dias_em_aberto > 0
      : quickReg === 'fora_horario' ? r.dias_fora_horario > 0
        : quickReg === 'extras' ? intervalToMin(r.extras) > 0
          : quickReg === 'ausencias' ? (!!r.colaborador_id && afastados.has(r.colaborador_id))
            : quickReg === 'sem_registro' ? r.dias_batidos === 0
              : quickReg === 'com_registro' ? r.dias_batidos > 0
                : quickReg === 'fora_base' ? !!r.fora_base
                  : true
  ))
  const mHH = lista.reduce((s, r) => s + intervalToMin(r.hh_trabalhada), 0)
  const mExtras = lista.reduce((s, r) => s + intervalToMin(r.extras), 0)
  const mFaltas = lista.reduce((s, r) => s + intervalToMin(r.faltas), 0)

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-4">
      {!lista.length ? <Painel><Vazio msg={`Nenhum registro nesse filtro em ${labelMes(anoMes)}.`} /></Painel> : (
      <Painel>
        <table className="w-full">
          <thead><tr className={c.head}>
            <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th>
            <th className={`${TH} hidden md:table-cell`}>Dispositivo</th><th className={TH}>Dias</th>
            <th className={`${TH} hidden sm:table-cell`}>HH Trab.</th><th className={TH}>Extras</th><th className={TH}>Faltas</th><th className={TH}></th>
          </tr></thead>
          <tbody>
            <tr className={`border-t font-extrabold ${c.isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.06] text-slate-100'}`}>
              <td className={TD}>Total · {lista.length}</td>
              <td className={`${TD} hidden md:table-cell`} />
              <td className={`${TD} hidden md:table-cell`} />
              <td className={TD} />
              <td className={`${TD} hidden sm:table-cell`}>{mHH > 0 ? minToHoras(mHH) : '—'}</td>
              <td className={`${TD} text-orange-500`}>{mExtras > 0 ? minToHoras(mExtras) : '—'}</td>
              <td className={`${TD} text-rose-500`}>{mFaltas > 0 ? minToHoras(mFaltas) : '—'}</td>
              <td className={TD} />
            </tr>
            {/* key composta c/ índice: colaborador pode ter 2+ linhas no resumo (ex.: troca de base no mês) */}
            {lista.map((r, i) => (
            <tr key={`${r.colaborador_id ?? r.colaborador_nome}:${i}`} onClick={() => setSel(r)} className={`border-t cursor-pointer ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt} max-w-[260px]`}><span className="block truncate" title={r.colaborador_nome ?? ''}>{r.colaborador_nome ?? '—'}</span>
                <div className={`text-[10px] flex items-center gap-1.5 flex-wrap ${c.sub}`}>
                  <span>{r.cargo}</span>
                  {r.dias_em_aberto > 0 && <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 font-semibold">{r.dias_em_aberto} em aberto</span>}
                  {r.dias_fora_horario > 0 && <span className="px-1 py-0.5 rounded bg-rose-500/15 text-rose-500 font-semibold">{r.dias_fora_horario} fora horário</span>}
                </div>
              </td>
              {/* dispositivo ≠ base do colaborador → ambos em vermelho */}
              <td className={`${TD} hidden md:table-cell ${r.fora_base ? 'text-rose-500 font-semibold' : c.sub}`}>{r.base_nome ?? '—'}</td>
              <td className={`${TD} hidden md:table-cell ${r.fora_base ? 'text-rose-500 font-semibold' : c.sub}`}>{r.dispositivo ?? '—'}</td>
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
            const fora = batidasForaHorario({ data: d.data, cargo: colab.cargo, entrada1: d.entrada1, saida1: d.saida1, saida2: d.saida2 })
            const hc = (bad: boolean) => bad ? 'text-rose-500 font-bold' : c.txt
            return (
              <tr key={d.data} className={`border-t ${c.row}`}>
                <td className={`${TD} ${c.txt}`}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span className={c.sub}>{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]}</span></td>
                <td className={`${TD} ${hc(fora.entrada1)}`}>{fmtHora(d.entrada1)}</td><td className={`${TD} ${hc(fora.saida1)}`}>{fmtHora(d.saida1)}</td>
                <td className={`${TD} ${c.txt}`}>{fmtHora(d.entrada2)}</td><td className={`${TD} ${hc(fora.saida2)}`}>{fmtHora(d.saida2)}</td>
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
function RegistrosDia({ baseId, pessoa, diaData, quickReg, dispositivo, situacao }: PontoTabProps) {
  const { data = [], isLoading } = usePontoDia(diaData, baseId || undefined)
  const { data: dispositivos = [] } = usePontoDispositivos()
  const { data: elegiveis } = useColabAtivosIds()
  const c = useThemeCls()
  const horaCls = (fora: boolean) => fora ? 'text-rose-500 font-bold' : c.txt
  // resolve o Ponto Virtual do dia: primeiro equip id não-vazio das batidas → cadastro linkdisp
  const dispById = new Map(dispositivos.map(d => [d.secullum_equip_id, d]))
  const dispDoDia = (r: PontoDiaLista) => {
    const eq = [r.equip_e1, r.equip_s1, r.equip_e2, r.equip_s2].find(v => v && v !== '0')
    return eq ? dispById.get(Number(eq)) ?? null : null
  }
  const rows = data
    .filter(r => matchPessoa(r.colaborador?.nome, pessoa) && matchSituacao(r.colaborador_id, situacao, elegiveis))
    .map(r => {
      const disp = dispDoDia(r)
      // compara com a base de CADASTRO do colaborador (a base do dia é derivada do próprio dispositivo)
      const foraBase = !!(disp?.base_id && r.colaborador?.base_id && disp.base_id !== r.colaborador.base_id)
      return { r, disp, foraBase, fora: batidasForaHorario({ data: r.data, cargo: r.cargo, entrada1: r.entrada1, saida1: r.saida1, saida2: r.saida2 }) }
    })
    .filter(({ disp }) => !dispositivo || disp?.descricao === dispositivo)
    .filter(({ r, fora, foraBase }) => (
      quickReg === 'aberto' ? pontoEmAberto(r)
        : quickReg === 'fora_horario' ? fora.algum
          : quickReg === 'extras' ? (intervalToMin(r.ex50) + intervalToMin(r.ex70) + intervalToMin(r.ex100)) > 0
            : quickReg === 'ausencias' ? !r.entrada1
              : quickReg === 'sem_registro' ? (!r.entrada1 && !r.saida1 && !r.entrada2 && !r.saida2)
                : quickReg === 'com_registro' ? (!!r.entrada1 || !!r.saida1 || !!r.entrada2 || !!r.saida2)
                  : quickReg === 'fora_base' ? foraBase
                    : true
    ))
    .sort((a, b) => (a.r.colaborador?.nome || '').localeCompare(b.r.colaborador?.nome || ''))
  const tNormais = rows.reduce((s, { r }) => s + intervalToMin(r.normais), 0)
  const tFaltas = rows.reduce((s, { r }) => s + intervalToMin(r.faltas), 0)
  const tExtras = rows.reduce((s, { r }) => s + intervalToMin(r.ex50) + intervalToMin(r.ex70) + intervalToMin(r.ex100), 0)
  if (isLoading) return <Painel><Loading /></Painel>
  if (!rows.length) return <Painel><Vazio msg={`Sem registros em ${new Date(diaData + 'T00:00:00').toLocaleDateString('pt-BR')}.`} /></Painel>
  return (
    <Painel>
      <table className="w-full">
        <thead><tr className={c.head}>
          <th className={TH}>Colaborador</th><th className={`${TH} hidden md:table-cell`}>Base</th>
          <th className={`${TH} hidden md:table-cell`}>Dispositivo</th>
          <th className={TH}>E1</th><th className={TH}>S1</th><th className={TH}>E2</th><th className={TH}>S2</th>
          <th className={`${TH} hidden sm:table-cell`}>Normais</th><th className={TH}>Faltas</th><th className={TH}>Extras</th>
        </tr></thead>
        <tbody>
          <tr className={`border-t font-extrabold ${c.isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.06] text-slate-100'}`}>
            <td className={TD}>Total · {rows.length}</td>
            <td className={`${TD} hidden md:table-cell`} />
            <td className={`${TD} hidden md:table-cell`} />
            <td className={TD} /><td className={TD} /><td className={TD} /><td className={TD} />
            <td className={`${TD} hidden sm:table-cell`}>{tNormais > 0 ? minToHoras(tNormais) : '—'}</td>
            <td className={`${TD} text-rose-500`}>{tFaltas > 0 ? minToHoras(tFaltas) : '—'}</td>
            <td className={`${TD} text-orange-500`}>{tExtras > 0 ? minToHoras(tExtras) : '—'}</td>
          </tr>
          {rows.map(({ r, fora, disp, foraBase }, i) => {
          const ex = intervalToMin(r.ex50) + intervalToMin(r.ex70) + intervalToMin(r.ex100)
          const falta = intervalToMin(r.faltas) > 0
          const aberto = pontoEmAberto(r)
          return (
            <tr key={i} className={`border-t ${c.row}`}>
              <td className={`${TD} font-semibold ${c.txt}`}>{r.colaborador?.nome ?? '—'}{aberto && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 font-semibold uppercase">em aberto</span>}</td>
              {/* Base = cadastro do colaborador; dispositivo divergente → ambos em vermelho */}
              <td className={`${TD} hidden md:table-cell ${foraBase ? 'text-rose-500 font-semibold' : c.sub}`}>{r.colaborador?.base?.nome ?? r.base?.nome ?? '—'}</td>
              <td className={`${TD} hidden md:table-cell ${foraBase ? 'text-rose-500 font-semibold' : c.sub}`}>{disp?.descricao ?? '—'}</td>
              <td className={`${TD} ${horaCls(fora.entrada1)}`}>{fmtHora(r.entrada1)}</td>
              <td className={`${TD} ${horaCls(fora.saida1)}`}>{fmtHora(r.saida1)}</td>
              <td className={`${TD} ${c.txt}`}>{fmtHora(r.entrada2)}</td>
              <td className={`${TD} ${horaCls(fora.saida2)}`}>{fmtHora(r.saida2)}</td>
              <td className={`${TD} hidden sm:table-cell ${c.sub}`}>{fmtHoras(r.normais)}</td>
              <td className={`${TD} ${falta ? 'text-rose-500 font-semibold' : c.sub}`}>{fmtHoras(r.faltas)}</td>
              <td className={`${TD} ${ex > 0 ? 'text-orange-500 font-semibold' : c.sub}`}>{ex > 0 ? minToHoras(ex) : '—'}</td>
            </tr>
          )
        })}</tbody>
      </table>
      <div className={`px-3 py-2 text-[10px] border-t ${c.isLight ? 'border-slate-100 text-slate-400' : 'border-white/[0.05] text-slate-500'}`}>
        <span className="text-rose-500 font-semibold">Vermelho</span> = batida fora da jornada (entrada 7h · saída 17h seg–qui / 16h sex · tolerância ±10 min · exceto motoristas).
      </div>
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
  const o = useOrdem('data', 'desc')
  const lista = ordenar(filtrarRetificacoes(data, { baseId, pessoa, status, ocultosJustif }), o,
    r => ({ nome: r.colaborador_nome ?? '', base: r.base_nome ?? '', data: r.data }))
  const idOf = (r: PontoRetificacao) => `${r.data}|${r.secullum_func_id}`
  const pend = lista.filter(r => r.aprov_status === 'pendente')
  const allSel = pend.length > 0 && pend.every(r => sel.has(idOf(r)))
  const onEnviar = () => enviar.mutate({ keys: lista.filter(r => sel.has(idOf(r))).map(r => ({ tipo: 'retificacao', data: r.data, secullum_func_id: r.secullum_func_id } as AprovKey)), por: aprovador }, { onSuccess: clear })

  // batida lançada à mão fica em âmbar; as demais seguem o cinza do cartão
  const Cel = ({ h, ret, mob }: { h: string | null; ret: boolean; mob?: boolean }) => (
    <td className={`${TD} ${mob ? 'hidden sm:table-cell' : ''} ${ret ? 'text-amber-500 font-bold' : c.sub}`}>{fmtHora(h)}</td>
  )

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <SelecaoBar n={sel.size} onEnviar={onEnviar} pending={enviar.isPending} />
      <Painel>
        {!lista.length ? <Vazio msg="Nenhuma retificação no filtro." /> : (<>
          <table className="w-full">
            <thead><tr className={c.head}>
              <ThCheck all={allSel} none={!pend.length} onToggle={() => allSel ? clear() : setAll(pend.map(idOf))} />
              <ThSort label="Colaborador" k="nome" o={o} /><ThSort label="Base" k="base" o={o} className="hidden md:table-cell" /><ThSort label="Dia" k="data" o={o} />
              <th className={TH}>E1</th><th className={TH}>S1</th><th className={`${TH} hidden sm:table-cell`}>E2</th><th className={TH}>S2</th>
              <th className={`${TH} hidden md:table-cell`}>Lançada em</th><th className={TH}>Status</th>
            </tr></thead>
            <tbody>{lista.map(r => {
              const dt = new Date(r.data + 'T00:00:00')
              return (
                <tr key={idOf(r)} className={`border-t ${c.row}`}>
                  <td className={`${TD} w-px`}>{r.aprov_status === 'pendente' && <input type="checkbox" checked={sel.has(idOf(r))} onChange={() => toggle(idOf(r))} className="accent-violet-500" />}</td>
                  <td className={`${TD} font-semibold ${c.txt} max-w-[240px]`}>
                    <span className="block truncate" title={r.colaborador_nome ?? ''}>{r.colaborador_nome ?? '—'}</span>
                    <div className={`text-[10px] flex items-center gap-1.5 flex-wrap ${c.sub}`}>
                      <span>{r.cargo}</span>
                      {r.dia_todo && <span className="px-1 py-0.5 rounded bg-rose-500/15 text-rose-500 font-semibold">jornada à mão</span>}
                      {r.motivo && <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 font-semibold">{r.motivo}</span>}
                    </div>
                  </td>
                  <td className={`${TD} hidden md:table-cell ${c.sub}`}>{r.base_nome ?? '—'}</td>
                  <td className={`${TD} ${c.txt}`}>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span className={c.sub}>{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()]}</span></td>
                  <Cel h={r.entrada1} ret={r.ret_e1} /><Cel h={r.saida1} ret={r.ret_s1} />
                  <Cel h={r.entrada2} ret={r.ret_e2} mob /><Cel h={r.saida2} ret={r.ret_s2} />
                  <td className={`${TD} hidden md:table-cell ${c.sub}`}>
                    {r.incluido_em ? new Date(r.incluido_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                    {r.atraso_dias != null && r.atraso_dias > 0 && <span className={`ml-1 ${r.atraso_dias > 7 ? 'text-rose-500 font-semibold' : ''}`}>+{r.atraso_dias}d</span>}
                  </td>
                  <td className={TD}><Status s={r.aprov_status} /></td>
                </tr>
              )
            })}</tbody>
          </table>
          <div className={`px-3 py-2 text-[10px] border-t ${c.isLight ? 'border-slate-100 text-slate-400' : 'border-white/[0.05] text-slate-500'}`}>
            <span className="text-amber-500 font-semibold">Âmbar</span> = batida lançada à mão no Secullum (Origem 2, sem NSR de relógio). As demais vieram do relógio ou do intervalo pré-assinalado.
            {' '}<span className="text-rose-500 font-semibold">Jornada à mão</span> = 3+ batidas do dia lançadas manualmente.
          </div>
        </>)}
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
  const o = useOrdem('data', 'desc')
  const lista = ordenar(filtrarHorasExtras(data, { pessoa, status }), o,
    r => ({ nome: r.colaborador_nome ?? '', base: r.base_nome ?? '', data: r.data }))
  const idOf = (r: { data: string; secullum_func_id: number }) => `${r.data}|${r.secullum_func_id}`
  const pend = lista.filter(r => r.aprov_status === 'pendente')
  const allSel = pend.length > 0 && pend.every(r => sel.has(idOf(r)))
  const onEnviar = () => enviar.mutate({ keys: lista.filter(r => sel.has(idOf(r))).map(r => ({ tipo: 'hora_extra', data: r.data, secullum_func_id: r.secullum_func_id } as AprovKey)), por: aprovador }, { onSuccess: clear })

  if (isLoading) return <Painel><Loading /></Painel>
  return (
    <div className="space-y-3">
      <SelecaoBar n={sel.size} onEnviar={onEnviar} pending={enviar.isPending} />
      <Painel>
        {!lista.length ? <Vazio msg="Nenhuma hora extra no filtro." /> : (
          <table className="w-full">
            <thead><tr className={c.head}>
              <ThCheck all={allSel} none={!pend.length} onToggle={() => allSel ? clear() : setAll(pend.map(idOf))} />
              <ThSort label="Colaborador" k="nome" o={o} /><ThSort label="Base" k="base" o={o} className="hidden md:table-cell" /><ThSort label="Data" k="data" o={o} /><th className={`${TH} hidden sm:table-cell`}>50%</th><th className={`${TH} hidden sm:table-cell`}>100%</th><th className={TH}>Total</th><th className={TH}>Status</th>
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

// ════════════════════════════════════════════════════════════════════════════
// 5) APROVAÇÃO — itens "em aprovação", agrupados por base + modal c/ filtros
// ════════════════════════════════════════════════════════════════════════════
export function AprovacaoTab({ anoMes }: PontoTabProps) {
  const c = useThemeCls()
  // Sem etapa de aprovacao por ora: a retificacao ja chega aprovada do Secullum,
  // entao tudo que vem de la segue direto para a Consolidacao. A fila fica aqui
  // desativada — nada mais do comportamento antigo foi alterado.
  return (
    <Painel>
      <div className="text-center py-16 px-6">
        <ShieldCheck className="mx-auto mb-3 text-violet-500" size={26} />
        <p className={`text-sm font-semibold ${c.txt}`}>Aprovações serão implementadas via TEG+ em breve.</p>
        <p className={`text-xs mt-1.5 max-w-md mx-auto ${c.sub}`}>
          Por enquanto a retificação já chega aprovada do Secullum, então tudo que vem de lá
          segue direto para a Consolidação — sem etapa de aprovação aqui.
        </p>
        <p className={`text-[11px] mt-3 ${c.sub}`}>Competência: {labelMes(anoMes)}</p>
      </div>
    </Painel>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 6) CONSOLIDAÇÃO — por pessoa (espelho) e por mês (pacote p/ CEMIG)
// ════════════════════════════════════════════════════════════════════════════
export function ConsolidacaoTab({ anoMes, bases }: PontoTabProps) {
  return <PontoConsolidacao anoMes={anoMes} bases={bases} />
}
