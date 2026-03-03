import { useState } from 'react'
import {
  Package2, FileText, Truck, CheckCircle2, X, Save,
  Loader2, AlertTriangle, ChevronDown,
} from 'lucide-react'
import {
  useSolicitacoes, useChecklistExpedicao, useSalvarChecklistExpedicao,
  useNFe, useEmitirNFe, useIniciarTransporte,
} from '../../hooks/useLogistica'
import { StatusBadge } from './LogisticaHome'
import type { EmitirNFePayload, IniciarTransportePayload } from '../../types/logistica'

// Solicitações em fase de expedição: aprovadas (precisam NF-e) ou com NF-e emitida (despacho)
export default function Expedicao() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [nfeModal, setNfeModal] = useState<string | null>(null)
  const [despachoModal, setDespachoModal] = useState<string | null>(null)
  const [nfeForm, setNfeForm] = useState<Partial<EmitirNFePayload>>({})
  const [despachoForm, setDespachoForm] = useState<Partial<IniciarTransportePayload>>({})

  const { data: solicitacoes = [], isLoading } = useSolicitacoes({
    status: ['aprovado', 'nfe_emitida'],
  })
  const emitirNFe = useEmitirNFe()
  const iniciarTransporte = useIniciarTransporte()

  async function handleEmitirNFe() {
    if (!nfeModal || !nfeForm.emitente_cnpj || !nfeForm.destinatario_nome || !nfeForm.valor_total) return
    await emitirNFe.mutateAsync({ ...nfeForm, solicitacao_id: nfeModal } as EmitirNFePayload)
    setNfeModal(null)
    setNfeForm({})
  }

  async function handleIniciarTransporte() {
    if (!despachoModal || !despachoForm.placa || !despachoForm.motorista_nome || !despachoForm.eta_original) return
    await iniciarTransporte.mutateAsync({
      ...despachoForm,
      solicitacao_id: despachoModal,
    } as IniciarTransportePayload)
    setDespachoModal(null)
    setDespachoForm({})
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Expedição</h1>
          <p className="text-xs text-slate-400 mt-0.5">Checklist, NF-e e despacho de cargas</p>
        </div>
      </div>

      {/* Alerta: bloqueio de despacho sem NF-e */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 font-medium">
          <strong>Regra obrigatória:</strong> Nenhuma carga pode ser despachada sem NF-e autorizada.
          O sistema bloqueia o despacho até a chave de acesso ser registrada.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Package2 size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Nenhuma solicitação aguardando expedição</p>
          <p className="text-slate-400 text-sm mt-1">Solicitações aprovadas aparecerão aqui para emissão de NF-e e despacho</p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map(s => {
            const isExp = expandedId === s.id
            const nfe = s.nfe
            const temNfe = nfe?.status === 'autorizada'
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isExp ? null : s.id)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${temNfe ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                    {temNfe ? <FileText size={16} className="text-emerald-600" /> : <Package2 size={16} className="text-orange-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-slate-800 font-mono">{s.numero}</p>
                      <StatusBadge status={s.status} />
                      {s.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">URGENTE</span>}
                    </div>
                    <p className="text-[10px] text-slate-400">{s.origem} → {s.destino}{s.obra_nome ? ` · ${s.obra_nome}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0 mr-2">
                    {temNfe ? (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-600">NF-e {nfe?.numero}</p>
                        <p className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{nfe?.chave_acesso?.slice(0, 12)}...</p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-semibold">Sem NF-e</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                </div>

                {isExp && (
                  <ExpedicaoDetail
                    solicitacao={s}
                    onEmitirNFe={() => {
                      setNfeModal(s.id)
                      setNfeForm({ solicitacao_id: s.id, destinatario_nome: s.obra_nome ?? '', valor_total: 0 })
                    }}
                    onDespachar={() => {
                      setDespachoModal(s.id)
                      setDespachoForm({
                        solicitacao_id: s.id,
                        placa: s.veiculo_placa ?? '',
                        motorista_nome: s.motorista_nome ?? '',
                        motorista_telefone: s.motorista_telefone ?? '',
                      })
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal NF-e ─────────────────────────────────────────── */}
      {nfeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Emitir NF-e</h2>
              <button onClick={() => setNfeModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipo</label>
                  <select value={nfeForm.tipo ?? 'NFe'} onChange={e => setNfeForm(p => ({ ...p, tipo: e.target.value }))}
                    className="input-base">
                    <option value="NFe">NF-e</option>
                    <option value="MDFe">MDF-e</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">CFOP *</label>
                  <input value={nfeForm.cfop ?? ''} onChange={e => setNfeForm(p => ({ ...p, cfop: e.target.value }))}
                    className="input-base" placeholder="5.949, 6.949..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">CNPJ Emitente *</label>
                  <input value={nfeForm.emitente_cnpj ?? ''} onChange={e => setNfeForm(p => ({ ...p, emitente_cnpj: e.target.value }))}
                    className="input-base" placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Razão Social Emitente</label>
                  <input value={nfeForm.emitente_nome ?? ''} onChange={e => setNfeForm(p => ({ ...p, emitente_nome: e.target.value }))}
                    className="input-base" placeholder="Nome empresa" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">CNPJ Destinatário</label>
                  <input value={nfeForm.destinatario_cnpj ?? ''} onChange={e => setNfeForm(p => ({ ...p, destinatario_cnpj: e.target.value }))}
                    className="input-base" placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Destinatário *</label>
                  <input value={nfeForm.destinatario_nome ?? ''} onChange={e => setNfeForm(p => ({ ...p, destinatario_nome: e.target.value }))}
                    className="input-base" placeholder="Obra / Cliente" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">UF Destinatário</label>
                  <input value={nfeForm.destinatario_uf ?? ''} onChange={e => setNfeForm(p => ({ ...p, destinatario_uf: e.target.value }))}
                    className="input-base" placeholder="MG, SP..." maxLength={2} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Natureza da Operação</label>
                  <input value={nfeForm.natureza_operacao ?? 'Remessa de Materiais'} onChange={e => setNfeForm(p => ({ ...p, natureza_operacao: e.target.value }))}
                    className="input-base" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Valor Total (R$) *</label>
                  <input type="number" min={0} step={0.01} value={nfeForm.valor_total ?? ''}
                    onChange={e => setNfeForm(p => ({ ...p, valor_total: Number(e.target.value) }))}
                    className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Valor Frete (R$)</label>
                  <input type="number" min={0} step={0.01} value={nfeForm.valor_frete ?? 0}
                    onChange={e => setNfeForm(p => ({ ...p, valor_frete: Number(e.target.value) }))}
                    className="input-base" />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                <p className="text-[10px] text-blue-700">
                  A NF-e será transmitida à SEFAZ. O sistema aguardará a autorização e registrará a chave de acesso automaticamente.
                  DANFE ficará disponível após autorização.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setNfeModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleEmitirNFe}
                disabled={emitirNFe.isPending || !nfeForm.emitente_cnpj || !nfeForm.destinatario_nome || !nfeForm.valor_total}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {emitirNFe.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Transmitir NF-e
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Despacho ─────────────────────────────────────── */}
      {despachoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Despachar Carga</h2>
              <button onClick={() => setDespachoModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Placa *</label>
                  <input value={despachoForm.placa ?? ''} onChange={e => setDespachoForm(p => ({ ...p, placa: e.target.value }))}
                    className="input-base" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Motorista *</label>
                  <input value={despachoForm.motorista_nome ?? ''} onChange={e => setDespachoForm(p => ({ ...p, motorista_nome: e.target.value }))}
                    className="input-base" placeholder="Nome do motorista" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tel. Motorista</label>
                  <input value={despachoForm.motorista_telefone ?? ''} onChange={e => setDespachoForm(p => ({ ...p, motorista_telefone: e.target.value }))}
                    className="input-base" placeholder="(34) 99999-0000" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ETA Previsto *</label>
                  <input type="datetime-local" value={despachoForm.eta_original ?? ''}
                    onChange={e => setDespachoForm(p => ({ ...p, eta_original: e.target.value }))}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Código Rastreio</label>
                <input value={despachoForm.codigo_rastreio ?? ''} onChange={e => setDespachoForm(p => ({ ...p, codigo_rastreio: e.target.value }))}
                  className="input-base" placeholder="Código da transportadora..." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setDespachoModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleIniciarTransporte}
                disabled={iniciarTransporte.isPending || !despachoForm.placa || !despachoForm.motorista_nome || !despachoForm.eta_original}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {iniciarTransporte.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                Despachar Carga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detalhe da expedição com checklist ────────────────────────────────────────
function ExpedicaoDetail({
  solicitacao, onEmitirNFe, onDespachar,
}: { solicitacao: any; onEmitirNFe: () => void; onDespachar: () => void }) {
  const { data: checklist } = useChecklistExpedicao(solicitacao.id)
  const salvarChecklist = useSalvarChecklistExpedicao()
  const { data: nfes = [] } = useNFe(solicitacao.id)

  const nfe = nfes[0]
  const temNfe = nfe?.status === 'autorizada'

  const ITEMS_CHECKLIST = [
    ['itens_conferidos',       'Itens conferidos contra lista de materiais'],
    ['volumes_identificados',  'Volumes identificados com etiquetas'],
    ['embalagem_verificada',   'Condições de embalagem e proteção verificadas'],
    ['documentacao_separada',  'Documentação separada (DANFE, romaneio)'],
    ['motorista_habilitado',   'Motorista habilitado verificado'],
    ['veiculo_vistoriado',     'Veículo vistoriado'],
    ['contato_destinatario',   'Contato do destinatário confirmado'],
  ] as const

  const todosMarcados = ITEMS_CHECKLIST.every(([k]) => checklist?.[k as keyof typeof checklist])

  async function toggle(key: string, val: boolean) {
    await salvarChecklist.mutateAsync({
      solicitacao_id: solicitacao.id,
      ...(checklist ?? {}),
      [key]: val,
    })
  }

  return (
    <div className="border-t border-slate-100 px-4 py-4 space-y-4">
      {/* Checklist de expedição */}
      <div>
        <p className="text-xs font-bold text-slate-600 mb-2">Checklist de Expedição</p>
        <div className="space-y-1.5">
          {ITEMS_CHECKLIST.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!(checklist?.[key as keyof typeof checklist])}
                onChange={e => toggle(key, e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-xs ${checklist?.[key as keyof typeof checklist] ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Status NF-e */}
      {temNfe ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-emerald-700">NF-e Autorizada — N° {nfe.numero}</p>
              <p className="text-[10px] text-emerald-600 font-mono">{nfe.chave_acesso}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-semibold text-amber-700">NF-e não emitida — obrigatória para despacho</p>
          </div>
          <button onClick={onEmitirNFe}
            className="text-xs font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
            <FileText size={11} /> Emitir
          </button>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        {!temNfe && (
          <button onClick={onEmitirNFe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700
              text-white text-xs font-semibold transition-colors">
            <FileText size={12} /> Emitir NF-e
          </button>
        )}
        {temNfe && (
          <button onClick={onDespachar} disabled={!todosMarcados}
            title={!todosMarcados ? 'Complete o checklist de expedição primeiro' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700
              text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Truck size={12} /> Despachar Carga
          </button>
        )}
        {!todosMarcados && temNfe && (
          <p className="text-[10px] text-amber-600 font-medium self-center">
            Complete o checklist para habilitar o despacho
          </p>
        )}
      </div>
    </div>
  )
}
