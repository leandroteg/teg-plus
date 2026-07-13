// ─────────────────────────────────────────────────────────────────────────────
// pages/rh/RHAdmissao.tsx — Fluxo de Admissão (7 etapas)
// Rail de abas no padrão do Financeiro (CPPipeline · PipelineRail).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  UserPlus, ClipboardList, ShieldCheck, FileText, Stethoscope, Truck,
  HeartHandshake, CheckCircle2, ChevronLeft, ChevronRight, Plus, Construction, Receipt,
  ChevronRight as ChevR, Paperclip, AlertTriangle, XCircle, HelpCircle, Loader2,
  Smartphone, Circle, MinusCircle, User, Building2, Calendar, Briefcase, Handshake, Upload,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useAdmissoesFluxo, useMissoesDocsStatus, useParecerQualificacao,
  useAnexarDocMissao, useUploadAnexoCandidato,
} from '../../hooks/useRHAdmissaoFluxo'
import RHAdmissaoForm from '../../components/rh/RHAdmissaoForm'
import RHAdmissaoModal from '../../components/rh/RHAdmissaoModal'
import RHFluxoToolbar, { type ViewMode } from '../../components/rh/RHFluxoToolbar'
import { PropostaCard, ExamesCard, RegistroCard, MobilizacaoCard, IntegracaoCard, LiberadoCard, ExcluirAdmissaoBtn } from '../../components/rh/RHAdmissaoEtapas'
import { useAuth } from '../../contexts/AuthContext'
import type { RHAdmissao, EtapaAdmissaoFluxo } from '../../types/rh'

type EtapaAdmissao = EtapaAdmissaoFluxo

const ETAPAS: { key: EtapaAdmissao; num: number; label: string; descricao: string; icon: typeof Receipt }[] = [
  { key: 'requisicao',          num: 1, label: 'Pendente',                 descricao: 'Requisições aguardando envio para aprovação.',                   icon: ClipboardList },
  { key: 'aprovacao',           num: 2, label: 'Aprovação',               descricao: 'Diretoria autoriza a admissão solicitada.',                      icon: ShieldCheck },
  { key: 'proposta_alinhamento', num: 3, label: 'Proposta', descricao: 'Proposta de contratação, aceite e alinhamento de chegada.',      icon: Handshake },
  { key: 'documentacao',        num: 4, label: 'Documentação',            descricao: 'Envio e conferência da documentação do colaborador.',            icon: FileText },
  { key: 'exames_treinamentos', num: 5, label: 'Exames',                  descricao: 'Exame admissional (ASO) — agendamento e resultado.',             icon: Stethoscope },
  { key: 'registro',            num: 6, label: 'Registro',                descricao: 'Ficha p/ contabilidade, contrato, assinatura e matrícula.',      icon: ClipboardList },
  { key: 'mobilizacao',         num: 7, label: 'Mobilização',             descricao: 'Logística de deslocamento e chegada à obra.',                    icon: Truck },
  { key: 'integracao',          num: 8, label: 'Integração', descricao: 'Treinamentos obrigatórios (NRs) + onboarding com RH e Gestor.', icon: HeartHandshake },
  { key: 'liberado',            num: 9, label: 'Liberação',               descricao: 'Colaborador apto, ativo e liberado para iniciar as atividades.', icon: CheckCircle2 },
]

const ETAPA_ICON: Record<Exclude<EtapaAdmissao, 'cancelada'>, typeof Receipt> = Object.fromEntries(
  ETAPAS.map(e => [e.key, e.icon]),
) as Record<Exclude<EtapaAdmissao, 'cancelada'>, typeof Receipt>

const ACCENT: Record<Exclude<EtapaAdmissao, 'cancelada'>, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:          { bg: 'hover:bg-blue-50',    bgActive: 'bg-blue-50',    text: 'text-blue-600',    textActive: 'text-blue-800',    border: 'border-blue-500',    badge: 'bg-blue-100 text-blue-700',       icon: 'text-blue-500' },
  aprovacao:           { bg: 'hover:bg-amber-50',   bgActive: 'bg-amber-50',   text: 'text-amber-600',   textActive: 'text-amber-800',   border: 'border-amber-500',   badge: 'bg-amber-100 text-amber-700',     icon: 'text-amber-500' },
  proposta_alinhamento:{ bg: 'hover:bg-rose-50',    bgActive: 'bg-rose-50',    text: 'text-rose-600',    textActive: 'text-rose-800',    border: 'border-rose-500',    badge: 'bg-rose-100 text-rose-700',       icon: 'text-rose-500' },
  documentacao:        { bg: 'hover:bg-violet-50',  bgActive: 'bg-violet-50',  text: 'text-violet-600',  textActive: 'text-violet-800',  border: 'border-violet-500',  badge: 'bg-violet-100 text-violet-700',   icon: 'text-violet-500' },
  exames_treinamentos: { bg: 'hover:bg-sky-50',     bgActive: 'bg-sky-50',     text: 'text-sky-600',     textActive: 'text-sky-800',     border: 'border-sky-500',     badge: 'bg-sky-100 text-sky-700',         icon: 'text-sky-500' },
  registro:            { bg: 'hover:bg-indigo-50',  bgActive: 'bg-indigo-50',  text: 'text-indigo-600',  textActive: 'text-indigo-800',  border: 'border-indigo-500',  badge: 'bg-indigo-100 text-indigo-700',   icon: 'text-indigo-500' },
  mobilizacao:         { bg: 'hover:bg-orange-50',  bgActive: 'bg-orange-50',  text: 'text-orange-600',  textActive: 'text-orange-800',  border: 'border-orange-500',  badge: 'bg-orange-100 text-orange-700',   icon: 'text-orange-500' },
  integracao:          { bg: 'hover:bg-teal-50',    bgActive: 'bg-teal-50',    text: 'text-teal-600',    textActive: 'text-teal-800',    border: 'border-teal-500',    badge: 'bg-teal-100 text-teal-700',       icon: 'text-teal-500' },
  liberado:            { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500' },
}

const ACCENT_DARK: Record<Exclude<EtapaAdmissao, 'cancelada'>, { bg: string; bgActive: string; text: string; textActive: string; border: string; badge: string; icon: string }> = {
  requisicao:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-blue-500/10',    text: 'text-blue-400',    textActive: 'text-blue-300',    border: 'border-blue-400/40',    badge: 'bg-blue-500/15 text-blue-200',       icon: 'text-blue-400' },
  aprovacao:           { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-amber-500/10',   text: 'text-amber-400',   textActive: 'text-amber-300',   border: 'border-amber-400/40',   badge: 'bg-amber-500/15 text-amber-200',     icon: 'text-amber-400' },
  proposta_alinhamento:{ bg: 'hover:bg-white/[0.03]', bgActive: 'bg-rose-500/10',    text: 'text-rose-400',    textActive: 'text-rose-300',    border: 'border-rose-400/40',    badge: 'bg-rose-500/15 text-rose-200',       icon: 'text-rose-400' },
  documentacao:        { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-violet-500/10',  text: 'text-violet-400',  textActive: 'text-violet-300',  border: 'border-violet-400/40',  badge: 'bg-violet-500/15 text-violet-200',   icon: 'text-violet-400' },
  exames_treinamentos: { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-sky-500/10',     text: 'text-sky-400',     textActive: 'text-sky-300',     border: 'border-sky-400/40',     badge: 'bg-sky-500/15 text-sky-200',         icon: 'text-sky-400' },
  registro:            { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-indigo-500/10',  text: 'text-indigo-400',  textActive: 'text-indigo-300',  border: 'border-indigo-400/40',  badge: 'bg-indigo-500/15 text-indigo-200',   icon: 'text-indigo-400' },
  mobilizacao:         { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-orange-500/10',  text: 'text-orange-400',  textActive: 'text-orange-300',  border: 'border-orange-400/40',  badge: 'bg-orange-500/15 text-orange-200',   icon: 'text-orange-400' },
  integracao:          { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-teal-500/10',    text: 'text-teal-400',    textActive: 'text-teal-300',    border: 'border-teal-400/40',    badge: 'bg-teal-500/15 text-teal-200',       icon: 'text-teal-400' },
  liberado:            { bg: 'hover:bg-white/[0.03]', bgActive: 'bg-emerald-500/10', text: 'text-emerald-400', textActive: 'text-emerald-300', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-200', icon: 'text-emerald-400' },
}

// ── Status derivado por admissão (etapa-aware; reflete o sub-status GESET) ─────
type StatusInfo = { key: string; label: string; cls: string }
function admStatus(a: RHAdmissao): StatusInfo {
  if (a.status_aprovacao === 'rejeitado') return { key: 'rejeitado', label: 'Rejeitado', cls: 'bg-red-100 text-red-700' }
  if (a.status_aprovacao === 'esclarecimento') return { key: 'esclarecer', label: 'Esclarecer', cls: 'bg-amber-100 text-amber-700' }
  const aguardandoGeset = (a.candidatos ?? []).some(
    c => (c.dados_extras as Record<string, unknown> | undefined)?.geset_status === 'aguardando_liberacao',
  )
  if (a.etapa === 'liberado') {
    return aguardandoGeset
      ? { key: 'aguardando', label: 'Aguardando liberação', cls: 'bg-amber-100 text-amber-700' }
      : { key: 'liberado', label: 'Liberado', cls: 'bg-emerald-100 text-emerald-700' }
  }
  if (a.etapa === 'integracao') {
    return aguardandoGeset
      ? { key: 'aguardando', label: 'Aguardando liberação', cls: 'bg-amber-100 text-amber-700' }
      : { key: 'em_integracao', label: 'Em integração', cls: 'bg-teal-100 text-teal-700' }
  }
  if (a.etapa === 'aprovacao') return { key: 'aprovacao', label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-700' }
  return { key: 'pendente', label: 'Pendente', cls: 'bg-amber-100 text-amber-700' }
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MESES_ABREV[Number(m) - 1] ?? m}/${y}`
}

// ── Dropdown de filtro compacto (padrão da linha de filtros) ───────────────────
function FiltroSelect({ value, onChange, options, placeholder, isDark }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; isDark: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border outline-none transition-all cursor-pointer ${
        value
          ? isDark ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-800 border-slate-200'
          : isDark ? 'bg-transparent text-slate-400 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
      }`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function RHAdmissao() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const autorNome = perfil?.nome || perfil?.email || 'Usuário'
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<'fluxo' | 'nova'>('fluxo')
  // Aba ativa persistida na URL: sobrevive a reload/auto-update do PWA
  const etapaUrl = searchParams.get('etapa') as EtapaAdmissao | null
  const [etapa, setEtapaState] = useState<EtapaAdmissao>(
    etapaUrl && ETAPAS.some(e => e.key === etapaUrl) ? etapaUrl : 'requisicao',
  )
  const setEtapa = (e: EtapaAdmissao) => {
    setEtapaState(e)
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('etapa', e); return p }, { replace: true })
  }
  const [selecionada, setSelecionada] = useState<RHAdmissao | null>(null)
  const [busca, setBusca] = useState('')
  const [sortField, setSortField] = useState('data')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [fBase, setFBase] = useState('')
  const [fMes, setFMes] = useState('')
  const [fUrg, setFUrg] = useState('')
  const [fStatus, setFStatus] = useState('')

  const { data: admissoes = [], isLoading } = useAdmissoesFluxo()

  // Status é específico da etapa (Integração/Liberação) — zera ao trocar de aba
  useEffect(() => { setFStatus('') }, [etapa])

  const temFiltroStatus = etapa === 'integracao' || etapa === 'liberado'

  // Abertura via ?nova=1 (menu Nova Solicitação → Admissão)
  useEffect(() => {
    if (searchParams.get('nova') === '1') {
      setView('nova')
      searchParams.delete('nova')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const ativa = ETAPAS.find(e => e.key === etapa) ?? ETAPAS[0]
  const counts = ETAPAS.reduce((acc, e) => {
    const naEtapa = admissoes.filter(a => (a.etapa ?? 'requisicao') === e.key)
    // Liberação: o badge conta só quem ainda está "Aguardando liberação" no GESET
    acc[e.key] = e.key === 'liberado'
      ? naEtapa.filter(a => admStatus(a).key === 'aguardando').length
      : naEtapa.length
    return acc
  }, {} as Record<EtapaAdmissao, number>)
  const itensEtapa = admissoes.filter(a => (a.etapa ?? 'requisicao') === etapa)

  // Opções de filtro — base/mês são globais (consistentes entre abas); status é da etapa
  const baseOptions = useMemo(
    () => Array.from(new Set(admissoes.map(a => a.base).filter(Boolean) as string[])).sort()
      .map(b => ({ value: b, label: b })),
    [admissoes],
  )
  const mesOptions = useMemo(
    () => Array.from(new Set(admissoes.map(a => (a.created_at ?? '').slice(0, 7)).filter(Boolean)))
      .sort().reverse().map(m => ({ value: m, label: mesLabel(m) })),
    [admissoes],
  )
  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>()
    itensEtapa.forEach(a => { const s = admStatus(a); if (!seen.has(s.key)) seen.set(s.key, s.label) })
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }, [itensEtapa])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let l = itensEtapa
    if (q) {
      l = l.filter(a => {
        const nomes = (a.candidatos ?? []).map(c => c.nome).join(' ').toLowerCase()
        return nomes.includes(q)
          || (a.base ?? '').toLowerCase().includes(q)
          || (a.centro_custo?.codigo ?? '').toLowerCase().includes(q)
          || (a.motivo ?? '').toLowerCase().includes(q)
      })
    }
    if (fBase) l = l.filter(a => (a.base ?? '') === fBase)
    if (fMes) l = l.filter(a => (a.created_at ?? '').slice(0, 7) === fMes)
    if (fUrg) l = l.filter(a => (fUrg === 'sim' ? !!a.urgente : !a.urgente))
    if (fStatus && temFiltroStatus) l = l.filter(a => admStatus(a).key === fStatus)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...l].sort((x, y) => {
      if (sortField === 'candidato') {
        const nx = (x.candidatos?.[0]?.nome ?? '').toLowerCase()
        const ny = (y.candidatos?.[0]?.nome ?? '').toLowerCase()
        return nx < ny ? -dir : nx > ny ? dir : 0
      }
      return (new Date(x.created_at).getTime() - new Date(y.created_at).getTime()) * dir
    })
  }, [itensEtapa, busca, sortField, sortDir, fBase, fMes, fUrg, fStatus, temFiltroStatus])

  if (view === 'nova') {
    return (
      <RHAdmissaoForm
        onBack={() => setView('fluxo')}
        onCreated={() => { setView('fluxo'); setEtapa('requisicao') }}
      />
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <UserPlus size={20} className="text-violet-400" />
          Admissão
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Fluxo de admissão — da requisição à liberação para atividades
        </p>
      </div>

      {/* Rail de abas */}
      <EtapaRail isDark={isDark} etapa={etapa} setEtapa={setEtapa} counts={counts} />

      {/* Conteúdo da etapa ativa */}
      <EtapaPanel etapa={ativa} isDark={isDark}>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-slate-300" /></div>
        ) : (
          <>
            <RHFluxoToolbar
              isDark={isDark} busca={busca} setBusca={setBusca}
              placeholder="Buscar candidato, base, CC..."
              sortOptions={[{ field: 'data', label: 'Data' }, { field: 'candidato', label: 'Candidato' }]}
              sortField={sortField} setSortField={setSortField} sortDir={sortDir} setSortDir={setSortDir}
              viewMode={viewMode} setViewMode={setViewMode}
              count={filtrados.length} total={itensEtapa.length}
            >
              <FiltroSelect value={fBase} onChange={setFBase} options={baseOptions} placeholder="Base" isDark={isDark} />
              <FiltroSelect value={fMes} onChange={setFMes} options={mesOptions} placeholder="Mês da solicitação" isDark={isDark} />
              <FiltroSelect value={fUrg} onChange={setFUrg}
                options={[{ value: 'sim', label: 'Urgente' }, { value: 'nao', label: 'Não urgente' }]}
                placeholder="Urgência" isDark={isDark} />
              {temFiltroStatus && (
                <FiltroSelect value={fStatus} onChange={setFStatus} options={statusOptions} placeholder="Status" isDark={isDark} />
              )}
            </RHFluxoToolbar>
            {filtrados.length === 0 ? (
              <PlaceholderVazio etapa={ativa} isDark={isDark} />
            ) : viewMode !== 'cards' ? (
              <AdmissaoLista itens={filtrados} isDark={isDark} onSelect={setSelecionada} />
            ) : (
              <div className="space-y-2">
                {filtrados.map(a => {
                  const props = { key: a.id, adm: a, isDark, onClick: () => setSelecionada(a) }
                  if (etapa === 'proposta_alinhamento') return <PropostaCard {...props} />
                  if (etapa === 'documentacao') return <DocumentacaoCard {...props} />
                  if (etapa === 'exames_treinamentos') return <ExamesCard {...props} autorNome={autorNome} />
                  if (etapa === 'registro') return <RegistroCard {...props} autorNome={autorNome} />
                  if (etapa === 'mobilizacao') return <MobilizacaoCard {...props} autorNome={autorNome} />
                  if (etapa === 'integracao') return <IntegracaoCard {...props} autorNome={autorNome} />
                  if (etapa === 'liberado') return <LiberadoCard {...props} />
                  return <AdmissaoCard {...props} />
                })}
              </div>
            )}
          </>
        )}
      </EtapaPanel>

      {selecionada && <RHAdmissaoModal adm={selecionada} onClose={() => setSelecionada(null)} />}
    </div>
  )
}

// ── Card da etapa Documentação: vaga + progresso dos docs por candidato ──────
function DocumentacaoCard({ adm, isDark, onClick }: { adm: RHAdmissao; isDark: boolean; onClick: () => void }) {
  const candidatos = adm.candidatos ?? []
  const ccTxt = adm.centro_custo ? `${adm.centro_custo.codigo} - ${adm.centro_custo.descricao}` : null
  const criadoPorSuperTEG = (adm.observacoes ?? '').startsWith('[Criado por SuperTEG]')
  return (
    // <div>, e não <button>: os itens de documento carregam <input type="file"> dentro.
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`w-full text-left rounded-2xl border p-4 transition-all group cursor-pointer ${
        isDark
          ? 'bg-white/[0.02] border-white/[0.06] hover:border-violet-400/40 hover:bg-violet-500/5'
          : 'bg-white border-slate-200 hover:border-violet-300 hover:shadow-md'
      }`}>
      {/* Dados da vaga */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {candidatos[0]?.nome || adm.nome_candidato || 'Candidato'}
            {adm.urgente && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Urgente</span>}
            {criadoPorSuperTEG && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">🦸 SuperTEG</span>}
          </p>
          <div className={`flex items-center gap-3 flex-wrap mt-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {(candidatos[0]?.cargo || adm.cargo_previsto) && <span className="flex items-center gap-1 font-semibold"><Briefcase size={11} /> {candidatos[0]?.cargo || adm.cargo_previsto}</span>}
            {adm.base && <span className="flex items-center gap-1"><Building2 size={11} /> {adm.base}</span>}
            {ccTxt && <span>{ccTxt}</span>}
            {adm.data_prevista_inicio && (
              <span className="flex items-center gap-1"><Calendar size={11} /> início {new Date(adm.data_prevista_inicio).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>
        <ChevR size={16} className={`shrink-0 mt-1 ${isDark ? 'text-slate-500' : 'text-slate-300'} group-hover:text-violet-400`} />
      </div>

      {/* Progresso de docs por candidato */}
      <div className="space-y-1.5">
        {candidatos.map(c => (
          <DocCandidatoProgress key={c.id} candidatoId={c.id} admissaoId={adm.id} nome={c.nome} isDark={isDark}
            temPesquisaHistorico={(c.anexos ?? []).some(a => a.tipo === 'pesquisa_historico')} />
        ))}
        {candidatos.length === 0 && (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum candidato.</p>
        )}
      </div>
    </div>
  )
}

function DocCandidatoProgress({ candidatoId, admissaoId, nome, isDark, temPesquisaHistorico }: {
  candidatoId: string; admissaoId: string; nome?: string; isDark: boolean; temPesquisaHistorico?: boolean
}) {
  const { perfil } = useAuth()
  const { data: docs = [], isLoading } = useMissoesDocsStatus(candidatoId)
  const { data: parecer } = useParecerQualificacao(candidatoId)
  const anexar = useAnexarDocMissao()
  const uploadAnexo = useUploadAnexoCandidato()
  const [subindo, setSubindo] = useState<string | null>(null)
  const [erroAnexo, setErroAnexo] = useState<string | null>(null)
  const total = docs.length
  const ok = docs.filter(d => d.status === 'concluida' || d.status === 'dispensada').length
  const completo = total > 0 && ok === total && !!temPesquisaHistorico

  return (
    <div className={`rounded-xl border px-3 py-2 ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-100 bg-slate-50/60'}`}>
      <div className="flex items-center gap-2 justify-end">
        {parecer && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            parecer.aprovado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
            title="Parecer de Qualificação do SuperTEG (detalhes no modal)">
            Qualificação: {parecer.aprovado ? 'Aprovado' : 'Reprovado'}
          </span>
        )}
        {isLoading ? (
          <Loader2 size={12} className="animate-spin text-slate-400" />
        ) : total === 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-500">
            <Smartphone size={10} /> Missão não enviada
          </span>
        ) : (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            completo ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
          }`}>
            {completo ? '✓ Documentação completa' : `${ok}/${total} documentos`}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap mt-1.5">
          {docs.map(d => {
            const rotulo = d.titulo.replace(/^Enviar /, '').replace(/ \(se aplicável\)$/, '')
            if (d.status === 'concluida') {
              return (
                <span key={d.missao_id} className="flex items-center gap-1 min-w-0">
                  <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                  <span className={`text-[10px] truncate ${isDark ? 'text-slate-200 font-semibold' : 'text-slate-700 font-semibold'}`}>{rotulo}</span>
                </span>
              )
            }
            const enviando = anexar.isPending && subindo === d.missao_id
            return (
              <label key={d.missao_id}
                title={`Anexar ${rotulo}`}
                onClick={e => e.stopPropagation()}
                className={`flex items-center gap-1 min-w-0 group/doc cursor-pointer rounded px-0.5 -mx-0.5 ${
                  isDark ? 'hover:bg-teal-500/10' : 'hover:bg-teal-50'}`}>
                {enviando
                  ? <Loader2 size={11} className="animate-spin text-teal-500 shrink-0" />
                  : d.status === 'dispensada'
                    ? <MinusCircle size={11} className={`shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    : <Circle size={11} className={`shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'} group-hover/doc:text-teal-500`} />}
                <span className={`text-[10px] truncate ${
                  d.status === 'dispensada'
                    ? (isDark ? 'text-slate-600 line-through' : 'text-slate-400 line-through')
                    : (isDark ? 'text-slate-500' : 'text-slate-400')
                } group-hover/doc:text-teal-600`}>
                  {rotulo}
                </span>
                <Upload size={9} className="shrink-0 text-teal-500 opacity-0 group-hover/doc:opacity-100 transition-opacity" />
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  disabled={anexar.isPending}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.currentTarget.value = ''
                    if (!file) return
                    setErroAnexo(null); setSubindo(d.missao_id)
                    anexar.mutate(
                      { missaoId: d.missao_id, admissaoId, candidatoId, docTipo: d.doc_tipo, file, autorId: perfil?.id },
                      { onError: err => setErroAnexo(err instanceof Error ? err.message : 'Falha ao anexar'), onSettled: () => setSubindo(null) },
                    )
                  }} />
              </label>
            )
          })}
          {/* Pesquisa Histórico — interno do RH (não vira missão do colaborador) */}
          {temPesquisaHistorico ? (
            <span className="flex items-center gap-1 min-w-0">
              <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
              <span className={`text-[10px] truncate ${isDark ? 'text-slate-200 font-semibold' : 'text-slate-700 font-semibold'}`}>
                Pesquisa Histórico 🔒
              </span>
            </span>
          ) : (
            <label title="Anexar Pesquisa Histórico"
              onClick={e => e.stopPropagation()}
              className={`flex items-center gap-1 min-w-0 group/doc cursor-pointer rounded px-0.5 -mx-0.5 ${
                isDark ? 'hover:bg-teal-500/10' : 'hover:bg-teal-50'}`}>
              {uploadAnexo.isPending
                ? <Loader2 size={11} className="animate-spin text-teal-500 shrink-0" />
                : <Circle size={11} className={`shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-300'} group-hover/doc:text-teal-500`} />}
              <span className={`text-[10px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'} group-hover/doc:text-teal-600`}>
                Pesquisa Histórico 🔒
              </span>
              <Upload size={9} className="shrink-0 text-teal-500 opacity-0 group-hover/doc:opacity-100 transition-opacity" />
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                disabled={uploadAnexo.isPending}
                onChange={e => {
                  const file = e.target.files?.[0]
                  e.currentTarget.value = ''
                  if (!file) return
                  setErroAnexo(null)
                  uploadAnexo.mutate(
                    { admissaoId, candidatoId, file, tipo: 'pesquisa_historico', autorId: perfil?.id },
                    { onError: err => setErroAnexo(err instanceof Error ? err.message : 'Falha ao anexar') },
                  )
                }} />
            </label>
          )}
        </div>
      )}
      {erroAnexo && <p className="text-[10px] text-red-500 font-semibold mt-1">{erroAnexo}</p>}
    </div>
  )
}

// ── Card de admissão na lista ─────────────────────────────────────────────────
function AdmissaoCard({ adm, isDark, onClick }: { adm: RHAdmissao; isDark: boolean; onClick: () => void }) {
  const candidatos = adm.candidatos ?? []
  const nCand = candidatos.length
  const nDocs = candidatos.reduce((s, c) => s + (c.anexos?.length ?? 0), 0)
  const titulo = nCand === 1
    ? (candidatos[0].nome || adm.nome_candidato || 'Candidato')
    : nCand > 1
      ? `${candidatos[0].nome || 'Candidato'} +${nCand - 1}`
      : (adm.nome_candidato || 'Solicitação de admissão')
  return (
    <div className="relative">
    <button onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 pr-16 transition-all group flex items-center gap-3 ${
        isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
      }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/[0.05]' : 'bg-slate-100'}`}>
        <UserPlus size={18} className="text-violet-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{titulo}</p>
          {nCand > 1 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">{nCand} CANDIDATOS</span>
          )}
          {adm.etapa === 'aprovacao' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AGUARDANDO APROVAÇÃO</span>
          )}
          {adm.urgente && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5"><AlertTriangle size={9} />URGENTE</span>
          )}
          {adm.status_aprovacao === 'rejeitado' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5"><XCircle size={9} />REJEITADO</span>
          )}
          {adm.status_aprovacao === 'esclarecimento' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5"><HelpCircle size={9} />ESCLARECER</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {adm.base && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{adm.base}</span>}
          {adm.centro_custo && <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{adm.centro_custo.codigo}</span>}
          <span className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><Paperclip size={9} />{nDocs} doc(s)</span>
        </div>
      </div>
      <ChevR size={14} className={`shrink-0 ${isDark ? 'text-slate-600 group-hover:text-violet-400' : 'text-slate-300 group-hover:text-violet-500'} transition-colors`} />
    </button>
      <ExcluirAdmissaoBtn admId={adm.id} nome={titulo} className="absolute top-1/2 -translate-y-1/2 right-9 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" />
    </div>
  )
}

// ── Visão lista (tabela) ──────────────────────────────────────────────────────
function AdmissaoLista({ itens, isDark, onSelect }: { itens: RHAdmissao[]; isDark: boolean; onSelect: (a: RHAdmissao) => void }) {
  const th = 'text-left px-3 py-2 font-semibold'
  return (
    <div className={`rounded-xl border overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className={isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'}>
            <th className={th}>Candidato(s)</th>
            <th className={th}>Base</th>
            <th className={th}>CC</th>
            <th className="text-center px-3 py-2 font-semibold">Docs</th>
            <th className={th}>Status</th>
            <th className={th}>Data</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {itens.map(a => {
            const cands = a.candidatos ?? []
            const nDocs = cands.reduce((s, c) => s + (c.anexos?.length ?? 0), 0)
            const nome = cands.length === 1 ? (cands[0].nome || '—') : cands.length > 1 ? `${cands[0].nome || 'Candidato'} +${cands.length - 1}` : (a.nome_candidato || '—')
            const status = admStatus(a)
            return (
              <tr key={a.id} onClick={() => onSelect(a)}
                className={`cursor-pointer transition-all ${isDark ? 'hover:bg-white/[0.03] border-t border-white/[0.04]' : 'hover:bg-slate-50 border-t border-slate-100'}`}>
                <td className={`px-3 py-2 font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {nome}{a.urgente && <span className="ml-1.5 text-[9px] font-bold text-orange-600">URGENTE</span>}
                </td>
                <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.base || '—'}</td>
                <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{a.centro_custo?.codigo || '—'}</td>
                <td className={`px-3 py-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{nDocs}</td>
                <td className="px-3 py-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status.cls}`}>{status.label}</span></td>
                <td className={`px-3 py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(a.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-2 py-2 text-right"><ExcluirAdmissaoBtn admId={a.id} nome={nome} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PlaceholderVazio({ etapa, isDark }: { etapa: typeof ETAPAS[number]; isDark: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-12 px-6 ${
      isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'
    }`}>
      <UserPlus size={30} className={isDark ? 'text-slate-600 mb-2' : 'text-slate-300 mb-2'} />
      <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nenhuma admissão em “{etapa.label}”</p>
    </div>
  )
}

function PlaceholderConstrucao({ etapa, isDark }: { etapa: typeof ETAPAS[number]; isDark: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed flex flex-col items-center justify-center text-center py-14 px-6 ${
      isDark ? 'border-white/[0.10] bg-white/[0.02]' : 'border-slate-300 bg-slate-50/60'
    }`}>
      <Construction size={34} className={isDark ? 'text-slate-600 mb-3' : 'text-slate-300 mb-3'} />
      <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        Conteúdo da etapa “{etapa.label}” em construção
      </p>
      <p className={`text-xs mt-1 max-w-md ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        A estrutura do fluxo está pronta. Os campos e ações desta etapa serão montados em seguida.
      </p>
    </div>
  )
}

// ── Painel da etapa (apenas o conteúdo; a aba ativa já indica a etapa) ──────────
function EtapaPanel({ isDark, children }: { etapa: typeof ETAPAS[number]; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
      {children}
    </div>
  )
}

// ── Rail de etapas (cópia fiel do PipelineRail do Financeiro) ──────────────────
function EtapaRail({
  isDark,
  etapa,
  setEtapa,
  counts,
}: {
  isDark: boolean
  etapa: EtapaAdmissao
  setEtapa: (e: EtapaAdmissao) => void
  counts: Record<EtapaAdmissao, number>
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false, startX: 0, startScrollLeft: 0,
  })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const updateScrollState = () => {
      const maxScroll = rail.scrollWidth - rail.clientWidth
      setCanScrollLeft(rail.scrollLeft > 8)
      setCanScrollRight(maxScroll - rail.scrollLeft > 8)
    }
    updateScrollState()
    rail.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(rail)
    Array.from(rail.children).forEach(child => resizeObserver.observe(child))
    return () => {
      rail.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [etapa])

  const scrollByOffset = (direction: 'left' | 'right') => {
    const rail = railRef.current
    if (!rail) return
    const offset = Math.max(rail.clientWidth * 0.72, 220)
    rail.scrollBy({ left: direction === 'left' ? -offset : offset, behavior: 'smooth' })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    const rail = railRef.current
    if (!rail) return
    dragRef.current = { active: true, startX: event.clientX, startScrollLeft: rail.scrollLeft }
    rail.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const rail = railRef.current
    if (!rail) return
    const delta = event.clientX - dragRef.current.startX
    rail.scrollLeft = dragRef.current.startScrollLeft - delta
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    dragRef.current.active = false
    if (rail.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId)
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    rail.scrollLeft += event.deltaY
  }

  const arrowBaseClass = isDark
    ? 'border-white/[0.08] bg-slate-950/80 text-slate-200 hover:bg-slate-900'
    : 'border-slate-200 bg-white/95 text-slate-600 hover:bg-slate-50'

  return (
    <div className={`relative min-w-0 rounded-2xl border p-1.5 ${
      isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'
    }`}>
      {canScrollLeft && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 left-1 z-10 w-16 rounded-l-[calc(1rem-2px)] ${
            isDark ? 'bg-gradient-to-r from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-r from-white via-white/85 to-transparent'
          }`} />
          <button type="button" aria-label="Rolar etapas para a esquerda" onClick={() => scrollByOffset('left')}
            className={`absolute left-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}>
            <ChevronLeft size={16} />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className={`pointer-events-none absolute inset-y-1 right-1 z-10 w-16 rounded-r-[calc(1rem-2px)] ${
            isDark ? 'bg-gradient-to-l from-[#0f172a] via-[#0f172a]/80 to-transparent' : 'bg-gradient-to-l from-white via-white/85 to-transparent'
          }`} />
          <button type="button" aria-label="Rolar etapas para a direita" onClick={() => scrollByOffset('right')}
            className={`absolute right-3 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all ${arrowBaseClass}`}>
            <ChevronRight size={16} />
          </button>
        </>
      )}

      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="min-w-0 overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing"
      >
        <div className="flex min-w-max items-stretch gap-1.5 pr-10 md:min-w-0 md:w-full md:pr-0">
          {ETAPAS.map(e => {
            const count = counts[e.key] || 0
            const isActive = etapa === e.key
            const Icon = e.icon
            const accent = isDark ? ACCENT_DARK[e.key] : ACCENT[e.key]
            return (
              <button
                key={e.key}
                onClick={() => setEtapa(e.key)}
                className={`flex min-h-[56px] min-w-fit items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-all shrink-0 md:flex-1 ${
                  isActive
                    ? `${accent.bgActive} ${accent.textActive} border font-bold shadow-sm ${accent.border}`
                    : `${accent.bg} ${accent.text} font-medium`
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {e.label}
                {count > 0 && (
                  <span className={`rounded-full min-w-[24px] h-[24px] px-1.5 flex items-center justify-center text-[10px] font-bold ${
                    isActive ? accent.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
