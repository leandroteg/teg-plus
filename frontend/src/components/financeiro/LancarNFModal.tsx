// ─────────────────────────────────────────────────────────────────────────────
// components/financeiro/LancarNFModal.tsx — Financeiro › Novo Registro ›
// "Lançar NF Recebimento". A NF já foi emitida fora do sistema (caso da CEMIG),
// então entra direto na etapa NF Emitida em vez de percorrer
// Previsto → Autorizar → Faturar.
//
// A OSC é o eixo: escolhida ela, obra, natureza e centro de custo (polo) vêm
// juntos — os mesmos campos que o lançamento em lote de julho/26 preencheu.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { X, Receipt, Loader2, Search, Upload, Check } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useLancarNFRecebimento, useOscsParaNF } from '../../hooks/useFinanceiro'
import { useLookupEmpresas } from '../../hooks/useLookups'
import { UpperInput } from '../UpperInput'
import {
  TIPOS_DOC_FINANCEIRO, rotuloCurtoDocFin,
  type TipoDocFinanceiro, type ArquivoFinanceiro,
} from '../../types/documentosFin'

const CEMIG = { nome: 'CEMIG DISTRIBUIÇÃO S.A.', cnpj: '06.981.180/0001-16' }
/** prazo padrão da CEMIG — confirmado nas NFs de junho e julho/26 */
const PRAZO_DIAS = 30

const somaDias = (iso: string, d: number) => {
  const dt = new Date(iso + 'T12:00:00')
  dt.setDate(dt.getDate() + d)
  return dt.toISOString().slice(0, 10)
}
const hoje = () => new Date().toISOString().slice(0, 10)
/** "1.234,56" ou "1234.56" → 1234.56 */
const paraNumero = (s: string) => {
  const t = s.replace(/[^\d.,-]/g, '')
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(norm)
  return Number.isFinite(n) ? n : 0
}

export default function LancarNFModal({ onClose, onCriado }: { onClose: () => void; onCriado?: () => void }) {
  const { isLightSidebar: isLight } = useTheme()
  const isDark = !isLight
  const { user } = useAuth()
  const quem = (user as { nome?: string; email?: string } | null)?.nome
    || (user as { email?: string } | null)?.email || 'Financeiro'

  const { data: oscs = [], isLoading: loadOscs } = useOscsParaNF()
  const empresas = useLookupEmpresas()
  const lancar = useLancarNFRecebimento()

  const [cliente, setCliente] = useState(CEMIG.nome)
  const [cnpj, setCnpj] = useState(CEMIG.cnpj)
  const [buscaOsc, setBuscaOsc] = useState('')
  const [oscId, setOscId] = useState('')
  const [nf, setNf] = useState('')
  const [serie, setSerie] = useState('U')
  const [chave, setChave] = useState('')
  const [emissao, setEmissao] = useState(hoje())
  const [venc, setVenc] = useState(somaDias(hoje(), PRAZO_DIAS))
  const [vencManual, setVencManual] = useState(false)
  const [valor, setValor] = useState('')
  const [desconto, setDesconto] = useState('')
  const [jurosMulta, setJurosMulta] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [obs, setObs] = useState('')
  const [danfe, setDanfe] = useState<File | null>(null)
  const [anexos, setAnexos] = useState<ArquivoFinanceiro[]>([])
  const [tipoAnexo, setTipoAnexo] = useState<TipoDocFinanceiro>('recibo')
  const [erro, setErro] = useState<string | null>(null)
  // Dados bancários do cliente pagador (mig 222) — de onde o dinheiro vem,
  // usado na conciliação do extrato e em eventual devolução.
  const [favorecido, setFavorecido] = useState('')
  const [bancoNome, setBancoNome] = useState('')
  const [agencia, setAgencia] = useState('')
  const [conta, setConta] = useState('')
  const [pixTipo, setPixTipo] = useState('')
  const [pixChave, setPixChave] = useState('')

  // vencimento acompanha a emissão até alguém editar à mão
  useEffect(() => { if (!vencManual) setVenc(somaDias(emissao, PRAZO_DIAS)) }, [emissao, vencManual])

  const q = buscaOsc.trim().toLowerCase()
  const filtradas = useMemo(() => (!q ? oscs.slice(0, 40)
    : oscs.filter(o => o.numero_os.toLowerCase().includes(q) || (o.obra_nome ?? '').toLowerCase().includes(q)).slice(0, 40)),
    [oscs, q])
  const osc = oscs.find(o => o.id === oscId)

  const valorNum = paraNumero(valor)
  const descontoNum = paraNumero(desconto)
  const jurosNum = paraNumero(jurosMulta)
  // A receber = valor − desconto + juros/multa (mesma fórmula da CP)
  const valorReceber = Math.max(0, Math.round((valorNum - descontoNum + jurosNum) * 100) / 100)
  const podeSalvar = !!nf.trim() && valorNum > 0 && !!emissao && !!venc && !!empresaId && !lancar.isPending

  const temDadosBanco = [bancoNome, agencia, conta, pixChave].some(v => v.trim())

  async function salvar() {
    setErro(null)
    try {
      await lancar.mutateAsync({
        cliente_nome: cliente.trim(), cliente_cnpj: cnpj.trim() || undefined,
        numero_nf: nf.trim(), serie_nf: serie.trim() || undefined, chave_nfe: chave.trim() || undefined,
        valor_original: valorNum, valor_desconto: descontoNum, valor_juros_multa: jurosNum,
        empresa_id: empresaId || null,
        data_emissao: emissao, data_vencimento: venc,
        osc_id: osc?.id ?? null, projeto_id: osc?.obra_id ?? null,
        natureza: osc?.tipo ? osc.tipo.charAt(0).toUpperCase() + osc.tipo.slice(1) : null,
        centro_custo: osc?.polo ?? null,
        descricao: osc ? `${osc.obra_nome ?? ''} · ${osc.numero_os}`.trim() : undefined,
        observacoes: obs.trim() || undefined,
        criado_por_nome: quem,
        dados_pagamento: {
          // Sem favorecido digitado, o titular é o próprio cliente da NF
          favorecido: favorecido.trim() || (temDadosBanco ? cliente.trim() : ''),
          banco_nome: bancoNome.trim(),
          agencia: agencia.trim(), conta: conta.trim(),
          pix_tipo: pixTipo, pix_chave: pixChave.trim(),
        },
        danfeFile: danfe ?? undefined,
        anexos,
      })
      onCriado?.(); onClose()
    } catch (e) { setErro((e as Error).message) }
  }

  const lab = `block text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`
  const inp = `w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 ${
    isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'}`
  const txt = isDark ? 'text-slate-200' : 'text-slate-700'
  const sub = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[94vh] lg:max-h-[88vh] flex flex-col rounded-t-2xl lg:rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>

        <div className={`flex items-center justify-between gap-2 px-4 py-3 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <span className={`flex items-center gap-2 font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <Receipt size={16} className="text-emerald-500" /> Lançar NF de Recebimento
          </span>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className={`text-[11px] ${sub}`}>
            Para NF já emitida fora do sistema — entra direto na etapa <b className={txt}>NF Emitida</b>.
          </p>

          <div>
            <label className={lab}>Cliente</label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2">
              <input value={cliente} onChange={e => setCliente(e.target.value)} className={inp} placeholder="Razão social" />
              <input value={cnpj} onChange={e => setCnpj(e.target.value)} className={inp} placeholder="CNPJ" />
            </div>
          </div>

          <div>
            <label className={lab}>OSC · traz obra, natureza e centro de custo</label>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white border-slate-200'}`}>
              <Search size={13} className={sub} />
              <input value={buscaOsc} onChange={e => setBuscaOsc(e.target.value)} placeholder="Buscar OSC ou obra…"
                className={`flex-1 min-w-0 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
              {osc && <button onClick={() => { setOscId(''); setBuscaOsc('') }} className={`text-[11px] ${sub} hover:underline`}>limpar</button>}
            </div>
            {osc ? (
              <div className={`mt-2 rounded-xl border px-3 py-2 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className={`text-xs font-bold ${txt}`}><Check size={12} className="inline mr-1 text-emerald-500" />{osc.numero_os}</p>
                <p className={`text-[11px] ${sub}`}>{osc.obra_nome ?? '—'} · {osc.polo ?? 'sem polo'} · {osc.tipo ?? '—'}</p>
              </div>
            ) : loadOscs ? (
              <p className={`text-[11px] mt-2 ${sub}`}><Loader2 size={11} className="inline animate-spin mr-1" /> carregando OSCs…</p>
            ) : (
              <div className={`mt-2 max-h-40 overflow-y-auto rounded-xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                {filtradas.map(o => (
                  <button key={o.id} onClick={() => { setOscId(o.id); setBuscaOsc(o.numero_os) }}
                    className={`w-full text-left px-3 py-1.5 text-xs border-b last:border-0 ${
                      isDark ? 'border-white/[0.05] hover:bg-white/[0.04] text-slate-300' : 'border-slate-100 hover:bg-slate-50 text-slate-700'}`}>
                    <b>{o.numero_os}</b> <span className={sub}>· {o.obra_nome ?? '—'}</span>
                  </button>
                ))}
                {!filtradas.length && <p className={`text-[11px] px-3 py-2 ${sub}`}>Nada encontrado.</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label className={lab}>Nº da NF *</label><input value={nf} onChange={e => setNf(e.target.value)} className={inp} placeholder="584" /></div>
            <div><label className={lab}>Série</label><input value={serie} onChange={e => setSerie(e.target.value)} className={inp} /></div>
            <div className="col-span-2"><label className={lab}>Código de verificação</label><input value={chave} onChange={e => setChave(e.target.value)} className={inp} placeholder="da NFSe" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div><label className={lab}>Emissão *</label><input type="date" value={emissao} onChange={e => setEmissao(e.target.value)} className={inp} /></div>
            <div>
              <label className={lab}>Vencimento *</label>
              <input type="date" value={venc} onChange={e => { setVenc(e.target.value); setVencManual(true) }} className={inp} />
              {!vencManual && <p className={`text-[10px] mt-0.5 ${sub}`}>emissão + {PRAZO_DIAS} dias</p>}
            </div>
            <div><label className={lab}>Valor líquido *</label><input value={valor} onChange={e => setValor(e.target.value)} className={inp} placeholder="0,00" inputMode="decimal" /></div>
          </div>

          {/* Desconto e juros/multa — a receber = valor − desconto + juros */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lab}>Desconto (R$)</label><input value={desconto} onChange={e => setDesconto(e.target.value)} className={inp} placeholder="0,00" inputMode="decimal" /></div>
            <div><label className={lab}>Juros/multa (R$)</label><input value={jurosMulta} onChange={e => setJurosMulta(e.target.value)} className={inp} placeholder="0,00" inputMode="decimal" /></div>
            <div>
              <label className={lab}>A receber</label>
              <div className={`${inp} font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {valorReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          {/* Filial emitente/recebedora (mig 214) */}
          <div>
            <label className={lab}>Filial recebedora *</label>
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.codigo} — {emp.nome_fantasia || emp.razao_social}</option>
              ))}
            </select>
          </div>

          {/* Dados bancários do cliente pagador (mig 222) */}
          <div className={`rounded-xl border p-3 space-y-2 ${isDark ? 'border-white/[0.08] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/70'}`}>
            <div>
              <p className={`text-xs font-bold ${txt}`}>Dados para pagamento do cliente</p>
              <p className={`text-[11px] ${sub}`}>De onde o pagamento vem — ajuda na conciliação do extrato. Opcional.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <label className={lab}>Favorecido / titular da conta</label>
                <UpperInput value={favorecido} onChange={e => setFavorecido(e.target.value)} className={inp} placeholder={cliente || 'Titular da conta'} />
              </div>
              <div><label className={lab}>Banco</label><UpperInput value={bancoNome} onChange={e => setBancoNome(e.target.value)} className={inp} placeholder="Nome do banco" /></div>
              <div><label className={lab}>Agência</label><UpperInput value={agencia} onChange={e => setAgencia(e.target.value)} className={inp} placeholder="0001" /></div>
              <div><label className={lab}>Conta</label><UpperInput value={conta} onChange={e => setConta(e.target.value)} className={inp} placeholder="12345-6" /></div>
              <div>
                <label className={lab}>Tipo PIX</label>
                <select value={pixTipo} onChange={e => setPixTipo(e.target.value)} className={inp}>
                  <option value="">Selecione...</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave aleatória</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lab}>Chave PIX</label>
                <UpperInput value={pixChave} onChange={e => setPixChave(e.target.value)} className={inp} placeholder="Informe a chave PIX" />
              </div>
            </div>
          </div>

          <div>
            <label className={lab}>Observações</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inp}
              placeholder="Bruto, retenções, pedido CEMIG, competência…" />
          </div>

          <div>
            <label className={lab}>DANFE (PDF)</label>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${
              isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
              <Upload size={14} className={sub} />
              <span className="truncate">{danfe ? danfe.name : 'Selecionar arquivo…'}</span>
              <input type="file" accept="application/pdf" className="hidden"
                onChange={e => setDanfe(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          {/* Outros documentos da NF: recibo, boleto, comprovantes */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className={lab}>Outros documentos</label>
              <select value={tipoAnexo} onChange={e => setTipoAnexo(e.target.value as TipoDocFinanceiro)}
                className={`${inp} w-auto py-1 text-xs`}>
                {TIPOS_DOC_FINANCEIRO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm ${
              isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
              <Upload size={14} className={sub} />
              <span className="truncate">Anexar {TIPOS_DOC_FINANCEIRO.find(t => t.value === tipoAnexo)?.label.toLowerCase()}…</span>
              <input type="file" multiple className="hidden"
                onChange={e => {
                  const novos = Array.from(e.target.files ?? []).map(file => ({ file, tipo: tipoAnexo }))
                  if (novos.length) setAnexos(prev => [...prev, ...novos])
                  e.target.value = ''
                }} />
            </label>
            {anexos.length > 0 && (
              <ul className="mt-1 space-y-1">
                {anexos.map((a, i) => (
                  <li key={i} className={`flex items-center justify-between gap-2 text-[11px] rounded-lg px-2 py-1.5 ${isDark ? 'bg-white/[0.04] text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                    <span className="truncate">
                      <span className="font-semibold text-emerald-600 mr-1">{rotuloCurtoDocFin(a.tipo)}</span>
                      {a.file.name}
                    </span>
                    <button type="button" onClick={() => setAnexos(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-500 shrink-0"><X size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erro && <p className="text-xs text-rose-500">{erro}</p>}
        </div>

        <div className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          <button onClick={onClose} className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${isDark ? 'text-slate-400 hover:bg-white/[0.06]' : 'text-slate-500 hover:bg-slate-100'}`}>Cancelar</button>
          <button onClick={salvar} disabled={!podeSalvar}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">
            {lancar.isPending ? <Loader2 size={13} className="animate-spin" /> : <Receipt size={13} />} Lançar em NF Emitida
          </button>
        </div>
      </div>
    </div>
  )
}
