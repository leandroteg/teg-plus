import { useEffect, useState } from 'react'
import { Coins, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useImpostosPedido, useSalvarImpostosPedido, type ImpostosPedido, type TipoNota } from '../hooks/useImpostosPedido'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  pedidoId: string
  temProduto: boolean
  temServico: boolean
  dark: boolean
}

function NumField({ label, value, onChange, prefix, suffix }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">{prefix}</span>}
        <input
          type="number" step={0.01} min={0}
          value={value || ''}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className={`w-full border border-slate-200 rounded-lg ${prefix ? 'pl-7' : 'pl-2'} ${suffix ? 'pr-7' : 'pr-2'} py-1.5 text-xs focus:ring-2 focus:ring-teal-300 outline-none`}
          placeholder="0,00"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-300 outline-none uppercase"
        placeholder={placeholder}
      />
    </div>
  )
}

function FormProduto({ initial, onSave, saving }: {
  initial: Partial<ImpostosPedido>
  onSave: (d: Partial<ImpostosPedido>) => void
  saving: boolean
}) {
  const [d, setD] = useState<Partial<ImpostosPedido>>(initial)
  useEffect(() => setD(initial), [initial.id])

  const total =
    (d.valor_total_nota ?? 0) ||
    (d.base_calculo_icms ?? 0) + (d.valor_ipi ?? 0) + (d.valor_frete ?? 0) + (d.valor_seguro ?? 0) + (d.outras_despesas ?? 0) - (d.valor_desconto ?? 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TextField label="NF Numero" value={d.nf_numero ?? ''} onChange={v => setD({ ...d, nf_numero: v })} />
        <TextField label="Serie" value={d.nf_serie ?? ''} onChange={v => setD({ ...d, nf_serie: v })} />
        <TextField label="Chave de Acesso" value={d.nf_chave_acesso ?? ''} onChange={v => setD({ ...d, nf_chave_acesso: v })} placeholder="44 digitos" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Data Emissao</label>
          <input type="date" value={d.data_emissao ?? ''} onChange={e => setD({ ...d, data_emissao: e.target.value })}
            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-300 outline-none" />
        </div>
        <NumField label="Valor Total NF" value={d.valor_total_nota ?? 0} onChange={v => setD({ ...d, valor_total_nota: v })} prefix="R$" />
        <NumField label="Outras Despesas" value={d.outras_despesas ?? 0} onChange={v => setD({ ...d, outras_despesas: v })} prefix="R$" />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-2">ICMS</p>
        <div className="grid grid-cols-4 gap-2">
          <NumField label="BC ICMS" value={d.base_calculo_icms ?? 0} onChange={v => setD({ ...d, base_calculo_icms: v })} prefix="R$" />
          <NumField label="Valor ICMS" value={d.valor_icms ?? 0} onChange={v => setD({ ...d, valor_icms: v })} prefix="R$" />
          <NumField label="BC ICMS ST" value={d.base_calculo_icms_st ?? 0} onChange={v => setD({ ...d, base_calculo_icms_st: v })} prefix="R$" />
          <NumField label="ICMS ST" value={d.valor_icms_st ?? 0} onChange={v => setD({ ...d, valor_icms_st: v })} prefix="R$" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-2">Demais Tributos</p>
        <div className="grid grid-cols-4 gap-2">
          <NumField label="IPI" value={d.valor_ipi ?? 0} onChange={v => setD({ ...d, valor_ipi: v })} prefix="R$" />
          <NumField label="PIS" value={d.valor_pis ?? 0} onChange={v => setD({ ...d, valor_pis: v })} prefix="R$" />
          <NumField label="COFINS" value={d.valor_cofins ?? 0} onChange={v => setD({ ...d, valor_cofins: v })} prefix="R$" />
          <NumField label="Desconto" value={d.valor_desconto ?? 0} onChange={v => setD({ ...d, valor_desconto: v })} prefix="R$" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <NumField label="Frete" value={d.valor_frete ?? 0} onChange={v => setD({ ...d, valor_frete: v })} prefix="R$" />
          <NumField label="Seguro" value={d.valor_seguro ?? 0} onChange={v => setD({ ...d, valor_seguro: v })} prefix="R$" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-500">Total estimado da NF: <strong className="text-sky-700">{fmt(total)}</strong></span>
        <button onClick={() => onSave(d)} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
        </button>
      </div>
    </div>
  )
}

function FormServico({ initial, onSave, saving }: {
  initial: Partial<ImpostosPedido>
  onSave: (d: Partial<ImpostosPedido>) => void
  saving: boolean
}) {
  const [d, setD] = useState<Partial<ImpostosPedido>>(initial)
  useEffect(() => setD(initial), [initial.id])

  const totalRetencoes =
    (d.valor_iss_retido ?? 0) + (d.valor_inss_retido ?? 0) + (d.valor_ir_retido ?? 0) +
    (d.valor_csll_retido ?? 0) + (d.valor_pis_retido ?? 0) + (d.valor_cofins_retido ?? 0)
  const liquido = (d.valor_total_nota ?? 0) - totalRetencoes

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TextField label="NFS-e Numero" value={d.nf_numero ?? ''} onChange={v => setD({ ...d, nf_numero: v })} />
        <TextField label="Codigo Verificacao" value={d.nf_chave_acesso ?? ''} onChange={v => setD({ ...d, nf_chave_acesso: v })} />
        <NumField label="Valor Total NFS-e" value={d.valor_total_nota ?? 0} onChange={v => setD({ ...d, valor_total_nota: v })} prefix="R$" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Data Emissao</label>
        <input type="date" value={d.data_emissao ?? ''} onChange={e => setD({ ...d, data_emissao: e.target.value })}
          className="w-48 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-300 outline-none" />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">ISS</p>
          <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
            <input type="checkbox" checked={d.iss_retido ?? false} onChange={e => setD({ ...d, iss_retido: e.target.checked })} className="rounded" />
            ISS Retido
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <NumField label="BC ISS" value={d.base_calculo_iss ?? 0} onChange={v => setD({ ...d, base_calculo_iss: v })} prefix="R$" />
          <NumField label="Aliquota" value={d.aliquota_iss ?? 0} onChange={v => setD({ ...d, aliquota_iss: v })} suffix="%" />
          <NumField label="ISS Devido" value={d.valor_iss ?? 0} onChange={v => setD({ ...d, valor_iss: v })} prefix="R$" />
          <NumField label="ISS Retido" value={d.valor_iss_retido ?? 0} onChange={v => setD({ ...d, valor_iss_retido: v })} prefix="R$" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-2">Retencoes Federais (PCC + IR + INSS)</p>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="PIS Retido" value={d.valor_pis_retido ?? 0} onChange={v => setD({ ...d, valor_pis_retido: v })} prefix="R$" />
          <NumField label="COFINS Retido" value={d.valor_cofins_retido ?? 0} onChange={v => setD({ ...d, valor_cofins_retido: v })} prefix="R$" />
          <NumField label="CSLL Retido" value={d.valor_csll_retido ?? 0} onChange={v => setD({ ...d, valor_csll_retido: v })} prefix="R$" />
          <NumField label="IRRF" value={d.valor_ir_retido ?? 0} onChange={v => setD({ ...d, valor_ir_retido: v })} prefix="R$" />
          <NumField label="INSS Retido" value={d.valor_inss_retido ?? 0} onChange={v => setD({ ...d, valor_inss_retido: v })} prefix="R$" />
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Bruto</p>
          <p className="font-bold text-slate-700">{fmt(d.valor_total_nota ?? 0)}</p>
        </div>
        <div>
          <p className="text-slate-500">Total Retencoes</p>
          <p className="font-bold text-red-600">−{fmt(totalRetencoes)}</p>
        </div>
        <div>
          <p className="text-slate-500">Liquido a Pagar</p>
          <p className="font-extrabold text-emerald-600">{fmt(liquido)}</p>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2 border-t border-slate-100">
        <button onClick={() => onSave(d)} disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar
        </button>
      </div>
    </div>
  )
}

export default function PedidoImpostosSection({ pedidoId, temProduto, temServico, dark }: Props) {
  const { data: impostos = [] } = useImpostosPedido(pedidoId)
  const salvar = useSalvarImpostosPedido()
  const [open, setOpen] = useState(false)

  const find = (tipo: TipoNota): Partial<ImpostosPedido> =>
    impostos.find(i => i.tipo_nota === tipo) ?? { pedido_id: pedidoId, tipo_nota: tipo }

  if (!temProduto && !temServico) return null

  const txt = dark ? 'text-slate-300' : 'text-slate-600'
  const brd = dark ? 'border-white/10' : 'border-slate-200'

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide mb-2 ${txt} hover:opacity-80 transition`}
      >
        <span className="flex items-center gap-1">
          <Coins size={11} /> Impostos
          {impostos.length > 0 && (
            <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 normal-case">
              {impostos.length} preenchido(s)
            </span>
          )}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="space-y-4">
          {temProduto && (
            <div className={`rounded-xl border overflow-hidden ${brd}`}>
              <div className={`px-3 py-2 ${dark ? 'bg-sky-500/10' : 'bg-sky-50'} flex items-center justify-between`}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-700">NF de Produto</span>
                <span className="text-[10px] text-slate-500">ICMS / IPI / PIS / COFINS</span>
              </div>
              <div className="p-3 bg-white">
                <FormProduto
                  initial={find('nf_produto')}
                  onSave={d => salvar.mutate({ ...d, pedido_id: pedidoId, tipo_nota: 'nf_produto' } as ImpostosPedido)}
                  saving={salvar.isPending}
                />
              </div>
            </div>
          )}

          {temServico && (
            <div className={`rounded-xl border overflow-hidden ${brd}`}>
              <div className={`px-3 py-2 ${dark ? 'bg-violet-500/10' : 'bg-violet-50'} flex items-center justify-between`}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700">NFS-e</span>
                <span className="text-[10px] text-slate-500">ISS + retencoes federais</span>
              </div>
              <div className="p-3 bg-white">
                <FormServico
                  initial={find('nfs_e')}
                  onSave={d => salvar.mutate({ ...d, pedido_id: pedidoId, tipo_nota: 'nfs_e' } as ImpostosPedido)}
                  saving={salvar.isPending}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
