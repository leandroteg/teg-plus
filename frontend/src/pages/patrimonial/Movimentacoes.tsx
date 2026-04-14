import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight, Plus, Search, X, Save, Loader2,
} from 'lucide-react'
import {
  useImobilizados,
  useMovimentacoesPatrimonial,
  useRegistrarMovimentacaoPatrimonial,
  useConfirmarMovimentacao,
} from '../../hooks/usePatrimonial'
import { useBases } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { PatMovimentacao } from '../../types/estoque'

const TIPO_CONFIG: Record<PatMovimentacao['tipo'], { label: string; cor: string; bg: string }> = {
  transferencia: { label: 'Transfer\u00eancia', cor: 'text-blue-700', bg: 'bg-blue-50' },
  manutencao: { label: 'Manuten\u00e7\u00e3o', cor: 'text-amber-700', bg: 'bg-amber-50' },
  cessao: { label: 'Cess\u00e3o', cor: 'text-violet-700', bg: 'bg-violet-50' },
  retorno: { label: 'Retorno', cor: 'text-emerald-700', bg: 'bg-emerald-50' },
  baixa: { label: 'Baixa', cor: 'text-red-700', bg: 'bg-red-50' },
  inventario: { label: 'Invent\u00e1rio', cor: 'text-slate-700', bg: 'bg-slate-100' },
}

type FormState = {
  imobilizado_id: string
  tipo: PatMovimentacao['tipo']
  base_origem_id: string
  base_destino_id: string
  responsavel_origem: string
  responsavel_destino: string
  data_movimentacao: string
  nf_transferencia_numero: string
  observacao: string
}

const EMPTY_FORM: FormState = {
  imobilizado_id: '',
  tipo: 'transferencia',
  base_origem_id: '',
  base_destino_id: '',
  responsavel_origem: '',
  responsavel_destino: '',
  data_movimentacao: new Date().toISOString().slice(0, 10),
  nf_transferencia_numero: '',
  observacao: '',
}

export default function MovimentacoesPatrimonialPage() {
  const [params, setParams] = useSearchParams()
  const { isLightSidebar: isLight } = useTheme()
  const { perfil } = useAuth()
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [showForm, setShowForm] = useState(params.get('nova') === '1')
  const [payload, setPayload] = useState<FormState>(EMPTY_FORM)

  const { data: movimentacoes = [], isLoading } = useMovimentacoesPatrimonial()
  const { data: imobilizados = [] } = useImobilizados()
  const { data: bases = [] } = useBases()
  const registrar = useRegistrarMovimentacaoPatrimonial()
  const confirmar = useConfirmarMovimentacao()

  useEffect(() => {
    setShowForm(params.get('nova') === '1')
  }, [params])

  const filtradas = useMemo(() => movimentacoes.filter(m => {
    const matchTipo = tipoFiltro ? m.tipo === tipoFiltro : true
    const term = busca.trim().toLowerCase()
    const matchBusca = !term || [
      m.imobilizado?.numero_patrimonio,
      m.imobilizado?.descricao,
      m.responsavel_destino,
      m.responsavel_origem,
      m.observacao,
    ].some(v => v?.toLowerCase().includes(term))
    return matchTipo && matchBusca
  }), [movimentacoes, tipoFiltro, busca])

  function openForm() {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('nova', '1')
      return next
    })
  }

  function closeForm() {
    setShowForm(false)
    setPayload(EMPTY_FORM)
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('nova')
      return next
    })
  }

  async function handleSave() {
    if (!payload.imobilizado_id) return
    await registrar.mutateAsync({
      ...payload,
      base_origem_id: payload.base_origem_id || undefined,
      base_destino_id: payload.base_destino_id || undefined,
      responsavel_origem: payload.responsavel_origem || undefined,
      responsavel_destino: payload.responsavel_destino || undefined,
      nf_transferencia_numero: payload.nf_transferencia_numero || undefined,
      observacao: payload.observacao || undefined,
    })
    closeForm()
  }

  const card = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Histórico</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filtradas.length} registros</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder={'Buscar por patrim\u00f4nio, descri\u00e7\u00e3o ou respons\u00e1vel...'}
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
          />
        </div>
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'}`}
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <ArrowLeftRight size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{'Nenhuma movimenta\u00e7\u00e3o patrimonial encontrada'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(mov => {
            const cfg = TIPO_CONFIG[mov.tipo]
            return (
              <div key={mov.id} className={`rounded-2xl border p-4 flex items-center gap-3 ${card}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <ArrowLeftRight size={16} className={cfg.cor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {mov.imobilizado?.numero_patrimonio ?? '--'} - {mov.imobilizado?.descricao ?? 'Sem descri\u00e7\u00e3o'}
                    </p>
                    <span className={`hidden sm:inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.cor}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {mov.responsavel_origem ? `Origem: ${mov.responsavel_origem}` : 'Sem respons\u00e1vel origem'}
                    {mov.responsavel_destino ? ` - Destino: ${mov.responsavel_destino}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${mov.confirmado ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {mov.confirmado ? 'Confirmado' : 'Pendente'}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(mov.data_movimentacao).toLocaleDateString('pt-BR')}</p>
                  {!mov.confirmado && (
                    <button onClick={() => confirmar.mutate({ id: mov.id, confirmado_por: perfil?.nome ?? 'Sistema' })} className="mt-1 text-[10px] text-amber-700 font-semibold">
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Nova Movimenta\u00e7\u00e3o'}</h2>
              <button onClick={closeForm} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{'Patrim\u00f4nio *'}</label>
                <select value={payload.imobilizado_id} onChange={e => setPayload(prev => ({ ...prev, imobilizado_id: e.target.value }))} className={inputCls}>
                  <option value="">Selecione...</option>
                  {imobilizados.filter(i => i.status !== 'baixado').map(i => (
                    <option key={i.id} value={i.id}>{i.numero_patrimonio} - {i.descricao}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Tipo *</label>
                  <select value={payload.tipo} onChange={e => setPayload(prev => ({ ...prev, tipo: e.target.value as PatMovimentacao['tipo'] }))} className={inputCls}>
                    {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Data *</label>
                  <input type="date" value={payload.data_movimentacao} onChange={e => setPayload(prev => ({ ...prev, data_movimentacao: e.target.value }))} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Base Origem</label>
                  <select value={payload.base_origem_id} onChange={e => setPayload(prev => ({ ...prev, base_origem_id: e.target.value }))} className={inputCls}>
                    <option value="">Nao informado</option>
                    {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Base Destino</label>
                  <select value={payload.base_destino_id} onChange={e => setPayload(prev => ({ ...prev, base_destino_id: e.target.value }))} className={inputCls}>
                    <option value="">Nao informado</option>
                    {bases.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Responsavel Origem</label>
                  <input value={payload.responsavel_origem} onChange={e => setPayload(prev => ({ ...prev, responsavel_origem: e.target.value }))} className={inputCls} placeholder="Nome..." />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Responsavel Destino</label>
                  <input value={payload.responsavel_destino} onChange={e => setPayload(prev => ({ ...prev, responsavel_destino: e.target.value }))} className={inputCls} placeholder="Nome..." />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>NF Transferencia</label>
                <input value={payload.nf_transferencia_numero} onChange={e => setPayload(prev => ({ ...prev, nf_transferencia_numero: e.target.value }))} className={inputCls} placeholder="Numero da NF..." />
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Observacao</label>
                <textarea value={payload.observacao} onChange={e => setPayload(prev => ({ ...prev, observacao: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="Detalhes da movimentacao..." />
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button onClick={closeForm} className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={registrar.isPending || !payload.imobilizado_id} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
                {registrar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
