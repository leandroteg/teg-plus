import { useState } from 'react'
import { Plus, Car, Wrench, Building2, CalendarDays, User, FileText, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useVeiculos } from '../../hooks/useFrotas'

type TipoSolicitacao = 'emprestimo' | 'manutencao'

const TIPO_OPTS: { value: TipoSolicitacao; label: string; desc: string; icon: typeof Car }[] = [
  { value: 'emprestimo',  label: 'Empréstimo de Ativo',     desc: 'Solicitar veículo ou máquina para obra / CC', icon: Car   },
  { value: 'manutencao',  label: 'Solicitação de Manutenção', desc: 'Reportar problema ou agendar revisão',       icon: Wrench },
]

export default function SolicitacoesFrotas() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const [tipo, setTipo]           = useState<TipoSolicitacao>('emprestimo')
  const [veiculoId, setVeiculoId] = useState('')
  const [destino, setDestino]     = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim]     = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [obs, setObs]             = useState('')
  const [success, setSuccess]     = useState(false)

  const { data: veiculos = [] } = useVeiculos()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: integrate with fro_solicitacoes table when migration is created
    setSuccess(true)
    setTimeout(() => setSuccess(false), 4000)
  }

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border-white/[0.06]'

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h2 className={`text-lg font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Plus size={18} className="text-rose-500" />
          Nova Solicitação
        </h2>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Solicite empréstimo de ativo ou abertura de OS de manutenção
        </p>
      </div>

      {/* Success toast */}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
          <CheckCircle2 size={16} /> Solicitação registrada com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Tipo de Solicitação
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TIPO_OPTS.map(opt => {
              const Icon = opt.icon
              const active = tipo === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipo(opt.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    active
                      ? (isLight ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-rose-500/10 border-rose-500/40 text-rose-300')
                      : (isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:bg-white/[0.06]')
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    active ? (isLight ? 'bg-rose-100' : 'bg-rose-500/20') : (isLight ? 'bg-slate-100' : 'bg-white/[0.06]')
                  }`}>
                    <Icon size={14} className={active ? (isLight ? 'text-rose-600' : 'text-rose-400') : (isLight ? 'text-slate-500' : 'text-slate-400')} />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Fields */}
        <div className={`rounded-2xl border p-4 space-y-4 ${card}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Detalhes
          </p>

          {/* Ativo (only for emprestimo) */}
          {tipo === 'emprestimo' && (
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <Car size={11} className="inline mr-1" />Ativo Solicitado
              </label>
              <select
                value={veiculoId}
                onChange={e => setVeiculoId(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                  isLight
                    ? 'bg-white border-slate-200 focus:border-rose-400 text-slate-800'
                    : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500'
                }`}
              >
                <option value="">Selecionar ativo...</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Destino / Obra */}
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <Building2 size={11} className="inline mr-1" />Obra / Centro de Custo
            </label>
            <input
              type="text"
              value={destino}
              onChange={e => setDestino(e.target.value)}
              placeholder="Ex: Obra Campo Belo, CC-012..."
              className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                isLight
                  ? 'bg-white border-slate-200 focus:border-rose-400 placeholder:text-slate-300'
                  : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500 placeholder:text-slate-500'
              }`}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <CalendarDays size={11} className="inline mr-1" />Data de Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                  isLight
                    ? 'bg-white border-slate-200 focus:border-rose-400'
                    : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500'
                }`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                <CalendarDays size={11} className="inline mr-1" />Retorno Previsto
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                  isLight
                    ? 'bg-white border-slate-200 focus:border-rose-400'
                    : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Responsável */}
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <User size={11} className="inline mr-1" />Responsável
            </label>
            <input
              type="text"
              value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              placeholder="Nome do responsável pelo ativo..."
              className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                isLight
                  ? 'bg-white border-slate-200 focus:border-rose-400 placeholder:text-slate-300'
                  : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500 placeholder:text-slate-500'
              }`}
            />
          </div>

          {/* Observações */}
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <FileText size={11} className="inline mr-1" />Observações
            </label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              placeholder={tipo === 'manutencao' ? 'Descreva o problema ou serviço necessário...' : 'Finalidade, observações especiais...'}
              className={`w-full px-3 py-2 rounded-xl border text-sm resize-none transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
                isLight
                  ? 'bg-white border-slate-200 focus:border-rose-400 placeholder:text-slate-300'
                  : 'bg-slate-800/60 border-slate-700 text-white focus:border-rose-500 placeholder:text-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${
            isLight
              ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
              : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
          }`}
        >
          <Plus size={15} />
          Enviar Solicitação
        </button>
      </form>
    </div>
  )
}
