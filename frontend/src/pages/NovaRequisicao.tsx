import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Trash2, Send, AlertCircle } from 'lucide-react'
import { useCriarRequisicao } from '../hooks/useRequisicoes'
import type { RequisicaoItem, Urgencia } from '../types'

const OBRAS = [
  { id: 'FRUTAL', nome: 'SE Frutal' },
  { id: 'PARACATU', nome: 'SE Paracatu' },
  { id: 'PERDIZES', nome: 'SE Perdizes' },
  { id: 'TRESMARIAS', nome: 'SE Tres Marias' },
  { id: 'RIOPAR', nome: 'SE Rio Paranaiba' },
  { id: 'ITUIUTABA', nome: 'SE Ituiutaba' },
]

const ALCADAS = [
  { nivel: 1, nome: 'Coordenador', max: 5000 },
  { nivel: 2, nome: 'Gerente', max: 25000 },
  { nivel: 3, nome: 'Diretor', max: 100000 },
  { nivel: 4, nome: 'CEO', max: Infinity },
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const emptyItem = (): RequisicaoItem => ({
  descricao: '', quantidade: 1, unidade: 'un', valor_unitario_estimado: 0,
})

export default function NovaRequisicao() {
  const nav = useNavigate()
  const mutation = useCriarRequisicao()

  const [form, setForm] = useState({
    solicitante_nome: '',
    obra_nome: '',
    descricao: '',
    justificativa: '',
    urgencia: 'normal' as Urgencia,
  })
  const [itens, setItens] = useState<RequisicaoItem[]>([emptyItem()])

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario_estimado, 0)
  const alcada = ALCADAS.find(a => total <= a.max) ?? ALCADAS[3]

  const updateItem = (idx: number, field: keyof RequisicaoItem, value: string | number) => {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync({ ...form, itens })
      nav('/')
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Nova Requisicao</h2>

      {/* Solicitante */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Solicitante</label>
        <input
          required
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Seu nome"
          value={form.solicitante_nome}
          onChange={e => setForm(f => ({ ...f, solicitante_nome: e.target.value }))}
        />
      </div>

      {/* Obra */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Obra</label>
        <select
          required
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          value={form.obra_nome}
          onChange={e => setForm(f => ({ ...f, obra_nome: e.target.value }))}
        >
          <option value="">Selecione a obra</option>
          {OBRAS.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
        </select>
      </div>

      {/* Descricao */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descricao</label>
        <textarea
          required
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Descreva o que precisa comprar"
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
        />
      </div>

      {/* Justificativa */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Justificativa</label>
        <textarea
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Por que precisa?"
          value={form.justificativa}
          onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))}
        />
      </div>

      {/* Urgencia */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Urgencia</label>
        <div className="flex gap-2">
          {(['normal', 'urgente', 'critica'] as const).map(u => (
            <button
              key={u}
              type="button"
              onClick={() => setForm(f => ({ ...f, urgencia: u }))}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                form.urgencia === u
                  ? u === 'critica' ? 'bg-red-500 text-white border-red-500'
                  : u === 'urgente' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600'
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
            className="text-primary text-xs flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>

        {itens.map((item, idx) => (
          <div key={idx} className="bg-white border rounded-lg p-3 mb-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Item {idx + 1}</span>
              {itens.length > 1 && (
                <button type="button" onClick={() => setItens(p => p.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-4 h-4 text-gray-300 hover:text-danger" />
                </button>
              )}
            </div>
            <input
              required
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="Descricao do item"
              value={item.descricao}
              onChange={e => updateItem(idx, 'descricao', e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-gray-400">Qtd</label>
                <input
                  required type="number" min="0.01" step="0.01"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={item.quantidade || ''}
                  onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Unidade</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm bg-white"
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
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={item.valor_unitario_estimado || ''}
                  onChange={e => updateItem(idx, 'valor_unitario_estimado', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total + Alcada */}
      <div className="bg-white rounded-xl p-4 shadow-sm border space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Valor Total Estimado</span>
          <span className="text-lg font-bold text-primary">{fmt(total)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-warning" />
          <span className="text-gray-600">
            Alcada: <strong>{alcada.nome}</strong> (nivel {alcada.nivel})
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-primary text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {mutation.isPending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><Send className="w-4 h-4" /> Enviar Requisicao</>
        )}
      </button>

      {mutation.isError && (
        <p className="text-danger text-sm text-center">Erro ao enviar. Tente novamente.</p>
      )}
      {mutation.isSuccess && (
        <p className="text-success text-sm text-center">Requisicao enviada com sucesso!</p>
      )}
    </form>
  )
}
