import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HardHat, ClipboardList, CloudSun, Wallet, Receipt,
  Users, Truck, Users2,
} from 'lucide-react'
import {
  useObrasKPIs,
  useApontamentos,
  useMobilizacoes,
  useEquipes,
} from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import {
  MobilePanel, MobileHeader, Segmented, KpiCard, KpiGrid, Section,
  SectionBody, RowList, ListRow, LeadingBadge, Pill, Empty, MobileLoading,
} from '../../components/paineis-mobile/kit'
import type { Tone } from '../../components/paineis-mobile/kit'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_APONTAMENTO: Record<string, { label: string; tone: Tone }> = {
  rascunho:   { label: 'Rascunho',   tone: 'slate' },
  confirmado: { label: 'Confirmado', tone: 'blue' },
  validado:   { label: 'Validado',   tone: 'emerald' },
}

const STATUS_MOB: Record<string, { label: string; tone: Tone }> = {
  planejada:    { label: 'Planejada',    tone: 'slate' },
  em_andamento: { label: 'Em Andamento', tone: 'blue' },
  concluida:    { label: 'Concluida',    tone: 'emerald' },
}

// Versão mobile-native do Painel de Obras — MESMOS dados do ObrasHome.tsx.
export default function ObrasHomeMobile() {
  const nav = useNavigate()
  const obras = useLookupObras()
  const { data: kpis, isLoading } = useObrasKPIs()
  const { data: recentApontamentos = [] } = useApontamentos()
  const { data: mobilizacoes = [] } = useMobilizacoes()

  const [aba, setAba] = useState('atividade')

  // Equipe — mesma lógica do desktop
  const [equipeObraId, setEquipeObraId] = useState('')
  const { data: equipeData = [] } = useEquipes(equipeObraId || undefined)

  if (isLoading) return <MobileLoading tone="emerald" />

  const latest5 = recentApontamentos.slice(0, 5)
  const recentMobs = mobilizacoes.slice(0, 5)

  return (
    <MobilePanel>
      <MobileHeader
        title="Painel de Obras"
        subtitle="Apontamentos, RDOs, adiantamentos e equipes"
        icon={HardHat}
        tone="emerald"
      />

      {/* KPIs */}
      <KpiGrid>
        <KpiCard label="Apontamentos Hoje" value={kpis?.apontamentos_hoje ?? 0} tone="blue" note="registros do dia" icon={ClipboardList} />
        <KpiCard label="RDOs Pendentes" value={kpis?.rdos_pendentes ?? 0} tone="amber" note="aguardando finalizar" icon={CloudSun} />
        <KpiCard label="Adiant. Abertos" value={kpis?.adiantamentos_abertos ?? 0} tone="violet" note="aguardando prestacao" icon={Wallet} />
        <KpiCard label="Prest. Pendentes" value={kpis?.prestacoes_pendentes ?? 0} tone="rose" note="aguardando aprovacao" icon={Receipt} />
      </KpiGrid>

      <Segmented
        value={aba}
        onChange={setAba}
        options={[{ value: 'atividade', label: 'Atividade' }, { value: 'equipe', label: 'Equipe' }]}
      />

      {aba === 'atividade' ? (
        <>
          {/* Apontamentos Recentes */}
          <Section title="Apontamentos Recentes" icon={ClipboardList} tone="blue" action={{ label: 'Ver todos', onClick: () => nav('/obras/apontamentos') }}>
            {latest5.length === 0 ? (
              <Empty icon={ClipboardList}>Nenhum apontamento registrado</Empty>
            ) : (
              <RowList>
                {latest5.map(ap => {
                  const st = STATUS_APONTAMENTO[ap.status] ?? STATUS_APONTAMENTO.rascunho
                  return (
                    <ListRow
                      key={ap.id}
                      title={ap.atividade}
                      subtitle={`${ap.obra?.nome ?? '—'}${ap.frente?.nome ? ` / ${ap.frente.nome}` : ''}`}
                      value={`${ap.quantidade_executada} ${ap.unidade ?? 'un'}`}
                      valueSub={fmtDate(ap.data_apontamento)}
                      leading={<Pill tone={st.tone}>{st.label}</Pill>}
                    />
                  )
                })}
              </RowList>
            )}
          </Section>

          {/* Mobilizacoes Recentes */}
          <Section title="Mobilizacoes Recentes" icon={Truck} tone="teal" action={{ label: 'Nova', onClick: () => nav('/obras/equipe') }}>
            {recentMobs.length === 0 ? (
              <Empty icon={Truck}>Nenhuma mobilizacao registrada</Empty>
            ) : (
              <RowList>
                {recentMobs.map(mob => {
                  const st = STATUS_MOB[mob.status] ?? STATUS_MOB.planejada
                  return (
                    <ListRow
                      key={mob.id}
                      leading={<LeadingBadge tone={st.tone}><Truck size={15} /></LeadingBadge>}
                      title={mob.tipo === 'mobilizacao' ? 'Mobilizacao' : 'Desmobilizacao'}
                      subtitle={`${mob.obra?.nome ?? '—'}${mob.data_prevista ? ` • ${fmtDate(mob.data_prevista)}` : ''}`}
                      value={<Pill tone={st.tone}>{st.label}</Pill>}
                    />
                  )
                })}
              </RowList>
            )}
          </Section>

          {/* Acesso Rapido */}
          <Section title="Acesso Rapido" icon={HardHat} tone="emerald">
            <RowList>
              <ListRow leading={<LeadingBadge tone="blue"><ClipboardList size={15} /></LeadingBadge>} title="Apontamentos" subtitle="Registro diario de producao" onClick={() => nav('/obras/apontamentos')} />
              <ListRow leading={<LeadingBadge tone="amber"><CloudSun size={15} /></LeadingBadge>} title="RDO" subtitle="Relatorio diario de obra" onClick={() => nav('/obras/rdo')} />
              <ListRow leading={<LeadingBadge tone="violet"><Wallet size={15} /></LeadingBadge>} title="Adiantamentos" subtitle="Solicitacoes e prestacao de contas" onClick={() => nav('/obras/adiantamentos')} />
              <ListRow leading={<LeadingBadge tone="rose"><Receipt size={15} /></LeadingBadge>} title="Prestacao de Contas" subtitle="Despesas e reembolsos" onClick={() => nav('/obras/prestacao')} />
              <ListRow leading={<LeadingBadge tone="teal"><Users size={15} /></LeadingBadge>} title="Planejamento de Equipe" subtitle="Profissionais por obra" onClick={() => nav('/obras/equipe')} />
            </RowList>
          </Section>
        </>
      ) : (
        /* Equipe por Obra */
        <Section title="Equipe por Obra" icon={Users2} tone="violet">
          <SectionBody>
            <select
              value={equipeObraId}
              onChange={e => setEquipeObraId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-600 dark:text-slate-300 [&>option]:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="">Selecione uma obra</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </SectionBody>

          {!equipeObraId ? (
            <Empty icon={Users2}>Selecione uma obra para ver a equipe</Empty>
          ) : equipeData.length === 0 ? (
            <Empty icon={Users2}>Nenhum membro na equipe desta obra</Empty>
          ) : (
            <RowList>
              {equipeData.map(m => (
                <ListRow
                  key={m.id}
                  leading={<LeadingBadge tone="violet">{m.colaborador_nome.charAt(0).toUpperCase()}</LeadingBadge>}
                  title={m.colaborador_nome}
                  subtitle={`${m.funcao}${m.frente?.nome ? ` • ${m.frente.nome}` : ''}`}
                  value={<Pill tone={m.ativo ? 'emerald' : 'slate'}>{m.ativo ? 'Ativo' : 'Inativo'}</Pill>}
                />
              ))}
            </RowList>
          )}
        </Section>
      )}
    </MobilePanel>
  )
}
