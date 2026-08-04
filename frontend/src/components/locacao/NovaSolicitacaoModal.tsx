import { useState } from 'react'
import { X, Wrench, RefreshCw, Loader2, Paperclip, ShieldAlert } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useImoveis, useCriarSolicitacaoLocacao } from '../../hooks/useLocacao'
import { UpperInput, UpperTextarea } from '../UpperInput'
import type { TipoSolicitacao, UrgenciaSolicitacao } from '../../types/locacao'

const TIPOS: { key: TipoSolicitacao; label: string; desc: string; icon: typeof Wrench; iconColor: string }[] = [
  { key: 'manutencao', label: 'Manutencao',           desc: 'Reparos e manutencoes no imovel',        icon: Wrench,     iconColor: 'text-orange-500' },
  { key: 'nc_seguranca', label: 'NC de Seguranca',    desc: 'Nao-conformidade de seguranca no imovel', icon: ShieldAlert, iconColor: 'text-rose-500' },
  { key: 'renovacao',  label: 'Aditivo / Renovacao',  desc: 'Renovar ou aditivar contrato de locacao', icon: RefreshCw,  iconColor: 'text-violet-500' },
]


interface Props {
  onClose: () => void
  tipoInicial?: TipoSolicitacao
}

export default function NovaSolicitacaoModal({ onClose, tipoInicial }: Props) {
  const { isDark } = useTheme()
  const { data: imoveis = [] } = useImoveis({ status: 'ativo' })
  const criar = useCriarSolicitacaoLocacao()

  const [step, setStep] = useState<'tipo' | 'form'>(tipoInicial ? 'form' : 'tipo')
  const [tipo, setTipo] = useState<TipoSolicitacao | null>(tipoInicial ?? null)
  const [imovelId, setImovelId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [dataLimite, setDataLimite] = useState('')
  const [anexo, setAnexo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'

  const handleSelectTipo = (t: TipoSolicitacao) => {
    setTipo(t)
    setStep('form')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tipo) return
    setEnviando(true)
    try {
      let anexoUrl: string | undefined, anexoNome: string | undefined
      if (anexo) {
        const path = `solicitacoes/${Date.now()}_${anexo.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('locacao-faturas').upload(path, anexo)
        if (!upErr) { anexoUrl = path; anexoNome = anexo.name }
      }
      await criar.mutateAsync({
        tipo, titulo, descricao,
        urgencia: (urgente ? 'urgente' : 'normal') as UrgenciaSolicitacao,
        imovel_id: imovelId || undefined,
        data_limite: dataLimite,
        anexo_url: anexoUrl, anexo_nome: anexoNome,
      } as any)
      onClose()
    } finally { setEnviando(false) }
  }

  // imóveis agrupados por cidade, exibidos pelo código (titulo padronizado)
  const cidades = [...new Set(imoveis.map(im => (im as any).cidade || '—'))].sort()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div>
            <h3 className={`text-base font-bold ${txt}`}>
              {step === 'tipo' ? 'Nova Solicitacao' : `Nova Solicitacao - ${TIPOS.find(t => t.key === tipo)?.label}`}
            </h3>
            <p className={`text-xs ${txtMuted}`}>Locacao de Imoveis</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Step 1: Tipo */}
        {step === 'tipo' && (
          <div className="p-5 grid grid-cols-1 gap-3">
            {TIPOS.map(({ key, label, desc, icon: Icon, iconColor }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectTipo(key)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:border-indigo-400 ${border} ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-indigo-50'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${txt}`}>{label}</p>
                  <p className={`text-xs ${txtMuted}`}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Imovel */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Imovel</label>
              <select
                value={imovelId}
                onChange={e => setImovelId(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              >
                <option value="">Selecionar imovel...</option>
                {cidades.map(cid => (
                  <optgroup key={cid} label={cid}>
                    {imoveis.filter(im => ((im as any).cidade || '—') === cid)
                      .sort((a, b) => (((a as any).titulo ?? '') as string).localeCompare(((b as any).titulo ?? '') as string))
                      .map(im => (
                        <option key={im.id} value={im.id}>
                          {(im as any).titulo || (im as any).nome || im.descricao}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Titulo */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Titulo *</label>
              <UpperInput
                required
                type="text"
                placeholder="Descreva brevemente a solicitacao..."
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`}
              />
            </div>

            {/* Descricao */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Descricao</label>
              <UpperTextarea
                rows={3}
                placeholder="Detalhes adicionais..."
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors resize-none ${inputCls}`}
              />
            </div>

            {/* Data limite + Urgente */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>
                  Prazo previsto <span className="text-rose-500">*</span>
                </label>
                <input type="date" required value={dataLimite} onChange={e => setDataLimite(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className={`w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Urgente?</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setUrgente(false)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${!urgente ? 'bg-slate-100 text-slate-700 border-slate-300' : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-400'}`}>
                    Nao
                  </button>
                  <button type="button" onClick={() => setUrgente(true)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${urgente ? 'bg-red-100 text-red-700 border-red-300' : isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-400'}`}>
                    Sim
                  </button>
                </div>
              </div>
            </div>

            {/* Anexo */}
            <div>
              <label className={`block text-xs font-semibold mb-1 ${txtMuted}`}>Anexo</label>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${inputCls}`}>
                <Paperclip size={14} className="shrink-0 opacity-60" />
                <span className={anexo ? '' : 'opacity-50'}>{anexo ? anexo.name : 'Selecionar arquivo...'}</span>
                <input type="file" className="hidden" onChange={e => setAnexo(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('tipo')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={criar.isPending || enviando || !titulo || !dataLimite}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {(criar.isPending || enviando) && <Loader2 size={14} className="animate-spin" />}
                Criar Solicitacao
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
