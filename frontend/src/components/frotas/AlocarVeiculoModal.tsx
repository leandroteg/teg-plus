import { useState, useMemo } from 'react'
import { X, MapPin, Loader2, Search, Building2, User, CalendarDays } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCriarAlocacao, useSalvarVeiculo } from '../../hooks/useFrotas'
import { useLookupObras, useLookupCentrosCusto } from '../../hooks/useLookups'
import { useCadColaboradores } from '../../hooks/useCadastros'
import type { FroVeiculo } from '../../types/frotas'

interface Props {
  veiculo: FroVeiculo
  onClose: () => void
}

export default function AlocarVeiculoModal({ veiculo, onClose }: Props) {
  const { isDark } = useTheme()
  const criarAlocacao = useCriarAlocacao()
  const salvarVeiculo = useSalvarVeiculo()

  const obras = useLookupObras()
  const centrosCusto = useLookupCentrosCusto()
  const { data: colaboradores = [] } = useCadColaboradores()

  const [obraId, setObraId] = useState('')
  const [ccId, setCcId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [dataRetornoPrev, setDataRetornoPrev] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [buscaObra, setBuscaObra] = useState('')
  const [buscaCC, setBuscaCC] = useState('')
  const [buscaResp, setBuscaResp] = useState('')

  const identificador = veiculo.tipo_ativo === 'maquina' && veiculo.numero_serie ? veiculo.numero_serie : veiculo.placa

  const obrasFiltradas = useMemo(() => {
    if (!buscaObra.trim()) return obras
    const t = buscaObra.toLowerCase()
    return obras.filter(o => o.nome.toLowerCase().includes(t) || o.codigo.toLowerCase().includes(t))
  }, [obras, buscaObra])

  const ccFiltrados = useMemo(() => {
    if (!buscaCC.trim()) return centrosCusto
    const t = buscaCC.toLowerCase()
    return centrosCusto.filter(c => c.codigo.toLowerCase().includes(t) || c.descricao.toLowerCase().includes(t))
  }, [centrosCusto, buscaCC])

  const respFiltrados = useMemo(() => {
    const ativos = colaboradores.filter(c => c.ativo)
    if (!buscaResp.trim()) return ativos
    const t = buscaResp.toLowerCase()
    return ativos.filter(c => c.nome.toLowerCase().includes(t) || (c.cargo ?? '').toLowerCase().includes(t))
  }, [colaboradores, buscaResp])

  const responsavelSelecionado = colaboradores.find(c => c.id === responsavelId)
  const obraSelecionada = obras.find(o => o.id === obraId)
  const ccSelecionado = centrosCusto.find(c => c.id === ccId)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-rose-500'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-rose-400'
  const selectCls = `w-full text-sm rounded-xl px-3 py-2.5 border outline-none transition-colors ${inputCls}`

  const canSubmit = (obraId || ccId) && responsavelId

  const handleConfirmar = async () => {
    if (!canSubmit) return
    try {
      await criarAlocacao.mutateAsync({
        veiculo_id: veiculo.id,
        obra_id: obraId || undefined,
        centro_custo_id: ccId || undefined,
        responsavel_id: responsavelId,
        responsavel_nome: responsavelSelecionado?.nome ?? '',
        data_saida: new Date().toISOString(),
        data_retorno_prev: dataRetornoPrev || undefined,
        status: 'ativa',
        observacoes: observacoes.trim() || undefined,
      })
      // Atualiza status do veículo para aguardando_saida (checklist pendente)
      await salvarVeiculo.mutateAsync({
        id: veiculo.id,
        status: 'aguardando_saida' as any,
      })
      onClose()
    } catch (err) {
      console.error('[AlocarVeiculoModal] Erro:', err)
    }
  }

  const isPending = criarAlocacao.isPending || salvarVeiculo.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-lg mx-4 max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <MapPin size={16} className="text-white" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${txt}`}>Alocar Ativo</h3>
              <p className={`text-[11px] ${txtMuted}`}>
                {identificador} — {veiculo.marca} {veiculo.modelo}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Responsável (Colaborador) */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
              <User size={11} className="inline mr-1" />
              Responsável *
            </label>
            {responsavelSelecionado ? (
              <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                isDark ? 'border-rose-500/30 bg-rose-500/10' : 'border-rose-200 bg-rose-50'
              }`}>
                <div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {responsavelSelecionado.nome}
                  </p>
                  {responsavelSelecionado.cargo && (
                    <p className={`text-[11px] ${txtMuted}`}>{responsavelSelecionado.cargo}</p>
                  )}
                </div>
                <button
                  onClick={() => setResponsavelId('')}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                    isDark ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${txtMuted}`} />
                  <input
                    value={buscaResp}
                    onChange={e => setBuscaResp(e.target.value)}
                    placeholder="Buscar colaborador..."
                    className={`w-full text-sm rounded-xl pl-8 pr-3 py-2 border outline-none transition-colors ${inputCls}`}
                  />
                </div>
                <div className={`max-h-32 overflow-y-auto rounded-xl border ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                  {respFiltrados.length === 0 && (
                    <p className={`text-xs text-center py-3 ${txtMuted}`}>Nenhum colaborador encontrado</p>
                  )}
                  {respFiltrados.slice(0, 20).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setResponsavelId(c.id); setBuscaResp('') }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50'
                      } ${isDark ? 'border-b border-white/[0.04] last:border-0' : 'border-b border-slate-100 last:border-0'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600'
                      }`}>
                        <User size={12} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-slate-700'}`}>{c.nome}</p>
                        {c.cargo && <p className={`text-[10px] truncate ${txtMuted}`}>{c.cargo}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Centro de Custo */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
              Centro de Custo *
            </label>
            <select
              value={ccId}
              onChange={e => setCcId(e.target.value)}
              className={selectCls}
            >
              <option value="">Selecione o centro de custo</option>
              {centrosCusto.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>
              ))}
            </select>
          </div>

          {/* Projeto (Obra) */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
              <Building2 size={11} className="inline mr-1" />
              Projeto (Obra)
            </label>
            <select
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              className={selectCls}
            >
              <option value="">Selecione o projeto</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>
              ))}
            </select>
          </div>

          {/* Data retorno previsto */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>
              <CalendarDays size={11} className="inline mr-1" />
              Data Retorno Previsto
            </label>
            <input
              type="date"
              value={dataRetornoPrev}
              onChange={e => setDataRetornoPrev(e.target.value)}
              className={`w-full text-sm rounded-xl px-3 py-2.5 border outline-none transition-colors ${inputCls}`}
            />
          </div>

          {/* Observações */}
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${txtMuted}`}>Observações</label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Finalidade da alocação, destino, etc."
              className={`w-full text-sm rounded-xl px-3 py-2.5 border outline-none resize-none transition-colors ${inputCls}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
              isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={isPending || !canSubmit}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30 transition-all ${
              (isPending || !canSubmit) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            Confirmar Alocação
          </button>
        </div>
      </div>
    </div>
  )
}
