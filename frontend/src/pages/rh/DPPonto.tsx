// pages/rh/DPPonto.tsx — DP > Ponto
import { useState } from 'react'
import { Clock, FileEdit, Timer, FileText, ShieldCheck, CheckCircle2, Fingerprint } from 'lucide-react'
import DPFluxoPage from '../../components/rh/DPFluxoPage'
import type { RHTab } from '../../components/rh/RHTabRail'
import { useTheme } from '../../contexts/ThemeContext'
import { useBases } from '../../hooks/useEstoque'
import { ultimosMeses, labelMes, mesAtual } from '../../lib/ponto'
import {
  RegistrosPontoTab, RetificacoesTab, HorasExtrasTab, AtestadosTab, AprovacaoTab, ConsolidacaoTab,
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
  const { data: basesRaw = [] } = useBases()
  const bases = basesRaw.map(b => ({ id: b.id, nome: b.nome, codigo: b.codigo }))

  // filtro de base não se aplica a Aprovação/Consolidação (visão por área)
  const semFiltroBase = (key: string) => key === 'aprovacao' || key === 'consolidacao'

  const selCls = `px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-700 bg-slate-800 text-white'}`

  function renderPanel(key: string) {
    const props: PontoTabProps = { anoMes, baseId, bases }
    return (
      <div className="space-y-4">
        {/* Filtro mês + base */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={anoMes} onChange={e => setAnoMes(e.target.value)} className={selCls}>
            {ultimosMeses(12).map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          {!semFiltroBase(key) && (
            <select value={baseId} onChange={e => setBaseId(e.target.value)} className={selCls}>
              <option value="">Todas as bases</option>
              {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          )}
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
