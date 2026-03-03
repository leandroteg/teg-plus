import { useState } from 'react'
import {
  ClipboardList, Plus, Search, X, Save, Loader2,
  ChevronDown, AlertTriangle,
} from 'lucide-react'
import {
  useSolicitacoes, useCriarSolicitacao, useAtualizarStatusSolicitacao,
  useAprovarSolicitacao, usePlanejaarSolicitacao, useTransportadoras, useRotas,
} from '../../hooks/useLogistica'
import { StatusBadge } from './LogisticaHome'
import type { CriarSolicitacaoPayload, TipoTransporte, StatusSolicitacao } from '../../types/logistica'

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

function getAlcada(valor?: number) {
  if (!valor) return ALÇADAS[0]
  return ALÇADAS.find(a => valor <= a.limite) ?? ALÇADAS[2]
}

export default function Solicitacoes() {
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CriarSolicitacaoPayload>({ ...EMPTY_FORM })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [aprovacaoModal, setAprovacaoModal] = useState<{ id: string; titulo: string } | null>(null)
  const [motivoReprovacao, setMotivoReprovacao] = useState('')
  const [planejamentoModal, setPlanejamentoModal] = useState<string | null>(null)
  const [planejForm, setPlanejForm] = useState<any>({})

  const { data: solicitacoes = [], isLoading } = useSolicitacoes(
    statusFiltro ? { status: statusFiltro as StatusSolicitacao } : undefined
  )
  const { data: transportadoras = [] } = useTransportadoras()
  const { data: rotas = [] } = useRotas()
  const criar = useCriarSolicitacao()
  const atualizarStatus = useAtualizarStatusSolicitacao()
  const aprovar = useAprovarSolicitacao()
  const planejar = usePlanejaarSolicitacao()

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
    await criar.mutateAsync(form)
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
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

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Solicitações</h1>
          <p className="text-xs text-slate-400 mt-0.5">{filtradas.length} registros</p>
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
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm
              focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400" />
        </div>
        <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold
            text-slate-600 focus:outline-none">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ClipboardList size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(s => {
            const isExp = expandedId === s.id
            const alcada = getAlcada(s.custo_estimado)
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExp ? null : s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-extrabold text-slate-800 font-mono">{s.numero}</p>
                      <StatusBadge status={s.status} />
                      {s.urgente && (
                        <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle size={9} /> URGENTE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {TIPO_LABEL[s.tipo]} · {s.origem} → {s.destino}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {s.obra_nome ?? '—'} · {s.centro_custo ?? '—'}
                      {s.solicitante_nome ? ` · por ${s.solicitante_nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {s.custo_estimado ? (
                      <p className="text-sm font-extrabold text-slate-700">
                        {s.custo_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    ) : null}
                    {s.data_desejada && (
                      <p className="text-[10px] text-slate-400">
                        Prazo: {new Date(s.data_desejada + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                </div>

                {isExp && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
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
                      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{s.descricao}</p>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Nova Solicitação</h2>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo *</label>
                  <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input-base">
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Rota Padrão</label>
                  <select
                    onChange={e => {
                      const r = rotas.find(r => r.id === e.target.value)
                      if (r) set('origem', r.origem) || set('destino', r.destino)
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
                  <label className="block text-xs font-bold text-slate-600 mb-1">Origem *</label>
                  <input value={form.origem} onChange={e => set('origem', e.target.value)}
                    className="input-base" placeholder="Cidade / Depósito" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Destino *</label>
                  <input value={form.destino} onChange={e => set('destino', e.target.value)}
                    className="input-base" placeholder="Obra / Cidade" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Obra / Projeto</label>
                  <input value={form.obra_nome ?? ''} onChange={e => set('obra_nome', e.target.value)}
                    className="input-base" placeholder="SE Frutal..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Centro de Custo</label>
                  <input value={form.centro_custo ?? ''} onChange={e => set('centro_custo', e.target.value)}
                    className="input-base" placeholder="CC-001" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">OC Vinculada</label>
                  <input value={form.oc_numero ?? ''} onChange={e => set('oc_numero', e.target.value)}
                    className="input-base" placeholder="OC-2026-0001" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data Desejada</label>
                  <input type="date" value={form.data_desejada ?? ''} onChange={e => set('data_desejada', e.target.value)}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Descrição da Carga</label>
                <textarea value={form.descricao ?? ''} onChange={e => set('descricao', e.target.value)}
                  rows={2} className="input-base resize-none" placeholder="Lista de materiais, equipamentos..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Peso Total (kg)</label>
                  <input type="number" min={0} value={form.peso_total_kg ?? ''}
                    onChange={e => set('peso_total_kg', e.target.value ? Number(e.target.value) : undefined)}
                    className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">N° de Volumes</label>
                  <input type="number" min={0} value={form.volumes_total ?? ''}
                    onChange={e => set('volumes_total', e.target.value ? Number(e.target.value) : undefined)}
                    className="input-base" />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.urgente ?? false} onChange={e => set('urgente', e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                  <span className="text-xs font-semibold text-slate-600">Urgente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.carga_especial ?? false} onChange={e => set('carga_especial', e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                  <span className="text-xs font-semibold text-slate-600">Carga Especial</span>
                </label>
              </div>
              {form.urgente && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Justificativa da Urgência *</label>
                  <textarea value={form.justificativa_urgencia ?? ''} onChange={e => set('justificativa_urgencia', e.target.value)}
                    rows={2} className="input-base resize-none" placeholder="Motivo da urgência..." />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Planejar Transporte</h2>
              <button onClick={() => setPlanejamentoModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Modal</label>
                <select value={planejForm.modal ?? ''} onChange={e => setPlanejForm((p: any) => ({ ...p, modal: e.target.value }))}
                  className="input-base">
                  <option value="">Selecione...</option>
                  {[['frota_propria','Frota Própria'],['frota_locada','Frota Locada'],['transportadora','Transportadora'],['motoboy','Motoboy'],['correios','Correios']].map(([k,v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {planejForm.modal === 'transportadora' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Transportadora</label>
                  <select value={planejForm.transportadora_id ?? ''} onChange={e => setPlanejForm((p: any) => ({ ...p, transportadora_id: e.target.value }))}
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
                  <label className="block text-xs font-bold text-slate-600 mb-1">Placa do Veículo</label>
                  <input value={planejForm.veiculo_placa ?? ''} onChange={e => setPlanejForm((p: any) => ({ ...p, veiculo_placa: e.target.value }))}
                    className="input-base" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Motorista</label>
                  <input value={planejForm.motorista_nome ?? ''} onChange={e => setPlanejForm((p: any) => ({ ...p, motorista_nome: e.target.value }))}
                    className="input-base" placeholder="Nome do motorista" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Data Prevista</label>
                  <input type="datetime-local" value={planejForm.data_prevista_saida ?? ''}
                    onChange={e => setPlanejForm((p: any) => ({ ...p, data_prevista_saida: e.target.value }))}
                    className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Custo Estimado (R$)</label>
                  <input type="number" min={0} step={0.01} value={planejForm.custo_estimado ?? ''}
                    onChange={e => setPlanejForm((p: any) => ({ ...p, custo_estimado: Number(e.target.value) }))}
                    className="input-base" />
                </div>
              </div>
              {planejForm.custo_estimado > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-amber-700 font-semibold">
                    Alçada: {getAlcada(planejForm.custo_estimado).aprovador}
                    {planejForm.custo_estimado > 500 && ' — Requer aprovação formal'}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setPlanejamentoModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Aprovação — {aprovacaoModal.titulo}</h2>
              <button onClick={() => setAprovacaoModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Motivo (se reprovar)</label>
                <textarea value={motivoReprovacao} onChange={e => setMotivoReprovacao(e.target.value)}
                  rows={2} className="input-base resize-none" placeholder="Justificativa da reprovação..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
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
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-slate-700 mt-0.5">{value}</p>
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
