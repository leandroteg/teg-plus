import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { useCriarContrato, useClientes } from '../../hooks/useContratos'
import { useFornecedores } from '../../hooks/useFinanceiro'
import type { NovoContratoPayload, RecorrenciaContrato, TipoContrato, StatusContrato } from '../../types/contratos'

const RECORRENCIAS: { value: RecorrenciaContrato; label: string }[] = [
  { value: 'mensal',        label: 'Mensal' },
  { value: 'bimestral',     label: 'Bimestral' },
  { value: 'trimestral',    label: 'Trimestral' },
  { value: 'semestral',     label: 'Semestral' },
  { value: 'anual',         label: 'Anual' },
  { value: 'personalizado', label: 'Personalizado' },
]

const STATUSES: { value: StatusContrato; label: string }[] = [
  { value: 'em_negociacao', label: 'Em Negociação' },
  { value: 'assinado',      label: 'Assinado' },
  { value: 'vigente',       label: 'Vigente' },
]

interface ItemForm {
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
}

export default function NovoContrato() {
  const nav = useNavigate()
  const criarContrato = useCriarContrato()
  const { data: clientes = [] } = useClientes()
  const { data: fornecedores = [] } = useFornecedores()

  const [tipo, setTipo] = useState<TipoContrato>('despesa')
  const [numero, setNumero] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [objeto, setObjeto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [dataAssinatura, setDataAssinatura] = useState('')
  const [recorrencia, setRecorrencia] = useState<RecorrenciaContrato>('mensal')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [centroCusto, setCentroCusto] = useState('')
  const [classeFinanceira, setClasseFinanceira] = useState('')
  const [indiceReajuste, setIndiceReajuste] = useState('')
  const [status, setStatus] = useState<StatusContrato>('vigente')
  const [itens, setItens] = useState<ItemForm[]>([])
  const [erro, setErro] = useState('')

  const addItem = () => setItens(prev => [...prev, { descricao: '', unidade: 'un', quantidade: 1, valor_unitario: 0 }])
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: keyof ItemForm, val: string | number) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))

  const totalItens = itens.reduce((s, it) => s + it.quantidade * it.valor_unitario, 0)

  const handleSubmit = async () => {
    setErro('')
    if (!numero.trim()) return setErro('Informe o número do contrato')
    if (!objeto.trim()) return setErro('Informe o objeto do contrato')
    if (!valorTotal && itens.length === 0) return setErro('Informe o valor total ou adicione itens')
    if (!dataInicio || !dataFim) return setErro('Informe as datas de início e fim')
    if (tipo === 'despesa' && !fornecedorId) return setErro('Selecione o fornecedor')
    if (tipo === 'receita' && !clienteId) return setErro('Selecione o cliente')

    const payload: NovoContratoPayload = {
      numero: numero.trim(),
      tipo_contrato: tipo,
      cliente_id: tipo === 'receita' ? clienteId : clientes[0]?.id ?? '',
      fornecedor_id: tipo === 'despesa' ? fornecedorId : undefined,
      objeto: objeto.trim(),
      descricao: descricao.trim() || undefined,
      valor_total: itens.length > 0 ? totalItens : parseFloat(valorTotal),
      data_assinatura: dataAssinatura || undefined,
      data_inicio: dataInicio,
      data_fim_previsto: dataFim,
      recorrencia,
      dia_vencimento: diaVencimento ? parseInt(diaVencimento) : undefined,
      centro_custo: centroCusto || undefined,
      classe_financeira: classeFinanceira || undefined,
      indice_reajuste: indiceReajuste || undefined,
      status,
      itens: itens.length > 0
        ? itens.map(it => ({
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade: it.quantidade,
            valor_unitario: it.valor_unitario,
          }))
        : undefined,
    }

    try {
      await criarContrato.mutateAsync(payload)
      nav('/contratos/lista')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar contrato')
    }
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400'
  const labelClass = 'text-xs font-semibold text-slate-600 mb-1 block'

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/contratos/lista')}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Novo Contrato</h1>
          <p className="text-xs text-slate-400 mt-0.5">Cadastre um contrato a pagar ou a receber</p>
        </div>
      </div>

      {/* ── Tipo ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className={labelClass}>Tipo do Contrato</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTipo('despesa')}
            className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
              tipo === 'despesa'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            A Pagar (Despesa)
          </button>
          <button onClick={() => setTipo('receita')}
            className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
              tipo === 'receita'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            A Receber (Receita)
          </button>
        </div>
      </div>

      {/* ── Dados Básicos ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Dados do Contrato</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Número do Contrato *</label>
            <input value={numero} onChange={e => setNumero(e.target.value)}
              placeholder="Ex: CTR-2026-001" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as StatusContrato)}
              className={inputClass}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Contraparte */}
        {tipo === 'despesa' ? (
          <div>
            <label className={labelClass}>Fornecedor *</label>
            <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className={inputClass}>
              <option value="">Selecione o fornecedor</option>
              {fornecedores.map(f => (
                <option key={f.id} value={f.id}>{f.razao_social}{f.cnpj ? ` (${f.cnpj})` : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputClass}>
              <option value="">Selecione o cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.cnpj ? ` (${c.cnpj})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass}>Objeto do Contrato *</label>
          <input value={objeto} onChange={e => setObjeto(e.target.value)}
            placeholder="Descrição resumida do objeto" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Descrição Detalhada</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Detalhes do escopo, condições, etc."
            rows={3} className={`${inputClass} resize-none`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Data Assinatura</label>
            <input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data Início *</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data Fim Previsto *</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className={inputClass} />
          </div>
        </div>
      </div>

      {/* ── Itens do Contrato ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">Itens do Contrato</h2>
          <button onClick={addItem}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
            <Plus size={13} /> Adicionar Item
          </button>
        </div>

        {itens.length === 0 ? (
          <div>
            <label className={labelClass}>Valor Total do Contrato *</label>
            <input type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)}
              placeholder="0,00" className={inputClass} step="0.01" min="0" />
            <p className="text-[10px] text-slate-400 mt-1">Ou adicione itens acima para calcular automaticamente</p>
          </div>
        ) : (
          <>
            {itens.map((it, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400">Item {idx + 1}</p>
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>
                <input value={it.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)}
                  placeholder="Descrição do item" className={inputClass} />
                <div className="grid grid-cols-3 gap-2">
                  <input value={it.unidade} onChange={e => updateItem(idx, 'unidade', e.target.value)}
                    placeholder="un" className={inputClass} />
                  <input type="number" value={it.quantidade || ''} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                    placeholder="Qtd" className={inputClass} min="0" step="0.01" />
                  <input type="number" value={it.valor_unitario || ''} onChange={e => updateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                    placeholder="Valor Un." className={inputClass} min="0" step="0.01" />
                </div>
                <p className="text-[10px] text-right text-slate-500 font-semibold">
                  Subtotal: {(it.quantidade * it.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            ))}
            <div className="text-right">
              <p className="text-sm font-extrabold text-indigo-600">
                Total: {totalItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Recorrência e Parcelas ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Recorrência e Parcelas</h2>
        <p className="text-xs text-slate-400">
          Selecione a frequência para gerar parcelas automaticamente, ou "Personalizado" para criar manualmente.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {RECORRENCIAS.map(r => (
            <button key={r.value} onClick={() => setRecorrencia(r.value)}
              className={`py-2.5 rounded-xl text-[11px] font-semibold border-2 transition-all ${
                recorrencia === r.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>

        {recorrencia !== 'personalizado' && (
          <div>
            <label className={labelClass}>Dia do Vencimento (1-31)</label>
            <input type="number" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)}
              placeholder="Ex: 15" className={inputClass} min="1" max="31" />
            <p className="text-[10px] text-slate-400 mt-1">
              As parcelas serão geradas automaticamente com esta periodicidade entre início e fim do contrato.
            </p>
          </div>
        )}
      </div>

      {/* ── Classificação Financeira ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-extrabold text-slate-800">Classificação Financeira</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Centro de Custo</label>
            <input value={centroCusto} onChange={e => setCentroCusto(e.target.value)}
              placeholder="Ex: ADM, OBRA-123" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Classe Financeira</label>
            <input value={classeFinanceira} onChange={e => setClasseFinanceira(e.target.value)}
              placeholder="Ex: Serviços, Materiais" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Índice de Reajuste</label>
            <input value={indiceReajuste} onChange={e => setIndiceReajuste(e.target.value)}
              placeholder="IPCA, IGP-M, INPC" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ── Erro ──────────────────────────────────────────────── */}
      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium">{erro}</p>
        </div>
      )}

      {/* ── Submit ────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button onClick={() => nav('/contratos/lista')}
          className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-sm font-semibold
            text-slate-600 hover:bg-slate-50 transition-all">
          Cancelar
        </button>
        <button onClick={handleSubmit}
          disabled={criarContrato.isPending}
          className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-bold
            hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {criarContrato.isPending
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <CheckCircle2 size={16} />}
          Criar Contrato
        </button>
      </div>
    </div>
  )
}
