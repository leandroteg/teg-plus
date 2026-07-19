import { useState, useEffect, Fragment, type ReactNode } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ShieldCheck, GraduationCap, Siren, Plus, Pencil, Link2,
  Search, Loader2, FileDown, Paperclip, Trash2, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Circle, Upload, User,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  useIntegracaoTreinos, useTreinamentos as useAdmissaoTreinamentos, certTreinamentoUrl, useEtapaCandidato,
  type IntegracaoCand, type IntegracaoTreino,
} from '../../hooks/useRHAdmissaoFluxo'
import { TreinamentosBlock } from '../../components/rh/RHAdmissaoEtapas'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import {
  useRiscos, useSalvarRisco, useEpis, useSalvarEpi,
  useFichasEpi, useCriarFichaEpi, useArquivarFichaEpi, consultarCA,
  uploadEvidencia, evidenciaUrl, type ItemFichaEpi,
  useTreinamentos, useSalvarTreinamento, useOcorrencias, useSalvarOcorrencia,
  useAcoesQsma, useEnviarOcorrenciaSgi, useGerarRelatorio, useRelatorioStatus,
  useCatalogoTreinamentos, useMatrizTreinamentos, useSetMatrizCelula,
  useColaboradoresTreino, treinoStatus, cargoBase,
  useEpiEntregas, useMatrizEpi, useSetMatrizEpiCelula,
  useEstoqueEpi,
} from '../../hooks/useQsma'
import RHColaboradorDetalhe from '../rh/RHColaboradorDetalhe'
import { gerarFichaEpiPdf } from '../../utils/ficha-epi-pdf'
import { QsmaModal, ModalFooter, FotosUpload, fmtData } from '../../components/qsma/ModalBits'
import { QsmaToolbar, ToolbarSelect, ToolbarPills, BotaoNovo, QuickChips, MultiCheck, ToolbarDateRange } from '../../components/qsma/Toolbar'
import { Timer, FileSignature, List, LayoutGrid, LayoutList, Columns3, ExternalLink, Send, Sparkles, FileText } from 'lucide-react'
import { ObraPicker, ColaboradorPicker, VeiculoPicker, pickerInputCls, pickerLabelCls } from '../../components/qsma/Pickers'
import { useObrasComProjeto } from '../../hooks/useObras'
import { useBases } from '../../hooks/useEstoque'
import type {
  QsmaRisco, QsmaEpi, QsmaEpiFicha, QsmaTreinamento, QsmaOcorrencia,
  EscopoRisco, TipoOcorrencia, Gravidade, Envolvido, StatusOcorrencia, MotivoEntregaEpi,
} from '../../types/qsma'
import {
  nivelRisco, NORMAS_TREINAMENTO, TIPO_OCORRENCIA_LABEL, GRAVIDADE_LABEL, STATUS_OCORRENCIA_LABEL,
  STATUS_FICHA_EPI_LABEL,
} from '../../types/qsma'

const STEPS: FlowStep[] = [
  {
    key: 'ocorrencias', label: 'Ocorrências',
    description: 'Registro → investigação (causa raiz) → ações corretivas no SGI.',
    icon: Siren,
    accent: { bg: 'hover:bg-red-50', bgActive: 'bg-red-50', text: 'text-red-600', textActive: 'text-red-800', border: 'border-red-500', badge: 'bg-red-100 text-red-700' },
  },
  {
    key: 'treinamentos', label: 'Treinamentos',
    description: 'Matriz de NRs por colaborador com vencimentos e reciclagens.',
    icon: GraduationCap,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'epis', label: 'EPIs',
    description: 'Catálogo com CA e fichas de entrega assinadas via PortalTEG.',
    icon: ShieldCheck,
    accent: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
  },
  {
    key: 'riscos', label: 'Riscos (PGR/APR)',
    description: 'Inventário de riscos por GHE e análise preliminar por tarefa — matriz 5×5.',
    icon: AlertTriangle,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
]

const KANBAN: StatusOcorrencia[] = ['registro', 'investigacao', 'acao', 'encerrada']

export default function QsmaSeguranca() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { perfil } = useAuth()
  const isAdmin = perfil?.role === 'administrador'
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<string>(params.get('aba') ?? 'ocorrencias')
  const [modalRisco, setModalRisco] = useState<QsmaRisco | 'novo' | null>(null)
  const [modalEpi, setModalEpi] = useState<QsmaEpi | 'novo' | null>(null)
  const [modalFicha, setModalFicha] = useState(false)
  const [epiColab, setEpiColab] = useState<string | null>(null)
  const [subEpi, setSubEpi] = useState<'controle' | 'matriz' | 'epis'>('controle')
  const [modalTreinamento, setModalTreinamento] = useState<QsmaTreinamento | 'novo' | null>(null)
  const [modalOcorrencia, setModalOcorrencia] = useState<QsmaOcorrencia | 'novo' | null>(null)

  const novoParam = params.get('novo')
  useEffect(() => {
    if (!novoParam) return
    if (novoParam === 'ocorrencia') { setAba('ocorrencias'); setModalOcorrencia('novo') }
    if (novoParam === 'epi') { setAba('epis'); setSubEpi('controle'); setModalFicha(true) }
    if (novoParam === 'treinamento') { setAba('treinamentos'); setModalTreinamento('novo') }
    if (novoParam === 'risco') { setAba('riscos'); setModalRisco('novo') }
    setParams({}, { replace: true })
  }, [novoParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: riscos = [] } = useRiscos()
  const { data: epis = [] } = useEpis()
  const { data: fichas = [] } = useFichasEpi()
  const arquivarFicha = useArquivarFichaEpi()
  const { data: treinamentos = [] } = useTreinamentos()
  const { data: ocorrencias = [] } = useOcorrencias()
  const { data: acoes = [] } = useAcoesQsma()
  const { data: obras = [] } = useObrasComProjeto()
  const obraNome = (id?: string) => obras.find(o => o.id === id)?.nome ?? '—'
  // data no formato da planilha/pastas do OneDrive: DD.MM.AAAA
  const fmtDataPlanilha = (d?: string) => d
    ? new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
    : '—'

  // Deep-link vindo do Painel: abre a ocorrência / treinamento pelo id
  const ocoParam = params.get('ocorrencia')
  useEffect(() => {
    if (!ocoParam || !ocorrencias.length) return
    const o = ocorrencias.find(x => x.id === ocoParam)
    if (o) { setAba('ocorrencias'); setModalOcorrencia(o); setParams({}, { replace: true }) }
  }, [ocoParam, ocorrencias]) // eslint-disable-line react-hooks/exhaustive-deps

  const treParam = params.get('treinamento')
  useEffect(() => {
    if (!treParam || !treinamentos.length) return
    const t = treinamentos.find(x => x.id === treParam)
    if (t) { setAba('treinamentos'); setModalTreinamento(t); setParams({}, { replace: true }) }
  }, [treParam, treinamentos]) // eslint-disable-line react-hooks/exhaustive-deps

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const hoje = new Date().toISOString().split('T')[0]

  // filtros compactos na primeira linha (padrão do sistema)
  const [busca, setBusca] = useState('')
  const [escopoF, setEscopoF] = useState('todos')
  const [normaF, setNormaF] = useState('')
  const [exTipoOco, setExTipoOco] = useState<Set<string>>(new Set())
  const [exGravOco, setExGravOco] = useState<Set<string>>(new Set())
  const [exObraOco, setExObraOco] = useState<Set<string>>(new Set())
  const [exStatusOco, setExStatusOco] = useState<Set<string>>(new Set())
  const [dataDeOco, setDataDeOco] = useState('')
  const [dataAteOco, setDataAteOco] = useState('')
  const [quickTre, setQuickTre] = useState('todos')
  const [subTreino, setSubTreino] = useState<'integracao' | 'controle' | 'matriz'>('controle')
  const [treinoColab, setTreinoColab] = useState<string | null>(null)
  const [quickFicha, setQuickFicha] = useState('todos')
  const [vistaOco, setVistaOco] = useState<'lista' | 'cards' | 'kanban'>('cards')
  const q = busca.trim().toLowerCase()
  const lim60 = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]

  const riscosF = riscos.filter(r =>
    (escopoF === 'todos' || r.escopo === escopoF)
    && (!q || r.perigo.toLowerCase().includes(q) || r.risco.toLowerCase().includes(q) || (r.tarefa ?? '').toLowerCase().includes(q) || (r.ghe ?? '').toLowerCase().includes(q))
  )
  const fichasF = fichas.filter(f =>
    (quickFicha === 'todos' || (quickFicha === 'aguardando' && f.status === 'aguardando_assinatura'))
    && (!q || (f.colaborador_nome ?? '').toLowerCase().includes(q) || (f.codigo ?? '').toLowerCase().includes(q)
      || (f.itens ?? []).some(it => (it.epi?.nome ?? '').toLowerCase().includes(q)))
  )
  const treinamentosF = treinamentos.filter(t =>
    (!normaF || t.norma === normaF)
    && (quickTre === 'todos'
      || (quickTre === 'vencido' && !!t.vencimento && t.vencimento < hoje)
      || (quickTre === 'vencendo' && !!t.vencimento && t.vencimento >= hoje && t.vencimento <= lim60))
    && (!q || (t.colaborador_nome ?? '').toLowerCase().includes(q) || (t.curso ?? '').toLowerCase().includes(q))
  )
  const obrasComOcorrencia = [...new Map(
    ocorrencias.filter(o => o.obra_id).map(o => [o.obra_id!, obraNome(o.obra_id)])
  ).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const ocorrenciasF = ocorrencias.filter(o =>
    !exTipoOco.has(o.tipo)
    && !exGravOco.has(o.gravidade)
    && !exObraOco.has(o.obra_id ?? '')
    && !exStatusOco.has(o.status)
    && (!dataDeOco || o.data_ocorrencia.slice(0, 10) >= dataDeOco)
    && (!dataAteOco || o.data_ocorrencia.slice(0, 10) <= dataAteOco)
    && (!q || o.descricao.toLowerCase().includes(q) || (o.codigo ?? '').toLowerCase().includes(q) || obraNome(o.obra_id).toLowerCase().includes(q))
  )

  return (
    <ControladoriaFlow
      title="Gestão SST"
      subtitle="Prevenir (riscos) → equipar (EPIs) → capacitar (treinamentos) → tratar (ocorrências)"
      steps={STEPS}
      activeStep={aba}
      onStepChange={setAba}
    >
      {/* ── Riscos ── */}
      {aba === 'riscos' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${riscosF.length} risco${riscosF.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar perigo, risco, tarefa…"
            acoes={<BotaoNovo label="Novo Risco / APR" onClick={() => setModalRisco('novo')} />}
          >
            <ToolbarPills
              isDark={isDark} value={escopoF} onChange={setEscopoF}
              options={[{ value: 'todos', label: 'Todos' }, { value: 'pgr', label: 'PGR' }, { value: 'apr', label: 'APR' }]}
            />
          </QsmaToolbar>
          {riscosF.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum risco cadastrado — comece pelo inventário PGR ou uma APR" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {riscosF.map(r => {
                const nv = nivelRisco(r.probabilidade, r.severidade)
                return (
                  <button key={r.id} onClick={() => setModalRisco(r)} className={`text-left ${card} p-4 hover:shadow-md transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-mono font-bold ${txtMuted}`}>{r.codigo} · {r.escopo.toUpperCase()}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: nv.cor }}>
                        {nv.label} ({nv.valor})
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${txtMain}`}>{r.perigo}</p>
                    <p className={`text-[11px] ${txtMuted}`}>{r.risco}</p>
                    <p className={`text-[10px] mt-1 ${txtMuted}`}>{[r.tarefa, r.ghe, r.obra_id ? obraNome(r.obra_id) : null].filter(Boolean).join(' · ')}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EPIs ── */}
      {aba === 'epis' && (() => {
        // Toggle das sub-visões — mesmo padrão dos Treinamentos (Controle | Matriz | Fichas)
        const subTabsEpi = (
          <div className={`inline-flex p-1 rounded-xl shrink-0 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
            {([['controle', 'Controle'], ['matriz', 'Matriz'], ['epis', 'EPIs']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setSubEpi(k)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  subEpi === k
                    ? isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-white text-sky-700 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}>{lbl}</button>
            ))}
          </div>
        )
        if (subEpi === 'matriz') return <MatrizEpis subTabs={subTabsEpi} isDark={isDark} txtMain={txtMain} txtMuted={txtMuted} isAdmin={isAdmin} />
        if (subEpi === 'controle') return (
          epiColab
            ? <RHColaboradorDetalhe id={epiColab} onBack={() => setEpiColab(null)} soTreinamentos mostrarEpi />
            : <ControleEpis subTabs={subTabsEpi} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted}
                onSelect={setEpiColab} />
        )
        return (
          <ListaEpis subTabs={subTabsEpi} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted}
            onNovoEpi={() => setModalEpi('novo')} onEditEpi={e => setModalEpi(e)} />
        )
      })()}

      {/* ── Treinamentos ── */}
      {aba === 'treinamentos' && (() => {
        // Toggle das sub-abas (Controle à esquerda, Matriz à direita) — renderizado
        // dentro da linha de filtros de cada sub-aba (subimos tudo p/ a mesma linha).
        const subTabsToggle = (
          <div className={`inline-flex p-1 rounded-xl shrink-0 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
            {([['integracao', 'Integração'], ['controle', 'Controle'], ['matriz', 'Matriz']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setSubTreino(k)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  subTreino === k
                    ? isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-white text-sky-700 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}>{lbl}</button>
            ))}
          </div>
        )
        return (
          <div className="space-y-3">
            {subTreino === 'integracao' && <IntegracaoTreinamentos subTabs={subTabsToggle} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted} />}

            {subTreino === 'matriz' && <MatrizTreinamentos subTabs={subTabsToggle} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted} isAdmin={isAdmin} />}

            {subTreino === 'controle' && (
              treinoColab
                ? <RHColaboradorDetalhe id={treinoColab} onBack={() => setTreinoColab(null)} soTreinamentos />
                : <ControleTreinamentos subTabs={subTabsToggle} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted}
                    onSelect={setTreinoColab} />
            )}
          </div>
        )
      })()}

      {/* ── Ocorrências (kanban) ── */}
      {aba === 'ocorrencias' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${ocorrenciasF.length} ocorrência${ocorrenciasF.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar ocorrência, código ou obra…"
          >
            <MultiCheck
              isDark={isDark} label="Tipo" excluded={exTipoOco} setExcluded={setExTipoOco}
              options={(Object.keys(TIPO_OCORRENCIA_LABEL) as TipoOcorrencia[]).map(t => ({ value: t, label: TIPO_OCORRENCIA_LABEL[t] }))}
            />
            <MultiCheck
              isDark={isDark} label="Gravidade" excluded={exGravOco} setExcluded={setExGravOco}
              options={(Object.keys(GRAVIDADE_LABEL) as Gravidade[]).map(g => ({ value: g, label: GRAVIDADE_LABEL[g].label }))}
            />
            <MultiCheck
              isDark={isDark} label="Obra" excluded={exObraOco} setExcluded={setExObraOco}
              options={obrasComOcorrencia}
            />
            <MultiCheck
              isDark={isDark} label="Status" excluded={exStatusOco} setExcluded={setExStatusOco}
              options={(Object.keys(STATUS_OCORRENCIA_LABEL) as StatusOcorrencia[]).map(s => ({ value: s, label: STATUS_OCORRENCIA_LABEL[s].label }))}
            />
            <ToolbarDateRange isDark={isDark} de={dataDeOco} ate={dataAteOco} onDe={setDataDeOco} onAte={setDataAteOco} />
            {/* toggle Lista/Cards/Quadro (só acompanhamento — o tratamento é no Gestão) */}
            <div className={`inline-flex rounded-xl border overflow-hidden shrink-0 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
              {([['lista', LayoutList, 'Lista'], ['cards', LayoutGrid, 'Cards'], ['kanban', Columns3, 'Quadro por etapa']] as const).map(([v, Icon, tt]) => (
                <button key={v} onClick={() => setVistaOco(v)} title={tt}
                  className={`px-2.5 py-2 transition-all ${vistaOco === v
                    ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700'
                    : isDark ? 'bg-transparent text-slate-400 hover:bg-white/[0.05]' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </QsmaToolbar>

          {/* Vista Lista (compacta — linhas) */}
          {vistaOco === 'lista' && (
            ocorrenciasF.length === 0 ? (
              <Vazio isDark={isDark} texto="Nenhuma ocorrência registrada" />
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
                {ocorrenciasF.map((o, i) => {
                  const g = GRAVIDADE_LABEL[o.gravidade]
                  const st = STATUS_OCORRENCIA_LABEL[o.status]
                  const nAcoes = acoes.filter(a => a.origem_id === o.id).length
                  return (
                    <button key={o.id} onClick={() => setModalOcorrencia(o)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors ${i > 0 ? (isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100') : ''} ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                      <span className={`font-mono text-[10px] shrink-0 w-16 ${txtMuted}`}>{o.codigo}</span>
                      <span className={`text-[11px] shrink-0 w-20 tabular-nums ${txtMuted}`}>{fmtDataPlanilha(o.data_ocorrencia)}</span>
                      <span className={`text-[12px] font-semibold truncate flex-1 min-w-0 ${txtMain}`}>{obraNome(o.obra_id)} · <span className="font-normal">{o.descricao}</span></span>
                      {nAcoes > 0 && <span className="inline-flex items-center gap-0.5 shrink-0 text-[10px] text-violet-400"><Link2 size={11} />{nAcoes}</span>}
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${isDark ? g.dark : g.light}`}>{g.label}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${isDark ? st.dark : st.light}`}>{st.label}</span>
                      {o.sgi_registro_id && (
                        <span className={`inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'}`} title="Em tratamento no módulo Gestão (SGI)">
                          <ExternalLink size={11} /> Gestão
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          )}

          {/* Vista Cards */}
          {vistaOco === 'cards' && (
            ocorrenciasF.length === 0 ? (
              <Vazio isDark={isDark} texto="Nenhuma ocorrência registrada" />
            ) : (
              <div className="space-y-2">
                {ocorrenciasF.map(o => {
                  const g = GRAVIDADE_LABEL[o.gravidade]
                  const st = STATUS_OCORRENCIA_LABEL[o.status]
                  const nAcoes = acoes.filter(a => a.origem_id === o.id).length
                  return (
                    <button key={o.id} onClick={() => setModalOcorrencia(o)} className={`w-full text-left ${card} p-3.5 flex items-center gap-3 flex-wrap hover:shadow-md transition-all`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${txtMain} flex items-center gap-2 flex-wrap`}>
                          <span className={`font-mono text-[10px] ${txtMuted}`}>{o.codigo}</span>
                          <span>{fmtDataPlanilha(o.data_ocorrencia)} · {obraNome(o.obra_id)}</span>
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isDark ? g.dark : g.light}`}>{g.label}</span>
                        </p>
                        <p className={`text-[11px] truncate ${txtMuted}`}>
                          {TIPO_OCORRENCIA_LABEL[o.tipo]} · {o.descricao}
                          {nAcoes > 0 && <span className="inline-flex items-center gap-0.5 ml-1 text-violet-400"><Link2 size={9} />{nAcoes} ação(ões)</span>}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${isDark ? st.dark : st.light}`}>{st.label}</span>
                      {o.sgi_registro_id && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${isDark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-50 text-violet-700'}`} title="Em tratamento no módulo Gestão (SGI)">
                          <ExternalLink size={11} /> Gestão
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          )}

          {/* Vista Kanban (acompanhamento por etapa) */}
          {vistaOco === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {KANBAN.map(st => {
                const cfg = STATUS_OCORRENCIA_LABEL[st]
                const itens = ocorrenciasF.filter(o => o.status === st)
                return (
                  <div key={st} className={`rounded-2xl border p-3 ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50/60 border-slate-200'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${txtMuted}`}>
                      {cfg.label} <span className="font-mono">({itens.length})</span>
                    </p>
                    <div className="space-y-2">
                      {itens.map(o => {
                        const g = GRAVIDADE_LABEL[o.gravidade]
                        const nAcoes = acoes.filter(a => a.origem_id === o.id).length
                        return (
                          <button key={o.id} onClick={() => setModalOcorrencia(o)} className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                            isDark ? 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]' : 'bg-white border-slate-200 hover:shadow-md'
                          }`}>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[9px] font-mono font-bold ${txtMuted}`}>{o.codigo}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? g.dark : g.light}`}>{g.label}</span>
                            </div>
                            <p className={`text-[11px] font-semibold leading-tight ${txtMain}`}>{fmtDataPlanilha(o.data_ocorrencia)} · {obraNome(o.obra_id)}</p>
                            <p className={`text-[10px] mt-0.5 line-clamp-2 ${txtMuted}`}>{o.descricao}</p>
                            <p className={`text-[9px] mt-1 ${txtMuted}`}>
                              {TIPO_OCORRENCIA_LABEL[o.tipo]}
                              {nAcoes > 0 && <span className="inline-flex items-center gap-0.5 ml-1 text-violet-400"><Link2 size={8} />{nAcoes} ação(ões)</span>}
                            </p>
                          </button>
                        )
                      })}
                      {itens.length === 0 && <p className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modais ── */}
      {modalRisco && <RiscoModal isDark={isDark} risco={modalRisco === 'novo' ? null : modalRisco} onClose={() => setModalRisco(null)} />}
      {modalEpi && <EpiCatalogoModal isDark={isDark} epi={modalEpi === 'novo' ? null : modalEpi} onClose={() => setModalEpi(null)} />}
      {modalFicha && <FichaEpiModal isDark={isDark} epis={epis.filter(e => e.ativo)} onClose={() => setModalFicha(false)} />}
      {modalTreinamento && <TreinamentoModal isDark={isDark} treinamento={modalTreinamento === 'novo' ? null : modalTreinamento} onClose={() => setModalTreinamento(null)} />}
      {modalOcorrencia && <OcorrenciaModal isDark={isDark} ocorrencia={modalOcorrencia === 'novo' ? null : modalOcorrencia} onClose={() => setModalOcorrencia(null)} />}
    </ControladoriaFlow>
  )
}

function Vazio({ isDark, texto }: { isDark: boolean; texto: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
      <ShieldCheck size={36} className="mb-2" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

// ── Modal: Risco (PGR/APR) — matriz 5×5 ao vivo ─────────────────────────────

function RiscoModal({ isDark, risco, onClose }: { isDark: boolean; risco: QsmaRisco | null; onClose: () => void }) {
  const salvar = useSalvarRisco()
  const [escopo, setEscopo] = useState<EscopoRisco>(risco?.escopo ?? 'apr')
  const [obraId, setObraId] = useState(risco?.obra_id ?? '')
  const [ghe, setGhe] = useState(risco?.ghe ?? '')
  const [tarefa, setTarefa] = useState(risco?.tarefa ?? '')
  const [perigo, setPerigo] = useState(risco?.perigo ?? '')
  const [riscoTxt, setRiscoTxt] = useState(risco?.risco ?? '')
  const [prob, setProb] = useState(risco?.probabilidade ?? 3)
  const [sev, setSev] = useState(risco?.severidade ?? 3)
  const [controles, setControles] = useState(risco?.controles ?? '')
  const [episReq, setEpisReq] = useState(risco?.epis_requeridos ?? '')
  const [status, setStatus] = useState(risco?.status ?? 'ativo')

  const nv = nivelRisco(prob, sev)
  const erros: string[] = []
  if (!perigo.trim()) erros.push('informe o perigo')
  if (!riscoTxt.trim()) erros.push('informe o risco')
  if (escopo === 'apr' && !tarefa.trim()) erros.push('APR precisa da tarefa')

  return (
    <QsmaModal isDark={isDark} wide titulo={risco ? `Editar ${risco.codigo}` : 'Novo risco'} subtitulo="PGR (inventário por GHE) ou APR (análise por tarefa)" onClose={onClose}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Escopo</label>
          <select value={escopo} onChange={e => setEscopo(e.target.value as EscopoRisco)} className={pickerInputCls(isDark)}>
            <option value="apr">APR — por tarefa</option>
            <option value="pgr">PGR — inventário</option>
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>GHE</label>
          <input value={ghe} onChange={e => setGhe(e.target.value)} placeholder="Ex.: Eletricistas LV" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as never)} className={pickerInputCls(isDark)}>
            <option value="ativo">Ativo</option>
            <option value="mitigado">Mitigado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
      </div>
      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} />
      {escopo === 'apr' && (
        <div>
          <label className={pickerLabelCls(isDark)}>Tarefa *</label>
          <input value={tarefa} onChange={e => setTarefa(e.target.value)} placeholder="Ex.: Içamento de estrutura com guindauto" className={pickerInputCls(isDark)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Perigo *</label>
          <input value={perigo} onChange={e => setPerigo(e.target.value)} placeholder="Ex.: Trabalho próximo a rede energizada" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Risco *</label>
          <input value={riscoTxt} onChange={e => setRiscoTxt(e.target.value)} placeholder="Ex.: Choque elétrico / arco voltaico" className={pickerInputCls(isDark)} />
        </div>
      </div>

      {/* Matriz 5×5 ao vivo */}
      <div className={`rounded-xl border p-3 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <div className="grid grid-cols-2 gap-3">
          {[['Probabilidade', prob, setProb], ['Severidade', sev, setSev]].map(([label, val, set]: any) => (
            <div key={label}>
              <label className={pickerLabelCls(isDark)}>{label}: <b>{val}</b></label>
              <input type="range" min={1} max={5} value={val} onChange={e => set(Number(e.target.value))} className="w-full accent-red-600" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nível de risco:</span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: nv.cor }}>
            {nv.label} · {nv.valor}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Medidas de controle</label>
          <textarea value={controles} onChange={e => setControles(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>EPIs requeridos</label>
          <textarea value={episReq} onChange={e => setEpisReq(e.target.value)} rows={2} placeholder="Ex.: Luva isolante classe 2, capacete classe B…" className={pickerInputCls(isDark)} />
        </div>
      </div>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        salvando={salvar.isPending}
        onCancel={onClose}
        onSave={() => salvar.mutate(
          {
            id: risco?.id, escopo, obra_id: obraId || undefined, ghe: ghe || undefined, tarefa: tarefa || undefined,
            perigo: perigo.trim(), risco: riscoTxt.trim(), probabilidade: prob, severidade: sev,
            controles: controles || undefined, epis_requeridos: episReq || undefined, status: status as never,
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: EPI no catálogo (com busca na base oficial de CAs) ────────────────

function EpiCatalogoModal({ isDark, epi, onClose }: { isDark: boolean; epi: QsmaEpi | null; onClose: () => void }) {
  const salvar = useSalvarEpi()
  const [nome, setNome] = useState(epi?.nome ?? '')
  const [ca, setCa] = useState(epi?.ca ?? '')
  const [validadeCa, setValidadeCa] = useState(epi?.validade_ca ?? '')
  const [fabricante, setFabricante] = useState(epi?.fabricante ?? '')
  const [especificacoes, setEspecificacoes] = useState(epi?.especificacoes ?? '')
  const [vidaUtil, setVidaUtil] = useState<string>(epi?.vida_util_dias?.toString() ?? '')
  const [possuiDevolucao, setPossuiDevolucao] = useState(epi?.possui_devolucao ?? false)
  const [tamanhoPorFunc, setTamanhoPorFunc] = useState(epi?.tamanho_por_funcionario ?? false)
  const [ativo, setAtivo] = useState(epi?.ativo ?? true)
  const [buscandoCa, setBuscandoCa] = useState(false)
  const [caMsg, setCaMsg] = useState<string | null>(null)

  // Busca na base oficial espelhada (qsma_caepi) e preenche tudo — padrão SOC
  async function buscarCA() {
    if (!ca.trim()) return
    setBuscandoCa(true)
    setCaMsg(null)
    try {
      const r = await consultarCA(ca)
      if (!r) {
        setCaMsg('CA não encontrado na base local — confira o número ou preencha manualmente')
        return
      }
      if (r.equipamento && !nome.trim()) setNome(r.equipamento)
      else if (r.equipamento) setNome(r.equipamento)
      if (r.fabricante) setFabricante(r.fabricante)
      if (r.validade) setValidadeCa(r.validade)
      if (r.descricao) setEspecificacoes(r.descricao)
      setCaMsg(`✓ ${r.equipamento ?? 'EPI'} — ${r.fabricante ?? ''} (validade CA ${r.validade ? new Date(r.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'})`)
    } catch (err: any) {
      setCaMsg(`Erro na consulta: ${err?.message ?? 'desconhecido'}`)
    } finally {
      setBuscandoCa(false)
    }
  }

  const erros: string[] = []
  if (!nome.trim()) erros.push('informe o nome (ou busque pelo CA)')
  const avisos: string[] = []
  if (!ca.trim()) avisos.push('EPI sem CA — verifique se é isento')
  if (validadeCa && validadeCa < new Date().toISOString().split('T')[0]) avisos.push('CA vencido')

  return (
    <QsmaModal isDark={isDark} titulo={epi ? 'Editar EPI' : 'Novo EPI no catálogo'} subtitulo="Digite o nº do CA e busque — nome, fabricante e validade vêm da base oficial do MTE" onClose={onClose}>
      {/* Busca por CA */}
      <div className={`rounded-xl border p-3 ${isDark ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-red-200 bg-red-50/40'}`}>
        <label className={pickerLabelCls(isDark)}>Nº do CA</label>
        <div className="flex gap-2">
          <input
            value={ca}
            onChange={e => setCa(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') buscarCA() }}
            placeholder="Ex.: 31469"
            className={`${pickerInputCls(isDark)} flex-1`}
          />
          <button
            onClick={buscarCA}
            disabled={buscandoCa || !ca.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {buscandoCa ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
            Buscar CA
          </button>
        </div>
        {caMsg && (
          <p className={`mt-1.5 text-[10px] font-medium ${caMsg.startsWith('✓') ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : 'text-amber-500'}`}>
            {caMsg}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Luva isolante classe 2" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Validade do CA</label>
          <input type="date" value={validadeCa} onChange={e => setValidadeCa(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Fabricante</label>
          <input value={fabricante} onChange={e => setFabricante(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Vida útil / reposição (dias)</label>
          <input type="number" value={vidaUtil} onChange={e => setVidaUtil(e.target.value)} placeholder="Ex.: 180" className={pickerInputCls(isDark)} />
        </div>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Especificações</label>
        <textarea value={especificacoes} onChange={e => setEspecificacoes(e.target.value)} rows={2} placeholder="Descrição técnica (vem da base do CA)" className={pickerInputCls(isDark)} />
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={possuiDevolucao} onChange={e => setPossuiDevolucao(e.target.checked)} className="accent-red-600" />
          Possui devolução
        </label>
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={tamanhoPorFunc} onChange={e => setTamanhoPorFunc(e.target.checked)} className="accent-red-600" />
          Tamanho por funcionário
        </label>
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="accent-red-600" />
          Ativo no catálogo
        </label>
      </div>
      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          {
            id: epi?.id, nome: nome.trim(), ca: ca || undefined, validade_ca: validadeCa || undefined,
            fabricante: fabricante || undefined, especificacoes: especificacoes || undefined,
            vida_util_dias: vidaUtil ? Number(vidaUtil) : undefined,
            possui_devolucao: possuiDevolucao, tamanho_por_funcionario: tamanhoPorFunc, ativo,
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: Ficha de Entrega de EPI (multi-item, padrão SOC/NR-06) ────────────

// Sugere o tamanho do colaborador conforme o tipo de EPI (roupa × calçado)
function tamanhoSugerido(epi: QsmaEpi | undefined, c?: { tamanho_camisa?: string; tamanho_calca?: string; tamanho_calcado?: string }): string {
  if (!epi || !c) return ''
  const n = epi.nome.toLowerCase()
  if (/cal[çc]a|bermuda/.test(n)) return c.tamanho_calca ?? ''
  if (/botina|bota|cal[çc]ado|perneira|sapat/.test(n)) return c.tamanho_calcado ?? ''
  if (/camisa|blus|jaqueta|colete|balaclava|anti-?chama|macac/.test(n)) return c.tamanho_camisa ?? ''
  return ''
}

function FichaEpiModal({ isDark, epis, onClose }: { isDark: boolean; epis: QsmaEpi[]; onClose: () => void }) {
  const criar = useCriarFichaEpi()
  const { data: matriz = [] } = useMatrizEpi()
  const { data: bases = [] } = useBases()
  const { perfil } = useAuth()
  const [cargoSel, setCargoSel] = useState('')
  const hoje = new Date().toISOString().split('T')[0]
  const [colabId, setColabId] = useState('')
  const [colabNome, setColabNome] = useState('')
  const [baseId, setBaseId] = useState('')
  const [dataEntrega, setDataEntrega] = useState(hoje)
  const [motivo, setMotivo] = useState<MotivoEntregaEpi>('entrega')
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState<{ epi_id: string; quantidade: string; tamanho: string }[]>([
    { epi_id: '', quantidade: '1', tamanho: '' },
  ])
  const [gerarPdfAoSalvar, setGerarPdfAoSalvar] = useState(true)

  const trocaPrevista = (epiId: string): string | undefined => {
    const epi = epis.find(e => e.id === epiId)
    if (!epi?.vida_util_dias) return undefined
    const d = new Date(dataEntrega + 'T12:00:00')
    d.setDate(d.getDate() + epi.vida_util_dias)
    return d.toISOString().split('T')[0]
  }

  const itensValidos = itens.filter(it => it.epi_id && Number(it.quantidade) > 0)
  const erros: string[] = []
  if (!colabId) erros.push('selecione o colaborador')
  if (itensValidos.length === 0) erros.push('adicione ao menos 1 EPI')
  const avisos: string[] = []
  for (const it of itensValidos) {
    const epi = epis.find(e => e.id === it.epi_id)
    if (epi?.validade_ca && epi.validade_ca < hoje) avisos.push(`CA ${epi.ca} (${epi.nome}) VENCIDO`)
    if (epi?.tamanho_por_funcionario && !it.tamanho.trim()) avisos.push(`${epi.nome}: informe o tamanho`)
  }

  async function salvar() {
    try {
      const payload = {
        colaborador_id: colabId,
        colaborador_nome: colabNome,
        base_id: baseId || undefined,
        data_entrega: dataEntrega,
        motivo,
        observacoes: obs || undefined,
        entregue_por_nome: perfil?.nome,
        itens: itensValidos.map(it => ({
          epi_id: it.epi_id,
          quantidade: Number(it.quantidade),
          tamanho: it.tamanho || undefined,
          data_troca_prevista: trocaPrevista(it.epi_id),
        })) as ItemFichaEpi[],
      }
      const r = await criar.mutateAsync(payload)
      if (gerarPdfAoSalvar) {
        await gerarFichaEpiPdf({
          codigo: r.codigo,
          colaboradorNome: colabNome,
          baseNome: bases.find(b => b.id === baseId)?.nome,
          dataEntrega,
          motivo,
          observacoes: obs || undefined,
          entreguePorNome: perfil?.nome,
          itens: itensValidos.map(it => {
            const epi = epis.find(e => e.id === it.epi_id)
            return {
              nome: epi?.nome ?? 'EPI',
              ca: epi?.ca,
              quantidade: Number(it.quantidade),
              tamanho: it.tamanho || undefined,
              trocaPrevista: trocaPrevista(it.epi_id),
            }
          }),
        })
      }
      onClose()
    } catch (err: any) {
      alert(`Erro ao criar ficha: ${err?.message ?? 'desconhecido'}`)
    }
  }

  return (
    <QsmaModal isDark={isDark} wide titulo="Nova ficha de entrega de EPI" subtitulo="1 ficha carrega vários EPIs — gere o PDF, colha a assinatura e arquive" onClose={onClose}>
      <ColaboradorPicker isDark={isDark} value={colabId} onChange={(id, c) => {
        setColabId(id); setColabNome(c?.nome ?? ''); setCargoSel(c?.cargo ?? '')
        if ((c as { base_id?: string })?.base_id) setBaseId((c as { base_id?: string }).base_id!)
        // Auto-carrega o kit do cargo pela matriz de EPI (com tamanho da pessoa)
        const kit = matriz
          .filter(m => m.exigencia === 'obrigatorio' && cargoBase(m.cargo) === cargoBase(c?.cargo))
          .map(m => ({ epi_id: m.epi_id, quantidade: String(m.quantidade), tamanho: tamanhoSugerido(epis.find(e => e.id === m.epi_id), c) }))
        setItens(kit.length ? kit : [{ epi_id: '', quantidade: '1', tamanho: '' }])
      }} required />
      {colabId && (
        <p className={`-mt-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {cargoSel || '—'} · {itens.filter(it => it.epi_id).length > 0
            ? `kit do cargo carregado (${itens.filter(it => it.epi_id).length} EPIs) — ajuste se precisar`
            : 'sem matriz de EPI para este cargo — adicione os itens manualmente'}
        </p>
      )}
      <div>
        <label className={pickerLabelCls(isDark)}>Base</label>
        <select value={baseId} onChange={e => setBaseId(e.target.value)} className={pickerInputCls(isDark)}>
          <option value="">Selecione a base…</option>
          {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Data da entrega</label>
          <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Motivo</label>
          <select value={motivo} onChange={e => setMotivo(e.target.value as MotivoEntregaEpi)} className={pickerInputCls(isDark)}>
            <option value="entrega">Entrega</option>
            <option value="troca">Troca</option>
            <option value="devolucao">Devolução</option>
          </select>
        </div>
      </div>

      {/* Itens da ficha */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>EPIs da ficha ({itensValidos.length})</span>
          <button
            onClick={() => setItens(prev => [...prev, { epi_id: '', quantidade: '1', tamanho: '' }])}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plus size={10} /> EPI
          </button>
        </div>
        {itens.map((it, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_56px_64px_auto] items-center gap-1.5">
            <select
              value={it.epi_id}
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, epi_id: e.target.value } : x))}
              className={pickerInputCls(isDark)}
            >
              <option value="">Selecione o EPI…</option>
              {epis.map(e => <option key={e.id} value={e.id}>{e.nome}{e.ca ? ` · CA ${e.ca}` : ''}</option>)}
            </select>
            <input
              type="number" min={1} value={it.quantidade} title="Quantidade"
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, quantidade: e.target.value } : x))}
              className={pickerInputCls(isDark)}
            />
            <input
              value={it.tamanho} placeholder="Tam." title="Tamanho"
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, tamanho: e.target.value } : x))}
              className={pickerInputCls(isDark)}
            />
            <button
              onClick={() => setItens(prev => prev.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-500 p-1"
              title="Remover EPI"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className={pickerLabelCls(isDark)}>Observações</label>
        <input value={obs} onChange={e => setObs(e.target.value)} className={pickerInputCls(isDark)} />
      </div>

      <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        <input type="checkbox" checked={gerarPdfAoSalvar} onChange={e => setGerarPdfAoSalvar(e.target.checked)} className="accent-red-600" />
        Gerar a ficha em PDF ao salvar (para colher a assinatura)
      </label>

      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos} salvando={criar.isPending}
        onCancel={onClose} saveLabel="Criar ficha" onSave={salvar}
      />
    </QsmaModal>
  )
}

// rótulo curto e legível por treinamento (o header mostrava "Anexo 1/2/3/4", críptico)
const TREINO_ABREV: Record<string, string> = {
  ASO: 'ASO', NR01: 'NR-01', NR06: 'NR-06', NR10B: 'NR-10', NR10SEP: 'NR-10 SEP',
  NR11: 'NR-11', NR12: 'NR-12', NR18: 'NR-18', NR31: 'NR-31', NR33: 'NR-33', NR35: 'NR-35',
  PS: 'Prim. Socorros', DDL: 'Direção Leve', DDGP: 'Direção Pesado', P4X4: 'Pilotagem 4x4',
  CBSE: 'Curso Básico', MOTO: 'Motosserra', FAIXA: 'Faixa/Aceiro', IF: 'Instr. Formal', SINAL: 'Sinaleiro',
}
const colLabel = (c: { codigo: string; norma: string | null }) => TREINO_ABREV[c.codigo] || c.norma || c.codigo


// filtro multi-seleção (checkboxes) com "Selecionar todos"
function CheckDropdown({ label, options, selected, onChange, isDark }: {
  label: string; options: string[]; selected: Set<string> | null
  onChange: (s: Set<string>) => void; isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const sel = selected ?? new Set(options)
  const allSel = options.length > 0 && options.every(o => sel.has(o))
  const toggle = (o: string) => { const n = new Set(sel); n.has(o) ? n.delete(o) : n.add(o); onChange(n) }
  const resumo = allSel ? 'Todos' : sel.size === 0 ? 'Nenhum' : `${sel.size}/${options.length}`
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`text-xs rounded-lg px-2.5 py-1.5 border inline-flex items-center gap-1.5 ${isDark ? 'bg-white/[0.05] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
        {label}: <span className="font-bold">{resumo}</span> <ChevronDown size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
      </button>
      {open && (<>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className={`absolute z-40 mt-1 max-h-72 w-60 overflow-auto rounded-xl border p-1 shadow-xl ${isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'}`}>
          <label className={`flex items-center gap-2 px-2 py-1.5 rounded-lg font-bold cursor-pointer border-b mb-1 text-xs ${isDark ? 'border-white/10 text-slate-200' : 'border-slate-100 text-slate-700'}`}>
            <input type="checkbox" checked={allSel} onChange={() => onChange(allSel ? new Set() : new Set(options))} /> Selecionar todos
          </label>
          {options.map(o => (
            <label key={o} className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-xs ${isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-600 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={sel.has(o)} onChange={() => toggle(o)} /> <span className="truncate">{o}</span>
            </label>
          ))}
        </div>
      </>)}
    </div>
  )
}

// ── Controle de Treinamentos: lista de colaboradores × conformidade da matriz ──
function ControleTreinamentos({ subTabs, isDark, card, txtMain, txtMuted, onSelect }: {
  subTabs?: ReactNode; isDark: boolean; card: string; txtMain: string; txtMuted: string
  onSelect: (id: string) => void
}) {
  const { data: colabs = [], isLoading } = useColaboradoresTreino()
  const { data: matriz = [] } = useMatrizTreinamentos()
  const { data: catalogo = [] } = useCatalogoTreinamentos()
  const { data: treinos = [] } = useTreinamentos()
  const [busca, setBusca] = useState('')
  const [quick, setQuick] = useState<'todos' | 'pendencia'>('todos')
  const [vista, setVista] = useState<'tabela' | 'cards'>('tabela')
  const [fBase, setFBase] = useState<Set<string> | null>(null)
  const [fCargo, setFCargo] = useState<Set<string> | null>(null)
  const [fSetor, setFSetor] = useState<Set<string> | null>(null)
  const [fAdmDe, setFAdmDe] = useState('')
  const [fAdmAte, setFAdmAte] = useState('')

  const bases = [...new Set(colabs.map(c => c.base).filter(Boolean))].sort() as string[]
  const cargos = [...new Set(colabs.map(c => cargoBase(c.cargo)).filter(Boolean))].sort() as string[]
  const setores = [...new Set(colabs.map(c => c.setor).filter(Boolean))].sort() as string[]

  // defaults: tudo marcado, exceto a base "Escritório Central"
  useEffect(() => {
    if (colabs.length && fBase === null) {
      setFBase(new Set(bases.filter(b => cargoBase(b) !== 'ESCRITORIO CENTRAL' && b !== 'Escritório Central')))
      setFCargo(new Set(cargos))
      setFSetor(new Set(setores))
    }
  }, [colabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const catById = new Map(catalogo.map(c => [c.id, c]))
  const reqPorCargo = new Map<string, string[]>()
  matriz.forEach(m => {
    if (m.exigencia !== 'obrigatorio') return
    const k = cargoBase(m.cargo)
    reqPorCargo.set(k, [...(reqPorCargo.get(k) ?? []), m.treinamento_id])
  })

  const linhas = colabs.map(c => {
    const req = reqPorCargo.get(cargoBase(c.cargo)) ?? []
    const meus = treinos.filter(t => t.colaborador_id === c.id)
    let ok = 0, vencendo = 0, vencido = 0, faltando = 0
    let prox: string | null = null
    req.forEach(tid => {
      const cat = catById.get(tid)
      const cands = meus.filter(t => (t as any).treinamento_id === tid || (cat?.norma && (t.norma ?? '').toUpperCase() === cat.norma.toUpperCase()))
      const r = cands.sort((a, b) => (b.data_realizacao ?? '').localeCompare(a.data_realizacao ?? ''))[0] ?? null
      const s = treinoStatus(!!r, r?.vencimento)
      if (s === 'ok') ok++; else if (s === 'vencendo') vencendo++; else if (s === 'vencido') vencido++; else faltando++
      if (r?.vencimento && (s === 'ok' || s === 'vencendo') && (!prox || r.vencimento < prox)) prox = r.vencimento
    })
    return { c, total: req.length, ok, vencendo, vencido, faltando, prox }
  })

  // registros por colaborador (para status por célula)
  const meusPorColab = new Map<string, typeof treinos>()
  treinos.forEach(t => { meusPorColab.set(t.colaborador_id, [...(meusPorColab.get(t.colaborador_id) ?? []), t]) })
  const statusCel = (colabId: string, tidSet: Set<string>, cat: { id: string; norma: string | null }) => {
    if (!tidSet.has(cat.id)) return 'na' as const
    const cands = (meusPorColab.get(colabId) ?? []).filter(t => (t as any).treinamento_id === cat.id || (cat.norma && (t.norma ?? '').toUpperCase() === cat.norma.toUpperCase()))
    const r = cands.sort((a, b) => (b.data_realizacao ?? '').localeCompare(a.data_realizacao ?? ''))[0] ?? null
    return treinoStatus(!!r, r?.vencimento)
  }

  const q = busca.trim().toLowerCase()
  const filt = linhas.filter(l =>
    (!q || l.c.nome.toLowerCase().includes(q) || (l.c.cargo ?? '').toLowerCase().includes(q))
    && (!fBase || !l.c.base || fBase.has(l.c.base))
    && (!fCargo || !cargoBase(l.c.cargo) || fCargo.has(cargoBase(l.c.cargo)))
    && (!fSetor || !l.c.setor || fSetor.has(l.c.setor))
    && (!fAdmDe || (l.c.data_admissao ?? '') >= fAdmDe)
    && (!fAdmAte || (l.c.data_admissao ?? '9999') <= fAdmAte)
    && (quick === 'todos' || (quick === 'pendencia' && (l.faltando > 0 || l.vencido > 0 || l.vencendo > 0)))
  ).sort((a, b) => (b.faltando + b.vencido) - (a.faltando + a.vencido) || a.c.nome.localeCompare(b.c.nome))

  const fmt = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
  const comPend = linhas.filter(l => l.faltando > 0 || l.vencido > 0).length
  const cols = catalogo // já ordenado por ordem
  // agrupado por função (cargo), colaboradores ordenados por nome dentro do grupo
  const grupos = [...filt.reduce((m, l) => {
    const k = cargoBase(l.c.cargo) || '—'; m.set(k, [...(m.get(k) ?? []), l]); return m
  }, new Map<string, typeof filt>()).entries()]
    .map(([k, arr]) => [k, arr.sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'))] as [string, typeof filt])
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))

  const IconeStatus = ({ s }: { s: 'na' | 'ok' | 'vencendo' | 'vencido' | 'faltando' }) =>
    s === 'ok' ? <CheckCircle2 size={16} className="text-emerald-500" />
    : s === 'vencendo' ? <AlertTriangle size={15} className="text-amber-500" />
    : s === 'vencido' ? <XCircle size={16} className="text-red-500" />
    : s === 'faltando' ? <Circle size={14} className={isDark ? 'text-red-400/70' : 'text-red-400'} />
    : <span className={isDark ? 'text-slate-700' : 'text-slate-200'}>·</span>

  return (
    <div className="space-y-3">
      {(() => {
        const selCls = `text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`
        return (
          <div className="space-y-1.5">
            <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
              {subTabs}
              <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
                <Search size={14} className={txtMuted} />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…" className={`bg-transparent outline-none w-full ${txtMain}`} />
              </div>
              <CheckDropdown label="Bases" options={bases} selected={fBase} onChange={setFBase} isDark={isDark} />
              <CheckDropdown label="Posições" options={cargos} selected={fCargo} onChange={setFCargo} isDark={isDark} />
              <CheckDropdown label="Setores" options={setores} selected={fSetor} onChange={setFSetor} isDark={isDark} />
              <span className={`flex items-center gap-1 text-[11px] ${txtMuted}`} title="Data de admissão">
                Adm.
                <input type="date" value={fAdmDe} onChange={e => setFAdmDe(e.target.value)} className={selCls} />
                <input type="date" value={fAdmAte} onChange={e => setFAdmAte(e.target.value)} className={selCls} />
              </span>
              <button onClick={() => setQuick(quick === 'pendencia' ? 'todos' : 'pendencia')}
                className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${quick === 'pendencia' ? 'bg-red-100 text-red-700 border-red-300' : (isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500')}`}>
                <AlertTriangle size={12} /> Com pendência
              </button>
              <div className={`inline-flex p-0.5 rounded-lg ml-auto ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                <button onClick={() => setVista('tabela')} title="Tabela"
                  className={`p-1.5 rounded-md ${vista === 'tabela' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><List size={15} /></button>
                <button onClick={() => setVista('cards')} title="Cards"
                  className={`p-1.5 rounded-md ${vista === 'cards' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><LayoutGrid size={15} /></button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* contagem (esquerda) + legenda (direita) na mesma linha */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs font-semibold ${txtMuted}`}>{filt.length} colaborador{filt.length !== 1 ? 'es' : ''}{comPend ? ` · ${comPend} com pendência` : ''}</p>
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          <span className={`flex items-center gap-1 ${txtMuted}`}><CheckCircle2 size={14} className="text-emerald-500" /> Em dia</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><AlertTriangle size={13} className="text-amber-500" /> Vencendo (60d)</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><XCircle size={14} className="text-red-500" /> Vencido</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><Circle size={12} className="text-red-400" /> Não feito</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className="text-slate-300 font-bold">·</span> Não se aplica</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
      ) : filt.length === 0 ? (
        <Vazio isDark={isDark} texto="Nenhum colaborador encontrado" />
      ) : vista === 'tabela' ? (
        <div className={`rounded-2xl border overflow-auto max-h-[70vh] ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full min-w-[1000px] table-fixed border-collapse text-xs">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-30 w-[240px] text-left px-3 pb-2 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>Colaborador</th>
                {cols.map(c => (
                  <th key={c.id} title={`${c.nome}${c.norma ? ' · ' + c.norma : ''}`}
                    className={`sticky top-0 z-20 h-[132px] p-0 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-400' : 'bg-slate-50 text-slate-500'} ${c.tipo !== 'legal' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-300') : ''}`}>
                    <div className="relative h-full">
                      <span className="absolute bottom-2 left-1 origin-bottom-left rotate-[-45deg] whitespace-nowrap text-[11px] leading-none">{colLabel(c)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([cargo, linhas]) => (
                <Fragment key={cargo}>
                  <tr>
                    <td colSpan={cols.length + 1}
                      className={`sticky left-0 z-10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {cargo} <span className="font-normal opacity-70">· {linhas.length}</span>
                    </td>
                  </tr>
                  {linhas.map((l, i) => {
                    const tidSet = new Set(reqPorCargo.get(cargoBase(l.c.cargo)) ?? [])
                    return (
                      <tr key={l.c.id} className={i % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}>
                        <td className={`sticky left-0 z-10 px-3 py-1.5 pl-5 overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
                          <button onClick={() => onSelect(l.c.id)} title={l.c.nome} className="text-left group block w-full">
                            <p className={`text-xs font-bold truncate group-hover:text-sky-500 ${txtMain}`}>{l.c.nome}</p>
                          </button>
                        </td>
                        {cols.map(c => (
                          <td key={c.id} className={`text-center ${c.tipo !== 'legal' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-200') : ''}`}>
                            <div className="flex items-center justify-center h-7"><IconeStatus s={statusCel(l.c.id, tidSet, c)} /></div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(([cargo, linhas]) => (
            <div key={cargo} className="space-y-2">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cargo} <span className="font-normal opacity-70">· {linhas.length}</span></p>
              {linhas.map(l => (
                <button key={l.c.id} onClick={() => onSelect(l.c.id)}
                  className={`${card} w-full text-left p-3.5 flex items-center gap-3 flex-wrap transition-all hover:border-sky-400/50`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${txtMain}`}>{l.c.nome}</p>
                    <p className={`text-[11px] ${txtMuted}`}>{l.prox ? `próx. venc. ${fmt(l.prox)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {l.total === 0 && <span className={`text-[10px] ${txtMuted}`}>sem matriz</span>}
                    {l.faltando > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{l.faltando} faltando</span>}
                    {l.vencido > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{l.vencido} vencido</span>}
                    {l.vencendo > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{l.vencendo} vencendo</span>}
                    {l.total > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l.ok === l.total ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{l.ok}/{l.total} ok</span>}
                    <ChevronRight size={14} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Integração: candidatos em integração × treinamentos obrigatórios ─────────
// Mesmo layout do Controle; o upload do certificado reusa o anexarCert da Admissão
// (grava em rh_admissao_treinamentos + bucket rh-admissao-docs) → reflete na Admissão › Integração.
function IntegracaoTreinamentos({ subTabs, isDark, card, txtMain, txtMuted }: {
  subTabs?: ReactNode; isDark: boolean; card: string; txtMain: string; txtMuted: string
}) {
  const qc = useQueryClient()
  const { data: catalogo = [] } = useCatalogoTreinamentos()
  const { data: matriz = [] } = useMatrizTreinamentos()
  const { data, isLoading } = useIntegracaoTreinos()
  const admTrein = useAdmissaoTreinamentos()
  const [busca, setBusca] = useState('')
  const [quick, setQuick] = useState<'todos' | 'pendencia'>('todos')
  const [vista, setVista] = useState<'tabela' | 'cards'>('tabela')
  const [fBase, setFBase] = useState<Set<string> | null>(null)
  const [fCargo, setFCargo] = useState<Set<string> | null>(null)
  const [detalhe, setDetalhe] = useState<IntegracaoCand | null>(null)

  const candidatos = data?.candidatos ?? []
  const treinos = data?.treinos ?? []

  const bases = [...new Set(candidatos.map(c => c.base).filter(Boolean))].sort() as string[]
  const cargos = [...new Set(candidatos.map(c => cargoBase(c.cargo)).filter(Boolean))].sort() as string[]

  // defaults: tudo marcado
  useEffect(() => {
    if (candidatos.length && fBase === null) { setFBase(new Set(bases)); setFCargo(new Set(cargos)) }
  }, [candidatos.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // required por cargo-base (obrigatório, exceto ASO — que é da etapa de Exames, igual à Admissão)
  const catById = new Map(catalogo.map(c => [c.id, c]))
  const reqPorCargo = new Map<string, Set<string>>()
  matriz.forEach(m => {
    if (m.exigencia !== 'obrigatorio') return
    if (catById.get(m.treinamento_id)?.codigo === 'ASO') return
    const k = cargoBase(m.cargo)
    if (!reqPorCargo.has(k)) reqPorCargo.set(k, new Set())
    reqPorCargo.get(k)!.add(m.treinamento_id)
  })

  const treinosPorCand = new Map<string, IntegracaoTreino[]>()
  treinos.forEach(t => { treinosPorCand.set(t.candidato_id, [...(treinosPorCand.get(t.candidato_id) ?? []), t]) })
  const recDe = (candId: string, cat: { nome: string; norma: string | null }) =>
    (treinosPorCand.get(candId) ?? []).find(t =>
      (cat.norma && (t.norma ?? '').toUpperCase() === cat.norma.toUpperCase()) || t.nome.trim().toUpperCase() === cat.nome.trim().toUpperCase())

  type Cel = { s: 'na' | 'ok' | 'faltando'; rec?: IntegracaoTreino }
  const statusCel = (candId: string, cargoKey: string, cat: { id: string; nome: string; norma: string | null }): Cel => {
    const req = reqPorCargo.get(cargoKey)
    if (!req || !req.has(cat.id)) return { s: 'na' }
    const rec = recDe(candId, cat)
    if (rec?.status === 'concluido' && rec.certificado_path) return { s: 'ok', rec }
    return { s: 'faltando', rec }
  }

  // resumo por candidato (ok / pendente / total obrigatório)
  const resumoDe = (c: IntegracaoCand) => {
    const req = reqPorCargo.get(cargoBase(c.cargo))
    const total = req ? req.size : 0
    let ok = 0
    req?.forEach(tid => { const cat = catById.get(tid); if (cat && statusCel(c.id, cargoBase(c.cargo), cat).s === 'ok') ok++ })
    return { ok, pend: total - ok, total }
  }

  const q = busca.trim().toLowerCase()
  const filt = candidatos.filter(c =>
    (!q || c.nome.toLowerCase().includes(q) || (c.cargo ?? '').toLowerCase().includes(q))
    && (!fBase || !c.base || fBase.has(c.base))
    && (!fCargo || !cargoBase(c.cargo) || fCargo.has(cargoBase(c.cargo)))
    && (quick === 'todos' || (quick === 'pendencia' && resumoDe(c).pend > 0))
  )
  const comPend = filt.filter(c => resumoDe(c).pend > 0).length

  const grupos = [...filt.reduce((m, c) => {
    const k = cargoBase(c.cargo) || '—'; m.set(k, [...(m.get(k) ?? []), c]); return m
  }, new Map<string, IntegracaoCand[]>()).entries()]
    .map(([k, arr]) => [k, arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))] as [string, IntegracaoCand[]])
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))

  const cols = catalogo
  const upload = (candId: string, recId: string | undefined, cat: { nome: string; norma: string | null }, file: File) => {
    admTrein.anexarCert.mutate(
      { candidatoId: candId, recId, nome: cat.nome, norma: cat.norma ?? undefined, file },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ['integracao-treinos'] }), onError: (e: any) => alert(`Erro ao anexar: ${e?.message ?? 'desconhecido'}`) },
    )
  }
  const verCert = async (path?: string | null) => { const url = await certTreinamentoUrl(path); if (url) window.open(url, '_blank', 'noopener') }
  const abrir = (c: IntegracaoCand) => setDetalhe(c)

  // Drill-in: painel de treinamentos da Admissão (com upload) — grava em rh_admissao_treinamentos
  if (detalhe) return (
    <IntegracaoDetalhe cand={detalhe} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted}
      onBack={() => { setDetalhe(null); qc.invalidateQueries({ queryKey: ['integracao-treinos'] }) }} />
  )

  const selCls = `text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`

  return (
    <div className="space-y-3">
      {/* header com filtros (mesmo padrão do Controle) */}
      <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {subTabs}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…" className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
        <CheckDropdown label="Bases" options={bases} selected={fBase} onChange={setFBase} isDark={isDark} />
        <CheckDropdown label="Posições" options={cargos} selected={fCargo} onChange={setFCargo} isDark={isDark} />
        <button onClick={() => setQuick(quick === 'pendencia' ? 'todos' : 'pendencia')}
          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${quick === 'pendencia' ? 'bg-red-100 text-red-700 border-red-300' : (isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500')}`}>
          <AlertTriangle size={12} /> Com pendência
        </button>
        <div className={`inline-flex p-0.5 rounded-lg ml-auto ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <button onClick={() => setVista('tabela')} title="Tabela"
            className={`p-1.5 rounded-md ${vista === 'tabela' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><List size={15} /></button>
          <button onClick={() => setVista('cards')} title="Cards"
            className={`p-1.5 rounded-md ${vista === 'cards' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><LayoutGrid size={15} /></button>
        </div>
      </div>

      {/* contagem (esquerda) + legenda (direita) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs font-semibold ${txtMuted}`}>{filt.length} em integração{comPend ? ` · ${comPend} com pendência` : ''}</p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${txtMuted}`}><CheckCircle2 size={14} className="text-emerald-500" /> Certificado anexado</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><Circle size={12} className="text-red-400" /> Pendente (clique p/ anexar)</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className="text-slate-300 font-bold">·</span> Não se aplica</span>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
      ) : filt.length === 0 ? (
        <Vazio isDark={isDark} texto="Nenhum colaborador em fase de integração" />
      ) : vista === 'tabela' ? (
        <div className={`rounded-2xl border overflow-auto max-h-[70vh] ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full min-w-[1000px] table-fixed border-collapse text-xs">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-30 w-[240px] text-left px-3 pb-2 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>Colaborador</th>
                {cols.map(c => (
                  <th key={c.id} title={`${c.nome}${c.norma ? ' · ' + c.norma : ''}`}
                    className={`sticky top-0 z-20 h-[132px] p-0 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-400' : 'bg-slate-50 text-slate-500'} ${c.tipo !== 'legal' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-300') : ''}`}>
                    <div className="relative h-full">
                      <span className="absolute bottom-2 left-1 origin-bottom-left rotate-[-45deg] whitespace-nowrap text-[11px] leading-none">{colLabel(c)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map(([cargo, linhas]) => (
                <Fragment key={cargo}>
                  <tr>
                    <td colSpan={cols.length + 1}
                      className={`sticky left-0 z-10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {cargo} <span className="font-normal opacity-70">· {linhas.length}</span>
                    </td>
                  </tr>
                  {linhas.map((c, i) => {
                    const cargoKey = cargoBase(c.cargo)
                    return (
                      <tr key={c.id} className={i % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}>
                        <td className={`sticky left-0 z-10 px-3 py-1.5 pl-5 overflow-hidden ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
                          <button onClick={() => abrir(c)} title={c.nome} className="text-left group block w-full">
                            <p className={`text-xs font-bold truncate group-hover:text-sky-500 ${txtMain}`}>{c.nome}</p>
                            {c.base && <p className={`text-[10px] truncate ${txtMuted}`}>{c.base}</p>}
                          </button>
                        </td>
                        {cols.map(col => {
                          const st = statusCel(c.id, cargoKey, col)
                          return (
                            <td key={col.id} className={`text-center ${col.tipo !== 'legal' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-200') : ''}`}>
                              <div className="flex items-center justify-center h-8">
                                {st.s === 'na' ? (
                                  <span className={isDark ? 'text-slate-700' : 'text-slate-200'}>·</span>
                                ) : st.s === 'ok' ? (
                                  <button type="button" onClick={() => verCert(st.rec?.certificado_path)} title={`Ver certificado — ${st.rec?.certificado_nome ?? 'anexado'}`} className="group">
                                    <CheckCircle2 size={16} className="text-emerald-500 group-hover:text-emerald-600" />
                                  </button>
                                ) : (
                                  <label title="Anexar certificado (reflete na Admissão › Integração)" className={`cursor-pointer inline-flex ${admTrein.anexarCert.isPending ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="relative inline-flex items-center justify-center group">
                                      <Circle size={14} className="text-red-400 group-hover:opacity-0" />
                                      <Upload size={13} className="absolute text-sky-500 opacity-0 group-hover:opacity-100" />
                                    </span>
                                    <input type="file" className="hidden"
                                      onChange={e => { const f = e.target.files?.[0]; if (f) upload(c.id, st.rec?.id, col, f); e.currentTarget.value = '' }} />
                                  </label>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(([cargo, linhas]) => (
            <div key={cargo} className="space-y-2">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{cargo} <span className="font-normal opacity-70">· {linhas.length}</span></p>
              {linhas.map(c => {
                const r = resumoDe(c)
                return (
                  <button key={c.id} onClick={() => abrir(c)}
                    className={`${card} w-full text-left p-3.5 flex items-center gap-3 flex-wrap transition-all hover:border-sky-400/50`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${txtMain}`}>{c.nome}</p>
                      <p className={`text-[11px] ${txtMuted}`}>{c.base ?? ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {r.total === 0 && <span className={`text-[10px] ${txtMuted}`}>sem matriz</span>}
                      {r.pend > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{r.pend} pendente</span>}
                      {r.total > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.ok === r.total ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{r.ok}/{r.total} ok</span>}
                      <ChevronRight size={14} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Drill-in do Integração: painel de treinamentos da Admissão (com upload) do candidato.
// Reusa o TreinamentosBlock da etapa de Integração → grava em rh_admissao_treinamentos.
function IntegracaoDetalhe({ cand, isDark, card, txtMain, txtMuted, onBack }: {
  cand: IntegracaoCand; isDark: boolean; card: string; txtMain: string; txtMuted: string; onBack: () => void
}) {
  const { data } = useEtapaCandidato(cand.id)
  return (
    <div className="space-y-3">
      <button onClick={onBack} className={`inline-flex items-center gap-1 text-xs font-bold ${isDark ? 'text-sky-300' : 'text-sky-700'} hover:underline`}>
        <ChevronRight size={14} className="rotate-180" /> Voltar
      </button>
      <div className={`${card} p-4`}>
        <p className={`text-base font-black ${txtMain}`}>{cand.nome}</p>
        <p className={`text-xs mt-0.5 ${txtMuted}`}>{[cand.cargo, cand.base].filter(Boolean).join(' · ') || '—'}</p>
      </div>
      <div className={`${card} p-4`}>
        <TreinamentosBlock cand={cand as any} cargo={cand.cargo} treinamentos={data?.treinamentos ?? []} />
      </div>
    </div>
  )
}

// ── Matriz de Treinamentos (cargo × treinamento) ─────────────────────────────
function MatrizTreinamentos({ subTabs, isDark, card, txtMain, txtMuted, isAdmin }: {
  subTabs?: ReactNode; isDark: boolean; card: string; txtMain: string; txtMuted: string; isAdmin: boolean
}) {
  const { data: catalogo = [], isLoading: lc } = useCatalogoTreinamentos()
  const { data: matriz = [], isLoading: lm } = useMatrizTreinamentos()
  const setCel = useSetMatrizCelula()
  const [busca, setBusca] = useState('')
  const [tipoF, setTipoF] = useState<'todos' | 'legal' | 'contratual'>('todos')

  const cols = catalogo.filter(c => tipoF === 'todos' || c.tipo === tipoF)
  const cargos = [...new Set(matriz.map(m => m.cargo))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const q = busca.trim().toLowerCase()
  const cargosF = q ? cargos.filter(c => c.toLowerCase().includes(q)) : cargos
  const cel = (cargo: string, tid: string) => matriz.find(m => m.cargo === cargo && m.treinamento_id === tid)?.exigencia ?? 'na'

  const ciclo: Record<string, 'obrigatorio' | 'atividade' | 'na'> = { na: 'obrigatorio', obrigatorio: 'na', atividade: 'na' }
  const onCel = (cargo: string, tid: string, atual: string) => {
    if (!isAdmin || setCel.isPending) return
    setCel.mutate({ cargo, treinamento_id: tid, exigencia: ciclo[atual] })
  }

  const cellStyle = (e: string) =>
    e === 'obrigatorio' ? (isDark ? 'bg-emerald-500/25 text-emerald-300' : 'bg-emerald-500 text-white')
      : e === 'atividade' ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-300 text-amber-900')
      : (isDark ? 'text-slate-700' : 'text-slate-200')
  const cellTxt = (e: string) => e === 'obrigatorio' ? 'O' : e === 'atividade' ? 'A' : '·'

  if (lc || lm) return (
    <div className="space-y-3">
      {subTabs && <div className="flex items-center gap-2 flex-wrap">{subTabs}</div>}
      <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* header: filtros dentro da caixa com borda (mesmo padrão do Controle) */}
      <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {subTabs}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cargo…"
            className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
        <div className={`inline-flex p-1 rounded-xl ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {([['todos', 'Todos'], ['legal', 'Legais (NR)'], ['contratual', 'Contratuais']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTipoF(k)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${tipoF === k ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* contagem + dica (esquerda) + legenda (direita) — igual ao Controle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs ${txtMuted}`}>
          <span className="font-semibold">{cargosF.length} cargo{cargosF.length !== 1 ? 's' : ''} · {cols.length} treinamentos</span>
          {isAdmin && <span className="ml-2 opacity-80">· Clique numa célula para alternar entre Obrigatório e Não se aplica. Base: Matriz CEMIG OD/ST-06114/2025 + operação TEG.</span>}
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className={`w-4 h-4 rounded flex items-center justify-center font-bold ${cellStyle('obrigatorio')}`}>O</span> Obrigatório</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className={`w-4 h-4 rounded flex items-center justify-center ${cellStyle('na')}`}>·</span> Não se aplica</span>
        </div>
      </div>

      {/* grade */}
      <div className={`rounded-2xl border overflow-auto max-h-[70vh] ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <table className="w-full min-w-[1000px] table-fixed border-collapse text-xs">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-30 w-[240px] text-left px-3 pb-2 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>Cargo</th>
              {cols.map(c => (
                <th key={c.id} title={`${c.nome}${c.norma ? ' · ' + c.norma : ''}${c.carga_horaria ? ' · ' + c.carga_horaria + 'h' : ''}`}
                  className={`sticky top-0 z-20 h-[132px] p-0 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-400' : 'bg-slate-50 text-slate-500'} ${c.tipo === 'contratual' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-300') : ''}`}>
                  <div className="relative h-full">
                    <span className="absolute bottom-2 left-1 origin-bottom-left rotate-[-45deg] whitespace-nowrap text-[11px] leading-none">{colLabel(c)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargosF.map((cargo, i) => (
              <tr key={cargo} className={i % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}>
                <td title={cargo} className={`sticky left-0 z-10 px-3 py-1.5 font-semibold truncate max-w-[240px] ${txtMain} ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>{cargo}</td>
                {cols.map(c => {
                  const e = cel(cargo, c.id)
                  return (
                    <td key={c.id} className={`text-center ${c.tipo === 'contratual' ? 'border-l border-dashed ' + (isDark ? 'border-white/10' : 'border-slate-200') : ''}`}>
                      <button disabled={!isAdmin} onClick={() => onCel(cargo, c.id, e)}
                        className={`w-7 h-7 m-0.5 rounded font-bold text-[11px] transition-all ${cellStyle(e)} ${isAdmin ? 'hover:ring-2 hover:ring-sky-400 cursor-pointer' : 'cursor-default'}`}>
                        {cellTxt(e)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {cargosF.length === 0 && (
              <tr><td colSpan={cols.length + 1} className={`px-3 py-8 text-center ${txtMuted}`}>Nenhum cargo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Modal: Treinamento ───────────────────────────────────────────────────────

function TreinamentoModal({ isDark, treinamento, onClose }: { isDark: boolean; treinamento: QsmaTreinamento | null; onClose: () => void }) {
  const salvar = useSalvarTreinamento()
  const [colabId, setColabId] = useState(treinamento?.colaborador_id ?? '')
  const [colabNome, setColabNome] = useState(treinamento?.colaborador_nome ?? '')
  const [norma, setNorma] = useState(treinamento?.norma ?? 'NR-10')
  const [curso, setCurso] = useState(treinamento?.curso ?? '')
  const [carga, setCarga] = useState<string>(treinamento?.carga_horaria?.toString() ?? '')
  const [dataReal, setDataReal] = useState(treinamento?.data_realizacao ?? '')
  const [validadeMeses, setValidadeMeses] = useState<string>(treinamento?.validade_meses?.toString() ?? '24')
  const [certPaths, setCertPaths] = useState<string[]>(treinamento?.certificado_path ? [treinamento.certificado_path] : [])

  const erros: string[] = []
  if (!colabId) erros.push('selecione o colaborador')
  if (!norma) erros.push('informe a norma')
  if (!dataReal) erros.push('informe a data de realização')

  return (
    <QsmaModal isDark={isDark} titulo={treinamento ? 'Editar treinamento' : 'Novo treinamento'} subtitulo="Vencimento calculado pela validade da norma" onClose={onClose}>
      <ColaboradorPicker isDark={isDark} value={colabId} onChange={(id, c) => { setColabId(id); setColabNome(c?.nome ?? '') }} required />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Norma *</label>
          <select value={norma} onChange={e => setNorma(e.target.value)} className={pickerInputCls(isDark)}>
            {NORMAS_TREINAMENTO.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Curso</label>
          <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ex.: Reciclagem NR-10 SEP" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Carga (h)</label>
          <input type="number" value={carga} onChange={e => setCarga(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Realização *</label>
          <input type="date" value={dataReal} onChange={e => setDataReal(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Validade (meses)</label>
          <input type="number" value={validadeMeses} onChange={e => setValidadeMeses(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
      </div>
      <FotosUpload isDark={isDark} pasta={`treinamentos/${colabId || 'novo'}`} paths={certPaths} onChange={setCertPaths} label="Certificado" />
      <ModalFooter
        isDark={isDark} erros={erros} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          {
            id: treinamento?.id, colaborador_id: colabId, colaborador_nome: colabNome,
            norma, curso: curso || undefined, carga_horaria: carga ? Number(carga) : undefined,
            data_realizacao: dataReal, validade_meses: validadeMeses ? Number(validadeMeses) : undefined,
            certificado_path: certPaths[0],
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: Ocorrência (registro + investigação + ação SGI) ──────────────────

function OcorrenciaModal({ isDark, ocorrencia, onClose }: { isDark: boolean; ocorrencia: QsmaOcorrencia | null; onClose: () => void }) {
  const salvar = useSalvarOcorrencia()
  const enviarSgi = useEnviarOcorrenciaSgi()
  const { data: acoes = [] } = useAcoesQsma()
  const { data: obras = [] } = useObrasComProjeto()
  const { perfil } = useAuth()
  const nav = useNavigate()
  const isEdit = !!ocorrencia?.id

  const [tipo, setTipo] = useState<TipoOcorrencia>(ocorrencia?.tipo ?? 'desvio')
  const [gravidade, setGravidade] = useState<Gravidade>(ocorrencia?.gravidade ?? 'baixa')
  const [obraId, setObraId] = useState(ocorrencia?.obra_id ?? '')
  const [frente, setFrente] = useState(ocorrencia?.frente ?? '')
  const [dataOco, setDataOco] = useState(
    ocorrencia?.data_ocorrencia?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
  )
  const [localDesc, setLocalDesc] = useState(ocorrencia?.local_descricao ?? '')
  const [descricao, setDescricao] = useState(ocorrencia?.descricao ?? '')
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>(ocorrencia?.envolvidos ?? [])
  const [envolvidoTmp, setEnvolvidoTmp] = useState('')
  const [veiculoId, setVeiculoId] = useState(ocorrencia?.veiculo_id ?? '')
  const [fotos, setFotos] = useState<string[]>(ocorrencia?.fotos ?? [])
  const [diasAfast, setDiasAfast] = useState<string>(ocorrencia?.dias_afastamento?.toString() ?? '')

  const minhasAcoes = acoes.filter(a => a.origem_id === ocorrencia?.id)
  const emTratamento = !!ocorrencia?.sgi_registro_id
  const stAtual = ocorrencia ? STATUS_OCORRENCIA_LABEL[ocorrencia.status] : null

  // Relatório de investigação (SuperTEG)
  const gerarRel = useGerarRelatorio()
  const [relIniciado, setRelIniciado] = useState(false)
  const statusInicial = ocorrencia?.relatorio_status ?? null
  const pollAtivo = (statusInicial === 'processando') || relIniciado
  const { data: relLive } = useRelatorioStatus(ocorrencia?.id, pollAtivo)
  const relStatus = relLive?.relatorio_status ?? statusInicial
  const relUrl = relLive?.relatorio_url ?? ocorrencia?.relatorio_url ?? null
  const relProcessando = relStatus === 'processando'
  async function handleGerarRelatorio() {
    if (!ocorrencia?.id) return
    try { setRelIniciado(true); await gerarRel.mutateAsync(ocorrencia.id) }
    catch (e: any) { setRelIniciado(false); alert(`Erro: ${e?.message ?? 'desconhecido'}`) }
  }
  async function abrirRelatorio() {
    if (!relUrl) return
    const url = await evidenciaUrl(relUrl)
    if (!url) return
    // o storage serve HTML como text/plain (segurança); reabre como blob text/html p/ renderizar
    try {
      const html = await (await fetch(url)).text()
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      window.open(url, '_blank')
    }
  }

  const erros: string[] = []
  if (!descricao.trim()) erros.push('descreva a ocorrência')
  if (!obraId) erros.push('selecione a obra')
  if ((tipo === 'acidente_cpt') && !diasAfast) erros.push('acidente c/ afastamento pede os dias')

  async function handleSave() {
    try {
      await salvar.mutateAsync({
        id: ocorrencia?.id,
        tipo, gravidade, obra_id: obraId, frente: frente || undefined,
        data_ocorrencia: new Date(dataOco).toISOString(),
        local_descricao: localDesc || undefined,
        descricao: descricao.trim(),
        envolvidos, veiculo_id: veiculoId || undefined,
        fotos, dias_afastamento: diasAfast ? Number(diasAfast) : undefined,
        registrado_por_id: ocorrencia?.registrado_por_id ?? perfil?.id,
        registrado_por_nome: ocorrencia?.registrado_por_nome ?? perfil?.nome,
      })
      onClose()
    } catch (e: any) {
      alert(`Erro: ${e?.message ?? 'desconhecido'}`)
    }
  }

  async function handleEnviarSgi() {
    if (!ocorrencia) return
    if (!confirm('Enviar para tratamento no módulo Gestão (SGI)? A investigação, plano de ação e encerramento acontecem lá — aqui a ocorrência passa a só acompanhar o andamento.')) return
    try {
      const reg = await enviarSgi.mutateAsync({
        ocorrencia,
        obraNome: obras.find(o => o.id === ocorrencia.obra_id)?.nome,
        criado_por_nome: perfil?.nome,
      })
      alert(`✓ Registro ${reg.codigo ?? ''} criado na Melhoria Contínua do Gestão.`)
      onClose()
    } catch (e: any) {
      alert(`Erro ao enviar: ${e?.message ?? 'desconhecido'}`)
    }
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={isEdit ? `${ocorrencia?.codigo} — ${TIPO_OCORRENCIA_LABEL[tipo]}` : 'Registrar ocorrência'} subtitulo="Registro → investigação (5 porquês) → ação corretiva no SGI" onClose={onClose}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Tipo *</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoOcorrencia)} className={pickerInputCls(isDark)}>
            {(Object.keys(TIPO_OCORRENCIA_LABEL) as TipoOcorrencia[]).map(t => <option key={t} value={t}>{TIPO_OCORRENCIA_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Potencial de gravidade</label>
          <select value={gravidade} onChange={e => setGravidade(e.target.value as Gravidade)} className={pickerInputCls(isDark)}>
            {(Object.keys(GRAVIDADE_LABEL) as Gravidade[]).map(g => <option key={g} value={g}>{GRAVIDADE_LABEL[g].label}</option>)}
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Data/hora *</label>
          <input type="datetime-local" value={dataOco} onChange={e => setDataOco(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
      </div>
      <ObraPicker isDark={isDark} value={obraId} onChange={id => { setObraId(id); setVeiculoId('') }} required />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Frente</label>
          <input value={frente} onChange={e => setFrente(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Local</label>
          <input value={localDesc} onChange={e => setLocalDesc(e.target.value)} placeholder="Ex.: Torre 42, vão 41-42" className={pickerInputCls(isDark)} />
        </div>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Descrição do ocorrido *</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} className={pickerInputCls(isDark)} />
      </div>

      {/* Envolvidos */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Envolvidos ({envolvidos.length})</span>
        {envolvidos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {envolvidos.map((e, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                {e.nome}{e.funcao ? ` · ${e.funcao}` : ''}
                <button onClick={() => setEnvolvidos(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
        <ColaboradorPicker
          isDark={isDark}
          value={envolvidoTmp}
          onChange={(id, c) => {
            if (id && c && !envolvidos.some(e => e.colaborador_id === id)) {
              setEnvolvidos(prev => [...prev, { colaborador_id: id, nome: c.nome, funcao: c.cargo }])
            }
            setEnvolvidoTmp('')
          }}
          label="Adicionar envolvido"
          placeholder="Buscar colaborador…"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <VeiculoPicker isDark={isDark} value={veiculoId} onChange={setVeiculoId} obraId={obraId || undefined} label="Veículo envolvido (se houver)" />
        {(tipo === 'acidente_cpt' || tipo === 'acidente_spt') && (
          <div>
            <label className={pickerLabelCls(isDark)}>Dias de afastamento{tipo === 'acidente_cpt' ? ' *' : ''}</label>
            <input type="number" min={0} value={diasAfast} onChange={e => setDiasAfast(e.target.value)} className={pickerInputCls(isDark)} />
          </div>
        )}
      </div>

      <FotosUpload isDark={isDark} pasta={`ocorrencias/${ocorrencia?.id ?? 'nova'}`} paths={fotos} onChange={setFotos} />

      {/* Tratar com o SuperTEG — gera o relatório de investigação ilustrado */}
      {isEdit && (
        <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-teal-500/20 bg-teal-500/[0.04]' : 'border-teal-200 bg-teal-50/40'}`}>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
            <Sparkles size={10} /> Relatório de Investigação — SuperTEG
          </span>
          {relProcessando ? (
            <div className="flex items-center gap-2 text-[11px]">
              <Loader2 size={14} className="animate-spin text-teal-500 shrink-0" />
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>SuperTEG analisando a ocorrência e montando o relatório… pode levar alguns minutos (pode fechar — ele continua).</span>
            </div>
          ) : relStatus === 'pronto' && relUrl ? (
            <>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Relatório gerado — revise, ajuste os campos e imprima/salve em PDF.</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={abrirRelatorio} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-teal-600 text-white hover:bg-teal-700"><FileText size={12} /> Ver relatório</button>
                <button onClick={handleGerarRelatorio} disabled={gerarRel.isPending} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Sparkles size={11} /> Refazer</button>
              </div>
            </>
          ) : (
            <>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {relStatus === 'erro' ? 'A geração anterior falhou — tente novamente. ' : ''}O SuperTEG lê os anexos, analisa a causa raiz e monta o relatório de investigação (RIIA ilustrado) no padrão da TEG.
              </p>
              <button onClick={handleGerarRelatorio} disabled={gerarRel.isPending} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                <Sparkles size={11} /> {gerarRel.isPending ? 'Acionando…' : 'Tratar com o SuperTEG'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Tratamento — a execução acontece no módulo Gestão (SGI); aqui só acompanha */}
      {isEdit && (
        <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-violet-500/20 bg-violet-500/[0.04]' : 'border-violet-200 bg-violet-50/40'}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
              <Link2 size={10} /> Tratamento — módulo Gestão (SGI)
            </span>
            {stAtual && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isDark ? stAtual.dark : stAtual.light}`}>{stAtual.label}</span>
            )}
          </div>
          {emTratamento ? (
            <>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Em tratamento na Melhoria Contínua — investigação, plano de ação e encerramento acontecem lá; o andamento se reflete aqui automaticamente.
              </p>
              {minhasAcoes.length > 0 && (
                <div className="space-y-1">
                  {minhasAcoes.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{a.titulo}</span>
                      <span className={`shrink-0 text-[9px] font-bold uppercase ${a.status === 'concluida' ? 'text-emerald-500' : 'text-amber-500'}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => nav('/sgi/melhoria')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  isDark ? 'border-violet-500/30 text-violet-300 hover:bg-violet-500/10' : 'border-violet-200 text-violet-700 hover:bg-violet-50'
                }`}
              >
                <ExternalLink size={11} /> Abrir no Gestão
              </button>
            </>
          ) : (
            <>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Esta ocorrência ainda não foi enviada para tratamento. O QSMA registra e acompanha; a execução das etapas é no Gestão.
              </p>
              <button
                onClick={handleEnviarSgi}
                disabled={enviarSgi.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                <Send size={11} /> {enviarSgi.isPending ? 'Enviando…' : 'Enviar para tratamento (Gestão)'}
              </button>
            </>
          )}
        </div>
      )}

      <ModalFooter
        isDark={isDark} erros={erros}
        salvando={salvar.isPending}
        onCancel={onClose}
        saveLabel={isEdit ? 'Salvar' : 'Registrar'}
        onSave={handleSave}
      />
    </QsmaModal>
  )
}

// ── Matriz de EPIs: cargo × EPI obrigatório (célula cicla · → 1 → 2 → ·) ──────
function MatrizEpis({ subTabs, isDark, txtMain, txtMuted, isAdmin }: {
  subTabs?: ReactNode; isDark: boolean; txtMain: string; txtMuted: string; isAdmin: boolean
}) {
  const { data: epis = [], isLoading: le } = useEpis()
  const { data: matriz = [], isLoading: lm } = useMatrizEpi()
  const { data: matrizTreino = [] } = useMatrizTreinamentos()
  const setCel = useSetMatrizEpiCelula()
  const [busca, setBusca] = useState('')

  const cols = epis.filter(e => e.ativo)
  // linhas: cargos já presentes na matriz de EPI + todos os da matriz de treinamentos (mesma população de funções)
  const cargos = [...new Set([...matriz.map(m => m.cargo), ...matrizTreino.map(m => cargoBase(m.cargo))])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const q = busca.trim().toLowerCase()
  const cargosF = q ? cargos.filter(c => c.toLowerCase().includes(q)) : cargos
  const qtdCel = (cargo: string, eid: string) => {
    const m = matriz.find(x => x.cargo === cargo && x.epi_id === eid)
    return m && m.exigencia === 'obrigatorio' ? m.quantidade : 0
  }
  const onCel = (cargo: string, eid: string) => {
    if (!isAdmin || setCel.isPending) return
    const atual = qtdCel(cargo, eid)
    const prox = atual === 0 ? 1 : atual === 1 ? 2 : 0
    setCel.mutate({ cargo, epi_id: eid, exigencia: prox === 0 ? 'na' : 'obrigatorio', quantidade: Math.max(1, prox) })
  }
  const cellStyle = (n: number) =>
    n > 0 ? (isDark ? 'bg-emerald-500/25 text-emerald-300' : 'bg-emerald-500 text-white')
      : (isDark ? 'text-slate-700' : 'text-slate-200')

  if (le || lm) return (
    <div className="space-y-3">
      {subTabs && <div className="flex items-center gap-2 flex-wrap">{subTabs}</div>}
      <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {subTabs}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cargo…"
            className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs ${txtMuted}`}>
          <span className="font-semibold">{cargosF.length} cargo{cargosF.length !== 1 ? 's' : ''} · {cols.length} EPIs</span>
          {isAdmin && <span className="ml-2 opacity-80">· Clique na célula para alternar a quantidade (· → 1 → 2). Base: kit de admissão TEG (fichas assinadas).</span>}
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className={`w-4 h-4 rounded flex items-center justify-center font-bold ${cellStyle(1)}`}>1</span> Qtd. obrigatória</span>
          <span className={`flex items-center gap-1 ${txtMuted}`}><span className={`w-4 h-4 rounded flex items-center justify-center ${cellStyle(0)}`}>·</span> Não se aplica</span>
        </div>
      </div>

      <div className={`rounded-2xl border overflow-auto max-h-[70vh] ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-30 w-[240px] text-left px-3 pb-2 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>Cargo</th>
              {cols.map(e => (
                <th key={e.id} title={`${e.nome}${e.ca ? ' · CA ' + e.ca : ''}${e.fabricante ? ' · ' + e.fabricante : ''}`}
                  className={`sticky top-0 z-20 h-[132px] p-0 align-bottom font-bold ${isDark ? 'bg-[#0f172a] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  <div className="relative h-full">
                    <span className="absolute bottom-2 left-1 origin-bottom-left rotate-[-45deg] whitespace-nowrap text-[11px] leading-none">{e.nome}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargosF.map((cargo, i) => (
              <tr key={cargo} className={i % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}>
                <td title={cargo} className={`sticky left-0 z-10 px-3 py-1.5 font-semibold truncate max-w-[240px] ${txtMain} ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>{cargo}</td>
                {cols.map(e => {
                  const n = qtdCel(cargo, e.id)
                  return (
                    <td key={e.id} className="text-center">
                      <button disabled={!isAdmin} onClick={() => onCel(cargo, e.id)}
                        className={`w-7 h-7 m-0.5 rounded font-bold text-[11px] transition-all ${cellStyle(n)} ${isAdmin ? 'hover:ring-2 hover:ring-sky-400 cursor-pointer' : 'cursor-default'}`}>
                        {n > 0 ? n : '·'}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            {cargosF.length === 0 && (
              <tr><td colSpan={cols.length + 1} className={`px-3 py-8 text-center ${txtMuted}`}>Nenhum cargo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Card de uma ficha de entrega (PDF + arquivar assinada) ────────────────────
function FichaCard({ f, isDark, card, txtMain, txtMuted, baseNome }: {
  f: QsmaEpiFicha; isDark: boolean; card: string; txtMain: string; txtMuted: string
  baseNome: (id?: string) => string
}) {
  const arquivarFicha = useArquivarFichaEpi()
  const st = STATUS_FICHA_EPI_LABEL[f.status]
  const itens = f.itens ?? []
  return (
    <div className={`${card} p-3.5`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${txtMain}`}>
            <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{f.codigo}</span>
            {f.colaborador_nome ?? '—'}
          </p>
          <p className={`text-[11px] ${txtMuted}`}>
            {itens.length} item(ns) · {fmtData(f.data_entrega)} · {baseNome(f.base_id)}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isDark ? st.dark : st.light}`}>{st.label}</span>
        <button
          onClick={() => gerarFichaEpiPdf({
            codigo: f.codigo,
            colaboradorNome: f.colaborador_nome ?? '—',
            baseNome: baseNome(f.base_id),
            dataEntrega: f.data_entrega,
            motivo: f.motivo,
            observacoes: f.observacoes,
            entreguePorNome: f.entregue_por_nome,
            itens: itens.map(it => ({
              nome: it.epi?.nome ?? 'EPI',
              ca: it.epi?.ca,
              quantidade: it.quantidade,
              tamanho: it.tamanho,
              trocaPrevista: it.data_troca_prevista,
            })),
          })}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="Gerar a ficha em PDF para colher a assinatura"
        >
          <FileDown size={11} /> PDF
        </button>
        {f.status === 'aguardando_assinatura' && (
          <label className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
            isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`} title="Anexar a ficha assinada (foto/scan) e arquivar">
            <Paperclip size={11} /> Arquivar assinada
            <input
              type="file" className="hidden" accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={async ev => {
                const file = ev.target.files?.[0]
                if (!file) return
                try {
                  const path = await uploadEvidencia(`fichas-epi/${f.id}`, file)
                  await arquivarFicha.mutateAsync({ fichaId: f.id, arquivoPath: path })
                } catch (err: any) {
                  alert(`Erro ao arquivar: ${err?.message ?? 'desconhecido'}`)
                }
              }}
            />
          </label>
        )}
        {f.onedrive_web_url ? (
          <a href={f.onedrive_web_url} target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
            title="Abrir a ficha assinada no OneDrive">
            <ShieldCheck size={12} /> Ficha assinada (OneDrive)
          </a>
        ) : f.arquivo_assinado_path && (
          <button
            onClick={async () => {
              const url = await evidenciaUrl(f.arquivo_assinado_path)
              if (url) window.open(url, '_blank')
            }}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}
            title="Abrir ficha assinada arquivada"
          >
            <ShieldCheck size={13} />
          </button>
        )}
      </div>
      {itens.length > 0 && (
        <p className={`mt-1.5 text-[10px] ${txtMuted}`}>
          {itens.map(it => `${it.quantidade}× ${it.epi?.nome ?? 'EPI'}${it.epi?.ca ? ` (CA ${it.epi.ca})` : ''}`).join(' · ')}
        </p>
      )}
    </div>
  )
}

// ── Controle de EPIs por COLABORADOR: kit × matriz do cargo → ficha viva ──────
function ControleEpis({ subTabs, isDark, card, txtMain, txtMuted, onSelect }: {
  subTabs?: ReactNode; isDark: boolean; card: string; txtMain: string; txtMuted: string
  onSelect: (id: string) => void
}) {
  const { data: colabs = [], isLoading } = useColaboradoresTreino()
  const { data: epis = [] } = useEpis()
  const { data: matriz = [] } = useMatrizEpi()
  const { data: entregas = [] } = useEpiEntregas()
  const { data: fichas = [] } = useFichasEpi()
  const { data: estBases = [] } = useBases()
  const baseNome = (id?: string) => estBases.find(b => b.id === id)?.nome ?? '—'
  const [busca, setBusca] = useState('')
  const [quick, setQuick] = useState<'todos' | 'incompleto'>('todos')
  const [fBase, setFBase] = useState<Set<string> | null>(null)
  const [fCargo, setFCargo] = useState<Set<string> | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)

  const bases = [...new Set(colabs.map(c => c.base).filter(Boolean))].sort() as string[]
  const cargos = [...new Set(colabs.map(c => cargoBase(c.cargo)).filter(Boolean))].sort() as string[]
  // cargos que têm matriz de EPI (pelo menos 1 EPI obrigatório)
  const cargosComMatriz = new Set(matriz.filter(m => m.exigencia === 'obrigatorio').map(m => cargoBase(m.cargo)))

  useEffect(() => {
    if (colabs.length && matriz.length && fBase === null) {
      setFBase(new Set(bases.filter(b => cargoBase(b) !== 'ESCRITORIO CENTRAL' && b !== 'Escritório Central')))
      // pré-filtra só cargos COM matriz — esconde as posições "sem matriz p/ o cargo"
      setFCargo(new Set(cargos.filter(c => cargosComMatriz.has(c))))
    }
  }, [colabs.length, matriz.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const epiById = new Map(epis.map(e => [e.id, e]))
  // exigido por cargo-base: epi_id → quantidade
  const reqPorCargo = new Map<string, Map<string, number>>()
  matriz.forEach(m => {
    if (m.exigencia !== 'obrigatorio') return
    const k = cargoBase(m.cargo)
    if (!reqPorCargo.has(k)) reqPorCargo.set(k, new Map())
    reqPorCargo.get(k)!.set(m.epi_id, m.quantidade)
  })
  const entPorColab = new Map<string, typeof entregas>()
  entregas.forEach(e => { if (e.colaborador_id) entPorColab.set(e.colaborador_id, [...(entPorColab.get(e.colaborador_id) ?? []), e]) })
  const fichasPorColab = new Map<string, typeof fichas>()
  fichas.forEach(f => { if (f.colaborador_id) fichasPorColab.set(f.colaborador_id, [...(fichasPorColab.get(f.colaborador_id) ?? []), f]) })

  const q = busca.trim().toLowerCase()
  const linhas = colabs.map(c => {
    const req = reqPorCargo.get(cargoBase(c.cargo)) ?? new Map<string, number>()
    const ent = entPorColab.get(c.id) ?? []
    const entregueIds = new Set(ent.map(e => e.epi_id))
    const okItens = [...req.keys()].filter(eid => entregueIds.has(eid))
    const faltantes = [...req.keys()].filter(eid => !entregueIds.has(eid))
    const fchs = fichasPorColab.get(c.id) ?? []
    const aguardando = fchs.filter(f => f.status === 'aguardando_assinatura').length
    const ultima = ent.map(e => e.data_entrega).filter(Boolean).sort().slice(-1)[0] ?? null
    return { c, total: req.size, ok: okItens.length, faltantes, fichas: fchs, aguardando, ultima }
  })
  const filt = linhas.filter(l =>
    (!q || l.c.nome.toLowerCase().includes(q))
    && (fBase === null || (l.c.base ? fBase.has(l.c.base) : true))
    && (fCargo === null || fCargo.has(cargoBase(l.c.cargo)))
    && (quick !== 'incompleto' || (l.total > 0 && l.ok < l.total))
  )
  const incompletos = linhas.filter(l => l.total > 0 && l.ok < l.total).length

  const grupos = [...filt.reduce((m, l) => {
    const k = cargoBase(l.c.cargo) || '—'; m.set(k, [...(m.get(k) ?? []), l]); return m
  }, new Map<string, typeof filt>()).entries()]
    .map(([k, arr]) => [k, arr.sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'))] as [string, typeof filt])
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))

  const fmt = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {subTabs}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador…" className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
        <CheckDropdown label="Bases" options={bases} selected={fBase} onChange={setFBase} isDark={isDark} />
        <CheckDropdown label="Posições" options={cargos} selected={fCargo} onChange={setFCargo} isDark={isDark} />
        <button onClick={() => setQuick(quick === 'incompleto' ? 'todos' : 'incompleto')}
          className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${quick === 'incompleto' ? 'bg-red-100 text-red-700 border-red-300' : (isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500')}`}>
          <AlertTriangle size={12} /> Kit incompleto
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className={`text-xs font-semibold ${txtMuted}`}>{filt.length} colaborador{filt.length !== 1 ? 'es' : ''}{incompletos ? ` · ${incompletos} com kit incompleto` : ''}</p>
        <p className={`text-[11px] ${txtMuted}`}>Clique no nome para abrir a ficha do colaborador · clique no badge <b>Kit</b> para ver as pendências</p>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
      ) : filt.length === 0 ? (
        <Vazio isDark={isDark} texto="Nenhum colaborador encontrado" />
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          {grupos.map(([cargo, ls]) => (
            <Fragment key={cargo}>
              <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                {cargo} <span className="font-normal opacity-70">· {ls.length}</span>
              </div>
              {ls.map((l, i) => {
                const expandido = aberto === l.c.id
                const completo = l.total > 0 && l.ok === l.total
                return (
                  <div key={l.c.id} className={`${i % 2 ? (isDark ? 'bg-white/[0.015]' : 'bg-slate-50/40') : ''}`}>
                    <div className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'}`}>
                      {/* Nome → abre a ficha de segurança do colaborador */}
                      <button onClick={() => onSelect(l.c.id)}
                        className={`flex items-center gap-2 flex-1 min-w-0 text-left group`} title="Abrir ficha do colaborador">
                        <User size={13} className={txtMuted} />
                        <span className={`text-xs font-bold truncate ${txtMain} group-hover:underline`}>{l.c.nome}</span>
                      </button>
                      {l.total === 0 ? (
                        <span className={`text-[10px] ${txtMuted}`}>sem matriz p/ o cargo</span>
                      ) : (
                        /* Badge "Kit" → expande as pendências inline */
                        <button onClick={() => setAberto(expandido ? null : l.c.id)} title="Ver pendências do kit"
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${completo
                            ? 'bg-emerald-500 text-white'
                            : l.ok === 0 ? (isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200') : (isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200')}`}>
                          Kit {l.ok}/{l.total}
                          {expandido ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                      )}
                      {l.aguardando > 0 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
                          {l.aguardando} aguard. assinatura
                        </span>
                      )}
                      <span className={`text-[10px] w-[110px] text-right ${txtMuted}`}>{l.ultima ? `últ. entrega ${fmt(l.ultima)}` : 'sem entrega'}</span>
                    </div>
                    {expandido && (
                      <div className={`px-9 pb-3 space-y-2 ${isDark ? '' : ''}`}>
                        {l.faltantes.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase ${txtMuted}`}>Faltam:</span>
                            {l.faltantes.map(eid => {
                              const e = epiById.get(eid)
                              return (
                                <span key={eid} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-600'}`}>
                                  {e?.nome ?? 'EPI'}{e?.ca ? ` · CA ${e.ca}` : ''}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {l.fichas.length === 0 ? (
                          <p className={`text-[11px] italic ${txtMuted}`}>Nenhuma ficha de entrega ainda — registre em "+ Novo Registro".</p>
                        ) : (
                          l.fichas.map(f => <FichaCard key={f.id} f={f} isDark={isDark} card={card} txtMain={txtMain} txtMuted={txtMuted} baseNome={baseNome} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lista de EPIs (catálogo padrão lista/cards + estoque) ─────────────────────
function ListaEpis({ subTabs, isDark, card, txtMain, txtMuted, onNovoEpi, onEditEpi }: {
  subTabs?: ReactNode; isDark: boolean; card: string; txtMain: string; txtMuted: string
  onNovoEpi: () => void; onEditEpi: (e: QsmaEpi) => void
}) {
  const { data: epis = [], isLoading } = useEpis()
  const { data: estoque } = useEstoqueEpi()
  const [busca, setBusca] = useState('')
  const [quick, setQuick] = useState<'todos' | 'ca_vencido' | 'inativos'>('todos')
  const [vista, setVista] = useState<'tabela' | 'cards'>('tabela')

  const hoje = new Date().toISOString().slice(0, 10)
  const saldoDe = (id: string) => estoque?.saldo.get(id) ?? 0
  const q = busca.trim().toLowerCase()
  const filt = epis.filter(e =>
    (!q || e.nome.toLowerCase().includes(q) || (e.ca ?? '').includes(q) || (e.fabricante ?? '').toLowerCase().includes(q))
    && (quick === 'inativos' ? !e.ativo : e.ativo || quick === 'ca_vencido')
    && (quick !== 'ca_vencido' || (e.validade_ca && e.validade_ca < hoje))
  )
  const caVencidos = epis.filter(e => e.ativo && e.validade_ca && e.validade_ca < hoje).length

  const fmtD = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
  const badgeEstoque = (e: QsmaEpi) => {
    const s = saldoDe(e.id)
    const min = (e as { estoque_minimo?: number }).estoque_minimo ?? 0
    const cls = s <= 0
      ? (isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700')
      : min > 0 && s < min
        ? (isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700')
        : (isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600')
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{s}</span>
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl border p-2 flex items-center gap-2 flex-wrap ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
        {subTabs}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs min-w-[160px] flex-1 ${isDark ? 'bg-white/[0.05] border-white/10' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txtMuted} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar EPI, CA ou fabricante…" className={`bg-transparent outline-none w-full ${txtMain}`} />
        </div>
        <div className={`inline-flex p-1 rounded-xl ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          {([['todos', 'Ativos'], ['ca_vencido', `CA vencido${caVencidos ? ` (${caVencidos})` : ''}`], ['inativos', 'Inativos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setQuick(k)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${quick === k ? (isDark ? 'bg-sky-500/20 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}>{l}</button>
          ))}
        </div>
        <div className={`inline-flex p-0.5 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <button onClick={() => setVista('tabela')} title="Lista"
            className={`p-1.5 rounded-md ${vista === 'tabela' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><List size={15} /></button>
          <button onClick={() => setVista('cards')} title="Cards"
            className={`p-1.5 rounded-md ${vista === 'cards' ? (isDark ? 'bg-white/10 text-sky-300' : 'bg-white text-sky-700 shadow-sm') : txtMuted}`}><LayoutGrid size={15} /></button>
        </div>
        <BotaoNovo label="EPI no catálogo" onClick={onNovoEpi} />
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-sky-500" /></div>
      ) : filt.length === 0 ? (
        <Vazio isDark={isDark} texto="Nenhum EPI encontrado" />
      ) : vista === 'tabela' ? (
        <div className={`rounded-2xl border overflow-x-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                <th className="text-left px-3 py-2 font-semibold">EPI</th>
                <th className="text-left px-3 py-2 font-semibold w-[90px]">CA</th>
                <th className="text-left px-3 py-2 font-semibold w-[110px]">VALIDADE CA</th>
                <th className="text-left px-3 py-2 font-semibold">FABRICANTE</th>
                <th className="text-center px-3 py-2 font-semibold w-[90px]">ESTOQUE</th>
                <th className="text-left px-3 py-2 font-semibold w-[110px]">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filt.map(e => {
                const vencido = e.validade_ca && e.validade_ca < hoje
                return (
                  <tr key={e.id} onClick={() => onEditEpi(e)}
                    className={`cursor-pointer border-t transition-colors ${isDark ? 'border-white/[0.04] hover:bg-white/[0.04]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-3 py-2 font-semibold ${txtMain}`}>{e.nome}</td>
                    <td className={`px-3 py-2 font-mono ${txtMuted}`}>{e.ca ?? '—'}</td>
                    <td className={`px-3 py-2 ${vencido ? 'text-red-500 font-bold' : txtMuted}`}>{fmtD(e.validade_ca)}</td>
                    <td className={`px-3 py-2 truncate max-w-[220px] ${txtMuted}`}>{e.fabricante ?? '—'}</td>
                    <td className="px-3 py-2 text-center">{badgeEstoque(e)}</td>
                    <td className="px-3 py-2">
                      {vencido
                        ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>CA vencido</span>
                        : e.ativo
                          ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Ativo</span>
                          : <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Inativo</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filt.map(e => {
            const vencido = e.validade_ca && e.validade_ca < hoje
            return (
              <button key={e.id} onClick={() => onEditEpi(e)} className={`${card} p-3.5 text-left transition-all hover:border-sky-400/50`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${txtMain}`}>{e.nome}</p>
                  {badgeEstoque(e)}
                </div>
                <p className={`text-[11px] mt-0.5 ${vencido ? 'text-red-500 font-semibold' : txtMuted}`}>
                  {e.ca ? `CA ${e.ca} · val. ${fmtD(e.validade_ca)}` : 'sem CA'}{vencido ? ' ⚠ vencido' : ''}
                </p>
                <p className={`text-[11px] truncate ${txtMuted}`}>{e.fabricante ?? '—'}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
