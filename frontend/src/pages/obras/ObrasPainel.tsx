import { useMemo } from 'react'
import { HardHat, Users2, Truck, Building2, Layers } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePlanejamentoEquipe, useObrasComProjeto } from '../../hooks/useObras'
import { useAlocacoes, useVeiculos } from '../../hooks/useFrotas'
import { CATEGORIA_GRUPO, CATEGORIA_GRUPO_LABEL } from '../../constants/categoriaVeiculo'

const STATUS_ATIVO = ['planejado', 'mobilizado', 'ativo']
const poloNm = (s?: string) => (s ?? '').replace(/^F[\d.\/]+\s*-\s*/, '') || (s ?? '—')

// Painel do módulo Obras — foco em mobilização (equipes alocadas) + frota por obra.
// Padrão EGP: cards de KPI + barras horizontais, tema claro/escuro, dados reais.
export default function ObrasPainel() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { data: equipe = [] } = usePlanejamentoEquipe()
  const { data: obras = [] } = useObrasComProjeto()
  const { data: alocFrota = [] } = useAlocacoes()
  const { data: veiculos = [] } = useVeiculos()

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const cardClass = isDark ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-white border border-slate-200 shadow-sm'

  const d = useMemo(() => {
    const obraById = new Map(obras.map(o => [o.id, o]))
    const ativos = equipe.filter(e => STATUS_ATIVO.includes(e.status))

    const kpi = {
      obras: new Set(ativos.map(e => e.obra_id).filter(Boolean)).size,
      pessoas: ativos.length,
      supervisores: ativos.filter(e => e.papel === 'supervisor').length,
      encarregados: ativos.filter(e => e.papel === 'encarregado').length,
      engenheiros: ativos.filter(e => e.papel === 'engenheiro').length,
    }

    // composição por papel
    const porPapel = (['engenheiro', 'supervisor', 'encarregado', 'apoio', 'time'] as const)
      .map(p => ({ label: { engenheiro: 'Engenheiros', supervisor: 'Supervisores', encarregado: 'Encarregados', apoio: 'Apoio', time: 'Time' }[p], value: ativos.filter(e => e.papel === p).length, cor: { engenheiro: '#6366f1', supervisor: '#8b5cf6', encarregado: '#f97316', apoio: '#06b6d4', time: '#94a3b8' }[p] }))
      .filter(x => x.value > 0)

    // efetivo por obra
    const obraCount = new Map<string, number>()
    ativos.forEach(e => { if (e.obra_id) obraCount.set(e.obra_id, (obraCount.get(e.obra_id) ?? 0) + 1) })
    const porObra = [...obraCount.entries()].map(([id, n]) => ({ label: obraById.get(id)?.nome ?? '—', value: n })).sort((a, b) => b.value - a.value)

    // efetivo por polo/projeto
    const poloCount = new Map<string, number>()
    ativos.forEach(e => { const pn = poloNm(obraById.get(e.obra_id)?.projeto_nome); poloCount.set(pn, (poloCount.get(pn) ?? 0) + 1) })
    const porPolo = [...poloCount.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

    // por frente de trabalho (encarregado.funcao_equipe → encarregado + seu time)
    const timeByLider = new Map<string, number>()
    ativos.filter(e => e.papel === 'time').forEach(e => { const k = e.lider_id ?? ''; timeByLider.set(k, (timeByLider.get(k) ?? 0) + 1) })
    const frenteCount = new Map<string, number>()
    ativos.filter(e => e.papel === 'encarregado').forEach(e => {
      const f = e.funcao_equipe || 'Sem frente'
      frenteCount.set(f, (frenteCount.get(f) ?? 0) + 1 + (timeByLider.get(e.id) ?? 0))
    })
    const porFrente = [...frenteCount.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

    // frota
    const veicById = new Map(veiculos.map(v => [v.id, v]))
    const frotaAtiva = alocFrota.filter(a => a.status === 'ativa' && a.obra_id && veicById.get(a.veiculo_id))
    const frotaPorObra = new Map<string, number>()
    const frotaPorGrupo = new Map<string, number>()
    frotaAtiva.forEach(a => {
      frotaPorObra.set(a.obra_id!, (frotaPorObra.get(a.obra_id!) ?? 0) + 1)
      const veic = veicById.get(a.veiculo_id)!
      const g = CATEGORIA_GRUPO[veic.categoria]; const gl = g ? CATEGORIA_GRUPO_LABEL[g] : 'Outros'
      frotaPorGrupo.set(gl, (frotaPorGrupo.get(gl) ?? 0) + 1)
    })
    const maquinas = frotaAtiva.length
    const porFrotaObra = [...frotaPorObra.entries()].map(([id, n]) => ({ label: obraById.get(id)?.nome ?? '—', value: n })).sort((a, b) => b.value - a.value)
    const porFrotaGrupo = [...frotaPorGrupo.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

    return { kpi, maquinas, porPapel, porObra, porPolo, porFrente, porFrotaObra, porFrotaGrupo }
  }, [equipe, obras, alocFrota, veiculos])

  return (
    <div className="space-y-3">
      {/* Indicadores consolidados — padrão EGP */}
      <section className={`rounded-3xl p-4 md:p-5 ${cardClass}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Obras · Indicadores consolidados</p>
        <h2 className={`text-sm font-black mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Mobilização <span className="font-normal text-slate-400 text-[11px]">· efetivo e frota nas obras ativas</span></h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Kpi isDark={isDark} label="Obras com equipe"    value={`${d.kpi.obras}`}        note="com efetivo"   tone={isDark ? 'text-orange-400' : 'text-orange-600'} />
          <Kpi isDark={isDark} label="Pessoas mobilizadas" value={`${d.kpi.pessoas}`}      note="efetivo total" tone={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
          <Kpi isDark={isDark} label="Supervisores"        value={`${d.kpi.supervisores}`} note="líderes"       tone={isDark ? 'text-violet-400' : 'text-violet-600'} />
          <Kpi isDark={isDark} label="Encarregados"        value={`${d.kpi.encarregados}`} note="equipes"       tone={isDark ? 'text-amber-400' : 'text-amber-600'} />
          <Kpi isDark={isDark} label="Engenheiros"         value={`${d.kpi.engenheiros}`}  note="responsáveis"  tone={isDark ? 'text-sky-400' : 'text-sky-600'} />
          <Kpi isDark={isDark} label="Máquinas"            value={`${d.maquinas}`}         note="frota alocada" tone={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Bloco isDark={isDark} className={card} titulo="Efetivo por obra" icon={Building2}>
          <Barras isDark={isDark} dados={d.porObra} cor="#f97316" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Efetivo por polo" icon={Layers}>
          <Barras isDark={isDark} dados={d.porPolo} cor="#6366f1" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Composição por papel" icon={Users2}>
          <Barras isDark={isDark} dados={d.porPapel} />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Efetivo por frente de trabalho" icon={HardHat}>
          <Barras isDark={isDark} dados={d.porFrente} cor="#8b5cf6" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Frota por obra" icon={Truck}>
          <Barras isDark={isDark} dados={d.porFrotaObra} cor="#10b981" vazio="Nenhuma máquina alocada" />
        </Bloco>
        <Bloco isDark={isDark} className={card} titulo="Frota por tipo" icon={Truck}>
          <Barras isDark={isDark} dados={d.porFrotaGrupo} cor="#10b981" vazio="Nenhuma máquina alocada" />
        </Bloco>
      </div>
    </div>
  )
}

function Kpi({ isDark, label, value, note, tone }: { isDark: boolean; label: string; value: string; note: string; tone: string }) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${isDark ? 'border-white/[0.06] bg-white/[0.03]' : 'border-slate-100 bg-slate-50/70'}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 truncate">{label}</p>
      <p className={`mt-1.5 text-xl leading-none font-black ${tone}`}>{value}</p>
      <p className={`text-[9px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{note}</p>
    </div>
  )
}

function Bloco({ isDark, className, titulo, icon: Icon, children }: { isDark: boolean; className: string; titulo: string; icon: typeof Users2; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <Icon size={14} className={isDark ? 'text-slate-300' : 'text-slate-500'} />
        <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Barras({ isDark, dados, cor, vazio }: { isDark: boolean; dados: { label: string; value: number; cor?: string }[]; cor?: string; vazio?: string }) {
  const max = Math.max(1, ...dados.map(x => x.value))
  const txtMain = isDark ? 'text-white' : 'text-slate-700'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  if (dados.length === 0) return <p className={`text-[11px] italic ${txtMuted} py-2`}>{vazio ?? 'Sem dados'}</p>
  return (
    <div className="space-y-1.5">
      {dados.slice(0, 12).map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`text-[11px] truncate w-[42%] shrink-0 ${txtMain}`} title={x.label}>{x.label}</span>
          <div className={`flex-1 h-3.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full" style={{ width: `${(x.value / max) * 100}%`, backgroundColor: x.cor ?? cor ?? '#6366f1' }} />
          </div>
          <span className={`text-[11px] font-bold w-7 text-right shrink-0 ${txtMain}`}>{x.value}</span>
        </div>
      ))}
    </div>
  )
}
