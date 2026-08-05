import { formatCpfCnpj, normalizeDigits } from '../../hooks/useFornecedorVinculo'
import { UpperInput } from '../UpperInput'
import type { DadosPagamento, TipoPessoaFavorecido } from '../../types/financeiro'

/**
 * Bloco "Dados para pagamento" — favorecido, documento, banco/agência/conta e
 * PIX. Nasceu dentro do Pagamento Extraordinário (CPPipeline) e virou
 * componente quando o pedido de compra passou a coletar os mesmos dados na
 * liberação para pagamento: é a mesma informação, tem que sair igual dos dois
 * lados e cair no mesmo fin_contas_pagar.dados_pagamento.
 */

export type TipoPessoa = '' | TipoPessoaFavorecido

export const tipoPessoaPorDocumento = (documento?: string | null): TipoPessoa => {
  const len = normalizeDigits(documento).length
  if (len === 11) return 'pf'
  if (len === 14) return 'pj'
  return ''
}

export const pixEhDocumento = (pixTipo?: string | null) => pixTipo === 'cpf' || pixTipo === 'cnpj'
export const pixTipoDoDocumento = (tipo: TipoPessoa) => (tipo === 'pf' ? 'cpf' : tipo === 'pj' ? 'cnpj' : '')

export const labelDocumento = (tipo: TipoPessoa) =>
  tipo === 'pf' ? 'CPF do favorecido' : tipo === 'pj' ? 'CNPJ do favorecido' : 'CPF/CNPJ do favorecido'

export const placeholderDocumento = (tipo: TipoPessoa) =>
  tipo === 'pf' ? '000.000.000-00' : tipo === 'pj' ? '00.000.000/0000-00' : 'CPF ou CNPJ de quem recebe'

/** Máscara do documento, cortando no tamanho de um CNPJ. */
export const mascararDocumento = (valor: string) => formatCpfCnpj(normalizeDigits(valor).slice(0, 14))

/** Opções de Tipo PIX: PF não oferece CNPJ e PJ não oferece CPF. */
export function OpcoesTipoPix({ tipoPessoa }: { tipoPessoa: TipoPessoa }) {
  return (
    <>
      <option value="">Selecione...</option>
      {tipoPessoa !== 'pj' && <option value="cpf">CPF</option>}
      {tipoPessoa !== 'pf' && <option value="cnpj">CNPJ</option>}
      <option value="email">E-mail</option>
      <option value="telefone">Telefone</option>
      <option value="aleatoria">Chave aleatória</option>
    </>
  )
}

export interface DadosPagamentoForm {
  favorecido: string
  favorecido_tipo: TipoPessoa
  favorecido_documento: string
  banco_nome: string
  agencia: string
  conta: string
  pix_tipo: string
  pix_chave: string
}

export const DADOS_PAGAMENTO_VAZIO: DadosPagamentoForm = {
  favorecido: '', favorecido_tipo: '', favorecido_documento: '',
  banco_nome: '', agencia: '', conta: '', pix_tipo: '', pix_chave: '',
}

/** Pré-preenche a partir do cadastro do fornecedor/beneficiário. */
export function dadosPagamentoDoFornecedor(f?: {
  razao_social?: string | null
  cnpj?: string | null
  banco_nome?: string | null
  agencia?: string | null
  conta?: string | null
  pix_tipo?: string | null
  pix_chave?: string | null
} | null): DadosPagamentoForm {
  if (!f) return DADOS_PAGAMENTO_VAZIO
  const documento = formatCpfCnpj(normalizeDigits(f.cnpj))
  const tipoPessoa = tipoPessoaPorDocumento(f.cnpj)
  const pixTipo = f.pix_tipo ?? ''
  return {
    favorecido: f.razao_social ?? '',
    favorecido_tipo: tipoPessoa,
    favorecido_documento: documento,
    banco_nome: f.banco_nome ?? '',
    agencia: f.agencia ?? '',
    conta: f.conta ?? '',
    // Chave de documento não se digita duas vezes: é o CPF/CNPJ do favorecido.
    pix_tipo: pixEhDocumento(pixTipo) && tipoPessoa ? pixTipoDoDocumento(tipoPessoa) : pixTipo,
    pix_chave: pixEhDocumento(pixTipo) ? documento : (f.pix_chave ?? ''),
  }
}

/** Só manda para o banco o que foi preenchido — `{}` significa "não informado". */
export function toDadosPagamento(form: DadosPagamentoForm): DadosPagamento {
  const limpo = (v: string) => v.trim() || undefined
  const dados: DadosPagamento = {
    favorecido: limpo(form.favorecido),
    favorecido_tipo: form.favorecido_tipo || undefined,
    favorecido_documento: limpo(form.favorecido_documento),
    banco_nome: limpo(form.banco_nome),
    agencia: limpo(form.agencia),
    conta: limpo(form.conta),
    pix_tipo: limpo(form.pix_tipo),
    pix_chave: pixEhDocumento(form.pix_tipo) ? limpo(form.favorecido_documento) : limpo(form.pix_chave),
  }
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined)) as DadosPagamento
}

export const temDadosPagamento = (form: DadosPagamentoForm) =>
  Object.keys(toDadosPagamento(form)).length > 0

export function DadosPagamentoFields({
  form,
  onChange,
  dark = false,
  descricao = 'Vêm do cadastro do fornecedor. Ajuste aqui se o pagamento for para outra conta — a alteração vale só para este pagamento.',
}: {
  form: DadosPagamentoForm
  onChange: (patch: Partial<DadosPagamentoForm>) => void
  dark?: boolean
  descricao?: string
}) {
  const labelCls = `block text-[10px] font-bold uppercase tracking-wide mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`
  const inputCls = `w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-300 ${
    dark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-700'
  }`

  // Trocar PF/PJ reescreve o tipo de chave PIX quando ela é o documento —
  // senão sobra "chave CNPJ" num favorecido que virou pessoa física.
  const aplicarTipoPessoa = (tipo: TipoPessoa) => {
    onChange({
      favorecido_tipo: tipo,
      pix_tipo: pixEhDocumento(form.pix_tipo) ? pixTipoDoDocumento(tipo) : form.pix_tipo,
    })
  }

  const aplicarDocumento = (valor: string) => {
    const doc = mascararDocumento(valor)
    const tipo = tipoPessoaPorDocumento(doc) || form.favorecido_tipo
    onChange({
      favorecido_documento: doc,
      favorecido_tipo: tipo,
      pix_chave: pixEhDocumento(form.pix_tipo) ? doc : form.pix_chave,
      pix_tipo: pixEhDocumento(form.pix_tipo) ? pixTipoDoDocumento(tipo) : form.pix_tipo,
    })
  }

  const aplicarTipoPix = (valor: string) => {
    onChange({
      pix_tipo: valor,
      pix_chave: pixEhDocumento(valor)
        ? form.favorecido_documento
        : pixEhDocumento(form.pix_tipo) ? '' : form.pix_chave,
    })
  }

  return (
    <div className={`rounded-xl border p-3 space-y-3 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'}`}>
      <div>
        <p className={`text-xs font-bold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Dados para pagamento</p>
        <p className={`text-[11px] mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{descricao}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="sm:col-span-2">
          <label className={labelCls}>Favorecido</label>
          <UpperInput value={form.favorecido} onChange={e => onChange({ favorecido: e.target.value })} className={inputCls} placeholder="Nome de quem recebe" />
        </div>
        <div>
          <label className={labelCls}>Favorecido é</label>
          <select value={form.favorecido_tipo} onChange={e => aplicarTipoPessoa(e.target.value as TipoPessoa)} className={inputCls}>
            <option value="">Selecione...</option>
            <option value="pf">Pessoa Física (CPF)</option>
            <option value="pj">Pessoa Jurídica (CNPJ)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{labelDocumento(form.favorecido_tipo)}</label>
          <input
            value={form.favorecido_documento}
            onChange={e => aplicarDocumento(e.target.value)}
            className={inputCls}
            inputMode="numeric"
            maxLength={18}
            placeholder={placeholderDocumento(form.favorecido_tipo)}
          />
        </div>
        <div>
          <label className={labelCls}>Banco</label>
          <UpperInput value={form.banco_nome} onChange={e => onChange({ banco_nome: e.target.value })} className={inputCls} placeholder="Nome do banco" />
        </div>
        <div>
          <label className={labelCls}>Agência</label>
          <UpperInput value={form.agencia} onChange={e => onChange({ agencia: e.target.value })} className={inputCls} placeholder="0001" />
        </div>
        <div>
          <label className={labelCls}>Conta</label>
          <UpperInput value={form.conta} onChange={e => onChange({ conta: e.target.value })} className={inputCls} placeholder="12345-6" />
        </div>
        <div>
          <label className={labelCls}>Tipo PIX</label>
          <select value={form.pix_tipo} onChange={e => aplicarTipoPix(e.target.value)} className={inputCls}>
            <OpcoesTipoPix tipoPessoa={form.favorecido_tipo} />
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Chave PIX</label>
          {pixEhDocumento(form.pix_tipo) ? (
            <>
              <input
                value={form.favorecido_documento}
                onChange={e => aplicarDocumento(e.target.value)}
                className={inputCls}
                inputMode="numeric"
                maxLength={18}
                placeholder={placeholderDocumento(form.favorecido_tipo)}
              />
              <p className={`mt-1 text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Mesma coisa que o {form.favorecido_tipo === 'pj' ? 'CNPJ' : 'CPF'} do favorecido — editar aqui atualiza os dois campos.
              </p>
            </>
          ) : (
            <UpperInput value={form.pix_chave} onChange={e => onChange({ pix_chave: e.target.value })} className={inputCls} placeholder="Informe a chave PIX" />
          )}
        </div>
      </div>
    </div>
  )
}
