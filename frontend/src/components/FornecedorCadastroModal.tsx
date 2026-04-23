import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Loader2, X } from 'lucide-react'
import { UpperInput } from './UpperInput'
import { useSalvarFornecedor } from '../hooks/useCadastros'
import { useConsultaCNPJ } from '../hooks/useConsultas'
import {
  formatCNPJ,
  getFornecedorPaymentMissingFields,
  hasFornecedorPaymentData,
  normalizeDigits,
} from '../hooks/useFornecedorVinculo'
import type { Fornecedor } from '../types/financeiro'

export type FornecedorFormData = Partial<Fornecedor> & {
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
}

interface FornecedorCadastroModalProps {
  open: boolean
  dark?: boolean
  title: string
  description?: string
  initialData: FornecedorFormData
  requirePaymentData?: boolean
  onClose: () => void
  onSaved: (fornecedor: Fornecedor) => void
}

const EMPTY_FORM: FornecedorFormData = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  telefone: '',
  email: '',
  contato_nome: '',
  banco_nome: '',
  agencia: '',
  conta: '',
  boleto: false,
  pix_chave: '',
  pix_tipo: '',
  ativo: true,
}

export default function FornecedorCadastroModal({
  open,
  dark = false,
  title,
  description,
  initialData,
  requirePaymentData = false,
  onClose,
  onSaved,
}: FornecedorCadastroModalProps) {
  const salvarFornecedor = useSalvarFornecedor()
  const [form, setForm] = useState<FornecedorFormData>(EMPTY_FORM)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_FORM, ...initialData })
    setErrorMessage(null)
  }, [open, initialData])

  const cnpjLookup = useConsultaCNPJ(useCallback((result) => {
    setForm(prev => ({
      ...prev,
      razao_social: result.razao_social || prev.razao_social,
      nome_fantasia: result.nome_fantasia || prev.nome_fantasia,
      telefone: result.telefone || prev.telefone,
      email: result.email || prev.email,
      cep: result.endereco?.cep || prev.cep,
      endereco: result.endereco?.logradouro ? [result.endereco.logradouro, result.endereco.numero].filter(Boolean).join(', ') : prev.endereco,
      cidade: result.endereco?.cidade || prev.cidade,
      uf: result.endereco?.uf || prev.uf,
    }))
  }, []))

  useEffect(() => {
    if (!open) return
    const cnpj = normalizeDigits(initialData.cnpj)
    if (cnpj.length === 14) {
      void cnpjLookup.consultar(cnpj)
    }
  }, [open, initialData.cnpj, cnpjLookup])

  const bg = dark ? 'bg-[#0f172a]' : 'bg-white'
  const border = dark ? 'border-white/10' : 'border-slate-200'
  const text = dark ? 'text-white' : 'text-slate-800'
  const subtext = dark ? 'text-slate-400' : 'text-slate-500'
  const input = dark
    ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500'
    : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'

  const missingPaymentFields = useMemo(() => getFornecedorPaymentMissingFields(form), [form])
  const paymentReady = useMemo(() => hasFornecedorPaymentData(form), [form])

  const setField = (field: keyof FornecedorFormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrorMessage(null)
  }

  const handleSave = async () => {
    const cnpjDigits = normalizeDigits(form.cnpj)

    if (!form.razao_social?.trim()) {
      setErrorMessage('Informe a razão social do fornecedor.')
      return
    }

    if (cnpjDigits.length !== 14) {
      setErrorMessage('Informe um CNPJ válido com 14 dígitos.')
      return
    }

    if (requirePaymentData && !paymentReady) {
      setErrorMessage(`Preencha os dados de pagamento para continuar: ${missingPaymentFields.join(', ')}.`)
      return
    }

    const payload = {
      ...form,
      cnpj: cnpjDigits,
      ativo: form.ativo ?? true,
    }

    try {
      const saved = await salvarFornecedor.mutateAsync(payload)
      onSaved(saved)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar fornecedor.'
      setErrorMessage(message)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className={`${bg} w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border ${border}`}
      >
        <div className={`sticky top-0 z-10 ${bg} px-6 py-4 border-b ${border} flex items-start justify-between gap-4`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                <Building2 size={18} className={dark ? 'text-teal-300' : 'text-teal-600'} />
              </div>
              <div>
                <p className={`text-base font-bold ${text}`}>{title}</p>
                {description && <p className={`text-xs mt-0.5 ${subtext}`}>{description}</p>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>Razão Social *</label>
              <UpperInput value={form.razao_social ?? ''} onChange={(event) => setField('razao_social', event.target.value)} placeholder="Razão social" className={`input-base ${input}`} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>Nome Fantasia</label>
              <UpperInput value={form.nome_fantasia ?? ''} onChange={(event) => setField('nome_fantasia', event.target.value)} placeholder="Nome fantasia" className={`input-base ${input}`} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>CNPJ *</label>
              <div className="relative">
                <input
                  value={form.cnpj ?? ''}
                  onChange={(event) => setField('cnpj', event.target.value)}
                  onBlur={() => cnpjLookup.consultar(form.cnpj ?? '')}
                  placeholder="00.000.000/0000-00"
                  className={`input-base pr-24 ${input}`}
                />
                {cnpjLookup.loading && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-semibold ${dark ? 'text-teal-300' : 'text-teal-600'}`}>
                    <Loader2 size={12} className="animate-spin" />
                    Buscando
                  </div>
                )}
              </div>
              {cnpjLookup.erro && <p className="mt-1 text-[11px] text-red-500">{cnpjLookup.erro}</p>}
              {cnpjLookup.dados && !cnpjLookup.erro && (
                <p className="mt-1 text-[11px] text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  {cnpjLookup.dados.situacao}
                </p>
              )}
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>Contato</label>
              <UpperInput value={form.contato_nome ?? ''} onChange={(event) => setField('contato_nome', event.target.value)} placeholder="Nome do contato" className={`input-base ${input}`} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>Telefone</label>
              <UpperInput value={form.telefone ?? ''} onChange={(event) => setField('telefone', event.target.value)} placeholder="(00) 00000-0000" className={`input-base ${input}`} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${subtext}`}>E-mail</label>
              <input value={form.email ?? ''} onChange={(event) => setField('email', event.target.value)} placeholder="financeiro@empresa.com" className={`input-base ${input}`} />
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-bold ${text}`}>Dados de pagamento</p>
                <p className={`text-xs mt-1 ${subtext}`}>
                  {requirePaymentData
                    ? 'Este pedido só pode ser emitido com fornecedor completo para pagamento.'
                    : 'Preencha conta bancária ou PIX para usar este fornecedor no Financeiro.'}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${paymentReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {paymentReady ? 'Completo' : 'Pendente'}
              </span>
            </div>

            <label className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold ${text}`}>
              <input
                type="checkbox"
                checked={Boolean(form.boleto)}
                onChange={(event) => setField('boleto', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Recebe por boleto
            </label>
            <p className={`text-[11px] mt-1 ${subtext}`}>
              Ao marcar boleto, Banco, Agência, Conta e PIX deixam de ser obrigatórios.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${subtext}`}>Banco</label>
                <UpperInput value={form.banco_nome ?? ''} disabled={Boolean(form.boleto)} onChange={(event) => setField('banco_nome', event.target.value)} placeholder="Banco" className={`input-base ${input} ${form.boleto ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${subtext}`}>Agência</label>
                <UpperInput value={form.agencia ?? ''} disabled={Boolean(form.boleto)} onChange={(event) => setField('agencia', event.target.value)} placeholder="0000" className={`input-base ${input} ${form.boleto ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${subtext}`}>Conta</label>
                <UpperInput value={form.conta ?? ''} disabled={Boolean(form.boleto)} onChange={(event) => setField('conta', event.target.value)} placeholder="00000-0" className={`input-base ${input} ${form.boleto ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${subtext}`}>Chave PIX</label>
                <input value={form.pix_chave ?? ''} disabled={Boolean(form.boleto)} onChange={(event) => setField('pix_chave', event.target.value)} placeholder="Chave PIX" className={`input-base ${input} ${form.boleto ? 'opacity-60 cursor-not-allowed' : ''}`} />
              </div>
              <div>
                <label className={`block text-xs font-bold mb-1 ${subtext}`}>Tipo PIX</label>
                <select value={form.pix_tipo ?? ''} disabled={Boolean(form.boleto)} onChange={(event) => setField('pix_tipo', event.target.value)} className={`input-base ${input} ${form.boleto ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <option value="">Selecione</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatória</option>
                </select>
              </div>
              <div className={`rounded-xl px-3 py-3 border ${dark ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-white'}`}>
                <p className={`text-[11px] font-semibold ${subtext}`}>Resumo</p>
                <p className={`text-xs mt-1 ${text}`}>{paymentReady ? 'Fornecedor pronto para pagamento.' : `Pendências: ${missingPaymentFields.join(', ')}`}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50'}`}>
            <div>
              <p className={`text-xs font-semibold ${text}`}>Prévia do cadastro</p>
              <p className={`text-[11px] mt-0.5 ${subtext}`}>
                {form.razao_social?.trim() || 'Razão social pendente'}{form.cnpj ? ` • ${formatCNPJ(form.cnpj)}` : ''}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${paymentReady ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {paymentReady ? 'Pagamento OK' : 'Cadastro em edição'}
            </span>
          </div>

          {errorMessage && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</div>}
        </div>

        <div className={`px-6 py-4 border-t ${border} flex items-center justify-end gap-2`}>
          <button onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${dark ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={salvarFornecedor.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm inline-flex items-center gap-2">
            {salvarFornecedor.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Salvar fornecedor
          </button>
        </div>
      </div>
    </div>
  )
}
