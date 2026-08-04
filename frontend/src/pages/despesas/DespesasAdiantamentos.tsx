import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Wallet, CheckCircle2, Clock3, XCircle, Send, AlertCircle, ChevronRight, Save, Loader2, Paperclip, FileText, KeyRound, Printer, Pencil } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCadCentrosCusto, useCadClasses, useCadFornecedores } from '../../hooks/useCadastros'
import {
  isDespesaSchemaMissing, useAdiantamentosDespesa, useCriarSolicitacaoAdiantamento,
  useAtualizarClasseAdiantamento, useAnexosAdiantamento, useAtualizarAdiantamento,
  useAnexarDocumentosAdiantamento, podeEditarAdiantamento,
} from '../../hooks/useDespesas'
import { useRHColaboradores } from '../../hooks/useRH'
import NumericInput from '../../components/NumericInput'
import { UpperTextarea } from '../../components/UpperInput'
import SearchableSelect from '../../components/SearchableSelect'
import type { SelectOption } from '../../components/SearchableSelect'
import type { StatusDespesaAdiantamento } from '../../types'
import { imprimirTermoAdiantamento } from '../../utils/termoAdiantamento'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function addBusinessDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  let added = 0
  while (added < days) {
    date.setDate(date.getDate() + 1)
    const dow = date.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}


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
  chave_pix: '',
  banco: '',
  finalidade: '',
  justificativa: '',
  valor_solicitado: 0,
  data_pagamento: '',
  data_limite_prestacao: '',
  centro_custo: '',
  centro_custo_id: '',
  observacoes: '',
}

type FavorecidoOption = SelectOption & {
  email?: string
}


export default function DespesasAdiantamentos() {
  const { dark } = useTheme()
  const { perfil, isAdmin } = useAuth()
  // Solicitar EM NOME DE OUTRO: só comprador (setor de Compras) e admin.
  // Os demais continuam pedindo apenas para si — favorecido travado no próprio nome.
  const podeLancarParaOutros = isAdmin || Boolean((perfil as any)?.comprador)
  const { data: adiantamentos = [], error: adiantamentosError } = useAdiantamentosDespesa()
  const { data: centros = [] } = useCadCentrosCusto()
  const { data: classes = [] } = useCadClasses({ tipo: 'despesa' })
  const { data: colaboradoresAtivos = [] } = useRHColaboradores({ ativo: true })
  const { data: fornecedoresAtivos = [] } = useCadFornecedores({ ativo: true })
  const criar = useCriarSolicitacaoAdiantamento()
  const atualizarClasse = useAtualizarClasseAdiantamento()
  const adiantamentosIndisponiveis = isDespesaSchemaMissing(adiantamentosError)

  // Resizable columns
  const adTableRef = useRef<HTMLDivElement>(null)
  const adColWidthsRef = useRef<number[]>([])
  const AD_COLS_DEFAULT = '1fr 1.4fr 1fr 1fr 1fr 1fr 0.9fr'
  const startAdColResize = useCallback((colIndex: number, startX: number) => {
    const container = adTableRef.current
    if (!container) return
    const cells = Array.from(container.querySelectorAll<HTMLElement>('[data-adh]'))
    const startWidths = cells.length > 0
      ? cells.map(el => el.getBoundingClientRect().width)
      : adColWidthsRef.current.length > 0
        ? [...adColWidthsRef.current]
        : [160, 220, 160, 160, 120, 120]
    adColWidthsRef.current = startWidths
    const onMove = (e: MouseEvent) => {
      const next = startWidths.map((w, i) => i === colIndex ? Math.max(60, w + (e.clientX - startX)) : w)
      adColWidthsRef.current = next
      container.style.setProperty('--ad-cols', next.map(w => `${w}px`).join(' '))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    document.body.style.setProperty('cursor', 'col-resize')
    document.body.style.setProperty('user-select', 'none')
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const [showModal, setShowModal] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [arquivos, setArquivos] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Abre o modal automaticamente quando vier ?nova= na URL (fluxo do requisitante)
  useEffect(() => {
    if (searchParams.has('nova')) {
      setShowModal(true)
      const next = new URLSearchParams(searchParams)
      next.delete('nova')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [detalheItem, setDetalheItem] = useState<typeof adiantamentos[0] | null>(null)
  const [detalheClasseId, setDetalheClasseId] = useState('')
  const [detalheErroCls, setDetalheErroCls] = useState('')

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
    if (colaboradorAtual) {
      setForm(prev => ({
        ...prev,
        favorecido_key: `colaborador:${colaboradorAtual.id}`,
        favorecido_nome: colaboradorAtual.nome,
        favorecido_email: colaboradorAtual.email || '',
      }))
      return
    }

    // Sem cadastro no RH: quem não pode escolher outro favorecido ainda precisa
    // conseguir pedir p/ si — usa o próprio perfil (campo fica travado na tela).
    if (!podeLancarParaOutros && perfil?.nome) {
      setForm(prev => ({
        ...prev,
        favorecido_nome: perfil.nome,
        favorecido_email: perfil.email || '',
      }))
    }
  }, [showModal, form.favorecido_key, colaboradoresAtivos, perfil?.id, perfil?.nome, perfil?.email, podeLancarParaOutros])

  useEffect(() => {
    if (!form.data_pagamento) {
      setForm(prev => ({ ...prev, data_limite_prestacao: '' }))
      return
    }
    const limite = addBusinessDays(form.data_pagamento, 5)
    setForm(prev => ({ ...prev, data_limite_prestacao: limite }))
  }, [form.data_pagamento])


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
    if (!form.centro_custo) {
      setErro('Selecione o centro de custo.')
      return
    }
    if (adiantamentosIndisponiveis) {
      setErro('Fluxo de adiantamentos ainda está em implantação no banco de dados.')
      return
    }

    setErro('')
    try {
      const criado = await criar.mutateAsync({
        favorecido_nome: form.favorecido_nome,
        favorecido_email: form.favorecido_email || undefined,
        chave_pix: form.chave_pix || undefined,
        banco: form.banco || undefined,
        arquivos,
        finalidade: form.finalidade,
        justificativa: form.justificativa,
        valor_solicitado: Number(form.valor_solicitado),
        data_pagamento: form.data_pagamento || undefined,
        data_limite_prestacao: form.data_limite_prestacao || undefined,
        centro_custo: form.centro_custo,
        centro_custo_id: form.centro_custo_id || undefined,
        observacoes: form.observacoes,
      })
      setShowModal(false)

      // Termo de repasse abre na hora para assinatura (substitui o do Totvs RM)
      imprimirTermoAdiantamento({
        numero: criado?.numero ?? '',
        favorecido_nome: form.favorecido_nome,
        favorecido_email: form.favorecido_email || undefined,
        valor_solicitado: Number(form.valor_solicitado),
        finalidade: form.finalidade,
        justificativa: form.justificativa,
        observacoes: form.observacoes,
        chave_pix: form.chave_pix,
        banco: form.banco,
        centro_custo: form.centro_custo,
        data_pagamento: form.data_pagamento || undefined,
        data_limite_prestacao: form.data_limite_prestacao || undefined,
        solicitante_nome: perfil?.nome,
      }, perfil?.nome).catch(() => { /* impressão é best-effort */ })

      setForm(EMPTY_FORM)
      setArquivos([])
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

      <div
        ref={adTableRef}
        style={{ '--ad-cols': adColWidthsRef.current.length ? adColWidthsRef.current.map(w => `${w}px`).join(' ') : AD_COLS_DEFAULT } as Record<string, string>}
        className={`overflow-x-auto rounded-3xl border ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}
      >
        <div
          className={`grid gap-4 border-b px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${dark ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-500'}`}
          style={{ gridTemplateColumns: 'var(--ad-cols)' }}
        >
          <span className="relative" data-adh>Número
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(0, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span className="relative" data-adh>Finalidade
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(1, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span className="relative" data-adh>Solicitante
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(2, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span className="relative" data-adh>Gestor
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(3, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span className="relative" data-adh>Favorecido
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(4, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span className="relative" data-adh>Valor
            <div className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center group/rh z-10" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startAdColResize(5, e.clientX) }}>
              <div className="w-0.5 h-5 rounded-full bg-slate-400 opacity-20 group-hover/rh:opacity-100 group-hover/rh:bg-indigo-500 transition-all" />
            </div>
          </span>
          <span data-adh>Status</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {adiantamentos.length === 0 && (
            <div className={`px-5 py-12 text-center text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Nenhuma solicitação de adiantamento cadastrada ainda.
            </div>
          )}
          {adiantamentos.map(item => {
            const semClasse = !item.classe_financeira && item.status !== 'rejeitado' && item.status !== 'concluido'
            return (
              <div
                key={item.id}
                onClick={() => {
                  setDetalheItem(item)
                  setDetalheClasseId(item.classe_financeira_id || '')
                  setDetalheErroCls('')
                }}
                className={`grid gap-4 px-5 py-4 text-sm cursor-pointer transition-colors ${dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
                style={{ gridTemplateColumns: 'var(--ad-cols)' }}
              >
                <div>
                  <p className={`font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{item.numero}</p>
                  <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(item.data_solicitacao).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.finalidade}</p>
                  {semClasse && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <AlertCircle size={10} /> Classe não definida
                    </span>
                  )}
                </div>
                <div>
                  <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.solicitante_nome || 'Usuário não identificado'}</p>
                </div>
                <div>
                  <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.gestor_nome || '—'}</p>
                </div>
                <div>
                  <p className={`${dark ? 'text-slate-200' : 'text-slate-700'}`}>{item.favorecido_nome}</p>
                </div>
                <div>
                  <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{fmt(Number(item.valor_solicitado))}</p>
                  {item.centro_custo && (
                    <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{item.centro_custo}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  <ChevronRight size={14} className={dark ? 'text-slate-600' : 'text-slate-300'} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {detalheItem && (
        <DetalheAdiantamento
          item={detalheItem}
          dark={dark}
          classes={classes}
          classeId={detalheClasseId}
          setClasseId={setDetalheClasseId}
          erroClasse={detalheErroCls}
          setErroClasse={setDetalheErroCls}
          salvando={atualizarClasse.isPending}
          onSalvarClasse={async () => {
            const selecionada = classes.find(c => c.id === detalheClasseId)
            if (!selecionada) { setDetalheErroCls('Selecione a classe financeira.'); return }
            try {
              await atualizarClasse.mutateAsync({
                id: detalheItem.id,
                classe_financeira: selecionada.codigo || selecionada.descricao || '',
                classe_financeira_id: selecionada.id,
              })
              setDetalheErroCls('')
              setDetalheItem(null)
            } catch (e) {
              setDetalheErroCls(e instanceof Error ? e.message : 'Erro ao salvar a classe.')
            }
          }}
          onClose={() => setDetalheItem(null)}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className={`w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[28px] border p-6 shadow-2xl ${dark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'}`}>
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
                {podeLancarParaOutros ? (
                  <>
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
                      Você pode solicitar em nome de outra pessoa: a aprovação vai para o gestor do favorecido.
                    </p>
                  </>
                ) : (
                  <>
                    <input value={form.favorecido_nome || perfil?.nome || ''} disabled className={`${inputCls} opacity-70`} />
                    <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Solicitação em nome de outra pessoa é feita pelo setor de Compras.
                    </p>
                  </>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Finalidade</label>
                <UpperTextarea rows={3} value={form.finalidade} onChange={e => setForm(prev => ({ ...prev, finalidade: e.target.value }))} className={inputCls} placeholder="Descreva o motivo do adiantamento" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Justificativa</label>
                <UpperTextarea rows={3} value={form.justificativa} onChange={e => setForm(prev => ({ ...prev, justificativa: e.target.value }))} className={inputCls} placeholder="Contexto para o gestor aprovar" />
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Limite para prestação
                  <span className={`ml-1.5 font-normal ${dark ? 'text-slate-500' : 'text-slate-400'}`}>(5 dias úteis após o pagamento)</span>
                </label>
                <input
                  type="date"
                  value={form.data_limite_prestacao}
                  readOnly
                  disabled={!form.data_pagamento}
                  className={`${inputCls} cursor-default opacity-70`}
                />
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Chave PIX do favorecido
                  <span className={`ml-1.5 font-normal ${dark ? 'text-slate-500' : 'text-slate-400'}`}>(opcional)</span>
                </label>
                <input
                  value={form.chave_pix}
                  onChange={e => setForm(prev => ({ ...prev, chave_pix: e.target.value }))}
                  className={inputCls}
                  placeholder="CPF/CNPJ, e-mail, telefone ou chave aleatória"
                />
                <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Vai junto para o Financeiro na conta a pagar gerada após a aprovação.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Banco
                  <span className={`ml-1.5 font-normal ${dark ? 'text-slate-500' : 'text-slate-400'}`}>(opcional)</span>
                </label>
                <input
                  value={form.banco}
                  onChange={e => setForm(prev => ({ ...prev, banco: e.target.value }))}
                  className={inputCls}
                  placeholder="Ex.: 341 Itaú / Nubank / Caixa"
                />
                <p className={`mt-1 text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sai no termo de repasse junto com a chave PIX.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Observações</label>
                <UpperTextarea rows={2} value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))} className={inputCls} placeholder="Informações complementares para o financeiro" />
              </div>

              {/* Anexos da solicitação (orçamento, comprovante, autorização...) */}
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Documentos
                  <span className={`ml-1.5 font-normal ${dark ? 'text-slate-500' : 'text-slate-400'}`}>(opcional)</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 transition ${
                    dark ? 'border-white/10 bg-white/[0.03] hover:border-emerald-400/40' : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40'
                  }`}
                >
                  <Paperclip size={18} className={dark ? 'text-slate-400' : 'text-slate-400'} />
                  <div className="min-w-0">
                    <p className={`text-sm ${dark ? 'text-slate-300' : 'text-slate-600'}`}>Clique para anexar</p>
                    <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      PDF, JPG, PNG, XLS, XLSX — pode escolher mais de um
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                  className="hidden"
                  onChange={e => {
                    const novos = Array.from(e.target.files ?? [])
                    if (novos.length) setArquivos(prev => [...prev, ...novos])
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                />
                {arquivos.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {arquivos.map((arquivo, i) => (
                      <div
                        key={`${arquivo.name}-${i}`}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 ${dark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}
                      >
                        <FileText size={14} className="shrink-0 text-emerald-500" />
                        <span className={`min-w-0 flex-1 truncate text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {arquivo.name}
                        </span>
                        <span className={`shrink-0 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {(arquivo.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setArquivos(prev => prev.filter((_, idx) => idx !== i))}
                          className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

// ── Detalhe do adiantamento: PIX, documentos anexados e classe financeira ────

function DetalheAdiantamento({
  item, dark, classes, classeId, setClasseId, erroClasse, setErroClasse,
  salvando, onSalvarClasse, onClose,
}: {
  item: { id: string; numero: string; finalidade: string; favorecido_nome: string; solicitante_nome?: string
    solicitante_id?: string | null
    favorecido_email?: string | null; justificativa?: string | null; observacoes?: string | null
    gestor_nome?: string | null; valor_solicitado: number; status: StatusDespesaAdiantamento
    centro_custo?: string | null; classe_financeira?: string | null; chave_pix?: string | null; banco?: string | null
    data_pagamento?: string | null; data_limite_prestacao?: string | null; fin_conta_pagar_id?: string | null }
  dark: boolean
  classes: { id: string; codigo?: string | null; descricao?: string | null }[]
  classeId: string
  setClasseId: (v: string) => void
  erroClasse: string
  setErroClasse: (v: string) => void
  salvando: boolean
  onSalvarClasse: () => void
  onClose: () => void
}) {
  const { data: anexos = [] } = useAnexosAdiantamento(item.id)
  const { perfil, isAdmin } = useAuth()
  const atualizar = useAtualizarAdiantamento()
  const anexarDocs = useAnexarDocumentosAdiantamento()
  const linha = `flex items-start justify-between gap-4 py-2 text-sm`
  const rotulo = dark ? 'text-slate-400' : 'text-slate-500'
  const valor = dark ? 'text-slate-100' : 'text-slate-800'

  // Só o criador (ou admin) mexe. Depois de aprovado, valor/favorecido ficam
  // travados — o adiantamento já virou conta a pagar no Financeiro.
  const podeEditar = podeEditarAdiantamento(item, perfil?.id, isAdmin)
  const jaAprovado = !['solicitado', 'rascunho'].includes(item.status)
  const [editando, setEditando] = useState(false)
  const [msgEdicao, setMsgEdicao] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    finalidade: item.finalidade ?? '',
    justificativa: item.justificativa ?? '',
    observacoes: item.observacoes ?? '',
    chave_pix: item.chave_pix ?? '',
    banco: item.banco ?? '',
    favorecido_nome: item.favorecido_nome ?? '',
    valor_solicitado: Number(item.valor_solicitado) || 0,
  })

  const salvarEdicao = async () => {
    setMsgEdicao(null)
    try {
      await atualizar.mutateAsync({ id: item.id, status: item.status, campos: form })
      setMsgEdicao({ tipo: 'ok', texto: 'Alterações salvas.' })
      setEditando(false)
    } catch (e) {
      setMsgEdicao({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' })
    }
  }

  const enviarAnexos = async (files: FileList | null) => {
    const arquivos = Array.from(files ?? [])
    if (arquivos.length === 0) return
    setMsgEdicao(null)
    try {
      await anexarDocs.mutateAsync({ adiantamentoId: item.id, arquivos })
      setMsgEdicao({ tipo: 'ok', texto: `${arquivos.length} documento(s) anexado(s).` })
    } catch (e) {
      setMsgEdicao({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao anexar.' })
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className={`w-full max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-[28px] border p-6 shadow-2xl ${dark ? 'border-white/10 bg-slate-950' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>{item.numero}</h2>
            <p className={`mt-1 break-words text-sm ${rotulo}`}>{item.finalidade}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => imprimirTermoAdiantamento({
                numero: item.numero,
                favorecido_nome: item.favorecido_nome,
                favorecido_email: item.favorecido_email,
                valor_solicitado: Number(item.valor_solicitado),
                finalidade: item.finalidade,
                justificativa: item.justificativa,
                observacoes: item.observacoes,
                chave_pix: item.chave_pix,
                banco: item.banco,
                centro_custo: item.centro_custo,
                data_pagamento: item.data_pagamento,
                data_limite_prestacao: item.data_limite_prestacao,
                solicitante_nome: item.solicitante_nome,
              })}
              title="Imprimir termo de repasse"
              className={`rounded-full p-2 ${dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Printer size={17} />
            </button>
            {podeEditar && !editando && (
              <button
                type="button"
                onClick={() => { setEditando(true); setMsgEdicao(null) }}
                title="Editar solicitação"
                className={`rounded-full p-2 ${dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Pencil size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} className={`rounded-full p-2 ${dark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}>
              <XCircle size={18} />
            </button>
          </div>
        </div>

        {/* Edição pelo criador */}
        {editando && (
          <div className={`mt-4 rounded-2xl border p-4 space-y-3 ${dark ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'}`}>
            <p className={`text-xs font-bold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              Editando a solicitação
            </p>
            {jaAprovado && (
              <p className={`text-[11px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                Já aprovada: valor e favorecido ficam travados (viraram conta a pagar).
                Para mudar isso, o Financeiro precisa cancelar o título.
              </p>
            )}

            {!jaAprovado && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Favorecido</label>
                  <input
                    value={form.favorecido_nome}
                    onChange={e => setForm(p => ({ ...p, favorecido_nome: e.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Valor</label>
                  <NumericInput
                    value={form.valor_solicitado}
                    onChange={v => setForm(p => ({ ...p, valor_solicitado: v }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Finalidade</label>
              <UpperTextarea
                rows={2}
                value={form.finalidade}
                onChange={e => setForm(p => ({ ...p, finalidade: e.target.value }))}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Chave PIX</label>
                <input
                  value={form.chave_pix}
                  onChange={e => setForm(p => ({ ...p, chave_pix: e.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Banco</label>
                <input
                  value={form.banco}
                  onChange={e => setForm(p => ({ ...p, banco: e.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                />
              </div>
            </div>
            <div>
              <label className={`mb-1 block text-[11px] font-semibold ${rotulo}`}>Observações</label>
              <UpperTextarea
                rows={2}
                value={form.observacoes}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditando(false)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${dark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-500 hover:bg-white'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={atualizar.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {atualizar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salvar alterações
              </button>
            </div>
          </div>
        )}

        {msgEdicao && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
            msgEdicao.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>{msgEdicao.texto}</p>
        )}

        <div className={`mt-4 divide-y ${dark ? 'divide-white/5' : 'divide-slate-100'}`}>
          <div className={linha}><span className={rotulo}>Favorecido</span><span className={`font-semibold ${valor}`}>{item.favorecido_nome}</span></div>
          <div className={linha}><span className={rotulo}>Valor</span><span className={`font-bold ${valor}`}>{fmt(Number(item.valor_solicitado))}</span></div>
          <div className={linha}><span className={rotulo}>Solicitante</span><span className={valor}>{item.solicitante_nome || '—'}</span></div>
          <div className={linha}><span className={rotulo}>Gestor aprovador</span><span className={valor}>{item.gestor_nome || '—'}</span></div>
          {item.centro_custo && (
            <div className={linha}><span className={rotulo}>Centro de custo</span><span className={valor}>{item.centro_custo}</span></div>
          )}
          {item.data_pagamento && (
            <div className={linha}><span className={rotulo}>Pagamento</span><span className={valor}>{new Date(item.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span></div>
          )}
          {item.data_limite_prestacao && (
            <div className={linha}><span className={rotulo}>Prestar contas até</span><span className={valor}>{new Date(item.data_limite_prestacao + 'T00:00:00').toLocaleDateString('pt-BR')}</span></div>
          )}
          <div className={linha}>
            <span className={`flex shrink-0 items-center gap-1.5 ${rotulo}`}><KeyRound size={13} /> Chave PIX</span>
            <span className={`min-w-0 break-all text-right font-mono text-xs ${item.chave_pix ? valor : dark ? 'text-slate-600' : 'text-slate-300'}`}>
              {item.chave_pix || 'não informada'}
            </span>
          </div>
          {item.banco && (
            <div className={linha}><span className={rotulo}>Banco</span><span className={valor}>{item.banco}</span></div>
          )}
          {item.fin_conta_pagar_id && (
            <div className={linha}>
              <span className={rotulo}>Financeiro</span>
              <span className="text-right text-xs font-semibold text-emerald-500">Conta a pagar gerada (Confirmados)</span>
            </div>
          )}
        </div>

        {/* Documentos anexados */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${rotulo}`}>
              <Paperclip size={12} /> Documentos ({anexos.length})
            </p>
            {podeEditar && (
              <>
                <button
                  type="button"
                  onClick={() => arquivoRef.current?.click()}
                  disabled={anexarDocs.isPending}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-60 ${
                    dark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {anexarDocs.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Anexar
                </button>
                <input
                  ref={arquivoRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx"
                  className="hidden"
                  onChange={e => enviarAnexos(e.target.files)}
                />
              </>
            )}
          </div>
          {anexos.length === 0 ? (
            <p className={`text-xs italic ${dark ? 'text-slate-600' : 'text-slate-400'}`}>Nenhum documento anexado.</p>
          ) : (
            <div className="space-y-1.5">
              {anexos.map(anexo => (
                <a
                  key={anexo.id}
                  href={anexo.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${dark ? 'bg-white/[0.04] hover:bg-white/[0.08]' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  <FileText size={14} className="shrink-0 text-emerald-500" />
                  <span className={`min-w-0 flex-1 truncate text-xs ${valor}`}>{anexo.nome_arquivo}</span>
                  {anexo.tamanho_bytes != null && (
                    <span className={`shrink-0 text-[10px] ${rotulo}`}>{(anexo.tamanho_bytes / 1024).toFixed(0)} KB</span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Classe financeira — necessária para a contabilização da CP */}
        <div className={`mt-4 rounded-2xl border p-3 ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'}`}>
          <label className={`mb-1.5 block text-xs font-semibold ${rotulo}`}>
            Classe financeira {item.classe_financeira ? '' : '— pendente'}
          </label>
          {/* min-w-0 no select: sem isso a opcao longa estoura o flex e joga o
              botao Salvar pra fora da tela (o modal ganhava scroll horizontal) */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classeId}
              onChange={e => { setClasseId(e.target.value); setErroClasse('') }}
              className={`min-w-0 flex-1 basis-48 truncate rounded-2xl border px-3 py-2 text-sm outline-none ${dark ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              <option value="">Selecione</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} - ${c.descricao || ''}` : c.descricao}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSalvarClasse}
              disabled={salvando}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
          {erroClasse && <p className="mt-1.5 text-xs text-rose-500">{erroClasse}</p>}
        </div>
      </div>
    </div>
  )
}
