import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ShieldCheck, GraduationCap, Siren, Plus, Pencil, Link2,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import {
  useRiscos, useSalvarRisco, useEpis, useSalvarEpi, useEpiEntregas, useRegistrarEntregaEpi,
  useTreinamentos, useSalvarTreinamento, useOcorrencias, useSalvarOcorrencia,
  useCriarAcaoOcorrencia, useAcoesQsma,
} from '../../hooks/useQsma'
import { QsmaModal, ModalFooter, FotosUpload, fmtData } from '../../components/qsma/ModalBits'
import { ObraPicker, ColaboradorPicker, VeiculoPicker, pickerInputCls, pickerLabelCls } from '../../components/qsma/Pickers'
import { useObrasComProjeto } from '../../hooks/useObras'
import type {
  QsmaRisco, QsmaEpi, QsmaTreinamento, QsmaOcorrencia,
  EscopoRisco, TipoOcorrencia, Gravidade, Envolvido, StatusOcorrencia,
} from '../../types/qsma'
import {
  nivelRisco, NORMAS_TREINAMENTO, TIPO_OCORRENCIA_LABEL, GRAVIDADE_LABEL, STATUS_OCORRENCIA_LABEL,
} from '../../types/qsma'

const STEPS: FlowStep[] = [
  {
    key: 'riscos', label: 'Riscos (PGR/APR)',
    description: 'Inventário de riscos por GHE e análise preliminar por tarefa — matriz 5×5.',
    icon: AlertTriangle,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
  {
    key: 'epis', label: 'EPIs',
    description: 'Catálogo com CA e fichas de entrega assinadas via PortalTEG.',
    icon: ShieldCheck,
    accent: { bg: 'hover:bg-violet-50', bgActive: 'bg-violet-50', text: 'text-violet-600', textActive: 'text-violet-800', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700' },
  },
  {
    key: 'treinamentos', label: 'Treinamentos',
    description: 'Matriz de NRs por colaborador com vencimentos e reciclagens.',
    icon: GraduationCap,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'ocorrencias', label: 'Ocorrências',
    description: 'Registro → investigação (causa raiz) → ações corretivas no SGI.',
    icon: Siren,
    accent: { bg: 'hover:bg-red-50', bgActive: 'bg-red-50', text: 'text-red-600', textActive: 'text-red-800', border: 'border-red-500', badge: 'bg-red-100 text-red-700' },
  },
]

const KANBAN: StatusOcorrencia[] = ['registro', 'investigacao', 'acao', 'encerrada']

export default function QsmaSeguranca() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<string>(params.get('aba') ?? 'riscos')
  const [modalRisco, setModalRisco] = useState<QsmaRisco | 'novo' | null>(null)
  const [modalEpi, setModalEpi] = useState<QsmaEpi | 'novo' | null>(null)
  const [modalEntrega, setModalEntrega] = useState(false)
  const [modalTreinamento, setModalTreinamento] = useState<QsmaTreinamento | 'novo' | null>(null)
  const [modalOcorrencia, setModalOcorrencia] = useState<QsmaOcorrencia | 'novo' | null>(null)

  useEffect(() => {
    const novo = params.get('novo')
    if (novo === 'ocorrencia') { setAba('ocorrencias'); setModalOcorrencia('novo') }
    if (novo === 'epi') { setAba('epis'); setModalEntrega(true) }
    if (novo === 'treinamento') { setAba('treinamentos'); setModalTreinamento('novo') }
    if (novo === 'risco') { setAba('riscos'); setModalRisco('novo') }
    if (novo) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: riscos = [] } = useRiscos()
  const { data: epis = [] } = useEpis()
  const { data: entregas = [] } = useEpiEntregas()
  const { data: treinamentos = [] } = useTreinamentos()
  const { data: ocorrencias = [] } = useOcorrencias()
  const { data: acoes = [] } = useAcoesQsma()
  const { data: obras = [] } = useObrasComProjeto()
  const obraNome = (id?: string) => obras.find(o => o.id === id)?.nome ?? '—'

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const hoje = new Date().toISOString().split('T')[0]

  const btnNovo = (label: string, onClick: () => void) => (
    <div className="flex justify-end">
      <button onClick={onClick} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
        <Plus size={13} /> {label}
      </button>
    </div>
  )

  return (
    <ControladoriaFlow
      title="Segurança"
      subtitle="Prevenir (riscos) → equipar (EPIs) → capacitar (treinamentos) → tratar (ocorrências)"
      steps={STEPS}
      activeStep={aba}
      onStepChange={setAba}
    >
      {/* ── Riscos ── */}
      {aba === 'riscos' && (
        <div className="space-y-3">
          {btnNovo('Novo Risco / APR', () => setModalRisco('novo'))}
          {riscos.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum risco cadastrado — comece pelo inventário PGR ou uma APR" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {riscos.map(r => {
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
      {aba === 'epis' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalEpi('novo')} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
              <Plus size={13} /> EPI no catálogo
            </button>
            <button onClick={() => setModalEntrega(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
              <Plus size={13} /> Registrar Entrega
            </button>
          </div>

          {/* Catálogo */}
          <div className={card}>
            <p className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b ${txtMuted} ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
              Catálogo ({epis.length})
            </p>
            {epis.length === 0 ? (
              <p className={`px-4 py-4 text-xs italic ${txtMuted}`}>Nenhum EPI cadastrado</p>
            ) : (
              <div className="p-3 flex flex-wrap gap-1.5">
                {epis.map(e => {
                  const caVencido = e.validade_ca && e.validade_ca < hoje
                  return (
                    <button key={e.id} onClick={() => setModalEpi(e)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      caVencido
                        ? isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'
                        : isDark ? 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`} title={caVencido ? 'CA vencido!' : undefined}>
                      {e.nome}{e.ca ? ` · CA ${e.ca}` : ''}{caVencido ? ' ⚠' : ''}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Entregas */}
          <div className="space-y-2">
            {entregas.length === 0 ? (
              <Vazio isDark={isDark} texto="Nenhuma entrega de EPI registrada" />
            ) : entregas.map(en => (
              <div key={en.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${txtMain}`}>{en.colaborador_nome ?? '—'}</p>
                  <p className={`text-[11px] ${txtMuted}`}>
                    {en.epi?.nome ?? 'EPI'}{en.epi?.ca ? ` (CA ${en.epi.ca})` : ''} · {en.quantidade}un · {fmtData(en.data_entrega)}
                    {en.data_troca_prevista && ` · troca ${fmtData(en.data_troca_prevista)}`}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${en.assinado
                  ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  : isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
                }`}>
                  {en.assinado ? 'Assinado' : 'Aguard. assinatura'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Treinamentos ── */}
      {aba === 'treinamentos' && (
        <div className="space-y-3">
          {btnNovo('Novo Treinamento', () => setModalTreinamento('novo'))}
          {treinamentos.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum treinamento registrado" />
          ) : (
            <div className="space-y-2">
              {treinamentos.map(t => {
                const vencido = t.vencimento && t.vencimento < hoje
                const vencendo = !vencido && t.vencimento && t.vencimento <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
                return (
                  <div key={t.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${txtMain}`}>{t.colaborador_nome ?? '—'} <span className={`font-normal ${txtMuted}`}>· {t.norma}</span></p>
                      <p className={`text-[11px] ${txtMuted}`}>
                        {t.curso ?? ''} {t.carga_horaria ? `· ${t.carga_horaria}h` : ''} · realizado {fmtData(t.data_realizacao)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      vencido ? isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'
                        : vencendo ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
                        : isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {vencido ? `Vencido ${fmtData(t.vencimento)}` : t.vencimento ? `Vence ${fmtData(t.vencimento)}` : 'Sem vencimento'}
                    </span>
                    <button onClick={() => setModalTreinamento(t)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}>
                      <Pencil size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Ocorrências (kanban) ── */}
      {aba === 'ocorrencias' && (
        <div className="space-y-3">
          {btnNovo('Registrar Ocorrência', () => setModalOcorrencia('novo'))}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {KANBAN.map(st => {
              const cfg = STATUS_OCORRENCIA_LABEL[st]
              const itens = ocorrencias.filter(o => o.status === st)
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
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${isDark ? g.dark : g.light}`}>{g.label}</span>
                          </div>
                          <p className={`text-[11px] font-semibold leading-tight ${txtMain}`}>{TIPO_OCORRENCIA_LABEL[o.tipo]}</p>
                          <p className={`text-[10px] mt-0.5 line-clamp-2 ${txtMuted}`}>{o.descricao}</p>
                          <p className={`text-[9px] mt-1 ${txtMuted}`}>
                            {obraNome(o.obra_id)} · {fmtData(o.data_ocorrencia)}
                            {nAcoes > 0 && <span className="inline-flex items-center gap-0.5 ml-1 text-violet-400"><Link2 size={8} />{nAcoes} ação(ões) SGI</span>}
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
        </div>
      )}

      {/* ── Modais ── */}
      {modalRisco && <RiscoModal isDark={isDark} risco={modalRisco === 'novo' ? null : modalRisco} onClose={() => setModalRisco(null)} />}
      {modalEpi && <EpiCatalogoModal isDark={isDark} epi={modalEpi === 'novo' ? null : modalEpi} onClose={() => setModalEpi(null)} />}
      {modalEntrega && <EntregaEpiModal isDark={isDark} epis={epis.filter(e => e.ativo)} onClose={() => setModalEntrega(false)} />}
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

// ── Modal: EPI no catálogo ───────────────────────────────────────────────────

function EpiCatalogoModal({ isDark, epi, onClose }: { isDark: boolean; epi: QsmaEpi | null; onClose: () => void }) {
  const salvar = useSalvarEpi()
  const [nome, setNome] = useState(epi?.nome ?? '')
  const [ca, setCa] = useState(epi?.ca ?? '')
  const [validadeCa, setValidadeCa] = useState(epi?.validade_ca ?? '')
  const [fabricante, setFabricante] = useState(epi?.fabricante ?? '')
  const [vidaUtil, setVidaUtil] = useState<string>(epi?.vida_util_dias?.toString() ?? '')
  const [ativo, setAtivo] = useState(epi?.ativo ?? true)

  const erros: string[] = []
  if (!nome.trim()) erros.push('informe o nome')
  const avisos: string[] = []
  if (!ca.trim()) avisos.push('EPI sem CA — verifique se é isento')
  if (validadeCa && validadeCa < new Date().toISOString().split('T')[0]) avisos.push('CA vencido')

  return (
    <QsmaModal isDark={isDark} titulo={epi ? 'Editar EPI' : 'Novo EPI no catálogo'} subtitulo="Certificado de Aprovação (CA) validado na entrega" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Luva isolante classe 2" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>CA</label>
          <input value={ca} onChange={e => setCa(e.target.value)} placeholder="Nº do CA" className={pickerInputCls(isDark)} />
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
          <label className={pickerLabelCls(isDark)}>Vida útil (dias)</label>
          <input type="number" value={vidaUtil} onChange={e => setVidaUtil(e.target.value)} placeholder="Ex.: 180" className={pickerInputCls(isDark)} />
        </div>
      </div>
      <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="accent-red-600" />
        Ativo no catálogo
      </label>
      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          { id: epi?.id, nome: nome.trim(), ca: ca || undefined, validade_ca: validadeCa || undefined, fabricante: fabricante || undefined, vida_util_dias: vidaUtil ? Number(vidaUtil) : undefined, ativo },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: Entrega de EPI ────────────────────────────────────────────────────

function EntregaEpiModal({ isDark, epis, onClose }: { isDark: boolean; epis: QsmaEpi[]; onClose: () => void }) {
  const registrar = useRegistrarEntregaEpi()
  const { perfil } = useAuth()
  const [colabId, setColabId] = useState('')
  const [colabNome, setColabNome] = useState('')
  const [obraId, setObraId] = useState('')
  const [epiId, setEpiId] = useState('')
  const [qtd, setQtd] = useState('1')
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0])
  const [motivo, setMotivo] = useState<'entrega' | 'troca' | 'devolucao'>('entrega')

  const epi = epis.find(e => e.id === epiId)
  const hoje = new Date().toISOString().split('T')[0]
  const trocaPrevista = useMemo(() => {
    if (!epi?.vida_util_dias || !dataEntrega) return undefined
    const d = new Date(dataEntrega + 'T12:00:00')
    d.setDate(d.getDate() + epi.vida_util_dias)
    return d.toISOString().split('T')[0]
  }, [epi, dataEntrega])

  const erros: string[] = []
  if (!colabId) erros.push('selecione o colaborador')
  if (!epiId) erros.push('selecione o EPI')
  if (!(Number(qtd) > 0)) erros.push('quantidade inválida')
  const avisos: string[] = []
  if (epi?.validade_ca && epi.validade_ca < hoje) avisos.push(`CA ${epi.ca} está VENCIDO — não entregue este EPI`)

  return (
    <QsmaModal isDark={isDark} titulo="Registrar entrega de EPI" subtitulo="A ficha de entrega vai para assinatura do colaborador no PortalTEG" onClose={onClose}>
      <ColaboradorPicker isDark={isDark} value={colabId} onChange={(id, c) => { setColabId(id); setColabNome(c?.nome ?? '') }} required />
      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>EPI *</label>
          <select value={epiId} onChange={e => setEpiId(e.target.value)} className={pickerInputCls(isDark)}>
            <option value="">Selecione…</option>
            {epis.map(e => <option key={e.id} value={e.id}>{e.nome}{e.ca ? ` · CA ${e.ca}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Qtd *</label>
          <input type="number" min={1} value={qtd} onChange={e => setQtd(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Motivo</label>
          <select value={motivo} onChange={e => setMotivo(e.target.value as never)} className={pickerInputCls(isDark)}>
            <option value="entrega">Entrega</option>
            <option value="troca">Troca</option>
            <option value="devolucao">Devolução</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Data da entrega</label>
          <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Troca prevista</label>
          <input type="date" value={trocaPrevista ?? ''} readOnly disabled className={`${pickerInputCls(isDark)} opacity-60`} />
        </div>
      </div>
      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos} salvando={registrar.isPending} onCancel={onClose} saveLabel="Registrar"
        onSave={() => registrar.mutate(
          {
            epi_id: epiId, colaborador_id: colabId, colaborador_nome: colabNome, obra_id: obraId || undefined,
            quantidade: Number(qtd), data_entrega: dataEntrega, data_troca_prevista: trocaPrevista,
            motivo, entregue_por_nome: perfil?.nome,
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
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
  const criarAcao = useCriarAcaoOcorrencia()
  const { data: acoes = [] } = useAcoesQsma()
  const { perfil } = useAuth()
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
  const [status, setStatus] = useState<StatusOcorrencia>(ocorrencia?.status ?? 'registro')
  const [causa, setCausa] = useState(ocorrencia?.causa_raiz?.causa ?? '')
  const [porques, setPorques] = useState<string[]>(
    (Array.isArray(ocorrencia?.causa_raiz?.analise) ? ocorrencia?.causa_raiz?.analise as string[] : null) ?? ['', '', '', '', ''],
  )
  // nova ação corretiva
  const [acaoTitulo, setAcaoTitulo] = useState('')
  const [acaoPrazo, setAcaoPrazo] = useState('')
  const [acaoRespId, setAcaoRespId] = useState('')

  const minhasAcoes = acoes.filter(a => a.origem_id === ocorrencia?.id)

  const erros: string[] = []
  if (!descricao.trim()) erros.push('descreva a ocorrência')
  if (!obraId) erros.push('selecione a obra')
  if ((tipo === 'acidente_cpt') && !diasAfast) erros.push('acidente c/ afastamento pede os dias')
  const avisos: string[] = []
  if (status !== 'registro' && !causa.trim() && porques.every(p => !p.trim())) avisos.push('investigação sem causa raiz preenchida')

  async function handleSave() {
    try {
      const analisePreenchida = porques.some(p => p.trim())
      const id = await salvar.mutateAsync({
        id: ocorrencia?.id,
        tipo, gravidade, obra_id: obraId, frente: frente || undefined,
        data_ocorrencia: new Date(dataOco).toISOString(),
        local_descricao: localDesc || undefined,
        descricao: descricao.trim(),
        envolvidos, veiculo_id: veiculoId || undefined,
        fotos, dias_afastamento: diasAfast ? Number(diasAfast) : undefined,
        status,
        causa_raiz: (causa.trim() || analisePreenchida)
          ? { metodo: '5porques', analise: porques, causa: causa.trim() || undefined }
          : ocorrencia?.causa_raiz ?? null,
        registrado_por_id: ocorrencia?.registrado_por_id ?? perfil?.id,
        registrado_por_nome: ocorrencia?.registrado_por_nome ?? perfil?.nome,
      })
      // ação corretiva opcional → SGI
      if (acaoTitulo.trim() && id) {
        await criarAcao.mutateAsync({
          ocorrencia_id: id as string, titulo: acaoTitulo.trim(),
          prazo: acaoPrazo || undefined, responsavel_id: acaoRespId || undefined,
          criado_por_nome: perfil?.nome,
        })
      }
      onClose()
    } catch (e: any) {
      alert(`Erro: ${e?.message ?? 'desconhecido'}`)
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
          <label className={pickerLabelCls(isDark)}>Gravidade</label>
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

      {/* Etapa / investigação — só na edição */}
      {isEdit && (
        <>
          <div>
            <label className={pickerLabelCls(isDark)}>Etapa</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(STATUS_OCORRENCIA_LABEL) as StatusOcorrencia[]).map(st => {
                const cfg = STATUS_OCORRENCIA_LABEL[st]
                return (
                  <button key={st} onClick={() => setStatus(st)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    status === st ? 'bg-red-600 border-red-600 text-white'
                      : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {status !== 'registro' && (
            <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Investigação — 5 porquês</span>
              {porques.map((p, i) => (
                <input
                  key={i} value={p}
                  onChange={e => setPorques(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                  placeholder={`${i + 1}º porquê…`}
                  className={pickerInputCls(isDark)}
                />
              ))}
              <div>
                <label className={pickerLabelCls(isDark)}>Causa raiz</label>
                <input value={causa} onChange={e => setCausa(e.target.value)} className={pickerInputCls(isDark)} />
              </div>
            </div>
          )}

          {/* Ações SGI vinculadas */}
          <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-violet-500/20 bg-violet-500/[0.04]' : 'border-violet-200 bg-violet-50/40'}`}>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
              <Link2 size={10} /> Ações corretivas (plano de ação SGI)
            </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <input value={acaoTitulo} onChange={e => setAcaoTitulo(e.target.value)} placeholder="Nova ação corretiva… (opcional)" className={pickerInputCls(isDark)} />
              <input type="date" value={acaoPrazo} onChange={e => setAcaoPrazo(e.target.value)} className={pickerInputCls(isDark)} title="Prazo" />
            </div>
            {acaoTitulo.trim() && (
              <ColaboradorPicker isDark={isDark} value={acaoRespId} onChange={setAcaoRespId} label="Responsável pela ação" />
            )}
          </div>
        </>
      )}

      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos}
        salvando={salvar.isPending || criarAcao.isPending}
        onCancel={onClose}
        saveLabel={isEdit ? 'Salvar' : 'Registrar'}
        onSave={handleSave}
      />
    </QsmaModal>
  )
}
