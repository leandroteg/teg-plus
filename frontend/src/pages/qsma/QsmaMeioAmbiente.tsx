import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileBadge, CalendarDays, Leaf, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import {
  useLicencas, useSalvarLicenca, useAtualizarCondicionante,
  useEventosAmbientais, useSalvarEvento, useAspectos, useSalvarAspecto,
} from '../../hooks/useQsma'
import { QsmaModal, ModalFooter, FotosUpload, fmtData } from '../../components/qsma/ModalBits'
import { QsmaToolbar, ToolbarSelect, BotaoNovo, Contagem } from '../../components/qsma/Toolbar'
import { ObraPicker, ColaboradorPicker, pickerInputCls, pickerLabelCls } from '../../components/qsma/Pickers'
import { useObrasComProjeto } from '../../hooks/useObras'
import type { QsmaLicenca, QsmaCondicionante, QsmaEventoAmbiental, QsmaAspecto, TipoLicenca, StatusLicenca, Recorrencia } from '../../types/qsma'
import { STATUS_LICENCA_LABEL, STATUS_CONDICIONANTE_LABEL, nivelRisco } from '../../types/qsma'

const STEPS: FlowStep[] = [
  {
    key: 'licencas', label: 'Licenças & Condicionantes',
    description: 'Licenças ambientais por obra com condicionantes e alertas de prazo.',
    icon: FileBadge,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
  {
    key: 'calendario', label: 'Calendário Ambiental',
    description: 'Obrigações e eventos ambientais ao longo do ano.',
    icon: CalendarDays,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'aspectos', label: 'Aspectos & Impactos',
    description: 'Levantamento ISO 14001 por atividade e obra.',
    icon: Leaf,
    accent: { bg: 'hover:bg-lime-50', bgActive: 'bg-lime-50', text: 'text-lime-600', textActive: 'text-lime-800', border: 'border-lime-500', badge: 'bg-lime-100 text-lime-700' },
  },
]

export default function QsmaMeioAmbiente() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<string>(params.get('aba') ?? 'licencas')
  const [modalLicenca, setModalLicenca] = useState<QsmaLicenca | 'novo' | null>(null)
  const [modalEvento, setModalEvento] = useState<QsmaEventoAmbiental | 'novo' | null>(null)
  const [modalAspecto, setModalAspecto] = useState<QsmaAspecto | 'novo' | null>(null)
  const [mesCal, setMesCal] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  useEffect(() => {
    const novo = params.get('novo')
    if (novo === 'licenca') { setAba('licencas'); setModalLicenca('novo') }
    if (novo === 'evento') { setAba('calendario'); setModalEvento('novo') }
    if (novo === 'aspecto') { setAba('aspectos'); setModalAspecto('novo') }
    if (novo) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: licencas = [] } = useLicencas()
  const { data: eventos = [] } = useEventosAmbientais()
  const { data: aspectos = [] } = useAspectos()
  const { data: obras = [] } = useObrasComProjeto()
  const atualizarCond = useAtualizarCondicionante()
  const obraNome = (id?: string) => obras.find(o => o.id === id)?.nome ?? 'Geral'

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const hoje = new Date().toISOString().split('T')[0]

  // filtros compactos na primeira linha (padrão do sistema)
  const [busca, setBusca] = useState('')
  const [obraF, setObraF] = useState('')
  const q = busca.trim().toLowerCase()
  const obrasOpts = useMemo(
    () => obras.map(o => ({ value: o.id, label: o.nome })),
    [obras],
  )

  const licencasF = useMemo(() => licencas.filter(l =>
    (!obraF || l.obra_id === obraF)
    && (!q || (l.numero ?? '').toLowerCase().includes(q) || (l.orgao ?? '').toLowerCase().includes(q) || (l.descricao ?? '').toLowerCase().includes(q))
  ), [licencas, obraF, q])
  const aspectosF = useMemo(() => aspectos.filter(a =>
    (!obraF || a.obra_id === obraF)
    && (!q || a.atividade.toLowerCase().includes(q) || a.aspecto.toLowerCase().includes(q) || a.impacto.toLowerCase().includes(q))
  ), [aspectos, obraF, q])

  const eventosDoMes = useMemo(() => eventos.filter(e => e.data?.startsWith(mesCal)), [eventos, mesCal])
  const mesLabel = useMemo(() => {
    const [y, m] = mesCal.split('-').map(Number)
    const l = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return l.charAt(0).toUpperCase() + l.slice(1)
  }, [mesCal])
  function shiftMes(delta: number) {
    const [y, m] = mesCal.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMesCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <ControladoriaFlow
      title="Meio Ambiente"
      subtitle="Licenciar → cumprir condicionantes → monitorar aspectos e impactos"
      steps={STEPS}
      activeStep={aba}
      onStepChange={setAba}
    >
      {/* ── Licenças ── */}
      {aba === 'licencas' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            busca={busca} onBusca={setBusca} placeholder="Buscar nº, órgão ou descrição…"
            acoes={<BotaoNovo label="Nova Licença" onClick={() => setModalLicenca('novo')} />}
          >
            <ToolbarSelect isDark={isDark} value={obraF} onChange={setObraF} allLabel="Todas as obras" options={obrasOpts} />
          </QsmaToolbar>
          <Contagem isDark={isDark} n={licencasF.length} singular="licença" plural="licenças" />
          {licencasF.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhuma licença ambiental cadastrada" />
          ) : (
            <div className="space-y-3">
              {licencasF.map(l => {
                const st = STATUS_LICENCA_LABEL[l.status]
                const vencendo = l.validade && l.status === 'vigente' && l.validade <= new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
                const conds = l.condicionantes ?? []
                return (
                  <div key={l.id} className={`${card} p-4`}>
                    <button onClick={() => setModalLicenca(l)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <p className={`text-sm font-bold ${txtMain}`}>
                          <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{l.codigo}</span>
                          {l.numero ? `${l.numero} · ` : ''}{l.orgao ?? l.tipo}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isDark ? st.dark : st.light}`}>
                          {st.label}{vencendo ? ' ⚠' : ''}
                        </span>
                      </div>
                      <p className={`text-[11px] ${txtMuted}`}>
                        {obraNome(l.obra_id)} · emissão {fmtData(l.emissao)} · validade <b className={vencendo || (l.validade && l.validade < hoje) ? 'text-red-500' : ''}>{fmtData(l.validade)}</b>
                        {l.descricao ? ` · ${l.descricao}` : ''}
                      </p>
                    </button>
                    {conds.length > 0 && (
                      <div className={`mt-3 pt-2 border-t space-y-1 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                        {conds.map(c => {
                          const cst = STATUS_CONDICIONANTE_LABEL[c.status]
                          const atrasada = c.status === 'pendente' && c.prazo && c.prazo < hoje
                          return (
                            <div key={c.id} className="flex items-center gap-2 text-[11px]">
                              <button
                                onClick={() => atualizarCond.mutate({ id: c.id, status: c.status === 'atendida' ? 'pendente' : 'atendida' })}
                                className={`w-3.5 h-3.5 rounded border shrink-0 transition-colors ${
                                  c.status === 'atendida' ? 'bg-emerald-500 border-emerald-500' : isDark ? 'border-white/20' : 'border-slate-300'
                                }`}
                                title="Alternar atendida/pendente"
                              />
                              <span className={`flex-1 truncate ${c.status === 'atendida' ? 'line-through opacity-60' : ''} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                {c.descricao}
                              </span>
                              {c.prazo && <span className={`shrink-0 ${atrasada ? 'text-red-500 font-bold' : txtMuted}`}>{fmtData(c.prazo)}</span>}
                              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${isDark ? (atrasada ? STATUS_CONDICIONANTE_LABEL.atrasada.dark : cst.dark) : (atrasada ? STATUS_CONDICIONANTE_LABEL.atrasada.light : cst.light)}`}>
                                {atrasada ? 'Atrasada' : cst.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Calendário ── */}
      {aba === 'calendario' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
              <button onClick={() => shiftMes(-1)} className={isDark ? 'text-emerald-400' : 'text-emerald-600'}><ChevronLeft size={15} /></button>
              <span className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{mesLabel}</span>
              <button onClick={() => shiftMes(1)} className={isDark ? 'text-emerald-400' : 'text-emerald-600'}><ChevronRight size={15} /></button>
            </div>
            <div className="ml-auto">
              <BotaoNovo label="Novo Evento" onClick={() => setModalEvento('novo')} />
            </div>
          </div>
          <Contagem isDark={isDark} n={eventosDoMes.length} singular="evento no mês" plural="eventos no mês" />
          {eventosDoMes.length === 0 ? (
            <Vazio isDark={isDark} texto={`Nenhum evento ambiental em ${mesLabel}`} />
          ) : (
            <div className="space-y-2">
              {eventosDoMes.map(ev => (
                <button key={ev.id} onClick={() => setModalEvento(ev)} className={`w-full text-left ${card} p-3.5 flex items-center gap-3 hover:shadow-md transition-all`}>
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <span className={`text-sm font-black leading-none ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{ev.data.slice(8, 10)}</span>
                    <span className={`text-[8px] font-bold uppercase ${txtMuted}`}>{mesLabel.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${txtMain}`}>{ev.titulo}</p>
                    <p className={`text-[11px] ${txtMuted}`}>{obraNome(ev.obra_id)}{ev.recorrencia && ev.recorrencia !== 'unica' ? ` · ${ev.recorrencia}` : ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    ev.status === 'realizado' ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      : ev.status === 'cancelado' ? isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-600'
                      : isDark ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700'
                  }`}>{ev.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aspectos ── */}
      {aba === 'aspectos' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            busca={busca} onBusca={setBusca} placeholder="Buscar atividade, aspecto ou impacto…"
            acoes={<BotaoNovo label="Novo Aspecto" onClick={() => setModalAspecto('novo')} />}
          >
            <ToolbarSelect isDark={isDark} value={obraF} onChange={setObraF} allLabel="Todas as obras" options={obrasOpts} />
          </QsmaToolbar>
          <Contagem isDark={isDark} n={aspectosF.length} singular="aspecto" plural="aspectos" />
          {aspectosF.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum aspecto/impacto levantado" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aspectosF.map(a => {
                const nv = nivelRisco(a.severidade, a.severidade)
                return (
                  <button key={a.id} onClick={() => setModalAspecto(a)} className={`text-left ${card} p-4 hover:shadow-md transition-all`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${txtMuted}`}>{obraNome(a.obra_id)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: nv.cor }}>Sev. {a.severidade}</span>
                    </div>
                    <p className={`text-sm font-bold ${txtMain}`}>{a.atividade}</p>
                    <p className={`text-[11px] ${txtMuted}`}>{a.aspecto} → {a.impacto}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modais ── */}
      {modalLicenca && <LicencaModal isDark={isDark} licenca={modalLicenca === 'novo' ? null : modalLicenca} onClose={() => setModalLicenca(null)} />}
      {modalEvento && <EventoModal isDark={isDark} evento={modalEvento === 'novo' ? null : modalEvento} onClose={() => setModalEvento(null)} />}
      {modalAspecto && <AspectoModal isDark={isDark} aspecto={modalAspecto === 'novo' ? null : modalAspecto} onClose={() => setModalAspecto(null)} />}
    </ControladoriaFlow>
  )
}

function Vazio({ isDark, texto }: { isDark: boolean; texto: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
      <Leaf size={36} className="mb-2" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

// ── Modal: Licença + condicionantes dinâmicas ────────────────────────────────

function LicencaModal({ isDark, licenca, onClose }: { isDark: boolean; licenca: QsmaLicenca | null; onClose: () => void }) {
  const salvar = useSalvarLicenca()
  const [obraId, setObraId] = useState(licenca?.obra_id ?? '')
  const [tipo, setTipo] = useState<TipoLicenca>(licenca?.tipo ?? 'licenca')
  const [numero, setNumero] = useState(licenca?.numero ?? '')
  const [orgao, setOrgao] = useState(licenca?.orgao ?? '')
  const [descricao, setDescricao] = useState(licenca?.descricao ?? '')
  const [emissao, setEmissao] = useState(licenca?.emissao ?? '')
  const [validade, setValidade] = useState(licenca?.validade ?? '')
  const [status, setStatus] = useState<StatusLicenca>(licenca?.status ?? 'vigente')
  const [arquivos, setArquivos] = useState<string[]>(licenca?.arquivo_path ? [licenca.arquivo_path] : [])
  const [conds, setConds] = useState<Partial<QsmaCondicionante>[]>(licenca?.condicionantes ?? [])

  const erros: string[] = []
  if (!numero.trim() && !descricao.trim()) erros.push('informe o número ou a descrição')
  const avisos: string[] = []
  if (validade && validade < new Date().toISOString().split('T')[0] && status === 'vigente') avisos.push('validade no passado com status vigente')

  return (
    <QsmaModal isDark={isDark} wide titulo={licenca ? `Editar ${licenca.codigo}` : 'Nova licença ambiental'} subtitulo="Condicionantes geram alerta de prazo no painel" onClose={onClose}>
      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoLicenca)} className={pickerInputCls(isDark)}>
            <option value="licenca">Licença</option>
            <option value="autorizacao">Autorização</option>
            <option value="outorga">Outorga</option>
            <option value="cadastro">Cadastro</option>
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Número</label>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: LO 1234/2026" className={pickerInputCls(isDark)} />
        </div>
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Órgão</label>
          <input value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Ex.: SUPRAM, IBAMA" className={pickerInputCls(isDark)} />
        </div>
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Descrição</label>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Emissão</label>
          <input type="date" value={emissao} onChange={e => setEmissao(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Validade</label>
          <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Status</label>
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(STATUS_LICENCA_LABEL) as StatusLicenca[]).map(st => (
            <button key={st} onClick={() => setStatus(st)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
              status === st ? 'bg-red-600 border-red-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>{STATUS_LICENCA_LABEL[st].label}</button>
          ))}
        </div>
      </div>

      {/* Condicionantes dinâmicas */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Condicionantes ({conds.length})</span>
          <button onClick={() => setConds(prev => [...prev, { descricao: '', status: 'pendente' }])} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
            <Plus size={10} /> Condicionante
          </button>
        </div>
        {conds.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={c.descricao ?? ''}
              onChange={e => setConds(prev => prev.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))}
              placeholder="Descrição da condicionante…"
              className={`${pickerInputCls(isDark)} flex-1`}
            />
            <input
              type="date"
              value={c.prazo ?? ''}
              onChange={e => setConds(prev => prev.map((x, j) => j === i ? { ...x, prazo: e.target.value } : x))}
              className={`${pickerInputCls(isDark)} w-32 shrink-0`}
              title="Prazo"
            />
            {!c.id && (
              <button onClick={() => setConds(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 p-1 shrink-0">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        {conds.length === 0 && <p className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Sem condicionantes</p>}
      </div>

      <FotosUpload isDark={isDark} pasta={`licencas/${licenca?.id ?? 'nova'}`} paths={arquivos} onChange={setArquivos} label="Documento da licença" />

      <ModalFooter
        isDark={isDark} erros={erros} avisos={avisos} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          {
            id: licenca?.id, obra_id: obraId || undefined, tipo, numero: numero || undefined, orgao: orgao || undefined,
            descricao: descricao || undefined, emissao: emissao || undefined, validade: validade || undefined,
            status, arquivo_path: arquivos[0], condicionantes: conds,
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: Evento do calendário ──────────────────────────────────────────────

function EventoModal({ isDark, evento, onClose }: { isDark: boolean; evento: QsmaEventoAmbiental | null; onClose: () => void }) {
  const salvar = useSalvarEvento()
  const [titulo, setTitulo] = useState(evento?.titulo ?? '')
  const [obraId, setObraId] = useState(evento?.obra_id ?? '')
  const [data, setData] = useState(evento?.data ?? new Date().toISOString().split('T')[0])
  const [recorrencia, setRecorrencia] = useState<Recorrencia>((evento?.recorrencia as Recorrencia) ?? 'unica')
  const [descricao, setDescricao] = useState(evento?.descricao ?? '')
  const [status, setStatus] = useState(evento?.status ?? 'previsto')

  const erros: string[] = []
  if (!titulo.trim()) erros.push('informe o título')
  if (!data) erros.push('informe a data')

  return (
    <QsmaModal isDark={isDark} titulo={evento ? 'Editar evento' : 'Novo evento ambiental'} subtitulo="Obrigações, campanhas e monitoramentos do calendário" onClose={onClose}>
      <div>
        <label className={pickerLabelCls(isDark)}>Título *</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Relatório trimestral de supressão" className={pickerInputCls(isDark)} />
      </div>
      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Data *</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Recorrência</label>
          <select value={recorrencia} onChange={e => setRecorrencia(e.target.value as Recorrencia)} className={pickerInputCls(isDark)}>
            <option value="unica">Única</option>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as never)} className={pickerInputCls(isDark)}>
            <option value="previsto">Previsto</option>
            <option value="realizado">Realizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Descrição</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
      </div>
      <ModalFooter
        isDark={isDark} erros={erros} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          { id: evento?.id, titulo: titulo.trim(), obra_id: obraId || undefined, data, recorrencia, descricao: descricao || undefined, status: status as never },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: Aspecto & Impacto ─────────────────────────────────────────────────

function AspectoModal({ isDark, aspecto, onClose }: { isDark: boolean; aspecto: QsmaAspecto | null; onClose: () => void }) {
  const salvar = useSalvarAspecto()
  const [obraId, setObraId] = useState(aspecto?.obra_id ?? '')
  const [atividade, setAtividade] = useState(aspecto?.atividade ?? '')
  const [aspectoTxt, setAspectoTxt] = useState(aspecto?.aspecto ?? '')
  const [impacto, setImpacto] = useState(aspecto?.impacto ?? '')
  const [severidade, setSeveridade] = useState(aspecto?.severidade ?? 3)
  const [controles, setControles] = useState(aspecto?.controles ?? '')

  const erros: string[] = []
  if (!atividade.trim()) erros.push('informe a atividade')
  if (!aspectoTxt.trim()) erros.push('informe o aspecto')
  if (!impacto.trim()) erros.push('informe o impacto')

  return (
    <QsmaModal isDark={isDark} titulo={aspecto ? 'Editar aspecto' : 'Novo aspecto & impacto'} subtitulo="Levantamento ISO 14001 — atividade → aspecto → impacto" onClose={onClose}>
      <ObraPicker isDark={isDark} value={obraId} onChange={setObraId} />
      <div>
        <label className={pickerLabelCls(isDark)}>Atividade *</label>
        <input value={atividade} onChange={e => setAtividade(e.target.value)} placeholder="Ex.: Supressão vegetal na faixa" className={pickerInputCls(isDark)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Aspecto *</label>
          <input value={aspectoTxt} onChange={e => setAspectoTxt(e.target.value)} placeholder="Ex.: Geração de resíduo vegetal" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Impacto *</label>
          <input value={impacto} onChange={e => setImpacto(e.target.value)} placeholder="Ex.: Alteração de habitat" className={pickerInputCls(isDark)} />
        </div>
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Severidade: <b>{severidade}</b></label>
        <input type="range" min={1} max={5} value={severidade} onChange={e => setSeveridade(Number(e.target.value))} className="w-full accent-red-600" />
      </div>
      <div>
        <label className={pickerLabelCls(isDark)}>Medidas de controle</label>
        <textarea value={controles} onChange={e => setControles(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
      </div>
      <ModalFooter
        isDark={isDark} erros={erros} salvando={salvar.isPending} onCancel={onClose}
        onSave={() => salvar.mutate(
          { id: aspecto?.id, obra_id: obraId || undefined, atividade: atividade.trim(), aspecto: aspectoTxt.trim(), impacto: impacto.trim(), severidade, controles: controles || undefined },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}
