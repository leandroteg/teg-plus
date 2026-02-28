import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Send, PlusCircle, Trash2, AlertCircle, Edit3, ChevronLeft,
  Zap, Shield, Building, Wrench, Truck, Package,
} from 'lucide-react'
import { useCriarRequisicao } from '../hooks/useRequisicoes'
import { useAiParse } from '../hooks/useAiParse'
import type { RequisicaoItem, Urgencia, AiParseResult } from '../types'

const OBRAS = [
  { id: 'FRUTAL', nome: 'SE Frutal' },
  { id: 'PARACATU', nome: 'SE Paracatu' },
  { id: 'PERDIZES', nome: 'SE Perdizes' },
  { id: 'TRESMARIAS', nome: 'SE Tres Marias' },
  { id: 'RIOPAR', nome: 'SE Rio Paranaiba' },
  { id: 'ITUIUTABA', nome: 'SE Ituiutaba' },
]

const CATEGORIAS = [
  { codigo: 'eletrico', nome: 'Eletrico', icon: Zap, cor: 'bg-amber-100 text-amber-700 border-amber-300' },
  { codigo: 'epi', nome: 'EPIs', icon: Shield, cor: 'bg-red-100 text-red-700 border-red-300' },
  { codigo: 'civil', nome: 'Civil', icon: Building, cor: 'bg-violet-100 text-violet-700 border-violet-300' },
  { codigo: 'ferramentas', nome: 'Ferramentas', icon: Wrench, cor: 'bg-blue-100 text-blue-700 border-blue-300' },
  { codigo: 'servicos', nome: 'Servicos', icon: Truck, cor: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { codigo: 'consumo', nome: 'Consumo', icon: Package, cor: 'bg-gray-100 text-gray-700 border-gray-300' },
]

const ALCADAS = [
  { nivel: 1, nome: 'Coordenador', max: 5000 },
  { nivel: 2, nome: 'Gerente', max: 25000 },
  { nivel: 3, nome: 'Diretor', max: 100000 },
  { nivel: 4, nome: 'CEO', max: Infinity },
]

const TEMPLATES = [
  'Cabos e condutores para...',
  'EPIs para equipe de...',
  'Locacao de guindaste...',
  'Material de construcao...',
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyItem = (): RequisicaoItem => ({
  descricao: '', quantidade: 1, unidade: 'un', valor_unitario_estimado: 0,
})

type Mode = 'input' | 'preview'

export default function NovaRequisicao() {
  const nav = useNavigate()
  const mutation = useCriarRequisicao()
  const aiParse = useAiParse()

  const [mode, setMode] = useState<Mode>('input')
  const [texto, setTexto] = useState('')
  const [solicitante, setSolicitante] = useState('')

  // Preview state (filled by AI or manually)
  const [obraNome, setObraNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [urgencia, setUrgencia] = useState<Urgencia>('normal')
  const [categoria, setCategoria] = useState('')
  const [itens, setItens] = useState<RequisicaoItem[]>([emptyItem()])
  const [compradorSugerido, setCompradorSugerido] = useState<{ id: string; nome: string } | null>(null)
  const [confianca, setConfianca] = useState(0)

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_estimado, 0)
  const alcada = ALCADAS.find(a => total <= a.max) ?? ALCADAS[3]

  const handleAiParse = async () => {
    if (!texto.trim()) return
    try {
      const result: AiParseResult = await aiParse.mutateAsync({ texto, solicitante_nome: solicitante })
      setItens(result.itens.length > 0 ? result.itens : [emptyItem()])
      if (result.obra_sugerida) setObraNome(result.obra_sugerida)
      if (result.urgencia_sugerida) setUrgencia(result.urgencia_sugerida)
      if (result.categoria_sugerida) setCategoria(result.categoria_sugerida)
      if (result.justificativa_sugerida) setJustificativa(result.justificativa_sugerida)
      if (result.comprador_sugerido) setCompradorSugerido(result.comprador_sugerido)
      setConfianca(result.confianca)
      setDescricao(texto)
      setMode('preview')
    } catch {
      // error shown via mutation state
    }
  }

  const updateItem = (idx: number, field: keyof RequisicaoItem, value: string | number) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync({
        solicitante_nome: solicitante,
        obra_nome: obraNome,
        descricao,
        justificativa,
        urgencia,
        categoria,
        itens,
        texto_original: texto,
        comprador_id: compradorSugerido?.id,
        ai_confianca: confianca,
      })
      nav('/')
    } catch {
      // error handled by mutation state
    }
  }

  // ===== MODE: AI TEXT INPUT =====
  if (mode === 'input') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          Nova Requisicao
        </h2>

        <p className="text-xs text-gray-500">
          Descreva o que precisa comprar em linguagem natural. A IA vai estruturar tudo para voce.
        </p>

        {/* Solicitante */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Seu nome</label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
            placeholder="Nome do solicitante"
            value={solicitante}
            onChange={e => setSolicitante(e.target.value)}
          />
        </div>

        {/* Category Quick Buttons */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Categoria rapida</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map(cat => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.codigo}
                  type="button"
                  onClick={() => {
                    setCategoria(cat.codigo)
                    if (!texto) setTexto(`[${cat.nome}] `)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    categoria === cat.codigo ? cat.cor + ' ring-2 ring-offset-1' : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.nome}
                </button>
              )
            })}
          </div>
        </div>

        {/* Big Textarea */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Descreva sua necessidade</label>
          <textarea
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none resize-none"
            placeholder="Ex: 500m de cabo XLPE 15kV 50mm2, 20 terminais de compressao para a SE Frutal, urgente para proxima semana"
            value={texto}
            onChange={e => setTexto(e.target.value)}
          />
        </div>

        {/* Templates */}
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTexto(t)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition"
            >
              {t}
            </button>
          ))}
        </div>

        {/* AI Parse Button */}
        <button
          type="button"
          onClick={handleAiParse}
          disabled={!texto.trim() || aiParse.isPending}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-200 active:scale-[0.98] transition-all"
        >
          {aiParse.isPending ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processando com IA...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Processar com IA
            </>
          )}
        </button>

        {aiParse.isError && (
          <p className="text-red-500 text-sm text-center">Erro ao processar. Tente novamente.</p>
        )}

        {/* Manual mode link */}
        <button
          type="button"
          onClick={() => {
            setDescricao(texto)
            setMode('preview')
          }}
          className="w-full text-xs text-gray-400 text-center py-1 hover:text-violet-500 transition"
        >
          Prefere preencher manualmente?
        </button>
      </div>
    )
  }

  // ===== MODE: PREVIEW / EDIT =====
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMode('input')} className="p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-violet-500" />
          Revisar Requisicao
        </h2>
      </div>

      {/* AI Confidence */}
      {confianca > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
          confianca >= 0.8 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <Sparkles className="w-3.5 h-3.5" />
          IA preencheu com {Math.round(confianca * 100)}% de confianca — revise e ajuste se necessario
        </div>
      )}

      {/* Comprador sugerido */}
      {compradorSugerido && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-xs">
          <Sparkles className="w-3.5 h-3.5" />
          Comprador sugerido: <strong>{compradorSugerido.nome}</strong>
        </div>
      )}

      {/* Solicitante */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Solicitante</label>
        <input
          required
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
          placeholder="Seu nome"
          value={solicitante}
          onChange={e => setSolicitante(e.target.value)}
        />
      </div>

      {/* Obra */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Obra</label>
        <select
          required
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none"
          value={obraNome}
          onChange={e => setObraNome(e.target.value)}
        >
          <option value="">Selecione a obra</option>
          {OBRAS.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
        </select>
      </div>

      {/* Categoria */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">Categoria</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map(cat => {
            const Icon = cat.icon
            return (
              <button
                key={cat.codigo}
                type="button"
                onClick={() => setCategoria(cat.codigo)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  categoria === cat.codigo ? cat.cor + ' ring-2 ring-offset-1' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.nome}
              </button>
            )
          })}
        </div>
      </div>

      {/* Descricao */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descricao</label>
        <textarea
          required rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
        />
      </div>

      {/* Justificativa */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Justificativa</label>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-300 outline-none"
          placeholder="Por que precisa?"
          value={justificativa}
          onChange={e => setJustificativa(e.target.value)}
        />
      </div>

      {/* Urgencia */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block">Urgencia</label>
        <div className="flex gap-2">
          {(['normal', 'urgente', 'critica'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgencia(u)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                urgencia === u
                  ? u === 'critica' ? 'bg-red-500 text-white border-red-500'
                  : u === 'urgente' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-violet-500 text-white border-violet-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {u.charAt(0).toUpperCase() + u.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Itens */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-gray-500">Itens</label>
          <button
            type="button"
            onClick={() => setItens(p => [...p, emptyItem()])}
            className="text-violet-600 text-xs flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>

        {itens.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 mb-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Item {idx + 1}</span>
              {itens.length > 1 && (
                <button type="button" onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-500 transition" />
                </button>
              )}
            </div>
            <input
              required
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              placeholder="Descricao do item"
              value={item.descricao}
              onChange={e => updateItem(idx, 'descricao', e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-400">Qtd</label>
                <input
                  required type="number" min="0.01" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  value={item.quantidade || ''}
                  onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Unidade</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
                  value={item.unidade}
                  onChange={e => updateItem(idx, 'unidade', e.target.value)}
                >
                  {['un', 'kg', 'm', 'm2', 'm3', 'L', 'pc', 'cx'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Valor Unit.</label>
                <input
                  required type="number" min="0.01" step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                  value={item.valor_unitario_estimado || ''}
                  onChange={e => updateItem(idx, 'valor_unitario_estimado', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total + Alcada */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Valor Total Estimado</span>
          <span className="text-lg font-bold text-violet-600">{fmt(total)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-gray-600">
            Alcada: <strong>{alcada.nome}</strong> (nivel {alcada.nivel})
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-200 active:scale-[0.98] transition-all"
      >
        {mutation.isPending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><Send className="w-4 h-4" /> Confirmar e Enviar</>
        )}
      </button>

      {mutation.isError && (
        <p className="text-red-500 text-sm text-center">Erro ao enviar. Tente novamente.</p>
      )}
      {mutation.isSuccess && (
        <p className="text-emerald-500 text-sm text-center">Requisicao enviada com sucesso!</p>
      )}
    </form>
  )
}
