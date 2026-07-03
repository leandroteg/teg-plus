import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardList, CalendarRange, CheckCircle2, Plus, ChevronUp, ChevronDown,
  Trash2, Ban, ShieldCheck, Play, Loader2, HardHat,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import ControladoriaFlow, { type FlowStep } from '../../components/ControladoriaFlow'
import { useModelosChecklist, useSalvarModelo, useInspecoes, useSalvarInspecao } from '../../hooks/useQsma'
import { QsmaModal, ModalFooter, FotosUpload, fmtData } from '../../components/qsma/ModalBits'
import { QsmaToolbar, ToolbarSelect, ToolbarPills, BotaoNovo, MultiCheck } from '../../components/qsma/Toolbar'
import { ObraPicker, ColaboradorPicker, VeiculoPicker, pickerInputCls, pickerLabelCls } from '../../components/qsma/Pickers'
import { useObrasComProjeto, usePlanejamentoEquipe } from '../../hooks/useObras'
import type { QsmaModeloChecklist, QsmaInspecao, ItemChecklist, RespostaItem, TipoModelo, EscopoModelo, TipoResposta } from '../../types/qsma'
import { TIPO_MODELO_LABEL, ESCOPO_MODELO_LABEL, STATUS_INSPECAO_LABEL } from '../../types/qsma'

const STEPS: FlowStep[] = [
  {
    key: 'modelos', label: 'Modelos',
    description: 'Monte os checklists configuráveis: itens, tipo de resposta e veredito.',
    icon: ClipboardList,
    accent: { bg: 'hover:bg-sky-50', bgActive: 'bg-sky-50', text: 'text-sky-600', textActive: 'text-sky-800', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700' },
  },
  {
    key: 'programacao', label: 'Programação',
    description: 'Agende inspeções por obra, equipe ou veículo.',
    icon: CalendarRange,
    accent: { bg: 'hover:bg-amber-50', bgActive: 'bg-amber-50', text: 'text-amber-600', textActive: 'text-amber-800', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700' },
  },
  {
    key: 'execucoes', label: 'Execuções',
    description: 'Inspeções realizadas com respostas, evidências e veredito.',
    icon: CheckCircle2,
    accent: { bg: 'hover:bg-emerald-50', bgActive: 'bg-emerald-50', text: 'text-emerald-600', textActive: 'text-emerald-800', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  },
]

export default function QsmaInspecoes() {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState<string>(params.get('aba') ?? 'modelos')
  const [modalModelo, setModalModelo] = useState<QsmaModeloChecklist | 'novo' | null>(null)
  const [modalProgramar, setModalProgramar] = useState<{ obraId?: string } | null>(null)
  const [executar, setExecutar] = useState<QsmaInspecao | null>(null)

  // deep-link do Novo Registro: /qsma/inspecoes?novo=programar
  useEffect(() => {
    const novo = params.get('novo')
    if (novo === 'programar') { setAba('programacao'); setModalProgramar({}) }
    if (novo === 'modelo') { setAba('modelos'); setModalModelo('novo') }
    if (novo) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: modelos = [] } = useModelosChecklist()
  const { data: inspecoes = [] } = useInspecoes()
  const { data: obras = [] } = useObrasComProjeto()
  const { data: equipeObras = [] } = usePlanejamentoEquipe()
  const obraNome = (id?: string) => obras.find(o => o.id === id)?.nome ?? '—'

  // TSTs alocados na programação do módulo Obras (vínculo pedido: só segurança)
  const tsts = useMemo(() => equipeObras.filter(r =>
    ['planejado', 'mobilizado', 'ativo'].includes(r.status)
    && /seguran|tst|sesmt/i.test(r.funcao ?? '')
  ), [equipeObras])

  // filtros por aba (busca + selects na primeira linha, padrão do sistema)
  const [busca, setBusca] = useState('')
  const [tipoF, setTipoF] = useState('')
  const [grupoF, setGrupoF] = useState('')
  const [exObras, setExObras] = useState<Set<string>>(new Set())
  const [veredF, setVeredF] = useState('todos')
  const obrasComRegistro = useMemo(() => {
    const ids = new Set(inspecoes.map(i => i.obra_id).filter(Boolean))
    return obras.filter(o => ids.has(o.id)).map(o => ({ value: o.id, label: o.nome }))
  }, [inspecoes, obras])

  const q = busca.trim().toLowerCase()
  const grupos = useMemo(() => [...new Set(modelos.map(m => m.grupo).filter(Boolean))].sort() as string[], [modelos])
  const modelosF = useMemo(() => modelos.filter(m =>
    (!q || m.nome.toLowerCase().includes(q) || (m.codigo ?? '').toLowerCase().includes(q))
    && (!tipoF || m.tipo === tipoF)
    && (!grupoF || m.grupo === grupoF)
  ), [modelos, q, tipoF, grupoF])
  // agrupado por "tipo de guia" (grupo) p/ renderização com headers
  const modelosPorGrupo = useMemo(() => {
    const map = new Map<string, typeof modelos>()
    for (const m of modelosF) {
      const g = m.grupo || 'Sem grupo'
      map.set(g, [...(map.get(g) ?? []), m])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [modelosF])
  const programadas = useMemo(() => inspecoes.filter(i =>
    i.status === 'programada'
    && !exObras.has(i.obra_id ?? '')
    && (!q || (i.modelo?.nome ?? '').toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q))
  ), [inspecoes, exObras, q])
  const executadas = useMemo(() => inspecoes.filter(i =>
    i.status === 'executada'
    && !exObras.has(i.obra_id ?? '')
    && (!q || (i.modelo?.nome ?? '').toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q) || (i.executor_nome ?? '').toLowerCase().includes(q))
    && (veredF === 'todos' || (veredF === 'bloqueado' ? i.veredito === 'bloqueado' : veredF === 'liberado' ? i.veredito === 'liberado' : true))
  ), [inspecoes, exObras, q, veredF])

  const card = `rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200 shadow-sm'}`
  const txtMain = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <ControladoriaFlow
      title="Inspeções"
      subtitle="Checklists de campo — montar, programar e executar com evidência e veredito"
      steps={STEPS}
      activeStep={aba}
      onStepChange={setAba}
    >
      {/* ── Aba Modelos ── */}
      {aba === 'modelos' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${modelosF.length} modelo${modelosF.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar modelo ou código…"
            acoes={<BotaoNovo label="Novo Modelo" onClick={() => setModalModelo('novo')} />}
          >
            <ToolbarSelect
              isDark={isDark} value={grupoF} onChange={setGrupoF} allLabel="Todos os tipos de guia"
              options={grupos.map(g => ({ value: g, label: g }))}
            />
            <ToolbarSelect
              isDark={isDark} value={tipoF} onChange={setTipoF} allLabel="Todos os tipos"
              options={(Object.keys(TIPO_MODELO_LABEL) as (keyof typeof TIPO_MODELO_LABEL)[]).map(t => ({ value: t, label: TIPO_MODELO_LABEL[t] }))}
            />
          </QsmaToolbar>
          {modelosF.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhum modelo de checklist — crie o primeiro" />
          ) : (
            <div className="space-y-4">
              {modelosPorGrupo.map(([grupo, lista]) => (
                <div key={grupo}>
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${txtMuted}`}>{grupo}</p>
                    <span className={`text-[9px] font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>({lista.length})</span>
                    <div className={`flex-1 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lista.map(m => (
                      <button key={m.id} onClick={() => setModalModelo(m)} className={`text-left ${card} p-4 hover:shadow-md transition-all`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700'}`}>{m.codigo ?? '—'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${m.ativo
                            ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                            : isDark ? 'bg-slate-500/15 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                        <p className={`text-sm font-bold leading-snug ${txtMain}`}>{m.nome}</p>
                        <p className={`text-[10px] mt-1 ${txtMuted}`}>
                          {TIPO_MODELO_LABEL[m.tipo]} · {ESCOPO_MODELO_LABEL[m.escopo]} · {m.itens.length} item(ns)
                          {m.exige_veredito && ' · com veredito'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Programação ── */}
      {aba === 'programacao' && (
        <div className="space-y-3">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${programadas.length} programada${programadas.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar inspeção…"
            acoes={<BotaoNovo label="Programar Inspeção" onClick={() => setModalProgramar({})} />}
          >
            <MultiCheck isDark={isDark} label="Obras" options={obrasComRegistro} excluded={exObras} setExcluded={setExObras} />
          </QsmaToolbar>

          {/* TSTs em campo — vínculo com a programação do módulo Obras */}
          <div className={`rounded-2xl border p-4 ${isDark ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-amber-200 bg-amber-50/40'}`}>
            <p className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              <HardHat size={11} /> TSTs em campo · programação de Obras ({tsts.length})
            </p>
            {tsts.length === 0 ? (
              <p className={`text-[11px] italic ${txtMuted}`}>
                Nenhum Técnico de Segurança alocado na programação de Obras — aloque em Obras › Alocação de Equipes.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {tsts.map(t => (
                  <div key={t.id} className={`rounded-xl border p-3 flex items-center gap-3 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${txtMain}`}>{t.nome}</p>
                      <p className={`text-[10px] truncate ${txtMuted}`}>
                        {obraNome(t.obra_id)} · desde {fmtData(t.data_inicio)}{t.data_fim ? ` até ${fmtData(t.data_fim)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setModalProgramar({ obraId: t.obra_id })}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      title={`Programar inspeção na obra ${obraNome(t.obra_id)}`}
                    >
                      <Plus size={10} /> Programar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {programadas.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhuma inspeção programada" />
          ) : (
            <div className="space-y-2">
              {programadas.map(i => (
                <div key={i.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${txtMain}`}>
                      <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{i.codigo}</span>
                      {i.modelo?.nome ?? 'Checklist'}
                    </p>
                    <p className={`text-[11px] ${txtMuted}`}>{obraNome(i.obra_id)}{i.frente ? ` · ${i.frente}` : ''} · prevista {fmtData(i.data_prevista)}</p>
                  </div>
                  <button
                    onClick={() => setExecutar(i)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <Play size={11} /> Executar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Execuções ── */}
      {aba === 'execucoes' && (
        <div className="space-y-2">
          <QsmaToolbar
            isDark={isDark}
            contagem={`${executadas.length} executada${executadas.length !== 1 ? 's' : ''}`}
            busca={busca} onBusca={setBusca} placeholder="Buscar código, modelo, executor…"
          >
            <MultiCheck isDark={isDark} label="Obras" options={obrasComRegistro} excluded={exObras} setExcluded={setExObras} />
            <ToolbarPills
              isDark={isDark} value={veredF} onChange={setVeredF}
              options={[{ value: 'todos', label: 'Todas' }, { value: 'liberado', label: 'Liberadas' }, { value: 'bloqueado', label: 'Bloqueadas' }]}
            />
          </QsmaToolbar>
          {executadas.length === 0 ? (
            <Vazio isDark={isDark} texto="Nenhuma inspeção executada ainda" />
          ) : executadas.map(i => {
            const nc = i.respostas.filter(r => r.resposta === 'nc').length
            return (
              <div key={i.id} className={`${card} p-3.5 flex items-center gap-3 flex-wrap`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${txtMain}`}>
                    <span className={`font-mono text-[10px] mr-2 ${txtMuted}`}>{i.codigo}</span>
                    {i.modelo?.nome ?? 'Checklist'}
                  </p>
                  <p className={`text-[11px] ${txtMuted}`}>
                    {obraNome(i.obra_id)} · {fmtData(i.data_execucao)} · {i.executor_nome ?? '—'}
                    {nc > 0 && <span className="text-red-500 font-semibold"> · {nc} NC</span>}
                  </p>
                </div>
                {i.veredito && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    i.veredito === 'liberado'
                      ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      : isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-100 text-red-700'
                  }`}>
                    {i.veredito === 'liberado' ? <ShieldCheck size={11} /> : <Ban size={11} />}
                    {i.veredito === 'liberado' ? 'LIBERADO' : 'BLOQUEADO'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modais ── */}
      {modalModelo && (
        <ModeloChecklistModal
          isDark={isDark}
          modelo={modalModelo === 'novo' ? null : modalModelo}
          grupos={grupos}
          onClose={() => setModalModelo(null)}
        />
      )}
      {modalProgramar && (
        <ProgramarInspecaoModal isDark={isDark} modelos={modelos.filter(m => m.ativo)} defaultObraId={modalProgramar.obraId} onClose={() => setModalProgramar(null)} />
      )}
      {executar && (
        <ExecutarInspecaoModal isDark={isDark} inspecao={executar} onClose={() => setExecutar(null)} />
      )}
    </ControladoriaFlow>
  )
}

function Vazio({ isDark, texto }: { isDark: boolean; texto: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
      <ClipboardList size={36} className="mb-2" />
      <p className="text-sm">{texto}</p>
    </div>
  )
}

// ── Modal: builder de modelo de checklist ────────────────────────────────────

function ModeloChecklistModal({ isDark, modelo, grupos, onClose }: { isDark: boolean; modelo: QsmaModeloChecklist | null; grupos: string[]; onClose: () => void }) {
  const salvar = useSalvarModelo()
  const { perfil } = useAuth()
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [grupo, setGrupo] = useState(modelo?.grupo ?? '')
  const [tipo, setTipo] = useState<TipoModelo>(modelo?.tipo ?? 'inspecao')
  const [escopo, setEscopo] = useState<EscopoModelo>(modelo?.escopo ?? 'equipe')
  const [exigeVeredito, setExigeVeredito] = useState(modelo?.exige_veredito ?? false)
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true)
  const [itens, setItens] = useState<ItemChecklist[]>(modelo?.itens ?? [])

  const erros: string[] = []
  if (!nome.trim()) erros.push('informe o nome')
  if (itens.length === 0) erros.push('adicione ao menos 1 item')
  if (itens.some(i => !i.texto.trim())) erros.push('há item sem texto')

  function addItem() {
    setItens(prev => [...prev, { ordem: prev.length + 1, texto: '', tipo_resposta: 'cna' }])
  }
  function move(i: number, delta: number) {
    setItens(prev => {
      const arr = [...prev]
      const j = i + delta
      if (j < 0 || j >= arr.length) return prev
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr.map((x, k) => ({ ...x, ordem: k + 1 }))
    })
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={modelo ? `Editar modelo ${modelo.codigo ?? ''}` : 'Novo modelo de checklist'} subtitulo="Itens configuráveis — o executor responde item a item no campo" onClose={onClose}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={pickerLabelCls(isDark)}>Nome *</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Inspeção diária de equipe LV" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoModelo)} className={pickerInputCls(isDark)}>
            {(Object.keys(TIPO_MODELO_LABEL) as TipoModelo[]).map(t => <option key={t} value={t}>{TIPO_MODELO_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Escopo</label>
          <select value={escopo} onChange={e => setEscopo(e.target.value as EscopoModelo)} className={pickerInputCls(isDark)}>
            {(Object.keys(ESCOPO_MODELO_LABEL) as EscopoModelo[]).map(t => <option key={t} value={t}>{ESCOPO_MODELO_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={pickerLabelCls(isDark)}>Grupo (tipo de guia)</label>
          <input
            value={grupo} onChange={e => setGrupo(e.target.value)} list="qsma-grupos-guia"
            placeholder="Ex.: Inspeção Trabalho (Distribuição)" className={pickerInputCls(isDark)}
          />
          <datalist id="qsma-grupos-guia">
            {grupos.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={exigeVeredito} onChange={e => setExigeVeredito(e.target.checked)} className="accent-red-600" />
          Exige veredito Liberado/Bloqueado
        </label>
        <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="accent-red-600" />
          Ativo
        </label>
      </div>

      {/* Itens */}
      <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Itens do checklist ({itens.length})</span>
          <button onClick={addItem} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
            isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
            <Plus size={10} /> Item
          </button>
        </div>
        {itens.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono w-5 text-right shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}.</span>
            <input
              value={item.texto}
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
              placeholder="O que verificar?"
              className={`${pickerInputCls(isDark)} flex-1`}
            />
            <select
              value={item.tipo_resposta}
              onChange={e => setItens(prev => prev.map((x, j) => j === i ? { ...x, tipo_resposta: e.target.value as TipoResposta } : x))}
              className={`${pickerInputCls(isDark)} w-28 shrink-0`}
            >
              <option value="cna">C / NC / NA</option>
              <option value="texto">Texto</option>
              <option value="numero">Número</option>
            </select>
            <div className="flex flex-col shrink-0">
              <button onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-600 p-0.5"><ChevronUp size={11} /></button>
              <button onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-600 p-0.5"><ChevronDown size={11} /></button>
            </div>
            <button onClick={() => setItens(prev => prev.filter((_, j) => j !== i).map((x, k) => ({ ...x, ordem: k + 1 })))} className="text-slate-400 hover:text-red-500 p-1 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {itens.length === 0 && <p className={`text-[10px] italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Sem itens — clique em "+ Item"</p>}
      </div>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        salvando={salvar.isPending}
        onCancel={onClose}
        onSave={() => salvar.mutate(
          { id: modelo?.id, nome: nome.trim(), grupo: grupo.trim() || undefined, tipo, escopo, exige_veredito: exigeVeredito, ativo, itens, criado_por_nome: perfil?.nome },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: programar inspeção ────────────────────────────────────────────────

function ProgramarInspecaoModal({ isDark, modelos, defaultObraId, onClose }: { isDark: boolean; modelos: QsmaModeloChecklist[]; defaultObraId?: string; onClose: () => void }) {
  const salvar = useSalvarInspecao()
  const [modeloId, setModeloId] = useState('')
  const [obraId, setObraId] = useState(defaultObraId ?? '')
  const [frente, setFrente] = useState('')
  const [liderId, setLiderId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [dataPrevista, setDataPrevista] = useState(new Date().toISOString().split('T')[0])

  const modelo = modelos.find(m => m.id === modeloId)
  const erros: string[] = []
  if (!modeloId) erros.push('escolha o modelo')
  if (!obraId) erros.push('escolha a obra')
  if (!dataPrevista) erros.push('informe a data prevista')
  if (modelo?.escopo === 'veiculo' && !veiculoId) erros.push('escopo do modelo é veículo — selecione o veículo')

  return (
    <QsmaModal isDark={isDark} titulo="Programar inspeção" subtitulo="Gera uma pendência para execução em campo" onClose={onClose}>
      <div>
        <label className={pickerLabelCls(isDark)}>Modelo de checklist *</label>
        <select value={modeloId} onChange={e => setModeloId(e.target.value)} className={pickerInputCls(isDark)}>
          <option value="">Selecione…</option>
          {[...new Set(modelos.map(m => m.grupo || 'Outros'))].sort().map(g => (
            <optgroup key={g} label={g}>
              {modelos.filter(m => (m.grupo || 'Outros') === g).map(m => (
                <option key={m.id} value={m.id}>{m.codigo ? `${m.codigo} · ` : ''}{m.nome}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <ObraPicker isDark={isDark} value={obraId} onChange={id => { setObraId(id); setVeiculoId('') }} required />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={pickerLabelCls(isDark)}>Frente</label>
          <input value={frente} onChange={e => setFrente(e.target.value)} placeholder="Opcional" className={pickerInputCls(isDark)} />
        </div>
        <div>
          <label className={pickerLabelCls(isDark)}>Data prevista *</label>
          <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className={pickerInputCls(isDark)} />
        </div>
      </div>
      <ColaboradorPicker isDark={isDark} value={liderId} onChange={setLiderId} label="Líder da equipe inspecionada" />
      {(modelo?.escopo === 'veiculo' || veiculoId) && (
        <VeiculoPicker isDark={isDark} value={veiculoId} onChange={setVeiculoId} obraId={obraId || undefined} required={modelo?.escopo === 'veiculo'} />
      )}
      <ModalFooter
        isDark={isDark}
        erros={erros}
        salvando={salvar.isPending}
        onCancel={onClose}
        saveLabel="Programar"
        onSave={() => salvar.mutate(
          {
            modelo_id: modeloId, obra_id: obraId, frente: frente || undefined,
            equipe_lider_id: liderId || undefined, veiculo_id: veiculoId || undefined,
            data_prevista: dataPrevista, status: 'programada',
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

// ── Modal: executar inspeção (wizard item a item) ────────────────────────────

function ExecutarInspecaoModal({ isDark, inspecao, onClose }: { isDark: boolean; inspecao: QsmaInspecao; onClose: () => void }) {
  const salvar = useSalvarInspecao()
  const { perfil } = useAuth()
  const itens = inspecao.modelo?.itens ?? []
  const [respostas, setRespostas] = useState<RespostaItem[]>(
    itens.map(it => ({ ordem: it.ordem, resposta: undefined, obs: '', foto_paths: [] })),
  )
  const [obs, setObs] = useState('')
  const [veredito, setVeredito] = useState<'liberado' | 'bloqueado' | ''>('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [pedindoGps, setPedindoGps] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
    setPedindoGps(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPedindoGps(false) },
      () => setPedindoGps(false),
      { timeout: 8000 },
    )
  }, [])

  const respondidos = respostas.filter(r => r.resposta != null && r.resposta !== '').length
  const ncs = respostas.filter(r => r.resposta === 'nc').length
  const erros: string[] = []
  if (respondidos < itens.length) erros.push(`responda todos os itens (${respondidos}/${itens.length})`)
  if (inspecao.modelo?.exige_veredito && !veredito) erros.push('defina o veredito')
  const avisos: string[] = []
  if (ncs > 0) avisos.push(`${ncs} não conformidade(s) — considere registrar ocorrência/ação`)

  function responder(i: number, patch: Partial<RespostaItem>) {
    setRespostas(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  return (
    <QsmaModal isDark={isDark} wide titulo={`Executar ${inspecao.codigo ?? 'inspeção'}`} subtitulo={inspecao.modelo?.nome} onClose={onClose}>
      {/* progresso */}
      <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(respondidos / Math.max(1, itens.length)) * 100}%` }} />
      </div>

      <div className="space-y-3">
        {itens.map((item, i) => {
          const r = respostas[i]
          const tipoItem = item.tipo_resposta ?? 'cna'
          return (
            <div key={i} className={`rounded-xl border p-3 ${
              r?.resposta === 'nc'
                ? isDark ? 'border-red-500/30 bg-red-500/[0.04]' : 'border-red-200 bg-red-50/40'
                : isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-white'
            }`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span className={`font-mono mr-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}.</span>
                {item.texto}
              </p>
              {tipoItem === 'cna' ? (
                <div className="flex gap-1.5">
                  {([['c', 'Conforme', 'emerald'], ['nc', 'Não conforme', 'red'], ['na', 'N/A', 'slate']] as const).map(([v, l, tone]) => (
                    <button
                      key={v}
                      onClick={() => responder(i, { resposta: v })}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        r?.resposta === v
                          ? tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white'
                            : tone === 'red' ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-slate-500 border-slate-500 text-white'
                          : isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.05]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={tipoItem === 'numero' ? 'number' : 'text'}
                  value={r?.resposta ?? ''}
                  onChange={e => responder(i, { resposta: e.target.value })}
                  placeholder={tipoItem === 'numero' ? '0' : 'Resposta…'}
                  className={pickerInputCls(isDark)}
                />
              )}
              {(r?.resposta === 'nc' || item.foto_obrigatoria) && (
                <div className="mt-2 space-y-2">
                  <input
                    value={r?.obs ?? ''}
                    onChange={e => responder(i, { obs: e.target.value })}
                    placeholder="Descreva a não conformidade…"
                    className={pickerInputCls(isDark)}
                  />
                  <FotosUpload
                    isDark={isDark}
                    pasta={`inspecoes/${inspecao.id}/item-${i + 1}`}
                    paths={r?.foto_paths ?? []}
                    onChange={p => responder(i, { foto_paths: p })}
                    label="Foto da NC"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div>
        <label className={pickerLabelCls(isDark)}>Observações gerais</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={pickerInputCls(isDark)} />
      </div>

      {inspecao.modelo?.exige_veredito && (
        <div className="flex gap-2">
          <button
            onClick={() => setVeredito('liberado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'liberado' ? 'bg-emerald-600 border-emerald-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-emerald-500/10' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'
            }`}
          >
            <ShieldCheck size={14} /> LIBERADO
          </button>
          <button
            onClick={() => setVeredito('bloqueado')}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
              veredito === 'bloqueado' ? 'bg-red-600 border-red-600 text-white'
                : isDark ? 'border-white/10 text-slate-300 hover:bg-red-500/10' : 'border-slate-200 text-slate-600 hover:bg-red-50'
            }`}
          >
            <Ban size={14} /> BLOQUEADO
          </button>
        </div>
      )}

      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {pedindoGps ? <span className="inline-flex items-center gap-1"><Loader2 size={9} className="animate-spin" /> obtendo GPS…</span>
          : gps ? `📍 ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : '📍 GPS indisponível'}
      </p>

      <ModalFooter
        isDark={isDark}
        erros={erros}
        avisos={avisos}
        salvando={salvar.isPending}
        onCancel={onClose}
        saveLabel="Concluir inspeção"
        onSave={() => salvar.mutate(
          {
            id: inspecao.id,
            respostas,
            observacoes: obs || undefined,
            veredito: (veredito || null) as never,
            latitude: gps?.lat, longitude: gps?.lng,
            data_execucao: new Date().toISOString(),
            executor_id: perfil?.id, executor_nome: perfil?.nome,
            status: 'executada',
          },
          { onSuccess: onClose, onError: (e: any) => alert(`Erro: ${e?.message ?? 'desconhecido'}`) },
        )}
      />
    </QsmaModal>
  )
}

export { STATUS_INSPECAO_LABEL }
