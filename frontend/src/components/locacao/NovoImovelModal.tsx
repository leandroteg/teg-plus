import { useState } from 'react'
import {
  X, Loader2, Paperclip, BedDouble, HardHat, Warehouse, Building2, Hotel,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useLookupCentrosCusto, useLookupEmpresas } from '../../hooks/useLookups'

// Tipos de imóvel. HTL (hotel) é hospedagem temporária: sem contrato e com bem menos campos.
const TIPOS: { key: string; label: string; desc: string; icon: typeof BedDouble; color: string }[] = [
  { key: 'ALOJ', label: 'Alojamento',              desc: 'Moradia de equipe com leitos',        icon: BedDouble,  color: 'text-cyan-500' },
  { key: 'CANT', label: 'Canteiro',                desc: 'Canteiro de obras',                   icon: HardHat,    color: 'text-amber-500' },
  { key: 'CD',   label: 'Centro de Distribuição',  desc: 'Almoxarifado / logística',            icon: Warehouse,  color: 'text-violet-500' },
  { key: 'ESC',  label: 'Escritório',              desc: 'Escritório / sede administrativa',    icon: Building2,   color: 'text-blue-500' },
  { key: 'HTL',  label: 'Hotel',                   desc: 'Hospedagem temporária (sem contrato)', icon: Hotel,      color: 'text-rose-500' },
]

interface Props {
  onClose: () => void
  onCreated?: (imovelId: string) => void
  /**
   * true  → "Novo Imóvel": abre a entrada em 'pendente' e o imóvel entra em
   *         'em_entrada'; quem libera é o pipeline (vistoria → relatório).
   * false → "Cadastrar Imóvel": o imóvel já nasce ativo, sem passar pelo fluxo.
   */
  viaFluxo?: boolean
}

export default function NovoImovelModal({ onClose, onCreated, viaFluxo = false }: Props) {
  const { isDark } = useTheme()
  const { perfil } = useAuth()
  const centrosCusto = useLookupCentrosCusto()
  const empresas = useLookupEmpresas()
  const qc = useQueryClient()
  const nav = useNavigate()

  const [step, setStep] = useState<'tipo' | 'form'>('tipo')
  const [tipo, setTipo] = useState<string>('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Campos do imóvel
  const [titulo, setTitulo] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cep, setCep] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [areaM2, setAreaM2] = useState('')
  const [valorAluguel, setValorAluguel] = useState('')
  const [diaVencimento, setDiaVencimento] = useState('')
  const [locadorNome, setLocadorNome] = useState('')
  const [locadorDoc, setLocadorDoc] = useState('')
  const [locadorContato, setLocadorContato] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [centroCustoId, setCentroCustoId] = useState('')
  const [qtdLeitos, setQtdLeitos] = useState('')
  // Contrato (não-HTL)
  const [contratoNumero, setContratoNumero] = useState('')
  const [contratoInicio, setContratoInicio] = useState('')
  const [contratoFim, setContratoFim] = useState('')
  const [contratoPdf, setContratoPdf] = useState<File | null>(null)

  const isHtl = tipo === 'HTL'

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const border = isDark ? 'border-white/[0.06]' : 'border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const txtMuted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-indigo-500'
    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
  const labelCls = `block text-xs font-semibold mb-1 ${txtMuted}`
  const fieldCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none transition-colors ${inputCls}`

  const selectTipo = (t: string) => { setTipo(t); setStep('form') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    // validações mínimas
    if (!isHtl && (!contratoInicio || !contratoFim)) {
      setErro('Informe o início e o fim do contrato.')
      return
    }
    if (!titulo && !endereco) {
      setErro('Informe ao menos o nome/código ou o endereço.')
      return
    }
    setEnviando(true)
    try {
      // Sobe o PDF do contrato (só p/ tipos com contrato)
      let arquivoUrl: string | null = null
      if (!isHtl && contratoPdf) {
        const path = `contratos/${Date.now()}_${contratoPdf.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('contratos-anexos').upload(path, contratoPdf)
        if (!upErr) arquivoUrl = path
      }

      const num = (v: string) => (v.trim() === '' ? null : Number(v))
      const { data, error } = await supabase.rpc('loc_novo_imovel', {
        p_tipo: tipo,
        p_titulo: titulo || null,
        p_descricao: null,
        p_endereco: endereco || null,
        p_numero: numero || null,
        p_complemento: complemento || null,
        p_bairro: bairro || null,
        p_cep: cep || null,
        p_cidade: cidade || null,
        p_uf: uf || null,
        p_area_m2: num(areaM2),
        p_valor_aluguel: num(valorAluguel),
        p_dia_vencimento: num(diaVencimento),
        p_locador_nome: isHtl ? null : (locadorNome || null),
        p_locador_cpf_cnpj: isHtl ? null : (locadorDoc || null),
        p_locador_contato: isHtl ? null : (locadorContato || null),
        p_empresa_id: empresaId || null,
        p_centro_custo_id: centroCustoId || null,
        p_qtd_leitos: qtdLeitos.trim() === '' ? 0 : Number(qtdLeitos),
        p_contrato_numero: isHtl ? null : (contratoNumero || null),
        p_contrato_inicio: isHtl ? null : contratoInicio,
        p_contrato_fim: isHtl ? null : contratoFim,
        p_arquivo_url: arquivoUrl,
        p_criado_por: perfil?.nome ?? null,
        p_via_fluxo: viaFluxo,
      })
      if (error) throw error
      const r = data as { ok: boolean; erro?: string; imovel_id?: string; entrada_id?: string }
      if (!r.ok) { setErro(r.erro || 'Falha ao cadastrar imóvel.'); return }

      // invalida tudo que lista imóveis/leitos/contratos
      ;['loc_imoveis', 'loc_alojamentos', 'loc_leitos', 'loc_imoveis_mapa', 'con_contratos', 'loc_entradas'].forEach(k =>
        qc.invalidateQueries({ queryKey: [k] }))
      if (r.imovel_id) onCreated?.(r.imovel_id)
      onClose()
      // Leva direto para a fila onde a entrada acabou de cair.
      if (viaFluxo && r.entrada_id) nav('/locacoes/entradas')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao cadastrar imóvel.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div>
            <h3 className={`text-base font-bold ${txt}`}>
              {viaFluxo ? 'Novo Imóvel' : 'Cadastrar Imóvel'}
              {step !== 'tipo' && ` — ${TIPOS.find(t => t.key === tipo)?.label}`}
            </h3>
            <p className={`text-xs ${txtMuted}`}>
              {viaFluxo
                ? 'Locação de Imóveis · abre o fluxo de entrada (vistoria → liberação)'
                : 'Locação de Imóveis · cadastro direto, sem passar pelo fluxo'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Step 1: Tipo */}
        {step === 'tipo' && (
          <div className="p-5 grid grid-cols-1 gap-3">
            <p className={`text-xs ${txtMuted} -mb-1`}>Qual o tipo do imóvel?</p>
            {TIPOS.map(({ key, label, desc, icon: Icon, color }) => (
              <button key={key} type="button" onClick={() => selectTipo(key)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:border-indigo-400 ${border} ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-indigo-50'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${txt}`}>{label} <span className={`text-[10px] font-mono ${txtMuted}`}>{key}</span></p>
                  <p className={`text-xs ${txtMuted}`}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Identificação */}
            <div>
              <label className={labelCls}>Nome / Código {isHtl ? '*' : ''}</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder={isHtl ? 'Ex.: Hotel Central' : 'Ex.: ALOJ-ARX-RUA X-100 (opcional)'} className={fieldCls} />
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Endereço</label>
                <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua / Av." className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Número</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Complemento</label>
                <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Bairro</label>
                <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Cidade</label>
                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>UF</label>
                <input type="text" maxLength={2} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>CEP</label>
                <input type="text" value={cep} onChange={e => setCep(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Nº de leitos — sempre disponível */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Nº de leitos</label>
                <input type="number" min={0} value={qtdLeitos} onChange={e => setQtdLeitos(e.target.value)}
                  placeholder="0" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Área (m²)</label>
                <input type="number" min={0} step="0.01" value={areaM2} onChange={e => setAreaM2(e.target.value)} className={fieldCls} />
              </div>
            </div>

            {/* Campos que só valem p/ tipos com contrato (não-HTL) */}
            {!isHtl && (
              <>
                <div className={`h-px ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                {/* Locador */}
                <div>
                  <label className={labelCls}>Locador</label>
                  <input type="text" value={locadorNome} onChange={e => setLocadorNome(e.target.value)} placeholder="Nome do proprietário" className={fieldCls} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>CPF / CNPJ</label>
                    <input type="text" value={locadorDoc} onChange={e => setLocadorDoc(e.target.value)} className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Contato</label>
                    <input type="text" value={locadorContato} onChange={e => setLocadorContato(e.target.value)} placeholder="Telefone / e-mail" className={fieldCls} />
                  </div>
                </div>

                {/* Financeiro */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Aluguel mensal (R$)</label>
                    <input type="number" min={0} step="0.01" value={valorAluguel} onChange={e => setValorAluguel(e.target.value)} className={fieldCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Dia de vencimento</label>
                    <input type="number" min={1} max={31} value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} className={fieldCls} />
                  </div>
                </div>

                {/* Empresa + Centro de custo */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Empresa (locatária)</label>
                    <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={fieldCls}>
                      <option value="">Selecionar...</option>
                      {empresas.map((em: { id: string; razao_social?: string; nome_fantasia?: string }) =>
                        <option key={em.id} value={em.id}>{em.nome_fantasia || em.razao_social}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Centro de custo</label>
                    <select value={centroCustoId} onChange={e => setCentroCustoId(e.target.value)} className={fieldCls}>
                      <option value="">Selecionar...</option>
                      {centrosCusto.map((cc: { id: string; codigo?: string; descricao?: string }) =>
                        <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.descricao}</option>)}
                    </select>
                  </div>
                </div>

                {/* Contrato */}
                <div className={`rounded-xl p-4 space-y-3 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-200'}`}>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Contrato (vai para o módulo Contratos)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>Nº do contrato</label>
                      <input type="text" value={contratoNumero} onChange={e => setContratoNumero(e.target.value)} placeholder="Auto (ALG-…)" className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Início *</label>
                      <input type="date" value={contratoInicio} onChange={e => setContratoInicio(e.target.value)} className={fieldCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Fim *</label>
                      <input type="date" value={contratoFim} onChange={e => setContratoFim(e.target.value)} className={fieldCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Contrato (PDF)</label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${inputCls}`}>
                      <Paperclip size={14} className="shrink-0 opacity-60" />
                      <span className={contratoPdf ? '' : 'opacity-50'}>{contratoPdf ? contratoPdf.name : 'Anexar contrato...'}</span>
                      <input type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setContratoPdf(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {isHtl && (
              <p className={`text-xs ${txtMuted}`}>Hotel é hospedagem temporária: sem contrato e não entra no módulo Contratos.</p>
            )}

            {erro && <p className="text-xs text-rose-500">{erro}</p>}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setStep('tipo'); setErro('') }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                Voltar
              </button>
              <button type="submit" disabled={enviando}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {enviando && <Loader2 size={14} className="animate-spin" />}
                {viaFluxo ? 'Abrir Entrada' : 'Cadastrar Imóvel'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
