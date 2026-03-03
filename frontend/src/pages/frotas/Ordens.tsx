import { useState } from 'react'
import {
  Plus, ChevronDown, ChevronUp, Wrench, Check, X,
  AlertTriangle, Clock,
} from 'lucide-react'
import {
  useOrdensServico, useCriarOS, useAtualizarStatusOS,
  useAprovarOS, useConcluirOS, useVeiculos, useFornecedoresFrotas,
  useSalvarCotacao, useSelecionarCotacao, useCotacoesOS,
} from '../../hooks/useFrotas'
import type {
  FroOrdemServico, PrioridadeOS, TipoOS, TipoItemOS,
  FroCotacaoOS,
} from '../../types/frotas'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const PRIORIDADE_CFG: Record<PrioridadeOS, { label: string; cls: string }> = {
  critica: { label: 'CRÍTICA', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  alta:    { label: 'ALTA',    cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  media:   { label: 'MÉDIA',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  baixa:   { label: 'BAIXA',   cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
}

const TIPO_LABEL: Record<TipoOS, string> = {
  preventiva: 'Preventiva', corretiva: 'Corretiva',
  sinistro: 'Sinistro', revisao: 'Revisão',
}

const STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_cotacao: 'Em Cotação',
  aguardando_aprovacao: 'Ag. Aprovação', aprovada: 'Aprovada',
  em_execucao: 'Em Execução', concluida: 'Concluída',
  rejeitada: 'Rejeitada', cancelada: 'Cancelada',
}

function getAlcada(valor?: number) {
  if (!valor || valor <= 300) return { nivel: 'Analista de Frotas', cor: 'text-emerald-400' }
  if (valor <= 1500) return { nivel: 'Coordenador / Gerente', cor: 'text-amber-400' }
  return { nivel: 'Diretoria', cor: 'text-red-400' }
}

// ── Nova OS Modal ─────────────────────────────────────────────────────────────
function NovaOSModal({ onClose }: { onClose: () => void }) {
  const criar = useCriarOS()
  const { data: veiculos = [] } = useVeiculos()
  const [form, setForm] = useState({
    veiculo_id: '', tipo: 'corretiva' as TipoOS, prioridade: 'media' as PrioridadeOS,
    descricao_problema: '', hodometro_entrada: '', data_previsao: '',
  })
  const [itens, setItens] = useState<Array<{ tipo: TipoItemOS; descricao: string; quantidade: number; valor_unitario: number }>>([])

  const addItem = () => setItens(i => [...i, { tipo: 'peca', descricao: '', quantidade: 1, valor_unitario: 0 }])
  const setItem = (idx: number, k: string, v: unknown) =>
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [k]: v } : item))
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id,
      tipo: form.tipo,
      prioridade: form.prioridade,
      descricao_problema: form.descricao_problema,
      hodometro_entrada: form.hodometro_entrada ? +form.hodometro_entrada : undefined,
      data_previsao: form.data_previsao || undefined,
      itens: itens.filter(i => i.descricao),
    })
    onClose()
  }

  const inp = 'w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30'
  const sel = inp + ' [&>option]:bg-slate-900'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto styled-scrollbar">
        <h2 className="text-base font-bold text-white">Nova Ordem de Serviço</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Veículo *</label>
            <select className={sel} value={form.veiculo_id} onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))} required>
              <option value="">Selecione…</option>
              {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Tipo</label>
            <select className={sel} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOS }))}>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Prioridade</label>
            <select className={sel} value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as PrioridadeOS }))}>
              {Object.entries(PRIORIDADE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Hodômetro entrada</label>
            <input type="number" className={inp} value={form.hodometro_entrada} onChange={e => setForm(f => ({ ...f, hodometro_entrada: e.target.value }))} placeholder="km" />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Previsão de conclusão</label>
            <input type="date" className={inp} value={form.data_previsao} onChange={e => setForm(f => ({ ...f, data_previsao: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Descrição do problema *</label>
          <textarea className={inp + ' resize-none'} rows={2} required value={form.descricao_problema} onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} placeholder="Descreva o problema identificado…" />
        </div>

        {/* Itens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-slate-400">Itens (peças / mão de obra)</label>
            <button type="button" onClick={addItem} className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1">
              <Plus size={12} /> Adicionar item
            </button>
          </div>
          {itens.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 mb-2">
              <select className={sel + ' col-span-2'} value={item.tipo} onChange={e => setItem(idx, 'tipo', e.target.value)}>
                <option value="peca">Peça</option>
                <option value="mao_obra">Mão Obra</option>
                <option value="outros">Outros</option>
              </select>
              <input className={inp + ' col-span-5'} placeholder="Descrição" value={item.descricao} onChange={e => setItem(idx, 'descricao', e.target.value)} />
              <input type="number" className={inp + ' col-span-2'} placeholder="Qtd" value={item.quantidade} onChange={e => setItem(idx, 'quantidade', +e.target.value)} min={0} step={0.1} />
              <input type="number" className={inp + ' col-span-2'} placeholder="R$ unit." value={item.valor_unitario} onChange={e => setItem(idx, 'valor_unitario', +e.target.value)} min={0} step={0.01} />
              <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-slate-600 hover:text-red-400 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400 hover:bg-white/5">Cancelar</button>
          <button type="submit" disabled={criar.isPending} className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold disabled:opacity-50">
            {criar.isPending ? 'Criando…' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Cotações inline ───────────────────────────────────────────────────────────
function CotacoesPanel({ os }: { os: FroOrdemServico }) {
  const { data: cotacoes = [] } = useCotacoesOS(os.id)
  const { data: fornecedores = [] } = useFornecedoresFrotas()
  const salvarCot   = useSalvarCotacao()
  const selecionarCot = useSelecionarCotacao()
  const [form, setForm] = useState({ fornecedor_id: '', valor_total: '', prazo_execucao_dias: '', observacoes: '' })
  const [addOpen, setAddOpen] = useState(false)

  async function handleAddCotacao(e: React.FormEvent) {
    e.preventDefault()
    await salvarCot.mutateAsync({
      os_id: os.id,
      fornecedor_id: form.fornecedor_id,
      valor_total: +form.valor_total,
      prazo_execucao_dias: form.prazo_execucao_dias ? +form.prazo_execucao_dias : undefined,
      observacoes: form.observacoes || undefined,
    })
    setForm({ fornecedor_id: '', valor_total: '', prazo_execucao_dias: '', observacoes: '' })
    setAddOpen(false)
  }

  const inp = 'w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30'
  const sel = inp + ' [&>option]:bg-slate-900'

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-semibold">Cotações ({cotacoes.length}/3 mínimo)</p>
        {cotacoes.length < 3 && (
          <button onClick={() => setAddOpen(o => !o)} className="text-[11px] text-rose-400 flex items-center gap-1">
            <Plus size={11} /> Adicionar cotação
          </button>
        )}
      </div>

      {addOpen && (
        <form onSubmit={handleAddCotacao} className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-white/4 border border-white/8">
          <select className={sel} value={form.fornecedor_id} onChange={e => setForm(f => ({ ...f, fornecedor_id: e.target.value }))} required>
            <option value="">Fornecedor…</option>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razao_social}</option>)}
          </select>
          <input type="number" className={inp} placeholder="Valor total R$" value={form.valor_total} onChange={e => setForm(f => ({ ...f, valor_total: e.target.value }))} required />
          <input type="number" className={inp} placeholder="Prazo (dias)" value={form.prazo_execucao_dias} onChange={e => setForm(f => ({ ...f, prazo_execucao_dias: e.target.value }))} />
          <button type="submit" className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs text-white font-semibold">Adicionar</button>
        </form>
      )}

      {cotacoes.map(cot => (
        <div key={cot.id} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs ${cot.selecionado ? 'border-rose-500/40 bg-rose-500/8' : 'border-white/8 bg-white/3'}`}>
          <div className="flex-1">
            <p className="font-semibold text-white">{cot.fornecedor?.razao_social}</p>
            {cot.prazo_execucao_dias && <p className="text-slate-500">{cot.prazo_execucao_dias} dias</p>}
          </div>
          <p className="font-black text-white">{BRL(cot.valor_total)}</p>
          {os.status === 'em_cotacao' && !cot.selecionado && cotacoes.length >= 1 && (
            <button
              onClick={() => selecionarCot.mutate({ cotacaoId: cot.id, osId: os.id, fornecedorId: cot.fornecedor_id, valor: cot.valor_total })}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white"
            >
              <Check size={11} /> Selecionar
            </button>
          )}
          {cot.selecionado && <span className="text-rose-400 font-bold text-[10px]">✓ Selecionada</span>}
        </div>
      ))}
    </div>
  )
}

// ── OS Card ───────────────────────────────────────────────────────────────────
function OSCard({ os }: { os: FroOrdemServico }) {
  const [expanded, setExpanded] = useState(false)
  const [aprovModal, setAprovModal] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [concluirModal, setConcluirModal] = useState(false)
  const [motivo, setMotivo]   = useState('')
  const [valorFinal, setValorFinal]   = useState('')
  const [hodSaida, setHodSaida]   = useState('')

  const atualizarStatus = useAtualizarStatusOS()
  const aprovar = useAprovarOS()
  const concluir = useConcluirOS()

  const pCfg = PRIORIDADE_CFG[os.prioridade]
  const alcada = getAlcada(os.valor_orcado)

  async function handleAprovar() {
    await aprovar.mutateAsync({ id: os.id, aprovado: true, valor: os.valor_orcado })
    setAprovModal(null)
  }
  async function handleRejeitar() {
    await aprovar.mutateAsync({ id: os.id, aprovado: false, motivo })
    setAprovModal(null)
  }
  async function handleConcluir() {
    await concluir.mutateAsync({
      id: os.id,
      veiculo_id: os.veiculo_id,
      hodometro_saida: hodSaida ? +hodSaida : undefined,
      valor_final: valorFinal ? +valorFinal : os.valor_aprovado,
    })
    setConcluirModal(false)
  }

  return (
    <div className={`glass-card rounded-2xl border ${os.prioridade === 'critica' ? 'border-red-500/30' : 'border-white/6'}`}>
      <button className="w-full p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${pCfg.cls}`}>
            {pCfg.label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              {os.numero_os ?? '…'} · {os.veiculo?.placa}
            </p>
            <p className="text-[11px] text-slate-400 truncate">{os.descricao_problema}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-500">{TIPO_LABEL[os.tipo]}</span>
              {os.fornecedor && <span className="text-[10px] text-slate-500">· {os.fornecedor.razao_social}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-white">{os.valor_aprovado ? BRL(os.valor_aprovado) : os.valor_orcado ? BRL(os.valor_orcado) : '—'}</p>
            <p className="text-[10px] text-slate-500">{STATUS_LABEL[os.status]}</p>
          </div>
          {expanded ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">

          {/* Alçada info */}
          {os.valor_orcado && (
            <p className="text-[11px] text-slate-400">
              Alçada de aprovação: <span className={`font-semibold ${alcada.cor}`}>{alcada.nivel}</span>
            </p>
          )}

          {/* Cotações: mostrar se aberta ou em_cotacao */}
          {(os.status === 'aberta' || os.status === 'em_cotacao') && (
            <>
              <button
                onClick={() => atualizarStatus.mutate({ id: os.id, status: 'em_cotacao' })}
                className="text-xs text-sky-400 hover:text-sky-300 underline"
                hidden={os.status !== 'aberta'}
              >
                Iniciar cotação
              </button>
              {os.status === 'em_cotacao' && <CotacoesPanel os={os} />}
            </>
          )}

          {/* Aprovar/Rejeitar */}
          {os.status === 'aguardando_aprovacao' && (
            <div className="flex gap-2">
              <button onClick={() => setAprovModal('aprovar')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-xs text-white font-semibold">
                <Check size={13} /> Aprovar — {BRL(os.valor_orcado ?? 0)}
              </button>
              <button onClick={() => setAprovModal('rejeitar')} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600/60 hover:bg-red-600/80 text-xs text-white font-semibold">
                <X size={13} /> Rejeitar
              </button>
            </div>
          )}

          {/* Iniciar execução */}
          {os.status === 'aprovada' && (
            <button
              onClick={() => atualizarStatus.mutate({ id: os.id, status: 'em_execucao', extra: { data_entrada_oficina: new Date().toISOString() } })}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-xs text-white font-semibold"
            >
              <Wrench size={13} /> Enviar para Execução
            </button>
          )}

          {/* Concluir */}
          {os.status === 'em_execucao' && (
            <button
              onClick={() => setConcluirModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-xs text-white font-semibold"
            >
              <Check size={13} /> Concluir OS e Liberar Veículo
            </button>
          )}

          {/* Datas */}
          <div className="flex gap-4 text-[10px] text-slate-500">
            <span>Aberta: {new Date(os.data_abertura).toLocaleDateString('pt-BR')}</span>
            {os.data_previsao && <span>Prev.: {new Date(os.data_previsao).toLocaleDateString('pt-BR')}</span>}
            {os.data_conclusao && <span className="text-emerald-400">Concluída: {new Date(os.data_conclusao).toLocaleDateString('pt-BR')}</span>}
          </div>
        </div>
      )}

      {/* Modal Aprovar/Rejeitar */}
      {aprovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="glass-card rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h3 className="text-sm font-bold text-white">
              {aprovModal === 'aprovar' ? 'Confirmar Aprovação' : 'Rejeitar OS'}
            </h3>
            {aprovModal === 'aprovar' ? (
              <p className="text-xs text-slate-400">Valor aprovado: <span className="text-white font-bold">{BRL(os.valor_orcado ?? 0)}</span></p>
            ) : (
              <div>
                <label className="text-[11px] text-slate-400">Motivo da rejeição *</label>
                <textarea
                  className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none"
                  rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} required
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setAprovModal(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400">Cancelar</button>
              <button
                onClick={aprovModal === 'aprovar' ? handleAprovar : handleRejeitar}
                className={`flex-1 py-2 rounded-xl text-sm text-white font-semibold ${aprovModal === 'aprovar' ? 'bg-emerald-600' : 'bg-red-600'}`}
              >
                {aprovModal === 'aprovar' ? 'Aprovar' : 'Rejeitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Concluir */}
      {concluirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="glass-card rounded-2xl p-5 w-full max-w-sm space-y-3">
            <h3 className="text-sm font-bold text-white">Concluir OS {os.numero_os}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Hodômetro saída (km)</label>
                <input type="number" className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30" value={hodSaida} onChange={e => setHodSaida(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Valor final (R$)</label>
                <input type="number" className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30" value={valorFinal} onChange={e => setValorFinal(e.target.value)} placeholder={String(os.valor_aprovado ?? '')} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConcluirModal(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-slate-400">Cancelar</button>
              <button onClick={handleConcluir} className="flex-1 py-2 rounded-xl bg-emerald-600 text-sm text-white font-semibold">
                Concluir e Liberar Veículo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'abertas', label: 'Abertas', statuses: ['aberta','em_cotacao','aguardando_aprovacao','aprovada','em_execucao'] },
  { key: 'concluidas', label: 'Concluídas', statuses: ['concluida'] },
  { key: 'canceladas', label: 'Canceladas / Rejeitadas', statuses: ['cancelada','rejeitada'] },
]

export default function Ordens() {
  const [tab, setTab] = useState(0)
  const [novaOS, setNovaOS] = useState(false)
  const cur = TABS[tab]

  const { data: os = [], isLoading } = useOrdensServico({ status: cur.statuses as never })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench size={20} className="text-rose-400" /> Ordens de Serviço
          </h1>
          <p className="text-sm text-slate-500">{os.length} OS na aba atual</p>
        </div>
        <button onClick={() => setNovaOS(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm text-white font-semibold">
          <Plus size={15} /> Nova OS
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit">
        {TABS.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === i ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-20 animate-pulse" />)}</div>
      ) : os.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhuma OS nesta aba</p>
      ) : (
        <div className="space-y-3">
          {os.map(o => <OSCard key={o.id} os={o} />)}
        </div>
      )}

      {novaOS && <NovaOSModal onClose={() => setNovaOS(false)} />}
    </div>
  )
}
