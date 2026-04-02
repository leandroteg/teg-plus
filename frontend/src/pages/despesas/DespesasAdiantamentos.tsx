import { useEffect, useMemo, useState } from 'react'
import { Plus, Wallet, CheckCircle2, Clock3, XCircle, Send } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCadCentrosCusto, useCadClasses, useCadFornecedores } from '../../hooks/useCadastros'
import { isDespesaSchemaMissing, useAdiantamentosDespesa, useCriarSolicitacaoAdiantamento } from '../../hooks/useDespesas'
import { useRHColaboradores } from '../../hooks/useRH'
import NumericInput from '../../components/NumericInput'
import SearchableSelect from '../../components/SearchableSelect'
import type { SelectOption } from '../../components/SearchableSelect'
import type { StatusDespesaAdiantamento } from '../../types'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_STYLE: Record<StatusDespesaAdiantamento, string> = {
  solicitado: 'bg-amber-100 text-amber-700',
  aprovado: 'bg-emerald-100 text-emerald-700',
  rejeitado: 'bg-rose-100 text-rose-700',
  prestacao_pendente: 'bg-sky-100 text-sky-700',
  prestacao_enviada: 'bg-indigo-100 text-indigo-700',
  concluido: 'bg-slate-100 text-slate-700',
}

const STATUS_LABEL: Record<StatusDespesaAdiantamento, string> = {
  solicitado: 'Aguardando gestor',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  prestacao_pendente: 'Prestação pendente',
  prestacao_enviada: 'Prestação enviada',
  concluido: 'Concluído',
}

const EMPTY_FORM = {
  favorecido_key: '',
  favorecido_nome: '',
  favorecido_email: '',
  finalidade: '',
  justificativa: '',
  valor_solicitado: 0,
  data_pagamento: '',
  data_limite_prestacao: '',
  centro_custo: '',
  centro_custo_id: '',
  classe_financeira: '',
  classe_financeira_id: '',
  observacoes: '',
}

type FavorecidoOption = SelectOption & {
  email?: string
}

export default function DespesasAdiantamentos() {
  const { dark } = useTheme()
  const { perfil } = useAuth()
  const { data: adiantamentos = [], error: adiantamentosError } = useAdiantamentosDespesa()
  const { data: centros = [] } = useCadCentrosCusto()
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const { data: colaboradoresAtivos = [] } = useRHColaboradores({ ativo: true })
  const { data: fornecedoresAtivos = [] } = useCadFornecedores({ ativo: true })
  const criar = useCriarSolicitacaoAdiantamento()
  const adiantamentosIndisponiveis = isDespesaSchemaMissing(adiantamentosError)

  const [showModal, setShowModal] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const favorecidoOptions = useMemo<FavorecidoOption[]>(() => {
    const colaboradores = colaboradoresAtivos.map(colaborador => {
      const tipoContrato = (colaborador.tipo_contrato || 'CLT').toUpperCase()
      const tipoLabel = tipoContrato === 'PJ' ? 'Colaborador PJ' : 'Funcionário'
      return {
        value: `colaborador:${colaborador.id}`,
        label: colaborador.nome,
        code: tipoLabel,
        description: [colaborador.email, colaborador.cargo, colaborador.cnpj_pj].filter(Boolean).join(' • '),
        email: colaborador.email,
      }
    })

    const fornecedores = fornecedoresAtivos.map(fornecedor => ({
      value: `fornecedor:${fornecedor.id}`,
      label: fornecedor.nome_fantasia?.trim() || fornecedor.razao_social,
      code: 'PJ',
      description: [fornecedor.razao_social, fornecedor.cnpj, fornecedor.email].filter(Boolean).join(' • '),
      email: fornecedor.email,
    }))

    return [...colaboradores, ...fornecedores].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [colaboradoresAtivos, fornecedoresAtivos])

  useEffect(() => {
    if (!showModal || form.favorecido_key) return

    const colaboradorAtual = colaboradoresAtivos.find(colaborador => colaborador.perfil_id === perfil?.id)
    if (!colaboradorAtual) return

    setForm(prev => ({
      ...prev,
      favorecido_key: `colaborador:${colaboradorAtual.id}`,
      favorecido_nome: colaboradorAtual.nome,
      favorecido_email: colaboradorAtual.email || '',
    }))
  }, [showModal, form.favorecido_key, colaboradoresAtivos, perfil?.id])

  const stats = useMemo(() => ({
    solicitado: adiantamentos.filter(item => item.status === 'solicitado').length,
    aprovado: adiantamentos.filter(item => item.status === 'aprovado').length,
    total: adiantamentos.reduce((sum, item) => sum + Number(item.valor_solicitado), 0),
  }), [adiantamentos])

  const inputCls = `w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition ${dark
    ? 'border-white/10 bg-white/[0.04] text-slate-200 placeholder:text-slate-500'
    : 'border-slate-200 bg-white text-slate-700 placeholder:text-slate-400'
  }`

  async function handleSubmit() {
    if (!form.finalidade.trim() || Number(form.valor_solicitado) <= 0) {
      setErro('Preencha a finalidade e o valor solicitado.')
      return
    }
    if (!form.favorecido_nome.trim()) {
      setErro('Selecione o favorecido da solicitação.')
      return
    }
    if (!form.centro_custo || !form.classe_financeira) {
      setErro('Selecione centro de custo e classe financeira.')
      return
    }
    if (adiantamentosIndisponiveis) {
      setErro('Fluxo de adiantamentos ainda está em implantação no banco de dados.')
      return
    }

    setErro('')
    try {
      await criar.mutateAsync({
        favorecido_nome: form.favorecido_nome,
        favorecido_email: form.favorecido_email || undefined,
        finalidade: form.finalidade,
        justificativa: form.justificativa,
        valor_solicitado: Number(form.valor_solicitado),
        data_pagamento: form.data_pagamento || undefined,
        data_limite_prestacao: form.data_limite_prestacao || undefined,
        centro_custo: form.centro_custo,
        centro_custo_id: form.centro_custo_id || undefined,
        classe_financeira: form.classe_financeira,
        classe_financeira_id: form.classe_financeira_id || undefined,
        observacoes: form.observacoes,
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Adiantamentos</h1>
          <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            Solicitação para aprovação do gestor. Depois de aprovada, a despesa entra no financeiro como conta a pagar do favorecido.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErro('')
            setForm(EMPTY_FORM)
            setShowModal(true)
          }}
          disabled={adiantamentosIndisponiveis}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <Plus size={16} />
          Nova Solicitação
        </button>
      </div>

      {adiantamentosIndisponiveis && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${dark ? 'border-amber-500/20 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          O layout do fluxo já está pronto, mas as solicitações serão liberadas depois que a migration de adiantamentos for aplicada no banco.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`rounded-3xl border p-5 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 text-slate-500"><Wallet size={16} /> Total solicitado</div>
          <p className={`mt-3 text-3xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{fmt(stats.total)}</p>
        </div>
        <div className={`rounded-3xl border p-5 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 text-amber-500"><Clock3 size={16} /> Aguardando gestor</div>
          <p className={`mt-3 text-3xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{stats.solicitado}</p>
        </div>
        <div className={`rounded-3xl border p-5 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-2 text-emerald-500"><CheckCircle2 size={16} /> Aprovados</div>
          <p className={`mt-3 text-3xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{stats.aprovado}</p>
        </div>
      </div>

      <div className={`overflow-hidden rounded-3xl border ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
        <div className={`grid grid-cols-[1fr,1.4fr,1fr,1fr,1fr,0.9fr] gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
          <span>Número</span>
          <span>Finalidade</span>
          <span>Solicitante</span>
          <span>Favorecido</span>
          <span>Valor</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {adiantamentos.length === 0 && (
            <div className={`px-5 py-12 text-center text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Nenhuma solicitação de adiantamento cadastrada ainda.
            </div>
          )}
          {adiantamentos.map(item => (
            <div key={item.id} className="grid grid-cols-[1fr,1.4fr,1fr,1fr,1fr,0.9fr] gap-4 px-5 py-4 text-sm">
              <div>
                <p className={`font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{item.numero}</p>
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(item.data_solicitacao).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.finalidade}</p>
                {item.justificativa && (
                  <p className={`mt-1 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{item.justificativa}</p>
                )}
              </div>
              <div>
                <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.solicitante_nome || 'Usuário não identificado'}</p>
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{item.gestor_nome || 'Gestor não identificado'}</p>
              </div>
              <div>
                <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.favorecido_nome}</p>
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{item.gestor_nome || 'Gestor não identificado'}</p>
              </div>
              <div>
                <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{fmt(Number(item.valor_solicitado))}</p>
                {item.centro_custo && (
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{item.centro_custo}</p>
                )}
              </div>
              <div className="flex items-start">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className={`w-full max-w-2xl rounded-[28px] border p-6 shadow-2xl ${dark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>Solicitação de Adiantamento</h2>
                <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  O gestor do solicitante receberá a aprovação no Aprova Aí.
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className={`rounded-full p-2 ${dark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Solicitante</label>
                <input value={perfil?.nome || ''} disabled className={`${inputCls} opacity-70`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Favorecido</label>
                <SearchableSelect
                  options={favorecidoOptions}
                  value={form.favorecido_key}
                  onChange={value => {
                    const selected = favorecidoOptions.find(option => option.value === value)
                    setForm(prev => ({
                      ...prev,
                      favorecido_key: value,
                      favorecido_nome: selected?.label || '',
                      favorecido_email: selected?.email || '',
                    }))
                  }}
                  placeholder="Buscar funcionário ativo ou PJ..."
                />
                <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Funcionários ativos e PJs cadastrados ficam disponíveis nesta busca.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Finalidade</label>
                <textarea rows={3} value={form.finalidade} onChange={e => setForm(prev => ({ ...prev, finalidade: e.target.value }))} className={inputCls} placeholder="Descreva o motivo do adiantamento" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Justificativa</label>
                <textarea rows={3} value={form.justificativa} onChange={e => setForm(prev => ({ ...prev, justificativa: e.target.value }))} className={inputCls} placeholder="Contexto para o gestor aprovar" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Valor solicitado</label>
                <NumericInput value={form.valor_solicitado} onChange={value => setForm(prev => ({ ...prev, valor_solicitado: value }))} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Data de pagamento</label>
                <input type="date" value={form.data_pagamento} onChange={e => setForm(prev => ({ ...prev, data_pagamento: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Limite para prestação</label>
                <input type="date" value={form.data_limite_prestacao} onChange={e => setForm(prev => ({ ...prev, data_limite_prestacao: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Centro de custo</label>
                <select
                  value={form.centro_custo_id}
                  onChange={e => {
                    const selected = centros.find(item => item.id === e.target.value)
                    setForm(prev => ({
                      ...prev,
                      centro_custo_id: e.target.value,
                      centro_custo: selected?.codigo || selected?.descricao || '',
                    }))
                  }}
                  className={inputCls}
                >
                  <option value="">Selecione</option>
                  {centros.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.codigo ? `${item.codigo} - ${item.descricao || item.codigo}` : item.descricao}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Classe financeira</label>
                <select
                  value={form.classe_financeira_id}
                  onChange={e => {
                    const selected = classes.find(item => item.id === e.target.value)
                    setForm(prev => ({
                      ...prev,
                      classe_financeira_id: e.target.value,
                      classe_financeira: selected?.codigo || selected?.descricao || '',
                    }))
                  }}
                  className={inputCls}
                >
                  <option value="">Selecione</option>
                  {classes.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.codigo ? `${item.codigo} - ${item.descricao || item.codigo}` : item.descricao}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Observações</label>
                <textarea rows={2} value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))} className={inputCls} placeholder="Informações complementares para o financeiro" />
              </div>
            </div>

            {erro && (
              <div className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${dark ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {erro}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={criar.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                <Send size={15} />
                {criar.isPending ? 'Enviando...' : 'Enviar para aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
