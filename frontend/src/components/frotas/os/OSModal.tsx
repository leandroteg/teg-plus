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
  FileSearch, Send, Building2, Clock, CalendarClock, PauseCircle, PlayCircle,  MessageSquare, Trash2, FileText } from 'lucide-react'
import {
  useItensOS, useSalvarItensOS, useHistoricoPrecoItens, useGarantiasVigentes,
  useAtualizarOS, useAtualizarStatusOS, useAprovarOS, useUploadFotoOS,
  useCotacoesOS, useSalvarCotacao, useFornecedoresOS,
  useProgramarEntradaOS, useLiberarOS, useAlocacoes, useVeiculos, useChecklists,
  useComentariosOS, useAdicionarComentarioOS, useRemoverComentarioOS,
} from '../../../hooks/useFrotas'
import { useAuth } from '../../../contexts/AuthContext'
import FornecedorPicker from './FornecedorPicker'
import ItensOSEditor, { type ItemEdit } from './ItensOSEditor'
import { OSAnexos, OSRelatorioModal } from './OSAnexos'
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
const NATUREZA_LABEL: Record<string, string> = {
  material: 'Material/Compra', servico: 'Serviço', manutencao: 'Manutenção',
}
/** Rótulo de classificação: tipo de manutenção, ou natureza quando é demanda de suprimento. */
const classifOS = (os: FroOrdemServico) =>
  os.tipo ? TIPO_LABEL[os.tipo] : (os.natureza ? NATUREZA_LABEL[os.natureza] : 'Demanda')
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
  const emEspera = os.status === 'aguardando'

  // Pausar: leva a OS para "Aguardando" (para mas não cancela nem conclui),
  // guardando a etapa de origem para retomar depois. Motivo vai em status_detalhe.
  const mudarStatus = useAtualizarStatusOS()
  const [pausando, setPausando] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const pausar = () => {
    mudarStatus.mutate(
      { id: os.id, status: 'aguardando', extra: { status_anterior: os.status, status_detalhe: motivoPausa || null } },
      { onSuccess: onClose },
    )
  }

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
          {!encerrada && !emEspera && (
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
          {emEspera && (
            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-orange-500/15 text-orange-500">
              <PauseCircle size={11} /> Aguardando
              {os.status_detalhe && ` · ${os.status_detalhe}`}
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
                {veiculo?.codigo_interno || os.veiculo?.placa || os.ativo_livre || 'Demanda de suprimentos'}
                <span className={`ml-2 text-xs font-normal ${txtMuted}`}>
                  {os.veiculo?.marca} {os.veiculo?.modelo}
                </span>
              </p>
              <p className={`text-[11px] ${txtMuted}`}>
                {classifOS(os)} · Prioridade {PRIOR_LABEL[os.prioridade]} · Aberta {fmtData(os.data_abertura)}
              </p>
            </div>
          </button>
        </div>

        {/* Pausar → Aguardando (disponível em qualquer etapa ativa) */}
        {!encerrada && !emEspera && os.status !== 'concluida' && (
          <div className={`px-5 py-2 border-b ${border}`}>
            {pausando ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={motivoPausa} onChange={e => setMotivoPausa(e.target.value)}
                  placeholder="Motivo (opcional): peça em falta, aguardando terceiro…"
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] focus:outline-none focus:ring-2 focus:ring-orange-500/30 ${
                    isDark ? 'bg-white/[0.04] border-white/[0.1] text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                  }`} />
                <button onClick={pausar} disabled={mudarStatus.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50">
                  {mudarStatus.isPending ? <Loader2 size={12} className="animate-spin" /> : <PauseCircle size={12} />} Confirmar
                </button>
                <button onClick={() => { setPausando(false); setMotivoPausa('') }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setPausando(true)}
                className={`flex items-center gap-1.5 text-[11px] font-semibold ${isDark ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'}`}>
                <PauseCircle size={13} /> Colocar em Aguardando
              </button>
            )}
          </div>
        )}

        {/* Corpo por etapa */}
        <div className="p-5">
          {os.status === 'pendente' || os.status === 'aberta' ? (
            <CorpoAbertura os={os} veiculo={veiculo} isDark={isDark} onClose={onClose} />
          ) : os.status === 'em_cotacao' ? (
            <CorpoCotacao os={os} isDark={isDark} onClose={onClose} />
          ) : os.status === 'aguardando_aprovacao' ? (
            <CorpoAprovacao os={os} isDark={isDark} onClose={onClose} />
          ) : os.status === 'aprovada' ? (
            <CorpoProgramacao os={os} veiculo={veiculo} isDark={isDark} onClose={onClose} />
          ) : os.status === 'em_execucao' ? (
            <CorpoExecucao os={os} isDark={isDark} onClose={onClose} />
          ) : os.status === 'aguardando' ? (
            <CorpoAguardando os={os} isDark={isDark} onClose={onClose} />
          ) : os.status === 'concluida' ? (
            <CorpoLiberado os={os} isDark={isDark} />
          ) : (
            <CorpoResumo os={os} isDark={isDark} />
          )}

          {/* Comentários — disponíveis em qualquer etapa do fluxo */}
          <div className="mt-4">
            <ComentariosOS osId={os.id} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Comentários da OS ────────────────────────────────────────────────────────
function ComentariosOS({ osId, isDark }: { osId: string; isDark: boolean }) {
  const { perfil } = useAuth()
  const { data: comentarios = [], isLoading } = useComentariosOS(osId)
  const adicionar = useAdicionarComentarioOS()
  const remover = useRemoverComentarioOS()
  const [texto, setTexto] = useState('')

  const txt = isDark ? 'text-slate-200' : 'text-slate-700'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  const iniciais = (nome?: string | null) =>
    (nome ?? '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?'

  async function enviar() {
    if (!texto.trim() || adicionar.isPending) return
    try {
      await adicionar.mutateAsync({ osId, mensagem: texto, autorId: perfil?.id ?? null, autorNome: perfil?.nome ?? null })
      setTexto('')
    } catch (e: any) { alert(`Erro ao comentar: ${e?.message ?? 'desconhecido'}`) }
  }

  return (
    <Secao titulo={`Comentários${comentarios.length ? ` (${comentarios.length})` : ''}`} isDark={isDark}>
      {isLoading ? (
        <p className={`text-[11px] flex items-center gap-1.5 ${txtMuted}`}>
          <Loader2 size={11} className="animate-spin" /> carregando…
        </p>
      ) : comentarios.length === 0 ? (
        <p className={`text-[11px] flex items-center gap-1.5 ${txtMuted}`}>
          <MessageSquare size={11} /> Nenhum comentário ainda.
        </p>
      ) : (
        <div className="space-y-2.5 mb-3">
          {comentarios.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700'
              }`}>
                {iniciais(c.criado_por_nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold ${txt}`}>{c.criado_por_nome ?? 'Sem autor'}</span>
                  <span className={`text-[10px] ${txtMuted}`}>{quando(c.created_at)}</span>
                  {perfil?.id && c.autor_id === perfil.id && (
                    <button
                      onClick={() => { if (window.confirm('Apagar este comentário?')) remover.mutate({ id: c.id, osId }) }}
                      className={`ml-auto p-0.5 rounded ${txtMuted} hover:text-red-500`}
                      title="Apagar meu comentário"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <p className={`text-[12px] whitespace-pre-wrap break-words ${txt}`}>{c.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar() } }}
          rows={2}
          placeholder="Escreva um comentário… (Ctrl+Enter envia)"
          className={`flex-1 text-[12px] rounded-lg border px-2.5 py-2 outline-none resize-none ${
            isDark
              ? 'bg-white/[0.04] border-white/10 text-slate-100 placeholder-slate-500'
              : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
          }`}
        />
        <button
          onClick={enviar}
          disabled={!texto.trim() || adicionar.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
        >
          {adicionar.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Enviar
        </button>
      </div>
    </Secao>
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

  // A SUP-PRO-001 exige foto + parecer na corretiva; aqui vale para TODO tipo.
  // A abertura fica idêntica em preventiva, corretiva, sinistro e revisão: quem
  // vai cotar precisa da mesma evidência, e o histórico não fica capenga por tipo.

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const lbl = `block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`

  async function enviarParaCotacao() {
    setErro(undefined)
    if (!problema.trim()) return setErro('Descreva o problema.')
    if (!parecer.trim()) return setErro('Parecer técnico é obrigatório para enviar à cotação.')
    if (!foto) return setErro('Foto do problema é obrigatória para enviar à cotação.')

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
              Parecer técnico <span className="text-rose-500">*</span>
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

      <Secao titulo="Foto do problema *" isDark={isDark}>
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

      {/* Além da foto obrigatória acima: quantas fotos/documentos quiser */}
      <OSAnexos osId={os.id} etapa="requisicao" isDark={isDark} titulo="Outras fotos e documentos" />
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
  const salvarItens = useSalvarItensOS()
  const salvarCotacao = useSalvarCotacao()
  const atualizar = useAtualizarOS()
  const mudarStatus = useAtualizarStatusOS()

  const [itens, setItens] = useState<ItemEdit[]>([])
  const [verParecer, setVerParecer] = useState(false)
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
          <NovaCotacao osId={os.id} isDark={isDark} onSalvar={salvarCotacao} />
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

      <Secao titulo="Fornecedor e agenda" isDark={isDark}>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Fornecedor (oficina, autopeças, distribuidora…)</label>
            <FornecedorPicker
              valorId={fornecedorId}
              valorNome={os.fornecedor?.nome_fantasia ?? os.fornecedor?.razao_social}
              onChange={f => setFornecedorId(f?.id ?? '')}
              isDark={isDark}
            />
          </div>
          <div>
            <label className={lbl}>Entrada prevista</label>
            <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)}
              className={`${inp} max-w-[180px]`} />
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

      <OSAnexos osId={os.id} etapa="cotacao" isDark={isDark} titulo="Orçamentos, laudos e fotos da avaliação" />

      <button
        onClick={() => setVerParecer(true)}
        className={`w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 ${
          isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <FileText size={13} /> Gerar Parecer Técnico
      </button>
      {verParecer && (
        <OSRelatorioModal osId={os.id} numeroOS={os.numero_os} tipo="parecer" isDark={isDark}
          onClose={() => setVerParecer(false)} />
      )}
    </div>
  )
}

function NovaCotacao({ osId, isDark, onSalvar }: {
  osId: string
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
      <FornecedorPicker valorId={forn} onChange={f => setForn(f?.id ?? '')} isDark={isDark}
        placeholder="Buscar fornecedor do orçamento..." />
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

  const salvarItens = useSalvarItensOS()
  const [modo, setModo] = useState<'ver' | 'ajustar' | 'rejeitar'>('ver')
  const [valorAjuste, setValorAjuste] = useState(os.valor_orcado?.toString() ?? '')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string>()
  const [detalhando, setDetalhando] = useState(false)
  const [itensNovos, setItensNovos] = useState<ItemEdit[]>([])

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
          {classifOS(os)} · prioridade {PRIOR_LABEL[os.prioridade]}
        </p>
      </div>

      {/* Justificativa de exceção, se houver */}
      {os.justificativa_excecao && (
        <Secao titulo="⚠ Seguiu com menos de 2 orçamentos" isDark={isDark} acento="alerta">
          <p className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>{os.justificativa_excecao}</p>
        </Secao>
      )}

      {/* O que será feito — OS antiga pode não ter itens; permite detalhar aqui. */}
      <Secao titulo="O que será feito" isDark={isDark} acento={itens.length === 0 ? 'alerta' : 'normal'}>
        {itens.length === 0 && !detalhando ? (
          <div className="space-y-2">
            <p className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
              Esta OS foi orçada em <span className="font-bold">{BRL(total)}</span> sem detalhamento de
              peças e mão de obra — aprovar assim é decidir no escuro, e o valor não entra nos indicadores
              de custo por tipo nem no histórico de preço.
            </p>
            <button
              onClick={() => { setDetalhando(true); setItensNovos([{ tipo: 'peca', descricao: '', quantidade: 1, valor_unitario: total }]) }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${
                isDark ? 'border-amber-500/30 text-amber-200 hover:bg-amber-500/10' : 'border-amber-300 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <FileSearch size={12} /> Detalhar os itens agora
            </button>
          </div>
        ) : detalhando ? (
          <div className="space-y-2">
            <ItensOSEditor itens={itensNovos} onChange={setItensNovos} isDark={isDark} precoHist={precoHist} />
            <div className="flex gap-2">
              <button onClick={() => setDetalhando(false)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold ${txtMuted}`}>
                Cancelar
              </button>
              <button
                disabled={salvarItens.isPending}
                onClick={async () => {
                  const validos = itensNovos.filter(i => i.descricao.trim() && i.valor_unitario > 0)
                  if (!validos.length) return setErro('Preencha descrição e valor dos itens.')
                  await salvarItens.mutateAsync({ osId: os.id, itens: validos, campoValor: 'valor_orcado' })
                  setDetalhando(false)
                }}
                className="flex-1 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold disabled:opacity-50"
              >
                {salvarItens.isPending ? 'Salvando…' : 'Salvar itens'}
              </button>
            </div>
          </div>
        ) : (
          <ItensOSEditor itens={itensEdit} onChange={() => {}} isDark={isDark} precoHist={precoHist} readOnly />
        )}
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

// ── 4 · PROGRAMAÇÃO ──────────────────────────────────────────────────────────
// Etapa 7 do fluxo oficial: tirar o veículo da operação de forma controlada.
function CorpoProgramacao({ os, veiculo, isDark, onClose }: {
  os: FroOrdemServico; veiculo?: FroVeiculo; isDark: boolean; onClose: () => void
}) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: alocacoes = [] } = useAlocacoes({ status: 'ativa', veiculo_id: os.veiculo_id })
  const { data: veiculos = [] } = useVeiculos()
  const programar = useProgramarEntradaOS()

  const alocacao = alocacoes[0]
  const hoje = new Date().toISOString().slice(0, 10)
  const [dataEntrada, setDataEntrada] = useState(os.data_programada_entrada || hoje)
  const [hodometro, setHodometro] = useState(veiculo?.hodometro_atual?.toString() ?? '')
  const [desalocar, setDesalocar] = useState(true)
  const [substituto, setSubstituto] = useState('')
  const [erro, setErro] = useState<string>()

  // Candidatos a substituto: mesma categoria, disponíveis, exceto o próprio.
  const candidatos = useMemo(
    () => veiculos.filter(v =>
      v.id !== os.veiculo_id && v.status === 'disponivel' && v.categoria === veiculo?.categoria),
    [veiculos, os.veiculo_id, veiculo?.categoria],
  )

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const lbl = `block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`

  async function confirmar() {
    setErro(undefined)
    if (!dataEntrada) return setErro('Informe a data de entrada na oficina.')
    await programar.mutateAsync({
      osId: os.id,
      veiculoId: os.veiculo_id,
      dataEntrada: new Date(dataEntrada + 'T12:00:00').toISOString(),
      hodometroEntrada: hodometro ? +hodometro : undefined,
      alocacaoId: desalocar ? alocacao?.id : undefined,
      substitutoId: substituto || undefined,
      obraId: alocacao?.obra_id,
      centroCustoId: alocacao?.centro_custo_id,
      responsavelNome: alocacao?.responsavel_nome,
    })
    onClose()
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Aprovado" isDark={isDark}>
        <div className="flex items-baseline justify-between mb-2">
          <span className={`text-xs ${txtMuted}`}>
            {os.fornecedor?.nome_fantasia ?? os.fornecedor?.razao_social ?? 'Oficina não definida'}
          </span>
          <span className={`text-lg font-black ${txt}`}>{BRL(os.valor_aprovado ?? os.valor_orcado ?? 0)}</span>
        </div>
        {itens.length > 0 && (
          <ul className={`text-[11px] space-y-0.5 ${txtMuted}`}>
            {itens.map(i => (
              <li key={i.id}>• {i.descricao} — {i.quantidade}× {BRL(i.valor_unitario)}</li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Entrada na oficina" isDark={isDark}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data de entrada *</label>
            <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Hodômetro de entrada</label>
            <input type="number" value={hodometro} onChange={e => setHodometro(e.target.value)} className={inp} />
          </div>
        </div>
        <p className={`text-[10px] mt-2 ${txtMuted}`}>
          A partir daqui conta o tempo de oficina — a espera até aqui fica registrada como espera administrativa.
        </p>
      </Secao>

      <Secao titulo="Veículo na obra" isDark={isDark}>
        {alocacao ? (
          <div className="space-y-3">
            <p className={`text-xs ${txt}`}>
              Alocado em <span className="font-bold">{alocacao.obra?.nome ?? '—'}</span>
              {alocacao.responsavel_nome && <span className={txtMuted}> · {alocacao.responsavel_nome}</span>}
            </p>
            <label className={`flex items-center gap-2 text-xs font-semibold ${txt}`}>
              <input type="checkbox" checked={desalocar} onChange={e => setDesalocar(e.target.checked)} className="accent-rose-500" />
              Encerrar a alocação (o veículo sai da obra)
            </label>
            {desalocar && (
              <div>
                <label className={lbl}>Substituto para a obra (opcional)</label>
                <select value={substituto} onChange={e => setSubstituto(e.target.value)} className={inp}>
                  <option value="">Sem substituto</option>
                  {candidatos.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.codigo_interno || v.placa} — {v.marca} {v.modelo}
                    </option>
                  ))}
                </select>
                {candidatos.length === 0 && (
                  <p className={`text-[10px] mt-1 ${txtMuted}`}>
                    Nenhum veículo disponível da mesma categoria.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className={`text-xs ${txtMuted}`}>Veículo sem alocação ativa — nada a desalocar.</p>
        )}
      </Secao>

      <Erro msg={erro} />

      <button
        onClick={confirmar} disabled={programar.isPending}
        className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
      >
        {programar.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
        Confirmar entrada na oficina
      </button>
    </div>
  )
}

// ── 5 · EXECUÇÃO ─────────────────────────────────────────────────────────────
const SUB_STATUS = ['Em serviço', 'Aguardando peça', 'Aguardando NF', 'Pronto p/ retirada']

function CorpoExecucao({ os, isDark, onClose }: {
  os: FroOrdemServico; isDark: boolean; onClose: () => void
}) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()
  const atualizar = useAtualizarOS()
  const [liberando, setLiberando] = useState(false)
  const [verConclusao, setVerConclusao] = useState(false)

  const diasOficina = diasDesde(os.data_entrada_oficina)
  const atrasado = os.data_previsao ? new Date(os.data_previsao) < new Date() : false

  const itensEdit = useMemo<ItemEdit[]>(() => itens.map(i => ({
    tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
    valor_unitario: i.valor_unitario,
    garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
  })), [itens])

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'

  if (liberando) {
    return <CorpoLiberacao os={os} isDark={isDark} onClose={onClose} onVoltar={() => setLiberando(false)} />
  }

  return (
    <div className="space-y-4">
      {/* Contador de oficina */}
      <div className={`rounded-xl border p-3 ${
        isDark ? 'bg-violet-500/[0.06] border-violet-500/20' : 'bg-violet-50/60 border-violet-200'
      }`}>
        <p className={`text-sm font-bold ${isDark ? 'text-violet-200' : 'text-violet-900'}`}>
          {diasOficina != null ? `${diasOficina} dias na oficina` : 'Entrada na oficina não registrada'}
        </p>
        <p className={`text-[11px] ${isDark ? 'text-violet-300/80' : 'text-violet-700'}`}>
          {os.fornecedor?.nome_fantasia ?? os.fornecedor?.razao_social ?? 'Oficina não definida'}
          {os.data_previsao && (
            <span className={atrasado ? ' text-red-500 font-bold' : ''}>
              {' · '}previsão {fmtData(os.data_previsao)}{atrasado && ' (atrasado)'}
            </span>
          )}
        </p>
      </div>

      {/* Sub-status — campo já lido pelo Painel de Disponibilidade */}
      <Secao titulo="Situação na oficina" isDark={isDark}>
        <div className="flex flex-wrap gap-1.5">
          {SUB_STATUS.map(s => {
            const ativo = os.status_detalhe === s
            return (
              <button
                key={s}
                onClick={() => atualizar.mutate({ id: os.id, status_detalhe: ativo ? undefined : s })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  ativo
                    ? 'bg-rose-500 text-white'
                    : isDark ? 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            )
          })}
        </div>
        {os.status_detalhe && !SUB_STATUS.includes(os.status_detalhe) && (
          <p className={`text-[11px] mt-2 ${txtMuted}`}>Atual: {os.status_detalhe}</p>
        )}
      </Secao>

      {itens.length > 0 && (
        <Secao titulo="Serviço aprovado" isDark={isDark}>
          <ItensOSEditor itens={itensEdit} onChange={() => {}} isDark={isDark} precoHist={precoHist} readOnly />
        </Secao>
      )}

      <Secao titulo="Problema" isDark={isDark}>
        <p className={`text-xs whitespace-pre-wrap ${txt}`}>{os.descricao_problema}</p>
      </Secao>

      <OSAnexos osId={os.id} etapa="execucao" isDark={isDark} titulo="Fotos do serviço executado e NF" />

      <button
        onClick={() => setVerConclusao(true)}
        className={`w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 ${
          isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <FileText size={13} /> Gerar Relatório de Conclusão
      </button>
      {verConclusao && (
        <OSRelatorioModal osId={os.id} numeroOS={os.numero_os} tipo="conclusao" isDark={isDark}
          onClose={() => setVerConclusao(false)} />
      )}

      <button
        onClick={() => setLiberando(true)}
        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
      >
        <Check size={14} /> Concluir e Liberar veículo
      </button>
    </div>
  )
}

// ── 6 · LIBERAÇÃO (fechamento) ───────────────────────────────────────────────
// Checklist pós-manutenção é BLOQUEANTE: "veículo não liberado sem checklist
// pós-manutenção assinado" (ORG-PRO-001).
function CorpoLiberacao({ os, isDark, onClose, onVoltar }: {
  os: FroOrdemServico; isDark: boolean; onClose: () => void; onVoltar: () => void
}) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()
  const { data: checklists = [] } = useChecklists({ veiculo_id: os.veiculo_id, tipo: 'pos_manutencao', limit: 10 })
  const { data: obras = [] } = useAlocacoes({ status: 'ativa' })
  const salvarItens = useSalvarItensOS()
  const liberar = useLiberarOS()
  const upload = useUploadFotoOS()

  const [itensReais, setItensReais] = useState<ItemEdit[]>([])
  const [hodometro, setHodometro] = useState(os.hodometro_saida?.toString() ?? '')
  const [servico, setServico] = useState(os.descricao_servico ?? '')
  const [foto, setFoto] = useState(os.foto_depois_url)
  const [destino, setDestino] = useState<'patio' | 'obra'>('patio')
  const [obraId, setObraId] = useState('')
  const [erro, setErro] = useState<string>()

  useEffect(() => {
    if (itens.length) {
      setItensReais(itens.map(i => ({
        tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
      })))
    }
  }, [itens])

  // Checklist pós-manutenção posterior à entrada na oficina.
  const checklistOk = useMemo(() => {
    const ref = os.data_entrada_oficina ? new Date(os.data_entrada_oficina).getTime() : 0
    return checklists.some(c => new Date(c.data_checklist).getTime() >= ref)
  }, [checklists, os.data_entrada_oficina])

  const total = itensReais.reduce((s, i) => s + (i.quantidade || 0) * (i.valor_unitario || 0), 0)
  const aprovado = os.valor_aprovado ?? os.valor_orcado ?? 0
  const desvio = aprovado > 0 ? (total - aprovado) / aprovado : null

  const obrasUnicas = useMemo(() => {
    const m = new Map<string, string>()
    obras.forEach(a => { if (a.obra_id && a.obra?.nome) m.set(a.obra_id, a.obra.nome) })
    return [...m].map(([id, nome]) => ({ id, nome }))
  }, [obras])

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const inp = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/[0.1] text-white' : 'bg-white border-slate-200 text-slate-800'
  }`
  const lbl = `block text-[10px] font-bold uppercase tracking-wider mb-1 ${txtMuted}`

  async function confirmar() {
    setErro(undefined)
    const validos = itensReais.filter(i => i.descricao.trim() && i.valor_unitario > 0)
    if (!validos.length) return setErro('Confirme os itens realizados.')
    if (!checklistOk) return setErro('Checklist pós-manutenção é obrigatório para liberar o veículo.')
    if (destino === 'obra' && !obraId) return setErro('Escolha a obra de destino.')

    await salvarItens.mutateAsync({ osId: os.id, itens: validos })
    await liberar.mutateAsync({
      osId: os.id,
      veiculoId: os.veiculo_id,
      valorFinal: total,
      hodometroSaida: hodometro ? +hodometro : undefined,
      descricaoServico: servico.trim() || undefined,
      checklistOk: true,
      realocar: destino === 'obra' ? { obraId } : undefined,
    })
    onClose()
  }

  const salvando = salvarItens.isPending || liberar.isPending

  return (
    <div className="space-y-4">
      <button onClick={onVoltar} className={`text-[11px] font-semibold ${txtMuted} hover:underline`}>
        ← voltar ao acompanhamento
      </button>

      <Secao titulo="① Itens realizados" isDark={isDark}>
        <ItensOSEditor itens={itensReais} onChange={setItensReais} isDark={isDark} precoHist={precoHist} />
        <div className={`flex items-center justify-between mt-2 pt-2 border-t text-[11px] ${
          isDark ? 'border-white/[0.06]' : 'border-slate-200'
        }`}>
          <span className={txtMuted}>Aprovado {BRL(aprovado)} → Real {BRL(total)}</span>
          {desvio != null && Math.abs(desvio) > 0.001 && (
            <span className={`font-bold ${desvio > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {desvio > 0 ? '+' : ''}{Math.round(desvio * 100)}%
            </span>
          )}
        </div>
      </Secao>

      <Secao titulo="② Evidências" isDark={isDark}>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Serviço executado</label>
            <textarea rows={2} value={servico} onChange={e => setServico(e.target.value)}
              className={`${inp} resize-none`} placeholder="O que a oficina fez..." />
          </div>
          <div>
            <label className={lbl}>Hodômetro de saída</label>
            <input type="number" value={hodometro} onChange={e => setHodometro(e.target.value)}
              className={`${inp} max-w-[160px]`} />
          </div>
          {foto ? (
            <a href={foto} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-rose-500 hover:underline inline-flex items-center gap-1">
              <Camera size={13} /> Ver foto do serviço
            </a>
          ) : (
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold ${
              isDark ? 'border-white/[0.1] text-slate-300' : 'border-slate-200 text-slate-600'
            }`}>
              {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              Anexar foto do serviço
              <input type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) setFoto(await upload.mutateAsync({ osId: os.id, file: f, campo: 'foto_depois_url' }))
                }} />
            </label>
          )}
        </div>
      </Secao>

      {/* Checklist bloqueante */}
      <div className={`rounded-xl border p-4 ${
        checklistOk
          ? isDark ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-emerald-50/60 border-emerald-200'
          : isDark ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-red-50/60 border-red-200'
      }`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
          checklistOk ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-red-300' : 'text-red-700')
        }`}>
          ③ Checklist pós-manutenção
        </p>
        <p className={`text-xs font-semibold ${checklistOk ? txt : isDark ? 'text-red-200' : 'text-red-800'}`}>
          {checklistOk
            ? '✓ Checklist registrado após a entrada na oficina'
            : 'Sem checklist pós-manutenção — o veículo não pode ser liberado'}
        </p>
        {!checklistOk && (
          <p className={`text-[10px] mt-1 ${isDark ? 'text-red-300/80' : 'text-red-600'}`}>
            Faça o checklist na aba Checklists (tipo pós-manutenção) e volte aqui. Regra do fluxo ORG-PRO-001.
          </p>
        )}
      </div>

      <Secao titulo="④ Destino do veículo" isDark={isDark}>
        <div className="space-y-2">
          <label className={`flex items-center gap-2 text-xs font-semibold ${txt}`}>
            <input type="radio" checked={destino === 'patio'} onChange={() => setDestino('patio')} className="accent-rose-500" />
            Deixar disponível no pátio
          </label>
          <label className={`flex items-center gap-2 text-xs font-semibold ${txt}`}>
            <input type="radio" checked={destino === 'obra'} onChange={() => setDestino('obra')} className="accent-rose-500" />
            Realocar para obra
          </label>
          {destino === 'obra' && (
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={inp}>
              <option value="">Selecione a obra...</option>
              {obrasUnicas.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          )}
        </div>
      </Secao>

      <Erro msg={erro} />

      <button
        onClick={confirmar} disabled={salvando || !checklistOk}
        title={!checklistOk ? 'Checklist pós-manutenção obrigatório' : undefined}
        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Liberar veículo · {BRL(total)}
      </button>
    </div>
  )
}

// ── Liberado (já concluída) ──────────────────────────────────────────────────
function CorpoLiberado({ os, isDark }: { os: FroOrdemServico; isDark: boolean }) {
  const { data: itens = [] } = useItensOS(os.id)
  const { data: precoHist } = useHistoricoPrecoItens()

  const itensEdit = useMemo<ItemEdit[]>(() => itens.map(i => ({
    tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
    valor_unitario: i.valor_unitario,
    garantia_dias: i.garantia_dias ?? undefined, garantia_km: i.garantia_km ?? undefined,
  })), [itens])

  const esperaAdm = os.aprovado_em && os.data_entrada_oficina
    ? Math.max(0, Math.floor((new Date(os.data_entrada_oficina).getTime() - new Date(os.aprovado_em).getTime()) / 86_400_000))
    : null
  const naOficina = os.data_entrada_oficina && os.data_conclusao
    ? Math.max(0, Math.floor((new Date(os.data_conclusao).getTime() - new Date(os.data_entrada_oficina).getTime()) / 86_400_000))
    : null
  const totalParado = diasDesde(os.data_abertura) != null && os.data_conclusao
    ? Math.floor((new Date(os.data_conclusao).getTime() - new Date(os.data_abertura).getTime()) / 86_400_000)
    : null

  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const txt = isDark ? 'text-white' : 'text-slate-800'

  return (
    <div className="space-y-4">
      <Secao titulo="Serviço executado" isDark={isDark}>
        <p className={`text-xs whitespace-pre-wrap ${txt}`}>
          {os.descricao_servico || os.descricao_problema}
        </p>
        <div className="flex gap-3 mt-2">
          {os.foto_antes_url && (
            <a href={os.foto_antes_url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-semibold text-rose-500 hover:underline inline-flex items-center gap-1">
              <Camera size={11} /> Antes
            </a>
          )}
          {os.foto_depois_url && (
            <a href={os.foto_depois_url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-semibold text-rose-500 hover:underline inline-flex items-center gap-1">
              <Camera size={11} /> Depois
            </a>
          )}
          {!os.checklist_saida_ok && (
            <span className="text-[11px] font-bold text-amber-500 inline-flex items-center gap-1">
              <TriangleAlert size={11} /> Liberado sem checklist
            </span>
          )}
        </div>
      </Secao>

      {itens.length > 0 && (
        <Secao titulo="Itens trocados" isDark={isDark}>
          <ItensOSEditor itens={itensEdit} onChange={() => {}} isDark={isDark} precoHist={precoHist} readOnly />
        </Secao>
      )}

      {/* Decomposição do tempo parado — onde o veículo perdeu dias */}
      <Secao titulo="Tempo parado" isDark={isDark}>
        <div className="grid grid-cols-3 gap-3 text-center">
          {([
            ['Espera adm.', esperaAdm],
            ['Na oficina', naOficina],
            ['Total', totalParado],
          ] as [string, number | null][]).map(([l, v]) => (
            <div key={l}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${txtMuted}`}>{l}</p>
              <p className={`text-sm font-black ${txt}`}>{v != null ? `${v}d` : '—'}</p>
            </div>
          ))}
        </div>
      </Secao>

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
    </div>
  )
}

// ── Fallback (rejeitada / cancelada) ─────────────────────────────────────────
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

// ── AGUARDANDO (em espera) ────────────────────────────────────────────────────
// A OS parou mas não foi cancelada nem concluída. Daqui ela RETOMA para a etapa
// de onde saiu (status_anterior), ou pode ser cancelada.
const STAGE_RETOMA_LABEL: Record<string, string> = {
  pendente: 'Pendente', aberta: 'Pendente', em_cotacao: 'Cotação',
  aguardando_aprovacao: 'Aprovação', aprovada: 'Programação', em_execucao: 'Execução',
}
function CorpoAguardando({ os, isDark, onClose }: {
  os: FroOrdemServico; isDark: boolean; onClose: () => void
}) {
  const mudarStatus = useAtualizarStatusOS()
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'

  // Para onde volta: a etapa de origem; sem registro, cai em Cotação.
  const destino = (os.status_anterior && STAGE_RETOMA_LABEL[os.status_anterior]) ? os.status_anterior : 'em_cotacao'
  const destinoLabel = STAGE_RETOMA_LABEL[destino] ?? 'Cotação'
  const desde = os.updated_at ? Math.floor((Date.now() - new Date(os.updated_at).getTime()) / 86_400_000) : null

  const retomar = () =>
    mudarStatus.mutate({ id: os.id, status: destino as StatusOS, extra: { status_anterior: null } }, { onSuccess: onClose })
  const cancelar = () =>
    mudarStatus.mutate({ id: os.id, status: 'cancelada' }, { onSuccess: onClose })

  return (
    <div className="space-y-4">
      <Secao titulo="Em espera" isDark={isDark} acento="alerta">
        <p className={`text-xs ${txt}`}>
          {os.status_detalhe || 'Sem motivo registrado.'}
        </p>
        {desde != null && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 ${txtMuted}`}>
            <Clock size={11} /> parada há {desde} {desde === 1 ? 'dia' : 'dias'}
          </p>
        )}
      </Secao>

      <Secao titulo="Problema" isDark={isDark}>
        <p className={`text-xs whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {os.descricao_problema}
        </p>
      </Secao>

      <div className="flex items-center gap-2">
        <button onClick={retomar} disabled={mudarStatus.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50">
          {mudarStatus.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          Retomar para {destinoLabel}
        </button>
        <button onClick={cancelar} disabled={mudarStatus.isPending}
          className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${
            isDark ? 'border-white/10 text-slate-400 hover:bg-white/[0.06]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          } disabled:opacity-50`}>
          Cancelar OS
        </button>
      </div>
    </div>
  )
}
