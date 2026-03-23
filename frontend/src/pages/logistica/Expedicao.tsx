import { useState, useMemo } from 'react'
import {
  Package2, FileText, Truck, CheckCircle2, X, Loader2,
  AlertTriangle, ChevronDown, Download, ClipboardList,
  ExternalLink, MapPin, Clock, ScrollText, XCircle, Route,
} from 'lucide-react'
import {
  useSolicitacoes, useChecklistExpedicao, useSalvarChecklistExpedicao,
  useNFe, useCancelarNFe, useIniciarTransporte, useEmitirRomaneio, useSolicitarNFFiscal,
  useDespacharViagem,
} from '../../hooks/useLogistica'
import { buildRomaneioDataFromSolicitacao, gerarRomaneioPDF } from '../../utils/romaneio-pdf'
import { getDocumentoFiscalContext, getDocumentoFiscalLabel } from '../../utils/logisticaFiscal'
import { StatusBadge } from './LogisticaHome'
import { useTheme } from '../../contexts/ThemeContext'
import type { IniciarTransportePayload, LogSolicitacao } from '../../types/logistica'

// ── Romaneio download (standalone, used by getDocStatus and ExpedicaoDetail) ──

function downloadRomaneio(s: LogSolicitacao) {
  void (async () => {
    const url = await gerarRomaneioPDF(buildRomaneioDataFromSolicitacao(s))
    const a = document.createElement('a')
    a.href = url
    a.download = `romaneio-${s.numero}.pdf`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  })()
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Expedicao() {
  const { isDark } = useTheme()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [romaneioModal, setRomaneioModal] = useState<LogSolicitacao | null>(null)
  const [nfModal, setNfModal] = useState<LogSolicitacao | null>(null)
  const [despachoModal, setDespachoModal] = useState<string | null>(null)
  const [despachoForm, setDespachoForm] = useState<Partial<IniciarTransportePayload>>({})

  // NF Solicitar form state
  const [nfForm, setNfForm] = useState({
    emitente_cnpj: '',
    emitente_nome: '',
    destinatario_cnpj: '',
    destinatario_nome: '',
    destinatario_uf: '',
    valor_total: 0,
    cfop: '',
    natureza_operacao: 'Remessa de Materiais',
    descricao: '',
  })

  const { data: solicitacoes = [], isLoading } = useSolicitacoes({
    status: ['aprovado', 'nfe_emitida', 'romaneio_emitido'],
  })

  const emitirRomaneio = useEmitirRomaneio()
  const solicitarNF = useSolicitarNFFiscal()
  const cancelarNFe = useCancelarNFe()
  const iniciarTransporte = useIniciarTransporte()
  const despacharViagem = useDespacharViagem()

  // Viagem despacho modal
  const [despachoViagemModal, setDespachoViagemModal] = useState<{ viagemId: string; solicitacoes: LogSolicitacao[] } | null>(null)
  const [despachoViagemForm, setDespachoViagemForm] = useState<{
    placa: string; motorista_nome: string; motorista_telefone: string; eta_original: string; codigo_rastreio: string
  }>({ placa: '', motorista_nome: '', motorista_telefone: '', eta_original: '', codigo_rastreio: '' })

  // ── Romaneio handler ──

  async function handleGerarRomaneio() {
    if (!romaneioModal) return
    const s = romaneioModal

    const url = await gerarRomaneioPDF(buildRomaneioDataFromSolicitacao(s))

    // Open PDF in new tab for the user
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)

    await emitirRomaneio.mutateAsync({
      solicitacao_id: s.id,
      romaneio_url: '',
    })

    setRomaneioModal(null)
  }

  // ── Solicitar NF handler ──

  async function handleSolicitarNF() {
    if (!nfModal || !nfForm.emitente_cnpj || !nfForm.valor_total) return

    await solicitarNF.mutateAsync({
      solicitacao_id: nfModal.id,
      fornecedor_nome: nfForm.emitente_nome || nfForm.emitente_cnpj,
      valor_total: nfForm.valor_total,
      cfop: nfForm.cfop || undefined,
      natureza_operacao: nfForm.natureza_operacao || undefined,
      descricao: nfForm.descricao || undefined,
      destinatario_cnpj: nfForm.destinatario_cnpj || undefined,
      destinatario_nome: nfForm.destinatario_nome || undefined,
      destinatario_uf: nfForm.destinatario_uf || undefined,
      emitente_cnpj: nfForm.emitente_cnpj || undefined,
      emitente_nome: nfForm.emitente_nome || undefined,
      items: (nfModal.itens ?? []).map(i => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
      })),
    })

    setNfModal(null)
    setNfForm({
      emitente_cnpj: '', emitente_nome: '', destinatario_cnpj: '', destinatario_nome: '',
      destinatario_uf: '', valor_total: 0, cfop: '', natureza_operacao: 'Remessa de Materiais', descricao: '',
    })
  }

  // ── Despacho handler ──

  async function handleIniciarTransporte() {
    if (!despachoModal || !despachoForm.placa || !despachoForm.motorista_nome || !despachoForm.eta_original) return
    await iniciarTransporte.mutateAsync({
      ...despachoForm,
      solicitacao_id: despachoModal,
    } as IniciarTransportePayload)
    setDespachoModal(null)
    setDespachoForm({})
  }

  // ── Open NF modal with smart defaults ──

  function openNfModal(s: LogSolicitacao) {
    const fiscalCtx = getDocumentoFiscalContext(s)
    setNfModal(s)
    setNfForm({
      emitente_cnpj: '',
      emitente_nome: '',
      destinatario_cnpj: '',
      destinatario_nome: s.obra_nome ?? '',
      destinatario_uf: fiscalCtx.destinoUf || '',
      valor_total: 0,
      cfop: fiscalCtx.regra === 'romaneio' ? '5.949' : fiscalCtx.regra === 'nf' ? '6.949' : '',
      natureza_operacao: 'Remessa de Materiais',
      descricao: '',
    })
  }

  // ── Counts for stat chips ──

  const counts = useMemo(() => {
    let aprovado = 0, romaneio = 0, nfe = 0, nfPendente = 0
    for (const s of solicitacoes) {
      if (s.status === 'aprovado' && s.doc_fiscal_tipo !== 'nf') aprovado++
      else if (s.status === 'aprovado' && s.doc_fiscal_tipo === 'nf') nfPendente++
      else if (s.status === 'romaneio_emitido') romaneio++
      else if (s.status === 'nfe_emitida') nfe++
    }
    return { aprovado, romaneio, nfe, nfPendente, total: solicitacoes.length }
  }, [solicitacoes])

  // ── Group by viagem_id ──
  type DisplayItem =
    | { kind: 'solo'; sol: LogSolicitacao }
    | { kind: 'viagem'; viagemId: string; viagem: LogSolicitacao['viagem']; solicitacoes: LogSolicitacao[] }

  const displayItems = useMemo((): DisplayItem[] => {
    const viagemGroups = new Map<string, LogSolicitacao[]>()
    const solos: LogSolicitacao[] = []

    for (const sol of solicitacoes) {
      if (sol.viagem_id) {
        const arr = viagemGroups.get(sol.viagem_id) || []
        arr.push(sol)
        viagemGroups.set(sol.viagem_id, arr)
      } else {
        solos.push(sol)
      }
    }

    const result: DisplayItem[] = []
    const viagemInserted = new Set<string>()

    for (const sol of solicitacoes) {
      if (sol.viagem_id) {
        if (!viagemInserted.has(sol.viagem_id)) {
          viagemInserted.add(sol.viagem_id)
          const sols = viagemGroups.get(sol.viagem_id)!
          sols.sort((a, b) => (a.ordem_na_viagem ?? 0) - (b.ordem_na_viagem ?? 0))
          result.push({
            kind: 'viagem',
            viagemId: sol.viagem_id,
            viagem: sol.viagem,
            solicitacoes: sols,
          })
        }
      } else {
        result.push({ kind: 'solo', sol })
      }
    }

    return result
  }, [solicitacoes])

  // ── Despachar viagem handler ──
  function openDespachoViagem(viagemId: string, sols: LogSolicitacao[]) {
    const v = sols[0]?.viagem
    setDespachoViagemModal({ viagemId, solicitacoes: sols })
    setDespachoViagemForm({
      placa: v?.veiculo_placa ?? sols[0]?.veiculo_placa ?? '',
      motorista_nome: v?.motorista_nome ?? sols[0]?.motorista_nome ?? '',
      motorista_telefone: v?.motorista_telefone ?? sols[0]?.motorista_telefone ?? '',
      eta_original: '',
      codigo_rastreio: '',
    })
  }

  async function handleDespacharViagem() {
    if (!despachoViagemModal || !despachoViagemForm.placa || !despachoViagemForm.motorista_nome || !despachoViagemForm.eta_original) return
    await despacharViagem.mutateAsync({
      viagemId: despachoViagemModal.viagemId,
      placa: despachoViagemForm.placa,
      motorista_nome: despachoViagemForm.motorista_nome,
      motorista_telefone: despachoViagemForm.motorista_telefone || undefined,
      eta_original: despachoViagemForm.eta_original,
      codigo_rastreio: despachoViagemForm.codigo_rastreio || undefined,
    })
    setDespachoViagemModal(null)
    setDespachoViagemForm({ placa: '', motorista_nome: '', motorista_telefone: '', eta_original: '', codigo_rastreio: '' })
  }

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-navy'}`}>Expedição</h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Checklist, documento fiscal e despacho de cargas</p>
        </div>
      </div>

      {/* ── Stat chips ─────────────────────────────────────────── */}
      {!isLoading && counts.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {counts.aprovado > 0 && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />{counts.aprovado} aguardando doc fiscal
            </span>
          )}
          {counts.nfPendente > 0 && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              <Clock size={10} />{counts.nfPendente} NF solicitada
            </span>
          )}
          {counts.romaneio > 0 && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
              <ScrollText size={10} />{counts.romaneio} romaneio emitido
            </span>
          )}
          {counts.nfe > 0 && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
              <CheckCircle2 size={10} />{counts.nfe} NF-e emitida
            </span>
          )}
        </div>
      )}

      {/* ── Alert banner ───────────────────────────────────────── */}
      <div className={`rounded-2xl px-4 py-3 flex items-start gap-2.5 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
        <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
        <p className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
          <strong>Regra obrigatória:</strong> Nenhuma carga pode ser despachada sem documento fiscal (Romaneio intrastadual ou NF-e interestadual).
          O sistema bloqueia o despacho até o documento ser emitido.
        </p>
      </div>

      {/* ── Loading / Empty / List ─────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className={`rounded-2xl p-12 text-center ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
          <Package2 size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
          <p className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nenhuma solicitação aguardando expedição</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Solicitações aprovadas aparecerão aqui para emissão de documento fiscal e despacho</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map(item => item.kind === 'viagem' ? (
            <ViagemExpCard
              key={`vg-${item.viagemId}`}
              item={item}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onEmitirRomaneio={s => setRomaneioModal(s)}
              onSolicitarNF={s => openNfModal(s)}
              onCancelarNFe={(nfeId, solId) => cancelarNFe.mutate({ id: nfeId, motivo: 'Cancelamento pela expedição', solicitacao_id: solId })}
              cancelandoNFe={cancelarNFe.isPending}
              onDespacharSolo={s => {
                setDespachoModal(s.id)
                setDespachoForm({
                  solicitacao_id: s.id,
                  placa: s.veiculo_placa ?? '',
                  motorista_nome: s.motorista_nome ?? '',
                  motorista_telefone: s.motorista_telefone ?? '',
                })
              }}
              onDespacharViagem={() => openDespachoViagem(item.viagemId, item.solicitacoes)}
              isDark={isDark}
            />
          ) : (
            (() => {
              const s = item.sol
              const isExp = expandedId === s.id
              const docStatus = getDocStatus(s)
              return (
                <div key={s.id} className={`rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
                  {/* ── Row header ── */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/60'}`}
                    onClick={() => setExpandedId(isExp ? null : s.id)}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${docStatus.iconBg}`}>
                      {docStatus.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.numero}</p>
                        <StatusBadge status={s.status} />
                        {s.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Urgente</span>}
                        {docStatus.badge}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                        <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.origem} → {s.destino}{s.obra_nome ? ` · ${s.obra_nome}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      {docStatus.rightInfo}
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
                  </div>

                  {/* ── Expanded detail ── */}
                  {isExp && (
                    <ExpedicaoDetail
                      solicitacao={s}
                      onEmitirRomaneio={() => setRomaneioModal(s)}
                      onSolicitarNF={() => openNfModal(s)}
                      onCancelarNFe={nfeId => cancelarNFe.mutate({ id: nfeId, motivo: 'Cancelamento pela expedição', solicitacao_id: s.id })}
                      cancelandoNFe={cancelarNFe.isPending}
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
            })()
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: Romaneio                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {romaneioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                  <ScrollText size={16} className="text-teal-600" />
                </div>
                <div>
                  <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Emitir Romaneio</h2>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Documento operacional intrastadual</p>
                </div>
              </div>
              <button onClick={() => setRomaneioModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Route info */}
              <div className={`rounded-xl px-4 py-3 ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50/60 border border-teal-100'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-teal-600" />
                  <span className={`font-bold ${isDark ? 'text-teal-400' : 'text-teal-800'}`}>{romaneioModal.origem}</span>
                  <span className="text-teal-400">→</span>
                  <span className={`font-bold ${isDark ? 'text-teal-400' : 'text-teal-800'}`}>{romaneioModal.destino}</span>
                </div>
                {romaneioModal.obra_nome && (
                  <p className={`text-[11px] mt-1 ml-5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>Obra: {romaneioModal.obra_nome}</p>
                )}
              </div>

              {/* Driver / Vehicle */}
              <div className="grid grid-cols-3 gap-3">
                <InfoField label="Motorista" value={romaneioModal.motorista_nome} />
                <InfoField label="Telefone" value={romaneioModal.motorista_telefone} />
                <InfoField label="Placa" value={romaneioModal.veiculo_placa} />
              </div>

              {/* Cargo summary */}
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Peso Total" value={romaneioModal.peso_total_kg ? `${romaneioModal.peso_total_kg} kg` : undefined} />
                <InfoField label="Volumes" value={romaneioModal.volumes_total?.toString()} />
              </div>

              {/* Items list */}
              <div>
                <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <ClipboardList size={12} />
                  Itens ({romaneioModal.itens?.length ?? 0})
                </p>
                {(romaneioModal.itens?.length ?? 0) > 0 ? (
                  <div className={`rounded-xl max-h-48 overflow-y-auto ${isDark ? 'bg-white/5 border border-white/[0.06] divide-y divide-white/[0.04]' : 'bg-slate-50 border border-slate-100 divide-y divide-slate-100'}`}>
                    {romaneioModal.itens!.map((item, i) => (
                      <div key={item.id ?? i} className="px-3 py-2 flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.descricao}</p>
                          {item.numero_serie && <p className={`text-[9px] font-mono ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>S/N: {item.numero_serie}</p>}
                        </div>
                        <div className={`text-right shrink-0 ml-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.quantidade} {item.unidade}
                          {item.peso_kg ? <span className={`ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>({item.peso_kg} kg)</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`rounded-xl px-4 py-6 text-center ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nenhum item registrado na solicitação</p>
                  </div>
                )}
              </div>

              {/* Obs */}
              {romaneioModal.observacoes_carga && (
                <div>
                  <p className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Observações de Carga</p>
                  <p className={`text-xs rounded-lg px-3 py-2 ${isDark ? 'text-slate-400 bg-white/5 border border-white/[0.06]' : 'text-slate-500 bg-slate-50 border border-slate-100'}`}>{romaneioModal.observacoes_carga}</p>
                </div>
              )}

              <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <p className={`text-[10px] ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                  O romaneio será gerado como PDF e aberto em nova aba. A solicitação passará para status "Romaneio Emitido", liberando o despacho.
                </p>
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setRomaneioModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleGerarRomaneio}
                disabled={emitirRomaneio.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700
                  text-white text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]">
                {emitirRomaneio.isPending ? <Loader2 size={14} className="animate-spin" /> : <ScrollText size={14} />}
                Gerar Romaneio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: Solicitar NF                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {nfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                  <FileText size={16} className="text-violet-600" />
                </div>
                <div>
                  <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Solicitar NF</h2>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Enviar solicitação ao setor Fiscal</p>
                </div>
              </div>
              <button onClick={() => setNfModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Route info */}
              <div className={`rounded-xl px-4 py-3 ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50/60 border border-violet-100'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin size={14} className="text-violet-600" />
                  <span className={`font-bold ${isDark ? 'text-violet-400' : 'text-violet-800'}`}>{nfModal.origem}</span>
                  <span className="text-violet-400">→</span>
                  <span className={`font-bold ${isDark ? 'text-violet-400' : 'text-violet-800'}`}>{nfModal.destino}</span>
                </div>
                <p className={`text-[11px] mt-1 ml-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                  {getDocumentoFiscalContext(nfModal).regra === 'nf' ? 'Transporte interestadual — NF obrigatória' : 'NF solicitada manualmente'}
                </p>
              </div>

              {/* Emitente */}
              <fieldset className="space-y-3">
                <legend className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Emitente</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CNPJ Emitente *</label>
                    <input value={nfForm.emitente_cnpj} onChange={e => setNfForm(p => ({ ...p, emitente_cnpj: e.target.value }))}
                      className="input-base" placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Razão Social</label>
                    <input value={nfForm.emitente_nome} onChange={e => setNfForm(p => ({ ...p, emitente_nome: e.target.value }))}
                      className="input-base" placeholder="Nome empresa" />
                  </div>
                </div>
              </fieldset>

              {/* Destinatario */}
              <fieldset className="space-y-3">
                <legend className={`text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Destinatário</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CNPJ Destinatário</label>
                    <input value={nfForm.destinatario_cnpj} onChange={e => setNfForm(p => ({ ...p, destinatario_cnpj: e.target.value }))}
                      className="input-base" placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Nome Destinatário</label>
                    <input value={nfForm.destinatario_nome} onChange={e => setNfForm(p => ({ ...p, destinatario_nome: e.target.value }))}
                      className="input-base" placeholder="Obra / Cliente" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">UF</label>
                    <input value={nfForm.destinatario_uf} onChange={e => setNfForm(p => ({ ...p, destinatario_uf: e.target.value }))}
                      className="input-base" placeholder="MG, SP..." maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CFOP</label>
                    <input value={nfForm.cfop} onChange={e => setNfForm(p => ({ ...p, cfop: e.target.value }))}
                      className="input-base" placeholder="5.949 / 6.949" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Valor Total (R$) *</label>
                    <input type="number" min={0} step={0.01} value={nfForm.valor_total || ''}
                      onChange={e => setNfForm(p => ({ ...p, valor_total: Number(e.target.value) }))}
                      className="input-base" />
                  </div>
                </div>
              </fieldset>

              {/* Extra fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Natureza da Operação</label>
                  <input value={nfForm.natureza_operacao} onChange={e => setNfForm(p => ({ ...p, natureza_operacao: e.target.value }))}
                    className="input-base" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Descrição</label>
                  <input value={nfForm.descricao} onChange={e => setNfForm(p => ({ ...p, descricao: e.target.value }))}
                    className="input-base" placeholder="Descrição adicional..." />
                </div>
              </div>

              {/* Items preview */}
              {(nfModal.itens?.length ?? 0) > 0 && (
                <div>
                  <p className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <ClipboardList size={11} /> {nfModal.itens!.length} iten{nfModal.itens!.length > 1 ? 's' : ''} serão incluídos
                  </p>
                  <div className={`rounded-lg px-3 py-2 max-h-28 overflow-y-auto ${isDark ? 'bg-white/5 border border-white/[0.06]' : 'bg-slate-50 border border-slate-100'}`}>
                    {nfModal.itens!.map((it, i) => (
                      <p key={it.id ?? i} className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {it.quantidade}x {it.descricao}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className={`rounded-xl px-3 py-2 ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
                <p className={`text-[10px] ${isDark ? 'text-violet-400' : 'text-violet-700'}`}>
                  A solicitação será enviada ao setor Fiscal para emissão da NF-e.
                  Após a emissão pelo Fiscal, o despacho será liberado automaticamente.
                </p>
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setNfModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleSolicitarNF}
                disabled={solicitarNF.isPending || !nfForm.emitente_cnpj || !nfForm.valor_total}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700
                  text-white text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]">
                {solicitarNF.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Enviar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: Despacho (preserved from original)                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {despachoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                  <Truck size={16} className="text-orange-600" />
                </div>
                <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Despachar Carga</h2>
              </div>
              <button onClick={() => setDespachoModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Placa *</label>
                  <input value={despachoForm.placa ?? ''} onChange={e => setDespachoForm(p => ({ ...p, placa: e.target.value }))}
                    className="input-base" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Motorista *</label>
                  <input value={despachoForm.motorista_nome ?? ''} onChange={e => setDespachoForm(p => ({ ...p, motorista_nome: e.target.value }))}
                    className="input-base" placeholder="Nome do motorista" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tel. Motorista</label>
                  <input value={despachoForm.motorista_telefone ?? ''} onChange={e => setDespachoForm(p => ({ ...p, motorista_telefone: e.target.value }))}
                    className="input-base" placeholder="(34) 99999-0000" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ETA Previsto *</label>
                  <input type="datetime-local" value={despachoForm.eta_original ?? ''}
                    onChange={e => setDespachoForm(p => ({ ...p, eta_original: e.target.value }))}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Código Rastreio</label>
                <input value={despachoForm.codigo_rastreio ?? ''} onChange={e => setDespachoForm(p => ({ ...p, codigo_rastreio: e.target.value }))}
                  className="input-base" placeholder="Código da transportadora..." />
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setDespachoModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleIniciarTransporte}
                disabled={iniciarTransporte.isPending || !despachoForm.placa || !despachoForm.motorista_nome || !despachoForm.eta_original}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]">
                {iniciarTransporte.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                Despachar Carga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/*  MODAL: Despacho Viagem                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {despachoViagemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${isDark ? 'bg-[#1e293b]' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                  <Route size={16} className="text-orange-600" />
                </div>
                <div>
                  <h2 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>Despachar Viagem</h2>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{despachoViagemModal.solicitacoes.length} solicitações nesta viagem</p>
                </div>
              </div>
              <button onClick={() => setDespachoViagemModal(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Solicitações included */}
              <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                <p className={`text-[10px] font-bold mb-1 ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>Solicitações incluídas:</p>
                {despachoViagemModal.solicitacoes.map(s => (
                  <p key={s.id} className={`text-[10px] ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>
                    {s.numero} — {s.origem} → {s.destino}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Placa *</label>
                  <input value={despachoViagemForm.placa} onChange={e => setDespachoViagemForm(p => ({ ...p, placa: e.target.value }))}
                    className="input-base" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Motorista *</label>
                  <input value={despachoViagemForm.motorista_nome} onChange={e => setDespachoViagemForm(p => ({ ...p, motorista_nome: e.target.value }))}
                    className="input-base" placeholder="Nome do motorista" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Tel. Motorista</label>
                  <input value={despachoViagemForm.motorista_telefone} onChange={e => setDespachoViagemForm(p => ({ ...p, motorista_telefone: e.target.value }))}
                    className="input-base" placeholder="(34) 99999-0000" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ETA Previsto *</label>
                  <input type="datetime-local" value={despachoViagemForm.eta_original}
                    onChange={e => setDespachoViagemForm(p => ({ ...p, eta_original: e.target.value }))}
                    className="input-base" />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Código Rastreio</label>
                <input value={despachoViagemForm.codigo_rastreio} onChange={e => setDespachoViagemForm(p => ({ ...p, codigo_rastreio: e.target.value }))}
                  className="input-base" placeholder="Código da transportadora..." />
              </div>
            </div>
            <div className={`px-6 py-4 flex justify-end gap-2 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
              <button onClick={() => setDespachoViagemModal(null)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'border border-white/[0.06] text-slate-400 hover:bg-white/5' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Cancelar
              </button>
              <button onClick={handleDespacharViagem}
                disabled={despacharViagem.isPending || !despachoViagemForm.placa || !despachoViagemForm.motorista_nome || !despachoViagemForm.eta_original}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700
                  text-white text-sm font-semibold transition-all disabled:opacity-60 active:scale-[0.98]">
                {despacharViagem.isPending ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                Despachar Viagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Document status helper ──────────────────────────────────────────────────

function getDocStatus(s: LogSolicitacao) {
  const nfe = s.nfe
  const temNfe = nfe?.status === 'autorizada'

  // NF-e emitida (legacy or fiscal-emitted)
  if (s.status === 'nfe_emitida' || temNfe) {
    return {
      iconBg: 'bg-emerald-50',
      icon: <FileText size={16} className="text-emerald-600" />,
      badge: (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={9} /> NF-e Emitida
        </span>
      ),
      rightInfo: (
        <div className="text-right">
          {nfe?.numero && <p className="text-[10px] font-bold text-emerald-600">NF-e {nfe.numero}</p>}
          {nfe?.chave_acesso && <p className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{nfe.chave_acesso.slice(0, 12)}...</p>}
          {s.danfe_url && (
            <a href={s.danfe_url} target="_blank" rel="noreferrer"
              className="text-[9px] text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-0.5 justify-end mt-0.5"
              onClick={e => e.stopPropagation()}>
              <ExternalLink size={8} /> DANFE
            </a>
          )}
        </div>
      ),
    }
  }

  // Romaneio emitido
  if (s.status === 'romaneio_emitido') {
    return {
      iconBg: 'bg-teal-50',
      icon: <ScrollText size={16} className="text-teal-600" />,
      badge: (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
          <CheckCircle2 size={9} /> Romaneio Emitido
        </span>
      ),
      rightInfo: s.romaneio_url ? (
        <button
          className="text-[10px] text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
          onClick={e => { e.stopPropagation(); downloadRomaneio(s) }}>
          <Download size={10} /> Download
        </button>
      ) : null,
    }
  }

  // NF solicitada ao Fiscal (doc_fiscal_tipo = 'nf' but status still aprovado)
  if (s.doc_fiscal_tipo === 'nf' && s.status === 'aprovado') {
    return {
      iconBg: 'bg-amber-50',
      icon: <Clock size={16} className="text-amber-600" />,
      badge: (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          <Clock size={9} /> NF Solicitada
        </span>
      ),
      rightInfo: (
        <span className="text-[10px] text-amber-600 font-semibold">Aguardando Fiscal</span>
      ),
    }
  }

  // Approved, no doc yet
  return {
    iconBg: 'bg-indigo-50',
    icon: <Package2 size={16} className="text-indigo-600" />,
    badge: null,
    rightInfo: (
      <span className="text-[10px] text-amber-600 font-semibold">Sem doc fiscal</span>
    ),
  }
}

// ── Info field micro-component ──────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value?: string | null }) {
  const { isDark } = useTheme()
  return (
    <div>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value || 'N/A'}</p>
    </div>
  )
}

// ── Viagem grouped card for Expedição ────────────────────────────────────────

function ViagemExpCard({ item, expandedId, setExpandedId, onEmitirRomaneio, onSolicitarNF, onCancelarNFe, cancelandoNFe, onDespacharSolo, onDespacharViagem, isDark }: {
  item: { kind: 'viagem'; viagemId: string; viagem: LogSolicitacao['viagem']; solicitacoes: LogSolicitacao[] }
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onEmitirRomaneio: (s: LogSolicitacao) => void
  onSolicitarNF: (s: LogSolicitacao) => void
  onCancelarNFe: (nfeId: string, solId: string) => void
  cancelandoNFe: boolean
  onDespacharSolo: (s: LogSolicitacao) => void
  onDespacharViagem: () => void
  isDark: boolean
}) {
  const v = item.viagem
  const sols = item.solicitacoes

  // Check if all solicitações have doc fiscal ready
  const allDocReady = sols.every(s =>
    s.status === 'romaneio_emitido' || s.status === 'nfe_emitida' ||
    s.nfe?.status === 'autorizada'
  )

  return (
    <div className={`rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'}`}>
      {/* ── Viagem header ── */}
      <div className={`px-4 py-3 ${isDark ? 'bg-indigo-500/5 border-b border-white/[0.06]' : 'bg-indigo-50/40 border-b border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-100'}`}>
            <Route size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-extrabold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {v?.numero ?? 'Viagem'}
              </p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-100 text-indigo-700'}`}>
                {sols.length} solicitações
              </span>
              {v?.qtd_paradas != null && v.qtd_paradas > 0 && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {v.qtd_paradas} parada{v.qtd_paradas > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1">
                <MapPin size={10} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {v?.origem_principal ?? sols[0]?.origem} → {v?.destino_final ?? sols[sols.length - 1]?.destino}
                </p>
              </div>
              {v?.motorista_nome && (
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Truck size={10} className="inline mr-0.5" />{v.motorista_nome}
                </p>
              )}
              {v?.veiculo_placa && (
                <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {v.veiculo_placa}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-items ── */}
      <div className={isDark ? 'divide-y divide-white/[0.04]' : 'divide-y divide-slate-100'}>
        {sols.map(s => {
          const isExp = expandedId === s.id
          const docStatus = getDocStatus(s)
          return (
            <div key={s.id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/60'}`}
                onClick={() => setExpandedId(isExp ? null : s.id)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${docStatus.iconBg}`}>
                  {docStatus.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-xs font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{s.numero}</p>
                    <StatusBadge status={s.status} />
                    {s.urgente && <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Urgente</span>}
                    {docStatus.badge}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={9} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                    <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.origem} → {s.destino}{s.obra_nome ? ` · ${s.obra_nome}` : ''}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 mr-2">
                  {docStatus.rightInfo}
                </div>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} />
              </div>

              {isExp && (
                <ExpedicaoDetail
                  solicitacao={s}
                  onEmitirRomaneio={() => onEmitirRomaneio(s)}
                  onSolicitarNF={() => onSolicitarNF(s)}
                  onCancelarNFe={nfeId => onCancelarNFe(nfeId, s.id)}
                  cancelandoNFe={cancelandoNFe}
                  onDespachar={() => onDespacharSolo(s)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Group action: Despachar Viagem ── */}
      {allDocReady && (
        <div className={`px-4 py-3 flex items-center justify-end gap-2 ${isDark ? 'border-t border-white/[0.06] bg-white/[0.02]' : 'border-t border-slate-100 bg-slate-50/40'}`}>
          <button onClick={onDespacharViagem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700
              text-white text-xs font-semibold transition-all active:scale-[0.97]">
            <Route size={12} /> Despachar Viagem ({sols.length} solicitações)
          </button>
        </div>
      )}
    </div>
  )
}

// ── Detail panel with checklist + smart buttons ─────────────────────────────

function ExpedicaoDetail({
  solicitacao, onEmitirRomaneio, onSolicitarNF, onCancelarNFe, cancelandoNFe, onDespachar,
}: {
  solicitacao: LogSolicitacao
  onEmitirRomaneio: () => void
  onSolicitarNF: () => void
  onCancelarNFe: (nfeId: string) => void
  cancelandoNFe: boolean
  onDespachar: () => void
}) {
  const { data: checklist } = useChecklistExpedicao(solicitacao.id)
  const salvarChecklist = useSalvarChecklistExpedicao()
  const { data: nfes = [] } = useNFe(solicitacao.id)

  const nfe = nfes[0]
  const temNfe = nfe?.status === 'autorizada'
  const temRomaneio = solicitacao.status === 'romaneio_emitido'
  const nfSolicitada = solicitacao.doc_fiscal_tipo === 'nf' && solicitacao.status === 'aprovado'
  const temDocFiscal = temNfe || temRomaneio || solicitacao.status === 'nfe_emitida'
  const fiscalCtx = getDocumentoFiscalContext(solicitacao)

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

  const { isDark } = useTheme()

  return (
    <div className={`px-4 py-4 space-y-4 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-100'}`}>
      {/* ── Checklist ── */}
      <div>
        <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <ClipboardList size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          Checklist de Expedição
        </p>
        <div className="space-y-1.5">
          {ITEMS_CHECKLIST.map(([key, label]) => {
            const checked = !!(checklist?.[key as keyof typeof checklist])
            return (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => toggle(key, e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 transition-colors"
                />
                <span className={`text-xs transition-colors ${checked ? (isDark ? 'text-emerald-400 line-through opacity-70' : 'text-emerald-700 line-through opacity-70') : (isDark ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-600 group-hover:text-slate-800')}`}>
                  {label}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Document fiscal status ── */}
      {temDocFiscal ? (
        /* Has document — show green banner */
        temNfe || solicitacao.status === 'nfe_emitida' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-emerald-700">NF-e Autorizada{nfe?.numero ? ` — N\u00b0 ${nfe.numero}` : ''}</p>
                {nfe?.chave_acesso && <p className="text-[10px] text-emerald-600 font-mono">{nfe.chave_acesso}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1 ml-5">
              {solicitacao.danfe_url && (
                <a href={solicitacao.danfe_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700 font-semibold">
                  <ExternalLink size={9} /> Ver DANFE
                </a>
              )}
              {nfe?.id && (
                <button onClick={() => onCancelarNFe(nfe.id)} disabled={cancelandoNFe}
                  className="inline-flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 font-semibold disabled:opacity-50">
                  {cancelandoNFe ? <Loader2 size={9} className="animate-spin" /> : <XCircle size={9} />} Cancelar NF-e
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-teal-600" />
              <div>
                <p className="text-xs font-bold text-teal-700">Romaneio Emitido</p>
                <p className="text-[10px] text-teal-600">Documento de carga intraestadual pronto para despacho</p>
              </div>
            </div>
            {solicitacao.romaneio_url && (
              <button onClick={() => downloadRomaneio(solicitacao)}
                className="inline-flex items-center gap-1 text-[10px] text-teal-700 hover:text-teal-800 font-semibold mt-1 ml-5">
                <Download size={9} /> Download Romaneio
              </button>
            )}
          </div>
        )
      ) : nfSolicitada ? (
        /* NF requested but awaiting fiscal */
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-amber-700">NF Solicitada — Aguardando setor Fiscal</p>
              <p className="text-[10px] text-amber-600">O despacho será liberado após emissão da NF-e pelo Fiscal</p>
            </div>
          </div>
        </div>
      ) : (
        /* No document — show warning + UF hint */
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-600" />
            <p className="text-xs font-semibold text-amber-700">Documento fiscal obrigatório para despacho</p>
          </div>
          <p className="text-[10px] text-amber-600 ml-5">{getDocumentoFiscalLabel(fiscalCtx.regra)}</p>
          {(fiscalCtx.origemUf || fiscalCtx.destinoUf) && (
            <p className="text-[10px] text-amber-700 ml-5 mt-1 font-medium">UFs da rota: {fiscalCtx.origemUf || '—'} → {fiscalCtx.destinoUf || '—'}</p>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Show doc fiscal buttons only if no doc yet and no NF pending */}
        {!temDocFiscal && !nfSolicitada && (
          <>
            {/* MG → show Romaneio primary, NF secondary */}
            {fiscalCtx.regra === 'romaneio' && (
              <>
                <button onClick={onEmitirRomaneio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700
                    text-white text-xs font-semibold transition-all active:scale-[0.97]">
                  <ScrollText size={12} /> Emitir Romaneio
                </button>
                <button onClick={onSolicitarNF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100
                    text-violet-700 text-xs font-semibold transition-all active:scale-[0.97]">
                  <FileText size={12} /> Solicitar NF
                </button>
              </>
            )}
            {/* Inter-state → show NF primary, Romaneio secondary */}
            {fiscalCtx.regra === 'nf' && (
              <>
                <button onClick={onSolicitarNF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700
                    text-white text-xs font-semibold transition-all active:scale-[0.97]">
                  <FileText size={12} /> Solicitar NF
                </button>
                <button onClick={onEmitirRomaneio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100
                    text-teal-700 text-xs font-semibold transition-all active:scale-[0.97]">
                  <ScrollText size={12} /> Emitir Romaneio
                </button>
              </>
            )}
            {/* Indefinido → show both equal weight */}
            {fiscalCtx.regra === 'indefinido' && (
              <>
                <button onClick={onEmitirRomaneio}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700
                    text-white text-xs font-semibold transition-all active:scale-[0.97]">
                  <ScrollText size={12} /> Emitir Romaneio
                </button>
                <button onClick={onSolicitarNF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700
                    text-white text-xs font-semibold transition-all active:scale-[0.97]">
                  <FileText size={12} /> Solicitar NF
                </button>
              </>
            )}
          </>
        )}

        {/* Despacho — only when doc fiscal is ready */}
        {temDocFiscal && (
          <button onClick={onDespachar} disabled={!todosMarcados}
            title={!todosMarcados ? 'Complete o checklist de expedição primeiro' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700
              text-white text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]">
            <Truck size={12} /> Despachar Carga
          </button>
        )}
        {!todosMarcados && temDocFiscal && (
          <p className="text-[10px] text-amber-600 font-medium self-center">
            Complete o checklist para habilitar o despacho
          </p>
        )}
      </div>
    </div>
  )
}
