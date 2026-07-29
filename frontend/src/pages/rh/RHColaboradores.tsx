// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHColaboradores.tsx — Gestão de Colaboradores (ficha completa + filtros top tier)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Users, Search, SlidersHorizontal, X, Phone, Mail, Briefcase,
  ChevronRight, ChevronDown, Calendar, MapPin, Building2, HardHat, BadgeCheck,
  Filter, Download, UserCircle, DollarSign, Clock, Heart,
  LayoutList, LayoutGrid, GraduationCap, Gavel, AlertTriangle, Hourglass, PauseCircle, Loader2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useRHColaboradores, useSituacaoColaborador } from '../../hooks/useRH'
import { useBases } from '../../hooks/useEstoque'
import type { RHColaborador, FiltrosColaboradores } from '../../types/rh'
import { TIPOS_CONTRATO, UFS, ESTADOS_CIVIS, GENEROS } from '../../types/rh'
import RHColaboradorDetalhe from './RHColaboradorDetalhe'

type Situacao = 'ativo' | 'afastado' | 'inativo'

// Afastado é ativo=true COM a marca de afastamento: continua empregado, no
// headcount e nos benefícios — só não está trabalhando.
const situacaoDe = (c: RHColaborador): Situacao =>
  !c.ativo ? 'inativo' : c.afastado ? 'afastado' : 'ativo'

const SITUACAO_LABEL: Record<Situacao, string> = { ativo: 'Ativo', afastado: 'Afastado', inativo: 'Inativo' }
const SITUACAO_DOT: Record<Situacao, string> = { ativo: 'bg-emerald-500', afastado: 'bg-amber-500', inativo: 'bg-slate-400' }
const SITUACAO_TXT: Record<Situacao, (l: boolean) => string> = {
  ativo:    l => (l ? 'text-emerald-600' : 'text-emerald-400'),
  afastado: l => (l ? 'text-amber-600' : 'text-amber-400'),
  inativo:  l => (l ? 'text-slate-400' : 'text-slate-500'),
}
const MOTIVOS = [
  { v: 'licenca_medica', l: 'Licença médica' },
  { v: 'suspensao',      l: 'Suspensão' },
  { v: 'maternidade',    l: 'Maternidade' },
] as const
const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(MOTIVOS.map(m => [m.v, m.l]))

function AfastamentoModal({ colab, isLight, onClose }: {
  colab: RHColaborador; isLight: boolean; onClose: () => void
}) {
  const salvar = useSituacaoColaborador()
  const [afastado, setAfastado] = useState(!!colab.afastado)
  const [motivo, setMotivo] = useState<string>(colab.afastamento_motivo ?? '')
  const [inicio, setInicio] = useState(colab.afastamento_inicio ?? '')
  const [retorno, setRetorno] = useState(colab.afastamento_previsao_retorno ?? '')
  const [obs, setObs] = useState(colab.afastamento_observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const input = isLight
    ? 'bg-white border-slate-200 text-slate-800'
    : 'bg-white/[0.05] border-white/10 text-white'

  const confirmar = async () => {
    if (afastado && !motivo) { setErro('Escolha o motivo do afastamento.'); return }
    setErro(null)
    try {
      await salvar.mutateAsync({
        id: colab.id, afastado,
        motivo: (motivo || null) as 'licenca_medica' | 'suspensao' | 'maternidade' | null,
        inicio: inicio || null, previsaoRetorno: retorno || null, observacao: obs.trim() || null,
      })
      onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0d1420] border-white/10'}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.08]'}`}>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Situação do colaborador</h3>
            <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{colab.nome}</p>
          </div>
          <button onClick={onClose} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[{ v: false, l: 'Ativo', c: 'emerald' }, { v: true, l: 'Afastado', c: 'amber' }].map(o => {
              const on = afastado === o.v
              return (
                <button key={o.l} onClick={() => setAfastado(o.v)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition-colors ${on
                    ? o.c === 'emerald'
                      ? (isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300')
                      : (isLight ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/20 border-amber-500/40 text-amber-300')
                    : isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                  {o.l}
                </button>
              )
            })}
          </div>

          {afastado && (
            <>
              <div>
                <label className={`block text-[11px] font-semibold mb-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>MOTIVO</label>
                <div className="grid grid-cols-3 gap-2">
                  {MOTIVOS.map(m => (
                    <button key={m.v} onClick={() => setMotivo(m.v)}
                      className={`py-2 rounded-lg border text-[11px] font-semibold transition-colors ${motivo === m.v
                        ? isLight ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>INÍCIO</label>
                  <input type="date" value={inicio} onChange={e => setInicio(e.target.value)}
                    className={`w-full text-sm rounded-lg px-2.5 py-2 border outline-none ${input}`} />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>PREVISÃO DE RETORNO</label>
                  <input type="date" value={retorno} onChange={e => setRetorno(e.target.value)}
                    className={`w-full text-sm rounded-lg px-2.5 py-2 border outline-none ${input}`} />
                </div>
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>OBSERVAÇÃO</label>
                <input value={obs} onChange={e => setObs(e.target.value)} placeholder="opcional"
                  className={`w-full text-sm rounded-lg px-2.5 py-2 border outline-none ${input}`} />
              </div>
            </>
          )}

          <p className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Afastar não desliga: o colaborador continua no headcount e nos benefícios.
            Para desligar, use Desligamento.
          </p>
          {erro && <p className="text-xs text-rose-500">{erro}</p>}
        </div>

        <div className={`flex justify-end gap-2 px-5 py-4 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.08]'}`}>
          <button onClick={onClose} className={`text-xs font-semibold px-3 py-2 rounded-lg ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Cancelar</button>
          <button onClick={confirmar} disabled={salvar.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50">
            {salvar.isPending ? <><Loader2 size={13} className="animate-spin" /> Salvando…</> : <><PauseCircle size={13} /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function calcTempoEmpresa(dataAdmissao: string | undefined) {
  if (!dataAdmissao) return null
  const adm = new Date(dataAdmissao)
  const hoje = new Date()
  const anos = Math.floor((hoje.getTime() - adm.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  const meses = Math.floor(((hoje.getTime() - adm.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12)
  return anos > 0 ? `${anos}a ${meses}m` : `${meses}m`
}

function getInitials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// Contrato de experiência vencendo: admissão há 35–45 dias (1ª renovação, 45d)
// ou há 80–90 dias (efetivação, 90d).
function janelaExperiencia(dataAdmissao?: string | null): { label: string; title: string } | null {
  if (!dataAdmissao) return null
  const dias = Math.floor((Date.now() - new Date(dataAdmissao + 'T00:00:00').getTime()) / 86_400_000)
  if (dias >= 35 && dias <= 45) return { label: 'exp 45d', title: `Experiência vencendo — ${dias}º dia (renovação dos 45 dias)` }
  if (dias >= 80 && dias <= 90) return { label: 'exp 90d', title: `Experiência vencendo — ${dias}º dia (efetivação dos 90 dias)` }
  return null
}
const experienciaVencendo = (dataAdmissao?: string | null) => janelaExperiencia(dataAdmissao) !== null

// Campo multi-seleção (popover que abre ao clicar) com "Selecionar todos"
function MultiSelectField({ options, selected, onChange, isLight, placeholder = 'Todos' }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; isLight: boolean; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const allSel = selected.length === options.length && options.length > 0
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  const resumo = selected.length === 0 ? placeholder : allSel ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionados`
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-700 bg-slate-800 text-white'}`}>
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : ''}`}>{resumo}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border shadow-lg p-1 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
          <label className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-xs font-bold border-b ${isLight ? 'hover:bg-slate-50 text-slate-700 border-slate-100' : 'hover:bg-white/5 text-slate-200 border-slate-700'}`}>
            <input type="checkbox" className="accent-violet-500" checked={allSel}
              onChange={e => onChange(e.target.checked ? [...options] : [])} />
            Selecionar todos
          </label>
          {options.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Sem opções</p>}
          {options.map(o => (
            <label key={o} className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-xs ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-slate-200'}`}>
              <input type="checkbox" className="accent-violet-500" checked={selected.includes(o)} onChange={() => toggle(o)} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RHColaboradores() {
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosColaboradores>({})
  // Situação do colaborador: Ativo / Afastado / Inativo. "Afastado" é ativo=true
  // com a marca de afastamento — não some do headcount nem dos benefícios.
  const [situacao, setSituacao] = useState<Situacao>('ativo')
  const [afastando, setAfastando] = useState<RHColaborador | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [comProcesso, setComProcesso] = useState(false)
  const [semDados, setSemDados] = useState(false)
  const [expVencendo, setExpVencendo] = useState(false)

  const { data: todos = [], isLoading } = useRHColaboradores()
  const { data: bases = [] } = useBases()

  // Extrair departamentos e setores únicos
  const departamentos = useMemo(() => [...new Set(todos.map(c => c.departamento).filter(Boolean))] as string[], [todos])
  const setores = useMemo(() => [...new Set(todos.map(c => c.setor).filter(Boolean))] as string[], [todos])

  // Filtragem local completa
  const filtered = useMemo(() => {
    return todos.filter(c => {
      // Situação: ativo / afastado / inativo
      if (situacaoDe(c) !== situacao) return false
      // Processo trabalhista
      if (comProcesso && !c.tem_processo_trabalhista) return false
      // Sem CPF ou Data de Nascimento
      if (semDados && c.cpf && c.data_nascimento) return false
      // Contrato de experiência vencendo (35–45 ou 80–90 dias de admissão)
      if (expVencendo && !experienciaVencendo(c.data_admissao)) return false
      // Tipo contrato
      if (filtros.tipo_contrato && (c.tipo_contrato || 'CLT') !== filtros.tipo_contrato) return false
      // Departamento (multi)
      if (filtros.departamento?.length && !filtros.departamento.includes(c.departamento || '')) return false
      // Setor
      if (filtros.setor && c.setor !== filtros.setor) return false
      // Base
      if (filtros.base_id && c.base_id !== filtros.base_id) return false
      // Idade
      if (c.data_nascimento && (filtros.idade_min || filtros.idade_max)) {
        const hoje = new Date()
        const nasc = new Date(c.data_nascimento)
        const idade = Math.floor((hoje.getTime() - nasc.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (filtros.idade_min && idade < filtros.idade_min) return false
        if (filtros.idade_max && idade > filtros.idade_max) return false
      }
      // Tempo de empresa (em meses)
      if (c.data_admissao && (filtros.tempo_empresa_min || filtros.tempo_empresa_max)) {
        const hoje = new Date()
        const adm = new Date(c.data_admissao)
        const meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth())
        if (filtros.tempo_empresa_min && meses < filtros.tempo_empresa_min) return false
        if (filtros.tempo_empresa_max && meses > filtros.tempo_empresa_max) return false
      }
      // Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase()
        return (
          c.nome.toLowerCase().includes(q) ||
          c.cpf?.includes(q) ||
          c.matricula?.toLowerCase().includes(q) ||
          c.cargo?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [todos, filtros, busca, comProcesso, semDados, expVencendo])

  // KPI calculations
  const kpis = useMemo(() => {
    const ativos = filtered.filter(c => c.ativo)
    const clt = ativos.filter(c => (c.tipo_contrato || 'CLT').toUpperCase() === 'CLT').length
    const pj = ativos.filter(c => (c.tipo_contrato || '').toUpperCase() === 'PJ').length
    const aprendiz = ativos.filter(c => (c.tipo_contrato || '').toUpperCase() === 'APRENDIZ').length
    const hoje = new Date()
    const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    const admissoes30d = ativos.filter(c => c.data_admissao && new Date(c.data_admissao) >= trintaDiasAtras).length
    return { ativos: ativos.length, clt, pj, aprendiz, admissoes30d }
  }, [filtered])

  const activeFilterCount = [
    filtros.tipo_contrato, filtros.departamento?.length, filtros.setor,
    filtros.base_id, filtros.idade_min, filtros.idade_max,
    filtros.tempo_empresa_min, filtros.tempo_empresa_max,
  ].filter(Boolean).length

  function clearFiltros() {
    setFiltros({ ativo: true })
  }

  function exportCSV() {
    const headers = ['Nome', 'CPF', 'Matrícula', 'Cargo', 'Departamento', 'Setor', 'Tipo Contrato', 'Admissão', 'Email', 'Telefone', 'Ativo']
    const rows = filtered.map(c => [
      c.nome, c.cpf || '', c.matricula || '', c.cargo || '', c.departamento || '',
      c.setor || '', c.tipo_contrato || 'CLT', c.data_admissao || '', c.email || '', c.telefone || '',
      c.ativo ? 'Sim' : 'Não',
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colaboradores_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Se está vendo detalhe de um colaborador
  if (selectedId) {
    return <RHColaboradorDetalhe id={selectedId} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Ativos', value: kpis.ativos, icon: Users, color: 'teal' },
          { label: 'CLT', value: kpis.clt, icon: BadgeCheck, color: 'emerald' },
          { label: 'PJ', value: kpis.pj, icon: Briefcase, color: 'amber' },
          { label: 'Aprendiz', value: kpis.aprendiz, icon: GraduationCap, color: 'sky' },
          { label: 'Admissões 30d', value: kpis.admissoes30d, icon: Calendar, color: 'indigo' },
        ].map(kpi => {
          const colorMap: Record<string, { light: string; dark: string; iconLight: string; iconDark: string }> = {
            teal:    { light: 'bg-teal-50 border-teal-100',    dark: 'bg-teal-500/10 border-teal-500/20',    iconLight: 'text-teal-500',    iconDark: 'text-teal-400' },
            emerald: { light: 'bg-emerald-50 border-emerald-100', dark: 'bg-emerald-500/10 border-emerald-500/20', iconLight: 'text-emerald-500', iconDark: 'text-emerald-400' },
            amber:   { light: 'bg-amber-50 border-amber-100',   dark: 'bg-amber-500/10 border-amber-500/20',   iconLight: 'text-amber-500',   iconDark: 'text-amber-400' },
            sky:     { light: 'bg-sky-50 border-sky-100',       dark: 'bg-sky-500/10 border-sky-500/20',       iconLight: 'text-sky-500',     iconDark: 'text-sky-400' },
            indigo:  { light: 'bg-indigo-50 border-indigo-100', dark: 'bg-indigo-500/10 border-indigo-500/20', iconLight: 'text-indigo-500', iconDark: 'text-indigo-400' },
          }
          const c = colorMap[kpi.color]
          return (
            <div key={kpi.label}
              className={`rounded-2xl border p-3 ${isLight ? c.light : c.dark}`}>
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon size={13} className={isLight ? c.iconLight : c.iconDark} />
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</span>
              </div>
              <p className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{kpi.value}</p>
            </div>
          )
        })}
      </div>

      {/* Busca + status + filtros + exportar + view (tudo em 1 linha) */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Situação: Ativos / Afastados / Inativos */}
        {(['ativo', 'afastado', 'inativo'] as Situacao[]).map(v => {
          const on = situacao === v
          const count = todos.filter(c => situacaoDe(c) === v).length
          return (
            <button key={v} onClick={() => setSituacao(v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                on
                  ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-white/10'
              }`}>
              {SITUACAO_LABEL[v]}s
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                on
                  ? isLight ? 'bg-violet-200 text-violet-700' : 'bg-violet-500/30 text-violet-200'
                  : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
              }`}>{count}</span>
            </button>
          )
        })}

        {/* Processo trabalhista */}
        <button onClick={() => setComProcesso(v => !v)}
          title="Filtrar colaboradores com processo trabalhista"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            comProcesso
              ? isLight ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-white/10'
          }`}>
          <Gavel size={13} /> Processo
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            comProcesso
              ? isLight ? 'bg-amber-200 text-amber-700' : 'bg-amber-500/30 text-amber-200'
              : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
          }`}>{todos.filter(c => c.tem_processo_trabalhista).length}</span>
        </button>

        {/* Sem CPF / Data de Nascimento */}
        <button onClick={() => setSemDados(v => !v)}
          title="Filtrar colaboradores sem CPF ou sem data de nascimento"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            semDados
              ? isLight ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-white/10'
          }`}>
          <AlertTriangle size={13} /> Sem CPF/Nasc.
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            semDados
              ? isLight ? 'bg-rose-200 text-rose-700' : 'bg-rose-500/30 text-rose-200'
              : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
          }`}>{todos.filter(c => situacaoDe(c) === situacao && (!c.cpf || !c.data_nascimento)).length}</span>
        </button>

        {/* Experiência vencendo (35–45 ou 80–90 dias de admissão) */}
        <button onClick={() => setExpVencendo(v => !v)}
          title="Contrato de experiência vencendo: admissão há 35–45 dias (renovação dos 45d) ou 80–90 dias (efetivação dos 90d)"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            expVencendo
              ? isLight ? 'bg-sky-100 text-sky-700 border border-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] border border-white/10'
          }`}>
          <Hourglass size={13} /> Experiência vencendo
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            expVencendo
              ? isLight ? 'bg-sky-200 text-sky-700' : 'bg-sky-500/30 text-sky-200'
              : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-500'
          }`}>{todos.filter(c => situacaoDe(c) === situacao && experienciaVencendo(c.data_admissao)).length}</span>
        </button>

        {/* Busca (encolhe pra caber) */}
        <div className="relative flex-1 min-w-[150px]">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, cargo..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
              isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'
            }`} />
        </div>

        {/* Filtros */}
        <button onClick={() => setShowFiltros(!showFiltros)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors relative shrink-0 ${
            showFiltros || activeFilterCount > 0
              ? isLight ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : isLight ? 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06] border border-white/10'
          }`}>
          <SlidersHorizontal size={13} /> Filtros
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Exportar CSV */}
        <button onClick={exportCSV}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors shrink-0 ${
            isLight ? 'text-slate-500 hover:bg-slate-100 border border-slate-200' : 'text-slate-400 hover:bg-white/10 border border-white/10'
          }`}>
          <Download size={13} /> Exportar CSV
        </button>

        {/* View mode toggle */}
        <div className={`flex rounded-xl border overflow-hidden shrink-0 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <button onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold transition-colors ${
              viewMode === 'table'
                ? isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/20 text-violet-300'
                : isLight ? 'bg-white text-slate-400 hover:bg-slate-50' : 'bg-transparent text-slate-500 hover:bg-white/[0.04]'
            }`}>
            <LayoutList size={13} />
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold transition-colors ${
              viewMode === 'cards'
                ? isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/20 text-violet-300'
                : isLight ? 'bg-white text-slate-400 hover:bg-slate-50' : 'bg-transparent text-slate-500 hover:bg-white/[0.04]'
            }`}>
            <LayoutGrid size={13} />
          </button>
        </div>
      </div>

      {/* Filtros expandidos */}
      {showFiltros && (
        <div className={`rounded-2xl border p-4 space-y-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Filtros Avançados</p>
            <button onClick={clearFiltros} className={`text-[10px] font-semibold ${isLight ? 'text-violet-600' : 'text-violet-400'}`}>Limpar tudo</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tipo Contrato</label>
              <select value={filtros.tipo_contrato || ''} onChange={e => setFiltros(f => ({ ...f, tipo_contrato: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todos</option>
                {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Departamento</label>
              <MultiSelectField options={departamentos} selected={filtros.departamento ?? []} isLight={isLight}
                onChange={v => setFiltros(f => ({ ...f, departamento: v.length ? v : undefined }))} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Setor</label>
              <select value={filtros.setor || ''} onChange={e => setFiltros(f => ({ ...f, setor: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todos</option>
                {setores.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Base</label>
              <select value={filtros.base_id || ''} onChange={e => setFiltros(f => ({ ...f, base_id: e.target.value || undefined }))}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`}>
                <option value="">Todas</option>
                {bases.map(b => <option key={b.id} value={b.id}>{b.codigo} — {b.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Idade mín.</label>
              <input type="number" min={16} max={99} value={filtros.idade_min || ''} onChange={e => setFiltros(f => ({ ...f, idade_min: Number(e.target.value) || undefined }))}
                placeholder="16" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Idade máx.</label>
              <input type="number" min={16} max={99} value={filtros.idade_max || ''} onChange={e => setFiltros(f => ({ ...f, idade_max: Number(e.target.value) || undefined }))}
                placeholder="99" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tempo empresa mín. (meses)</label>
              <input type="number" min={0} value={filtros.tempo_empresa_min || ''} onChange={e => setFiltros(f => ({ ...f, tempo_empresa_min: Number(e.target.value) || undefined }))}
                placeholder="0" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
            <div>
              <label className={`block text-[10px] font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tempo empresa máx. (meses)</label>
              <input type="number" min={0} value={filtros.tempo_empresa_max || ''} onChange={e => setFiltros(f => ({ ...f, tempo_empresa_max: Number(e.target.value) || undefined }))}
                placeholder="∞" className={`w-full px-2 py-1.5 rounded-lg border text-xs ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-800 text-white'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <Users size={40} className={isLight ? 'text-slate-200 mx-auto mb-3' : 'text-slate-600 mx-auto mb-3'} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <>
          {/* Table view */}
          {viewMode === 'table' && (
            <div className={`rounded-2xl overflow-hidden border shadow-sm ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
              <table className="w-full">
                <thead>
                  <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Colaborador</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden sm:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Matrícula</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden md:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Cargo</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden lg:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Base</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden sm:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tipo</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden lg:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Admissão</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 hidden xl:table-cell ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tempo</th>
                    <th className={`text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const tempoEmpresa = calcTempoEmpresa(c.data_admissao)
                    const tipo = (c.tipo_contrato || 'CLT').toUpperCase()
                    return (
                      <tr key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`cursor-pointer transition-colors border-t ${
                          isLight ? 'border-slate-100 hover:bg-slate-50/80' : 'border-white/[0.04] hover:bg-white/[0.03]'
                        } ${!c.ativo ? 'opacity-60' : ''}`}>
                        {/* Avatar + Nome + Matrícula */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                              isLight ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                            }`}>
                              {c.foto_url ? (
                                <img src={c.foto_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : getInitials(c.nome)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{c.nome}</p>
                                {c.tem_processo_trabalhista && (
                                  <span title={c.processo_trabalhista_info || 'Processo trabalhista'} className="shrink-0">
                                    <Gavel size={12} className={isLight ? 'text-amber-500' : 'text-amber-400'} />
                                  </span>
                                )}
                                {!c.cpf && (
                                  <span title="Sem CPF cadastrado" className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-300'}`}>sem CPF</span>
                                )}
                                {!c.data_nascimento && (
                                  <span title="Sem data de nascimento" className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-300'}`}>sem nasc</span>
                                )}
                                {(() => { const j = janelaExperiencia(c.data_admissao); return j && (
                                  <span title={j.title} className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-300'}`}>{j.label}</span>
                                ) })()}
                              </div>
                              {c.matricula && (
                                <p className={`text-[10px] font-mono sm:hidden ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{c.matricula}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Matrícula */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {c.matricula ? (
                            <span className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{c.matricula}</span>
                          ) : (
                            <span className={`text-xs ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>—</span>
                          )}
                        </td>
                        {/* Cargo + Departamento */}
                        <td className={`px-4 py-3 hidden md:table-cell`}>
                          <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{c.cargo || '—'}</p>
                          {c.departamento && (
                            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{c.departamento}</p>
                          )}
                        </td>
                        {/* Base */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {c.base?.nome ? (
                            <span className={`text-[10px] px-2 py-1 rounded-xl font-semibold ${
                              isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'
                            }`}>{c.base.nome}</span>
                          ) : (
                            <span className={`text-xs ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>—</span>
                          )}
                        </td>
                        {/* Tipo */}
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`text-[10px] px-2 py-1 rounded-xl font-bold ${
                            tipo === 'PJ'
                              ? isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-400'
                              : tipo === 'APRENDIZ'
                                ? isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-400'
                                : isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400'
                          }`}>{tipo === 'APRENDIZ' ? 'Aprendiz' : (c.tipo_contrato || 'CLT')}</span>
                        </td>
                        {/* Admissão */}
                        <td className={`px-4 py-3 hidden lg:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {c.data_admissao ? new Date(c.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        {/* Tempo */}
                        <td className={`px-4 py-3 hidden xl:table-cell text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {tempoEmpresa || '—'}
                        </td>
                        {/* Situação — clicar abre a edição de afastamento */}
                        <td className="px-4 py-3">
                          <button type="button"
                            onClick={e => { e.stopPropagation(); setAfastando(c) }}
                            title="Alterar situação (afastamento)"
                            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                            <div className={`w-2 h-2 rounded-full ${SITUACAO_DOT[situacaoDe(c)]}`} />
                            <span className={`text-xs font-semibold ${SITUACAO_TXT[situacaoDe(c)](isLight)}`}>
                              {SITUACAO_LABEL[situacaoDe(c)]}
                            </span>
                            {c.afastado && c.afastamento_motivo && (
                              <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                · {MOTIVO_LABEL[c.afastamento_motivo]}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards view */}
          {viewMode === 'cards' && (
            <div className="space-y-2">
              {filtered.map(c => {
                const tempoEmpresa = calcTempoEmpresa(c.data_admissao)

                return (
                  <div key={c.id} onClick={() => setSelectedId(c.id)}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all group ${
                      isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                    } ${!c.ativo ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                        isLight ? 'bg-violet-50 text-violet-600 border border-violet-100' : 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                      }`}>
                        {c.foto_url ? (
                          <img src={c.foto_url} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : getInitials(c.nome)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{c.nome}</p>
                          {c.tem_processo_trabalhista && (
                            <span title={c.processo_trabalhista_info || 'Processo trabalhista'} className="shrink-0">
                              <Gavel size={12} className={isLight ? 'text-amber-500' : 'text-amber-400'} />
                            </span>
                          )}
                          {!c.cpf && (
                            <span title="Sem CPF cadastrado" className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-300'}`}>sem CPF</span>
                          )}
                          {!c.data_nascimento && (
                            <span title="Sem data de nascimento" className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-300'}`}>sem nasc</span>
                          )}
                          {(() => { const j = janelaExperiencia(c.data_admissao); return j && (
                            <span title={j.title} className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-300'}`}>{j.label}</span>
                          ) })()}
                          {c.matricula && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-500'}`}>
                              {c.matricula}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {c.cargo && (
                            <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Briefcase size={9} />{c.cargo}
                            </span>
                          )}
                          {c.departamento && (
                            <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Building2 size={9} />{c.departamento}
                            </span>
                          )}
                          {c.base?.nome && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-400'
                            }`}>{c.base.nome}</span>
                          )}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            (c.tipo_contrato || 'CLT').toUpperCase() === 'PJ'
                              ? isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/15 text-orange-400'
                              : (c.tipo_contrato || '').toUpperCase() === 'APRENDIZ'
                                ? isLight ? 'bg-sky-50 text-sky-600' : 'bg-sky-500/15 text-sky-400'
                                : isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/15 text-blue-400'
                          }`}>{(c.tipo_contrato || '').toUpperCase() === 'APRENDIZ' ? 'Aprendiz' : (c.tipo_contrato || 'CLT')}</span>
                          {tempoEmpresa && (
                            <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Clock size={9} />{tempoEmpresa}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={14} className={`shrink-0 ${isLight ? 'text-slate-300 group-hover:text-violet-500' : 'text-slate-600 group-hover:text-violet-400'} transition-colors`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {afastando && (
        <AfastamentoModal colab={afastando} isLight={isLight} onClose={() => setAfastando(null)} />
      )}
    </div>
  )
}
