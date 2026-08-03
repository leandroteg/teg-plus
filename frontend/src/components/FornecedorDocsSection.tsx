import { useRef, useState } from 'react'
import { FileText, Upload, Trash2, Loader2, Download, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { FornecedorDocTipo } from '../types/financeiro'
import {
  DOC_TIPOS, docTipoLabel, isCnpj, cartaoCnpjValido, getAnexoUrl,
  useFornecedorAnexos, useUploadFornecedorAnexo, useRemoverFornecedorAnexo,
  type StagedDoc,
} from '../hooks/useFornecedorDocs'

interface Props {
  dark?: boolean
  /** Fornecedor já existente: uploads são imediatos. Ausente = cadastro novo (staged). */
  fornecedorId?: string | null
  cnpj?: string | null
  staged: StagedDoc[]
  onStagedChange: (next: StagedDoc[]) => void
}

const fmtSize = (b?: number | null) =>
  b == null ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`

const fmtDate = (d?: string | null) => {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

export default function FornecedorDocsSection({ dark = false, fornecedorId, cnpj, staged, onStagedChange }: Props) {
  const isExisting = Boolean(fornecedorId)
  const { data: anexos = [], isLoading } = useFornecedorAnexos(fornecedorId)
  const upload = useUploadFornecedorAnexo()
  const remover = useRemoverFornecedorAnexo()

  const [tipo, setTipo] = useState<FornecedorDocTipo>('cartao_cnpj')
  const [dataEmissao, setDataEmissao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const exigeEmissao = DOC_TIPOS.find(d => d.value === tipo)?.exigeEmissao
  const cnpjFornecedor = isCnpj(cnpj)

  const text = dark ? 'text-slate-200' : 'text-slate-700'
  const subtext = dark ? 'text-slate-400' : 'text-slate-500'
  const cardCls = dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'
  const inputCls = `text-sm rounded-lg border px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
    dark ? 'bg-white/[0.03] border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
  }`

  async function handlePick(file: File | undefined) {
    setErro(null)
    if (!file) return
    if (exigeEmissao && !dataEmissao) {
      setErro('Informe a data de emissão do Cartão CNPJ antes de anexar.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setErro('Arquivo maior que 15 MB.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    if (isExisting) {
      try {
        await upload.mutateAsync({ fornecedorId: fornecedorId as string, tipo, file, data_emissao: dataEmissao || undefined })
        setDataEmissao('')
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao anexar.')
      }
    } else {
      onStagedChange([
        ...staged,
        { tempId: crypto.randomUUID(), tipo, file, data_emissao: dataEmissao || undefined },
      ])
      setDataEmissao('')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function abrir(path: string) {
    try {
      const url = await getAnexoUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch {
      setErro('Não foi possível abrir o arquivo.')
    }
  }

  const temCartaoValido =
    anexos.some(a => a.tipo === 'cartao_cnpj' && cartaoCnpjValido(a.data_emissao)) ||
    staged.some(s => s.tipo === 'cartao_cnpj' && cartaoCnpjValido(s.data_emissao))

  return (
    <div className={`rounded-2xl border p-4 ${cardCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-bold ${text}`}>
            Documentos{cnpjFornecedor && <span className="text-red-500"> *</span>}
          </p>
          <p className={`text-xs mt-0.5 ${subtext}`}>
            {cnpjFornecedor
              ? 'Cartão CNPJ obrigatório para fornecedor com CNPJ. Certidões e contrato social são opcionais. PDF ou imagem, até 15 MB.'
              : 'Cartão CNPJ, certidões, contrato social. PDF ou imagem, até 15 MB.'}
          </p>
        </div>
        {cnpjFornecedor && (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
            temCartaoValido ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {temCartaoValido ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {temCartaoValido ? 'Cartão CNPJ ok' : 'Cartão CNPJ pendente'}
          </span>
        )}
      </div>

      {cnpjFornecedor && !temCartaoValido && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 flex items-start gap-1.5">
          <AlertTriangle size={13} className="shrink-0 mt-px" />
          <span>Fornecedor com CNPJ exige o <strong>Cartão CNPJ</strong> emitido nos últimos 90 dias para poder salvar.</span>
        </div>
      )}

      {/* Adicionar documento */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${subtext}`}>Tipo</label>
          <select value={tipo} onChange={e => { setTipo(e.target.value as FornecedorDocTipo); setErro(null) }} className={inputCls}>
            {DOC_TIPOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        {exigeEmissao && (
          <div className="flex flex-col">
            <label className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${subtext}`}>Emissão *</label>
            <input type="date" max={new Date().toISOString().split('T')[0]} value={dataEmissao}
              onChange={e => { setDataEmissao(e.target.value); setErro(null) }} className={inputCls} />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {upload.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Anexar
        </button>
        <input ref={fileRef} type="file" className="hidden"
          accept="application/pdf,image/*"
          onChange={e => handlePick(e.target.files?.[0])} />
      </div>

      {erro && <p className="mt-2 text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> {erro}</p>}

      {/* Lista */}
      <div className="mt-4 space-y-1.5">
        {isLoading && isExisting && (
          <p className={`text-xs ${subtext} flex items-center gap-1.5`}><Loader2 size={12} className="animate-spin" /> Carregando…</p>
        )}

        {anexos.map(a => {
          const vencido = a.tipo === 'cartao_cnpj' && !cartaoCnpjValido(a.data_emissao)
          return (
            <div key={a.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
              <FileText size={14} className={subtext} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold truncate ${text}`}>{a.nome}</p>
                <p className={`text-[10px] ${subtext} flex items-center gap-1.5`}>
                  <span>{docTipoLabel(a.tipo)}</span>
                  {a.tamanho_bytes && <span>· {fmtSize(a.tamanho_bytes)}</span>}
                  {a.data_emissao && <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {fmtDate(a.data_emissao)}</span>}
                  {vencido && <span className="text-amber-600 font-bold">· vencido</span>}
                </p>
              </div>
              <button type="button" onClick={() => abrir(a.storage_path)} title="Abrir"
                className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <Download size={13} />
              </button>
              <button type="button" onClick={() => remover.mutate(a)} disabled={remover.isPending} title="Remover"
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}

        {staged.map(s => (
          <div key={s.tempId} className={`flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 ${dark ? 'border-white/15' : 'border-slate-300'}`}>
            <FileText size={14} className="text-teal-500" />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold truncate ${text}`}>{s.file.name}</p>
              <p className={`text-[10px] ${subtext} flex items-center gap-1.5`}>
                <span>{docTipoLabel(s.tipo)}</span>
                <span>· {fmtSize(s.file.size)}</span>
                {s.data_emissao && <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {fmtDate(s.data_emissao)}</span>}
                <span className="text-teal-600 font-bold">· será enviado ao salvar</span>
              </p>
            </div>
            <button type="button" onClick={() => onStagedChange(staged.filter(x => x.tempId !== s.tempId))} title="Remover"
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {!isLoading && anexos.length === 0 && staged.length === 0 && (
          <p className={`text-[11px] ${subtext} py-1`}>Nenhum documento anexado.</p>
        )}
      </div>
    </div>
  )
}
