import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Send, PlusCircle, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, Check, Layers, FileText,
} from 'lucide-react'
import { useCriarRequisicao } from '../hooks/useRequisicoes'
import { useAiParse } from '../hooks/useAiParse'
import { useCategorias } from '../hooks/useCategorias'
import CategoryCard from '../components/CategoryCard'
import type { RequisicaoItem, Urgencia, AiParseResult, CategoriaMaterial } from '../types'

// ── Obras fixas (alinhadas com seed do SQL) ────────────────────────────────
const OBRAS = [
  { id: 'FRUTAL',      nome: 'SE Frutal'       },
  { id: 'PARACATU',   nome: 'SE Paracatu'     },
  { id: 'PERDIZES',   nome: 'SE Perdizes'     },
  { id: 'TRESMARIAS', nome: 'SE Três Marias'  },
  { id: 'RIOPAR',     nome: 'Rio Paranaíba'   },
  { id: 'ITUIUTABA',  nome: 'SE Ituiutaba'    },
  { id: 'CD_MATRIZ',  nome: 'CD — Matriz'     },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const emptyItem = (): RequisicaoItem => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario_estimado: 0 })

function minCotacoes(valor: number, regras?: { ate_500: number; '501_a_2k': number; acima_2k: number }) {
  if (!regras) return valor <= 500 ? 1 : valor <= 2000 ? 2 : 3
  if (valor <= 500) return regras.ate_500
  if (valor <= 2000) return regras['501_a_2k']
  return regras.acima_2k
}

function Stepper({ step }: { step: number }) {
  const steps = ['Categoria', 'Detalhes', 'Confirmar']
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = idx < step
        const active = idx === step
        return (
          <div key={label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 transition-all
                ${done   ? 'bg-teal-500 text-white' : ''}
                ${active ? 'bg-teal-400 text-white ring-4 ring-teal-400/20' : ''}
                ${!done && !active ? 'bg-slate-100 text-slate-400' : ''}
              `}>
                {done ? <Check size={13} strokeWidth={3} /> : idx}
              </div>
              <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap
                ${active ? 'text-teal-600' : done ? 'text-teal-500' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-1 mt-[-12px] ${done ? 'bg-teal-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function NovaRequisicao() {
  const nav = useNavigate()
  const mutation = useCriarRequisicao()
  const aiParse = useAiParse()
  const { data: categorias = [], isLoading: catLoading } = useCategorias()

  const [step, setStep]               = useState(1)
  const [aiMode, setAiMode]           = useState(false)
  const [textoAi, setTextoAi]         = useState('')

  const [categoria, setCategoria]     = useState<CategoriaMaterial | null>(null)
  const [solicitante, setSolicitante] = useState('')
  const [obraNome, setObraNome]       = useState('')
  const [descricao, setDescricao]     = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [urgencia, setUrgencia]       = useState<Urgencia>('normal')
  const [dataNecessidade, setDataNecessidade] = useState('')
  const [itens, setItens]             = useState<RequisicaoItem[]>([emptyItem()])
  const [compradorSugerido, setCompradorSugerido] = useState<{ id: string; nome: string } | null>(null)
  const [confianca, setConfianca]     = useState(0)

  const total  = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_estimado, 0)
  const minCot = categoria ? minCotacoes(total, categoria.cotacoes_regras) : 1

  const handleAiParse = async () => {
    if (!textoAi.trim()) return
    try {
      const result: AiParseResult = await aiParse.mutateAsync({ texto: textoAi, solicitante_nome: solicitante })
      setItens(result.itens.length > 0 ? result.itens : [emptyItem()])
      if (result.obra_sugerida)       setObraNome(result.obra_sugerida)
      if (result.urgencia_sugerida)   setUrgencia(result.urgencia_sugerida)
      if (result.justificativa_sugerida) setJustificativa(result.justificativa_sugerida)
      if (result.comprador_sugerido)  setCompradorSugerido(result.comprador_sugerido)
      if (result.categoria_sugerida) {
        const catEncontrada = categorias.find(c =>
          c.codigo === result.categoria_sugerida ||
          c.nome.toLowerCase().includes((result.categoria_sugerida ?? '').toLowerCase())
        )
        if (catEncontrada) setCategoria(catEncontrada)
      }
      setConfianca(result.confianca)
      setDescricao(textoAi)
      setStep(2)
    } catch { /* handled by mutation.isError */ }
  }

  const updateItem = (idx: number, field: keyof RequisicaoItem, value: string | number) =>
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))

  const submit = async () => {
    try {
      await mutation.mutateAsync({
        solicitante_nome: solicitante,
        obra_nome:        obraNome,
        descricao,
        justificativa,
        urgencia,
        categoria:        categoria?.codigo,
        itens,
        data_necessidade: dataNecessidade || undefined,
        texto_original:   textoAi || undefined,
        comprador_id:     compradorSugerido?.id,
        ai_confianca:     confianca,
      })
      nav('/requisicoes')
    } catch { /* handled */ }
  }

  // ═══════════════════════════════════════
  // ETAPA 1 — Categoria
  // ═══════════════════════════════════════
  if (step === 1) return (
    <div className="space-y-5">
      <Stepper step={1} />

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        <button onClick={() => setAiMode(false)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${!aiMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
          <Layers size={13} /> Categorias
        </button>
        <button onClick={() => setAiMode(true)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${aiMode ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}>
          <Sparkles size={13} /> Texto Livre (IA)
        </button>
      </div>

      {!aiMode ? (
        <>
          {catLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categorias.map(cat => (
                <CategoryCard key={cat.id} categoria={cat}
                  selected={categoria?.id === cat.id}
                  onClick={() => setCategoria(cat.id === categoria?.id ? null : cat)}
                />
              ))}
            </div>
          )}

          {categoria && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black text-teal-700 uppercase tracking-wide">Fluxo desta Categoria</p>
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div><span className="text-teal-500">Comprador</span>
                  <p className="font-bold text-slate-800">{categoria.comprador_nome ?? '—'}</p></div>
                <div><span className="text-teal-500">Aprovação ≤R$2k</span>
                  <p className="font-bold text-slate-800">{categoria.alcada1_aprovador ?? 'Welton'}</p></div>
                <div><span className="text-teal-500">Aprovação &gt;R$2k</span>
                  <p className="font-bold text-slate-800">Laucídio</p></div>
                <div><span className="text-teal-500">Cotações mínimas</span>
                  <p className="font-bold text-slate-800">≤R$500: 1 · ≤R$2k: 2 · &gt;R$2k: 3</p></div>
              </div>
              {categoria.politica_resumo && (
                <div className="bg-white rounded-xl p-3 border border-teal-100">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <span className="font-bold text-teal-700">Política: </span>{categoria.politica_resumo}
                  </p>
                </div>
              )}
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!categoria}
            className="w-full bg-teal-500 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all">
            Próxima Etapa <ChevronRight size={16} />
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Descreva o que precisa. A IA estrutura tudo automaticamente.</p>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Seu nome</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
              placeholder="Nome do solicitante" value={solicitante} onChange={e => setSolicitante(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Descreva sua necessidade</label>
            <textarea rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-violet-300 outline-none resize-none"
              placeholder="Ex: 500m de cabo XLPE 15kV para a SE Frutal, urgente para a próxima semana..."
              value={textoAi} onChange={e => setTextoAi(e.target.value)} />
          </div>
          <button onClick={handleAiParse} disabled={!textoAi.trim() || aiParse.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-200 active:scale-[0.98] transition-all">
            {aiParse.isPending
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processando...</>
              : <><Sparkles size={16} />Processar com IA</>}
          </button>
          {aiParse.isError && <p className="text-red-500 text-sm text-center">Erro ao processar. Tente novamente.</p>}
          <button type="button" onClick={() => { setDescricao(textoAi); setStep(2) }}
            className="w-full text-xs text-slate-400 text-center py-1 hover:text-slate-600 transition">
            Pular IA e preencher manualmente →
          </button>
        </div>
      )}
    </div>
  )

  // ═══════════════════════════════════════
  // ETAPA 2 — Detalhes
  // ═══════════════════════════════════════
  if (step === 2) return (
    <div className="space-y-5">
      <Stepper step={2} />
      <button onClick={() => setStep(1)} className="flex items-center gap-1 text-slate-500 text-sm -mt-2">
        <ChevronLeft size={16} /> Voltar
      </button>

      {categoria && (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-teal-700">{categoria.nome}</span>
          <span className="text-teal-400">·</span>
          <span className="text-xs text-teal-600">Comprador: {categoria.comprador_nome}</span>
        </div>
      )}

      {confianca > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border ${
          confianca >= 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <Sparkles size={13} />
          IA preencheu com {Math.round(confianca * 100)}% de confiança — revise se necessário
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Solicitante *</label>
        <input required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Seu nome completo" value={solicitante} onChange={e => setSolicitante(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Obra *</label>
        <select required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none"
          value={obraNome} onChange={e => setObraNome(e.target.value)}>
          <option value="">Selecione a obra</option>
          {OBRAS.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Descrição *</label>
        <textarea required rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Resumo do que precisa ser comprado"
          value={descricao} onChange={e => setDescricao(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Justificativa</label>
        <textarea rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          placeholder="Por que é necessário? Impacto se não atendido?"
          value={justificativa} onChange={e => setJustificativa(e.target.value)} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-2 block">Urgência</label>
        <div className="flex gap-2">
          {(['normal', 'urgente', 'critica'] as const).map(u => (
            <button key={u} type="button" onClick={() => setUrgencia(u)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                urgencia === u
                  ? u === 'critica' ? 'bg-red-500 text-white border-red-500'
                  : u === 'urgente' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-teal-500 text-white border-teal-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}>
              {u === 'critica' ? '🔴 Crítica' : u === 'urgente' ? '🟡 Urgente' : '🟢 Normal'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Data de necessidade</label>
        <input type="date"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
          value={dataNecessidade} onChange={e => setDataNecessidade(e.target.value)} />
      </div>

      {/* Itens */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-slate-500">Itens *</label>
          <button type="button" onClick={() => setItens(p => [...p, emptyItem()])}
            className="text-teal-600 text-xs flex items-center gap-1 font-semibold">
            <PlusCircle size={13} /> Adicionar
          </button>
        </div>

        {itens.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-3 mb-2 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Item {idx + 1}</span>
              {itens.length > 1 && (
                <button type="button" onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} className="text-slate-300 hover:text-red-500 transition" />
                </button>
              )}
            </div>
            <input required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
              placeholder="Descrição do item"
              value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Qtd</label>
                <input required type="number" min="0.01" step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.quantidade || ''} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Unidade</label>
                <select className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}>
                  {['un', 'kg', 'm', 'm²', 'm³', 'L', 'pc', 'cx', 'hr', 'vb'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Vlr. Unit.</label>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-2 py-1.5 text-sm focus:ring-2 focus:ring-teal-300 outline-none"
                  value={item.valor_unitario_estimado || ''} onChange={e => updateItem(idx, 'valor_unitario_estimado', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <span className="text-xs text-teal-500 font-semibold">Total estimado</span>
            <p className="text-lg font-black text-teal-700">{fmt(total)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-teal-500">Cotações mínimas</span>
            <p className="text-2xl font-black text-teal-600">{minCot}</p>
          </div>
        </div>
      )}

      <button onClick={() => {
        if (!solicitante.trim() || !obraNome || !descricao.trim()) return
        setStep(3)
      }}
        className="w-full bg-teal-500 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all">
        Revisar e Confirmar <ChevronRight size={16} />
      </button>
    </div>
  )

  // ═══════════════════════════════════════
  // ETAPA 3 — Confirmar
  // ═══════════════════════════════════════
  return (
    <div className="space-y-5">
      <Stepper step={3} />
      <button onClick={() => setStep(2)} className="flex items-center gap-1 text-slate-500 text-sm -mt-2">
        <ChevronLeft size={16} /> Editar
      </button>

      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Confirmar Requisição</h2>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-teal-500/10 border-b border-teal-200 px-4 py-3">
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
            <FileText size={12} /> Resumo
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-y-2.5 text-sm">
            {[
              ['Solicitante', solicitante],
              ['Obra', obraNome],
              ['Categoria', categoria?.nome ?? '—'],
              ['Comprador', categoria?.comprador_nome ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-[11px] text-slate-400">{label}</span>
                <p className="font-semibold text-slate-800">{value}</p>
              </div>
            ))}
            <div>
              <span className="text-[11px] text-slate-400">Urgência</span>
              <p className={`font-bold ${urgencia === 'critica' ? 'text-red-600' : urgencia === 'urgente' ? 'text-amber-600' : 'text-emerald-600'}`}>
                {urgencia.charAt(0).toUpperCase() + urgencia.slice(1)}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Valor estimado</span>
              <p className="font-extrabold text-teal-700 text-base">{fmt(total)}</p>
            </div>
          </div>
          {descricao && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Descrição</span>
              <p className="text-sm text-slate-700 mt-0.5">{descricao}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100">
          <div className="px-4 py-2 bg-slate-50">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {itens.filter(i => i.descricao).length} iten{itens.filter(i => i.descricao).length !== 1 ? 's' : ''}
            </p>
          </div>
          {itens.filter(i => i.descricao).map((item, idx) => (
            <div key={idx} className="flex justify-between items-start px-4 py-2 text-sm border-t border-slate-50">
              <span className="text-slate-700 flex-1">{item.descricao}</span>
              <span className="text-slate-500 ml-2">{item.quantidade} {item.unidade}</span>
              <span className="text-teal-700 font-bold ml-3">{fmt(item.quantidade * item.valor_unitario_estimado)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fluxo visual */}
      {categoria && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Fluxo após envio</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { label: '① Sua RC',   color: 'bg-slate-200 text-slate-700' },
              { label: `② ${total > 2000 ? 'Laucídio' : (categoria.alcada1_aprovador ?? 'Welton')} aprova`, color: 'bg-blue-100 text-blue-700' },
              { label: `③ ${categoria.comprador_nome} cota`, color: 'bg-violet-100 text-violet-700' },
              { label: '④ Aprov. Fin.', color: 'bg-indigo-100 text-indigo-700' },
              { label: '⑤ Pedido',    color: 'bg-cyan-100 text-cyan-700' },
              { label: '⑥ Entrega',   color: 'bg-teal-100 text-teal-700' },
              { label: '⑦ Pagamento', color: 'bg-emerald-100 text-emerald-700' },
            ].map((s, i) => (
              <span key={i} className={`px-2 py-1 rounded-lg font-semibold ${s.color}`}>{s.label}</span>
            ))}
          </div>
          {total > 500 && (
            <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">
                Valor {fmt(total)} exige <strong>{minCot} cotação{minCot > 1 ? 'ões' : ''}</strong> mínima{minCot > 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>
      )}

      <button onClick={submit} disabled={mutation.isPending}
        className="w-full bg-teal-500 text-white rounded-2xl py-4 font-extrabold text-base flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-teal-500/30 active:scale-[0.98] transition-all">
        {mutation.isPending
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <><Send size={18} /> Enviar Requisição</>}
      </button>

      {mutation.isError && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-2">Erro ao enviar. Tente novamente.</p>
      )}
    </div>
  )
}
