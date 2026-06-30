// pages/rh/DPPonto.tsx — DP > Ponto
import { useState, useMemo } from 'react'
import { Clock, FileEdit, Timer, FileText, ShieldCheck, CheckCircle2, Fingerprint, CalendarRange, CalendarDays } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import type { RHTab } from '../../components/rh/RHTabRail'
import { useTheme } from '../../contexts/ThemeContext'
import { useBases } from '../../hooks/useEstoque'
import { usePontoRetificacoes } from '../../hooks/usePonto'
import { ultimosMeses, labelMes, mesAtual, hojeISO, ontemISO } from '../../lib/ponto'
import {
  RegistrosPontoTab, RetificacoesTab, HorasExtrasTab, AtestadosTab, AprovacaoTab, ConsolidacaoTab,
  MultiSelectJustif, RUIDO_MIGRACAO, REG_CHIPS,
} from '../../components/rh/ponto/PontoTabs'
import type { PontoTabProps } from '../../types/ponto'

const TABS: RHTab[] = [
  { key: 'registros',     label: 'Registros Ponto', icon: Clock,        cor: 'blue' },
  { key: 'retificacoes',  label: 'Retificações',    icon: FileEdit,     cor: 'amber' },
  { key: 'horas_extras',  label: 'Horas Extras',    icon: Timer,        cor: 'orange' },
  { key: 'atestados',     label: 'Atestados',       icon: FileText,     cor: 'rose' },
  { key: 'aprovacao',     label: 'Aprovação',       icon: ShieldCheck,  cor: 'violet' },
  { key: 'consolidacao',  label: 'Consolidação',    icon: CheckCircle2, cor: 'emerald' },
]

export default function DPPonto() {
  const { isLightSidebar: isLight } = useTheme()
  const [anoMes, setAnoMes] = useState(mesAtual())
  const [baseId, setBaseId] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [status, setStatus] = useState('')
  const [ocultosJustif, setOcultosJustif] = useState<Set<string>>(new Set(['Mudança de ponto']))
  const [quickReg, setQuickReg] = useState('todos')
  const [vista, setVista] = useState('mes')
  const [diaData, setDiaData] = useState(hojeISO())
  const { data: basesRaw = [] } = useBases()
  const bases = basesRaw.map(b => ({ id: b.id, nome: b.nome, codigo: b.codigo }))

  // motivos de retificação (p/ o dropdown na barra), do mesmo cache do hook
  const { data: retData = [] } = usePontoRetificacoes(anoMes)
  const motivosRetif = useMemo(() => [...new Set(
    retData.filter(r => r.motivo && !RUIDO_MIGRACAO.test(r.motivo) && (!baseId || r.colaborador?.base_id === baseId)).map(r => r.motivo!)
  )].sort(), [retData, baseId])
  const toggleJustif = (m: string) => setOcultosJustif(s => { const n = new Set(s); n.has(m) ? n.delete(m) : n.add(m); return n })

  const semFiltroBase = (key: string) => key === 'aprovacao' || key === 'consolidacao'
  const selCls = `px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-700 bg-slate-800 text-white'}`

  function renderPanel(key: string) {
    const props: PontoTabProps = { anoMes, baseId, pessoa, status, ocultosJustif, quickReg, vista, diaData, bases }
    const temStatus = key === 'retificacoes' || key === 'horas_extras' || key === 'atestados'
    const chipCls = (on: boolean) => `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${on ? (isLight ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-violet-500/20 text-violet-300 border-violet-500/30') : (isLight ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50' : 'bg-white/[0.03] text-slate-400 border-white/10 hover:bg-white/[0.06]')}`
    const segCls = (on: boolean) => `px-2.5 py-2 text-xs font-semibold inline-flex items-center gap-1 ${on ? (isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/20 text-violet-300') : (isLight ? 'bg-white text-slate-500 hover:bg-slate-50' : 'bg-transparent text-slate-400 hover:bg-white/[0.05]')}`
    return (
      <div className="space-y-4">
        {/* Filtros (primeira linha): mês + base + status + justificativa + pessoa */}
        <div className="flex items-center gap-2 flex-wrap">
          {!(key === 'registros' && vista === 'dia') && (
            <select value={anoMes} onChange={e => setAnoMes(e.target.value)} className={selCls}>
              {ultimosMeses(12).map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
          )}
          {!semFiltroBase(key) && (
            <select value={baseId} onChange={e => setBaseId(e.target.value)} className={selCls}>
              <option value="">Todas as bases</option>
              {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          )}
          {temStatus && (
            <select value={status} onChange={e => setStatus(e.target.value)} className={selCls}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="em_aprovacao">Em aprovação</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
            </select>
          )}
          {key === 'retificacoes' && (
            <MultiSelectJustif motivos={motivosRetif} ocultos={ocultosJustif} toggle={toggleJustif} />
          )}
          {!semFiltroBase(key) && (
            <input value={pessoa} onChange={e => setPessoa(e.target.value)} placeholder="Filtrar por pessoa…"
              className={`${selCls} w-[180px]`} />
          )}
          {key === 'registros' && (
            <div className={`inline-flex rounded-xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
              <button onClick={() => setVista('mes')} className={segCls(vista === 'mes')}><CalendarRange size={13} /> Mês</button>
              <button onClick={() => setVista('dia')} className={segCls(vista === 'dia')}><CalendarDays size={13} /> Dia</button>
            </div>
          )}
          {key === 'registros' && vista === 'mes' && (<>
            <div className="hidden lg:flex items-center gap-1.5">
              {REG_CHIPS.map(ch => (
                <button key={ch.k} onClick={() => setQuickReg(ch.k)} className={chipCls(quickReg === ch.k)}>
                  <ch.icon size={13} /> {ch.label}
                </button>
              ))}
            </div>
            <select value={quickReg} onChange={e => setQuickReg(e.target.value)} className={`${selCls} lg:hidden`}>
              {REG_CHIPS.map(ch => <option key={ch.k} value={ch.k}>{ch.label}</option>)}
            </select>
          </>)}
          {key === 'registros' && vista === 'dia' && (<>
            <button onClick={() => setDiaData(hojeISO())} className={chipCls(diaData === hojeISO())}>Hoje</button>
            <button onClick={() => setDiaData(ontemISO())} className={chipCls(diaData === ontemISO())}>Ontem</button>
            <input type="date" value={diaData} onChange={e => setDiaData(e.target.value)} className={selCls} />
          </>)}
        </div>

        {key === 'registros' && <RegistrosPontoTab {...props} />}
        {key === 'retificacoes' && <RetificacoesTab {...props} />}
        {key === 'horas_extras' && <HorasExtrasTab {...props} />}
        {key === 'atestados' && <AtestadosTab {...props} />}
        {key === 'aprovacao' && <AprovacaoTab {...props} />}
        {key === 'consolidacao' && <ConsolidacaoTab {...props} />}
      </div>
    )
  }

  return <DPFluxoPage titulo="Ponto" subtitulo="Registros, retificações, horas extras e consolidação" icon={Fingerprint} iconColor="text-blue-400" tabs={TABS} renderPanel={renderPanel} />
}
