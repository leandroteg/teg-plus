// ─────────────────────────────────────────────────────────────────────────────
// OSModal — modal da Ordem de Serviço com corpo específico por etapa do fluxo.
//
// Espelha o fluxo oficial ORG-PRO-001 (Manutenção e Uso de Frotas) e a política
// SUP-PRO-001 (categoria "Manutenção de Frota": 2 orçamentos, SLA 5 dias,
// oficinas credenciadas, corretiva exige foto + parecer):
//
//   Pendente → Cotação → Aprovação → Programação → Execução → Liberado
//
// Quem abre a OS só conhece o PROBLEMA. A solução (e portanto os itens) nasce
// na Cotação, feita por Suprimentos.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import {
  X, Wrench, Car, Camera, ShieldAlert, Loader2, Check, TriangleAlert,
  FileSearch, Send, Building2, Clock,
} from 'lucide-react'
import {
  useItensOS, useSalvarItensOS, useHistoricoPrecoItens, useGarantiasVigentes,
  useAtualizarOS, useAtualizarStatusOS, useAprovarOS, useUploadFotoOS,
  useCotacoesOS, useSalvarCotacao, useFornecedoresFrotas,
} from '../../../hooks/useFrotas'
import ItensOSEditor, { type ItemEdit } from './ItensOSEditor'
import type { FroOrdemServico, FroVeiculo, StatusOS, TipoOS, PrioridadeOS } from '../../../types/frotas'

// ── Fluxo ────────────────────────────────────────────────────────────────────
interface EtapaFluxo {
  label: string
  statuses: StatusOS[]
  /** Quando a OS ENTROU nesta etapa (alimenta o stepper e o lead time). */
  entrada: (os: FroOrdemServico) => string | undefined
}

const FLUXO: EtapaFluxo[] = [
  { label: 'Pendente',    statuses: ['pendente', 'aberta'],       entrada: os => os.data_abertura },
  { label: 'Cotação',     statuses: ['em_cotacao'],               entrada: os => os.data_envio_cotacao },
  { label: 'Aprovação',   statuses: ['aguardando_aprovacao'],     entrada: () => undefined },
  { label: 'Programação', statuses: ['aprovada'],                 entrada: os => os.aprovado_em },
  { label: 'Execução',    statuses: ['em_execucao'],              entrada: os => os.data_entrada_oficina },
  { label: 'Liberado',    statuses: ['concluida'],                entrada: os => os.data_conclusao },
]

const etapaDe = (s: StatusOS) => FLUXO.findIndex(e => e.statuses.includes(s))

// Alçada da política SUP-PRO-001 — categoria Manutenção de Frota.
const LIMITE_ALCADA = 3000
const alcadaDe = (valor?: number) =>
  (valor ?? 0) <= LIMITE_ALCADA
    ? { aprovador: 'Welton', faixa: '≤ R$ 3.000' }
    : { aprovador: 'Laucídio', faixa: '> R$ 3.000' }

const SLA_COTACAO_DIAS = 5

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d?: string) =>
  d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '—'
const diasDesde = (d?: string) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null

const TIPO_LABEL: Record<TipoOS, string> = {
  preventiva: 'Preventiva', corretiva: 'Corretiva', sinistro: 'Sinistro', revisao: 'Revisão',
}
const PRIOR_LABEL: Record<PrioridadeOS, string> = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa',
}

// ── Modal ────────────────────────────────────────────────────────────────────
export default function OSModal({
  os, veiculo, isDark, onClose, onVeiculoClick,
}: {
  os: FroOrdemServico
  veiculo?: FroVeiculo
  isDark: boolean
  onClose: () => void
  onVeiculoClick?: () => void
}) {
  const etapaAtual = etapaDe(os.status)
  const encerrada = os.status === 'rejeitada' || os.status === 'cancelada'

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className={`relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border ${border} ${bg}`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 px-5 py-3.5 border-b ${border} ${bg} rounded-t-2xl`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Wrench size={16} className="text-rose-500 shrink-0" />
              <h3 className={`text-sm font-extrabold font-mono truncate ${txt}`}>
                {os.numero_os || 'Ordem de Serviço'}
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X size={17} />
            </button>
          </div>

          {/* Stepper — cada etapa com a data em que a OS entrou nela */}
          {!encerrada && (
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-0.5">
              {FLUXO.map((e, i) => {
                const passou = i < etapaAtual
                const atual = i === etapaAtual
                const data = e.entrada(os)
                return (
                  <div key={e.label} className="flex items-center gap-1 shrink-0">
                    <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      atual
                        ? 'bg-rose-500 text-white'
                        : passou
                        ? isDark ? 'bg-white/[0.08] text-slate-300' : 'bg-slate-200 text-slate-600'
                        : isDark ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      {e.label}
                      {(passou || atual) && data && (
                        <span className="ml-1 font-normal opacity-75">{fmtData(data)}</span>
                      )}
                    </div>
                    {i < FLUXO.length - 1 && (
                      <span className={i < etapaAtual ? 'text-slate-400' : isDark ? 'text-slate-700' : 'text-slate-200'}>›</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {encerrada && (
            <span className="inline-block mt-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-500">
              {os.status === 'rejeitada' ? 'Rejeitada' : 'Cancelada'}
              {os.motivo_rejeicao && ` · ${os.motivo_rejeicao}`}
            </span>
          )}
        </div>

        {/* Veículo */}
        <div className={`px-5 py-3 border-b ${border}`}>
          <button
            type="button"
            onClick={onVeiculoClick}
            disabled={!onVeiculoClick}
            className="flex items-center gap-2 text-left w-full disabled:cursor-default"
          >
            <Car size={15} className={txtMuted} />
            <div className="min-w-0">
              <p className={`text-sm font-bold ${txt} ${onVeiculoClick ? 'hover:underline decoration-dotted' : ''}`}>
                {veiculo?.codigo_interno || os.veiculo?.placa || '—'}
                <span className={`ml-2 text-xs font-normal ${txtMuted}`}>
                  {os.veiculo?.marca} {os.veiculo?.modelo}
                </span>
              </p>
              <p className={`text-[11px] ${txtMuted}`}>
                {TIPO_LABEL[os.tipo]} · Prioridade {PRIOR_LABEL[os.prioridade]} · Aberta {fmtData(os.data_abertura)}
              </p>
            </div>
          </button>
        </div>

        {/* Corpo por etapa */}
        <div className="p-5">
          {os.status === 'pendente' || os.status === 'aberta' ? (
            <CorpoAbertura os={os} veiculo={veiculo} isDark={isDark} onClose={onClose} />
          ) : os.status === 'em_cotacao' ? (
            <CorpoCotacao os={os} isDark={isDark} onClose={onClose} />
          ) : os.status === 'aguardando_aprovacao' ? (
            <CorpoAprovacao os={os} isDark={isDark} onClose={onClose} />
          ) : (
            <CorpoResumo os={os} isDark={isDark} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Blocos reutilizáveis ─────────────────────────────────────────────────────
function Secao({ titulo, children, isDark, acento }: {
  titulo: string; children: React.ReactNode; isDark: boolean; acento?: 'normal' | 'alerta'
}) {
  const base = acento === 'alerta'
    ? isDark ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-amber-50/60 border-amber-200'
    : isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
  const lbl = acento === 'alerta'
    ? isDark ? 'text-amber-300' : 'text-amber-700'
    : isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className={`rounded-xl border p-4 ${base}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${lbl}`}>{titulo}</p>
      {children}
    </div>
  )
}

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1">
      <TriangleAlert size={11} /> {msg}
    </p>
  )
}

// ── 1 · ABERTURA (Pendente) ──────────────────────────────────────────────────
// Só o problema. Nenhum valor, nenhuma peça — isso é da Cotação.
function CorpoAbertura({ os, veiculo, isDark, onClose }: {
  os: FroOrdemServico; veiculo?: FroVeiculo; isDark: boolean; onClose: () => void
}) {
  const atualizar = useAtualizarOS()
  const mudarStatus = useAtualizarStatusOS()
  const upload = useUploadFotoOS()
  const { data: garantias = [] } = useGarantiasVigentes(os.veiculo_id, veiculo?.hodometro_atual)

  const [problema, setProblema] = useState(os.descricao_problema ?? '')
  const [parecer, setParecer] = useState(os.parecer_tecnico ?? '')
  const [hodometro, setHodometro] = useState(os.hodometro_entrada?.toString() ?? '')
  const [foto, setFoto] = useState(os.foto_antes_url)
  const [erro, setErro] = useState<string>()

  // Política SUP-PRO-001: corretiva exige foto + parecer.
  const exigeEvidencia = os.tipo === 'corretiva' || os.tipo === 'sinistro'

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const lbl = `block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`

  async function enviarParaCotacao() {
    setErro(undefined)
    if (!problema.trim()) return setErro('Descreva o problema.')
    if (exigeEvidencia && !parecer.trim()) return setErro('Parecer técnico é obrigatório na corretiva (SUP-PRO-001).')
    if (exigeEvidencia && !foto) return setErro('Foto do problema é obrigatória na corretiva (SUP-PRO-001).')

    await atualizar.mutateAsync({
      id: os.id,
      descricao_problema: problema.trim(),
      parecer_tecnico: parecer.trim() || undefined,
      hodometro_entrada: hodometro ? +hodometro : undefined,
    })
    await mudarStatus.mutateAsync({
      id: os.id,
      status: 'em_cotacao',
      extra: { data_envio_cotacao: new Date().toISOString() },
    })
    onClose()
  }

  const salvando = atualizar.isPending || mudarStatus.isPending

  return (
    <div className="space-y-4">
      {/* Alerta de garantia vigente — acionar garantia em vez de pagar de novo */}
      {garantias.length > 0 && (
        <Secao titulo="⚠ Garantias vigentes neste veículo" isDark={isDark} acento="alerta">
          <div className="space-y-2">
            {garantias.slice(0, 4).map(g => (
              <div key={g.item.id} className="text-[11px]">
                <p className={`font-bold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                  {g.item.descricao}
                </p>
                <p className={isDark ? 'text-amber-300/80' : 'text-amber-700'}>
                  {g.osNumero ?? 'OS anterior'} · trocado em {fmtData(g.concluidaEm)}
                  {g.diasRestantes != null && ` · ${g.diasRestantes} dias restantes`}
                  {g.kmRestantes != null && ` · ${g.kmRestantes.toLocaleString('pt-BR')} km restantes`}
                </p>
              </div>
            ))}
            <p className={`text-[11px] font-bold pt-1 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
              Se o problema for em um destes itens, acione a garantia em vez de pagar novamente.
            </p>
          </div>
        </Secao>
      )}

      <Secao titulo="Problema identificado" isDark={isDark}>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Descrição do problema *</label>
            <textarea
              rows={3} value={problema} onChange={e => setProblema(e.target.value.toUpperCase())}
              className={`${inp} resize-none`} placeholder="O que o veículo apresentou..."
            />
          </div>
          <div>
            <label className={lbl}>
              Parecer técnico {exigeEvidencia && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={2} value={parecer} onChange={e => setParecer(e.target.value)}
              className={`${inp} resize-none`}
              placeholder="Causa provável, urgência, o que precisa ser verificado..."
            />
          </div>
          <div>
            <label className={lbl}>Hodômetro / horímetro na abertura</label>
            <input
              type="number" value={hodometro} onChange={e => setHodometro(e.target.value)}
              className={`${inp} max-w-[160px]`} placeholder="km"
            />
          </div>
        </div>
      </Secao>

      <Secao titulo={`Foto do problema${exigeEvidencia ? ' *' : ''}`} isDark={isDark}>
        {foto ? (
          <div className="flex items-center gap-3">
            <a href={foto} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-rose-500 hover:underline inline-flex items-center gap-1">
              <Camera size={13} /> Ver foto anexada
            </a>
            <label className={`text-[11px] cursor-pointer ${txtMuted} hover:underline`}>
              trocar
              <input type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) setFoto(await upload.mutateAsync({ osId: os.id, file: f, campo: 'foto_antes_url' }))
                }} />
            </label>
          </div>
        ) : (
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-colors ${
            isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}>
            {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {upload.isPending ? 'Enviando…' : 'Anexar foto'}
            <input type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0]
                if (f) setFoto(await upload.mutateAsync({ osId: os.id, file: f, campo: 'foto_antes_url' }))
              }} />
          </label>
        )}
      </Secao>

      <Erro msg={erro} />

      <button
        onClick={enviarParaCotacao} disabled={salvando}
        className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
      >
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Enviar para Cotação
      </button>
      <p className={`text-[10px] text-center ${txtMuted}`}>
        Suprimentos recebe a OS e cota com as oficinas credenciadas · SLA {SLA_COTACAO_DIAS} dias
      </p>
    </div>
  )
}

// ── 2 · COTAÇÃO ──────────────────────────────────────────────────────────────
// Onde a solução nasce: 2 orçamentos (SUP-PRO-001) + os itens.
function CorpoCotacao({ os, isDark, onClose }: {
  os: FroOrdemServico; isDark: boolean; onClose: () => void
}) {
  const { data: itensSalvos = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()
  const { data: cotacoes = [] } = useCotacoesOS(os.id)
  const { data: fornecedores = [] } = useFornecedoresFrotas()
  const salvarItens = useSalvarItensOS()
  const salvarCotacao = useSalvarCotacao()
  const atualizar = useAtualizarOS()
  const mudarStatus = useAtualizarStatusOS()

  const [itens, setItens] = useState<ItemEdit[]>([])
  const [justificativa, setJustificativa] = useState(os.justificativa_excecao ?? '')
  const [fornecedorId, setFornecedorId] = useState(os.fornecedor_id ?? '')
  const [dataEntrada, setDataEntrada] = useState(os.data_programada_entrada ?? '')
  const [erro, setErro] = useState<string>()

  // Carrega os itens já salvos uma vez.
  useEffect(() => {
    if (itensSalvos.length) {
      setItens(itensSalvos.map(i => ({
        tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
      })))
    }
  }, [itensSalvos])

  const total = itens.reduce((s, i) => s + (i.quantidade || 0) * (i.valor_unitario || 0), 0)
  const diasSla = diasDesde(os.data_envio_cotacao)
  const slaEstourado = diasSla != null && diasSla > SLA_COTACAO_DIAS

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const lbl = `block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`

  async function enviarParaAprovacao() {
    setErro(undefined)
    const validos = itens.filter(i => i.descricao.trim() && i.valor_unitario > 0)
    if (!validos.length) return setErro('Lance ao menos um item (peça ou mão de obra).')
    if (cotacoes.length < 2 && !justificativa.trim()) {
      return setErro('A política pede 2 orçamentos. Com menos, a justificativa é obrigatória.')
    }

    await salvarItens.mutateAsync({ osId: os.id, itens: validos, campoValor: 'valor_orcado' })
    await atualizar.mutateAsync({
      id: os.id,
      fornecedor_id: fornecedorId || undefined,
      data_programada_entrada: dataEntrada || undefined,
      justificativa_excecao: cotacoes.length < 2 ? justificativa.trim() : undefined,
    })
    await mudarStatus.mutateAsync({ id: os.id, status: 'aguardando_aprovacao' })
    onClose()
  }

  const salvando = salvarItens.isPending || atualizar.isPending || mudarStatus.isPending

  return (
    <div className="space-y-4">
      {/* O problema, para quem vai cotar */}
      <Secao titulo="O problema" isDark={isDark}>
        <p className={`text-xs whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {os.descricao_problema}
        </p>
        {os.parecer_tecnico && (
          <p className={`text-[11px] mt-2 pt-2 border-t ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            <span className="font-bold">Parecer: </span>{os.parecer_tecnico}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          {os.foto_antes_url && (
            <a href={os.foto_antes_url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-semibold text-rose-500 hover:underline inline-flex items-center gap-1">
              <Camera size={11} /> Foto do problema
            </a>
          )}
          {diasSla != null && (
            <span className={`ml-auto text-[11px] font-bold inline-flex items-center gap-1 ${
              slaEstourado ? 'text-red-500' : diasSla >= SLA_COTACAO_DIAS - 1 ? 'text-amber-500' : txtMuted
            }`}>
              <Clock size={11} /> {diasSla} de {SLA_COTACAO_DIAS} dias
            </span>
          )}
        </div>
      </Secao>

      {/* Cotações — mínimo 2 pela política */}
      <Secao titulo={`Orçamentos (${cotacoes.length}/2 mínimo)`} isDark={isDark}>
        <div className="space-y-2">
          {cotacoes.map(c => (
            <div key={c.id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 ${
              isDark ? 'bg-white/[0.04]' : 'bg-white border border-slate-200'
            }`}>
              <Building2 size={12} className={txtMuted} />
              <span className={`font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {c.fornecedor?.nome_fantasia ?? c.fornecedor?.razao_social ?? '—'}
              </span>
              <span className={`ml-auto font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {BRL(c.valor_total)}
              </span>
              {c.prazo_execucao_dias != null && (
                <span className={txtMuted}>{c.prazo_execucao_dias}d</span>
              )}
            </div>
          ))}
          <NovaCotacao osId={os.id} fornecedores={fornecedores} isDark={isDark} onSalvar={salvarCotacao} />
          {cotacoes.length < 2 && (
            <div className="pt-1">
              <label className={lbl}>Justificativa para seguir com menos de 2 orçamentos *</label>
              <textarea
                rows={2} value={justificativa} onChange={e => setJustificativa(e.target.value)}
                className={`${inp} resize-none`}
                placeholder="Ex: veículo parado em obra, oficina única na região..."
              />
            </div>
          )}
        </div>
      </Secao>

      {/* Itens — o coração da estruturação */}
      <Secao titulo="Itens do orçamento" isDark={isDark}>
        <ItensOSEditor itens={itens} onChange={setItens} isDark={isDark} precoHist={precoHist} />
      </Secao>

      <Secao titulo="Oficina e agenda" isDark={isDark}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Oficina (credenciada)</label>
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.nome_fantasia ?? f.razao_social}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Entrada prevista</label>
            <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} className={inp} />
          </div>
        </div>
      </Secao>

      <Erro msg={erro} />

      <button
        onClick={enviarParaAprovacao} disabled={salvando}
        className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
      >
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
        Enviar para Aprovação · {BRL(total)}
      </button>
      <p className={`text-[10px] text-center ${txtMuted}`}>
        Alçada: {alcadaDe(total).aprovador} ({alcadaDe(total).faixa})
      </p>
    </div>
  )
}

function NovaCotacao({ osId, fornecedores, isDark, onSalvar }: {
  osId: string
  fornecedores: { id: string; razao_social: string; nome_fantasia?: string }[]
  isDark: boolean
  onSalvar: ReturnType<typeof useSalvarCotacao>
}) {
  const [aberto, setAberto] = useState(false)
  const [forn, setForn] = useState('')
  const [valor, setValor] = useState('')
  const [prazo, setPrazo] = useState('')

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inp = `rounded-lg border px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`

  if (!aberto) {
    return (
      <button
        type="button" onClick={() => setAberto(true)}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
          isDark ? 'border-white/[0.1] text-slate-300 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
        }`}
      >
        <FileSearch size={12} /> Adicionar orçamento
      </button>
    )
  }

  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${isDark ? 'border-white/[0.1]' : 'border-slate-200'}`}>
      <select value={forn} onChange={e => setForn(e.target.value)} className={`${inp} w-full`}>
        <option value="">Oficina...</option>
        {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia ?? f.razao_social}</option>)}
      </select>
      <div className="flex gap-2">
        <input type="number" placeholder="Valor R$" value={valor} onChange={e => setValor(e.target.value)} className={`${inp} flex-1`} />
        <input type="number" placeholder="Prazo (d)" value={prazo} onChange={e => setPrazo(e.target.value)} className={`${inp} w-[100px]`} />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAberto(false)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold ${txtMuted}`}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!forn || !valor || onSalvar.isPending}
          onClick={async () => {
            await onSalvar.mutateAsync({
              os_id: osId, fornecedor_id: forn, valor_total: +valor,
              prazo_execucao_dias: prazo ? +prazo : undefined,
            })
            setForn(''); setValor(''); setPrazo(''); setAberto(false)
          }}
          className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold disabled:opacity-50"
        >
          Salvar orçamento
        </button>
      </div>
    </div>
  )
}

// ── 3 · APROVAÇÃO ────────────────────────────────────────────────────────────
// Decisão informada: impacto + itens + desvio de preço + alçada real.
function CorpoAprovacao({ os, isDark, onClose }: {
  os: FroOrdemServico; isDark: boolean; onClose: () => void
}) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()
  const { data: cotacoes = [] } = useCotacoesOS(os.id)
  const aprovar = useAprovarOS()

  const [modo, setModo] = useState<'ver' | 'ajustar' | 'rejeitar'>('ver')
  const [valorAjuste, setValorAjuste] = useState(os.valor_orcado?.toString() ?? '')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string>()

  const total = os.valor_orcado ?? itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0)
  const alc = alcadaDe(total)
  const diasParado = diasDesde(os.data_abertura)

  const itensEdit = useMemo<ItemEdit[]>(() => itens.map(i => ({
    tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
    valor_unitario: i.valor_unitario,
    garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
  })), [itens])

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`

  async function decidir(ok: boolean) {
    setErro(undefined)
    if (!ok && !motivo.trim()) return setErro('Motivo da rejeição é obrigatório.')
    await aprovar.mutateAsync({
      id: os.id,
      aprovado: ok,
      valor: ok ? (modo === 'ajustar' ? +valorAjuste : total) : undefined,
      motivo: ok ? undefined : motivo.trim(),
    })
    onClose()
  }

  return (
    <div className="space-y-4">
      {/* Impacto — o que está em jogo */}
      <div className={`rounded-xl border p-3 ${
        isDark ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-red-50/60 border-red-200'
      }`}>
        <p className={`text-xs font-bold ${isDark ? 'text-red-200' : 'text-red-800'}`}>
          Veículo parado há {diasParado ?? '—'} dias
        </p>
        <p className={`text-[11px] ${isDark ? 'text-red-300/80' : 'text-red-700'}`}>
          {TIPO_LABEL[os.tipo]} · prioridade {PRIOR_LABEL[os.prioridade]}
        </p>
      </div>

      {/* Justificativa de exceção, se houver */}
      {os.justificativa_excecao && (
        <Secao titulo="⚠ Seguiu com menos de 2 orçamentos" isDark={isDark} acento="alerta">
          <p className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>{os.justificativa_excecao}</p>
        </Secao>
      )}

      {/* O que será feito */}
      <Secao titulo="O que será feito" isDark={isDark}>
        <ItensOSEditor itens={itensEdit} onChange={() => {}} isDark={isDark} precoHist={precoHist} readOnly />
      </Secao>

      {/* Orçamentos concorrentes */}
      {cotacoes.length > 0 && (
        <Secao titulo="Orçamentos recebidos" isDark={isDark}>
          <div className="space-y-1.5">
            {cotacoes.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className={c.selecionado ? 'text-rose-500' : txtMuted}>{c.selecionado ? '◉' : '○'}</span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                  {c.fornecedor?.nome_fantasia ?? c.fornecedor?.razao_social}
                </span>
                <span className={`ml-auto font-bold ${txt}`}>{BRL(c.valor_total)}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {/* Evidência */}
      {(os.foto_antes_url || os.parecer_tecnico) && (
        <Secao titulo="Evidência da abertura" isDark={isDark}>
          {os.parecer_tecnico && <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{os.parecer_tecnico}</p>}
          {os.foto_antes_url && (
            <a href={os.foto_antes_url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-semibold text-rose-500 hover:underline inline-flex items-center gap-1 mt-1">
              <Camera size={11} /> Ver foto
            </a>
          )}
        </Secao>
      )}

      {/* Total + alçada */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-baseline justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>Total</span>
          <span className={`text-2xl font-black ${txt}`}>{BRL(total)}</span>
        </div>
        <p className={`text-[11px] mt-1 ${txtMuted}`}>
          Alçada: <span className="font-bold">{alc.aprovador}</span> ({alc.faixa}) · política SUP-PRO-001
        </p>
      </div>

      {modo === 'ajustar' && (
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Valor aprovado</label>
          <input type="number" value={valorAjuste} onChange={e => setValorAjuste(e.target.value)} className={inp} />
        </div>
      )}
      {modo === 'rejeitar' && (
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`}>Motivo da rejeição *</label>
          <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} className={`${inp} resize-none`} />
        </div>
      )}

      <Erro msg={erro} />

      <div className="flex flex-col gap-2">
        {modo === 'rejeitar' ? (
          <div className="flex gap-2">
            <button onClick={() => { setModo('ver'); setErro(undefined) }}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
              Voltar
            </button>
            <button onClick={() => decidir(false)} disabled={aprovar.isPending}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50">
              Confirmar rejeição
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => decidir(true)} disabled={aprovar.isPending}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {aprovar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Aprovar {BRL(modo === 'ajustar' ? +valorAjuste || 0 : total)}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setModo(modo === 'ajustar' ? 'ver' : 'ajustar')}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
                {modo === 'ajustar' ? 'Cancelar ajuste' : 'Aprovar com ajuste'}
              </button>
              <button onClick={() => setModo('rejeitar')}
                className="flex-1 py-2 rounded-xl border border-red-500/30 text-red-500 text-xs font-semibold">
                Rejeitar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Demais etapas (Programação / Execução / Liberado) ────────────────────────
// Resumo com os itens estruturados. As ações destas etapas entram na sequência.
function CorpoResumo({ os, isDark }: { os: FroOrdemServico; isDark: boolean }) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()

  const itensEdit = useMemo<ItemEdit[]>(() => itens.map(i => ({
    tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
    valor_unitario: i.valor_unitario,
    garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
  })), [itens])

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="space-y-4">
      <Secao titulo="Problema" isDark={isDark}>
        <p className={`text-xs whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {os.descricao_problema}
        </p>
      </Secao>

      {itens.length > 0 && (
        <Secao titulo="Itens" isDark={isDark}>
          <ItensOSEditor itens={itensEdit} onChange={() => {}} isDark={isDark} precoHist={precoHist} readOnly />
        </Secao>
      )}

      <Secao titulo="Valores" isDark={isDark}>
        <div className="grid grid-cols-3 gap-3 text-center">
          {([
            ['Orçado', os.valor_orcado],
            ['Aprovado', os.valor_aprovado],
            ['Realizado', os.valor_final],
          ] as [string, number | undefined][]).map(([l, v]) => (
            <div key={l}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{l}</p>
              <p className={`text-sm font-black ${txt}`}>{v != null ? BRL(v) : '—'}</p>
            </div>
          ))}
        </div>
      </Secao>

      {os.status_detalhe && (
        <Secao titulo="Situação" isDark={isDark}>
          <p className={`text-xs font-semibold ${txt}`}>{os.status_detalhe}</p>
        </Secao>
      )}
    </div>
  )
}
