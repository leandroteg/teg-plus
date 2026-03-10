import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FolderKanban, Save, X } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCriarPortfolio } from '../../hooks/usePMO'
import { supabase } from '../../services/supabase'
import type { StatusPortfolio, TipoOSC } from '../../types/pmo'

const STATUS_OPTIONS: { value: StatusPortfolio; label: string }[] = [
  { value: 'em_analise_ate', label: 'Em Analise ATE' },
  { value: 'revisao_cliente', label: 'Revisao Cliente' },
  { value: 'liberado_iniciar', label: 'Liberado Iniciar' },
  { value: 'obra_andamento', label: 'Em Andamento' },
  { value: 'obra_paralisada', label: 'Paralisada' },
  { value: 'obra_concluida', label: 'Concluida' },
  { value: 'cancelada', label: 'Cancelada' },
]

const TIPO_OSC_OPTIONS: { value: TipoOSC; label: string }[] = [
  { value: 'obra', label: 'Obra' },
  { value: 'manutencao', label: 'Manutencao' },
]

export default function NovoPortfolio() {
  const { isLightSidebar: isLight } = useTheme()
  const nav = useNavigate()
  const criarPortfolio = useCriarPortfolio()

  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: async () => {
      const { data } = await supabase.from('sys_obras').select('id, nome').order('nome')
      return data ?? []
    },
  })

  const { data: contratos } = useQuery({
    queryKey: ['contratos-dropdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from('con_contratos')
        .select('id, titulo, contraparte, numero_contrato')
        .order('titulo')
      return data ?? []
    },
  })

  const [form, setForm] = useState({
    nome_obra: '',
    numero_osc: '',
    obra_id: '',
    contrato_id: '',
    tipo_osc: 'obra' as TipoOSC,
    status: 'em_analise_ate' as StatusPortfolio,
    cidade_estado: '',
    cluster: '',
    valor_total_osc: '',
    custo_orcado: '',
    custo_real: '',
    data_inicio_contratual: '',
    data_termino_contratual: '',
    resumo_osc: '',
  })

  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.nome_obra.trim()) {
      setError('Nome da obra e obrigatorio')
      return
    }
    if (!form.numero_osc.trim()) {
      setError('Numero da OSC e obrigatorio')
      return
    }

    try {
      const payload: Record<string, unknown> = {
        nome_obra: form.nome_obra.trim(),
        numero_osc: form.numero_osc.trim(),
        tipo_osc: form.tipo_osc,
        status: form.status,
        valor_total_osc: form.valor_total_osc ? parseFloat(form.valor_total_osc) : 0,
        custo_orcado: form.custo_orcado ? parseFloat(form.custo_orcado) : 0,
        custo_real: form.custo_real ? parseFloat(form.custo_real) : 0,
        valor_faturado: 0,
        custo_planejado: 0,
        multa_valor_estimado: 0,
      }
      if (form.obra_id) payload.obra_id = form.obra_id
      if (form.contrato_id) payload.contrato_id = form.contrato_id
      if (form.cidade_estado.trim()) payload.cidade_estado = form.cidade_estado.trim()
      if (form.cluster.trim()) payload.cluster = form.cluster.trim()
      if (form.data_inicio_contratual) payload.data_inicio_contratual = form.data_inicio_contratual
      if (form.data_termino_contratual) payload.data_termino_contratual = form.data_termino_contratual
      if (form.resumo_osc.trim()) payload.resumo_osc = form.resumo_osc.trim()

      const data = await criarPortfolio.mutateAsync(payload as any)
      nav(`/egp/portfolio/${data.id}`)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar portfolio')
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back button */}
      <button
        onClick={() => nav('/egp/portfolio')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar aos Portfolios
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <FolderKanban size={20} className="text-blue-500" />
          Novo Portfolio
        </h1>
        <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Preencha os dados para criar um novo portfolio de obra
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2 ${
          isLight
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className={`rounded-2xl border p-5 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-800/60 border-slate-700'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome da Obra */}
            <div className="md:col-span-2">
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Nome da Obra <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nome_obra}
                onChange={e => handleChange('nome_obra', e.target.value)}
                placeholder="Ex: SE Frutal 230kV"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Numero OSC */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Numero OSC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.numero_osc}
                onChange={e => handleChange('numero_osc', e.target.value)}
                placeholder="Ex: OSC-2026-001"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Obra (sys_obras) */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Obra Vinculada
              </label>
              <select
                value={form.obra_id}
                onChange={e => handleChange('obra_id', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              >
                <option value="">Selecione uma obra</option>
                {(obras ?? []).map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>

            {/* Contrato Vinculado */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Contrato Vinculado
              </label>
              <select
                value={form.contrato_id}
                onChange={e => handleChange('contrato_id', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              >
                <option value="">Nenhum contrato</option>
                {(contratos ?? []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}{c.contraparte ? ` - ${c.contraparte}` : ''}{c.numero_contrato ? ` (${c.numero_contrato})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo OSC */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Tipo OSC
              </label>
              <select
                value={form.tipo_osc}
                onChange={e => handleChange('tipo_osc', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              >
                {TIPO_OSC_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Status
              </label>
              <select
                value={form.status}
                onChange={e => handleChange('status', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Cidade / Estado */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Cidade / Estado
              </label>
              <input
                type="text"
                value={form.cidade_estado}
                onChange={e => handleChange('cidade_estado', e.target.value)}
                placeholder="Ex: Frutal - MG"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Cluster */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Cluster
              </label>
              <input
                type="text"
                value={form.cluster}
                onChange={e => handleChange('cluster', e.target.value)}
                placeholder="Ex: Triangulo Mineiro"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Valor Total OSC */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Valor Total OSC (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_total_osc}
                onChange={e => handleChange('valor_total_osc', e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Custo Orcado */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Custo Orcado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.custo_orcado}
                onChange={e => handleChange('custo_orcado', e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Custo Real */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Custo Real (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.custo_real}
                onChange={e => handleChange('custo_real', e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>

            {/* Data Inicio Contratual */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Data Inicio Contratual
              </label>
              <input
                type="date"
                value={form.data_inicio_contratual}
                onChange={e => handleChange('data_inicio_contratual', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              />
            </div>

            {/* Data Termino Contratual */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Data Termino Contratual
              </label>
              <input
                type="date"
                value={form.data_termino_contratual}
                onChange={e => handleChange('data_termino_contratual', e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-700 border-slate-600 text-white'
                }`}
              />
            </div>

            {/* Resumo */}
            <div className="md:col-span-2">
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Resumo / Escopo
              </label>
              <textarea
                rows={4}
                value={form.resumo_osc}
                onChange={e => handleChange('resumo_osc', e.target.value)}
                placeholder="Descreva brevemente o escopo da obra..."
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors resize-none focus:ring-2 focus:ring-blue-500/30 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                    : 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                }`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t"
            style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}
          >
            <button
              type="button"
              onClick={() => nav('/egp/portfolio')}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criarPortfolio.isPending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              {criarPortfolio.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Criar Portfolio
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
