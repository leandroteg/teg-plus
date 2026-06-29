import { useMemo } from 'react'
import { HardHat, Users2, Truck, Building2, Layers, Wrench } from 'lucide-react'
import { usePlanejamentoEquipe, useObrasComProjeto } from '../../hooks/useObras'
import { useAlocacoes, useVeiculos } from '../../hooks/useFrotas'
import { CATEGORIA_GRUPO, CATEGORIA_GRUPO_LABEL } from '../../constants/categoriaVeiculo'
import {
  MobilePanel, MobileHeader, KpiGrid, KpiCard, Section, SectionBody,
  BarStat, Empty, MobileLoading,
} from '../../components/paineis-mobile/kit'

const STATUS_ATIVO = ['planejado', 'mobilizado', 'ativo']
const poloNm = (s?: string) => (s ?? '').replace(/^F[\d.\/]+\s*-\s*/, '') || (s ?? '—')

// Versão mobile do Painel Obras — mesmos dados do desktop (equipe + frota), ajustado para telas pequenas.
export default function ObrasPainelMobile() {
  const { data: equipe = [], isLoading } = usePlanejamentoEquipe()
  const { data: obras = [] } = useObrasComProjeto()
  const { data: alocFrota = [] } = useAlocacoes()
  const { data: veiculos = [] } = useVeiculos()

  const d = useMemo(() => {
    const obraById = new Map(obras.map(o => [o.id, o]))
    const ativos = equipe.filter(e => STATUS_ATIVO.includes(e.status))

    const kpi = {
      obras:         new Set(ativos.map(e => e.obra_id).filter(Boolean)).size,
      pessoas:       ativos.length,
      supervisores:  ativos.filter(e => e.papel === 'supervisor').length,
      encarregados:  ativos.filter(e => e.papel === 'encarregado').length,
      engenheiros:   ativos.filter(e => e.papel === 'engenheiro').length,
    }

    // efetivo por obra
    const obraCount = new Map<string, number>()
    ativos.forEach(e => { if (e.obra_id) obraCount.set(e.obra_id, (obraCount.get(e.obra_id) ?? 0) + 1) })
    const porObra = [...obraCount.entries()]
      .map(([id, n]) => ({ label: obraById.get(id)?.nome ?? '—', value: n }))
      .sort((a, b) => b.value - a.value)

    // efetivo por polo/projeto
    const poloCount = new Map<string, number>()
    ativos.forEach(e => {
      const pn = poloNm(obraById.get(e.obra_id)?.projeto_nome)
      poloCount.set(pn, (poloCount.get(pn) ?? 0) + 1)
    })
    const porPolo = [...poloCount.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // composição por papel
    const papelCfg = { engenheiro: 'Engenheiros', supervisor: 'Supervisores', encarregado: 'Encarregados', apoio: 'Apoio', time: 'Time' }
    const porPapel = (Object.keys(papelCfg) as Array<keyof typeof papelCfg>)
      .map(p => ({ label: papelCfg[p], value: ativos.filter(e => e.papel === p).length }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value)

    // efetivo por frente (encarregado + seu time)
    const timeByLider = new Map<string, number>()
    ativos.filter(e => e.papel === 'time').forEach(e => { const k = e.lider_id ?? ''; timeByLider.set(k, (timeByLider.get(k) ?? 0) + 1) })
    const frenteCount = new Map<string, number>()
    ativos.filter(e => e.papel === 'encarregado').forEach(e => {
      const f = e.funcao_equipe || 'Sem frente'
      frenteCount.set(f, (frenteCount.get(f) ?? 0) + 1 + (timeByLider.get(e.id) ?? 0))
    })
    const porFrente = [...frenteCount.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // frota
    const veicById = new Map(veiculos.map(v => [v.id, v]))
    const frotaAtiva = alocFrota.filter(a => a.status === 'ativa' && a.obra_id && veicById.get(a.veiculo_id))
    const frotaPorObra  = new Map<string, number>()
    const frotaPorGrupo = new Map<string, number>()
    frotaAtiva.forEach(a => {
      frotaPorObra.set(a.obra_id!, (frotaPorObra.get(a.obra_id!) ?? 0) + 1)
      const veic = veicById.get(a.veiculo_id)!
      const g = CATEGORIA_GRUPO[veic.categoria]
      const gl = g ? CATEGORIA_GRUPO_LABEL[g] : 'Outros'
      frotaPorGrupo.set(gl, (frotaPorGrupo.get(gl) ?? 0) + 1)
    })
    const maquinas = frotaAtiva.length
    const porFrotaObra  = [...frotaPorObra.entries()].map(([id, n]) => ({ label: obraById.get(id)?.nome ?? '—', value: n })).sort((a, b) => b.value - a.value)
    const porFrotaGrupo = [...frotaPorGrupo.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

    return { kpi, maquinas, porObra, porPolo, porPapel, porFrente, porFrotaObra, porFrotaGrupo }
  }, [equipe, obras, alocFrota, veiculos])

  if (isLoading) return <MobileLoading tone="amber" />

  const maxObra   = Math.max(1, ...d.porObra.map(x => x.value))
  const maxPolo   = Math.max(1, ...d.porPolo.map(x => x.value))
  const maxPapel  = Math.max(1, ...d.porPapel.map(x => x.value))
  const maxFrente = Math.max(1, ...d.porFrente.map(x => x.value))
  const maxFObra  = Math.max(1, ...d.porFrotaObra.map(x => x.value))
  const maxFGrupo = Math.max(1, ...d.porFrotaGrupo.map(x => x.value))

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel - Obras"
        subtitle="Mobilização de equipes e frota nas obras ativas"
        icon={HardHat}
        tone="amber"
      />

      {/* KPIs de mobilização */}
      <KpiGrid cols={3}>
        <KpiCard label="Com equipe"   value={d.kpi.obras}        tone="amber"   note="obras ativas" />
        <KpiCard label="Pessoas"      value={d.kpi.pessoas}      tone="indigo"  note="mobilizadas" />
        <KpiCard label="Supervisores" value={d.kpi.supervisores} tone="violet"  note="líderes" />
        <KpiCard label="Encarregados" value={d.kpi.encarregados} tone="amber"   note="equipes" />
        <KpiCard label="Engenheiros"  value={d.kpi.engenheiros}  tone="sky"     note="responsáveis" />
        <KpiCard label="Máquinas"     value={d.maquinas}         tone="emerald" note="frota alocada" />
      </KpiGrid>

      {/* Efetivo por obra */}
      <Section title="Efetivo por Obra" icon={Building2} tone="amber">
        <SectionBody className="space-y-2">
          {d.porObra.length === 0
            ? <Empty>Nenhuma equipe alocada</Empty>
            : d.porObra.slice(0, 12).map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxObra) * 100} tone="amber" />)
          }
        </SectionBody>
      </Section>

      {/* Efetivo por polo */}
      <Section title="Efetivo por Polo" icon={Layers} tone="indigo">
        <SectionBody className="space-y-2">
          {d.porPolo.length === 0
            ? <Empty>Nenhuma equipe por polo</Empty>
            : d.porPolo.slice(0, 10).map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxPolo) * 100} tone="indigo" />)
          }
        </SectionBody>
      </Section>

      {/* Composição por papel */}
      <Section title="Composição por Papel" icon={Users2} tone="violet">
        <SectionBody className="space-y-2">
          {d.porPapel.length === 0
            ? <Empty>Nenhum papel mapeado</Empty>
            : d.porPapel.map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxPapel) * 100} tone="violet" />)
          }
        </SectionBody>
      </Section>

      {/* Efetivo por frente de trabalho */}
      <Section title="Efetivo por Frente" icon={HardHat} tone="teal">
        <SectionBody className="space-y-2">
          {d.porFrente.length === 0
            ? <Empty>Nenhuma frente mapeada</Empty>
            : d.porFrente.slice(0, 10).map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxFrente) * 100} tone="teal" />)
          }
        </SectionBody>
      </Section>

      {/* Frota por obra */}
      <Section title="Frota por Obra" icon={Truck} tone="emerald">
        <SectionBody className="space-y-2">
          {d.porFrotaObra.length === 0
            ? <Empty>Nenhuma máquina alocada</Empty>
            : d.porFrotaObra.slice(0, 10).map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxFObra) * 100} tone="emerald" />)
          }
        </SectionBody>
      </Section>

      {/* Frota por tipo */}
      <Section title="Frota por Tipo" icon={Wrench} tone="emerald">
        <SectionBody className="space-y-2">
          {d.porFrotaGrupo.length === 0
            ? <Empty>Nenhuma máquina alocada</Empty>
            : d.porFrotaGrupo.map(x => <BarStat key={x.label} label={x.label} value={`${x.value}`} pct={(x.value / maxFGrupo) * 100} tone="emerald" />)
          }
        </SectionBody>
      </Section>
    </MobilePanel>
  )
}
