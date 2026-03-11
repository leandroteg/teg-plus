import { useState, useCallback } from 'react'
import {
  ClipboardList, Plus, Search, X, Save, Loader2,
  ChevronDown, AlertTriangle, FileInput, ExternalLink, CheckCircle2,
  Trash2, Package2,
} from 'lucide-react'
import {
  useSolicitacoes, useCriarSolicitacao, useAtualizarStatusSolicitacao,
  useAprovarSolicitacao, usePlanejaarSolicitacao, useTransportadoras, useRotas,
} from '../../hooks/useLogistica'
import { useCriarSolicitacao as useCriarSolicitacaoNF } from '../../hooks/useSolicitacoesNF'
import { useConsultaCNPJ } from '../../hooks/useConsultas'
import { StatusBadge } from './LogisticaHome'
import { useTheme } from '../../contexts/ThemeContext'
import type { CriarSolicitacaoPayload, TipoTransporte, StatusSolicitacao } from '../../types/logistica'
import { useNavigate } from 'react-router-dom'

const TIPO_LABEL: Record<TipoTransporte, string> = {
  viagem:                  'Viagem',
  mobilizacao:             'Mobilização',
  transferencia_material:  'Transf. Material',
  transferencia_maquina:   'Transf. Máquina',
}

const EMPTY_FORM: CriarSolicitacaoPayload = {
  tipo: 'transferencia_material',
  origem: '',
  destino: '',
  descricao: '',
  urgente: false,
}

const ALÇADAS = [
  { limite: 500,    label: 'Até R$ 500',         aprovador: 'Coordenador' },
  { limite: 2000,   label: 'R$ 501 a R$ 2.000',  aprovador: 'Gerente' },
  { limite: Infinity, label: 'Acima de R$ 2.000', aprovador: 'Diretoria' },
]

interface PlanejamentoForm {
  modal?: string
  transportadora_id?: string
  veiculo_placa?: string
  motorista_nome?: string
  data_prevista_saida?: string
  custo_estimado?: number
}

function getAlcada(valor?: number) {
  if (!valor) return ALÇADAS[0]
  return ALÇADAS.find(a => valor <= a.limite) ?? ALÇADAS[2]
}

export default function Solicitacoes() {
  const { isDark } = useTheme()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CriarSolicitacaoPayload>({ ...EMPTY_FORM })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [aprovacaoModal, setAprovacaoModal] = useState<{ id: string; titulo: string } | null>(null)
  const [motivoReprovacao, setMotivoReprovacao] = useState('')
  const [planejamentoModal, setPlanejamentoModal] = useState<string | null>(null)
  const [planejForm, setPlanejForm] = useState<PlanejamentoForm>({})
  const [nfModal, setNfModal] = useState<{ solId: string; descricao: string; valor: number; transportadora?: string; cnpj?: string } | null>(null)
  const [nfForm, setNfForm] = useState({ fornecedor_cnpj: '', fornecedor_nome: '', valor_total: 0, descricao: '' })
  const [itensForm, setItensForm] = useState<{ descricao: string; quantidade: number; unidade: string; peso_kg?: number; volume_m3?: number }[]>([])
  const navigate = useNavigate()

  const { data: solicitacoes = [], isLoading } = useSolicitacoes(
    statusFiltro ? { status: statusFiltro as StatusSolicitacao } : undefined
  )
  const { data: transportadoras = [] } = useTransportadoras()
  const { data: rotas = [] } = useRotas()
  const criar = useCriarSolicitacao()
  const atualizarStatus = useAtualizarStatusSolicitacao()
  const aprovar = useAprovarSolicitacao()
  const planejar = usePlanejaarSolicitacao()
  const criarNF = useCriarSolicitacaoNF()
  const cnpjLookup = useConsultaCNPJ(useCallback((r) => {
    setNfForm(prev => ({
      ...prev,
      fornecedor_nome: prev.fornecedor_nome || r.razao_social,
    }))
  }, []))

  const filtradas = busca.trim()
    ? solicitacoes.filter(s =>
        s.numero?.toLowerCase().includes(busca.toLowerCase()) ||
        s.origem.toLowerCase().includes(busca.toLowerCase()) ||
        s.destino.toLowerCase().includes(busca.toLowerCase()) ||
        s.obra_nome?.toLowerCase().includes(busca.toLowerCase())
      )
    : solicitacoes

  const set = (k: keyof CriarSolicitacaoPayload, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function handleCriar() {
    await criar.mutateAsync({ ...form, itens: itensForm.length > 0 ? itensForm : undefined })
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    setItensForm([])
  }

  async function handleValidar(id: string) {
    await atualizarStatus.mutateAsync({
      id,
      status: 'validando',
      extra: { validado_em: new Date().toISOString() },
    })
  }

  async function handlePlanejar() {
    if (!planejamentoModal) return
    await planejar.mutateAsync({ id: planejamentoModal, ...planejForm })
    setPlanejamentoModal(null)
    setPlanejForm({})
  }

  async function handleAprovar(aprovado: boolean) {
    if (!aprovacaoModal) return
    await aprovar.mutateAsync({ id: aprovacaoModal.id, aprovado, motivo: motivoReprovacao })
    setAprovacaoModal(null)
    setMotivoReprovacao('')
  }

  function openNfModal(s: typeof solicitacoes[0]) {
    const transp = s.transportadora
    setNfForm({
      fornecedor_cnpj: transp?.cnpj ?? '',
      fornecedor_nome: transp?.nome_fantasia ?? transp?.razao_social ?? '',
      valor_total: s.custo_estimado ?? 0,
      descricao: `Transporte ${s.numero} — ${s.origem} → ${s.destino}`,
    })
    setNfModal({ solId: s.id, descricao: s.numero, valor: s.custo_estimado ?? 0, transportadora: transp?.razao_social, cnpj: transp?.cnpj })
  }

  async function handleSolicitarNF() {
    if (!nfModal) return
    await criarNF.mutateAsync({
      fornecedor_cnpj: nfForm.fornecedor_cnpj,
      fornecedor_nome: nfForm.fornecedor_nome,
      valor_total: nfForm.valor_total,
      descricao: nfForm.descricao,
      origem: 'logistica',
      solicitacao_log_id: nfModal.solId,
    })
    // Avançar status para nfe_emitida
    await atualizarStatus.mutateAsync({ id: nfModal.solId, status: 'nfe_emitida' })
    setNfModal(null)
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Solicitações</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{filtradas.length} registros</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm">
          <Plus size={15} /> Nova Solicitação
        </button>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por número, origem, destino ou obra..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 ${isDark ? 'border-white/[0.06] bg-white/5 text-white placeholder:text-slate-600' : 'border-slate-200 bg-white'}`} />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none ${isDark ? 'border-white/[0.06] bg-white/5 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
          <option value="">Todos os status</option>
          {[
            ['solicitado','Solicitado'],['validando','Validando'],['planejado','Planejado'],
            ['aguardando_aprovacao','Aguard. Aprovação'],['aprovado','Aprovado'],
            ['nfe_emitida','NF-e Emitida'],['em_transito','Em Trânsito'],
            ['entregue','Entregue'],['confirmado','Confirmado'],['concluido','Concluído'],
            ['recusado','Recusado'],['cancelado','Cancelado'],
          ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* ── Lista ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <ClipboardList size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
          <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(s => {
            const isExp = expandedId === s.id
            const alcada = getAlcada(s.custo_estimado)
            return (
              <div key={s.id} className={`rounded-2xl shadow-sm overflow-hidden ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                  onClick={() => setExpandedId(isExp ? null : s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.numero}</p>
                      <StatusBadge status={s.status} />
                      {s.urgente && (
                        <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle size={9} /> URGENTE
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {TIPO_LABEL[s.tipo]} · {s.origem} → {s.destino}
                    </p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {s.obra_nome ?? '—'} · {s.centro_custo ?? '—'}
                      {s.solicitante_nome ? ` · por ${s.solicitante_nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {s.custo_estimado ? (
                      <p className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                        {s.custo_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    ) : null}
                    {s.data_desejada && (
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Prazo: {new Date(s.data_desejada + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                </div>

                {isExp && (
                  <div className={`px-4 py-4 space-y-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
                    {/* Detalhes */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <Detail label="Tipo" value={TIPO_LABEL[s.tipo]} />
                      <Detail label="Origem" value={s.origem} />
                      <Detail label="Destino" value={s.destino} />
                      {s.modal && <Detail label="Modal" value={s.modal.replace('_', ' ')} />}
                      {s.veiculo_placa && <Detail label="Placa" value={s.veiculo_placa} />}
                      {s.motorista_nome && <Detail label="Motorista" value={s.motorista_nome} />}
                      {s.custo_estimado && (
                        <Detail label="Custo Est." value={s.custo_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                      )}
                      {s.custo_estimado && (
                        <Detail label="Aprovador" value={`${alcada.aprovador} (${alcada.label})`} />
                      )}
                      {s.oc_numero && <Detail label="OC Vinculada" value={s.oc_numero} />}
                    </div>
                    {s.descricao && (
                      <p className={`text-xs rounded-lg px-3 py-2 ${isDark ? 'text-slate-400 bg-white/5' : 'text-slate-500 bg-slate-50'}`}>{s.descricao}</p>
                    )}

                    {/* Ações por status */}
                    <div className="flex gap-2 flex-wrap pt-1">
                      {s.status === 'solicitado' && (
                        <ActionBtn
                          label="Validar / Avançar"
                          color="bg-sky-600 hover:bg-sky-700"
                          loading={atualizarStatus.isPending}
                          onClick={() => handleValidar(s.id)}
                        />
                      )}
                      {s.status === 'validando' && (
                        <>
                          <ActionBtn
                            label="Planejar"
                            color="bg-blue-600 hover:bg-blue-700"
                            loading={false}
                            onClick={() => { setPlanejamentoModal(s.id); setPlanejForm({ custo_estimado: s.custo_estimado }) }}
                          />
                          <ActionBtn
                            label="Recusar"
                            color="bg-red-600 hover:bg-red-700"
                            loading={atualizarStatus.isPending}
                            onClick={() => atualizarStatus.mutate({ id: s.id, status: 'recusado' })}
                          />
                        </>
                      )}
                      {s.status === 'aguardando_aprovacao' && (
                        <>
                          <ActionBtn
                            label="Aprovar"
                            color="bg-emerald-600 hover:bg-emerald-700"
                            loading={aprovar.isPending}
                            onClick={() => setAprovacaoModal({ id: s.id, titulo: s.numero })}
                          />
                        </>
                      )}
                      {s.status === 'aprovado' && (
                        <>
                          <button onClick={() => navigate('/logistica/expedicao')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700
                              text-white text-xs font-semibold transition-colors shadow-sm">
                            <Package2 size={12} /> Ir para Expedição
                          </button>
                          <button onClick={() => openNfModal(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700
                              text-white text-xs font-semibold transition-colors shadow-sm">
                            <FileInput size={12} /> Solicitar NF
                          </button>
                        </>
                      )}
                      {s.status === 'romaneio_emitido' && (
                        <button onClick={() => navigate('/logistica/expedicao')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700
                            text-white text-xs font-semibold transition-colors shadow-sm">
                          <Package2 size={12} /> Ir para Expedição
                        </button>
                      )}
                      {s.status === 'nfe_emitida' && (
                        <>
                          <button onClick={() => navigate('/logistica/expedicao')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700
                              text-white text-xs font-semibold transition-colors shadow-sm">
                            <Package2 size={12} /> Ir para Expedição
                          </button>
                          <button onClick={() => navigate('/fiscal/solicitacao')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20
                              text-amber-700 text-xs font-semibold transition-colors border border-amber-200">
                            <ExternalLink size={12} /> Ver no Fiscal
                          </button>
                        </>
                      )}
                      {(s.status === 'solicitado' || s.status === 'validando' || s.status === 'planejado') && (
                        <ActionBtn
                          label="Cancelar"
                          color="bg-gray-500 hover:bg-gray-600"
                          loading={atualizarStatus.isPending}
                          onClick={() => atualizarStatus.mutate({ id: s.id, status: 'cancelado' })}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal Nova Solicitação ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Nova Solicitação</h2>
              <button onClick={() => setShowForm(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tipo *</label>
                  <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input-base">
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Rota Padrão</label>
                  <select
                    onChange={e => {
                      const r = rotas.find(r => r.id === e.target.value)
                      setForm(p => ({ ...p, origem: r?.origem ?? p.origem, destino: r?.destino ?? p.destino }))
                    }}
                    className="input-base"
                  >
                    <option value="">Selecionar rota...</option>
                    {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Origem *</label>
                  <input value={form.origem} onChange={e => set('origem', e.target.value)}
                    className="input-base" placeholder="Cidade / Depósito" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Destino *</label>
                  <input value={form.destino} onChange={e => set('destino', e.target.value)}
                    className="input-base" placeholder="Obra / Cidade" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Obra / Projeto</label>
                  <input value={form.obra_nome ?? ''} onChange={e => set('obra_nome', e.target.value)}
                    className="input-base" placeholder="SE Frutal..." />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Centro de Custo</label>
                  <input value={form.centro_custo ?? ''} onChange={e => set('centro_custo', e.target.value)}
                    className="input-base" placeholder="CC-001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>OC Vinculada</label>
                  <input value={form.oc_numero ?? ''} onChange={e => set('oc_numero', e.target.value)}
                    className="input-base" placeholder="OC-2026-0001" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Data Desejada</label>
                  <input type="date" value={form.data_desejada ?? ''} onChange={e => set('data_desejada', e.target.value)}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Descrição da Carga</label>
                <textarea value={form.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
                  rows={2} className="input-base resize-none" placeholder="Lista de materiais, equipamentos..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Peso Total (kg)</label>
                  <input type="number" min={0} value={form.peso_total_kg ?? ''}
                    onChange={e => set('peso_total_kg', e.target.value ? Number(e.target.value) : undefined)}
                    className="input-base" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>N° de Volumes</label>
                  <input type="number" min={0} value={form.volumes_total ?? ''}
                    onChange={e => set('volumes_total', e.target.value ? Number(e.target.value) : undefined)}
                    className="input-base" />
                </div>
              </div>
              {/* Itens da Carga */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Itens da Carga</label>
                  <button type="button"
                    onClick={() => setItensForm(p => [...p, { descricao: '', quantidade: 1, unidade: 'un' }])}
                    className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 hover:text-orange-700">
                    <Plus size={10} /> Adicionar Item
                  </button>
                </div>
                {itensForm.length > 0 ? (
                  <div className="space-y-2">
                    {itensForm.map((item, idx) => (
                      <div key={idx} className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                        <div className="flex gap-2 mb-2">
                          <input value={item.descricao}
                            onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))}
                            placeholder="Descrição do item *" className="input-base flex-1 text-xs" />
                          <button onClick={() => setItensForm(p => p.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 shrink-0 p-1">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <input type="number" min={1} value={item.quantidade}
                            onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, quantidade: Number(e.target.value) } : it))}
                            placeholder="Qtd" className="input-base text-xs" />
                          <select value={item.unidade}
                            onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, unidade: e.target.value } : it))}
                            className="input-base text-xs">
                            {['un','pç','kg','m','m²','m³','L','cx','rl','pct','bd','tb'].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                          <input type="number" min={0} step={0.1} value={item.peso_kg ?? ''}
                            onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, peso_kg: e.target.value ? Number(e.target.value) : undefined } : it))}
                            placeholder="Peso (kg)" className="input-base text-xs" />
                          <input type="number" min={0} step={0.01} value={item.volume_m3 ?? ''}
                            onChange={e => setItensForm(p => p.map((it, i) => i === idx ? { ...it, volume_m3: e.target.value ? Number(e.target.value) : undefined } : it))}
                            placeholder="Vol (m³)" className="input-base text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`rounded-xl px-4 py-3 text-center ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                    <Package2 size={16} className={`mx-auto mb-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item adicionado (opcional)</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.urgente ?? false} onChange={e => set('urgente', e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Urgente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.carga_especial ?? false} onChange={e => set('carga_especial', e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Carga Especial</span>
                </label>
              </div>
              {form.urgente && (
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Justificativa da Urgência *</label>
                  <textarea value={form.justificativa_urgencia ?? ''} onChange={e => set('justificativa_urgencia', e.target.value)}
                    rows={2} className="input-base resize-none" placeholder="Motivo da urgência..." />
                </div>
              )}
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleCriar} disabled={criar.isPending || !form.origem || !form.destino}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {criar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Criar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Planejamento ─────────────────────────────────── */}
      {planejamentoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Planejar Transporte</h2>
              <button onClick={() => setPlanejamentoModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Modal</label>
                <select value={planejForm.modal ?? ''} onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, modal: e.target.value }))}
                  className="input-base">
                  <option value="">Selecione...</option>
                  {[['frota_propria','Frota Própria'],['frota_locada','Frota Locada'],['transportadora','Transportadora'],['motoboy','Motoboy'],['correios','Correios']].map(([k,v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {planejForm.modal === 'transportadora' && (
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Transportadora</label>
                  <select value={planejForm.transportadora_id ?? ''} onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, transportadora_id: e.target.value }))}
                    className="input-base">
                    <option value="">Selecione...</option>
                    {transportadoras.filter(t => t.ativo).map(t => (
                      <option key={t.id} value={t.id}>{t.nome_fantasia ?? t.razao_social}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Placa do Veículo</label>
                  <input value={planejForm.veiculo_placa ?? ''} onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, veiculo_placa: e.target.value }))}
                    className="input-base" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Motorista</label>
                  <input value={planejForm.motorista_nome ?? ''} onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, motorista_nome: e.target.value }))}
                    className="input-base" placeholder="Nome do motorista" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Data Prevista</label>
                  <input type="datetime-local" value={planejForm.data_prevista_saida ?? ''}
                    onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, data_prevista_saida: e.target.value }))}
                    className="input-base" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Custo Estimado (R$)</label>
                  <input type="number" min={0} step={0.01} value={planejForm.custo_estimado ?? ''}
                    onChange={e => setPlanejForm((p: PlanejamentoForm) => ({ ...p, custo_estimado: Number(e.target.value) }))}
                    className="input-base" />
                </div>
              </div>
              {planejForm.custo_estimado > 0 && (
                <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    Alçada: {getAlcada(planejForm.custo_estimado).aprovador}
                    {planejForm.custo_estimado > 500 && ' — Requer aprovação formal'}
                  </p>
                </div>
              )}
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setPlanejamentoModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handlePlanejar} disabled={planejar.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {planejar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Planejamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Aprovação ────────────────────────────────────── */}
      {aprovacaoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Aprovação — {aprovacaoModal.titulo}</h2>
              <button onClick={() => setAprovacaoModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Motivo (se reprovar)</label>
                <textarea value={motivoReprovacao} onChange={e => setMotivoReprovacao(e.target.value)}
                  rows={2} className="input-base resize-none" placeholder="Justificativa da reprovação..." />
              </div>
            </div>
            <div className={`px-6 py-4 flex gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => handleAprovar(false)} disabled={aprovar.isPending}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                Reprovar
              </button>
              <button onClick={() => handleAprovar(true)} disabled={aprovar.isPending}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Solicitar NF ──────────────────────────────── */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <div>
                <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Solicitar Nota Fiscal</h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Transporte {nfModal.descricao}</p>
              </div>
              <button onClick={() => setNfModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  <FileInput size={13} />
                  Sera enviada ao modulo Fiscal como &quot;Pendente&quot;
                </p>
              </div>
              <div className="relative">
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>CNPJ do Fornecedor *</label>
                <input value={nfForm.fornecedor_cnpj}
                  onChange={e => setNfForm(p => ({ ...p, fornecedor_cnpj: e.target.value }))}
                  onBlur={() => cnpjLookup.consultar(nfForm.fornecedor_cnpj)}
                  className="input-base" placeholder="00.000.000/0000-00" />
                {cnpjLookup.loading && (
                  <div className="absolute right-2 top-7 flex items-center gap-1 text-amber-500">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] font-semibold">Buscando...</span>
                  </div>
                )}
                {cnpjLookup.dados && !cnpjLookup.erro && (
                  <p className="text-[9px] text-emerald-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={9} /> {cnpjLookup.dados.situacao}
                  </p>
                )}
                {cnpjLookup.erro && (
                  <p className="text-[9px] text-red-500 mt-0.5">{cnpjLookup.erro}</p>
                )}
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Nome / Razao Social *</label>
                <input value={nfForm.fornecedor_nome}
                  onChange={e => setNfForm(p => ({ ...p, fornecedor_nome: e.target.value }))}
                  className="input-base" placeholder="Nome do fornecedor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Valor Total (R$) *</label>
                  <input type="number" min={0} step={0.01}
                    value={nfForm.valor_total}
                    onChange={e => setNfForm(p => ({ ...p, valor_total: Number(e.target.value) }))}
                    className="input-base" />
                </div>
                <div className="flex items-end pb-0.5">
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Pre-preenchido com custo estimado do transporte
                  </p>
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Descricao</label>
                <textarea value={nfForm.descricao}
                  onChange={e => setNfForm(p => ({ ...p, descricao: e.target.value }))}
                  rows={2} className="input-base resize-none" />
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setNfModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleSolicitarNF}
                disabled={criarNF.isPending || atualizarStatus.isPending || !nfForm.fornecedor_nome || !nfForm.fornecedor_cnpj}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {(criarNF.isPending || atualizarStatus.isPending) ? <Loader2 size={14} className="animate-spin" /> : <FileInput size={14} />}
                Enviar ao Fiscal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-lg px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
      <p className={`text-[9px] uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}

function ActionBtn({ label, color, loading, onClick }: {
  label: string; color: string; loading: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${color}
        text-white text-xs font-semibold transition-colors disabled:opacity-60`}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : null}
      {label}
    </button>
  )
}
